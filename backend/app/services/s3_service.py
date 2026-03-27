"""S3 Service Layer

Handles photo uploads, retrieval, and deletion for residents and caregivers.
All photos are stored with AES-256 server-side encryption.

Bucket layout:
    residents/<facility_id>/<resident_id>/avatar_<timestamp>.<ext>
    caregivers/<facility_id>/<caregiver_id>/avatar_<timestamp>.<ext>
"""

import logging
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from ..config import settings

logger = logging.getLogger(__name__)

# Supported MIME types and their file extensions
_CONTENT_TYPE_EXTENSION_MAP: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
}

# Fallback extension when the content type is not in the map
_DEFAULT_EXTENSION = ".jpg"


class S3Service:
    """Service for managing photo assets in AWS S3.

    Provides upload, presigned URL generation, and deletion operations
    for resident and caregiver profile photos. All objects are stored
    with AES-256 server-side encryption and tagged with relevant metadata.

    Attributes:
        s3_client: Boto3 S3 client scoped to the configured AWS region.
        bucket_name: Name of the S3 bucket used for photo storage.
    """

    def __init__(self) -> None:
        self.s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
        self.bucket_name = settings.S3_PHOTOS_BUCKET

    # ------------------------------------------------------------------
    # Public upload methods
    # ------------------------------------------------------------------

    def upload_resident_photo(
        self,
        facility_id: str,
        resident_id: str,
        file_bytes: bytes,
        content_type: str = "image/jpeg",
    ) -> str:
        """Upload a resident profile photo to S3.

        Args:
            facility_id:  Resident's facility identifier, e.g. ``"FAC#f-001"``.
            resident_id:  Resident identifier, e.g. ``"RES#res-20250301-0001"``.
            file_bytes:   Raw binary content of the image file.
            content_type: MIME type of the image (default: ``"image/jpeg"``).

        Returns:
            The S3 object key where the photo was stored.

        Raises:
            ValueError: If ``facility_id``, ``resident_id``, or ``file_bytes``
                        are empty.
            ClientError: If the S3 ``put_object`` call fails.
        """
        self._validate_upload_args(facility_id, resident_id, file_bytes)

        # Strip DynamoDB-style prefixes for use in the S3 path
        fac_clean = facility_id.replace("FAC#", "")
        res_clean = resident_id.replace("RES#", "")

        s3_key = self._build_s3_key("residents", fac_clean, res_clean, content_type)
        metadata = {
            "facility_id": facility_id,
            "resident_id": resident_id,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }

        self._put_object(s3_key, file_bytes, content_type, metadata)
        logger.info("Uploaded resident photo | key=%s", s3_key)
        return s3_key

    def upload_caregiver_photo(
        self,
        facility_id: str,
        caregiver_id: str,
        file_bytes: bytes,
        content_type: str = "image/jpeg",
    ) -> str:
        """Upload a caregiver profile photo to S3.

        Args:
            facility_id:  Caregiver's facility identifier, e.g. ``"FAC#f-001"``.
            caregiver_id: Caregiver identifier, e.g. ``"CG#cg-20250301-0001"``.
            file_bytes:   Raw binary content of the image file.
            content_type: MIME type of the image (default: ``"image/jpeg"``).

        Returns:
            The S3 object key where the photo was stored.

        Raises:
            ValueError: If ``facility_id``, ``caregiver_id``, or ``file_bytes``
                        are empty.
            ClientError: If the S3 ``put_object`` call fails.
        """
        self._validate_upload_args(facility_id, caregiver_id, file_bytes)

        # Strip DynamoDB-style prefixes for use in the S3 path
        fac_clean = facility_id.replace("FAC#", "")
        cg_clean = caregiver_id.replace("CG#", "")

        s3_key = self._build_s3_key("caregivers", fac_clean, cg_clean, content_type)
        metadata = {
            "facility_id": facility_id,
            "caregiver_id": caregiver_id,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }

        self._put_object(s3_key, file_bytes, content_type, metadata)
        logger.info("Uploaded caregiver photo | key=%s", s3_key)
        return s3_key

    # ------------------------------------------------------------------
    # Presigned URL
    # ------------------------------------------------------------------

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate a time-limited presigned URL for reading a photo.

        Args:
            s3_key:     S3 object key returned by one of the upload methods.
            expiration: URL validity in seconds (default: 3 600 = 1 hour).

        Returns:
            A presigned HTTPS URL string valid for ``expiration`` seconds.

        Raises:
            ValueError: If ``s3_key`` is empty.
            ClientError: If URL generation fails (e.g. key does not exist).
        """
        if not s3_key:
            raise ValueError("s3_key must not be empty.")

        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": s3_key,
                },
                ExpiresIn=expiration,
            )
        except ClientError:
            logger.exception(
                "Failed to generate presigned URL | bucket=%s key=%s",
                self.bucket_name,
                s3_key,
            )
            raise

        logger.debug("Generated presigned URL | key=%s expiration=%ss", s3_key, expiration)
        return url

    # ------------------------------------------------------------------
    # Deletion
    # ------------------------------------------------------------------

    def delete_photo(self, s3_key: str) -> None:
        """Permanently delete a photo object from S3.

        Args:
            s3_key: S3 object key of the photo to remove.

        Raises:
            ValueError: If ``s3_key`` is empty.
            ClientError: If the S3 ``delete_object`` call fails.
        """
        if not s3_key:
            raise ValueError("s3_key must not be empty.")

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
        except ClientError:
            logger.exception(
                "Failed to delete photo | bucket=%s key=%s",
                self.bucket_name,
                s3_key,
            )
            raise

        logger.info("Deleted photo from S3 | key=%s", s3_key)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_s3_key(
        self,
        entity_type: str,
        facility_id: str,
        entity_id: str,
        content_type: str,
    ) -> str:
        """Construct a deterministic, timestamped S3 object key.

        Format: ``<entity_type>/<facility_id>/<entity_id>/avatar_<ts>.<ext>``

        Args:
            entity_type:  Top-level path segment, e.g. ``"residents"``.
            facility_id:  Cleaned facility identifier (no ``FAC#`` prefix).
            entity_id:    Cleaned entity identifier (no type prefix).
            content_type: MIME type used to derive the file extension.

        Returns:
            A fully qualified S3 key string.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        ext = self._get_extension(content_type)
        filename = f"avatar_{timestamp}{ext}"
        return f"{entity_type}/{facility_id}/{entity_id}/{filename}"

    def _put_object(
        self,
        s3_key: str,
        file_bytes: bytes,
        content_type: str,
        metadata: dict[str, str],
    ) -> None:
        """Write bytes to S3 with encryption and metadata.

        Args:
            s3_key:       Destination object key.
            file_bytes:   Raw image bytes.
            content_type: MIME type stored as the object's Content-Type.
            metadata:     Key/value pairs attached as S3 object metadata.

        Raises:
            ClientError: Propagated from boto3 on any S3 error.
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
                ServerSideEncryption="AES256",
                Metadata=metadata,
            )
        except ClientError:
            logger.exception(
                "Failed to upload photo | bucket=%s key=%s",
                self.bucket_name,
                s3_key,
            )
            raise

    @staticmethod
    def _validate_upload_args(entity_id_a: str, entity_id_b: str, file_bytes: bytes) -> None:
        """Raise ``ValueError`` if any required upload argument is falsy.

        Args:
            entity_id_a: First identifier (facility or similar).
            entity_id_b: Second identifier (resident, caregiver, or similar).
            file_bytes:  Raw image bytes — must be non-empty.

        Raises:
            ValueError: Describes which argument is missing.
        """
        if not entity_id_a:
            raise ValueError("facility_id must not be empty.")
        if not entity_id_b:
            raise ValueError("entity_id (resident_id / caregiver_id) must not be empty.")
        if not file_bytes:
            raise ValueError("file_bytes must not be empty.")

    @staticmethod
    def _get_extension(content_type: str) -> str:
        """Return the file extension for a given MIME type.

        Falls back to ``".jpg"`` for unrecognised types.

        Args:
            content_type: MIME type string, e.g. ``"image/png"``.

        Returns:
            Dotted extension string, e.g. ``".png"``.
        """
        return _CONTENT_TYPE_EXTENSION_MAP.get(content_type, _DEFAULT_EXTENSION)


# ---------------------------------------------------------------------------
# Module-level singleton
# Instantiated once at import time; re-use this across the application.
# ---------------------------------------------------------------------------
s3_service = S3Service()