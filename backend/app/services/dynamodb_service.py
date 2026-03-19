"""
DynamoDB Service Layer
Handles all database operations
"""
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from ..config import settings

class DynamoDBService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.client = boto3.client('dynamodb', region_name=settings.AWS_REGION)
    
    def decimal_to_float(self, obj):
        """Convert Decimal to float for JSON serialization"""
        if isinstance(obj, list):
            return [self.decimal_to_float(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: self.decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, Decimal):
            return float(obj)
        else:
            return obj
    
    # ==================== SLEEP DIARY ENDPOINTS ====================
    
    def get_sleep_nightly_summary(self, resident_id: str, days: int = 10) -> List[Dict]:
        """Get last N days of sleep summary for a resident"""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_SUMMARY)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                ScanIndexForward=False,  # Descending order
                Limit=days
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching sleep summary: {e}")
            return []
    
    def get_sleep_movement_hourly(self, resident_id: str, sleep_date: str) -> List[Dict]:
        """Get hourly body movement for a specific sleep night"""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_MOVEMENT)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id) & 
                                     Key('sleep_date_hour').begins_with(sleep_date)
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching sleep movement: {e}")
            return []
    
    def get_sleep_wake_episodes(self, resident_id: str, sleep_date: str) -> List[Dict]:
        """Get wake episodes for a specific sleep night"""
        table = self.dynamodb.Table(settings.TABLE_SLEEP_WAKE)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id) & 
                                     Key('sleep_date_episode').begins_with(sleep_date)
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching wake episodes: {e}")
            return []
    
    # ==================== GAIT ENDPOINTS ====================
    
    def get_latest_gait_snapshot(self, resident_id: str) -> Optional[Dict]:
        """Get the most recent gait metrics snapshot"""
        table = self.dynamodb.Table(settings.TABLE_GAIT_SNAPSHOT)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                ScanIndexForward=False,
                Limit=1
            )
            items = response.get('Items', [])
            return self.decimal_to_float(items[0]) if items else None
        except Exception as e:
            print(f"Error fetching gait snapshot: {e}")
            return None
    
    def get_gait_daily_steps(self, resident_id: str, days: int = 30) -> List[Dict]:
        """Get daily step counts for last N days"""
        table = self.dynamodb.Table(settings.TABLE_GAIT_DAILY)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                ScanIndexForward=False,
                Limit=days
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching daily steps: {e}")
            return []
    
    def get_stride_length_hourly(self, resident_id: str, date: str) -> List[Dict]:
        """Get hourly stride length distribution for a specific date"""
        table = self.dynamodb.Table(settings.TABLE_STRIDE_HOURLY)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id) & 
                                     Key('date_hour').begins_with(date)
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching stride hourly: {e}")
            return []
    
    # ==================== COMMON ENDPOINTS ====================
    
    def get_resident_info(self, resident_id: str) -> Optional[Dict]:
        """Get basic resident information"""
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        
        try:
            response = table.query(
                IndexName='gsi-resident-id',
                KeyConditionExpression=Key('resident_id').eq(resident_id)
            )
            items = response.get('Items', [])
            return self.decimal_to_float(items[0]) if items else None
        except Exception as e:
            print(f"Error fetching resident info: {e}")
            return None
    
    def get_recent_alerts(self, resident_id: str, limit: int = 10) -> List[Dict]:
        """Get recent alerts for a resident"""
        table = self.dynamodb.Table(settings.TABLE_UNIFIED_ALERTS)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                ScanIndexForward=False,
                Limit=limit
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching alerts: {e}")
            return []
    
    def get_resident_suggestions(self, resident_id: str, limit: int = 10) -> List[Dict]:
        """Get AI-generated suggestions for a resident"""
        table = self.dynamodb.Table(settings.TABLE_SUGGESTIONS)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                ScanIndexForward=False,
                Limit=limit
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching suggestions: {e}")
            return []
    
    def get_health_score(self, resident_id: str) -> Optional[Dict]:
        """Get latest health score for a resident"""
        table = self.dynamodb.Table(settings.TABLE_HEALTH_SCORE)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id) & 
                                     Key('score_date').eq('LATEST')
            )
            items = response.get('Items', [])
            return self.decimal_to_float(items[0]) if items else None
        except Exception as e:
            print(f"Error fetching health score: {e}")
            return None
    
    # ==================== LIST ALL RESIDENTS ====================
    
    def get_all_residents(self, facility_id: str = None) -> List[Dict]:
        """Get all active residents in a facility"""
        if facility_id is None:
            facility_id = settings.FACILITY_ID
        
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('facility_id').eq(facility_id)
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching all residents: {e}")
            return []

# Singleton instance
db_service = DynamoDBService()
