"""
API Integration Tests for Phase 13 — Explainable Risk Intelligence & Decision Support
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.db_models import IncidentRecordModel
from app.api.service import PipelineService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_incident_uuid(client):
    """Fetches or ensures at least one registered incident exists in the DB."""
    res = client.get("/api/incidents")
    assert res.status_code == 200
    incidents = res.json()
    assert len(incidents) > 0, "Expected registered incidents from API"
    return incidents[0]["incident_uuid"]


def test_api_risk_attribution(client, sample_incident_uuid):
    """Test GET /api/incidents/{incident_uuid}/risk-attribution."""
    res = client.get(f"/api/incidents/{sample_incident_uuid}/risk-attribution")
    assert res.status_code == 200
    data = res.json()
    assert "risk_score" in data
    assert "contributors" in data
    assert len(data["contributors"]) >= 4
    assert "primary_factor" in data
    assert "explanation" in data


def test_api_abnormality_breakdown(client, sample_incident_uuid):
    """Test GET /api/incidents/{incident_uuid}/abnormality-breakdown."""
    res = client.get(f"/api/incidents/{sample_incident_uuid}/abnormality-breakdown")
    assert res.status_code == 200
    data = res.json()
    assert "abnormality_score" in data
    assert "abnormality_status" in data
    assert "components" in data
    assert len(data["components"]) == 4
    assert "plain_language_explanation" in data


def test_api_similar_incidents(client, sample_incident_uuid):
    """Test GET /api/incidents/{incident_uuid}/similar."""
    res = client.get(f"/api/incidents/{sample_incident_uuid}/similar?top_k=3")
    assert res.status_code == 200
    data = res.json()
    assert "incident_uuid" in data
    assert "similar_incidents" in data
    assert isinstance(data["similar_incidents"], list)


def test_api_facility_risk_profile(client):
    """Test GET /api/facilities/{facility_name}/risk-profile."""
    facility_name = "Reliance Jamnagar Refinery"
    res = client.get(f"/api/facilities/{facility_name}/risk-profile")
    assert res.status_code == 200
    data = res.json()
    assert data["facility_name"] == facility_name
    assert "historical_trend" in data
    assert "risk_tier" in data
    assert "average_risk_score" in data


def test_api_executive_summary(client, sample_incident_uuid):
    """Test GET /api/incidents/{incident_uuid}/executive-summary."""
    res = client.get(f"/api/incidents/{sample_incident_uuid}/executive-summary")
    assert res.status_code == 200
    data = res.json()
    assert "executive_summary" in data
    assert "key_bullet_points" in data
    assert len(data["key_bullet_points"]) == 4
    assert "evidence_telemetry" in data
    assert len(data["executive_summary"]) > 30


def test_api_not_found_errors(client):
    """Test 404 responses for non-existent incident UUIDs."""
    bogus_uuid = "INC-99999999-NONEXISTENT"
    res_attr = client.get(f"/api/incidents/{bogus_uuid}/risk-attribution")
    assert res_attr.status_code == 404

    res_abn = client.get(f"/api/incidents/{bogus_uuid}/abnormality-breakdown")
    assert res_abn.status_code == 404

    res_sim = client.get(f"/api/incidents/{bogus_uuid}/similar")
    assert res_sim.status_code == 404

    res_exec = client.get(f"/api/incidents/{bogus_uuid}/executive-summary")
    assert res_exec.status_code == 404
