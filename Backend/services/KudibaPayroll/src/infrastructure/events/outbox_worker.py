import asyncio
import logging
from typing import Optional

from src.domain.ports.event_publisher import EventPublisher
from src.domain.ports.payroll_repository import PayrollRepository

logger = logging.getLogger(__name__)


class PayrollOutboxWorker:
    def __init__(
        self,
        payroll_repo: PayrollRepository,
        event_publisher: EventPublisher,
        poll_interval: float = 5.0,
        batch_size: int = 50,
    ):
        self.payroll_repo = payroll_repo
        self.event_publisher = event_publisher
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self._task: Optional[asyncio.Task] = None
        self._stopped = False

    async def start(self) -> None:
        self._stopped = False
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stopped = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def process_batch(self) -> int:
        events = await self.payroll_repo.list_pending_outbox_events(limit=self.batch_size)
        if not events:
            return 0

        dispatched = 0
        for ev in events:
            try:
                await self.event_publisher.publish(ev["routing_key"], ev["payload"])
                await self.payroll_repo.mark_outbox_event_published(ev["event_id"])
                dispatched += 1
            except Exception as exc:
                logger.warning(
                    "Falha ao despachar evento de outbox %s: %s",
                    ev["event_id"],
                    exc,
                )
                break
        return dispatched

    async def _run_loop(self) -> None:
        while not self._stopped:
            try:
                await self.process_batch()
            except Exception as exc:
                logger.error("Erro no ciclo do PayrollOutboxWorker: %s", exc)

            try:
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
