"""
Unit Tests for Phase 13A — Risk Attribution Engine
"""

import pytest
from app.intelligence.risk_attribution import RiskAttributionEngine


def test_risk_attribution_decomposition():
    """Verify that composite risk score is decomposed into ranked factors with percentages."""
    subscores = {
        "thermal_subscore": 80.0,    # 0.35 * 80 = 28.0
        "proximity_subscore": 73.33, # 0.30 * 73.33 = 22.0
        "persistence_subscore": 48.0,# 0.25 * 48 = 12.0
        "confidence_subscore": 80.0, # 0.10 * 80 = 8.0
        "exposure_subscore": 12.0    # +12.0
    }
    # Sum = 28 + 22 + 12 + 8 + 12 = 82
    result = RiskAttributionEngine.compute_attribution(
        risk_score=82.0,
        subscores=subscores,
        risk_level="CRITICAL"
    )

    assert result["risk_score"] == 82.0
    assert result["risk_level"] == "CRITICAL"
    contributors = result["contributors"]
    assert len(contributors) == 5

    # Check top contributor
    top = contributors[0]
    assert top["factor"] == "Thermal Intensity"
    assert round(top["value"]) == 28
    assert round(top["percent"], 1) == 34.1  # 28/82 * 100 = 34.1%

    # Check that percentages sum close to 100%
    pct_sum = sum(c["percent"] for c in contributors)
    assert 99.0 <= pct_sum <= 101.0

    # Check explanation is populated and mentions dominant factor
    assert "Thermal Intensity" in result["explanation"]
    assert "82" in result["explanation"]


def test_risk_attribution_fallback_from_telemetry():
    """Verify attribution works when only raw telemetry is provided."""
    telemetry = {
        "max_frp": 60.0,
        "max_brightness": 350.0,
        "distance_to_industry_meters": 0.0,
        "persistence_ratio": 0.3,
        "is_anomaly_spike": True
    }
    result = RiskAttributionEngine.compute_attribution(
        risk_score=75.0,
        telemetry=telemetry
    )

    assert result["risk_score"] == 75.0
    assert len(result["contributors"]) >= 4
    assert result["primary_factor"] in [
        "Thermal Intensity", "Facility Proximity", "Persistence & Anomaly", "Sensor Confidence"
    ]
    assert len(result["explanation"]) > 20
