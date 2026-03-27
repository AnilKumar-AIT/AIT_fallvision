"""Caregivers API Routes"""
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

router = APIRouter(prefix="/caregivers", tags=["Caregivers"])


# ===========================================================================
# POST /caregivers/
# ===========================================================================

@router.post("/")
async def create_caregiver(
    caregiver_data: str = Form(...),
    photo: Optional[UploadFile] = File(None)
) -> Dict:
    """
    Create a new caregiver with an optional profile photo.

    Accepts multipart/form-data:
      - caregiver_data: JSON string containing caregiver fields
      - photo (optional): image file to upload to S3
    """
    try:
        # Parse the JSON string sent as a form field
        data = json.loads(caregiver_data)

        facility_id = settings.FACILITY_ID
        photo_s3_key = None

        # ------------------------------------------------------------------
        # Handle optional photo upload
        # ------------------------------------------------------------------
        if photo and photo.filename:
            file_bytes = await photo.read()

            if len(file_bytes) > 0:
                # Build a unique caregiver ID to use as the S3 path prefix
                date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
                short_uuid = uuid.uuid4().hex[:4]
                temp_caregiver_id = f"CG#cg-{date_part}-{short_uuid}"

                logger.info(f"[CAREGIVER API] Uploading photo for temp ID: {temp_caregiver_id}")

                photo_s3_key = s3_service.upload_caregiver_photo(
                    facility_id=facility_id,
                    caregiver_id=temp_caregiver_id,
                    file_bytes=file_bytes,
                    content_type=photo.content_type or "image/jpeg"
                )

                # Carry the generated ID into the DB creation step so S3
                # path and DynamoDB key stay in sync
                data["_override_caregiver_id"] = temp_caregiver_id

        # ------------------------------------------------------------------
        # Persist the caregiver record in DynamoDB
        # ------------------------------------------------------------------
        created = db_service.create_caregiver(
            facility_id=facility_id,
            caregiver_data=data,
            photo_s3_key=photo_s3_key
        )

        logger.info(f"[CAREGIVER API] Caregiver created successfully in facility {facility_id}")

        return {
            "message": "Caregiver created successfully",
            "caregiver": created
        }

    except json.JSONDecodeError:
        # Bad JSON in the form field — return a clear 400 instead of a 500
        logger.warning("[CAREGIVER API] Invalid JSON received in caregiver_data field")
        raise HTTPException(status_code=400, detail="Invalid JSON in caregiver_data")

    except Exception as e:
        logger.error(f"[CAREGIVER API] Unexpected error creating caregiver: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/
# ===========================================================================

@router.get("/")
async def get_all_caregivers() -> Dict:
    """Return a list of all caregivers registered for the facility."""
    try:
        caregivers = db_service.get_all_caregivers(settings.FACILITY_ID)

        logger.info(f"[CAREGIVER API] Fetched {len(caregivers)} caregivers for facility {settings.FACILITY_ID}")

        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(caregivers),
            "caregivers": caregivers
        }

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching all caregivers: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# PUT /caregivers/{caregiver_id}
# ===========================================================================

