from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query, Response
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
    DashboardSummaryResponse,
    WeatherContext,
    ExposureContext,
    FacilityThermalFingerprint,
    AbnormalityDetectionResult,
    GroundTruthLabelCreate,
    GroundTruthLabelUpdate,
    GroundTruthLabelResponse,
    MLDatasetSummaryResponse,
    MonitoredRegionResponse,
    ExposureAssetResponse,
    TemporalIntelligenceResult,
    IncidentSummaryResponse,
    IncidentDetailResponse,
    IncidentTimelineResponse,
    FacilityHistoryResponse,
    IncidentStatusUpdate,
    RiskAttributionResponse,
    AbnormalityBreakdownResponse,
    SimilarIncidentsResponse,
    FacilityRiskProfileResponse,
    ExecutiveSummaryResponse,
    ReviewAuditLogResponse,
    ReviewerAnalyticsResponse,
    DatasetQualityResponse,
    TrainingReadinessResponse
)
from app.ingestion.weather_client import WeatherClient
from app.spatial.exposure_engine import ExposureAnalysisService
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
from app.core.regions import tag_coordinates
from app.scoring.abnormality_engine import AbnormalityEngine
from app.ml.ground_truth_service import GroundTruthService
from app.ml.dataset_builder import MLDatasetBuilder
from app.ml.governance_service import ReviewerAnalyticsService, DatasetQualityService
from app.ml.training_readiness import TrainingReadinessEngine
from app.services.incident_registry import IncidentRegistryService
from app.services.incident_timeline import IncidentTimelineService
from app.services.facility_history import FacilityHistoryService
from app.intelligence.risk_attribution import RiskAttributionEngine
from app.intelligence.abnormality_explainer import AbnormalityExplainer
from app.intelligence.similar_incidents import SimilarIncidentsEngine
from app.intelligence.facility_risk_profile import FacilityRiskProfileEngine
from app.intelligence.executive_summary import ExecutiveSummaryEngine

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
def get_summary(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code (e.g. WEST_GUJARAT, WEST_MAHARASHTRA, ALL_INDIA)"),
    state: Optional[str] = Query(default=None, description="Filter by state (e.g. Gujarat, Maharashtra)"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns high-level KPI metrics computed from the analyzed observation database
    including near-real-time refresh timestamps, stream breakdown, and regional filtering.
    """
    pipeline_data = PipelineService.get_filtered_analyzed_data(db, region=region, state=state)
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
            "next_satellite_check_seconds": refresh_status.get("next_satellite_check_seconds"),
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
        "next_satellite_check_seconds": refresh_status.get("next_satellite_check_seconds"),
        "live_observations_count": live_count,
        "historical_observations_count": hist_count,
        "monitoring_mode": "NEAR_REAL_TIME"
    }


@router.get("/observations", summary="List Enriched Satellite Hotspot Observations")
def get_observations(
    stream_type: Optional[str] = Query(default=None, description="'all', 'near_real_time', or 'historical'"),
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    state: Optional[str] = Query(default=None, description="Filter by state"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns the complete list of individual satellite hotspot observations enriched with
    spatial context, nearest industrial facility distance, and cluster associations.
    """
    pipeline_data = PipelineService.get_filtered_analyzed_data(db, region=region, state=state)
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
            "stream_type": str(row.get("stream_type", "historical")),
            "state": str(row.get("state") if row.get("state") and row.get("state") != "Gujarat" else tag_coordinates(float(row["latitude"]), float(row["longitude"]))[0]),
            "region_code": str(row.get("region_code") if row.get("region_code") and row.get("region_code") != "WEST_GUJARAT" else tag_coordinates(float(row["latitude"]), float(row["longitude"]))[1])
        })

    return results


