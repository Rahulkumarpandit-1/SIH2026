import os
import tempfile
import pytest
import numpy as np
import pandas as pd
from datetime import date

from app.ingestion.historical_firms import HistoricalFIRMSIngester
from app.dataset.ground_truth import GroundTruthRegistry, LabelProvenance, TargetClass
from app.dataset.builder import DatasetBuilder
from app.scoring.classifier import FEATURE_COLUMNS, ThermalClassifier


@pytest.fixture
def sample_firms_dataframe():
    """Generates a representative sample FIRMS DataFrame for testing."""
    return pd.DataFrame([
        {
            "latitude": 21.1642,
            "longitude": 72.6781,
            "brightness": 372.4,
            "bright_t31": 298.5,
            "acq_date": "2026-08-24",
            "acq_time": "1845",
            "satellite": "N",
            "instrument": "VIIRS",
            "confidence": "high",
            "frp": 145.2,
            "daynight": "N"
        },
        {
            "latitude": 22.4707,
            "longitude": 70.0577,
            "brightness": 341.2,
            "bright_t31": 295.1,
            "acq_date": "2026-08-20",
            "acq_time": "1830",
            "satellite": "N",
            "instrument": "VIIRS",
            "confidence": "nominal",
            "frp": 32.5,
            "daynight": "N"
        },
        # Duplicate of second record
        {
            "latitude": 22.4707,
            "longitude": 70.0577,
            "brightness": 341.2,
            "bright_t31": 295.1,
            "acq_date": "2026-08-20",
            "acq_time": "1830",
            "satellite": "N",
            "instrument": "VIIRS",
            "confidence": "nominal",
            "frp": 32.5,
            "daynight": "N"
        },
        # Unlabeled rural observation
        {
            "latitude": 23.9500,
            "longitude": 71.5000,
            "brightness": 315.0,
            "bright_t31": 292.0,
            "acq_date": "2026-08-22",
            "acq_time": "0830",
            "satellite": "N",
            "instrument": "VIIRS",
            "confidence": "low",
            "frp": 6.8,
            "daynight": "D"
        }
    ])


def test_deduplication(sample_firms_dataframe):
    """Verifies that duplicate satellite telemetry observations are identified and dropped."""
    ingester = HistoricalFIRMSIngester()
    df_dedup, dropped = ingester.deduplicate_observations(sample_firms_dataframe)
    
    assert len(df_dedup) == 3
    assert dropped == 1


def test_ground_truth_provenance_matching():
    """Verifies that ground truth registry correctly attaches verified provenance and marks unknowns as UNLABELED."""
    registry = GroundTruthRegistry()
    registry.register_verified_incident(
        latitude=21.1642,
        longitude=72.6781,
        radius_meters=1000.0,
        date_str="2026-08-24",
        target_class=TargetClass.INDUSTRIAL_FIRE_OUTBREAK,
        source="OFFICIAL_DISASTER_REGISTRY",
        confidence=0.95,
        reference="DOC-HAZIRA-2026-08-003"
    )

    # 1. Matching observation
    match = registry.match_observation(21.1642, 72.6781, "2026-08-24")
    assert match.label == int(TargetClass.INDUSTRIAL_FIRE_OUTBREAK)
    assert match.label_source == "OFFICIAL_DISASTER_REGISTRY"
    assert match.label_confidence == 0.95
    assert match.source_reference == "DOC-HAZIRA-2026-08-003"

    # 2. Non-matching date
    no_date_match = registry.match_observation(21.1642, 72.6781, "2026-08-20")
    assert no_date_match.label is None
    assert no_date_match.label_name == "UNLABELED"
    assert no_date_match.label_source == "UNVERIFIED"

    # 3. Non-matching coordinate
    no_loc_match = registry.match_observation(23.5000, 71.0000, "2026-08-24")
    assert no_loc_match.label is None
    assert no_loc_match.label_name == "UNLABELED"


