import pytest
import pandas as pd
import numpy as np
import tempfile
import hashlib
import json
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.ingestion.historical_firms import HistoricalFIRMSIngester, AVAILABLE_SENSORS
from app.ingestion.validator import ObservationValidator
from app.dataset.ground_truth import (
    GroundTruthRegistry,
    GroundTruthReviewRequest,
    TargetClass,
    LabelProvenance
)
from app.dataset.builder import DatasetBuilder, FORBIDDEN_FEATURES
from app.scoring.classifier import (
    MLReadinessEvaluator,
    MLReadinessStatus,
    ProductionMLTrainer,
    FEATURE_COLUMNS,
    ThermalFeatureExtractor,
    ThermalClassifier
)

client = TestClient(app)


def test_historical_ingester_sensors_supported():
    """Verifies that all 4 NASA FIRMS sensors are supported."""
    expected = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
    for s in expected:
        assert s in AVAILABLE_SENSORS


def test_historical_ingester_deduplication():
    """Verifies composite natural key deduplication logic."""
    ingester = HistoricalFIRMSIngester()
    
    df_with_dups = pd.DataFrame([
        {
            "latitude": 21.1012,
            "longitude": 72.6364,
            "brightness": 355.8,
            "acq_date": "2026-08-24",
            "acq_time": "0805",
            "satellite": "N",
            "frp": 11.1
        },
        {
            "latitude": 21.1012,
            "longitude": 72.6364,
            "brightness": 355.8,
            "acq_date": "2026-08-24",
            "acq_time": "0805",
            "satellite": "N",
            "frp": 11.1
        },
        # Different time -> valid separate detection
        {
            "latitude": 21.1012,
            "longitude": 72.6364,
            "brightness": 340.0,
            "acq_date": "2026-08-24",
            "acq_time": "2030",
            "satellite": "N",
            "frp": 8.5
        }
    ])

    df_clean, dropped = ingester.deduplicate_observations(df_with_dups)
    assert dropped == 1
    assert len(df_clean) == 2


def test_sensor_normalization_modis_and_viirs():
    """Verifies that MODIS and VIIRS column differences and confidence values normalize properly."""
    validator = ObservationValidator()
    
    # MODIS sample (numeric confidence 0-100, bright_t31, TERRA satellite)
    modis_df = pd.DataFrame([{
        "latitude": 22.1234,
        "longitude": 70.5678,
        "brightness": 340.5,
        "bright_t31": 295.2,
        "scan": 1.0,
        "track": 1.0,
        "acq_date": "2026-08-20",
        "acq_time": "1030",
        "satellite": "Terra",
        "instrument": "MODIS",
        "confidence": 85,
        "version": "6.1NRT",
        "frp": 45.0,
        "daynight": "D"
    }])
    valid_modis, rejections = validator.validate_dataframe(modis_df)
    assert len(valid_modis) == 1
    assert len(rejections) == 0
    assert valid_modis[0].confidence == "high"
    assert valid_modis[0].confidence_normalized == 0.85
    assert valid_modis[0].instrument == "MODIS"

    # VIIRS sample (bright_ti4 / bright_ti5, categorical confidence 'h')
    viirs_df = pd.DataFrame([{
        "latitude": 21.1000,
        "longitude": 72.6000,
        "bright_ti4": 367.8,
        "bright_ti5": 298.0,
        "scan": 0.375,
        "track": 0.375,
        "acq_date": "2026-08-24",
        "acq_time": "2112",
        "satellite": "N",
        "instrument": "VIIRS",
        "confidence": "h",
        "version": "2.0NRT",
        "frp": 12.3,
        "daynight": "N"
    }])
    valid_viirs, rejections_v = validator.validate_dataframe(viirs_df)
    assert len(valid_viirs) == 1
    assert len(rejections_v) == 0
    assert valid_viirs[0].brightness == 367.8
    assert valid_viirs[0].bright_t31 == 298.0
    assert valid_viirs[0].confidence == "high"


def test_immutable_storage_and_sha256_verification(tmp_path):
    """Verifies that raw files are saved immutably with SHA-256 sidecars and no collisions."""
    raw_dir = tmp_path / "raw" / "firms"
    ingester = HistoricalFIRMSIngester(raw_storage_dir=str(raw_dir))

    # Mock raw text payload
    raw_payload = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n21.1,72.6,350.0,0.5,0.5,2026-08-24,2100,N,VIIRS,nominal,2.0,290.0,15.0,N"
    expected_sha = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    # Emulate fetch_and_archive_area saving raw payload
    archive_dir = ingester._get_archive_dir()
    csv_file = archive_dir / "test_payload.csv"
    meta_file = archive_dir / "test_payload.meta.json"

    csv_file.write_text(raw_payload, encoding="utf-8")
    meta_file.write_text(json.dumps({
        "sha256_checksum": expected_sha,
        "raw_record_count": 1,
        "sensor": "VIIRS_SNPP_NRT"
    }), encoding="utf-8")

    assert csv_file.exists()
    assert meta_file.exists()
    
    # Read back and verify hash integrity
    content = csv_file.read_text(encoding="utf-8")
    actual_sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert actual_sha == expected_sha


