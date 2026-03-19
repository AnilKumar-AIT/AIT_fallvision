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
        
        # Transform to React format
        gait_data = transformer.transform_gait_data(
            resident_info,
            gait_snapshot,
            daily_steps,
            stride_hourly
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
