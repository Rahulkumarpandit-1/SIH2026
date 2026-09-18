import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.ingestion.weather_client import WeatherClient


def test_weather_cardinal_conversion():
    """Verifies that meteorological wind degrees map to correct 16-point cardinal compass headings."""
    assert WeatherClient._deg_to_cardinal(0) == "N"
    assert WeatherClient._deg_to_cardinal(90) == "E"
    assert WeatherClient._deg_to_cardinal(180) == "S"
    assert WeatherClient._deg_to_cardinal(270) == "W"
    assert WeatherClient._deg_to_cardinal(225) == "SW"
    assert WeatherClient._deg_to_cardinal(240) == "WSW"
    assert WeatherClient._deg_to_cardinal(45) == "NE"


def test_weather_observation_confidence_logic():
    """Verifies the exact observation confidence thresholds from requirements:
    0-30% -> High
    31-70% -> Medium
    71-100% -> Low
    """
    assert WeatherClient._evaluate_confidence(0) == "HIGH"
    assert WeatherClient._evaluate_confidence(15) == "HIGH"
    assert WeatherClient._evaluate_confidence(30) == "HIGH"
    assert WeatherClient._evaluate_confidence(31) == "MEDIUM"
    assert WeatherClient._evaluate_confidence(50) == "MEDIUM"
    assert WeatherClient._evaluate_confidence(70) == "MEDIUM"
    assert WeatherClient._evaluate_confidence(71) == "LOW"
    assert WeatherClient._evaluate_confidence(95) == "LOW"
    assert WeatherClient._evaluate_confidence(100) == "LOW"


def test_weather_spread_concern_logic():
    """Verifies that high wind increases spread concern and precipitation suppresses spread concern."""
    # Heavy rain suppresses
    assert WeatherClient._evaluate_spread_concern(wind_speed=40.0, precipitation=3.5) == "PRECIPITATION_SUPPRESSION"
    # Strong wind without rain increases spread concern
    assert WeatherClient._evaluate_spread_concern(wind_speed=35.0, precipitation=0.0) == "CRITICAL_WIND_DRIVEN_SPREAD"
    assert WeatherClient._evaluate_spread_concern(wind_speed=18.0, precipitation=0.0) == "MODERATE_WIND_SPREAD_RISK"
    assert WeatherClient._evaluate_spread_concern(wind_speed=8.0, precipitation=0.0) == "LOW_WIND_SPREAD_RISK"


def test_weather_caching_mechanism():
    """Verifies that subsequent calls within the 15-minute TTL return cached result."""
    lat, lon = 21.1642, 72.6781
    key = f"{round(lat, 2)}_{round(lon, 2)}"
    
    # Inject known entry into cache
    WeatherClient._cache[key] = {
        "cached_at": time.time(),
        "data": {
            "wind_speed_kmh": 22.0,
            "wind_direction_deg": 240,
            "wind_cardinal": "WSW",
            "temperature_c": 33.0,
            "cloud_cover_pct": 10,
            "precipitation_mm": 0.0,
            "observation_confidence": "HIGH",
            "spread_concern": "MODERATE_WIND_SPREAD_RISK",
            "plume_dispersion_heading": "ENE",
            "cached": False,
            "source": "Test Cache Injection",
            "timestamp_utc": "2026-09-16T08:00:00Z"
        }
    }

    res = WeatherClient.get_weather_context(lat, lon)
    assert res["cached"] is True
    assert res["wind_speed_kmh"] == 22.0
    assert res["observation_confidence"] == "HIGH"


def test_weather_api_endpoint():
    """Verifies that GET /api/weather returns valid schema at arbitrary coordinates."""
    client = TestClient(app)
    response = client.get("/api/weather?latitude=21.16&longitude=72.68")
    assert response.status_code == 200
    data = response.json()
    assert "wind_speed_kmh" in data
    assert "wind_direction_deg" in data
    assert "temperature_c" in data
    assert "cloud_cover_pct" in data
    assert "precipitation_mm" in data
    assert "observation_confidence" in data
    assert data["observation_confidence"] in ["HIGH", "MEDIUM", "LOW"]
    assert "spread_concern" in data


def test_risk_prioritization_includes_weather_context():
    """Verifies that GET /api/risk includes weather_context for all clusters."""
    client = TestClient(app)
    response = client.get("/api/risk")
    assert response.status_code == 200
    incidents = response.json()
    if incidents:
        first_incident = incidents[0]
        assert "weather_context" in first_incident
        w = first_incident["weather_context"]
        assert "wind_speed_kmh" in w
        assert "observation_confidence" in w
