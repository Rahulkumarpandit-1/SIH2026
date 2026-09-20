"""
Script to seed realistic multi-sensor satellite observations across all Indian industrial corridors.
Ensures authentic multi-temporal observations in Gujarat, Maharashtra, NCR, Eastern Steel Belt, and Southern Corridor.
"""

import os
import sys
from datetime import date
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal
from app.db.db_models import RawObservationModel
from app.core.regions import tag_coordinates
from app.core.logging import logger

NATIONAL_OBSERVATIONS = [
    # =========================================================================
    # WEST_MAHARASHTRA: Maharashtra Industrial Belt
    # =========================================================================
    # 1. BPCL / HPCL Mumbai Refinery (Mahul) - Continuous Flare Baseline
    {"lat": 19.0112, "lon": 72.8920, "bright": 348.2, "t31": 298.0, "frp": 24.5, "date": "2026-08-20", "time": "0830", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 19.0115, "lon": 72.8922, "bright": 351.0, "t31": 299.1, "frp": 27.2, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 19.0110, "lon": 72.8918, "bright": 353.4, "t31": 300.5, "frp": 31.0, "date": "2026-08-22", "time": "0800", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 19.0114, "lon": 72.8921, "bright": 356.1, "t31": 301.8, "frp": 33.8, "date": "2026-08-23", "time": "0845", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 19.0113, "lon": 72.8919, "bright": 358.5, "t31": 302.2, "frp": 36.5, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},
    
    # 2. Taloja MIDC Chemical Park - Acute High-Power Chemical Fire Outbreak
    {"lat": 19.0734, "lon": 73.1182, "bright": 382.4, "t31": 312.0, "frp": 74.2, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.95, "dn": "D", "stream": "near_real_time"},
    {"lat": 19.0738, "lon": 73.1186, "bright": 394.0, "t31": 322.5, "frp": 98.6, "date": "2026-08-24", "time": "2045", "conf": "high", "c_norm": 0.95, "dn": "N", "stream": "near_real_time"},

    # 3. Tarapur MIDC Chemical Complex
    {"lat": 19.8210, "lon": 72.6950, "bright": 344.0, "t31": 296.8, "frp": 18.2, "date": "2026-08-22", "time": "0800", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 19.8214, "lon": 72.6955, "bright": 346.5, "t31": 298.0, "frp": 21.4, "date": "2026-08-23", "time": "0845", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 19.8212, "lon": 72.6952, "bright": 349.8, "t31": 299.4, "frp": 25.4, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.85, "dn": "D", "stream": "near_real_time"},

    # 4. Rural Maharashtra (Ahmednagar) - Agricultural Residue
    {"lat": 19.4500, "lon": 74.2000, "bright": 332.0, "t31": 293.0, "frp": 4.8, "date": "2026-08-23", "time": "0845", "conf": "nominal", "c_norm": 0.5, "dn": "D", "stream": "historical"},

    # =========================================================================
    # NORTH_NCR: NCR Industrial Corridor
    # =========================================================================
    # 1. IOCL Panipat Refinery (Haryana) - Operational Gas Flaring
    {"lat": 29.4120, "lon": 76.9240, "bright": 349.5, "t31": 298.5, "frp": 26.5, "date": "2026-08-20", "time": "0830", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 29.4123, "lon": 76.9242, "bright": 352.8, "t31": 299.8, "frp": 29.4, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 29.4119, "lon": 76.9238, "bright": 355.2, "t31": 301.0, "frp": 32.8, "date": "2026-08-22", "time": "0800", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 29.4122, "lon": 76.9241, "bright": 358.4, "t31": 302.5, "frp": 35.6, "date": "2026-08-23", "time": "0845", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 29.4121, "lon": 76.9239, "bright": 361.0, "t31": 303.8, "frp": 38.2, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 2. Manesar Heavy Manufacturing Zone (Gurugram) - Sudden Thermal Spike / Fire Outbreak
    {"lat": 28.3540, "lon": 76.9420, "bright": 378.0, "t31": 310.5, "frp": 68.5, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.95, "dn": "D", "stream": "near_real_time"},
    {"lat": 28.3545, "lon": 76.9425, "bright": 389.5, "t31": 319.0, "frp": 89.2, "date": "2026-08-24", "time": "2045", "conf": "high", "c_norm": 0.95, "dn": "N", "stream": "near_real_time"},

    # 3. IOCL Mathura Refinery (UP)
    {"lat": 27.4220, "lon": 77.6910, "bright": 346.0, "t31": 297.2, "frp": 21.0, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 27.4224, "lon": 77.6915, "bright": 348.5, "t31": 298.5, "frp": 24.8, "date": "2026-08-22", "time": "0800", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 27.4222, "lon": 77.6912, "bright": 354.0, "t31": 300.8, "frp": 32.5, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 4. Rural Haryana (Jind Agricultural Field)
    {"lat": 29.1200, "lon": 76.3500, "bright": 334.5, "t31": 294.0, "frp": 5.6, "date": "2026-08-23", "time": "0845", "conf": "nominal", "c_norm": 0.5, "dn": "D", "stream": "historical"},

    # =========================================================================
    # EAST_MINERAL_BELT: Eastern Steel & Mineral Belt
    # =========================================================================
    # 1. IOCL Paradip Refinery (Odisha) - Heavy Continuous Flaring
    {"lat": 20.2840, "lon": 86.6320, "bright": 352.0, "t31": 299.5, "frp": 31.0, "date": "2026-08-20", "time": "0830", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 20.2843, "lon": 86.6322, "bright": 355.4, "t31": 301.2, "frp": 35.8, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 20.2839, "lon": 86.6318, "bright": 359.0, "t31": 303.0, "frp": 40.2, "date": "2026-08-22", "time": "0800", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 20.2842, "lon": 86.6321, "bright": 362.5, "t31": 304.8, "frp": 43.5, "date": "2026-08-23", "time": "0845", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 20.2841, "lon": 86.6319, "bright": 366.0, "t31": 306.0, "frp": 46.5, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 2. Tata Steel Jamshedpur (Jharkhand) - Metallurgical Hot Blast
    {"lat": 22.7830, "lon": 86.2110, "bright": 358.0, "t31": 302.0, "frp": 38.5, "date": "2026-08-21", "time": "0815", "conf": "high", "c_norm": 0.85, "dn": "D", "stream": "historical"},
    {"lat": 22.7834, "lon": 86.2114, "bright": 363.0, "t31": 304.5, "frp": 44.2, "date": "2026-08-22", "time": "0800", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 22.7832, "lon": 86.2112, "bright": 369.5, "t31": 308.0, "frp": 54.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.95, "dn": "D", "stream": "near_real_time"},

    # 3. SAIL Bhilai Steel Plant (Chhattisgarh) - Sudden Industrial Explosion / Fire Surge
    {"lat": 21.1850, "lon": 81.3850, "bright": 384.0, "t31": 314.0, "frp": 82.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.95, "dn": "D", "stream": "near_real_time"},
    {"lat": 21.1855, "lon": 81.3855, "bright": 393.2, "t31": 321.8, "frp": 96.5, "date": "2026-08-24", "time": "2045", "conf": "high", "c_norm": 0.95, "dn": "N", "stream": "near_real_time"},

    # 4. Haldia Petrochemicals (West Bengal)
    {"lat": 22.0620, "lon": 88.0810, "bright": 349.0, "t31": 298.8, "frp": 27.5, "date": "2026-08-22", "time": "0800", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 22.0625, "lon": 88.0815, "bright": 357.2, "t31": 302.4, "frp": 39.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 5. Rural Odisha (Forest / Scrub Clearing)
    {"lat": 21.5500, "lon": 85.3000, "bright": 333.0, "t31": 293.5, "frp": 5.1, "date": "2026-08-23", "time": "0845", "conf": "nominal", "c_norm": 0.5, "dn": "D", "stream": "historical"},

    # =========================================================================
    # SOUTH_CORRIDOR: Southern Industrial Corridor
    # =========================================================================
    # 1. CPCL Manali Petrochemical Complex (Chennai, Tamil Nadu) - Flare Baseline
    {"lat": 13.1640, "lon": 80.2610, "bright": 347.5, "t31": 297.8, "frp": 24.0, "date": "2026-08-20", "time": "0830", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 13.1644, "lon": 80.2613, "bright": 351.0, "t31": 299.0, "frp": 28.5, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 13.1639, "lon": 80.2608, "bright": 354.5, "t31": 300.5, "frp": 33.2, "date": "2026-08-22", "time": "0800", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 13.1642, "lon": 80.2611, "bright": 358.0, "t31": 302.0, "frp": 37.0, "date": "2026-08-23", "time": "0845", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "historical"},
    {"lat": 13.1641, "lon": 80.2609, "bright": 361.5, "t31": 303.5, "frp": 39.5, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 2. MRPL Mangalore Refinery (Karnataka) - Critical Sudden Explosion / Fire Surge
    {"lat": 12.9910, "lon": 74.8320, "bright": 381.0, "t31": 311.5, "frp": 71.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.95, "dn": "D", "stream": "near_real_time"},
    {"lat": 12.9915, "lon": 74.8325, "bright": 392.5, "t31": 321.0, "frp": 94.5, "date": "2026-08-24", "time": "2045", "conf": "high", "c_norm": 0.95, "dn": "N", "stream": "near_real_time"},

    # 3. BPCL Kochi Refinery (Kerala)
    {"lat": 9.9820, "lon": 76.3640, "bright": 346.5, "t31": 297.0, "frp": 22.5, "date": "2026-08-21", "time": "0815", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 9.9823, "lon": 76.3644, "bright": 350.0, "t31": 298.5, "frp": 27.0, "date": "2026-08-22", "time": "0800", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 9.9821, "lon": 76.3642, "bright": 355.0, "t31": 300.5, "frp": 34.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 4. HPCL Visakhapatnam Refinery (Andhra Pradesh)
    {"lat": 17.6820, "lon": 83.2540, "bright": 348.0, "t31": 298.0, "frp": 26.0, "date": "2026-08-22", "time": "0800", "conf": "nominal", "c_norm": 0.7, "dn": "D", "stream": "historical"},
    {"lat": 17.6825, "lon": 83.2545, "bright": 356.5, "t31": 301.8, "frp": 37.0, "date": "2026-08-24", "time": "0820", "conf": "high", "c_norm": 0.9, "dn": "D", "stream": "near_real_time"},

    # 5. Rural Tamil Nadu (Salem Agricultural Residue)
    {"lat": 11.2000, "lon": 78.5000, "bright": 331.5, "t31": 292.8, "frp": 4.6, "date": "2026-08-23", "time": "0845", "conf": "nominal", "c_norm": 0.5, "dn": "D", "stream": "historical"},
]


def seed_database():
    db = SessionLocal()
    try:
        added_count = 0
        skipped_count = 0

        for item in NATIONAL_OBSERVATIONS:
            lat = item["lat"]
            lon = item["lon"]
            acq_d = date.fromisoformat(item["date"])
            acq_t = item["time"]
            sat = "N"

            # Check if this exact observation already exists
            existing = db.query(RawObservationModel).filter(
                RawObservationModel.latitude == lat,
                RawObservationModel.longitude == lon,
                RawObservationModel.acq_date == acq_d,
                RawObservationModel.acq_time == acq_t,
                RawObservationModel.satellite == sat
            ).first()

            if existing:
                skipped_count += 1
                continue

            state, region_code = tag_coordinates(lat, lon)

            record = RawObservationModel(
                latitude=lat,
                longitude=lon,
                brightness=item["bright"],
                scan=0.38,
                track=0.36,
                acq_date=acq_d,
                acq_time=acq_t,
                satellite=sat,
                instrument="VIIRS",
                confidence=item["conf"],
                confidence_normalized=item["c_norm"],
                version="2.0NRT",
                bright_t31=item["t31"],
                frp=item["frp"],
                daynight=item["dn"],
                stream_type=item["stream"],
                state=state,
                region_code=region_code
            )
            db.add(record)
            added_count += 1

        db.commit()
        print(f"[+] Successfully seeded {added_count} national observations ({skipped_count} already existed).")

        # Summary by region
        from sqlalchemy import func
        summary = db.query(
            RawObservationModel.region_code,
            RawObservationModel.state,
            func.count(RawObservationModel.id)
        ).group_by(RawObservationModel.region_code, RawObservationModel.state).all()

        print("\n--- DATABASE OBSERVATIONS PER REGION ---")
        for reg, st, cnt in summary:
            print(f"  {reg:<20} | {st:<15} | {cnt} observations")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
