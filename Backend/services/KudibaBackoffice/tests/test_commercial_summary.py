import uuid
from datetime import datetime, timedelta, timezone

import pytest

from src.application.queries import GetPlatformCommercialSummaryUseCase


class FakeClient:
    def __init__(self, created_at):
        self.id = uuid.uuid4()
        self.created_at = created_at


class FakeClientRepo:
    def __init__(self, clients):
        self._clients = clients

    async def list_all(self, search=None):
        return list(self._clients)


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


@pytest.mark.asyncio
async def test_commercial_summary_buckets_clients_by_month():
    now = datetime.now(timezone.utc)
    last_month = (now.replace(day=1) - timedelta(days=1))
    repo = FakeClientRepo(
        [
            FakeClient(now),
            FakeClient(now),
            FakeClient(last_month),
        ]
    )

    summary = await GetPlatformCommercialSummaryUseCase(repo).execute()

    assert summary.total_clients == 3
    assert summary.new_this_month == 2
    assert summary.new_last_month == 1
    assert summary.growth_rate == 100.0
    assert len(summary.monthly) == 12
    assert summary.new_last_12m == 3

    buckets = {b.month: b.count for b in summary.monthly}
    assert buckets[_month_key(now)] == 2
    assert buckets[_month_key(last_month)] == 1


@pytest.mark.asyncio
async def test_commercial_summary_growth_none_when_no_previous_month():
    now = datetime.now(timezone.utc)
    repo = FakeClientRepo([FakeClient(now)])

    summary = await GetPlatformCommercialSummaryUseCase(repo).execute()

    assert summary.new_this_month == 1
    assert summary.new_last_month == 0
    assert summary.growth_rate is None


@pytest.mark.asyncio
async def test_commercial_summary_empty_platform():
    summary = await GetPlatformCommercialSummaryUseCase(FakeClientRepo([])).execute()

    assert summary.total_clients == 0
    assert summary.new_this_month == 0
    assert summary.growth_rate is None
    assert all(b.count == 0 for b in summary.monthly)
