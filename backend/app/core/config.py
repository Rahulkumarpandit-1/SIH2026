import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Deterministic base directory pointing to backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _resolve_default_db_url() -> str:
    env_db = os.getenv("DATABASE_URL")
    if env_db:
        return env_db
    p1 = BASE_DIR / "data" / "app.db"
    if p1.exists():
        return f"sqlite:///{p1.resolve().as_posix()}"
    p2 = BASE_DIR.parent / "data" / "app.db"
    if p2.exists():
        return f"sqlite:///{p2.resolve().as_posix()}"
    return f"sqlite:///{p1.resolve().as_posix()}"


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""
    
    # NASA FIRMS settings
    FIRMS_MAP_KEY: str = Field(default="demo_key_or_offline", description="NASA FIRMS MAPKEY")
    FIRMS_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov/api"
    
    # Available satellite sensors in FIRMS
    DEFAULT_SENSOR: str = "VIIRS_SNPP_NRT"
    DEFAULT_DAY_RANGE: int = 3  # 1 to 10 days for NRT
    
    # Default Region of Interest: [min_lon, min_lat, max_lon, max_lat]
    # Complete Gujarat Industrial Corridor (Jamnagar, Dahej, Hazira/Surat, Vadodara, Vapi)
    DEFAULT_BBOX_MIN_LON: float = 69.0
    DEFAULT_BBOX_MIN_LAT: float = 20.0
    DEFAULT_BBOX_MAX_LON: float = 74.0
    DEFAULT_BBOX_MAX_LAT: float = 24.5
    
    # Storage settings - defaults to deterministic database path
    DATABASE_URL: str = Field(default_factory=_resolve_default_db_url)
    
    # CORS Origins (comma-separated list or * for all)
    CORS_ORIGINS: str = Field(default="*", description="Allowed CORS origins comma-separated")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def default_bbox(self) -> List[float]:
        """Returns [min_lon, min_lat, max_lon, max_lat]"""
        return [
            self.DEFAULT_BBOX_MIN_LON,
            self.DEFAULT_BBOX_MIN_LAT,
            self.DEFAULT_BBOX_MAX_LON,
            self.DEFAULT_BBOX_MAX_LAT
        ]


settings = Settings()
