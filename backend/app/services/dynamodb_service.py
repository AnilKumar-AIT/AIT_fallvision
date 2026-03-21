"""DynamoDB Service Layer
Handles all database operations
"""
import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import Binary
from decimal import Decimal
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import base64
from ..config import settings

class DynamoDBService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        self.client = boto3.client('dynamodb', region_name=settings.AWS_REGION)
    
    def decimal_to_float(self, obj):
        """Convert Decimal to float and Binary to base64 string for JSON serialization"""
        if isinstance(obj, list):
            return [self.decimal_to_float(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: self.decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, Binary):
            # Convert binary data to base64 string (or skip encrypted fields)
            return base64.b64encode(bytes(obj)).decode('utf-8')
        elif isinstance(obj, bytes):
            # Also handle raw bytes
            return base64.b64encode(obj).decode('utf-8')
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
                Limit=days,
                ConsistentRead=True  # Use strong consistency to avoid eventual consistency issues
            )
            items = self.decimal_to_float(response.get('Items', []))
            print(f"[DEBUG] get_sleep_nightly_summary for {resident_id}: Found {len(items)} items")
            return items
        except Exception as e:
            print(f"[ERROR] Error fetching sleep summary for {resident_id}: {e}")
            import traceback
            traceback.print_exc()
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
            result = self.decimal_to_float(items[0]) if items else None
            print(f"[DEBUG] get_resident_info for {resident_id}: {'Found' if result else 'NOT FOUND'}")
            return result
        except Exception as e:
            print(f"[ERROR] Error fetching resident info for {resident_id}: {e}")
            import traceback
            traceback.print_exc()
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
            # Handle pagination to get ALL residents (DynamoDB returns max 1MB per query)
            items = []
            last_evaluated_key = None
            
            while True:
                if last_evaluated_key:
                    response = table.query(
                        KeyConditionExpression=Key('facility_id').eq(facility_id),
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = table.query(
                        KeyConditionExpression=Key('facility_id').eq(facility_id)
                    )
                
                items.extend(response.get('Items', []))
                
                # Check if there are more items to fetch
                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    break
            
            print(f"Total residents fetched from DynamoDB: {len(items)}")
            
            # Process items and clean up sensitive/binary fields
            cleaned_items = []
            for item in items:
                cleaned_item = self.decimal_to_float(item)
                
                # Remove or mask encrypted binary fields - keep them as indicators
                for key in ['first_name_enc', 'last_name_enc', 'display_name_enc', 'dob_enc']:
                    if key in cleaned_item:
                        # Keep as a flag but don't send the actual encrypted data
                        cleaned_item[key] = '[ENCRYPTED]'
                
                cleaned_items.append(cleaned_item)
            
            return cleaned_items
        except Exception as e:
            print(f"Error fetching all residents: {e}")
            return []
    
    def get_emergency_contacts(self, resident_id: str) -> List[Dict]:
        """Get emergency contacts for a resident"""
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id)
            )
            items = response.get('Items', [])
            
            # Decrypt or mask contact information
            cleaned_items = []
            for item in items:
                cleaned_item = self.decimal_to_float(item)
                
                # Mask encrypted fields but show that they exist
                for key in ['contact_name_enc', 'phone_enc', 'email_enc']:
                    if key in cleaned_item:
                        # In production, you'd decrypt these
                        # For now, we'll use placeholder text
                        base_key = key.replace('_enc', '')
                        cleaned_item[base_key] = f'[Encrypted {base_key}]'
                        del cleaned_item[key]  # Remove the encrypted version
                
                cleaned_items.append(cleaned_item)
            
            return cleaned_items
        except Exception as e:
            print(f"Error fetching emergency contacts: {e}")
            return []
    
    # ==================== CAREGIVERS ENDPOINTS ====================
    
    def get_all_caregivers(self, facility_id: str = None) -> List[Dict]:
        """Get all caregivers in a facility"""
        if facility_id is None:
            facility_id = settings.FACILITY_ID
        
        table = self.dynamodb.Table('caregivers')
        
        try:
            items = []
            last_evaluated_key = None
            
            while True:
                if last_evaluated_key:
                    response = table.query(
                        KeyConditionExpression=Key('facility_id').eq(facility_id),
                        ExclusiveStartKey=last_evaluated_key
                    )
                else:
                    response = table.query(
                        KeyConditionExpression=Key('facility_id').eq(facility_id)
                    )
                
                items.extend(response.get('Items', []))
                
                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    break
            
            print(f"Total caregivers fetched from DynamoDB: {len(items)}")
            
            cleaned_items = []
            for item in items:
                cleaned_item = self.decimal_to_float(item)
                
                # Remove or mask encrypted/sensitive fields
                for key in ['cognito_user_id']:
                    if key in cleaned_item:
                        cleaned_item[key] = '[PROTECTED]'
                
                cleaned_items.append(cleaned_item)
            
            return cleaned_items
        except Exception as e:
            print(f"Error fetching all caregivers: {e}")
            return []
    
    def get_caregiver_info(self, caregiver_id: str, facility_id: str = None) -> Optional[Dict]:
        """Get detailed caregiver information"""
        if facility_id is None:
            facility_id = settings.FACILITY_ID
            
        table = self.dynamodb.Table('caregivers')
        
        try:
            # Use proper query with partition key and sort key
            response = table.query(
                KeyConditionExpression=Key('facility_id').eq(facility_id) & Key('caregiver_id').eq(caregiver_id),
                Limit=1
            )
            items = response.get('Items', [])
            
            if items:
                cleaned_item = self.decimal_to_float(items[0])
                # Mask sensitive fields
                if 'cognito_user_id' in cleaned_item:
                    cleaned_item['cognito_user_id'] = '[PROTECTED]'
                return cleaned_item
            return None
        except Exception as e:
            print(f"Error fetching caregiver info: {e}")
            return None
    
    def get_caregiver_certifications(self, caregiver_id: str) -> List[Dict]:
        """Get certifications for a caregiver"""
        table = self.dynamodb.Table('caregiver_certifications')
        
        try:
            response = table.query(
                KeyConditionExpression=Key('caregiver_id').eq(caregiver_id)
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching caregiver certifications: {e}")
            return []
    
    def get_caregiver_assignments(self, caregiver_id: str, days: int = 7) -> List[Dict]:
        """Get resident assignments for a caregiver"""
        table = self.dynamodb.Table('caregiver_resident_assignments')
        
        try:
            # Query using GSI for caregiver_id
            from datetime import datetime, timedelta
            
            start_date = datetime.now() - timedelta(days=days)
            end_date = datetime.now()
            
            response = table.query(
                IndexName='gsi-caregiver-date',
                KeyConditionExpression=Key('caregiver_id').eq(caregiver_id) & 
                                     Key('shift_date').between(
                                         start_date.strftime('%Y-%m-%d'),
                                         end_date.strftime('%Y-%m-%d')
                                     )
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching caregiver assignments: {e}")
            return []
    
    def get_caregiver_schedule(self, caregiver_id: str, days: int = 7) -> List[Dict]:
        """Get shift schedule for a caregiver"""
        table = self.dynamodb.Table('caregiver_shift_schedule')
        
        try:
            from datetime import datetime, timedelta
            
            start_date = datetime.now() - timedelta(days=days)
            end_date = datetime.now()
            
            response = table.query(
                IndexName='gsi-caregiver-date',
                KeyConditionExpression=Key('caregiver_id').eq(caregiver_id) & 
                                     Key('shift_date').between(
                                         start_date.strftime('%Y-%m-%d'),
                                         end_date.strftime('%Y-%m-%d')
                                     )
            )
            return self.decimal_to_float(response.get('Items', []))
        except Exception as e:
            print(f"Error fetching caregiver schedule: {e}")
            return []
    
    def get_caregiver_performance(self, caregiver_id: str) -> Optional[Dict]:
        """Get latest performance metrics for a caregiver"""
        table = self.dynamodb.Table('caregiver_performance_metrics')
        
        try:
            response = table.query(
                KeyConditionExpression=Key('caregiver_id').eq(caregiver_id),
                ScanIndexForward=False,
                Limit=1
            )
            items = response.get('Items', [])
            return self.decimal_to_float(items[0]) if items else None
        except Exception as e:
            print(f"Error fetching caregiver performance: {e}")
            return None

# Singleton instance
db_service = DynamoDBService()
