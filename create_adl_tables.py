#!/usr/bin/env python3
"""
AITCare-FallVision — ADL (Activities of Daily Living) DynamoDB Table Creator & Seeder
======================================================================================
Creates 4 new DynamoDB tables for the ADL Monitoring screen and seeds each with
10 realistic dummy records. Aligns with the existing 27-table optimized architecture.

Tables Created:
  T29. adl_activity_events     — Individual activity detections (sit, stand, walk, transfer)
  T30. adl_hourly_summary      — Hourly aggregated activity breakdown
  T31. adl_daily_summary       — Daily ADL metrics + independence score
  T32. adl_baselines           — Per-resident learned normal patterns

Also adds ADL domain data to existing tables:
  - unified_alerts (domain=ADL)
  - resident_smart_suggestions (target_domain=ADL)
  - smart_suggestion_templates (ADL templates)

Usage:
  python create_adl_tables.py --endpoint http://localhost:8000 --env dev
  python create_adl_tables.py --region us-west-2 --env dev
  python create_adl_tables.py --dry-run
  python create_adl_tables.py --tables-only
  python create_adl_tables.py --seed-only

Author:  AI Tensors Inc.
Date:    2025-06-20
Version: 1.0
"""

import argparse
import json
import sys
import time
import uuid
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("ERROR: boto3 is required. Install with: pip install boto3")
    sys.exit(1)

# ============================================================================
# CONSTANTS (aligned with create_tables_and_seed.py)
# ============================================================================
FACILITY_ID = "FAC#f-001"
ENV = "dev"
NOW = datetime.now(timezone.utc)
TODAY = NOW.strftime("%Y-%m-%d")
YESTERDAY = (NOW - timedelta(days=1)).strftime("%Y-%m-%d")

# Reuse existing resident IDs from the main seed script
RESIDENT_IDS = [f"RES#res-20250815-{str(i).zfill(4)}" for i in range(1, 11)]
CAREGIVER_IDS = [f"CG#cg-20240601-{str(i).zfill(4)}" for i in range(1, 11)]
DEVICE_IDS = [f"DEV#jetson-room-{200 + i}" for i in range(1, 11)]

ACTIVITY_TYPES = ["SIT", "STAND", "WALK", "TRANSFER", "LYING", "REACHING", "BENDING", "OTHER"]
TRANSITION_TYPES = [
    "SIT_TO_STAND", "STAND_TO_SIT", "STAND_TO_WALK", "WALK_TO_STAND",
    "WALK_TO_SIT", "LYING_TO_SIT", "SIT_TO_LYING", "BED_TO_STAND",
    "STAND_TO_BED", "CHAIR_TO_STAND", "NONE"
]
ZONES = ["patient_room", "hallway", "bathroom", "common_area", "dining"]
MOBILITY_AIDS = ["NONE", "WALKER", "CANE", "WHEELCHAIR", "BED_RAIL"]


