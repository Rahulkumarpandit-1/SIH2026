import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_ground_truth_feed():
    res = client.get("/api/ground-truth")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 6

    first_item = data[0]
    for key in ["incident_uuid", "facility_name", "assigned_label", "risk_score", "max_frp", "weather_context", "exposure_context", "facility_fingerprint", "abnormality_detection"]:
        assert key in first_item


def test_api_create_and_update_ground_truth_label():
    # 1. Create label
    payload = {
        "incident_uuid": "CLUSTER_004",
        "facility_name": "ONGC Hazira Gas Processing Terminal",
        "assigned_label": "CONTROLLED_FLARING",
        "reviewer_name": "Reviewer Alpha",
        "review_notes": "Sweetening flare operational."
    }
    create_res = client.post("/api/ground-truth", json=payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["incident_uuid"] == "CLUSTER_004"
    assert created["assigned_label"] == "CONTROLLED_FLARING"
    assert created["reviewer_name"] == "Reviewer Alpha"
    label_id = created["id"]

    # 2. Update label
    update_payload = {
        "assigned_label": "MAINTENANCE_ACTIVITY",
        "review_notes": "Updated to maintenance purge burn."
    }
    update_res = client.put(f"/api/ground-truth/{label_id}", json=update_payload)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["id"] == label_id
    assert updated["assigned_label"] == "MAINTENANCE_ACTIVITY"
    assert updated["review_notes"] == "Updated to maintenance purge burn."


def test_api_ground_truth_export():
    res = client.get("/api/ground-truth/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "incident_uuid,facility_name,assigned_label" in res.text


def test_api_ml_dataset_summary():
    res = client.get("/api/ml/dataset")
    assert res.status_code == 200
    data = res.json()
    assert "total_samples" in data
    assert data["total_samples"] >= 6
    assert data["feature_count"] == 13
    assert "label_distribution" in data
    assert "features" in data
    assert len(data["features"]) == 13


def test_api_ml_dataset_download():
    res = client.get("/api/ml/dataset?download=true")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "risk_score" in res.text
    assert "ground_truth_label" in res.text
