import math
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon
from shapely.ops import nearest_points

from app.core.logging import logger


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on the Earth
    in meters using the Haversine formula.
    """
    R = 6371000.0  # Earth's mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class SpatialProximityEngine:
    """
    High-performance engine for spatial proximity analysis between satellite hotspots (points)
    and OpenStreetMap industrial zones/facilities (polygons & points) using R-tree spatial indexing.
    """

    def __init__(self, industrial_gdf: gpd.GeoDataFrame):
        self.industrial_gdf = industrial_gdf
        if self.industrial_gdf.empty:
            logger.warning("SpatialProximityEngine initialized with empty industrial GeoDataFrame.")
            self.sindex = None
        else:
            if self.industrial_gdf.crs is None:
                self.industrial_gdf = self.industrial_gdf.set_crs(epsg=4326)
            self.sindex = self.industrial_gdf.sindex

    def find_nearest_facility(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Determines if a hotspot coordinate is inside an industrial polygon,
        or calculates the shortest geodesic distance (in meters) to the nearest facility boundary.
        """
        if self.industrial_gdf.empty or self.sindex is None:
            return {
                "in_industrial_zone": False,
                "distance_to_industry_meters": float("inf"),
                "nearest_facility_name": "No OSM data available",
                "nearest_facility_type": "unknown",
                "osm_id": None,
                "spatial_context": "UNKNOWN_NO_OSM_DATA",
                "proximity_risk_factor": 0.1
            }

        hotspot_point = Point(lon, lat)
        
        # 1. Fast R-tree point-in-polygon query (microseconds)
        candidate_intersect_idx = self.sindex.query(hotspot_point, predicate="intersects")
        if len(candidate_intersect_idx) > 0:
            row = self.industrial_gdf.iloc[candidate_intersect_idx[0]]
            return {
                "in_industrial_zone": True,
                "distance_to_industry_meters": 0.0,
                "nearest_facility_name": str(row.get("name", "Unnamed Facility")),
                "nearest_facility_type": str(row.get("industrial", row.get("landuse", "industrial"))),
                "osm_id": str(row.get("osm_id", "unknown")),
                "spatial_context": "INSIDE_INDUSTRIAL_ZONE",
                "proximity_risk_factor": 1.0
            }

        # 2. Fast nearest candidates query using spatial index
        try:
            nearest_indices = self.sindex.nearest(hotspot_point, max_distance=None, return_distance=False)
            if hasattr(nearest_indices, "ndim") and nearest_indices.ndim == 2:
                candidate_indices = nearest_indices[1]
            elif isinstance(nearest_indices, (list, tuple, pd.Series)):
                candidate_indices = nearest_indices
            else:
                candidate_indices = [nearest_indices]
            
            candidate_gdf = self.industrial_gdf.iloc[candidate_indices]
        except Exception:
            candidate_gdf = self.industrial_gdf

        min_dist = float("inf")
        nearest_row = None

        for _, row in candidate_gdf.iterrows():
            geom = row["geometry"]
            if isinstance(geom, Polygon):
                target_geom = geom.exterior
            else:
                target_geom = geom

            nearest_pt_on_geom, _ = nearest_points(target_geom, hotspot_point)
            dist_meters = haversine_distance(lat, lon, nearest_pt_on_geom.y, nearest_pt_on_geom.x)

            if dist_meters < min_dist:
                min_dist = dist_meters
                nearest_row = row

        min_dist_rounded = round(min_dist, 1)

        # Categorize spatial context based on distance thresholds
        if min_dist_rounded <= 1000.0:
            spatial_context = "NEARBY_INDUSTRIAL_BUFFER"
            risk_factor = 0.8
        elif min_dist_rounded <= 5000.0:
            spatial_context = "VICINITY_ZONE"
            risk_factor = 0.4
        else:
            spatial_context = "NON_INDUSTRIAL_RURAL"
            risk_factor = 0.1

        return {
            "in_industrial_zone": False,
            "distance_to_industry_meters": min_dist_rounded,
            "nearest_facility_name": str(nearest_row.get("name", "Unnamed Facility")) if nearest_row is not None else "None",
            "nearest_facility_type": str(nearest_row.get("industrial", nearest_row.get("landuse", "industrial"))) if nearest_row is not None else "none",
            "osm_id": str(nearest_row.get("osm_id", "unknown")) if nearest_row is not None else None,
            "spatial_context": spatial_context,
            "proximity_risk_factor": risk_factor
        }

    def enrich_observations_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Takes a DataFrame of FIRMS observations (with 'latitude', 'longitude' columns)
        and appends OSM contextual features to each row.
        """
        if df.empty:
            return df

        enriched_rows = []
        for _, row in df.iterrows():
            lat = float(row["latitude"])
            lon = float(row["longitude"])
            spatial_meta = self.find_nearest_facility(lat, lon)
            
            combined = row.to_dict()
            combined.update(spatial_meta)
            enriched_rows.append(combined)

        return pd.DataFrame(enriched_rows)
