import pytest
import pandas as pd
from app.scoring.risk_engine import RiskScoringEngine


def test_thermal_subscore_bounds():
    """Verify thermal sub-score scales accurately from 0 to 100."""
    # Zero power and background temperature
    assert RiskScoringEngine.compute_thermal_subscore(0.0, 300.0) == 0.0

    # 100 MW and 390K temperature should produce 100.0
    assert RiskScoringEngine.compute_thermal_subscore(100.0, 390.0) == 100.0

    # 50 MW and 350K temperature (midpoint)
    # S_frp = 50.0, S_temp = 50.0 -> S_thermal = 50.0
    assert RiskScoringEngine.compute_thermal_subscore(50.0, 350.0) == 50.0


def test_proximity_subscore_decay():
    """Verify proximity sub-score decays with distance from industrial boundary."""
    # Inside facility fence
    assert RiskScoringEngine.compute_proximity_subscore(0.0) == 100.0

    # 500m buffer
    s_500m = RiskScoringEngine.compute_proximity_subscore(500.0)
    assert 50.0 < s_500m < 100.0

    # 1000m fence limit
    assert RiskScoringEngine.compute_proximity_subscore(1000.0) == 20.0

    # Remote rural (> 5000m)
    assert RiskScoringEngine.compute_proximity_subscore(40000.0) == 5.0


def test_hazira_sudden_spike_scores_critical():
    """Verify that Hazira sudden massive fire (92.7 MW, acute spike) is ranked CRITICAL."""
    res = RiskScoringEngine.calculate_composite_risk(
        frp=92.7,
        brightness=388.9,
        distance_to_industry_meters=0.0,
        persistence_ratio=0.20,
        is_anomaly_spike=True,
        confidence_normalized=0.95
    )

    assert res["risk_score"] >= 80.0
    assert res["risk_level"] == "CRITICAL"
    assert res["classification"] == "INDUSTRIAL_FIRE_OUTBREAK"
    assert res["action_code"] == "EMERGENCY_DISPATCH"


def test_jamnagar_routine_flare_scores_moderate():
    """Verify that Jamnagar continuous refinery flare is ranked MODERATE."""
    res = RiskScoringEngine.calculate_composite_risk(
        frp=29.1,
        brightness=368.7,
        distance_to_industry_meters=0.0,
        persistence_ratio=1.00,
        is_anomaly_spike=False,
        confidence_normalized=0.85
    )

    assert 30.0 <= res["risk_score"] < 60.0
    assert res["risk_level"] == "MODERATE"
    assert res["classification"] == "PERSISTENT_OPERATIONAL_SOURCE"
    assert res["action_code"] == "ROUTINE_MONITORING"


def test_rural_agricultural_burn_scores_low():
    """Verify that remote farm burn (>35km away, 5.6 MW) is ranked LOW."""
    res = RiskScoringEngine.calculate_composite_risk(
        frp=5.6,
        brightness=335.2,
        distance_to_industry_meters=39256.0,
        persistence_ratio=0.20,
        is_anomaly_spike=False,
        confidence_normalized=0.60
    )

    assert res["risk_score"] < 30.0
    assert res["risk_level"] == "LOW"
    assert res["classification"] == "NON_INDUSTRIAL_RURAL"
    assert res["action_code"] == "BACKGROUND_LOG"


def test_cluster_dataframe_scoring_and_sorting():
    """Verify that scoring a DataFrame of clusters ranks the highest risk incident at index 0."""
    df_clusters = pd.DataFrame([
        {
            "cluster_id": "CLUSTER_RURAL",
            "max_frp": 5.6,
            "max_brightness": 335.2,
            "distance_to_industry_meters": 39256.0,
            "persistence_ratio": 0.20,
            "is_anomaly_spike": False
        },
        {
            "cluster_id": "CLUSTER_HAZIRA",
            "max_frp": 92.7,
            "max_brightness": 388.9,
            "distance_to_industry_meters": 0.0,
            "persistence_ratio": 0.20,
            "is_anomaly_spike": True
        },
        {
            "cluster_id": "CLUSTER_JAMNAGAR",
            "max_frp": 29.1,
            "max_brightness": 368.7,
            "distance_to_industry_meters": 0.0,
            "persistence_ratio": 1.00,
            "is_anomaly_spike": False
        }
    ])

    scored_df = RiskScoringEngine.score_clusters_dataframe(df_clusters)

    assert len(scored_df) == 3
    # Top ranked item must be the Hazira critical outbreak
    assert scored_df.iloc[0]["cluster_id"] == "CLUSTER_HAZIRA"
    assert scored_df.iloc[0]["risk_level"] == "CRITICAL"
    # Second item must be Jamnagar moderate flare
    assert scored_df.iloc[1]["cluster_id"] == "CLUSTER_JAMNAGAR"
    assert scored_df.iloc[1]["risk_level"] == "MODERATE"
    # Bottom item must be rural low risk
    assert scored_df.iloc[2]["cluster_id"] == "CLUSTER_RURAL"
    assert scored_df.iloc[2]["risk_level"] == "LOW"
