"""
Test Suite: Operational Directives, Scientific Safety & Ground Verification Requirements
Verifies that all risk levels generate scientifically defensible investigation recommendations,
prohibited emergency response language is excluded, and mandatory recommendation disclaimers are present.
"""

import pytest
from app.scoring.risk_engine import RiskScoringEngine
from app.intelligence.executive_summary import ExecutiveSummaryEngine
from app.services.incident_registry import sanitize_action_code_for_temporal_status
from app.analytics.temporal_engine import STATUS_HISTORICAL, STATUS_RECENTLY_OBSERVED


PROHIBITED_STRINGS = [
    "DISPATCH FIRE BRIGADE",
    "EMERGENCY DISPATCH",
    "IMMEDIATE RESPONSE REQUIRED"
]


def test_risk_level_to_operational_directives():
    """Verify each risk score range yields the correct scientific directive."""
    # Critical (>= 80)
    res_crit = RiskScoringEngine.calculate_composite_risk(
        frp=65.0, brightness=375.0, distance_to_industry_meters=0.0,
        persistence_ratio=0.1, is_anomaly_spike=True, confidence_normalized=0.95
    )
    assert res_crit["action_code"] == "HIGH_PRIORITY_INVESTIGATION_REQUIRED"
    assert "High Priority Investigation Required" in res_crit["action_directive"]

    # High (60 to 79)
    res_high = RiskScoringEngine.calculate_composite_risk(
        frp=35.0, brightness=350.0, distance_to_industry_meters=200.0,
        persistence_ratio=0.3, is_anomaly_spike=True, confidence_normalized=0.85
    )
    assert res_high["action_code"] == "ESCALATED_INVESTIGATION_RECOMMENDED"
    assert "Escalated Investigation Recommended" in res_high["action_directive"]

    # Moderate (30 to 59)
    res_mod = RiskScoringEngine.calculate_composite_risk(
        frp=29.1, brightness=368.7, distance_to_industry_meters=0.0,
        persistence_ratio=1.00, is_anomaly_spike=False, confidence_normalized=0.85
    )
    assert res_mod["action_code"] == "ANALYST_REVIEW_RECOMMENDED"
    assert "Analyst Review Recommended" in res_mod["action_directive"]

    # Low (< 30)
    res_low = RiskScoringEngine.calculate_composite_risk(
        frp=4.0, brightness=320.0, distance_to_industry_meters=25000.0,
        persistence_ratio=0.1, is_anomaly_spike=False, confidence_normalized=0.50
    )
    assert res_low["action_code"] == "ROUTINE_MONITORING_RECOMMENDED"
    assert "Routine Monitoring Recommended" in res_low["action_directive"]


def test_mandatory_recommendation_disclaimer_present():
    """Verify recommendation disclaimer is present and explicit about ground verification."""
    res = RiskScoringEngine.calculate_composite_risk(
        frp=50.0, brightness=360.0, distance_to_industry_meters=0.0,
        persistence_ratio=0.2, is_anomaly_spike=True, confidence_normalized=0.9
    )
    
    assert "recommendation_statement" in res
    rec = res["recommendation_statement"]
    assert "satellite-observed thermal anomalies" in rec
    assert "Ground verification is required" in rec


def test_historical_incident_directive_sanitization():
    """Verify historical incidents cannot issue high priority or emergency action directives."""
    # If an incident is historical (>24h old), directive must be downgraded to routine monitoring
    sanitized = sanitize_action_code_for_temporal_status(
        "HIGH_PRIORITY_INVESTIGATION_REQUIRED",
        STATUS_HISTORICAL
    )
    assert sanitized == "ROUTINE_MONITORING_RECOMMENDED"

    # Active/recently observed incident maintains high priority directive
    active_directive = sanitize_action_code_for_temporal_status(
        "HIGH_PRIORITY_INVESTIGATION_REQUIRED",
        STATUS_RECENTLY_OBSERVED
    )
    assert active_directive == "HIGH_PRIORITY_INVESTIGATION_REQUIRED"


def test_prohibited_emergency_dispatch_strings_absent():
    """Verify prohibited emergency dispatch language is completely absent from directives."""
    # Test scoring engine directives
    for frp, dist in [(100.0, 0.0), (45.0, 500.0), (15.0, 5000.0), (3.0, 30000.0)]:
        res = RiskScoringEngine.calculate_composite_risk(
            frp=frp, brightness=360.0, distance_to_industry_meters=dist,
            persistence_ratio=0.2, is_anomaly_spike=True, confidence_normalized=0.9
        )
        for prohibited in PROHIBITED_STRINGS:
            assert prohibited != res["action_code"]

    # Test executive summary narrative
    mock_incident = {
        "incident_uuid": "INC-TEST-001",
        "facility_name": "Test Chemical Complex",
        "risk_score": 95.0,
        "risk_level": "CRITICAL",
        "action_code": "HIGH_PRIORITY_INVESTIGATION_REQUIRED",
        "peak_frp": 85.0,
        "detection_count": 8,
        "temporal_intelligence": {"active_duration_hours": 3.5, "first_detected": "2026-09-20T00:00:00Z"},
        "weather_context": {"wind_speed_kmh": 22.0, "wind_cardinal": "W", "plume_dispersion_heading": "E"},
        "exposure_context": {"downwind_exposure": "HIGH", "population_exposure": "HIGH"},
        "abnormality_detection": {"abnormality_score": 90.0, "abnormality_status": "HIGHLY_ABNORMAL"}
    }
    summary = ExecutiveSummaryEngine.generate_summary(mock_incident)
    narrative = summary["executive_summary"].upper()

    for prohibited in PROHIBITED_STRINGS:
        assert prohibited not in narrative
