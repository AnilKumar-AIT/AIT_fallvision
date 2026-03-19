"""
Configuration settings for FallVision Backend API
"""
import os

class Settings:
    # AWS Configuration
    AWS_REGION = "us-east-1"
    FACILITY_ID = "FAC#f-001"
    
    # DynamoDB Table Names
    TABLE_RESIDENTS = "residents"
    TABLE_SLEEP_SUMMARY = "sleep_nightly_summary"
    TABLE_SLEEP_MOVEMENT = "sleep_movement_hourly"
    TABLE_SLEEP_WAKE = "sleep_wake_episodes"
    TABLE_GAIT_SNAPSHOT = "gait_metrics_snapshot"
    TABLE_GAIT_DAILY = "gait_daily_steps"
    TABLE_STRIDE_HOURLY = "stride_length_hourly"
    TABLE_UNIFIED_ALERTS = "unified_alerts"
    TABLE_SUGGESTIONS = "resident_smart_suggestions"
    TABLE_HEALTH_SCORE = "resident_health_score"
    
    # CORS
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    # API Settings
    API_V1_PREFIX = "/api/v1"
    PROJECT_NAME = "FallVision API"
    VERSION = "1.0.0"

settings = Settings()
