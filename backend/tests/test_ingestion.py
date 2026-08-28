import os
import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.db_models import RawObservationModel
from app.models.schemas import RawObservationCreate
from app.ingestion.validator import ObservationValidator
from app.ingestion.firms_client import FIRMSClient


# Setup an in-memory SQLite database for isolated test execution
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session():
    """Provides a clean in-memory database session for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


def test_valid_observation_schema():
    """Test that a standard valid VIIRS record parses correctly."""
    valid_data = {
        "latitude": 22.4707,
        "longitude": 70.0577,
        "brightness": 348.5,
        "scan": 0.38,
        "track": 0.36,
        "acq_date": "2026-08-24",
        "acq_time": "0830",
        "satellite": "N",
        "instrument": "VIIRS",
        "confidence": "high",
        "frp": 14.2,
        "daynight": "D"
    }
    model = RawObservationCreate(**valid_data)
    assert model.latitude == 22.4707
    assert model.longitude == 70.0577
    assert model.confidence == "high"
    assert model.confidence_normalized == 0.9
    assert model.frp == 14.2
    assert model.daynight == "D"


def test_alternate_column_normalization():
    """Test that VIIRS 'bright_ti4' and numeric confidence percentages normalize properly."""
    raw_data = {
        "latitude": 21.6834,
        "longitude": 72.5692,
        "bright_ti4": 365.2,
        "bright_ti5": 302.1,
        "acq_date": "2026-08-24",
        "acq_time": "820",  # 3-char time string that should be padded to 0820
        "satellite": "1",
        "confidence": "95",  # MODIS-style numeric confidence
        "frp": 32.5,
        "daynight": "day"
    }
    model = RawObservationCreate(**raw_data)
    assert model.brightness == 365.2
    assert model.bright_t31 == 302.1
    assert model.acq_time == "0820"
    assert model.confidence == "high"
    assert model.confidence_normalized == 0.95
    assert model.daynight == "D"


def test_invalid_coordinates_rejected():
    """Test that out-of-bounds latitudes (>90 or <-90) are rejected."""
    invalid_data = {
        "latitude": 95.0,  # Invalid latitude
        "longitude": 70.0,
        "brightness": 330.0,
        "acq_date": "2026-08-24",
        "acq_time": "1200",
        "satellite": "N",
        "confidence": "nominal",
        "frp": 10.0
    }
    is_valid, model, err = ObservationValidator.validate_single_record(invalid_data)
    assert is_valid is False
    assert model is None
    assert "latitude" in err.lower()


def test_batch_validation_and_db_ingestion(db_session):
    """Test full batch ingestion from sample CSV into database."""
    client = FIRMSClient()
    sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "sample_firms_india.csv")
    
    assert os.path.exists(sample_path), f"Sample CSV missing at {sample_path}"
    
    df = client.load_from_csv(sample_path)
    summary, saved_records = client.ingest_and_save(
        db=db_session,
        df=df,
        source_name="SAMPLE_CSV_TEST",
        sensor_name="VIIRS_SNPP"
    )

    assert summary.total_received == len(df)
    assert summary.valid_records == len(df)
    assert summary.rejected_records == 0
    assert len(saved_records) == len(df)

    # Verify records in database
    db_rows = db_session.query(RawObservationModel).all()
    assert len(db_rows) == len(df)
    assert db_rows[0].latitude == 22.4707
    assert db_rows[0].frp == 14.2

    # Second ingestion of the identical dataset must be idempotent (0 new, 15 skipped)
    summary_2, saved_records_2 = client.ingest_and_save(
        db=db_session,
        df=df,
        source_name="SAMPLE_CSV_TEST_SECOND_RUN",
        sensor_name="VIIRS_SNPP"
    )
    assert summary_2.valid_records == 0
    assert summary_2.duplicates_skipped == len(df)
    assert len(saved_records_2) == 0

    # Total rows in DB must still be exactly len(df)
    total_db_rows_after = db_session.query(RawObservationModel).count()
    assert total_db_rows_after == len(df)
