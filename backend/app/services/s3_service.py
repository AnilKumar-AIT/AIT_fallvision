"""
S3 Service Layer
Handles photo uploads for residents and caregivers
"""
import boto3
import uuid
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from ..config import settings


class S3Service:
    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=settings.AWS_REGION)
        self.bucket_name = settings.S3_PHOTOS_BUCKET

    def upload_resident_photo(self, facility_id: str, resident_id: str, file_bytes: bytes, content_type: str = "image/jpeg") -> str:
        """
        Upload a resident photo to S3 and return the S3 key.
        
        Args:
            facility_id: e.g. "FAC#f-001"
            resident_id: e.g. "RES#res-20250301-0001"
            file_bytes: Raw file bytes
            content_type: MIME type of the file
        
        Returns:
            S3 key string
        """
        # Clean IDs for path construction
        fac_clean = facility_id.replace("FAC#", "")
        res_clean = resident_id.replace("RES#", "")

        # Generate unique filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        ext = self._get_extension(content_type)
        filename = f"avatar_{timestamp}{ext}"

        s3_key = f"residents/{fac_clean}/{res_clean}/{filename}"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
                ServerSideEncryption="AES256",
                Metadata={
                    "facility_id": facility_id,
                    "resident_id": resident_id,
                    "uploaded_at": datetime.now(timezone.utc).isoformat()
                }
            )
            print(f"[S3] Uploaded resident photo: {s3_key}")
            return s3_key
        except ClientError as e:
            print(f"[S3 ERROR] Failed to upload photo: {e}")
            raise

    def upload_caregiver_photo(self, facility_id: str, caregiver_id: str, file_bytes: bytes, content_type: str = "image/jpeg") -> str:
        """
        Upload a caregiver photo to S3 and return the S3 key.
        
        Args:
            facility_id: e.g. "FAC#f-001"
            caregiver_id: e.g. "CG#cg-20250301-0001"
            file_bytes: Raw file bytes
            content_type: MIME type of the file
        
        Returns:
            S3 key string
        """
        # Clean IDs for path construction
        fac_clean = facility_id.replace("FAC#", "")
        cg_clean = caregiver_id.replace("CG#", "")

        # Generate unique filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        ext = self._get_extension(content_type)
        filename = f"avatar_{timestamp}{ext}"

        s3_key = f"caregivers/{fac_clean}/{cg_clean}/{filename}"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type,
                ServerSideEncryption="AES256",
                Metadata={
                    "facility_id": facility_id,
                    "caregiver_id": caregiver_id,
                    "uploaded_at": datetime.now(timezone.utc).isoformat()
                }
            )
            print(f"[S3] Uploaded caregiver photo: {s3_key}")
            return s3_key
        except ClientError as e:
            print(f"[S3 ERROR] Failed to upload photo: {e}")
            raise

    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate a presigned URL for accessing a photo"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"[S3 ERROR] Failed to generate presigned URL: {e}")
            raise

    def delete_photo(self, s3_key: str):
        """Delete a photo from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            print(f"[S3] Deleted photo: {s3_key}")
        except ClientError as e:
            print(f"[S3 ERROR] Failed to delete photo: {e}")
            raise

    def _get_extension(self, content_type: str) -> str:
        """Map content type to file extension"""
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        return mapping.get(content_type, ".jpg")


# Singleton instance
s3_service = S3Service()