@router.put("/{caregiver_id}")
async def update_caregiver(
    caregiver_id: str,
    caregiver_data: Dict
) -> Dict:
    """
    Update an existing caregiver's information.

    Raises 404 if the caregiver does not exist.
    """
    try:
        logger.info(f"[CAREGIVER API] Update request for caregiver: {caregiver_id}")

        updated = db_service.update_caregiver(
            facility_id=settings.FACILITY_ID,
            caregiver_id=caregiver_id,
            caregiver_data=caregiver_data
        )

        logger.info(f"[CAREGIVER API] Caregiver updated successfully: {caregiver_id}")

        return {
            "message": "Caregiver updated successfully",
            "caregiver": updated
        }

    except ValueError as e:
        # db_service raises ValueError when the record is not found
        logger.warning(f"[CAREGIVER API] Caregiver not found for update: {caregiver_id}")
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error updating caregiver {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/{caregiver_id}
# ===========================================================================

@router.get("/{caregiver_id}")
async def get_caregiver(caregiver_id: str) -> Dict:
    """Return detailed profile information for a single caregiver."""
    try:
        logger.info(f"[CAREGIVER API] Details request for: {caregiver_id}")

        caregiver = db_service.get_caregiver_info(caregiver_id, settings.FACILITY_ID)

        if not caregiver:
            logger.warning(f"[CAREGIVER API] Caregiver not found: {caregiver_id}")
            raise HTTPException(status_code=404, detail=f"Caregiver {caregiver_id} not found")

        logger.info(f"[CAREGIVER API] Caregiver found: {caregiver_id}")
        return caregiver

    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI handles them correctly
        raise

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching caregiver {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/{caregiver_id}/certifications
# ===========================================================================

@router.get("/{caregiver_id}/certifications")
async def get_caregiver_certifications(caregiver_id: str) -> Dict:
    """Return all certifications on record for the specified caregiver."""
    try:
        logger.info(f"[CAREGIVER API] Certifications request for: {caregiver_id}")

        certifications = db_service.get_caregiver_certifications(caregiver_id)

        logger.info(f"[CAREGIVER API] Found {len(certifications)} certifications for {caregiver_id}")

        return {
            "caregiver_id": caregiver_id,
            "certifications": certifications,
            "count": len(certifications)
        }

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching certifications for {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/{caregiver_id}/assignments
# ===========================================================================

@router.get("/{caregiver_id}/assignments")
async def get_caregiver_assignments(caregiver_id: str, days: int = 7) -> Dict:
    """
    Return resident assignments for the caregiver over a rolling window.

    Query params:
      - days: number of past days to include (default 7)
    """
    try:
        logger.info(f"[CAREGIVER API] Assignments request for {caregiver_id} — last {days} days")

        assignments = db_service.get_caregiver_assignments(caregiver_id, days)

        logger.info(f"[CAREGIVER API] Found {len(assignments)} assignments for {caregiver_id}")

        return {
            "caregiver_id": caregiver_id,
            "assignments": assignments,
            "days": days,
            "count": len(assignments)
        }

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching assignments for {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/{caregiver_id}/schedule
# ===========================================================================

@router.get("/{caregiver_id}/schedule")
async def get_caregiver_schedule(caregiver_id: str, days: int = 7) -> Dict:
    """
    Return the shift schedule for the caregiver.

    Query params:
      - days: number of days to look ahead/behind (default 7)
    """
    try:
        logger.info(f"[CAREGIVER API] Schedule request for {caregiver_id} — {days} days")

        schedule = db_service.get_caregiver_schedule(caregiver_id, days)

        logger.info(f"[CAREGIVER API] Schedule fetched successfully for {caregiver_id}")

        return {
            "caregiver_id": caregiver_id,
            "schedule": schedule,
            "days": days
        }

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching schedule for {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /caregivers/{caregiver_id}/performance
# ===========================================================================

@router.get("/{caregiver_id}/performance")
async def get_caregiver_performance(caregiver_id: str) -> Dict:
    """
    Return performance metrics for the caregiver.

    Returns a structured empty response (not a 404) when no data is
    available yet, so the frontend can render a consistent empty state.
    """
    try:
        logger.info(f"[CAREGIVER API] Performance request for: {caregiver_id}")

        performance = db_service.get_caregiver_performance(caregiver_id)

        if not performance:
            # No data yet — return an explicit empty-state payload so the
            # frontend does not need to handle a 404 for this endpoint
            logger.warning(f"[CAREGIVER API] No performance data found for {caregiver_id}")
            return {
                "caregiver_id": caregiver_id,
                "message": "No performance data available yet",
                "falls_responded": None,
                "avg_response_time_sec": None,
                "alerts_acknowledged": None,
                "alerts_missed": None,
                "residents_served": None,
                "shifts_worked": None,
                "dashboard_logins": None
            }

        logger.info(f"[CAREGIVER API] Performance data found for {caregiver_id}")
        return performance

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching performance for {caregiver_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))