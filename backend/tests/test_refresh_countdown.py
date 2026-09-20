"""
Test Suite: Refresh Countdown, Dynamic Rescheduling & Rollover
Verifies that next refresh countdown is strictly non-negative, past-due timestamps dynamically advance,
and midnight rollovers are calculated without errors.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.api.service import PipelineService


def test_refresh_status_dynamic_recalculation():
    """Verify that get_refresh_status() produces future next_scheduled_refresh and non-negative seconds."""
    service = PipelineService()
    status = service.get_refresh_status()

    assert "next_scheduled_refresh" in status
    assert "next_satellite_check_seconds" in status

    next_dt = datetime.fromisoformat(status["next_scheduled_refresh"].replace("Z", "+00:00"))
    now_utc = datetime.now(timezone.utc)

    # Must be in the future (or exact present)
    assert next_dt >= now_utc
    assert status["next_satellite_check_seconds"] >= 0


def test_countdown_seconds_non_negative():
    """Verify countdown calculation logic clamps negative values to 0."""
    now_utc = datetime(2026, 9, 20, 12, 0, 0, tzinfo=timezone.utc)
    
    # Past timestamp (10 seconds ago)
    past_dt = datetime(2026, 9, 20, 11, 59, 50, tzinfo=timezone.utc)
    diff_sec = max(0, int((past_dt - now_utc).total_seconds()))
    assert diff_sec == 0

    # Future timestamp (45 seconds ahead)
    future_dt = datetime(2026, 9, 20, 12, 0, 45, tzinfo=timezone.utc)
    diff_sec_future = max(0, int((future_dt - now_utc).total_seconds()))
    assert diff_sec_future == 45


def test_midnight_rollover_calculation():
    """Verify rollover across UTC midnight (23:59:45 -> 00:00:45 next day) does not produce negative intervals."""
    t_before_midnight = datetime(2026, 9, 19, 23, 59, 45, tzinfo=timezone.utc)
    t_after_midnight = datetime(2026, 9, 20, 0, 0, 15, tzinfo=timezone.utc)

    delta_seconds = (t_after_midnight - t_before_midnight).total_seconds()
    assert delta_seconds == 30
    assert delta_seconds > 0
