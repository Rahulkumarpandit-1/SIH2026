"""
Regional Corridor Registry and Spatial Tagger for India-Wide Industrial Monitoring.
Defines bounding boxes, centroids, zoom levels, and state-tagging algorithms for
all major economic corridors of India.
"""
from typing import Dict, Any, List, Optional, Tuple


# Master Registry of Monitored Industrial Regions
MONITORED_REGIONS: Dict[str, Dict[str, Any]] = {
    "ALL_INDIA": {
        "region_code": "ALL_INDIA",
        "name": "All India (National Overview)",
        "short_name": "All India",
        "states_covered": "All States & Union Territories",
        "bbox": [68.0, 8.0, 97.5, 37.5],  # [min_lon, min_lat, max_lon, max_lat]
        "center": [21.7679, 78.8718],     # [lat, lon]
        "default_zoom": 5,
        "description": "Consolidated national industrial fire telemetry across all major manufacturing and petrochemical corridors.",
        "icon": "india"
    },
    "WEST_GUJARAT": {
        "region_code": "WEST_GUJARAT",
        "name": "Gujarat Industrial Corridor",
        "short_name": "Gujarat",
        "states_covered": "Gujarat",
        "bbox": [68.5, 20.0, 74.5, 24.5],
        "center": [22.2587, 71.1924],
        "default_zoom": 7,
        "description": "Petrochemical refineries, GIDC chemical zones, and ports across Jamnagar, Hazira, Dahej, Vadodara, and Vapi.",
        "icon": "factory"
    },
    "WEST_MAHARASHTRA": {
        "region_code": "WEST_MAHARASHTRA",
        "name": "Maharashtra Industrial Belt",
        "short_name": "Maharashtra",
        "states_covered": "Maharashtra",
        "bbox": [72.5, 18.0, 75.2, 20.5],
        "center": [19.1000, 73.2000],
        "default_zoom": 8,
        "description": "MIDC petrochemical clusters, Mumbai refineries (BPCL/HPCL), Taloja, Tarapur, Rasayani, and Thane-Belapur corridor.",
        "icon": "refinery"
    },
    "NORTH_NCR": {
        "region_code": "NORTH_NCR",
        "name": "NCR Industrial Corridor",
        "short_name": "NCR / North",
        "states_covered": "Delhi, Haryana, Uttar Pradesh, Rajasthan",
        "bbox": [76.0, 27.2, 78.5, 29.8],
        "center": [28.4000, 77.1000],
        "default_zoom": 8,
        "description": "Panipat Petrochemical Complex, Mathura Refinery, Neemrana, Manesar, and Bhiwadi industrial hubs.",
        "icon": "building"
    },
    "EAST_MINERAL_BELT": {
        "region_code": "EAST_MINERAL_BELT",
        "name": "Eastern Steel & Mineral Belt",
        "short_name": "Eastern Corridor",
        "states_covered": "Odisha, Jharkhand, West Bengal, Chhattisgarh",
        "bbox": [80.5, 19.5, 89.0, 25.0],
        "center": [22.0000, 85.0000],
        "default_zoom": 7,
        "description": "Paradip PCPIR, Haldia Petrochemicals, Tata Steel Jamshedpur, Rourkela, Bhilai, and Bokaro metallurgical complexes.",
        "icon": "steel"
    },
    "SOUTH_CORRIDOR": {
        "region_code": "SOUTH_CORRIDOR",
        "name": "Southern Industrial Corridor",
        "short_name": "Southern Corridor",
        "states_covered": "Tamil Nadu, Karnataka, Andhra Pradesh, Kerala",
        "bbox": [74.0, 8.2, 84.0, 18.2],
        "center": [13.5000, 78.5000],
        "default_zoom": 7,
        "description": "CPCL Manali Refinery, BPCL Kochi, MRPL Mangalore, Visakhapatnam, Ennore, and Bengaluru industrial parks.",
        "icon": "port"
    }
}


def get_all_regions() -> List[Dict[str, Any]]:
    """Returns list of all configured monitored regions."""
    return list(MONITORED_REGIONS.values())


def get_region_by_code(region_code: str) -> Optional[Dict[str, Any]]:
    """Retrieves region metadata by code (case-insensitive)."""
    if not region_code:
        return None
    code_norm = region_code.strip().upper()
    return MONITORED_REGIONS.get(code_norm)


def tag_coordinates(lat: float, lon: float) -> Tuple[str, str]:
    """
    Spatially tags an observation (lat, lon) with its Indian State and Region Code.
    Evaluates specific regional bounding boxes first, defaulting to General India quadrants.
    Returns: (state_name, region_code)
    """
    # 1. Check Gujarat Corridor
    if 20.0 <= lat <= 24.5 and 68.5 <= lon <= 74.5:
        return "Gujarat", "WEST_GUJARAT"

    # 2. Check Maharashtra Corridor
    if 18.0 <= lat <= 20.5 and 72.5 <= lon <= 75.2:
        return "Maharashtra", "WEST_MAHARASHTRA"

    # 3. Check NCR / Northern Corridor
    if 27.2 <= lat <= 29.8 and 76.0 <= lon <= 78.5:
        if lat >= 29.0:
            return "Haryana", "NORTH_NCR"
        elif lon >= 77.3:
            return "Uttar Pradesh", "NORTH_NCR"
        elif lon < 76.8:
            return "Rajasthan", "NORTH_NCR"
        return "Delhi NCR", "NORTH_NCR"

    # 4. Check Eastern Steel & Mineral Belt (Odisha, Jharkhand, West Bengal, Chhattisgarh)
    if 19.5 <= lat <= 25.0 and 80.5 <= lon <= 89.0:
        if lon >= 87.0:
            return "West Bengal", "EAST_MINERAL_BELT"
        elif lat >= 22.2 and lon >= 84.5:
            return "Jharkhand", "EAST_MINERAL_BELT"
        elif lon < 83.2:
            return "Chhattisgarh", "EAST_MINERAL_BELT"
        return "Odisha", "EAST_MINERAL_BELT"

    # 5. Check Southern Corridor (Tamil Nadu, Karnataka, Andhra Pradesh, Kerala)
    if 8.2 <= lat <= 18.2 and 74.0 <= lon <= 84.0:
        if lon >= 79.2 and lat < 13.8:
            return "Tamil Nadu", "SOUTH_CORRIDOR"
        elif lon < 77.2 and lat < 11.5:
            return "Kerala", "SOUTH_CORRIDOR"
        elif lat >= 14.0 or lon >= 81.0:
            return "Andhra Pradesh", "SOUTH_CORRIDOR"
        return "Karnataka", "SOUTH_CORRIDOR"

    # Broad geographic state fallbacks based on India quadrants
    if lat > 28.0:
        return "Northern India", "ALL_INDIA"
    elif lat < 15.0:
        return "Southern India", "ALL_INDIA"
    elif lon > 84.0:
        return "Eastern India", "ALL_INDIA"
    elif lon < 74.0:
        return "Western India", "ALL_INDIA"
    return "Central India", "ALL_INDIA"
