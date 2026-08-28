from app.db.session import engine, Base
from app.db.db_models import RawObservationModel
from app.core.logging import logger

def init_db():
    """Initializes the database schema by creating all registered tables."""
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized successfully.")

if __name__ == "__main__":
    init_db()
