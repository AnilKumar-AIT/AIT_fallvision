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
        stride_hourly: List[Dict]
    ) -> Dict:
        """Transform DynamoDB gait data to match React gaitData.json format"""
        
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
                "recentAlerts": "Low step frequency detected on [20 Feb]",
                "recommendations": "Increase walking pace to improve step frequency",
                "fallRiskSummary": f"Fall risk elevated due to {gait_snapshot.get('fall_risk_level', 'moderate')} body tilt"
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

transformer = DataTransformer()
