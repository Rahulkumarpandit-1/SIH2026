"""
Test Suite: Review Audit Trail & Label Quality Protection (Phase 14A & 14E)
Verifies:
- Creation of immutable audit trail entries on label creation and modification
- Accurate recording of previous_label and new_label transitions
- Enforcement of non-anonymous reviewer identity
- Tracking of is_edited and edit_count metadata
- Filtering audit logs by incident_uuid and reviewer_name
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import GroundTruthLabelModel, ReviewAuditLogModel
from app.models.schemas import GroundTruthLabelCreate, GroundTruthLabelUpdate
from app.ml.ground_truth_service import GroundTruthService, validate_reviewer_name


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


def test_reviewer_name_validation():
    """Verify non-anonymous reviewer enforcement."""
    # Valid names
    assert validate_reviewer_name("Dr. R. Sharma") == "Dr. R. Sharma"
    assert validate_reviewer_name("Analyst Vikram") == "Analyst Vikram"

    # Anonymous / invalid names must raise ValueError
    with pytest.raises(ValueError, match="Anonymous reviews are prohibited"):
        validate_reviewer_name("Anonymous")

    with pytest.raises(ValueError, match="Anonymous reviews are prohibited"):
        validate_reviewer_name("anon")

    with pytest.raises(ValueError, match="Anonymous reviews are prohibited"):
        validate_reviewer_name("unknown")

    with pytest.raises(ValueError, match="Reviewer name is required"):
        validate_reviewer_name("")

    with pytest.raises(ValueError, match="Reviewer name is required"):
        validate_reviewer_name("   ")

    with pytest.raises(ValueError, match="Reviewer name is required"):
        validate_reviewer_name("A")


def test_label_creation_creates_audit_log(in_memory_db):
    """Verify that creating a ground truth label records an audit log entry."""
    create_req = GroundTruthLabelCreate(
        incident_uuid="INC-20260824-HAZIRA-001",
        facility_name="ONGC Hazira Complex",
        assigned_label="TRUE_FIRE",
        reviewer_name="Dr. R. Sharma",
        review_notes="Verified against local ground reports."
    )

    lbl = GroundTruthService.create_label(in_memory_db, create_req)
    assert lbl.id is not None
    assert lbl.assigned_label == "TRUE_FIRE"
    assert lbl.original_label == "TRUE_FIRE"
    assert lbl.is_edited is False
    assert lbl.edit_count == 0

    # Verify audit log record
    audits = in_memory_db.query(ReviewAuditLogModel).filter(
        ReviewAuditLogModel.incident_uuid == "INC-20260824-HAZIRA-001"
    ).all()
    assert len(audits) == 1
    log = audits[0]
    assert log.action_type == "CREATE"
    assert log.reviewer_name == "Dr. R. Sharma"
    assert log.previous_label is None
    assert log.new_label == "TRUE_FIRE"
    assert log.notes == "Verified against local ground reports."


def test_label_update_creates_audit_log_and_tracks_edits(in_memory_db):
    """Verify that updating a label marks it as edited and logs previous/new labels."""
    # Create initial label
    create_req = GroundTruthLabelCreate(
        incident_uuid="INC-20260824-JAMNAGAR-001",
        facility_name="Reliance Jamnagar Refinery",
        assigned_label="CONTROLLED_FLARING",
        reviewer_name="Analyst Priya",
        review_notes="Initial flare observation."
    )
    lbl = GroundTruthService.create_label(in_memory_db, create_req)

    # Update label
    update_req = GroundTruthLabelUpdate(
        assigned_label="TRUE_FIRE",
        reviewer_name="Senior Lead Verma",
        review_notes="Elevated combustion exceeds operational permit envelope."
    )
    updated_lbl = GroundTruthService.update_label(in_memory_db, lbl.id, update_req)

    assert updated_lbl.assigned_label == "TRUE_FIRE"
    assert updated_lbl.original_label == "CONTROLLED_FLARING"
    assert updated_lbl.is_edited is True
    assert updated_lbl.edit_count == 1
    assert updated_lbl.reviewer_name == "Senior Lead Verma"

    # Verify audit logs: should now have 2 records (1 CREATE, 1 UPDATE)
    audits = GroundTruthService.get_audit_trail(in_memory_db, incident_uuid="INC-20260824-JAMNAGAR-001")
    assert len(audits) == 2

    # Most recent first
    update_log = audits[0]
    create_log = audits[1]

    assert update_log.action_type == "UPDATE"
    assert update_log.previous_label == "CONTROLLED_FLARING"
    assert update_log.new_label == "TRUE_FIRE"
    assert update_log.reviewer_name == "Senior Lead Verma"

    assert create_log.action_type == "CREATE"
    assert create_log.previous_label is None
    assert create_log.new_label == "CONTROLLED_FLARING"
    assert create_log.reviewer_name == "Analyst Priya"


def test_audit_trail_filtering(in_memory_db):
    """Verify filtering audit logs by incident_uuid and reviewer_name."""
    # Label 1
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-001", facility_name="Site A", assigned_label="TRUE_FIRE", reviewer_name="Analyst Alice"
    ))
    # Label 2
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-002", facility_name="Site B", assigned_label="FALSE_ALARM", reviewer_name="Analyst Bob"
    ))

    # Filter by incident
    audits_inc1 = GroundTruthService.get_audit_trail(in_memory_db, incident_uuid="INC-001")
    assert len(audits_inc1) == 1
    assert audits_inc1[0].incident_uuid == "INC-001"

    # Filter by reviewer
    audits_bob = GroundTruthService.get_audit_trail(in_memory_db, reviewer_name="Bob")
    assert len(audits_bob) == 1
    assert audits_bob[0].reviewer_name == "Analyst Bob"
