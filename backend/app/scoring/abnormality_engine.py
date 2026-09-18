from typing import Dict, Any, Optional, List
from app.core.logging import logger
from app.scoring.facility_fingerprint import FacilityFingerprintEngine


class AbnormalityEngine:
    """
    Multi-Dimensional Abnormality Detection Engine.
    Detects whether an industrial thermal event behaves abnormally compared to its
    expected historical baseline and operational envelopes across 4 dimensions:
      1. Unusual Heat Intensity (Current FRP vs Facility Baseline FRP)
      2. Unusual Duration (Current Active Duration vs Expected Duration)
      3. Unusual Growth Pattern (Current Thermal Expansion Rate vs Mean Flux)
      4. Unusual Recurrence (Current Event Recurrence vs Monthly Historical Baseline)
    """

    WEIGHT_INTENSITY: float = 0.40
    WEIGHT_GROWTH: float = 0.25
    WEIGHT_PERSISTENCE: float = 0.20
    WEIGHT_RECURRENCE: float = 0.15

    @classmethod
    def evaluate_abnormality(
        cls,
        facility_name: str,
        current_frp: float,
        avg_frp: Optional[float] = None,
        active_days: Optional[int] = 1,
        total_detections: Optional[int] = 1,
        is_anomaly_spike: Optional[bool] = False,
        facility_type: Optional[str] = None,
        baseline_frp_override: Optional[float] = None,
        expected_duration_override: Optional[int] = None,
        baseline_frequency_override: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Evaluates an active incident or cluster against multi-dimensional abnormality criteria.
        Returns a normalized 0-100 composite score, 4-tier status, detailed sub-metrics,
        itemized bullet explanations, and a synthesized technical narrative.
        """
        profile = FacilityFingerprintEngine.get_facility_profile(facility_name)
        baseline_frp = float(baseline_frp_override if baseline_frp_override is not None else profile.get("baseline_frp", 12.0))
        max_historical_frp = float(profile.get("max_historical_frp", 25.0))
        
        cur_frp = max(0.0, float(current_frp))
        mean_frp = max(0.1, float(avg_frp if avg_frp is not None else cur_frp))
        curr_days = max(1, int(active_days if active_days is not None else 1))
        detections = max(1, int(total_detections if total_detections is not None else 1))
        expected_days = max(1, int(expected_duration_override if expected_duration_override is not None else 1))
        expected_freq = max(1, int(baseline_frequency_override if baseline_frequency_override is not None else 3))

        # -------------------------------------------------------------
        # 1. INTENSITY ANOMALY (Current FRP vs Baseline FRP)
        # -------------------------------------------------------------
        intensity_ratio = round(cur_frp / max(baseline_frp, 1.0), 2)
        if intensity_ratio <= 1.0:
            s_intensity = 0.0
            status_intensity = "NORMAL"
            detail_intensity = f"FRP ({cur_frp:.1f} MW) is within baseline envelope ({baseline_frp:.1f} MW)"
            bullet_intensity = f"FRP is within routine baseline ({intensity_ratio:.1f}x)"
        elif intensity_ratio <= 1.25:
            s_intensity = (intensity_ratio - 1.0) / 0.25 * 35.0
            status_intensity = "NORMAL"
            detail_intensity = f"FRP ({cur_frp:.1f} MW) is slightly elevated ({intensity_ratio:.1f}x baseline of {baseline_frp:.1f} MW)"
            bullet_intensity = f"FRP is within routine baseline ({intensity_ratio:.1f}x)"
        elif intensity_ratio <= 2.0:
            s_intensity = 35.0 + ((intensity_ratio - 1.25) / 0.75) * 25.0
            status_intensity = "ELEVATED"
            detail_intensity = f"FRP is {intensity_ratio:.1f}x above baseline ({cur_frp:.1f} MW vs {baseline_frp:.1f} MW)"
            bullet_intensity = f"FRP is {intensity_ratio:.1f}x above baseline"
        elif intensity_ratio <= 3.5:
            s_intensity = 60.0 + ((intensity_ratio - 2.0) / 1.5) * 20.0
            status_intensity = "ABNORMAL"
            detail_intensity = f"FRP is {intensity_ratio:.1f}x above baseline ({cur_frp:.1f} MW vs {baseline_frp:.1f} MW)"
            bullet_intensity = f"FRP is {intensity_ratio:.1f}x above baseline"
        else:
            s_intensity = min(100.0, 80.0 + ((intensity_ratio - 3.5) / 2.5) * 20.0)
            status_intensity = "SEVERELY_ABNORMAL"
            detail_intensity = f"FRP is {intensity_ratio:.1f}x above baseline ({cur_frp:.1f} MW vs {baseline_frp:.1f} MW) exceeding historical peak ({max_historical_frp:.1f} MW)"
            bullet_intensity = f"FRP is {intensity_ratio:.1f}x above baseline"
        s_intensity = round(s_intensity, 1)

        # -------------------------------------------------------------
        # 2. PERSISTENCE ANOMALY (Current Duration vs Expected Duration)
        # -------------------------------------------------------------
        excess_pct = round(max(0.0, ((curr_days - expected_days) / float(expected_days)) * 100.0), 1)
        if excess_pct == 0.0:
            s_persistence = 10.0
            status_persistence = "NORMAL"
            detail_persistence = f"Event duration ({curr_days} day) matches normal operational expectation"
            bullet_persistence = "Event duration within normal baseline"
        elif excess_pct <= 50.0:
            s_persistence = 10.0 + (excess_pct / 50.0) * 25.0
            status_persistence = "NORMAL"
            detail_persistence = f"Event duration is within normal operational limits (+{excess_pct:.0f}%)"
            bullet_persistence = "Event duration within normal baseline"
        elif excess_pct <= 150.0:
            s_persistence = 35.0 + ((excess_pct - 50.0) / 100.0) * 25.0
            status_persistence = "ELEVATED"
            detail_persistence = f"Event duration exceeds normal by {excess_pct:.0f}% ({curr_days} days active vs {expected_days} expected)"
            bullet_persistence = f"Event duration exceeds normal by {excess_pct:.0f}%"
        elif excess_pct <= 300.0:
            s_persistence = 60.0 + ((excess_pct - 150.0) / 150.0) * 20.0
            status_persistence = "ABNORMAL" if excess_pct < 300.0 else "SEVERELY_ABNORMAL"
            detail_persistence = f"Event duration exceeds normal by {excess_pct:.0f}% ({curr_days} days active vs {expected_days} expected)"
            bullet_persistence = f"Event duration exceeds normal by {excess_pct:.0f}%"
        else:
            s_persistence = min(100.0, 80.0 + ((excess_pct - 300.0) / 200.0) * 20.0)
            status_persistence = "SEVERELY_ABNORMAL"
            detail_persistence = f"Event duration exceeds normal by {excess_pct:.0f}% ({curr_days} days active vs {expected_days} expected)"
            bullet_persistence = f"Event duration exceeds normal by {excess_pct:.0f}%"
        s_persistence = round(s_persistence, 1)

        # -------------------------------------------------------------
        # 3. GROWTH ANOMALY (Peak FRP vs Mean FRP & Surge Trend)
        # -------------------------------------------------------------
        growth_ratio = round(cur_frp / max(mean_frp, 1.0), 2)
        growth_rate_pct = round(max(0.0, ((cur_frp - mean_frp) / max(mean_frp, 1.0)) * 100.0), 1)

        if growth_ratio <= 1.25:
            s_growth = 15.0
            status_growth = "NORMAL"
            trend_growth = "STABLE"
            detail_growth = f"Thermal growth stable with steady heat output (+{growth_rate_pct:.1f}% peak spread)"
            bullet_growth = "Thermal growth stable"
        elif growth_ratio <= 1.60:
            s_growth = 35.0 + ((growth_ratio - 1.25) / 0.35) * 15.0
            status_growth = "ELEVATED"
            trend_growth = "EXPANDING"
            detail_growth = f"Thermal growth expanding (+{growth_rate_pct:.1f}% peak spread over cluster mean)"
            bullet_growth = "Thermal growth expanding"
        elif growth_ratio <= 2.20:
            s_growth = 50.0 + ((growth_ratio - 1.60) / 0.60) * 25.0
            status_growth = "ABNORMAL"
            trend_growth = "ACCELERATING"
            detail_growth = f"Thermal growth accelerating rapidly (+{growth_rate_pct:.1f}% peak-to-mean surge)"
            bullet_growth = "Thermal growth accelerating"
        else:
            s_growth = min(100.0, 75.0 + ((growth_ratio - 2.20) / 1.0) * 25.0)
            status_growth = "SEVERELY_ABNORMAL"
            trend_growth = "EXPLOSIVE"
            detail_growth = f"Thermal growth explosive with rapid combustion runaway (+{growth_rate_pct:.1f}% surge)"
            bullet_growth = "Thermal growth accelerating"

        if is_anomaly_spike:
            s_growth = max(s_growth, 75.0)
            trend_growth = "ACCELERATING" if trend_growth in ["STABLE", "EXPANDING"] else trend_growth
            bullet_growth = "Thermal growth accelerating"

        s_growth = round(s_growth, 1)

        # -------------------------------------------------------------
        # 4. RECURRENCE ANOMALY (Observed Frequency vs Monthly Baseline)
        # -------------------------------------------------------------
        observed_freq = max(1, (detections + 1) // 2 + (curr_days - 1))
        rec_ratio = round(observed_freq / float(expected_freq), 2)

        if rec_ratio <= 1.0:
            s_recurrence = 15.0
            status_recurrence = "NORMAL"
            detail_recurrence = f"Recurrence frequency within nominal monthly baseline ({observed_freq} observed vs {expected_freq} expected)"
            bullet_recurrence = "Recurrence within monthly baseline"
        elif rec_ratio <= 1.50:
            s_recurrence = 35.0 + ((rec_ratio - 1.0) / 0.50) * 15.0
            status_recurrence = "ELEVATED"
            detail_recurrence = f"Recurrence moderately elevated ({observed_freq} observed events vs {expected_freq} baseline)"
            bullet_recurrence = "Recurrence moderately elevated"
        elif rec_ratio <= 2.20:
            s_recurrence = 50.0 + ((rec_ratio - 1.50) / 0.70) * 25.0
            status_recurrence = "ABNORMAL"
            detail_recurrence = f"Recurrence exceeds monthly average ({observed_freq} observed events vs {expected_freq} baseline)"
            bullet_recurrence = "Recurrence exceeds monthly average"
        else:
            s_recurrence = min(100.0, 75.0 + ((rec_ratio - 2.20) / 1.0) * 25.0)
            status_recurrence = "SEVERELY_ABNORMAL"
            detail_recurrence = f"Severe anomalous recurrence frequency ({observed_freq} observed events vs {expected_freq} baseline)"
            bullet_recurrence = "Recurrence exceeds monthly average"
        s_recurrence = round(s_recurrence, 1)

        # -------------------------------------------------------------
        # COMPOSITE ABNORMALITY SCORE (0 - 100)
        # -------------------------------------------------------------
        composite_score = round(
            cls.WEIGHT_INTENSITY * s_intensity
            + cls.WEIGHT_GROWTH * s_growth
            + cls.WEIGHT_PERSISTENCE * s_persistence
            + cls.WEIGHT_RECURRENCE * s_recurrence,
            1
        )
        composite_score = min(100.0, max(0.0, composite_score))

        # Overall Status Classification
        if composite_score >= 80.0:
            overall_status = "SEVERELY_ABNORMAL"
            narrative = (
                f"CRITICAL ABNORMALITY: Incident exhibits severe operational deviation with heat intensity {intensity_ratio:.1f}x baseline. "
                f"Thermal growth is {trend_growth.lower()} and duration exceeds expected operational bounds by {excess_pct:.0f}%. "
                f"Immediate emergency dispatch and on-site investigation required."
            )
        elif composite_score >= 60.0:
            overall_status = "ABNORMAL"
            narrative = (
                f"SIGNIFICANT ABNORMALITY: Thermal activity is abnormal ({intensity_ratio:.1f}x baseline). "
                f"Growth patterns indicate potential process upset or flare failure requiring priority verification."
            )
        elif composite_score >= 35.0:
            overall_status = "ELEVATED"
            narrative = (
                f"MODERATE ABNORMALITY: Thermal parameters moderately exceed routine baseline ({intensity_ratio:.1f}x baseline). "
                f"Likely operational flaring flux or scheduled high-temperature maintenance."
            )
        else:
            overall_status = "NORMAL"
            narrative = (
                f"NORMAL THERMAL BEHAVIOR: All observed thermal parameters fall within expected historical baseline "
                f"and seasonal tolerances for {facility_name}."
            )

        # Compile Itemized Explanations
        explanation_bullets = [
            bullet_intensity,
            bullet_persistence,
            bullet_growth,
            bullet_recurrence
        ]

        return {
            "abnormality_score": composite_score,
            "abnormality_status": overall_status,
            "intensity_anomaly": {
                "score": s_intensity,
                "status": status_intensity,
                "current_frp": round(cur_frp, 1),
                "baseline_frp": round(baseline_frp, 1),
                "ratio": intensity_ratio,
                "detail": detail_intensity
            },
            "persistence_anomaly": {
                "score": s_persistence,
                "status": status_persistence,
                "current_duration_days": curr_days,
                "expected_duration_days": expected_days,
                "excess_percentage": excess_pct,
                "detail": detail_persistence
            },
            "growth_anomaly": {
                "score": s_growth,
                "status": status_growth,
                "growth_rate_pct": growth_rate_pct,
                "peak_to_mean_ratio": growth_ratio,
                "trend": trend_growth,
                "detail": detail_growth
            },
            "recurrence_anomaly": {
                "score": s_recurrence,
                "status": status_recurrence,
                "observed_frequency": observed_freq,
                "baseline_frequency": expected_freq,
                "ratio": rec_ratio,
                "detail": detail_recurrence
            },
            "explanation": explanation_bullets,
            "narrative": narrative
        }
