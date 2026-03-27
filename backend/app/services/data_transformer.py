"""
Data Transformer Service

Provides transformation functions to convert DynamoDB data structures into
the format expected by the React frontend. Each transformer method corresponds
to a specific domain (sleep, gait, etc.) and ensures consistent, predictable
output shapes that match the frontend's data contracts.

All transformation is stateless and side-effect free.
"""

# ---------------------------------------------------------------------------
# Standard library imports
# ---------------------------------------------------------------------------
from datetime import datetime
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Module-level logger (optional, uncomment if logging is needed)
# ---------------------------------------------------------------------------
# import logging
# logger = logging.getLogger(__name__)


# ===========================================================================
# DataTransformer Class
# ===========================================================================


class DataTransformer:
    """
    Stateless transformer for converting raw database data to frontend formats.

    Each public method corresponds to a specific domain (sleep diary, gait
    analysis, falls, etc.) and produces output that matches the shape of the
    corresponding JSON fixture files used by the React frontend.

    Private helper methods (_prefixed) provide reusable formatting utilities
    for dates, timestamps, and derived metrics.
    """

    # -----------------------------------------------------------------------
    # Sleep Diary Transformation
    # -----------------------------------------------------------------------

    @staticmethod
    def transform_sleep_diary_data(
        resident_info: Dict,
        sleep_summaries: List[Dict],
        sleep_movement: List[Dict],
        wake_episodes: List[Dict]
    ) -> Dict:
        """
        Transform DynamoDB sleep data to match React sleepData.json format.

        Combines nightly summary statistics, hourly movement intensity, and
        wake episode records into a single unified payload for the frontend.

        Args:
            resident_info: Basic resident metadata (name, room, baselines)
            sleep_summaries: List of nightly sleep summaries (sorted newest first)
            sleep_movement: Hourly movement intensity for the most recent night
            wake_episodes: Wake episodes during the most recent night

        Returns:
            Dict matching the structure expected by SleepDiaryDashboard.tsx
        """
        # -------------------------------------------------------------------
        # Extract the most recent summary for current-night metrics
        # -------------------------------------------------------------------
        latest = sleep_summaries[0] if sleep_summaries else {}

        # -------------------------------------------------------------------
        # Build the unified response payload
        # -------------------------------------------------------------------
        return {
            # Patient identification and current date
            "patient": {
                "id": resident_info.get('resident_id', ''),
                "name": "Patient",  # Encrypted in DB
                "room": resident_info.get('room_id', '').replace('ROOM#r-', ''),
                "date": latest.get('sleep_date', '')
            },
            # Top-level sleep metrics with change indicators
            "metrics": {
                # Total Sleep Time (TST)
                "totalSleepTime": {
                    "value": round(latest.get('total_sleep_time_min', 0) / 60, 1),
                    "unit": "hrs",
                    "change": DataTransformer._calculate_change(
                        latest.get('total_sleep_time_min', 0),
                        resident_info.get('baseline_tst_min', 420)
                    )
                },
                # Sleep Efficiency (SE)
                "sleepEfficiency": {
                    "value": round(latest.get('sleep_efficiency_pct', 0)),
                    "unit": "%",
                    "change": DataTransformer._calculate_change(
                        latest.get('sleep_efficiency_pct', 0),
                        resident_info.get('baseline_se_pct', 85)
                    )
                },
                # Wake After Sleep Onset (WASO)
                "wakeAfterSleepOnset": {
                    "value": round(latest.get('waso_min', 0)),
                    "unit": "min",
                    "change": DataTransformer._calculate_change(
                        latest.get('waso_min', 0),
                        resident_info.get('baseline_waso_min', 45)
                    )
                },
                # Sleep Latency (time to fall asleep)
                "sleepLatency": {
                    "value": round(latest.get('sleep_latency_min', 0)),
                    "unit": "min",
                    "change": DataTransformer._calculate_change(
                        latest.get('sleep_latency_min', 0),
                        resident_info.get('baseline_sl_min', 15)
                    )
                }
            },
            # Sleep stage distribution for the most recent night
            "sleepStages": {
                "deepSleep": round(latest.get('deep_sleep_pct', 0)),
                "remSleep": round(latest.get('rem_sleep_pct', 0)),
                "lightSleep": round(latest.get('light_sleep_pct', 0)),
                "totalMinutes": latest.get('total_sleep_time_min', 0)
            },
            # Historical trend: sleep duration for the past 7 nights
            "sleepDurationOverTime": [
                {
                    "day": f"Day {i+1}",
                    "hours": round(item.get('total_sleep_time_min', 0) / 60, 1),
                    "quality": item.get('sleep_quality', 'AVERAGE')
                }
                for i, item in enumerate(reversed(sleep_summaries[:7]))
            ],
            # Hourly movement intensity for the most recent night
            "bodyMovement": [
                {
                    "time": DataTransformer._format_hour(item.get('sleep_date_hour', '')),
                    "value": item.get('avg_movement_intensity', 0)
                }
                for item in sorted(sleep_movement, key=lambda x: x.get('sleep_date_hour', ''))
            ],
            # Wake episodes during the most recent night
            "wakeEpisodes": [
                {
                    "label": DataTransformer._format_hour(item.get('sleep_date_episode', '')),
                    "duration": item.get('duration_min', 0),
                    "wakeTime": DataTransformer._format_time(item.get('wake_start_ts', '')),
                    "wakeDur": f"{item.get('duration_min', 0)} min",
                    "hourLabel": DataTransformer._get_hour_label_from_timestamp(item.get('wake_start_ts', ''))
                }
                for item in sorted(wake_episodes, key=lambda x: x.get('wake_start_ts', ''))
            ]
        }

    # -----------------------------------------------------------------------
    # Gait Analysis Transformation
    # -----------------------------------------------------------------------

    @staticmethod
    def transform_gait_data(
        resident_info: Dict,
        gait_snapshot: Dict,
        daily_steps: List[Dict],
        stride_hourly: List[Dict],
        alerts: Optional[List[Dict]] = None,
        suggestions: Optional[List[Dict]] = None,
        health_score: Optional[Dict] = None
    ) -> Dict:
        """
        Transform DynamoDB gait data to match React gaitData.json format.

        Combines real-time gait metrics, historical step counts, hourly stride
        distributions, alerts, suggestions, and health scores into a unified
        payload for the Gait & Mobility Dashboard.

        Args:
            resident_info: Basic resident metadata
            gait_snapshot: Most recent gait metrics (stride, balance, fall risk)
            daily_steps: Historical daily step counts (last 30 days)
            stride_hourly: Hourly stride length distribution for today
            alerts: Recent gait-related alerts (optional)
            suggestions: AI-generated care suggestions (optional)
            health_score: Comprehensive health score breakdown (optional)

        Returns:
            Dict matching the structure expected by GaitMobilityDashboard.tsx
        """
        # -------------------------------------------------------------------
        # Provide defaults for optional parameters
        # -------------------------------------------------------------------
        alerts = alerts or []
        suggestions = suggestions or []
        health_score = health_score or {}

        # -------------------------------------------------------------------
        # Build the unified response payload
        # -------------------------------------------------------------------
        return {
            # Patient identification
            "patient": {
                "id": resident_info.get('resident_id', ''),
                "name": "Patient",
                "room": resident_info.get('room_id', '').replace('ROOM#r-', '')
            },
            # Current gait metrics with change indicators
            "metrics": {
                # Step frequency (cadence)
                "stepFrequency": {
                    "value": round(gait_snapshot.get('step_frequency', 0)),
                    "unit": "steps/min",
                    "change": round(gait_snapshot.get('step_freq_delta', 0))
                },
                # Stride length
                "strideLength": {
                    "value": round(gait_snapshot.get('stride_length', 0) * 100),
                    "unit": "cm",
                    "change": round(gait_snapshot.get('stride_delta', 0))
                },
                # Balance score
                "balanceScore": {
                    "value": round(gait_snapshot.get('balance_score', 0)),
                    "unit": "%",
                    "change": round(gait_snapshot.get('balance_delta', 0))
                },
                # Fall risk assessment
                "fallRiskLevel": {
                    "value": gait_snapshot.get('fall_risk_level', 'MODERATE'),
                    "unit": "",
                    "change": ""
                }
            },
            # Historical trend: daily step counts for the past 30 days
            "stepFrequencyOverTime": [
                {
                    "day": f"Day {i+1}",
                    "steps": item.get('total_steps', 0)
                }
                for i, item in enumerate(reversed(daily_steps[:30]))
            ],
            # Hourly stride length distribution (today)
            "strideLengthDistribution": [
                {
                    "time": item.get('hour_label', ''),
                    "ideal": item.get('steps_ideal', 0),
                    "moderate": item.get('steps_moderate', 0),
                    "suboptimal": item.get('steps_suboptimal', 0)
                }
                for item in sorted(stride_hourly, key=lambda x: x.get('date_hour', ''))
            ],
            # Arm swing symmetry data (placeholder for S3 Parquet data)
            "armSwingSymmetry": DataTransformer._generate_arm_swing_data(),
            # Body tilt analysis
            "bodyTilt": {
                "value": round(gait_snapshot.get('body_tilt_angle', 0)),
                "label": DataTransformer._get_tilt_label(gait_snapshot.get('body_tilt_angle', 0)),
                "leftLabel": "Left Tilt",
                "rightLabel": "Right Tilt"
            },
            # AI-generated insights and summaries
            "insights": {
                "recentAlerts": DataTransformer._format_alerts(alerts),
                "recommendations": DataTransformer._format_suggestions(suggestions),
                "fallRiskSummary": DataTransformer._format_fall_risk(health_score, gait_snapshot)
            },
            # Recent alerts (detailed records)
            "alerts": [
                {
                    "id": alert.get('alert_id', ''),
                    "timestamp": alert.get('alert_ts', ''),
                    "type": alert.get('alert_type', ''),
                    "severity": alert.get('severity', ''),
                    "message": alert.get('message', ''),
                    "acknowledged": alert.get('acknowledged', False),
                    "domain": alert.get('domain', 'GAIT')
                }
                for alert in alerts
            ],
            # AI-generated care suggestions (detailed records)
            "suggestions": [
                {
                    "id": suggestion.get('suggestion_id', ''),
                    "timestamp": suggestion.get('suggestion_ts', ''),
                    "text": suggestion.get('suggestion_text', ''),
                    "category": suggestion.get('suggestion_category', ''),
                    "priority": suggestion.get('priority', ''),
                    "status": suggestion.get('status', 'ACTIVE'),
                    "confidence": float(suggestion.get('confidence', 0)),
                    "targetDomain": suggestion.get('target_domain', ''),
                    "validUntil": suggestion.get('valid_until', '')
                }
                for suggestion in suggestions
            ],
            # Comprehensive health score breakdown
            "healthScore": {
                "overall": health_score.get('overall_score', 0),
                "overallLabel": health_score.get('overall_label', 'N/A'),
                "fallRiskScore": health_score.get('fall_risk_score', 0),
                "gaitStabilityScore": health_score.get('gait_stability_score', 0),
                "activityLevelScore": health_score.get('activity_level_score', 0),
                "riskLevel": health_score.get('risk_level', 'MODERATE'),
                "primaryRiskFactor": health_score.get('primary_risk_factor', ''),
                "riskTrend7d": health_score.get('risk_trend_7d', 'STABLE'),
                "fallCard": health_score.get('fall_card', {}),
                "gaitCard": health_score.get('gait_card', {})
            }
        }

    # -----------------------------------------------------------------------
    # Helper Methods: Calculations
    # -----------------------------------------------------------------------

    @staticmethod
    def _calculate_change(current: float, baseline: float) -> float:
        """
        Calculate percentage change from baseline.

        Args:
            current: Current metric value
            baseline: Baseline/expected metric value

        Returns:
            Percentage change (positive = increase, negative = decrease)
        """
        if baseline == 0:
            return 0
        return round(((current - baseline) / baseline) * 100)

    # -----------------------------------------------------------------------
    # Helper Methods: Time Formatting
    # -----------------------------------------------------------------------

    @staticmethod
    def _format_hour(datetime_str: str) -> str:
        """
        Extract hour from sleep_date_hour format and convert to 12-hour label.

        Args:
            datetime_str: Date-hour string (e.g., '2025-03-12#22')

        Returns:
            12-hour time label (e.g., '10PM'), empty string on error
        """
        if '#' not in datetime_str:
            return ''
        try:
            hour = int(datetime_str.split('#')[1])
            if hour == 0:
                return "12AM"
            elif hour < 12:
                return f"{hour}AM"
            elif hour == 12:
                return "12PM"
            else:
                return f"{hour-12}PM"
        except Exception:
            return ''

    @staticmethod
    def _format_time(iso_timestamp: str) -> str:
        """
        Format ISO timestamp to time string.

        Args:
            iso_timestamp: ISO 8601 timestamp (e.g., '2025-03-17T23:29:00Z')

        Returns:
            Formatted time string (e.g., '11:29 PM'), empty string on error
        """
        if not iso_timestamp:
            return ''
        try:
            dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            return dt.strftime('%I:%M %p')
        except Exception:
            return ''

    @staticmethod
    def _get_hour_label_from_timestamp(iso_timestamp: str) -> str:
        """
        Extract hour label from ISO timestamp.

        Args:
            iso_timestamp: ISO 8601 timestamp (e.g., '2025-03-17T23:29:00Z')

        Returns:
            12-hour label (e.g., '11PM'), empty string on error
        """
        if not iso_timestamp:
            return ''
        try:
            dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            hour = dt.hour
            if hour == 0:
                return "12AM"
            elif hour < 12:
                return f"{hour}AM"
            elif hour == 12:
                return "12PM"
            else:
                return f"{hour-12}PM"
        except Exception:
            return ''

    # -----------------------------------------------------------------------
    # Helper Methods: Data Generation & Placeholders
    # -----------------------------------------------------------------------

    @staticmethod
    def _generate_arm_swing_data() -> List[Dict]:
        """
        Generate synthetic arm swing data.

        TODO: Replace with actual S3 Parquet data retrieval once
        the accelerometer pipeline is integrated.

        Returns:
            List of time-series arm swing measurements (left/right)
        """
        return [
            {"time": i, "left": 2.5, "right": 2.3}
            for i in range(10)
        ]

    # -----------------------------------------------------------------------
    # Helper Methods: Label Generation
    # -----------------------------------------------------------------------

    @staticmethod
    def _get_tilt_label(angle: float) -> str:
        """
        Get descriptive label for body tilt angle.

        Args:
            angle: Body tilt angle in degrees

        Returns:
            Human-readable tilt assessment
        """
        if angle < 5:
            return "Normal posture"
        elif angle < 12:
            return "Slight imbalance"
        else:
            return "Significant tilt"

    # -----------------------------------------------------------------------
    # Helper Methods: Insights Formatting
    # -----------------------------------------------------------------------

    @staticmethod
    def _format_alerts(alerts: List[Dict]) -> str:
        """
        Format recent alerts into a human-readable summary string.

        Args:
            alerts: List of alert records from DynamoDB

        Returns:
            Summary text of the most recent gait alert
        """
        if not alerts:
            return "No recent alerts"

        # Filter for gait-related alerts
        gait_alerts = [a for a in alerts if a.get('domain') == 'GAIT']
        if not gait_alerts:
            return "No recent gait alerts"

        # Get the most recent critical/warning alert
        latest = gait_alerts[0]
        alert_type = latest.get('alert_type', '').replace('_', ' ').title()
        timestamp = latest.get('alert_ts', '')

        # Format timestamp for display
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            date_str = dt.strftime('%d %b')
            return f"{alert_type} detected on [{date_str}]"
        except Exception:
            return f"{alert_type} detected recently"

    @staticmethod
    def _format_suggestions(suggestions: List[Dict]) -> str:
        """
        Format top AI suggestion into a human-readable string.

        Filters for gait/activity/fall suggestions, sorts by priority,
        and returns the highest-priority active suggestion.

        Args:
            suggestions: List of suggestion records from DynamoDB

        Returns:
            Summary text of the top-priority suggestion
        """
        if not suggestions:
            return "No recommendations available"

        # Filter for gait/activity/fall suggestions
        # More lenient: include suggestions without status or with status=ACTIVE
        relevant_domains = ['GAIT', 'ACTIVITY', 'FALL', 'CROSS_DOMAIN']
        gait_suggestions = [
            s for s in suggestions
            if s.get('target_domain') in relevant_domains
            and (not s.get('status') or s.get('status') == 'ACTIVE')
        ]

        # Fall back to any available suggestion if no domain-specific ones found
        if not gait_suggestions:
            gait_suggestions = suggestions

        if not gait_suggestions:
            return "No active recommendations"

        # Sort by priority (HIGH > MEDIUM > LOW)
        priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        gait_suggestions.sort(
            key=lambda x: priority_order.get(x.get('priority', 'LOW'), 3)
        )

        suggestion_text = gait_suggestions[0].get('suggestion_text', '')
        return suggestion_text if suggestion_text else "No recommendations available"

    @staticmethod
    def _format_fall_risk(health_score: Dict, gait_snapshot: Dict) -> str:
        """
        Format fall risk summary into a human-readable string.

        Combines fall risk level, primary risk factor, and trend direction
        into a concise natural-language summary.

        Args:
            health_score: Comprehensive health score breakdown
            gait_snapshot: Current gait metrics

        Returns:
            Natural-language fall risk summary
        """
        # Fall back to gait snapshot if health score is unavailable
        if not health_score:
            risk_level = gait_snapshot.get('fall_risk_level', 'MODERATE')
            return f"Fall risk is {risk_level.lower()}"

        # Extract risk components from health score
        risk_level = health_score.get('risk_level', 'MODERATE')
        primary_factor = health_score.get('primary_risk_factor', 'gait instability')
        trend = health_score.get('risk_trend_7d', 'STABLE')

        # Translate trend code to natural language
        trend_text = {
            'WORSENING': 'and worsening',
            'IMPROVING': 'but improving',
            'STABLE': 'and stable'
        }.get(trend, '')

        return f"Fall risk is {risk_level.lower()} due to {primary_factor} {trend_text}"


# ===========================================================================
# Module-level singleton instance
# ===========================================================================

transformer = DataTransformer()
