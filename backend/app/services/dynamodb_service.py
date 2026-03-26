"""DynamoDB Service Layer
Handles all database operations
"""
import os
import base64
import uuid
import logging
import traceback
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import Binary

from ..config import settings

logger = logging.getLogger(__name__)


class DynamoDBService:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb", region_name=settings.AWS_REGION)
        self.client = boto3.client("dynamodb", region_name=settings.AWS_REGION)

    # ==================== SERIALIZATION ====================

    def serialize_item(self, obj):
        """
        Recursively convert DynamoDB types for JSON serialization:
          - Decimal  → float
          - Binary / bytes → base64 string
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

    # Keep old name as an alias so existing callers don't break
    decimal_to_float = serialize_item

    # ==================== HELPERS ====================

    @staticmethod
    def _v(val):
        """Return the value if truthy/non-empty, otherwise 'N/A'."""
        if val is None:
            return "N/A"
        if isinstance(val, str) and val.strip() == "":
            return "N/A"
        return val

    @staticmethod
    def _fake_encrypt(plaintext: str) -> bytes:
        """
        Simple reversible placeholder encryption (NOT for production).
        Layout: [32 random bytes][1 length byte][up to 63 plaintext bytes][padding to 96 bytes total]
        Total blob size: 96 bytes, supporting up to 63 UTF-8 characters.

        FIX: Previous version only reserved 15 bytes for data, silently
        truncating anything longer. Now uses a 96-byte blob (63 usable bytes).
        """
        if not plaintext or plaintext == "N/A":
            return b"\x00" * 96

        plaintext_bytes = plaintext.encode("utf-8")[:63]
        length_byte = bytes([len(plaintext_bytes)])
        # 32 random prefix + 1 length + up to 63 data bytes, padded to 96
        payload = length_byte + plaintext_bytes
        blob = os.urandom(32) + payload.ljust(64, b"\x00")  # 32 + 64 = 96
        return blob

    @staticmethod
    def _fake_decrypt(encrypted_data) -> str:
        """
        Decrypt data produced by _fake_encrypt.
        Supports both the old 48-byte and new 96-byte blob formats.
        """
        try:
            if isinstance(encrypted_data, str):
                encrypted_bytes = base64.b64decode(encrypted_data)
            elif isinstance(encrypted_data, (bytes, bytearray, Binary)):
                encrypted_bytes = bytes(encrypted_data)
            else:
                return "[Invalid Type]"

            if not encrypted_bytes or len(encrypted_bytes) < 48:
                return "N/A"

            # Skip the 32-byte random prefix
            data_section = encrypted_bytes[32:]
            length = data_section[0]

            if length == 0:
                return "N/A"
            if length > 63:
                return "[Seed Data - No Plaintext]"

            return data_section[1 : 1 + length].decode("utf-8")

        except Exception:
            logger.exception("_fake_decrypt failed")
            return "[Decryption Failed]"

    @staticmethod
    def _paginate_query(table, **kwargs) -> List[Dict]:
        """
        Helper that transparently handles DynamoDB pagination.
        Pass the same kwargs you would to table.query().
        Returns all items across all pages.
        """
        items = []
        last_key = None
        while True:
            if last_key:
                kwargs["ExclusiveStartKey"] = last_key
            response = table.query(**kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
        return items

    # ==================== SLEEP DIARY ENDPOINTS ====================

    def get_sleep_nightly_summary(self, resident_id: str, days: int = 10) -> List[Dict]:
        """Get last N days of sleep summary for a resident."""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_SUMMARY)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=days,
                ConsistentRead=True,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception("get_sleep_nightly_summary failed for resident %s", resident_id)
            return []

    def get_sleep_movement_hourly(self, resident_id: str, sleep_date: str) -> List[Dict]:
        """Get hourly body movement for a specific sleep night."""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_MOVEMENT)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
                & Key("sleep_date_hour").begins_with(sleep_date)
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_sleep_movement_hourly failed for resident %s, date %s",
                resident_id, sleep_date,
            )
            return []

    def get_sleep_wake_episodes(self, resident_id: str, sleep_date: str) -> List[Dict]:
        """Get wake episodes for a specific sleep night."""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_WAKE)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
                & Key("sleep_date_episode").begins_with(sleep_date)
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_sleep_wake_episodes failed for resident %s, date %s",
                resident_id, sleep_date,
            )
            return []

    # ==================== GAIT ENDPOINTS ====================

    def get_latest_gait_snapshot(self, resident_id: str) -> Optional[Dict]:
        """Get the most recent gait metrics snapshot."""
        table = self.dynamodb.Table(settings.TABLE_GAIT_SNAPSHOT)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=1,
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception("get_latest_gait_snapshot failed for resident %s", resident_id)
            return None

    def get_gait_daily_steps(self, resident_id: str, days: int = 30) -> List[Dict]:
        """Get daily step counts for last N days."""
        table = self.dynamodb.Table(settings.TABLE_GAIT_DAILY)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=days,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception("get_gait_daily_steps failed for resident %s", resident_id)
            return []

    def get_stride_length_hourly(self, resident_id: str, date: str) -> List[Dict]:
        """Get hourly stride length distribution for a specific date."""
        table = self.dynamodb.Table(settings.TABLE_STRIDE_HOURLY)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
                & Key("date_hour").begins_with(date)
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_stride_length_hourly failed for resident %s, date %s",
                resident_id, date,
            )
            return []

    # ==================== COMMON ENDPOINTS ====================

    def get_resident_info(self, resident_id: str) -> Optional[Dict]:
        """Get basic resident information."""
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        try:
            response = table.query(
                IndexName="gsi-resident-id",
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception("get_resident_info failed for resident %s", resident_id)
            return None

    def get_recent_alerts(self, resident_id: str, limit: int = 10) -> List[Dict]:
        """Get recent alerts for a resident."""
        table = self.dynamodb.Table(settings.TABLE_UNIFIED_ALERTS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception("get_recent_alerts failed for resident %s", resident_id)
            return []

    def get_resident_suggestions(self, resident_id: str, limit: int = 10) -> List[Dict]:
        """Get AI-generated suggestions for a resident."""
        table = self.dynamodb.Table(settings.TABLE_SUGGESTIONS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id),
                ScanIndexForward=False,
                Limit=limit,
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception("get_resident_suggestions failed for resident %s", resident_id)
            return []

    def get_health_score(self, resident_id: str) -> Optional[Dict]:
        """Get latest health score for a resident."""
        table = self.dynamodb.Table(settings.TABLE_HEALTH_SCORE)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
                & Key("score_date").eq("LATEST")
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception("get_health_score failed for resident %s", resident_id)
            return None

    # ==================== LIST ALL RESIDENTS ====================

    def get_all_residents(self, facility_id: str = None) -> List[Dict]:
        """Get all active residents in a facility (handles DynamoDB pagination)."""
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        try:
            items = self._paginate_query(
                table,
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            logger.info("Total residents fetched from DynamoDB: %d", len(items))

            cleaned_items = []
            for item in items:
                cleaned = self.serialize_item(item)
                for key in ("first_name_enc", "last_name_enc", "display_name_enc", "dob_enc"):
                    if key in cleaned:
                        cleaned[key] = "[ENCRYPTED]"
                cleaned_items.append(cleaned)

            return cleaned_items
        except Exception:
            logger.exception("get_all_residents failed for facility %s", facility_id)
            return []

    def get_emergency_contacts(self, resident_id: str) -> List[Dict]:
        """Get emergency contacts for a resident and decrypt sensitive fields."""
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        try:
            response = table.query(
                KeyConditionExpression=Key("resident_id").eq(resident_id)
            )
            items = response.get("Items", [])

            cleaned_items = []
            for item in items:
                cleaned = self.serialize_item(item)

                if "contact_name_enc" in cleaned:
                    cleaned["contact_name"] = self._fake_decrypt(cleaned.pop("contact_name_enc"))
                if "phone_enc" in cleaned:
                    cleaned["phone"] = self._fake_decrypt(cleaned.pop("phone_enc"))
                if "email_enc" in cleaned:
                    cleaned["email"] = self._fake_decrypt(cleaned.pop("email_enc"))

                cleaned_items.append(cleaned)

            return cleaned_items
        except Exception:
            logger.exception("get_emergency_contacts failed for resident %s", resident_id)
            return []

    # ==================== CREATE RESIDENT ====================

    def create_resident(
        self, facility_id: str, resident_data: Dict, photo_s3_key: str = None
    ) -> Dict:
        """
        Create a new resident. Only facility_id is assumed.
        Every other field comes from the form; missing → 'N/A'.
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v

        date_part = now.strftime("%Y%m%d")
        short_uuid = uuid.uuid4().hex[:4]
        resident_id = f"RES#res-{date_part}-{short_uuid}"

        first_name = v(resident_data.get("first_name"))
        last_name = v(resident_data.get("last_name"))

        raw_age = resident_data.get("age")
        age = int(raw_age) if raw_age not in (None, "", "N/A") else "N/A"

        sex = v(resident_data.get("sex"))
        mrn = v(resident_data.get("mrn"))

        raw_h = resident_data.get("height_cm")
        height_cm = int(raw_h) if raw_h not in (None, "", "N/A") else "N/A"

        raw_w = resident_data.get("weight_kg")
        weight_kg = Decimal(str(raw_w)) if raw_w not in (None, "", "N/A") else "N/A"

        room_number = v(resident_data.get("room_number"))
        bed_id_suffix = v(resident_data.get("bed_id"))
        unit_id = v(resident_data.get("unit_id"))
        mobility_class = v(resident_data.get("mobility_class"))
        admission_date = v(resident_data.get("admission_date"))
        fall_risk_level = v(resident_data.get("fall_risk_level"))
        latest_sleep_quality = v(resident_data.get("latest_sleep_quality"))
        risk_factors = resident_data.get("risk_factors", [])

        sleep_monitoring_consent = resident_data.get("sleep_monitoring_consent", False)
        video_clip_consent = resident_data.get("video_clip_consent", False)

        if isinstance(age, int):
            age_group = "65-74" if age < 75 else ("75-84" if age < 85 else "85+")
        else:
            age_group = "N/A"

        room_id = f"ROOM#r-{room_number}" if room_number != "N/A" else "N/A"
        bed_id = (
            f"BED#b-{room_number}-{bed_id_suffix}"
            if room_number != "N/A" and bed_id_suffix != "N/A"
            else "N/A"
        )

        status = "ACTIVE"
        status_name_sort = f"{status}#{last_name}#{first_name}#{resident_id}"
        fake_enc = b"\x00" * 96  # Updated to match new blob size

        item = {
            "facility_id": facility_id,
            "resident_id": resident_id,
            "mrn": mrn,
            "first_name_enc": fake_enc,
            "last_name_enc": fake_enc,
            "display_name_enc": fake_enc,
            "dob_enc": fake_enc,
            "age": age,
            "age_group": age_group,
            "sex": sex,
            "height_cm": height_cm,
            "weight_kg": weight_kg,
            "room_id": room_id,
            "bed_id": bed_id,
            "unit_id": unit_id,
            "admission_date": admission_date,
            "mobility_class": mobility_class,
            "risk_factors": risk_factors if risk_factors else [],
            "baseline_step_freq": "N/A",
            "baseline_stride": "N/A",
            "baseline_balance": "N/A",
            "baseline_tst_min": "N/A",
            "baseline_se_pct": "N/A",
            "baseline_waso_min": "N/A",
            "baseline_sl_min": "N/A",
            "baseline_sleep_7d_avg_tst_min": "N/A",
            "total_falls_lifetime": 0,
            "last_fall_date": "N/A",
            "days_since_last_fall": 0,
            "fall_risk_level": fall_risk_level,
            "fall_risk_score": "N/A",
            "latest_sleep_quality": latest_sleep_quality,
            "monitoring_active": True,
            "sleep_monitoring_consent": sleep_monitoring_consent,
            "video_clip_consent": video_clip_consent,
            "photo_s3_key": photo_s3_key or "",
            "status": status,
            "status_name_sort": status_name_sort,
            "created_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version": 1,
        }

        try:
            table.put_item(Item=item)
            clean = self.serialize_item(item)
            for key in ("first_name_enc", "last_name_enc", "display_name_enc", "dob_enc"):
                if key in clean:
                    clean[key] = "[ENCRYPTED]"
            return clean
        except Exception:
            logger.exception("create_resident failed for facility %s", facility_id)
            raise

    def create_emergency_contacts(self, resident_id: str, contacts: List[Dict]):
        """
        Write emergency contacts for a newly created resident.
        Table key: resident_id (PK) + contact_priority (SK).
        Encrypts sensitive fields before storing.
        """
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        used_priorities: Dict[str, int] = {}
        for c in contacts:
            raw_priority = c.get("contact_priority", "N/A")
            if raw_priority in used_priorities:
                used_priorities[raw_priority] += 1
                sk = f"{raw_priority}_{used_priorities[raw_priority]}"
            else:
                used_priorities[raw_priority] = 1
                sk = raw_priority

            item = {
                "resident_id": resident_id,
                "contact_priority": sk,
                "contact_name_enc": self._fake_encrypt(c.get("contact_name", "N/A")),
                "relationship": c.get("relationship", "N/A"),
                "phone_enc": self._fake_encrypt(c.get("phone", "N/A")),
                "email_enc": self._fake_encrypt(c.get("email", "N/A")),
                "notify_on_fall": c.get("notify_on_fall", False),
                "is_legal_guardian": c.get("is_legal_guardian", False),
                "created_at": now,
            }

            try:
                table.put_item(Item=item)
            except Exception:
                logger.exception(
                    "create_emergency_contacts failed for resident %s, priority %s",
                    resident_id, sk,
                )

    # ==================== DELETE RESIDENT ====================

    def delete_resident(self, facility_id: str, resident_id: str) -> str:
        """
        Delete a resident from DynamoDB.
        Returns the resident's photo_s3_key so the caller can clean up S3.
        Also deletes their emergency contacts.
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        photo_s3_key = ""

        # 1) Fetch to get photo_s3_key before deletion
        try:
            response = table.query(
                KeyConditionExpression=Key("facility_id").eq(facility_id)
                & Key("resident_id").eq(resident_id)
            )
            items = response.get("Items", [])
            if items:
                photo_s3_key = items[0].get("photo_s3_key", "")
        except Exception:
            logger.exception(
                "delete_resident: failed to fetch resident %s before deletion", resident_id
            )

        # 2) Delete the resident item
        try:
            table.delete_item(Key={"facility_id": facility_id, "resident_id": resident_id})
        except Exception:
            logger.exception("delete_resident failed for resident %s", resident_id)
            raise

        # 3) Delete emergency contacts (best-effort)
        try:
            ec_table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
            ec_items = self._paginate_query(
                ec_table,
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            for item in ec_items:
                ec_table.delete_item(
                    Key={
                        "resident_id": resident_id,
                        "contact_priority": item["contact_priority"],
                    }
                )
        except Exception:
            logger.exception(
                "delete_resident: failed to delete emergency contacts for resident %s", resident_id
            )

        return photo_s3_key or ""

    # ==================== UPDATE RESIDENT ====================

    def update_resident(
        self, facility_id: str, resident_id: str, resident_data: Dict
    ) -> Dict:
        """
        Update an existing resident's information.
        Only updates the fields provided in resident_data.

        FIX: Previously tried to read first_name / last_name from the DB record,
        but those are stored encrypted (first_name_enc). The caller must supply
        both names when they want status_name_sort to be rebuilt correctly.
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v

        current_resident = self.get_resident_info(resident_id)
        if not current_resident:
            raise ValueError(f"Resident {resident_id} not found")

        update_expr_parts = []
        expr_attr_names: Dict = {}
        expr_attr_values: Dict = {}
        idx = 0

        # Rebuild status_name_sort only if caller provides at least one of its components.
        # Names come from the caller — they are NOT readable from the DB record
        # because they are stored encrypted.
        if any(k in resident_data for k in ("first_name", "last_name", "status")):
            first_name = v(resident_data.get("first_name", ""))
            last_name = v(resident_data.get("last_name", ""))
            status_for_sort = resident_data.get("status", current_resident.get("status", "ACTIVE"))
            status_name_sort = f"{status_for_sort}#{last_name}#{first_name}#{resident_id}"
            expr_attr_names["#status_name_sort"] = "status_name_sort"
            expr_attr_values[":status_name_sort"] = status_name_sort
            update_expr_parts.append("#status_name_sort = :status_name_sort")

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
                continue

            if field_name == "room_number":
                expr_attr_names["#room_id"] = "room_id"
                expr_attr_values[":room_id"] = f"ROOM#r-{field_value}"
                update_expr_parts.append("#room_id = :room_id")
            else:
                ak = f"#field{idx}"
                vk = f":val{idx}"
                expr_attr_names[ak] = field_name
                expr_attr_values[vk] = int(field_value) if field_name == "age" else v(field_value)
                update_expr_parts.append(f"{ak} = {vk}")
                idx += 1

        if "age" in resident_data:
            age = int(resident_data["age"])
            age_group = "65-74" if age < 75 else ("75-84" if age < 85 else "85+")
            expr_attr_names["#age_group"] = "age_group"
            expr_attr_values[":age_group"] = age_group
            update_expr_parts.append("#age_group = :age_group")

        expr_attr_names["#updated_at"] = "updated_at"
        expr_attr_values[":updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append("#updated_at = :updated_at")

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
            for key in ("first_name_enc", "last_name_enc", "display_name_enc", "dob_enc"):
                if key in updated_item:
                    updated_item[key] = "[ENCRYPTED]"
            return updated_item
        except Exception:
            logger.exception(
                "update_resident failed for resident %s / facility %s", resident_id, facility_id
            )
            raise

    # ==================== FALLS ENDPOINTS ====================

    def get_fall_video_clip(self, fall_id: str) -> Optional[Dict]:
        """Get video clip information for a specific fall event."""
        table = self.dynamodb.Table("fall_video_clips")
        try:
            response = table.get_item(
                Key={"fall_id": fall_id, "sk": "CLIP"}
            )
            item = response.get("Item")
            return self.serialize_item(item) if item else None
        except Exception:
            logger.exception("get_fall_video_clip failed for fall %s", fall_id)
            return None

    def get_fall_events(
        self, facility_id: str, days: int = 30, priority: str = None
    ) -> List[Dict]:
        """
        Get fall events for a facility.

        FIX 1: Resident enrichment (name, room, photo) now always runs,
                not only when a priority filter is active.
        FIX 2: Pagination added so large facilities don't silently lose records.
        FIX 3: Date filtering is still done in Python because the GSI sort key
                is not a date; left with a TODO to add a date-range GSI.
        """
        table = self.dynamodb.Table("fall_events")
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            # TODO: push date range into DynamoDB using a date-based GSI sort key
            # to avoid full-table fan-out on large datasets.
            all_falls = self._paginate_query(
                table,
                IndexName="gsi-facility-ts",
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            falls = self.serialize_item(all_falls)

            # Filter by date range in Python
            start_str = start_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            falls = [f for f in falls if f.get("fall_ts", "") >= start_str]

            # Optional priority (severity) filter
            if priority and priority.upper() != "ALL":
                falls = [
                    f for f in falls
                    if f.get("severity", "").upper() == priority.upper()
                ]

            # ── Enrich ALL falls with resident info ──────────────────────────
            # FIX: this block was previously nested inside the `if priority`
            # block, so it only ran when a filter was active.
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

                # Name from status_name_sort: STATUS#last#first#id
                parts = resident.get("status_name_sort", "").split("#")
                fall["resident_name"] = (
                    f"{parts[2]} {parts[1]}" if len(parts) >= 3 else "Unknown Resident"
                )

                # Room from resident record, falling back to fall's own room_id
                room_id = resident.get("room_id", "")
                fall["location_id"] = (
                    room_id if room_id and room_id != "N/A" else fall.get("room_id", "")
                )

                fall["photo_s3_key"] = resident.get("photo_s3_key", "")
            # ─────────────────────────────────────────────────────────────────

            falls.sort(key=lambda x: x.get("fall_ts", ""), reverse=True)
            return falls

        except Exception:
            logger.exception(
                "get_fall_events failed for facility %s", facility_id
            )
            return []

    def get_fall_analytics(self, facility_id: str, days: int = 1) -> List[Dict]:
        """Get hourly fall-count analytics for the last N days."""
        try:
            falls = self.get_fall_events(facility_id, days)

            hourly_counts = {i: 0 for i in range(24)}
            for fall in falls:
                fall_ts = fall.get("fall_ts", "")
                if fall_ts:
                    try:
                        dt = datetime.fromisoformat(fall_ts.replace("Z", "+00:00"))
                        hourly_counts[dt.hour] += 1
                    except ValueError:
                        logger.warning("Unparseable fall_ts: %s", fall_ts)

            hours_map = [0, 3, 6, 9, 12, 15, 18, 21, 23]
            time_labels = ["12Am", "3Am", "6Am", "9Am", "12Pm", "3Pm", "6Pm", "9Pm", "12Am"]

            analytics = []
            for i, hour in enumerate(hours_map):
                if i < len(hours_map) - 1:
                    count = sum(hourly_counts.get(h, 0) for h in range(hour, hours_map[i + 1]))
                else:
                    count = hourly_counts.get(23, 0) + hourly_counts.get(0, 0)
                analytics.append({"time": time_labels[i], "falls": count})

            return analytics
        except Exception:
            logger.exception("get_fall_analytics failed for facility %s", facility_id)
            return []

    # ==================== CAREGIVERS ENDPOINTS ====================

    def get_all_caregivers(self, facility_id: str = None) -> List[Dict]:
        """Get all caregivers in a facility (handles DynamoDB pagination)."""
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table("caregivers")
        try:
            items = self._paginate_query(
                table,
                KeyConditionExpression=Key("facility_id").eq(facility_id),
            )
            logger.info("Total caregivers fetched from DynamoDB: %d", len(items))

            cleaned_items = []
            for item in items:
                cleaned = self.serialize_item(item)
                if "cognito_user_id" in cleaned:
                    cleaned["cognito_user_id"] = "[PROTECTED]"
                cleaned_items.append(cleaned)

            return cleaned_items
        except Exception:
            logger.exception("get_all_caregivers failed for facility %s", facility_id)
            return []

    def get_caregiver_info(
        self, caregiver_id: str, facility_id: str = None
    ) -> Optional[Dict]:
        """Get detailed caregiver information."""
        if facility_id is None:
            facility_id = settings.FACILITY_ID

        table = self.dynamodb.Table("caregivers")
        try:
            response = table.query(
                KeyConditionExpression=Key("facility_id").eq(facility_id)
                & Key("caregiver_id").eq(caregiver_id),
                Limit=1,
            )
            items = response.get("Items", [])
            if not items:
                return None
            cleaned = self.serialize_item(items[0])
            if "cognito_user_id" in cleaned:
                cleaned["cognito_user_id"] = "[PROTECTED]"
            return cleaned
        except Exception:
            logger.exception(
                "get_caregiver_info failed for caregiver %s", caregiver_id
            )
            return None

    def get_caregiver_certifications(self, caregiver_id: str) -> List[Dict]:
        """Get certifications for a caregiver."""
        table = self.dynamodb.Table("caregiver_certifications")
        try:
            response = table.query(
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id)
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_certifications failed for caregiver %s", caregiver_id
            )
            return []

    def get_caregiver_assignments(self, caregiver_id: str, days: int = 7) -> List[Dict]:
        """Get resident assignments for a caregiver."""
        table = self.dynamodb.Table("caregiver_resident_assignments")
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            end_date = datetime.now().strftime("%Y-%m-%d")

            response = table.query(
                IndexName="gsi-caregiver-date",
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id)
                & Key("shift_date").between(start_date, end_date),
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_assignments failed for caregiver %s", caregiver_id
            )
            return []

    def get_caregiver_schedule(self, caregiver_id: str, days: int = 7) -> List[Dict]:
        """Get shift schedule for a caregiver."""
        table = self.dynamodb.Table("caregiver_shift_schedule")
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            end_date = datetime.now().strftime("%Y-%m-%d")

            response = table.query(
                IndexName="gsi-caregiver-date",
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id)
                & Key("shift_date").between(start_date, end_date),
            )
            return self.serialize_item(response.get("Items", []))
        except Exception:
            logger.exception(
                "get_caregiver_schedule failed for caregiver %s", caregiver_id
            )
            return []

    def get_caregiver_performance(self, caregiver_id: str) -> Optional[Dict]:
        """Get latest performance metrics for a caregiver."""
        table = self.dynamodb.Table("caregiver_performance_metrics")
        try:
            response = table.query(
                KeyConditionExpression=Key("caregiver_id").eq(caregiver_id),
                ScanIndexForward=False,
                Limit=1,
            )
            items = response.get("Items", [])
            return self.serialize_item(items[0]) if items else None
        except Exception:
            logger.exception(
                "get_caregiver_performance failed for caregiver %s", caregiver_id
            )
            return None

    def get_resident_caregivers(self, resident_id: str, days: int = 7) -> List[Dict]:
        """Get currently assigned caregivers for a resident (active assignments only)."""
        table = self.dynamodb.Table("caregiver_resident_assignments")
        try:
            all_assignments = self._paginate_query(
                table,
                IndexName="gsi-resident-date",
                KeyConditionExpression=Key("resident_id").eq(resident_id),
            )
            all_assignments = self.serialize_item(all_assignments)
            logger.debug(
                "[DB] %d total assignments for resident %s", len(all_assignments), resident_id
            )

            active = [a for a in all_assignments if a.get("is_active") is True]
            logger.debug("[DB] %d active assignments", len(active))

            caregiver_ids = list({a["caregiver_id"] for a in active if a.get("caregiver_id")})
            caregivers = []

            for cg_id in caregiver_ids:
                caregiver = self.get_caregiver_info(cg_id, settings.FACILITY_ID)
                if not caregiver:
                    continue

                cg_assignments = [a for a in active if a.get("caregiver_id") == cg_id]
                latest = max(
                    cg_assignments, key=lambda x: x.get("shift_date", ""), default=None
                )
                if latest:
                    caregiver["assignment_type"] = latest.get("assignment_type", "PRIMARY")
                    caregiver["shift_type"] = latest.get("shift_type", "N/A")
                    caregiver["assigned_date"] = latest.get("shift_date", "N/A")

                caregivers.append(caregiver)

            # PRIMARY assignments first, then alphabetical
            caregivers.sort(
                key=lambda x: (x.get("assignment_type") != "PRIMARY", x.get("display_name", ""))
            )
            logger.debug(
                "[DB] Returning %d active caregivers for resident %s",
                len(caregivers), resident_id,
            )
            return caregivers
        except Exception:
            logger.exception(
                "get_resident_caregivers failed for resident %s", resident_id
            )
            return []

    # ==================== CREATE CAREGIVER ====================

    def create_caregiver(
        self, facility_id: str, caregiver_data: Dict, photo_s3_key: str = None
    ) -> Dict:
        """
        Create a new caregiver. Only facility_id is assumed.
        Every other field comes from the form; missing → 'N/A'.
        """
        table = self.dynamodb.Table("caregivers")
        now = datetime.now(timezone.utc)
        v = self._v

        if "_override_caregiver_id" in caregiver_data:
            caregiver_id = caregiver_data["_override_caregiver_id"]
        else:
            date_part = now.strftime("%Y%m%d")
            short_uuid = uuid.uuid4().hex[:4]
            caregiver_id = f"CG#cg-{date_part}-{short_uuid}"

        first_name = v(caregiver_data.get("first_name"))
        last_name = v(caregiver_data.get("last_name"))
        email = v(caregiver_data.get("email"))
        phone = v(caregiver_data.get("phone"))
        role = v(caregiver_data.get("role"))
        primary_shift = v(caregiver_data.get("primary_shift"))
        badge_id = v(caregiver_data.get("badge_id"))
        employee_id = v(caregiver_data.get("employee_id"))
        status = caregiver_data.get("status", "ACTIVE")

        if badge_id == "N/A":
            badge_id = f"BADGE#B-{4500 + int(uuid.uuid4().hex[:4], 16) % 1000}"
        if employee_id == "N/A":
            employee_id = (
                f"EMP#E-2025-{str(300 + int(uuid.uuid4().hex[:4], 16) % 1000).zfill(4)}"
            )

        fall_response_trained = caregiver_data.get("fall_response_trained", False)
        mfa_enabled = caregiver_data.get("mfa_enabled", True)

        raw_max_load = caregiver_data.get("max_resident_load")
        max_resident_load = (
            int(raw_max_load) if raw_max_load not in (None, "", "N/A") else 10
        )

        display_name = f"{first_name} {last_name}, {role}"
        status_display_name = f"{status}#{display_name}"
        license_status_expiry = "ACTIVE#2026-12-31"

        permissions = ["residents:read", "falls:read", "alerts:acknowledge"]
        if role in ("RN", "NP", "ADMIN"):
            permissions.extend(["residents:write", "falls:write", "reports:read"])

        dashboard_access_level = "FULL" if role in ("RN", "NP", "ADMIN") else "READ_ONLY"
        is_caregiver = role != "ADMIN"
        cognito_user_id = (
            f"us-east-1_{uuid.uuid4().hex[:8]}:{uuid.uuid4().hex[:12]}"
        )

        item = {
            "facility_id": facility_id,
            "caregiver_id": caregiver_id,
            "cognito_user_id": cognito_user_id,
            "badge_id": badge_id,
            "employee_id": employee_id,
            "first_name": first_name,
            "last_name": last_name,
            "display_name": display_name,
            "email": email,
            "phone": phone,
            "role": role,
            "is_caregiver": is_caregiver,
            "primary_shift": primary_shift,
            "max_resident_load": max_resident_load,
            "current_resident_count": 0,
            "fall_response_trained": fall_response_trained,
            "avg_response_time_sec": 0,
            "total_falls_responded": 0,
            "dashboard_access_level": dashboard_access_level,
            "permissions": permissions,
            "mfa_enabled": mfa_enabled,
            "status": status,
            "status_display_name": status_display_name,
            "license_status_expiry": license_status_expiry,
            "photo_s3_key": photo_s3_key or "",
            "created_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version": 1,
        }

        try:
            table.put_item(Item=item)
            clean = self.serialize_item(item)
            if "cognito_user_id" in clean:
                clean["cognito_user_id"] = "[PROTECTED]"
            return clean
        except Exception:
            logger.exception("create_caregiver failed for facility %s", facility_id)
            raise

    # ==================== UPDATE CAREGIVER ====================

    def update_caregiver(
        self, facility_id: str, caregiver_id: str, caregiver_data: Dict
    ) -> Dict:
        """
        Update an existing caregiver's information.
        Only updates the fields provided in caregiver_data.
        """
        table = self.dynamodb.Table("caregivers")
        now = datetime.now(timezone.utc)
        v = self._v

        current_caregiver = self.get_caregiver_info(caregiver_id, facility_id)
        if not current_caregiver:
            raise ValueError(f"Caregiver {caregiver_id} not found")

        update_expr_parts = []
        expr_attr_names: Dict = {}
        expr_attr_values: Dict = {}
        idx = 0

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

        # Compute display_name and status_display_name from merged state
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

        for field_name, field_value in field_mapping.items():
            if field_value is None:
                continue
            ak = f"#field{idx}"
            vk = f":val{idx}"
            expr_attr_names[ak] = field_name
            expr_attr_values[vk] = v(field_value)
            update_expr_parts.append(f"{ak} = {vk}")
            idx += 1

        expr_attr_names["#display_name"] = "display_name"
        expr_attr_values[":display_name"] = display_name
        update_expr_parts.append("#display_name = :display_name")

        expr_attr_names["#status_display_name"] = "status_display_name"
        expr_attr_values[":status_display_name"] = status_display_name
        update_expr_parts.append("#status_display_name = :status_display_name")

        expr_attr_names["#updated_at"] = "updated_at"
        expr_attr_values[":updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append("#updated_at = :updated_at")

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
                updated_item["cognito_user_id"] = "[PROTECTED]"
            return updated_item
        except Exception:
            logger.exception(
                "update_caregiver failed for caregiver %s / facility %s",
                caregiver_id, facility_id,
            )
            raise


# Singleton instance
db_service = DynamoDBService()