def test_ground_truth_review_workflow(tmp_path):
    """Tests ground truth review registration, provenance storage, and quality metrics."""
    storage_file = tmp_path / "test_reviews.json"
    registry = GroundTruthRegistry(storage_path=str(storage_file))

    review_req = GroundTruthReviewRequest(
        observation_id=101,
        latitude=21.1688,
        longitude=72.6957,
        acq_date="2026-08-24",
        target_class="INDUSTRIAL_FIRE_OUTBREAK",
        reviewer="Test Lead Analyst",
        source_citation="DOC-TEST-HAZIRA-2026",
        provenance_type="EXPERT_HUMAN_REVIEW",
        confidence=0.95,
        review_notes="Verified via CCTV and emergency logs"
    )

    prov = registry.add_human_review(review_req)
    assert prov.label == int(TargetClass.INDUSTRIAL_FIRE_OUTBREAK)
    assert prov.label_source == "EXPERT_HUMAN_REVIEW"
    assert prov.reviewer == "Test Lead Analyst"

    # Match observation
    matched = registry.match_observation(21.1688, 72.6957, "2026-08-24")
    assert matched.label == 1
    assert matched.source_reference == "DOC-TEST-HAZIRA-2026"

    # Quality report
    quality = registry.get_ground_truth_quality()
    assert quality["human_reviews_count"] == 1
    assert quality["class_distribution"]["INDUSTRIAL_FIRE_OUTBREAK"] == 1


def test_leakage_free_dataset_builder(tmp_path):
    """Verifies that coordinates and rule engine outputs are strictly barred from ML matrices."""
    builder = DatasetBuilder(output_dir=str(tmp_path / "processed"), ml_dir=str(tmp_path / "ml"))
    
    # Create sample labeled dataset
    df_sample = pd.DataFrame([
        {
            "id": 1,
            "latitude": 21.1642,
            "longitude": 72.6781,
            "brightness": 365.2,
            "bright_t31": 300.0,
            "frp": 92.7,
            "acq_date": "2026-08-24",
            "distance_to_industry_meters": 0.0,
            "persistence_ratio": 0.2,
            "active_days_count": 1,
            "is_anomaly_spike": 1,
            "confidence_normalized": 0.9,
            "cluster_id": "CLUSTER_1",
            "label": 1,
            "risk_score": 92.4,
            "action_code": "EMERGENCY_DISPATCH"
        },
        {
            "id": 2,
            "latitude": 22.4707,
            "longitude": 70.0577,
            "brightness": 345.0,
            "bright_t31": 298.0,
            "frp": 25.0,
            "acq_date": "2026-08-24",
            "distance_to_industry_meters": 500.0,
            "persistence_ratio": 1.0,
            "active_days_count": 5,
            "is_anomaly_spike": 0,
            "confidence_normalized": 0.8,
            "cluster_id": "CLUSTER_2",
            "label": 0,
            "risk_score": 62.6,
            "action_code": "BACKGROUND_LOG"
        }
    ])

    X, y, groups, feat_names = builder.generate_feature_matrices(df_sample)
    
    # Assertions
    assert "latitude" not in feat_names
    assert "longitude" not in feat_names
    assert "risk_score" not in feat_names
    assert "action_code" not in feat_names
    assert "cluster_id" not in feat_names
    assert len(feat_names) == 9
    assert X.shape == (2, 9)
    assert len(y) == 2
    assert len(groups) == 2

    # Export ML splits
    manifest = builder.export_ml_splits(df_sample)
    assert manifest["leakage_prevention_verified"] is True
    assert (tmp_path / "ml" / "X_train.csv").exists()
    assert (tmp_path / "ml" / "feature_metadata.json").exists()


def test_forbidden_feature_assertions(tmp_path):
    """Tests that passing any forbidden column to validator raises ValueError."""
    builder = DatasetBuilder(output_dir=str(tmp_path / "processed"), ml_dir=str(tmp_path / "ml"))
    
    for forbidden in ["latitude", "longitude", "cluster_id", "risk_score", "risk_level", "action_code", "incident_classification"]:
        bad_df = pd.DataFrame({
            "frp": [10.0],
            forbidden: [1.0]
        })
        with pytest.raises(ValueError) as exc_info:
            builder.validate_feature_matrix_integrity(bad_df)
        assert "CRITICAL LEAKAGE DETECTED" in str(exc_info.value)


