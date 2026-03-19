"""
Common/Residents API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict
from ..services.dynamodb_service import db_service
from ..config import settings

router = APIRouter(prefix="/residents", tags=["Residents"])

@router.get("/")
async def get_all_residents() -> Dict:
    """Get list of all residents in the facility"""
    try:
        residents = db_service.get_all_residents(settings.FACILITY_ID)
        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(residents),
            "residents": residents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}")
async def get_resident(resident_id: str) -> Dict:
    """Get detailed info for a specific resident"""
    try:
        resident = db_service.get_resident_info(resident_id)
        if not resident:
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")
        return resident
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/alerts")
async def get_resident_alerts(resident_id: str, limit: int = 10) -> Dict:
    """Get recent alerts for a resident"""
    try:
        alerts = db_service.get_recent_alerts(resident_id, limit)
        return {"resident_id": resident_id, "alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/suggestions")
async def get_resident_suggestions(resident_id: str, limit: int = 10) -> Dict:
    """Get AI-generated suggestions for a resident"""
    try:
        suggestions = db_service.get_resident_suggestions(resident_id, limit)
        return {"resident_id": resident_id, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/health-score")
async def get_health_score(resident_id: str) -> Dict:
    """Get health score for a resident"""
    try:
        score = db_service.get_health_score(resident_id)
        if not score:
            raise HTTPException(status_code=404, detail=f"No health score found for {resident_id}")
        return score
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
