import os
import json
from typing import List, Optional, Dict, Any, Tuple
import httpx
import geopandas as gpd
from shapely.geometry import Point, Polygon
from app.core.config import settings
from app.core.logging import logger


class OSMClient:
    """
    Client for querying OpenStreetMap (OSM) via Overpass API for industrial land-use,
    refineries, chemical plants, and flares. Supports local GeoJSON caching and offline fallback.
    """

    OVERPASS_ENDPOINTS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    ]

    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir:
            self.cache_dir = cache_dir
        else:
            p1 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "osm_cache"))
            p2 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "osm_cache"))
            if os.path.exists(p1):
                self.cache_dir = p1
            elif os.path.exists(p2):
                self.cache_dir = p2
            else:
                self.cache_dir = p1
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_filepath(self, bbox: List[float]) -> str:
        """Generates a consistent filename based on bounding box coordinates."""
        bbox_slug = f"osm_{bbox[0]:.2f}_{bbox[1]:.2f}_{bbox[2]:.2f}_{bbox[3]:.2f}.geojson"
        return os.path.join(self.cache_dir, bbox_slug)

    def load_cached_geojson(self, filepath: str) -> gpd.GeoDataFrame:
        """Loads industrial features directly from a GeoJSON file into a GeoDataFrame."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"OSM GeoJSON file not found at: {filepath}")
        
        logger.info(f"Loading OSM industrial features from local cache: {filepath}")
        gdf = gpd.read_file(filepath)
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326)
        return gdf

    def fetch_industrial_features(
        self,
        bbox: Optional[List[float]] = None,
        use_cache: bool = True
    ) -> gpd.GeoDataFrame:
        """
        Fetches industrial features within bounding box [min_lon, min_lat, max_lon, max_lat].
        Uses cached GeoJSON if available to avoid unnecessary API queries.
        """
        bbox = bbox or settings.default_bbox
        min_lon, min_lat, max_lon, max_lat = bbox
        cache_file = self._get_cache_filepath(bbox)

        # 1. Check local cache first
        if use_cache and os.path.exists(cache_file):
            logger.info(f"Using cached OSM data for bbox {bbox} from: {cache_file}")
            return self.load_cached_geojson(cache_file)

        # 2. Overpass QL Query
        # Note Overpass bbox syntax is: (south, west, north, east) -> (min_lat, min_lon, max_lat, max_lon)
        overpass_query = f"""
        [out:json][timeout:25];
        (
          way["landuse"="industrial"]({min_lat},{min_lon},{max_lat},{max_lon});
          relation["landuse"="industrial"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["industrial"]({min_lat},{min_lon},{max_lat},{max_lon});
          node["man_made"="flare"]({min_lat},{min_lon},{max_lat},{max_lon});
          way["man_made"="storage_tank"]({min_lat},{min_lon},{max_lat},{max_lon});
        );
        out body;
        >;
        out skel qt;
        """

        logger.info(f"Querying Overpass API for industrial geometries in bbox: {bbox}")
        
        for endpoint in self.OVERPASS_ENDPOINTS:
            try:
                with httpx.Client(timeout=35.0) as client:
                    response = client.post(endpoint, data={"data": overpass_query})
                    if response.status_code == 200:
                        data = response.json()
                        gdf = self._parse_overpass_json(data)
                        if not gdf.empty:
                            # Save to cache
                            gdf.to_file(cache_file, driver="GeoJSON")
                            logger.info(f"Successfully fetched & cached {len(gdf)} OSM industrial features.")
                            return gdf
            except Exception as e:
                logger.warning(f"Overpass endpoint {endpoint} failed: {str(e)}. Trying next...")

        # 3. Fallback to sample fixture if API calls fail
        sample_path = os.path.join(self.cache_dir, "sample_gujarat_industrial.geojson")
        if os.path.exists(sample_path):
            logger.warning("Overpass API unavailable. Falling back to verified local sample dataset.")
            return self.load_cached_geojson(sample_path)

        # If nothing available, return empty GeoDataFrame with EPSG:4326
        logger.error("Failed to retrieve OSM data from API and no local cache was found.")
        return gpd.GeoDataFrame(
            columns=["osm_id", "name", "landuse", "industrial", "geometry"],
            crs="EPSG:4326"
        )

    def _parse_overpass_json(self, data: Dict[str, Any]) -> gpd.GeoDataFrame:
        """
        Parses Overpass API JSON response (nodes, ways) into a GeoPandas GeoDataFrame.
        """
        elements = data.get("elements", [])
        nodes_dict: Dict[int, Tuple[float, float]] = {}
        features: List[Dict[str, Any]] = []

        # First pass: collect node coordinates
        for el in elements:
            if el.get("type") == "node" and "lat" in el and "lon" in el:
                nodes_dict[el["id"]] = (el["lon"], el["lat"])

        # Second pass: construct polygons from ways and point nodes
        for el in elements:
            el_type = el.get("type")
            tags = el.get("tags", {})
            osm_id = f"{el_type}/{el.get('id')}"
            name = tags.get("name", "Unnamed Industrial Facility")
            landuse = tags.get("landuse", "industrial")
            industrial_type = tags.get("industrial", tags.get("man_made", "general_industry"))

            if el_type == "way" and "nodes" in el:
                coords = [nodes_dict[nid] for nid in el["nodes"] if nid in nodes_dict]
                if len(coords) >= 3:
                    try:
                        poly = Polygon(coords)
                        if poly.is_valid:
                            features.append({
                                "osm_id": osm_id,
                                "name": name,
                                "landuse": landuse,
                                "industrial": industrial_type,
                                "geometry": poly
                            })
                    except Exception:
                        pass
            elif el_type == "node" and "tags" in el:
                lon, lat = el.get("lon"), el.get("lat")
                if lon is not None and lat is not None:
                    features.append({
                        "osm_id": osm_id,
                        "name": name,
                        "landuse": landuse,
                        "industrial": industrial_type,
                        "geometry": Point(lon, lat)
                    })

        if not features:
            return gpd.GeoDataFrame(columns=["osm_id", "name", "landuse", "industrial", "geometry"], crs="EPSG:4326")

        return gpd.GeoDataFrame(features, crs="EPSG:4326")
