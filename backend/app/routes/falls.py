"""
Falls API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
from ..services.dynamodb_service import db_service
from ..config import settings

router = APIRouter(prefix="/falls", tags=["Falls"])

@router.get("/")
async def get_all_falls(days: int = 30, priority: str = None) -> Dict:
    """Get all fall events, optionally filtered by priority"""
    try:
        falls = db_service.get_fall_events(settings.FACILITY_ID, days, priority)
        
        # Debug: Check if photo_s3_key is in the response
        print(f"[FALLS ROUTE] Returning {len(falls)} falls")
        for i, fall in enumerate(falls[:2]):  # Check first 2 falls
            print(f"[FALLS ROUTE] Fall {i}: photo_s3_key = {fall.get('photo_s3_key', 'NOT_IN_DICT')}")
        
        return {
            "facility_id": settings.FACILITY_ID,
            "count": len(falls),
            "falls": falls,
            "days": days,
            "priority_filter": priority
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_fall_analytics(days: int = 1) -> Dict:
    """Get fall analytics by time of day"""
    try:
        analytics = db_service.get_fall_analytics(settings.FACILITY_ID, days)
        return {
            "facility_id": settings.FACILITY_ID,
            "analytics": analytics,
            "days": days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/video/{fall_id}")
async def get_fall_video(fall_id: str) -> Dict:
    """Get video URL for a specific fall event"""
    try:
        # Query fall_video_clips table
        video_clip = db_service.get_fall_video_clip(fall_id)
        
        if not video_clip:
            raise HTTPException(status_code=404, detail="Video clip not found")
        
        # Generate pre-signed S3 URL (valid for 1 hour)
        import boto3
        s3_client = boto3.client('s3', region_name='us-east-1')
        
        s3_bucket = video_clip.get('s3_bucket', 'aitcare-fall-clips-encrypted-dev')
        s3_key = video_clip.get('s3_key', '')
        
        # Generate pre-signed URL
        video_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_bucket,
                'Key': s3_key,
                'ResponseContentType': 'video/mp4'
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return {
            "fall_id": fall_id,
            "video_url": video_url,
            "duration_sec": video_clip.get('duration_sec', 20),
            "resolution": video_clip.get('resolution', '854x480'),
            "file_size_bytes": video_clip.get('file_size_bytes', 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
