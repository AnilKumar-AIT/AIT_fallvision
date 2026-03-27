"""
DynamoDB Service Layer
======================
Handles all database read/write operations for the facility management platform.

Design notes:
- A single ``DynamoDBService`` class owns every table interaction so callers
  never import boto3 directly.
- Sensitive columns (names, DOB, contact details) are stored encrypted.
  ``_fake_encrypt`` / ``_fake_decrypt`` are placeholder stubs; swap them for a
  real KMS/AES implementation before going to production.
- ``_paginate_query`` transparently handles DynamoDB's 1 MB page limit so
  callers always receive a complete result set.
- Every public method catches its own exceptions, logs them, and returns a safe
  default (``None`` or ``[]``) so a single bad query never crashes a request.
"""

from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional

import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import Binary

from ..config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Placeholder encryption blob dimensions (see _fake_encrypt for format spec).
_ENCRYPT_RANDOM_PREFIX_LEN: int = 32   # bytes of random prefix
_ENCRYPT_PAYLOAD_LEN: int = 64         # 1 length byte + up to 63 data bytes
_ENCRYPT_BLOB_SIZE: int = _ENCRYPT_RANDOM_PREFIX_LEN + _ENCRYPT_PAYLOAD_LEN  # 96

# The maximum number of UTF-8 characters that fit in one encrypted blob.
_ENCRYPT_MAX_CHARS: int = 63

# Sentinel blob used when there is no plaintext to store.
_NULL_BLOB: bytes = b"\x00" * _ENCRYPT_BLOB_SIZE

# Age-bracket boundaries (years).
_AGE_BRACKET_YOUNG_SENIOR: int = 75   # 65–74
_AGE_BRACKET_OLDER_SENIOR: int = 85   # 75–84
                                       # 85+ is the remaining bracket

# Resident sort-key separator used in ``status_name_sort``.
_SORT_SEP: str = "#"

# Protected-field placeholder shown to API callers instead of raw ciphertext.
_REDACTED_ENCRYPTED: str = "[ENCRYPTED]"
_REDACTED_COGNITO: str = "[PROTECTED]"

# Hardcoded table names for tables whose names are not driven by ``settings``.
_TABLE_FALL_EVENTS: str = "fall_events"
_TABLE_FALL_VIDEO_CLIPS: str = "fall_video_clips"
_TABLE_CAREGIVERS: str = "caregivers"
_TABLE_CAREGIVER_CERTS: str = "caregiver_certifications"
_TABLE_CAREGIVER_ASSIGNMENTS: str = "caregiver_resident_assignments"
_TABLE_CAREGIVER_SCHEDULE: str = "caregiver_shift_schedule"
_TABLE_CAREGIVER_PERFORMANCE: str = "caregiver_performance_metrics"

# Roles that receive elevated permissions and full dashboard access.
_ELEVATED_ROLES: frozenset[str] = frozenset({"RN", "NP", "ADMIN"})

# Base permissions granted to every caregiver.
_BASE_PERMISSIONS: List[str] = ["residents:read", "falls:read", "alerts:acknowledge"]

# Additional permissions for elevated roles.
_ELEVATED_PERMISSIONS: List[str] = ["residents:write", "falls:write", "reports:read"]

# Default maximum residents a caregiver can be assigned when not specified.
_DEFAULT_MAX_RESIDENT_LOAD: int = 10

# Hour-of-day buckets used by ``get_fall_analytics``.
_ANALYTICS_HOUR_BUCKETS: List[int] = [0, 3, 6, 9, 12, 15, 18, 21, 23]
_ANALYTICS_TIME_LABELS: List[str] = [
    "12Am", "3Am", "6Am", "9Am", "12Pm", "3Pm", "6Pm", "9Pm", "12Am"
]


# ---------------------------------------------------------------------------
# Service class
# ---------------------------------------------------------------------------

