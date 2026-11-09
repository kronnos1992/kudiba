import uuid
from datetime import date
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, EmailStr, Field

from src.application.dto import (
    CreateClientCommand,
    RenewLicenseCommand,
    SetLicenseStatusCommand,
    UpdateClientCommand,
)
from src.domain.modules import BILLABLE_MODULES
from src.presentation.http.deps import SecurityContext, get_app_state, require_platform_admin


class CreateClientHttpRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    nif: str = Field(..., min_length=3, max_length=20)
    alvara_number: Optional[str] = Field(None, max_length=64, description="Número do Alvará Comercial")
    alvara_issue_date: Optional[date] = Field(None, description="Data de Emissão do Alvará Comercial (auto-preenchida se omitida)")
    alvara_expiry_date: Optional[date] = Field(None, description="Data de Validade do Alvará Comercial (auto-preenchida se omitida)")
    sector_code: str = Field(default="GERAL", max_length=32, description="Sector de Actividade: GERAL, SEGUROS, BANCA, PETROLEO")
    accounting_template_code: str = Field(default="PGC_GENERIC", max_length=64, description="Código do Plano de Contas Regulatório")
    modules: List[str] = Field(..., min_length=1)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None
    plan: str = Field(default="STANDARD", max_length=32)
    seats: int = Field(default=5, ge=1, le=100000)
    admin_email: Optional[EmailStr] = None
    admin_full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    admin_password: Optional[str] = Field(None, min_length=12, max_length=1024)


class UpdateClientHttpRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=255)
    alvara_number: Optional[str] = Field(None, max_length=64, description="Número do Alvará Comercial")
    alvara_issue_date: Optional[date] = Field(None, description="Data de Emissão do Alvará Comercial")
    alvara_expiry_date: Optional[date] = Field(None, description="Data de Validade do Alvará Comercial")
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None


class VerifyAlvaraHttpRequest(BaseModel):
    alvara_number: str = Field(..., min_length=2, max_length=64)
    nif: Optional[str] = Field(None, max_length=20)
    alvara_issue_date: Optional[date] = None
    alvara_expiry_date: Optional[date] = None
    probe_remote: bool = Field(default=True)


class RenewLicenseHttpRequest(BaseModel):
    modules: Optional[List[str]] = Field(None, min_length=1)
    plan: Optional[str] = Field(None, max_length=32)
    seats: Optional[int] = Field(None, ge=1, le=100000)
    notes: Optional[str] = None


