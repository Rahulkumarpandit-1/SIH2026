"""
Test Suite: Dataset Quality & Empirical Coverage Engine (Phase 14C)
Verifies:
- Accurate calculation of verified coverage percentage
- Label distribution breakdown including unreviewed incidents
- Reviewer, regional, and facility distributions
- Last 7-day review activity trend
- Data integrity scoring
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import GroundTruthLabelModel, IncidentRecordModel
from app.models.schemas import GroundTruthLabelCreate
from app.ml.ground_truth_service import GroundTruthService
from app.ml.governance_service import DatasetQualityService


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


def test_dataset_quality_metrics_calculation(in_memory_db):
    """Verify quality metrics with labeled records and incident records."""
    # Add labeled incidents
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-001", facility_name="ONGC Hazira", assigned_label="TRUE_FIRE",
        reviewer_name="Dr. R. Sharma", review_notes="Comprehensive evidence recorded."
    ))
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-002", facility_name="Reliance Jamnagar", assigned_label="CONTROLLED_FLARING",
        reviewer_name="Analyst Priya", review_notes="Within baseline limits."
    ))
    GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
        incident_uuid="INC-003", facility_name="Adani Mundra", assigned_label="FALSE_ALARM",
        reviewer_name="Analyst Priya", review_notes="Rural agricultural signature."
    ))

    quality = DatasetQualityService.get_quality_metrics(in_memory_db)

    assert quality["total_labeled_incidents"] == 3
    assert quality["total_incidents"] >= 3
    assert quality["verified_coverage_pct"] > 0.0

    # Label distribution check
    dist = quality["label_distribution"]
    assert dist["TRUE_FIRE"] == 1
    assert dist["CONTROLLED_FLARING"] == 1
    assert dist["FALSE_ALARM"] == 1
    assert dist["MAINTENANCE_ACTIVITY"] == 0
    assert "UNLABELED" in dist

    # Reviewer distribution check
    rev_dist = quality["labels_per_reviewer"]
    assert rev_dist["Dr. R. Sharma"] == 1
    assert rev_dist["Analyst Priya"] == 2

    # Facility distribution check
    fac_dist = quality["facility_distribution"]
    assert len(fac_dist) == 3
    fac_names = [f["facility_name"] for f in fac_dist]
    assert "ONGC Hazira" in fac_names
    assert "Reliance Jamnagar" in fac_names

    # 7-day trend check
    trend = quality["last_7_day_trend"]
    assert len(trend) == 7
    total_trend_count = sum(t["count"] for t in trend)
    assert total_trend_count == 3

    # Data integrity score
    assert quality["data_integrity_score"] > 0.0
    assert quality["data_integrity_score"] <= 100.0
