"""
Test Suite: 5-Dimensional ML Training Readiness Engine (Phase 14D)
Verifies:
- NOT_READY state for empty or statistically insufficient datasets
- LIMITED_TRAINING state for moderate sample size with multi-class and multi-facility coverage
- PRODUCTION_READY state for comprehensive, multi-corridor, multi-reviewer datasets
- Correct 5-dimensional breakdown: Total Verified, Class Balance, Facility Diversity, Regional Diversity, Reviewer Diversity
- Actionable bottleneck explanations and operational recommendations
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import GroundTruthLabelModel
from app.models.schemas import GroundTruthLabelCreate
from app.ml.ground_truth_service import GroundTruthService
from app.ml.training_readiness import TrainingReadinessEngine


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


def test_empty_dataset_not_ready(in_memory_db):
    """Verify zero labels outputs NOT_READY with zero score and actionable bottlenecks."""
    res = TrainingReadinessEngine.evaluate(in_memory_db)
    assert res["readiness_state"] == "NOT_READY"
    assert res["readiness_score"] == 0.0
    assert res["is_trainable"] is False
    assert len(res["bottlenecks"]) >= 2
    assert "deterministic" in res["recommendation"].lower()


def test_sparse_dataset_not_ready(in_memory_db):
    """Verify small dataset (e.g. 5 labels, 1 class, 1 facility) remains NOT_READY."""
    for i in range(5):
        GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
            incident_uuid=f"INC-{i}",
            facility_name="Single Refinery",
            assigned_label="TRUE_FIRE",
            reviewer_name="Solo Analyst"
        ))

    res = TrainingReadinessEngine.evaluate(in_memory_db)
    assert res["readiness_state"] == "NOT_READY"
    assert res["is_trainable"] is False
    assert res["dimensions"]["class_balance_score"] == 0.0
    assert res["dimensions"]["facility_diversity_score"] <= 30.0
    assert any("class" in b.lower() for b in res["bottlenecks"])


def test_moderate_dataset_limited_training(in_memory_db):
    """Verify 16 balanced labels across 2 facilities and 2 reviewers outputs LIMITED_TRAINING."""
    # 8 TRUE_FIRE, 8 CONTROLLED_FLARING across 2 facilities and 2 reviewers
    classes = ["TRUE_FIRE", "CONTROLLED_FLARING"]
    facilities = ["Refinery A", "Chemical Plant B"]
    reviewers = ["Analyst 1", "Analyst 2"]

    for i in range(16):
        GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
            incident_uuid=f"INC-MOD-{i}",
            facility_name=facilities[i % 2],
            assigned_label=classes[i % 2],
            reviewer_name=reviewers[i % 2]
        ))

    res = TrainingReadinessEngine.evaluate(in_memory_db)
    assert res["readiness_state"] == "LIMITED_TRAINING"
    assert res["is_trainable"] is True
    assert res["readiness_score"] >= 40.0
    assert res["dimensions"]["class_balance_score"] > 0.0
    assert res["dimension_telemetry"]["verified_count"] == 16


def test_production_ready_dataset(in_memory_db):
    """Verify comprehensive dataset (50+ labels, 4 classes, 6 facilities, 2 regions, 3 reviewers) outputs PRODUCTION_READY."""
    classes = ["TRUE_FIRE", "CONTROLLED_FLARING", "FALSE_ALARM", "MAINTENANCE_ACTIVITY"]
    facilities = ["Site 1", "Site 2", "Site 3", "Site 4", "Site 5", "Site 6"]
    regions = ["WEST_GUJARAT", "MUMBAI_PUNE"]
    reviewers = ["Dr. Sharma", "Analyst Priya", "Senior Lead Verma"]

    for i in range(56):
        lbl = GroundTruthService.create_label(in_memory_db, GroundTruthLabelCreate(
            incident_uuid=f"INC-PROD-{i}",
            facility_name=facilities[i % len(facilities)],
            assigned_label=classes[i % len(classes)],
            reviewer_name=reviewers[i % len(reviewers)],
            review_notes=f"Detailed verification evidence record {i}"
        ))
        lbl.region_code = regions[i % len(regions)]
    in_memory_db.commit()

    res = TrainingReadinessEngine.evaluate(in_memory_db)
    assert res["readiness_state"] == "PRODUCTION_READY"
    assert res["is_trainable"] is True
    assert res["readiness_score"] >= 75.0
    assert res["dimensions"]["total_verified_score"] == 100.0
    assert res["dimensions"]["class_balance_score"] > 80.0
    assert res["dimensions"]["facility_diversity_score"] == 100.0
    assert res["dimensions"]["regional_diversity_score"] == 100.0
    assert res["dimensions"]["reviewer_diversity_score"] == 100.0
    assert "production_ready" in res["explanation"].lower()
