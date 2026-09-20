"""
Training Readiness Engine (Phase 14D)
Scientifically evaluates dataset sufficiency across 5 empirical dimensions:
1. Total Verified Labels
2. Class Balance (Normalized Entropy)
3. Facility Diversity
4. Regional Diversity
5. Reviewer Diversity

Outputs transparent, defensible readiness states: NOT_READY, LIMITED_TRAINING, PRODUCTION_READY
with actionable bottleneck gap analysis.
"""

import math
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from collections import defaultdict

from app.db.db_models import GroundTruthLabelModel


class TrainingReadinessEngine:
    """
    Evaluates whether the human-reviewed ground-truth dataset meets statistical,
    geographic, and annotator standards for supervised machine learning training.
    """

    ALLOWED_CLASSES = [
        "TRUE_FIRE",
        "FALSE_ALARM",
        "CONTROLLED_FLARING",
        "MAINTENANCE_ACTIVITY"
    ]

    @classmethod
    def evaluate(cls, db: Session) -> Dict[str, Any]:
        """
        Computes 5-dimensional training readiness metrics from persisted ground-truth records.
        """
        labels = db.query(GroundTruthLabelModel).all()
        total_count = len(labels)

        if total_count == 0:
            return {
                "readiness_state": "NOT_READY",
                "readiness_score": 0.0,
                "is_trainable": False,
                "dimensions": {
                    "total_verified_score": 0.0,
                    "class_balance_score": 0.0,
                    "facility_diversity_score": 0.0,
                    "regional_diversity_score": 0.0,
                    "reviewer_diversity_score": 0.0
                },
                "dimension_telemetry": {
                    "verified_count": 0,
                    "classes_represented": 0,
                    "facility_count": 0,
                    "region_count": 0,
                    "reviewer_count": 0
                },
                "explanation": (
                    "The platform currently contains zero human-verified ground-truth annotations. "
                    "In adherence to scientific integrity, supervised training cannot be conducted without empirical training data."
                ),
                "bottlenecks": [
                    "Zero verified ground-truth labels available. At least 15 verified incidents required for initial experimental training.",
                    "No multi-class representation available.",
                    "Zero facilities or geographic corridors annotated."
                ],
                "recommendation": "Begin human-in-the-loop analyst reviews in the Ground Truth Review tab using the deterministic multi-signal baseline."
            }

        # 1. Total Verified Labels Dimension (Target: 15 for limited, 50 for production)
        # Scaled 0 to 100
        verified_score = min(100.0, round((total_count / 50.0) * 100.0, 1))

        # 2. Class Balance Dimension (Normalized Shannon Entropy across 4 classes)
        class_counts: Dict[str, int] = defaultdict(int)
        for lbl in labels:
            class_counts[lbl.assigned_label] += 1
        
        classes_represented = len(class_counts)
        num_classes = len(cls.ALLOWED_CLASSES)  # 4
        max_entropy = math.log(num_classes)  # log(4) ≈ 1.386

        entropy = 0.0
        for c in cls.ALLOWED_CLASSES:
            cnt = class_counts.get(c, 0)
            if cnt > 0:
                p = cnt / total_count
                entropy -= p * math.log(p)

        class_balance_score = round(min(100.0, (entropy / max_entropy) * 100.0), 1) if max_entropy > 0 else 0.0

        # 3. Facility Diversity Dimension (Target: 2 for limited, 5 for production)
        facilities = {lbl.facility_name for lbl in labels if lbl.facility_name}
        facility_count = len(facilities)
        facility_score = min(100.0, round((facility_count / 5.0) * 100.0, 1))

        # 4. Regional Diversity Dimension (Target: 1 for limited, 2 for production)
        regions = {lbl.region_code or "WEST_GUJARAT" for lbl in labels}
        region_count = len(regions)
        region_score = min(100.0, round((region_count / 2.0) * 100.0, 1))

        # 5. Reviewer Diversity Dimension (Target: 2 for limited, 3 for production)
        reviewers = {lbl.reviewer_name for lbl in labels if lbl.reviewer_name}
        reviewer_count = len(reviewers)
        reviewer_score = min(100.0, round((reviewer_count / 3.0) * 100.0, 1))

        # Composite Multi-Factor Readiness Score (0 to 100)
        readiness_score = round(
            (verified_score * 0.30) +
            (class_balance_score * 0.25) +
            (facility_score * 0.20) +
            (region_score * 0.15) +
            (reviewer_score * 0.10),
            1
        )

        # Readiness State Determination
        bottlenecks: List[str] = []

        if total_count < 15:
            bottlenecks.append(f"Insufficient volume: {total_count}/15 minimum labels for limited training (50 needed for production).")
        if classes_represented < 2:
            bottlenecks.append(f"Critical class deficiency: Only {classes_represented} class represented. Supervised ML requires at least 2 distinct classes to learn decision boundaries.")
        elif classes_represented < 3:
            missing_classes = [c for c in cls.ALLOWED_CLASSES if class_counts.get(c, 0) == 0]
            bottlenecks.append(f"Moderate class gap: Missing representation for: {', '.join(missing_classes)}.")

        if facility_count < 2:
            bottlenecks.append("Single-facility risk: All labels are concentrated on a single industrial site, risking overfitting to local thermal characteristics.")
        elif facility_count < 5:
            bottlenecks.append(f"Facility spread: Labels span {facility_count} facilities (minimum 5 recommended for generalized industrial performance).")

        if region_count < 2:
            bottlenecks.append(f"Geographic concentration: Labels cover only {region_count} industrial region. Cross-corridor generalization requires multi-region coverage.")

        if reviewer_count < 2:
            bottlenecks.append("Annotator bias risk: All labels submitted by a single reviewer. At least 2 independent human analysts recommended to ensure inter-annotator reliability.")

        # Determine state
        if total_count >= 50 and classes_represented >= 3 and facility_count >= 5 and region_count >= 2 and reviewer_count >= 3 and readiness_score >= 75.0:
            readiness_state = "PRODUCTION_READY"
            is_trainable = True
            explanation = (
                f"The dataset is PRODUCTION_READY with {total_count} verified labels across {classes_represented} classes, "
                f"{facility_count} facilities, and {region_count} monitored regions by {reviewer_count} independent analysts. "
                "Statistically defensible for supervised model training and deployment."
            )
            recommendation = "Proceed with model retraining and spatial cross-validation. Supervised model meets production governance standards."
        elif total_count >= 15 and classes_represented >= 2 and facility_count >= 2 and readiness_score >= 40.0:
            readiness_state = "LIMITED_TRAINING"
            is_trainable = True
            explanation = (
                f"The dataset has achieved LIMITED_TRAINING readiness (Score: {readiness_score}/100) with {total_count} verified labels. "
                "Sufficient for experimental benchmark evaluation and spatial cross-validation, but insufficient for unsupervised operational deployment."
            )
            recommendation = "Execute experimental pilot training with spatial cross-validation. Continue human labeling to achieve production readiness."
        else:
            readiness_state = "NOT_READY"
            is_trainable = False
            explanation = (
                f"The dataset is currently NOT_READY for reliable supervised machine learning (Readiness Score: {readiness_score}/100). "
                f"With {total_count} verified labels across {classes_represented} class(es), training would lead to statistical instability and spatial memorization."
            )
            recommendation = "Rely on the Phase 4 deterministic multi-signal rule engine for operational triage while accumulating diverse human reviews."

        return {
            "readiness_state": readiness_state,
            "readiness_score": readiness_score,
            "is_trainable": is_trainable,
            "dimensions": {
                "total_verified_score": verified_score,
                "class_balance_score": class_balance_score,
                "facility_diversity_score": facility_score,
                "regional_diversity_score": region_score,
                "reviewer_diversity_score": reviewer_score
            },
            "dimension_telemetry": {
                "verified_count": total_count,
                "classes_represented": classes_represented,
                "facility_count": facility_count,
                "region_count": region_count,
                "reviewer_count": reviewer_count
            },
            "explanation": explanation,
            "bottlenecks": bottlenecks,
            "recommendation": recommendation
        }
