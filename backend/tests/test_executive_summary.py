"""
Unit Tests for Phase 13E — Executive Summary Engine
"""

import pytest
from app.intelligence.executive_summary import ExecutiveSummaryEngine


def test_executive_summary_generation():
    """Verify deterministic executive summary generation from incident detail dictionary."""
    incident_detail = {
        "incident_uuid": "INC-20260824-WGUJ-RELIANCE-A1B2",
        "facility_name": "Reliance Jamnagar Refinery",
        "risk_score": 82.5,
        "risk_level": "HIGH",
        "action_code": "PRIORITY_INSPECTION",
        "peak_frp": 51.6,
        "detection_count": 7,
        "telemetry": {
            "distance_to_industry_meters": 0.0,
            "max_frp": 51.6,
            "total_detections": 7
        },
        "temporal_intelligence": {
            "active_duration_hours": 14.2,
            "observation_freshness_minutes": 45.0,
            "first_detected": "2026-08-24T02:30:00Z"
        },
        "weather_context": {
            "wind_speed_kmh": 18.5,
            "wind_cardinal": "SW",
            "plume_dispersion_heading": "NE",
            "spread_concern": "ELEVATED_SPREAD_POTENTIAL"
        },
        "facility_fingerprint": {
            "baseline_frp": 12.0
        },
        "abnormality_detection": {
            "abnormality_score": 78.0,
            "abnormality_status": "ABNORMAL"
        },
        "exposure_context": {
            "downwind_exposure": "MEDIUM",
            "population_exposure": "LOW"
        }
    }

    result = ExecutiveSummaryEngine.generate_summary(incident_detail)

    assert result["incident_uuid"] == "INC-20260824-WGUJ-RELIANCE-A1B2"
    assert result["facility_name"] == "Reliance Jamnagar Refinery"
    assert result["risk_level"] == "HIGH"
    assert result["risk_score"] == 82.5

    summary_text = result["executive_summary"]
    # Check key required groundings:
    assert "Reliance Jamnagar Refinery" in summary_text
    assert "14.2 hours" in summary_text
    assert "7 satellite detections" in summary_text
    assert "HIGH" in summary_text
    assert "4.3x" in summary_text or "exceeds the facility baseline" in summary_text
    assert "wind-assisted propagation" in summary_text

    # Check key bullet points
    bullets = result["key_bullet_points"]
    assert len(bullets) == 4
    assert any("51.6 MW" in b for b in bullets)
    assert any("14.2 hours" in b for b in bullets)
    assert any("PRIORITY_INSPECTION" in b for b in bullets)

    # Check evidence telemetry dictionary
    telem = result["evidence_telemetry"]
    assert telem["peak_frp"] == 51.6
    assert telem["active_duration_hours"] == 14.2
