"""
Persistent Incident Registry Service (Phase 12B)
SIH26162 — Thermal Industrial Fire Intelligence Platform

Decouples transient DBSCAN cluster IDs from persistent, traceable incident records.
Provides permanent UUID generation, lifecycle state management (NEW, UNDER_REVIEW,
VERIFIED_FIRE, FALSE_ALARM, CONTROLLED_FLARING, ARCHIVED), and ground-truth review synchronization.

Scientific Grounding:
Observation-derived status (RECENTLY_OBSERVED, RECENT, HISTORICAL) is derived from the
latest available satellite infrared observation pass (NASA FIRMS) and does NOT represent
real-time physical ground truth.
"""

import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.core.logging import logger
from app.db.db_models import IncidentRecordModel, GroundTruthLabelModel
from app.analytics.temporal_engine import (
    TemporalEngine,
    STATUS_RECENTLY_OBSERVED,
    STATUS_RECENT,
    STATUS_HISTORICAL,
    TEMPORAL_STATUS_ALIASES,
    parse_observation_timestamp
)


def _slugify(text: str) -> str:
    """Creates a sanitized alphanumeric slug for readable UUID generation."""
    s = re.sub(r"[^\w\s-]", "", str(text)).strip().upper()
    return re.sub(r"[-\s]+", "-", s)[:16]


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC for safe comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def sanitize_action_code_for_temporal_status(action_code: str, temporal_status: str) -> str:
    """
    Ensures historical incidents cannot generate emergency or urgent operational directives.
    Phase 13.1G Validation Requirement.
    """
    if temporal_status == STATUS_HISTORICAL:
        return "ROUTINE_MONITORING_RECOMMENDED"
    return action_code


