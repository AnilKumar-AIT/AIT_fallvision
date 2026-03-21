"""
Data Transformer Service
Converts DynamoDB data format to React frontend format
"""
from typing import Dict, List

class DataTransformer:
    
    @staticmethod
    def transform_sleep_diary_data(
        resident_info: Dict,
        sleep_summaries: List[Dict],
        sleep_movement: List[Dict],
        wake_episodes: List[Dict]
    ) -> Dict:
        """Transform DynamoDB sleep data to match React sleepData.json format"""
        
        # Get latest summary for metrics
        latest = sleep_summaries[0] if sleep_summaries else {}
        
        # Transform to React format
        return {
            "patient": {
                "id": resident_info.get('resident_id', ''),
                "name": "Patient",  # Encrypted in DB
                "room": resident_info.get('room_id', '').replace('ROOM#r-', ''),
                "date": latest.get('sleep_date', '')
            },
            "metrics": {
                "totalSleepTime": {
                    "value": round(latest.get('total_sleep_time_min', 0) / 60, 1),
                    "unit": "hrs",
                    "change": DataTransformer._calculate_change(
                        latest.get('total_sleep_time_min', 0),
                        resident_info.get('baseline_tst_min', 420)
                    )
                },
                "sleepEfficiency": {
                    "value": round(latest.get('sleep_efficiency_pct', 0)),
                    "unit": "%",
                    "change": DataTransformer._calculate_change(
                        latest.get('sleep_efficiency_pct', 0),
                        resident_info.get('baseline_se_pct', 85)
                    )
                },
                "wakeAfterSleepOnset": {
                    "value": round(latest.get('waso_min', 0)),
                    "unit": "min",
                    "change": DataTransformer._calculate_change(
                        latest.get('waso_min', 0),
                        resident_info.get('baseline_waso_min', 45)
                    )
                },
                "sleepLatency": {
                    "value": round(latest.get('sleep_latency_min', 0)),
                    "unit": "min",
                    "change": DataTransformer._calculate_change(
                        latest.get('sleep_latency_min', 0),
                        resident_info.get('baseline_sl_min', 15)
                    )
                }
            },
            "sleepStages": {
                "deepSleep": round(latest.get('deep_sleep_pct', 0)),
                "remSleep": round(latest.get('rem_sleep_pct', 0)),
                "lightSleep": round(latest.get('light_sleep_pct', 0)),
                "totalMinutes": latest.get('total_sleep_time_min', 0)
            },
            "sleepDurationOverTime": [
                {
                    "day": f"Day {i+1}",
                    "hours": round(item.get('total_sleep_time_min', 0) / 60, 1),
                    "quality": item.get('sleep_quality', 'AVERAGE')
                }
                for i, item in enumerate(reversed(sleep_summaries[:7]))
            ],
            "bodyMovement": [
                {
                    "time": DataTransformer._format_hour(item.get('sleep_date_hour', '')),
                    "value": item.get('avg_movement_intensity', 0)
                }
                for item in sorted(sleep_movement, key=lambda x: x.get('sleep_date_hour', ''))
            ],
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
    
    @staticmethod
    def transform_gait_data(
        resident_info: Dict,
        gait_snapshot: Dict,
        daily_steps: List[Dict],
        stride_hourly: List[Dict],
        alerts: List[Dict] = None,
        suggestions: List[Dict] = None,
        health_score: Dict = None
    ) -> Dict:
        """Transform DynamoDB gait data to match React gaitData.json format"""
        
        # Default empty lists if not provided
        alerts = alerts or []
        suggestions = suggestions or []
        health_score = health_score or {}
        
        return {
            "patient": {
                "id": resident_info.get('resident_id', ''),
                "name": "Patient",
                "room": resident_info.get('room_id', '').replace('ROOM#r-', '')
            },
            "metrics": {
                "stepFrequency": {
                    "value": round(gait_snapshot.get('step_frequency', 0)),
                    "unit": "steps/min",
                    "change": round(gait_snapshot.get('step_freq_delta', 0))
                },
                "strideLength": {
                    "value": round(gait_snapshot.get('stride_length', 0) * 100),
                    "unit": "cm",
                    "change": round(gait_snapshot.get('stride_delta', 0))
                },
                "balanceScore": {
                    "value": round(gait_snapshot.get('balance_score', 0)),
                    "unit": "%",
                    "change": round(gait_snapshot.get('balance_delta', 0))
                },
                "fallRiskLevel": {
                    "value": gait_snapshot.get('fall_risk_level', 'MODERATE'),
                    "unit": "",
                    "change": ""
                }
            },
            "stepFrequencyOverTime": [
                {
                    "day": f"Day {i+1}",
                    "steps": item.get('total_steps', 0)
                }
                for i, item in enumerate(reversed(daily_steps[:30]))
            ],
            "strideLengthDistribution": [
                {
                    "time": item.get('hour_label', ''),
                    "ideal": item.get('steps_ideal', 0),
                    "moderate": item.get('steps_moderate', 0),
                    "suboptimal": item.get('steps_suboptimal', 0)
                }
                for item in sorted(stride_hourly, key=lambda x: x.get('date_hour', ''))
            ],
            "armSwingSymmetry": DataTransformer._generate_arm_swing_data(),
            "bodyTilt": {
                "value": round(gait_snapshot.get('body_tilt_angle', 0)),
                "label": DataTransformer._get_tilt_label(gait_snapshot.get('body_tilt_angle', 0)),
                "leftLabel": "Left Tilt",
                "rightLabel": "Right Tilt"
            },
            "insights": {
                "recentAlerts": DataTransformer._format_alerts(alerts),
                "recommendations": DataTransformer._format_suggestions(suggestions),
                "fallRiskSummary": DataTransformer._format_fall_risk(health_score, gait_snapshot)
            },
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
    
    @staticmethod
    def _calculate_change(current: float, baseline: float) -> float:
        """Calculate percentage change from baseline"""
        if baseline == 0:
            return 0
        return round(((current - baseline) / baseline) * 100)
    
    @staticmethod
    def _format_hour(datetime_str: str) -> str:
        """Extract hour from sleep_date_hour format (e.g., '2025-03-12#22' -> '10PM')"""
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
        except:
            return ''
    
    @staticmethod
    def _format_time(iso_timestamp: str) -> str:
        """Format ISO timestamp to time string (e.g., '11:00 PM')"""
        if not iso_timestamp:
            return ''
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            return dt.strftime('%I:%M %p')
        except:
            return ''
    
    @staticmethod
    def _generate_arm_swing_data() -> List[Dict]:
        """Generate synthetic arm swing data (placeholder for S3 Parquet data)"""
        return [
            {"time": i, "left": 2.5, "right": 2.3}
            for i in range(10)
        ]
    
    @staticmethod
    def _get_tilt_label(angle: float) -> str:
        """Get body tilt descriptive label"""
        if angle < 5:
            return "Normal posture"
        elif angle < 12:
            return "Slight imbalance"
        else:
            return "Significant tilt"
    
    @staticmethod
    def _get_hour_label_from_timestamp(iso_timestamp: str) -> str:
        """Extract hour label from ISO timestamp (e.g., '2025-03-17T23:29:00Z' -> '11PM')"""
        if not iso_timestamp:
            return ''
        try:
            from datetime import datetime
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
        except:
            return ''
    
    @staticmethod
    def _format_alerts(alerts: List[Dict]) -> str:
        """Format recent alerts into a summary string"""
        if not alerts:
            return "No recent alerts"
        
        # Get the most recent critical/warning alert
        gait_alerts = [a for a in alerts if a.get('domain') == 'GAIT']
        if not gait_alerts:
            return "No recent gait alerts"
        
        latest = gait_alerts[0]
        alert_type = latest.get('alert_type', '').replace('_', ' ').title()
        timestamp = latest.get('alert_ts', '')
        
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            date_str = dt.strftime('%d %b')
            return f"{alert_type} detected on [{date_str}]"
        except:
            return f"{alert_type} detected recently"
    
    @staticmethod
    def _format_suggestions(suggestions: List[Dict]) -> str:
        """Format top suggestion into a string"""
        if not suggestions:
            return "No recommendations available"
        
        # Filter for gait/activity suggestions (more lenient - check if status exists and is ACTIVE)
        gait_suggestions = [
            s for s in suggestions 
            if s.get('target_domain') in ['GAIT', 'ACTIVITY', 'FALL', 'CROSS_DOMAIN']
            and (not s.get('status') or s.get('status') == 'ACTIVE')  # Include if no status or ACTIVE
        ]
        
        # If no gait-specific suggestions, use any available suggestion
        if not gait_suggestions:
            gait_suggestions = suggestions
        
        if not gait_suggestions:
            return "No active recommendations"
        
        # Sort by priority (HIGH > MEDIUM > LOW)
        priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        gait_suggestions.sort(key=lambda x: priority_order.get(x.get('priority', 'LOW'), 3))
        
        suggestion_text = gait_suggestions[0].get('suggestion_text', '')
        return suggestion_text if suggestion_text else "No recommendations available"
    
    @staticmethod
    def _format_fall_risk(health_score: Dict, gait_snapshot: Dict) -> str:
        """Format fall risk summary"""
        if not health_score:
            risk_level = gait_snapshot.get('fall_risk_level', 'MODERATE')
            return f"Fall risk is {risk_level.lower()}"
        
        risk_level = health_score.get('risk_level', 'MODERATE')
        primary_factor = health_score.get('primary_risk_factor', 'gait instability')
        trend = health_score.get('risk_trend_7d', 'STABLE')
        
        trend_text = {
            'WORSENING': 'and worsening',
            'IMPROVING': 'but improving',
            'STABLE': 'and stable'
        }.get(trend, '')
        
        return f"Fall risk is {risk_level.lower()} due to {primary_factor} {trend_text}"

transformer = DataTransformer()
