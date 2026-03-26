"""
Common/Residents API Routes
"""
import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Dict, Optional
from ..services.dynamodb_service import db_service
from ..services.s3_service import s3_service
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


@router.post("/")
async def create_resident(
    resident_data: str = Form(...),
    photo: Optional[UploadFile] = File(None)
) -> Dict:
    """Create a new resident with optional photo upload"""
    try:
        # Parse the JSON form data
        data = json.loads(resident_data)
        
        facility_id = settings.FACILITY_ID
        photo_s3_key = None
        
        # Handle photo upload if provided
        if photo and photo.filename:
            file_bytes = await photo.read()
            if len(file_bytes) > 0:
                from datetime import datetime, timezone
                import uuid
                now = datetime.now(timezone.utc)
                date_part = now.strftime("%Y%m%d")
                short_uuid = uuid.uuid4().hex[:4]
                temp_resident_id = f"RES#res-{date_part}-{short_uuid}"
                
                photo_s3_key = s3_service.upload_resident_photo(
                    facility_id=facility_id,
                    resident_id=temp_resident_id,
                    file_bytes=file_bytes,
                    content_type=photo.content_type or "image/jpeg"
                )
                
                # Override the resident_id in data to match the one used for S3
                data["_override_resident_id"] = temp_resident_id
        
        # Create the resident in DynamoDB
        created = db_service.create_resident(
            facility_id=facility_id,
            resident_data=data,
            photo_s3_key=photo_s3_key
        )
        
        # Create emergency contacts if any were provided
        contacts = data.get("emergency_contacts", [])
        if contacts:
            resident_id = created.get("resident_id")
            db_service.create_emergency_contacts(resident_id, contacts)
        
        return {
            "message": "Resident created successfully",
            "resident": created
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in resident_data")
    except Exception as e:

        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{resident_id}")
async def update_resident(
    resident_id: str,
    resident_data: Dict
) -> Dict:
    """Update an existing resident's information"""
    try:
        facility_id = settings.FACILITY_ID
        
        # Update the resident in DynamoDB
        updated = db_service.update_resident(
            facility_id=facility_id,
            resident_id=resident_id,
            resident_data=resident_data
        )
        
        return {
            "message": "Resident updated successfully",
            "resident": updated
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:

        import traceback
        traceback.print_exc()
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


@router.get("/{resident_id}/emergency-contacts")
async def get_emergency_contacts(resident_id: str) -> Dict:
    """Get emergency contacts for a resident"""
    try:
        contacts = db_service.get_emergency_contacts(resident_id)
        return {"resident_id": resident_id, "contacts": contacts, "count": len(contacts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{resident_id}/caregivers")
async def get_resident_caregivers(resident_id: str, days: int = 7) -> Dict:
    """Get caregivers assigned to a resident"""
    try:
        caregivers = db_service.get_resident_caregivers(resident_id, days)
        return {
            "resident_id": resident_id,
            "caregivers": caregivers,
            "count": len(caregivers),
            "days": days
        }
    except Exception as e:

        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{resident_id}")
async def delete_resident(resident_id: str) -> Dict:
    """Delete a resident, their emergency contacts, and their S3 photo"""
    try:
        facility_id = settings.FACILITY_ID

        # Delete from DynamoDB — returns the photo_s3_key so we can clean up S3
        photo_s3_key = db_service.delete_resident(facility_id, resident_id)

        # Delete photo from S3 if one existed
        if photo_s3_key:
            try:
                s3_service.delete_photo(photo_s3_key)
            except Exception as s3_err:
                pass

        return {
            "message": "Resident deleted successfully",
            "resident_id": resident_id,
            "photo_deleted": bool(photo_s3_key)
        }
    except Exception as e:

        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