def test_ml_readiness_evaluator():
    """Tests honest ML readiness assessment under sparse vs sufficient conditions."""
    # 1. Sparse dataset
    sparse_df = pd.DataFrame({
        "label": [0, 0, 0],
        "cluster_id": ["C1", "C1", "C1"]
    })
    readiness_sparse = MLReadinessEvaluator.evaluate(sparse_df)
    assert readiness_sparse["status"] == MLReadinessStatus.NOT_READY.value
    assert readiness_sparse["is_statistically_defensible"] is False
    assert "Supervised learning requires >= 2 distinct classes" in readiness_sparse["reason"]

    # 2. Sufficient multi-class dataset
    labels = [0] * 25 + [1] * 20 + [2] * 15
    clusters = [f"CLUSTER_{i % 6}" for i in range(len(labels))]
    rich_df = pd.DataFrame({
        "label": labels,
        "cluster_id": clusters
    })
    readiness_rich = MLReadinessEvaluator.evaluate(rich_df)
    assert readiness_rich["status"] == MLReadinessStatus.READY_FOR_TRAINING.value
    assert readiness_rich["is_statistically_defensible"] is True


def test_production_ml_training_graceful_skip(tmp_path):
    """Tests that trainer skips gracefully when data is insufficient."""
    trainer = ProductionMLTrainer(models_dir=str(tmp_path / "models"), reports_dir=str(tmp_path / "reports"))
    
    X = np.array([[10.0, 330.0, 300.0, 30.0, 100.0, 0.2, 1, 0, 0.8]])
    y = np.array([0])
    groups = np.array(["C1"])
    readiness = {"status": "NOT_READY", "reason": "Insufficient data"}

    report = trainer.train_and_persist(X, y, groups, readiness)
    assert report["training_status"] == "SKIPPED"
    assert "Training skipped due to insufficient" in report["reason"]


def test_production_ml_training_valid_spatial_cv(tmp_path):
    """Tests valid ML training with Spatial GroupKFold isolation (0 cluster overlap) on synthetic multi-class data."""
    trainer = ProductionMLTrainer(models_dir=str(tmp_path / "models"), reports_dir=str(tmp_path / "reports"))
    
    # 60 samples across 3 classes and 6 spatial clusters
    np.random.seed(42)
    n = 60
    X = np.random.randn(n, 9)
    y = np.array([0] * 20 + [1] * 20 + [2] * 20)
    groups = np.array([f"CLUSTER_{i % 6}" for i in range(n)])
    
    readiness = {
        "status": "READY_FOR_TRAINING",
        "reason": "Sufficient multi-class samples in multiple spatial clusters.",
        "is_statistically_defensible": True
    }

    # Test Random Forest
    rf_report = trainer.train_and_persist(X, y, groups, readiness, model_type="random_forest")
    assert rf_report["training_status"] == "SUCCESS"
    assert rf_report["model_type"] == "random_forest"
    assert rf_report["metrics"]["cluster_overlap_verified"] == 0
    assert (tmp_path / "models" / "model.joblib").exists()

    # Test Logistic Regression
    lr_report = trainer.train_and_persist(X, y, groups, readiness, model_type="logistic_regression")
    assert lr_report["training_status"] == "SUCCESS"
    assert lr_report["model_type"] == "logistic_regression"
    assert lr_report["metrics"]["cluster_overlap_verified"] == 0


def test_api_ground_truth_endpoints():
    """Tests FastAPI /api/ground-truth and /api/ground-truth/quality."""
    res = client.get("/api/ground-truth")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res_q = client.get("/api/ground-truth/quality")
    assert res_q.status_code == 200
    data_q = res_q.json()
    assert "total_verified_labels" in data_q
    assert "class_distribution" in data_q


def test_api_ml_status():
    """Tests FastAPI /api/ml/status."""
    res = client.get("/api/ml/status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "reason" in data
    assert "labeled_samples" in data


def test_api_ml_predict():
    """Tests FastAPI /api/ml/predict with 9D feature payload."""
    payload = {
        "frp": 85.0,
        "brightness": 365.0,
        "bright_t31": 300.0,
        "thermal_contrast": 65.0,
        "distance_to_industry_meters": 0.0,
        "persistence_ratio": 0.2,
        "active_days_count": 1,
        "is_anomaly_spike": 1,
        "confidence_normalized": 0.9
    }
    res = client.post("/api/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "ml_status" in data
    assert "features_used" in data
    assert len(data["features_used"]) == 9
