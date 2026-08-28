import math
from datetime import date, datetime
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


def _is_null_or_nan(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    s = str(v).strip().lower()
    return s in ["nan", "none", "null", ""]


class RawObservationBase(BaseModel):
    """Base schema representing a single satellite thermal hotspot observation."""
    
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    brightness: float = Field(..., gt=200.0, lt=600.0, description="Brightness temperature in Kelvin (channel 4/I4)")
    scan: Optional[float] = Field(default=0.375, gt=0.0, description="Pixel scan size in km")
    track: Optional[float] = Field(default=0.375, gt=0.0, description="Pixel track size in km")
    acq_date: date = Field(..., description="Acquisition date (YYYY-MM-DD)")
    acq_time: str = Field(..., description="Acquisition time (HHMM UTC)")
    satellite: str = Field(..., description="Satellite platform identifier (e.g. N, 1, 2, Terra, Aqua)")
    instrument: str = Field(default="VIIRS", description="Sensor instrument (VIIRS or MODIS)")
    confidence: str = Field(..., description="Confidence label (low, nominal, high, or percentage string)")
    confidence_normalized: float = Field(default=0.5, ge=0.0, le=1.0, description="Confidence normalized from 0.0 to 1.0")
    version: Optional[str] = Field(default="NRT", description="FIRMS data processing version")
    bright_t31: Optional[float] = Field(default=None, description="Brightness temp channel 5 / Band 31 in Kelvin")
    frp: float = Field(default=0.0, ge=0.0, description="Fire Radiative Power in Megawatts (MW)")
    daynight: Literal["D", "N"] = Field(default="N", description="D=Day pass, N=Night pass")
    stream_type: str = Field(default="historical", description="Stream categorization: 'historical' or 'near_real_time'")

    @field_validator("acq_time", mode="before")
    @classmethod
    def clean_acq_time(cls, v) -> str:
        """Pads and sanitizes acquisition time to a standard 4-character string (HHMM)."""
        val_str = str(v).strip().replace(":", "")
        if len(val_str) < 4:
            val_str = val_str.zfill(4)
        return val_str[:4]

    @field_validator("daynight", mode="before")
    @classmethod
    def clean_daynight(cls, v) -> str:
        """Ensures daynight is either 'D' or 'N'."""
        val = str(v).strip().upper()
        return "D" if val.startswith("D") else "N"

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, values: dict) -> dict:
        """
        Normalizes variations across FIRMS sensor CSVs (e.g., bright_ti4 vs brightness,
        confidence percentages vs nominal/high categories).
        """
        if not isinstance(values, dict):
            return values

        # Handle alternate column names for brightness and NaN values
        b_val = values.get("brightness")
        if _is_null_or_nan(b_val):
            ti4 = values.get("bright_ti4")
            if not _is_null_or_nan(ti4):
                values["brightness"] = float(ti4)

        b31_val = values.get("bright_t31")
        if _is_null_or_nan(b31_val):
            ti5 = values.get("bright_ti5")
            if not _is_null_or_nan(ti5):
                values["bright_t31"] = float(ti5)
            else:
                values["bright_t31"] = None
        else:
            values["bright_t31"] = float(b31_val)

        # Handle satellite & instrument defaults if NaN
        if _is_null_or_nan(values.get("satellite")):
            values["satellite"] = "N"
        if _is_null_or_nan(values.get("instrument")):
            values["instrument"] = "VIIRS"
        if _is_null_or_nan(values.get("scan")):
            values["scan"] = 0.375
        if _is_null_or_nan(values.get("track")):
            values["track"] = 0.375
        if _is_null_or_nan(values.get("version")):
            values["version"] = "NRT"
        if _is_null_or_nan(values.get("stream_type")):
            values["stream_type"] = "historical"

        # Normalize confidence to both a categorical string and a 0.0-1.0 float
        conf_raw = str(values.get("confidence", "nominal")).strip().lower()
        
        # Try numeric conversion (MODIS 0-100 or float scale)
        try:
            val = float(conf_raw)
            if val > 1.0:
                values["confidence_normalized"] = min(max(val / 100.0, 0.0), 1.0)
                if val >= 80.0:
                    values["confidence"] = "high"
                elif val >= 40.0:
                    values["confidence"] = "nominal"
                else:
                    values["confidence"] = "low"
            else:
                values["confidence_normalized"] = min(max(val, 0.0), 1.0)
                if val >= 0.8:
                    values["confidence"] = "high"
                elif val >= 0.4:
                    values["confidence"] = "nominal"
                else:
                    values["confidence"] = "low"
        except (ValueError, TypeError):
            if conf_raw in ["h", "high"]:
                values["confidence"] = "high"
                values["confidence_normalized"] = 0.9
            elif conf_raw in ["n", "nominal"]:
                values["confidence"] = "nominal"
                values["confidence_normalized"] = 0.6
            elif conf_raw in ["l", "low"]:
                values["confidence"] = "low"
                values["confidence_normalized"] = 0.2
            else:
                values["confidence"] = "nominal"
                values["confidence_normalized"] = 0.5

        # Sanitize FRP (ensure non-negative)
        frp_raw = values.get("frp", 0.0)
        try:
            frp_val = float(frp_raw)
            values["frp"] = max(frp_val, 0.0)
        except (ValueError, TypeError):
            values["frp"] = 0.0

        return values


