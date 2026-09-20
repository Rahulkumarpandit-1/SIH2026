"""
Test Suite: Timezone Consistency & IST Temporal Localization
Verifies backend timestamps are UTC compliant and IST conversion logic produces accurate local representations.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.incident_registry import IncidentRegistryService, _to_utc
from app.analytics.temporal_engine import parse_observation_timestamp
from app.api.service import PipelineService


def test_incident_timestamps_are_utc_formatted():
    """Verify observation timestamp parsing and helper functions produce timezone-aware UTC datetimes."""
    # Test parse_observation_timestamp producing UTC
    dt = parse_observation_timestamp("2026-08-24", "0820")
    assert dt.tzinfo == timezone.utc
    assert dt.year == 2026
    assert dt.month == 8
    assert dt.day == 24
    assert dt.hour == 8
    assert dt.minute == 20

    # Test _to_utc helper
    naive_dt = datetime(2026, 9, 20, 10, 30, 0)
    utc_dt = _to_utc(naive_dt)
    assert utc_dt.tzinfo == timezone.utc
    assert utc_dt.hour == 10

    # Ensure ISO string ends with Z or offset
    iso_str = utc_dt.isoformat()
    assert "+00:00" in iso_str or iso_str.endswith("Z")


def test_ist_conversion_offset_mathematics():
    """Verify that a UTC timestamp converts to IST with exactly +5:30 offset."""
    # Example: 2026-09-20 00:00:00 UTC -> 2026-09-20 05:30:00 IST
    utc_dt = datetime(2026, 9, 20, 0, 0, 0, tzinfo=timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_dt = utc_dt.astimezone(ist_tz)

    assert ist_dt.hour == 5
    assert ist_dt.minute == 30
    assert ist_dt.day == 20

    # Cross-midnight test: 2026-09-19 20:00:00 UTC -> 2026-09-20 01:30:00 IST
    utc_late = datetime(2026, 9, 19, 20, 0, 0, tzinfo=timezone.utc)
    ist_late = utc_late.astimezone(ist_tz)

    assert ist_late.day == 20
    assert ist_late.hour == 1
    assert ist_late.minute == 30


def test_refresh_status_returns_valid_utc():
    """Verify /api/refresh-status timestamps are valid UTC ISO8601 strings."""
    service = PipelineService()
    status = service.get_refresh_status()
    
    next_refresh = status["next_scheduled_refresh"]
    assert next_refresh is not None
    
    dt_next = datetime.fromisoformat(next_refresh.replace("Z", "+00:00"))
    assert dt_next.tzinfo is not None
    assert status["next_satellite_check_seconds"] >= 0
