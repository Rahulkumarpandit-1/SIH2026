# NASA FIRMS Ingestion & Data Pipeline Architecture

## 1. Data Sources & Provenance
The thermal fire intelligence platform ingests satellite radiance from NASA EOSDIS MODAPS (FIRMS):
- **Sensors Supported**:
  - `VIIRS_SNPP_NRT` (375m spatial resolution, Suomi-NPP)
  - `VIIRS_NOAA20_NRT` (375m spatial resolution, NOAA-20)
  - `VIIRS_NOAA21_NRT` (375m spatial resolution, NOAA-21)
  - `MODIS_NRT` (1km spatial resolution, Terra & Aqua)
- **Monitored Study Region**: Gujarat Industrial Corridor `[69.0°E, 20.0°N to 74.0°E, 24.5°N]`, encompassing Jamnagar, Dahej, Hazira/Surat, Vadodara, and Vapi.

---

## 2. Chunked Historical Ingestion & Raw Archiving
NASA FIRMS area API restricts historical queries with dates to 5-day windows (`/api/area/csv/[KEY]/[SENSOR]/[BBOX]/[DAYS]/[DATE]`).
The ingestion engine (`HistoricalFIRMSIngester`) automatically slices arbitrary `--start-date` and `--end-date` ranges into contiguous 5-day query windows.

### Raw Data Immutability
All downloaded raw responses are immutably archived under:
```
data/raw/firms/YYYY/MM/
    sensor_bbox_date_timestamp.csv
    sensor_bbox_date_timestamp.meta.json
```
The JSON metadata sidecar contains:
- `source` and `source_url`
- `sensor`
- `bbox` and `day_range`
- `download_timestamp_utc`
- `raw_record_count`
- `sha256_checksum` (SHA-256 integrity hash of raw response)
- `retrieval_status`

---

## 3. Normalization & Natural Key Deduplication
Observations are normalized across sensor differences (`bright_ti4` $\to$ `brightness`, `bright_ti5` $\to$ `bright_t31`, confidence percentages $\to$ normalized 0.0–1.0 float).

### Composite Deduplication Key
Deduplication is executed on the 5-tuple natural identity:
$$\text{Natural Key} = \big(\text{round}(\text{lat}, 4), \text{round}(\text{lon}, 4), \text{acq\_date}, \text{acq\_time}, \text{satellite}\big)$$
- Prevents duplicate inserts on repeated queries.
- Preserves distinct satellite passes (e.g. SNPP vs NOAA-20) even if geographically proximate.

---

## 4. Spatial Enrichment & Clustering
1. **OSM Industrial Geofencing**: Computes Haversine distance to 3,970 OpenStreetMap industrial facility boundaries.
2. **DBSCAN Spatio-Temporal Clustering**: Groups nearby hotspot pixels within a 750-meter radius into distinct physical clusters.
3. **Temporal Persistence Engine**: Evaluates active day ratios ($P_{\text{ratio}} = \text{days\_active} / \text{monitored\_window}$) and identifies acute 3.0× FRP anomaly surges.
4. **Leakage-Free Export**: Saves structured datasets under `data/processed/` and exports strict 9D predictive matrices under `data/ml/`.
