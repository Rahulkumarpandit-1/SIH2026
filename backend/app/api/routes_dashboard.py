from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.service import PipelineService
from app.core.logging import logger
from app.dataset.ground_truth import GroundTruthReviewRequest
from app.models.schemas import (
    MLPredictRequest,
    MLPredictResponse,
    MLStatusResponse,
    DataRefreshRequest,
    DataRefreshResponse,
    DataRefreshStatusResponse,
    DashboardSummaryResponse
)

router = APIRouter(prefix="/api", tags=["Dashboard & Telemetry"])


@router.get("/health", summary="API Health Check")
def get_health() -> Dict[str, Any]:
    """Confirms that the FastAPI server and telemetry endpoints are operational."""
    return {
        "status": "healthy",
        "service": "SIH26162 Thermal Fire Intelligence API",
        "version": "1.0.0",
        "monitoring_mode": "NEAR_REAL_TIME"
    }


@router.get("/summary", summary="Dashboard Statistics Summary", response_model=DashboardSummaryResponse)
def get_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns high-level KPI metrics computed from the analyzed observation database
    including near-real-time refresh timestamps and stream breakdown.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]
    clusters_df = pipeline_data["clusters_df"]
    refresh_status = PipelineService.get_refresh_status()

    if obs_df.empty or clusters_df.empty:
        return {
            "total_observations": 0,
            "total_clusters": 0,
            "critical_count": 0,
            "high_count": 0,
            "moderate_count": 0,
            "low_count": 0,
            "date_range": None,
            "latest_observation_date": None,
            "last_data_update": refresh_status.get("last_success") or refresh_status.get("last_checked"),
            "last_refresh_time": refresh_status.get("last_checked"),
            "next_refresh_time": refresh_status.get("next_scheduled_refresh"),
            "live_observations_count": 0,
            "historical_observations_count": 0,
            "monitoring_mode": "NEAR_REAL_TIME"
        }

    # Count risk levels among distinct physical clusters
    risk_counts = clusters_df["risk_level"].value_counts().to_dict()

    dates = sorted(obs_df["acq_date"].unique().tolist())
    date_range = {
        "start": str(dates[0]) if dates else None,
        "end": str(dates[-1]) if dates else None
    }

    # Stream breakdown
    if "stream_type" in obs_df.columns:
        live_count = int((obs_df["stream_type"] == "near_real_time").sum())
    else:
        live_count = 0
    hist_count = int(len(obs_df) - live_count)

    latest_date_str = str(dates[-1]) if dates else None
    last_update_ts = refresh_status.get("last_success") or refresh_status.get("last_checked") or latest_date_str

    return {
        "total_observations": int(len(obs_df)),
        "total_clusters": int(len(clusters_df)),
        "critical_count": int(risk_counts.get("CRITICAL", 0)),
        "high_count": int(risk_counts.get("HIGH", 0)),
        "moderate_count": int(risk_counts.get("MODERATE", 0)),
        "low_count": int(risk_counts.get("LOW", 0)),
        "date_range": date_range,
        "latest_observation_date": latest_date_str,
        "last_data_update": last_update_ts,
        "last_refresh_time": refresh_status.get("last_checked"),
        "next_refresh_time": refresh_status.get("next_scheduled_refresh"),
        "live_observations_count": live_count,
        "historical_observations_count": hist_count,
        "monitoring_mode": "NEAR_REAL_TIME"
    }


@router.get("/observations", summary="List Enriched Satellite Hotspot Observations")
def get_observations(
    stream_type: Optional[str] = Query(default=None, description="'all', 'near_real_time', or 'historical'"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns the complete list of individual satellite hotspot observations enriched with
    spatial context, nearest industrial facility distance, and cluster associations.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]

    if obs_df.empty:
        return []

    # Filter stream_type if specified
    if stream_type and stream_type.lower() != "all" and "stream_type" in obs_df.columns:
        target_stream = stream_type.lower()
        if target_stream in ["near_real_time", "live", "nrt"]:
            obs_df = obs_df[obs_df["stream_type"] == "near_real_time"]
        elif target_stream in ["historical", "archive"]:
            obs_df = obs_df[obs_df["stream_type"] != "near_real_time"]

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
            "confidence": str(row["confidence"]),
            "confidence_normalized": round(float(row.get("confidence_normalized", 0.8)), 2),
            "cluster_id": str(row["cluster_id"]),
            "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
            "nearest_facility_name": str(row["nearest_facility_name"]),
            "nearest_facility_type": str(row["nearest_facility_type"]),
            "spatial_context": str(row["spatial_context"]),
            "daynight": str(row["daynight"]),
            "risk_score": round(float(row.get("risk_score", 0.0)), 2),
            "risk_level": str(row.get("risk_level", "LOW")),
            "incident_classification": str(row.get("incident_classification", "NON_INDUSTRIAL_RURAL")),
            "action_code": str(row.get("action_code", "BACKGROUND_LOG")),
            "stream_type": str(row.get("stream_type", "historical"))
        })

    return results


