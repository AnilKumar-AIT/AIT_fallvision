"""
Common/Residents API Routes
"""
import json
import uuid
import logging
import traceback
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from ..services.dynamodb_service import db_service
from ..services.s3_service import s3_service
from ..config import settings

# ---------------------------------------------------------------------------
# Module-level logger — created once, reused across all route handlers
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/residents", tags=["Residents"])


# ===========================================================================
# GET /residents/
# ===========================================================================

@router.get("/")
async def get_all_residents() -> Dict:
    """Return a list of all residents registered in the facility."""
    try:
        residents = db_service.get_all_residents(settings.FACILITY_ID)

        logger.info(f"[RESIDENTS API] Fetched {len(residents)} residents for facility {settings.FACILITY_ID}")

        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(residents),
            "residents": residents
        }

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching all residents: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# POST /residents/
# ===========================================================================

@router.post("/")
async def create_resident(
    resident_data: str = Form(...),
    photo: Optional[UploadFile] = File(None)
) -> Dict:
    """
    Create a new resident with an optional profile photo.

    Accepts multipart/form-data:
      - resident_data: JSON string containing resident fields
      - photo (optional): image file to upload to S3
    """
    try:
        # Parse the JSON string sent as a form field
        data = json.loads(resident_data)

        facility_id = settings.FACILITY_ID
        photo_s3_key = None

        # ------------------------------------------------------------------
        # Handle optional photo upload
        # ------------------------------------------------------------------
        if photo and photo.filename:
            file_bytes = await photo.read()

            if len(file_bytes) > 0:
                # Build a unique resident ID to use as the S3 path prefix so
                # the S3 key and DynamoDB record stay in sync from the start
                date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
                short_uuid = uuid.uuid4().hex[:4]
                temp_resident_id = f"RES#res-{date_part}-{short_uuid}"

                logger.info(f"[RESIDENTS API] Uploading photo for temp ID: {temp_resident_id}")

                photo_s3_key = s3_service.upload_resident_photo(
                    facility_id=facility_id,
                    resident_id=temp_resident_id,
                    file_bytes=file_bytes,
                    content_type=photo.content_type or "image/jpeg"
                )

                # Pass the generated ID through so the DB creation step uses
                # the same key that was used for the S3 upload
                data["_override_resident_id"] = temp_resident_id

        # ------------------------------------------------------------------
        # Persist the resident record in DynamoDB
        # ------------------------------------------------------------------
        created = db_service.create_resident(
            facility_id=facility_id,
            resident_data=data,
            photo_s3_key=photo_s3_key
        )

        # ------------------------------------------------------------------
        # Persist any emergency contacts supplied in the payload
        # ------------------------------------------------------------------
        contacts = data.get("emergency_contacts", [])
        if contacts:
            resident_id = created.get("resident_id")
            db_service.create_emergency_contacts(resident_id, contacts)
            logger.info(f"[RESIDENTS API] Created {len(contacts)} emergency contact(s) for {resident_id}")

        logger.info(f"[RESIDENTS API] Resident created successfully in facility {facility_id}")

        return {
            "message": "Resident created successfully",
            "resident": created
        }

    except json.JSONDecodeError:
        # Bad JSON in the form field — return a clear 400 instead of a 500
        logger.warning("[RESIDENTS API] Invalid JSON received in resident_data field")
        raise HTTPException(status_code=400, detail="Invalid JSON in resident_data")

    except Exception as e:
        logger.error(f"[RESIDENTS API] Unexpected error creating resident: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# PUT /residents/{resident_id}
# ===========================================================================

@router.put("/{resident_id}")
async def update_resident(
    resident_id: str,
    resident_data: Dict
) -> Dict:
    """
    Update an existing resident's information.

    Raises 404 if the resident does not exist.
    """
    try:
        logger.info(f"[RESIDENTS API] Update request for resident: {resident_id}")

        updated = db_service.update_resident(
            facility_id=settings.FACILITY_ID,
            resident_id=resident_id,
            resident_data=resident_data
        )

        logger.info(f"[RESIDENTS API] Resident updated successfully: {resident_id}")

        return {
            "message": "Resident updated successfully",
            "resident": updated
        }

    except ValueError as e:
        # db_service raises ValueError when the record is not found
        logger.warning(f"[RESIDENTS API] Resident not found for update: {resident_id}")
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error updating resident {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}
# ===========================================================================

@router.get("/{resident_id}")
async def get_resident(resident_id: str) -> Dict:
    """Return detailed profile information for a single resident."""
    try:
        logger.info(f"[RESIDENTS API] Details request for resident: {resident_id}")

        resident = db_service.get_resident_info(resident_id)
        if not resident:
            logger.warning(f"[RESIDENTS API] Resident not found: {resident_id}")
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")

        logger.info(f"[RESIDENTS API] Resident found: {resident_id}")
        return resident

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching resident {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}/alerts
# ===========================================================================

@router.get("/{resident_id}/alerts")
async def get_resident_alerts(resident_id: str, limit: int = 10) -> Dict:
    """
    Return recent alerts for a resident.

    Query params:
      - limit: maximum number of alerts to return (default 10)
    """
    try:
        logger.info(f"[RESIDENTS API] Alerts request for resident: {resident_id} (limit={limit})")

        alerts = db_service.get_recent_alerts(resident_id, limit)

        logger.info(f"[RESIDENTS API] Returning {len(alerts)} alerts for resident: {resident_id}")

        return {"resident_id": resident_id, "alerts": alerts}

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching alerts for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}/suggestions
# ===========================================================================

