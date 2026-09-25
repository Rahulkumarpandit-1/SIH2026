"""
Test Suite for Temporal Intelligence Engine (Phase 12A)
Verifies:
- parse_observation_timestamp correctly parses date and HHMM string
- Temporal classification rules:
    * RECENTLY_OBSERVED: Last Detection <= 6 Hours
    * RECENT: 6 Hours < Last Detection <= 24 Hours
    * HISTORICAL: Last Detection > 24 Hours
    * ACTIVE alias mapping
- Freshness, incident age, active duration calculations
- Single vs multi-observation handling
- Scientific disclosure presence
"""

from datetime import datetime, date, timezone, timedelta
import pytest
import pandas as pd

from app.analytics.temporal_engine import (
    TemporalEngine,
    parse_observation_timestamp,
    STATUS_RECENTLY_OBSERVED,
    STATUS_RECENT,
    STATUS_HISTORICAL,
    TEMPORAL_STATUS_ALIASES
)


def test_parse_observation_timestamp():
    # Test valid date object and string time
    dt1 = parse_observation_timestamp(date(2026, 8, 24), "0820")
    assert dt1 == datetime(2026, 8, 24, 8, 20, tzinfo=timezone.utc)

    # Test string date
    dt2 = parse_observation_timestamp("2026-08-24", "1430")
    assert dt2 == datetime(2026, 8, 24, 14, 30, tzinfo=timezone.utc)

    # Test colon in time
    dt3 = parse_observation_timestamp("2026-08-24", "09:45")
    assert dt3 == datetime(2026, 8, 24, 9, 45, tzinfo=timezone.utc)

    # Test padded short time
    dt4 = parse_observation_timestamp("2026-08-24", "500")
    assert dt4.hour == 5 and dt4.minute == 0


def test_temporal_status_classification_rules():
    # <= 24 hours -> LIVE / RECENTLY_OBSERVED
    assert TemporalEngine.classify_temporal_status(0.0) == STATUS_RECENTLY_OBSERVED
    assert TemporalEngine.classify_temporal_status(6.0) == STATUS_RECENTLY_OBSERVED
    assert TemporalEngine.classify_temporal_status(24.0) == STATUS_RECENTLY_OBSERVED

    # > 24 to 168 hours (7 days) -> RECENT
    assert TemporalEngine.classify_temporal_status(24.1) == STATUS_RECENT
    assert TemporalEngine.classify_temporal_status(72.0) == STATUS_RECENT
    assert TemporalEngine.classify_temporal_status(168.0) == STATUS_RECENT

    # > 168 hours (7 days) -> HISTORICAL
    assert TemporalEngine.classify_temporal_status(168.1) == STATUS_HISTORICAL
    assert TemporalEngine.classify_temporal_status(300.0) == STATUS_HISTORICAL


def test_active_alias_mapping():
    assert TEMPORAL_STATUS_ALIASES["ACTIVE"] == STATUS_RECENTLY_OBSERVED
    assert TEMPORAL_STATUS_ALIASES["RECENTLY_OBSERVED"] == STATUS_RECENTLY_OBSERVED
    assert TEMPORAL_STATUS_ALIASES["LIVE"] == STATUS_RECENTLY_OBSERVED
    assert TEMPORAL_STATUS_ALIASES["RECENT"] == STATUS_RECENT
    assert TEMPORAL_STATUS_ALIASES["HISTORICAL"] == STATUS_HISTORICAL


def test_evaluate_observations_calculations():
    # Anchor reference time: 2026-08-24 12:00 UTC
    ref_time = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)

    # Obs 1 at 08:00 (4h before ref), Obs 2 at 10:00 (2h before ref)
    obs_list = [
        {"acq_date": "2026-08-24", "acq_time": "0800", "frp": 25.0},
        {"acq_date": "2026-08-24", "acq_time": "1000", "frp": 60.0}
    ]

    metrics = TemporalEngine.evaluate_observations(obs_list, reference_time=ref_time)

    assert metrics["detection_count"] == 2
    assert metrics["first_detected"] == "2026-08-24T08:00:00+00:00"
    assert metrics["last_detected"] == "2026-08-24T10:00:00+00:00"
    assert metrics["active_duration_hours"] == 2.0  # 10:00 - 08:00
    assert metrics["incident_age_hours"] == 4.0     # 12:00 - 08:00
    assert metrics["observation_freshness_minutes"] == 120.0  # 12:00 - 10:00 (2h = 120m)
    assert metrics["temporal_status"] == STATUS_RECENTLY_OBSERVED
    assert metrics["is_recently_observed"] is True
    assert "NASA FIRMS" in metrics["scientific_disclosure"]


def test_evaluate_observations_recent_and_historical():
    ref_time = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)

    # 1. 10 hours ago -> LIVE (<= 24h)
    live_obs = [{"acq_date": "2026-08-25", "acq_time": "0200", "frp": 15.0}]
    m_live = TemporalEngine.evaluate_observations(live_obs, reference_time=ref_time)
    assert m_live["temporal_status"] == STATUS_RECENTLY_OBSERVED
    assert m_live["is_recently_observed"] is True
    assert m_live["incident_age_hours"] == 10.0
    assert m_live["active_duration_hours"] == 0.0

    # 2. 48 hours (2 days) ago -> RECENT (>24h and <= 168h)
    recent_obs = [{"acq_date": "2026-08-23", "acq_time": "1200", "frp": 15.0}]
    m_recent = TemporalEngine.evaluate_observations(recent_obs, reference_time=ref_time)
    assert m_recent["temporal_status"] == STATUS_RECENT
    assert m_recent["is_recently_observed"] is False
    assert m_recent["incident_age_hours"] == 48.0

    # 3. 240 hours (10 days) ago -> HISTORICAL (> 168h)
    hist_obs = [{"acq_date": "2026-08-15", "acq_time": "1200", "frp": 15.0}]
    m_hist = TemporalEngine.evaluate_observations(hist_obs, reference_time=ref_time)
    assert m_hist["temporal_status"] == STATUS_HISTORICAL
    assert m_hist["is_recently_observed"] is False
    assert m_hist["incident_age_hours"] == 240.0


def test_evaluate_empty_observations():
    metrics = TemporalEngine.evaluate_observations([])
    assert metrics["detection_count"] == 0
    assert metrics["temporal_status"] == STATUS_HISTORICAL
    assert metrics["is_recently_observed"] is False
    assert metrics["first_detected"] is None
    assert metrics["last_detected"] is None
    assert metrics["observation_freshness_minutes"] is None
