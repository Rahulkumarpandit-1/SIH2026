# Machine Learning Pipeline & Spatial Cross-Validation

## 1. 9-Dimensional Feature Vector Design
The supervised feature matrix $X \in \mathbb{R}^{N \times 9}$ strictly uses physical, sensor, and spatial context features without geographic coordinates:

| Feature Name | Symbol | Unit | Physical Description |
| :--- | :--- | :--- | :--- |
| `frp` | $FRP$ | MW | Fire Radiative Power (radiant thermal heat output) |
| `brightness` | $T_4$ | K | 4µm middle-infrared brightness temperature |
| `bright_t31` | $T_{31}$ | K | 11µm longwave thermal infrared background temperature |
| `thermal_contrast` | $\Delta T$ | K | Sub-pixel thermal anomaly contrast ($T_4 - T_{31}$) |
| `distance_to_industry_meters` | $d_{\text{ind}}$ | m | Geodesic distance to nearest OSM industrial polygon |
| `persistence_ratio` | $P_{\text{ratio}}$ | 0.0–1.0 | Fraction of days with active thermal detections |
| `active_days_count` | $N_{\text{days}}$ | Days | Number of distinct detection days |
| `is_anomaly_spike` | $S_{\text{spike}}$ | 0 or 1 | Flag indicating current FRP $\ge 3.0 \times$ historical median |
| `confidence_normalized` | $C_{\text{norm}}$ | 0.0–1.0 | Normalized satellite instrument confidence index |

---

## 2. Strict Spatial & Target Leakage Prevention
To ensure valid generalization across new unseen industrial corridors:
1. **Latitude and Longitude are strictly barred from $X$**: Tree models trained on raw coordinates memorize geographic factory locations rather than learning thermal physics.
2. **Rule-Engine Outputs Excluded**: `risk_score`, `risk_level`, `action_code`, and `incident_classification` are barred from $X$ to prevent target leakage.
3. **Automated Verification**: `DatasetBuilder.validate_feature_matrix_integrity()` asserts that no forbidden column exists prior to training or export.

---

## 3. Spatial Group K-Fold Cross-Validation
- **Grouping Variable**: Physical DBSCAN `cluster_id`.
- **Guarantee**: Observations belonging to the same physical cluster never appear in both training and test/validation splits simultaneously.
- **Outcome**: 0% geographic contamination, providing an honest assessment of spatial generalization.

---

## 4. Empirical ML Readiness Evaluation
Before attempting model training, `MLReadinessEvaluator` evaluates statistical sufficiency:
- **`NOT_READY`**: $< 15$ verified labels or $< 2$ distinct classes. Training is skipped gracefully, and the system relies on the Phase 4 Rule Engine.
- **`LIMITED_EXPERIMENTAL`**: $15 \le N < 50$ samples across $\ge 2$ classes. Permitted for research benchmarks with explicit disclosures.
- **`READY_FOR_TRAINING`**: $\ge 50$ samples across $\ge 3$ classes in $\ge 5$ spatial clusters. Supervised production training enabled.
