"""
Unit Tests for Phase 13D — Facility Risk Profile Engine
"""

import pytest
from app.db.session import SessionLocal
from app.intelligence.facility_risk_profile import FacilityRiskProfileEngine


def test_generate_facility_risk_profile():
    """Verify facility risk profile generation, trend, and tier classification."""
    db = SessionLocal()
    try:
        facility_name = "Reliance Jamnagar Refinery"
        profile = FacilityRiskProfileEngine.generate_facility_risk_profile(db, facility_name)

        assert profile["facility_name"] == facility_name
        assert profile["facility_type"] is not None
        assert "historical_trend" in profile
        assert profile["historical_trend"] in ["INCREASING", "STABLE", "DECREASING", "LOW_BASELINE", "ELEVATED_BASELINE"]
        assert "risk_tier" in profile
        assert profile["risk_tier"] in ["CRITICAL_RISK", "ELEVATED_RISK", "NOMINAL_MONITORING", "NOMINAL_BASELINE"]
        assert "total_incidents" in profile
        assert "average_risk_score" in profile
        assert "trend_description" in profile
    finally:
        db.close()
