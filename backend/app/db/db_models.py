from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Index, UniqueConstraint, Boolean
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
    state = Column(String(50), nullable=True, default="Gujarat", index=True)
    region_code = Column(String(20), nullable=True, default="WEST_GUJARAT", index=True)
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
        Index("idx_obs_region_date", "region_code", "acq_date"),
        Index("idx_obs_state_date", "state", "acq_date"),
    )

    def __repr__(self) -> str:
        return f"<RawObservation(id={self.id}, lat={self.latitude}, lon={self.longitude}, date={self.acq_date}, frp={self.frp}MW, region={self.region_code})>"


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
    state = Column(String(50), nullable=True, default="Gujarat", index=True)
    region_code = Column(String(20), nullable=True, default="WEST_GUJARAT", index=True)
    cluster_zone = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_observed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_facility_region", "region_code"),
        Index("idx_facility_state", "state"),
    )

    def __repr__(self) -> str:
        return f"<FacilityThermalProfile(facility='{self.facility_name}', region='{self.region_code}', avg_frp={self.avg_frp}MW)>"


class GroundTruthLabelModel(Base):
    """Database table to record expert human-in-the-loop ground-truth labels for ML training."""
    
    __tablename__ = "ground_truth_labels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_uuid = Column(String(50), nullable=False, index=True)
    facility_name = Column(String(120), nullable=False, index=True)
    assigned_label = Column(String(50), nullable=False)  # TRUE_FIRE, FALSE_ALARM, CONTROLLED_FLARING, MAINTENANCE_ACTIVITY
    reviewer_name = Column(String(100), nullable=False)
    review_notes = Column(String(500), nullable=True)
    state = Column(String(50), nullable=True, default="Gujarat")
    region_code = Column(String(20), nullable=True, default="WEST_GUJARAT", index=True)
    original_label = Column(String(50), nullable=True)
    is_edited = Column(Boolean, default=False, nullable=False)
    edit_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_incident_label", "incident_uuid", "assigned_label"),
        Index("idx_gt_region", "region_code"),
    )

    def __repr__(self) -> str:
        return f"<GroundTruthLabel(id={self.id}, incident='{self.incident_uuid}', label='{self.assigned_label}', reviewer='{self.reviewer_name}')>"


class ReviewAuditLogModel(Base):
    """Database table recording the complete immutable audit trail of human ground truth reviews."""
    
    __tablename__ = "review_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_uuid = Column(String(50), nullable=False, index=True)
    label_id = Column(Integer, nullable=True, index=True)
    facility_name = Column(String(120), nullable=False)
    action_type = Column(String(20), nullable=False)  # CREATE, UPDATE
    reviewer_name = Column(String(100), nullable=False, index=True)
    previous_label = Column(String(50), nullable=True)  # None on initial creation
    new_label = Column(String(50), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_incident", "incident_uuid"),
        Index("idx_audit_reviewer", "reviewer_name"),
        Index("idx_audit_created", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ReviewAuditLog(id={self.id}, incident='{self.incident_uuid}', action='{self.action_type}', reviewer='{self.reviewer_name}')>"


class MonitoredRegionModel(Base):
    """Database table cataloging the active industrial corridors and monitored zones across India."""
    
    __tablename__ = "monitored_regions"

    region_code = Column(String(20), primary_key=True)
    name = Column(String(100), nullable=False)
    states_covered = Column(String(200), nullable=False)
    min_lon = Column(Float, nullable=False)
    min_lat = Column(Float, nullable=False)
    max_lon = Column(Float, nullable=False)
    max_lat = Column(Float, nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    default_zoom = Column(Integer, nullable=False, default=7)
    is_active = Column(Boolean, nullable=False, default=True)
    facility_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self) -> str:
        return f"<MonitoredRegion(code='{self.region_code}', name='{self.name}')>"


class ExposureAssetModel(Base):
    """Database table cataloging critical receptors, settlements, and environmental assets."""
    
    __tablename__ = "exposure_assets"

    asset_id = Column(String(50), primary_key=True)
    name = Column(String(150), nullable=False, index=True)
    region_code = Column(String(20), nullable=False, index=True)
    state = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)  # POPULATION, INFRASTRUCTURE, ENVIRONMENTAL
    sub_type = Column(String(50), nullable=False)
    criticality = Column(String(20), nullable=False, default="MEDIUM")
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    source = Column(String(50), default="OSM_OVERPASS")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_exposure_spatial", "latitude", "longitude"),
        Index("idx_exposure_region", "region_code"),
    )

    def __repr__(self) -> str:
        return f"<ExposureAsset(id='{self.asset_id}', name='{self.name}', cat='{self.category}', reg='{self.region_code}')>"


class IncidentRecordModel(Base):
    """
    Persistent Incident Registry Table (Phase 12B).
    Provides permanent, traceable incident UUIDs across pipeline runs, decoupling transient
    DBSCAN cluster IDs from persistent investigation records and longitudinal facility intelligence.
    """

    __tablename__ = "incidents"

    incident_uuid = Column(String(64), primary_key=True, index=True)
    cluster_id = Column(String(50), nullable=True, index=True)
    facility_name = Column(String(120), nullable=False, index=True)
    state = Column(String(50), nullable=False, default="Gujarat", index=True)
    region_code = Column(String(20), nullable=False, default="WEST_GUJARAT", index=True)
    first_detected = Column(DateTime, nullable=False)
    last_detected = Column(DateTime, nullable=False)
    risk_score = Column(Float, nullable=False, default=0.0)
    abnormality_score = Column(Float, nullable=False, default=0.0)
    temporal_status = Column(String(30), nullable=False, default="HISTORICAL", index=True)
    detection_count = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="NEW", index=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)
    peak_frp = Column(Float, nullable=True, default=0.0)
    action_code = Column(String(50), nullable=True)
    risk_level = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_incident_facility_date", "facility_name", "first_detected"),
        Index("idx_incident_temporal_status", "temporal_status", "status"),
        Index("idx_incident_region_status", "region_code", "status"),
    )

    def __repr__(self) -> str:
        return f"<IncidentRecord(uuid='{self.incident_uuid}', facility='{self.facility_name}', status='{self.status}', temporal='{self.temporal_status}')>"


