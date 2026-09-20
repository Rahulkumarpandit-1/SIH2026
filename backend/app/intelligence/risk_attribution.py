"""
Risk Attribution Engine (Phase 13A)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Decomposes composite incident risk scores into explainable, auditable contributing factors:
- Thermal Intensity (Radiative Power & Pixel Temperature)
- Facility Proximity (Distance to Industrial Boundary)
- Persistence & Anomaly (Surge Duration vs Baseline Flaring)
- Sensor Confidence (VIIRS/MODIS Detection Quality)
- Geospatial Exposure (Sensitive Receptors & Downwind Plume Impact)

Provides raw point contributions, normalized percentages, factor rankings,
and plain-language analyst explanations for legal, insurance, and forensic auditing.
"""

from typing import Dict, Any, List, Optional
from app.core.logging import logger
from app.scoring.risk_engine import RiskScoringEngine


class RiskAttributionEngine:
    """
    Explainable Risk Attribution Engine decomposing multi-signal composite risk
    scores into transparent, ranked mathematical components.
    """

    FACTOR_THERMAL = "Thermal Intensity"
    FACTOR_PROXIMITY = "Facility Proximity"
    FACTOR_PERSISTENCE = "Persistence & Anomaly"
    FACTOR_CONFIDENCE = "Sensor Confidence"
    FACTOR_EXPOSURE = "Geospatial Exposure"

    FACTOR_DESCRIPTIONS = {
        FACTOR_THERMAL: "Radiative heat power (FRP) and brightness temperature recorded by infrared sensors.",
        FACTOR_PROXIMITY: "Physical proximity to industrial facility boundaries and high-hazard operating units.",
        FACTOR_PERSISTENCE: "Observation duration and unexpected thermal surge versus routine operational baselines.",
        FACTOR_CONFIDENCE: "Sensor detection quality, scan geometry, and atmospheric transmission certainty.",
        FACTOR_EXPOSURE: "Threat to sensitive population settlements, critical infrastructure, and downwind zones."
    }

    @classmethod
    def compute_attribution(
        cls,
        risk_score: float,
        subscores: Optional[Dict[str, float]] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        exposure_context: Optional[Dict[str, Any]] = None,
        risk_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates itemized risk attribution breakdown for an incident.
        Returns:
            - risk_score: total score (0-100)
            - contributors: list of dicts with factor, value, percent, description
            - primary_factor: factor with highest point contribution
            - explanation: analyst-friendly technical narrative
        """
        score = round(max(0.0, min(100.0, float(risk_score))), 2)
        sub = subscores or {}
        tel = telemetry or {}
        exp = exposure_context or {}

        # 1. Base rule engine components
        s_th = float(sub.get("thermal_subscore", 0.0))
        s_prox = float(sub.get("proximity_subscore", 0.0))
        s_pers = float(sub.get("persistence_subscore", 0.0))
        s_conf = float(sub.get("confidence_subscore", 0.0))

        # If subscores were not supplied but telemetry is available, recompute
        if s_th == 0.0 and s_prox == 0.0 and tel:
            frp = float(tel.get("max_frp", tel.get("avg_frp", 15.0)))
            brightness = float(tel.get("max_brightness", 330.0))
            dist = float(tel.get("distance_to_industry_meters", 0.0))
            p_ratio = float(tel.get("persistence_ratio", 0.2))
            is_spike = bool(tel.get("is_anomaly_spike", False))
            recomputed = RiskScoringEngine.calculate_composite_risk(
                frp=frp,
                brightness=brightness,
                distance_to_industry_meters=dist,
                persistence_ratio=p_ratio,
                is_anomaly_spike=is_spike
            )
            s_th = recomputed["subscores"]["thermal_subscore"]
            s_prox = recomputed["subscores"]["proximity_subscore"]
            s_pers = recomputed["subscores"]["persistence_subscore"]
            s_conf = recomputed["subscores"]["confidence_subscore"]

        # Raw weighted values from the 4 primary signals
        raw_th = round(RiskScoringEngine.WEIGHT_THERMAL * s_th, 1)
        raw_prox = round(RiskScoringEngine.WEIGHT_PROXIMITY * s_prox, 1)
        raw_pers = round(RiskScoringEngine.WEIGHT_PERSISTENCE * s_pers, 1)
        raw_conf = round(RiskScoringEngine.WEIGHT_CONFIDENCE * s_conf, 1)

        raw_base_sum = raw_th + raw_prox + raw_pers + raw_conf

        # 2. Exposure contribution: if total risk_score includes exposure adjustment, or from exposure context
        exposure_val = 0.0
        if "exposure_subscore" in sub:
            exposure_val = round(float(sub["exposure_subscore"]), 1)
        elif score > raw_base_sum:
            # The delta is attributed to geospatial exposure
            exposure_val = round(score - raw_base_sum, 1)
        elif exp:
            pop_exp = str(exp.get("population_exposure", "LOW")).upper()
            downwind_exp = str(exp.get("downwind_exposure", "LOW")).upper()
            infra_exp = str(exp.get("infrastructure_exposure", "LOW")).upper()
            if pop_exp == "HIGH" or downwind_exp == "HIGH":
                exposure_val = 12.0
            elif pop_exp == "MEDIUM" or infra_exp == "HIGH":
                exposure_val = 8.0
            elif pop_exp == "LOW" and (downwind_exp == "MEDIUM" or infra_exp == "MEDIUM"):
                exposure_val = 5.0

        raw_contributors = [
            {"factor": cls.FACTOR_THERMAL, "value": raw_th},
            {"factor": cls.FACTOR_PROXIMITY, "value": raw_prox},
            {"factor": cls.FACTOR_PERSISTENCE, "value": raw_pers},
            {"factor": cls.FACTOR_CONFIDENCE, "value": raw_conf}
        ]

        if exposure_val > 0.0:
            raw_contributors.append({"factor": cls.FACTOR_EXPOSURE, "value": exposure_val})

        # Calculate sum of raw values
        total_raw = sum(c["value"] for c in raw_contributors)
        effective_total = score if score > 0 else (total_raw if total_raw > 0 else 1.0)

        # Build normalized contributors list
        contributors: List[Dict[str, Any]] = []
        for item in raw_contributors:
            val = item["value"]
            # Percentage of the total risk score
            pct = round((val / max(effective_total, 1e-6)) * 100.0, 1) if effective_total > 0 else 0.0
            contributors.append({
                "factor": item["factor"],
                "value": round(val, 1),
                "percent": pct,
                "description": cls.FACTOR_DESCRIPTIONS.get(item["factor"], "")
            })

        # Sort descending by value
        contributors.sort(key=lambda x: x["value"], reverse=True)

        primary = contributors[0]["factor"] if contributors else "Unknown"
        secondary = contributors[1]["factor"] if len(contributors) > 1 else None

        # Build analyst-friendly narrative
        explanation = cls._build_explanation(
            score=score,
            primary=primary,
            contributors=contributors,
            secondary=secondary,
            risk_level=risk_level
        )

        return {
            "incident_uuid": tel.get("incident_uuid", ""),
            "risk_score": score,
            "risk_level": risk_level or ("CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MODERATE" if score >= 30 else "LOW"),
            "contributors": contributors,
            "primary_factor": primary,
            "explanation": explanation
        }

    @classmethod
    def _build_explanation(
        cls,
        score: float,
        primary: str,
        contributors: List[Dict[str, Any]],
        secondary: Optional[str] = None,
        risk_level: Optional[str] = None
    ) -> str:
        """Generates plain-language risk attribution narrative."""
        primary_item = next((c for c in contributors if c["factor"] == primary), None)
        p_pct = primary_item["percent"] if primary_item else 0.0
        p_val = primary_item["value"] if primary_item else 0.0

        sec_item = next((c for c in contributors if c["factor"] == secondary), None) if secondary else None
        s_pct = sec_item["percent"] if sec_item else 0.0
        s_val = sec_item["value"] if sec_item else 0.0

        level_str = risk_level or ("CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MODERATE" if score >= 30 else "LOW")

        text = (
            f"The incident has a composite risk score of {score:.0f}/100 ({level_str} priority). "
            f"The dominant risk driver is {primary}, contributing +{p_val:.1f} points ({p_pct:.1f}% of overall score). "
        )
        if secondary and sec_item:
            text += f"Secondary contributor is {secondary} at +{s_val:.1f} points ({s_pct:.1f}%). "

        if any(c["factor"] == cls.FACTOR_EXPOSURE and c["value"] > 0 for c in contributors):
            exp_item = next(c for c in contributors if c["factor"] == cls.FACTOR_EXPOSURE)
            text += f"Downwind geospatial exposure adds an additional +{exp_item['value']:.1f} points ({exp_item['percent']:.1f}%) due to proximity to sensitive community and industrial receptors."
        else:
            text += "Risk drivers remain concentrated within the physical industrial perimeter."

        return text
