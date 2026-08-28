import os
import io
import json
import time
import hashlib
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
import httpx
import pandas as pd

from app.core.config import settings
from app.core.logging import logger
from app.ingestion.validator import ObservationValidator
from app.models.schemas import RawObservationCreate


AVAILABLE_SENSORS = [
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "VIIRS_NOAA21_NRT",
    "MODIS_NRT"
]


class HistoricalFIRMSIngester:
    """
    Production-grade NASA FIRMS historical ingestion & raw archive client.
    Supports multi-sensor queries, automatic 5-day date chunking, structured YYYY/MM raw archiving,
    SHA256 integrity hashing, composite natural key deduplication, and detailed quality reporting.
    """

    def __init__(
        self,
        raw_storage_dir: Optional[str] = None,
        map_key: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        if raw_storage_dir:
            self.raw_base_dir = Path(raw_storage_dir)
        else:
            p1 = Path(__file__).resolve().parent.parent.parent / "data" / "raw" / "firms"
            p2 = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw" / "firms"
            self.raw_base_dir = p1 if p1.exists() else p2
        
        self.raw_base_dir.mkdir(parents=True, exist_ok=True)
        self.map_key = map_key or settings.FIRMS_MAP_KEY
        self.base_url = (base_url or settings.FIRMS_BASE_URL).rstrip("/")
        self.validator = ObservationValidator()

    def _get_archive_dir(self, dt: Optional[datetime] = None) -> Path:
        """Returns structured data/raw/firms/YYYY/MM directory."""
        dt = dt or datetime.utcnow()
        year_str = dt.strftime("%Y")
        month_str = dt.strftime("%m")
        archive_dir = self.raw_base_dir / year_str / month_str
        archive_dir.mkdir(parents=True, exist_ok=True)
        return archive_dir

    def verify_api_availability(self) -> Dict[str, Any]:
        """
        Pre-flight check verifying FIRMS API connectivity and MAP_KEY status.
        """
        if not self.map_key or self.map_key == "demo_key_or_offline":
            return {
                "available": False,
                "reason": "Invalid or demo FIRMS_MAP_KEY configured",
                "map_key_set": False
            }
        
        test_url = f"{self.base_url}/area/csv/{self.map_key}/VIIRS_SNPP_NRT/69,20,74,24.5/1"
        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(test_url)
                if res.status_code == 200:
                    return {
                        "available": True,
                        "status_code": 200,
                        "base_url": self.base_url,
                        "sensors_supported": AVAILABLE_SENSORS
                    }
                else:
                    return {
                        "available": False,
                        "status_code": res.status_code,
                        "reason": f"HTTP {res.status_code}: {res.text[:150]}"
                    }
        except Exception as e:
            return {
                "available": False,
                "reason": f"Connection error: {str(e)}"
            }

    def fetch_and_archive_area(
        self,
        bbox: Optional[List[float]] = None,
        sensor: str = settings.DEFAULT_SENSOR,
        day_range: int = 5,
        target_date: Optional[str] = None,
        save_raw: bool = True
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Fetches FIRMS data for a bounding box [min_lon, min_lat, max_lon, max_lat],
        supporting optional target_date for historical queries (day_range 1..5 for date queries, 1..10 for NRT).
        Saves immutable raw CSV + JSON metadata sidecar with SHA-256 hash.
        """
        bbox = bbox or settings.default_bbox
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        
        if target_date:
            day_range = max(1, min(day_range, 5))
            endpoint = f"{self.base_url}/area/csv/{self.map_key}/{sensor}/{bbox_str}/{day_range}/{target_date}"
        else:
            day_range = max(1, min(day_range, 5))
            endpoint = f"{self.base_url}/area/csv/{self.map_key}/{sensor}/{bbox_str}/{day_range}"

        logger.info(f"FIRMS area query: sensor={sensor}, bbox={bbox_str}, days={day_range}, date={target_date}")
        
        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.get(endpoint)
                response.raise_for_status()
                raw_text = response.text.strip()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from NASA FIRMS ({e.response.status_code}): {e.response.text[:200]}")
            return pd.DataFrame(), {
                "status": f"HTTP_ERROR_{e.response.status_code}",
                "record_count": 0,
                "sensor": sensor,
                "error": e.response.text[:200]
            }
        except Exception as e:
            logger.error(f"Failed to fetch FIRMS data from NASA API: {e}")
            return pd.DataFrame(), {
                "status": "CONNECTION_ERROR",
                "record_count": 0,
                "sensor": sensor,
                "error": str(e)
            }

        if not raw_text or "latitude" not in raw_text.lower():
            logger.warning(f"NASA FIRMS returned empty or non-data response for {sensor} (date={target_date}).")
            return pd.DataFrame(), {
                "status": "EMPTY_RESPONSE",
                "record_count": 0,
                "sensor": sensor,
                "request_url": endpoint
            }

        try:
            df_raw = pd.read_csv(io.StringIO(raw_text))
        except Exception as e:
            logger.error(f"Failed to parse CSV response from FIRMS: {e}")
            return pd.DataFrame(), {"status": "PARSE_ERROR", "record_count": 0, "sensor": sensor}

        # Calculate SHA256 checksum of raw response
        sha256_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
        
        now = datetime.utcnow()
        archive_dir = self._get_archive_dir(now)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        date_slug = target_date.replace("-", "") if target_date else "nrt"
        slug = f"{sensor}_{bbox[0]:.1f}_{bbox[1]:.1f}_{bbox[2]:.1f}_{bbox[3]:.1f}_{date_slug}_{timestamp_str}"
        raw_csv_path = archive_dir / f"{slug}.csv"
        meta_path = archive_dir / f"{slug}.meta.json"

        # Guarantee no overwrite
        counter = 1
        while raw_csv_path.exists() or meta_path.exists():
            raw_csv_path = archive_dir / f"{slug}_{counter}.csv"
            meta_path = archive_dir / f"{slug}_{counter}.meta.json"
            counter += 1

        metadata = {
            "source": "NASA_FIRMS_API",
            "source_url": endpoint,
            "sensor": sensor,
            "bbox": bbox,
            "day_range": day_range,
            "target_date": target_date,
            "download_timestamp_utc": now.isoformat(),
            "raw_filename": raw_csv_path.name,
            "raw_filepath": str(raw_csv_path),
            "raw_record_count": len(df_raw),
            "sha256_checksum": sha256_hash,
            "columns": list(df_raw.columns),
            "retrieval_status": "SUCCESS"
        }

        if save_raw:
            raw_csv_path.write_text(raw_text, encoding="utf-8")
            meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            logger.info(f"Immutably archived raw FIRMS payload: {raw_csv_path.name} ({len(df_raw)} records, SHA: {sha256_hash[:8]}...)")

        return df_raw, metadata

    def fetch_historical_chunks(
        self,
        start_date: str,
        end_date: str,
        bbox: Optional[List[float]] = None,
        sensor: str = settings.DEFAULT_SENSOR
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Slices an arbitrary historical date range [start_date, end_date] into sequential 5-day chunks,
        queries FIRMS for each chunk, and aggregates the resulting raw observations.
        """
        d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        if d_start > d_end:
            raise ValueError(f"start_date ({start_date}) cannot be after end_date ({end_date})")

        all_dfs = []
        all_meta = []
        curr = d_start

        while curr <= d_end:
            chunk_days = min(5, (d_end - curr).days + 1)
            date_str = curr.strftime("%Y-%m-%d")
            
            logger.info(f"Fetching historical chunk: date={date_str}, days={chunk_days}, sensor={sensor}")
            df_chunk, meta_chunk = self.fetch_and_archive_area(
                bbox=bbox,
                sensor=sensor,
                day_range=chunk_days,
                target_date=date_str,
                save_raw=True
            )

            if not df_chunk.empty:
                df_chunk["_sensor_source"] = sensor
                all_dfs.append(df_chunk)
            all_meta.append(meta_chunk)

            curr += timedelta(days=chunk_days)

        if not all_dfs:
            return pd.DataFrame(), all_meta

        combined_df = pd.concat(all_dfs, ignore_index=True)
        return combined_df, all_meta

    def fetch_multi_sensor_range(
        self,
        bbox: Optional[List[float]] = None,
        sensors: Optional[List[str]] = None,
        day_range: int = 5,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Fetches and aggregates observations across multiple satellite platforms (e.g. SNPP + NOAA-20 + MODIS).
        """
        sensors = sensors or ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]
        all_dfs = []
        all_meta = []

        for sensor in sensors:
            try:
                if start_date and end_date:
                    df_s, meta_s = self.fetch_historical_chunks(
                        start_date=start_date,
                        end_date=end_date,
                        bbox=bbox,
                        sensor=sensor
                    )
                elif day_range > 5:
                    today_d = date.today()
                    start_d = today_d - timedelta(days=day_range - 1)
                    df_s, meta_s = self.fetch_historical_chunks(
                        start_date=start_d.strftime("%Y-%m-%d"),
                        end_date=today_d.strftime("%Y-%m-%d"),
                        bbox=bbox,
                        sensor=sensor
                    )
                else:
                    df_s, meta_s_single = self.fetch_and_archive_area(
                        bbox=bbox,
                        sensor=sensor,
                        day_range=day_range,
                        save_raw=True
                    )
                    meta_s = [meta_s_single]

                if not df_s.empty:
                    df_s["_sensor_source"] = sensor
                    all_dfs.append(df_s)
                all_meta.extend(meta_s)
            except Exception as e:
                logger.warning(f"Multi-sensor query for {sensor} encountered error: {e}")

        if not all_dfs:
            return pd.DataFrame(), all_meta

        combined_df = pd.concat(all_dfs, ignore_index=True)
        return combined_df, all_meta

    def load_and_validate_raw_file(self, filepath: str) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Loads an existing raw FIRMS CSV file from disk, normalizes columns,
        and validates physical bounds via ObservationValidator.
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Raw FIRMS file not found: {filepath}")

        df = pd.read_csv(path)
        valid_models, rejected = self.validator.validate_dataframe(df)

        valid_dicts = [m.model_dump() for m in valid_models]
        df_valid = pd.DataFrame(valid_dicts)
        return df_valid, rejected

    def deduplicate_observations(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, int]:
        """
        Deduplicates observations using composite natural key:
        (round(latitude, 4), round(longitude, 4), acq_date, str(acq_time), str(satellite))
        Two nearby detections from different satellite instruments or distinct times are preserved.
        """
        if df.empty:
            return df, 0

        initial_count = len(df)
        df_dedup = df.copy()
        
        # Build normalized deduplication key
        df_dedup["_lat_round"] = df_dedup["latitude"].round(4)
        df_dedup["_lon_round"] = df_dedup["longitude"].round(4)
        df_dedup["_date_str"] = df_dedup["acq_date"].astype(str)
        df_dedup["_time_str"] = df_dedup["acq_time"].astype(str).str.zfill(4)
        sat_col = df_dedup["satellite"] if "satellite" in df_dedup.columns else "N"
        df_dedup["_sat_str"] = sat_col.astype(str)

        key_cols = ["_lat_round", "_lon_round", "_date_str", "_time_str", "_sat_str"]
        df_dedup = df_dedup.drop_duplicates(subset=key_cols, keep="first")
        
        df_dedup = df_dedup.drop(columns=[c for c in key_cols if c in df_dedup.columns])
        dropped_count = initial_count - len(df_dedup)
        
        logger.info(f"Deduplication: {initial_count} -> {len(df_dedup)} records ({dropped_count} duplicates dropped).")
        return df_dedup, dropped_count

    def generate_ingestion_quality_report(
        self,
        df_raw: pd.DataFrame,
        df_clean: pd.DataFrame,
        rejected_records: List[Dict[str, Any]],
        duplicates_dropped: int
    ) -> Dict[str, Any]:
        """
        Produces an Ingestion Quality Report summarizing:
        total downloaded, duplicates removed, retained observations, invalid records,
        sensor breakdown, and temporal/spatial coverage.
        """
        total_downloaded = len(df_raw) if not df_raw.empty else 0
        retained = len(df_clean) if not df_clean.empty else 0
        invalid_count = len(rejected_records)

        sensor_breakdown = {}
        if not df_clean.empty and "satellite" in df_clean.columns:
            sensor_breakdown = df_clean["satellite"].value_counts().to_dict()
            sensor_breakdown = {str(k): int(v) for k, v in sensor_breakdown.items()}

        dates = sorted(df_clean["acq_date"].astype(str).unique().tolist()) if not df_clean.empty and "acq_date" in df_clean.columns else []
        temporal_coverage = {
            "start_date": dates[0] if dates else None,
            "end_date": dates[-1] if dates else None,
            "unique_days_count": len(dates)
        }

        geographic_coverage = {
            "min_lat": round(float(df_clean["latitude"].min()), 4) if not df_clean.empty else None,
            "max_lat": round(float(df_clean["latitude"].max()), 4) if not df_clean.empty else None,
            "min_lon": round(float(df_clean["longitude"].min()), 4) if not df_clean.empty else None,
            "max_lon": round(float(df_clean["longitude"].max()), 4) if not df_clean.empty else None
        }

        return {
            "total_downloaded": total_downloaded,
            "duplicates_removed": duplicates_dropped,
            "retained_observations": retained,
            "invalid_records": invalid_count,
            "sensor_breakdown": sensor_breakdown,
            "temporal_coverage": temporal_coverage,
            "geographic_coverage": geographic_coverage,
            "generation_timestamp_utc": datetime.utcnow().isoformat()
        }
