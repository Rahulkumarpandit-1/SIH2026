import os
import numpy as np
import pandas as pd
from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.db_models import RawObservationModel
from app.ingestion.osm_client import OSMClient
from app.spatial.proximity import SpatialProximityEngine
from app.spatial.clustering import SpatioTemporalClusterer
from app.spatial.persistence import PersistenceEngine
from app.scoring.classifier import ThermalFeatureExtractor, ThermalClassifier, CLASS_LABELS


def main():
    print("=" * 115)
    print("SIH26162 — PHASE 5: MACHINE LEARNING EVALUATION & DATASET INTEGRITY BENCHMARK")
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
                "bright_t31": obs.bright_t31,
                "acq_date": str(obs.acq_date),
                "acq_time": obs.acq_time,
                "frp": obs.frp,
                "confidence": obs.confidence,
                "confidence_normalized": obs.confidence_normalized,
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

    # Merge cluster-level persistence metrics back to individual observations
    pers_map = cluster_summary_df.set_index("cluster_id")[["persistence_ratio", "active_days_count", "is_anomaly_spike"]].to_dict(orient="index")
    
    clustered_df["persistence_ratio"] = clustered_df["cluster_id"].map(lambda cid: pers_map.get(cid, {}).get("persistence_ratio", 0.2))
    clustered_df["active_days_count"] = clustered_df["cluster_id"].map(lambda cid: pers_map.get(cid, {}).get("active_days_count", 1))
    clustered_df["is_anomaly_spike"] = clustered_df["cluster_id"].map(lambda cid: pers_map.get(cid, {}).get("is_anomaly_spike", False))

    # 5. Ground-Truth Benchmark Labels
    # Mapping ground truth classes for verified benchmark facilities
    labels = []
    for _, row in clustered_df.iterrows():
        cid = row["cluster_id"]
        # CLUSTER_003 (Hazira 92.7 MW Sudden Spike) -> Class 1 (INDUSTRIAL_FIRE_OUTBREAK)
        if cid == "CLUSTER_003":
            labels.append(1)
        # CLUSTER_004 & CLUSTER_005 (Rural North Gujarat) -> Class 2 (AGRICULTURAL_WILDFIRE)
        elif cid in ["CLUSTER_004", "CLUSTER_005"]:
            labels.append(2)
        # CLUSTER_001 (Jamnagar), CLUSTER_002 (Dahej), CLUSTER_006 (Vadodara) -> Class 0 (PERSISTENT_INDUSTRIAL_SOURCE)
        else:
            labels.append(0)

    y = np.array(labels)
    groups = clustered_df["cluster_id"].to_numpy()

    # 6. Feature Matrix Extraction (Phase 5)
    X, feature_names = ThermalFeatureExtractor.extract_features_from_dataframe(clustered_df)
    print(f"\n[Feature Extraction] Created {X.shape[0]} samples with {X.shape[1]} engineered features:")
    for idx, fname in enumerate(feature_names, start=1):
        print(f"  {idx}. {fname}")

    # 7. Model Training & Feature Importance Analysis
    clf = ThermalClassifier(n_estimators=50, random_state=42)
    clf.fit(X, y)
    importances = clf.get_feature_importances()

    print("\n" + "=" * 115)
    print("RANDOM FOREST FEATURE IMPORTANCE RANKINGS (Which Signals Drove the Predictions)")
    print("=" * 115)
    for feat, imp in importances.items():
        bar = "#" * int(imp * 50)
        print(f"  * {feat:<28} : {imp:.4f} ({imp*100:>5.1f}%) | {bar}")
    print("=" * 115)

    # 8. Spatial Cluster-Aware Cross Validation (Leakage Prevention)
    print("\n[Cross Validation] Running Spatial Group K-Fold Cross Validation (Cluster-Aware Splits)...")
    eval_results = clf.evaluate_spatial_cv(X, y, groups=groups, n_splits=3)

    print("\n" + "=" * 115)
    print("CLASSIFICATION PERFORMANCE METRICS (Cluster-Held-Out Spatial Cross Validation)")
    print("=" * 115)
    print(f"  * Total Folds Evaluated : {eval_results['n_splits']} Spatial Cluster Splits")
    print(f"  * Weighted Precision    : {eval_results['weighted_precision'] * 100:.2f}%")
    print(f"  * Weighted Recall       : {eval_results['weighted_recall'] * 100:.2f}%")
    print(f"  * Weighted F1-Score     : {eval_results['weighted_f1'] * 100:.2f}%")
    print("=" * 115)

    # 9. Comparison: Machine Learning vs. Phase 4 Transparent Rule Engine
    print("\n" + "=" * 115)
    print("COMPARATIVE EVALUATION: MACHINE LEARNING vs. PHASE 4 TRANSPARENT RULE ENGINE")
    print("=" * 115)
    print(f"{'Evaluation Dimension':<30} | {'Phase 4 Transparent Rule Engine':<40} | {'Phase 5 Machine Learning Model'}")
    print("-" * 115)
    print(f"{'Ground Truth Dependency':<30} | {'Zero labeled training data required':<40} | {'Requires verified labeled incident logs'}")
    print(f"{'Explainability & Audit':<30} | {'100% transparent mathematical formula':<40} | {'Ensemble tree decision boundaries'}")
    print(f"{'Edge Case Stability':<30} | {'Deterministic bounds guaranteed':<40} | {'Can overfit on rare extreme outliers'}")
    print(f"{'Recommended Role in SIH':<30} | {'PRIMARY OPERATIONAL DECISION ENGINE':<40} | {'SECONDARY EMPIRICAL BENCHMARK'}")
    print("=" * 115)


if __name__ == "__main__":
    main()
