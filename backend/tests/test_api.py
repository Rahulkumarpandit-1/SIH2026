import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_health():
    """Verify that the health check endpoint returns 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_api_summary_metrics():
    """Verify summary metrics computed from database observations."""
    response = client.get("/api/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_observations"] >= 15
    assert data["total_clusters"] >= 6
    assert data["critical_count"] >= 1
    assert "date_range" in data


def test_api_observations_count_and_fields():
    """Verify observations endpoint returns enriched records."""
    response = client.get("/api/observations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 15

    # Verify expected schema on first observation
    first_obs = data[0]
    for key in ["observation_id", "latitude", "longitude", "acq_date", "frp", "confidence", "cluster_id", "nearest_facility_name", "distance_to_industry_meters"]:
        assert key in first_obs


def test_api_clusters():
    """Verify clusters endpoint returns clusters with persistence metrics."""
    response = client.get("/api/clusters")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 6

    cluster_ids = [c["cluster_id"] for c in data]
    assert "CLUSTER_003" in cluster_ids
    assert "CLUSTER_001" in cluster_ids


def test_api_risk_sorting_and_critical_hazira():
    """Verify that /api/risk returns clusters sorted descending with Hazira (CLUSTER_003) at Rank #1."""
    response = client.get("/api/risk")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 6

    # Verify descending sort order
    scores = [c["risk_score"] for c in data]
    assert scores == sorted(scores, reverse=True)

    # Top item must be CLUSTER_003 (Hazira Outbreak)
    top_cluster = data[0]
    assert top_cluster["cluster_id"] == "CLUSTER_003"
    assert top_cluster["rank"] == 1
    assert top_cluster["risk_score"] >= 80.0
    assert top_cluster["risk_level"] == "CRITICAL"
    assert top_cluster["action_code"] == "EMERGENCY_DISPATCH"
    assert top_cluster["subscores"]["thermal_subscore"] > 90.0
    assert top_cluster["telemetry"]["is_anomaly_spike"] is True


def test_api_geojson_compliance():
    """Verify /api/geojson returns a valid GeoJSON FeatureCollection."""
    response = client.get("/api/geojson")
    assert response.status_code == 200
    geojson = response.json()

    assert geojson["type"] == "FeatureCollection"
    assert "features" in geojson
    assert len(geojson["features"]) > 0

    # Test geometry structure of the first feature
    first_feature = geojson["features"][0]
    assert first_feature["type"] == "Feature"
    assert first_feature["geometry"]["type"] == "Point"
    assert len(first_feature["geometry"]["coordinates"]) == 2
    assert "risk_score" in first_feature["properties"]
    assert "risk_level" in first_feature["properties"]


def test_api_osm_industrial_layer():
    """Verify /api/osm-industrial returns industrial polygons."""
    response = client.get("/api/osm-industrial")
    assert response.status_code == 200
    geojson = response.json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) > 0


def test_api_ml_evaluation():
    """Verify /api/ml-evaluation returns Random Forest feature importances and spatial CV."""
    response = client.get("/api/ml-evaluation")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "BENCHMARK_EVALUATION"
    assert "feature_importances" in data
    assert len(data["feature_importances"]) > 0
    assert "spatial_cv" in data
    assert "model_summary" in data
    assert data["model_summary"]["total_samples"] >= 15


def test_api_dataset_endpoints():
    """Verify Phase 7 dataset endpoints return observations with provenance and quality metrics."""
    # 1. /api/dataset
    r1 = client.get("/api/dataset")
    assert r1.status_code == 200
    dataset = r1.json()
    assert len(dataset) >= 15
    assert "label_name" in dataset[0]
    assert "label_source" in dataset[0]

    # 2. /api/dataset/quality
    r2 = client.get("/api/dataset/quality")
    assert r2.status_code == 200
    quality = r2.json()
    assert quality["total_unique_observations"] >= 15
    assert "scientific_assessment" in quality

    # 3. /api/dataset/provenance
    r3 = client.get("/api/dataset/provenance")
    assert r3.status_code == 200
    prov = r3.json()
    assert len(prov) > 0
    assert "source_reference" in prov[0]

