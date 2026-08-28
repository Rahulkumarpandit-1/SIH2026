import os
from typing import Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes_dashboard import router as dashboard_router
from app.core.config import settings
from app.core.logging import logger
from app.scheduler.scheduler import scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to start and stop background workers cleanly."""
    logger.info("Initializing SIH26162 Near-Real-Time Thermal Intelligence Platform...")
    # Start background scheduler if enabled
    if settings.ENABLE_BACKGROUND_SCHEDULER:
        try:
            await scheduler.start()
        except Exception as e:
            logger.error(f"Failed to start background scheduler: {e}")

    yield

    logger.info("Shutting down SIH26162 background tasks...")
    if settings.ENABLE_BACKGROUND_SCHEDULER:
        try:
            await scheduler.stop()
        except Exception as e:
            logger.error(f"Error stopping background scheduler: {e}")


app = FastAPI(
    title="SIH26162 — Thermal Industrial Fire Intelligence API",
    description=(
        "Production API exposing near-real-time satellite thermal hotspot ingestion (NASA FIRMS), "
        "spatial context enrichment (OpenStreetMap Overpass), spatio-temporal persistence (DBSCAN), "
        "and explainable multi-signal risk prioritization for industrial fire monitoring."
    ),
    version="1.0.0",
    lifespan=lifespan
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
        "monitoring_mode": "NEAR_REAL_TIME",
        "api_docs": "/docs",
        "health_check": "/api/health",
        "dashboard_summary": "/api/summary",
        "risk_prioritization": "/api/risk",
        "refresh_status": "/api/data/refresh/status",
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
        "version": "1.0.0",
        "monitoring_mode": "NEAR_REAL_TIME"
    }
