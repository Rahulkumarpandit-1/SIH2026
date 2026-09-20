"""
Test Suite: Incident Temporal Status Classification & Banner Disclosures
Verifies scientific temporal status classifications (<=6h RECENTLY_OBSERVED, 6-24h RECENT, >24h HISTORICAL)
and disclosure enforcement for non-live historical incidents.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.analytics.temporal_engine import (
    TemporalEngine,
    STATUS_RECENTLY_OBSERVED,
    STATUS_RECENT,
    STATUS_HISTORICAL
)


def test_temporal_status_thresholds():
    """Verify temporal status matches Phase 13.1 guidelines."""
    # Under 6 hours: RECENTLY_OBSERVED / LIVE OBSERVATION
    assert TemporalEngine.classify_temporal_status(0.5) == STATUS_RECENTLY_OBSERVED
    assert TemporalEngine.classify_temporal_status(5.9) == STATUS_RECENTLY_OBSERVED
    assert TemporalEngine.classify_temporal_status(6.0) == STATUS_RECENTLY_OBSERVED

    # Between 6 and 24 hours: RECENT / RECENT OBSERVATION
    assert TemporalEngine.classify_temporal_status(6.1) == STATUS_RECENT
    assert TemporalEngine.classify_temporal_status(12.0) == STATUS_RECENT
    assert TemporalEngine.classify_temporal_status(24.0) == STATUS_RECENT

    # Over 24 hours: HISTORICAL
    assert TemporalEngine.classify_temporal_status(24.1) == STATUS_HISTORICAL
    assert TemporalEngine.classify_temporal_status(72.0) == STATUS_HISTORICAL
    assert TemporalEngine.classify_temporal_status(120.0) == STATUS_HISTORICAL


def test_temporal_engine_historical_incident_disclosure():
    """Verify that evaluating historical observations includes scientific non-live disclosures."""
    now_utc = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    
    # Observation from 3 days ago (historical event)
    historical_obs = [
        {"acq_date": "2026-09-17", "acq_time": "0830", "frp": 35.0},
        {"acq_date": "2026-09-17", "acq_time": "1415", "frp": 42.0}
    ]

    metrics = TemporalEngine.evaluate_observations(historical_obs, reference_time=now_utc)

    assert metrics["temporal_status"] == STATUS_HISTORICAL
    assert metrics["is_recently_observed"] is False
    assert metrics["incident_age_hours"] > 24.0
    assert "scientific_disclosure" in metrics
    # Must emphasize satellite observation limitation
    assert "satellite" in metrics["scientific_disclosure"].lower()
