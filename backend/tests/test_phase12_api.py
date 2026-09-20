"""
Test Suite for Phase 12 API Endpoints
Verifies:
- GET /api/incidents
- GET /api/incidents/{incident_uuid}
- GET /api/incidents/{incident_uuid}/timeline
- GET /api/facilities/{facility_name}/history
- GET /api/incidents/archive
- PATCH /api/incidents/{incident_uuid}/status
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_incidents_list():
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "incident_uuid" in first
        assert "facility_name" in first
        assert "temporal_status" in first
        assert "status" in first
        assert "first_detected" in first
        assert "last_detected" in first


def test_api_incidents_filter_temporal_status():
    response = client.get("/api/incidents?temporal_status=RECENTLY_OBSERVED")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for inc in data:
        assert inc["temporal_status"] == "RECENTLY_OBSERVED"


def test_api_incidents_archive():
    response = client.get("/api/incidents/archive")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_api_incident_detail_and_timeline():
    # First fetch list to get a valid incident_uuid
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    incidents = resp.json()
    if len(incidents) > 0:
        test_uuid = incidents[0]["incident_uuid"]

        # Detail endpoint
        resp_detail = client.get(f"/api/incidents/{test_uuid}")
        assert resp_detail.status_code == 200
        det = resp_detail.json()
        assert det["incident_uuid"] == test_uuid
        assert "facility_name" in det
        assert "temporal_status" in det
        assert "telemetry" in det

        # Timeline endpoint
        resp_tl = client.get(f"/api/incidents/{test_uuid}/timeline")
        assert resp_tl.status_code == 200
        tl = resp_tl.json()
        assert tl["incident_uuid"] == test_uuid
        assert "events" in tl
        assert isinstance(tl["events"], list)
        assert len(tl["events"]) > 0
        assert "scientific_disclosure" in tl


def test_api_facility_history():
    resp = client.get("/api/facilities/Reliance%20Jamnagar/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "facility_name" in data
    assert "total_incidents" in data
    assert "verified_fires" in data
    assert "false_alarms" in data
    assert "controlled_flaring" in data
    assert "highest_recorded_frp" in data
    assert "average_risk_score" in data


def test_api_update_incident_status():
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    incidents = resp.json()
    if len(incidents) > 0:
        test_uuid = incidents[0]["incident_uuid"]
        orig_status = incidents[0]["status"]

        # Update status
        patch_resp = client.patch(
            f"/api/incidents/{test_uuid}/status",
            json={"status": "UNDER_REVIEW"}
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["status"] == "UNDER_REVIEW"

        # Revert status
        patch_revert = client.patch(
            f"/api/incidents/{test_uuid}/status",
            json={"status": orig_status}
        )
        assert patch_revert.status_code == 200
        assert patch_revert.json()["status"] == orig_status
