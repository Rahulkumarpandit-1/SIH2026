# SIH26162 — Production Deployment & Operations Guide
## AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources

This guide provides step-by-step instructions for deploying the **FastAPI backend** and **React + Vite frontend** to public cloud providers (Render, Railway, Vercel, Netlify, Docker, or Linux VMs).

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  NASA FIRMS Telemetry Stream (VIIRS 375m & MODIS 1km)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenStreetMap Overpass Geofence Layer (3,970 Polygons)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Port 8000)                                │
│  - Phase 1: Pydantic Validation & Ingestion                 │
│  - Phase 2: OSM Spatial Proximity Enrichment                │
│  - Phase 3: 750m DBSCAN Clustering & Persistence Engine     │
│  - Phase 4: Multi-Signal Risk Scoring (Operational MVP)     │
│  - Phase 5: Spatial Group K-Fold ML Benchmark               │
│  - SQLite / PostgreSQL Database                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / GeoJSON API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  React + Vite + Leaflet Frontend (Port 5173 / Static CDN)   │
│  - Overview Dashboard & Critical Incident Spotlight         │
│  - Prioritized Incident Triage Table                        │
│  - Dedicated Structured Incident Intelligence Report        │
│  - Full-Screen GIS Explorer with CartoDB Voyager Map        │
│  - Regional Analytics & Random Forest Feature Importance    │
│  - 5-Day Chronological Detection Timeline & 10-Step Trace   │
│  - Scientific Methodology & Defensive Disclaimers           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Deployment Guide

### A. Environment Configuration
Create a `.env` file inside `backend/` or set the following environment variables in your cloud provider:

```bash
# NASA FIRMS API MAPKEY (Get free key at https://firms.modaps.eosdis.nasa.gov/api/map_key)
FIRMS_MAP_KEY=51ca9bc710f3add041124d86ddbb631d

# Database URL
# Default SQLite: sqlite:///./data/app.db
# PostgreSQL: postgresql://user:password@hostname:5432/sih_db
DATABASE_URL=sqlite:///./data/app.db

# Allowed CORS Origins (Comma-separated list of production frontend URLs, or * for all)
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173,*

# Monitored Regional Bounding Box [min_lon, min_lat, max_lon, max_lat]
DEFAULT_BBOX_MIN_LON=69.0
DEFAULT_BBOX_MIN_LAT=20.0
DEFAULT_BBOX_MAX_LON=74.0
DEFAULT_BBOX_MAX_LAT=24.5
```

### B. Python Environment & Installation
```bash
# 1. Clone repository and navigate to backend directory
cd SIH2026/backend

# 2. Create and activate virtual environment
python -m venv venv
# On Linux/macOS:
source venv/bin/activate
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1

# 3. Install production dependencies
pip install -r requirements.txt
```

### C. Database Initialization (If starting from scratch)
```bash
# Populates verified satellite observations into the database
python run_ingestion.py
```

### D. Startup Commands

**Local / Development Mode:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Production Mode (Single Uvicorn Worker):**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log
```

**Production Mode (Multi-Worker with Gunicorn for Linux/Docker/Cloud):**
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
```

---

## 3. Frontend Deployment Guide

### A. Environment Configuration
Create a `.env` file in `frontend/` (or configure in Vercel / Netlify / Cloudflare Pages dashboard):

```bash
# URL of the deployed FastAPI backend (with no trailing slash)
# Example for hosted API:
VITE_API_BASE_URL=https://sih2026-api.onrender.com

# For local development:
# VITE_API_BASE_URL=http://127.0.0.1:8000
```

### B. Build Commands
```bash
# 1. Navigate to frontend directory
cd SIH2026/frontend

# 2. Install dependencies
npm install

# 3. Build optimized static production bundle
npm run build

# Output will be generated in frontend/dist/
```

### C. Deploying to Vercel / Netlify
1. Connect your GitHub repository to Vercel or Netlify.
2. Set **Root Directory**: `frontend`
3. Set **Build Command**: `npm run build`
4. Set **Output Directory**: `dist`
5. Set Environment Variable: `VITE_API_BASE_URL = https://your-backend-url`
6. Deploy!

---

## 4. Docker Deployment Option (Unified Container)

### Backend `Dockerfile` (`backend/Dockerfile`):
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for spatial libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. Public API Verification Checklist

Once the backend is live, verify the core endpoints using `curl` or browser:

| Endpoint | Method | Expected Output | Status |
|---|---|---|---|
| `/api/health` | GET | `{"status": "healthy"}` | Verified |
| `/api/summary` | GET | `{"total_observations": 15, "total_clusters": 6, "critical_count": 1, ...}` | Verified |
| `/api/observations` | GET | Array of 15 satellite records with FRP, brightness, and context | Verified |
| `/api/clusters` | GET | Array of 6 DBSCAN clusters with persistence ratios | Verified |
| `/api/risk` | GET | Ranked queue with `CLUSTER_003` at #1 (Risk ~92.42, EMERGENCY_DISPATCH) | Verified |
| `/api/geojson` | GET | Valid GeoJSON FeatureCollection of points | Verified |
| `/api/osm-industrial` | GET | Valid GeoJSON FeatureCollection of 3,970 industrial polygons | Verified |
| `/api/ml-evaluation` | GET | Random Forest feature importances & Spatial Group K-Fold metrics | Verified |

---

## 6. Scientific & Pedagogical Integrity Guidelines

1. **Deterministic Phase 4 Rule Engine is the Primary Operational MVP:**
   The risk scoring formulation is 100% deterministic, physically explainable, and derived from peer-reviewed thermal remote sensing principles ($35\% \text{Thermal} + 30\% \text{Proximity} + 25\% \text{Persistence} + 10\% \text{Confidence}$).
2. **Phase 5 Machine Learning is an Empirical Framework:**
   Phase 5 uses Random Forest and Spatial Group K-Fold cross-validation. We **do not claim** fabricated 99% accuracy because verified industrial ground-truth legal accident logs are restricted in India.
3. **Decision-Support Prioritization:**
   A satellite pixel spans $375\text{m} \times 375\text{m}$. The risk score is an operational prioritization tool to deploy drones, CCTV, and ground verification—not autonomous legal proof of a disaster.
