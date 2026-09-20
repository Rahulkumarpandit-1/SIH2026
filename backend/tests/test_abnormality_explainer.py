"""
Unit Tests for Phase 13B — Abnormality Explanation Engine
"""

import pytest
from app.intelligence.abnormality_explainer import AbnormalityExplainer


def test_abnormality_explainer_with_explicit_points():
    """Verify points breakdown matching Phase 13 prompt example (38/40, 21/25, 18/20, 14/15 -> 91)."""
    result = AbnormalityExplainer.explain_abnormality(
        facility_name="Reliance Jamnagar Refinery",
        intensity_points=38.0,
        growth_points=21.0,
        persistence_points=18.0,
        recurrence_points=14.0
    )

    assert result["abnormality_score"] == 91.0
    assert result["abnormality_status"] == "SEVERELY_ABNORMAL"

    components = result["components"]
    assert len(components) == 4

    c_map = {c["name"]: c for c in components}
    assert c_map["Heat Intensity"]["points"] == 38.0
    assert c_map["Heat Intensity"]["max_points"] == 40.0

    assert c_map["Thermal Growth"]["points"] == 21.0
    assert c_map["Thermal Growth"]["max_points"] == 25.0

    assert c_map["Persistence"]["points"] == 18.0
    assert c_map["Persistence"]["max_points"] == 20.0

    assert c_map["Recurrence"]["points"] == 14.0
    assert c_map["Recurrence"]["max_points"] == 15.0

    # Check plain-language explanation
    explanation = result["plain_language_explanation"]
    assert "SEVERELY_ABNORMAL" in explanation
    assert "Heat Intensity" in explanation
    assert "Reliance Jamnagar Refinery" in explanation


def test_abnormality_explainer_from_raw_telemetry():
    """Verify abnormality explainer computes components from raw telemetry."""
    result = AbnormalityExplainer.explain_abnormality(
        facility_name="IOCL Panipat Refinery",
        current_frp=15.0,
        avg_frp=14.0,
        active_days=1,
        total_detections=1,
        is_anomaly_spike=False
    )

    assert result["abnormality_status"] in ["NORMAL", "ELEVATED"]
    assert len(result["components"]) == 4
    for c in result["components"]:
        assert c["points"] <= c["max_points"]
        assert c["score"] >= 0.0
    assert len(result["plain_language_explanation"]) > 20
