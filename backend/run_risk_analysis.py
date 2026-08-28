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
from app.scoring.risk_engine import RiskScoringEngine


def main():
    print("=" * 115)
    print("SIH26162 — PHASE 4: MULTI-SIGNAL RISK SCORING & INCIDENT PRIORITIZATION DASHBOARD")
    print("=" * 115)

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

    # 3. Spatio-Temporal Clustering (Phase 3)
    clusterer = SpatioTemporalClusterer(spatial_radius_meters=750.0)
    clustered_df = clusterer.cluster_observations(enriched_df)

    # 4. Historical Persistence & Recurrence (Phase 3)
    persistence_engine = PersistenceEngine(persistence_threshold=0.5)
    cluster_summary_df = persistence_engine.analyze_clusters(clustered_df)

    # 5. Multi-Signal Risk Scoring (Phase 4)
    scored_clusters_df = RiskScoringEngine.score_clusters_dataframe(cluster_summary_df)

    # 6. Display Ranked Incident Prioritization Table
    print("\n" + "=" * 115)
    print("RANKED INCIDENT PRIORITIZATION QUEUE (Sorted by Risk Score DESC)")
    print("=" * 115)
    print(f"{'Rank':<4} | {'Cluster ID':<12} | {'Risk Score':<10} | {'Level':<10} | {'Action Code':<20} | {'Max FRP':<8} | {'P_Ratio':<8} | {'Facility / Area'}")
    print("-" * 115)

    for rank, (_, row) in enumerate(scored_clusters_df.iterrows(), start=1):
        facility = f"{row['nearest_facility_name']}"
        print(f"#{rank:<3} | {row['cluster_id']:<12} | {row['risk_score']:<10.1f} | {row['risk_level']:<10} | {row['action_code']:<20} | {row['max_frp']:<8.1f} | {row['persistence_ratio']:<8.2f} | {facility[:35]}")

    print("=" * 115)

    # 7. Mathematical Sub-Score Diagnostic Breakdown
    print("\nMATHEMATICAL SUB-SCORE BREAKDOWN:")
    for _, row in scored_clusters_df.iterrows():
        print(f"\n[{row['cluster_id']}] -> Composite Risk: {row['risk_score']:.1f}/100 [{row['risk_level']}]")
        print(f"  * Classification     : {row['incident_classification']}")
        print(f"  * Nearest Facility   : {row['nearest_facility_name']} ({row['nearest_facility_type']}) - {row['distance_to_industry_meters']:.1f}m")
        print(f"  * Thermal Subscore   : {row['thermal_subscore']:.1f}/100 (Max FRP: {row['max_frp']} MW, Max Temp: {row['max_brightness']} K)")
        print(f"  * Proximity Subscore : {row['proximity_subscore']:.1f}/100 (Context: {row['spatial_context']})")
        print(f"  * Persistence Subscore: {row['persistence_subscore']:.1f}/100 (Persistence Ratio: {row['persistence_ratio']*100:.1f}%, Spike: {row['is_anomaly_spike']})")
        print(f"  * Confidence Subscore: {row['confidence_subscore']:.1f}/100")

    print("\n" + "=" * 115)


if __name__ == "__main__":
    main()