@router.get("/clusters", summary="List Physical Thermal Clusters & Persistence Metrics")
def get_clusters(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns spatio-temporal cluster summaries computed by DBSCAN and the PersistenceEngine.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    clusters_df = pipeline_data["clusters_df"]

    if clusters_df.empty:
        return []

    results = []
    for _, row in clusters_df.iterrows():
        results.append({
            "cluster_id": str(row["cluster_id"]),
            "centroid_latitude": round(float(row["centroid_lat"]), 6),
            "centroid_longitude": round(float(row["centroid_lon"]), 6),
            "detection_count": int(row["total_detections"]),
            "active_days_count": int(row["active_days_count"]),
            "total_window_days": int(row["total_window_days"]),
            "persistence_ratio": round(float(row["persistence_ratio"]), 4),
            "avg_frp": round(float(row["avg_frp"]), 2),
            "max_frp": round(float(row["max_frp"]), 2),
            "avg_brightness": round(float(row["avg_brightness"]), 2),
            "max_brightness": round(float(row["max_brightness"]), 2),
            "is_anomaly_spike": bool(row["is_anomaly_spike"]),
            "nearest_facility_name": str(row["nearest_facility_name"]),
            "nearest_facility_type": str(row["nearest_facility_type"]),
            "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
            "spatial_context": str(row["spatial_context"]),
            "persistence_category": str(row.get("persistence_category", "UNKNOWN")),
            "incident_classification": str(row.get("incident_classification", "UNKNOWN"))
        })

    return results


@router.get("/risk", summary="Ranked Incident Prioritization & Explainable Risk Feed")
def get_risk_prioritization(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns the complete Phase 4 multi-signal risk evaluations for all detected clusters,
    sorted by risk_score in descending order (highest emergency priority first).
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    clusters_df = pipeline_data["clusters_df"]

    if clusters_df.empty:
        return []

    # Sort descending by risk_score
    sorted_df = clusters_df.sort_values(by="risk_score", ascending=False).reset_index(drop=True)

    results = []
    for rank, (_, row) in enumerate(sorted_df.iterrows(), start=1):
        results.append({
            "rank": rank,
            "cluster_id": str(row["cluster_id"]),
            "risk_score": round(float(row["risk_score"]), 2),
            "risk_level": str(row["risk_level"]),
            "action_code": str(row["action_code"]),
            "incident_classification": str(row["incident_classification"]),
            "subscores": {
                "thermal_subscore": round(float(row.get("thermal_subscore", 0.0)), 2),
                "proximity_subscore": round(float(row.get("proximity_subscore", 0.0)), 2),
                "persistence_subscore": round(float(row.get("persistence_subscore", 0.0)), 2),
                "confidence_subscore": round(float(row.get("confidence_subscore", 0.0)), 2)
            },
            "telemetry": {
                "max_frp": round(float(row["max_frp"]), 2),
                "avg_frp": round(float(row["avg_frp"]), 2),
                "max_brightness": round(float(row["max_brightness"]), 2),
                "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
                "persistence_ratio": round(float(row["persistence_ratio"]), 4),
                "active_days_count": int(row["active_days_count"]),
                "is_anomaly_spike": bool(row["is_anomaly_spike"]),
                "total_detections": int(row["total_detections"])
            },
            "nearest_facility_name": str(row["nearest_facility_name"]),
            "nearest_facility_type": str(row["nearest_facility_type"]),
            "spatial_context": str(row["spatial_context"]),
            "centroid_latitude": round(float(row["centroid_lat"]), 6),
            "centroid_longitude": round(float(row["centroid_lon"]), 6)
        })

    return results


@router.get("/geojson", summary="Thermal Hotspots GeoJSON FeatureCollection")
def get_geojson_layer(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns all satellite observations formatted as standard RFC 7946 GeoJSON Point features.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]

    features = []
    if not obs_df.empty:
        for _, row in obs_df.iterrows():
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(row["longitude"]), 6), round(float(row["latitude"]), 6)]
                },
                "properties": {
                    "id": int(row["id"]),
                    "cluster_id": str(row["cluster_id"]),
                    "frp": round(float(row["frp"]), 2),
                    "brightness": round(float(row["brightness"]), 2),
                    "acq_date": str(row["acq_date"]),
                    "acq_time": str(row["acq_time"]),
                    "risk_level": str(row.get("risk_level", "LOW")),
                    "risk_score": round(float(row.get("risk_score", 0.0)), 2),
                    "nearest_facility": str(row["nearest_facility_name"]),
                    "distance_meters": round(float(row["distance_to_industry_meters"]), 1),
                    "spatial_context": str(row["spatial_context"]),
                    "stream_type": str(row.get("stream_type", "historical"))
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/osm-industrial", summary="OpenStreetMap Industrial Boundaries GeoJSON Layer")
def get_osm_industrial_layer(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the 3,970 OpenStreetMap industrial polygons covering Gujarat.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    return pipeline_data.get("osm_geojson", {"type": "FeatureCollection", "features": []})


@router.get("/ml-evaluation", summary="ML Feature Importances & Spatial Group Cross-Validation")
def get_ml_evaluation(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the Random Forest ML evaluation metrics including feature importances,
    GroupKFold cross-validation scores, and spatial leakage disclosures.
    """
    return PipelineService.get_ml_evaluation(db)


@router.get("/dataset", summary="Enriched Dataset Export for Research & ML")
def get_dataset(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Exports the complete enriched dataset with spatial context, persistence ratios,
    and ground truth labels for scientific evaluation.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]
    if obs_df.empty:
        return []
    return obs_df.to_dict(orient="records")


@router.get("/dataset/quality", summary="Dataset Quality & Completeness Report")
def get_dataset_quality(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns data quality metrics, missing value rates, spatial coordinate bounding box compliance,
    and class distribution.
    """
    return PipelineService.get_dataset_quality(db)


@router.get("/dataset/provenance", summary="Ground Truth Incident Provenance Catalog")
def get_dataset_provenance() -> List[Dict[str, Any]]:
    """
    Returns the ground-truth provenance registry with citations, coordinates, dates, and reviewer metadata.
    """
    return PipelineService.get_dataset_provenance()


@router.get("/ground-truth", summary="Human Review Feed for Ground Truth Labeling")
def get_ground_truth_feed(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns observation records with their verified ground truth annotations (or UNLABELED status).
    """
    return PipelineService.get_ground_truth_feed(db)


@router.post("/ground-truth/review", summary="Submit Human Ground Truth Review")
def submit_ground_truth_review(
    review: GroundTruthReviewRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Records a verified human review annotation with reviewer audit trail and provenance citation.
    """
    try:
        return PipelineService.submit_ground_truth_review(review, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting ground-truth review: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/ground-truth/quality", summary="Ground-Truth Distribution & Quality Statistics")
def get_ground_truth_quality(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns ground-truth quality statistics, class balance, and verification source breakdown.
    """
    return PipelineService.get_ground_truth_quality(db)


@router.get("/ml/status", summary="Machine Learning Readiness & Data Sufficiency Status", response_model=MLStatusResponse)
def get_ml_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the honest scientific ML readiness assessment without fabricating accuracy.
    Evaluates verified label counts, class representation, and spatial group diversity.
    """
    return PipelineService.get_ml_status(db)


@router.post("/ml/predict", summary="9D Feature Vector Prediction Inference", response_model=MLPredictResponse)
def predict_ml(
    req: MLPredictRequest,
    db: Session = Depends(get_db)
) -> MLPredictResponse:
    """
    Infers classification for a 9D feature vector. Returns honest fallback with scientific
    disclosures if the dataset is statistically insufficient for supervised production inference.
    """
    return PipelineService.predict_ml(req, db)


# ==============================================================================
# PHASE 11 — NEAR-REAL-TIME DATA REFRESH & STATUS APIS
# ==============================================================================

@router.get("/data/refresh/status", summary="Near-Real-Time Ingestion Job Status", response_model=DataRefreshStatusResponse)
def get_refresh_status() -> Dict[str, Any]:
    """
    Exposes the thread-safe operational status of the near-real-time satellite ingestion engine.
    States: IDLE, RUNNING, SUCCESS, FAILED.
    """
    return PipelineService.get_refresh_status()


@router.post("/data/refresh", summary="Safe NASA FIRMS Near-Real-Time / Historical Data Refresh", response_model=DataRefreshResponse)
def refresh_data(
    req: DataRefreshRequest,
    db: Session = Depends(get_db)
) -> DataRefreshResponse:
    """
    Fetches real FIRMS satellite observations, validates, deduplicates, commits new records
    to the active database, updates spatial clusters, and invalidates in-memory caches.
    Enforces mutex job locking to prevent concurrent executions.
    """
    try:
        return PipelineService.refresh_firms_data(req, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing FIRMS data: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
