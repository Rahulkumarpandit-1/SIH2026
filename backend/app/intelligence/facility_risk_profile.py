"""
Facility Risk Profile Engine (Phase 13D)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Computes comprehensive facility-level risk profiles and longitudinal risk trajectory intelligence:
- Total Incidents
- Verified Fires Count
- False Alarms Count
- Controlled Flaring Events
- Average Risk Score
- Average Abnormality Score
- Highest Recorded Peak FRP
- Facility Thermal Baseline
- Last Incident Date
- Historical Trend Classification (INCREASING, STABLE, DECREASING, LOW_BASELINE)
- Facility Risk Tier (CRITICAL_RISK, ELEVATED_RISK, NOMINAL_MONITORING)
- Precedent Incidents List
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.logging import logger
from app.db.db_models import IncidentRecordModel, FacilityThermalProfileModel
from app.scoring.facility_fingerprint import FacilityFingerprintEngine
from app.services.facility_history import FacilityHistoryService


class FacilityRiskProfileEngine:
    """
    Synthesizes long-term plant emissions history, ground truth reviews, and spatial
    telemetry to build actionable facility risk profiles.
    """

    @classmethod
    def generate_facility_risk_profile(
        cls,
        db: Session,
        facility_name: str
    ) -> Dict[str, Any]:
        """
        Generates comprehensive facility risk profile for regulatory compliance,
        safety audits, and prioritization ranking.
        """
        clean_name = facility_name.strip()

        # Query existing history from service
        hist = FacilityHistoryService.get_facility_history(db, clean_name)

        incidents = (
            db.query(IncidentRecordModel)
            .filter(IncidentRecordModel.facility_name.ilike(f"%{clean_name}%"))
            .order_by(desc(IncidentRecordModel.last_detected))
            .all()
        )

        total_inc = len(incidents)
        avg_risk = hist.get("average_risk_score", 0.0)
        avg_abn = hist.get("average_abnormality_score", 0.0)
        peak_frp = hist.get("highest_recorded_frp", 0.0)
        verified_fires = hist.get("verified_fires", 0)
        false_alarms = hist.get("false_alarms", 0)
        controlled_flaring = hist.get("controlled_flaring", 0)
        under_review = hist.get("under_review", 0)
        new_inc = hist.get("new_incidents", 0)

        # Baseline FRP from profile
        profile = FacilityFingerprintEngine.get_facility_profile(clean_name)
        baseline_frp = float(profile.get("baseline_frp", 12.0))
        fac_type = profile.get("facility_type", hist.get("facility_type", "Industrial Installation"))
        region_code = hist.get("region_code", "WEST_GUJARAT")
        state = hist.get("state", "Gujarat")

        # 1. Evaluate Historical Trend
        trend, trend_desc = cls._evaluate_trend(incidents, avg_risk)

        # 2. Evaluate Facility Risk Tier
        risk_tier = cls._evaluate_risk_tier(
            verified_fires=verified_fires,
            avg_risk=avg_risk,
            peak_frp=peak_frp,
            total_inc=total_inc
        )

        return {
            "facility_name": clean_name,
            "facility_type": fac_type,
            "region_code": region_code,
            "state": state,
            "total_incidents": total_inc,
            "verified_fires": verified_fires,
            "false_alarms": false_alarms,
            "controlled_flaring": controlled_flaring,
            "under_review": under_review,
            "new_incidents": new_inc,
            "average_risk_score": round(avg_risk, 1),
            "average_abnormality_score": round(avg_abn, 1),
            "peak_frp": round(peak_frp, 1),
            "baseline_frp": round(baseline_frp, 1),
            "last_incident_date": hist.get("last_incident_date"),
            "historical_trend": trend,
            "trend_description": trend_desc,
            "risk_tier": risk_tier,
            "historical_precedents": hist.get("historical_incidents", [])
        }

    @classmethod
    def _evaluate_trend(cls, incidents: List[IncidentRecordModel], avg_risk: float) -> tuple[str, str]:
        """Calculates trajectory of thermal risk over time."""
        if not incidents or len(incidents) < 2:
            if avg_risk >= 60.0:
                return "ELEVATED_BASELINE", "Single high-severity event on record; ongoing monitoring advised."
            elif avg_risk > 0:
                return "STABLE", "Thermal emission records demonstrate standard operational compliance."
            return "LOW_BASELINE", "No critical thermal excursion incidents documented for this facility."

        # Compare most recent incident against older incidents
        recent_scores = [inc.risk_score for inc in incidents[:2]]
        older_scores = [inc.risk_score for inc in incidents[2:]] if len(incidents) > 2 else [inc.risk_score for inc in incidents[1:]]

        mean_recent = sum(recent_scores) / len(recent_scores)
        mean_older = sum(older_scores) / len(older_scores)
        diff = mean_recent - mean_older

        if diff >= 10.0:
            return "INCREASING", f"Recent thermal risk has escalated by +{diff:.1f} points compared to prior baseline."
        elif diff <= -10.0:
            return "DECREASING", f"Recent thermal risk has decreased by {abs(diff):.1f} points showing operational stabilization."
        elif avg_risk >= 60.0:
            return "STABLE", "Persistent high-heat operational regime maintained across monitoring periods."
        else:
            return "STABLE", "Stable operational thermal profile with no significant variance from normal baseline."

    @classmethod
    def _evaluate_risk_tier(
        cls,
        verified_fires: int,
        avg_risk: float,
        peak_frp: float,
        total_inc: int
    ) -> str:
        """Classifies facility risk tier."""
        if verified_fires >= 2 or avg_risk >= 75.0 or peak_frp >= 90.0:
            return "CRITICAL_RISK"
        elif verified_fires >= 1 or avg_risk >= 50.0 or peak_frp >= 45.0 or total_inc >= 5:
            return "ELEVATED_RISK"
        elif total_inc > 0:
            return "NOMINAL_MONITORING"
        return "NOMINAL_BASELINE"
