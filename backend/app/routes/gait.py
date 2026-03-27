"""
Gait Analysis API Routes
"""
import logging
import traceback
from datetime import datetime
from typing import Dict

from boto3.dynamodb.conditions import Key
from fastapi import APIRouter, HTTPException

from ..services.dynamodb_service import db_service
from ..services.data_transformer import transformer

# ---------------------------------------------------------------------------
# Module-level logger
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gait", tags=["Gait Analysis"])

# Domains considered relevant to gait suggestions
GAIT_SUGGESTION_DOMAINS = {"GAIT", "ACTIVITY", "FALL", "CROSS_DOMAIN"}

# DynamoDB table name for stride length hourly data
STRIDE_HOURLY_TABLE = "stride_length_hourly"


# ===========================================================================
# GET /gait/{resident_id}
# ===========================================================================

@router.get("/{resident_id}")
async def get_gait_data(resident_id: str) -> Dict:
    """
    Return complete gait analysis data for a resident.

    Fetches and combines data from multiple sources — snapshot, daily steps,
    stride hourly, alerts, suggestions, and health score — then transforms
    them into the shape expected by the React frontend (matches gaitData.json).

    Example: GET /api/v1/gait/RES#res-20251112-0001
    """
    try:
        logger.info(f"[GAIT API] Full gait data request for resident: {resident_id}")

        # ------------------------------------------------------------------
        # Validate resident exists before fetching any further data
        # ------------------------------------------------------------------
        resident_info = db_service.get_resident_info(resident_id)
        if not resident_info:
            logger.warning(f"[GAIT API] Resident not found: {resident_id}")
            raise HTTPException(status_code=404, detail=f"Resident {resident_id} not found")

        # ------------------------------------------------------------------
        # Gait snapshot — required; no point continuing without it
        # ------------------------------------------------------------------
        gait_snapshot = db_service.get_latest_gait_snapshot(resident_id)
        if not gait_snapshot:
            logger.warning(f"[GAIT API] No gait snapshot found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No gait data found for {resident_id}")

        # ------------------------------------------------------------------
        # Daily step counts — last 30 days
        # ------------------------------------------------------------------
        daily_steps = db_service.get_gait_daily_steps(resident_id, days=30)
        logger.debug(f"[GAIT API] Fetched {len(daily_steps)} daily step records for {resident_id}")

        # ------------------------------------------------------------------
        # Stride hourly data — prefer today's data; fall back to the most
        # recent available records if today has no entries yet
        # ------------------------------------------------------------------
        today = datetime.now().strftime("%Y-%m-%d")
        stride_hourly = db_service.get_stride_length_hourly(resident_id, today)

        if not stride_hourly:
            logger.debug(f"[GAIT API] No stride data for today ({today}), falling back to latest records")
            table = db_service.dynamodb.Table(STRIDE_HOURLY_TABLE)
            response = table.query(
                KeyConditionExpression=Key('resident_id').eq(resident_id),
                Limit=10
            )
            stride_hourly = db_service.decimal_to_float(response.get('Items', []))

        logger.debug(f"[GAIT API] Using {len(stride_hourly)} stride hourly records for {resident_id}")

        # ------------------------------------------------------------------
        # Supporting data: alerts, suggestions, health score
        # ------------------------------------------------------------------
        alerts = db_service.get_recent_alerts(resident_id, limit=10)
        suggestions = db_service.get_resident_suggestions(resident_id, limit=10)
        health_score = db_service.get_health_score(resident_id)

        # ------------------------------------------------------------------
        # Transform all fetched data into the React-compatible response shape
        # ------------------------------------------------------------------
        gait_data = transformer.transform_gait_data(
            resident_info,
            gait_snapshot,
            daily_steps,
            stride_hourly,
            alerts,
            suggestions,
            health_score
        )

        logger.info(f"[GAIT API] Gait data assembled successfully for resident: {resident_id}")
        return gait_data

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[GAIT API] Unexpected error fetching gait data for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# ===========================================================================
# GET /gait/{resident_id}/metrics
# ===========================================================================

@router.get("/{resident_id}/metrics")
async def get_gait_metrics(resident_id: str) -> Dict:
    """
    Return the latest gait metrics snapshot only.

    Lighter alternative to the full endpoint when the caller only needs
    current numeric metrics without chart data or alerts.
    """
    try:
        logger.info(f"[GAIT API] Metrics request for resident: {resident_id}")

        snapshot = db_service.get_latest_gait_snapshot(resident_id)
        if not snapshot:
            logger.warning(f"[GAIT API] No gait snapshot found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No data found for {resident_id}")

        logger.info(f"[GAIT API] Metrics fetched successfully for resident: {resident_id}")
        return snapshot

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[GAIT API] Error fetching gait metrics for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /gait/{resident_id}/alerts
# ===========================================================================

