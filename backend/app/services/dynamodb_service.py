"""DynamoDB Service Layer
Handles all database operations
"""
import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import Binary
from decimal import Decimal
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
import base64
import uuid
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
        """Get emergency contacts for a resident and decrypt sensitive fields"""
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        
        try:
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id)
            )
            items = response.get('Items', [])
            
            # Decrypt and return contact information
            cleaned_items = []
            for item in items:
                cleaned_item = self.decimal_to_float(item)
                
                # Decrypt encrypted fields
                if 'contact_name_enc' in cleaned_item:
                    cleaned_item['contact_name'] = self._fake_decrypt(cleaned_item['contact_name_enc'])
                    del cleaned_item['contact_name_enc']
                
                if 'phone_enc' in cleaned_item:
                    cleaned_item['phone'] = self._fake_decrypt(cleaned_item['phone_enc'])
                    del cleaned_item['phone_enc']
                
                if 'email_enc' in cleaned_item:
                    cleaned_item['email'] = self._fake_decrypt(cleaned_item['email_enc'])
                    del cleaned_item['email_enc']
                
                cleaned_items.append(cleaned_item)
            
            return cleaned_items
        except Exception as e:
            print(f"Error fetching emergency contacts: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    # ==================== CREATE RESIDENT ====================
    
    @staticmethod
    def _v(val):
        """Return the value if truthy/non-empty, otherwise 'N/A'."""
        if val is None:
            return "N/A"
        if isinstance(val, str) and val.strip() == "":
            return "N/A"
        return val

    def create_resident(self, facility_id: str, resident_data: Dict, photo_s3_key: str = None) -> Dict:
        """
        Create a new resident.  Only facility_id is assumed.
        Every other field comes from the form; missing → "N/A".
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v   # shorthand

        # Generate unique resident_id
        date_part = now.strftime("%Y%m%d")
        short_uuid = uuid.uuid4().hex[:4]
        resident_id = f"RES#res-{date_part}-{short_uuid}"

        # ── Pull every field from the form; empty → "N/A" ──
        first_name   = v(resident_data.get("first_name"))
        last_name    = v(resident_data.get("last_name"))
        raw_age      = resident_data.get("age")
        age          = int(raw_age) if raw_age not in (None, "", "N/A") else "N/A"
        sex          = v(resident_data.get("sex"))
        mrn          = v(resident_data.get("mrn"))

        raw_h = resident_data.get("height_cm")
        height_cm = int(raw_h) if raw_h not in (None, "", "N/A") else "N/A"

        raw_w = resident_data.get("weight_kg")
        weight_kg = Decimal(str(raw_w)) if raw_w not in (None, "", "N/A") else "N/A"

        room_number    = v(resident_data.get("room_number"))
        bed_id_suffix  = v(resident_data.get("bed_id"))
        unit_id        = v(resident_data.get("unit_id"))
        mobility_class = v(resident_data.get("mobility_class"))
        admission_date = v(resident_data.get("admission_date"))
        fall_risk_level      = v(resident_data.get("fall_risk_level"))
        latest_sleep_quality = v(resident_data.get("latest_sleep_quality"))
        risk_factors   = resident_data.get("risk_factors", [])

        sleep_monitoring_consent = resident_data.get("sleep_monitoring_consent", False)
        video_clip_consent      = resident_data.get("video_clip_consent", False)

        # Compute age_group only if age is a real number
        if isinstance(age, int):
            if age < 75:
                age_group = "65-74"
            elif age < 85:
                age_group = "75-84"
            else:
                age_group = "85+"
        else:
            age_group = "N/A"

        # Build composite keys only when we have real room numbers
        room_id = f"ROOM#r-{room_number}" if room_number != "N/A" else "N/A"
        bed_id  = f"BED#b-{room_number}-{bed_id_suffix}" if room_number != "N/A" and bed_id_suffix != "N/A" else "N/A"

        # GSI sort key  (status is always ACTIVE for a new resident)
        status = "ACTIVE"
        status_name_sort = f"{status}#{last_name}#{first_name}#{resident_id}"

        # Placeholder encrypted fields (production would use KMS)
        fake_enc = b'\x00' * 48

        item = {
            "facility_id":       facility_id,
            "resident_id":       resident_id,
            "mrn":               mrn,
            "first_name_enc":    fake_enc,
            "last_name_enc":     fake_enc,
            "display_name_enc":  fake_enc,
            "dob_enc":           fake_enc,
            "age":               age,
            "age_group":         age_group,
            "sex":               sex,
            "height_cm":         height_cm,
            "weight_kg":         weight_kg,
            "room_id":           room_id,
            "bed_id":            bed_id,
            "unit_id":           unit_id,
            "admission_date":    admission_date,
            "mobility_class":    mobility_class,
            "risk_factors":      risk_factors if risk_factors else [],
            # Baselines — N/A until a clinical assessment is done
            "baseline_step_freq":          "N/A",
            "baseline_stride":             "N/A",
            "baseline_balance":            "N/A",
            "baseline_tst_min":            "N/A",
            "baseline_se_pct":             "N/A",
            "baseline_waso_min":           "N/A",
            "baseline_sl_min":             "N/A",
            "baseline_sleep_7d_avg_tst_min": "N/A",
            # Falls — brand-new resident
            "total_falls_lifetime":  0,
            "last_fall_date":        "N/A",
            "days_since_last_fall":  0,
            # Clinical — only what user entered
            "fall_risk_level":       fall_risk_level,
            "fall_risk_score":       "N/A",
            "latest_sleep_quality":  latest_sleep_quality,
            # Monitoring
            "monitoring_active":           True,
            "sleep_monitoring_consent":    sleep_monitoring_consent,
            "video_clip_consent":          video_clip_consent,
            "photo_s3_key":                photo_s3_key or "",
            # Status & meta
            "status":              status,
            "status_name_sort":    status_name_sort,
            "created_at":          now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at":          now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version":             1,
        }
        
        try:
            table.put_item(Item=item)
            print(f"[DB] Created resident: {resident_id}")
            
            # Return a cleaned version (no binary)
            clean = self.decimal_to_float(item)
            for key in ['first_name_enc', 'last_name_enc', 'display_name_enc', 'dob_enc']:
                if key in clean:
                    clean[key] = '[ENCRYPTED]'
            return clean
        except Exception as e:
            print(f"[ERROR] Failed to create resident: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def create_emergency_contacts(self, resident_id: str, contacts: List[Dict]):
        """
        Write emergency contacts for a newly created resident.
        Table key: resident_id (PK) + contact_priority (SK).
        Encrypts sensitive fields before storing.
        """
        table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Track used priorities so we don't collide on the sort key
        used_priorities = {}
        for c in contacts:
            raw_priority = c.get("contact_priority", "N/A")
            # Make unique: PRIMARY, PRIMARY_2, PRIMARY_3 …
            if raw_priority in used_priorities:
                used_priorities[raw_priority] += 1
                sk = f"{raw_priority}_{used_priorities[raw_priority]}"
            else:
                used_priorities[raw_priority] = 1
                sk = raw_priority

            # Encrypt sensitive fields (reversible encryption for dev/demo)
            item = {
                "resident_id":       resident_id,
                "contact_priority":  sk,
                "contact_name_enc":  self._fake_encrypt(c.get("contact_name", "N/A")),
                "relationship":      c.get("relationship", "N/A"),
                "phone_enc":         self._fake_encrypt(c.get("phone", "N/A")),
                "email_enc":         self._fake_encrypt(c.get("email", "N/A")),
                "notify_on_fall":    c.get("notify_on_fall", False),
                "is_legal_guardian": c.get("is_legal_guardian", False),
                "created_at":        now,
            }

            try:
                table.put_item(Item=item)
                print(f"[DB] Created emergency contact for {resident_id}: {sk}")
            except Exception as e:
                print(f"[ERROR] Failed to create emergency contact {sk}: {e}")
    
    @staticmethod
    def _fake_encrypt(plaintext: str) -> bytes:
        """
        Simple reversible encryption (placeholder for KMS).
        Stores plaintext in base64 within a 48-byte binary blob.
        Format: [32 random bytes][16 bytes with base64-encoded plaintext]
        """
        if not plaintext or plaintext == "N/A":
            return b'\x00' * 48
        
        # Encode plaintext and pad/truncate to fit in last 16 bytes
        plaintext_bytes = plaintext.encode('utf-8')[:64]  # Max 64 chars
        # Store length in first byte, then data
        length_byte = bytes([min(len(plaintext_bytes), 63)])
        padded = (length_byte + plaintext_bytes).ljust(16, b'\x00')
        
        # Random prefix (32 bytes) + our encoded data (16 bytes)
        import os
        return os.urandom(32) + padded
    
    @staticmethod
    def _fake_decrypt(encrypted_data) -> str:
        """
        Decrypt data encrypted by _fake_encrypt.
        Extracts plaintext from last 16 bytes.
        """
        try:
            # Convert from base64 string if needed
            if isinstance(encrypted_data, str):
                encrypted_bytes = base64.b64decode(encrypted_data)
            elif isinstance(encrypted_data, bytes):
                encrypted_bytes = encrypted_data
            else:
                return "[Invalid Type]"
            
            if not encrypted_bytes or len(encrypted_bytes) < 48:
                return "N/A"
            
            # Extract last 16 bytes
            data_section = encrypted_bytes[32:48]
            
            # First byte is the length
            length = data_section[0]
            if length == 0 or length > 63:
                return "[Seed Data - No Plaintext]"
            
            # Extract plaintext
            plaintext_bytes = data_section[1:1+length]
            return plaintext_bytes.decode('utf-8')
            
        except Exception as e:
            print(f"[ERROR] _fake_decrypt failed: {e}")
            return "[Decryption Failed]"
    
    def delete_resident(self, facility_id: str, resident_id: str) -> str:
        """
        Delete a resident from DynamoDB and return their photo_s3_key
        so the caller can also delete the photo from S3.
        Also deletes their emergency contacts.
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        photo_s3_key = ""

        # 1) Fetch the resident first to get their photo_s3_key
        try:
            response = table.query(
                KeyConditionExpression=Key('facility_id').eq(facility_id) &
                                     Key('resident_id').eq(resident_id)
            )
            items = response.get('Items', [])
            if items:
                photo_s3_key = items[0].get('photo_s3_key', '')
        except Exception as e:
            print(f"[WARN] Could not fetch resident before delete: {e}")

        # 2) Delete the resident item
        try:
            table.delete_item(
                Key={'facility_id': facility_id, 'resident_id': resident_id}
            )
            print(f"[DB] Deleted resident: {resident_id}")
        except Exception as e:
            print(f"[ERROR] Failed to delete resident {resident_id}: {e}")
            raise

        # 3) Delete their emergency contacts (best-effort)
        #    Table key: resident_id (PK) + contact_priority (SK)
        try:
            ec_table = self.dynamodb.Table(settings.TABLE_EMERGENCY_CONTACTS)
            ec_response = ec_table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id)
            )
            for item in ec_response.get('Items', []):
                ec_table.delete_item(
                    Key={
                        'resident_id': resident_id,
                        'contact_priority': item['contact_priority']
                    }
                )
            print(f"[DB] Deleted emergency contacts for {resident_id}")
        except Exception as e:
            print(f"[WARN] Could not delete emergency contacts for {resident_id}: {e}")

        return photo_s3_key or ""
    
    def update_resident(self, facility_id: str, resident_id: str, resident_data: Dict) -> Dict:
        """
        Update an existing resident's information.
        Only updates the fields provided in resident_data.
        """
        table = self.dynamodb.Table(settings.TABLE_RESIDENTS)
        now = datetime.now(timezone.utc)
        v = self._v  # shorthand
        
        # Build update expression dynamically based on provided fields
        update_expr_parts = []
        expr_attr_names = {}
        expr_attr_values = {}
        
        # First, get current resident data
        current_resident = self.get_resident_info(resident_id)
        if not current_resident:
            raise ValueError(f"Resident {resident_id} not found")
        
        # Build updated values
        first_name = v(resident_data.get('first_name')) if 'first_name' in resident_data else current_resident.get('first_name', 'N/A')
        last_name = v(resident_data.get('last_name')) if 'last_name' in resident_data else current_resident.get('last_name', 'N/A')
        status = resident_data.get('status') if 'status' in resident_data else current_resident.get('status', 'ACTIVE')
        
        # Update status_name_sort if name or status changed
        if 'first_name' in resident_data or 'last_name' in resident_data or 'status' in resident_data:
            status_name_sort = f"{status}#{last_name}#{first_name}#{resident_id}"
            expr_attr_names['#status_name_sort'] = 'status_name_sort'
            expr_attr_values[':status_name_sort'] = status_name_sort
            update_expr_parts.append('#status_name_sort = :status_name_sort')
        
        # Map of field names to their values
        idx = 0
        field_mapping = {
            'age': resident_data.get('age'),
            'room_number': resident_data.get('room_number'),
            'mrn': resident_data.get('mrn'),
            'fall_risk_level': resident_data.get('fall_risk_level'),
            'latest_sleep_quality': resident_data.get('latest_sleep_quality'),
            'mobility_class': resident_data.get('mobility_class'),
            'status': resident_data.get('status'),
        }
        
        # Add fields to update expression
        for field_name, field_value in field_mapping.items():
            if field_value is not None:
                # Special handling for room_number
                if field_name == 'room_number':
                    room_id = f"ROOM#r-{field_value}"
                    expr_attr_names['#room_id'] = 'room_id'
                    expr_attr_values[':room_id'] = room_id
                    update_expr_parts.append('#room_id = :room_id')
                else:
                    attr_name_key = f"#field{idx}"
                    attr_value_key = f":val{idx}"
                    
                    expr_attr_names[attr_name_key] = field_name
                    if field_name == 'age':
                        expr_attr_values[attr_value_key] = int(field_value)
                    else:
                        expr_attr_values[attr_value_key] = v(field_value)
                    update_expr_parts.append(f"{attr_name_key} = {attr_value_key}")
                    idx += 1
        
        # Update age_group if age changed
        if 'age' in resident_data:
            age = int(resident_data['age'])
            if age < 75:
                age_group = "65-74"
            elif age < 85:
                age_group = "75-84"
            else:
                age_group = "85+"
            expr_attr_names['#age_group'] = 'age_group'
            expr_attr_values[':age_group'] = age_group
            update_expr_parts.append('#age_group = :age_group')
        
        # Add updated_at and version
        expr_attr_names['#updated_at'] = 'updated_at'
        expr_attr_values[':updated_at'] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append('#updated_at = :updated_at')
        
        expr_attr_names['#version'] = 'version'
        expr_attr_values[':version_inc'] = 1
        update_expr_parts.append('#version = #version + :version_inc')
        
        if not update_expr_parts:
            raise ValueError("No fields to update")
        
        update_expression = 'SET ' + ', '.join(update_expr_parts)
        
        try:
            response = table.update_item(
                Key={
                    'facility_id': facility_id,
                    'resident_id': resident_id
                },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values,
                ReturnValues='ALL_NEW'
            )
            
            print(f"[DB] Updated resident: {resident_id}")
            
            # Return cleaned version
            updated_item = self.decimal_to_float(response['Attributes'])
            for key in ['first_name_enc', 'last_name_enc', 'display_name_enc', 'dob_enc']:
                if key in updated_item:
                    updated_item[key] = '[ENCRYPTED]'
            return updated_item
        except Exception as e:
            print(f"[ERROR] Failed to update resident {resident_id}: {e}")
            import traceback
            traceback.print_exc()
            raise
    
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
    
    def get_resident_caregivers(self, resident_id: str, days: int = 7) -> List[Dict]:
        """Get currently assigned caregivers for a resident (active assignments only)"""
        table = self.dynamodb.Table('caregiver_resident_assignments')
        
        try:
            # Query all assignments for this resident using GSI
            response = table.query(
                IndexName='gsi-resident-date',
                KeyConditionExpression=Key('resident_id').eq(resident_id)
            )
            
            all_assignments = self.decimal_to_float(response.get('Items', []))
            print(f"[DB] Found {len(all_assignments)} total assignments for resident {resident_id}")
            
            # Filter for active assignments only
            active_assignments = [
                a for a in all_assignments 
                if a.get('is_active', False) == True
            ]
            
            print(f"[DB] Found {len(active_assignments)} active assignments")
            
            # Get unique caregiver IDs and fetch their details
            caregiver_ids = list(set([a.get('caregiver_id') for a in active_assignments if a.get('caregiver_id')]))
            caregivers = []
            
            for cg_id in caregiver_ids:
                caregiver = self.get_caregiver_info(cg_id, settings.FACILITY_ID)
                if caregiver:
                    # Add assignment info to caregiver
                    cg_assignments = [a for a in active_assignments if a.get('caregiver_id') == cg_id]
                    
                    # Get the latest assignment info
                    latest_assignment = max(cg_assignments, key=lambda x: x.get('shift_date', ''), default=None)
                    
                    if latest_assignment:
                        caregiver['assignment_type'] = latest_assignment.get('assignment_type', 'PRIMARY')
                        caregiver['shift_type'] = latest_assignment.get('shift_type', 'N/A')
                        caregiver['assigned_date'] = latest_assignment.get('shift_date', 'N/A')
                    
                    caregivers.append(caregiver)
            
            # Sort by assignment type (PRIMARY first)
            caregivers.sort(key=lambda x: (x.get('assignment_type') != 'PRIMARY', x.get('display_name', '')))
            
            print(f"[DB] Returning {len(caregivers)} active caregivers for resident {resident_id}")
            return caregivers
        except Exception as e:
            print(f"Error fetching resident caregivers: {e}")
            import traceback
            traceback.print_exc()
            return []

    def create_caregiver(self, facility_id: str, caregiver_data: Dict, photo_s3_key: str = None) -> Dict:
        """
        Create a new caregiver. Only facility_id is assumed.
        Every other field comes from the form; missing → "N/A".
        """
        table = self.dynamodb.Table('caregivers')
        now = datetime.now(timezone.utc)
        v = self._v   # shorthand

        # Check if we have an override from photo upload
        if "_override_caregiver_id" in caregiver_data:
            caregiver_id = caregiver_data["_override_caregiver_id"]
        else:
            # Generate unique caregiver_id
            date_part = now.strftime("%Y%m%d")
            short_uuid = uuid.uuid4().hex[:4]
            caregiver_id = f"CG#cg-{date_part}-{short_uuid}"

        # Pull every field from the form; empty → "N/A"
        first_name   = v(caregiver_data.get("first_name"))
        last_name    = v(caregiver_data.get("last_name"))
        email        = v(caregiver_data.get("email"))
        phone        = v(caregiver_data.get("phone"))
        role         = v(caregiver_data.get("role"))
        primary_shift = v(caregiver_data.get("primary_shift"))
        badge_id     = v(caregiver_data.get("badge_id"))
        employee_id  = v(caregiver_data.get("employee_id"))
        status       = caregiver_data.get("status", "ACTIVE")
        
        # Auto-generate badge_id and employee_id if not provided
        if badge_id == "N/A":
            badge_id = f"BADGE#B-{4500 + int(uuid.uuid4().hex[:4], 16) % 1000}"
        if employee_id == "N/A":
            employee_id = f"EMP#E-2025-{str(300 + int(uuid.uuid4().hex[:4], 16) % 1000).zfill(4)}"

        fall_response_trained = caregiver_data.get("fall_response_trained", False)
        mfa_enabled = caregiver_data.get("mfa_enabled", True)
        
        raw_max_load = caregiver_data.get("max_resident_load")
        max_resident_load = int(raw_max_load) if raw_max_load not in (None, "", "N/A") else 10

        # Build display name
        display_name = f"{first_name} {last_name}, {role}"
        
        # Status sort key for GSI
        status_display_name = f"{status}#{display_name}"
        
        # License status for GSI (placeholder - would come from certifications)
        license_status_expiry = "ACTIVE#2026-12-31"
        
        # Permissions based on role
        permissions = ["residents:read", "falls:read", "alerts:acknowledge"]
        if role in ["RN", "NP", "ADMIN"]:
            permissions.extend(["residents:write", "falls:write", "reports:read"])
        
        dashboard_access_level = "FULL" if role in ["RN", "NP", "ADMIN"] else "READ_ONLY"
        is_caregiver = role != "ADMIN"
        
        # Generate fake cognito user ID (in production, would be real)
        cognito_user_id = f"us-east-1_{uuid.uuid4().hex[:8]}:{uuid.uuid4().hex[:12]}"

        item = {
            "facility_id":       facility_id,
            "caregiver_id":      caregiver_id,
            "cognito_user_id":   cognito_user_id,
            "badge_id":          badge_id,
            "employee_id":       employee_id,
            "first_name":        first_name,
            "last_name":         last_name,
            "display_name":      display_name,
            "email":             email,
            "phone":             phone,
            "role":              role,
            "is_caregiver":      is_caregiver,
            "primary_shift":     primary_shift,
            "max_resident_load": max_resident_load,
            "current_resident_count": 0,
            "fall_response_trained": fall_response_trained,
            "avg_response_time_sec": 0,
            "total_falls_responded": 0,
            "dashboard_access_level": dashboard_access_level,
            "permissions":       permissions,
            "mfa_enabled":       mfa_enabled,
            "status":            status,
            "status_display_name": status_display_name,
            "license_status_expiry": license_status_expiry,
            "photo_s3_key":      photo_s3_key or "",
            "created_at":        now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "updated_at":        now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "version":           1,
        }
        
        try:
            table.put_item(Item=item)
            print(f"[DB] Created caregiver: {caregiver_id}")
            
            # Return a cleaned version
            clean = self.decimal_to_float(item)
            if 'cognito_user_id' in clean:
                clean['cognito_user_id'] = '[PROTECTED]'
            return clean
        except Exception as e:
            print(f"[ERROR] Failed to create caregiver: {e}")
            import traceback
            traceback.print_exc()
            raise

    def update_caregiver(self, facility_id: str, caregiver_id: str, caregiver_data: Dict) -> Dict:
        """
        Update an existing caregiver's information.
        Only updates the fields provided in caregiver_data.
        """
        table = self.dynamodb.Table('caregivers')
        now = datetime.now(timezone.utc)
        v = self._v  # shorthand
        
        # Build update expression dynamically based on provided fields
        update_expr_parts = []
        expr_attr_names = {}
        expr_attr_values = {}
        
        # Track which fields are being updated
        idx = 0
        
        # Map of field names to their values
        field_mapping = {
            'first_name': caregiver_data.get('first_name'),
            'last_name': caregiver_data.get('last_name'),
            'email': caregiver_data.get('email'),
            'phone': caregiver_data.get('phone'),
            'role': caregiver_data.get('role'),
            'primary_shift': caregiver_data.get('primary_shift'),
            'badge_id': caregiver_data.get('badge_id'),
            'employee_id': caregiver_data.get('employee_id'),
            'status': caregiver_data.get('status'),
        }
        
        # First, get current caregiver data to build display_name and status_display_name
        current_caregiver = self.get_caregiver_info(caregiver_id, facility_id)
        if not current_caregiver:
            raise ValueError(f"Caregiver {caregiver_id} not found")
        
        # Build updated values, using current values if not provided
        first_name = v(caregiver_data.get('first_name')) if 'first_name' in caregiver_data else current_caregiver.get('first_name', 'N/A')
        last_name = v(caregiver_data.get('last_name')) if 'last_name' in caregiver_data else current_caregiver.get('last_name', 'N/A')
        role = v(caregiver_data.get('role')) if 'role' in caregiver_data else current_caregiver.get('role', 'CNA')
        status = caregiver_data.get('status') if 'status' in caregiver_data else current_caregiver.get('status', 'ACTIVE')
        
        # Build display_name
        display_name = f"{first_name} {last_name}, {role}"
        status_display_name = f"{status}#{display_name}"
        
        # Add all fields to update expression
        for field_name, field_value in field_mapping.items():
            if field_value is not None:
                attr_name_key = f"#field{idx}"
                attr_value_key = f":val{idx}"
                
                expr_attr_names[attr_name_key] = field_name
                expr_attr_values[attr_value_key] = v(field_value)
                update_expr_parts.append(f"{attr_name_key} = {attr_value_key}")
                idx += 1
        
        # Add computed fields
        expr_attr_names['#display_name'] = 'display_name'
        expr_attr_values[':display_name'] = display_name
        update_expr_parts.append('#display_name = :display_name')
        
        expr_attr_names['#status_display_name'] = 'status_display_name'
        expr_attr_values[':status_display_name'] = status_display_name
        update_expr_parts.append('#status_display_name = :status_display_name')
        
        # Add updated_at and version
        expr_attr_names['#updated_at'] = 'updated_at'
        expr_attr_values[':updated_at'] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        update_expr_parts.append('#updated_at = :updated_at')
        
        expr_attr_names['#version'] = 'version'
        expr_attr_values[':version_inc'] = 1
        update_expr_parts.append('#version = #version + :version_inc')
        
        update_expression = 'SET ' + ', '.join(update_expr_parts)
        
        try:
            response = table.update_item(
                Key={
                    'facility_id': facility_id,
                    'caregiver_id': caregiver_id
                },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values,
                ReturnValues='ALL_NEW'
            )
            
            print(f"[DB] Updated caregiver: {caregiver_id}")
            
            # Return cleaned version
            updated_item = self.decimal_to_float(response['Attributes'])
            if 'cognito_user_id' in updated_item:
                updated_item['cognito_user_id'] = '[PROTECTED]'
            return updated_item
        except Exception as e:
            print(f"[ERROR] Failed to update caregiver {caregiver_id}: {e}")
            import traceback
            traceback.print_exc()
            raise

# Singleton instance
db_service = DynamoDBService()
