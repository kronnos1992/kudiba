import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship

Base = declarative_base()


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class TenantModel(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    nif: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    address_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(2), default="AO", nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class BranchModel(Base):
    __tablename__ = "branches"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.tenants.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    address_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UserTenantModel(Base):
    __tablename__ = "user_tenants"
    __table_args__ = (
        UniqueConstraint("user_id", "tenant_id", name="uq_user_tenant"),
        {"schema": "kudiba_core"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.users.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.tenants.id", ondelete="CASCADE"), nullable=False
    )
    default_branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.branches.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class RoleModel(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PermissionModel(Base):
    __tablename__ = "permissions"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    module: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class RolePermissionModel(Base):
    __tablename__ = "role_permissions"
    __table_args__ = {"schema": "kudiba_core"}

    role_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("kudiba_core.roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("kudiba_core.permissions.id", ondelete="CASCADE"), primary_key=True
    )


class UserRoleModel(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "tenant_id"],
            ["kudiba_core.user_tenants.user_id", "kudiba_core.user_tenants.tenant_id"],
            ondelete="CASCADE",
        ),
        {"schema": "kudiba_core"},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    role_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("kudiba_core.roles.id", ondelete="CASCADE"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class RefreshTokenModel(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = {"schema": "kudiba_core"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.users.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_core.tenants.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class AuthAuditLogModel(Base):
    __tablename__ = "auth_audit_log"
    __table_args__ = {"schema": "kudiba_audit"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    email_attempted: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