def extract_actor(request: Request, sec: Optional[SecurityContext]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    actor_id = str(sec.user_id) if sec and hasattr(sec, "user_id") and sec.user_id else request.headers.get("X-User-ID")
    actor_name = None
    if sec and hasattr(sec, "claims") and sec.claims:
        actor_name = sec.claims.get("email") or sec.claims.get("sub")
    if not actor_name:
        actor_name = request.headers.get("X-User-Name")
    ip_addr = request.headers.get("X-Forwarded-For")
    if ip_addr:
        ip_addr = ip_addr.split(",")[0].strip()
    elif request.client:
        ip_addr = request.client.host
    return actor_id, actor_name, ip_addr


async def record_audit(
    app_state,
    tenant_id: uuid.UUID,
    module: str,
    action: str,
    entity_type: str,
    entity_id: str,
    document_reference: Optional[str] = None,
    request: Optional[Request] = None,
    sec: Optional[SecurityContext] = None,
    details: Optional[dict] = None,
):
    if not hasattr(app_state, "audit_repo") or not app_state.audit_repo:
        return
    actor_id, actor_name, ip_addr = extract_actor(request, sec) if request else (None, None, None)
    await app_state.audit_repo.record_event(
        tenant_id=tenant_id,
        module=module,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        document_reference=document_reference,
        actor_user_id=actor_id,
        actor_name=actor_name,
        ip_address=ip_addr,
        details=details or {},
    )


def create_backoffice_router() -> APIRouter:
    router = APIRouter(tags=["Kudiba Backoffice — Clientes & Licenças"])

    @router.get(
        "/summary",
        summary="Painel Executivo da Plataforma",
        description="Agrega clientes, licenças (activas, a expirar, expiradas), lugares e adopção de módulos.",
    )
    async def get_platform_summary(
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.get_platform_summary.execute()

    @router.get(
        "/commercial-summary",
        summary="Painel Comercial da Plataforma",
        description="Novos clientes por mês, crescimento e totais comerciais para o dashboard executivo.",
    )
    async def get_platform_commercial_summary(
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.get_platform_commercial_summary.execute()

    @router.get(
        "/modules",
        summary="Catálogo de Módulos Subscritíveis",
        description="Lista os módulos que cada cliente pode escolher na sua licença.",
    )
    async def list_modules(
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        return [
            {"key": m.key, "name": m.name, "description": m.description}
            for m in BILLABLE_MODULES
        ]

    @router.get(
        "/clients",
        summary="Listar Clientes",
        description="Lista clientes com o estado derivado da licença actual.",
    )
    async def list_clients(
        request: Request,
        search: Optional[str] = Query(None, description="Pesquisa por nome, NIF ou e-mail"),
        status_filter: Optional[str] = Query(None, alias="status", description="ACTIVE | EXPIRED | SUSPENDED | NONE"),
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.list_clients.execute(search=search, status=status_filter)

    @router.get(
        "/accounting-templates",
        summary="Listar Planos de Contas Oficiais por Setor",
        description="Retorna os planos de contas regulatórios angolanos (PGC Geral MINFIN, Segurador ARSEG, Bancário BNA, Petrolífero MIREMPET/ANPG).",
    )
    async def list_accounting_templates(
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        if hasattr(app_state, "chart_provisioner") and app_state.chart_provisioner:
            return await app_state.chart_provisioner.list_templates()
        return []

    @router.post(
        "/clients",
        status_code=status.HTTP_201_CREATED,
        summary="Criar Cliente",
        description="Cria o cliente, provisiona o tenant (com administrador opcional) e emite a 1ª licença anual.",
    )
    async def create_client(
        req: CreateClientHttpRequest,
        request: Request,
        sec: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = CreateClientCommand(
            company_name=req.company_name,
            nif=req.nif,
            alvara_number=req.alvara_number,
            alvara_issue_date=req.alvara_issue_date,
            alvara_expiry_date=req.alvara_expiry_date,
            sector_code=req.sector_code,
            accounting_template_code=req.accounting_template_code,
            modules=req.modules,
            contact_name=req.contact_name,
            contact_email=req.contact_email,
            contact_phone=req.contact_phone,
            notes=req.notes,
            plan=req.plan,
            seats=req.seats,
            admin_email=req.admin_email,
            admin_full_name=req.admin_full_name,
            admin_password=req.admin_password,
        )
        res = await app_state.create_client.execute(cmd)
        await record_audit(
            app_state,
            tenant_id=res.tenant_id,
            module="BACKOFFICE",
            action="CRIACAO_CLIENTE_PLATAFORMA",
            entity_type="CLIENT",
            entity_id=str(res.id),
            document_reference=f"CLI-{res.nif}",
            request=request,
            sec=sec,
            details={
                "company_name": res.company_name,
                "nif": res.nif,
                "plan": req.plan,
                "seats": req.seats,
                "sector_code": req.sector_code,
                "accounting_template_code": req.accounting_template_code,
            },
        )
        return res

    @router.post(
        "/alvara/verify",
        summary="Verificar Validade do Alvará Comercial",
        description="Valida o formato, datas de emissão/validade e testa conectividade/links das plataformas oficiais de Angola (SILAC/MINDCOM, GUE, SEPE e AGT).",
    )
    async def verify_alvara(
        req: VerifyAlvaraHttpRequest,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.verify_alvara.execute(
            alvara_number=req.alvara_number,
            nif=req.nif,
            alvara_issue_date=req.alvara_issue_date,
            alvara_expiry_date=req.alvara_expiry_date,
            probe_remote=req.probe_remote,
        )

    @router.post(
        "/clients/{client_id}/verify-alvara",
        summary="Verificar Alvará Comercial do Cliente",
        description="Executa a verificação do alvará comercial registado no cliente e devolve os links e estado nas plataformas oficiais.",
    )
    async def verify_client_alvara(
        client_id: uuid.UUID,
        request: Request,
        probe_remote: bool = Query(default=True),
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        detail = await app_state.get_client.execute(client_id)
        return await app_state.verify_alvara.execute(
            alvara_number=detail.alvara_number or "",
            nif=detail.nif,
            alvara_issue_date=detail.alvara_issue_date,
            alvara_expiry_date=detail.alvara_expiry_date,
            probe_remote=probe_remote,
        )

    @router.get(
        "/clients/{client_id}",
        summary="Detalhe do Cliente",
        description="Devolve o cliente, a licença actual e o histórico de períodos.",
    )
    async def get_client(
        client_id: uuid.UUID,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.get_client.execute(client_id)

    @router.get(
        "/clients/{client_id}/backups",
        summary="Histórico de Cópias de Segurança do Cliente",
        description="Lista as cópias de segurança lógicas associadas ao tenant do cliente subscritor.",
    )
    async def list_client_backups(
        client_id: uuid.UUID,
        request: Request,
        limit: int = 50,
        offset: int = 0,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        detail = await app_state.get_client.execute(client_id)
        if hasattr(app_state, "tenant_reader") and app_state.tenant_reader:
            return await app_state.tenant_reader.list_tenant_backups(
                detail.tenant_id, limit=limit, offset=offset
            )
        return {"items": [], "total": 0, "limit": limit, "offset": offset}

    @router.patch(
        "/clients/{client_id}",
        summary="Actualizar Cliente",
        description="Actualiza dados de contacto do cliente.",
    )
    async def update_client(
        client_id: uuid.UUID,
        req: UpdateClientHttpRequest,
        request: Request,
        sec: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = UpdateClientCommand(
            client_id=client_id,
            company_name=req.company_name,
            alvara_number=req.alvara_number,
            alvara_issue_date=req.alvara_issue_date,
            alvara_expiry_date=req.alvara_expiry_date,
            contact_name=req.contact_name,
            contact_email=req.contact_email,
            contact_phone=req.contact_phone,
            notes=req.notes,
        )
        res = await app_state.update_client.execute(cmd)
        await record_audit(
            app_state,
            tenant_id=res.tenant_id,
            module="BACKOFFICE",
            action="ATUALIZACAO_CLIENTE_PLATAFORMA",
            entity_type="CLIENT",
            entity_id=str(client_id),
            document_reference=f"CLI-{res.nif}",
            request=request,
            sec=sec,
            details={"company_name": res.company_name},
        )
        return res

    @router.post(
        "/clients/{client_id}/licenses",
        status_code=status.HTTP_201_CREATED,
        summary="Renovar Licença",
        description="Emite um novo período anual (a partir do fim do período corrente ou de hoje) e reactiva o cliente.",
    )
    async def renew_license(
        client_id: uuid.UUID,
        req: RenewLicenseHttpRequest,
        request: Request,
        sec: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = RenewLicenseCommand(
            client_id=client_id,
            modules=req.modules,
            plan=req.plan,
            seats=req.seats,
            notes=req.notes,
        )
        res = await app_state.renew_license.execute(cmd)
        client = await app_state.client_repo.get(client_id)
        tid = client.tenant_id if client else client_id
        await record_audit(
            app_state,
            tenant_id=tid,
            module="BACKOFFICE",
            action="RENOVACAO_LICENCA_PLATAFORMA",
            entity_type="LICENSE",
            entity_id=str(res.id),
            document_reference=res.license_key,
            request=request,
            sec=sec,
            details={"plan": res.plan, "seats": res.seats},
        )
        return res

    @router.post(
        "/clients/{client_id}/suspend",
        summary="Suspender Cliente",
        description="Suspende a licença corrente e bloqueia o acesso dos utilizadores do tenant.",
    )
    async def suspend_client(
        client_id: uuid.UUID,
        request: Request,
        sec: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        res = await app_state.set_license_status.execute(
            SetLicenseStatusCommand(client_id=client_id, action="suspend")
        )
        await record_audit(
            app_state,
            tenant_id=res.tenant_id,
            module="BACKOFFICE",
            action="SUSPENSAO_CLIENTE_PLATAFORMA",
            entity_type="CLIENT",
            entity_id=str(client_id),
            document_reference=f"CLI-{res.nif}",
            request=request,
            sec=sec,
            details={"status": "SUSPENDED"},
        )
        return res

    @router.post(
        "/clients/{client_id}/activate",
        summary="Reactivar Cliente",
        description="Reactiva a licença corrente (se o período ainda estiver vigente).",
    )
    async def activate_client(
        client_id: uuid.UUID,
        request: Request,
        sec: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        res = await app_state.set_license_status.execute(
            SetLicenseStatusCommand(client_id=client_id, action="activate")
        )
        await record_audit(
            app_state,
            tenant_id=res.tenant_id,
            module="BACKOFFICE",
            action="ATIVACAO_CLIENTE_PLATAFORMA",
            entity_type="CLIENT",
            entity_id=str(client_id),
            document_reference=f"CLI-{res.nif}",
            request=request,
            sec=sec,
            details={"status": "ACTIVE"},
        )
        return res

    @router.get(
        "/system-audit-trail",
        summary="Consultar Trilha de Auditoria Universal",
        description="Devolve o histórico de auditoria do Backoffice e subscrições.",
    )
    async def get_system_audit_trail(
        request: Request,
        tenant_id: Optional[uuid.UUID] = Query(None),
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        raw_header = request.headers.get("X-Tenant-ID") or request.headers.get("X-Resolved-Tenant-ID")
        try:
            tid = tenant_id or (uuid.UUID(raw_header) if raw_header else uuid.UUID("00000000-0000-0000-0000-000000000000"))
        except ValueError:
            tid = uuid.UUID("00000000-0000-0000-0000-000000000000")
        items = await app_state.audit_repo.list_events(
            tenant_id=tid,
            module=module,
            action=action,
            limit=limit,
            offset=offset,
        )
        total = await app_state.audit_repo.count_events(
            tenant_id=tid,
            module=module,
            action=action,
        )
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    return router