@router.get("/clusters", summary="List Physical Thermal Clusters & Persistence Metrics")
def get_clusters(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    state: Optional[str] = Query(default=None, description="Filter by state"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns spatio-temporal cluster summaries computed by DBSCAN and the PersistenceEngine.
    """
    pipeline_data = PipelineService.get_filtered_analyzed_data(db, region=region, state=state)
    clusters_df = pipeline_data["clusters_df"]

    if clusters_df.empty:
        return []

    results = []
    for _, row in clusters_df.iterrows():
        c_lat = float(row["centroid_lat"])
        c_lon = float(row["centroid_lon"])
        calc_st, calc_reg = tag_coordinates(c_lat, c_lon)
        results.append({
            "cluster_id": str(row["cluster_id"]),
            "incident_uuid": str(row.get("incident_uuid", row["cluster_id"])),
            "stream_type": str(row.get("stream_type", "historical")),
            "live_detections_count": int(row.get("live_detections_count", 0)),
            "status": str(row.get("status", "NEW")),
            "temporal_status": str(row.get("temporal_status", "HISTORICAL")),
            "first_detected": str(row["first_detected"]) if pd.notna(row.get("first_detected")) and str(row.get("first_detected")).strip() not in ("", "nan", "None") else None,
            "last_detected": str(row["last_detected"]) if pd.notna(row.get("last_detected")) and str(row.get("last_detected")).strip() not in ("", "nan", "None") else None,
            "incident_age_hours": float(row.get("incident_age_hours", 0.0)) if pd.notna(row.get("incident_age_hours")) else None,
            "active_duration_hours": float(row.get("active_duration_hours", 0.0)) if pd.notna(row.get("active_duration_hours")) else None,
            "observation_freshness_minutes": float(row["observation_freshness_minutes"]) if pd.notna(row.get("observation_freshness_minutes")) and row.get("observation_freshness_minutes") is not None else None,
            "centroid_latitude": round(c_lat, 6),
            "centroid_longitude": round(c_lon, 6),
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
            "incident_classification": str(row.get("incident_classification", "UNKNOWN")),
            "state": str(row.get("state") if row.get("state") and row.get("state") != "Gujarat" else calc_st),
            "region_code": str(row.get("region_code") if row.get("region_code") and row.get("region_code") != "WEST_GUJARAT" else calc_reg),
            "weather_context": row.get("weather_context") or {},
            "exposure_context": row.get("exposure_context") or {},
            "facility_fingerprint": row.get("facility_fingerprint") or {},
            "abnormality_detection": row.get("abnormality_detection") or {},
            "temporal_intelligence": row.get("temporal_intelligence") or {}
        })

    return results


@router.get("/risk", summary="Ranked Incident Prioritization & Explainable Risk Feed")
def get_risk_prioritization(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    state: Optional[str] = Query(default=None, description="Filter by state"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns the complete Phase 4 multi-signal risk evaluations for all detected clusters,
    sorted by risk_score in descending order (highest emergency priority first).
    """
    pipeline_data = PipelineService.get_filtered_analyzed_data(db, region=region, state=state)
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
            "incident_uuid": str(row.get("incident_uuid", row["cluster_id"])),
            "stream_type": str(row.get("stream_type", "historical")),
            "live_detections_count": int(row.get("live_detections_count", 0)),
            "status": str(row.get("status", "NEW")),
            "temporal_status": str(row.get("temporal_status", "HISTORICAL")),
            "first_detected": str(row["first_detected"]) if pd.notna(row.get("first_detected")) and str(row.get("first_detected")).strip() not in ("", "nan", "None") else None,
            "last_detected": str(row["last_detected"]) if pd.notna(row.get("last_detected")) and str(row.get("last_detected")).strip() not in ("", "nan", "None") else None,
            "incident_age_hours": float(row.get("incident_age_hours", 0.0)) if pd.notna(row.get("incident_age_hours")) else None,
            "active_duration_hours": float(row.get("active_duration_hours", 0.0)) if pd.notna(row.get("active_duration_hours")) else None,
            "observation_freshness_minutes": float(row["observation_freshness_minutes"]) if pd.notna(row.get("observation_freshness_minutes")) and row.get("observation_freshness_minutes") is not None else None,
            "risk_score": round(float(row["risk_score"]), 2),
            "risk_level": str(row["risk_level"]),
            "action_code": str(row["action_code"]),
            "action_directive": str(row.get("action_directive", row["action_code"])),
            "legacy_action_code": str(row.get("legacy_action_code", "")),
            "recommendation_statement": str(row.get("recommendation_statement", "")),
            "incident_classification": str(row["incident_classification"]),
            "state": str(row.get("state", "Gujarat")),
            "region_code": str(row.get("region_code", "WEST_GUJARAT")),
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
            "centroid_longitude": round(float(row["centroid_lon"]), 6),
            "weather_context": row.get("weather_context") or {},
            "exposure_context": row.get("exposure_context") or {},
            "facility_fingerprint": row.get("facility_fingerprint") or {},
            "abnormality_detection": row.get("abnormality_detection") or {},
            "temporal_intelligence": row.get("temporal_intelligence") or {}
        })

    return results


