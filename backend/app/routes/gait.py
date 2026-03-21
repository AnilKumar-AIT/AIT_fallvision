"""
Gait Analysis API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key
from ..services.dynamodb_service import db_service
from ..services.data_transformer import transformer

router = APIRouter(prefix="/gait", tags=["Gait Analysis"])

@router.get("/{resident_id}")
async def get_gait_data(resident_id: str) -> Dict:
    """
    Get complete gait analysis data for a resident (matches React gaitData.json format)
    
    Example: GET /api/v1/gait/RES#res-20251112-0001
    """
    try:
        # Fetch all required data
        resident_info = db_service.get_resident_info(resident_id)
        if not resident_info:
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")
        
        gait_snapshot = db_service.get_latest_gait_snapshot(resident_id)
        if not gait_snapshot:
            raise HTTPException(status_code=404, detail=f"No gait data found for {resident_id}")
        
        daily_steps = db_service.get_gait_daily_steps(resident_id, days=30)
        
        # Get stride hourly data - try today first, then any available date
        today = datetime.now().strftime("%Y-%m-%d")
        stride_hourly = db_service.get_stride_length_hourly(resident_id, today)
        
        # If no data for today, get all stride data without date filter
        if not stride_hourly:
            table = db_service.dynamodb.Table('stride_length_hourly')
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                Limit=10
            )
            stride_hourly = db_service.decimal_to_float(response.get('Items', []))
        
        # Fetch alerts, suggestions, and health score
        alerts = db_service.get_recent_alerts(resident_id, limit=10)
        suggestions = db_service.get_resident_suggestions(resident_id, limit=10)
        health_score = db_service.get_health_score(resident_id)
        
        # Transform to React format
        gait_data = transformer.transform_gait_data(
            resident_info,
            gait_snapshot,
            daily_steps,
            stride_hourly,
            alerts,
            suggestions,
            health_score
        )
        
        return gait_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/{resident_id}/metrics")
async def get_gait_metrics(resident_id: str) -> Dict:
    """Get current gait metrics only (simplified endpoint)"""
    try:
        snapshot = db_service.get_latest_gait_snapshot(resident_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail=f"No data found for {resident_id}")
        return snapshot
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/alerts")
async def get_gait_alerts(resident_id: str, limit: int = 10) -> Dict:
    """Get recent gait-related alerts"""
    try:
        alerts = db_service.get_recent_alerts(resident_id, limit=limit)
        # Filter for gait domain only
        gait_alerts = [a for a in alerts if a.get('domain') == 'GAIT']
        return {
            "resident_id": resident_id,
            "count": len(gait_alerts),
            "alerts": gait_alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/suggestions")
async def get_gait_suggestions(resident_id: str, limit: int = 10) -> Dict:
    """Get AI-generated gait suggestions"""
    try:
        suggestions = db_service.get_resident_suggestions(resident_id, limit=limit)
        # Filter for gait/activity domain (more lenient)
        gait_suggestions = [s for s in suggestions 
                           if s.get('target_domain') in ['GAIT', 'ACTIVITY', 'FALL', 'CROSS_DOMAIN']]
        
        # If no domain-specific suggestions, return all
        if not gait_suggestions:
            gait_suggestions = suggestions
        
        return {
            "resident_id": resident_id,
            "count": len(gait_suggestions),
            "suggestions": gait_suggestions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/health-score")
async def get_gait_health_score(resident_id: str) -> Dict:
    """Get health score with fall risk details"""
    try:
        health_score = db_service.get_health_score(resident_id)
        if not health_score:
            raise HTTPException(status_code=404, detail=f"No health score found for {resident_id}")
        return health_score
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/debug")
async def debug_gait_data(resident_id: str) -> Dict:
    """Debug endpoint to see raw data from all tables"""
    try:
        return {
            "resident_info": db_service.get_resident_info(resident_id),
            "gait_snapshot": db_service.get_latest_gait_snapshot(resident_id),
            "daily_steps_count": len(db_service.get_gait_daily_steps(resident_id, days=30)),
            "stride_hourly_count": len(db_service.get_stride_length_hourly(resident_id, datetime.now().strftime("%Y-%m-%d"))),
            "alerts": db_service.get_recent_alerts(resident_id, limit=10),
            "suggestions": db_service.get_resident_suggestions(resident_id, limit=10),
            "health_score": db_service.get_health_score(resident_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