class RawObservationCreate(RawObservationBase):
    """Schema used when ingesting new observations."""
    pass


class RawObservationResponse(RawObservationBase):
    """Schema returned by API endpoints."""
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


class IngestionSummary(BaseModel):
    """Summary metrics of an ingestion run."""
    source: str
    total_received: int
    valid_records: int
    rejected_records: int
    duplicates_skipped: int = 0
    sensor: str
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    execution_time_seconds: float


class MLPredictRequest(BaseModel):
    """9-dimensional feature vector input for machine learning inference."""
    frp: float = Field(..., ge=0.0, description="Fire Radiative Power (MW)")
    brightness: float = Field(..., gt=200.0, lt=600.0, description="T4 Brightness Temperature (K)")
    bright_t31: Optional[float] = Field(default=None, description="T31 Background Temperature (K)")
    thermal_contrast: Optional[float] = Field(default=None, description="Delta T (T4 - T31) (K)")
    distance_to_industry_meters: float = Field(..., ge=0.0, description="Distance to industrial boundary (m)")
    persistence_ratio: float = Field(..., ge=0.0, le=1.0, description="Persistence ratio (0.0 to 1.0)")
    active_days_count: int = Field(default=1, ge=1, description="Active detection days count")
    is_anomaly_spike: int = Field(default=0, ge=0, le=1, description="Thermal anomaly spike indicator (0 or 1)")
    confidence_normalized: float = Field(default=0.8, ge=0.0, le=1.0, description="Normalized detection confidence (0.0 to 1.0)")


class MLPredictResponse(BaseModel):
    """ML prediction response schema."""
    ml_status: str
    prediction_available: bool
    predicted_class: Optional[int] = None
    predicted_class_name: Optional[str] = None
    class_probabilities: Optional[Dict[str, float]] = None
    model_type: Optional[str] = None
    scientific_warning: Optional[str] = None
    features_used: Dict[str, float]


class MLStatusResponse(BaseModel):
    """ML status and readiness response schema."""
    status: str
    reason: str
    labeled_samples: int
    classes_present: int
    class_distribution: Dict[str, int]
    spatial_groups_count: int
    min_samples_per_class: int
    is_statistically_defensible: bool
    recommendation: str


class DataRefreshRequest(BaseModel):
    """Data refresh request parameters."""
    days: Optional[int] = Field(default=1, ge=1, le=30, description="Days to query (default 1 for NRT)")
    sensor: Optional[str] = Field(default="VIIRS_SNPP_NRT", description="Sensor to query")
    bbox: Optional[List[float]] = Field(default=None, description="[min_lon, min_lat, max_lon, max_lat]")
    start_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    end_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    stream_type: Optional[str] = Field(default="near_real_time", description="'near_real_time' or 'historical'")


class DataRefreshResponse(BaseModel):
    """Data refresh summary response."""
    job_id: str
    status: str
    rows_received: int
    rows_added: int
    rows_duplicate: int
    date_range: Dict[str, Optional[str]]
    sensor: str
    execution_time_seconds: float


class DataRefreshStatusResponse(BaseModel):
    """Near-real-time data refresh operational status schema."""
    status: str = Field(..., description="IDLE | RUNNING | SUCCESS | FAILED")
    job_id: Optional[str] = None
    started_at: Optional[str] = None
    last_success: Optional[str] = None
    last_checked: Optional[str] = None
    next_scheduled_refresh: Optional[str] = None
    new_observations: int = 0
    duplicates: int = 0
    duration_seconds: float = 0.0
    refresh_interval_minutes: int = 15
    active_sensor: str = "VIIRS_SNPP_NRT"
    error: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    """High-level KPI metrics summary schema."""
    total_observations: int
    total_clusters: int
    critical_count: int
    high_count: int
    moderate_count: int
    low_count: int
    date_range: Optional[Dict[str, Optional[str]]] = None
    latest_observation_date: Optional[str] = None
    last_data_update: Optional[str] = None
    last_refresh_time: Optional[str] = None
    next_refresh_time: Optional[str] = None
    live_observations_count: int = 0
    historical_observations_count: int = 0
    monitoring_mode: str = "NEAR_REAL_TIME"
