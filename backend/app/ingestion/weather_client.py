import time
from typing import Dict, Any, Optional
import httpx
from app.core.logging import logger


class WeatherClient:
    """
    Client for Open-Meteo API with coordinate spatial grid hashing and 15-minute caching.
    Enriches incident clusters with real-time meteorological dispersion parameters:
    wind_speed, wind_direction, temperature, cloud_cover, precipitation, and observation confidence.
    """
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_TTL_SECONDS = 900  # 15 minutes cache

    # In-memory thread-safe dictionary cache: { "lat_lon": { "cached_at": timestamp, "data": {...} } }
    _cache: Dict[str, Dict[str, Any]] = {}
    _circuit_open_until: float = 0.0

    @classmethod
    def _deg_to_cardinal(cls, deg: float) -> str:
        """Converts meteorological wind azimuth degree (0-360) to 16-point cardinal string."""
        dirs = [
            "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
        ]
        idx = int((deg + 11.25) / 22.5) % 16
        return dirs[idx]

    @classmethod
    def _evaluate_confidence(cls, cloud_cover: int) -> str:
        """
        Maps cloud cover to satellite observation confidence:
        0-30%   -> HIGH (Clear atmosphere, direct thermal radiance line-of-sight)
        31-70%  -> MEDIUM (Partial atmospheric scattering / thin cirrus)
        71-100% -> LOW (Heavy cloud obscuration; thermal radiance may be attenuated)
        """
        if cloud_cover <= 30:
            return "HIGH"
        elif cloud_cover <= 70:
            return "MEDIUM"
        return "LOW"

    @classmethod
    def _evaluate_spread_concern(cls, wind_speed: float, precipitation: float) -> str:
        """Determines physical fire propagation concern based on wind and precipitation."""
        if precipitation >= 2.0:
            return "PRECIPITATION_SUPPRESSION"
        elif wind_speed >= 30.0:
            return "CRITICAL_WIND_DRIVEN_SPREAD"
        elif wind_speed >= 15.0:
            return "MODERATE_WIND_SPREAD_RISK"
        return "LOW_WIND_SPREAD_RISK"

    @classmethod
    def _get_baseline_fallback(cls) -> Dict[str, Any]:
        return {
            "wind_speed_kmh": 14.0,
            "wind_direction_deg": 220,
            "wind_cardinal": "SW",
            "temperature_c": 32.0,
            "cloud_cover_pct": 20,
            "precipitation_mm": 0.0,
            "observation_confidence": "HIGH",
            "spread_concern": "MODERATE_WIND_SPREAD_RISK",
            "plume_dispersion_heading": "NE",
            "cached": True,
            "source": "Fallback Baseline",
            "timestamp_utc": None
        }

    @classmethod
    def get_weather_context(cls, lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetches or retrieves cached weather parameters for given geographic coordinates.
        Uses 0.5-degree (~55km regional cell) spatial quantization for cache consolidation.
        """
        grid_lat = round(lat * 2) / 2
        grid_lon = round(lon * 2) / 2
        cache_key = f"{grid_lat}_{grid_lon}"
        legacy_key = f"{round(lat, 2)}_{round(lon, 2)}"
        now = time.time()

        # 1. Check in-memory cache (supports both precise injection key and regional cell)
        entry = cls._cache.get(legacy_key) or cls._cache.get(cache_key)
        if entry:
            if now - entry["cached_at"] < cls.CACHE_TTL_SECONDS:
                cached_data = dict(entry["data"])
                cached_data["cached"] = True
                return cached_data

        # 2. Check circuit breaker if rate-limited
        if now < cls._circuit_open_until:
            fallback = cls._get_baseline_fallback()
            cls._cache[cache_key] = {"cached_at": now, "data": fallback}
            return fallback

        # 3. Query Open-Meteo REST API
        params = {
            "latitude": grid_lat,
            "longitude": grid_lon,
            "current": "temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m",
            "wind_speed_unit": "kmh"
        }

        try:
            with httpx.Client(timeout=1.8) as client:
                res = client.get(cls.BASE_URL, params=params)
                res.raise_for_status()
                curr = res.json().get("current", {})

                wind_speed = float(curr.get("wind_speed_10m", 12.0))
                wind_dir = float(curr.get("wind_direction_10m", 180.0))
                temp = float(curr.get("temperature_2m", 30.0))
                cloud = int(curr.get("cloud_cover", 20))
                precip = float(curr.get("precipitation", 0.0))

                downwind_deg = (wind_dir + 180.0) % 360.0
                obs_conf = cls._evaluate_confidence(cloud)
                spread_concern = cls._evaluate_spread_concern(wind_speed, precip)

                weather_data = {
                    "wind_speed_kmh": round(wind_speed, 1),
                    "wind_direction_deg": int(wind_dir),
                    "wind_cardinal": cls._deg_to_cardinal(wind_dir),
                    "temperature_c": round(temp, 1),
                    "cloud_cover_pct": cloud,
                    "precipitation_mm": round(precip, 1),
                    "observation_confidence": obs_conf,
                    "spread_concern": spread_concern,
                    "plume_dispersion_heading": cls._deg_to_cardinal(downwind_deg),
                    "cached": False,
                    "source": "Open-Meteo API",
                    "timestamp_utc": curr.get("time")
                }

                cls._cache[cache_key] = {"cached_at": now, "data": weather_data}
                return weather_data

        except Exception as e:
            cls._circuit_open_until = now + 180  # Trip circuit breaker for 3m on network failure to avoid 400 serial timeouts
            logger.warning(f"Open-Meteo fetch failed for ({lat}, {lon}): {e}. Tripping circuit breaker to use resilient fallback.")
            fallback_data = cls._get_baseline_fallback()
            cls._cache[cache_key] = {"cached_at": now, "data": fallback_data}
            return fallback_data

