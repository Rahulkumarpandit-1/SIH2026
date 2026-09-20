"""
Test Suite for Incident Timeline Engine (Phase 12C)
Verifies:
- Chronological ordering of investigation events
- Presence of detection, peak FRP, risk analysis, weather, exposure, and abnormality events
- Ground-truth review incorporation into timeline
- Event payload structure and scientific disclosure
"""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import IncidentRecordModel, RawObservationModel, GroundTruthLabelModel
from app.services.incident_timeline import IncidentTimelineService


@pytest.fixture
def timeline_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


def test_timeline_generation_chronological_order(timeline_db):
    base_t = datetime(2026, 8, 24, 8, 15, tzinfo=timezone.utc)
    inc = IncidentRecordModel(
        incident_uuid="INC-TIMELINE-001",
        cluster_id="CLUSTER_TEST",
        facility_name="Reliance Jamnagar Refinery",
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=base_t,
        last_detected=base_t + timedelta(hours=2, minutes=30),
        risk_score=85.0,
        risk_level="CRITICAL",
        action_code="EMERGENCY_INSPECTION",
        abnormality_score=80.0,
        temporal_status="RECENTLY_OBSERVED",
        detection_count=3,
        status="NEW",
        peak_frp=140.0,
        centroid_lat=22.35,
        centroid_lon=69.85
    )
    timeline_db.add(inc)

    # Add constituent observations
    obs1 = RawObservationModel(
        latitude=22.35, longitude=69.85, brightness=330.0,
        acq_date=base_t.date(), acq_time="0815",
        satellite="VIIRS_SNPP", instrument="VIIRS", confidence="high",
        confidence_normalized=0.9, frp=45.0, daynight="N"
    )
    obs2 = RawObservationModel(
        latitude=22.36, longitude=69.86, brightness=370.0,
        acq_date=base_t.date(), acq_time="0930",
        satellite="VIIRS_SNPP", instrument="VIIRS", confidence="high",
        confidence_normalized=0.95, frp=140.0, daynight="N"
    )
    obs3 = RawObservationModel(
        latitude=22.35, longitude=69.84, brightness=325.0,
        acq_date=base_t.date(), acq_time="1045",
        satellite="VIIRS_NOAA20", instrument="VIIRS", confidence="nominal",
        confidence_normalized=0.7, frp=35.0, daynight="N"
    )
    timeline_db.add_all([obs1, obs2, obs3])
    timeline_db.commit()

    timeline = IncidentTimelineService.generate_timeline(timeline_db, "INC-TIMELINE-001")

    assert timeline["incident_uuid"] == "INC-TIMELINE-001"
    assert timeline["total_events"] >= 5
    events = timeline["events"]

    # Verify chronological ascending order
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)

    # Verify key events exist
    event_types = [e["event_type"] for e in events]
    assert "FIRST_DETECTION" in event_types
    assert "PEAK_FRP" in event_types
    assert "RISK_ANALYSIS" in event_types
    assert "WEATHER_ANALYSIS" in event_types
    assert "EXPOSURE_ANALYSIS" in event_types
    assert "ABNORMALITY_ANALYSIS" in event_types

    # Verify scientific disclosure
    assert "overpasses" in timeline["scientific_disclosure"]


def test_timeline_with_ground_truth_review(timeline_db):
    t0 = datetime(2026, 8, 24, 6, 0, tzinfo=timezone.utc)
    inc = IncidentRecordModel(
        incident_uuid="INC-GT-TIMELINE-002",
        facility_name="ONGC Hazira",
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=t0,
        last_detected=t0 + timedelta(hours=1),
        risk_score=45.0,
        status="VERIFIED_FIRE"
    )
    timeline_db.add(inc)

    # Add ground truth label committed later
    gt = GroundTruthLabelModel(
        incident_uuid="INC-GT-TIMELINE-002",
        facility_name="ONGC Hazira",
        assigned_label="TRUE_FIRE",
        reviewer_name="Dr. K. Sharma",
        review_notes="Verified against ground CCTV footage.",
        created_at=t0 + timedelta(hours=2),
        updated_at=t0 + timedelta(hours=2)
    )
    timeline_db.add(gt)
    timeline_db.commit()

    timeline = IncidentTimelineService.generate_timeline(timeline_db, "INC-GT-TIMELINE-002")
    events = timeline["events"]

    # Find review event
    review_events = [e for e in events if e["event_type"] == "ANALYST_REVIEW"]
    assert len(review_events) == 1
    assert "TRUE_FIRE" in review_events[0]["title"]
    assert "Dr. K. Sharma" in review_events[0]["description"]
