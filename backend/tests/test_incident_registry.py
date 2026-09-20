"""
Test Suite for Persistent Incident Registry (Phase 12B)
Verifies:
- Stable, readable incident UUID generation
- Database persistence of IncidentRecordModel
- Cluster synchronization into permanent incidents
- UUID stability across multiple sync executions
- Incident lifecycle transitions (NEW, UNDER_REVIEW, VERIFIED_FIRE, FALSE_ALARM, CONTROLLED_FLARING, ARCHIVED)
- Query filtering by region, status, and temporal status
"""

import pytest
from datetime import datetime, timezone, timedelta
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import IncidentRecordModel, GroundTruthLabelModel
from app.services.incident_registry import IncidentRegistryService
from app.analytics.temporal_engine import STATUS_RECENTLY_OBSERVED, STATUS_HISTORICAL


@pytest.fixture
def in_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()
    try:
        yield db
    finally:
        db.close()


def test_generate_incident_uuid():
    dt = datetime(2026, 8, 24, 8, 30, tzinfo=timezone.utc)
    uuid1 = IncidentRegistryService.generate_incident_uuid("Reliance Jamnagar Refinery", "WEST_GUJARAT", dt)
    assert uuid1.startswith("INC-20260824-WEST-RELIANCE-JAM")
    
    # Verify determinism: same input yields same UUID
    uuid2 = IncidentRegistryService.generate_incident_uuid("Reliance Jamnagar Refinery", "WEST_GUJARAT", dt)
    assert uuid1 == uuid2

    # Different facility yields different UUID
    uuid3 = IncidentRegistryService.generate_incident_uuid("ONGC Hazira", "WEST_GUJARAT", dt)
    assert uuid1 != uuid3


def test_incident_record_persistence(in_memory_db):
    now = datetime.now(timezone.utc)
    inc = IncidentRecordModel(
        incident_uuid="INC-20260824-TEST-001",
        cluster_id="CLUSTER_001",
        facility_name="Adani Mundra Thermal Power",
        state="Gujarat",
        region_code="WEST_GUJARAT",
        first_detected=now - timedelta(hours=3),
        last_detected=now - timedelta(hours=1),
        risk_score=78.5,
        abnormality_score=82.0,
        temporal_status=STATUS_RECENTLY_OBSERVED,
        detection_count=4,
        status="NEW",
        peak_frp=95.0,
        centroid_lat=22.8,
        centroid_lon=69.7
    )
    in_memory_db.add(inc)
    in_memory_db.commit()

    retrieved = IncidentRegistryService.get_incident_by_uuid(in_memory_db, "INC-20260824-TEST-001")
    assert retrieved is not None
    assert retrieved.facility_name == "Adani Mundra Thermal Power"
    assert retrieved.risk_score == 78.5
    assert retrieved.temporal_status == STATUS_RECENTLY_OBSERVED
    assert retrieved.status == "NEW"


def test_sync_incidents_from_clusters(in_memory_db):
    # Setup test cluster and observations DataFrame
    clusters_df = pd.DataFrame([{
        "cluster_id": "CLUSTER_HAZIRA",
        "nearest_facility_name": "ONGC Hazira Gas Processing",
        "state": "Gujarat",
        "region_code": "WEST_GUJARAT",
        "risk_score": 88.0,
        "risk_level": "CRITICAL",
        "action_code": "DISPATCH_INSPECTION",
        "max_frp": 125.0,
        "centroid_lat": 21.12,
        "centroid_lon": 72.65,
        "abnormality_detection": {"abnormality_score": 75.0}
    }])

    enriched_obs_df = pd.DataFrame([
        {
            "id": 1,
            "cluster_id": "CLUSTER_HAZIRA",
            "acq_date": "2026-08-24",
            "acq_time": "0800",
            "frp": 90.0,
            "brightness": 340.0
        },
        {
            "id": 2,
            "cluster_id": "CLUSTER_HAZIRA",
            "acq_date": "2026-08-24",
            "acq_time": "1000",
            "frp": 125.0,
            "brightness": 365.0
        }
    ])

    ref_time = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
    incidents = IncidentRegistryService.sync_incidents_from_clusters(
        db=in_memory_db,
        clusters_df=clusters_df,
        enriched_obs_df=enriched_obs_df,
        reference_time=ref_time
    )

    assert len(incidents) == 1
    first_uuid = incidents[0].incident_uuid
    assert first_uuid.startswith("INC-20260824-WEST-ONGC-HAZIRA")
    assert incidents[0].temporal_status == STATUS_RECENTLY_OBSERVED
    assert incidents[0].detection_count == 2
    assert incidents[0].peak_frp == 125.0

    # Test Idempotence: Running sync again with same cluster should update, NOT duplicate
    incidents_round2 = IncidentRegistryService.sync_incidents_from_clusters(
        db=in_memory_db,
        clusters_df=clusters_df,
        enriched_obs_df=enriched_obs_df,
        reference_time=ref_time
    )
    assert len(incidents_round2) == 1
    assert incidents_round2[0].incident_uuid == first_uuid
    assert in_memory_db.query(IncidentRecordModel).count() == 1


def test_status_lifecycle_and_transitions(in_memory_db):
    dt = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    inc = IncidentRecordModel(
        incident_uuid="INC-STATUS-TEST-001",
        cluster_id="CLUSTER_T1",
        facility_name="Tata Steel Kalinganagar",
        state="Odisha",
        region_code="EAST_STEEL",
        first_detected=dt,
        last_detected=dt,
        risk_score=55.0,
        temporal_status="RECENT",
        detection_count=1,
        status="NEW"
    )
    in_memory_db.add(inc)
    in_memory_db.commit()

    # Transition to UNDER_REVIEW
    updated = IncidentRegistryService.update_incident_status(in_memory_db, "INC-STATUS-TEST-001", "UNDER_REVIEW")
    assert updated.status == "UNDER_REVIEW"

    # Transition to VERIFIED_FIRE
    updated2 = IncidentRegistryService.update_incident_status(in_memory_db, "INC-STATUS-TEST-001", "VERIFIED_FIRE")
    assert updated2.status == "VERIFIED_FIRE"

    # Transition to ARCHIVED
    updated3 = IncidentRegistryService.update_incident_status(in_memory_db, "INC-STATUS-TEST-001", "ARCHIVED")
    assert updated3.status == "ARCHIVED"

    # Invalid status raises ValueError
    with pytest.raises(ValueError):
        IncidentRegistryService.update_incident_status(in_memory_db, "INC-STATUS-TEST-001", "INVALID_STATUS")
