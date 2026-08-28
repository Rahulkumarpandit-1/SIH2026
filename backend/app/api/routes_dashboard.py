from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
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
    DataRefreshResponse
)

router = APIRouter(prefix="/api", tags=["Dashboard & Telemetry"])


@router.get("/health", summary="API Health Check")
def get_health() -> Dict[str, Any]:
    """Confirms that the FastAPI server and telemetry endpoints are operational."""
    return {
        "status": "healthy",
        "service": "SIH26162 Thermal Fire Intelligence API",
        "version": "1.0.0"
    }


@router.get("/summary", summary="Dashboard Statistics Summary")
def get_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns high-level KPI metrics computed from the analyzed observation database.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]
    clusters_df = pipeline_data["clusters_df"]

    if obs_df.empty or clusters_df.empty:
        return {
            "total_observations": 0,
            "total_clusters": 0,
            "critical_count": 0,
            "high_count": 0,
            "moderate_count": 0,
            "low_count": 0,
            "date_range": None,
            "latest_observation_date": None
        }

    # Count risk levels among distinct physical clusters
    risk_counts = clusters_df["risk_level"].value_counts().to_dict()

    dates = sorted(obs_df["acq_date"].unique().tolist())
    date_range = {
        "start": dates[0] if dates else None,
        "end": dates[-1] if dates else None
    }

    return {
        "total_observations": int(len(obs_df)),
        "total_clusters": int(len(clusters_df)),
        "critical_count": int(risk_counts.get("CRITICAL", 0)),
        "high_count": int(risk_counts.get("HIGH", 0)),
        "moderate_count": int(risk_counts.get("MODERATE", 0)),
        "low_count": int(risk_counts.get("LOW", 0)),
        "date_range": date_range,
        "latest_observation_date": dates[-1] if dates else None
    }


@router.get("/observations", summary="List Enriched Satellite Hotspot Observations")
def get_observations(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns the complete list of individual satellite hotspot observations enriched with
    spatial context, nearest industrial facility distance, and cluster associations.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
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
            "action_code": str(row.get("action_code", "BACKGROUND_LOG"))
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
                "total_detections": int(row["total_detections"]),
                "is_anomaly_spike": bool(row["is_anomaly_spike"])
            },
            "nearest_facility_name": str(row["nearest_facility_name"]),
            "nearest_facility_type": str(row["nearest_facility_type"]),
            "spatial_context": str(row["spatial_context"]),
            "centroid_latitude": round(float(row["centroid_lat"]), 6),
            "centroid_longitude": round(float(row["centroid_lon"]), 6)
        })

    return results


