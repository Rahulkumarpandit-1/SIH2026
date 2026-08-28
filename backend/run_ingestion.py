import os
import sys
from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.ingestion.firms_client import FIRMSClient
from app.db.db_models import RawObservationModel

def main():
    """Main execution entry point for testing Phase 1 ingestion."""
    print("=" * 70)
    print("SIH26162 — PHASE 1: NASA FIRMS INGESTION & VALIDATION RUNNER")
    print("=" * 70)

    # 1. Initialize SQLite tables
    init_db()

    client = FIRMSClient()
    db = SessionLocal()

    try:
        sample_path = os.path.join(os.path.dirname(__file__), "data", "raw", "sample_firms_india.csv")
        
        # Check if user has provided a real NASA FIRMS API key
        if settings.FIRMS_MAP_KEY and settings.FIRMS_MAP_KEY != "demo_key_or_offline":
            logger.info("Live NASA FIRMS MAP_KEY detected. Fetching live satellite thermal data...")
            df = client.fetch_area_csv()
            source_name = "NASA_FIRMS_LIVE_API"
        else:
            logger.info(f"Using verified sample satellite dataset from: {sample_path}")
            df = client.load_from_csv(sample_path)
            source_name = "SAMPLE_FIRMS_GUJARAT_DATASET"

        summary, records = client.ingest_and_save(
            db=db,
            df=df,
            source_name=source_name,
            sensor_name=settings.DEFAULT_SENSOR
        )

        print("\n" + "=" * 70)
        print("INGESTION SUMMARY REPORT")
        print("=" * 70)
        print(f"Data Source         : {summary.source}")
        print(f"Sensor Platform     : {summary.sensor}")
        print(f"Total Rows Received : {summary.total_received}")
        print(f"Valid Records Saved : {summary.valid_records}")
        print(f"Duplicates Skipped  : {summary.duplicates_skipped}")
        print(f"Rejected Records    : {summary.rejected_records}")
        print(f"Date Coverage       : {summary.date_range_start} to {summary.date_range_end}")
        print(f"Execution Time      : {summary.execution_time_seconds:.3f} seconds")
        print("=" * 70)

        # Print first 5 database rows as verification table
        all_obs = db.query(RawObservationModel).limit(5).all()
        print("\nSAMPLE PERSISTED OBSERVATIONS (First 5 records in SQLite):")
        print(f"{'ID':<4} | {'Lat':<8} | {'Lon':<8} | {'Date':<10} | {'Time':<5} | {'Bright(K)':<9} | {'FRP(MW)':<8} | {'Conf':<8} | {'Day/Night'}")
        print("-" * 80)
        for obs in all_obs:
            print(f"{obs.id:<4} | {obs.latitude:<8.4f} | {obs.longitude:<8.4f} | {str(obs.acq_date):<10} | {obs.acq_time:<5} | {obs.brightness:<9.1f} | {obs.frp:<8.1f} | {obs.confidence:<8} | {obs.daynight}")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    main()
