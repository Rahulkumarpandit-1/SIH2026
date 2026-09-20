import pytest
from app.db.session import SessionLocal
from app.ml.dataset_builder import MLDatasetBuilder, FEATURE_DEFINITIONS
from app.ml.ground_truth_service import GroundTruthService
from app.models.schemas import GroundTruthLabelCreate


def test_build_dataset_features_and_export():
    db = SessionLocal()
    try:
        # Seed a ground-truth label to verify target label mapping
        label_in = GroundTruthLabelCreate(
            incident_uuid="CLUSTER_003",
            facility_name="Hazira Heavy Industrial & Steel Complex",
            assigned_label="TRUE_FIRE",
            reviewer_name="Safety Lead",
            review_notes="Ground-truth verified fire."
        )
        GroundTruthService.create_label(db, label_in)

        # Build dataset
        df = MLDatasetBuilder.build_dataset(db)
        assert not df.empty
        assert len(df) >= 6

        # Verify all 13 required features are present
        required_features = [
            "risk_score",
            "thermal_intensity",
            "distance_to_facility",
            "persistence_ratio",
            "confidence_score",
            "wind_speed",
            "temperature",
            "cloud_cover",
            "population_exposure",
            "infrastructure_exposure",
            "environmental_exposure",
            "thermal_anomaly_ratio",
            "abnormality_score"
        ]
        for feat in required_features:
            assert feat in df.columns, f"Missing required feature column: {feat}"
            # Assert no null values in required features
            assert df[feat].isnull().sum() == 0, f"Found nulls in feature column: {feat}"

        assert "ground_truth_label" in df.columns

        # Verify target label mapping for CLUSTER_003
        c3_row = df[df["incident_uuid"] == "CLUSTER_003"]
        if not c3_row.empty:
            assert c3_row.iloc[0]["ground_truth_label"] == "TRUE_FIRE"

        # Verify CSV export path exists and has content
        csv_path = MLDatasetBuilder.get_dataset_output_path()
        assert csv_path.exists()
        assert csv_path.stat().st_size > 0

    finally:
        db.close()


def test_dataset_summary():
    db = SessionLocal()
    try:
        summary = MLDatasetBuilder.get_dataset_summary(db)
        assert summary["total_samples"] >= 6
        assert summary["feature_count"] == 13
        assert "label_distribution" in summary
        assert "TRUE_FIRE" in summary["label_distribution"]
        assert "UNLABELED" in summary["label_distribution"]
        assert len(summary["features"]) == 13

        # Check feature definition structure
        first_feat = summary["features"][0]
        for key in ["name", "label", "source", "unit", "description"]:
            assert key in first_feat

    finally:
        db.close()


def test_dataset_csv_string():
    db = SessionLocal()
    try:
        csv_str = MLDatasetBuilder.get_dataset_csv_string(db)
        assert isinstance(csv_str, str)
        assert "risk_score" in csv_str
        assert "ground_truth_label" in csv_str
        assert "thermal_intensity" in csv_str
    finally:
        db.close()