@router.get("/weather", summary="Live Meteorological Context at Coordinates", response_model=WeatherContext)
def get_weather(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
) -> Dict[str, Any]:
    """
    Fetches real-time atmospheric context (wind speed, wind direction, temperature, cloud cover,
    precipitation) via Open-Meteo API with 15-minute in-memory caching and observation confidence scoring.
    """
    return WeatherClient.get_weather_context(latitude, longitude)


@router.get("/exposure", summary="Incident Geospatial Exposure Analysis", response_model=ExposureContext)
def get_exposure(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees"),
    wind_direction_deg: Optional[float] = Query(default=None, ge=0.0, le=360.0, description="Wind direction in degrees (0-360)"),
    wind_speed_kmh: Optional[float] = Query(default=None, ge=0.0, le=300.0, description="Wind speed in km/h")
) -> Dict[str, Any]:
    """
    Executes multi-domain exposure analysis evaluating Population, Infrastructure,
    Environmental, and Downwind Plume Sector exposure around given coordinates.
    If wind parameters are omitted, live atmospheric context is queried automatically.
    """
    if wind_direction_deg is None or wind_speed_kmh is None:
        wx = WeatherClient.get_weather_context(latitude, longitude)
        wind_direction_deg = float(wx.get("wind_direction_deg", 180.0))
        wind_speed_kmh = float(wx.get("wind_speed_kmh", 15.0))

    return ExposureAnalysisService.analyze_incident_exposure(
        lat=latitude,
        lon=longitude,
        wind_direction_deg=wind_direction_deg,
        wind_speed_kmh=wind_speed_kmh
    )


@router.get("/facilities/fingerprint", summary="Facility Historical Thermal Baseline Profile", response_model=FacilityThermalFingerprint)
def get_facility_fingerprint(
    facility_name: str = Query(..., description="Name of industrial facility"),
    current_frp: float = Query(default=15.0, ge=0.0, description="Current observed peak FRP in MW"),
    facility_type: Optional[str] = Query(default=None, description="Optional facility classification")
) -> Dict[str, Any]:
    """
    Evaluates observed thermal radiative power against the facility's authoritative historical baseline,
    computing anomaly ratio, operational deviation status (NORMAL/ELEVATED/ABNORMAL/CRITICAL), and explanation.
    """
    return FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name=facility_name,
        current_frp=current_frp,
        facility_type=facility_type
    )


@router.get("/abnormality", summary="Evaluate Multi-Dimensional Abnormality Profile", response_model=AbnormalityDetectionResult)
def get_abnormality(
    facility_name: str = Query(default="Industrial Facility", description="Name of industrial facility"),
    current_frp: float = Query(default=25.0, ge=0.0, description="Current peak observed FRP in MW"),
    avg_frp: Optional[float] = Query(default=None, ge=0.0, description="Cluster average FRP in MW"),
    active_days: Optional[int] = Query(default=1, ge=1, description="Active observation days count"),
    total_detections: Optional[int] = Query(default=1, ge=1, description="Total satellite detections count"),
    is_anomaly_spike: Optional[bool] = Query(default=False, description="Whether acute anomaly spike was flagged"),
    facility_type: Optional[str] = Query(default=None, description="Optional facility classification"),
    baseline_frp: Optional[float] = Query(default=None, ge=0.0, description="Optional custom baseline FRP override")
) -> Dict[str, Any]:
    """
    Evaluates multi-dimensional operational abnormality across Heat Intensity,
    Persistence Duration, Thermal Growth, and Recurrence Frequency.
    Returns composite abnormality score (0-100), status classification, and explainable reasons.
    """
    return AbnormalityEngine.evaluate_abnormality(
        facility_name=facility_name,
        current_frp=current_frp,
        avg_frp=avg_frp,
        active_days=active_days,
        total_detections=total_detections,
        is_anomaly_spike=is_anomaly_spike,
        facility_type=facility_type,
        baseline_frp_override=baseline_frp
    )



