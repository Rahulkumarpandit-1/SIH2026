import os
import json
import uuid
import time
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import joblib

from app.core.config import settings
from app.core.logging import logger
from app.db.db_models import RawObservationModel
from app.ingestion.osm_client import OSMClient
from app.ingestion.historical_firms import HistoricalFIRMSIngester
from app.ingestion.weather_client import WeatherClient
from app.spatial.proximity import SpatialProximityEngine
from app.spatial.clustering import SpatioTemporalClusterer
from app.spatial.persistence import PersistenceEngine
from app.scoring.risk_engine import RiskScoringEngine
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
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
from app.core.regions import tag_coordinates
from app.models.schemas import (
    MLPredictRequest, 
    MLPredictResponse, 
    DataRefreshRequest, 
    DataRefreshResponse,
    DataRefreshStatusResponse
)


class PipelineService:
    """
    Service layer orchestrating the verified near-real-time and historical pipeline execution in memory.
    Reads from the database with in-memory caching to achieve ultra-fast (<2ms) responses.
    """
    _cached_data: Optional[Dict[str, Any]] = None
    _cached_record_count: Optional[int] = None
    _cached_ml: Optional[Dict[str, Any]] = None
    _cached_quality_report: Optional[Dict[str, Any]] = None

    _refresh_lock = threading.Lock()
    _pipeline_lock = threading.Lock()
    _last_refresh_status: Dict[str, Any] = {
        "status": "IDLE",
        "job_id": None,
        "started_at": None,
        "last_success": None,
        "last_checked": None,
        "next_scheduled_refresh": None,
        "new_observations": 0,
        "duplicates": 0,
        "duration_seconds": 0.0,
        "refresh_interval_minutes": settings.LIVE_REFRESH_INTERVAL_MINUTES,
        "active_sensor": settings.DEFAULT_SENSOR,
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
    def get_refresh_status(cls) -> Dict[str, Any]:
        """Returns the current operational state of the near-real-time refresh job."""
        st = dict(cls._last_refresh_status)
        now = datetime.now(timezone.utc)
        interval_mins = max(1, settings.LIVE_REFRESH_INTERVAL_MINUTES)

        # Parse or recalculate next_scheduled_refresh to ensure it is always in the future
        next_dt: Optional[datetime] = None
        next_raw = st.get("next_scheduled_refresh")
        if next_raw:
            try:
                parsed = datetime.fromisoformat(str(next_raw))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                if parsed > now:
                    next_dt = parsed
            except Exception:
                next_dt = None

        if next_dt is None:
            # Advance to the next future scheduled check cycle
            next_dt = now + timedelta(minutes=interval_mins)
            st["next_scheduled_refresh"] = next_dt.isoformat()

        # Non-negative countdown calculation strictly guaranteed
        remaining_secs = max(0, int((next_dt - now).total_seconds()))
        st["next_satellite_check_seconds"] = remaining_secs
        return st

    @classmethod
    def get_analyzed_data(cls, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes the verified analysis pipeline on stored observations with in-memory caching:
        DB Observations -> OSM Proximity -> DBSCAN Clustering -> Persistence -> Risk Scoring -> Ground Truth
        """
        # Fast path if cache is already warm
        if not force_refresh and cls._cached_data is not None:
            return cls._cached_data

        with cls._pipeline_lock:
            # Check cache again inside lock
            if not force_refresh and cls._cached_data is not None:
                return cls._cached_data

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
                "instrument": obs.instrument,
                "stream_type": getattr(obs, "stream_type", "historical") or "historical",
                "state": (getattr(obs, "state", None) if getattr(obs, "state", None) and getattr(obs, "state", None) != "Gujarat" else tag_coordinates(obs.latitude, obs.longitude)[0]),
                "region_code": (getattr(obs, "region_code", None) if getattr(obs, "region_code", None) and getattr(obs, "region_code", None) != "WEST_GUJARAT" else tag_coordinates(obs.latitude, obs.longitude)[1])
            })
        df_obs = pd.DataFrame(data)

        # 1. Spatial & Persistence Enrichment via DatasetBuilder
        builder = DatasetBuilder()
        builder.register_known_historical_ground_truth()
        enriched_df = builder.process_and_enrich_observations(df_obs)

        # Ensure stream_type, state, and region_code are preserved in enriched_df
        if "stream_type" not in enriched_df.columns and "stream_type" in df_obs.columns:
            enriched_df["stream_type"] = df_obs["stream_type"]
        if "state" not in enriched_df.columns and "state" in df_obs.columns:
            enriched_df["state"] = df_obs["state"]
        if "region_code" not in enriched_df.columns and "region_code" in df_obs.columns:
            enriched_df["region_code"] = df_obs["region_code"]

        # 2. Persistence Analysis on Cluster Summary
        persistence_engine = PersistenceEngine(persistence_threshold=0.5)
        cluster_summary_df = persistence_engine.analyze_clusters(enriched_df)

        # 3. Multi-Signal Risk Scoring (Phase 4)
        scored_clusters_df = RiskScoringEngine.score_clusters_dataframe(cluster_summary_df)

        # Attach region_code / state to scored_clusters_df from constituent observations
        if not scored_clusters_df.empty and "cluster_id" in scored_clusters_df.columns and "cluster_id" in enriched_df.columns:
            cluster_meta = enriched_df.groupby("cluster_id").agg({
                "region_code": lambda s: s.iloc[0] if len(s) > 0 else "WEST_GUJARAT",
                "state": lambda s: s.iloc[0] if len(s) > 0 else "Gujarat"
            }).to_dict(orient="index")
            scored_clusters_df["region_code"] = scored_clusters_df.apply(
                lambda r: cluster_meta.get(r["cluster_id"], {}).get("region_code") or tag_coordinates(float(r.get("centroid_lat", 20.0)), float(r.get("centroid_lon", 70.0)))[1],
                axis=1
            )
            scored_clusters_df["state"] = scored_clusters_df.apply(
                lambda r: cluster_meta.get(r["cluster_id"], {}).get("state") or tag_coordinates(float(r.get("centroid_lat", 20.0)), float(r.get("centroid_lon", 70.0)))[0],
                axis=1
            )

        # 3.5. Meteorological Context Enrichment (Open-Meteo)
        from concurrent.futures import ThreadPoolExecutor
        coords = [
            (float(row.get("centroid_lat", 21.0)), float(row.get("centroid_lon", 71.0)))
            for _, row in scored_clusters_df.iterrows()
        ]
        max_workers = min(max(len(coords), 1), 8)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            weather_contexts = list(executor.map(lambda pt: WeatherClient.get_weather_context(pt[0], pt[1]), coords))
        scored_clusters_df["weather_context"] = weather_contexts

        # 3.6. Geospatial Exposure & Consequence Analysis (Population, Infrastructure, Environment, Downwind)
        from app.spatial.exposure_engine import ExposureAnalysisService
        exposure_contexts = []
        for _, row in scored_clusters_df.iterrows():
            c_lat = float(row.get("centroid_lat", 21.0))
            c_lon = float(row.get("centroid_lon", 71.0))
            w_ctx = row.get("weather_context", {}) or {}
            w_dir = w_ctx.get("wind_direction_deg", 180.0)
            w_spd = w_ctx.get("wind_speed_kmh", 15.0)
            exp_ctx = ExposureAnalysisService.analyze_incident_exposure(
                lat=c_lat,
                lon=c_lon,
                wind_direction_deg=w_dir,
                wind_speed_kmh=w_spd
            )
            exposure_contexts.append(exp_ctx)
        scored_clusters_df["exposure_context"] = exposure_contexts

        # 3.7. Facility Thermal Fingerprint Engine (Historical Baseline vs Current Excursion)
        from app.scoring.facility_fingerprint import FacilityFingerprintEngine
        facility_fingerprints = []
        for _, row in scored_clusters_df.iterrows():
            fac_name = str(row.get("nearest_facility_name", "Industrial Facility"))
            max_frp = float(row.get("max_frp", 10.0))
            fac_type = str(row.get("nearest_facility_type", "industrial"))
            fp = FacilityFingerprintEngine.evaluate_incident_fingerprint(
                facility_name=fac_name,
                current_frp=max_frp,
                facility_type=fac_type
            )
            facility_fingerprints.append(fp)
        scored_clusters_df["facility_fingerprint"] = facility_fingerprints

        # 3.8. Multi-Dimensional Abnormality Detection Engine
        from app.scoring.abnormality_engine import AbnormalityEngine
        abnormality_detections = []
        for _, row in scored_clusters_df.iterrows():
            fac_name = str(row.get("nearest_facility_name", "Industrial Facility"))
            max_frp = float(row.get("max_frp", 10.0))
            avg_frp = float(row.get("avg_frp", max_frp))
            active_days = int(row.get("active_days_count", 1))
            total_detections = int(row.get("total_detections", 1))
            is_spike = bool(row.get("is_anomaly_spike", False))
            fac_type = str(row.get("nearest_facility_type", "industrial"))
            abnormality = AbnormalityEngine.evaluate_abnormality(
                facility_name=fac_name,
                current_frp=max_frp,
                avg_frp=avg_frp,
                active_days=active_days,
                total_detections=total_detections,
                is_anomaly_spike=is_spike,
                facility_type=fac_type
            )
            abnormality_detections.append(abnormality)
        scored_clusters_df["abnormality_detection"] = abnormality_detections

        # 3.9. Temporal Intelligence & Persistent Incident Registry (Phase 12)
        from app.analytics.temporal_engine import TemporalEngine
        from app.services.incident_registry import IncidentRegistryService

        temporal_intelligences = []
        for _, row in scored_clusters_df.iterrows():
            cid = str(row["cluster_id"])
            c_obs = enriched_df[enriched_df["cluster_id"] == cid]
            t_intel = TemporalEngine.evaluate_cluster_dataframe(c_obs)
            temporal_intelligences.append(t_intel)
        scored_clusters_df["temporal_intelligence"] = temporal_intelligences
        scored_clusters_df["temporal_status"] = [t["temporal_status"] for t in temporal_intelligences]
        scored_clusters_df["first_detected"] = [t["first_detected"] for t in temporal_intelligences]
        scored_clusters_df["last_detected"] = [t["last_detected"] for t in temporal_intelligences]
        scored_clusters_df["incident_age_hours"] = [t["incident_age_hours"] for t in temporal_intelligences]
        scored_clusters_df["active_duration_hours"] = [t["active_duration_hours"] for t in temporal_intelligences]
        scored_clusters_df["observation_freshness_minutes"] = [t["observation_freshness_minutes"] for t in temporal_intelligences]

        cluster_streams = []
        live_counts = []
        for _, row in scored_clusters_df.iterrows():
            cid = str(row["cluster_id"])
            c_obs = enriched_df[enriched_df["cluster_id"] == cid]
            if "stream_type" in c_obs.columns and (c_obs["stream_type"] == "near_real_time").any():
                cluster_streams.append("near_real_time")
                live_counts.append(int((c_obs["stream_type"] == "near_real_time").sum()))
            else:
                cluster_streams.append("historical")
                live_counts.append(0)
        scored_clusters_df["stream_type"] = cluster_streams
        scored_clusters_df["live_detections_count"] = live_counts

        # Sync with Persistent Incident Registry in DB
        try:
            incidents = IncidentRegistryService.sync_incidents_from_clusters(
                db=db,
                clusters_df=scored_clusters_df,
                enriched_obs_df=enriched_df
            )
            uuid_map = {inc.cluster_id: inc.incident_uuid for inc in incidents if inc.cluster_id}
            status_map = {inc.cluster_id: inc.status for inc in incidents if inc.cluster_id}
            scored_clusters_df["incident_uuid"] = scored_clusters_df["cluster_id"].map(
                lambda cid: uuid_map.get(cid, cid)
            )
            scored_clusters_df["status"] = scored_clusters_df["cluster_id"].map(
                lambda cid: status_map.get(cid, "NEW")
            )
        except Exception as e:
            logger.warning(f"Error syncing incident registry: {e}")
            scored_clusters_df["incident_uuid"] = scored_clusters_df["cluster_id"]
            scored_clusters_df["status"] = "NEW"

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
        base_gdf = osm_client.fetch_industrial_features(bbox=settings.default_bbox)
        proximity_engine = SpatialProximityEngine(base_gdf)
        industrial_gdf = proximity_engine.industrial_gdf
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
    def get_filtered_analyzed_data(
        cls,
        db: Session,
        region: Optional[str] = None,
        state: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Retrieves base analyzed data and filters by regional corridor or state.
        Executes in sub-millisecond time from cached pipeline structures.
        """
        base_data = cls.get_analyzed_data(db, force_refresh=force_refresh)
        obs_df = base_data["observations_df"]
        clusters_df = base_data["clusters_df"]
        osm_geojson = base_data["osm_geojson"]

        if obs_df.empty:
            return base_data

        filtered_obs = obs_df.copy()
        filtered_clusters = clusters_df.copy()

        norm_region = region.strip().upper() if region else None
        if norm_region and norm_region not in ["ALL", "ALL_INDIA"]:
            if "region_code" in filtered_obs.columns:
                filtered_obs = filtered_obs[filtered_obs["region_code"] == norm_region]
            if "region_code" in filtered_clusters.columns:
                filtered_clusters = filtered_clusters[filtered_clusters["region_code"] == norm_region]
            else:
                valid_cids = set(filtered_obs["cluster_id"].unique())
                filtered_clusters = filtered_clusters[filtered_clusters["cluster_id"].isin(valid_cids)]

        if state and state.strip().lower() != "all":
            state_clean = state.strip().lower()
            if "state" in filtered_obs.columns:
                filtered_obs = filtered_obs[filtered_obs["state"].str.lower() == state_clean]
            if "state" in filtered_clusters.columns:
                filtered_clusters = filtered_clusters[filtered_clusters["state"].str.lower() == state_clean]
            else:
                valid_cids = set(filtered_obs["cluster_id"].unique())
                filtered_clusters = filtered_clusters[filtered_clusters["cluster_id"].isin(valid_cids)]

        return {
            "observations_df": filtered_obs,
            "clusters_df": filtered_clusters,
            "osm_geojson": osm_geojson
        }

    @classmethod
    def get_monitored_regions(cls, db: Session) -> List[Dict[str, Any]]:
        """Returns catalog of operational industrial corridors across India."""
        from app.core.regions import get_all_regions
        from app.db.db_models import MonitoredRegionModel
        
        try:
            cnt = db.query(MonitoredRegionModel).count()
            if cnt == 0:
                for reg in get_all_regions():
                    row = MonitoredRegionModel(
                        region_code=reg["region_code"],
                        name=reg["name"],
                        states_covered=reg["states_covered"],
                        min_lon=reg["bbox"][0],
                        min_lat=reg["bbox"][1],
                        max_lon=reg["bbox"][2],
                        max_lat=reg["bbox"][3],
                        center_lat=reg["center"][0],
                        center_lon=reg["center"][1],
                        default_zoom=reg["default_zoom"],
                        is_active=True,
                        facility_count=8 if reg["region_code"] == "WEST_GUJARAT" else 5
                    )
                    db.add(row)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Region seeding fallback: {e}")

        return get_all_regions()

    @classmethod
    def get_facility_directory(cls, db: Session, region: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns national industrial facilities with thermal profiles."""
        FacilityFingerprintEngine.seed_database_profiles(db)
        baselines = FacilityFingerprintEngine.KNOWN_BASELINES
        results = []
        norm_reg = region.strip().upper() if region else None
        for name, prof in baselines.items():
            reg_code = prof.get("region_code", "WEST_GUJARAT")
            if norm_reg and norm_reg not in ["ALL", "ALL_INDIA"] and reg_code != norm_reg:
                continue
            item = dict(prof)
            item["facility_name"] = name
            results.append(item)
        return results


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
            label_val = row.get("label")
            label_name = row.get("label_name")
            if pd.isna(label_val) or label_name == "UNLABELED" or not label_name:
                display_label = "UNLABELED"
                display_code = -1
            else:
                display_label = str(label_name)
                display_code = int(label_val)

            results.append({
                "observation_id": int(row["id"]),
                "cluster_id": str(row["cluster_id"]),
                "latitude": round(float(row["latitude"]), 6),
                "longitude": round(float(row["longitude"]), 6),
                "acq_date": str(row["acq_date"]),
                "acq_time": str(row["acq_time"]),
                "frp": round(float(row["frp"]), 2),
                "brightness": round(float(row["brightness"]), 2),
                "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
                "nearest_facility_name": str(row["nearest_facility_name"]),
                "spatial_context": str(row["spatial_context"]),
                "label": display_code,
                "label_name": display_label,
                "label_source": str(row.get("label_source", "UNVERIFIED")),
                "label_confidence": float(row.get("label_confidence", 0.0)) if not pd.isna(row.get("label_confidence")) else None,
                "source_reference": str(row.get("source_reference", "")) if not pd.isna(row.get("source_reference")) else None,
                "reviewer": str(row.get("reviewer", "")) if not pd.isna(row.get("reviewer")) else None,
                "review_notes": str(row.get("review_notes", "")) if not pd.isna(row.get("review_notes")) else None,
                "verified_at": str(row.get("verified_at", "")) if not pd.isna(row.get("verified_at")) else None,
                "stream_type": str(row.get("stream_type", "historical"))
            })

        return results

    @classmethod
    def submit_ground_truth_review(
        cls,
        req: GroundTruthReviewRequest,
        db: Session
    ) -> Dict[str, Any]:
        """
        Records a verified human ground-truth review for a specific satellite observation.
        """
        obs = db.query(RawObservationModel).filter(RawObservationModel.id == req.observation_id).first()
        if not obs:
            raise ValueError(f"Observation ID #{req.observation_id} not found in database.")

        builder = DatasetBuilder()
        builder.register_known_historical_ground_truth()

        target_class_enum = TargetClass[req.target_class] if req.target_class in TargetClass.__members__ else TargetClass.UNLABELED

        prov = builder.registry.register_verified_incident(
            latitude=obs.latitude,
            longitude=obs.longitude,
            target_class=target_class_enum,
            source_citation=req.source_citation,
            reviewer=req.reviewer,
            radius_meters=375.0,
            date_str=str(obs.acq_date),
            confidence=req.confidence,
            review_notes=req.review_notes
        )

        cls.invalidate_cache()
        cls.get_analyzed_data(db, force_refresh=True)

        return {
            "status": "RECORDED",
            "observation_id": req.observation_id,
            "target_class": prov.label_name,
            "label_code": prov.label,
            "reviewer": prov.reviewer,
            "source_citation": prov.source_reference,
            "verified_at": prov.verified_at,
            "message": f"Ground-truth classification '{prov.label_name}' successfully committed to provenance registry."
        }

    @classmethod
    def get_ground_truth_quality(cls, db: Session) -> Dict[str, Any]:
        """Returns the data quality metrics from the ground truth registry."""
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]
        builder = DatasetBuilder()
        return builder.generate_quality_report(obs_df, obs_df, duplicates_dropped=0)

    @classmethod
    def get_ml_status(cls, db: Session) -> Dict[str, Any]:
        """Returns honest ML readiness assessment based on statistical sufficiency."""
        pipeline_data = cls.get_analyzed_data(db)
        obs_df = pipeline_data["observations_df"]

        evaluator = MLReadinessEvaluator()
        report = evaluator.evaluate(obs_df)

        return {
            "status": report.get("status", "NOT_READY"),
            "reason": report.get("reason", "Insufficient data"),
            "labeled_samples": report.get("labeled_samples", 0),
            "classes_present": report.get("classes_present", 0),
            "class_distribution": report.get("class_distribution", {}),
            "spatial_groups_count": report.get("spatial_groups_count", 0),
            "min_samples_per_class": report.get("min_samples_per_class", 0),
            "is_statistically_defensible": report.get("is_statistically_defensible", False),
            "recommendation": report.get("recommendation", "Use Rule Engine.")
        }

    @classmethod
    def predict_ml(cls, req: MLPredictRequest, db: Session) -> MLPredictResponse:
        """
        Executes ML inference for a 9D feature vector with strict honest disclosures.
        """
        features_dict = {
            "frp": req.frp,
            "brightness": req.brightness,
            "bright_t31": req.bright_t31 if req.bright_t31 is not None else req.brightness - (req.thermal_contrast or 5.0),
            "thermal_contrast": req.thermal_contrast if req.thermal_contrast is not None else 5.0,
            "distance_to_industry_meters": req.distance_to_industry_meters,
            "persistence_ratio": req.persistence_ratio,
            "active_days_count": req.active_days_count,
            "is_anomaly_spike": req.is_anomaly_spike,
            "confidence_normalized": req.confidence_normalized
        }

        model_path = Path(settings.BASE_DIR) / "models" / "thermal_classifier.joblib"
        if not model_path.exists():
            model_path = Path(settings.BASE_DIR).parent / "models" / "thermal_classifier.joblib"

        if not model_path.exists():
            return MLPredictResponse(
                ml_status="NOT_READY",
                prediction_available=False,
                scientific_warning=(
                    "Supervised ML model is not loaded (Status: NOT_READY). "
                    "In adherence to scientific integrity, supervised training requires sufficient "
                    "verified multi-class ground truth. Primary operational classification is provided "
                    "by the Phase 4 Deterministic Rule Engine."
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
        Thread-safe execution of NASA FIRMS near-real-time or historical data refresh.
        Guarantees single execution lock, deduplicates against database, commits new records,
        invalidates caches, and records full operational metrics.
        """
        # 1. Enforce thread-safe job locking
        acquired = cls._refresh_lock.acquire(blocking=False)
        if not acquired:
            logger.warning("Attempted to initiate FIRMS refresh while another refresh job is already active.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A NASA FIRMS refresh job is already currently running. Please wait for completion."
            )

        start_time = time.time()
        job_id = f"job_refresh_{uuid.uuid4().hex[:8]}"
        now_utc = datetime.now(timezone.utc)
        
        # Update status to RUNNING
        cls._last_refresh_status["status"] = "RUNNING"
        cls._last_refresh_status["job_id"] = job_id
        cls._last_refresh_status["started_at"] = now_utc.isoformat()
        cls._last_refresh_status["active_sensor"] = req.sensor or settings.DEFAULT_SENSOR
        cls._last_refresh_status["error"] = None

        try:
            ingester = HistoricalFIRMSIngester()
            logger.info(
                f"Executing FIRMS data refresh: sensor={req.sensor}, days={req.days}, date_range={req.start_date}..{req.end_date}, stream={req.stream_type}"
            )

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
                    day_range=req.days or settings.DEFAULT_DAY_RANGE,
                    save_raw=True
                )

            exec_duration = round(time.time() - start_time, 3)
            now_finished = datetime.now(timezone.utc)
            next_refresh = now_finished + timedelta(minutes=settings.LIVE_REFRESH_INTERVAL_MINUTES)

            if df_raw.empty:
                logger.info(f"NASA FIRMS returned 0 observations for area query (duration={exec_duration}s).")
                cls._last_refresh_status.update({
                    "status": "IDLE",
                    "last_checked": now_finished.isoformat(),
                    "next_scheduled_refresh": next_refresh.isoformat(),
                    "new_observations": 0,
                    "duplicates": 0,
                    "duration_seconds": exec_duration,
                    "error": None
                })
                return DataRefreshResponse(
                    job_id=job_id,
                    status="SUCCESS_NO_NEW_DATA",
                    rows_received=0,
                    rows_added=0,
                    rows_duplicate=0,
                    date_range={"start": None, "end": None},
                    sensor=req.sensor or settings.DEFAULT_SENSOR,
                    execution_time_seconds=exec_duration
                )

            # Ingest and save to DB
            from app.ingestion.firms_client import FIRMSClient
            client = FIRMSClient()
            summary, new_models = client.ingest_and_save(
                db=db,
                df=df_raw,
                source_name="NASA_FIRMS_NRT_STREAM" if req.stream_type == "near_real_time" else "NASA_FIRMS_HISTORICAL_EXPANSION",
                sensor_name=req.sensor or settings.DEFAULT_SENSOR,
                stream_type=req.stream_type or "near_real_time"
            )

            # Invalidate in-memory caches
            cls.invalidate_cache()

            # Recompute pipeline data to warm cache
            pipeline_data = cls.get_analyzed_data(db, force_refresh=True)
            obs_df = pipeline_data["observations_df"]
            
            # Update dataset exports
            builder = DatasetBuilder()
            builder.split_and_save_datasets(obs_df)

            dates = sorted(df_raw["acq_date"].astype(str).unique().tolist()) if "acq_date" in df_raw.columns else []

            cls._last_refresh_status.update({
                "status": "SUCCESS",
                "last_success": now_finished.isoformat(),
                "last_checked": now_finished.isoformat(),
                "next_scheduled_refresh": next_refresh.isoformat(),
                "new_observations": summary.valid_records,
                "duplicates": summary.duplicates_skipped,
                "duration_seconds": exec_duration,
                "error": None
            })

            return DataRefreshResponse(
                job_id=job_id,
                status="SUCCESS",
                rows_received=summary.total_received,
                rows_added=summary.valid_records,
                rows_duplicate=summary.duplicates_skipped,
                date_range={"start": dates[0] if dates else None, "end": dates[-1] if dates else None},
                sensor=req.sensor or settings.DEFAULT_SENSOR,
                execution_time_seconds=exec_duration
            )

        except Exception as e:
            exec_duration = round(time.time() - start_time, 3)
            logger.error(f"Error during FIRMS refresh execution: {e}", exc_info=True)
            cls._last_refresh_status.update({
                "status": "FAILED",
                "last_checked": datetime.now(timezone.utc).isoformat(),
                "duration_seconds": exec_duration,
                "error": str(e)[:200]
            })
            raise

        finally:
            cls._refresh_lock.release()

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

        y = (obs_df["risk_score"] >= 60.0).astype(int).values

        classifier = ThermalClassifier(n_estimators=50, random_state=42)
        classifier.fit(X, y)
        importances = classifier.get_feature_importances()

        groups = obs_df["cluster_id"].values
        cv_results = classifier.evaluate_spatial_cv(X, y, groups=groups, n_splits=3)

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

    @classmethod
    def get_incident_detail(cls, db: Session, incident_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves comprehensive incident detail including temporal intelligence,
        atmospheric context, geospatial exposure, baseline fingerprint, and abnormality analysis.
        Supports lookup by persistent incident_uuid or transient cluster_id.
        """
        from app.services.incident_registry import IncidentRegistryService
        from app.analytics.temporal_engine import TemporalEngine

        # Find in registry
        inc = IncidentRegistryService.get_incident_by_uuid(db, incident_uuid)
        if not inc:
            inc = IncidentRegistryService.get_incident_by_cluster_id(db, incident_uuid)

        # Get pipeline analyzed clusters
        pipeline_data = cls.get_analyzed_data(db)
        clusters_df = pipeline_data["clusters_df"]
        enriched_df = pipeline_data["observations_df"]

        matched_row = None
        if not clusters_df.empty:
            if inc and inc.cluster_id:
                m = clusters_df[clusters_df["cluster_id"] == inc.cluster_id]
                if not m.empty:
                    matched_row = m.iloc[0].to_dict()
            if matched_row is None:
                m = clusters_df[clusters_df["cluster_id"] == incident_uuid]
                if not m.empty:
                    matched_row = m.iloc[0].to_dict()

        if inc is None and matched_row is None:
            return None

        # Build response dict
        cid = matched_row.get("cluster_id") if matched_row else (inc.cluster_id if inc else incident_uuid)
        uuid_val = inc.incident_uuid if inc else cid
        fac_name = inc.facility_name if inc else matched_row.get("nearest_facility_name", "Industrial Facility")
        state_val = inc.state if inc else matched_row.get("state", "Gujarat")
        reg_code = inc.region_code if inc else matched_row.get("region_code", "WEST_GUJARAT")

        # Telemetry
        telemetry = {}
        if matched_row:
            telemetry = {
                "max_frp": float(matched_row.get("max_frp", 0.0)),
                "avg_frp": float(matched_row.get("avg_frp", 0.0)),
                "max_brightness": float(matched_row.get("max_brightness", 300.0)),
                "distance_to_industry_meters": float(matched_row.get("distance_to_industry_meters", 0.0)),
                "persistence_ratio": float(matched_row.get("persistence_ratio", 0.0)),
                "active_days_count": int(matched_row.get("active_days_count", 1)),
                "is_anomaly_spike": bool(matched_row.get("is_anomaly_spike", False)),
                "total_detections": int(matched_row.get("total_detections", 1))
            }
        elif inc:
            telemetry = {
                "max_frp": inc.peak_frp or 15.0,
                "avg_frp": inc.peak_frp or 15.0,
                "max_brightness": 320.0,
                "distance_to_industry_meters": 0.0,
                "persistence_ratio": 0.5,
                "active_days_count": 1,
                "is_anomaly_spike": False,
                "total_detections": inc.detection_count
            }

        # Temporal intelligence
        temporal_intel = matched_row.get("temporal_intelligence") if matched_row else None
        if not temporal_intel:
            c_obs = enriched_df[enriched_df["cluster_id"] == cid] if not enriched_df.empty and cid in enriched_df["cluster_id"].values else pd.DataFrame()
            if not c_obs.empty:
                temporal_intel = TemporalEngine.evaluate_cluster_dataframe(c_obs)
            elif inc:
                temporal_intel = {
                    "first_detected": inc.first_detected.isoformat(),
                    "last_detected": inc.last_detected.isoformat(),
                    "incident_age_hours": round(max(0.0, (datetime.now(timezone.utc) - inc.first_detected.replace(tzinfo=timezone.utc)).total_seconds() / 3600.0), 2),
                    "active_duration_hours": round(max(0.0, (inc.last_detected - inc.first_detected).total_seconds() / 3600.0), 2),
                    "detection_count": inc.detection_count,
                    "observation_freshness_minutes": round(max(0.0, (datetime.now(timezone.utc) - inc.last_detected.replace(tzinfo=timezone.utc)).total_seconds() / 60.0), 1),
                    "temporal_status": inc.temporal_status,
                    "is_recently_observed": (inc.temporal_status == "RECENTLY_OBSERVED"),
                    "scientific_disclosure": TemporalEngine.SCIENTIFIC_DISCLOSURE,
                    "reference_time": datetime.now(timezone.utc).isoformat()
                }

        first_dt = inc.first_detected if inc else (datetime.fromisoformat(temporal_intel["first_detected"]) if temporal_intel else datetime.now(timezone.utc))
        last_dt = inc.last_detected if inc else (datetime.fromisoformat(temporal_intel["last_detected"]) if temporal_intel else datetime.now(timezone.utc))
        risk_score = inc.risk_score if inc else float(matched_row.get("risk_score", 0.0))
        risk_level = inc.risk_level if inc else str(matched_row.get("risk_level", "LOW"))
        action_code = inc.action_code if inc else str(matched_row.get("action_code", "BACKGROUND_LOG"))
        abnormality_score = inc.abnormality_score if inc else (matched_row.get("abnormality_detection", {}).get("abnormality_score", 0.0) if matched_row else 0.0)
        temp_status = inc.temporal_status if inc else (temporal_intel.get("temporal_status", "HISTORICAL") if temporal_intel else "HISTORICAL")
        status_val = inc.status if inc else "NEW"
        c_lat = inc.centroid_lat if inc else float(matched_row.get("centroid_lat", 22.0))
        c_lon = inc.centroid_lon if inc else float(matched_row.get("centroid_lon", 71.0))
        peak_frp = inc.peak_frp if inc else float(matched_row.get("max_frp", 0.0))
        created_at = inc.created_at if inc else first_dt
        updated_at = inc.updated_at if inc else last_dt

        return {
            "incident_uuid": uuid_val,
            "cluster_id": cid,
            "facility_name": fac_name,
            "state": state_val,
            "region_code": reg_code,
            "first_detected": first_dt,
            "last_detected": last_dt,
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "action_code": action_code,
            "abnormality_score": round(abnormality_score, 2),
            "temporal_status": temp_status,
            "detection_count": inc.detection_count if inc else (temporal_intel.get("detection_count", 1) if temporal_intel else 1),
            "status": status_val,
            "centroid_lat": c_lat,
            "centroid_lon": c_lon,
            "peak_frp": peak_frp,
            "created_at": created_at,
            "updated_at": updated_at,
            "temporal_intelligence": temporal_intel,
            "telemetry": telemetry,
            "weather_context": matched_row.get("weather_context") if matched_row else {},
            "exposure_context": matched_row.get("exposure_context") if matched_row else {},
            "facility_fingerprint": matched_row.get("facility_fingerprint") if matched_row else {},
            "abnormality_detection": matched_row.get("abnormality_detection") if matched_row else {}
        }
