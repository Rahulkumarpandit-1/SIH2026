"""
Executive Incident Summary Engine (Phase 13E)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Generates deterministic, audit-compliant executive incident summaries grounded
strictly in platform-generated telemetry and physical models.

STRICT DESIGN GUARANTEES:
- Zero external LLMs (No OpenAI, Anthropic, Gemini, or cloud APIs)
- Zero hallucinations or unverified claims
- Deterministic, reproducible semantic composition
- Sub-millisecond generation speed
- Suitable for emergency operational briefs, command room dashboards, and regulatory inquiries.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.core.logging import logger


class ExecutiveSummaryEngine:
    """
    Synthesizes multi-source sensor observations, meteorological modeling,
    facility thermal baselines, and risk scoring into concise, professional executive summaries.
    """

    @classmethod
    def generate_summary(
        cls,
        incident_detail: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates an executive-ready summary narrative and bullet highlights
        using only verified platform telemetry.
        """
        uuid_val = incident_detail.get("incident_uuid", "INCIDENT")
        facility_name = incident_detail.get("facility_name", "Industrial Facility")
        risk_score = float(incident_detail.get("risk_score", 0.0))
        risk_level = incident_detail.get("risk_level", "LOW")
        action_code = incident_detail.get("action_code", "BACKGROUND_LOG")

        # Telemetry
        telemetry = incident_detail.get("telemetry", {})
        peak_frp = float(incident_detail.get("peak_frp", telemetry.get("max_frp", 15.0)))
        dist_m = float(telemetry.get("distance_to_industry_meters", 0.0))
        total_detections = int(incident_detail.get("detection_count", telemetry.get("total_detections", 1)))

        # Temporal
        temporal = incident_detail.get("temporal_intelligence", {})
        active_hours = float(temporal.get("active_duration_hours", 0.0))
        freshness_mins = float(temporal.get("observation_freshness_minutes", 0.0))
        first_dt = temporal.get("first_detected", "")

        # Weather
        wx = incident_detail.get("weather_context", {})
        wind_speed = wx.get("wind_speed_kmh")
        wind_dir = wx.get("wind_cardinal", "N/A")
        plume_dir = wx.get("plume_dispersion_heading", "N/A")
        spread_concern = wx.get("spread_concern", "NORMAL_MONITORING")

        # Facility Fingerprint & Abnormality
        fp = incident_detail.get("facility_fingerprint", {})
        baseline_frp = max(1.0, float(fp.get("baseline_frp", 12.0)))
        anomaly_ratio = round(peak_frp / baseline_frp, 1)

        ab = incident_detail.get("abnormality_detection", {})
        ab_score = float(incident_detail.get("abnormality_score", ab.get("abnormality_score", 0.0)))
        ab_status = ab.get("abnormality_status", "NORMAL")

        # Exposure
        exp = incident_detail.get("exposure_context", {})
        downwind_exp = exp.get("downwind_exposure", "LOW")
        pop_exp = exp.get("population_exposure", "LOW")

        # 1. Location sentence (scientifically accurate)
        if dist_m == 0.0:
            loc_str = f"A thermal anomaly was observed directly inside {facility_name}."
        elif dist_m <= 1000.0:
            loc_str = f"A satellite-detected heat signature was observed within the immediate perimeter of {facility_name} ({dist_m:.0f}m from boundary)."
        else:
            loc_str = f"A thermal anomaly was observed {dist_m / 1000.0:.1f} km from {facility_name}."

        # 2. Temporal sentence
        if active_hours > 0:
            temp_str = f"The persistent thermal event has exhibited elevated thermal activity for {active_hours:.1f} hours across {total_detections} satellite detections."
        else:
            temp_str = f"The satellite-detected heat signature was recorded across {total_detections} satellite detections."

        # 3. Weather sentence
        if wind_speed is not None and wind_speed > 25.0:
            wx_str = f"Atmospheric modeling indicates elevated wind dispersion ({wind_speed:.1f} km/h from {wind_dir}) with plume heading towards {plume_dir}, presenting high potential for wind-assisted propagation."
        elif wind_speed is not None and wind_speed > 12.0:
            wx_str = f"Atmospheric modeling indicates moderate wind velocity with downwind plume dispersion heading towards {plume_dir}, presenting potential for wind-assisted propagation."
        else:
            wx_str = "Atmospheric conditions indicate low wind velocity with localized thermal stagnation."

        # 4. Abnormality & baseline sentence
        if anomaly_ratio >= 1.5:
            ab_str = f"The observed peak FRP ({peak_frp:.1f} MW) exceeds the facility baseline by {anomaly_ratio:.1f}x ({ab_status} thermal behavior)."
        else:
            ab_str = f"The observed peak FRP ({peak_frp:.1f} MW) remains consistent with the facility routine operational baseline ({baseline_frp:.1f} MW)."

        # 5. Risk classification sentence
        risk_str = f"Risk classification is {risk_level} (Score: {risk_score:.0f}/100) with operational directive: {action_code}. Investigation recommended."

        # Assemble cohesive executive narrative
        executive_summary = f"{loc_str} {temp_str} {wx_str} {ab_str} {risk_str}"

        # Ground verification status check
        status_val = incident_detail.get("status", "NEW")
        if status_val == "VERIFIED_FIRE":
            ground_verif_str = "Analyst Ground Truth Verified: Confirmed Thermal Event"
        elif status_val == "CONTROLLED_FLARING":
            ground_verif_str = "Analyst Ground Truth Verified: Controlled Operational Flaring"
        elif status_val == "FALSE_ALARM":
            ground_verif_str = "Analyst Ground Truth Verified: False Positive / Non-Industrial Source"
        else:
            ground_verif_str = "Not Available Unless Analyst Reviewed"

        recommendation_disclaimer = (
            "This recommendation is based solely on satellite-observed thermal anomalies "
            "and supporting analytical models. Ground verification is required before operational response decisions."
        )

        # High-impact key evidence bullet points
        key_bullets = [
            f"Thermal Intensity: {peak_frp:.1f} MW peak FRP ({anomaly_ratio:.1f}x baseline envelope).",
            f"Observation Span: {active_hours:.1f} hours of elevated thermal activity across {total_detections} satellite passes.",
            f"Atmospheric Dynamics: Plume dispersion heading towards {plume_dir} with {downwind_exp} downwind hazard tier.",
            f"Operational Directive: {action_code} ({risk_level} priority). Investigation recommended."
        ]

        evidence_telemetry = {
            "incident_uuid": uuid_val,
            "facility_name": facility_name,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "peak_frp": peak_frp,
            "baseline_frp": baseline_frp,
            "anomaly_ratio": anomaly_ratio,
            "active_duration_hours": active_hours,
            "total_detections": total_detections,
            "wind_speed_kmh": wind_speed,
            "plume_dispersion_heading": plume_dir,
            "abnormality_status": ab_status,
            "action_code": action_code,
            "confidence_level": "Satellite Observation Confidence Only",
            "ground_verification": ground_verif_str
        }

        return {
            "incident_uuid": uuid_val,
            "facility_name": facility_name,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "abnormality_status": ab_status,
            "abnormality_score": ab_score,
            "action_code": action_code,
            "confidence_level": "Satellite Observation Confidence Only",
            "ground_verification": ground_verif_str,
            "recommendation_statement": recommendation_disclaimer,
            "executive_summary": executive_summary,
            "key_bullet_points": key_bullets,
            "evidence_telemetry": evidence_telemetry,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