@router.get("/{resident_id}/alerts")
async def get_gait_alerts(resident_id: str, limit: int = 10) -> Dict:
    """
    Return recent gait-domain alerts for the resident.

    Query params:
      - limit: maximum number of alerts to return (default 10)
    """
    try:
        logger.info(f"[GAIT API] Alerts request for resident: {resident_id} (limit={limit})")

        alerts = db_service.get_recent_alerts(resident_id, limit=limit)

        # Only surface alerts that belong to the GAIT domain
        gait_alerts = [a for a in alerts if a.get('domain') == 'GAIT']

        logger.info(f"[GAIT API] Returning {len(gait_alerts)} gait alerts for resident: {resident_id}")

        return {
            "resident_id": resident_id,
            "count": len(gait_alerts),
            "alerts": gait_alerts
        }

    except Exception as e:
        logger.error(f"[GAIT API] Error fetching gait alerts for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /gait/{resident_id}/suggestions
# ===========================================================================

@router.get("/{resident_id}/suggestions")
async def get_gait_suggestions(resident_id: str, limit: int = 10) -> Dict:
    """
    Return AI-generated suggestions relevant to gait for the resident.

    Filters by GAIT_SUGGESTION_DOMAINS; falls back to all suggestions if
    none match so the frontend always has something useful to display.

    Query params:
      - limit: maximum number of suggestions to return (default 10)
    """
    try:
        logger.info(f"[GAIT API] Suggestions request for resident: {resident_id} (limit={limit})")

        suggestions = db_service.get_resident_suggestions(resident_id, limit=limit)

        # Prefer domain-specific suggestions; fall back to all if none match
        gait_suggestions = [
            s for s in suggestions
            if s.get('target_domain') in GAIT_SUGGESTION_DOMAINS
        ]

        if not gait_suggestions:
            logger.debug(f"[GAIT API] No domain-specific suggestions found for {resident_id}, returning all")
            gait_suggestions = suggestions

        logger.info(f"[GAIT API] Returning {len(gait_suggestions)} suggestions for resident: {resident_id}")

        return {
            "resident_id": resident_id,
            "count": len(gait_suggestions),
            "suggestions": gait_suggestions
        }

    except Exception as e:
        logger.error(f"[GAIT API] Error fetching gait suggestions for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /gait/{resident_id}/health-score
# ===========================================================================

@router.get("/{resident_id}/health-score")
async def get_gait_health_score(resident_id: str) -> Dict:
    """Return the health score and fall-risk details for the resident."""
    try:
        logger.info(f"[GAIT API] Health score request for resident: {resident_id}")

        health_score = db_service.get_health_score(resident_id)
        if not health_score:
            logger.warning(f"[GAIT API] No health score found for resident: {resident_id}")
            raise HTTPException(status_code=404, detail=f"No health score found for {resident_id}")

        logger.info(f"[GAIT API] Health score fetched successfully for resident: {resident_id}")
        return health_score

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[GAIT API] Error fetching health score for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# GET /gait/{resident_id}/debug
# ===========================================================================

@router.get("/{resident_id}/debug")
async def debug_gait_data(resident_id: str) -> Dict:
    """
    Return raw data from all gait-related tables for a resident.

    Intended for development and troubleshooting only — should be removed
    or protected behind an auth guard before going to production.
    """
    try:
        logger.info(f"[GAIT API] Debug data request for resident: {resident_id}")

        today = datetime.now().strftime("%Y-%m-%d")

        debug_payload = {
            "resident_info": db_service.get_resident_info(resident_id),
            "gait_snapshot": db_service.get_latest_gait_snapshot(resident_id),
            "daily_steps_count": len(db_service.get_gait_daily_steps(resident_id, days=30)),
            "stride_hourly_count": len(db_service.get_stride_length_hourly(resident_id, today)),
            "alerts": db_service.get_recent_alerts(resident_id, limit=10),
            "suggestions": db_service.get_resident_suggestions(resident_id, limit=10),
            "health_score": db_service.get_health_score(resident_id)
        }

        logger.info(f"[GAIT API] Debug payload assembled for resident: {resident_id}")
        return debug_payload

    except Exception as e:
        logger.error(f"[GAIT API] Error assembling debug payload for {resident_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))