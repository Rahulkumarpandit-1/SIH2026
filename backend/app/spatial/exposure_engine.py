import os
import json
import math
from typing import List, Dict, Any, Optional, Tuple
import geopandas as gpd
from shapely.geometry import Point, Polygon

from app.core.logging import logger


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the geodesic distance between two coordinates in kilometers."""
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 3)


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the initial compass bearing (azimuth) from point 1 to point 2 in degrees (0-360).
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    bearing = math.degrees(math.atan2(y, x))
    return round((bearing + 360.0) % 360.0, 1)


def deg_to_cardinal(deg: float) -> str:
    """Converts a 0-360 compass degree to 16-point cardinal compass text."""
    cardinals = [
        "N", "NNE", "NE", "ENE",
        "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW",
        "W", "WNW", "NW", "NNW"
    ]
    idx = round(deg / 22.5) % 16
    return cardinals[idx]


def destination_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> Tuple[float, float]:
    """
    Computes destination latitude and longitude given a starting point,
    bearing in degrees, and distance in kilometers using spherical trigonometry.
    """
    R = 6371.0
    d_div_r = distance_km / R
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(d_div_r)
        + math.cos(lat1) * math.sin(d_div_r) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(d_div_r) * math.cos(lat1),
        math.cos(d_div_r) - math.sin(lat1) * math.sin(lat2)
    )

    return math.degrees(lat2), math.degrees(lon2)


def is_angle_between(target_deg: float, center_deg: float, half_width_deg: float = 35.0) -> bool:
    """
    Checks if a target bearing falls within center_deg +/- half_width_deg,
    correctly accounting for 360-degree boundary wrap-around.
    """
    diff = (target_deg - center_deg + 180.0) % 360.0 - 180.0
    return abs(diff) <= half_width_deg


class ExposureAnalysisService:
    """
    Geospatial Exposure Analysis Engine evaluating Population, Infrastructure,
    Environmental, and Downwind Plume exposure for industrial fire incidents.
    """
    _assets_gdf: Optional[gpd.GeoDataFrame] = None

    @classmethod
    def _get_assets_path(cls) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        p_india = os.path.join(base_dir, "data", "osm_cache", "india_exposure_assets.geojson")
        if os.path.exists(p_india):
            return p_india
        p = os.path.join(base_dir, "data", "osm_cache", "gujarat_exposure_assets.geojson")
        return p


    @classmethod
    def load_assets(cls, force_reload: bool = False) -> gpd.GeoDataFrame:
        """Loads and caches spatial exposure assets into memory with R-tree indexing."""
        if cls._assets_gdf is not None and not force_reload:
            return cls._assets_gdf

        filepath = cls._get_assets_path()
        if os.path.exists(filepath):
            try:
                gdf = gpd.read_file(filepath)
                if gdf.crs is None:
                    gdf = gdf.set_crs(epsg=4326)
                cls._assets_gdf = gdf
                logger.info(f"Loaded {len(gdf)} curated exposure assets from: {filepath}")
                return cls._assets_gdf
            except Exception as e:
                logger.error(f"Error reading exposure assets GeoJSON {filepath}: {e}")

        # Resilient fallback empty GeoDataFrame
        cls._assets_gdf = gpd.GeoDataFrame(
            columns=["asset_id", "name", "category", "sub_type", "criticality", "geometry"],
            crs="EPSG:4326"
        )
        return cls._assets_gdf

    @classmethod
    def generate_downwind_cone_geometry(
        cls,
        lat: float,
        lon: float,
        wind_direction_deg: float,
        wind_speed_kmh: float,
        half_angle_deg: float = 35.0
    ) -> Dict[str, Any]:
        """
        Generates a GeoJSON Polygon representing the potential downwind impact sector / plume cone.
        Downwind direction is (wind_direction + 180) % 360.
        Length scales with wind speed between 2.0 km and 10.0 km.
        """
        downwind_bearing = (wind_direction_deg + 180.0) % 360.0
        cone_length_km = max(2.0, min(10.0, 1.5 + (0.15 * wind_speed_kmh)))

        # Arc points along the downwind sector
        start_angle = downwind_bearing - half_angle_deg
        end_angle = downwind_bearing + half_angle_deg
        steps = 14
        step_angle = (end_angle - start_angle) / steps

        coordinates = [[round(lon, 6), round(lat, 6)]]
        for i in range(steps + 1):
            cur_angle = (start_angle + (i * step_angle)) % 360.0
            pt_lat, pt_lon = destination_point(lat, lon, cur_angle, cone_length_km)
            coordinates.append([round(pt_lon, 6), round(pt_lat, 6)])

        # Close the polygon ring
        coordinates.append([round(lon, 6), round(lat, 6)])

        return {
            "type": "Polygon",
            "coordinates": [coordinates],
            "properties": {
                "downwind_bearing": round(downwind_bearing, 1),
                "downwind_cardinal": deg_to_cardinal(downwind_bearing),
                "cone_length_km": round(cone_length_km, 2),
                "half_angle_deg": half_angle_deg
            }
        }

    @classmethod
    def analyze_incident_exposure(
        cls,
        lat: float,
        lon: float,
        wind_direction_deg: Optional[float] = 180.0,
        wind_speed_kmh: Optional[float] = 15.0,
        max_search_radius_km: float = 12.0
    ) -> Dict[str, Any]:
        """
        Comprehensive exposure assessment for an incident coordinate.
        Returns:
            - population_exposure (LOW, MEDIUM, HIGH)
            - infrastructure_exposure (LOW, MEDIUM, HIGH)
            - environmental_exposure (LOW, MEDIUM, HIGH)
            - downwind_exposure (LOW, MEDIUM, HIGH)
            - exposure_summary (Narrative intelligence)
            - nearby_assets (List of identified assets sorted by distance)
            - downwind_cone_geojson (GeoJSON polygon for map rendering)
        """
        assets_gdf = cls.load_assets()
        wind_dir = wind_direction_deg if wind_direction_deg is not None else 180.0
        wind_spd = wind_speed_kmh if wind_speed_kmh is not None else 15.0
        downwind_bearing = (wind_dir + 180.0) % 360.0
        cone_length_km = max(2.0, min(10.0, 1.5 + (0.15 * wind_spd)))
        half_angle = 35.0

        cone_geojson = cls.generate_downwind_cone_geometry(
            lat=lat,
            lon=lon,
            wind_direction_deg=wind_dir,
            wind_speed_kmh=wind_spd,
            half_angle_deg=half_angle
        )

        nearby_assets: List[Dict[str, Any]] = []

        for _, row in assets_gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            
            # Point centroid for asset
            a_lon = geom.x if hasattr(geom, "x") else geom.centroid.x
            a_lat = geom.y if hasattr(geom, "y") else geom.centroid.y

            dist_km = haversine_km(lat, lon, a_lat, a_lon)
            if dist_km > max_search_radius_km:
                continue

            bearing_deg = calculate_bearing(lat, lon, a_lat, a_lon)
            cardinal = deg_to_cardinal(bearing_deg)

            # Check if asset is inside downwind dispersion sector
            in_downwind_sector = (
                dist_km <= cone_length_km
                and is_angle_between(bearing_deg, downwind_bearing, half_angle)
            )

            nearby_assets.append({
                "asset_id": str(row.get("asset_id", "ASSET_000")),
                "name": str(row.get("name", "Unnamed Asset")),
                "category": str(row.get("category", "INFRASTRUCTURE")).upper(),
                "sub_type": str(row.get("sub_type", "asset")),
                "criticality": str(row.get("criticality", "MEDIUM")).upper(),
                "distance_km": dist_km,
                "bearing_deg": bearing_deg,
                "cardinal_direction": cardinal,
                "is_downwind": in_downwind_sector,
                "latitude": round(a_lat, 6),
                "longitude": round(a_lon, 6)
            })

        # Sort assets by distance ascending
        nearby_assets.sort(key=lambda x: x["distance_km"])

        # 1. Population Exposure Evaluation
        pop_assets = [a for a in nearby_assets if a["category"] == "POPULATION"]
        pop_min_dist = min([a["distance_km"] for a in pop_assets], default=999.0)
        pop_downwind = any(a["is_downwind"] for a in pop_assets if a["distance_km"] <= 4.0)

        if pop_min_dist <= 1.5 or pop_downwind:
            pop_tier = "HIGH"
        elif pop_min_dist <= 4.5:
            pop_tier = "MEDIUM"
        else:
            pop_tier = "LOW"

        # 2. Infrastructure Exposure Evaluation
        infra_assets = [a for a in nearby_assets if a["category"] == "INFRASTRUCTURE"]
        infra_min_dist = min([a["distance_km"] for a in infra_assets], default=999.0)
        infra_critical_downwind = any(
            a["is_downwind"] for a in infra_assets
            if a["criticality"] in ["CRITICAL", "HIGH"] and a["distance_km"] <= 3.0
        )

        if infra_min_dist <= 1.0 or infra_critical_downwind:
            infra_tier = "HIGH"
        elif infra_min_dist <= 3.5:
            infra_tier = "MEDIUM"
        else:
            infra_tier = "LOW"

        # 3. Environmental Exposure Evaluation
        env_assets = [a for a in nearby_assets if a["category"] == "ENVIRONMENTAL"]
        env_min_dist = min([a["distance_km"] for a in env_assets], default=999.0)
        env_downwind = any(a["is_downwind"] for a in env_assets if a["distance_km"] <= 3.0)

        if env_min_dist <= 1.0 or env_downwind:
            env_tier = "HIGH"
        elif env_min_dist <= 3.5:
            env_tier = "MEDIUM"
        else:
            env_tier = "LOW"

        # 4. Downwind Plume Sector Exposure Evaluation
        downwind_assets = [a for a in nearby_assets if a["is_downwind"]]
        if any(a["category"] == "POPULATION" or a["criticality"] == "CRITICAL" for a in downwind_assets):
            downwind_tier = "HIGH"
        elif len(downwind_assets) > 0:
            downwind_tier = "MEDIUM"
        else:
            downwind_tier = "LOW"

        # 5. Synthesize Explainable Narrative Summary
        summary_parts = []
        downwind_card = deg_to_cardinal(downwind_bearing)
        summary_parts.append(f"Plume dispersion projects {downwind_card} ({downwind_bearing:.0f}°) at {wind_spd:.1f} km/h.")

        downwind_critical = [a for a in downwind_assets if a["category"] == "POPULATION" or a["criticality"] == "CRITICAL"]
        if downwind_critical:
            target = downwind_critical[0]
            summary_parts.append(
                f"CRITICAL DOWNWIND HAZARD: {target['name']} ({target['category'].title()}) is directly in the path at {target['distance_km']:.1f} km."
            )
        elif downwind_assets:
            target = downwind_assets[0]
            summary_parts.append(
                f"Downwind zone intersects {target['name']} ({target['distance_km']:.1f} km {target['cardinal_direction']})."
            )
        else:
            summary_parts.append("Downwind impact sector currently clear of documented human or critical infrastructure.")

        if infra_min_dist <= 1.5 and infra_assets:
            closest_infra = infra_assets[0]
            summary_parts.append(f"Proximity alert: {closest_infra['name']} within {closest_infra['distance_km']:.1f} km.")

        exposure_summary = " ".join(summary_parts)

        return {
            "population_exposure": pop_tier,
            "infrastructure_exposure": infra_tier,
            "environmental_exposure": env_tier,
            "downwind_exposure": downwind_tier,
            "exposure_summary": exposure_summary,
            "nearby_assets": nearby_assets[:8],  # Top 8 most relevant assets
            "downwind_cone_geojson": cone_geojson
        }
