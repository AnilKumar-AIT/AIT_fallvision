"""
ADLs (Activities of Daily Living) API Routes - REAL DATA FROM DYNAMODB
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
from datetime import datetime, timedelta
from ..services.dynamodb_service import db_service
import boto3
from boto3.dynamodb.conditions import Key

router = APIRouter(prefix="/adls", tags=["ADLs"])

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
adl_hourly_table = dynamodb.Table('adl_hourly_summary')
adl_daily_table = dynamodb.Table('adl_daily_summary')


def format_hour_label(hour: int) -> str:
    """Convert 24-hour format to 12Am/12Pm format"""
    if hour == 0:
        return "12Am"
    elif hour < 12:
        return f"{hour}Am"
    elif hour == 12:
        return "12Pm"
    else:
        return f"{hour - 12}Pm"


@router.get("/{resident_id}")
async def get_adls_data(resident_id: str) -> Dict:
    """
    Get ADLs data for a resident (Sit, Walk, Stand activities)
    Fetches REAL data from adl_hourly_summary and adl_daily_summary tables
    
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
        
        # Get today's date
        today = datetime.now().strftime("%Y-%m-%d")
        
        # ========================================
        # FETCH HOURLY DATA FROM adl_hourly_summary
        # ========================================
        try:
            response = adl_hourly_table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id) & 
                                     Key('date_hour').begins_with(today)
            )
            hourly_records = response.get('Items', [])
        except Exception as e:
            print(f"Error querying adl_hourly_summary: {e}")
            hourly_records = []
        
        # ========================================
        # FETCH DAILY SUMMARY FROM adl_daily_summary
        # ========================================
        try:
            response = adl_daily_table.get_item(
                Key={
                    'resident_id': resident_id,
                    'summary_date': 'LATEST'
                }
            )
            daily_summary = response.get('Item', {})
        except Exception as e:
            print(f"Error querying adl_daily_summary: {e}")
            daily_summary = {}
        
        # ========================================
        # PROCESS DATA FOR FRONTEND
        # ========================================
        
                # Create hourly chart data (24 hours)
        hourly_data_by_hour = {}
        for record in hourly_records:
            try:
                date_hour = record.get('date_hour', '')
                hour = int(date_hour.split('#')[1]) if '#' in date_hour else 0
                hourly_data_by_hour[hour] = {
                    'sit': int(record.get('sit_minutes', 0)),
                    'stand': int(record.get('stand_minutes', 0)),
                    'walk': int(record.get('walk_minutes', 0))
                }
            except (ValueError, IndexError) as e:
                print(f"Error parsing hourly record: {e}")
                continue
        
        print(f"\nADL Hourly Data for {resident_id}:")
        print(f"  Total hourly records found: {len(hourly_records)}")
        if hourly_data_by_hour:
            print(f"  Hours with data: {sorted(hourly_data_by_hour.keys())}")
            # Show sample data
            sample_hours = [0, 6, 12, 18]
            for h in sample_hours:
                if h in hourly_data_by_hour:
                    data = hourly_data_by_hour[h]
                    print(f"  {format_hour_label(h)}: Sit={data['sit']}min, Walk={data['walk']}min, Stand={data['stand']}min")
        
                # Generate ALL 24 hours of chart data
                chart_hours = list(range(24))  # 0, 1, 2, 3, ... 23 (all 24 hours)
        
                sit_chart_data = []
                walk_chart_data = []
                stand_chart_data = []
        
                for hour in chart_hours:
                    time_label = format_hour_label(hour)
                    hourly = hourly_data_by_hour.get(hour, {'sit': 0, 'stand': 0, 'walk': 0})
            
                    sit_chart_data.append({"time": time_label, "duration": hourly['sit']})
                    walk_chart_data.append({"time": time_label, "duration": hourly['walk']})
                    stand_chart_data.append({"time": time_label, "duration": hourly['stand']})
        
        # ========================================
        # CALCULATE TOTAL DAILY DURATIONS
        # ========================================
        # Show total minutes for each activity today
        # ========================================
        
        # Get total minutes from daily summary
        total_sit_minutes = int(daily_summary.get('total_sitting_minutes', 0))
        total_walk_minutes = int(daily_summary.get('total_walking_minutes', 0))
        total_stand_minutes = int(daily_summary.get('total_standing_minutes', 0))
        
        # If no daily summary, calculate from hourly data
        if total_sit_minutes == 0 and hourly_records:
            total_sit_minutes = sum(int(r.get('sit_minutes', 0)) for r in hourly_records)
        if total_walk_minutes == 0 and hourly_records:
            total_walk_minutes = sum(int(r.get('walk_minutes', 0)) for r in hourly_records)
        if total_stand_minutes == 0 and hourly_records:
            total_stand_minutes = sum(int(r.get('stand_minutes', 0)) for r in hourly_records)
        
        print(f"ADL Total Durations for {resident_id} (Today):")
        print(f"  Sitting:  {total_sit_minutes} mins")
        print(f"  Standing: {total_stand_minutes} mins")
        print(f"  Walking:  {total_walk_minutes} mins")
        
        # Convert to hours and minutes
        def minutes_to_hours_mins(total_minutes):
            hours = total_minutes // 60
            minutes = total_minutes % 60
            return {"hours": hours, "minutes": minutes}
        
                # ========================================
        # BUILD RESPONSE
        # ========================================
        adls_data = {
            "residentId": resident_id,
            "residentName": resident_name,
            "sit": {
                "totalDuration": minutes_to_hours_mins(total_sit_minutes),
                "chartData": sit_chart_data
            },
            "walk": {
                "totalDuration": minutes_to_hours_mins(total_walk_minutes),
                "chartData": walk_chart_data
            },
            "stand": {
                "totalDuration": minutes_to_hours_mins(total_stand_minutes),
                "chartData": stand_chart_data
            }
        }
        
        return adls_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_adls_data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
