"""Falls API Routes

Provides endpoints for retrieving fall events, analytics, and video clips.
Includes input validation, rate limiting considerations, and proper error handling.
"""
import logging
import traceback
import re
from typing import Dict, Optional

import boto3
from fastapi import APIRouter, HTTPException, Query

from ..services.dynamodb_service import db_service
from ..config import settings

# ---------------------------------------------------------------------------
# Module-level logger and shared AWS client
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

# S3 client initialized once at module load — avoids recreating it on every
# request to the video endpoint, which would add unnecessary overhead
s3_client = boto3.client('s3', region_name=settings.AWS_REGION)

router = APIRouter(prefix="/falls", tags=["Falls"])

# ---------------------------------------------------------------------------
# Constants from configuration
# ---------------------------------------------------------------------------
FALL_CLIPS_BUCKET = settings.S3_FALL_CLIPS_BUCKET
PRESIGNED_URL_EXPIRY_SEC = settings.PRESIGNED_URL_EXPIRY_SEC

# ---------------------------------------------------------------------------
# Validation patterns
# ---------------------------------------------------------------------------
FALL_ID_PATTERN = re.compile(r'^FALL#[a-zA-Z0-9-]+$')


# ===========================================================================
# GET /falls/
# ===========================================================================

@router.get("/")
async def get_all_falls(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to look back"),
    priority: Optional[str] = Query(default=None, pattern="^(high|medium|low)$", description="Filter by priority level")
) -> Dict:
    """
    Return all fall events for the facility, optionally filtered by priority.

    Query params:
      - days: rolling window of days to include (1-365, default 30)
      - priority: optional priority filter ('high', 'medium', 'low')
      
    Returns:
      Dictionary containing facility_id, count, falls array, days, and priority_filter
    """
    try:
        falls = db_service.get_fall_events(settings.FACILITY_ID, days, priority)

        logger.info(f"[FALLS API] Returning {len(falls)} falls for facility {settings.FACILITY_ID} "
                    f"(days={days}, priority={priority})")

        # Log a sample of the first two records to aid debugging without
        # flooding logs with the full payload
        for i, fall in enumerate(falls[:2]):
            logger.debug(f"[FALLS API] Fall {i}: photo_s3_key={fall.get('photo_s3_key', 'NOT_IN_DICT')}")

        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(falls),
            "falls": falls,
            "days": days,
            "priority_filter": priority
        }

    except Exception as e:
        logger.error(f"[FALLS API] Error fetching fall events: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /falls/analytics
# ===========================================================================

@router.get("/analytics")
async def get_fall_analytics(
    days: int = Query(default=1, ge=1, le=30, description="Number of days to analyze")
) -> Dict:
    """
    Return fall analytics broken down by time of day.

    Query params:
      - days: number of past days to analyse (1-30, default 1)
      
    Returns:
      Dictionary containing facility_id, analytics array, and days
    """
    try:
        logger.info(f"[FALLS API] Analytics request for facility {settings.FACILITY_ID} — last {days} days")

        analytics = db_service.get_fall_analytics(settings.FACILITY_ID, days)

        logger.info(f"[FALLS API] Analytics fetched successfully")

        return {
            "facility_id": settings.FACILITY_ID,
            "analytics": analytics,
            "days": days
        }

    except Exception as e:
        logger.error(f"[FALLS API] Error fetching fall analytics: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /falls/video/{fall_id}
# ===========================================================================

@router.get("/video/{fall_id}")
async def get_fall_video(fall_id: str) -> Dict:
    """
    Return a pre-signed S3 URL for the video clip of a specific fall event.

    The URL is valid for the configured expiry time (default 1 hour). 
    Raises 404 if no clip exists for the given fall ID.
    
    Args:
      fall_id: Fall event identifier (format: FALL#xxx)
      
    Returns:
      Dictionary containing fall_id, video_url, duration_sec, resolution, and file_size_bytes
      
    Raises:
      HTTPException 400: Invalid fall_id format
      HTTPException 404: Video clip not found
      HTTPException 500: Server error generating URL
    """
    try:
        # ------------------------------------------------------------------
        # Validate fall_id format
        # ------------------------------------------------------------------
        if not fall_id or not FALL_ID_PATTERN.match(fall_id):
            logger.warning(f"[FALLS API] Invalid fall_id format: {fall_id}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid fall_id format. Expected format: FALL#xxx"
            )
        
        logger.info(f"[FALLS API] Video request for fall: {fall_id}")

        # ------------------------------------------------------------------
        # Look up the video clip metadata from DynamoDB
        # ------------------------------------------------------------------
        video_clip = db_service.get_fall_video_clip(fall_id)

        if not video_clip:
            logger.warning(f"[FALLS API] No video clip found for fall: {fall_id}")
            raise HTTPException(status_code=404, detail="Video clip not found")

        # ------------------------------------------------------------------
        # Generate a pre-signed S3 URL so the client can stream the clip
        # directly without exposing permanent credentials
        # ------------------------------------------------------------------
        s3_bucket = video_clip.get('s3_bucket', FALL_CLIPS_BUCKET)
        s3_key = video_clip.get('s3_key', '')

        logger.info(f"[FALLS API] Generating pre-signed URL — bucket={s3_bucket}, key={s3_key}")

        video_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket,
                'Key': s3_key,
                'ResponseContentType': 'video/mp4'
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY_SEC
        )

        logger.info(f"[FALLS API] Pre-signed URL generated successfully for fall: {fall_id}")

        return {
            "fall_id": fall_id,
            "video_url": video_url,
            "duration_sec": video_clip.get('duration_sec', 20),
            "resolution": video_clip.get('resolution', '854x480'),
            "file_size_bytes": video_clip.get('file_size_bytes', 0)
        }

    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI handles them correctly
        raise

    except Exception as e:
        logger.error(f"[FALLS API] Error generating video URL for fall {fall_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))