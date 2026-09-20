import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import GroundTruthLabelModel
from app.models.schemas import GroundTruthLabelCreate, GroundTruthLabelUpdate
from app.ml.ground_truth_service import GroundTruthService


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_create_and_get_ground_truth_label(test_db):
    label_in = GroundTruthLabelCreate(
        incident_uuid="CLUSTER_003",
        facility_name="Hazira Heavy Industrial & Steel Complex",
        assigned_label="TRUE_FIRE",
        reviewer_name="Senior Disaster Analyst",
        review_notes="Confirmed uncontained industrial fire outbreak at Unit 4 tank storage."
    )
    created = GroundTruthService.create_label(test_db, label_in)
    assert created.id is not None
    assert created.incident_uuid == "CLUSTER_003"
    assert created.assigned_label == "TRUE_FIRE"
    assert created.reviewer_name == "Senior Disaster Analyst"

    # Get by ID
    retrieved = GroundTruthService.get_label(test_db, created.id)
    assert retrieved is not None
    assert retrieved.facility_name == "Hazira Heavy Industrial & Steel Complex"

    # Get by Incident
    by_inc = GroundTruthService.get_label_by_incident(test_db, "CLUSTER_003")
    assert by_inc is not None
    assert by_inc.id == created.id


def test_upsert_existing_label(test_db):
    label1 = GroundTruthLabelCreate(
        incident_uuid="CLUSTER_001",
        facility_name="Jamnagar Petroleum Refining Complex",
        assigned_label="CONTROLLED_FLARING",
        reviewer_name="Analyst A",
        review_notes="Permitted baseline flaring."
    )
    first = GroundTruthService.create_label(test_db, label1)
    first_id = first.id

    # Update via create_label with same incident_uuid
    label2 = GroundTruthLabelCreate(
        incident_uuid="CLUSTER_001",
        facility_name="Jamnagar Petroleum Refining Complex",
        assigned_label="MAINTENANCE_ACTIVITY",
        reviewer_name="Analyst B",
        review_notes="Corrected to scheduled turnaround flaring."
    )
    second = GroundTruthService.create_label(test_db, label2)
    assert second.id == first_id
    assert second.assigned_label == "MAINTENANCE_ACTIVITY"
    assert second.reviewer_name == "Analyst B"


def test_update_ground_truth_label(test_db):
    label_in = GroundTruthLabelCreate(
        incident_uuid="CLUSTER_002",
        facility_name="Dahej PCPIR Petrochemical Complex",
        assigned_label="FALSE_ALARM",
        reviewer_name="Analyst C",
        review_notes="Solar glint reflection off warehouse roof."
    )
    created = GroundTruthService.create_label(test_db, label_in)

    update_in = GroundTruthLabelUpdate(
        assigned_label="CONTROLLED_FLARING",
        review_notes="Re-evaluated as ground flare operation."
    )
    updated = GroundTruthService.update_label(test_db, created.id, update_in)
    assert updated.assigned_label == "CONTROLLED_FLARING"
    assert updated.review_notes == "Re-evaluated as ground flare operation."
    assert updated.reviewer_name == "Analyst C"  # Unchanged


def test_invalid_label_rejection(test_db):
    with pytest.raises((ValueError, Exception)):
        GroundTruthLabelCreate(
            incident_uuid="CLUSTER_999",
            facility_name="Test Facility",
            assigned_label="NOT_A_REAL_LABEL",  # type: ignore
            reviewer_name="Analyst",
            review_notes=""
        )


def test_export_training_records(test_db):
    label_in = GroundTruthLabelCreate(
        incident_uuid="CLUSTER_005",
        facility_name="Ankleshwar Chemical Estate",
        assigned_label="TRUE_FIRE",
        reviewer_name="Field Inspector",
        review_notes="Solvent drum ignition."
    )
    GroundTruthService.create_label(test_db, label_in)

    csv_data = GroundTruthService.export_training_records(test_db)
    assert "incident_uuid,facility_name,assigned_label" in csv_data
    assert "CLUSTER_005" in csv_data
    assert "TRUE_FIRE" in csv_data
    assert "Ankleshwar Chemical Estate" in csv_data
