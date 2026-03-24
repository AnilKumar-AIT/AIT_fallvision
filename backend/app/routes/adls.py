"""
ADLs (Activities of Daily Living) API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime
from ..services.dynamodb_service import db_service

router = APIRouter(prefix="/adls", tags=["ADLs"])

@router.get("/{resident_id}")
async def get_adls_data(resident_id: str) -> Dict:
    """
    Get ADLs data for a resident (Sit, Walk, Stand activities)
    
    Example: GET /api/v1/adls/RES#res-20251112-0001
    """
    try:
        # Fetch resident info to get name
        resident_info = db_service.get_resident_info(resident_id)
        if not resident_info:
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")
        
        # Extract resident name from status_name_sort
        resident_name = "Unknown Resident"
        if resident_info.get("status_name_sort"):
            parts = resident_info["status_name_sort"].split("#")
            if len(parts) >= 3:
                first_name = parts[2]
                last_name = parts[1]
                resident_name = f"{first_name} {last_name}"
        
        # TODO: Replace with actual DynamoDB queries once ADL tables are created
        # For now, returning mock activity data
        # Expected tables: adl_sit_duration, adl_walk_duration, adl_stand_duration
        adls_data = {
            "residentId": resident_id,
            "residentName": resident_name,
            "sit": {
                "longestDuration": {
                    "hours": 1,
                    "minutes": 38
                },
                "chartData": [
                    {"time": "12Am", "duration": 15},
                    {"time": "3Am", "duration": 10},
                    {"time": "6Am", "duration": 5},
                    {"time": "9Am", "duration": 12},
                    {"time": "12Pm", "duration": 45},
                    {"time": "3Pm", "duration": 25},
                    {"time": "6Pm", "duration": 20},
                    {"time": "9Pm", "duration": 23},
                    {"time": "12Am", "duration": 8}
                ]
            },
            "walk": {
                "longestDuration": {
                    "hours": 4,
                    "minutes": 40
                },
                "chartData": [
                    {"time": "12Am", "duration": 10},
                    {"time": "3Am", "duration": 18},
                    {"time": "6Am", "duration": 15},
                    {"time": "9Am", "duration": 14},
                    {"time": "12Pm", "duration": 23},
                    {"time": "3Pm", "duration": 50},
                    {"time": "6Pm", "duration": 28},
                    {"time": "9Pm", "duration": 32},
                    {"time": "12Am", "duration": 6}
                ]
            },
            "stand": {
                "longestDuration": {
                    "hours": 2,
                    "minutes": 30
                },
                "chartData": [
                    {"time": "12Am", "duration": 8},
                    {"time": "3Am", "duration": 5},
                    {"time": "6Am", "duration": 12},
                    {"time": "9Am", "duration": 18},
                    {"time": "12Pm", "duration": 20},
                    {"time": "3Pm", "duration": 30},
                    {"time": "6Pm", "duration": 15},
                    {"time": "9Pm", "duration": 22},
                    {"time": "12Am", "duration": 6}
                ]
            }
        }
        
        return adls_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