def test_dataset_enrichment_and_split(sample_firms_dataframe):
    """Verifies that dataset builder enriches data and separates labeled vs unlabeled CSVs cleanly."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        builder = DatasetBuilder(output_dir=tmp_dir)
        builder.register_known_historical_ground_truth()

        ingester = HistoricalFIRMSIngester()
        df_clean, _ = ingester.deduplicate_observations(sample_firms_dataframe)
        df_enriched = builder.process_and_enrich_observations(df_clean)

        assert "distance_to_industry_meters" in df_enriched.columns
        assert "cluster_id" in df_enriched.columns
        assert "persistence_ratio" in df_enriched.columns
        assert "label" in df_enriched.columns

        df_labeled, df_unlabeled = builder.split_and_save_datasets(df_enriched)

        assert len(df_labeled) > 0
        assert len(df_unlabeled) > 0
        assert len(df_labeled) + len(df_unlabeled) == len(df_clean)

        # Check saved files
        assert os.path.exists(os.path.join(tmp_dir, "historical_all_enriched.csv"))
        assert os.path.exists(os.path.join(tmp_dir, "historical_labeled.csv"))
        assert os.path.exists(os.path.join(tmp_dir, "historical_unlabeled.csv"))


def test_feature_matrix_and_no_coordinate_leakage(sample_firms_dataframe):
    """
    CRITICAL TEST: Verifies that the predictive feature matrix X contains exactly the 9
    physical/spatial features and strictly excludes latitude and longitude coordinates.
    """
    builder = DatasetBuilder()
    builder.register_known_historical_ground_truth()

    ingester = HistoricalFIRMSIngester()
    df_clean, _ = ingester.deduplicate_observations(sample_firms_dataframe)
    df_enriched = builder.process_and_enrich_observations(df_clean)
    df_labeled, _ = builder.split_and_save_datasets(df_enriched)

    X, y, groups, feat_names = builder.generate_feature_matrices(df_labeled)

    assert X.shape[1] == 9
    assert "latitude" not in feat_names
    assert "longitude" not in feat_names
    assert feat_names == FEATURE_COLUMNS
    assert len(y) == len(df_labeled)
    assert len(groups) == len(df_labeled)


def test_spatial_group_kfold_isolation():
    """
    Verifies that Spatial Group K-Fold cross validation ensures zero cluster leakage:
    No spatial cluster ID is present in both training and test splits simultaneously.
    """
    # Create synthetic observations across 4 distinct spatial clusters
    np.random.seed(42)
    n_samples = 20
    X = np.random.randn(n_samples, 9)
    y = np.random.choice([0, 1, 2], size=n_samples)
    groups = np.array(["CLUSTER_A"] * 6 + ["CLUSTER_B"] * 5 + ["CLUSTER_C"] * 5 + ["CLUSTER_D"] * 4)

    classifier = ThermalClassifier(n_estimators=10, random_state=42)
    from sklearn.model_selection import GroupKFold
    gkf = GroupKFold(n_splits=3)

    for train_idx, test_idx in gkf.split(X, y, groups=groups):
        train_clusters = set(groups[train_idx])
        test_clusters = set(groups[test_idx])
        # Assert complete intersection emptiness (0 overlap)
        overlap = train_clusters.intersection(test_clusters)
        assert len(overlap) == 0, f"Spatial leakage detected! Overlapping clusters: {overlap}"


def test_quality_report_sufficiency_evaluation(sample_firms_dataframe):
    """Verifies that the dataset quality report accurately flags insufficient data for ML without fabricating accuracy."""
    builder = DatasetBuilder()
    builder.register_known_historical_ground_truth()

    ingester = HistoricalFIRMSIngester()
    df_clean, dropped = ingester.deduplicate_observations(sample_firms_dataframe)
    df_enriched = builder.process_and_enrich_observations(df_clean)

    report = builder.generate_quality_report(sample_firms_dataframe, df_enriched, duplicates_dropped=dropped)

    assert report["total_raw_observations"] == 4
    assert report["total_unique_observations"] == 3
    assert report["duplicates_dropped"] == 1
    # Since dataset is small (<50 samples), must report insufficient for supervised ML
    assert report["is_sufficient_for_supervised_ml"] is False
    assert "Insufficient verified ground-truth data" in report["scientific_assessment"]