@router.get("/geojson", summary="GeoJSON Layer of Hotspots & Cluster Centroids")
def get_geojson(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns valid GeoJSON FeatureCollection formatted for Leaflet GIS mapping.
    Contains both individual hotspot observations and physical cluster centroids.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]
    clusters_df = pipeline_data["clusters_df"]

    features = []

    # 1. Hotspot Observation Points
    if not obs_df.empty:
        for _, row in obs_df.iterrows():
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(row["longitude"]), 6), round(float(row["latitude"]), 6)]
                },
                "properties": {
                    "feature_type": "observation",
                    "observation_id": int(row["id"]),
                    "cluster_id": str(row["cluster_id"]),
                    "acq_date": str(row["acq_date"]),
                    "acq_time": str(row["acq_time"]),
                    "frp": round(float(row["frp"]), 2),
                    "brightness": round(float(row["brightness"]), 2),
                    "confidence": str(row["confidence"]),
                    "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
                    "nearest_facility_name": str(row["nearest_facility_name"]),
                    "nearest_facility_type": str(row["nearest_facility_type"]),
                    "spatial_context": str(row["spatial_context"]),
                    "risk_score": round(float(row.get("risk_score", 0.0)), 2),
                    "risk_level": str(row.get("risk_level", "LOW")),
                    "incident_classification": str(row.get("incident_classification", "NON_INDUSTRIAL_RURAL")),
                    "action_code": str(row.get("action_code", "BACKGROUND_LOG")),
                    "daynight": str(row["daynight"])
                }
            })

    # 2. Physical Cluster Centroids
    if not clusters_df.empty:
        for _, row in clusters_df.iterrows():
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(row["centroid_lon"]), 6), round(float(row["centroid_lat"]), 6)]
                },
                "properties": {
                    "feature_type": "cluster_centroid",
                    "cluster_id": str(row["cluster_id"]),
                    "total_detections": int(row["total_detections"]),
                    "active_days_count": int(row["active_days_count"]),
                    "persistence_ratio": round(float(row["persistence_ratio"]), 4),
                    "max_frp": round(float(row["max_frp"]), 2),
                    "avg_frp": round(float(row["avg_frp"]), 2),
                    "max_brightness": round(float(row["max_brightness"]), 2),
                    "is_anomaly_spike": bool(row["is_anomaly_spike"]),
                    "nearest_facility_name": str(row["nearest_facility_name"]),
                    "distance_to_industry_meters": round(float(row["distance_to_industry_meters"]), 1),
                    "risk_score": round(float(row["risk_score"]), 2),
                    "risk_level": str(row["risk_level"]),
                    "incident_classification": str(row["incident_classification"]),
                    "action_code": str(row["action_code"]),
                    "thermal_subscore": round(float(row.get("thermal_subscore", 0.0)), 2),
                    "proximity_subscore": round(float(row.get("proximity_subscore", 0.0)), 2),
                    "persistence_subscore": round(float(row.get("persistence_subscore", 0.0)), 2),
                    "confidence_subscore": round(float(row.get("confidence_subscore", 0.0)), 2)
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/osm-industrial", summary="GeoJSON Layer of Industrial Facility Boundaries")
def get_osm_industrial(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the OpenStreetMap industrial polygons from the active geospatial layer.
    Used by Leaflet to render industrial zones, refineries, and chemical parks.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    return pipeline_data.get("osm_geojson", {"type": "FeatureCollection", "features": []})


@router.get("/ml-evaluation", summary="Phase 5 Machine Learning Benchmark & Feature Importances")
def get_ml_evaluation(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns Phase 5/8 Random Forest benchmark metrics, feature importance rankings,
    and Spatial Group K-Fold cross-validation results.
    """
    return PipelineService.get_ml_evaluation(db)


@router.get("/dataset", summary="Complete Historical Dataset with Provenance")
def get_dataset(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns the complete list of historical satellite observations enriched with
    spatial proximity, clustering, persistence, and ground-truth provenance labels.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    obs_df = pipeline_data["observations_df"]
    if obs_df.empty:
        return []
    return obs_df.to_dict(orient="records")


@router.get("/dataset/quality", summary="Dataset Quality & Provenance Report")
def get_dataset_quality(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns the dynamic Data Quality Report detailing raw count, unique count,
    class distribution, and scientific ML readiness.
    """
    return PipelineService.get_dataset_quality(db)


@router.get("/dataset/provenance", summary="Ground Truth Registry Provenance Catalog")
def get_dataset_provenance() -> List[Dict[str, Any]]:
    """
    Returns the catalog of registered and documented ground-truth incidents.
    """
    return PipelineService.get_dataset_provenance()


# ==============================================================================
# PHASE 8B — GROUND TRUTH WORKFLOW APIS
# ==============================================================================

@router.get("/ground-truth", summary="List Observations for Ground-Truth Human Review")
def get_ground_truth_feed(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns the list of satellite observations with spatial context, thermal metrics,
    and current ground-truth labels for human inspection and labeling.
    """
    return PipelineService.get_ground_truth_feed(db)


@router.post("/ground-truth/review", summary="Submit Human Ground-Truth Review Annotation")
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


# ==============================================================================
# PHASE 8D/8E/8F — PRODUCTION ML & PREDICTION APIS
# ==============================================================================

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
# PHASE 8A/22 — DATA REFRESH API
# ==============================================================================

@router.post("/data/refresh", summary="Safe NASA FIRMS Historical/NRT Data Refresh", response_model=DataRefreshResponse)
def refresh_data(
    req: DataRefreshRequest,
    db: Session = Depends(get_db)
) -> DataRefreshResponse:
    """
    Fetches real FIRMS satellite observations, validates, deduplicates, commits new records
    to the active SQLite database, updates spatial clusters, and invalidates in-memory caches.
    """
    try:
        return PipelineService.refresh_firms_data(req, db)
    except Exception as e:
        logger.error(f"Error refreshing FIRMS data: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
