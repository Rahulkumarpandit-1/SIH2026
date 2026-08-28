import os
import sys
import argparse
import json
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.logging import logger
from app.ingestion.historical_firms import HistoricalFIRMSIngester, AVAILABLE_SENSORS
from app.dataset.builder import DatasetBuilder
from app.scoring.classifier import MLReadinessEvaluator, ProductionMLTrainer


def print_comparison_table():
    """Prints the clear comparison table between Rule Engine and ML Model."""
    table = """
================================================================================
                OPERATIONAL RULE ENGINE  vs  MACHINE LEARNING MODEL
================================================================================
 Dimension              Operational Rule Engine         ML Supervised Model
--------------------------------------------------------------------------------
 Explainability         Deterministic & Transparent     Statistical & Feature-Weight
 Training Requirement   0 verified labels needed        Requires verified multi-class
 Physics Features       Direct thermodynamic rules      Learns multi-feature boundary
 Spatial Validation     Global boundary geofencing      Spatial GroupKFold (0 overlap)
 Generalization         Rule-based across regions       Spatial group validation needed
 Operational Status     PRIMARY OPERATIONAL SYSTEM      EXPERIMENTAL / BENCHMARK
================================================================================
"""
    print(table)


def main():
    parser = argparse.ArgumentParser(
        description="SIH26162 — Real Historical NASA FIRMS Ingestion, Ground-Truth & ML Dataset Pipeline"
    )
    parser.add_argument(
        "--fetch-api",
        action="store_true",
        help="Fetch real historical/NRT observations from NASA FIRMS API"
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default=None,
        help="Start date for historical chunked query (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end-date",
        type=str,
        default=None,
        help="End date for historical chunked query (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--input-csv",
        type=str,
        default=None,
        help="Path to an existing raw FIRMS CSV file on disk"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=5,
        help="Number of days to query from NASA FIRMS API (1-30)"
    )
    parser.add_argument(
        "--sensor",
        type=str,
        default=settings.DEFAULT_SENSOR,
        help=f"Satellite sensor ({', '.join(AVAILABLE_SENSORS)})"
    )
    parser.add_argument(
        "--sensors",
        type=str,
        default=None,
        help="Comma-separated satellite sensors to query in multi-sensor mode (e.g. VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,MODIS_NRT or 'all')"
    )
    parser.add_argument(
        "--model-type",
        type=str,
        default="random_forest",
        choices=["random_forest", "logistic_regression", "gradient_boosting"],
        help="Classifier architecture for supervised training (random_forest or logistic_regression)"
    )
    parser.add_argument(
        "--save-db",
        action="store_true",
        help="Commit newly downloaded and deduplicated observations to active SQLite database"
    )
    parser.add_argument(
        "--export-ml",
        action="store_true",
        help="Export clean train/test splits and metadata to data/ml/"
    )
    parser.add_argument(
        "--train-ml",
        action="store_true",
        help="Attempt ML model training if dataset is evaluated as ready"
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Only display the data quality report"
    )

    args = parser.parse_args()

    print("\n" + "=" * 80)
    print(" SIH26162 — NASA FIRMS HISTORICAL ACQUISITION & PRODUCTION ML PIPELINE")
    print("=" * 80 + "\n")

    ingester = HistoricalFIRMSIngester()
    builder = DatasetBuilder()
    builder.register_known_historical_ground_truth()

    # Pre-flight API check if fetching from API
    if args.fetch_api:
        api_status = ingester.verify_api_availability()
        print(f"[*] Pre-flight NASA FIRMS API Check: {'AVAILABLE' if api_status.get('available') else 'UNAVAILABLE'}")
        if not api_status.get("available"):
            print(f"[!] Warning / Failure Reason: {api_status.get('reason')}")
            if not api_status.get("map_key_set", True):
                print("[!] Real FIRMS API request cannot proceed without valid FIRMS_MAP_KEY.")
                return

    df_raw = pd.DataFrame()
    rejected_records = []
    duplicates_dropped = 0
    raw_files_created = []

    if args.fetch_api:
        target_sensors: List[str] = []
        if args.sensors:
            if args.sensors.lower().strip() == "all":
                target_sensors = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
            else:
                target_sensors = [s.strip() for s in args.sensors.split(",") if s.strip()]
        else:
            target_sensors = [args.sensor]

        if len(target_sensors) > 1 or (args.start_date and args.end_date and len(target_sensors) > 1) or args.days > 10:
            print(f"[*] Multi-Sensor / Chunked Mode: querying {target_sensors}...")
            df_fetched, meta_list = ingester.fetch_multi_sensor_range(
                bbox=settings.default_bbox,
                sensors=target_sensors,
                day_range=args.days,
                start_date=args.start_date,
                end_date=args.end_date
            )
            print(f"[+] Downloaded {len(df_fetched)} raw observations across {len(target_sensors)} sensors.")
            df_raw = df_fetched
            raw_files_created = [m.get("raw_filename") for m in meta_list if m.get("raw_filename")]
        elif args.start_date and args.end_date:
            print(f"[*] Querying historical chunks: {args.start_date} to {args.end_date}, sensor={target_sensors[0]}...")
            df_fetched, meta_list = ingester.fetch_historical_chunks(
                start_date=args.start_date,
                end_date=args.end_date,
                bbox=settings.default_bbox,
                sensor=target_sensors[0]
            )
            print(f"[+] Downloaded {len(df_fetched)} raw observations across {len(meta_list)} chunks.")
            df_raw = df_fetched
            raw_files_created = [m.get("raw_filename") for m in meta_list if m.get("raw_filename")]
        else:
            print(f"[*] Querying NASA FIRMS for region {settings.default_bbox}, sensor {target_sensors[0]}, range {args.days} days...")
            df_fetched, meta = ingester.fetch_and_archive_area(
                bbox=settings.default_bbox,
                sensor=target_sensors[0],
                day_range=args.days,
                save_raw=True
            )
            print(f"[+] Downloaded {len(df_fetched)} raw observations from NASA FIRMS.")
            if meta.get("raw_filename"):
                print(f"[+] Saved raw archive: {meta.get('raw_filename')} (SHA256: {meta.get('sha256_checksum', '')[:8]}...)")
                raw_files_created = [meta.get("raw_filename")]
            df_raw = df_fetched

    elif args.input_csv:
        print(f"[*] Loading raw FIRMS CSV from: {args.input_csv}")
        df_raw, rejected_records = ingester.load_and_validate_raw_file(args.input_csv)
        print(f"[+] Loaded {len(df_raw)} valid observations ({len(rejected_records)} rejected).")

    else:
        # Default: load active observations from SQLite DB
        from app.db.session import SessionLocal
        from app.db.db_models import RawObservationModel
        db = SessionLocal()
        try:
            records = db.query(RawObservationModel).all()
            data = []
            for obs in records:
                data.append({
                    "id": obs.id,
                    "latitude": obs.latitude,
                    "longitude": obs.longitude,
                    "brightness": obs.brightness,
                    "bright_t31": obs.bright_t31,
                    "acq_date": str(obs.acq_date),
                    "acq_time": obs.acq_time,
                    "frp": obs.frp,
                    "confidence": obs.confidence,
                    "confidence_normalized": obs.confidence_normalized,
                    "daynight": obs.daynight,
                    "satellite": obs.satellite,
                    "instrument": obs.instrument
                })
            df_raw = pd.DataFrame(data)
            print(f"[+] Loaded {len(df_raw)} observations from active SQLite storage.")
        finally:
            db.close()

    if df_raw.empty:
        print("\n[!] No observations retrieved.")
        print("[!] Please check network connection, API key, or date range.")
        print("[!] In accordance with scientific integrity, no mock observations were fabricated.\n")
        return

    # 1. Deduplication
    df_clean, duplicates_dropped = ingester.deduplicate_observations(df_raw)

    # 2. Ingestion Quality Report
    ingestion_report = ingester.generate_ingestion_quality_report(df_raw, df_clean, rejected_records, duplicates_dropped)

    # 3. Optional DB Persistence
    if args.save_db and not df_clean.empty:
        from app.db.session import SessionLocal
        from app.ingestion.firms_client import FIRMSClient
        from app.api.service import PipelineService
        db = SessionLocal()
        try:
            client = FIRMSClient()
            summary, saved = client.ingest_and_save(
                db=db,
                df=df_clean,
                source_name="CLI_HISTORICAL_INGESTION",
                sensor_name=args.sensor
            )
            print(f"[+] DB Sync: Committed {len(saved)} new records ({summary.duplicates_skipped} duplicates skipped).")
            # Invalidate in-memory caches
            PipelineService.invalidate_cache()
        finally:
            db.close()

    # 4. Spatial Enrichment & Clustering
    print("[*] Executing spatial proximity (OSM) + DBSCAN clustering + persistence analysis...")
    df_enriched = builder.process_and_enrich_observations(df_clean)

    # 5. Split and Save Datasets
    df_labeled, df_unlabeled = builder.split_and_save_datasets(df_enriched)

    # 6. ML Dataset Export
    if args.export_ml or not df_labeled.empty:
        manifest = builder.export_ml_splits(df_labeled)
        print(f"[+] Exported clean ML splits to data/ml/ (status: {manifest.get('status')})")

    # 7. ML Readiness Assessment
    readiness = MLReadinessEvaluator.evaluate(df_labeled)

    # 8. Conditional ML Training (Only if readiness is valid)
    train_report = {}
    if args.train_ml:
        print(f"[*] ML Readiness Evaluation: {readiness['status']} — {readiness['reason']}")
        if readiness.get("status") != "NOT_READY" and not df_labeled.empty:
            X, y, groups, _ = builder.generate_feature_matrices(df_labeled)
            trainer = ProductionMLTrainer()
            train_report = trainer.train_and_persist(X, y, groups, readiness, model_type=args.model_type)
            print(f"[+] Model Training Completed: {train_report.get('training_status')} ({train_report.get('model_type')})")
        else:
            trainer = ProductionMLTrainer()
            train_report = trainer.train_and_persist(np.empty((0, 9)), np.array([]), np.array([]), readiness)
            print(f"[+] MODEL TRAINING SKIPPED — SCIENTIFICALLY CORRECT: {train_report.get('reason')}")

    # 9. Quality & Provenance Report
    report = builder.generate_quality_report(df_raw, df_enriched, duplicates_dropped)

    # Structured Data Audit Output
    print("\n" + "=" * 80)
    print("                    DATASET AUDIT & INGESTION REPORT")
    print("=" * 80)
    print(f" RAW RECORDS DOWNLOADED:            {ingestion_report['total_downloaded']}")
    print(f" UNIQUE RECORDS:                    {ingestion_report['retained_observations']}")
    print(f" DUPLICATES REMOVED:                {ingestion_report['duplicates_removed']}")
    print("-" * 80)
    print(" SENSORS:")
    for s_name, count in ingestion_report['sensor_breakdown'].items():
        print(f"   - {s_name:30s}: {count:4d}")
    print("-" * 80)
    print(" DATE RANGE:")
    print(f"   - EARLIEST OBSERVATION:          {report['date_range']['start']}")
    print(f"   - LATEST OBSERVATION:            {report['date_range']['end']}")
    print("-" * 80)
    print(" GEOGRAPHIC COVERAGE:")
    geo = ingestion_report.get("geographic_coverage", {})
    print(f"   - Latitude Range:                {geo.get('min_lat')} to {geo.get('max_lat')}")
    print(f"   - Longitude Range:               {geo.get('min_lon')} to {geo.get('max_lon')}")
    print(f"   - Bounding Box:                  {settings.default_bbox}")
    print("-" * 80)
    print(f" RAW FILES CREATED:                 {len(raw_files_created)}")
    for rf in raw_files_created[:5]:
        print(f"   - {rf}")
    if len(raw_files_created) > 5:
        print(f"   ... and {len(raw_files_created) - 5} more")

    print("\n" + "=" * 80)
    print("                     GROUND TRUTH & SPATIAL AUDIT")
    print("=" * 80)
    print(f" VERIFIED OBSERVATIONS:             {report['labeled_observations']}")
    print(f" UNLABELED OBSERVATIONS:            {report['unlabeled_observations']}")
    print("-" * 80)
    print(" CLASS DISTRIBUTION:")
    for cls_name, count in report['class_distribution'].items():
        print(f"   - {cls_name:30s}: {count:4d}")
    print("-" * 80)
    print(" SPATIAL BREAKDOWN:")
    print(f"   - Physical DBSCAN Clusters:      {report['total_physical_clusters']}")
    print(f"   - Industrial Proximity (<=1km):  {report['observations_near_industry_le_1km']}")
    print(f"   - Rural / Agrarian (>1km):       {report['observations_rural_gt_1km']}")

    print("\n" + "=" * 80)
    print("                      MACHINE LEARNING READINESS")
    print("=" * 80)
    print(f" ML STATUS:                         {readiness['status']}")
    print(f" SCIENTIFIC REASONING:              {readiness['reason']}")
    print(f" CLASSES REPRESENTED:               {readiness.get('classes_present', 0)}")
    print(f" SPATIAL GROUPS COUNT:              {readiness.get('spatial_groups_count', 0)}")
    print(f" RECOMMENDATION:                    {readiness.get('recommendation')}")
    if train_report and train_report.get("training_status") == "SUCCESS":
        print("-" * 80)
        print(" VALIDATED MODEL METRICS (Spatial GroupKFold):")
        m = train_report.get("metrics", {})
        print(f"   - Model:                         {train_report.get('model_type')}")
        print(f"   - Accuracy:                      {m.get('accuracy')}")
        print(f"   - Weighted Precision:            {m.get('weighted_precision')}")
        print(f"   - Weighted Recall:               {m.get('weighted_recall')}")
        print(f"   - Weighted F1:                   {m.get('weighted_f1')}")
        print(f"   - Cluster Overlap:               {m.get('cluster_overlap_verified', 0)}")
    print("=" * 80)

    # Print comparison table
    print_comparison_table()


if __name__ == "__main__":
    main()
