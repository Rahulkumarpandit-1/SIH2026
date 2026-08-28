import os
from typing import Dict, Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes_dashboard import router as dashboard_router
from app.core.config import settings
from app.core.logging import logger

app = FastAPI(
    title="SIH26162 — Thermal Industrial Fire Intelligence API",
    description=(
        "Production API exposing satellite thermal hotspot ingestion (NASA FIRMS), "
        "spatial context enrichment (OpenStreetMap Overpass), spatio-temporal persistence (DBSCAN), "
        "and explainable multi-signal risk prioritization for industrial fire monitoring."
    ),
    version="1.0.0"
)

# Robust CORS Configuration: Allow all Vercel domains, localhost, and wildcard origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api
app.include_router(dashboard_router)


@app.get("/", tags=["System"])
def root() -> Dict[str, Any]:
    """Root landing endpoint with system status and documentation links."""
    return {
        "project": "SIH26162 — AI-Based Industrial Fire & Persistent Thermal Source Detection",
        "status": "operational",
        "api_docs": "/docs",
        "health_check": "/api/health",
        "dashboard_summary": "/api/summary",
        "risk_prioritization": "/api/risk",
        "geojson_layer": "/api/geojson",
        "osm_industrial_layer": "/api/osm-industrial",
        "ml_evaluation": "/api/ml-evaluation"
    }


@app.get("/health", tags=["System"], summary="Global Health Check")
def health() -> Dict[str, Any]:
    """Top-level health check endpoint for cloud load balancers and orchestrators."""
    return {
        "status": "healthy",
        "service": "SIH26162 Thermal Fire Intelligence API",
        "version": "1.0.0"
    }
