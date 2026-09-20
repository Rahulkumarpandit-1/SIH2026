"""
Test Suite: Reviewer Analytics & Leaderboard Engine (Phase 14B)
Verifies:
- Reviewer activity aggregation across labels and audit trail
- Breakdown of reviews by classification label
- Leaderboard sorting descending by review volume
- Activity tracking with daily counts and last active timestamps
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import GroundTruthLabelModel, ReviewAuditLogModel
from app.models.schemas import GroundTruthLabelCreate, GroundTruthLabelUpdate
from app.ml.ground_truth_service import GroundTruthService
from app.ml.governance_service import ReviewerAnalyticsService


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


def test_reviewer_analytics_empty_db(in_memory_db):
    """Verify reviewer analytics gracefully handles empty database."""
    res = ReviewerAnalyticsService.get_analytics(in_memory_db)
    assert res["total_active_reviewers"] == 0
    assert res["leaderboard"] == []
    assert res["summary"]["total_reviews"] == 0
    assert res["summary"]["most_active_reviewer"] == "None"


def test_reviewer_analytics_multi_reviewer(in_memory_db):
    """Verify analytics aggregates multi-reviewer contributions and ranks the leaderboard."""
    # Reviewer 1: 3 reviews (2 TRUE_FIRE, 1 CONTROLLED_FLARING)
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-001", facility_name="Site 1", assigned_label="TRUE_FIRE", reviewer_name="Dr. R. Sharma"
    ))
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-002", facility_name="Site 2", assigned_label="TRUE_FIRE", reviewer_name="Dr. R. Sharma"
    ))
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-003", facility_name="Site 3", assigned_label="CONTROLLED_FLARING", reviewer_name="Dr. R. Sharma"
    ))

    # Reviewer 2: 1 review (1 FALSE_ALARM)
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-004", facility_name="Site 4", assigned_label="FALSE_ALARM", reviewer_name="Analyst Priya"
    ))

    res = ReviewerAnalyticsService.get_analytics(in_memory_db)

    assert res["total_active_reviewers"] == 2
    assert res["summary"]["total_reviews"] == 4
    assert res["summary"]["most_active_reviewer"] == "Dr. R. Sharma"

    # Leaderboard must have Dr. Sharma first (3 reviews) then Priya (1 review)
    lb = res["leaderboard"]
    assert len(lb) == 2
    assert lb[0]["reviewer_name"] == "Dr. R. Sharma"
    assert lb[0]["total_reviews"] == 3
    assert lb[0]["reviews_by_class"]["TRUE_FIRE"] == 2
    assert lb[0]["reviews_by_class"]["CONTROLLED_FLARING"] == 1
    assert lb[0]["last_active"] is not None

    assert lb[1]["reviewer_name"] == "Analyst Priya"
    assert lb[1]["total_reviews"] == 1
    assert lb[1]["reviews_by_class"]["FALSE_ALARM"] == 1


def test_reviewer_analytics_tracks_edit_counts(in_memory_db):
    """Verify that editing labels updates the reviewer's edit_count."""
    lbl = GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-010", facility_name="Site 10", assigned_label="CONTROLLED_FLARING", reviewer_name="Analyst Amit"
    ))
    GroundTruthService.update_label(in_memory_db, lbl.id, GroundTruthLabelUpdate(
        assigned_label="MAINTENANCE_ACTIVITY", reviewer_name="Analyst Amit"
    ))

    res = ReviewerAnalyticsService.get_analytics(in_memory_db)
    lb = res["leaderboard"]
    assert len(lb) == 1
    assert lb[0]["reviewer_name"] == "Analyst Amit"
    assert lb[0]["edit_count"] >= 1
