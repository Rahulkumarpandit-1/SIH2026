import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Ensure data directory exists for SQLite
if settings.DATABASE_URL.startswith("sqlite:///"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def auto_migrate_sqlite():
    """Checks for schema evolution columns and adds them if missing, ensuring backward compatibility."""
    try:
        # First ensure all declared tables exist
        import app.db.db_models  # Ensure models are imported for metadata
        Base.metadata.create_all(bind=engine)

        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # Migrate raw_observations
        if "raw_observations" in tables:
            obs_cols = [c["name"] for c in inspector.get_columns("raw_observations")]
            with engine.connect() as conn:
                if "stream_type" not in obs_cols:
                    conn.execute(text("ALTER TABLE raw_observations ADD COLUMN stream_type VARCHAR(20) DEFAULT 'historical'"))
                if "state" not in obs_cols:
                    conn.execute(text("ALTER TABLE raw_observations ADD COLUMN state VARCHAR(50) DEFAULT 'Gujarat'"))
                if "region_code" not in obs_cols:
                    conn.execute(text("ALTER TABLE raw_observations ADD COLUMN region_code VARCHAR(20) DEFAULT 'WEST_GUJARAT'"))
                conn.commit()

        # Migrate facility_thermal_profiles
        if "facility_thermal_profiles" in tables:
            fac_cols = [c["name"] for c in inspector.get_columns("facility_thermal_profiles")]
            with engine.connect() as conn:
                if "state" not in fac_cols:
                    conn.execute(text("ALTER TABLE facility_thermal_profiles ADD COLUMN state VARCHAR(50) DEFAULT 'Gujarat'"))
                if "region_code" not in fac_cols:
                    conn.execute(text("ALTER TABLE facility_thermal_profiles ADD COLUMN region_code VARCHAR(20) DEFAULT 'WEST_GUJARAT'"))
                if "cluster_zone" not in fac_cols:
                    conn.execute(text("ALTER TABLE facility_thermal_profiles ADD COLUMN cluster_zone VARCHAR(100)"))
                if "latitude" not in fac_cols:
                    conn.execute(text("ALTER TABLE facility_thermal_profiles ADD COLUMN latitude FLOAT"))
                if "longitude" not in fac_cols:
                    conn.execute(text("ALTER TABLE facility_thermal_profiles ADD COLUMN longitude FLOAT"))
                conn.commit()

        # Migrate ground_truth_labels
        if "ground_truth_labels" in tables:
            gt_cols = [c["name"] for c in inspector.get_columns("ground_truth_labels")]
            with engine.connect() as conn:
                if "state" not in gt_cols:
                    conn.execute(text("ALTER TABLE ground_truth_labels ADD COLUMN state VARCHAR(50) DEFAULT 'Gujarat'"))
                if "region_code" not in gt_cols:
                    conn.execute(text("ALTER TABLE ground_truth_labels ADD COLUMN region_code VARCHAR(20) DEFAULT 'WEST_GUJARAT'"))
                if "original_label" not in gt_cols:
                    conn.execute(text("ALTER TABLE ground_truth_labels ADD COLUMN original_label VARCHAR(50)"))
                if "is_edited" not in gt_cols:
                    conn.execute(text("ALTER TABLE ground_truth_labels ADD COLUMN is_edited BOOLEAN DEFAULT 0"))
                if "edit_count" not in gt_cols:
                    conn.execute(text("ALTER TABLE ground_truth_labels ADD COLUMN edit_count INTEGER DEFAULT 0"))
                conn.commit()

        # Ensure incidents table exists
        if "incidents" in tables:
            inc_cols = [c["name"] for c in inspector.get_columns("incidents")]
            with engine.connect() as conn:
                if "risk_level" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN risk_level VARCHAR(20)"))
                if "action_code" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN action_code VARCHAR(50)"))
                conn.commit()
    except Exception:
        # Ignore for in-memory, test databases or concurrent connections
        pass

# Run auto migration on import
auto_migrate_sqlite()

def get_db():
    """Dependency for yielding DB sessions in FastAPI or scripts."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