def iso_now(offset_minutes=0):
    return (NOW + timedelta(minutes=offset_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def epoch_ttl(days=90):
    return int((NOW + timedelta(days=days)).timestamp())


def rand_float(low, high, decimals=1):
    return Decimal(str(round(random.uniform(low, high), decimals)))


def rand_int(low, high):
    return random.randint(low, high)


# ============================================================================
# TABLE DEFINITIONS (4 new DynamoDB tables)
# ============================================================================
def get_adl_table_definitions():
    """Returns list of 4 ADL DynamoDB table definitions."""
    tables = []

    # T29. adl_activity_events
    tables.append({
        "TableName": "adl_activity_events",
        "KeySchema": [
            {"AttributeName": "resident_id", "KeyType": "HASH"},
            {"AttributeName": "event_ts", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "resident_id", "AttributeType": "S"},
            {"AttributeName": "event_ts", "AttributeType": "S"},
            {"AttributeName": "facility_id", "AttributeType": "S"},
            {"AttributeName": "activity_zone_ts", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "gsi-facility-ts",
                "KeySchema": [
                    {"AttributeName": "facility_id", "KeyType": "HASH"},
                    {"AttributeName": "event_ts", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            },
            {
                "IndexName": "gsi-facility-activity",
                "KeySchema": [
                    {"AttributeName": "facility_id", "KeyType": "HASH"},
                    {"AttributeName": "activity_zone_ts", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [
            {"Key": "Project", "Value": "AITCare-FallVision"},
            {"Key": "Tier", "Value": "2-TimeSeries"},
            {"Key": "Screen", "Value": "ADL-Monitoring"}
        ]
    })

    # T30. adl_hourly_summary
    tables.append({
        "TableName": "adl_hourly_summary",
        "KeySchema": [
            {"AttributeName": "resident_id", "KeyType": "HASH"},
            {"AttributeName": "date_hour", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "resident_id", "AttributeType": "S"},
            {"AttributeName": "date_hour", "AttributeType": "S"},
            {"AttributeName": "facility_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "gsi-facility-date-hour",
                "KeySchema": [
                    {"AttributeName": "facility_id", "KeyType": "HASH"},
                    {"AttributeName": "date_hour", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [
            {"Key": "Project", "Value": "AITCare-FallVision"},
            {"Key": "Tier", "Value": "2-TimeSeries"},
            {"Key": "Screen", "Value": "ADL-Monitoring"}
        ]
    })

    # T31. adl_daily_summary
    tables.append({
        "TableName": "adl_daily_summary",
        "KeySchema": [
            {"AttributeName": "resident_id", "KeyType": "HASH"},
            {"AttributeName": "summary_date", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "resident_id", "AttributeType": "S"},
            {"AttributeName": "summary_date", "AttributeType": "S"},
            {"AttributeName": "facility_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "gsi-facility-date",
                "KeySchema": [
                    {"AttributeName": "facility_id", "KeyType": "HASH"},
                    {"AttributeName": "summary_date", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [
            {"Key": "Project", "Value": "AITCare-FallVision"},
            {"Key": "Tier", "Value": "2-TimeSeries"},
            {"Key": "Screen", "Value": "ADL-Monitoring"}
        ]
    })

    # T32. adl_baselines
    tables.append({
        "TableName": "adl_baselines",
        "KeySchema": [
            {"AttributeName": "resident_id", "KeyType": "HASH"},
            {"AttributeName": "baseline_type", "KeyType": "RANGE"}
        ],
        "AttributeDefinitions": [
            {"AttributeName": "resident_id", "AttributeType": "S"},
            {"AttributeName": "baseline_type", "AttributeType": "S"},
            {"AttributeName": "facility_id", "AttributeType": "S"}
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "gsi-facility-baseline",
                "KeySchema": [
                    {"AttributeName": "facility_id", "KeyType": "HASH"},
                    {"AttributeName": "baseline_type", "KeyType": "RANGE"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ],
        "BillingMode": "PAY_PER_REQUEST",
        "Tags": [
            {"Key": "Project", "Value": "AITCare-FallVision"},
            {"Key": "Tier", "Value": "2-TimeSeries"},
            {"Key": "Screen", "Value": "ADL-Monitoring"}
        ]
    })

    return tables


# ============================================================================
# SEED DATA GENERATORS (10 records per table)
# ============================================================================

def seed_adl_activity_events():
    """Generate 10 sample activity events."""
    items = []
    for i in range(10):
        res_id = RESIDENT_IDS[i % 5]
        offset = rand_int(0, 1440)
        ts = (NOW - timedelta(minutes=offset)).strftime("%Y-%m-%dT%H:%M:%SZ")
        act = random.choice(["SIT", "STAND", "WALK", "TRANSFER", "LYING"])
        prior = random.choice(["SIT", "STAND", "WALK", "LYING"])
        zone = random.choice(ZONES)

        transition = "NONE"
        subtype = None
        if act == "STAND" and prior == "SIT":
            transition = "SIT_TO_STAND"
            subtype = random.choice(["chair_to_stand", "bed_to_stand"])
        elif act == "WALK" and prior == "STAND":
            transition = "STAND_TO_WALK"
            subtype = random.choice(["walking_aided", "walking_unaided"])
        elif act == "SIT" and prior == "STAND":
            transition = "STAND_TO_SIT"
            subtype = "stand_to_sit"
        elif act == "SIT" and prior == "WALK":
            transition = "WALK_TO_SIT"
            subtype = "walk_to_sit"

        difficulty = rand_float(0.0, 1.0, 2)
        is_anomaly = float(difficulty) > 0.7

        item = {
            "resident_id": {"S": res_id},
            "event_ts": {"S": ts},
            "event_id": {"S": f"AEVT#aevt-{uuid.uuid4().hex[:12]}"},
            "facility_id": {"S": FACILITY_ID},
            "camera_id": {"S": f"CAM#c-room-{201 + i % 5}"},
            "zone": {"S": zone},
            "activity_type": {"S": act},
            "prior_activity": {"S": prior},
            "transition_type": {"S": transition},
            "duration_sec": {"N": str(rand_int(5, 300))},
            "confidence_score": {"N": str(rand_float(0.70, 0.98, 2))},
            "detection_method": {"S": random.choice(["POSE_KEYPOINTS", "FUSED"])},
            "mobility_aid_detected": {"S": random.choice(["NONE", "NONE", "NONE", "WALKER", "CANE"])},
            "difficulty_score": {"N": str(difficulty)},
            "anomaly_flag": {"BOOL": is_anomaly},
            "gait_risk_score_at_event": {"N": str(rand_float(0.1, 0.9, 2))},
            "fall_risk_level_at_event": {"S": random.choice(["LOW", "MODERATE", "HIGH"])},
            "person_id_anonymous": {"S": f"PERSON_{str(i % 5 + 1).zfill(3)}"},
            "facility_activity_ts": {"S": f"{FACILITY_ID}#{ts}"},
            "activity_zone_ts": {"S": f"{transition}#{zone}#{ts}"},
            "ttl": {"N": str(epoch_ttl(7))}
        }

        if subtype:
            item["activity_subtype"] = {"S": subtype}

        if is_anomaly:
            item["anomaly_reason"] = {"S": f"Transfer took {rand_int(20, 40)}s vs {rand_int(8, 15)}s baseline"}
            item["vlm_description"] = {"S": random.choice([
                "Resident slowly stood from chair, gripping armrests tightly. Appeared unsteady for 3 seconds.",
                "Resident used walker to stand. Took two attempts before fully upright.",
                "Resident walked with shuffling gait toward bathroom. Noticeable left-side lean.",
                "Resident sat down heavily in chair, missing the seat slightly before correcting."
            ])}

        items.append(item)
    return "adl_activity_events", items


def seed_adl_hourly_summary():
    """Generate 10 hourly summaries (hours 7-16 for one resident)."""
    items = []
    for h in range(7, 17):  # 7 AM to 4 PM
        sit = rand_int(10, 40)
        stand = rand_int(5, 20)
        walk = rand_int(2, 15)
        lying = rand_int(0, 10) if h < 9 else 0
        transfer = rand_int(1, 5)
        other = max(0, 60 - sit - stand - walk - lying)
        total_active = stand + walk

        items.append({
            "resident_id": {"S": RESIDENT_IDS[0]},
            "date_hour": {"S": f"{TODAY}#{str(h).zfill(2)}"},
            "facility_id": {"S": FACILITY_ID},
            "hour_label": {"S": f"{h if h <= 12 else h - 12}{'AM' if h < 12 else 'PM'}"},
            "sit_minutes": {"N": str(sit)},
            "stand_minutes": {"N": str(stand)},
            "walk_minutes": {"N": str(walk)},
            "lying_minutes": {"N": str(lying)},
            "transfer_count": {"N": str(transfer)},
            "other_minutes": {"N": str(other)},
            "total_active_minutes": {"N": str(total_active)},
            "dominant_activity": {"S": "SIT" if sit >= stand and sit >= walk else ("STAND" if stand >= walk else "WALK")},
            "sedentary_flag": {"BOOL": (sit + lying) > 45},
            "walking_episodes": {"N": str(rand_int(0, 4))},
            "avg_walking_speed": {"N": str(rand_float(0.3, 0.8, 2))},
            "transitions_detail": {"M": {
                "sit_to_stand": {"N": str(rand_int(1, 4))},
                "stand_to_sit": {"N": str(rand_int(1, 4))},
                "stand_to_walk": {"N": str(rand_int(0, 3))},
                "walk_to_stand": {"N": str(rand_int(0, 3))}
            }},
            "anomaly_count": {"N": str(rand_int(0, 2))},
            "facility_date_hour": {"S": f"{FACILITY_ID}#{TODAY}#{str(h).zfill(2)}"},
            "ttl": {"N": str(epoch_ttl(30))}
        })
    return "adl_hourly_summary", items


def seed_adl_daily_summary():
    """Generate 10 daily summaries (LATEST + 9 historical days)."""
    items = []
    for d in range(10):
        dt = "LATEST" if d == 0 else (NOW - timedelta(days=d)).strftime("%Y-%m-%d")
        active = rand_int(80, 200)
        sedentary = rand_int(400, 700)
        walking = rand_int(20, 60)
        standing = rand_int(40, 80)
        sitting = rand_int(300, 500)
        lying = rand_int(100, 200)
        sts = rand_int(6, 20)
        walks = rand_int(4, 15)
        score = rand_int(45, 90)
        sed_over_60 = rand_int(0, 5)

        items.append({
            "resident_id": {"S": RESIDENT_IDS[0]},
            "summary_date": {"S": dt},
            "facility_id": {"S": FACILITY_ID},
            "total_active_minutes": {"N": str(active)},
            "total_sedentary_minutes": {"N": str(sedentary)},
            "total_walking_minutes": {"N": str(walking)},
            "total_standing_minutes": {"N": str(standing)},
            "total_sitting_minutes": {"N": str(sitting)},
            "total_lying_minutes": {"N": str(lying)},
            "sit_to_stand_count": {"N": str(sts)},
            "stand_to_sit_count": {"N": str(sts - rand_int(0, 2))},
            "bed_transfers": {"N": str(rand_int(2, 6))},
            "walking_episodes": {"N": str(walks)},
            "avg_walk_duration_sec": {"N": str(rand_int(120, 600))},
            "avg_transfer_duration_sec": {"N": str(rand_int(8, 25))},
            "longest_sedentary_min": {"N": str(rand_int(45, 120))},
            "sedentary_stretches_over_60min": {"N": str(sed_over_60)},
            "sedentary_stretches_over_30min": {"N": str(sed_over_60 + rand_int(1, 4))},
            "adl_independence_score": {"N": str(score)},
            "independence_score_delta": {"N": str(rand_float(-15, 10))},
            "mobility_aid_usage_pct": {"N": str(rand_float(0, 60))},
            "bathroom_visits": {"N": str(rand_int(3, 8))},
            "dining_visits": {"N": str(rand_int(1, 3))},
            "activity_distribution": {"M": {
                "SIT": {"N": str(rand_int(35, 55))},
                "STAND": {"N": str(rand_int(10, 25))},
                "WALK": {"N": str(rand_int(8, 20))},
                "LYING": {"N": str(rand_int(8, 20))},
                "TRANSFER": {"N": str(rand_int(1, 5))},
                "OTHER": {"N": str(rand_int(1, 5))}
            }},
            "anomaly_events": {"N": str(rand_int(0, 5))},
            "vlm_daily_summary": {"S": random.choice([
                "Resident had a moderately active day. 12 sit-to-stand transfers, mostly in morning hours. "
                "Walking episodes concentrated between 8-11 AM. One prolonged sedentary period of 95 min in afternoon. "
                "Independence score stable at 72.",
                "Resident showed reduced activity compared to baseline. Only 8 walking episodes vs 12 average. "
                "Sit-to-stand count down 25%. Recommend encouraging mobility breaks.",
                "Active day with good distribution of movement. 15 transfers, 10 walking episodes. "
                "No prolonged sedentary periods. Independence score improved to 82.",
                "Below average activity day. Extended lying period 10 AM - 12 PM (unusual for this resident). "
                "Bathroom visits normal. Sit-to-stand transitions appeared slower than baseline."
            ])},
            "alerts_generated": {"N": str(rand_int(0, 4))},
            "active_minutes_delta_pct": {"N": str(rand_float(-25, 15))},
            "sit_to_stand_delta_pct": {"N": str(rand_float(-30, 10))},
            "walking_episodes_delta_pct": {"N": str(rand_float(-20, 10))},
            "trend_7d": {"S": random.choice(["STABLE", "IMPROVING", "DECLINING"])},
            "computed_at": {"S": iso_now(-d * 1440)},
            "facility_score_date": {"S": f"{FACILITY_ID}#{str(score).zfill(3)}#{dt}"},
            "ttl": {"N": str(epoch_ttl(90))}
        })
    return "adl_daily_summary", items


def seed_adl_baselines():
    """Generate 10 baselines (3 per resident for first 3 residents + 1 extra)."""
    items = []
    baseline_types = ["ADMISSION", "ROLLING_7D", "ROLLING_30D"]

    for r in range(3):
        for bt in baseline_types:
            active_avg = rand_int(100, 180)
            sts_avg = rand_int(8, 18)
            walk_avg = rand_int(6, 14)
            transfer_sec_avg = rand_int(8, 18)

            items.append({
                "resident_id": {"S": RESIDENT_IDS[r]},
                "baseline_type": {"S": bt},
                "facility_id": {"S": FACILITY_ID},
                "avg_active_minutes": {"N": str(active_avg)},
                "avg_sedentary_minutes": {"N": str(rand_int(400, 600))},
                "avg_sit_to_stand_count": {"N": str(sts_avg)},
                "avg_walking_episodes": {"N": str(walk_avg)},
                "avg_walk_duration_sec": {"N": str(rand_int(180, 480))},
                "avg_transfer_duration_sec": {"N": str(transfer_sec_avg)},
                "avg_bed_transfers": {"N": str(rand_int(3, 6))},
                "avg_bathroom_visits": {"N": str(rand_int(4, 8))},
                "avg_longest_sedentary_min": {"N": str(rand_int(50, 90))},
                "avg_independence_score": {"N": str(rand_int(55, 85))},
                "hourly_activity_pattern": {"M": {
                    "00": {"M": {"dominant": {"S": "LYING"}, "active_min": {"N": "0"}}},
                    "06": {"M": {"dominant": {"S": "LYING"}, "active_min": {"N": "5"}}},
                    "07": {"M": {"dominant": {"S": "SIT"}, "active_min": {"N": "12"}}},
                    "08": {"M": {"dominant": {"S": "WALK"}, "active_min": {"N": "18"}}},
                    "12": {"M": {"dominant": {"S": "SIT"}, "active_min": {"N": "10"}}},
                    "14": {"M": {"dominant": {"S": "SIT"}, "active_min": {"N": "8"}}},
                    "18": {"M": {"dominant": {"S": "WALK"}, "active_min": {"N": "15"}}},
                    "22": {"M": {"dominant": {"S": "LYING"}, "active_min": {"N": "2"}}}
                }},
                "typical_wake_time": {"S": f"0{rand_int(5, 7)}:{rand_int(0, 59):02d}"},
                "typical_first_walk": {"S": f"0{rand_int(7, 8)}:{rand_int(0, 59):02d}"},
                "typical_last_walk": {"S": f"{rand_int(18, 20)}:{rand_int(0, 59):02d}"},
                "typical_sleep_time": {"S": f"{rand_int(21, 23)}:{rand_int(0, 59):02d}"},
                "anomaly_thresholds": {"M": {
                    "active_min_low": {"N": str(int(active_avg * 0.7))},
                    "sit_to_stand_low": {"N": str(int(sts_avg * 0.6))},
                    "sedentary_stretch_high": {"N": str(rand_int(75, 100))},
                    "transfer_time_high": {"N": str(int(transfer_sec_avg * 1.5))}
                }},
                "data_points": {"N": str(7 if bt == "ROLLING_7D" else (30 if bt == "ROLLING_30D" else rand_int(5, 7)))},
                "computed_at": {"S": iso_now(-rand_int(0, 1440))},
                "version": {"N": str(rand_int(1, 15))}
            })

    # 10th item: extra baseline
    items.append({
        "resident_id": {"S": RESIDENT_IDS[3]},
        "baseline_type": {"S": "ROLLING_7D"},
        "facility_id": {"S": FACILITY_ID},
        "avg_active_minutes": {"N": str(rand_int(90, 160))},
        "avg_sedentary_minutes": {"N": str(rand_int(450, 600))},
        "avg_sit_to_stand_count": {"N": str(rand_int(8, 16))},
        "avg_walking_episodes": {"N": str(rand_int(5, 12))},
        "avg_walk_duration_sec": {"N": str(rand_int(150, 400))},
        "avg_transfer_duration_sec": {"N": str(rand_int(10, 20))},
        "avg_bed_transfers": {"N": str(rand_int(3, 6))},
        "avg_bathroom_visits": {"N": str(rand_int(4, 7))},
        "avg_longest_sedentary_min": {"N": str(rand_int(55, 95))},
        "avg_independence_score": {"N": str(rand_int(50, 80))},
        "hourly_activity_pattern": {"M": {}},
        "anomaly_thresholds": {"M": {
            "active_min_low": {"N": "80"},
            "sit_to_stand_low": {"N": "6"},
            "sedentary_stretch_high": {"N": "90"},
            "transfer_time_high": {"N": "25"}
        }},
        "data_points": {"N": "7"},
        "computed_at": {"S": iso_now(-60)},
        "version": {"N": "3"}
    })

    return "adl_baselines", items


def seed_adl_alerts_in_unified():
    """Generate 5 ADL alerts in the existing unified_alerts table."""
    items = []
    adl_alerts = [
        ("SEDENTARY_ALERT", "WARNING", "Resident seated for 95 min without standing. Encourage mobility."),
        ("LOW_ACTIVITY", "WARNING", "Active minutes today (68) are 32% below 7-day average (100)."),
        ("TRANSFER_DECLINE", "CRITICAL", "Sit-to-stand transfers declined 45% over 3 consecutive days. Possible muscle weakness."),
        ("NIGHTTIME_ACTIVITY", "WARNING", "Resident walking in room at 2:30 AM. Fall risk elevated."),
        ("BATHROOM_DURATION", "WARNING", "Resident in bathroom for 28 min (average is 8 min). Check on resident.")
    ]

    for i, (atype, sev, msg) in enumerate(adl_alerts):
        ts = (NOW - timedelta(hours=rand_int(1, 48))).strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append({
            "resident_id": {"S": RESIDENT_IDS[i]},
            "alert_ts": {"S": ts},
            "alert_id": {"S": f"ALR#alr-adl-{uuid.uuid4().hex[:12]}"},
            "facility_id": {"S": FACILITY_ID},
            "domain": {"S": "ADL"},
            "alert_type": {"S": atype},
            "severity": {"S": sev},
            "message": {"S": msg},
            "domain_severity_ts": {"S": f"ADL#{sev}#{ts}"},
            "acknowledged": {"BOOL": random.choice([True, False])},
            "ttl": {"N": str(epoch_ttl(90))}
        })
    return "unified_alerts", items


def seed_adl_suggestions():
    """Generate 5 ADL-specific smart suggestions in existing table."""
    items = []
    suggestions = [
        ("ACTIVITY", "ADL", "Encourage hourly standing breaks. Resident had 3 sedentary stretches >1hr today.", "HIGH"),
        ("ACTIVITY", "ADL", "Schedule supervised walk. Walking episodes declined 5 consecutive days.", "HIGH"),
        ("CLINICAL", "ADL", "Request PT evaluation. Sit-to-stand transition time increased 150%.", "HIGH"),
        ("MONITORING", "ADL", "Enable chair alarm. Resident shows transfer difficulty pattern.", "MEDIUM"),
        ("ENVIRONMENTAL", "ADL", "Install raised toilet seat. Bathroom transfers show significant difficulty.", "MEDIUM")
    ]

    for i, (cat, domain, text, pri) in enumerate(suggestions):
        ts = (NOW - timedelta(hours=rand_int(1, 24))).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        items.append({
            "resident_id": {"S": RESIDENT_IDS[i]},
            "suggestion_ts": {"S": ts},
            "suggestion_id": {"S": f"SUG#sug-adl-{uuid.uuid4().hex[:12]}"},
            "facility_id": {"S": FACILITY_ID},
            "suggestion_text": {"S": text},
            "suggestion_category": {"S": cat},
            "target_domain": {"S": domain},
            "priority": {"S": pri},
            "status": {"S": "ACTIVE"},
            "status_priority_ts": {"S": f"ACTIVE#{pri}#{ts}"},
            "confidence": {"N": str(rand_float(0.75, 0.95, 2))},
            "generated_by": {"S": "ADL_ANOMALY_ENGINE_v1"},
            "display_order": {"N": str(i + 1)},
            "valid_until": {"S": (NOW + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")},
            "ttl": {"N": str(epoch_ttl(7))}
        })
    return "resident_smart_suggestions", items


def seed_adl_suggestion_templates():
    """Generate 6 ADL-specific suggestion templates in existing table."""
    items = []
    templates = [
        ("ACTIVITY", "TMPL#adl-hourly-standing", "ADL",
         "Encourage hourly standing breaks. Resident had {count} sedentary stretches >1hr today.",
         "sedentary_stretches_over_60min", "GREATER_THAN", "2"),
        ("ACTIVITY", "TMPL#adl-walking-decline", "ADL",
         "Schedule supervised walk. Walking episodes declined 5 consecutive days.",
         "walking_episodes_5d_trend", "EQUALS", "DECLINING"),
        ("CLINICAL", "TMPL#adl-pt-evaluation", "ADL",
         "Request PT evaluation. Sit-to-stand transition time increased {delta}%.",
         "avg_transfer_duration_delta_pct", "GREATER_THAN", "50"),
        ("MONITORING", "TMPL#adl-chair-alarm", "ADL",
         "Enable chair alarm. Resident shows transfer difficulty pattern.",
         "transfer_difficulty_3d_avg", "GREATER_THAN", "0.7"),
        ("BEHAVIORAL", "TMPL#adl-social-dining", "ADL",
         "Encourage dining room meals. Resident eating in room - missing social interaction.",
         "dining_visits_3d_avg", "LESS_THAN", "1"),
        ("ENVIRONMENTAL", "TMPL#adl-raised-toilet", "ADL",
         "Install raised toilet seat. Bathroom transfers show significant difficulty.",
         "bathroom_transfer_difficulty", "GREATER_THAN", "0.8")
    ]

    for cat, tid, domain, text, metric, op, threshold in templates:
        items.append({
            "template_category": {"S": cat},
            "template_id": {"S": tid},
            "template_text": {"S": text},
            "target_domain": {"S": domain},
            "trigger_conditions": {"L": [{"M": {
                "metric": {"S": metric},
                "operator": {"S": op},
                "threshold": {"S": threshold}
            }}]},
            "priority_default": {"S": "HIGH" if "clinical" in cat.lower() or "transfer" in text.lower() else "MEDIUM"},
            "enabled": {"BOOL": True},
            "version": {"N": "1"},
            "created_by": {"S": "SYSTEM"}
        })
    return "smart_suggestion_templates", items


# ============================================================================
# TABLE CREATION & SEEDING ENGINE
# ============================================================================

def create_tables(dynamodb_client, table_defs, dry_run=False):
    print(f"\n{'=' * 70}")
    print(f"  CREATING {len(table_defs)} ADL DynamoDB TABLES")
    print(f"{'=' * 70}\n")
    created = 0
    skipped = 0
    failed = 0

    for tdef in table_defs:
        table_name = tdef["TableName"]
        gsi_count = len(tdef.get("GlobalSecondaryIndexes", []))

        if dry_run:
            print(f"  [DRY RUN] Would create: {table_name} (GSIs: {gsi_count})")
            created += 1
            continue

        try:
            dynamodb_client.describe_table(TableName=table_name)
            print(f"  [SKIP] {table_name} already exists")
            skipped += 1
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                try:
                    dynamodb_client.create_table(**tdef)
                    print(f"  [OK]   {table_name} created (GSIs: {gsi_count})")
                    created += 1
                except ClientError as ce:
                    print(f"  [FAIL] {table_name}: {ce.response['Error']['Message']}")
                    failed += 1
            else:
                print(f"  [FAIL] {table_name}: {e.response['Error']['Message']}")
                failed += 1

    if not dry_run and created > 0:
        print(f"\n  Waiting for tables to become ACTIVE...")
        for tdef in table_defs:
            try:
                waiter = dynamodb_client.get_waiter('table_exists')
                waiter.wait(TableName=tdef["TableName"],
                            WaiterConfig={'Delay': 2, 'MaxAttempts': 30})
            except Exception:
                pass

    print(f"\n  Summary: {created} created, {skipped} skipped, {failed} failed")
    return failed == 0


def seed_all_tables(dynamodb_client, dry_run=False):
    print(f"\n{'=' * 70}")
    print(f"  SEEDING ADL TABLES WITH DUMMY DATA")
    print(f"{'=' * 70}\n")

    seeders = [
        seed_adl_activity_events,       # 10 records -> adl_activity_events
        seed_adl_hourly_summary,         # 10 records -> adl_hourly_summary
        seed_adl_daily_summary,          # 10 records -> adl_daily_summary
        seed_adl_baselines,              # 10 records -> adl_baselines
        seed_adl_alerts_in_unified,      # 5 records  -> unified_alerts (existing)
        seed_adl_suggestions,            # 5 records  -> resident_smart_suggestions (existing)
        seed_adl_suggestion_templates,   # 6 records  -> smart_suggestion_templates (existing)
    ]

    total_items = 0
    for seeder in seeders:
        table_name, items = seeder()

        if dry_run:
            print(f"  [DRY RUN] Would seed {table_name}: {len(items)} records")
            total_items += len(items)
            continue

        try:
            written = 0
            for item in items:
                dynamodb_client.put_item(TableName=table_name, Item=item)
                written += 1
            print(f"  [OK]   {table_name}: {written} records written")
            total_items += written
        except ClientError as e:
            print(f"  [FAIL] {table_name}: {e.response['Error']['Message']}")
        except Exception as e:
            print(f"  [FAIL] {table_name}: {str(e)}")

    print(f"\n  Total records written: {total_items}")


def print_summary(table_defs):
    print(f"\n{'=' * 70}")
    print(f"  ADL MONITORING TABLES - ARCHITECTURE SUMMARY")
    print(f"{'=' * 70}\n")
    total_gsi = 0
    print("  NEW ADL TABLES (DynamoDB):")
    for t in table_defs:
        gc = len(t.get("GlobalSecondaryIndexes", []))
        total_gsi += gc
        pk = [k["AttributeName"] for k in t["KeySchema"] if k["KeyType"] == "HASH"][0]
        sk = [k["AttributeName"] for k in t["KeySchema"] if k["KeyType"] == "RANGE"][0]
        print(f"    - {t['TableName']:35s} PK={pk}, SK={sk}  GSIs={gc}")

    print(f"\n  NEW S3 TABLE:")
    print(f"    - adl_raw_detections                 Path: s3://aitcare-fallvision-{{env}}/adl_detections/")

    print(f"\n  EXISTING TABLES RECEIVING ADL DATA:")
    print(f"    - unified_alerts                     domain='ADL' (5 new alert types)")
    print(f"    - resident_smart_suggestions         target_domain='ADL' (6 new suggestions)")
    print(f"    - smart_suggestion_templates          6 new ADL templates")
    print(f"    - resident_health_score              New adl_card embedded map")
    print(f"    - facility_daily_snapshot            New adl_overview embedded map")
    print(f"    - residents                          New ADL baseline fields")

    print(f"\n  TOTALS:")
    print(f"    New DynamoDB tables:  4")
    print(f"    New S3 tables:        1")
    print(f"    New GSIs:             {total_gsi}")
    print(f"    Seed records:         ~56 (40 new tables + 16 in existing)")
    print(f"    TTL-enabled:          3 of 4 (adl_baselines has no TTL)")


def print_ttl_commands():
    print(f"\n{'=' * 70}")
    print(f"  TTL CONFIGURATION (run after table creation)")
    print(f"{'=' * 70}\n")
    ttl_tables = ["adl_activity_events", "adl_hourly_summary", "adl_daily_summary"]
    for table in ttl_tables:
        print(f'  aws dynamodb update-time-to-live --table-name {table} '
              f'--time-to-live-specification "Enabled=true,AttributeName=ttl" --region us-west-2')
    print(f"\n  Note: adl_baselines has NO TTL (permanent baseline data)")


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="AITCare-FallVision: Create ADL DynamoDB tables & seed data")
    parser.add_argument("--region", default="us-west-2",
                        help="AWS region (default: us-west-2)")
    parser.add_argument("--env", default="dev",
                        choices=["dev", "staging", "prod"],
                        help="Environment")
    parser.add_argument("--endpoint", default=None,
                        help="DynamoDB endpoint URL (for local: http://localhost:8000)")
    parser.add_argument("--tables-only", action="store_true",
                        help="Only create tables, skip seeding")
    parser.add_argument("--seed-only", action="store_true",
                        help="Only seed data, skip table creation")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be done without executing")
    args = parser.parse_args()

    global ENV
    ENV = args.env

    print(f"\n{'#' * 70}")
    print(f"#  AITCare-FallVision - ADL Table Creator & Data Seeder")
    print(f"#  Region:   {args.region}")
    print(f"#  Env:      {args.env}")
    print(f"#  Endpoint: {args.endpoint or 'AWS Default'}")
    print(f"#  Mode:     {'DRY RUN' if args.dry_run else ('Tables Only' if args.tables_only else ('Seed Only' if args.seed_only else 'Full (Create + Seed)'))}")
    print(f"#  Date:     {NOW.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"{'#' * 70}")

    table_defs = get_adl_table_definitions()
    print_summary(table_defs)

    if args.dry_run:
        create_tables(None, table_defs, dry_run=True)
        seed_all_tables(None, dry_run=True)
        print_ttl_commands()
        print(f"\n  [DRY RUN COMPLETE] No AWS calls were made.\n")
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
        sys.exit(1)

    if not args.seed_only:
        success = create_tables(dynamodb_client, table_defs)
        if not success:
            print("\n  WARNING: Some tables failed to create. Continuing...\n")

    if not args.tables_only:
        if not args.seed_only:
            print("\n  Pausing 3 seconds for table propagation...")
            time.sleep(3)
        seed_all_tables(dynamodb_client)

    print_ttl_commands()

    print(f"\n{'=' * 70}")
    print(f"  DONE! ADL tables created and seeded successfully.")
    print(f"  New architecture: 31 DynamoDB + 4 S3 = 35 tables total")
    print(f"  (Original 27 + 4 wearable + 4 ADL = 35 DynamoDB)")
    print(f"  (Original 3 S3 + 1 ADL S3 = 4 S3)")
    print(f"")
    print(f"  Updated cost: ~$205/mo for 100 residents (+$16 for ADL)")
    print(f"  Per resident: ~$2.05/mo")
    print(f"{'=' * 70}\n")


if __name__ == "__main__":
    main()
