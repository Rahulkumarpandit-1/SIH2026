# Scientific Integrity & Disclosure Policy

## 1. Principles of Scientific Honesty
In operational remote sensing and industrial disaster response, scientific integrity is more critical than artificial performance numbers:

1. **Zero Synthetic Labels**: We never fabricate positive fire labels or synthetic observations. Every ground-truth label must correspond to an independently documented physical event.
2. **No Heuristic Label Assumption**: Proximity to a factory, high FRP, or rule-engine CRITICAL scores are model features, **never ground-truth labels**. Unverified detections remain strictly archived as `UNLABELED`.
3. **Zero Coordinate Memorization**: Raw latitude and longitude coordinates are strictly barred from machine-learning feature matrix $X$.
4. **Spatial Contamination Prevention**: Cross-validation is executed strictly via `GroupKFold` on physical DBSCAN cluster IDs, ensuring 0% cluster leakage between train and test splits.
5. **Honest ML Readiness Reporting**: If the dataset contains insufficient multi-class ground truth, the system returns `ML_STATUS = "NOT_READY_FOR_SUPERVISED_TRAINING"` rather than displaying fabricated 99% accuracy.

---

## 2. Operational Hierarchy: Rule Engine vs Machine Learning
- **Primary Operational Baseline**: The Phase 4 Multi-Signal Rule Engine is fully deterministic, zero-shot operational, and grounded in peer-reviewed remote sensing physics (combining thermal radiance, spatial proximity decays, temporal persistence ratios, and satellite confidence).
- **Secondary Research Benchmark**: Supervised Machine Learning provides feature importance rankings and benchmark classification once statistically sufficient verified ground-truth labels are acquired.

---

## 3. Disclosures & Disclaimers
- **Feature Importance**: Random Forest feature importances represent predictive contribution within the training dataset; they do not establish physical causality.
- **Data Ingestion Limitations**: NASA FIRMS NRT area queries are subject to satellite orbital overpasses (typically 2 day and 2 night passes every 24 hours per sensor). Cloud obscuration may temporarily mask low-intensity ground fires.
