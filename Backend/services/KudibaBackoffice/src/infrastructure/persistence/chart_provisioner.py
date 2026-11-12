import logging
import uuid
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.error import DomainError
from src.domain.ports import IChartProvisioner
from src.infrastructure.persistence import session_scope

logger = logging.getLogger(__name__)

_VALID_MODES = {"SEED", "MERGE"}


class SqlAlchemyChartProvisioner(IChartProvisioner):
    def __init__(self, accounting_session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = accounting_session_factory

    async def list_templates(self) -> List[dict]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                text(
                    """
                    SELECT t.code,
                           t.name,
                           t.sector_code,
                           t.regulator,
                           t.legal_reference,
                           t.version,
                           t.effective_from,
                           t.effective_to,
                           t.status,
                           t.description,
                           t.metadata->>'portal_url' AS portal_url,
                           COUNT(a.id) AS account_count
                      FROM kudiba_accounting.chart_templates t
                      LEFT JOIN kudiba_accounting.chart_template_accounts a
                             ON a.template_id = t.id
                     GROUP BY t.id
                     ORDER BY CASE t.status WHEN 'PUBLISHED' THEN 0 ELSE 1 END,
                              t.sector_code,
                              t.name
                    """
                )
            )
            return [dict(row) for row in res.mappings().all()]

    async def provision_chart(
        self,
        tenant_id: uuid.UUID,
        template_code: str,
        *,
        mode: str = "SEED",
        applied_by: Optional[str] = None,
    ) -> int:
        code = (template_code or "PGC_GENERIC").strip().upper()
        normalized_mode = (mode or "SEED").strip().upper()
        if normalized_mode not in _VALID_MODES:
            raise DomainError(
                f"Modo de provisionamento '{mode}' inválido. Use SEED ou MERGE.",
                code="INVALID_CHART_PROVISION_MODE",
            )

        async with session_scope(self._session_factory) as (session, _):
            await self._bind_tenant(session, tenant_id)
            res = await session.execute(
                text(
                    """
                    SELECT id, code, version, status
                      FROM kudiba_accounting.chart_templates
                     WHERE code = :code
                    """
                ),
                {"code": code},
            )
            template = res.mappings().first()
            if template is None:
                raise DomainError(
                    f"Template de plano de contas '{code}' não encontrado.",
                    code="CHART_TEMPLATE_NOT_FOUND",
                )
            if template["status"] != "PUBLISHED":
                raise DomainError(
                    f"O template de plano de contas '{code}' está em {template['status']} "
                    "e ainda não pode ser instalado.",
                    code="CHART_TEMPLATE_NOT_PUBLISHED",
                )

            existing = await session.scalar(
                text(
                    "SELECT COUNT(*) FROM kudiba_accounting.chart_of_accounts "
                    "WHERE tenant_id = :tenant_id"
                ),
                {"tenant_id": tenant_id},
            )
            inserted = 0
            if normalized_mode == "MERGE" or not existing:
                result = await session.execute(
                    text(
                        """
                        INSERT INTO kudiba_accounting.chart_of_accounts
                            (id, tenant_id, account_code, parent_account_code, account_name,
                             account_class, account_nature, is_analytical, is_system_reserved,
                             saft_grouping_code, is_active, template_code, class_code,
                             base_account_code)
                        SELECT gen_random_uuid(),
                               :tenant_id,
                               a.account_code,
                               a.parent_account_code,
                               a.account_name,
                               CAST(a.account_class AS kudiba_accounting.account_class),
                               CAST(a.account_nature AS kudiba_accounting.account_nature),
                               a.is_analytical,
                               a.is_system_reserved,
                               a.saft_grouping_code,
                               TRUE,
                               t.code,
                               a.class_code,
                               a.base_account_code
                          FROM kudiba_accounting.chart_template_accounts a
                          JOIN kudiba_accounting.chart_templates t
                            ON t.id = a.template_id
                         WHERE t.code = :code
                         ORDER BY a.sort_order, a.account_code
                        ON CONFLICT (tenant_id, account_code) DO NOTHING
                        """
                    ),
                    {"tenant_id": tenant_id, "code": code},
                )
                inserted = result.rowcount or 0

            await session.execute(
                text(
                    """
                    INSERT INTO kudiba_accounting.tenant_chart_settings
                        (tenant_id, template_code, template_version, applied_at,
                         applied_by, mode, status, metadata)
                    VALUES
                        (:tenant_id, :code, :version, NOW(), CAST(:applied_by AS VARCHAR), CAST(:mode AS VARCHAR), 'ACTIVE',
                         jsonb_build_object('inserted_accounts', CAST(:inserted AS INTEGER)))
                    ON CONFLICT (tenant_id) DO UPDATE SET
                        template_code = EXCLUDED.template_code,
                        template_version = EXCLUDED.template_version,
                        applied_at = NOW(),
                        applied_by = EXCLUDED.applied_by,
                        mode = EXCLUDED.mode,
                        status = 'ACTIVE',
                        metadata = EXCLUDED.metadata
                    """
                ),
                {
                    "tenant_id": tenant_id,
                    "code": code,
                    "version": template["version"],
                    "applied_by": applied_by,
                    "mode": normalized_mode,
                    "inserted": inserted,
                },
            )
            return inserted

    async def delete_chart(self, tenant_id: uuid.UUID) -> None:
        async with session_scope(self._session_factory) as (session, _):
            await self._bind_tenant(session, tenant_id)
            await session.execute(
                text(
                    "DELETE FROM kudiba_accounting.tenant_chart_settings "
                    "WHERE tenant_id = :tenant_id"
                ),
                {"tenant_id": tenant_id},
            )
            await session.execute(
                text(
                    "DELETE FROM kudiba_accounting.chart_of_accounts "
                    "WHERE tenant_id = :tenant_id"
                ),
                {"tenant_id": tenant_id},
            )

    @staticmethod
    async def _bind_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> None:
        await session.execute(
            text("SELECT set_config('app.current_tenant', :tenant_id, true)"),
            {"tenant_id": str(tenant_id)},
        )
