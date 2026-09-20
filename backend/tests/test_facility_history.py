"""
Test Suite for Facility Historical Intelligence (Phase 12D)
Verifies:
- Accurate aggregation of total incidents, verified fires, false alarms, flaring
- Average risk score and abnormality score calculation
- Highest recorded FRP computation
- Last incident date extraction
- Historical incident list presentation
"""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import IncidentRecordModel, FacilityThermalProfileModel
from app.services.facility_history import FacilityHistoryService


@pytest.fixture
def facility_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


def test_facility_history_aggregation(facility_db):
    fac_name = "Reliance Jamnagar Refinery"
    t1 = datetime(2026, 8, 20, 8, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 8, 22, 10, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 8, 24, 14, 0, tzinfo=timezone.utc)

    # 1. Add baseline profile
    prof = FacilityThermalProfileModel(
        facility_name=fac_name,
        facility_type="refinery",
        avg_frp=15.0,
        max_frp=50.0,
        region_code="WEST_GUJARAT",
        state="Gujarat"
    )
    facility_db.add(prof)

    # 2. Add 3 incidents with different statuses and FRPs
    inc1 = IncidentRecordModel(
        incident_uuid="INC-FAC-001",
        facility_name=fac_name,
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=t1,
        last_detected=t1,
        risk_score=90.0,
        abnormality_score=85.0,
        temporal_status="HISTORICAL",
        detection_count=3,
        status="VERIFIED_FIRE",
        peak_frp=182.0
    )
    inc2 = IncidentRecordModel(
        incident_uuid="INC-FAC-002",
        facility_name=fac_name,
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=t2,
        last_detected=t2,
        risk_score=30.0,
        abnormality_score=20.0,
        temporal_status="HISTORICAL",
        detection_count=1,
        status="FALSE_ALARM",
        peak_frp=22.0
    )
    inc3 = IncidentRecordModel(
        incident_uuid="INC-FAC-003",
        facility_name=fac_name,
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=t3,
        last_detected=t3,
        risk_score=45.0,
        abnormality_score=35.0,
        temporal_status="RECENTLY_OBSERVED",
        detection_count=2,
        status="CONTROLLED_FLARING",
        peak_frp=38.0
    )
    facility_db.add_all([inc1, inc2, inc3])
    facility_db.commit()

    history = FacilityHistoryService.get_facility_history(facility_db, fac_name)

    assert history["facility_name"] == fac_name
    assert history["total_incidents"] == 3
    assert history["verified_fires"] == 1
    assert history["false_alarms"] == 1
    assert history["controlled_flaring"] == 1
    assert history["highest_recorded_frp"] == 182.0
    assert history["average_risk_score"] == round((90.0 + 30.0 + 45.0) / 3, 2)
    assert history["average_abnormality_score"] == round((85.0 + 20.0 + 35.0) / 3, 2)
    assert history["last_incident_date"] == "2026-08-24"
    assert len(history["historical_incidents"]) == 3


def test_facility_history_empty_fallback(facility_db):
    # Query non-existent facility
    history = FacilityHistoryService.get_facility_history(facility_db, "Nonexistent Plant")
    assert history["total_incidents"] == 0
    assert history["verified_fires"] == 0
    assert history["highest_recorded_frp"] == 25.0 or history["highest_recorded_frp"] == 0.0
    assert history["last_incident_date"] is None
    assert history["historical_incidents"] == []
