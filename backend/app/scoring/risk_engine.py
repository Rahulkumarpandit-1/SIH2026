from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
from app.core.logging import logger


class RiskScoringEngine:
    """
    Transparent, explainable multi-signal risk scoring and incident prioritization engine.
    Fuses thermal intensity (FIRMS), land-use proximity (OSM), temporal persistence (History),
    and sensor quality into a normalized 0-100 composite Risk Score.
    """

    # Weights configured per Phase 4 Technical Design Document (sum to 1.00)
    WEIGHT_THERMAL: float = 0.35
    WEIGHT_PROXIMITY: float = 0.30
    WEIGHT_PERSISTENCE: float = 0.25
    WEIGHT_CONFIDENCE: float = 0.10

    @staticmethod
    def compute_thermal_subscore(frp: float, brightness: float) -> float:
        """
        Computes thermal sub-score S_thermal in [0.0, 100.0] based on FRP (MW) and Brightness Temp (K).
        """
        frp_val = max(0.0, float(frp))
        temp_val = max(0.0, float(brightness))

        # FRP sub-score: 0 to 100 MW linearly mapped to 0 to 100
        s_frp = min(100.0, frp_val)

        # Temperature sub-score: 310K (37 C) to 390K (117 C) mapped to 0 to 100
        s_temp = min(100.0, max(0.0, (temp_val - 310.0) / (390.0 - 310.0) * 100.0))

        # 70% FRP power + 30% pixel temperature
        s_thermal = 0.70 * s_frp + 0.30 * s_temp
        return round(float(s_thermal), 2)

    @staticmethod
    def compute_proximity_subscore(distance_to_industry_meters: float) -> float:
        """
        Computes proximity sub-score S_prox in [0.0, 100.0] based on distance to nearest industrial facility.
        """
        d = max(0.0, float(distance_to_industry_meters))

        if d == 0.0:
            s_prox = 100.0  # Directly inside industrial facility
        elif d <= 1000.0:
            # Immediate hazard buffer (1m to 1000m -> 100 to 20 score)
            s_prox = 80.0 * (1.0 - (d / 1000.0)) + 20.0
        elif d <= 5000.0:
            # Industrial vicinity corridor (1000m to 5000m -> 20 to 0 score)
            s_prox = 20.0 * (1.0 - ((d - 1000.0) / 4000.0))
        else:
            s_prox = 5.0  # Remote non-industrial rural

        return round(float(s_prox), 2)

    @staticmethod
    def compute_persistence_subscore(
        persistence_ratio: float,
        is_anomaly_spike: bool,
        total_detections: int = 1
    ) -> float:
        """
        Computes persistence & anomaly sub-score S_pers in [0.0, 100.0].
        Penalizes sudden surprise fires; discounts routine operational daily flares.
        """
        p_ratio = max(0.0, min(1.0, float(persistence_ratio)))

        if is_anomaly_spike:
            if p_ratio < 0.4:
                s_pers = 95.0  # Acute sudden anomaly spike
            else:
                s_pers = 85.0  # Persistent source flare blowout
        elif p_ratio >= 0.5:
            s_pers = 20.0  # Continuous persistent operational source (routine flare)
        elif p_ratio >= 0.2:
            s_pers = 40.0  # Recurring intermittent source
        else:
            s_pers = 25.0  # Single transient detection (no spike)

        return round(float(s_pers), 2)

    @staticmethod
    def compute_confidence_subscore(confidence_normalized: float) -> float:
        """
        Computes sensor quality sub-score S_conf in [0.0, 100.0].
        """
        c_norm = max(0.0, min(1.0, float(confidence_normalized)))
        return round(float(c_norm * 100.0), 2)

    @classmethod
    def calculate_composite_risk(
        cls,
        frp: float,
        brightness: float,
        distance_to_industry_meters: float,
        persistence_ratio: float,
        is_anomaly_spike: bool,
        confidence_normalized: float = 0.8
    ) -> Dict[str, Any]:
        """
        Calculates the complete explainable composite risk profile for a thermal event.
        """
        s_thermal = cls.compute_thermal_subscore(frp, brightness)
        s_prox = cls.compute_proximity_subscore(distance_to_industry_meters)
        s_pers = cls.compute_persistence_subscore(persistence_ratio, is_anomaly_spike)
        s_conf = cls.compute_confidence_subscore(confidence_normalized)

        composite_score = (
            cls.WEIGHT_THERMAL * s_thermal
            + cls.WEIGHT_PROXIMITY * s_prox
            + cls.WEIGHT_PERSISTENCE * s_pers
            + cls.WEIGHT_CONFIDENCE * s_conf
        )
        composite_score = round(min(100.0, max(0.0, float(composite_score))), 2)

        # Determine Risk Level and Operational Category
        if composite_score >= 80.0:
            risk_level = "CRITICAL"
            classification = "INDUSTRIAL_FIRE_OUTBREAK"
            action_code = "EMERGENCY_DISPATCH"
        elif composite_score >= 60.0:
            risk_level = "HIGH"
            classification = "ABNORMAL_INDUSTRIAL_HEAT"
            action_code = "PRIORITY_INSPECTION"
        elif composite_score >= 30.0:
            risk_level = "MODERATE"
            classification = "PERSISTENT_OPERATIONAL_SOURCE" if persistence_ratio >= 0.5 else "RECURRING_INTERMITTENT_HEAT"
            action_code = "ROUTINE_MONITORING"
        else:
            risk_level = "LOW"
            classification = "NON_INDUSTRIAL_RURAL"
            action_code = "BACKGROUND_LOG"

        return {
            "risk_score": composite_score,
            "risk_level": risk_level,
            "classification": classification,
            "action_code": action_code,
            "subscores": {
                "thermal_subscore": s_thermal,
                "proximity_subscore": s_prox,
                "persistence_subscore": s_pers,
                "confidence_subscore": s_conf
            },
            "weights": {
                "w_thermal": cls.WEIGHT_THERMAL,
                "w_proximity": cls.WEIGHT_PROXIMITY,
                "w_persistence": cls.WEIGHT_PERSISTENCE,
                "w_confidence": cls.WEIGHT_CONFIDENCE
            }
        }

    @classmethod
    def score_clusters_dataframe(cls, cluster_summary_df: pd.DataFrame) -> pd.DataFrame:
        """
        Enriches a cluster summary DataFrame with composite risk scores and classifications.
        """
        if cluster_summary_df.empty:
            return cluster_summary_df

        scored_rows = []
        for _, row in cluster_summary_df.iterrows():
            # Use representative FRP and brightness for cluster scoring
            frp = float(row.get("max_frp", row.get("avg_frp", 10.0)))
            brightness = float(row.get("max_brightness", row.get("avg_brightness", 340.0)))
            dist = float(row.get("distance_to_industry_meters", 10000.0))
            p_ratio = float(row.get("persistence_ratio", 0.2))
            is_spike = bool(row.get("is_anomaly_spike", False))
            conf = 0.9 if is_spike else 0.8

            risk_meta = cls.calculate_composite_risk(
                frp=frp,
                brightness=brightness,
                distance_to_industry_meters=dist,
                persistence_ratio=p_ratio,
                is_anomaly_spike=is_spike,
                confidence_normalized=conf
            )

            row_dict = row.to_dict()
            row_dict["risk_score"] = risk_meta["risk_score"]
            row_dict["risk_level"] = risk_meta["risk_level"]
            row_dict["incident_classification"] = risk_meta["classification"]
            row_dict["action_code"] = risk_meta["action_code"]
            row_dict["thermal_subscore"] = risk_meta["subscores"]["thermal_subscore"]
            row_dict["proximity_subscore"] = risk_meta["subscores"]["proximity_subscore"]
            row_dict["persistence_subscore"] = risk_meta["subscores"]["persistence_subscore"]
            row_dict["confidence_subscore"] = risk_meta["subscores"]["confidence_subscore"]
            scored_rows.append(row_dict)

        result_df = pd.DataFrame(scored_rows)
        # Sort by risk_score descending to automatically prioritize critical incidents
        result_df = result_df.sort_values(by="risk_score", ascending=False).reset_index(drop=True)
        logger.info(f"Risk scoring completed for {len(result_df)} clusters.")
        return result_df
