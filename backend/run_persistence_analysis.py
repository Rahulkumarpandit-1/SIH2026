import os
import pandas as pd
from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.db_models import RawObservationModel
from app.ingestion.osm_client import OSMClient
from app.spatial.proximity import SpatialProximityEngine
from app.spatial.clustering import SpatioTemporalClusterer
from app.spatial.persistence import PersistenceEngine


def main():
    print("=" * 110)
    print("SIH26162 — PHASE 3: SPATIO-TEMPORAL CLUSTERING & PERSISTENCE ANALYSIS RUNNER")
    print("=" * 110)

    # 1. Load satellite observations from SQLite database
    db = SessionLocal()
    try:
        observations = db.query(RawObservationModel).all()
        if not observations:
            print("No observations found in database. Run 'py backend/run_ingestion.py' first!")
            return
        
        data = []
        for obs in observations:
            data.append({
                "id": obs.id,
                "latitude": obs.latitude,
                "longitude": obs.longitude,
                "brightness": obs.brightness,
                "acq_date": str(obs.acq_date),
                "acq_time": obs.acq_time,
                "frp": obs.frp,
                "confidence": obs.confidence,
                "daynight": obs.daynight
            })
        df = pd.DataFrame(data)
        logger.info(f"Loaded {len(df)} observations from SQLite database.")
    finally:
        db.close()

    # 2. OSM Spatial Proximity Enrichment (Phase 2)
    osm_client = OSMClient()
    industrial_gdf = osm_client.fetch_industrial_features(bbox=settings.default_bbox)
    proximity_engine = SpatialProximityEngine(industrial_gdf)
    enriched_df = proximity_engine.enrich_observations_dataframe(df)

    # 3. Spatio-Temporal Clustering (DBSCAN)
    clusterer = SpatioTemporalClusterer(spatial_radius_meters=750.0)
    clustered_df = clusterer.cluster_observations(enriched_df)

    # 4. Historical Persistence & Recurrence Analysis
    persistence_engine = PersistenceEngine(persistence_threshold=0.5)
    summary_df = persistence_engine.analyze_clusters(clustered_df)

    # 5. Print Detailed Physical Cluster & Persistence Report
    print("\n" + "=" * 110)
    print("PHYSICAL THERMAL CLUSTER SUMMARY & PERSISTENCE ANALYSIS")
    print("=" * 110)
    print(f"{'Cluster ID':<13} | {'Centroid Lat,Lon':<18} | {'Detections':<10} | {'Active Days':<11} | {'P_Ratio':<8} | {'Avg FRP':<8} | {'Max FRP':<8} | {'Spike?':<7} | {'Category'}")
    print("-" * 110)

    for _, row in summary_df.iterrows():
        coords = f"{row['centroid_lat']:.4f}, {row['centroid_lon']:.4f}"
        days_str = f"{row['active_days_count']}/{row['total_window_days']}"
        spike_str = "YES (!)" if row['is_anomaly_spike'] else "No"
        print(f"{row['cluster_id']:<13} | {coords:<18} | {row['total_detections']:<10} | {days_str:<11} | {row['persistence_ratio']:<8.2f} | {row['avg_frp']:<8.1f} | {row['max_frp']:<8.1f} | {spike_str:<7} | {row['persistence_category']}")

    print("=" * 110)

    # 6. Detailed Incident Diagnostics
    print("\nCLUSTER DIAGNOSTICS & FACILITY ASSOCIATION:")
    for _, row in summary_df.iterrows():
        spike_alert = "[ANOMALY SPIKE DETECTED]" if row['is_anomaly_spike'] else "[NORMAL RANGE]"
        print(f"\n[{row['cluster_id']}] Centroid: ({row['centroid_lat']}, {row['centroid_lon']}) | {spike_alert}")
        print(f"  * Nearest Facility  : {row['nearest_facility_name']} ({row['nearest_facility_type']})")
        print(f"  * Distance to Fence : {row['distance_to_industry_meters']:.1f} meters ({row['spatial_context']})")
        print(f"  * Recurrence History: Seen on {row['active_days_count']} of {row['total_window_days']} days (Persistence Ratio: {row['persistence_ratio'] * 100:.1f}%)")
        print(f"  * Thermal Profile   : Avg FRP: {row['avg_frp']} MW | Max FRP: {row['max_frp']} MW | Max Temp: {row['max_brightness']} K")
        print(f"  * System Evaluation : {row['persistence_category']}")

    print("=" * 110)


if __name__ == "__main__":
    main()
