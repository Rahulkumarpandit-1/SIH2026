import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.scoring.abnormality_engine import AbnormalityEngine


client = TestClient(app)


def test_normal_abnormality_behavior():
    """Verifies that routine operational flaring within baseline is classified as NORMAL (< 35)."""
    result = AbnormalityEngine.evaluate_abnormality(
        facility_name="Hazira Heavy Industrial & Steel Complex",
        current_frp=16.0,  # Below baseline (18.0 MW)
        avg_frp=15.5,
        active_days=1,
        total_detections=2,
        is_anomaly_spike=False
    )
    assert result["abnormality_status"] == "NORMAL"
    assert result["abnormality_score"] < 35.0
    assert result["intensity_anomaly"]["status"] == "NORMAL"
    assert result["persistence_anomaly"]["status"] == "NORMAL"
    assert result["growth_anomaly"]["trend"] == "STABLE"
    assert len(result["explanation"]) == 4


def test_elevated_abnormality():
    """Verifies moderate operational flux is classified as ELEVATED (35 - 60)."""
    result = AbnormalityEngine.evaluate_abnormality(
        facility_name="Hazira Heavy Industrial & Steel Complex",
        current_frp=28.0,  # ~1.55x baseline
        avg_frp=20.0,
        active_days=2,
        total_detections=3,
        is_anomaly_spike=False
    )
    assert result["abnormality_status"] in ["ELEVATED", "ABNORMAL"]
    assert 30.0 <= result["abnormality_score"] <= 65.0
    assert result["intensity_anomaly"]["ratio"] > 1.25


def test_abnormal_abnormality():
    """Verifies significant process upset or uncontained flare is classified as ABNORMAL (60 - 80)."""
    result = AbnormalityEngine.evaluate_abnormality(
        facility_name="Jamnagar Petroleum Refining Complex",
        current_frp=65.0,  # ~2.88x baseline (22.5 MW)
        avg_frp=35.0,
        active_days=3,
        total_detections=5,
        is_anomaly_spike=True
    )
    assert result["abnormality_status"] in ["ABNORMAL", "SEVERELY_ABNORMAL"]
    assert result["abnormality_score"] >= 60.0
    assert result["intensity_anomaly"]["ratio"] > 2.0


def test_severely_abnormal_emergency():
    """Verifies extreme runaway fire outbreak is classified as SEVERELY_ABNORMAL (>= 80)."""
    result = AbnormalityEngine.evaluate_abnormality(
        facility_name="Hazira Heavy Industrial & Steel Complex",
        current_frp=93.6,  # 5.2x baseline (18.0 MW)
        avg_frp=38.5,
        active_days=4,  # exceeds normal by 300%
        total_detections=8,  # recurrence exceeds monthly
        is_anomaly_spike=True
    )
    assert result["abnormality_status"] == "SEVERELY_ABNORMAL"
    assert result["abnormality_score"] >= 80.0
    assert result["intensity_anomaly"]["ratio"] >= 5.0
    assert result["persistence_anomaly"]["excess_percentage"] == 300.0
    assert result["growth_anomaly"]["trend"] in ["ACCELERATING", "EXPLOSIVE"]

    # Check that itemized bullets contain exact diagnostic reasons
    explanation_text = " ".join(result["explanation"])
    assert "above baseline" in explanation_text
    assert "300%" in explanation_text
    assert "accelerating" in explanation_text.lower()
    assert "monthly" in explanation_text.lower()


def test_abnormality_api_endpoint():
    """Verifies GET /api/abnormality endpoint returns 200 OK and conforms to schema."""
    resp = client.get(
        "/api/abnormality",
        params={
            "facility_name": "Hazira Heavy Industrial & Steel Complex",
            "current_frp": 93.6,
            "avg_frp": 38.5,
            "active_days": 4,
            "total_detections": 8,
            "is_anomaly_spike": True
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "abnormality_score" in data
    assert data["abnormality_score"] >= 80.0
    assert data["abnormality_status"] == "SEVERELY_ABNORMAL"
    assert "intensity_anomaly" in data
    assert "persistence_anomaly" in data
    assert "growth_anomaly" in data
    assert "recurrence_anomaly" in data
    assert isinstance(data["explanation"], list)
    assert len(data["explanation"]) == 4
    assert "narrative" in data