class DynamoDBService:
    """
    Centralised data-access layer for all DynamoDB tables.

    Instantiate once at module level (see ``db_service`` singleton at the
    bottom of this file) and inject / import that instance wherever needed.
    """

    def __init__(self) -> None:
        # High-level resource API – used for Table objects and most operations.
        self.dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
        # Low-level client – kept for any operations not covered by the resource API.
        self.client = boto3.client("dynamodb", region_name=settings.AWS_REGION)

    # =========================================================================
    # SERIALIZATION HELPERS
    # =========================================================================

    def serialize_item(self, obj):
        """
        Recursively convert DynamoDB-specific types so the result can be
        JSON-serialised or returned directly to API callers.

        Conversions applied:
        - ``Decimal``              → ``float``
        - ``Binary`` / ``bytes``   → base64-encoded ``str``
        - ``list`` / ``dict``      → recursed into element-by-element
        """
        if isinstance(obj, list):
            return [self.serialize_item(i) for i in obj]
        if isinstance(obj, dict):
            return {k: self.serialize_item(v) for k, v in obj.items()}
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (Binary, bytes, bytearray)):
            return base64.b64encode(bytes(obj)).decode("utf-8")
        return obj

    # Backwards-compat alias so callers that use the old name still work.
    decimal_to_float = serialize_item

    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================

    @staticmethod
    def _v(val) -> str:
        """
        Normalise a form value: return it unchanged if it is non-empty,
        or return ``'N/A'`` for ``None`` / blank strings.

        This ensures every DynamoDB item has an explicit placeholder rather
        than missing keys or empty strings.
        """
        if val is None:
            return "N/A"
        if isinstance(val, str) and val.strip() == "":
            return "N/A"
        return val

    @staticmethod
    def _fake_encrypt(plaintext: str) -> bytes:
        """
        Reversible placeholder encryption – **NOT suitable for production**.

        Blob layout (96 bytes total):
        ┌──────────────────────┬───────────────┬────────────────────────────┐
        │  32 random bytes     │  1 length byte │  up to 63 plaintext bytes  │
        │  (random IV-like     │  (number of    │  (zero-padded to fill the   │
        │   prefix)            │   data bytes)  │   remaining 63 bytes)       │
        └──────────────────────┴───────────────┴────────────────────────────┘

        When ``plaintext`` is empty or ``'N/A'`` a 96-byte null blob is
        returned so the calling code can always treat the field as binary.

        TODO: Replace with envelope encryption using AWS KMS + AES-256-GCM.
        """
        if not plaintext or plaintext == "N/A":
            return _NULL_BLOB

        # Truncate at 63 UTF-8 bytes to fit within the fixed payload window.
        plaintext_bytes = plaintext.encode("utf-8")[:_ENCRYPT_MAX_CHARS]
        length_byte = bytes([len(plaintext_bytes)])

        # 32 random prefix || 1 length byte || plaintext || zero padding
        payload = length_byte + plaintext_bytes
        blob = os.urandom(_ENCRYPT_RANDOM_PREFIX_LEN) + payload.ljust(
            _ENCRYPT_PAYLOAD_LEN, b"\x00"
        )
        return blob  # always 96 bytes

    @staticmethod
    def _fake_decrypt(encrypted_data) -> str:
        """
        Recover plaintext produced by ``_fake_encrypt``.

        Accepts:
        - ``str``   – assumed to be base64; decoded first.
        - ``bytes`` / ``bytearray`` / ``Binary`` – used directly.

        Supports the legacy 48-byte blob (15 usable bytes) as well as the
        current 96-byte blob (63 usable bytes) so existing rows remain readable
        after a schema migration.

        Returns a human-readable sentinel string on any error so the caller
        always receives a ``str`` and never has to handle ``None`` here.
        """
        try:
            # Normalise input to raw bytes.
            if isinstance(encrypted_data, str):
                encrypted_bytes = base64.b64decode(encrypted_data)
            elif isinstance(encrypted_data, (bytes, bytearray, Binary)):
                encrypted_bytes = bytes(encrypted_data)
            else:
                return "[Invalid Type]"

            # Guard: blob must be at least 48 bytes (legacy minimum).
            if not encrypted_bytes or len(encrypted_bytes) < 48:
                return "N/A"

            # Skip the 32-byte random prefix to reach the payload section.
            data_section = encrypted_bytes[_ENCRYPT_RANDOM_PREFIX_LEN:]
            length = data_section[0]

            if length == 0:
                # Null blob – stored as placeholder; treat as absent.
                return "N/A"

            if length > _ENCRYPT_MAX_CHARS:
                # Length byte outside valid range – likely seed/fixture data
                # that was never encrypted with real plaintext.
                return "[Seed Data - No Plaintext]"

            # Extract exactly ``length`` bytes starting after the length byte.
            return data_section[1 : 1 + length].decode("utf-8")

        except Exception:
            logger.exception("_fake_decrypt failed")
            return "[Decryption Failed]"

    @staticmethod
    def _paginate_query(table, **kwargs) -> List[Dict]:
        """
        Transparently handle DynamoDB pagination for ``table.query()`` calls.

        DynamoDB returns at most 1 MB of data per call; when a result set is
        larger it includes a ``LastEvaluatedKey`` that must be passed as
        ``ExclusiveStartKey`` in the next call. This helper loops until no
        continuation key is present and returns the complete item list.

        Pass the same ``**kwargs`` you would to ``table.query()`` directly.
        """
        items: List[Dict] = []
        last_key = None

        while True:
            if last_key:
                kwargs["ExclusiveStartKey"] = last_key

            response = table.query(**kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")

            # No continuation key means we have retrieved all pages.
            if not last_key:
                break

        return items

    @staticmethod
    def _build_age_group(age: int) -> str:
        """
        Map a numeric age to one of three standard age-bracket strings.

        Returns:
            ``'65-74'``  for age < 75
            ``'75-84'``  for 75 ≤ age < 85
            ``'85+'``    for age ≥ 85
        """
        if age < _AGE_BRACKET_YOUNG_SENIOR:
            return "65-74"
        if age < _AGE_BRACKET_OLDER_SENIOR:
            return "75-84"
        return "85+"

    @staticmethod
    def _redact_encrypted_fields(item: Dict) -> Dict:
        """
        Replace raw encrypted blobs with a human-readable redaction marker.

        Called before returning resident records to API callers so ciphertext
        is never accidentally exposed in logs or responses.

        The item is mutated **in place** and also returned for convenience.
        """
        for key in ("first_name_enc", "last_name_enc", "display_name_enc", "dob_enc"):
            if key in item:
                item[key] = _REDACTED_ENCRYPTED
        return item

    # =========================================================================
    # SLEEP DIARY ENDPOINTS
    # =========================================================================

    def get_sleep_nightly_summary(
        self, resident_id: str, days: int = 10
    ) -> List[Dict]:
        """
        Return the most recent ``days`` nights of aggregated sleep data for a
        resident, ordered newest-first (``ScanIndexForward=False``).

        Table: ``settings.TABLE_SLEEP_SUMMARY``
        PK: ``resident_id``  /  SK: sleep date (ISO-8601)
        """
        table = self.dynamodb.Table(settings.TABLE_SLEEP_SUMMARY)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,  # newest night first
                Limit=days,
                ConsistentRead=True,     # strong consistency for clinical data
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_sleep_nightly_summary failed for resident %s", resident_id
            )
            return []

    def get_sleep_movement_hourly(
        self, resident_id: str, sleep_date: str
    ) -> List[Dict]:
        """
        Return hourly body-movement readings for a specific sleep night.

        ``sleep_date`` must match the prefix of the ``sleep_date_hour`` sort
        key (e.g. ``'2024-03-15'`` will match ``'2024-03-15#22'``,
        ``'2024-03-15#23'``, ``'2024-03-16#00'``, etc.).

        Table: ``settings.TABLE_SLEEP_MOVEMENT``
        PK: ``resident_id``  /  SK: ``sleep_date_hour`` (begins_with filter)
        """
        table = self.dynamodb.Table(settings.TABLE_SLEEP_MOVEMENT)
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("resident_id").eq(resident_id)
                    & Key("sleep_date_hour").begins_with(sleep_date)
                )
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_sleep_movement_hourly failed for resident %s, date %s",
                resident_id,
                sleep_date,
            )
            return []

    def get_sleep_wake_episodes(
        self, resident_id: str, sleep_date: str
    ) -> List[Dict]:
        """
        Return all recorded wake episodes for a specific sleep night.

        Uses a ``begins_with`` filter on the ``sleep_date_episode`` sort key,
        so all episodes on that night are returned regardless of their
        episode-sequence suffix.

        Table: ``settings.TABLE_SLEEP_WAKE``
        PK: ``resident_id``  /  SK: ``sleep_date_episode`` (begins_with filter)
        """
        table = self.dynamodb.Table(settings.TABLE_SLEEP_WAKE)
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("resident_id").eq(resident_id)
                    & Key("sleep_date_episode").begins_with(sleep_date)
                )
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_sleep_wake_episodes failed for resident %s, date %s",
                resident_id,
                sleep_date,
            )
            return []

    # =========================================================================
    # GAIT ENDPOINTS
    # =========================================================================

    def get_latest_gait_snapshot(self, resident_id: str) -> Optional[Dict]:
        """
        Return the single most-recent gait-metrics snapshot for a resident,
        or ``None`` if no snapshots exist yet.

        Table: ``settings.TABLE_GAIT_SNAPSHOT``
        PK: ``resident_id``  /  SK: timestamp
        """
        table = self.dynamodb.Table(settings.TABLE_GAIT_SNAPSHOT)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,  # most recent first
                Limit=1,
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception(
                "get_latest_gait_snapshot failed for resident %s", resident_id
            )
            return None

    def get_gait_daily_steps(
        self, resident_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Return per-day step counts for the last ``days`` days, newest first.

        Table: ``settings.TABLE_GAIT_DAILY``
        PK: ``resident_id``  /  SK: date
        """
        table = self.dynamodb.Table(settings.TABLE_GAIT_DAILY)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=days,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_gait_daily_steps failed for resident %s", resident_id
            )
            return []

    def get_stride_length_hourly(
        self, resident_id: str, date: str
    ) -> List[Dict]:
        """
        Return hourly stride-length distribution for a specific date.

        ``date`` is matched as a prefix against the ``date_hour`` sort key
        (format ``'YYYY-MM-DD'``).

        Table: ``settings.TABLE_STRIDE_HOURLY``
        PK: ``resident_id``  /  SK: ``date_hour`` (begins_with filter)
        """
        table = self.dynamodb.Table(settings.TABLE_STRIDE_HOURLY)
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("resident_id").eq(resident_id)
                    & Key("date_hour").begins_with(date)
                )
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_stride_length_hourly failed for resident %s, date %s",
                resident_id,
                date,
            )
            return []

    # =========================================================================
    # COMMON ENDPOINTS
    # =========================================================================

    def get_resident_info(self, resident_id: str) -> Optional[Dict]:
        """
        Look up basic resident metadata by ``resident_id`` via the GSI.

        Returns the first matching item (there should only ever be one) or
        ``None`` when the resident does not exist.

        Table: ``settings.TABLE_RESIDENTS``
        Index: ``gsi-resident-id``  (PK: ``resident_id``)
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        try:
            response = table.query(
                IndexName="gsi-resident-id",
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception(
                "get_resident_info failed for resident %s", resident_id
            )
            return None

    def get_recent_alerts(
        self, resident_id: str, limit: int = 10
    ) -> List[Dict]:
        """
        Return the most recent ``limit`` alerts for a resident, newest first.

        Table: ``settings.TABLE_UNIFIED_ALERTS``
        PK: ``resident_id``  /  SK: timestamp
        """
        table = self.dynamodb.Table(settings.TABLE_UNIFIED_ALERTS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_recent_alerts failed for resident %s", resident_id
            )
            return []

    def get_resident_suggestions(
        self, resident_id: str, limit: int = 10
    ) -> List[Dict]:
        """
        Return the most recent AI-generated care suggestions for a resident.

        Table: ``settings.TABLE_SUGGESTIONS``
        PK: ``resident_id``  /  SK: timestamp
        """
        table = self.dynamodb.Table(settings.TABLE_SUGGESTIONS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_resident_suggestions failed for resident %s", resident_id
            )
            return []

    def get_health_score(self, resident_id: str) -> Optional[Dict]:
        """
        Return the latest composite health score for a resident.

        The latest score is stored under the special sort-key value ``'LATEST'``
        so a single point-read is sufficient (no sort required).

        Table: ``settings.TABLE_HEALTH_SCORE``
        PK: ``resident_id``  /  SK: ``score_date`` (queried for exact value ``'LATEST'``)
        """
        table = self.dynamodb.Table(settings.TABLE_HEALTH_SCORE)
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("resident_id").eq(resident_id)
                    & Key("score_date").eq("LATEST")
                )
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception(
                "get_health_score failed for resident %s", resident_id
            )
            return None

    # =========================================================================
    # RESIDENT LISTING
    # =========================================================================

    def get_all_residents(self, facility_id: str = None) -> List[Dict]:
        """
        Return every active resident record for a facility.

        Uses ``_paginate_query`` so the full result set is always returned,
        even when the facility has more residents than DynamoDB's 1 MB page
        limit allows in a single call.

        Encrypted identity columns (names, DOB) are redacted before returning
        so ciphertext is never exposed to API consumers.

        Table: ``settings.TABLE_RESIDENTS``
        PK: ``facility_id``
        """
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        try:
            items = self._paginate_query(
                table,
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            logger.info(
                "Total residents fetched from DynamoDB: %d", len(items)
            )

            # Serialize Decimal/Binary types, then redact encrypted columns.
            return [
                self._redact_encrypted_fields(self.serialize_item(item))
                for item in items
            ]
        except Exception:
            logger.exception(
                "get_all_residents failed for facility %s", facility_id
            )
            return []

    def get_emergency_contacts(self, resident_id: str) -> List[Dict]:
        """
        Return all emergency contacts for a resident with PII fields decrypted.

        Encrypted columns (``contact_name_enc``, ``phone_enc``, ``email_enc``)
        are decrypted and re-keyed to plain names (``contact_name``, ``phone``,
        ``email``) before being returned; the ``_enc`` keys are removed.

        Table: ``settings.TABLE_EMERGENCY_CONTACTS``
        PK: ``resident_id``
        """
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
            )
            items = response.get("Items", [])

            cleaned_items = []
            for item in items:
                # Serialise DynamoDB types first.
                cleaned = self.serialize_item(item)

                # Decrypt each encrypted column and expose it under a plain key.
                if "contact_name_enc" in cleaned:
                    cleaned["contact_name"] = self._fake_decrypt(
                        cleaned.pop("contact_name_enc")
                    )
                if "phone_enc" in cleaned:
                    cleaned["phone"] = self._fake_decrypt(cleaned.pop("phone_enc"))
                if "email_enc" in cleaned:
                    cleaned["email"] = self._fake_decrypt(cleaned.pop("email_enc"))

                cleaned_items.append(cleaned)

            return cleaned_items
        except Exception:
            logger.exception(
                "get_emergency_contacts failed for resident %s", resident_id
            )
            return []

    # =========================================================================
    # CREATE RESIDENT
    # =========================================================================

    def create_resident(
        self,
        facility_id: str,
        resident_data: Dict,
        photo_s3_key: str = None,
    ) -> Dict:
        """
        Persist a new resident record and return the serialised item.

        ``resident_data`` is the raw form payload; every field is optional and
        falls back to ``'N/A'`` when absent so no caller is forced to supply
        a full schema.

        Key derivation:
        - ``resident_id`` – ``RES#res-<YYYYMMDD>-<4-hex>`` (time-prefixed for
          range-key locality).
        - ``room_id``     – ``ROOM#r-<room_number>``
        - ``bed_id``      – ``BED#b-<room_number>-<bed_suffix>``

        Encrypted identity fields are stored as 96-byte null blobs (no real
        KMS encryption in this stub) and redacted before returning.

        Table: ``settings.TABLE_RESIDENTS``
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v  # local alias for brevity

        # ── Generate a unique resident ID ─────────────────────────────────────
        date_part = now.strftime("%Y%m%d")
        short_uuid = uuid.uuid4().hex[:4]
        resident_id = f"RES#res-{date_part}-{short_uuid}"

        # ── Extract and normalise form fields ─────────────────────────────────
        first_name = v(resident_data.get("first_name"))
        last_name = v(resident_data.get("last_name"))

        raw_age = resident_data.get("age")
        age: int | str = (
            int(raw_age) if raw_age not in (None, "", "N/A") else "N/A"
        )

        sex = v(resident_data.get("sex"))
        mrn = v(resident_data.get("mrn"))

        raw_h = resident_data.get("height_cm")
        height_cm: int | str = (
            int(raw_h) if raw_h not in (None, "", "N/A") else "N/A"
        )

        raw_w = resident_data.get("weight_kg")
        # Use Decimal to avoid floating-point precision issues in DynamoDB.
        weight_kg: Decimal | str = (
            Decimal(str(raw_w)) if raw_w not in (None, "", "N/A") else "N/A"
        )

        room_number = v(resident_data.get("room_number"))
        bed_id_suffix = v(resident_data.get("bed_id"))
        unit_id = v(resident_data.get("unit_id"))
        mobility_class = v(resident_data.get("mobility_class"))
        admission_date = v(resident_data.get("admission_date"))
        fall_risk_level = v(resident_data.get("fall_risk_level"))
        latest_sleep_quality = v(resident_data.get("latest_sleep_quality"))
        risk_factors = resident_data.get("risk_factors", [])

        # Consent flags default to False when not provided.
        sleep_monitoring_consent: bool = resident_data.get(
            "sleep_monitoring_consent", False
        )
        video_clip_consent: bool = resident_data.get("video_clip_consent", False)

        # ── Derive computed fields ────────────────────────────────────────────
        age_group: str = (
            self._build_age_group(age) if isinstance(age, int) else "N/A"
        )

        # Compound sort-key lets us query "all ACTIVE residents sorted by name"
        # using a single KeyConditionExpression.
        status = "ACTIVE"
        status_name_sort = (
            f"{status}{_SORT_SEP}{last_name}{_SORT_SEP}{first_name}{_SORT_SEP}{resident_id}"
        )

        # Compose location IDs only when the required parts are present.
        room_id = f"ROOM#r-{room_number}" if room_number != "N/A" else "N/A"
        bed_id = (
            f"BED#b-{room_number}-{bed_id_suffix}"
            if room_number != "N/A" and bed_id_suffix != "N/A"
            else "N/A"
        )

        # ── Build the DynamoDB item ───────────────────────────────────────────
        item = {
            # Keys
            "facility_id": facility_id,
            "resident_id": resident_id,
            # Identity (encrypted – null blobs until real KMS is wired in)
            "first_name_enc": _NULL_BLOB,
            "last_name_enc": _NULL_BLOB,
            "display_name_enc": _NULL_BLOB,
            "dob_enc": _NULL_BLOB,
            # Demographics
            "mrn": mrn,
            "age": age,
            "age_group": age_group,
            "sex": sex,
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            # Location
            "room_id": room_id,
            "bed_id": bed_id,
            "unit_id": unit_id,
            # Clinical status
            "admission_date": admission_date,
            "mobility_class": mobility_class,
            "risk_factors": risk_factors if risk_factors else [],
            # Baseline metrics (populated later by monitoring pipeline)
            "baseline_step_freq": "N/A",
            "baseline_stride": "N/A",
            "baseline_balance": "N/A",
            "baseline_tst_min": "N/A",
            "baseline_se_pct": "N/A",
            "baseline_waso_min": "N/A",
            "baseline_sl_min": "N/A",
            "baseline_sleep_7d_avg_tst_min": "N/A",
            # Falls
            "total_falls_lifetime": 0,
            "last_fall_date": "N/A",
            "days_since_last_fall": 0,
            "fall_risk_level": fall_risk_level,
            "fall_risk_score": "N/A",
            # Sleep
            "latest_sleep_quality": latest_sleep_quality,
            # Monitoring & consent
            "monitoring_active": True,
            "sleep_monitoring_consent": sleep_monitoring_consent,
            "video_clip_consent": video_clip_consent,
            # Media
            "photo_s3_key": photo_s3_key or "",
            # Sort / filter helpers
            "status": status,
            "status_name_sort": status_name_sort,
            # Audit
            "created_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version": 1,
        }

        try:
            table.put_item(Item=item)
            # Return a serialised copy with encrypted fields redacted.
            return self._redact_encrypted_fields(self.serialize_item(item))
        except Exception:
            logger.exception(
                "create_resident failed for facility %s", facility_id
            )
            raise

    def create_emergency_contacts(
        self, resident_id: str, contacts: List[Dict]
    ) -> None:
        """
        Persist emergency-contact records for a newly created resident.

        Each contact is assigned a ``contact_priority`` sort key. If the same
        priority string appears more than once in ``contacts`` a numeric suffix
        is appended (e.g. ``'PRIMARY_2'``) to prevent key collisions.

        PII fields (name, phone, email) are encrypted before storage.

        Table: ``settings.TABLE_EMERGENCY_CONTACTS``
        PK: ``resident_id``  /  SK: ``contact_priority``
        """
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Track how many times each priority label has been used so we can
        # generate a unique sort key if the same label appears more than once.
        used_priorities: Dict[str, int] = {}

        for contact in contacts:
            raw_priority = contact.get("contact_priority", "N/A")

            if raw_priority in used_priorities:
                # Deduplicate by appending an incrementing counter.
                used_priorities[raw_priority] += 1
                sk = f"{raw_priority}_{used_priorities[raw_priority]}"
            else:
                used_priorities[raw_priority] = 1
                sk = raw_priority

            item = {
                "resident_id": resident_id,
                "contact_priority": sk,
                # Encrypt all PII columns before persisting.
                "contact_name_enc": self._fake_encrypt(
                    contact.get("contact_name", "N/A")
                ),
                "relationship": contact.get("relationship", "N/A"),
                "phone_enc": self._fake_encrypt(contact.get("phone", "N/A")),
                "email_enc": self._fake_encrypt(contact.get("email", "N/A")),
                # Notification preferences
                "notify_on_fall": contact.get("notify_on_fall", False),
                "is_legal_guardian": contact.get("is_legal_guardian", False),
                "created_at": now,
            }

            try:
                table.put_item(Item=item)
            except Exception:
                # Log but continue – a failed contact write should not abort
                # the entire create-resident flow; the caller can retry.
                logger.exception(
                    "create_emergency_contacts failed for resident %s, priority %s",
                    resident_id,
                    sk,
                )

    # =========================================================================
    # DELETE RESIDENT
    # =========================================================================

    def delete_resident(self, facility_id: str, resident_id: str) -> str:
        """
        Delete a resident and all their emergency-contact records.

        Returns the resident's ``photo_s3_key`` so the caller can clean up the
        associated S3 object. Returns ``''`` when the key is unavailable.

        Emergency-contact deletion is best-effort: if it fails the resident row
        is already gone, so we log the error and swallow it rather than raising.

        Table: ``settings.TABLE_RESIDENTS`` + ``settings.TABLE_EMERGENCY_CONTACTS``
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        photo_s3_key = ""

        # ── Step 1: Read the photo key before deleting the row ────────────────
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("facility_id").eq(facility_id)
                    & Key("resident_id").eq(resident_id)
                )
            )
            items = response.get("Items", [])
            if items:
                photo_s3_key = items[0].get("photo_s3_key", "")
        except Exception:
            logger.exception(
                "delete_resident: failed to fetch resident %s before deletion",
                resident_id,
            )

        # ── Step 2: Delete the resident item (raises on failure) ──────────────
        try:
            table.delete_item(
                Key={"facility_id": facility_id, "resident_id": resident_id}
            )
        except Exception:
            logger.exception(
                "delete_resident failed for resident %s", resident_id
            )
            raise

        # ── Step 3: Delete emergency contacts (best-effort, paginated) ────────
        try:
            ec_table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
            ec_items = self._paginate_query(
                ec_table,
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            for ec_item in ec_items:
                ec_table.delete_item(
                    Key={
                        "resident_id": resident_id,
                        "contact_priority": ec_item["contact_priority"],
                    }
                )
        except Exception:
            logger.exception(
                "delete_resident: failed to delete emergency contacts for resident %s",
                resident_id,
            )

        return photo_s3_key or ""

    # =========================================================================
    # UPDATE RESIDENT
    # =========================================================================

    def update_resident(
        self,
        facility_id: str,
        resident_id: str,
        resident_data: Dict,
    ) -> Dict:
        """
        Partially update a resident record; only keys present in
        ``resident_data`` are modified.

        ``status_name_sort`` is rebuilt whenever ``first_name``, ``last_name``,
        or ``status`` is included in the payload. Because names are stored
        encrypted the caller must supply the plaintext names explicitly – they
        cannot be read back from the database row.

        ``age_group`` is recomputed automatically whenever ``age`` is updated.

        The item's ``version`` counter is atomically incremented on every
        successful update.

        Table: ``settings.TABLE_RESIDENTS``
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v

        # Verify the resident exists before attempting an update.
        current_resident = self.get_resident_info(resident_id)
        if not current_resident:
            raise ValueError(f"Resident {resident_id} not found")

        # Collect expression fragments, attribute name aliases, and values.
        update_expr_parts: List[str] = []
        expr_attr_names: Dict[str, str] = {}
        expr_attr_values: Dict = {}
        idx = 0  # running counter for unique placeholder names

        # ── Rebuild sort key when any of its components are provided ──────────
        # Names must come from the caller because they are not readable from the
        # DB row (stored encrypted).
        if any(k in resident_data for k in ("first_name", "last_name", "status")):
            first_name = v(resident_data.get("first_name", ""))
            last_name = v(resident_data.get("last_name", ""))
            status_for_sort = resident_data.get(
                "status", current_resident.get("status", "ACTIVE")
            )
            status_name_sort = (
                f"{status_for_sort}{_SORT_SEP}"
                f"{last_name}{_SORT_SEP}"
                f"{first_name}{_SORT_SEP}"
                f"{resident_id}"
            )
            expr_attr_names["#status_name_sort"] = "status_name_sort"
            expr_attr_values[":status_name_sort"] = status_name_sort
            update_expr_parts.append("#status_name_sort = :status_name_sort")

        # ── Map supported fields to update expression clauses ─────────────────
        # ``room_number`` gets special treatment because it must be stored as a
        # compound ``room_id`` value rather than the raw number.
        field_mapping = {
            "age": resident_data.get("age"),
            "room_number": resident_data.get("room_number"),
            "mrn": resident_data.get("mrn"),
            "fall_risk_level": resident_data.get("fall_risk_level"),
            "latest_sleep_quality": resident_data.get("latest_sleep_quality"),
            "mobility_class": resident_data.get("mobility_class"),
            "status": resident_data.get("status"),
        }

        for field_name, field_value in field_mapping.items():
            if field_value is None:
                # Field was not supplied in this update request – skip it.
                continue

            if field_name == "room_number":
                # Store as a structured compound ID instead of a plain number.
                expr_attr_names["#room_id"] = "room_id"
                expr_attr_values[":room_id"] = f"ROOM#r-{field_value}"
                update_expr_parts.append("#room_id = :room_id")
            else:
                ak = f"#field{idx}"
                vk = f":val{idx}"
                expr_attr_names[ak] = field_name
                # ``age`` is always stored as an integer.
                expr_attr_values[vk] = (
                    int(field_value) if field_name == "age" else v(field_value)
                )
                update_expr_parts.append(f"{ak} = {vk}")
                idx += 1

        # ── Recompute age_group whenever age changes ──────────────────────────
        if "age" in resident_data:
            age_group = self._build_age_group(int(resident_data["age"]))
            expr_attr_names["#age_group"] = "age_group"
            expr_attr_values[":age_group"] = age_group
            update_expr_parts.append("#age_group = :age_group")

        # ── Always update the audit timestamp ─────────────────────────────────
        expr_attr_names["#updated_at"] = "updated_at"
        expr_attr_values[":updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append("#updated_at = :updated_at")

        # ── Atomically increment the optimistic-locking version counter ───────
        expr_attr_names["#version"] = "version"
        expr_attr_values[":version_inc"] = 1
        update_expr_parts.append("#version = #version + :version_inc")

        if not update_expr_parts:
            raise ValueError("No fields to update")

        update_expression = "SET " + ", ".join(update_expr_parts)

        try:
            response = table.update_item(
                Key={"facility_id": facility_id, "resident_id": resident_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values,
                ReturnValues="ALL_NEW",
            )
            updated_item = self.serialize_item(response["Attributes"])
            return self._redact_encrypted_fields(updated_item)
        except Exception:
            logger.exception(
                "update_resident failed for resident %s / facility %s",
                resident_id,
                facility_id,
            )
            raise

    # =========================================================================
    # FALLS ENDPOINTS
    # =========================================================================

    def get_fall_video_clip(self, fall_id: str) -> Optional[Dict]:
        """
        Return the video-clip metadata record for a fall event.

        Tries an exact ``get_item`` with SK ``'CLIP'`` first. If that returns
        nothing (the SK may differ in some records), falls back to a query on
        the ``fall_id`` partition key and takes the first result.

        Table: ``fall_video_clips``
        PK: ``fall_id``  /  SK: ``'CLIP'``
        """
        table = self.dynamodb.Table(_TABLE_FALL_VIDEO_CLIPS)
        try:
            logger.info(
                "Querying %s for fall_id: %s", _TABLE_FALL_VIDEO_CLIPS, fall_id
            )
            response = table.get_item(Key={"fall_id": fall_id, "sk": "CLIP"})
            item = response.get("Item")

            if not item:
                # Primary lookup missed – fall back to a broader query so we
                # don't silently drop clips with unexpected sort-key values.
                logger.warning(
                    "No video clip found for fall_id=%s with sk='CLIP'; "
                    "attempting query fallback",
                    fall_id,
                )
                query_response = table.query(
                    KeyConditionExpression=Key("fall_id").eq(fall_id),
                    Limit=1,
                )
                items = query_response.get("Items", [])
                if items:
                    logger.info(
                        "Found video clip via query fallback for fall_id=%s", fall_id
                    )
                    item = items[0]
                else:
                    logger.error(
                        "No video clips found at all for fall_id=%s", fall_id
                    )

            return self.serialize_item(item) if item else None
        except Exception:
            logger.exception(
                "get_fall_video_clip failed for fall %s", fall_id
            )
            return None

    def get_fall_events(
        self,
        facility_id: str,
        days: int = 30,
        priority: str = None,
    ) -> List[Dict]:
        """
        Return fall events for a facility optionally filtered by severity.

        Retrieves all events from the GSI (paginated), then applies date-range
        and priority filters in Python. Enriches every result with the
        resident's display name, room, and photo key.

        Note:
            Date-range filtering is currently done in Python because the GSI
            sort key is not a date. A date-based GSI should be added to avoid
            full-partition fan-out on large facilities.

            TODO: Add a date-range GSI sort key to push filtering into DynamoDB.

        Table: ``fall_events``
        Index: ``gsi-facility-ts``  (PK: ``facility_id``)
        """
        table = self.dynamodb.Table(_TABLE_FALL_EVENTS)
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            # Retrieve all fall events for this facility (paginated).
            all_falls = self._paginate_query(
                table,
                IndexName="gsi-facility-ts",
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            falls = self.serialize_item(all_falls)

            # ── Filter by date range (Python-side, see TODO above) ────────────
            start_str = start_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            falls = [f for f in falls if f.get("fall_ts", "") >= start_str]

            # ── Optional severity filter ──────────────────────────────────────
            if priority and priority.upper() != "ALL":
                falls = [
                    f
                    for f in falls
                    if f.get("severity", "").upper() == priority.upper()
                ]

            # ── Enrich every fall with resident metadata ───────────────────────
            # NOTE: Previously this block was nested inside the `if priority`
            # branch, so enrichment was skipped on unfiltered queries. Fixed.
            for fall in falls:
                fall.setdefault("photo_s3_key", "")
                resident_id = fall.get("resident_id")

                if not resident_id:
                    fall.setdefault("resident_name", "Unknown Resident")
                    continue

                resident = self.get_resident_info(resident_id)
                if not resident:
                    fall.setdefault("resident_name", "Unknown Resident")
                    continue

                # Parse display name from the compound sort key:
                # ``STATUS#last_name#first_name#resident_id``
                parts = resident.get("status_name_sort", "").split(_SORT_SEP)
                fall["resident_name"] = (
                    f"{parts[2]} {parts[1]}"
                    if len(parts) >= 3
                    else "Unknown Resident"
                )

                # Prefer the resident's authoritative room_id; fall back to the
                # fall record's own room_id if the resident row has none.
                room_id = resident.get("room_id", "")
                fall["location_id"] = (
                    room_id
                    if room_id and room_id != "N/A"
                    else fall.get("room_id", "")
                )

                fall["photo_s3_key"] = resident.get("photo_s3_key", "")

            # Return events sorted most-recent first.
            falls.sort(key=lambda x: x.get("fall_ts", ""), reverse=True)
            return falls

        except Exception:
            logger.exception(
                "get_fall_events failed for facility %s", facility_id
            )
            return []

    def get_fall_analytics(
        self, facility_id: str, days: int = 1
    ) -> List[Dict]:
        """
        Aggregate fall counts into 3-hour time buckets for the last ``days`` days.

        Buckets are aligned to the labels in ``_ANALYTICS_TIME_LABELS`` (12 Am,
        3 Am, 6 Am, …). Each bucket's count covers the hours from its start up
        to (but not including) the next bucket's start hour.

        Returns a list of ``{"time": <label>, "falls": <count>}`` dicts ordered
        from midnight to end of day.
        """
        try:
            falls = self.get_fall_events(facility_id, days)

            # Initialise a per-hour counter for all 24 hours.
            hourly_counts: Dict[int, int] = {i: 0 for i in range(24)}

            for fall in falls:
                fall_ts = fall.get("fall_ts", "")
                if not fall_ts:
                    continue
                try:
                    dt = datetime.fromisoformat(fall_ts.replace("Z", "+00:00"))
                    hourly_counts[dt.hour] += 1
                except ValueError:
                    logger.warning("Unparseable fall_ts: %s", fall_ts)

            # Aggregate hourly counts into the configured bucket boundaries.
            analytics = []
            for i, hour in enumerate(_ANALYTICS_HOUR_BUCKETS):
                if i < len(_ANALYTICS_HOUR_BUCKETS) - 1:
                    # Sum all hours from this bucket start up to the next.
                    count = sum(
                        hourly_counts.get(h, 0)
                        for h in range(hour, _ANALYTICS_HOUR_BUCKETS[i + 1])
                    )
                else:
                    # Last bucket wraps midnight (hour 23 and hour 0).
                    count = hourly_counts.get(23, 0) + hourly_counts.get(0, 0)

                analytics.append(
                    {"time": _ANALYTICS_TIME_LABELS[i], "falls": count}
                )

            return analytics
        except Exception:
            logger.exception(
                "get_fall_analytics failed for facility %s", facility_id
            )
            return []

    # =========================================================================
    # CAREGIVER ENDPOINTS
    # =========================================================================

    def get_all_caregivers(self, facility_id: str = None) -> List[Dict]:
        """
        Return every caregiver record for a facility (paginated).

        ``cognito_user_id`` is replaced with a redaction marker before
        returning so authentication identifiers are not leaked.

        Table: ``caregivers``
        PK: ``facility_id``
        """
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table(_TABLE_CAREGIVERS)
        try:
            items = self._paginate_query(
                table,
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            logger.info(
                "Total caregivers fetched from DynamoDB: %d", len(items)
            )

            cleaned_items = []
            for item in items:
                cleaned = self.serialize_item(item)
                if "cognito_user_id" in cleaned:
                    cleaned["cognito_user_id"] = _REDACTED_COGNITO
                cleaned_items.append(cleaned)

            return cleaned_items
        except Exception:
            logger.exception(
                "get_all_caregivers failed for facility %s", facility_id
            )
            return []

    def get_caregiver_info(
        self, caregiver_id: str, facility_id: str = None
    ) -> Optional[Dict]:
        """
        Return a single caregiver's record, or ``None`` if not found.

        ``cognito_user_id`` is redacted before returning.

        Table: ``caregivers``
        PK: ``facility_id``  /  SK: ``caregiver_id``
        """
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table(_TABLE_CAREGIVERS)
        try:
            response = table.query(
                KeyConditionExpression=(
                    Key("facility_id").eq(facility_id)
                    & Key("caregiver_id").eq(caregiver_id)
                ),
                Limit=1,
            )
            items = response.get("Items", [])
            if not items:
                return None
            cleaned = self.serialize_item(items[0])
            if "cognito_user_id" in cleaned:
                cleaned["cognito_user_id"] = _REDACTED_COGNITO
            return cleaned
        except Exception:
            logger.exception(
                "get_caregiver_info failed for caregiver %s", caregiver_id
            )
            return None

    def get_caregiver_certifications(self, caregiver_id: str) -> List[Dict]:
        """
        Return all certification records held by a caregiver.

        Table: ``caregiver_certifications``
        PK: ``caregiver_id``
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVER_CERTS)
        try:
            response = table.query(
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id)
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_certifications failed for caregiver %s",
                caregiver_id,
            )
            return []

    def get_caregiver_assignments(
        self, caregiver_id: str, days: int = 7
    ) -> List[Dict]:
        """
        Return resident-assignment records for a caregiver within a date window.

        Table: ``caregiver_resident_assignments``
        Index: ``gsi-caregiver-date``  (PK: ``caregiver_id``, SK: ``shift_date``)
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVER_ASSIGNMENTS)
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            end_date = datetime.now().strftime("%Y-%m-%d")

            response = table.query(
                IndexName="gsi-caregiver-date",
                KeyConditionExpression=(
                    Key("caregiver_id").eq(caregiver_id)
                    & Key("shift_date").between(start_date, end_date)
                ),
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_assignments failed for caregiver %s", caregiver_id
            )
            return []

    def get_caregiver_schedule(
        self, caregiver_id: str, days: int = 7
    ) -> List[Dict]:
        """
        Return shift-schedule records for a caregiver within a date window.

        Table: ``caregiver_shift_schedule``
        Index: ``gsi-caregiver-date``  (PK: ``caregiver_id``, SK: ``shift_date``)
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVER_SCHEDULE)
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            end_date = datetime.now().strftime("%Y-%m-%d")

            response = table.query(
                IndexName="gsi-caregiver-date",
                KeyConditionExpression=(
                    Key("caregiver_id").eq(caregiver_id)
                    & Key("shift_date").between(start_date, end_date)
                ),
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_schedule failed for caregiver %s", caregiver_id
            )
            return []

    def get_caregiver_performance(self, caregiver_id: str) -> Optional[Dict]:
        """
        Return the most-recent performance-metrics snapshot for a caregiver.

        Table: ``caregiver_performance_metrics``
        PK: ``caregiver_id``  /  SK: snapshot date (newest first)
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVER_PERFORMANCE)
        try:
            response = table.query(
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id),
                ScanIndexForward=False,  # most recent first
                Limit=1,
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception(
                "get_caregiver_performance failed for caregiver %s", caregiver_id
            )
            return None

    def get_resident_caregivers(
        self, resident_id: str, days: int = 7
    ) -> List[Dict]:
        """
        Return only **active** caregivers currently assigned to a resident.

        Process:
        1. Fetch all assignment rows for the resident via the GSI (paginated).
        2. Filter to rows where ``is_active is True``.
        3. De-duplicate by ``caregiver_id`` (a caregiver can appear on multiple
           shift rows but should only appear once in the result).
        4. Fetch the full caregiver profile for each unique ID.
        5. Attach the latest assignment's shift metadata to the profile.
        6. Sort: PRIMARY assignments first, then alphabetical by display name.

        The ``days`` parameter is accepted for interface compatibility but is
        not used in the current query – active-status filtering replaces the
        date window. It can be wired in if historic-window filtering is needed.

        Table: ``caregiver_resident_assignments``
        Index: ``gsi-resident-date``  (PK: ``resident_id``)
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVER_ASSIGNMENTS)
        try:
            # Retrieve all assignment rows for this resident.
            all_assignments = self._paginate_query(
                table,
                IndexName="gsi-resident-date",
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            all_assignments = self.serialize_item(all_assignments)
            logger.debug(
                "[DB] %d total assignments for resident %s",
                len(all_assignments),
                resident_id,
            )

            # Keep only currently active assignments.
            active = [a for a in all_assignments if a.get("is_active") is True]
            logger.debug("[DB] %d active assignments", len(active))

            # De-duplicate caregiver IDs while preserving order.
            caregiver_ids = list(
                {a["caregiver_id"] for a in active if a.get("caregiver_id")}
            )

            caregivers = []
            for cg_id in caregiver_ids:
                caregiver = self.get_caregiver_info(cg_id, settings.FACILITY_ID)
                if not caregiver:
                    continue

                # Find all active assignments for this caregiver and pick the
                # most-recent one for the shift metadata.
                cg_assignments = [
                    a for a in active if a.get("caregiver_id") == cg_id
                ]
                latest = max(
                    cg_assignments,
                    key=lambda x: x.get("shift_date", ""),
                    default=None,
                )
                if latest:
                    caregiver["assignment_type"] = latest.get(
                        "assignment_type", "PRIMARY"
                    )
                    caregiver["shift_type"] = latest.get("shift_type", "N/A")
                    caregiver["assigned_date"] = latest.get("shift_date", "N/A")

                caregivers.append(caregiver)

            # Sort: PRIMARY first, then alphabetical within each group.
            caregivers.sort(
                key=lambda x: (
                    x.get("assignment_type") != "PRIMARY",
                    x.get("display_name", ""),
                )
            )
            logger.debug(
                "[DB] Returning %d active caregivers for resident %s",
                len(caregivers),
                resident_id,
            )
            return caregivers
        except Exception:
            logger.exception(
                "get_resident_caregivers failed for resident %s", resident_id
            )
            return []

    # =========================================================================
    # CREATE CAREGIVER
    # =========================================================================

    def create_caregiver(
        self,
        facility_id: str,
        caregiver_data: Dict,
        photo_s3_key: str = None,
    ) -> Dict:
        """
        Persist a new caregiver record and return the serialised item.

        ``caregiver_data`` is the raw form payload. Missing fields fall back to
        ``'N/A'``. Badge and employee IDs are auto-generated when absent.

        Permissions and dashboard access level are derived from the caregiver's
        ``role`` field (elevated for RN/NP/ADMIN, read-only for all others).

        ``cognito_user_id`` is generated as a placeholder; wire it to real
        Cognito provisioning in production.

        Table: ``caregivers``
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVERS)
        now = datetime.now(timezone.utc)
        v = self._v

        # ── Caregiver ID ──────────────────────────────────────────────────────
        # An override key allows seeding / testing with predictable IDs.
        if "_override_caregiver_id" in caregiver_data:
            caregiver_id = caregiver_data["_override_caregiver_id"]
        else:
            date_part = now.strftime("%Y%m%d")
            short_uuid = uuid.uuid4().hex[:4]
            caregiver_id = f"CG#cg-{date_part}-{short_uuid}"

        # ── Extract and normalise form fields ─────────────────────────────────
        first_name = v(caregiver_data.get("first_name"))
        last_name = v(caregiver_data.get("last_name"))
        email = v(caregiver_data.get("email"))
        phone = v(caregiver_data.get("phone"))
        role = v(caregiver_data.get("role"))
        primary_shift = v(caregiver_data.get("primary_shift"))
        badge_id = v(caregiver_data.get("badge_id"))
        employee_id = v(caregiver_data.get("employee_id"))
        status = caregiver_data.get("status", "ACTIVE")

        # ── Auto-generate IDs when not supplied ───────────────────────────────
        if badge_id == "N/A":
            badge_id = f"BADGE#B-{4500 + int(uuid.uuid4().hex[:4], 16) % 1000}"
        if employee_id == "N/A":
            seq = str(300 + int(uuid.uuid4().hex[:4], 16) % 1000).zfill(4)
            employee_id = f"EMP#E-2025-{seq}"

        # ── Flags and numeric fields ──────────────────────────────────────────
        fall_response_trained: bool = caregiver_data.get(
            "fall_response_trained", False
        )
        mfa_enabled: bool = caregiver_data.get("mfa_enabled", True)

        raw_max_load = caregiver_data.get("max_resident_load")
        max_resident_load: int = (
            int(raw_max_load)
            if raw_max_load not in (None, "", "N/A")
            else _DEFAULT_MAX_RESIDENT_LOAD
        )

        # ── Derive computed fields ────────────────────────────────────────────
        display_name = f"{first_name} {last_name}, {role}"
        status_display_name = f"{status}#{display_name}"

        # Licence placeholder – replace with a real lookup / registration flow.
        license_status_expiry = "ACTIVE#2026-12-31"

        # Permissions grow with role seniority.
        permissions = list(_BASE_PERMISSIONS)
        if role in _ELEVATED_ROLES:
            permissions.extend(_ELEVATED_PERMISSIONS)

        dashboard_access_level = (
            "FULL" if role in _ELEVATED_ROLES else "READ_ONLY"
        )
        # Admins are not direct caregivers; all other roles are.
        is_caregiver = role != "ADMIN"

        # Placeholder Cognito ID – swap for the ID returned by Cognito
        # ``AdminCreateUser`` in production.
        cognito_user_id = (
            f"us-east-1_{uuid.uuid4().hex[:8]}:{uuid.uuid4().hex[:12]}"
        )

        # ── Build the DynamoDB item ───────────────────────────────────────────
        item = {
            # Keys
            "facility_id": facility_id,
            "caregiver_id": caregiver_id,
            # Auth (redacted in responses)
            "cognito_user_id": cognito_user_id,
            # Identity
            "badge_id": badge_id,
            "employee_id": employee_id,
            "first_name": first_name,
            "last_name": last_name,
            "display_name": display_name,
            "email": email,
            "phone": phone,
            # Role & shift
            "role": role,
            "is_caregiver": is_caregiver,
            "primary_shift": primary_shift,
            "max_resident_load": max_resident_load,
            "current_resident_count": 0,
            # Performance counters (updated by monitoring pipeline)
            "fall_response_trained": fall_response_trained,
            "avg_response_time_sec": 0,
            "total_falls_responded": 0,
            # Access control
            "dashboard_access_level": dashboard_access_level,
            "permissions": permissions,
            "mfa_enabled": mfa_enabled,
            # Status / sort helpers
            "status": status,
            "status_display_name": status_display_name,
            "license_status_expiry": license_status_expiry,
            # Media
            "photo_s3_key": photo_s3_key or "",
            # Audit
            "created_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version": 1,
        }

        try:
            table.put_item(Item=item)
            clean = self.serialize_item(item)
            if "cognito_user_id" in clean:
                clean["cognito_user_id"] = _REDACTED_COGNITO
            return clean
        except Exception:
            logger.exception(
                "create_caregiver failed for facility %s", facility_id
            )
            raise

    # =========================================================================
    # UPDATE CAREGIVER
    # =========================================================================

    def update_caregiver(
        self,
        facility_id: str,
        caregiver_id: str,
        caregiver_data: Dict,
    ) -> Dict:
        """
        Partially update a caregiver record; only keys present in
        ``caregiver_data`` are modified.

        ``display_name`` and ``status_display_name`` are always recomputed from
        the merged state (DB values + supplied values) to stay consistent.

        The item's ``version`` counter is atomically incremented on every
        successful update.

        Table: ``caregivers``
        """
        table = self.dynamodb.Table(_TABLE_CAREGIVERS)
        now = datetime.now(timezone.utc)
        v = self._v

        # Verify the caregiver exists before attempting an update.
        current_caregiver = self.get_caregiver_info(caregiver_id, facility_id)
        if not current_caregiver:
            raise ValueError(f"Caregiver {caregiver_id} not found")

        update_expr_parts: List[str] = []
        expr_attr_names: Dict[str, str] = {}
        expr_attr_values: Dict = {}
        idx = 0  # running counter for unique placeholder names

        # ── Fields that map 1-to-1 to DB columns ─────────────────────────────
        field_mapping = {
            "first_name": caregiver_data.get("first_name"),
            "last_name": caregiver_data.get("last_name"),
            "email": caregiver_data.get("email"),
            "phone": caregiver_data.get("phone"),
            "role": caregiver_data.get("role"),
            "primary_shift": caregiver_data.get("primary_shift"),
            "badge_id": caregiver_data.get("badge_id"),
            "employee_id": caregiver_data.get("employee_id"),
            "status": caregiver_data.get("status"),
        }

        # ── Recompute display names from merged state ──────────────────────────
        # Merge incoming values with the current DB state so the derived fields
        # are always accurate, even when only one component is updated.
        first_name = (
            v(caregiver_data["first_name"])
            if "first_name" in caregiver_data
            else current_caregiver.get("first_name", "N/A")
        )
        last_name = (
            v(caregiver_data["last_name"])
            if "last_name" in caregiver_data
            else current_caregiver.get("last_name", "N/A")
        )
        role = (
            v(caregiver_data["role"])
            if "role" in caregiver_data
            else current_caregiver.get("role", "CNA")
        )
        status = (
            caregiver_data["status"]
            if "status" in caregiver_data
            else current_caregiver.get("status", "ACTIVE")
        )

        display_name = f"{first_name} {last_name}, {role}"
        status_display_name = f"{status}#{display_name}"

        # ── Build expression clauses for each supplied field ───────────────────
        for field_name, field_value in field_mapping.items():
            if field_value is None:
                continue
            ak = f"#field{idx}"
            vk = f":val{idx}"
            expr_attr_names[ak] = field_name
            expr_attr_values[vk] = v(field_value)
            update_expr_parts.append(f"{ak} = {vk}")
            idx += 1

        # ── Always sync computed display-name fields ───────────────────────────
        expr_attr_names["#display_name"] = "display_name"
        expr_attr_values[":display_name"] = display_name
        update_expr_parts.append("#display_name = :display_name")

        expr_attr_names["#status_display_name"] = "status_display_name"
        expr_attr_values[":status_display_name"] = status_display_name
        update_expr_parts.append("#status_display_name = :status_display_name")

        # ── Audit timestamp ───────────────────────────────────────────────────
        expr_attr_names["#updated_at"] = "updated_at"
        expr_attr_values[":updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append("#updated_at = :updated_at")

        # ── Optimistic-locking version counter ────────────────────────────────
        expr_attr_names["#version"] = "version"
        expr_attr_values[":version_inc"] = 1
        update_expr_parts.append("#version = #version + :version_inc")

        update_expression = "SET " + ", ".join(update_expr_parts)

        try:
            response = table.update_item(
                Key={"facility_id": facility_id, "caregiver_id": caregiver_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values,
                ReturnValues="ALL_NEW",
            )
            updated_item = self.serialize_item(response["Attributes"])
            if "cognito_user_id" in updated_item:
                updated_item["cognito_user_id"] = _REDACTED_COGNITO
            return updated_item
        except Exception:
            logger.exception(
                "update_caregiver failed for caregiver %s / facility %s",
                caregiver_id,
                facility_id,
            )
            raise


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

# Import and use ``db_service`` wherever database access is needed.
# Re-creating ``DynamoDBService`` on every request wastes the boto3 session
# setup time; the singleton keeps that cost to a one-time hit at import.
db_service = DynamoDBService()