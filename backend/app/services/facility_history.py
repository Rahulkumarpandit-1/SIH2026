"""
Facility Historical Intelligence Service (Phase 12D)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Computes longitudinal facility track records and precedent statistics:
- Total Incidents Recorded
- Verified Fires Count
- False Alarms Count
- Controlled Flaring Events
- Average Risk Score
- Average Abnormality Score
- Average FRP (MW)
- Highest Recorded FRP (MW)
- Last Incident Date
- Precedent Incidents List
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.core.logging import logger
from app.db.db_models import IncidentRecordModel, FacilityThermalProfileModel, RawObservationModel
from app.scoring.facility_fingerprint import FacilityFingerprintEngine


class FacilityHistoryService:
    """
    Synthesizes historical incident occurrences, operational thermal baselines,
    and ground truth labels to build longitudinal facility intelligence.
    """

    @classmethod
    def get_facility_history(
        cls,
        db: Session,
        facility_name: str
    ) -> Dict[str, Any]:
        """
        Calculates longitudinal statistics for a given industrial facility.
        """
        clean_name = facility_name.strip()

        # 1. Fetch registered incidents matching facility (case-insensitive substring or exact)
        incidents = (
            db.query(IncidentRecordModel)
            .filter(IncidentRecordModel.facility_name.ilike(f"%{clean_name}%"))
            .order_by(desc(IncidentRecordModel.last_detected))
            .all()
        )

        # 2. Fetch baseline profile if present
        profile = (
            db.query(FacilityThermalProfileModel)
            .filter(FacilityThermalProfileModel.facility_name.ilike(f"%{clean_name}%"))
            .first()
        )

        known_baselines = FacilityFingerprintEngine.KNOWN_BASELINES
        matched_baseline = None
        for k, v in known_baselines.items():
            if clean_name.lower() in k.lower() or k.lower() in clean_name.lower():
                matched_baseline = v
                break

        # Calculate incident breakdown
        total_incidents = len(incidents)
        verified_fires = sum(1 for inc in incidents if inc.status == "VERIFIED_FIRE")
        false_alarms = sum(1 for inc in incidents if inc.status == "FALSE_ALARM")
        controlled_flaring = sum(1 for inc in incidents if inc.status in ["CONTROLLED_FLARING", "ARCHIVED"])
        under_review = sum(1 for inc in incidents if inc.status == "UNDER_REVIEW")
        new_incidents = sum(1 for inc in incidents if inc.status == "NEW")

        # Average risk & abnormality scores
        if incidents:
            avg_risk = sum(inc.risk_score for inc in incidents) / total_incidents
            avg_abnormality = sum(inc.abnormality_score for inc in incidents) / total_incidents
            inc_peak_frp = max(inc.peak_frp or 0.0 for inc in incidents)
            last_date_obj = max(inc.last_detected for inc in incidents)
            last_incident_str = last_date_obj.strftime("%Y-%m-%d")
        else:
            avg_risk = 0.0
            avg_abnormality = 0.0
            inc_peak_frp = 0.0
            last_incident_str = None

        # FRP metrics from profile or baseline
        profile_avg_frp = profile.avg_frp if profile else (matched_baseline.get("baseline_frp") if matched_baseline else 12.0)
        profile_max_frp = profile.max_frp if profile else (matched_baseline.get("max_historical_frp") if matched_baseline else 25.0)
        highest_recorded_frp = max(inc_peak_frp, profile_max_frp or 0.0)

        # Facility classification & region
        facility_type = profile.facility_type if profile else (matched_baseline.get("facility_type") if matched_baseline else "Industrial Installation")
        region_code = (incidents[0].region_code if incidents else (profile.region_code if profile else (matched_baseline.get("region_code") if matched_baseline else "WEST_GUJARAT")))
        state = (incidents[0].state if incidents else (profile.state if profile else "Gujarat"))

        # Summarize past incidents
        recent_list = []
        for inc in incidents[:10]:
            recent_list.append({
                "incident_uuid": inc.incident_uuid,
                "cluster_id": inc.cluster_id,
                "first_detected": inc.first_detected.isoformat(),
                "last_detected": inc.last_detected.isoformat(),
                "risk_score": round(inc.risk_score, 2),
                "risk_level": inc.risk_level or "LOW",
                "abnormality_score": round(inc.abnormality_score, 2),
                "temporal_status": inc.temporal_status,
                "status": inc.status,
                "peak_frp": round(inc.peak_frp or 0.0, 1),
                "detection_count": inc.detection_count
            })

        return {
            "facility_name": clean_name,
            "facility_type": facility_type,
            "region_code": region_code,
            "state": state,
            "total_incidents": total_incidents,
            "verified_fires": verified_fires,
            "false_alarms": false_alarms,
            "controlled_flaring": controlled_flaring,
            "under_review": under_review,
            "new_incidents": new_incidents,
            "average_risk_score": round(avg_risk, 2),
            "average_abnormality_score": round(avg_abnormality, 2),
            "average_frp": round(profile_avg_frp or 12.0, 1),
            "highest_recorded_frp": round(highest_recorded_frp, 1),
            "last_incident_date": last_incident_str,
            "historical_incidents": recent_list
        }
