import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.spatial.exposure_engine import (
    haversine_km,
    calculate_bearing,
    deg_to_cardinal,
    destination_point,
    is_angle_between,
    ExposureAnalysisService
)


def test_haversine_and_bearing_calculation():
    # Hazira centroid to Mora Colony (~2.0 km, bearing ~140° SE)
    lat1, lon1 = 21.1688, 72.6957
    lat2, lon2 = 21.1620, 72.6980
    dist = haversine_km(lat1, lon1, lat2, lon2)
    bearing = calculate_bearing(lat1, lon1, lat2, lon2)

    assert 0.5 <= dist <= 1.5
    assert 140.0 <= bearing <= 180.0
    assert deg_to_cardinal(bearing) in ["SE", "SSE", "S"]


def test_angle_between_wrap_around():
    # Test angle wrap around north (360° / 0°)
    # Center = 5°, target = 355°, half_width = 15° -> Should be True
    assert is_angle_between(355.0, 5.0, 15.0) is True
    # Center = 355°, target = 5°, half_width = 15° -> Should be True
    assert is_angle_between(5.0, 355.0, 15.0) is True
    # Center = 180°, target = 240°, half_width = 35° -> Should be False
    assert is_angle_between(240.0, 180.0, 35.0) is False
    # Center = 180°, target = 200°, half_width = 35° -> Should be True
    assert is_angle_between(200.0, 180.0, 35.0) is True


def test_downwind_cone_geometry():
    lat, lon = 21.1688, 72.6957
    wind_dir = 240.0  # Wind from WSW (240°) -> Downwind is ENE (60°)
    wind_spd = 25.0

    cone = ExposureAnalysisService.generate_downwind_cone_geometry(
        lat=lat,
        lon=lon,
        wind_direction_deg=wind_dir,
        wind_speed_kmh=wind_spd,
        half_angle_deg=35.0
    )

    assert cone["type"] == "Polygon"
    assert len(cone["coordinates"]) == 1
    ring = cone["coordinates"][0]
    # Ring must be closed (first coordinate equals last coordinate)
    assert ring[0] == ring[-1]
    assert cone["properties"]["downwind_bearing"] == 60.0
    assert cone["properties"]["downwind_cardinal"] == "ENE"
    assert cone["properties"]["cone_length_km"] >= 2.0


def test_exposure_assessment_hazira():
    # Hazira AMNS complex: lat 21.1688, lon 72.6957
    # Wind from 240° (WSW) -> Plume travels ENE towards Kawas & Mora
    res = ExposureAnalysisService.analyze_incident_exposure(
        lat=21.1688,
        lon=72.6957,
        wind_direction_deg=240.0,
        wind_speed_kmh=22.0
    )

    assert res["population_exposure"] in ["HIGH", "MEDIUM", "LOW"]
    assert res["infrastructure_exposure"] in ["HIGH", "MEDIUM", "LOW"]
    assert res["environmental_exposure"] in ["HIGH", "MEDIUM", "LOW"]
    assert res["downwind_exposure"] in ["HIGH", "MEDIUM", "LOW"]
    assert "exposure_summary" in res
    assert len(res["exposure_summary"]) > 20
    assert "nearby_assets" in res
    assert len(res["nearby_assets"]) > 0

    first_asset = res["nearby_assets"][0]
    assert "name" in first_asset
    assert "category" in first_asset
    assert "distance_km" in first_asset
    assert "is_downwind" in first_asset


def test_exposure_api_endpoint():
    client = TestClient(app)
    response = client.get("/api/exposure?latitude=21.1688&longitude=72.6957&wind_direction_deg=240&wind_speed_kmh=20")
    assert response.status_code == 200
    data = response.json()
    assert "population_exposure" in data
    assert "infrastructure_exposure" in data
    assert "environmental_exposure" in data
    assert "downwind_exposure" in data
    assert "exposure_summary" in data
    assert "nearby_assets" in data
    assert "downwind_cone_geojson" in data
