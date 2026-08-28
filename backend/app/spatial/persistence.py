from datetime import datetime, date
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from app.core.logging import logger


class PersistenceEngine:
    """
    Computes temporal recurrence metrics, Persistence Ratios,
    and thermal anomaly spikes across clustered satellite observations.
    """

    def __init__(self, persistence_threshold: float = 0.5):
        """
        :param persistence_threshold: Minimum persistence ratio (0.0 to 1.0) to classify as PERSISTENT_OPERATIONAL_SOURCE.
        """
        self.persistence_threshold = persistence_threshold

    def analyze_clusters(
        self,
        clustered_df: pd.DataFrame,
        total_window_days: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Groups clustered observations by 'cluster_id' and computes detailed persistence metrics.
        """
        if clustered_df.empty:
            return pd.DataFrame()

        df = clustered_df.copy()
        
        # Ensure acq_date is parsed as string or datetime for uniform comparisons
        df["acq_date_dt"] = pd.to_datetime(df["acq_date"])

        # Determine time window length in days
        if total_window_days is None:
            min_date = df["acq_date_dt"].min()
            max_date = df["acq_date_dt"].max()
            total_window_days = max(1, (max_date - min_date).days + 1)

        cluster_summaries: List[Dict[str, Any]] = []

        for cluster_id, group in df.groupby("cluster_id"):
            total_detections = len(group)
            active_days_count = group["acq_date_dt"].dt.date.nunique()
            persistence_ratio = round(active_days_count / float(total_window_days), 3)

            first_seen = group["acq_date"].min()
            last_seen = group["acq_date"].max()

            avg_frp = round(float(group["frp"].mean()), 2)
            max_frp = round(float(group["frp"].max()), 2)
            min_frp = round(float(group["frp"].min()), 2)
            std_frp = round(float(group["frp"].std()) if total_detections > 1 else 0.0, 2)

            avg_brightness = round(float(group["brightness"].mean()), 1)
            max_brightness = round(float(group["brightness"].max()), 1)

            centroid_lat = round(float(group["latitude"].mean()), 4)
            centroid_lon = round(float(group["longitude"].mean()), 4)

            # Facility proximity metadata from Phase 2
            nearest_facility = group["nearest_facility_name"].iloc[0] if "nearest_facility_name" in group.columns else "Unknown"
            facility_type = group["nearest_facility_type"].iloc[0] if "nearest_facility_type" in group.columns else "Unknown"
            dist_to_industry = float(group["distance_to_industry_meters"].min()) if "distance_to_industry_meters" in group.columns else float("inf")
            spatial_context = group["spatial_context"].iloc[0] if "spatial_context" in group.columns else "UNKNOWN"

            # Anomaly Spike Detection Logic:
            # 1. Sudden massive thermal power in a non-persistent location
            is_acute_spike = bool(max_frp >= 50.0 and persistence_ratio < 0.4)
            # 2. Significant deviation (> 2 std or > 2.0x avg) in a persistent source
            is_persistent_blowout = bool(total_detections >= 3 and max_frp > (avg_frp + 1.5 * std_frp) and max_frp >= 25.0 and std_frp > 3.0)
            is_anomaly_spike = bool(is_acute_spike or is_persistent_blowout)

            # Persistence Category Assignment
            if persistence_ratio >= self.persistence_threshold:
                category = "PERSISTENT_OPERATIONAL_SOURCE"
            elif persistence_ratio >= 0.2:
                category = "RECURRING_INTERMITTENT"
            else:
                category = "ACUTE_TRANSIENT_EVENT"

            cluster_summaries.append({
                "cluster_id": cluster_id,
                "centroid_lat": centroid_lat,
                "centroid_lon": centroid_lon,
                "nearest_facility_name": nearest_facility,
                "nearest_facility_type": facility_type,
                "distance_to_industry_meters": dist_to_industry,
                "spatial_context": spatial_context,
                "first_seen_date": str(first_seen),
                "last_seen_date": str(last_seen),
                "total_detections": total_detections,
                "active_days_count": active_days_count,
                "total_window_days": total_window_days,
                "persistence_ratio": persistence_ratio,
                "avg_frp": avg_frp,
                "max_frp": max_frp,
                "min_frp": min_frp,
                "std_frp": std_frp,
                "avg_brightness": avg_brightness,
                "max_brightness": max_brightness,
                "is_anomaly_spike": is_anomaly_spike,
                "persistence_category": category
            })

        summary_df = pd.DataFrame(cluster_summaries)
        logger.info(f"Persistence analysis completed for {len(summary_df)} clusters over a {total_window_days}-day window.")
        return summary_df
