import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.db_models import FacilityThermalProfileModel


class FacilityFingerprintEngine:
    """
    Maintains historical thermal fingerprints, baselines, and variance profiles
    for industrial installations across the Gujarat Industrial Corridor.
    Compares real-time thermal flux against facility historical envelopes.
    """

    # Curated authoritative historical profiles for key industrial complexes in the monitored region
    KNOWN_BASELINES: Dict[str, Dict[str, Any]] = {
        "Jamnagar Petroleum Refining Complex": {
            "facility_type": "oil_refinery",
            "baseline_frp": 22.5,
            "max_historical_frp": 45.0,
            "std_frp": 5.2,
            "persistence_days": 42,
            "event_frequency": "Continuous 24/7 Base Operation",
            "seasonal_behavior": "Constant Year-Round Base Flaring with minor winter peaking"
        },
        "Hazira Heavy Industrial & Steel Complex": {
            "facility_type": "steel_and_heavy_industry",
            "baseline_frp": 18.0,
            "max_historical_frp": 38.0,
            "std_frp": 4.8,
            "persistence_days": 36,
            "event_frequency": "Continuous 24/7 Base Operation",
            "seasonal_behavior": "Steady metallurgical thermal output with monsoonal cooling dips"
        },
        "Dahej PCPIR Petrochemical Complex": {
            "facility_type": "chemical_petrochemical",
            "baseline_frp": 14.5,
            "max_historical_frp": 32.0,
            "std_frp": 3.9,
            "persistence_days": 28,
            "event_frequency": "Regular Intermittent Flaring",
            "seasonal_behavior": "Elevated during post-monsoon petrochemical production cycles"
        },
        "NTPC Kawas Combined Cycle Gas Power Station": {
            "facility_type": "power_plant",
            "baseline_frp": 12.0,
            "max_historical_frp": 26.0,
            "std_frp": 3.1,
            "persistence_days": 15,
            "event_frequency": "Peaking Load Operation",
            "seasonal_behavior": "High dispatch in summer pre-monsoon heatwave peaks"
        },
        "ONGC Hazira Gas Processing Terminal": {
            "facility_type": "gas_processing",
            "baseline_frp": 11.0,
            "max_historical_frp": 24.0,
            "std_frp": 2.8,
            "persistence_days": 24,
            "event_frequency": "Continuous Operational Sweetening",
            "seasonal_behavior": "Consistent round-the-clock sour gas sweetening emission"
        },
        "Ankleshwar GIDC Chemical Zone": {
            "facility_type": "chemical_estate",
            "baseline_frp": 10.0,
            "max_historical_frp": 22.0,
            "std_frp": 2.5,
            "persistence_days": 18,
            "event_frequency": "Intermittent Batch Processing",
            "seasonal_behavior": "Year-round specialty chemical manufacturing thermal output"
        },
        "Vapi GIDC Industrial Complex": {
            "facility_type": "chemical_and_dye",
            "baseline_frp": 9.5,
            "max_historical_frp": 21.0,
            "std_frp": 2.3,
            "persistence_days": 14,
            "event_frequency": "Intermittent Production",
            "seasonal_behavior": "Stable emission profile with periodic maintenance shutdowns"
        }
    }

    _cache: Dict[str, Dict[str, Any]] = {}
    _initialized_db: bool = False

    @classmethod
    def seed_database_profiles(cls, db: Session) -> None:
        """Populates the database table with authoritative baselines if empty."""
        try:
            count = db.query(FacilityThermalProfileModel).count()
            if count == 0:
                for name, prof in cls.KNOWN_BASELINES.items():
                    db_entry = FacilityThermalProfileModel(
                        facility_name=name,
                        facility_type=prof["facility_type"],
                        avg_frp=prof["baseline_frp"],
                        max_frp=prof["max_historical_frp"],
                        std_frp=prof["std_frp"],
                        total_detections=prof["persistence_days"] * 2,
                        persistence_days=prof["persistence_days"],
                        event_frequency=prof["event_frequency"],
                        seasonal_behavior=prof["seasonal_behavior"]
                    )
                    db.add(db_entry)
                db.commit()
                logger.info("Successfully seeded facility thermal profiles table in database.")
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to seed facility thermal profiles: {e}")

    @classmethod
    def get_facility_profile(cls, facility_name: str) -> Dict[str, Any]:
        """
        Retrieves historical baseline profile for a facility with fuzzy matching
        and graceful fallback for newly detected or unnamed sites.
        """
        if not facility_name or facility_name in ["None", "Unknown", "No OSM data available", "Unnamed Facility"]:
            return {
                "facility_name": facility_name or "Unregistered Rural Area",
                "facility_type": "rural_non_industrial",
                "baseline_frp": 8.0,
                "max_historical_frp": 16.0,
                "std_frp": 2.0,
                "persistence_days": 1,
                "event_frequency": "Transient Event",
                "seasonal_behavior": "Low background rural biomass or agricultural profile"
            }

        # Check exact match
        if facility_name in cls.KNOWN_BASELINES:
            return cls.KNOWN_BASELINES[facility_name]

        # Check case-insensitive / substring match
        f_lower = facility_name.lower()
        for k, v in cls.KNOWN_BASELINES.items():
            if k.lower() in f_lower or f_lower in k.lower():
                return v

        # Keyword mapping for regional industrial hubs
        keywords = {
            "jamnagar": "Jamnagar Petroleum Refining Complex",
            "hazira": "Hazira Heavy Industrial & Steel Complex",
            "dahej": "Dahej PCPIR Petrochemical Complex",
            "kawas": "NTPC Kawas Combined Cycle Gas Power Station",
            "ongc": "ONGC Hazira Gas Processing Terminal",
            "ankleshwar": "Ankleshwar GIDC Chemical Zone",
            "vapi": "Vapi GIDC Industrial Complex",
        }
        for kw, target_key in keywords.items():
            if kw in f_lower:
                return cls.KNOWN_BASELINES[target_key]

        # Fallback profile for general industrial facilities
        return {
            "facility_name": facility_name,
            "facility_type": "industrial",
            "baseline_frp": 12.0,
            "max_historical_frp": 25.0,
            "std_frp": 3.5,
            "persistence_days": 5,
            "event_frequency": "Recurring Industrial Source",
            "seasonal_behavior": "Standardized industrial operation profile"
        }

    @classmethod
    def evaluate_incident_fingerprint(
        cls,
        facility_name: str,
        current_frp: float,
        facility_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compares an active incident's FRP against the facility's historical baseline.
        Computes anomaly ratio, status classification, and physical explanation.
        """
        profile = cls.get_facility_profile(facility_name)
        baseline_frp = float(profile["baseline_frp"])
        max_historical_frp = float(profile["max_historical_frp"])
        cur_frp = max(0.0, float(current_frp))

        # Calculate Anomaly Ratio
        anomaly_ratio = round(cur_frp / max(baseline_frp, 1.0), 2)

        # Classify Thermal Status
        if anomaly_ratio <= 1.25:
            thermal_status = "NORMAL"
            explanation = (
                f"Observed FRP of {cur_frp:.1f} MW is {anomaly_ratio}x of the historical baseline ({baseline_frp:.1f} MW). "
                f"Emissions are fully consistent with routine operational flaring tolerances for {facility_name}."
            )
        elif anomaly_ratio <= 2.0:
            thermal_status = "ELEVATED"
            explanation = (
                f"Observed FRP of {cur_frp:.1f} MW is {anomaly_ratio}x above historical baseline ({baseline_frp:.1f} MW). "
                f"Reflects moderate thermal escalation above routine levels (Historical Max: {max_historical_frp:.1f} MW)."
            )
        elif anomaly_ratio <= 3.5:
            thermal_status = "ABNORMAL"
            explanation = (
                f"Observed FRP of {cur_frp:.1f} MW represents an abnormal {anomaly_ratio}x surge over baseline ({baseline_frp:.1f} MW). "
                f"Exceeds typical operational envelope; likely process upset, relief valve discharge, or localized combustion incident."
            )
        else:
            thermal_status = "CRITICAL"
            explanation = (
                f"CRITICAL THERMAL EXCURSION: Observed FRP of {cur_frp:.1f} MW is {anomaly_ratio}x of historical baseline ({baseline_frp:.1f} MW) "
                f"and significantly exceeds historical peak ({max_historical_frp:.1f} MW). Indicates severe industrial fire outbreak or catastrophic equipment failure."
            )

        return {
            "facility_name": facility_name,
            "facility_type": profile.get("facility_type", facility_type or "industrial"),
            "baseline_frp": baseline_frp,
            "current_frp": round(cur_frp, 1),
            "anomaly_ratio": anomaly_ratio,
            "thermal_status": thermal_status,
            "explanation": explanation,
            "max_historical_frp": max_historical_frp,
            "persistence_days": profile.get("persistence_days", 1),
            "event_frequency": profile.get("event_frequency", "RECURRING_OPERATIONAL"),
            "seasonal_behavior": profile.get("seasonal_behavior", "Consistent Year-Round Emissions")
        }
