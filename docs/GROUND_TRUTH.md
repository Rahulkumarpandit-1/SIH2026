# Ground-Truth System & Human Review Workflow

## 1. Classification Taxonomy
The ground-truth framework standardizes thermal anomaly categorizations into 4 mutually exclusive classes plus unlabeled state:

- **CLASS 0: `PERSISTENT_INDUSTRIAL_SOURCE`**  
  Continuous, controlled operational thermal emissions (refinery flare stacks, chemical boilers, thermal power plant exhausts). Verified via continuous satellite flare registries or plant operational permits.
- **CLASS 1: `INDUSTRIAL_FIRE_OUTBREAK`**  
  Acute, uncontained emergency fires or chemical tank explosions within an industrial facility boundary requiring municipal dispatch. Verified via official emergency dispatch logs and disaster audit reports.
- **CLASS 2: `AGRICULTURAL_WILDFIRE`**  
  Open-field crop residue (stubble) burning, agricultural biomass clearing, or brush fires located in rural/agrarian zones. Verified via ground surveys and land-cover maps.
- **CLASS 3: `FALSE_DETECTION`**  
  Non-combustion thermal reflections (solar glint off metal roofs, cloud-edge refraction, high-albedo soil artifacts). Verified via optical high-resolution imagery.
- **`UNLABELED`**  
  Default state for all satellite detections lacking external documentary verification. Proximity to industry or high FRP does **NOT** automatically assign a fire label.

---

## 2. Mandatory Label Provenance
Every verified label record contains complete audit provenance:
- `label`: Integer class index (0–3)
- `label_name`: Standard class string
- `label_source`: Authority category (`OFFICIAL_DISASTER_REGISTRY`, `INDUSTRY_SELF_REPORT`, `VALIDATED_SATELLITE_CATALOG`, `EXPERT_HUMAN_REVIEW`, `INDEPENDENT_RESEARCH`)
- `label_confidence`: Real verification confidence (0.0–1.0)
- `label_date`: Event occurrence date (YYYY-MM-DD)
- `source_reference`: Document ID, dispatch number, citation, or registry URL
- `reviewer`: Name or credential of reviewing analyst
- `review_notes`: Detailed verification commentary
- `timestamp_utc`: Audit timestamp

---

## 3. Human Review Workflow APIs
- `GET /api/ground-truth`: Returns satellite observations with spatial context and current verification status for inspection.
- `POST /api/ground-truth/review`: Submits human review annotations, persisting updates to disk and invalidating in-memory caches.
- `GET /api/ground-truth/quality`: Returns class distributions, review counts, and verification source statistics.
