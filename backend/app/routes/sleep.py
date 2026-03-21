"""
Sleep Diary API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
from ..services.dynamodb_service import db_service
from ..services.data_transformer import transformer

router = APIRouter(prefix="/sleep", tags=["Sleep Diary"])

@router.get("/{resident_id}")
async def get_sleep_diary_data(resident_id: str) -> Dict:
    """
    Get complete sleep diary data for a resident (matches React sleepData.json format)
    
    Example: GET /api/v1/sleep/RES#res-20251112-0001
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[SLEEP API] Request for resident: {resident_id}")
        
        # Fetch all required data
        resident_info = db_service.get_resident_info(resident_id)
        if not resident_info:
            logger.warning(f"[SLEEP API] Resident NOT FOUND: {resident_id}")
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")
        
        logger.info(f"[SLEEP API] Resident found: {resident_id}, fetching sleep summaries...")
        sleep_summaries = db_service.get_sleep_nightly_summary(resident_id, days=10)
        if not sleep_summaries:
            logger.warning(f"[SLEEP API] No sleep data found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No sleep data found for {resident_id}")
        
        logger.info(f"[SLEEP API] Found {len(sleep_summaries)} sleep summaries for {resident_id}")
        latest_date = sleep_summaries[0]['sleep_date']
        sleep_movement = db_service.get_sleep_movement_hourly(resident_id, latest_date)
        wake_episodes = db_service.get_sleep_wake_episodes(resident_id, latest_date)
        
        # Transform to React format
        sleep_data = transformer.transform_sleep_diary_data(
            resident_info,
            sleep_summaries,
            sleep_movement,
            wake_episodes
        )
        
        logger.info(f"[SLEEP API] Successfully returning data for {resident_id}")
        return sleep_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[SLEEP API] Internal error for {resident_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/{resident_id}/summary")
async def get_sleep_summary(resident_id: str, days: int = 7) -> Dict:
    """Get sleep summary for last N days (simplified endpoint)"""
    try:
        summaries = db_service.get_sleep_nightly_summary(resident_id, days)
        if not summaries:
            raise HTTPException(status_code=404, detail=f"No data found for {resident_id}")
        return {"data": summaries}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
