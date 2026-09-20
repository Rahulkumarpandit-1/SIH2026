"""
Historical Similar Incident Engine (Phase 13C)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Identifies and ranks historically similar incidents from the permanent incident registry
using a multi-dimensional normalized distance and cosine similarity metric across:
1. Risk Score
2. Peak Fire Radiative Power (FRP in MW)
3. Facility Industrial Classification
4. Thermal Anomaly Ratio (Current FRP vs Facility Baseline)
5. Abnormality Score
6. Combustion Persistence (Detection Count / Duration)

Returns the top 5 most similar historical precedents to support forensic comparison,
legal precedent analysis, and operational decision support.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.logging import logger
from app.db.db_models import IncidentRecordModel, FacilityThermalProfileModel
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
from app.services.incident_registry import IncidentRegistryService


class SimilarIncidentsEngine:
    """
    Computes multidimensional similarity vectors between active/investigated incidents
    and historical records across industrial corridors.
    """

    WEIGHT_RISK = 0.25
    WEIGHT_FRP = 0.20
    WEIGHT_ABNORMALITY = 0.20
    WEIGHT_ANOMALY_RATIO = 0.15
    WEIGHT_PERSISTENCE = 0.10
    WEIGHT_FACILITY_TYPE = 0.10

    @classmethod
    def calculate_pair_similarity(
        cls,
        target_features: Dict[str, Any],
        candidate_features: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates similarity metric in [0.0, 1.0] between two incident feature profiles.
        """
        t_risk = float(target_features.get("risk_score", 0.0))
        c_risk = float(candidate_features.get("risk_score", 0.0))
        sim_risk = max(0.0, 1.0 - (abs(t_risk - c_risk) / 100.0))

        t_frp = max(1.0, float(target_features.get("peak_frp", 10.0)))
        c_frp = max(1.0, float(candidate_features.get("peak_frp", 10.0)))
        denom_frp = max(t_frp, c_frp, 50.0)
        sim_frp = max(0.0, 1.0 - (abs(t_frp - c_frp) / denom_frp))

        t_abn = float(target_features.get("abnormality_score", 0.0))
        c_abn = float(candidate_features.get("abnormality_score", 0.0))
        sim_abn = max(0.0, 1.0 - (abs(t_abn - c_abn) / 100.0))

        t_rat = max(0.1, float(target_features.get("thermal_anomaly_ratio", 1.0)))
        c_rat = max(0.1, float(candidate_features.get("thermal_anomaly_ratio", 1.0)))
        denom_rat = max(t_rat, c_rat, 3.0)
        sim_rat = max(0.0, 1.0 - (abs(t_rat - c_rat) / denom_rat))

        t_pers = max(1, int(target_features.get("persistence", target_features.get("detection_count", 1))))
        c_pers = max(1, int(candidate_features.get("persistence", candidate_features.get("detection_count", 1))))
        denom_pers = max(t_pers, c_pers, 10)
        sim_pers = max(0.0, 1.0 - (abs(t_pers - c_pers) / float(denom_pers)))

        t_type = str(target_features.get("facility_type", "")).strip().lower()
        c_type = str(candidate_features.get("facility_type", "")).strip().lower()
        if t_type and c_type:
            if t_type == c_type:
                sim_type = 1.0
            elif ("refin" in t_type and "refin" in c_type) or ("steel" in t_type and "steel" in c_type) or ("petrochem" in t_type and "petrochem" in c_type):
                sim_type = 0.7
            elif "industrial" in t_type or "industrial" in c_type:
                sim_type = 0.5
            else:
                sim_type = 0.2
        else:
            sim_type = 0.5

        composite_sim = (
            cls.WEIGHT_RISK * sim_risk
            + cls.WEIGHT_FRP * sim_frp
            + cls.WEIGHT_ABNORMALITY * sim_abn
            + cls.WEIGHT_ANOMALY_RATIO * sim_rat
            + cls.WEIGHT_PERSISTENCE * sim_pers
            + cls.WEIGHT_FACILITY_TYPE * sim_type
        )
        composite_sim = round(max(0.0, min(1.0, float(composite_sim))), 2)

        return {
            "similarity_score": composite_sim,
            "breakdown": {
                "risk_similarity": round(sim_risk, 2),
                "frp_similarity": round(sim_frp, 2),
                "abnormality_similarity": round(sim_abn, 2),
                "anomaly_ratio_similarity": round(sim_rat, 2),
                "persistence_similarity": round(sim_pers, 2),
                "facility_type_similarity": round(sim_type, 2)
            }
        }

    @classmethod
    def find_similar_incidents(
        cls,
        db: Session,
        target_incident_uuid: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Finds top K historical incidents most similar to target_incident_uuid.
        Returns target metadata and list of similar precedent records.
        """
        target = IncidentRegistryService.get_incident_by_uuid(db, target_incident_uuid)
        if not target:
            # Check by cluster ID
            target = IncidentRegistryService.get_incident_by_cluster_id(db, target_incident_uuid)

        if not target:
            raise ValueError(f"Incident with UUID '{target_incident_uuid}' not found.")

        # Extract target features
        t_baseline = FacilityFingerprintEngine.get_facility_profile(target.facility_name)
        t_base_frp = max(1.0, float(t_baseline.get("baseline_frp", 12.0)))
        t_ratio = round((target.peak_frp or 15.0) / t_base_frp, 2)
        t_type = t_baseline.get("facility_type", "Industrial Installation")

        target_features = {
            "risk_score": target.risk_score,
            "peak_frp": target.peak_frp or 15.0,
            "abnormality_score": target.abnormality_score or 0.0,
            "thermal_anomaly_ratio": t_ratio,
            "persistence": target.detection_count,
            "facility_type": t_type
        }

        # Query all historical incidents from registry (excluding target)
        candidates = (
            db.query(IncidentRecordModel)
            .filter(IncidentRecordModel.incident_uuid != target.incident_uuid)
            .all()
        )

        ranked: List[Dict[str, Any]] = []

        for c in candidates:
            c_baseline = FacilityFingerprintEngine.get_facility_profile(c.facility_name)
            c_base_frp = max(1.0, float(c_baseline.get("baseline_frp", 12.0)))
            c_ratio = round((c.peak_frp or 15.0) / c_base_frp, 2)
            c_type = c_baseline.get("facility_type", "Industrial Installation")

            c_features = {
                "risk_score": c.risk_score,
                "peak_frp": c.peak_frp or 15.0,
                "abnormality_score": c.abnormality_score or 0.0,
                "thermal_anomaly_ratio": c_ratio,
                "persistence": c.detection_count,
                "facility_type": c_type
            }

            sim_result = cls.calculate_pair_similarity(target_features, c_features)

            ranked.append({
                "incident_uuid": c.incident_uuid,
                "cluster_id": c.cluster_id,
                "facility": c.facility_name,
                "facility_type": c_type,
                "similarity_score": sim_result["similarity_score"],
                "risk_score": round(c.risk_score, 1),
                "risk_level": c.risk_level or ("HIGH" if c.risk_score >= 60 else "MODERATE"),
                "peak_frp": round(c.peak_frp or 0.0, 1),
                "abnormality_score": round(c.abnormality_score, 1),
                "status": c.status,
                "temporal_status": c.temporal_status,
                "first_detected": c.first_detected.isoformat() if c.first_detected else "",
                "last_detected": c.last_detected.isoformat() if c.last_detected else "",
                "similarity_breakdown": sim_result["breakdown"]
            })

        # Sort descending by similarity
        ranked.sort(key=lambda x: x["similarity_score"], reverse=True)

        return {
            "incident_uuid": target.incident_uuid,
            "facility": target.facility_name,
            "target_risk_score": round(target.risk_score, 1),
            "target_frp": round(target.peak_frp or 15.0, 1),
            "target_abnormality_score": round(target.abnormality_score, 1),
            "similar_incidents": ranked[:top_k]
        }
