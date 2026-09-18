import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
from app.db.session import SessionLocal
from app.db.db_models import FacilityThermalProfileModel


def test_facility_profile_matching():
    # Exact match
    jamnagar = FacilityFingerprintEngine.get_facility_profile("Jamnagar Petroleum Refining Complex")
    assert jamnagar["baseline_frp"] == 22.5
    assert jamnagar["max_historical_frp"] == 45.0

    # Substring / fuzzy match
    hazira = FacilityFingerprintEngine.get_facility_profile("Hazira Steel Works")
    assert hazira["baseline_frp"] == 18.0

    # Unnamed / fallback
    fallback = FacilityFingerprintEngine.get_facility_profile("Unknown")
    assert fallback["baseline_frp"] == 8.0


def test_anomaly_classification_thresholds():
    # Jamnagar baseline is 22.5 MW
    # 1. NORMAL: FRP = 20 MW (ratio = 0.89 <= 1.25)
    res_norm = FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name="Jamnagar Petroleum Refining Complex",
        current_frp=20.0
    )
    assert res_norm["thermal_status"] == "NORMAL"
    assert res_norm["anomaly_ratio"] <= 1.25
    assert "consistent with routine" in res_norm["explanation"]

    # 2. ELEVATED: FRP = 35 MW (ratio = 1.56 in (1.25, 2.0])
    res_elev = FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name="Jamnagar Petroleum Refining Complex",
        current_frp=35.0
    )
    assert res_elev["thermal_status"] == "ELEVATED"
    assert 1.25 < res_elev["anomaly_ratio"] <= 2.0

    # 3. ABNORMAL: FRP = 60 MW (ratio = 2.67 in (2.0, 3.5])
    res_abn = FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name="Jamnagar Petroleum Refining Complex",
        current_frp=60.0
    )
    assert res_abn["thermal_status"] == "ABNORMAL"
    assert 2.0 < res_abn["anomaly_ratio"] <= 3.5

    # 4. CRITICAL: FRP = 95 MW (ratio = 4.22 > 3.5)
    res_crit = FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name="Jamnagar Petroleum Refining Complex",
        current_frp=95.0
    )
    assert res_crit["thermal_status"] == "CRITICAL"
    assert res_crit["anomaly_ratio"] > 3.5
    assert "CRITICAL THERMAL EXCURSION" in res_crit["explanation"]


def test_db_seeding():
    db = SessionLocal()
    try:
        FacilityFingerprintEngine.seed_database_profiles(db)
        count = db.query(FacilityThermalProfileModel).count()
        assert count >= len(FacilityFingerprintEngine.KNOWN_BASELINES)
    finally:
        db.close()


def test_facility_fingerprint_api_endpoint():
    client = TestClient(app)
    response = client.get("/api/facilities/fingerprint?facility_name=Hazira+Heavy+Industrial+%26+Steel+Complex&current_frp=92.7")
    assert response.status_code == 200
    data = response.json()
    assert data["facility_name"] == "Hazira Heavy Industrial & Steel Complex"
    assert data["baseline_frp"] == 18.0
    assert data["current_frp"] == 92.7
    assert data["anomaly_ratio"] == 5.15
    assert data["thermal_status"] == "CRITICAL"
    assert "explanation" in data
    assert "max_historical_frp" in data
    assert "event_frequency" in data
    assert "seasonal_behavior" in data


def test_risk_endpoint_includes_facility_fingerprint():
    client = TestClient(app)
    response = client.get("/api/risk")
    assert response.status_code == 200
    data = response.json()
    if data:
        incident = data[0]
        assert "facility_fingerprint" in incident
        fp = incident["facility_fingerprint"]
        assert "baseline_frp" in fp
        assert "anomaly_ratio" in fp
        assert "thermal_status" in fp
        assert fp["thermal_status"] in ["NORMAL", "ELEVATED", "ABNORMAL", "CRITICAL"]
