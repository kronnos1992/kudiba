import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class AccountingBase(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChartTemplateModel(AccountingBase):
    __tablename__ = "chart_templates"
    __table_args__ = {"schema": "kudiba_accounting"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector_code: Mapped[str] = mapped_column(String(32), nullable=False)
    regulator: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    legal_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0")
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="DRAFT")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class ChartTemplateAccountModel(AccountingBase):
    __tablename__ = "chart_template_accounts"
    __table_args__ = {"schema": "kudiba_accounting"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    account_code: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_account_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_class: Mapped[str] = mapped_column(String(64), nullable=False)
    class_code: Mapped[str] = mapped_column(String(8), nullable=False)
    account_nature: Mapped[str] = mapped_column(String(8), nullable=False)
    is_analytical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_system_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    saft_grouping_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    base_account_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)


class TenantChartSettingsModel(AccountingBase):
    __tablename__ = "tenant_chart_settings"
    __table_args__ = {"schema": "kudiba_accounting"}

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    template_code: Mapped[str] = mapped_column(String(64), nullable=False)
    template_version: Mapped[str] = mapped_column(String(32), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    applied_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="SEED")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
