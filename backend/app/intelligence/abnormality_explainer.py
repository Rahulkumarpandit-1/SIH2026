"""
Abnormality Explanation Engine (Phase 13B)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Provides human-interpretable diagnostics for multi-dimensional thermal abnormality classifications:
- NORMAL (< 35)
- ELEVATED (35 - 59)
- ABNORMAL (60 - 79)
- SEVERELY_ABNORMAL (>= 80)

Breaks down points out of 100:
- Heat Intensity (x/40 pts, Weight: 0.40)
- Thermal Growth (x/25 pts, Weight: 0.25)
- Persistence (x/20 pts, Weight: 0.20)
- Recurrence (x/15 pts, Weight: 0.15)
"""

from typing import Dict, Any, List, Optional
from app.core.logging import logger
from app.scoring.abnormality_engine import AbnormalityEngine


class AbnormalityExplainer:
    """
    Deconstructs multi-dimensional abnormality scores into fraction-based point
    allocations (e.g. 38/40, 21/25, 18/20, 14/15) with plain-language root-cause explanations.
    """

    MAX_POINTS_INTENSITY = 40.0
    MAX_POINTS_GROWTH = 25.0
    MAX_POINTS_PERSISTENCE = 20.0
    MAX_POINTS_RECURRENCE = 15.0

    @classmethod
    def explain_abnormality(
        cls,
        abnormality_data: Optional[Dict[str, Any]] = None,
        facility_name: str = "Industrial Facility",
        current_frp: Optional[float] = None,
        avg_frp: Optional[float] = None,
        active_days: Optional[int] = None,
        total_detections: Optional[int] = None,
        is_anomaly_spike: Optional[bool] = None,
        # Direct override points for custom evaluations / unit testing
        intensity_points: Optional[float] = None,
        growth_points: Optional[float] = None,
        persistence_points: Optional[float] = None,
        recurrence_points: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Decomposes an abnormality detection result or raw telemetry into
        an explainable 4-component breakdown with points out of max and status.
        """
        data = abnormality_data or {}

        # If direct points are provided (e.g. testing or explicit calibration)
        if (
            intensity_points is not None
            and growth_points is not None
            and persistence_points is not None
            and recurrence_points is not None
        ):
            pts_int = float(intensity_points)
            pts_gro = float(growth_points)
            pts_per = float(persistence_points)
            pts_rec = float(recurrence_points)
            composite_score = round(pts_int + pts_gro + pts_per + pts_rec, 1)

            # Subscores normalized to 0-100
            s_int = round((pts_int / cls.MAX_POINTS_INTENSITY) * 100.0, 1)
            s_gro = round((pts_gro / cls.MAX_POINTS_GROWTH) * 100.0, 1)
            s_per = round((pts_per / cls.MAX_POINTS_PERSISTENCE) * 100.0, 1)
            s_rec = round((pts_rec / cls.MAX_POINTS_RECURRENCE) * 100.0, 1)

            status_int = "SEVERELY_ABNORMAL" if pts_int >= 32 else "ABNORMAL" if pts_int >= 24 else "ELEVATED" if pts_int >= 14 else "NORMAL"
            status_gro = "SEVERELY_ABNORMAL" if pts_gro >= 20 else "ABNORMAL" if pts_gro >= 15 else "ELEVATED" if pts_gro >= 9 else "NORMAL"
            status_per = "SEVERELY_ABNORMAL" if pts_per >= 16 else "ABNORMAL" if pts_per >= 12 else "ELEVATED" if pts_per >= 7 else "NORMAL"
            status_rec = "SEVERELY_ABNORMAL" if pts_rec >= 12 else "ABNORMAL" if pts_rec >= 9 else "ELEVATED" if pts_rec >= 5 else "NORMAL"

            int_ratio = round(pts_int / 10.0, 1)
            growth_trend = "ACCELERATING" if pts_gro >= 18 else "EXPANDING" if pts_gro >= 12 else "STABLE"
            excess_pct = round(pts_per * 15.0, 0)
            rec_ratio = round(pts_rec / 5.0, 1)
            detail_int = f"Heat intensity contributing {pts_int:.0f}/{cls.MAX_POINTS_INTENSITY:.0f} pts"
            detail_gro = f"Thermal growth contributing {pts_gro:.0f}/{cls.MAX_POINTS_GROWTH:.0f} pts"
            detail_per = f"Combustion persistence contributing {pts_per:.0f}/{cls.MAX_POINTS_PERSISTENCE:.0f} pts"
            detail_rec = f"Event recurrence contributing {pts_rec:.0f}/{cls.MAX_POINTS_RECURRENCE:.0f} pts"
            orig_narrative = ""
        else:
            # Recompute if necessary
            if not data or "intensity_anomaly" not in data:
                if current_frp is not None:
                    data = AbnormalityEngine.evaluate_abnormality(
                        facility_name=facility_name,
                        current_frp=current_frp,
                        avg_frp=avg_frp,
                        active_days=active_days or 1,
                        total_detections=total_detections or 1,
                        is_anomaly_spike=is_anomaly_spike or False
                    )
                else:
                    data = {}

            composite_score = float(data.get("abnormality_score", 0.0))

            int_anom = data.get("intensity_anomaly", {})
            gro_anom = data.get("growth_anomaly", {})
            per_anom = data.get("persistence_anomaly", {})
            rec_anom = data.get("recurrence_anomaly", {})

            s_int = float(int_anom.get("score", 0.0))
            s_gro = float(gro_anom.get("score", 0.0))
            s_per = float(per_anom.get("score", 0.0))
            s_rec = float(rec_anom.get("score", 0.0))

            pts_int = round(AbnormalityEngine.WEIGHT_INTENSITY * s_int, 1)
            pts_gro = round(AbnormalityEngine.WEIGHT_GROWTH * s_gro, 1)
            pts_per = round(AbnormalityEngine.WEIGHT_PERSISTENCE * s_per, 1)
            pts_rec = round(AbnormalityEngine.WEIGHT_RECURRENCE * s_rec, 1)

            status_int = int_anom.get("status", "NORMAL")
            status_gro = gro_anom.get("status", "NORMAL")
            status_per = per_anom.get("status", "NORMAL")
            status_rec = rec_anom.get("status", "NORMAL")

            int_ratio = float(int_anom.get("ratio", 1.0))
            growth_trend = gro_anom.get("trend", "STABLE")
            excess_pct = float(per_anom.get("excess_percentage", 0.0))
            rec_ratio = float(rec_anom.get("ratio", 1.0))

            detail_int = int_anom.get("detail", f"FRP is {int_ratio}x baseline")
            detail_gro = gro_anom.get("detail", f"Growth trend is {growth_trend}")
            detail_per = per_anom.get("detail", f"Duration exceeds baseline by {excess_pct:.0f}%")
            detail_rec = rec_anom.get("detail", f"Recurrence is {rec_ratio}x monthly baseline")
            orig_narrative = data.get("narrative", "")

        # Determine composite status
        if composite_score >= 80.0:
            status = "SEVERELY_ABNORMAL"
        elif composite_score >= 60.0:
            status = "ABNORMAL"
        elif composite_score >= 35.0:
            status = "ELEVATED"
        else:
            status = "NORMAL"

        # Percentage contributions of total score
        total_pts = max(composite_score, 1e-6)
        pct_int = round((pts_int / total_pts) * 100.0, 1) if composite_score > 0 else 0.0
        pct_gro = round((pts_gro / total_pts) * 100.0, 1) if composite_score > 0 else 0.0
        pct_per = round((pts_per / total_pts) * 100.0, 1) if composite_score > 0 else 0.0
        pct_rec = round((pts_rec / total_pts) * 100.0, 1) if composite_score > 0 else 0.0

        components: List[Dict[str, Any]] = [
            {
                "name": "Heat Intensity",
                "score": s_int,
                "weight": AbnormalityEngine.WEIGHT_INTENSITY,
                "points": pts_int,
                "max_points": cls.MAX_POINTS_INTENSITY,
                "contribution_percent": pct_int,
                "status": status_int,
                "detail": detail_int
            },
            {
                "name": "Thermal Growth",
                "score": s_gro,
                "weight": AbnormalityEngine.WEIGHT_GROWTH,
                "points": pts_gro,
                "max_points": cls.MAX_POINTS_GROWTH,
                "contribution_percent": pct_gro,
                "status": status_gro,
                "detail": detail_gro
            },
            {
                "name": "Persistence",
                "score": s_per,
                "weight": AbnormalityEngine.WEIGHT_PERSISTENCE,
                "points": pts_per,
                "max_points": cls.MAX_POINTS_PERSISTENCE,
                "contribution_percent": pct_per,
                "status": status_per,
                "detail": detail_per
            },
            {
                "name": "Recurrence",
                "score": s_rec,
                "weight": AbnormalityEngine.WEIGHT_RECURRENCE,
                "points": pts_rec,
                "max_points": cls.MAX_POINTS_RECURRENCE,
                "contribution_percent": pct_rec,
                "status": status_rec,
                "detail": detail_rec
            }
        ]

        plain_explanation = cls._generate_plain_explanation(
            status=status,
            score=composite_score,
            components=components,
            facility_name=facility_name,
            int_ratio=int_ratio,
            growth_trend=growth_trend,
            excess_pct=excess_pct
        )

        return {
            "incident_uuid": data.get("incident_uuid", ""),
            "abnormality_score": composite_score,
            "abnormality_status": status,
            "components": components,
            "intensity_ratio": int_ratio,
            "growth_trend": growth_trend,
            "persistence_excess_pct": excess_pct,
            "recurrence_ratio": rec_ratio,
            "narrative": orig_narrative or plain_explanation,
            "plain_language_explanation": plain_explanation
        }

    @classmethod
    def _generate_plain_explanation(
        cls,
        status: str,
        score: float,
        components: List[Dict[str, Any]],
        facility_name: str,
        int_ratio: float,
        growth_trend: str,
        excess_pct: float
    ) -> str:
        """Constructs concise, evidence-grounded diagnostic text."""
        c_sorted = sorted(components, key=lambda x: x["points"], reverse=True)
        top_factor = c_sorted[0]

        if status == "SEVERELY_ABNORMAL":
            return (
                f"Incident classified as SEVERELY_ABNORMAL with a composite score of {score:.0f}/100. "
                f"Primary driver is {top_factor['name']} ({top_factor['points']:.0f}/{top_factor['max_points']:.0f} pts). "
                f"Peak combustion energy is {int_ratio:.1f}x higher than the {facility_name} historical baseline, "
                f"accompanied by {growth_trend.lower()} thermal growth and an active duration exceeding routine thresholds by {excess_pct:.0f}%. "
                f"Indicates acute industrial process breakdown or uncontained fire outbreak."
            )
        elif status == "ABNORMAL":
            return (
                f"Incident classified as ABNORMAL ({score:.0f}/100). "
                f"The thermal signal shows significant deviation in {top_factor['name']} ({top_factor['points']:.0f}/{top_factor['max_points']:.0f} pts) "
                f"with {int_ratio:.1f}x baseline heat output. Exceeds routine operational flaring tolerances; priority verification warranted."
            )
        elif status == "ELEVATED":
            return (
                f"Incident classified as ELEVATED ({score:.0f}/100). "
                f"Moderate heat intensity ({int_ratio:.1f}x baseline) or temporary duration increase. "
                f"Consistent with scheduled high-temperature maintenance or controlled flaring flux."
            )
        else:
            return (
                f"Incident classified as NORMAL ({score:.0f}/100). "
                f"All 4 thermal behavior dimensions (Intensity: {components[0]['points']:.0f}/{components[0]['max_points']:.0f}, "
                f"Growth: {components[1]['points']:.0f}/{components[1]['max_points']:.0f}, "
                f"Persistence: {components[2]['points']:.0f}/{components[2]['max_points']:.0f}, "
                f"Recurrence: {components[3]['points']:.0f}/{components[3]['max_points']:.0f}) "
                f"remain well within standard operating bounds for {facility_name}."
            )