class IncidentRegistryService:
    """
    Manages persistent incident records, assigning permanent UUIDs and maintaining
    lifecycle status across repeated pipeline executions.
    """

    VALID_STATUSES = {
        "NEW",
        "UNDER_REVIEW",
        "VERIFIED_FIRE",
        "FALSE_ALARM",
        "CONTROLLED_FLARING",
        "ARCHIVED"
    }

    LABEL_TO_STATUS_MAP = {
        "TRUE_FIRE": "VERIFIED_FIRE",
        "FALSE_ALARM": "FALSE_ALARM",
        "CONTROLLED_FLARING": "CONTROLLED_FLARING",
        "MAINTENANCE_ACTIVITY": "CONTROLLED_FLARING"
    }

    @classmethod
    def generate_incident_uuid(
        cls,
        facility_name: str,
        region_code: str,
        first_detected: datetime,
        cluster_id: Optional[str] = None
    ) -> str:
        """
        Generates a deterministic, human-scannable, collision-free UUID.
        Example: INC-20260824-WGUJ-RELIANCE-JAMN-A1B2
        """
        date_str = first_detected.strftime("%Y%m%d")
        reg_slug = _slugify(region_code)[:4] or "IND"
        fac_slug = _slugify(facility_name)[:12] or "FACILITY"
        # Deterministic seed from identity attributes and cluster_id
        seed_str = f"{region_code}_{facility_name}_{date_str}_{cluster_id or ''}"
        short_hash = uuid.uuid5(uuid.NAMESPACE_DNS, seed_str).hex[:4].upper()
        return f"INC-{date_str}-{reg_slug}-{fac_slug}-{short_hash}"

    @classmethod
    def sync_incidents_from_clusters(
        cls,
        db: Session,
        clusters_df: pd.DataFrame,
        enriched_obs_df: pd.DataFrame,
        reference_time: Optional[datetime] = None
    ) -> List[IncidentRecordModel]:
        """
        Synchronizes transient DBSCAN clusters into persistent IncidentRecordModel rows.
        Maintains permanent incident_uuid, updates telemetry and temporal status,
        and links existing human ground-truth labels.
        """
        if clusters_df.empty or enriched_obs_df.empty:
            return []

        # Load existing UUIDs and ground truth labels into memory for fast lookup
        assigned_uuids = set(r[0] for r in db.query(IncidentRecordModel.incident_uuid).all())
        gt_labels = db.query(GroundTruthLabelModel).all()
        gt_map: Dict[str, str] = {}
        for gt in gt_labels:
            # Map both cluster_id and incident_uuid if present
            gt_map[gt.incident_uuid] = gt.assigned_label

        persisted_records: List[IncidentRecordModel] = []

        for _, row in clusters_df.iterrows():
            cluster_id = str(row["cluster_id"])
            fac_name = str(row.get("nearest_facility_name", "Industrial Facility"))
            state = str(row.get("state", "Gujarat"))
            region_code = str(row.get("region_code", "WEST_GUJARAT"))
            risk_score = float(row.get("risk_score", 0.0))
            abnormality_score = float(row.get("abnormality_detection", {}).get("abnormality_score", 0.0)) if isinstance(row.get("abnormality_detection"), dict) else 0.0
            peak_frp = float(row.get("max_frp", 0.0))
            centroid_lat = float(row.get("centroid_lat", 0.0))
            centroid_lon = float(row.get("centroid_lon", 0.0))
            action_code = str(row.get("action_code", "BACKGROUND_LOG"))
            risk_level = str(row.get("risk_level", "LOW"))

            # Extract constituent observations for this cluster
            cluster_obs = enriched_obs_df[enriched_obs_df["cluster_id"] == cluster_id]
            temporal_info = TemporalEngine.evaluate_cluster_dataframe(cluster_obs, reference_time=reference_time)

            first_dt = datetime.fromisoformat(temporal_info["first_detected"])
            last_dt = datetime.fromisoformat(temporal_info["last_detected"])
            temp_status = temporal_info["temporal_status"]
            det_count = temporal_info["detection_count"]

            # Check if this cluster or facility already has a registered incident
            # Look up by cluster_id or facility match within temporal proximity
            existing = (
                db.query(IncidentRecordModel)
                .filter(
                    or_(
                        IncidentRecordModel.cluster_id == cluster_id,
                        (IncidentRecordModel.facility_name == fac_name) &
                        (IncidentRecordModel.region_code == region_code) &
                        (IncidentRecordModel.first_detected >= first_dt - timedelta(days=2)) &
                        (IncidentRecordModel.first_detected <= first_dt + timedelta(days=2))
                    )
                )
                .first()
            )

            # Determine ground truth status transition
            matched_label = gt_map.get(cluster_id)
            if existing and existing.incident_uuid in gt_map:
                matched_label = gt_map[existing.incident_uuid]

            new_lifecycle_status = "NEW"
            if matched_label:
                new_lifecycle_status = cls.LABEL_TO_STATUS_MAP.get(matched_label, "VERIFIED_FIRE")
            elif existing and existing.status != "NEW":
                new_lifecycle_status = existing.status

            if existing:
                # Update existing record
                existing.cluster_id = cluster_id
                existing.first_detected = min(_to_utc(existing.first_detected), first_dt)
                existing.last_detected = max(_to_utc(existing.last_detected), last_dt)
                existing.risk_score = risk_score
                existing.abnormality_score = abnormality_score
                existing.temporal_status = temp_status
                existing.detection_count = max(existing.detection_count, det_count)
                existing.peak_frp = max(existing.peak_frp or 0.0, peak_frp)
                existing.centroid_lat = centroid_lat
                existing.centroid_lon = centroid_lon
                safe_action_code = sanitize_action_code_for_temporal_status(action_code, temp_status)
                existing.action_code = safe_action_code
                existing.risk_level = risk_level
                existing.status = new_lifecycle_status
                existing.updated_at = datetime.now(timezone.utc)
                persisted_records.append(existing)
            else:
                # Generate stable UUID and create new record
                inc_uuid = cls.generate_incident_uuid(fac_name, region_code, first_dt, cluster_id=cluster_id)
                base_uuid = inc_uuid
                while inc_uuid in assigned_uuids or db.query(IncidentRecordModel).filter(IncidentRecordModel.incident_uuid == inc_uuid).first():
                    inc_uuid = f"{base_uuid}-{uuid.uuid4().hex[:4].upper()}"
                assigned_uuids.add(inc_uuid)

                safe_action_code = sanitize_action_code_for_temporal_status(action_code, temp_status)
                new_inc = IncidentRecordModel(
                    incident_uuid=inc_uuid,
                    cluster_id=cluster_id,
                    facility_name=fac_name,
                    state=state,
                    region_code=region_code,
                    first_detected=first_dt,
                    last_detected=last_dt,
                    risk_score=risk_score,
                    abnormality_score=abnormality_score,
                    temporal_status=temp_status,
                    detection_count=det_count,
                    status=new_lifecycle_status,
                    centroid_lat=centroid_lat,
                    centroid_lon=centroid_lon,
                    peak_frp=peak_frp,
                    action_code=safe_action_code,
                    risk_level=risk_level,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(new_inc)
                persisted_records.append(new_inc)

        try:
            db.commit()
            for r in persisted_records:
                db.refresh(r)
        except Exception as e:
            db.rollback()
            logger.error(f"Error persisting incidents to registry: {e}")

        return persisted_records

    @classmethod
    def list_incidents(
        cls,
        db: Session,
        region: Optional[str] = None,
        state: Optional[str] = None,
        temporal_status: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[IncidentRecordModel]:
        """Lists incidents from persistent registry with flexible filters."""
        query = db.query(IncidentRecordModel)

        if region and region.upper() not in ["ALL", "ALL_INDIA"]:
            query = query.filter(IncidentRecordModel.region_code == region.upper())

        if state and state.lower() != "all":
            query = query.filter(IncidentRecordModel.state.ilike(state.strip()))

        if temporal_status and temporal_status.upper() != "ALL":
            # Map aliases (e.g. ACTIVE -> RECENTLY_OBSERVED)
            norm_ts = TEMPORAL_STATUS_ALIASES.get(temporal_status.upper(), temporal_status.upper())
            query = query.filter(IncidentRecordModel.temporal_status == norm_ts)

        if status and status.upper() != "ALL":
            query = query.filter(IncidentRecordModel.status == status.upper())

        return query.order_by(desc(IncidentRecordModel.risk_score), desc(IncidentRecordModel.last_detected)).offset(offset).limit(limit).all()

    @classmethod
    def get_incident_by_uuid(cls, db: Session, incident_uuid: str) -> Optional[IncidentRecordModel]:
        """Fetches incident by persistent UUID."""
        return db.query(IncidentRecordModel).filter(IncidentRecordModel.incident_uuid == incident_uuid).first()

    @classmethod
    def get_incident_by_cluster_id(cls, db: Session, cluster_id: str) -> Optional[IncidentRecordModel]:
        """Fetches incident by transient DBSCAN cluster ID."""
        return db.query(IncidentRecordModel).filter(IncidentRecordModel.cluster_id == cluster_id).first()

    @classmethod
    def get_archived_incidents(
        cls,
        db: Session,
        region: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[IncidentRecordModel]:
        """Returns incidents categorized as HISTORICAL or ARCHIVED."""
        query = db.query(IncidentRecordModel).filter(
            or_(
                IncidentRecordModel.temporal_status == STATUS_HISTORICAL,
                IncidentRecordModel.status == "ARCHIVED"
            )
        )

        if region and region.upper() not in ["ALL", "ALL_INDIA"]:
            query = query.filter(IncidentRecordModel.region_code == region.upper())

        return query.order_by(desc(IncidentRecordModel.last_detected)).offset(offset).limit(limit).all()

    @classmethod
    def update_incident_status(
        cls,
        db: Session,
        incident_uuid: str,
        new_status: str
    ) -> IncidentRecordModel:
        """Transitions incident lifecycle status."""
        status_clean = new_status.strip().upper()
        if status_clean not in cls.VALID_STATUSES:
            raise ValueError(f"Invalid status '{new_status}'. Allowed: {sorted(list(cls.VALID_STATUSES))}")

        inc = cls.get_incident_by_uuid(db, incident_uuid)
        if not inc:
            raise ValueError(f"Incident with UUID '{incident_uuid}' not found.")

        inc.status = status_clean
        inc.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(inc)
        return inc
