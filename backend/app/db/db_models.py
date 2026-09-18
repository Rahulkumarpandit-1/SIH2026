from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Index, UniqueConstraint
from app.db.session import Base


class RawObservationModel(Base):
    """Database table to persist all validated satellite thermal observations."""
    
    __tablename__ = "raw_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    brightness = Column(Float, nullable=False)
    scan = Column(Float, nullable=True, default=0.375)
    track = Column(Float, nullable=True, default=0.375)
    acq_date = Column(Date, nullable=False, index=True)
    acq_time = Column(String(4), nullable=False)
    satellite = Column(String(10), nullable=False)
    instrument = Column(String(10), nullable=False, default="VIIRS")
    confidence = Column(String(20), nullable=False)
    confidence_normalized = Column(Float, nullable=False, default=0.5)
    version = Column(String(20), nullable=True, default="NRT")
    bright_t31 = Column(Float, nullable=True)
    frp = Column(Float, nullable=False, default=0.0)
    daynight = Column(String(1), nullable=False, default="N")
    stream_type = Column(String(20), default="historical", nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Composite indexes and natural key unique constraint to prevent duplicate observations
    __table_args__ = (
        UniqueConstraint(
            "latitude", "longitude", "acq_date", "acq_time", "satellite", 
            name="uq_satellite_observation"
        ),
        Index("idx_spatial_coords", "latitude", "longitude"),
        Index("idx_temporal_spatial", "acq_date", "latitude", "longitude"),
        Index("idx_stream_type", "stream_type"),
    )

    def __repr__(self) -> str:
        return f"<RawObservation(id={self.id}, lat={self.latitude}, lon={self.longitude}, date={self.acq_date}, frp={self.frp}MW, stream={self.stream_type})>"


class FacilityThermalProfileModel(Base):
    """Maintains historical thermal fingerprints, baselines, and variance for industrial installations."""
    
    __tablename__ = "facility_thermal_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    facility_name = Column(String(120), unique=True, nullable=False, index=True)
    facility_type = Column(String(50), nullable=True)
    avg_frp = Column(Float, nullable=False, default=12.0)
    max_frp = Column(Float, nullable=False, default=25.0)
    std_frp = Column(Float, nullable=True, default=4.0)
    total_detections = Column(Integer, nullable=False, default=1)
    persistence_days = Column(Integer, nullable=False, default=1)
    event_frequency = Column(String(50), nullable=True, default="RECURRING_DAILY")
    seasonal_behavior = Column(String(250), nullable=True, default="Consistent Year-Round Emissions")
    last_observed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<FacilityThermalProfile(facility='{self.facility_name}', avg_frp={self.avg_frp}MW, max_frp={self.max_frp}MW)>"

