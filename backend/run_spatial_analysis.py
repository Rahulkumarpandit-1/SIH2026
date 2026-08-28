import os
import pandas as pd
from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.db_models import RawObservationModel
from app.ingestion.osm_client import OSMClient
from app.spatial.proximity import SpatialProximityEngine


def main():
    print("=" * 85)
    print("SIH26162 — PHASE 2: GIS & OPENSTREETMAP (OSM) CONTEXT ENRICHMENT RUNNER")
    print("=" * 85)

    # 1. Fetch observations from SQLite database
    db = SessionLocal()
    try:
        observations = db.query(RawObservationModel).all()
        if not observations:
            print("No observations found in database. Run 'py backend/run_ingestion.py' first!")
            return
        
        # Convert SQLAlchemy models to Pandas DataFrame
        data = []
        for obs in observations:
            data.append({
                "id": obs.id,
                "latitude": obs.latitude,
                "longitude": obs.longitude,
                "brightness": obs.brightness,
                "acq_date": str(obs.acq_date),
                "acq_time": obs.acq_time,
                "frp": obs.frp,
                "confidence": obs.confidence,
                "daynight": obs.daynight
            })
        df = pd.DataFrame(data)
        logger.info(f"Loaded {len(df)} observations from SQLite database for spatial enrichment.")
    finally:
        db.close()

    # 2. Fetch or load cached OSM industrial features
    osm_client = OSMClient()
    industrial_gdf = osm_client.fetch_industrial_features(bbox=settings.default_bbox)
    logger.info(f"Loaded {len(industrial_gdf)} industrial boundaries from OSM layer.")

    # 3. Perform Spatial Join & Geodesic Proximity Analysis
    engine = SpatialProximityEngine(industrial_gdf)
    enriched_df = engine.enrich_observations_dataframe(df)

    # 4. Print Enriched Geospatial Results Table
    print("\n" + "=" * 85)
    print("ENRICHED HOTSPOT OBSERVATIONS WITH OSM INDUSTRIAL CONTEXT")
    print("=" * 85)
    print(f"{'ID':<3} | {'Lat, Lon':<18} | {'Date':<10} | {'FRP(MW)':<7} | {'Dist(m)':<8} | {'Spatial Context':<24} | {'Nearest Industrial Facility'}")
    print("-" * 115)

    for _, row in enriched_df.iterrows():
        lat_lon = f"{row['latitude']:.4f}, {row['longitude']:.4f}"
        dist_str = f"{row['distance_to_industry_meters']:.0f}m" if row['distance_to_industry_meters'] < 100000 else ">100km"
        facility = f"{row['nearest_facility_name']} ({row['nearest_facility_type']})"
        print(f"{row['id']:<3} | {lat_lon:<18} | {row['acq_date']:<10} | {row['frp']:<7.1f} | {dist_str:<8} | {row['spatial_context']:<24} | {facility[:35]}")
    
    print("=" * 115)

    # 5. Summarize context distribution
    context_counts = enriched_df["spatial_context"].value_counts().to_dict()
    print("\nSPATIAL CONTEXT DISTRIBUTION:")
    for ctx, count in context_counts.items():
        print(f"  * {ctx:<26}: {count} observations")
    print("=" * 85)


if __name__ == "__main__":
    main()
