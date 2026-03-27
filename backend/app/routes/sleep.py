"""
Sleep Diary API Routes
"""
import logging
import traceback
from typing import Dict

from fastapi import APIRouter, HTTPException

from ..services.dynamodb_service import db_service
from ..services.data_transformer import transformer

# ---------------------------------------------------------------------------
# Module-level logger — created once, reused across all route handlers
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sleep", tags=["Sleep Diary"])


# ===========================================================================
# GET /sleep/{resident_id}
# ===========================================================================

@router.get("/{resident_id}")
async def get_sleep_diary_data(resident_id: str) -> Dict:
    """
    Return complete sleep diary data for a resident.

    Fetches nightly summaries, hourly movement, and wake episodes, then
    transforms them into the shape expected by the React frontend
    (matches sleepData.json format).

    Example: GET /api/v1/sleep/RES#res-20251112-0001
    """
    try:
        logger.info(f"[SLEEP API] Full sleep diary request for resident: {resident_id}")

        # ------------------------------------------------------------------
        # Validate resident exists before fetching any further data
        # ------------------------------------------------------------------
        resident_info = db_service.get_resident_info(resident_id)
        if not resident_info:
            logger.warning(f"[SLEEP API] Resident not found: {resident_id}")
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")

        # ------------------------------------------------------------------
        # Nightly summaries — required; no point continuing without them
        # ------------------------------------------------------------------
        sleep_summaries = db_service.get_sleep_nightly_summary(resident_id, days=10)
        if not sleep_summaries:
            logger.warning(f"[SLEEP API] No sleep summaries found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No sleep data found for {resident_id}")

        logger.info(f"[SLEEP API] Found {len(sleep_summaries)} sleep summaries for resident: {resident_id}")

        # ------------------------------------------------------------------
        # Hourly movement and wake episodes for the most recent night
        # ------------------------------------------------------------------
        latest_date = sleep_summaries[0]['sleep_date']
        logger.debug(f"[SLEEP API] Fetching movement and wake episodes for date: {latest_date}")

        sleep_movement = db_service.get_sleep_movement_hourly(resident_id, latest_date)
        wake_episodes = db_service.get_sleep_wake_episodes(resident_id, latest_date)

        # ------------------------------------------------------------------
        # Transform all fetched data into the React-compatible response shape
        # ------------------------------------------------------------------
        sleep_data = transformer.transform_sleep_diary_data(
            resident_info,
            sleep_summaries,
            sleep_movement,
            wake_episodes
        )

        logger.info(f"[SLEEP API] Sleep diary data assembled successfully for resident: {resident_id}")
        return sleep_data

    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI handles them correctly
        raise

    except Exception as e:
        logger.error(f"[SLEEP API] Unexpected error fetching sleep diary for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# ===========================================================================
# GET /sleep/{resident_id}/summary
# ===========================================================================

@router.get("/{resident_id}/summary")
async def get_sleep_summary(resident_id: str, days: int = 7) -> Dict:
    """
    Return nightly sleep summaries for the last N days.

    Lighter alternative to the full endpoint when the caller only needs
    the raw summary records without movement or wake episode detail.

    Query params:
      - days: number of past nights to include (default 7)
    """
    try:
        logger.info(f"[SLEEP API] Summary request for resident: {resident_id} (days={days})")

        summaries = db_service.get_sleep_nightly_summary(resident_id, days)
        if not summaries:
            logger.warning(f"[SLEEP API] No sleep summaries found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No data found for {resident_id}")

        logger.info(f"[SLEEP API] Returning {len(summaries)} summaries for resident: {resident_id}")
        return {"data": summaries}

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[SLEEP API] Error fetching sleep summary for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))