"""
Governance Service: Reviewer Analytics & Dataset Quality Engine (Phase 14B & 14C)
Provides rigorous human intelligence governance telemetry, reviewer accountability metrics,
and empirical dataset distribution analytics without relying on synthetic or automated labels.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.db.db_models import GroundTruthLabelModel, ReviewAuditLogModel, IncidentRecordModel


class ReviewerAnalyticsService:
    """
    Tracks reviewer accountability, calculates individual and collective review throughput,
    class diversity, and builds the reviewer leaderboard.
    """

    @classmethod
    def get_analytics(cls, db: Session) -> Dict[str, Any]:
        """
        Aggregates reviewer contributions across ground_truth_labels and review_audit_logs.
        """
        all_labels = db.query(GroundTruthLabelModel).all()
        all_audits = db.query(ReviewAuditLogModel).order_by(ReviewAuditLogModel.created_at.desc()).all()

        if not all_labels and not all_audits:
            return {
                "total_active_reviewers": 0,
                "leaderboard": [],
                "summary": {
                    "total_reviews": 0,
                    "avg_reviews_per_reviewer": 0.0,
                    "most_active_reviewer": "None",
                    "total_audit_events": 0
                }
            }

        reviewer_map: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "total_reviews": 0,
            "reviews_by_class": {
                "TRUE_FIRE": 0,
                "FALSE_ALARM": 0,
                "CONTROLLED_FLARING": 0,
                "MAINTENANCE_ACTIVITY": 0
            },
            "dates": defaultdict(int),
            "last_active": None,
            "edit_count": 0
        })

        # Process active labeled records
        for lbl in all_labels:
            rev = lbl.reviewer_name
            reviewer_map[rev]["total_reviews"] += 1
            if lbl.assigned_label in reviewer_map[rev]["reviews_by_class"]:
                reviewer_map[rev]["reviews_by_class"][lbl.assigned_label] += 1
            else:
                reviewer_map[rev]["reviews_by_class"][lbl.assigned_label] = 1

            if lbl.is_edited:
                reviewer_map[rev]["edit_count"] += int(lbl.edit_count or 1)

            d_str = lbl.updated_at.strftime("%Y-%m-%d") if lbl.updated_at else datetime.now(timezone.utc).strftime("%Y-%m-%d")
            reviewer_map[rev]["dates"][d_str] += 1

            last_dt = lbl.updated_at or lbl.created_at
            if last_dt:
                curr_last = reviewer_map[rev]["last_active"]
                if not curr_last or last_dt > curr_last:
                    reviewer_map[rev]["last_active"] = last_dt

        # Enrich with audit log timestamps
        for audit in all_audits:
            rev = audit.reviewer_name
            if rev in reviewer_map:
                if audit.created_at:
                    curr_last = reviewer_map[rev]["last_active"]
                    if not curr_last or audit.created_at > curr_last:
                        reviewer_map[rev]["last_active"] = audit.created_at
                d_str = audit.created_at.strftime("%Y-%m-%d")
                reviewer_map[rev]["dates"][d_str] += 1
            else:
                # Reviewer who may have made an audit event on a reassigned label
                reviewer_map[rev]["total_reviews"] += 1
                reviewer_map[rev]["last_active"] = audit.created_at
                d_str = audit.created_at.strftime("%Y-%m-%d")
                reviewer_map[rev]["dates"][d_str] += 1

        leaderboard = []
        now = datetime.now(timezone.utc)
        # 7-day date range for daily breakdown
        last_7_days = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in reversed(range(7))]

        for rev_name, data in reviewer_map.items():
            daily_list = [{"date": d, "count": data["dates"].get(d, 0)} for d in last_7_days]
            last_active_iso = data["last_active"].isoformat() if data["last_active"] else None

            leaderboard.append({
                "reviewer_name": rev_name,
                "total_reviews": data["total_reviews"],
                "reviews_by_class": data["reviews_by_class"],
                "daily_review_count": daily_list,
                "last_active": last_active_iso,
                "edit_count": data["edit_count"]
            })

        # Sort leaderboard descending by total reviews
        leaderboard.sort(key=lambda x: x["total_reviews"], reverse=True)

        total_rev_count = sum(r["total_reviews"] for r in leaderboard)
        active_count = len(leaderboard)
        avg_revs = round(total_rev_count / active_count, 1) if active_count > 0 else 0.0
        most_active = leaderboard[0]["reviewer_name"] if leaderboard else "None"

        return {
            "total_active_reviewers": active_count,
            "leaderboard": leaderboard,
            "summary": {
                "total_reviews": total_rev_count,
                "avg_reviews_per_reviewer": avg_revs,
                "most_active_reviewer": most_active,
                "total_audit_events": len(all_audits)
            }
        }


class DatasetQualityService:
    """
    Calculates dataset completeness, verification coverage, class distribution,
    geographic spread, and temporal labeling trends.
    """

    @classmethod
    def get_quality_metrics(cls, db: Session) -> Dict[str, Any]:
        """
        Returns high-fidelity empirical dataset telemetry for ML governance.
        """
        labels = db.query(GroundTruthLabelModel).all()
        total_labeled = len(labels)

        # Total incidents count from IncidentRecordModel or fallback
        total_incidents_db = db.query(func.count(IncidentRecordModel.incident_uuid)).scalar() or 0
        total_incidents = max(total_incidents_db, total_labeled, 6)

        coverage_pct = round((total_labeled / total_incidents) * 100.0, 1) if total_incidents > 0 else 0.0
        coverage_pct = min(100.0, coverage_pct)

        # Label Distribution
        label_dist = {
            "TRUE_FIRE": 0,
            "FALSE_ALARM": 0,
            "CONTROLLED_FLARING": 0,
            "MAINTENANCE_ACTIVITY": 0,
            "UNLABELED": max(0, total_incidents - total_labeled)
        }
        for lbl in labels:
            if lbl.assigned_label in label_dist:
                label_dist[lbl.assigned_label] += 1
            else:
                label_dist[lbl.assigned_label] = 1

        # Labels Per Reviewer
        reviewer_dist: Dict[str, int] = defaultdict(int)
        for lbl in labels:
            reviewer_dist[lbl.reviewer_name] += 1

        # Region Distribution
        region_dist: Dict[str, int] = defaultdict(int)
        for lbl in labels:
            reg = lbl.region_code or "WEST_GUJARAT"
            region_dist[reg] += 1
        if not region_dist:
            region_dist["WEST_GUJARAT"] = 0

        # Facility Distribution
        facility_counts: Dict[str, int] = defaultdict(int)
        for lbl in labels:
            facility_counts[lbl.facility_name] += 1
        
        facility_dist = [
            {"facility_name": fac, "count": cnt}
            for fac, cnt in sorted(facility_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Last 7-day Review Trend
        now = datetime.now(timezone.utc)
        daily_map: Dict[str, int] = defaultdict(int)
        for lbl in labels:
            d = (lbl.created_at or now).strftime("%Y-%m-%d")
            daily_map[d] += 1

        trend_7d = []
        for i in reversed(range(7)):
            day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            trend_7d.append({
                "date": day_str,
                "count": daily_map.get(day_str, 0)
            })

        # Edited labels
        edited_count = sum(1 for lbl in labels if lbl.is_edited)

        # Data Integrity Score (0 to 100)
        # Factors: coverage (40%), reviewer diversity (20%), notes completeness (20%), class balance (20%)
        notes_with_detail = sum(1 for lbl in labels if lbl.review_notes and len(lbl.review_notes.strip()) >= 10)
        notes_ratio = (notes_with_detail / total_labeled) if total_labeled > 0 else 0.0
        reviewer_count = len(reviewer_dist)
        rev_score = min(1.0, reviewer_count / 3.0)

        # Classes represented ratio
        active_classes = sum(1 for k, v in label_dist.items() if k != "UNLABELED" and v > 0)
        class_score = active_classes / 4.0

        integrity_score = round(
            (coverage_pct * 0.40) +
            (rev_score * 20.0) +
            (notes_ratio * 20.0) +
            (class_score * 20.0),
            1
        )
        integrity_score = max(5.0, min(100.0, integrity_score))

        return {
            "total_incidents": total_incidents,
            "total_labeled_incidents": total_labeled,
            "verified_coverage_pct": coverage_pct,
            "label_distribution": label_dist,
            "labels_per_reviewer": dict(reviewer_dist),
            "region_distribution": dict(region_dist),
            "facility_distribution": facility_dist,
            "last_7_day_trend": trend_7d,
            "edited_labels_count": edited_count,
            "data_integrity_score": integrity_score
        }
