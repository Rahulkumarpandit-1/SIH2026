import json
from pathlib import Path
from enum import IntEnum
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field


class TargetClass(IntEnum):
    """
    Standardized multi-class ground-truth taxonomy for thermal anomaly classification.
    """
    PERSISTENT_INDUSTRIAL_SOURCE = 0
    INDUSTRIAL_FIRE_OUTBREAK = 1
    AGRICULTURAL_WILDFIRE = 2
    FALSE_DETECTION = 3


CLASS_NAME_MAP = {
    TargetClass.PERSISTENT_INDUSTRIAL_SOURCE: "PERSISTENT_INDUSTRIAL_SOURCE",
    TargetClass.INDUSTRIAL_FIRE_OUTBREAK: "INDUSTRIAL_FIRE_OUTBREAK",
    TargetClass.AGRICULTURAL_WILDFIRE: "AGRICULTURAL_WILDFIRE",
    TargetClass.FALSE_DETECTION: "FALSE_DETECTION"
}

STR_TO_TARGET_CLASS = {
    "PERSISTENT_INDUSTRIAL_SOURCE": TargetClass.PERSISTENT_INDUSTRIAL_SOURCE,
    "INDUSTRIAL_FIRE_OUTBREAK": TargetClass.INDUSTRIAL_FIRE_OUTBREAK,
    "AGRICULTURAL_WILDFIRE": TargetClass.AGRICULTURAL_WILDFIRE,
    "FALSE_DETECTION": TargetClass.FALSE_DETECTION,
    "0": TargetClass.PERSISTENT_INDUSTRIAL_SOURCE,
    "1": TargetClass.INDUSTRIAL_FIRE_OUTBREAK,
    "2": TargetClass.AGRICULTURAL_WILDFIRE,
    "3": TargetClass.FALSE_DETECTION
}


class LabelProvenance(BaseModel):
    """
    Audit trail ensuring that every machine learning ground-truth label has
    rigorous scientific provenance rather than heuristic assumption.
    """
    label: Optional[int] = Field(default=None, description="0=PERSISTENT, 1=OUTBREAK, 2=AGRICULTURAL, 3=FALSE_DETECTION, None=UNLABELED")
    label_name: str = Field(default="UNLABELED", description="Readable class name or UNLABELED")
    label_source: str = Field(
        default="UNVERIFIED",
        description="Source category: OFFICIAL_DISASTER_REGISTRY, INDUSTRY_SELF_REPORT, VALIDATED_SATELLITE_CATALOG, EXPERT_HUMAN_REVIEW, INDEPENDENT_RESEARCH, UNVERIFIED"
    )
    label_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Verification confidence from 0.0 to 1.0")
    label_date: Optional[str] = Field(default=None, description="Date of ground-truth record (YYYY-MM-DD)")
    source_reference: Optional[str] = Field(default=None, description="Document ID, incident report citation, or registry URL")
    reviewer: Optional[str] = Field(default=None, description="Name or authority of reviewer")
    review_notes: Optional[str] = Field(default=None, description="Notes documenting verification evidence")
    timestamp_utc: Optional[str] = Field(default=None, description="ISO UTC timestamp of review")

    @classmethod
    def create_unlabeled(cls) -> "LabelProvenance":
        """Creates a standardized UNLABELED provenance record."""
        return cls(
            label=None,
            label_name="UNLABELED",
            label_source="UNVERIFIED",
            label_confidence=None,
            label_date=None,
            source_reference=None,
            reviewer=None,
            review_notes=None,
            timestamp_utc=None
        )

    @classmethod
    def create_verified(
        cls,
        target_class: Union[TargetClass, int],
        source: str,
        confidence: float,
        date_str: str,
        reference: str,
        reviewer: Optional[str] = None,
        notes: Optional[str] = None
    ) -> "LabelProvenance":
        """Creates a verified ground-truth record with mandatory provenance."""
        t_class = TargetClass(target_class) if isinstance(target_class, int) else target_class
        return cls(
            label=int(t_class),
            label_name=CLASS_NAME_MAP[t_class],
            label_source=source,
            label_confidence=round(confidence, 4),
            label_date=date_str,
            source_reference=reference,
            reviewer=reviewer or "Authoritative Registry",
            review_notes=notes or "Verified against documented external evidence",
            timestamp_utc=datetime.now(timezone.utc).isoformat()
        )


class GroundTruthReviewRequest(BaseModel):
    """Schema for human-in-the-loop ground-truth review submissions."""
    observation_id: Optional[int] = None
    latitude: float
    longitude: float
    acq_date: str
    target_class: str = Field(..., description="PERSISTENT_INDUSTRIAL_SOURCE, INDUSTRIAL_FIRE_OUTBREAK, AGRICULTURAL_WILDFIRE, FALSE_DETECTION, or UNLABELED")
    reviewer: str = Field(..., min_length=2, description="Reviewer name / analyst ID")
    source_citation: str = Field(..., min_length=3, description="Citation / reference documentation")
    provenance_type: str = Field(default="EXPERT_HUMAN_REVIEW", description="Source category")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Confidence in assigned label")
    review_notes: Optional[str] = Field(default="", description="Detailed commentary or justification")


