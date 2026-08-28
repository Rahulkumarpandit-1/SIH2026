import pytest
import pandas as pd
from app.spatial.clustering import SpatioTemporalClusterer
from app.spatial.persistence import PersistenceEngine


def test_dbscan_groups_nearby_hotspots():
    """Verify that observations within 500m are assigned the same cluster ID."""
    df = pd.DataFrame([
        {"latitude": 22.4707, "longitude": 70.0577, "acq_date": "2026-08-20", "frp": 14.2, "brightness": 348.5},
        {"latitude": 22.4712, "longitude": 70.0581, "acq_date": "2026-08-21", "frp": 16.5, "brightness": 352.1},
        {"latitude": 22.4709, "longitude": 70.0579, "acq_date": "2026-08-22", "frp": 18.9, "brightness": 355.8},
        # Distant rural point (~150 km away)
        {"latitude": 23.8512, "longitude": 71.2145, "acq_date": "2026-08-23", "frp": 5.6, "brightness": 335.2}
    ])

    clusterer = SpatioTemporalClusterer(spatial_radius_meters=750.0)
    clustered_df = clusterer.cluster_observations(df)

    assert "cluster_id" in clustered_df.columns
    # The first 3 Jamnagar points should share the same cluster ID
    assert clustered_df.iloc[0]["cluster_id"] == clustered_df.iloc[1]["cluster_id"] == clustered_df.iloc[2]["cluster_id"]
    # The distant rural point must have a different cluster ID
    assert clustered_df.iloc[3]["cluster_id"] != clustered_df.iloc[0]["cluster_id"]


def test_persistence_ratio_and_classification():
    """Verify that recurring detections yield high persistence and correct operational categorization."""
    clustered_df = pd.DataFrame([
        {
            "cluster_id": "CLUSTER_001",
            "latitude": 22.4707, "longitude": 70.0577,
            "acq_date": "2026-08-20", "frp": 14.2, "brightness": 348.5,
            "nearest_facility_name": "Jamnagar Refinery", "nearest_facility_type": "oil_refinery",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        },
        {
            "cluster_id": "CLUSTER_001",
            "latitude": 22.4712, "longitude": 70.0581,
            "acq_date": "2026-08-21", "frp": 16.5, "brightness": 352.1,
            "nearest_facility_name": "Jamnagar Refinery", "nearest_facility_type": "oil_refinery",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        },
        {
            "cluster_id": "CLUSTER_001",
            "latitude": 22.4709, "longitude": 70.0579,
            "acq_date": "2026-08-22", "frp": 18.9, "brightness": 355.8,
            "nearest_facility_name": "Jamnagar Refinery", "nearest_facility_type": "oil_refinery",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        },
        {
            "cluster_id": "CLUSTER_001",
            "latitude": 22.4708, "longitude": 70.0578,
            "acq_date": "2026-08-23", "frp": 22.4, "brightness": 360.2,
            "nearest_facility_name": "Jamnagar Refinery", "nearest_facility_type": "oil_refinery",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        },
        {
            "cluster_id": "CLUSTER_001",
            "latitude": 22.4710, "longitude": 70.0580,
            "acq_date": "2026-08-24", "frp": 29.1, "brightness": 368.7,
            "nearest_facility_name": "Jamnagar Refinery", "nearest_facility_type": "oil_refinery",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        }
    ])

    engine = PersistenceEngine(persistence_threshold=0.5)
    summary_df = engine.analyze_clusters(clustered_df, total_window_days=5)

    assert len(summary_df) == 1
    row = summary_df.iloc[0]
    assert row["active_days_count"] == 5
    assert row["total_detections"] == 5
    assert row["persistence_ratio"] == 1.0
    assert row["persistence_category"] == "PERSISTENT_OPERATIONAL_SOURCE"
    assert row["avg_frp"] == pytest.approx(20.22, abs=0.1)


def test_acute_anomaly_spike_detection():
    """Verify that a sudden, high-power single-day spike is flagged as an anomaly spike."""
    clustered_df = pd.DataFrame([
        {
            "cluster_id": "CLUSTER_HAZIRA",
            "latitude": 21.1685, "longitude": 72.6954,
            "acq_date": "2026-08-24", "frp": 68.4, "brightness": 375.4,
            "nearest_facility_name": "Hazira Steel Complex", "nearest_facility_type": "steel",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        },
        {
            "cluster_id": "CLUSTER_HAZIRA",
            "latitude": 21.1691, "longitude": 72.6960,
            "acq_date": "2026-08-24", "frp": 92.7, "brightness": 388.9,
            "nearest_facility_name": "Hazira Steel Complex", "nearest_facility_type": "steel",
            "distance_to_industry_meters": 0.0, "spatial_context": "INSIDE_INDUSTRIAL_ZONE"
        }
    ])

    engine = PersistenceEngine(persistence_threshold=0.5)
    summary_df = engine.analyze_clusters(clustered_df, total_window_days=5)

    assert len(summary_df) == 1
    row = summary_df.iloc[0]
    assert row["persistence_ratio"] == 0.2  # 1 day out of 5
    assert bool(row["is_anomaly_spike"]) is True
    assert row["persistence_category"] == "RECURRING_INTERMITTENT"
    assert row["max_frp"] == 92.7
