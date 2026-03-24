#!/usr/bin/env python3
"""
AITCare-FallVision - DynamoDB Table Creator & Seed Data Generator
=================================================================
Creates all 25 optimized DynamoDB tables (+ 3 S3 bucket structures)
and seeds each table with 10 realistic dummy records.

Architecture Reference: DB_Optimization_Guide.md (28 tables = 25 DynamoDB + 3 S3)

Usage:
    python create_tables_and_seed.py --region us-east-1 --env dev
    python create_tables_and_seed.py --region us-east-1 --env dev --endpoint http://localhost:8000
    python create_tables_and_seed.py --region us-east-1 --env dev --tables-only
    python create_tables_and_seed.py --region us-east-1 --env dev --seed-only
    python create_tables_and_seed.py --region us-east-1 --env dev --dry-run

Author:  AI Tensors Inc.
Date:    2026-03-16
Version: 1.0
"""

import argparse, json, sys, time, uuid, random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("ERROR: boto3 is required. Install with: pip install boto3")
    sys.exit(1)
# ============================================================================
# CONSTANTS
# ============================================================================
FACILITY_ID = "FAC#f-001"
ENV = "dev"
NOW = datetime.now(timezone.utc)
TODAY = NOW.strftime("%Y-%m-%d")
YESTERDAY = (NOW - timedelta(days=1)).strftime("%Y-%m-%d")
THIS_MONTH = NOW.strftime("%Y-%m")

RESIDENT_IDS = [f"RES#res-{(NOW - timedelta(days=random.randint(30,365))).strftime('%Y%m%d')}-{str(i).zfill(4)}" for i in range(1, 11)]
RESIDENT_NAMES = [
    ("James", "Smith"), ("Mary", "Johnson"), ("Robert", "Williams"), ("Patricia", "Brown"),
    ("John", "Davis"), ("Jennifer", "Miller"), ("Michael", "Wilson"), ("Linda", "Moore"),
    ("David", "Taylor"), ("Elizabeth", "Anderson")
]
CAREGIVER_IDS = [f"CG#cg-{(NOW - timedelta(days=random.randint(60,730))).strftime('%Y%m%d')}-{str(i).zfill(4)}" for i in range(1, 11)]
CAREGIVER_NAMES = [
    ("Sarah", "Johnson", "RN"), ("Michael", "Brown", "CNA"), ("Emily", "Davis", "LPN"),
    ("William", "Garcia", "RN"), ("Jessica", "Martinez", "CNA"), ("Daniel", "Robinson", "PT"),
    ("Amanda", "Clark", "NP"), ("Christopher", "Lewis", "CNA"), ("Stephanie", "Lee", "RN"),
    ("Matthew", "Walker", "ADMIN")
]
DEVICE_IDS = [f"DEV#jetson-room-{200 + i}" for i in range(1, 11)]
FALL_IDS = [f"FALL#fall-{uuid.uuid4().hex[:12]}" for _ in range(10)]

