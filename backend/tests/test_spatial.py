import os
import pytest
import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon

from app.spatial.proximity import haversine_distance, SpatialProximityEngine
from app.ingestion.osm_client import OSMClient


@pytest.fixture
def sample_osm_gdf():
    """Loads the verified sample Gujarat industrial GeoJSON."""
    cache_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "osm_cache", "sample_gujarat_industrial.geojson"
    )
    assert os.path.exists(cache_path), f"Sample GeoJSON missing at {cache_path}"
    client = OSMClient()
    return client.load_cached_geojson(cache_path)


def test_haversine_distance_math():
    """Verify that Haversine great-circle calculation matches known geodesic ground truth."""
    # Distance from (0,0) to (0,0) must be 0 meters
    assert haversine_distance(0.0, 0.0, 0.0, 0.0) == 0.0

    # 1 degree of latitude on Earth is approximately 111.19 km (111,195 m)
    dist_1deg_lat = haversine_distance(0.0, 0.0, 1.0, 0.0)
    assert 110_000 <= dist_1deg_lat <= 112_000


def test_hotspot_inside_industrial_polygon(sample_osm_gdf):
    """Test that a hotspot located inside the Jamnagar Refinery polygon is correctly identified."""
    engine = SpatialProximityEngine(sample_osm_gdf)
    
    # Jamnagar refinery coordinates from our dataset
    lat, lon = 22.4707, 70.0577
    result = engine.find_nearest_facility(lat, lon)

    assert result["in_industrial_zone"] is True
    assert result["distance_to_industry_meters"] == 0.0
    assert "Jamnagar" in result["nearest_facility_name"]
    assert result["nearest_facility_type"] == "oil_refinery"
    assert result["spatial_context"] == "INSIDE_INDUSTRIAL_ZONE"
    assert result["proximity_risk_factor"] == 1.0


def test_hotspot_in_rural_area(sample_osm_gdf):
    """Test that a distant rural hotspot is identified as non-industrial with large distance."""
    engine = SpatialProximityEngine(sample_osm_gdf)
    
    # Rural agricultural coordinates (far from industrial estates)
    lat, lon = 23.8512, 71.2145
    result = engine.find_nearest_facility(lat, lon)

    assert result["in_industrial_zone"] is False
    assert result["distance_to_industry_meters"] > 50_000.0  # > 50 km away
    assert result["spatial_context"] == "NON_INDUSTRIAL_RURAL"
    assert result["proximity_risk_factor"] == 0.1


def test_dataframe_enrichment(sample_osm_gdf):
    """Test full DataFrame enrichment appending all spatial columns."""
    engine = SpatialProximityEngine(sample_osm_gdf)
    
    df = pd.DataFrame([
        {"id": 1, "latitude": 22.4707, "longitude": 70.0577, "frp": 14.2},
        {"id": 2, "latitude": 23.8512, "longitude": 71.2145, "frp": 5.6}
    ])
    
    enriched_df = engine.enrich_observations_dataframe(df)

    assert "in_industrial_zone" in enriched_df.columns
    assert "distance_to_industry_meters" in enriched_df.columns
    assert "nearest_facility_name" in enriched_df.columns
    assert "spatial_context" in enriched_df.columns
    assert enriched_df.iloc[0]["in_industrial_zone"] == True
    assert enriched_df.iloc[1]["in_industrial_zone"] == False
