import os
import json
import joblib
from pathlib import Path
from enum import Enum
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support, accuracy_score, balanced_accuracy_score
from app.core.logging import logger


CLASS_LABELS = {
    0: "PERSISTENT_INDUSTRIAL_SOURCE",
    1: "INDUSTRIAL_FIRE_OUTBREAK",
    2: "AGRICULTURAL_WILDFIRE",
    3: "FALSE_DETECTION"
}

FEATURE_COLUMNS = [
    "frp",
    "brightness",
    "bright_t31",
    "thermal_contrast",
    "distance_to_industry_meters",
    "persistence_ratio",
    "active_days_count",
    "is_anomaly_spike",
    "confidence_normalized"
]


class MLReadinessStatus(str, Enum):
    NOT_READY = "NOT_READY"
    LIMITED_EXPERIMENTAL = "LIMITED_EXPERIMENTAL"
    READY_FOR_TRAINING = "READY_FOR_TRAINING"


class MLReadinessEvaluator:
    """
    Evaluates empirical dataset sufficiency and determines if supervised machine learning
    can be trained in a scientifically defensible manner.
    """

    @classmethod
    def evaluate(cls, df_labeled: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates readiness metrics on labeled subset of data.
        """
        if df_labeled.empty or "label" not in df_labeled.columns:
            return {
                "status": MLReadinessStatus.NOT_READY.value,
                "reason": "Zero verified ground-truth labels available.",
                "labeled_samples": 0,
                "classes_present": 0,
                "class_distribution": {},
                "spatial_groups_count": 0,
                "is_statistically_defensible": False,
                "recommendation": "Use Phase 4 Transparent Multi-Signal Rule Engine as primary operational MVP."
            }

        valid_labels = df_labeled[df_labeled["label"].notnull()]
        labeled_count = len(valid_labels)
        
        if labeled_count == 0:
            return {
                "status": MLReadinessStatus.NOT_READY.value,
                "reason": "Zero verified ground-truth labels available.",
                "labeled_samples": 0,
                "classes_present": 0,
                "class_distribution": {},
                "spatial_groups_count": 0,
                "is_statistically_defensible": False,
                "recommendation": "Use Phase 4 Transparent Multi-Signal Rule Engine as primary operational MVP."
            }

        class_counts = valid_labels["label"].value_counts().to_dict()
        class_dist = {CLASS_LABELS.get(int(k), str(k)): int(v) for k, v in class_counts.items()}
        classes_present = len(class_counts)

        groups = valid_labels["cluster_id"].nunique() if "cluster_id" in valid_labels.columns else 1
        min_class_samples = min(class_counts.values()) if class_counts else 0

        # Scientific sufficiency logic
        if labeled_count < 15 or classes_present < 2 or groups < 2:
            status = MLReadinessStatus.NOT_READY
            reason = (
                f"Only {labeled_count} verified labels across {classes_present} class(es) in {groups} spatial group(s). "
                "Supervised learning requires >= 2 distinct classes and multiple independent spatial clusters to prevent memorization."
            )
            is_defensible = False
        elif labeled_count < 50 or classes_present < 3:
            status = MLReadinessStatus.LIMITED_EXPERIMENTAL
            reason = (
                f"Dataset contains {labeled_count} verified labels across {classes_present} classes. "
                "Sufficient for experimental benchmark evaluation and spatial cross-validation, but insufficient for unsupervised operational deployment."
            )
            is_defensible = False
        else:
            status = MLReadinessStatus.READY_FOR_TRAINING
            reason = (
                f"Dataset contains {labeled_count} verified labels across {classes_present} classes in {groups} clusters. "
                "Statistically defensible for supervised production training."
            )
            is_defensible = True

        return {
            "status": status.value,
            "reason": reason,
            "labeled_samples": labeled_count,
            "classes_present": classes_present,
            "class_distribution": class_dist,
            "spatial_groups_count": groups,
            "min_samples_per_class": min_class_samples,
            "is_statistically_defensible": is_defensible,
            "recommendation": (
                "Supervised ML ready for training with Spatial Group K-Fold."
                if is_defensible
                else "Phase 4 Explainable Rule Engine remains the primary operational decision support system."
            )
        }


class ThermalFeatureExtractor:
    """
    Extracts numerical feature vectors from enriched satellite hotspot observations
    and persistence history for machine learning model training and inference.
    """

    @classmethod
    def extract_features_from_dataframe(cls, df: pd.DataFrame) -> Tuple[np.ndarray, List[str]]:
        """
        Extracts the 9-dimensional feature matrix X from an enriched observations DataFrame.
        """
        if df.empty:
            return np.empty((0, len(FEATURE_COLUMNS))), FEATURE_COLUMNS

        df_feat = df.copy()

        # 1. Fill missing background channel 5 / Band 31 if absent
        if "bright_t31" not in df_feat.columns or df_feat["bright_t31"].isnull().all():
            df_feat["bright_t31"] = df_feat["brightness"] - 30.0
        else:
            df_feat["bright_t31"] = df_feat["bright_t31"].fillna(df_feat["brightness"] - 30.0)

        # 2. Compute thermal contrast delta T = T4 - T31
        df_feat["thermal_contrast"] = df_feat["brightness"] - df_feat["bright_t31"]

        # 3. Ensure all expected feature columns exist with fallback defaults
        for col, default_val in [
            ("frp", 0.0),
            ("brightness", 330.0),
            ("distance_to_industry_meters", 50000.0),
            ("persistence_ratio", 0.2),
            ("active_days_count", 1),
            ("is_anomaly_spike", 0),
            ("confidence_normalized", 0.5)
        ]:
            if col not in df_feat.columns:
                df_feat[col] = default_val
            else:
                df_feat[col] = df_feat[col].fillna(default_val)

        # Convert boolean is_anomaly_spike to int
        df_feat["is_anomaly_spike"] = df_feat["is_anomaly_spike"].astype(int)

        X = df_feat[FEATURE_COLUMNS].to_numpy(dtype=float)
        return X, FEATURE_COLUMNS


class ProductionMLTrainer:
    """
    Orchestrates leakage-free model training with Spatial Group K-Fold cross-validation,
    artifact versioning, and honest fallback when data is statistically insufficient.
    """

    def __init__(self, models_dir: Optional[str] = None, reports_dir: Optional[str] = None):
        if models_dir:
            self.models_dir = Path(models_dir)
        else:
            p1 = Path(__file__).resolve().parent.parent.parent / "models"
            p2 = Path(__file__).resolve().parent.parent.parent.parent / "models"
            self.models_dir = p1 if p1.exists() else p2
        self.models_dir.mkdir(parents=True, exist_ok=True)

        if reports_dir:
            self.reports_dir = Path(reports_dir)
        else:
            p_r1 = Path(__file__).resolve().parent.parent.parent / "training_reports"
            p_r2 = Path(__file__).resolve().parent.parent.parent.parent / "training_reports"
            self.reports_dir = p_r1 if p_r1.exists() else p_r2
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def train_and_persist(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        readiness: Dict[str, Any],
        model_type: str = "random_forest"
    ) -> Dict[str, Any]:
        """
        Trains model if ML status != NOT_READY, saves artifacts to models/ and training_reports/.
        If status == NOT_READY, records honest skipped report without training.
        """
        now_str = datetime.now(timezone.utc).isoformat()

        if readiness.get("status") == MLReadinessStatus.NOT_READY.value or len(X) == 0 or len(np.unique(y)) < 2:
            report = {
                "training_status": "SKIPPED",
                "reason": "Training skipped due to insufficient scientifically valid labeled data.",
                "ml_readiness": readiness,
                "timestamp_utc": now_str,
                "samples_count": len(X)
            }
            # Save skip manifest
            (self.models_dir / "training_manifest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
            (self.reports_dir / "latest_training_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
            logger.info("ML training skipped: insufficient verified multi-class labels.")
            return report

        # Select model
        if model_type == "logistic_regression":
            model = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
        elif model_type == "gradient_boosting":
            model = HistGradientBoostingClassifier(random_state=42)
        else:
            model = RandomForestClassifier(n_estimators=100, max_depth=6, class_weight="balanced", random_state=42)

        # Spatial Group K-Fold
        unique_groups = len(np.unique(groups))
        n_splits = max(2, min(3, unique_groups))
        
        cv_metrics = {}
        if unique_groups >= 2:
            gkf = GroupKFold(n_splits=n_splits)
            
            # Explicitly verify cluster isolation in each fold
            fold_details = []
            for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
                train_clusters = set(groups[train_idx])
                val_clusters = set(groups[val_idx])
                overlap = train_clusters.intersection(val_clusters)
                if len(overlap) > 0:
                    raise ValueError(f"CRITICAL SPATIAL LEAKAGE: Cluster overlap detected in fold {fold_idx}: {overlap}")
                
                fold_details.append({
                    "fold": fold_idx + 1,
                    "train_samples": len(train_idx),
                    "val_samples": len(val_idx),
                    "train_clusters_count": len(train_clusters),
                    "val_clusters_count": len(val_clusters),
                    "cluster_overlap_count": 0
                })

            y_pred = cross_val_predict(model, X, y, groups=groups, cv=gkf)
            
            acc = accuracy_score(y, y_pred)
            b_acc = balanced_accuracy_score(y, y_pred)
            prec, rec, f1, _ = precision_recall_fscore_support(y, y_pred, average="weighted", zero_division=0)
            cm = confusion_matrix(y, y_pred).tolist()
            cls_report = classification_report(y, y_pred, output_dict=True, zero_division=0)

            cv_metrics = {
                "cross_validation_strategy": f"Spatial GroupKFold (n_splits={n_splits})",
                "cluster_overlap_verified": 0,
                "folds_evaluated": fold_details,
                "accuracy": round(float(acc), 4),
                "balanced_accuracy": round(float(b_acc), 4),
                "weighted_precision": round(float(prec), 4),
                "weighted_recall": round(float(rec), 4),
                "weighted_f1": round(float(f1), 4),
                "confusion_matrix": cm,
                "classification_report": cls_report
            }
        else:
            cv_metrics = {
                "warning": "INSUFFICIENT SPATIAL GROUPS FOR RELIABLE CROSS-VALIDATION",
                "spatial_groups": unique_groups
            }

        # Fit model on training data
        model.fit(X, y)

        # Feature importances if available
        feature_importances = {}
        if hasattr(model, "feature_importances_"):
            for feat, imp in sorted(zip(FEATURE_COLUMNS, model.feature_importances_), key=lambda x: x[1], reverse=True):
                feature_importances[feat] = round(float(imp), 4)

        # Persist model and artifacts
        model_path = self.models_dir / "model.joblib"
        joblib.dump(model, model_path)

        (self.models_dir / "feature_importance.json").write_text(json.dumps(feature_importances, indent=2), encoding="utf-8")
        (self.models_dir / "metrics.json").write_text(json.dumps(cv_metrics, indent=2), encoding="utf-8")

        manifest = {
            "training_status": "SUCCESS",
            "model_type": model_type,
            "model_artifact": model_path.name,
            "trained_samples_count": len(X),
            "spatial_groups_count": unique_groups,
            "classes_trained": [CLASS_LABELS.get(int(c), str(c)) for c in np.unique(y)],
            "features_used": FEATURE_COLUMNS,
            "feature_importances": feature_importances,
            "metrics": cv_metrics,
            "ml_readiness": readiness,
            "timestamp_utc": now_str
        }

        (self.models_dir / "training_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (self.reports_dir / "latest_training_report.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        logger.info(f"Production ML model persisted successfully to {model_path}")

        return manifest


class ThermalClassifier:
    """
    Supervised classifier wrapper for inferring thermal anomaly categories:
    - PERSISTENT_INDUSTRIAL_SOURCE (0)
    - INDUSTRIAL_FIRE_OUTBREAK (1)
    - AGRICULTURAL_WILDFIRE (2)
    - FALSE_DETECTION (3)
    """

    def __init__(self, n_estimators: int = 100, random_state: int = 42):
        self.model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=6,
            class_weight="balanced",
            random_state=random_state
        )
        self.is_trained = False
        self.feature_names = FEATURE_COLUMNS

    def fit(self, X: np.ndarray, y: np.ndarray) -> "ThermalClassifier":
        """Fits Random Forest model on feature matrix X and target labels y."""
        self.model.fit(X, y)
        self.is_trained = True
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            raise RuntimeError("Model has not been trained yet.")
        return self.model.predict(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            raise RuntimeError("Model has not been trained yet.")
        return self.model.predict_proba(X)

    def get_feature_importances(self) -> Dict[str, float]:
        if not self.is_trained:
            return {f: 1.0 / len(FEATURE_COLUMNS) for f in FEATURE_COLUMNS}
        importances = self.model.feature_importances_
        return {
            feat: round(float(imp), 4)
            for feat, imp in sorted(zip(self.feature_names, importances), key=lambda x: x[1], reverse=True)
        }

    def evaluate_spatial_cv(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        n_splits: int = 3
    ) -> Dict[str, Any]:
        """
        Executes Spatial Group K-Fold Cross Validation.
        """
        unique_groups = len(np.unique(groups))
        if unique_groups < 2:
            return {
                "warning": "INSUFFICIENT SPATIAL GROUPS FOR RELIABLE CROSS-VALIDATION",
                "spatial_groups": unique_groups
            }

        actual_splits = max(2, min(n_splits, unique_groups))
        gkf = GroupKFold(n_splits=actual_splits)
        
        # Verify zero spatial overlap in each fold
        for fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
            train_clusters = set(groups[train_idx])
            val_clusters = set(groups[val_idx])
            overlap = train_clusters.intersection(val_clusters)
            if len(overlap) > 0:
                raise ValueError(f"CRITICAL SPATIAL LEAKAGE: Cluster overlap in fold {fold_idx}: {overlap}")

        y_pred = cross_val_predict(self.model, X, y, groups=groups, cv=gkf)

        precision, recall, f1, _ = precision_recall_fscore_support(
            y, y_pred, average="weighted", zero_division=0
        )
        conf_matrix = confusion_matrix(y, y_pred)
        report = classification_report(y, y_pred, output_dict=True, zero_division=0)

        return {
            "n_splits": actual_splits,
            "cluster_overlap_verified": 0,
            "weighted_precision": round(float(precision), 4),
            "weighted_recall": round(float(recall), 4),
            "weighted_f1": round(float(f1), 4),
            "confusion_matrix": conf_matrix.tolist(),
            "classification_report": report
        }
