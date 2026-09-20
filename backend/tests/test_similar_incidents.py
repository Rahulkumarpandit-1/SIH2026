"""
Unit Tests for Phase 13C — Similar Incidents Engine
"""

import pytest
from app.db.session import SessionLocal
from app.db.db_models import IncidentRecordModel
from app.intelligence.similar_incidents import SimilarIncidentsEngine


def test_calculate_pair_similarity():
    """Verify pair similarity calculation across 6 normalized features."""
    target = {
        "risk_score": 85.0,
        "peak_frp": 95.0,
        "abnormality_score": 88.0,
        "thermal_anomaly_ratio": 4.5,
        "persistence": 8,
        "facility_type": "Refinery & Petrochemical Complex"
    }

    # Nearly identical candidate
    candidate_close = {
        "risk_score": 82.0,
        "peak_frp": 90.0,
        "abnormality_score": 85.0,
        "thermal_anomaly_ratio": 4.2,
        "persistence": 7,
        "facility_type": "Refinery & Petrochemical Complex"
    }

    # Very different candidate
    candidate_far = {
        "risk_score": 25.0,
        "peak_frp": 8.0,
        "abnormality_score": 15.0,
        "thermal_anomaly_ratio": 0.8,
        "persistence": 1,
        "facility_type": "Pharmaceuticals & Agrochemicals"
    }

    res_close = SimilarIncidentsEngine.calculate_pair_similarity(target, candidate_close)
    res_far = SimilarIncidentsEngine.calculate_pair_similarity(target, candidate_far)

    assert res_close["similarity_score"] >= 0.85
    assert res_far["similarity_score"] < 0.60
    assert "risk_similarity" in res_close["breakdown"]
    assert "frp_similarity" in res_close["breakdown"]


def test_find_similar_incidents_in_db():
    """Verify finding top similar incidents for an existing incident in DB."""
    from app.api.service import PipelineService
    db = SessionLocal()
    try:
        # Sync clusters into incidents table
        PipelineService.get_analyzed_data(db)
        first_inc = db.query(IncidentRecordModel).first()
        assert first_inc is not None, "Incidents should be registered after pipeline analysis"

        result = SimilarIncidentsEngine.find_similar_incidents(db, first_inc.incident_uuid, top_k=5)
        assert result["incident_uuid"] == first_inc.incident_uuid
        assert "similar_incidents" in result
        similar = result["similar_incidents"]

        # Ensure target incident itself is not in similar list
        assert all(s["incident_uuid"] != first_inc.incident_uuid for s in similar)

        # Ensure sorted descending by similarity score
        scores = [s["similarity_score"] for s in similar]
        assert scores == sorted(scores, reverse=True)
    finally:
        db.close()
