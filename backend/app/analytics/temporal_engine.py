"""
Temporal Intelligence Engine (Phase 12A)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Evaluates temporal dynamics of satellite thermal observations:
- First Detection Timestamp
- Last Detection Timestamp
- Observation Freshness (Minutes elapsed since last satellite overpass)
- Detection Count
- Active Duration (Observation span in hours)
- Incident Age (Hours since first satellite detection)
- Temporal Status Classification:
    * RECENTLY_OBSERVED: Last Detection <= 6 Hours
    * RECENT: 6 Hours < Last Detection <= 24 Hours
    * HISTORICAL: Last Detection > 24 Hours
    (Supports 'ACTIVE' as an alias for 'RECENTLY_OBSERVED' for backward compatibility)

Scientific Grounding:
Status is derived from the latest available satellite infrared observation pass (NASA FIRMS)
and does NOT represent real-time ground truth. Satellite overpass occurs intermittently.
"""

from datetime import datetime, date, time as dt_time, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
import pandas as pd


# Observation-based Temporal Classifications
STATUS_RECENTLY_OBSERVED = "RECENTLY_OBSERVED"  # Last Detection <= 6 Hours
STATUS_RECENT = "RECENT"                        # 6 Hours < Last Detection <= 24 Hours
STATUS_HISTORICAL = "HISTORICAL"                # Last Detection > 24 Hours

# Alias mapping for backward compatibility
TEMPORAL_STATUS_ALIASES = {
    "ACTIVE": STATUS_RECENTLY_OBSERVED,
    "RECENTLY_OBSERVED": STATUS_RECENTLY_OBSERVED,
    "RECENT": STATUS_RECENT,
    "HISTORICAL": STATUS_HISTORICAL
}


def parse_observation_timestamp(acq_date_val: Union[date, str], acq_time_val: Union[str, int]) -> datetime:
    """
    Parses acq_date and acq_time (HHMM UTC) into a timezone-aware UTC datetime.
    Example:
        date(2026, 8, 24), "0820" -> datetime(2026, 8, 24, 8, 20, tzinfo=timezone.utc)
    """
    if isinstance(acq_date_val, str):
        # Support YYYY-MM-DD
        d = datetime.strptime(acq_date_val.strip()[:10], "%Y-%m-%d").date()
    elif isinstance(acq_date_val, datetime):
        d = acq_date_val.date()
    elif isinstance(acq_date_val, date):
        d = acq_date_val
    else:
        d = datetime.now(timezone.utc).date()

    # Sanitize time string to 4 digits HHMM
    t_str = str(acq_time_val).strip().replace(":", "")
    if len(t_str) < 4:
        t_str = t_str.zfill(4)
    t_str = t_str[:4]

    try:
        hours = int(t_str[:2])
        mins = int(t_str[2:4])
        # Clamping
        hours = max(0, min(23, hours))
        mins = max(0, min(59, mins))
    except (ValueError, IndexError):
        hours, mins = 0, 0

    return datetime(d.year, d.month, d.day, hours, mins, tzinfo=timezone.utc)


class TemporalEngine:
    """
    Evaluates temporal patterns and freshness across a cluster of satellite observations.
    """

    SCIENTIFIC_DISCLOSURE = (
        "Observation-Derived Status: Incident status ('RECENTLY_OBSERVED', 'RECENT', 'HISTORICAL') "
        "is derived strictly from the latest orbital infrared satellite pass (NASA FIRMS) and does "
        "not represent real-time physical ground confirmation. Satellite overpass cycles occur periodically."
    )

    @classmethod
    def classify_temporal_status(cls, hours_since_last: float) -> str:
        """
        Classifies temporal status strictly by hours since last satellite detection:
        - RECENTLY_OBSERVED: <= 6 Hours
        - RECENT: > 6 Hours and <= 24 Hours
        - HISTORICAL: > 24 Hours
        """
        if hours_since_last <= 6.0:
            return STATUS_RECENTLY_OBSERVED
        elif hours_since_last <= 24.0:
            return STATUS_RECENT
        else:
            return STATUS_HISTORICAL

    @classmethod
    def evaluate_observations(
        cls,
        observations: List[Dict[str, Any]],
        reference_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Computes temporal metrics for a list of observation dictionaries.
        Each observation dictionary should have:
            - acq_date: date or YYYY-MM-DD string
            - acq_time: HHMM string
            - frp: float (optional)
            - brightness: float (optional)
        """
        if not observations:
            ref = reference_time or datetime.now(timezone.utc)
            ref_iso = ref.isoformat()
            return {
                "first_detected": ref_iso,
                "last_detected": ref_iso,
                "incident_age_hours": 0.0,
                "active_duration_hours": 0.0,
                "detection_count": 0,
                "observation_freshness_minutes": 0.0,
                "temporal_status": STATUS_HISTORICAL,
                "is_recently_observed": False,
                "scientific_disclosure": cls.SCIENTIFIC_DISCLOSURE,
                "reference_time": ref_iso
            }

        # Parse all observation timestamps
        parsed_timestamps: List[datetime] = []
        for obs in observations:
            ad = obs.get("acq_date")
            at = obs.get("acq_time", "0000")
            parsed_timestamps.append(parse_observation_timestamp(ad, at))

        parsed_timestamps.sort()
        first_dt = parsed_timestamps[0]
        last_dt = parsed_timestamps[-1]

        # Use given reference time or now UTC
        ref_dt = reference_time
        if ref_dt is None:
            ref_dt = datetime.now(timezone.utc)
        elif ref_dt.tzinfo is None:
            ref_dt = ref_dt.replace(tzinfo=timezone.utc)

        # Calculate time deltas
        freshness_seconds = max(0.0, (ref_dt - last_dt).total_seconds())
        freshness_minutes = round(freshness_seconds / 60.0, 1)
        hours_since_last = freshness_seconds / 3600.0

        age_seconds = max(0.0, (ref_dt - first_dt).total_seconds())
        incident_age_hours = round(age_seconds / 3600.0, 2)

        active_duration_seconds = max(0.0, (last_dt - first_dt).total_seconds())
        active_duration_hours = round(active_duration_seconds / 3600.0, 2)

        status = cls.classify_temporal_status(hours_since_last)

        return {
            "first_detected": first_dt.isoformat(),
            "last_detected": last_dt.isoformat(),
            "incident_age_hours": incident_age_hours,
            "active_duration_hours": active_duration_hours,
            "detection_count": len(parsed_timestamps),
            "observation_freshness_minutes": freshness_minutes,
            "temporal_status": status,
            "is_recently_observed": (status == STATUS_RECENTLY_OBSERVED),
            "scientific_disclosure": cls.SCIENTIFIC_DISCLOSURE,
            "reference_time": ref_dt.isoformat()
        }

    @classmethod
    def evaluate_cluster_dataframe(
        cls,
        cluster_obs_df: pd.DataFrame,
        reference_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Convenience method accepting a pandas DataFrame."""
        if cluster_obs_df.empty:
            return cls.evaluate_observations([], reference_time=reference_time)
        
        obs_records = cluster_obs_df.to_dict(orient="records")
        return cls.evaluate_observations(obs_records, reference_time=reference_time)
