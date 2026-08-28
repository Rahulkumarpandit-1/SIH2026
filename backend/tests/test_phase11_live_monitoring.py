import pytest
import pandas as pd
from datetime import date, datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.db.db_models import RawObservationModel
from app.ingestion.firms_client import FIRMSClient
from app.api.service import PipelineService
from app.models.schemas import DataRefreshRequest


@pytest.fixture
def test_db_session():
    """Shared In-memory SQLite database session with StaticPool for FastAPI test client."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    # Prepopulate with 2 test observations
    obs1 = RawObservationModel(
        latitude=21.685,
        longitude=72.585,
        brightness=340.5,
        scan=0.375,
        track=0.375,
        acq_date=date(2026, 8, 20),
        acq_time="1130",
        satellite="N21",
        instrument="VIIRS",
        confidence="high",
        confidence_normalized=0.9,
        version="NRT",
        bright_t31=298.0,
        frp=25.0,
        daynight="D",
        stream_type="historical"
    )
    obs2 = RawObservationModel(
        latitude=21.115,
        longitude=72.685,
        brightness=365.2,
        scan=0.375,
        track=0.375,
        acq_date=date(2026, 8, 28),
        acq_time="0845",
        satellite="SNPP",
        instrument="VIIRS",
        confidence="high",
        confidence_normalized=0.95,
        version="NRT",
        bright_t31=302.0,
        frp=65.0,
        daynight="D",
        stream_type="near_real_time"
    )
    db.add_all([obs1, obs2])
    db.commit()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    PipelineService.invalidate_cache()

    yield db

    app.dependency_overrides.clear()
    PipelineService.invalidate_cache()
    db.close()


def test_get_refresh_status_endpoint():
    """Verifies that GET /api/data/refresh/status returns correct operational fields."""
    client = TestClient(app)
    response = client.get("/api/data/refresh/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["IDLE", "RUNNING", "SUCCESS", "FAILED"]
    assert "next_scheduled_refresh" in data
    assert "refresh_interval_minutes" in data
    assert data["refresh_interval_minutes"] >= 1


def test_summary_metrics_dynamic_live_fields(test_db_session):
    """Verifies that GET /api/summary returns dynamic near-real-time fields and stream breakdown."""
    client = TestClient(app)
    response = client.get("/api/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["monitoring_mode"] == "NEAR_REAL_TIME"
    assert data["total_observations"] == 2
    assert data["live_observations_count"] == 1
    assert data["historical_observations_count"] == 1
    assert "last_data_update" in data
    assert "next_refresh_time" in data


def test_observations_stream_type_filtering(test_db_session):
    """Verifies that GET /api/observations supports stream_type filtering."""
    client = TestClient(app)

    # All records
    res_all = client.get("/api/observations")
    assert res_all.status_code == 200
    assert len(res_all.json()) == 2

    # Near-real-time records only
    res_live = client.get("/api/observations?stream_type=near_real_time")
    assert res_live.status_code == 200
    live_list = res_live.json()
    assert len(live_list) == 1
    assert live_list[0]["stream_type"] == "near_real_time"

    # Historical records only
    res_hist = client.get("/api/observations?stream_type=historical")
    assert res_hist.status_code == 200
    hist_list = res_hist.json()
    assert len(hist_list) == 1
    assert hist_list[0]["stream_type"] == "historical"


def test_firms_client_ingest_and_save_stream_tagging(test_db_session):
    """Verifies that FIRMSClient accurately persists stream_type and skips duplicates."""
    client = FIRMSClient()
    df_new = pd.DataFrame([
        {
            "latitude": 22.25,
            "longitude": 71.19,
            "brightness": 350.0,
            "scan": 0.375,
            "track": 0.375,
            "acq_date": "2026-08-28",
            "acq_time": "1200",
            "satellite": "N20",
            "instrument": "VIIRS",
            "confidence": "high",
            "version": "NRT",
            "bright_t31": 300.0,
            "frp": 35.0,
            "daynight": "D"
        }
    ])

    summary, records = client.ingest_and_save(
        db=test_db_session,
        df=df_new,
        source_name="TEST_NRT_FEED",
        sensor_name="VIIRS_NOAA20_NRT",
        stream_type="near_real_time"
    )

    assert summary.valid_records == 1
    assert summary.duplicates_skipped == 0
    assert len(records) == 1
    assert records[0].stream_type == "near_real_time"

    # Ingesting the same dataframe again should skip duplicate
    summary2, records2 = client.ingest_and_save(
        db=test_db_session,
        df=df_new,
        source_name="TEST_NRT_FEED",
        sensor_name="VIIRS_NOAA20_NRT",
        stream_type="near_real_time"
    )
    assert summary2.valid_records == 0
    assert summary2.duplicates_skipped == 1
    assert len(records2) == 0


def test_refresh_job_locking_concurrent_prevention(test_db_session):
    """Verifies that concurrent calls to refresh_firms_data are rejected by mutex lock."""
    # Acquire lock manually to simulate active job
    acquired = PipelineService._refresh_lock.acquire(blocking=False)
    assert acquired is True

    try:
        req = DataRefreshRequest(days=1, sensor="VIIRS_SNPP_NRT")
        # Attempting refresh while lock is held must raise HTTPException 409
        with pytest.raises(Exception) as exc_info:
            PipelineService.refresh_firms_data(req, test_db_session)
        assert "409" in str(exc_info.value) or "already" in str(exc_info.value).lower()
    finally:
        PipelineService._refresh_lock.release()
