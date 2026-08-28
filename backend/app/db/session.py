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
    """Checks for schema evolution columns like stream_type and adds them if missing."""
    try:
        inspector = inspect(engine)
        if "raw_observations" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("raw_observations")]
            if "stream_type" not in columns:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE raw_observations ADD COLUMN stream_type VARCHAR(20) DEFAULT 'historical'"))
                    conn.commit()
    except Exception as e:
        # Ignore for in-memory or fresh databases
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
