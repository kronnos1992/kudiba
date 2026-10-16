import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from src.domain.value_objects.enums import RunTrigger

logger = logging.getLogger(__name__)


class IntegrationsScheduler:
    def __init__(self, run_pull_use_case, tick_seconds: int = 30):
        self.run_pull_use_case = run_pull_use_case
        self.tick_seconds = max(5, tick_seconds)
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._loop())

    async def _loop(self) -> None:
        logger.info("Scheduler de integrações (REST pull) iniciado.")
        while not self._stop.is_set():
            try:
                await self.run_pull_use_case.execute(trigger=RunTrigger.SCHEDULE)
            except Exception:
                logger.exception("Falha ao executar o ciclo de pulls agendados.")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.tick_seconds)
            except asyncio.TimeoutError:
                continue

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
