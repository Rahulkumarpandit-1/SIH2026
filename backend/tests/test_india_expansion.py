"""
Unit and integration tests for Phase 11A India-Wide Expansion.
Tests regional corridor registry, spatial coordinate tagging, national industrial baselines,
multi-region exposure assets, and API regional filtering.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.regions import MONITORED_REGIONS, get_all_regions, get_region_by_code, tag_coordinates
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
from app.spatial.exposure_engine import ExposureAnalysisService


client = TestClient(app)


def test_monitored_regions_registry():
    """Verifies that all 6 required economic corridors of India are registered."""
    regions = get_all_regions()
    assert len(regions) >= 6

    expected_codes = {
        "ALL_INDIA",
        "WEST_GUJARAT",
        "WEST_MAHARASHTRA",
        "NORTH_NCR",
        "EAST_MINERAL_BELT",
        "SOUTH_CORRIDOR"
    }
    actual_codes = {r["region_code"] for r in regions}
    assert expected_codes.issubset(actual_codes)

    # Check structural integrity of each region
    for r in regions:
        assert len(r["bbox"]) == 4
        assert r["bbox"][0] < r["bbox"][2], f"Min lon should be < max lon in {r['region_code']}"
        assert r["bbox"][1] < r["bbox"][3], f"Min lat should be < max lat in {r['region_code']}"
        assert len(r["center"]) == 2
        assert 3 <= r["default_zoom"] <= 12


def test_tag_coordinates_across_india():
    """Verifies that coordinates across distinct Indian states are accurately tagged."""
    # Gujarat - Jamnagar Refinery
    state, reg = tag_coordinates(22.45, 70.04)
    assert state == "Gujarat"
    assert reg == "WEST_GUJARAT"

    # Maharashtra - BPCL Mahul Mumbai
    state, reg = tag_coordinates(19.01, 72.90)
    assert state == "Maharashtra"
    assert reg == "WEST_MAHARASHTRA"

    # Haryana - IOCL Panipat
    state, reg = tag_coordinates(29.41, 76.92)
    assert state == "Haryana"
    assert reg == "NORTH_NCR"

    # Odisha - IOCL Paradip
    state, reg = tag_coordinates(20.29, 86.63)
    assert state == "Odisha"
    assert reg == "EAST_MINERAL_BELT"

    # Tamil Nadu - CPCL Manali Chennai
    state, reg = tag_coordinates(13.16, 80.27)
    assert state == "Tamil Nadu"
    assert reg == "SOUTH_CORRIDOR"

    # Kerala - BPCL Kochi
    state, reg = tag_coordinates(9.98, 76.36)
    assert state == "Kerala"
    assert reg == "SOUTH_CORRIDOR"


def test_national_facility_fingerprints():
    """Verifies historical baseline retrieval and fuzzy matching for national hubs."""
    baselines = FacilityFingerprintEngine.KNOWN_BASELINES
    assert len(baselines) >= 20

    # Test key national complexes exist
    assert "Jamnagar Petroleum Refining Complex" in baselines
    assert "BPCL Mumbai Refinery (Mahul)" in baselines
    assert "IOCL Panipat Petrochemical Complex" in baselines
    assert "IOCL Paradip Refinery Complex" in baselines
    assert "Tata Steel Jamshedpur Works" in baselines
    assert "CPCL Manali Refinery Complex" in baselines

    # Test fuzzy keyword matching
    p_mumbai = FacilityFingerprintEngine.get_facility_profile("BPCL Mumbai Mahul Refinery Unit 4")
    assert "Mumbai" in p_mumbai["facility_name"]
    assert p_mumbai["region_code"] == "WEST_MAHARASHTRA"

    p_panipat = FacilityFingerprintEngine.get_facility_profile("Panipat Naphtha Cracker")
    assert "Panipat" in p_panipat["facility_name"]
    assert p_panipat["region_code"] == "NORTH_NCR"

    p_tata = FacilityFingerprintEngine.get_facility_profile("Tata Steel Blast Furnace #1")
    assert "Tata Steel" in p_tata["facility_name"]
    assert p_tata["region_code"] == "EAST_MINERAL_BELT"

    p_cpcl = FacilityFingerprintEngine.get_facility_profile("CPCL Manali Crude Distillation Unit")
    assert "Manali" in p_cpcl["facility_name"]
    assert p_cpcl["region_code"] == "SOUTH_CORRIDOR"


def test_abnormality_evaluation_national_hub():
    """Verifies that the Abnormality Engine correctly evaluates national facilities."""
    res = FacilityFingerprintEngine.evaluate_incident_fingerprint(
        facility_name="BPCL Mumbai Refinery (Mahul)",
        current_frp=85.0
    )
    assert res["anomaly_ratio"] > 4.0
    assert res["thermal_status"] == "CRITICAL"
    assert "CRITICAL THERMAL EXCURSION" in res["explanation"]


def test_exposure_assets_multi_region():
    """Verifies that the Exposure Engine loads assets across multiple states."""
    gdf = ExposureAnalysisService.load_assets(force_reload=True)
    assert not gdf.empty
    assert len(gdf) >= 30

    if "region_code" in gdf.columns:
        regions_found = set(gdf["region_code"].unique())
        assert "WEST_GUJARAT" in regions_found
        assert "WEST_MAHARASHTRA" in regions_found
        assert "NORTH_NCR" in regions_found
        assert "EAST_MINERAL_BELT" in regions_found
        assert "SOUTH_CORRIDOR" in regions_found


def test_api_regions_endpoint():
    """Verifies GET /api/regions endpoint."""
    response = client.get("/api/regions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 6
    codes = [r["region_code"] for r in data]
    assert "WEST_GUJARAT" in codes
    assert "WEST_MAHARASHTRA" in codes
    assert "ALL_INDIA" in codes


def test_api_facilities_endpoint():
    """Verifies GET /api/facilities with optional region filtering."""
    res_all = client.get("/api/facilities")
    assert res_all.status_code == 200
    all_facs = res_all.json()
    assert len(all_facs) >= 20

    res_mah = client.get("/api/facilities?region=WEST_MAHARASHTRA")
    assert res_mah.status_code == 200
    mah_facs = res_mah.json()
    assert len(mah_facs) >= 3
    for f in mah_facs:
        assert f["region_code"] == "WEST_MAHARASHTRA"


def test_api_exposure_assets_endpoint():
    """Verifies GET /api/exposure-assets endpoint."""
    response = client.get("/api/exposure-assets")
    assert response.status_code == 200
    assets = response.json()
    assert isinstance(assets, list)
    assert len(assets) >= 30

    # Filter by category
    res_pop = client.get("/api/exposure-assets?category=POPULATION")
    assert res_pop.status_code == 200
    pop_assets = res_pop.json()
    assert len(pop_assets) > 0
    for a in pop_assets:
        assert a["category"] == "POPULATION"


def test_api_summary_with_region_filter():
    """Verifies GET /api/summary with region parameter."""
    res_all = client.get("/api/summary?region=ALL_INDIA")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert "total_observations" in data_all

    res_guj = client.get("/api/summary?region=WEST_GUJARAT")
    assert res_guj.status_code == 200
    data_guj = res_guj.json()
    assert "total_observations" in data_guj
