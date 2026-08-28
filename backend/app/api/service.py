import os
import json
import uuid
import time
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import joblib

from app.core.config import settings
from app.core.logging import logger
from app.db.db_models import RawObservationModel
from app.ingestion.osm_client import OSMClient
from app.ingestion.historical_firms import HistoricalFIRMSIngester
from app.spatial.proximity import SpatialProximityEngine
from app.spatial.clustering import SpatioTemporalClusterer
from app.spatial.persistence import PersistenceEngine
from app.scoring.risk_engine import RiskScoringEngine
from app.scoring.classifier import (
    CLASS_LABELS,
    FEATURE_COLUMNS,
    MLReadinessEvaluator,
    MLReadinessStatus,
    ProductionMLTrainer,
    ThermalFeatureExtractor,
    ThermalClassifier
)
from app.dataset.ground_truth import GroundTruthRegistry, GroundTruthReviewRequest, TargetClass
from app.dataset.builder import DatasetBuilder
from app.models.schemas import MLPredictRequest, MLPredictResponse, DataRefreshRequest, DataRefreshResponse


class PipelineService:
    """
    Service layer orchestrating the verified Phases 1-8 pipeline execution in memory.
    Reads from the database with in-memory caching to achieve ultra-fast (<2ms) responses.
    """
    _cached_data: Optional[Dict[str, Any]] = None
    _cached_record_count: Optional[int] = None
    _cached_ml: Optional[Dict[str, Any]] = None
    _cached_quality_report: Optional[Dict[str, Any]] = None
    _is_refreshing: bool = False
    _last_refresh_status: Dict[str, Any] = {
        "status": "IDLE",
        "job_id": None,
        "start_time": None,
        "end_time": None,
        "sensor": None,
        "rows_received": 0,
        "rows_added": 0,
        "rows_duplicate": 0,
        "error": None
    }

    @classmethod
    def invalidate_cache(cls):
        """Clears all cached in-memory representations."""
        cls._cached_data = None
        cls._cached_record_count = None
        cls._cached_ml = None
        cls._cached_quality_report = None

    @classmethod
    def get_analyzed_data(cls, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes the verified analysis pipeline on stored observations with in-memory caching:
        DB Observations -> OSM Proximity -> DBSCAN Clustering -> Persistence -> Risk Scoring -> Ground Truth
        """
        records = db.query(RawObservationModel).all()
        current_count = len(records)

        if not force_refresh and cls._cached_data is not None and cls._cached_record_count == current_count:
            return cls._cached_data

        if not records:
            logger.warning("No observations found in database during API execution.")
            return {
                "observations_df": pd.DataFrame(),
                "clusters_df": pd.DataFrame(),
                "osm_geojson": {"type": "FeatureCollection", "features": []}
            }

        data = []
        for obs in records:
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
                "daynight": obs.daynight,
                "satellite": obs.satellite,
                "instrument": obs.instrument
            })
        df_obs = pd.DataFrame(data)

        # 1. Spatial & Persistence Enrichment via DatasetBuilder
        builder = DatasetBuilder()
        builder.register_known_historical_ground_truth()
        enriched_df = builder.process_and_enrich_observations(df_obs)

        # 2. Persistence Analysis on Cluster Summary
        persistence_engine = PersistenceEngine(persistence_threshold=0.5)
        cluster_summary_df = persistence_engine.analyze_clusters(enriched_df)

        # 3. Multi-Signal Risk Scoring (Phase 4)
        scored_clusters_df = RiskScoringEngine.score_clusters_dataframe(cluster_summary_df)

        # Merge cluster-level risk score and classification back to observation level
        risk_map = scored_clusters_df.set_index("cluster_id")[
            ["risk_score", "risk_level", "incident_classification", "action_code"]
        ].to_dict(orient="index")

        enriched_df["risk_score"] = enriched_df["cluster_id"].map(
            lambda cid: risk_map.get(cid, {}).get("risk_score", 0.0)
        )
        enriched_df["risk_level"] = enriched_df["cluster_id"].map(
            lambda cid: risk_map.get(cid, {}).get("risk_level", "LOW")
        )
        enriched_df["incident_classification"] = enriched_df["cluster_id"].map(
            lambda cid: risk_map.get(cid, {}).get("incident_classification", "NON_INDUSTRIAL_RURAL")
        )
        enriched_df["action_code"] = enriched_df["cluster_id"].map(
            lambda cid: risk_map.get(cid, {}).get("action_code", "BACKGROUND_LOG")
        )

        # 4. Prepare OSM GeoJSON for the frontend map layer
        osm_client = OSMClient()
        industrial_gdf = osm_client.fetch_industrial_features(bbox=settings.default_bbox)
        try:
            osm_geojson_str = industrial_gdf.to_json()
            osm_geojson = json.loads(osm_geojson_str)
        except Exception as e:
            logger.error(f"Error converting OSM GeoDataFrame to GeoJSON: {e}")
            osm_geojson = {"type": "FeatureCollection", "features": []}

        result = {
            "observations_df": enriched_df,
            "clusters_df": scored_clusters_df,
            "osm_geojson": osm_geojson
        }
        cls._cached_data = result
        cls._cached_record_count = current_count
        return result

    @classmethod
    def get_ground_truth_feed(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Returns list of observations with telemetry and current ground truth status
        for human reviewer inspection.
        """
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]
        if obs_df.empty:
            return []

        results = []
        for _, row in obs_df.iterrows():
            results.append({
                "observation_id": int(row["id"]),
                "latitude": round(float(row["latitude"]), 6),
                "longitude": round(float(row["longitude"]), 6),
                "acq_date": str(row["acq_date"]),
                "acq_time": str(row["acq_time"]),
                "frp": round(float(row["frp"]), 2),
                "brightness": round(float(row["brightness"]), 2),
                "bright_t31": round(float(row.get("bright_t31", row["brightness"] - 30.0)), 2),
                "thermal_contrast": round(float(row.get("thermal_contrast", 30.0)), 2),
                "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
                "nearest_facility_name": str(row.get("nearest_facility_name", "Industrial Zone")),
                "cluster_id": str(row.get("cluster_id", "CLUSTER_0")),
                "persistence_ratio": round(float(row.get("persistence_ratio", 0.2)), 4),
                "active_days_count": int(row.get("active_days_count", 1)),
                "is_anomaly_spike": bool(row.get("is_anomaly_spike", False)),
                "label": int(row["label"]) if pd.notnull(row.get("label")) else None,
                "label_name": str(row.get("label_name", "UNLABELED")),
                "label_source": str(row.get("label_source", "UNVERIFIED")),
                "label_confidence": float(row["label_confidence"]) if pd.notnull(row.get("label_confidence")) else None,
                "source_reference": str(row["source_reference"]) if pd.notnull(row.get("source_reference")) else None,
                "reviewer": str(row["reviewer"]) if pd.notnull(row.get("reviewer")) else None,
                "review_notes": str(row["review_notes"]) if pd.notnull(row.get("review_notes")) else None
            })
        return results

    @classmethod
    def get_observation_by_id(cls, observation_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """
        Returns full contextual telemetry and review provenance for a single observation ID.
        """
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]
        if obs_df.empty:
            return None

        match = obs_df[obs_df["id"] == observation_id]
        if match.empty:
            return None

        row = match.iloc[0]
        return {
            "observation_id": int(row["id"]),
            "latitude": round(float(row["latitude"]), 6),
            "longitude": round(float(row["longitude"]), 6),
            "acq_date": str(row["acq_date"]),
            "acq_time": str(row["acq_time"]),
            "satellite": str(row.get("satellite", "N")),
            "instrument": str(row.get("instrument", "VIIRS")),
            "confidence": str(row.get("confidence", "nominal")),
            "confidence_normalized": round(float(row.get("confidence_normalized", 0.8)), 2),
            "frp": round(float(row["frp"]), 2),
            "brightness": round(float(row["brightness"]), 2),
            "bright_t31": round(float(row.get("bright_t31", row["brightness"] - 30.0)), 2),
            "thermal_contrast": round(float(row.get("thermal_contrast", 30.0)), 2),
            "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
            "nearest_facility_name": str(row.get("nearest_facility_name", "Industrial Zone")),
            "nearest_facility_type": str(row.get("nearest_facility_type", "industrial")),
            "spatial_context": str(row.get("spatial_context", "INSIDE_INDUSTRIAL_ZONE")),
            "cluster_id": str(row.get("cluster_id", "CLUSTER_0")),
            "persistence_ratio": round(float(row.get("persistence_ratio", 0.2)), 4),
            "active_days_count": int(row.get("active_days_count", 1)),
            "is_anomaly_spike": bool(row.get("is_anomaly_spike", False)),
            "risk_score": round(float(row.get("risk_score", 0.0)), 2),
            "risk_level": str(row.get("risk_level", "LOW")),
            "action_code": str(row.get("action_code", "BACKGROUND_LOG")),
            "incident_classification": str(row.get("incident_classification", "NON_INDUSTRIAL_RURAL")),
            "label": int(row["label"]) if pd.notnull(row.get("label")) else None,
            "label_name": str(row.get("label_name", "UNLABELED")),
            "label_source": str(row.get("label_source", "UNVERIFIED")),
            "label_confidence": float(row["label_confidence"]) if pd.notnull(row.get("label_confidence")) else None,
            "source_reference": str(row["source_reference"]) if pd.notnull(row.get("source_reference")) else None,
            "reviewer": str(row["reviewer"]) if pd.notnull(row.get("reviewer")) else None,
            "review_notes": str(row["review_notes"]) if pd.notnull(row.get("review_notes")) else None
        }

    @classmethod
    def submit_ground_truth_review(cls, review_req: GroundTruthReviewRequest, db: Session) -> Dict[str, Any]:
        """
        Adds human verified review annotation, saves to disk, and invalidates in-memory caches.
        """
        registry = GroundTruthRegistry()
        prov = registry.add_human_review(review_req)
        
        # Invalidate pipeline cache to reflect updated labels
        cls.invalidate_cache()

        # Update dataset export splits in data/ml/
        pipeline_data = cls.get_analyzed_data(db, force_refresh=True)
        obs_df = pipeline_data["observations_df"]
        builder = DatasetBuilder()
        builder.split_and_save_datasets(obs_df)

        labeled_df = obs_df[obs_df["label"].notnull()]
        builder.export_ml_splits(labeled_df)

        return {
            "status": "SUCCESS",
            "message": f"Review recorded for ({review_req.latitude:.4f}, {review_req.longitude:.4f}) on {review_req.acq_date}",
            "provenance": prov.model_dump()
        }

    @classmethod
    def get_ground_truth_quality(cls, db: Session) -> Dict[str, Any]:
        """
        Returns ground truth quality and class distribution statistics.
        """
        registry = GroundTruthRegistry()
        registry_stats = registry.get_ground_truth_quality()

        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]
        
        total_obs = len(obs_df) if not obs_df.empty else 0
        labeled_obs = int(obs_df["label"].notnull().sum()) if not obs_df.empty else 0
        unlabeled_obs = total_obs - labeled_obs

        return {
            **registry_stats,
            "total_observations_in_db": total_obs,
            "active_labeled_count": labeled_obs,
            "active_unlabeled_count": unlabeled_obs,
            "labeled_fraction": round(labeled_obs / total_obs, 4) if total_obs > 0 else 0.0
        }

    @classmethod
    def get_ml_status(cls, db: Session) -> Dict[str, Any]:
        """
        Evaluates empirical ML readiness and returns honest status without fabricating accuracy.
        """
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]

        labeled_df = obs_df[obs_df["label"].notnull()] if not obs_df.empty and "label" in obs_df.columns else pd.DataFrame()
        return MLReadinessEvaluator.evaluate(labeled_df)

    @classmethod
    def predict_ml(cls, req: MLPredictRequest, db: Session) -> MLPredictResponse:
        """
        Performs 9D ML inference if valid trained model exists.
        If ML readiness is NOT_READY, returns honest fallback response.
        """
        ml_status_info = cls.get_ml_status(db)
        features_dict = {
            "frp": req.frp,
            "brightness": req.brightness,
            "bright_t31": req.bright_t31 if req.bright_t31 is not None else req.brightness - 30.0,
            "thermal_contrast": req.thermal_contrast if req.thermal_contrast is not None else (
                req.brightness - (req.bright_t31 if req.bright_t31 is not None else req.brightness - 30.0)
            ),
            "distance_to_industry_meters": req.distance_to_industry_meters,
            "persistence_ratio": req.persistence_ratio,
            "active_days_count": req.active_days_count,
            "is_anomaly_spike": req.is_anomaly_spike,
            "confidence_normalized": req.confidence_normalized
        }

        # Check for persisted model
        models_dir = Path(__file__).resolve().parent.parent.parent / "models"
        model_path = models_dir / "model.joblib"
        manifest_path = models_dir / "training_manifest.json"
        
        is_trained_model = False
        if model_path.exists() and manifest_path.exists():
            try:
                manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest_data.get("training_status") == "SUCCESS":
                    is_trained_model = True
            except Exception:
                is_trained_model = False

        if not is_trained_model or ml_status_info.get("status") == MLReadinessStatus.NOT_READY.value:
            return MLPredictResponse(
                ml_status="NOT_READY",
                prediction_available=False,
                predicted_class=None,
                predicted_class_name=None,
                class_probabilities=None,
                model_type=None,
                scientific_warning=(
                    "Supervised machine learning is currently NOT statistically defensible due to insufficient "
                    "verified multi-class ground truth. Predictions are withheld in adherence to scientific integrity. "
                    "The Phase 4 Transparent Rule Engine remains the primary operational system."
                ),
                features_used=features_dict
            )

        try:
            model = joblib.load(model_path)

            feat_vec = np.array([[
                features_dict["frp"],
                features_dict["brightness"],
                features_dict["bright_t31"],
                features_dict["thermal_contrast"],
                features_dict["distance_to_industry_meters"],
                features_dict["persistence_ratio"],
                features_dict["active_days_count"],
                features_dict["is_anomaly_spike"],
                features_dict["confidence_normalized"]
            ]])

            pred_class = int(model.predict(feat_vec)[0])
            pred_name = CLASS_LABELS.get(pred_class, f"CLASS_{pred_class}")
            
            probs = {}
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(feat_vec)[0]
                classes = model.classes_
                for c, p in zip(classes, proba):
                    probs[CLASS_LABELS.get(int(c), str(c))] = round(float(p), 4)

            return MLPredictResponse(
                ml_status="EXPERIMENTAL_BENCHMARK",
                prediction_available=True,
                predicted_class=pred_class,
                predicted_class_name=pred_name,
                class_probabilities=probs,
                model_type=type(model).__name__,
                scientific_warning="Experimental ML inference only. Primary operational baseline is Phase 4 Rule Engine.",
                features_used=features_dict
            )

        except Exception as e:
            logger.error(f"Error during ML prediction: {e}")
            return MLPredictResponse(
                ml_status="ERROR",
                prediction_available=False,
                scientific_warning=f"Inference execution error: {str(e)}",
                features_used=features_dict
            )

    @classmethod
    def refresh_firms_data(cls, req: DataRefreshRequest, db: Session) -> DataRefreshResponse:
        """
        Executes real FIRMS data refresh, deduplicates against database,
        commits new records, invalidates caches, and returns ingestion statistics.
        """
        start_time = time.time()
        job_id = f"job_refresh_{uuid.uuid4().hex[:8]}"
        ingester = HistoricalFIRMSIngester()

        logger.info(f"Initiating FIRMS data refresh: sensor={req.sensor}, days={req.days}, date_range={req.start_date}..{req.end_date}")

        if req.start_date and req.end_date:
            df_raw, meta_list = ingester.fetch_historical_chunks(
                start_date=req.start_date,
                end_date=req.end_date,
                bbox=req.bbox or settings.default_bbox,
                sensor=req.sensor
            )
        else:
            df_raw, meta = ingester.fetch_and_archive_area(
                bbox=req.bbox or settings.default_bbox,
                sensor=req.sensor,
                day_range=req.days,
                save_raw=True
            )

        if df_raw.empty:
            return DataRefreshResponse(
                job_id=job_id,
                status="EMPTY_RESPONSE_OR_ERROR",
                rows_received=0,
                rows_added=0,
                rows_duplicate=0,
                date_range={"start": None, "end": None},
                sensor=req.sensor,
                execution_time_seconds=round(time.time() - start_time, 3)
            )

        # Ingest and save to DB
        from app.ingestion.firms_client import FIRMSClient
        client = FIRMSClient()
        summary, new_models = client.ingest_and_save(
            db=db,
            df=df_raw,
            source_name="NASA_FIRMS_HISTORICAL_EXPANSION",
            sensor_name=req.sensor
        )

        # Invalidate in-memory caches
        cls.invalidate_cache()

        # Update dataset export
        pipeline_data = cls.get_analyzed_data(db, force_refresh=True)
        obs_df = pipeline_data["observations_df"]
        builder = DatasetBuilder()
        builder.split_and_save_datasets(obs_df)
        labeled_df = obs_df[obs_df["label"].notnull()]
        builder.export_ml_splits(labeled_df)

        dates = sorted(df_raw["acq_date"].astype(str).unique().tolist()) if "acq_date" in df_raw.columns else []

        return DataRefreshResponse(
            job_id=job_id,
            status="SUCCESS",
            rows_received=summary.total_received,
            rows_added=summary.valid_records,
            rows_duplicate=summary.duplicates_skipped,
            date_range={"start": dates[0] if dates else None, "end": dates[-1] if dates else None},
            sensor=req.sensor,
            execution_time_seconds=round(time.time() - start_time, 3)
        )

    @classmethod
    def get_ml_evaluation(cls, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes the Phase 5/8 Spatial ML benchmark evaluation using Random Forest
        and Spatial Group K-Fold cross validation on the active feature matrix.
        Includes full scientific disclosures regarding dataset size sufficiency.
        """
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]

        if obs_df.empty:
            return {
                "status": "INSUFFICIENT_DATA",
                "feature_names": [],
                "feature_importances": {},
                "spatial_cv": {},
                "model_summary": {
                    "total_samples": 0,
                    "total_clusters": 0
                }
            }

        if not force_refresh and cls._cached_ml is not None and cls._cached_record_count == len(obs_df):
            return cls._cached_ml

        extractor = ThermalFeatureExtractor()
        X, feature_names = extractor.extract_features_from_dataframe(obs_df)

        # Baseline benchmark target: 1 if high hazard (risk >= 60.0), 0 otherwise
        y = (obs_df["risk_score"] >= 60.0).astype(int).values

        classifier = ThermalClassifier(n_estimators=50, random_state=42)
        classifier.fit(X, y)
        importances = classifier.get_feature_importances()

        groups = obs_df["cluster_id"].values
        cv_results = classifier.evaluate_spatial_cv(X, y, groups=groups, n_splits=3)

        # Count verified ground truth labels
        labeled_count = int(obs_df["label"].notnull().sum())
        total_count = len(obs_df)
        is_statistically_valid = labeled_count >= 50

        result = {
            "status": "BENCHMARK_EVALUATION",
            "model_type": "RandomForestClassifier (Spatial Group K-Fold)",
            "is_statistically_valid": is_statistically_valid,
            "scientific_assessment": (
                "Sufficient verified ground-truth data available for supervised training."
                if is_statistically_valid
                else "Experimental spatial benchmark only. Insufficient verified ground-truth labels for statistically valid multi-class evaluation. Phase 4 Rule Engine remains the primary operational MVP."
            ),
            "feature_names": feature_names,
            "feature_importances": importances,
            "spatial_cv": cv_results,
            "model_summary": {
                "total_samples": int(total_count),
                "total_clusters": int(len(set(groups))),
                "labeled_samples": labeled_count,
                "unlabeled_samples": total_count - labeled_count,
                "high_risk_ratio": float(y.mean())
            }
        }
        cls._cached_ml = result
        return result

    @classmethod
    def get_dataset_quality(cls, db: Session) -> Dict[str, Any]:
        """Returns the Phase 7/8 Data Quality Report."""
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]
        builder = DatasetBuilder()
        return builder.generate_quality_report(obs_df, obs_df, duplicates_dropped=0)

    @classmethod
    def get_dataset_provenance(cls) -> List[Dict[str, Any]]:
        """Returns the ground truth provenance catalog."""
        builder = DatasetBuilder()
        builder.register_known_historical_ground_truth()
        
        items = []
        for reg in builder.registry._registry:
            prov = reg["provenance"]
            items.append({
                "latitude": reg["latitude"],
                "longitude": reg["longitude"],
                "radius_meters": reg["radius_meters"],
                "date": reg["date"],
                "label": prov.label,
                "label_name": prov.label_name,
                "label_source": prov.label_source,
                "label_confidence": prov.label_confidence,
                "source_reference": prov.source_reference,
                "reviewer": prov.reviewer,
                "review_notes": prov.review_notes
            })
        return items
