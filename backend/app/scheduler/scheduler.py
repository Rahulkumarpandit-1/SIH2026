import asyncio
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.models.schemas import DataRefreshRequest


class BackgroundRefreshScheduler:
    """
    Automated background worker that periodically polls NASA FIRMS for new satellite thermal observations
    within the Gujarat Industrial Corridor at a configurable interval (e.g., every 15 minutes).
    """
    _instance: Optional["BackgroundRefreshScheduler"] = None
    _lock = threading.Lock()

    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._interval_minutes = settings.LIVE_REFRESH_INTERVAL_MINUTES

    @classmethod
    def get_instance(cls) -> "BackgroundRefreshScheduler":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = BackgroundRefreshScheduler()
        return cls._instance

    async def start(self):
        """Starts the background scheduler task if enabled."""
        if not settings.ENABLE_BACKGROUND_SCHEDULER:
            logger.info("Background FIRMS scheduler is disabled via settings.")
            return

        if self._running:
            logger.warning("Background FIRMS scheduler is already running.")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            f"Near-Real-Time FIRMS scheduler started (Interval: {self._interval_minutes} minutes, Sensor: {settings.DEFAULT_SENSOR})."
        )

    async def stop(self):
        """Gracefully stops the background scheduler task."""
        if not self._running:
            return

        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Near-Real-Time FIRMS scheduler stopped.")

    async def _run_loop(self):
        """Main periodic refresh loop."""
        # Initial brief delay (e.g. 10 seconds) on startup to allow database initialization
        await asyncio.sleep(10)

        while self._running:
            try:
                logger.info(
                    f"Triggering scheduled near-real-time FIRMS check for Gujarat corridor ({settings.DEFAULT_SENSOR})..."
                )
                from app.api.service import PipelineService
                
                db = SessionLocal()
                try:
                    req = DataRefreshRequest(
                        days=settings.DEFAULT_DAY_RANGE,
                        sensor=settings.DEFAULT_SENSOR,
                        stream_type="near_real_time"
                    )
                    # PipelineService handles its own mutex locking
                    result = PipelineService.refresh_firms_data(req, db)
                    logger.info(
                        f"Scheduled FIRMS check completed: status={result.status}, new={result.rows_added}, duplicates={result.rows_duplicate} ({result.execution_time_seconds}s)"
                    )
                finally:
                    db.close()

            except Exception as e:
                logger.error(f"Error in background FIRMS refresh loop: {e}", exc_info=True)

            # Sleep for the configured interval in minutes
            sleep_seconds = self._interval_minutes * 60
            logger.info(
                f"Next scheduled near-real-time FIRMS check in {self._interval_minutes} minutes ({sleep_seconds}s)."
            )
            await asyncio.sleep(sleep_seconds)


scheduler = BackgroundRefreshScheduler.get_instance()
