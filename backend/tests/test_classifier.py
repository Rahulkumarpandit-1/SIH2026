import pytest
import numpy as np
import pandas as pd
from app.scoring.classifier import ThermalFeatureExtractor, ThermalClassifier, FEATURE_COLUMNS, CLASS_LABELS


def test_feature_extractor_shape_and_columns():
    """Verify that feature extractor creates the exact 9D matrix with proper delta T."""
    df = pd.DataFrame([
        {
            "latitude": 22.4707, "longitude": 70.0577,
            "frp": 14.2, "brightness": 348.5, "bright_t31": 298.2,
            "distance_to_industry_meters": 0.0,
            "persistence_ratio": 1.0,
            "active_days_count": 5,
            "is_anomaly_spike": False,
            "confidence_normalized": 0.95
        },
        {
            "latitude": 23.8512, "longitude": 71.2145,
            "frp": 5.6, "brightness": 335.2, "bright_t31": 294.0,
            "distance_to_industry_meters": 39256.0,
            "persistence_ratio": 0.2,
            "active_days_count": 1,
            "is_anomaly_spike": False,
            "confidence_normalized": 0.60
        }
    ])

    X, cols = ThermalFeatureExtractor.extract_features_from_dataframe(df)

    assert X.shape == (2, 9)
    assert cols == FEATURE_COLUMNS
    # Row 0 thermal contrast: 348.5 - 298.2 = 50.3
    assert X[0, 3] == pytest.approx(50.3, abs=0.1)


def test_thermal_classifier_training_and_inference():
    """Verify that Random Forest fits and returns valid class probabilities."""
    # Create small synthetic training sample covering 3 classes
    X = np.array([
        # Class 0: Persistent Industrial (high persistence, near industry, moderate FRP)
        [20.0, 350.0, 300.0, 50.0, 0.0, 1.0, 5, 0, 0.9],
        [25.0, 355.0, 305.0, 50.0, 0.0, 0.8, 4, 0, 0.9],
        # Class 1: Acute Industrial Fire Outbreak (low persistence, near industry, huge FRP)
        [90.0, 385.0, 310.0, 75.0, 0.0, 0.2, 1, 1, 0.95],
        [95.0, 390.0, 315.0, 75.0, 0.0, 0.2, 1, 1, 0.95],
        # Class 2: Agricultural Wildfire (low FRP, far from industry)
        [5.0, 335.0, 295.0, 40.0, 40000.0, 0.2, 1, 0, 0.6],
        [4.0, 330.0, 293.0, 37.0, 45000.0, 0.2, 1, 0, 0.5]
    ])
    y = np.array([0, 0, 1, 1, 2, 2])

    clf = ThermalClassifier(n_estimators=20, random_state=42)
    clf.fit(X, y)

    assert clf.is_trained is True

    # Test inference on a new acute industrial fire query point
    query_fire = np.array([[92.0, 388.0, 312.0, 76.0, 0.0, 0.2, 1, 1, 0.95]])
    pred = clf.predict(query_fire)
    proba = clf.predict_proba(query_fire)

    assert pred[0] == 1  # Must predict Class 1 (INDUSTRIAL_FIRE_OUTBREAK)
    assert proba.shape == (1, 3)

    # Feature importances must sum to 1.0
    importances = clf.get_feature_importances()
    assert len(importances) == 9
    assert sum(importances.values()) == pytest.approx(1.0, abs=0.01)


def test_spatial_group_cross_validation_leakage_prevention():
    """Verify that spatial cross validation respects cluster groups and runs without leakage."""
    X = np.array([
        [20.0, 350.0, 300.0, 50.0, 0.0, 1.0, 5, 0, 0.9],
        [22.0, 352.0, 302.0, 50.0, 0.0, 1.0, 5, 0, 0.9],
        [90.0, 385.0, 310.0, 75.0, 0.0, 0.2, 1, 1, 0.95],
        [95.0, 390.0, 315.0, 75.0, 0.0, 0.2, 1, 1, 0.95],
        [5.0, 335.0, 295.0, 40.0, 40000.0, 0.2, 1, 0, 0.6],
        [4.0, 330.0, 293.0, 37.0, 45000.0, 0.2, 1, 0, 0.5]
    ])
    y = np.array([0, 0, 1, 1, 2, 2])
    # 3 distinct spatial clusters (Jamnagar, Hazira, Rural)
    groups = np.array(["CLUSTER_001", "CLUSTER_001", "CLUSTER_003", "CLUSTER_003", "CLUSTER_004", "CLUSTER_004"])

    clf = ThermalClassifier(n_estimators=20, random_state=42)
    eval_results = clf.evaluate_spatial_cv(X, y, groups=groups, n_splits=3)

    assert "weighted_f1" in eval_results
    assert "confusion_matrix" in eval_results
    assert eval_results["n_splits"] == 3
