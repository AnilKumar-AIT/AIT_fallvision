"""
Caregivers API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict
from ..services.dynamodb_service import db_service
from ..config import settings

router = APIRouter(prefix="/caregivers", tags=["Caregivers"])

@router.get("/")
async def get_all_caregivers() -> Dict:
    """Get list of all caregivers in the facility"""
    try:
        caregivers = db_service.get_all_caregivers(settings.FACILITY_ID)
        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(caregivers),
            "caregivers": caregivers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{caregiver_id}")
async def get_caregiver(caregiver_id: str) -> Dict:
    """Get detailed info for a specific caregiver"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[CAREGIVER API] Details request for: {caregiver_id}")
        caregiver = db_service.get_caregiver_info(caregiver_id, settings.FACILITY_ID)
        
        if not caregiver:
            logger.warning(f"[CAREGIVER API] Caregiver not found: {caregiver_id}")
            raise HTTPException(status_code=404, detail=f"Caregiver {caregiver_id} not found")
        
        logger.info(f"[CAREGIVER API] Caregiver found: {caregiver_id}")
        return caregiver
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CAREGIVER API] Error fetching caregiver {caregiver_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{caregiver_id}/certifications")
async def get_caregiver_certifications(caregiver_id: str) -> Dict:
    """Get certifications for a caregiver"""
    try:
        certifications = db_service.get_caregiver_certifications(caregiver_id)
        return {
            "caregiver_id": caregiver_id,
            "certifications": certifications,
            "count": len(certifications)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{caregiver_id}/assignments")
async def get_caregiver_assignments(caregiver_id: str, days: int = 7) -> Dict:
    """Get resident assignments for a caregiver"""
    try:
        assignments = db_service.get_caregiver_assignments(caregiver_id, days)
        return {
            "caregiver_id": caregiver_id,
            "assignments": assignments,
            "days": days,
            "count": len(assignments)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{caregiver_id}/schedule")
async def get_caregiver_schedule(caregiver_id: str, days: int = 7) -> Dict:
    """Get shift schedule for a caregiver"""
    try:
        schedule = db_service.get_caregiver_schedule(caregiver_id, days)
        return {
            "caregiver_id": caregiver_id,
            "schedule": schedule,
            "days": days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{caregiver_id}/performance")
async def get_caregiver_performance(caregiver_id: str) -> Dict:
    """Get performance metrics for a caregiver"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[CAREGIVER API] Performance request for: {caregiver_id}")
        performance = db_service.get_caregiver_performance(caregiver_id)
        
        if not performance:
            logger.warning(f"[CAREGIVER API] No performance data found for {caregiver_id}")
            # Return empty performance object instead of 404
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
        logger.error(f"[CAREGIVER API] Error fetching performance for {caregiver_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
