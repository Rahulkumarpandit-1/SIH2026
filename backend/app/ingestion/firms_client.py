import os
import time
import io
from typing import List, Optional, Tuple, Dict, Any
import httpx
import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.schemas import RawObservationCreate, IngestionSummary
from app.db.db_models import RawObservationModel
from app.ingestion.validator import ObservationValidator


class FIRMSClient:
    """
    Client for interacting with the NASA FIRMS (Fire Information for Resource Management System) API.
    Supports near-real-time ingestion, area queries, country queries, local file parsing, and DB persistence.
    """

    def __init__(self, map_key: Optional[str] = None, base_url: Optional[str] = None):
        self.map_key = map_key or settings.FIRMS_MAP_KEY
        self.base_url = (base_url or settings.FIRMS_BASE_URL).rstrip("/")
        self.validator = ObservationValidator()

    def fetch_area_csv(
        self,
        bbox: Optional[List[float]] = None,
        sensor: str = settings.DEFAULT_SENSOR,
        day_range: int = settings.DEFAULT_DAY_RANGE
    ) -> pd.DataFrame:
        """
        Fetches FIRMS NRT data for a specified bounding box [min_lon, min_lat, max_lon, max_lat].
        URL format: https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SENSOR]/[W,S,E,N]/[DAY_RANGE]
        """
        bbox = bbox or settings.default_bbox
        if len(bbox) != 4:
            raise ValueError("Bounding box must contain exactly 4 values: [min_lon, min_lat, max_lon, max_lat]")
        
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        day_range = max(1, min(day_range, 10))  # FIRMS allows 1 to 10 days for NRT
        
        endpoint = f"{self.base_url}/area/csv/{self.map_key}/{sensor}/{bbox_str}/{day_range}"
        logger.info(f"Querying NASA FIRMS Area API: sensor={sensor}, bbox={bbox_str}, days={day_range}")
        
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(endpoint)
                response.raise_for_status()
                
                content = response.text.strip()
                if not content or "latitude" not in content.lower():
                    logger.warning(f"FIRMS returned empty or non-CSV response: {content[:200]}")
                    return pd.DataFrame()
                
                df = pd.read_csv(io.StringIO(content))
                logger.info(f"Successfully retrieved {len(df)} rows from NASA FIRMS API.")
                return df
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching FIRMS data: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error connecting to FIRMS API: {str(e)}")
            raise

    def fetch_country_csv(
        self,
        country_code: str = "IND",
        sensor: str = settings.DEFAULT_SENSOR,
        day_range: int = settings.DEFAULT_DAY_RANGE
    ) -> pd.DataFrame:
        """
        Fetches FIRMS NRT data for a 3-letter ISO country code (e.g., 'IND' for India).
        URL format: https://firms.modaps.eosdis.nasa.gov/api/country/csv/[MAP_KEY]/[SENSOR]/[COUNTRY]/[DAY_RANGE]
        """
        day_range = max(1, min(day_range, 10))
        endpoint = f"{self.base_url}/country/csv/{self.map_key}/{sensor}/{country_code}/{day_range}"
        logger.info(f"Querying NASA FIRMS Country API: country={country_code}, sensor={sensor}, days={day_range}")
        
        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.get(endpoint)
                response.raise_for_status()
                
                content = response.text.strip()
                if not content or "latitude" not in content.lower():
                    logger.warning(f"FIRMS returned empty or non-CSV response: {content[:200]}")
                    return pd.DataFrame()
                
                df = pd.read_csv(io.StringIO(content))
                logger.info(f"Successfully retrieved {len(df)} rows for country {country_code}.")
                return df
        except Exception as e:
            logger.error(f"Error fetching country FIRMS data: {str(e)}")
            raise

    def load_from_csv(self, filepath: str) -> pd.DataFrame:
        """Loads FIRMS observations from a local CSV file."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"FIRMS CSV file not found at: {filepath}")
        
        logger.info(f"Loading FIRMS data from local file: {filepath}")
        df = pd.read_csv(filepath)
        logger.info(f"Loaded {len(df)} records from {filepath}")
        return df

    def ingest_and_save(
        self,
        db: Session,
        df: pd.DataFrame,
        source_name: str = "NASA_FIRMS_NRT_STREAM",
        sensor_name: str = "VIIRS",
        stream_type: str = "near_real_time"
    ) -> Tuple[IngestionSummary, List[RawObservationModel]]:
        """
        Validates DataFrame records, deduplicates against existing records in DB,
        and saves only new unseen observations (idempotent ingestion).
        """
        start_time = time.time()
        valid_models, rejected = self.validator.validate_dataframe(df)

        if not valid_models:
            summary = IngestionSummary(
                source=source_name,
                total_received=len(df),
                valid_records=0,
                rejected_records=len(rejected),
                duplicates_skipped=0,
                sensor=sensor_name,
                execution_time_seconds=round(time.time() - start_time, 3)
            )
            return summary, []

        dates = [m.acq_date for m in valid_models]
        min_date, max_date = min(dates), max(dates)

        # Query existing natural keys in this date range to prevent duplicate inserts
        existing_rows = db.query(
            RawObservationModel.latitude,
            RawObservationModel.longitude,
            RawObservationModel.acq_date,
            RawObservationModel.acq_time,
            RawObservationModel.satellite
        ).filter(
            RawObservationModel.acq_date >= min_date,
            RawObservationModel.acq_date <= max_date
        ).all()

        existing_keys = {
            (round(r[0], 4), round(r[1], 4), r[2], str(r[3]), str(r[4]))
            for r in existing_rows
        }

        # Filter out duplicates (both inter-batch and intra-batch)
        new_models: List[RawObservationCreate] = []
        duplicates_skipped = 0

        for vm in valid_models:
            key = (round(vm.latitude, 4), round(vm.longitude, 4), vm.acq_date, str(vm.acq_time), str(vm.satellite))
            if key in existing_keys:
                duplicates_skipped += 1
            else:
                new_models.append(vm)
                existing_keys.add(key)

        db_records: List[RawObservationModel] = []
        for vm in new_models:
            db_record = RawObservationModel(
                latitude=vm.latitude,
                longitude=vm.longitude,
                brightness=vm.brightness,
                scan=vm.scan,
                track=vm.track,
                acq_date=vm.acq_date,
                acq_time=vm.acq_time,
                satellite=vm.satellite,
                instrument=vm.instrument,
                confidence=vm.confidence,
                confidence_normalized=vm.confidence_normalized,
                version=vm.version,
                bright_t31=vm.bright_t31,
                frp=vm.frp,
                daynight=vm.daynight,
                stream_type=stream_type
            )
            db_records.append(db_record)

        if db_records:
            try:
                db.add_all(db_records)
                db.commit()
                logger.info(f"Successfully committed {len(db_records)} new records to database ({duplicates_skipped} duplicates skipped, stream={stream_type}).")
            except Exception as e:
                db.rollback()
                logger.error(f"Database error during batch insert: {str(e)}")
                raise
        else:
            logger.info(f"No new records to commit. All {duplicates_skipped} records were duplicates already present in database.")

        summary = IngestionSummary(
            source=source_name,
            total_received=len(df),
            valid_records=len(db_records),
            rejected_records=len(rejected),
            duplicates_skipped=duplicates_skipped,
            sensor=sensor_name,
            date_range_start=min_date if dates else None,
            date_range_end=max_date if dates else None,
            execution_time_seconds=round(time.time() - start_time, 3)
        )

        return summary, db_records
