import io
import csv
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.db_models import GroundTruthLabelModel, ReviewAuditLogModel
from app.models.schemas import GroundTruthLabelCreate, GroundTruthLabelUpdate


def validate_reviewer_name(name: Optional[str]) -> str:
    """Ensures reviewer identity is provided, non-empty, and not anonymous."""
    if not name or not isinstance(name, str) or len(name.strip()) < 2:
        raise ValueError("Reviewer name is required and must be at least 2 characters.")
    clean = name.strip()
    if clean.lower() in ["anonymous", "anon", "unknown", "n/a", "none"]:
        raise ValueError("Anonymous reviews are prohibited. A verified analyst name is required for training governance.")
    return clean


class GroundTruthService:
    """
    Phase 9 & 14 Ground Truth Review & Human Intelligence Governance Service.
    Enables expert human-in-the-loop review, immutable audit trail recording,
    and label quality protection for supervised machine learning training datasets.
    """

    ALLOWED_LABELS = {
        "TRUE_FIRE",
        "FALSE_ALARM",
        "CONTROLLED_FLARING",
        "MAINTENANCE_ACTIVITY"
    }

    @classmethod
    def create_label(cls, db: Session, label_in: GroundTruthLabelCreate) -> GroundTruthLabelModel:
        """
        Creates or upserts an analyst ground-truth label for a specific incident.
        Records an immutable audit entry in review_audit_logs.
        """
        if label_in.assigned_label not in cls.ALLOWED_LABELS:
            raise ValueError(
                f"Invalid label '{label_in.assigned_label}'. Must be one of: {', '.join(cls.ALLOWED_LABELS)}"
            )

        clean_reviewer = validate_reviewer_name(label_in.reviewer_name)

        # Check if record already exists for this incident_uuid
        existing = db.query(GroundTruthLabelModel).filter(
            GroundTruthLabelModel.incident_uuid == label_in.incident_uuid
        ).first()

        now = datetime.now(timezone.utc)
        if existing:
            prev_label = existing.assigned_label
            if not existing.original_label:
                existing.original_label = prev_label

            existing.facility_name = label_in.facility_name
            existing.assigned_label = label_in.assigned_label
            existing.reviewer_name = clean_reviewer
            existing.review_notes = label_in.review_notes
            existing.is_edited = True
            existing.edit_count = (existing.edit_count or 0) + 1
            existing.updated_at = now
            db.commit()
            db.refresh(existing)

            # Record audit trail
            audit_entry = ReviewAuditLogModel(
                incident_uuid=existing.incident_uuid,
                label_id=existing.id,
                facility_name=existing.facility_name,
                action_type="UPDATE",
                reviewer_name=clean_reviewer,
                previous_label=prev_label,
                new_label=existing.assigned_label,
                notes=existing.review_notes,
                created_at=now
            )
            db.add(audit_entry)
            db.commit()

            logger.info(f"Updated ground truth label for {existing.incident_uuid}: {existing.assigned_label} by {clean_reviewer}")
            return existing

        new_label = GroundTruthLabelModel(
            incident_uuid=label_in.incident_uuid,
            facility_name=label_in.facility_name,
            assigned_label=label_in.assigned_label,
            original_label=label_in.assigned_label,
            is_edited=False,
            edit_count=0,
            reviewer_name=clean_reviewer,
            review_notes=label_in.review_notes,
            created_at=now,
            updated_at=now
        )
        db.add(new_label)
        db.commit()
        db.refresh(new_label)

        # Record audit trail
        audit_entry = ReviewAuditLogModel(
            incident_uuid=new_label.incident_uuid,
            label_id=new_label.id,
            facility_name=new_label.facility_name,
            action_type="CREATE",
            reviewer_name=clean_reviewer,
            previous_label=None,
            new_label=new_label.assigned_label,
            notes=new_label.review_notes,
            created_at=now
        )
        db.add(audit_entry)
        db.commit()

        logger.info(f"Created ground truth label for {new_label.incident_uuid}: {new_label.assigned_label} by {clean_reviewer}")
        return new_label

    @classmethod
    def update_label(cls, db: Session, label_id: int, label_up: GroundTruthLabelUpdate) -> GroundTruthLabelModel:
        """
        Updates an existing ground truth label by ID and creates an immutable audit trail entry.
        """
        label_record = db.query(GroundTruthLabelModel).filter(GroundTruthLabelModel.id == label_id).first()
        if not label_record:
            raise ValueError(f"Ground truth label with id {label_id} not found.")

        if label_up.reviewer_name is not None:
            clean_reviewer = validate_reviewer_name(label_up.reviewer_name)
            label_record.reviewer_name = clean_reviewer
        else:
            clean_reviewer = label_record.reviewer_name or "Verified Analyst"

        prev_label = label_record.assigned_label
        if not label_record.original_label:
            label_record.original_label = prev_label

        if label_up.assigned_label is not None:
            if label_up.assigned_label not in cls.ALLOWED_LABELS:
                raise ValueError(
                    f"Invalid label '{label_up.assigned_label}'. Must be one of: {', '.join(cls.ALLOWED_LABELS)}"
                )
            label_record.assigned_label = label_up.assigned_label

        if label_up.review_notes is not None:
            label_record.review_notes = label_up.review_notes

        now = datetime.now(timezone.utc)
        label_record.is_edited = True
        label_record.edit_count = (label_record.edit_count or 0) + 1
        label_record.updated_at = now
        db.commit()
        db.refresh(label_record)

        audit_entry = ReviewAuditLogModel(
            incident_uuid=label_record.incident_uuid,
            label_id=label_record.id,
            facility_name=label_record.facility_name,
            action_type="UPDATE",
            reviewer_name=clean_reviewer,
            previous_label=prev_label,
            new_label=label_record.assigned_label,
            notes=label_record.review_notes,
            created_at=now
        )
        db.add(audit_entry)
        db.commit()

        logger.info(f"Updated ground truth label id={label_id}: {label_record.assigned_label} by {clean_reviewer}")
        return label_record

    @classmethod
    def get_audit_trail(
        cls,
        db: Session,
        incident_uuid: Optional[str] = None,
        reviewer_name: Optional[str] = None,
        limit: int = 50
    ) -> List[ReviewAuditLogModel]:
        """
        Retrieves the immutable review audit trail ordered descending by creation timestamp.
        Supports filtering by incident_uuid or reviewer_name.
        """
        query = db.query(ReviewAuditLogModel)
        if incident_uuid:
            query = query.filter(ReviewAuditLogModel.incident_uuid == incident_uuid)
        if reviewer_name:
            query = query.filter(ReviewAuditLogModel.reviewer_name.ilike(f"%{reviewer_name}%"))
        
        limit_val = max(1, min(limit, 500))
        return query.order_by(ReviewAuditLogModel.created_at.desc()).limit(limit_val).all()

    @classmethod
    def get_label(cls, db: Session, label_id: int) -> Optional[GroundTruthLabelModel]:
        """
        Retrieves a ground truth label by primary key.
        """
        return db.query(GroundTruthLabelModel).filter(GroundTruthLabelModel.id == label_id).first()

    @classmethod
    def get_label_by_incident(cls, db: Session, incident_uuid: str) -> Optional[GroundTruthLabelModel]:
        """
        Retrieves a ground truth label by incident UUID / cluster ID.
        """
        return db.query(GroundTruthLabelModel).filter(GroundTruthLabelModel.incident_uuid == incident_uuid).first()

    @classmethod
    def get_all_labels(cls, db: Session) -> List[GroundTruthLabelModel]:
        """
        Retrieves all labeled ground truth records.
        """
        return db.query(GroundTruthLabelModel).order_by(GroundTruthLabelModel.updated_at.desc()).all()

    @classmethod
    def get_review_feed(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Returns the active cluster incidents enriched with review status, analyst labels,
        telemetry, weather, exposure, and abnormality intelligence.
        """
        from app.api.service import PipelineService
        pipeline_data = PipelineService.get_analyzed_data(db)
        clusters_df = pipeline_data.get("clusters_df")

        # Map existing database labels by incident_uuid
        labels = cls.get_all_labels(db)
        label_map = {lbl.incident_uuid: lbl for lbl in labels}

        if clusters_df is None or clusters_df.empty:
            # Return any standalone labeled records if cluster DF is empty
            feed = []
            for lbl in labels:
                feed.append({
                    "incident_uuid": lbl.incident_uuid,
                    "facility_name": lbl.facility_name,
                    "assigned_label": lbl.assigned_label,
                    "label_id": lbl.id,
                    "reviewer_name": lbl.reviewer_name,
                    "review_notes": lbl.review_notes,
                    "original_label": lbl.original_label,
                    "is_edited": bool(lbl.is_edited),
                    "edit_count": int(lbl.edit_count or 0),
                    "is_reviewed": True,
                    "risk_score": 0.0,
                    "risk_level": "LOW",
                    "action_code": "BACKGROUND_LOG",
                    "max_frp": 0.0,
                    "avg_frp": 0.0,
                    "distance_to_industry_meters": 0.0,
                    "persistence_ratio": 0.0,
                    "active_days_count": 1,
                    "weather_context": {},
                    "exposure_context": {},
                    "facility_fingerprint": {},
                    "abnormality_detection": {}
                })
            return feed

        feed = []
        for _, row in clusters_df.iterrows():
            c_id = str(row["cluster_id"])
            fac_name = str(row.get("nearest_facility_name", "Industrial Facility"))
            lbl = label_map.get(c_id)

            item = {
                "incident_uuid": c_id,
                "facility_name": fac_name,
                "assigned_label": lbl.assigned_label if lbl else "UNLABELED",
                "label_id": lbl.id if lbl else None,
                "reviewer_name": lbl.reviewer_name if lbl else None,
                "review_notes": lbl.review_notes if lbl else None,
                "original_label": lbl.original_label if lbl else None,
                "is_edited": bool(lbl.is_edited) if lbl else False,
                "edit_count": int(lbl.edit_count or 0) if lbl else 0,
                "created_at": lbl.created_at.isoformat() if lbl else None,
                "updated_at": lbl.updated_at.isoformat() if lbl else None,
                "is_reviewed": lbl is not None,
                "risk_score": round(float(row.get("risk_score", 0.0)), 2),
                "risk_level": str(row.get("risk_level", "LOW")),
                "action_code": str(row.get("action_code", "BACKGROUND_LOG")),
                "incident_classification": str(row.get("incident_classification", "UNKNOWN")),
                "max_frp": round(float(row.get("max_frp", 0.0)), 2),
                "avg_frp": round(float(row.get("avg_frp", 0.0)), 2),
                "max_brightness": round(float(row.get("max_brightness", 300.0)), 2),
                "distance_to_industry_meters": round(float(row.get("distance_to_industry_meters", 0.0)), 1),
                "persistence_ratio": round(float(row.get("persistence_ratio", 0.0)), 4),
                "active_days_count": int(row.get("active_days_count", 1)),
                "total_detections": int(row.get("total_detections", 1)),
                "is_anomaly_spike": bool(row.get("is_anomaly_spike", False)),
                "centroid_latitude": round(float(row.get("centroid_lat", 0.0)), 6),
                "centroid_longitude": round(float(row.get("centroid_lon", 0.0)), 6),
                "weather_context": row.get("weather_context") or {},
                "exposure_context": row.get("exposure_context") or {},
                "facility_fingerprint": row.get("facility_fingerprint") or {},
                "abnormality_detection": row.get("abnormality_detection") or {}
            }
            feed.append(item)

        # Sort with unreviewed highest risk first, or reviewed with clear order
        feed.sort(key=lambda x: x["risk_score"], reverse=True)
        return feed

    @classmethod
    def export_training_records(cls, db: Session) -> str:
        """
        Exports all verified human ground truth records as CSV string.
        """
        labels = cls.get_all_labels(db)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id",
            "incident_uuid",
            "facility_name",
            "assigned_label",
            "reviewer_name",
            "review_notes",
            "created_at",
            "updated_at"
        ])
        for lbl in labels:
            writer.writerow([
                lbl.id,
                lbl.incident_uuid,
                lbl.facility_name,
                lbl.assigned_label,
                lbl.reviewer_name,
                lbl.review_notes or "",
                lbl.created_at.isoformat() if lbl.created_at else "",
                lbl.updated_at.isoformat() if lbl.updated_at else ""
            ])
        return output.getvalue()