@router.get("/geojson", summary="Thermal Hotspots GeoJSON FeatureCollection")
def get_geojson_layer(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    state: Optional[str] = Query(default=None, description="Filter by state"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns satellite observations formatted as standard RFC 7946 GeoJSON Point features,
    with optional regional corridor filtering.
    """
    pipeline_data = PipelineService.get_filtered_analyzed_data(db, region=region, state=state)
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
                    "stream_type": str(row.get("stream_type", "historical")),
                    "state": str(row.get("state", "Gujarat")),
                    "region_code": str(row.get("region_code", "WEST_GUJARAT"))
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/osm-industrial", summary="OpenStreetMap Industrial Boundaries GeoJSON Layer")
def get_osm_industrial_layer(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    bbox: Optional[str] = Query(default=None, description="Bounding box filter min_lon,min_lat,max_lon,max_lat"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns OpenStreetMap industrial boundary polygons, with optional bounding-box or corridor clipping.
    """
    pipeline_data = PipelineService.get_analyzed_data(db)
    geojson = pipeline_data.get("osm_geojson", {"type": "FeatureCollection", "features": []})

    target_bbox = None
    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) == 4:
                target_bbox = parts
        except Exception:
            pass
    elif region and region.strip().upper() not in ["ALL", "ALL_INDIA"]:
        from app.core.regions import get_region_by_code
        reg_info = get_region_by_code(region)
        if reg_info and "bbox" in reg_info:
            target_bbox = reg_info["bbox"]

    if target_bbox and len(target_bbox) == 4:
        min_lon, min_lat, max_lon, max_lat = target_bbox
        filtered = []
        for feat in geojson.get("features", []):
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            if coords and len(coords) > 0:
                # Handle Polygon or MultiPolygon
                pt = coords[0][0] if isinstance(coords[0], list) and len(coords[0]) > 0 else coords[0]
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    if min_lon - 0.2 <= pt[0] <= max_lon + 0.2 and min_lat - 0.2 <= pt[1] <= max_lat + 0.2:
                        filtered.append(feat)
        return {"type": "FeatureCollection", "features": filtered}

    return geojson


@router.get("/regions", summary="List Monitored Industrial Regions & Corridors", response_model=List[MonitoredRegionResponse])
def get_monitored_regions(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns active monitored industrial regions across India with centroids,
    coverage bounding boxes, and metadata.
    """
    return PipelineService.get_monitored_regions(db)


@router.get("/facilities", summary="List Monitored Industrial Facilities with Baselines")
def get_facilities(
    region: Optional[str] = Query(default=None, description="Filter by corridor code (e.g. WEST_GUJARAT, WEST_MAHARASHTRA)"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns catalog of monitored industrial plants and complexes with historical thermal profiles.
    """
    return PipelineService.get_facility_directory(db, region=region)


@router.get("/exposure-assets", summary="List Critical Exposure Receptors", response_model=List[ExposureAssetResponse])
def get_exposure_assets(
    region: Optional[str] = Query(default=None, description="Filter by corridor code"),
    category: Optional[str] = Query(default=None, description="Filter by category: POPULATION, INFRASTRUCTURE, ENVIRONMENTAL"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns critical population, infrastructure, and environmental receptors with coordinates.
    """
    gdf = ExposureAnalysisService.load_assets()
    if gdf.empty:
        return []

    records = []
    norm_reg = region.strip().upper() if region else None
    norm_cat = category.strip().upper() if category else None

    for _, row in gdf.iterrows():
        reg = str(row.get("region_code", "WEST_GUJARAT"))
        cat = str(row.get("category", "POPULATION"))
        if norm_reg and norm_reg not in ["ALL", "ALL_INDIA"] and reg != norm_reg:
            continue
        if norm_cat and cat != norm_cat:
            continue
        geom = row.geometry
        lat = round(float(geom.y), 6) if hasattr(geom, "y") else 0.0
        lon = round(float(geom.x), 6) if hasattr(geom, "x") else 0.0
        records.append({
            "asset_id": str(row.get("asset_id", "")),
            "name": str(row.get("name", "")),
            "region_code": reg,
            "state": str(row.get("state", "Gujarat")),
            "category": cat,
            "sub_type": str(row.get("sub_type", "")),
            "criticality": str(row.get("criticality", "MEDIUM")),
            "latitude": lat,
            "longitude": lon,
            "description": str(row.get("description", "")),
            "source": "OSM_OVERPASS"
        })
    return records



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
    Returns active incidents/clusters enriched with their verified ground truth annotations (or UNLABELED status).
    """
    return GroundTruthService.get_review_feed(db)


@router.post("/ground-truth", summary="Submit Analyst Ground Truth Label", response_model=GroundTruthLabelResponse)
def create_ground_truth_label(
    label_in: GroundTruthLabelCreate,
    db: Session = Depends(get_db)
) -> GroundTruthLabelResponse:
    """
    Records a verified human review annotation with reviewer audit trail and label classification.
    """
    try:
        return GroundTruthService.create_label(db, label_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating ground-truth label: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/ground-truth/{label_id}", summary="Update Analyst Ground Truth Label", response_model=GroundTruthLabelResponse)
def update_ground_truth_label(
    label_id: int,
    label_up: GroundTruthLabelUpdate,
    db: Session = Depends(get_db)
) -> GroundTruthLabelResponse:
    """
    Updates an existing ground-truth review label.
    """
    try:
        return GroundTruthService.update_label(db, label_id, label_up)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating ground-truth label: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/ground-truth/export", summary="Export Ground Truth Training Records")
def export_ground_truth_records(db: Session = Depends(get_db)) -> Response:
    """
    Exports all verified human ground-truth labels as a downloadable CSV dataset.
    """
    csv_data = GroundTruthService.export_training_records(db)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ground_truth_labels.csv"}
    )


@router.post("/ground-truth/review", summary="Legacy Submit Human Ground Truth Review")
def submit_ground_truth_review(
    review: GroundTruthReviewRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Legacy endpoint: Records a verified human review annotation with reviewer audit trail.
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


@router.get("/review-audit", summary="Human Review Audit Trail Feed", response_model=List[ReviewAuditLogResponse])
def get_review_audit_trail(
    incident_uuid: Optional[str] = Query(default=None, description="Filter audit trail by incident UUID"),
    reviewer: Optional[str] = Query(default=None, description="Filter audit trail by reviewer name"),
    limit: int = Query(default=50, ge=1, le=500, description="Max audit entries to retrieve"),
    db: Session = Depends(get_db)
) -> List[ReviewAuditLogResponse]:
    """
    Returns the immutable audit log of ground-truth reviews, recording every label creation and modification.
    """
    return GroundTruthService.get_audit_trail(db, incident_uuid=incident_uuid, reviewer_name=reviewer, limit=limit)


@router.get("/reviewers", summary="Reviewer Accountability & Leaderboard Analytics", response_model=ReviewerAnalyticsResponse)
def get_reviewer_analytics(db: Session = Depends(get_db)) -> ReviewerAnalyticsResponse:
    """
    Returns reviewer telemetry, review counts by class, daily trends, and contributor leaderboard.
    """
    return ReviewerAnalyticsService.get_analytics(db)


@router.get("/dataset-quality", summary="Empirical Dataset Quality & Coverage Telemetry", response_model=DatasetQualityResponse)
def get_dataset_quality_metrics(db: Session = Depends(get_db)) -> DatasetQualityResponse:
    """
    Returns empirical dataset coverage, class distribution, regional/facility spread, and 7-day trend.
    """
    return DatasetQualityService.get_quality_metrics(db)


@router.get("/ml/readiness", summary="5-Dimensional Scientific ML Training Readiness Evaluation", response_model=TrainingReadinessResponse)
def get_ml_training_readiness(db: Session = Depends(get_db)) -> TrainingReadinessResponse:
    """
    Scientifically evaluates dataset sufficiency across 5 empirical dimensions:
    total verified labels, class balance, facility diversity, regional diversity, and reviewer diversity.
    """
    return TrainingReadinessEngine.evaluate(db)


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


@router.get("/ml/dataset", summary="Get or Export ML-Ready Dataset")
def get_ml_dataset(
    download: bool = Query(default=False, description="Set true to download as CSV file"),
    db: Session = Depends(get_db)
) -> Any:
    """
    Returns Phase 10 ML Dataset summary statistics and feature breakdown,
    or streams the complete 13-feature ml_dataset.csv file for supervised model training.
    """
    if download:
        csv_data = MLDatasetBuilder.get_dataset_csv_string(db)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ml_dataset.csv"}
        )
    return MLDatasetBuilder.get_dataset_summary(db)


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


# ==============================================================================
# PHASE 12 — TEMPORAL INTELLIGENCE, INCIDENT REGISTRY & INVESTIGATION APIS
# ==============================================================================

@router.get("/incidents", summary="List Persistent Incidents with Temporal Filters", response_model=List[IncidentSummaryResponse])
def get_incidents(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code (e.g. WEST_GUJARAT)"),
    state: Optional[str] = Query(default=None, description="Filter by state name"),
    temporal_status: Optional[str] = Query(default=None, description="Filter: RECENTLY_OBSERVED, RECENT, HISTORICAL (or alias ACTIVE)"),
    status: Optional[str] = Query(default=None, description="Filter: NEW, UNDER_REVIEW, VERIFIED_FIRE, FALSE_ALARM, CONTROLLED_FLARING, ARCHIVED"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
) -> List[IncidentSummaryResponse]:
    """
    Returns persistent, traceable incident records decoupled from transient DBSCAN cluster IDs.
    Supports filtering by observation-derived temporal classification and investigation lifecycle status.
    """
    # Ensure incidents table is synchronized with active observations
    PipelineService.get_analyzed_data(db)

    incidents = IncidentRegistryService.list_incidents(
        db=db,
        region=region,
        state=state,
        temporal_status=temporal_status,
        status=status,
        limit=limit,
        offset=offset
    )
    return [IncidentSummaryResponse.model_validate(inc) for inc in incidents]


@router.get("/incidents/archive", summary="List Archived and Historical Incident Records", response_model=List[IncidentSummaryResponse])
def get_incidents_archive(
    region: Optional[str] = Query(default=None, description="Filter by industrial corridor code"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db)
) -> List[IncidentSummaryResponse]:
    """
    Returns incident records categorized as HISTORICAL (>24h since latest satellite detection)
    or explicitly marked as ARCHIVED.
    """
    PipelineService.get_analyzed_data(db)
    archived = IncidentRegistryService.get_archived_incidents(db=db, region=region, limit=limit, offset=offset)
    return [IncidentSummaryResponse.model_validate(inc) for inc in archived]


@router.get("/incidents/{incident_uuid}", summary="Get Incident Detail with Temporal Intelligence", response_model=IncidentDetailResponse)
def get_incident_detail(
    incident_uuid: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieves full incident investigation dossier:
    - Persistent UUID & Lifecycle Status
    - Observation-Derived Temporal Metrics (Freshness, Age, Duration, Detection Count)
    - Real-Time Weather Context & Atmospheric Dispersion
    - Geospatial Exposure Receptors & Downwind Hazard Cone
    - Facility Thermal Fingerprint Baseline Excursion
    - Multi-Dimensional Abnormality Profile
    """
    detail = PipelineService.get_incident_detail(db, incident_uuid)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_uuid}' not found in registry."
        )
    return detail


@router.get("/incidents/{incident_uuid}/timeline", summary="Chronological Incident Timeline", response_model=IncidentTimelineResponse)
def get_incident_timeline(
    incident_uuid: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Reconstructs an explainable, chronological stream of investigation events:
    First Detection -> Peak FRP -> Latest Detection -> Risk / Weather / Exposure / Abnormality
    Analyses -> Human Ground-Truth Reviews.
    """
    # Ensure data is warm
    PipelineService.get_analyzed_data(db)
    try:
        return IncidentTimelineService.generate_timeline(db, incident_uuid)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating timeline for {incident_uuid}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/facilities/{facility_name}/history", summary="Facility Historical Intelligence Profile", response_model=FacilityHistoryResponse)
def get_facility_history(
    facility_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Computes longitudinal facility track records and precedent statistics:
    Total Incidents, Verified Fires, False Alarms, Controlled Flaring Events,
    Average Risk & Abnormality Scores, Historical Average & Peak FRP, and Last Incident Date.
    """
    PipelineService.get_analyzed_data(db)
    return FacilityHistoryService.get_facility_history(db, facility_name)


@router.patch("/incidents/{incident_uuid}/status", summary="Update Incident Lifecycle Status", response_model=IncidentSummaryResponse)
def update_incident_status(
    incident_uuid: str,
    status_update: IncidentStatusUpdate,
    db: Session = Depends(get_db)
) -> IncidentSummaryResponse:
    """
    Transitions incident lifecycle state:
    NEW -> UNDER_REVIEW -> VERIFIED_FIRE | FALSE_ALARM | CONTROLLED_FLARING | ARCHIVED
    """
    try:
        inc = IncidentRegistryService.update_incident_status(db, incident_uuid, status_update.status)
        return IncidentSummaryResponse.model_validate(inc)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating incident status: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# PHASE 13 — EXPLAINABLE RISK INTELLIGENCE & DECISION SUPPORT APIS
# ==============================================================================

@router.get("/incidents/{incident_uuid}/risk-attribution", summary="Explainable Risk Factor Attribution", response_model=RiskAttributionResponse)
def get_incident_risk_attribution(
    incident_uuid: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Deconstructs composite incident risk score into ranked, explainable contributing factors
    (Thermal Intensity, Proximity, Persistence, Confidence, Exposure).
    """
    detail = PipelineService.get_incident_detail(db, incident_uuid)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_uuid}' not found.")

    subscores = detail.get("telemetry", {}).get("subscores") or {}
    attribution = RiskAttributionEngine.compute_attribution(
        risk_score=detail["risk_score"],
        subscores=subscores,
        telemetry=detail.get("telemetry", {}),
        exposure_context=detail.get("exposure_context", {}),
        risk_level=detail.get("risk_level")
    )
    attribution["incident_uuid"] = detail["incident_uuid"]
    return attribution


@router.get("/incidents/{incident_uuid}/abnormality-breakdown", summary="Multi-Dimensional Abnormality Diagnostic Breakdown", response_model=AbnormalityBreakdownResponse)
def get_incident_abnormality_breakdown(
    incident_uuid: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Breaks down multi-dimensional abnormality into points out of 100:
    Heat Intensity (x/40), Thermal Growth (x/25), Persistence (x/20), Recurrence (x/15)
    with plain-language diagnostic explanation.
    """
    detail = PipelineService.get_incident_detail(db, incident_uuid)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_uuid}' not found.")

    ab_data = detail.get("abnormality_detection") or {}
    breakdown = AbnormalityExplainer.explain_abnormality(
        abnormality_data=ab_data,
        facility_name=detail["facility_name"]
    )
    breakdown["incident_uuid"] = detail["incident_uuid"]
    return breakdown


@router.get("/incidents/{incident_uuid}/similar", summary="Top Historically Similar Incidents", response_model=SimilarIncidentsResponse)
def get_similar_incidents(
    incident_uuid: str,
    top_k: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Identifies top K historically similar incidents based on risk score, peak FRP,
    facility type, thermal anomaly ratio, abnormality score, and persistence.
    """
    PipelineService.get_analyzed_data(db)
    try:
        return SimilarIncidentsEngine.find_similar_incidents(db, incident_uuid, top_k=top_k)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing similar incidents for {incident_uuid}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/facilities/{facility_name}/risk-profile", summary="Facility Longitudinal Risk & Compliance Profile", response_model=FacilityRiskProfileResponse)
def get_facility_risk_profile(
    facility_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generates facility-level intelligence: total incidents, verified fires, false alarms,
    flaring events, average risk/abnormality, peak FRP, historical trend, and risk tier.
    """
    PipelineService.get_analyzed_data(db)
    return FacilityRiskProfileEngine.generate_facility_risk_profile(db, facility_name)


@router.get("/incidents/{incident_uuid}/executive-summary", summary="Deterministic Executive Incident Summary", response_model=ExecutiveSummaryResponse)
def get_incident_executive_summary(
    incident_uuid: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generates concise analyst-ready executive summary using only verified platform telemetry.
    100% deterministic, zero external LLMs.
    """
    detail = PipelineService.get_incident_detail(db, incident_uuid)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{incident_uuid}' not found.")

    return ExecutiveSummaryEngine.generate_summary(detail)