@router.get("/{resident_id}/suggestions")
async def get_resident_suggestions(resident_id: str, limit: int = 10) -> Dict:
    """
    Return AI-generated care suggestions for a resident.

    Query params:
      - limit: maximum number of suggestions to return (default 10)
    """
    try:
        logger.info(f"[RESIDENTS API] Suggestions request for resident: {resident_id} (limit={limit})")

        suggestions = db_service.get_resident_suggestions(resident_id, limit)

        logger.info(f"[RESIDENTS API] Returning {len(suggestions)} suggestions for resident: {resident_id}")

        return {"resident_id": resident_id, "suggestions": suggestions}

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching suggestions for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}/health-score
# ===========================================================================

@router.get("/{resident_id}/health-score")
async def get_health_score(resident_id: str) -> Dict:
    """Return the health score for a resident. Raises 404 if none exists."""
    try:
        logger.info(f"[RESIDENTS API] Health score request for resident: {resident_id}")

        score = db_service.get_health_score(resident_id)
        if not score:
            logger.warning(f"[RESIDENTS API] No health score found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No health score found for {resident_id}")

        logger.info(f"[RESIDENTS API] Health score fetched for resident: {resident_id}")
        return score

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching health score for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}/emergency-contacts
# ===========================================================================

@router.get("/{resident_id}/emergency-contacts")
async def get_emergency_contacts(resident_id: str) -> Dict:
    """Return all emergency contacts on record for the resident."""
    try:
        logger.info(f"[RESIDENTS API] Emergency contacts request for resident: {resident_id}")

        contacts = db_service.get_emergency_contacts(resident_id)

        logger.info(f"[RESIDENTS API] Returning {len(contacts)} contact(s) for resident: {resident_id}")

        return {
            "resident_id": resident_id,
            "contacts": contacts,
            "count": len(contacts)
        }

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching emergency contacts for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /residents/{resident_id}/caregivers
# ===========================================================================

@router.get("/{resident_id}/caregivers")
async def get_resident_caregivers(resident_id: str, days: int = 7) -> Dict:
    """
    Return caregivers assigned to the resident over a rolling window.

    Query params:
      - days: number of past days to include (default 7)
    """
    try:
        logger.info(f"[RESIDENTS API] Caregivers request for resident: {resident_id} (days={days})")

        caregivers = db_service.get_resident_caregivers(resident_id, days)

        logger.info(f"[RESIDENTS API] Returning {len(caregivers)} caregiver(s) for resident: {resident_id}")

        return {
            "resident_id": resident_id,
            "caregivers": caregivers,
            "count": len(caregivers),
            "days": days
        }

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error fetching caregivers for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# DELETE /residents/{resident_id}
# ===========================================================================

@router.delete("/{resident_id}")
async def delete_resident(resident_id: str) -> Dict:
    """
    Delete a resident along with their emergency contacts and S3 profile photo.

    The DynamoDB deletion returns the photo_s3_key (if one existed) so we
    can clean up S3 in the same request. S3 errors are logged but do not
    fail the response — the DB record is already gone and a dangling S3
    object is preferable to returning a 500 to the caller.
    """
    try:
        logger.info(f"[RESIDENTS API] Delete request for resident: {resident_id}")

        # Delete from DynamoDB — returns photo_s3_key for S3 cleanup
        photo_s3_key = db_service.delete_resident(settings.FACILITY_ID, resident_id)

        # ------------------------------------------------------------------
        # Clean up the profile photo from S3 if one existed.
        # Failures here are non-fatal: the resident record is already gone
        # and a dangling S3 object is better than a misleading 500 error.
        # ------------------------------------------------------------------
        if photo_s3_key:
            try:
                s3_service.delete_photo(photo_s3_key)
                logger.info(f"[RESIDENTS API] Deleted S3 photo for resident: {resident_id}")
            except Exception as s3_err:
                logger.warning(f"[RESIDENTS API] S3 photo deletion failed for {resident_id}: {s3_err}")

        logger.info(f"[RESIDENTS API] Resident deleted successfully: {resident_id}")

        return {
            "message": "Resident deleted successfully",
            "resident_id": resident_id,
            "photo_deleted": bool(photo_s3_key)
        }

    except Exception as e:
        logger.error(f"[RESIDENTS API] Error deleting resident {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))