import pytest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4
from typing import List, Optional

from src.application.commands.payroll_commands import ClosePayrollPeriodUseCase
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip
from src.domain.ports.event_publisher import EventPublisher
from src.domain.ports.payroll_repository import PayrollRepository
from src.domain.value_objects.enums import PeriodStatus, PayslipStatus
from src.infrastructure.events.outbox_worker import PayrollOutboxWorker


class FakePayrollRepo(PayrollRepository):
    def __init__(self):
        self.periods = {}
        self.payslips = {}
        self.outbox_events = []

    async def get_period_by_id(self, tenant_id: UUID, period_id: UUID) -> Optional[PayrollPeriod]:
        return self.periods.get((tenant_id, period_id))

    async def get_period_by_year_month(self, tenant_id: UUID, year: int, month: int) -> Optional[PayrollPeriod]:
        for (t, _), p in self.periods.items():
            if t == tenant_id and p.year == year and p.month == month:
                return p
        return None

    async def list_periods(self, tenant_id: UUID) -> List[PayrollPeriod]:
        return [p for (t, _), p in self.periods.items() if t == tenant_id]

    async def save_period(self, period: PayrollPeriod) -> None:
        self.periods[(period.tenant_id, period.id)] = period

    async def save_payslips(self, period_id: UUID, payslips: List[Payslip]) -> None:
        self.payslips[period_id] = payslips

    async def list_payslips_by_period(self, tenant_id: UUID, period_id: UUID) -> List[Payslip]:
        return self.payslips.get(period_id, [])

    async def get_payslip_by_id(self, tenant_id: UUID, payslip_id: UUID) -> Optional[Payslip]:
        for slips in self.payslips.values():
            for s in slips:
                if s.id == payslip_id and s.tenant_id == tenant_id:
                    return s
        return None

    async def save_outbox_event(
        self,
        event_id: UUID,
        tenant_id: UUID,
        aggregate_id: UUID,
        event_type: str,
        routing_key: str,
        payload: dict,
    ) -> None:
        self.outbox_events.append({
            "event_id": event_id,
            "tenant_id": tenant_id,
            "aggregate_id": aggregate_id,
            "event_type": event_type,
            "routing_key": routing_key,
            "payload": payload,
            "created_at": datetime.now(timezone.utc),
            "published_at": None,
        })

    async def list_pending_outbox_events(self, limit: int = 50) -> List[dict]:
        return [e for e in self.outbox_events if e["published_at"] is None][:limit]

    async def mark_outbox_event_published(self, event_id: UUID) -> None:
        for e in self.outbox_events:
            if e["event_id"] == event_id:
                e["published_at"] = datetime.now(timezone.utc)


class FailingPublisher(EventPublisher):
    async def publish(self, routing_key: str, payload: dict) -> None:
        raise ConnectionError("RabbitMQ indisponível")


class RecordingPublisher(EventPublisher):
    def __init__(self):
        self.published = []

    async def publish(self, routing_key: str, payload: dict) -> None:
        self.published.append((routing_key, payload))


@pytest.mark.asyncio
async def test_close_payroll_period_persists_outbox_when_publisher_fails():
    tenant_id = uuid4()
    period_id = uuid4()
    from datetime import date
    period = PayrollPeriod(
        id=period_id,
        tenant_id=tenant_id,
        title="Outubro 2026",
        year=2026,
        month=10,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 31),
        status=PeriodStatus.CALCULATED,
        total_gross=Decimal("1000000.00"),
        total_net=Decimal("800000.00"),
        total_irt=Decimal("120000.00"),
        total_inss_employee=Decimal("30000.00"),
        total_inss_employer=Decimal("80000.00"),
    )
    repo = FakePayrollRepo()
    await repo.save_period(period)
    await repo.save_payslips(period_id, [])

    # Mesmo com o publisher a falhar (broker em baixo), o fecho de período não rebenta
    failing_pub = FailingPublisher()
    use_case = ClosePayrollPeriodUseCase(repo, failing_pub)
    closed = await use_case.execute(tenant_id, period_id)

    assert closed.status == PeriodStatus.CLOSED
    # O evento de integração com a Contabilidade foi preservado no Outbox
    pending = await repo.list_pending_outbox_events()
    assert len(pending) == 1
    assert pending[0]["event_type"] == "payroll.period.closed"
    assert pending[0]["aggregate_id"] == period_id
    assert pending[0]["published_at"] is None

    # Quando o RabbitMQ recupera, o worker processa e marca como publicado
    recording_pub = RecordingPublisher()
    worker = PayrollOutboxWorker(repo, recording_pub, poll_interval=0.1)
    dispatched = await worker.process_batch()
    assert dispatched == 1
    assert len(recording_pub.published) == 1
    assert recording_pub.published[0][0] == "payroll.event.period.closed"

    # Confirma que não há mais eventos pendentes
    pending_after = await repo.list_pending_outbox_events()
    assert len(pending_after) == 0