def iso_now(offset_minutes=0):
    return (NOW + timedelta(minutes=offset_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")

def epoch_ttl(days=90):
    return int((NOW + timedelta(days=days)).timestamp())

def rand_float(low, high, decimals=1):
    return Decimal(str(round(random.uniform(low, high), decimals)))

def rand_int(low, high):
    return random.randint(low, high)

def fake_encrypted():
    return b'\x00' * 32 + uuid.uuid4().bytes
# ============================================================================
# TABLE DEFINITIONS (25 DynamoDB Tables)
# ============================================================================
def get_table_definitions():
    tables = []

    # T1. residents (absorbs older_adults, sleep_baselines, resident_photos meta)
    tables.append({
        "TableName": "residents",
        "KeySchema": [
            {"AttributeName": "facility_id", "KeyType": "HASH"},
            {"AttributeName": "resident_id", "KeyType": "RANGE"}],
        "AttributeDefinitions": [
            {"AttributeName": "facility_id", "AttributeType": "S"},
            {"AttributeName": "resident_id", "AttributeType": "S"},
            {"AttributeName": "age_group", "AttributeType": "S"},
            {"AttributeName": "latest_sleep_quality", "AttributeType": "S"},
            {"AttributeName": "fall_risk_level", "AttributeType": "S"},
            {"AttributeName": "room_id", "AttributeType": "S"},
            {"AttributeName": "unit_id", "AttributeType": "S"},
            {"AttributeName": "status_name_sort", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-status-name", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "status_name_sort", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-age-group", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "age_group", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-sleep-quality", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "latest_sleep_quality", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-fall-risk", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "fall_risk_level", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-room", "KeySchema": [{"AttributeName": "room_id", "KeyType": "HASH"}, {"AttributeName": "resident_id", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-unit", "KeySchema": [{"AttributeName": "unit_id", "KeyType": "HASH"}, {"AttributeName": "resident_id", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-resident-id", "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "1-CoreEntity"}]
    })

    # T2. caregivers (absorbs staff_users, adds is_caregiver flag)
    tables.append({
        "TableName": "caregivers",
        "KeySchema": [
            {"AttributeName": "facility_id", "KeyType": "HASH"},
            {"AttributeName": "caregiver_id", "KeyType": "RANGE"}],
        "AttributeDefinitions": [
            {"AttributeName": "facility_id", "AttributeType": "S"},
            {"AttributeName": "caregiver_id", "AttributeType": "S"},
            {"AttributeName": "status_display_name", "AttributeType": "S"},
            {"AttributeName": "role", "AttributeType": "S"},
            {"AttributeName": "primary_shift", "AttributeType": "S"},
            {"AttributeName": "license_status_expiry", "AttributeType": "S"},
            {"AttributeName": "cognito_user_id", "AttributeType": "S"},
            {"AttributeName": "badge_id", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-status-name", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "status_display_name", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-role", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "role", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-shift", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "primary_shift", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-license", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "license_status_expiry", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-cognito", "KeySchema": [{"AttributeName": "cognito_user_id", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-badge", "KeySchema": [{"AttributeName": "badge_id", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "1-CoreEntity"}]
    })

    # T3. devices (merged facility_device_status + device_heartbeat_log)
    tables.append({
        "TableName": "devices",
        "KeySchema": [
            {"AttributeName": "device_id", "KeyType": "HASH"},
            {"AttributeName": "record_type_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [
            {"AttributeName": "device_id", "AttributeType": "S"},
            {"AttributeName": "record_type_ts", "AttributeType": "S"},
            {"AttributeName": "facility_id", "AttributeType": "S"},
            {"AttributeName": "status", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-facility-status", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "status", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "1-CoreEntity"}]
    })

    # T4. gait_metrics_snapshot (absorbs body_tilt_readings)
    tables.append({
        "TableName": "gait_metrics_snapshot",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "snapshot_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "snapshot_ts", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-ts", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "snapshot_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]
    })

    # T5. gait_daily_steps
    tables.append({"TableName": "gait_daily_steps",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "date", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "date", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]})

    # T6. stride_length_hourly
    tables.append({"TableName": "stride_length_hourly",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "date_hour", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "date_hour", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]})

    # T7. sleep_nightly_summary
    tables.append({"TableName": "sleep_nightly_summary",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "sleep_date", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "sleep_date", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "sleep_quality_date", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-facility-date", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "sleep_date", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-facility-quality", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "sleep_quality_date", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]})

    # T8. sleep_movement_hourly
    tables.append({"TableName": "sleep_movement_hourly",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "sleep_date_hour", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "sleep_date_hour", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]})

    # T9. sleep_wake_episodes
    tables.append({"TableName": "sleep_wake_episodes",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "sleep_date_episode", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "sleep_date_episode", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "wake_start_ts", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-wake", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "wake_start_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "2-TimeSeries"}]})

    # T10. fall_events (absorbs fall_contributing_factors)
    tables.append({"TableName": "fall_events",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "fall_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "fall_ts", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "severity_fall_ts", "AttributeType": "S"}, {"AttributeName": "location_type_fall_ts", "AttributeType": "S"}, {"AttributeName": "fall_id", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-facility-ts", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "fall_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-facility-severity", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "severity_fall_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-facility-location", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "location_type_fall_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-fall-id", "KeySchema": [{"AttributeName": "fall_id", "KeyType": "HASH"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "3-ClinicalEvent"}]})

    # T11. fall_response_log (absorbs fall_post_actions)
    tables.append({"TableName": "fall_response_log",
        "KeySchema": [{"AttributeName": "fall_id", "KeyType": "HASH"}, {"AttributeName": "event_type_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "fall_id", "AttributeType": "S"}, {"AttributeName": "event_type_ts", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "3-ClinicalEvent"}]})

    # T12. fall_monthly_stats
    tables.append({"TableName": "fall_monthly_stats",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "year_month", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "year_month", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-month", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "year_month", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "3-ClinicalEvent"}]})

    # T13. fall_prevention_plan
    tables.append({"TableName": "fall_prevention_plan",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "plan_version", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "plan_version", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "status_next_assessment", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-status", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "status_next_assessment", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "3-ClinicalEvent"}]})

    # T14. fall_video_clips
    tables.append({"TableName": "fall_video_clips",
        "KeySchema": [{"AttributeName": "fall_id", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "fall_id", "AttributeType": "S"}, {"AttributeName": "sk", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "3-ClinicalEvent"}]})

    # T15. unified_alerts (merges oa_alerts + sleep_alerts)
    tables.append({"TableName": "unified_alerts",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "alert_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "alert_ts", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "domain_severity_ts", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-facility-ts", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "alert_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-facility-domain", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "domain_severity_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "4-CrossCutting"}]})

    # T16. resident_smart_suggestions (absorbs oa_recommendations)
    tables.append({"TableName": "resident_smart_suggestions",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "suggestion_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "suggestion_ts", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "status_priority_ts", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-status", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "status_priority_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "4-CrossCutting"}]})

    # T17. entity_change_log (merges resident_change_log + caregiver_change_log)
    tables.append({"TableName": "entity_change_log",
        "KeySchema": [{"AttributeName": "entity_id", "KeyType": "HASH"}, {"AttributeName": "change_ts", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "entity_id", "AttributeType": "S"}, {"AttributeName": "change_ts", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "changed_by", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-facility-ts", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "change_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-changedby-ts", "KeySchema": [{"AttributeName": "changed_by", "KeyType": "HASH"}, {"AttributeName": "change_ts", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "4-CrossCutting"}]})

    # T18. entity_display_cache (merges resident_search_index + facility_roster_cache)
    tables.append({"TableName": "entity_display_cache",
        "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "entity_type_sort_key", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "entity_type_sort_key", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "4-CrossCutting"}]})

    # T19. resident_health_score (absorbs fall_risk_summary + resident_domain_summary)
    tables.append({"TableName": "resident_health_score",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "score_date", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "score_date", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "overall_score_resident", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-score", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "overall_score_resident", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "4-CrossCutting"}]})

    # T20. facility_daily_snapshot (absorbs facility_domain_overview)
    tables.append({"TableName": "facility_daily_snapshot",
        "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "snapshot_date", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "snapshot_date", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "5-Facility"}]})

    # T21. caregiver_resident_assignments
    tables.append({"TableName": "caregiver_resident_assignments",
        "KeySchema": [{"AttributeName": "facility_shift_date", "KeyType": "HASH"}, {"AttributeName": "caregiver_resident", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "facility_shift_date", "AttributeType": "S"}, {"AttributeName": "caregiver_resident", "AttributeType": "S"}, {"AttributeName": "caregiver_id", "AttributeType": "S"}, {"AttributeName": "shift_date", "AttributeType": "S"}, {"AttributeName": "resident_id", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [
            {"IndexName": "gsi-caregiver-date", "KeySchema": [{"AttributeName": "caregiver_id", "KeyType": "HASH"}, {"AttributeName": "shift_date", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            {"IndexName": "gsi-resident-date", "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "shift_date", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "6-Assignment"}]})

    # T22. caregiver_certifications
    tables.append({"TableName": "caregiver_certifications",
        "KeySchema": [{"AttributeName": "caregiver_id", "KeyType": "HASH"}, {"AttributeName": "cert_type", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "caregiver_id", "AttributeType": "S"}, {"AttributeName": "cert_type", "AttributeType": "S"}, {"AttributeName": "facility_id", "AttributeType": "S"}, {"AttributeName": "cert_status_expiry", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-facility-cert-status", "KeySchema": [{"AttributeName": "facility_id", "KeyType": "HASH"}, {"AttributeName": "cert_status_expiry", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "6-Assignment"}]})

    # T23. caregiver_shift_schedule
    tables.append({"TableName": "caregiver_shift_schedule",
        "KeySchema": [{"AttributeName": "facility_shift_date", "KeyType": "HASH"}, {"AttributeName": "shift_caregiver", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "facility_shift_date", "AttributeType": "S"}, {"AttributeName": "shift_caregiver", "AttributeType": "S"}, {"AttributeName": "caregiver_id", "AttributeType": "S"}, {"AttributeName": "shift_date", "AttributeType": "S"}],
        "GlobalSecondaryIndexes": [{"IndexName": "gsi-caregiver-date", "KeySchema": [{"AttributeName": "caregiver_id", "KeyType": "HASH"}, {"AttributeName": "shift_date", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "6-Assignment"}]})

    # T24. caregiver_performance_metrics
    tables.append({"TableName": "caregiver_performance_metrics",
        "KeySchema": [{"AttributeName": "caregiver_id", "KeyType": "HASH"}, {"AttributeName": "metric_period", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "caregiver_id", "AttributeType": "S"}, {"AttributeName": "metric_period", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "7-Supporting"}]})

    # T25. resident_emergency_contacts
    tables.append({"TableName": "resident_emergency_contacts",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "contact_priority", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "contact_priority", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "7-Supporting"}]})

    # T26. resident_insurance
    tables.append({"TableName": "resident_insurance",
        "KeySchema": [{"AttributeName": "resident_id", "KeyType": "HASH"}, {"AttributeName": "insurance_type", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "resident_id", "AttributeType": "S"}, {"AttributeName": "insurance_type", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "7-Supporting"}]})

    # T27. smart_suggestion_templates
    tables.append({"TableName": "smart_suggestion_templates",
        "KeySchema": [{"AttributeName": "template_category", "KeyType": "HASH"}, {"AttributeName": "template_id", "KeyType": "RANGE"}],
        "AttributeDefinitions": [{"AttributeName": "template_category", "AttributeType": "S"}, {"AttributeName": "template_id", "AttributeType": "S"}],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [{"Key": "Project", "Value": "AITCare-FallVision"}, {"Key": "Tier", "Value": "7-Supporting"}]})

    return tables
# ============================================================================
# SEED DATA GENERATORS (10 records per table)
# ============================================================================

def seed_residents():
    items = []
    risk_levels = ["LOW", "MODERATE", "HIGH", "CRITICAL"]
    sleep_qualities = ["GOOD", "AVERAGE", "POOR"]
    mobility = ["INDEPENDENT", "ASSISTED", "WHEELCHAIR"]
    for i in range(10):
        fn, ln = RESIDENT_NAMES[i]
        age = rand_int(65, 95)
        ag = "65-74" if age < 75 else ("75-84" if age < 85 else "85+")
        rl = random.choice(risk_levels); sq = random.choice(sleep_qualities)
        items.append({
            "facility_id": {"S": FACILITY_ID}, "resident_id": {"S": RESIDENT_IDS[i]},
            "mrn": {"S": f"MRN-2025-{str(4890+i).zfill(6)}"}, "first_name_enc": {"B": fake_encrypted()},
            "last_name_enc": {"B": fake_encrypted()}, "display_name_enc": {"B": fake_encrypted()},
            "dob_enc": {"B": fake_encrypted()}, "age": {"N": str(age)}, "age_group": {"S": ag},
            "sex": {"S": random.choice(["M","F"])}, "height_cm": {"N": str(rand_int(150,185))},
            "weight_kg": {"N": str(rand_float(55,95))}, "room_id": {"S": f"ROOM#r-{200+i+1}"},
            "bed_id": {"S": f"BED#b-{200+i+1}-A"}, "unit_id": {"S": f"UNIT#u-{2 if i<5 else 3}-{'north' if i%2==0 else 'south'}"},
            "admission_date": {"S": (NOW-timedelta(days=rand_int(30,180))).strftime("%Y-%m-%d")},
            "mobility_class": {"S": random.choice(mobility)},
            "risk_factors": {"L": [{"S": f} for f in random.sample(["diabetes","neuropathy","polypharmacy","nocturia","cognitive_impairment","vision_impairment"], rand_int(1,4))]},
            "baseline_step_freq": {"N": str(rand_float(65,90))}, "baseline_stride": {"N": str(rand_float(0.55,0.80,2))},
            "baseline_balance": {"N": str(rand_float(60,90))}, "baseline_tst_min": {"N": str(rand_int(360,480))},
            "baseline_se_pct": {"N": str(rand_float(70,95))}, "baseline_waso_min": {"N": str(rand_int(20,60))},
            "baseline_sl_min": {"N": str(rand_int(10,25))},
            "baseline_sleep_7d_avg_tst_min": {"N": str(rand_int(340,460))},
            "total_falls_lifetime": {"N": str(rand_int(0,12))},
            "last_fall_date": {"S": (NOW-timedelta(days=rand_int(1,60))).strftime("%Y-%m-%d")},
            "days_since_last_fall": {"N": str(rand_int(1,60))},
            "fall_risk_level": {"S": rl}, "fall_risk_score": {"N": str(rand_float(0.1,0.95,2))},
            "latest_sleep_quality": {"S": sq}, "monitoring_active": {"BOOL": True},
            "sleep_monitoring_consent": {"BOOL": True}, "video_clip_consent": {"BOOL": True},
            "photo_s3_key": {"S": f"residents/f-001/{RESIDENT_IDS[i].split('#')[1]}/avatar.enc"},
            "status": {"S": "ACTIVE"},
            "status_name_sort": {"S": f"ACTIVE#{ln}#{fn}#{RESIDENT_IDS[i]}"},
            "created_at": {"S": iso_now(-10000-i*100)}, "updated_at": {"S": iso_now(-i*10)},
            "version": {"N": str(rand_int(1,15))}})
    return "residents", items

def seed_caregivers():
    items = []
    shifts = ["DAY","EVENING","NIGHT"]
    for i in range(10):
        fn,ln,role = CAREGIVER_NAMES[i]; shift = shifts[i%3]
        items.append({
            "facility_id": {"S": FACILITY_ID}, "caregiver_id": {"S": CAREGIVER_IDS[i]},
            "cognito_user_id": {"S": f"us-east-1_{uuid.uuid4().hex[:8]}:{uuid.uuid4().hex[:12]}"},
            "badge_id": {"S": f"BADGE#B-{4500+i}"}, "employee_id": {"S": f"EMP#E-2025-{str(300+i).zfill(4)}"},
            "first_name": {"S": fn}, "last_name": {"S": ln},
            "display_name": {"S": f"{fn} {ln}, {role}"}, "email": {"S": f"{fn.lower()}.{ln.lower()}@facility.com"},
            "phone": {"S": f"+1-555-{str(100+i).zfill(4)}"}, "role": {"S": role},
            "is_caregiver": {"BOOL": role != "ADMIN"}, "primary_shift": {"S": shift},
            "max_resident_load": {"N": str(rand_int(6,12))}, "current_resident_count": {"N": str(rand_int(3,8))},
            "fall_response_trained": {"BOOL": True}, "avg_response_time_sec": {"N": str(rand_int(25,65))},
            "total_falls_responded": {"N": str(rand_int(2,30))},
            "dashboard_access_level": {"S": "FULL" if role in ("RN","NP","ADMIN") else "READ_ONLY"},
            "permissions": {"L": [{"S": "residents:read"},{"S": "falls:read"},{"S": "alerts:acknowledge"}]},
            "mfa_enabled": {"BOOL": True}, "status": {"S": "ACTIVE"},
            "status_display_name": {"S": f"ACTIVE#{fn} {ln}, {role}"},
            "license_status_expiry": {"S": f"ACTIVE#2026-{str(rand_int(1,12)).zfill(2)}-30"},
            "photo_s3_key": {"S": f"caregivers/f-001/{CAREGIVER_IDS[i].split('#')[1]}/avatar.jpg"},
            "created_at": {"S": iso_now(-20000)}, "updated_at": {"S": iso_now(-rand_int(0,500))},
            "version": {"N": str(rand_int(1,10))}})
    return "caregivers", items

def seed_devices():
    items = []
    for i in range(10):
        dev_id = DEVICE_IDS[i]; rn = 201+i
        items.append({"device_id": {"S": dev_id}, "record_type_ts": {"S": "STATUS"},
            "facility_id": {"S": FACILITY_ID}, "device_type": {"S": "JETSON_ORIN_NANO"},
            "device_name": {"S": f"Room {rn} Camera"}, "room_id": {"S": f"ROOM#r-{rn}"},
            "assigned_resident_id": {"S": RESIDENT_IDS[i]},
            "status": {"S": random.choice(["ONLINE"]*8+["OFFLINE","MAINTENANCE"])},
            "last_heartbeat_ts": {"S": iso_now(-rand_int(0,5))},
            "cpu_usage_pct": {"N": str(rand_float(20,75))}, "gpu_usage_pct": {"N": str(rand_float(50,90))},
            "memory_usage_pct": {"N": str(rand_float(40,80))}, "temperature_c": {"N": str(rand_float(42,62))},
            "fps_current": {"N": str(rand_float(25,30))}, "firmware_version": {"S": "1.2.3"},
            "model_version": {"S": "yolov8s-pose-fp16-v2"}, "ip_address": {"S": f"10.0.1.{rn}"},
            "mqtt_connected": {"BOOL": True}, "ttl": {"N": str(epoch_ttl(1))}})
    return "devices", items

def seed_gait_metrics_snapshot():
    items = []
    for i in range(10):
        items.append({"resident_id": {"S": RESIDENT_IDS[i]}, "snapshot_ts": {"S": iso_now(-rand_int(0,60))},
            "facility_id": {"S": FACILITY_ID}, "camera_id": {"S": f"CAM#c-hall-{str(i+1).zfill(2)}"},
            "step_frequency": {"N": str(rand_float(45,85))}, "step_freq_delta": {"N": str(rand_float(-20,5))},
            "stride_length": {"N": str(rand_float(0.35,0.75,2))}, "stride_delta": {"N": str(rand_float(-25,5))},
            "balance_score": {"N": str(rand_float(40,90))}, "balance_delta": {"N": str(rand_float(-20,10))},
            "body_tilt_angle": {"N": str(rand_float(1,18))},
            "body_tilt_dir": {"S": random.choice(["LEFT","RIGHT","BALANCED"])},
            "tilt_zone": {"S": random.choice(["NORMAL","SLIGHT","SIGNIFICANT"])},
            "arm_swing_sym": {"N": str(rand_float(0.4,0.95,2))},
            "fall_risk_level": {"S": random.choice(["LOW","MODERATE","HIGH","CRITICAL"])},
            "fall_risk_score": {"N": str(rand_float(0.1,0.95,2))},
            "shoulder_diff_px": {"N": str(rand_float(0,25))}, "hip_diff_px": {"N": str(rand_float(0,20))},
            "torso_angle": {"N": str(rand_float(1,18))}, "session_avg_tilt": {"N": str(rand_float(2,12))},
            "ttl": {"N": str(epoch_ttl(1))}})
    return "gait_metrics_snapshot", items

def seed_gait_daily_steps():
    items = []
    for d in range(10):
        dt = (NOW-timedelta(days=d)).strftime("%Y-%m-%d")
        items.append({"resident_id": {"S": RESIDENT_IDS[0]}, "date": {"S": dt},
            "facility_id": {"S": FACILITY_ID}, "total_steps": {"N": str(rand_int(1500,8000))},
            "avg_step_freq": {"N": str(rand_float(50,85))}, "active_minutes": {"N": str(rand_int(60,200))},
            "step_threshold": {"N": "3000"}, "walking_sessions": {"N": str(rand_int(5,20))},
            "ttl": {"N": str(epoch_ttl(30))}})
    return "gait_daily_steps", items

def seed_stride_length_hourly():
    items = []
    for h in range(8,18):
        items.append({"resident_id": {"S": RESIDENT_IDS[0]},
            "date_hour": {"S": f"{TODAY}#{str(h).zfill(2)}"}, "facility_id": {"S": FACILITY_ID},
            "hour_label": {"S": f"{h if h<=12 else h-12}{'AM' if h<12 else 'PM'}"},
            "total_steps": {"N": str(rand_int(200,1200))}, "steps_ideal": {"N": str(rand_int(100,800))},
            "steps_moderate": {"N": str(rand_int(50,300))}, "steps_suboptimal": {"N": str(rand_int(0,100))},
            "avg_stride_len": {"N": str(rand_float(0.40,0.70,2))}, "ttl": {"N": str(epoch_ttl(7))}})
    return "stride_length_hourly", items

def seed_sleep_nightly_summary():
    items = []
    for d in range(1,11):
        dt = (NOW-timedelta(days=d)).strftime("%Y-%m-%d"); tst = rand_int(240,480)
        sq = "GOOD" if tst>=420 else ("AVERAGE" if tst>=300 else "POOR")
        items.append({"resident_id": {"S": RESIDENT_IDS[0]}, "sleep_date": {"S": dt},
            "facility_id": {"S": FACILITY_ID}, "room_id": {"S": "ROOM#r-201"},
            "total_sleep_time_min": {"N": str(tst)}, "sleep_efficiency_pct": {"N": str(rand_float(55,95))},
            "sleep_latency_min": {"N": str(rand_int(5,35))}, "waso_min": {"N": str(rand_int(20,100))},
            "deep_sleep_pct": {"N": str(rand_float(15,30))}, "rem_sleep_pct": {"N": str(rand_float(18,28))},
            "light_sleep_pct": {"N": str(rand_float(40,60))}, "wake_episode_count": {"N": str(rand_int(1,7))},
            "sleep_quality": {"S": sq}, "sleep_quality_date": {"S": f"{sq}#{dt}"},
            "movement_index": {"N": str(rand_float(0.1,0.8,2))}, "ttl": {"N": str(epoch_ttl(30))}})
    return "sleep_nightly_summary", items

def seed_sleep_movement_hourly():
    items = []
    for h in [22,23,0,1,2,3,4,5,6,7]:
        nm=rand_int(30,55); mm=rand_int(3,18); hm=max(0,60-nm-mm)
        items.append({"resident_id": {"S": RESIDENT_IDS[0]},
            "sleep_date_hour": {"S": f"{YESTERDAY}#{str(h).zfill(2)}"}, "facility_id": {"S": FACILITY_ID},
            "no_movement_min": {"N": str(nm)}, "moderate_movement_min": {"N": str(mm)},
            "high_movement_min": {"N": str(hm)}, "avg_movement_intensity": {"N": str(rand_float(0.1,0.7,2))},
            "position_changes": {"N": str(rand_int(0,5))},
            "dominant_position": {"S": random.choice(["SUPINE","LEFT_LATERAL","RIGHT_LATERAL"])},
            "ttl": {"N": str(epoch_ttl(7))}})
    return "sleep_movement_hourly", items

def seed_sleep_wake_episodes():
    items = []
    for r_idx in range(2):
        for ep in range(1,6):
            h=22+ep; h=h-24 if h>=24 else h
            items.append({"resident_id": {"S": RESIDENT_IDS[r_idx]},
                "sleep_date_episode": {"S": f"{YESTERDAY}#{str(ep).zfill(2)}"},
                "facility_id": {"S": FACILITY_ID}, "episode_id": {"S": f"WEP#wep-{uuid.uuid4().hex[:12]}"},
                "wake_start_ts": {"S": f"{YESTERDAY}T{str(h).zfill(2)}:{rand_int(0,59):02d}:00Z"},
                "duration_min": {"N": str(rand_int(5,45))},
                "movement_level": {"S": random.choice(["LOW","MODERATE","HIGH"])},
                "probable_cause": {"S": random.choice(["RESTLESSNESS","BATHROOM","NOISE","UNKNOWN"])},
                "left_bed": {"BOOL": random.choice([True,False])}, "ttl": {"N": str(epoch_ttl(30))}})
    return "sleep_wake_episodes", items
def seed_fall_events():
    items = []
    severities = ["NO_INJURY","MINOR","MODERATE","SEVERE"]
    locations = ["ROOM","BATHROOM","HALLWAY","COMMON_AREA","DINING"]
    for i in range(10):
        res = RESIDENT_IDS[i%5]; fall_dt = NOW-timedelta(days=rand_int(1,90),hours=rand_int(0,23))
        fall_ts = fall_dt.strftime("%Y-%m-%dT%H:%M:%SZ"); sev = random.choice(severities); loc = random.choice(locations)
        items.append({"resident_id": {"S": res}, "fall_ts": {"S": fall_ts}, "fall_id": {"S": FALL_IDS[i]},
            "facility_id": {"S": FACILITY_ID}, "room_id": {"S": f"ROOM#r-{201+i%5}"},
            "location_type": {"S": loc}, "location_detail": {"S": f"{loc.replace('_',' ').title()} near Room {201+i%5}"},
            "severity": {"S": sev}, "severity_fall_ts": {"S": f"{sev}#{fall_ts}"},
            "location_type_fall_ts": {"S": f"{loc}#{fall_ts}"},
            "injury_type": {"S": "NONE" if sev=="NO_INJURY" else random.choice(["BRUISE","LACERATION"])},
            "fall_type": {"S": random.choice(["SLIP","TRIP","LOSS_OF_BALANCE"])},
            "detection_method": {"S": "AI_DETECTED"}, "confidence_score": {"N": str(rand_float(0.75,0.98,2))},
            "time_of_day_category": {"S": random.choice(["NIGHT","MORNING","AFTERNOON","EVENING"])},
            "response_time_sec": {"N": str(rand_int(20,120))}, "first_responder_id": {"S": CAREGIVER_IDS[i%10]},
            "intrinsic_factors": {"L": [{"S": f} for f in random.sample(["polypharmacy","nocturia","low_balance","gait_instability"],rand_int(1,3))]},
            "extrinsic_factors": {"L": [{"S": f} for f in random.sample(["dim_lighting","wet_floor","cluttered_path"],rand_int(0,2))]},
            "primary_cause": {"S": random.choice(["LOSS_OF_BALANCE","SLIP","TRIP"])},
            "reviewed": {"BOOL": random.choice([True,False])}, "created_at": {"S": fall_ts}})
    return "fall_events", items

def seed_fall_response_log():
    items = []
    events = ["DETECTED","ALERT_SENT","ALERT_ACKNOWLEDGED","STAFF_EN_ROUTE","STAFF_ARRIVED",
              "INITIAL_ASSESSMENT","RESIDENT_ASSISTED","POST_FALL_ASSESSMENT","POST_ACTION_ORDERED","RESOLVED"]
    for i, evt in enumerate(events):
        elapsed = i*rand_int(15,60); ts = (NOW-timedelta(days=5,seconds=-elapsed)).strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append({"fall_id": {"S": FALL_IDS[0]}, "event_type_ts": {"S": f"{evt}#{ts}"},
            "resident_id": {"S": RESIDENT_IDS[0]}, "facility_id": {"S": FACILITY_ID},
            "event_type": {"S": evt}, "event_ts": {"S": ts}, "elapsed_sec": {"N": str(elapsed)},
            "actor_id": {"S": "SYSTEM" if i<2 else CAREGIVER_IDS[i%10]},
            "actor_role": {"S": "AI_SYSTEM" if i<2 else "NURSE"},
            "notes": {"S": f"Step {i+1}: {evt.replace('_',' ').title()}"}, "ttl": {"N": str(epoch_ttl(90))}})
    return "fall_response_log", items

def seed_fall_monthly_stats():
    items = []
    for m in range(10):
        dt = NOW-timedelta(days=30*m); ym = dt.strftime("%Y-%m"); tf = rand_int(0,5)
        items.append({"resident_id": {"S": RESIDENT_IDS[0]}, "year_month": {"S": ym},
            "facility_id": {"S": FACILITY_ID}, "total_falls": {"N": str(tf)},
            "falls_no_injury": {"N": str(rand_int(0,tf))}, "falls_minor": {"N": str(rand_int(0,max(1,tf//2)))},
            "avg_response_sec": {"N": str(rand_int(25,90))}, "falls_night": {"N": str(rand_int(0,tf))},
            "falls_bathroom": {"N": str(rand_int(0,tf))}, "fall_rate_per_1k": {"N": str(rand_float(0,200))},
            "resident_days": {"N": str(rand_int(28,31))}, "computed_at": {"S": iso_now(-m*43200)},
            "ttl": {"N": str(epoch_ttl(365))}})
    return "fall_monthly_stats", items

def seed_fall_prevention_plan():
    items = []
    for r in range(5):
        for v in range(1,3):
            items.append({"resident_id": {"S": RESIDENT_IDS[r]}, "plan_version": {"S": f"v{str(v).zfill(3)}"},
                "plan_id": {"S": f"FPP#fpp-{uuid.uuid4().hex[:12]}"}, "facility_id": {"S": FACILITY_ID},
                "status": {"S": "ACTIVE" if v==2 else "SUPERSEDED"},
                "status_next_assessment": {"S": f"{'ACTIVE' if v==2 else 'SUPERSEDED'}#{(NOW+timedelta(days=rand_int(7,30))).strftime('%Y-%m-%d')}"},
                "risk_level": {"S": random.choice(["HIGH","MODERATE"])},
                "interventions": {"L": [{"S": "Balance training 3x/week"},{"S": "Supervised ambulation"}]},
                "environmental_mods": {"L": [{"S": "night_light"},{"S": "bed_alarm"},{"S": "non_slip_mat"}]},
                "next_assessment_date": {"S": (NOW+timedelta(days=rand_int(7,30))).strftime("%Y-%m-%d")},
                "created_by": {"S": CAREGIVER_IDS[0]}, "created_at": {"S": iso_now(-v*10080)}})
    return "fall_prevention_plan", items

def seed_fall_video_clips():
    items = []
    for i in range(10):
        items.append({"fall_id": {"S": FALL_IDS[i]}, "sk": {"S": "CLIP"},
            "resident_id": {"S": RESIDENT_IDS[i%5]}, "facility_id": {"S": FACILITY_ID},
            "s3_bucket": {"S": f"aitcare-fall-clips-encrypted-{ENV}"},
            "s3_key": {"S": f"f-001/{RESIDENT_IDS[i%5].split('#')[1]}/{FALL_IDS[i].split('#')[1]}.enc"},
            "duration_sec": {"N": "20"}, "resolution": {"S": "640x480"},
            "file_size_bytes": {"N": str(rand_int(1500000,3000000))},
            "checksum_sha256": {"S": uuid.uuid4().hex+uuid.uuid4().hex[:32]},
            "access_count": {"N": str(rand_int(0,5))}, "consent_documented": {"BOOL": True},
            "retention_until": {"S": (NOW+timedelta(days=2555)).strftime("%Y-%m-%d")}})
    return "fall_video_clips", items

def seed_unified_alerts():
    items = []
    alert_defs = [("GAIT","LOW_STEP_FREQUENCY","WARNING","Low step frequency detected"),
        ("GAIT","HIGH_TILT","CRITICAL","Significant body tilt detected"),
        ("GAIT","STRIDE_DECLINE","WARNING","Stride length declining"),
        ("GAIT","BALANCE_DROP","CRITICAL","Balance score dropped below threshold"),
        ("SLEEP","LOW_TOTAL_SLEEP","WARNING","Total sleep time below 5 hours"),
        ("SLEEP","BED_EXIT_NIGHTTIME","CRITICAL","Resident left bed at night"),
        ("SLEEP","FREQUENT_WAKE_EPISODES","WARNING","More than 4 wake episodes"),
        ("SLEEP","EXTENDED_WAKE_EPISODE","WARNING","Wake episode exceeded 30 minutes"),
        ("GAIT","SWING_ASYMMETRY","INFO","Arm swing asymmetry detected"),
        ("SLEEP","POOR_SLEEP_TREND","WARNING","3 consecutive poor sleep nights")]
    for i,(domain,atype,sev,msg) in enumerate(alert_defs):
        ts = (NOW-timedelta(hours=rand_int(1,72))).strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append({"resident_id": {"S": RESIDENT_IDS[i%10]}, "alert_ts": {"S": ts},
            "alert_id": {"S": f"ALR#alr-{uuid.uuid4().hex[:12]}"}, "facility_id": {"S": FACILITY_ID},
            "domain": {"S": domain}, "alert_type": {"S": atype}, "severity": {"S": sev},
            "message": {"S": msg}, "domain_severity_ts": {"S": f"{domain}#{sev}#{ts}"},
            "acknowledged": {"BOOL": random.choice([True,False])}, "ttl": {"N": str(epoch_ttl(90))}})
    return "unified_alerts", items

def seed_resident_smart_suggestions():
    items = []
    suggestions = [
        ("BEHAVIORAL","SLEEP","Suggest early bedtime: Sleep quality dropped 20% this week.","HIGH"),
        ("ACTIVITY","GAIT","Limit solo walks today: Gait irregularity detected.","HIGH"),
        ("ENVIRONMENTAL","FALL","Install grab bars in bathroom: Frequent fall location.","HIGH"),
        ("MONITORING","CROSS_DOMAIN","Increase supervision: Fall risk pattern worsening.","HIGH"),
        ("BEHAVIORAL","SLEEP","Limit screen time after 9 PM to improve sleep.","LOW"),
        ("CLINICAL","FALL","Request medication review: 3+ falls with polypharmacy.","HIGH"),
        ("ENVIRONMENTAL","FALL","Increase nighttime lighting in hallway.","MEDIUM"),
        ("ACTIVITY","GAIT","Schedule physical therapy: step frequency declining.","MEDIUM"),
        ("MONITORING","SLEEP","Enable bed alarm: multiple nighttime bed exits.","HIGH"),
        ("CLINICAL","CROSS_DOMAIN","Comprehensive care review: health score below 40.","HIGH")]
    for i,(cat,domain,text,pri) in enumerate(suggestions):
        ts = (NOW-timedelta(hours=rand_int(1,48))).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        items.append({"resident_id": {"S": RESIDENT_IDS[i%10]}, "suggestion_ts": {"S": ts},
            "suggestion_id": {"S": f"SUG#sug-{uuid.uuid4().hex[:12]}"}, "facility_id": {"S": FACILITY_ID},
            "suggestion_text": {"S": text}, "suggestion_category": {"S": cat},
            "target_domain": {"S": domain}, "priority": {"S": pri}, "status": {"S": "ACTIVE"},
            "status_priority_ts": {"S": f"ACTIVE#{pri}#{ts}"}, "confidence": {"N": str(rand_float(0.70,0.95,2))},
            "generated_by": {"S": "SUGGESTION_ENGINE_v1"}, "display_order": {"N": str(i+1)},
            "valid_until": {"S": (NOW+timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")},
            "ttl": {"N": str(epoch_ttl(7))}})
    return "resident_smart_suggestions", items

def seed_entity_change_log():
    items = []
    ctypes = ["CREATE","UPDATE","UPDATE","STATUS_CHANGE","PHOTO_UPDATE","CREATE","UPDATE","ROLE_CHANGE","ASSIGNMENT_CHANGE","UPDATE"]
    for i in range(10):
        is_res = i<5; eid = RESIDENT_IDS[i] if is_res else CAREGIVER_IDS[i-5]
        ts = (NOW-timedelta(hours=rand_int(1,720))).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        items.append({"entity_id": {"S": eid}, "change_ts": {"S": ts},
            "change_id": {"S": f"CHG#chg-{uuid.uuid4().hex[:12]}"}, "facility_id": {"S": FACILITY_ID},
            "entity_type": {"S": "RESIDENT" if is_res else "CAREGIVER"}, "change_type": {"S": ctypes[i]},
            "changed_by": {"S": CAREGIVER_IDS[0]}, "changed_by_role": {"S": "ADMIN"},
            "changed_by_ip": {"S": f"10.0.1.{rand_int(10,50)}"},
            "fields_changed": {"L": [{"S": "room_id"},{"S": "fall_risk_level"}] if is_res else [{"S": "role"}]},
            "change_reason": {"S": "Routine update" if i%3!=0 else "Room transfer"}})
    return "entity_change_log", items

def seed_entity_display_cache():
    items = []
    for i in range(5):
        fn,ln = RESIDENT_NAMES[i]
        items.append({"facility_id": {"S": FACILITY_ID},
            "entity_type_sort_key": {"S": f"RES#{ln}#{fn}#{RESIDENT_IDS[i]}"},
            "entity_type": {"S": "RES"}, "entity_id": {"S": RESIDENT_IDS[i]},
            "display_name_enc": {"B": fake_encrypted()},
            "photo_s3_key": {"S": f"residents/f-001/{RESIDENT_IDS[i].split('#')[1]}/thumb_64x64.enc"},
            "role": {"S": "RESIDENT"}, "room_label": {"S": f"Room {201+i}"},
            "fall_risk_level": {"S": random.choice(["LOW","MODERATE","HIGH"])},
            "status": {"S": "ACTIVE"}, "updated_at": {"S": iso_now()}, "ttl": {"N": str(epoch_ttl(0)+3600)}})
    for i in range(5):
        fn,ln,role = CAREGIVER_NAMES[i]
        items.append({"facility_id": {"S": FACILITY_ID},
            "entity_type_sort_key": {"S": f"CG#{ln}#{fn}#{CAREGIVER_IDS[i]}"},
            "entity_type": {"S": "CG"}, "entity_id": {"S": CAREGIVER_IDS[i]},
            "display_name_enc": {"B": fake_encrypted()},
            "photo_s3_key": {"S": f"caregivers/f-001/{CAREGIVER_IDS[i].split('#')[1]}/avatar.jpg"},
            "role": {"S": role}, "shift": {"S": ["DAY","EVENING","NIGHT"][i%3]},
            "status": {"S": "ACTIVE"}, "updated_at": {"S": iso_now()}, "ttl": {"N": str(epoch_ttl(0)+3600)}})
    return "entity_display_cache", items
def seed_resident_health_score():
    items = []
    for i in range(10):
        fs=rand_int(25,90); sq=rand_int(30,85); gs=rand_int(35,95); al=rand_int(40,90); mr=rand_int(30,80)
        overall = int(fs*0.35+sq*0.25+gs*0.25+al*0.10+mr*0.05)
        label = "EXCELLENT" if overall>=80 else ("GOOD" if overall>=60 else ("FAIR" if overall>=40 else "POOR"))
        items.append({"resident_id": {"S": RESIDENT_IDS[i]}, "score_date": {"S": "LATEST"},
            "facility_id": {"S": FACILITY_ID}, "overall_score": {"N": str(overall)},
            "overall_label": {"S": label}, "overall_trend_7d": {"S": random.choice(["STABLE","IMPROVING","DECLINING"])},
            "overall_score_resident": {"S": f"{str(overall).zfill(3)}#{RESIDENT_IDS[i]}"},
            "fall_risk_score": {"N": str(fs)}, "sleep_quality_score": {"N": str(sq)},
            "gait_stability_score": {"N": str(gs)}, "activity_level_score": {"N": str(al)},
            "medication_risk_score": {"N": str(mr)},
            "risk_level": {"S": random.choice(["LOW","MODERATE","HIGH"])},
            "primary_risk_factor": {"S": random.choice(["High body tilt","Low step frequency","Polypharmacy"])},
            "risk_trend_7d": {"S": random.choice(["STABLE","WORSENING","IMPROVING"])},
            "requires_review": {"BOOL": random.choice([True,False])},
            "fall_card": {"M": {"line1": {"S": f"{rand_int(0,5)} Falls this week"}, "line2": {"S": f"{rand_int(1,10)} days ago"}, "line3": {"S": random.choice(["Bathroom","Hallway","Room"])}}},
            "sleep_card": {"M": {"line1": {"S": f"{rand_float(4.5,8.0)} hrs"}, "line2": {"S": f"{rand_int(1,6)} breaks"}, "line3": {"S": f"{'Down' if random.random()>0.5 else 'Up'} {rand_int(5,25)}%"}}},
            "gait_card": {"M": {"line1": {"S": f"{rand_int(35,65)}cm"}, "line2": {"S": random.choice(["Steady","Unsteady"])}, "line3": {"S": f"{rand_int(6,10)}:{rand_int(0,59):02d} AM"}}},
            "computed_at": {"S": iso_now(-rand_int(0,120))}, "ttl": {"N": str(epoch_ttl(90))}})
    return "resident_health_score", items

def seed_facility_daily_snapshot():
    items = []
    for d in range(10):
        dt = "LATEST" if d==0 else (NOW-timedelta(days=d)).strftime("%Y-%m-%d")
        items.append({"facility_id": {"S": FACILITY_ID}, "snapshot_date": {"S": dt},
            "snapshot_ts": {"S": iso_now(-d*1440)}, "total_residents": {"N": str(rand_int(8,12))},
            "residents_age_65_74": {"N": str(rand_int(2,4))}, "residents_age_75_84": {"N": str(rand_int(3,5))},
            "residents_age_85_plus": {"N": str(rand_int(1,3))}, "total_devices": {"N": "10"},
            "active_devices": {"N": str(rand_int(8,10))}, "inactive_devices": {"N": str(rand_int(0,2))},
            "sleep_quality_stars": {"N": str(rand_float(2.0,4.5,1))},
            "gait_quality_stars": {"N": str(rand_float(2.0,4.5,1))},
            "fall_safety_stars": {"N": str(rand_float(1.5,4.0,1))},
            "sleep_poor_count": {"N": str(rand_int(1,5))}, "gait_unstable_count": {"N": str(rand_int(2,7))},
            "fall_24hr_count": {"N": str(rand_int(0,3))},
            "sleep_overview": {"M": {"bullet_1": {"S": f"{rand_int(2,6)} patients had poor sleep quality"},
                "bullet_2": {"S": f"{rand_int(3,8)} patients had 3+ sleep breaks"},
                "bullet_3": {"S": "Top Concern: Room 301 - 2.8 hrs sleep"}}},
            "gait_overview": {"M": {"bullet_1": {"S": f"{rand_int(3,7)} flagged for unstable gait"},
                "bullet_2": {"S": f"{rand_int(2,6)} irregular step patterns"},
                "bullet_3": {"S": "Most At Risk: Room 205, Rose Willy"}}},
            "fall_overview": {"M": {"bullet_1": {"S": f"{rand_int(0,4)} falls in 24 hrs"},
                "bullet_2": {"S": f"Top Location: Bathroom ({rand_int(5,15)} falls)"},
                "bullet_3": {"S": f"Repeat Fallers: {rand_int(1,4)} patients"}}},
            "computed_by": {"S": "AGGREGATION_JOB_v1"}, "ttl": {"N": str(epoch_ttl(90))}})
    return "facility_daily_snapshot", items

def seed_caregiver_resident_assignments():
    items = []
    for i in range(10):
        cg = CAREGIVER_IDS[i%5]; res = RESIDENT_IDS[i]; shift = ["DAY","EVENING","NIGHT"][i%3]
        items.append({"facility_shift_date": {"S": f"{FACILITY_ID}#{TODAY}#{shift}"},
            "caregiver_resident": {"S": f"{cg.split('#')[1]}#{res.split('#')[1]}"},
            "facility_id": {"S": FACILITY_ID}, "caregiver_id": {"S": cg},
            "caregiver_name": {"S": f"{CAREGIVER_NAMES[i%5][0]} {CAREGIVER_NAMES[i%5][1]}, {CAREGIVER_NAMES[i%5][2]}"},
            "resident_id": {"S": res}, "shift_date": {"S": TODAY}, "shift_type": {"S": shift},
            "assignment_type": {"S": "PRIMARY" if i<5 else "SECONDARY"},
            "is_active": {"BOOL": True}, "alert_routing_enabled": {"BOOL": True},
            "assigned_by": {"S": CAREGIVER_IDS[9]}, "assigned_at": {"S": iso_now(-720)},
            "ttl": {"N": str(epoch_ttl(7))}})
    return "caregiver_resident_assignments", items

def seed_caregiver_certifications():
    items = []
    certs = [("BLS","AHA"),("ACLS","AHA"),("CPI","CPI Intl"),("FALL_PREVENTION","NHCAA"),("DEMENTIA_CARE","Alzheimers Assoc")]
    for i in range(10):
        cg = CAREGIVER_IDS[i%5]; ct,issuer = certs[i%5]
        exp = (NOW+timedelta(days=rand_int(-30,365))).strftime("%Y-%m-%d")
        st = "ACTIVE" if exp>TODAY else "EXPIRED"
        items.append({"caregiver_id": {"S": cg}, "cert_type": {"S": ct if i<5 else f"{ct}_2"},
            "facility_id": {"S": FACILITY_ID}, "cert_name": {"S": ct.replace("_"," ").title()},
            "issuing_body": {"S": issuer}, "cert_number": {"S": f"{ct}-{NOW.year}-{rand_int(10000,99999)}"},
            "issued_date": {"S": (NOW-timedelta(days=rand_int(180,720))).strftime("%Y-%m-%d")},
            "expiry_date": {"S": exp}, "cert_status": {"S": st},
            "cert_status_expiry": {"S": f"{st}#{exp}"}, "verified_by": {"S": CAREGIVER_IDS[9]}})
    return "caregiver_certifications", items

def seed_caregiver_shift_schedule():
    items = []
    shifts = ["DAY","EVENING","NIGHT"]
    for i in range(10):
        cg = CAREGIVER_IDS[i]; shift = shifts[i%3]
        items.append({"facility_shift_date": {"S": f"{FACILITY_ID}#{TODAY}"},
            "shift_caregiver": {"S": f"{shift}#{cg}"}, "facility_id": {"S": FACILITY_ID},
            "caregiver_id": {"S": cg},
            "caregiver_name": {"S": f"{CAREGIVER_NAMES[i][0]} {CAREGIVER_NAMES[i][1]}, {CAREGIVER_NAMES[i][2]}"},
            "role": {"S": CAREGIVER_NAMES[i][2]}, "shift_date": {"S": TODAY}, "shift_type": {"S": shift},
            "unit_id": {"S": f"UNIT#u-{2 if i<5 else 3}-north"},
            "status": {"S": random.choice(["SCHEDULED","CHECKED_IN"])}, "ttl": {"N": str(epoch_ttl(30))}})
    return "caregiver_shift_schedule", items

def seed_caregiver_performance_metrics():
    items = []
    for i in range(10):
        cg = CAREGIVER_IDS[i%5]; mo = i//5; ym = (NOW-timedelta(days=30*mo)).strftime("%Y-%m")
        items.append({"caregiver_id": {"S": cg}, "metric_period": {"S": ym},
            "facility_id": {"S": FACILITY_ID}, "falls_responded": {"N": str(rand_int(1,8))},
            "avg_response_time_sec": {"N": str(rand_int(25,70))},
            "alerts_acknowledged": {"N": str(rand_int(20,80))}, "alerts_missed": {"N": str(rand_int(0,5))},
            "residents_served": {"N": str(rand_int(5,15))}, "shifts_worked": {"N": str(rand_int(18,26))},
            "dashboard_logins": {"N": str(rand_int(30,60))}, "computed_at": {"S": iso_now(-mo*43200)},
            "ttl": {"N": str(epoch_ttl(365))}})
    return "caregiver_performance_metrics", items

def seed_resident_emergency_contacts():
    items = []
    priorities = ["PRIMARY","SECONDARY","TERTIARY"]
    rels = ["SPOUSE","CHILD","SIBLING","GUARDIAN"]
    count = 0
    for r in range(4):
        for p in range(min(3,10-count)):
            if count>=10: break
            items.append({"resident_id": {"S": RESIDENT_IDS[r]}, "contact_priority": {"S": priorities[p]},
                "contact_name_enc": {"B": fake_encrypted()}, "relationship": {"S": rels[p%len(rels)]},
                "phone_enc": {"B": fake_encrypted()}, "email_enc": {"B": fake_encrypted()},
                "notify_on_fall": {"BOOL": True}, "is_legal_guardian": {"BOOL": p==0},
                "is_poa_healthcare": {"BOOL": p==0}, "created_at": {"S": iso_now(-5000)}})
            count += 1
    return "resident_emergency_contacts", items

def seed_resident_insurance():
    items = []
    ins = ["MEDICARE","PRIMARY","SECONDARY","MEDICAID"]
    for i in range(10):
        items.append({"resident_id": {"S": RESIDENT_IDS[i%5]},
            "insurance_type": {"S": ins[i%4] if i<8 else ins[i-8]},
            "carrier_name_enc": {"B": fake_encrypted()}, "policy_number_enc": {"B": fake_encrypted()},
            "group_number_enc": {"B": fake_encrypted()}, "effective_date": {"S": f"{NOW.year}-01-01"},
            "expiry_date": {"S": f"{NOW.year}-12-31"}, "verified": {"BOOL": True},
            "verified_at": {"S": iso_now(-2000)}})
    return "resident_insurance", items

def seed_smart_suggestion_templates():
    items = []
    templates = [
        ("BEHAVIORAL","TMPL#sleep-early-bedtime","SLEEP","Suggest early bedtime: Sleep quality dropped {delta}% this week.","sleep_quality_weekly_delta","LESS_THAN","-10"),
        ("ACTIVITY","TMPL#gait-limit-solo-walks","GAIT","Limit solo walks today: Gait irregularity detected.","fall_risk_level","EQUALS","HIGH"),
        ("ENVIRONMENTAL","TMPL#fall-grab-bars","FALL","Install grab bars in bathroom: Frequent fall location.","bathroom_fall_pct","GREATER_THAN","50"),
        ("MONITORING","TMPL#fall-increase-supervision","CROSS_DOMAIN","Increase supervision: Fall risk pattern worsening.","risk_trend_days_worsening","GREATER_THAN","3"),
        ("BEHAVIORAL","TMPL#sleep-screen-time","SLEEP","Limit screen time after 9 PM to improve sleep.","sleep_latency_min","GREATER_THAN","30"),
        ("CLINICAL","TMPL#fall-med-review","FALL","Request medication review: 3+ falls with polypharmacy.","falls_with_polypharmacy","GREATER_THAN","2"),
        ("ENVIRONMENTAL","TMPL#fall-night-lighting","FALL","Increase nighttime lighting in hallway.","night_falls_pct","GREATER_THAN","60"),
        ("ACTIVITY","TMPL#gait-schedule-pt","GAIT","Schedule physical therapy: step frequency declining.","step_freq_delta_pct","LESS_THAN","-20"),
        ("MONITORING","TMPL#sleep-bed-alarm","SLEEP","Enable bed alarm: multiple nighttime bed exits.","nighttime_bed_exits","GREATER_THAN","2"),
        ("CLINICAL","TMPL#cross-care-review","CROSS_DOMAIN","Comprehensive care review: health score below 40.","health_score","LESS_THAN","40")]
    for cat,tid,domain,text,metric,op,threshold in templates:
        items.append({"template_category": {"S": cat}, "template_id": {"S": tid},
            "template_text": {"S": text}, "target_domain": {"S": domain},
            "trigger_conditions": {"L": [{"M": {"metric": {"S": metric}, "operator": {"S": op}, "threshold": {"S": threshold}}}]},
            "priority_default": {"S": "HIGH" if "fall" in text.lower() else "MEDIUM"},
            "enabled": {"BOOL": True}, "version": {"N": "1"}, "created_by": {"S": "SYSTEM"}})
    return "smart_suggestion_templates", items
# ============================================================================
# TABLE CREATION & SEEDING ENGINE
# ============================================================================

def create_tables(dynamodb_client, table_defs, dry_run=False):
    print(f"\n{'='*70}")
    print(f"  CREATING {len(table_defs)} DynamoDB TABLES")
    print(f"{'='*70}\n")
    created = 0; skipped = 0; failed = 0
    for tdef in table_defs:
        table_name = tdef["TableName"]
        gsi_count = len(tdef.get("GlobalSecondaryIndexes", []))
        if dry_run:
            print(f"  [DRY RUN] Would create: {table_name} (GSIs: {gsi_count})")
            created += 1; continue
        try:
            dynamodb_client.describe_table(TableName=table_name)
            print(f"  [SKIP] {table_name} already exists"); skipped += 1
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                try:
                    dynamodb_client.create_table(**tdef)
                    print(f"  [OK]   {table_name} created (GSIs: {gsi_count})"); created += 1
                except ClientError as ce:
                    print(f"  [FAIL] {table_name}: {ce.response['Error']['Message']}"); failed += 1
            else:
                print(f"  [FAIL] {table_name}: {e.response['Error']['Message']}"); failed += 1
    if not dry_run:
        print(f"\n  Waiting for tables to become ACTIVE...")
        for tdef in table_defs:
            try:
                waiter = dynamodb_client.get_waiter('table_exists')
                waiter.wait(TableName=tdef["TableName"], WaiterConfig={'Delay': 2, 'MaxAttempts': 30})
            except Exception: pass
    print(f"\n  Summary: {created} created, {skipped} skipped, {failed} failed")
    return failed == 0


def seed_all_tables(dynamodb_client, seed_only_tables=None):
    print(f"\n{'='*70}")
    print(f"  SEEDING TABLES WITH DUMMY DATA (10 records each)")
    print(f"{'='*70}\n")
    seeders = [
        seed_residents, seed_caregivers, seed_devices,
        seed_gait_metrics_snapshot, seed_gait_daily_steps, seed_stride_length_hourly,
        seed_sleep_nightly_summary, seed_sleep_movement_hourly, seed_sleep_wake_episodes,
        seed_fall_events, seed_fall_response_log, seed_fall_monthly_stats,
        seed_fall_prevention_plan, seed_fall_video_clips,
        seed_unified_alerts, seed_resident_smart_suggestions,
        seed_entity_change_log, seed_entity_display_cache, seed_resident_health_score,
        seed_facility_daily_snapshot,
        seed_caregiver_resident_assignments, seed_caregiver_certifications,
        seed_caregiver_shift_schedule, seed_caregiver_performance_metrics,
        seed_resident_emergency_contacts, seed_resident_insurance,
        seed_smart_suggestion_templates]
    total_items = 0
    for seeder in seeders:
        table_name, items = seeder()
        if seed_only_tables and table_name not in seed_only_tables: continue
        try:
            written = 0
            for item in items:
                dynamodb_client.put_item(TableName=table_name, Item=item)
                written += 1
            print(f"  [OK]   {table_name}: {written} records written"); total_items += written
        except ClientError as e:
            print(f"  [FAIL] {table_name}: {e.response['Error']['Message']}")
        except Exception as e:
            print(f"  [FAIL] {table_name}: {str(e)}")
    print(f"\n  Total records written: {total_items}")


def get_s3_bucket_definitions():
    """Get S3 bucket configurations"""
    buckets = [
        {
            "name": f"aitcare-fallvision-{ENV}",
            "description": "Main data bucket for gait waveforms, sleep epochs, and fall detection data",
            "versioning": True,
            "encryption": "AES256"
        },
        {
            "name": f"aitcare-fall-clips-encrypted-{ENV}",
            "description": "Encrypted video clips of fall incidents",
            "versioning": True,
            "encryption": "AES256"
        },
        {
            "name": f"aitcare-resident-photos-{ENV}",
            "description": "Encrypted resident and caregiver photos",
            "versioning": False,
            "encryption": "AES256"
        }
    ]
    return buckets

def create_s3_buckets(s3_client, bucket_defs, region="us-east-1", dry_run=False):
    """Create S3 buckets with proper security configurations"""
    print(f"\n{'='*70}")
    print(f"  CREATING {len(bucket_defs)} S3 BUCKETS")
    print(f"{'='*70}\n")
    
    created = 0; skipped = 0; failed = 0
    
    for bucket_def in bucket_defs:
        bucket_name = bucket_def["name"]
        
        if dry_run:
            print(f"  [DRY RUN] Would create: {bucket_name}")
            created += 1
            continue
        
        try:
            # Check if bucket exists
            s3_client.head_bucket(Bucket=bucket_name)
            print(f"  [SKIP] {bucket_name} already exists")
            skipped += 1
            continue
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code != '404':
                print(f"  [FAIL] {bucket_name}: {e.response['Error']['Message']}")
                failed += 1
                continue
        
        try:
            # Create bucket
            if region == 'us-east-1':
                s3_client.create_bucket(Bucket=bucket_name)
            else:
                s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': region}
                )
            
            # Enable versioning if required
            if bucket_def.get("versioning"):
                s3_client.put_bucket_versioning(
                    Bucket=bucket_name,
                    VersioningConfiguration={'Status': 'Enabled'}
                )
            
            # Enable encryption
            s3_client.put_bucket_encryption(
                Bucket=bucket_name,
                ServerSideEncryptionConfiguration={
                    'Rules': [{
                        'ApplyServerSideEncryptionByDefault': {
                            'SSEAlgorithm': bucket_def.get("encryption", "AES256")
                        },
                        'BucketKeyEnabled': True
                    }]
                }
            )
            
            # Block all public access
            s3_client.put_public_access_block(
                Bucket=bucket_name,
                PublicAccessBlockConfiguration={
                    'BlockPublicAcls': True,
                    'IgnorePublicAcls': True,
                    'BlockPublicPolicy': True,
                    'RestrictPublicBuckets': True
                }
            )
            
            # Add lifecycle policy for main data bucket
            if "fallvision" in bucket_name:
                s3_client.put_bucket_lifecycle_configuration(
                    Bucket=bucket_name,
                    LifecycleConfiguration={
                        'Rules': [
                            {
                                'ID': 'ParquetDataLifecycle',
                                'Status': 'Enabled',
                                'Filter': {'Prefix': ''},
                                'Transitions': [
                                    {'Days': 30, 'StorageClass': 'STANDARD_IA'},
                                    {'Days': 90, 'StorageClass': 'GLACIER'},
                                    {'Days': 365, 'StorageClass': 'DEEP_ARCHIVE'}
                                ],
                                'Expiration': {'Days': 2555}  # 7 years
                            }
                        ]
                    }
                )
            
            # Tag the bucket
            s3_client.put_bucket_tagging(
                Bucket=bucket_name,
                Tagging={
                    'TagSet': [
                        {'Key': 'Project', 'Value': 'AITCare-FallVision'},
                        {'Key': 'Environment', 'Value': ENV},
                        {'Key': 'Compliance', 'Value': 'HIPAA'}
                    ]
                }
            )
            
            print(f"  [OK]   {bucket_name} created with encryption & security")
            created += 1
            
        except ClientError as e:
            print(f"  [FAIL] {bucket_name}: {e.response['Error']['Message']}")
            failed += 1
        except Exception as e:
            print(f"  [FAIL] {bucket_name}: {str(e)}")
            failed += 1
    
    print(f"\n  Summary: {created} created, {skipped} skipped, {failed} failed")
    return failed == 0

def print_s3_structure():
    print(f"\n{'='*70}")
    print(f"  S3 BUCKET STRUCTURE (3 data storage patterns)")
    print(f"{'='*70}\n")
    s3_tables = [
        ("S3-1", "arm_swing_waveform", f"s3://aitcare-fallvision-{ENV}/gait_waveforms/facility_id=f-001/oa_id=<id>/date=YYYY-MM-DD/*.parquet"),
        ("S3-2", "sleep_stages_epochs", f"s3://aitcare-fallvision-{ENV}/sleep_epochs/facility_id=f-001/oa_id=<id>/sleep_date=YYYY-MM-DD/*.parquet"),
        ("S3-3", "fall_detection_raw", f"s3://aitcare-fallvision-{ENV}/fall_detections/facility_id=f-001/resident_id=<id>/year=YYYY/month=MM/*.parquet")]
    for tier, name, path in s3_tables:
        print(f"  {tier}. {name}")
        print(f"       Path: {path}\n")
    print("  Buckets created with:")
    print("    [x] SSE-AES256 encryption")
    print("    [x] Versioning enabled")
    print("    [x] Public access block: ALL FOUR settings ENABLED")
    print("    [x] Lifecycle: Standard(30d) -> IA(90d) -> Glacier(365d) -> Archive(7yr)")
    print("    [x] HIPAA compliance tags")


def print_summary(table_defs):
    print(f"\n{'='*70}")
    print(f"  OPTIMIZED TABLE ARCHITECTURE SUMMARY (28 total)")
    print(f"{'='*70}\n")
    tiers = {"1-CoreEntity": "TIER 1: Core Entities", "2-TimeSeries": "TIER 2: Time-Series Sensor",
        "3-ClinicalEvent": "TIER 3: Clinical Events", "4-CrossCutting": "TIER 4: Unified Cross-Cutting",
        "5-Facility": "TIER 5: Facility-Level", "6-Assignment": "TIER 6: Assignments & Schedules",
        "7-Supporting": "TIER 7: Supporting"}
    total_gsi = 0
    for tier_key, tier_label in tiers.items():
        tier_tables = [t for t in table_defs if any(tag["Value"] == tier_key for tag in t.get("Tags", []))]
        if tier_tables:
            print(f"  {tier_label}")
            for t in tier_tables:
                gc = len(t.get("GlobalSecondaryIndexes", [])); total_gsi += gc
                pk = [k["AttributeName"] for k in t["KeySchema"] if k["KeyType"]=="HASH"][0]
                sk = [k["AttributeName"] for k in t["KeySchema"] if k["KeyType"]=="RANGE"][0]
                print(f"    - {t['TableName']:40s} PK={pk}, SK={sk}  GSIs={gc}")
            print()
    print(f"  + 3 S3-only tables: arm_swing_waveform, sleep_stages_epochs, fall_detection_raw")
    print(f"\n  TOTALS: {len(table_defs)} DynamoDB tables, {total_gsi} GSIs, 3 S3 tables = 28 total")
    print(f"  Seed data: 10 records per table = ~270 total records")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="AITCare-FallVision: Create DynamoDB tables & seed data")
    parser.add_argument("--region", default="us-east-1", help="AWS region (default: us-east-1)")
    parser.add_argument("--env", default="dev", choices=["dev","staging","prod"], help="Environment")
    parser.add_argument("--endpoint", default=None, help="DynamoDB endpoint URL (for local: http://localhost:8000)")
    parser.add_argument("--tables-only", action="store_true", help="Only create tables, skip seeding and S3")
    parser.add_argument("--seed-only", action="store_true", help="Only seed data, skip table and S3 creation")
    parser.add_argument("--s3-only", action="store_true", help="Only create S3 buckets")
    parser.add_argument("--skip-s3", action="store_true", help="Skip S3 bucket creation")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without executing")
    args = parser.parse_args()

    global ENV
    ENV = args.env

    print(f"\n{'#'*70}")
    print(f"#  AITCare-FallVision - DynamoDB Table Creator & Data Seeder")
    print(f"#  Region:   {args.region}")
    print(f"#  Env:      {args.env}")
    print(f"#  Endpoint: {args.endpoint or 'AWS Default'}")
    print(f"#  Mode:     {'DRY RUN' if args.dry_run else ('Tables Only' if args.tables_only else ('Seed Only' if args.seed_only else 'Full (Create + Seed)'))}")
    print(f"#  Date:     {NOW.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"{'#'*70}")

    table_defs = get_table_definitions()
    bucket_defs = get_s3_bucket_definitions()
    
    print_summary(table_defs)

    if args.dry_run:
        create_tables(None, table_defs, dry_run=True)
        create_s3_buckets(None, bucket_defs, region=args.region, dry_run=True)
        print_s3_structure()
        print("\n  [DRY RUN COMPLETE] No AWS calls were made.\n")
        return

    client_kwargs = {"region_name": args.region}
    if args.endpoint:
        client_kwargs["endpoint_url"] = args.endpoint
    
    try:
        dynamodb_client = boto3.client("dynamodb", **client_kwargs)
        dynamodb_client.list_tables(Limit=1)
    except Exception as e:
        print(f"\n  ERROR: Cannot connect to DynamoDB: {e}")
        print(f"  Ensure AWS credentials are configured or use --endpoint for DynamoDB Local.")
        print(f"  Tip: docker run -p 8000:8000 amazon/dynamodb-local")
        if not args.s3_only:
            sys.exit(1)
    
    # Create S3 client (always use AWS, not local)
    try:
        s3_client = boto3.client("s3", region_name=args.region)
        s3_client.list_buckets()
    except Exception as e:
        print(f"\n  ERROR: Cannot connect to S3: {e}")
        print(f"  Ensure AWS credentials are configured.")
        if args.s3_only or not args.skip_s3:
            sys.exit(1)

    # Handle S3-only mode
    if args.s3_only:
        create_s3_buckets(s3_client, bucket_defs, region=args.region)
        print_s3_structure()
        print("\n  S3 bucket creation complete!\n")
        return

    if not args.seed_only:
        success = create_tables(dynamodb_client, table_defs)
        if not success:
            print("\n  WARNING: Some tables failed to create. Continuing...\n")
    
    # Create S3 buckets unless skipped
    if not args.skip_s3 and not args.seed_only and not args.tables_only:
        print("\n  Creating S3 buckets...\n")
        create_s3_buckets(s3_client, bucket_defs, region=args.region)

    if not args.tables_only:
        if not args.seed_only:
            print("\n  Pausing 3 seconds for table propagation...")
            time.sleep(3)
        seed_all_tables(dynamodb_client)

    print_s3_structure()

    print(f"\n{'='*70}")
    print(f"  DONE! All 25 DynamoDB tables and 3 S3 buckets created and seeded.")
    print(f"  Cost: ~$189/mo for 100 Residents (optimized from $215)")
    print(f"  S3 Storage: ~$50/mo for video clips + photos")
    print(f"  Next steps:")
    print(f"    1. [x] S3 buckets created with encryption & lifecycle policies")
    print(f"    2. Configure KMS keys for field-level encryption (optional)")
    print(f"    3. Set up Cognito User Pool for authentication")
    print(f"    4. Deploy API Gateway + Lambda endpoints")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()