class GroundTruthRegistry:
    """
    Catalog of independently verified ground-truth industrial and agricultural fire incidents.
    Labels are matched ONLY on verified temporal and physical coordinates.
    Persists human review annotations to disk.
    """

    def __init__(self, storage_path: Optional[str] = None):
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            p1 = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "ground_truth_reviews.json"
            p2 = Path(__file__).resolve().parent.parent.parent.parent / "data" / "processed" / "ground_truth_reviews.json"
            self.storage_path = p1 if p1.parent.exists() else p2
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        self._registry: List[Dict[str, Any]] = []
        self._reviews: Dict[str, Dict[str, Any]] = {}
        self.load_persisted_reviews()

    def register_verified_incident(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float,
        date_str: str,
        target_class: TargetClass,
        source: str,
        confidence: float,
        reference: str,
        reviewer: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """Registers an independently documented ground-truth incident."""
        self._registry.append({
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "radius_meters": radius_meters,
            "date": date_str,
            "provenance": LabelProvenance.create_verified(
                target_class=target_class,
                source=source,
                confidence=confidence,
                date_str=date_str,
                reference=reference,
                reviewer=reviewer,
                notes=notes
            )
        })

    def _make_key(self, lat: float, lon: float, date_str: str) -> str:
        return f"{round(lat, 4)}_{round(lon, 4)}_{date_str}"

    def load_persisted_reviews(self):
        """Loads saved reviewer annotations from JSON file."""
        if self.storage_path.exists():
            try:
                data = json.loads(self.storage_path.read_text(encoding="utf-8"))
                self._reviews = data
            except Exception:
                self._reviews = {}

    def save_persisted_reviews(self):
        """Saves reviewer annotations to JSON file."""
        try:
            self.storage_path.write_text(json.dumps(self._reviews, indent=2), encoding="utf-8")
        except Exception:
            pass

    def add_human_review(self, review: GroundTruthReviewRequest) -> LabelProvenance:
        """
        Adds a human verified label review with strict audit provenance.
        """
        key = self._make_key(review.latitude, review.longitude, review.acq_date)
        
        target_class_str = review.target_class.upper().strip()
        if target_class_str == "UNLABELED":
            prov = LabelProvenance.create_unlabeled()
            if key in self._reviews:
                del self._reviews[key]
                self.save_persisted_reviews()
            return prov

        if target_class_str not in STR_TO_TARGET_CLASS:
            raise ValueError(f"Unknown target class: {review.target_class}. Must be one of {list(STR_TO_TARGET_CLASS.keys())} or UNLABELED")

        t_class = STR_TO_TARGET_CLASS[target_class_str]
        prov = LabelProvenance.create_verified(
            target_class=t_class,
            source=review.provenance_type,
            confidence=review.confidence,
            date_str=review.acq_date,
            reference=review.source_citation,
            reviewer=review.reviewer,
            notes=review.review_notes
        )

        self._reviews[key] = {
            "latitude": round(review.latitude, 4),
            "longitude": round(review.longitude, 4),
            "acq_date": review.acq_date,
            "observation_id": review.observation_id,
            "provenance": prov.model_dump()
        }
        self.save_persisted_reviews()
        return prov

    def match_observation(
        self,
        latitude: float,
        longitude: float,
        acq_date_str: str
    ) -> LabelProvenance:
        """
        Matches an observation against reviewer annotations or documented incidents within physical tolerance.
        Returns UNLABELED if no authoritative match exists.
        """
        lat_r = round(latitude, 4)
        lon_r = round(longitude, 4)
        key = self._make_key(lat_r, lon_r, acq_date_str)

        # 1. Exact match in saved human reviews
        if key in self._reviews:
            return LabelProvenance(**self._reviews[key]["provenance"])

        # 2. Check catalog registry
        for item in self._registry:
            if item["date"] == acq_date_str:
                d_lat = abs(item["latitude"] - lat_r)
                d_lon = abs(item["longitude"] - lon_r)
                if d_lat <= 0.015 and d_lon <= 0.015:
                    return item["provenance"]

        return LabelProvenance.create_unlabeled()

    def get_ground_truth_quality(self) -> Dict[str, Any]:
        """
        Calculates ground-truth quality statistics: class distribution, review count, sources.
        """
        catalog_count = len(self._registry)
        reviews_count = len(self._reviews)

        class_counts = {name: 0 for name in CLASS_NAME_MAP.values()}
        source_counts: Dict[str, int] = {}

        for item in self._registry:
            prov = item["provenance"]
            if prov.label_name in class_counts:
                class_counts[prov.label_name] += 1
            src = prov.label_source
            source_counts[src] = source_counts.get(src, 0) + 1

        for r_key, r_item in self._reviews.items():
            prov_dict = r_item.get("provenance", {})
            name = prov_dict.get("label_name")
            if name in class_counts:
                class_counts[name] += 1
            src = prov_dict.get("label_source", "EXPERT_HUMAN_REVIEW")
            source_counts[src] = source_counts.get(src, 0) + 1

        total_verified = sum(class_counts.values())

        return {
            "total_verified_labels": total_verified,
            "catalog_incidents_count": catalog_count,
            "human_reviews_count": reviews_count,
            "class_distribution": class_counts,
            "source_distribution": source_counts,
            "classes_represented": len([k for k, v in class_counts.items() if v > 0]),
            "timestamp_utc": datetime.now(timezone.utc).isoformat()
        }
