import asyncio
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from src.application.dto import (
    AuthenticateUserCommand,
    CreateBranchCommand,
    CreateRoleCommand,
    InviteUserCommand,
    LogoutUserCommand,
    RemoveMemberCommand,
    RotateRefreshTokenCommand,
    SwitchTenantCommand,
    UpdateMemberStatusCommand,
    UpdateRoleCommand,
    UpdateRolePermissionsCommand,
    UpdateTenantSettingsCommand,
    UpdateUserRolesCommand,
)
from src.presentation.http.deps import (
    extract_client_ip,
    get_app_state,
    get_security_context,
    require_permission,
    ensure_role_grant_is_allowed,
    SecurityContext,
)

# Schemas de Entrada HTTP
class LoginHttpRequest(BaseModel):
    email: EmailStr = Field(..., description="E-mail de autenticação")
    password: str = Field(..., min_length=6, max_length=1024, description="Palavra-passe")


class RefreshHttpRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token emitido anteriormente")


class SwitchTenantHttpRequest(BaseModel):
    tenant_id: uuid.UUID = Field(..., description="UUID da organização alvo")
    branch_id: Optional[uuid.UUID] = Field(None, description="Filial opcional")


class InviteHttpRequest(BaseModel):
    email: EmailStr = Field(..., description="E-mail do novo membro")
    full_name: str = Field(..., min_length=2, description="Nome completo")
    roles: List[str] = Field(default_factory=lambda: ["OPERADOR_CAIXA"], description="Papéis a atribuir")
    branch_id: Optional[uuid.UUID] = Field(None, description="Filial padrão")
    password: Optional[str] = Field(None, min_length=12, max_length=1024, description="Password inicial, obrigatória para novas contas")


class UpdateRolesHttpRequest(BaseModel):
    roles: List[str] = Field(..., min_length=1, description="Novos papéis")


class UpdateMemberStatusHttpRequest(BaseModel):
    status: str = Field(..., pattern=r"^(ACTIVE|SUSPENDED)$", description="Estado do membro (ACTIVE ou SUSPENDED)")


class BankAccountHttpItem(BaseModel):
    bank_name: str = Field(..., description="Nome da instituição bancária")
    iban: str = Field(..., description="IBAN da conta")
    account_number: Optional[str] = Field("", description="Número da conta")
    swift: Optional[str] = Field("", description="Código SWIFT/BIC")
    currency: Optional[str] = Field("AOA", description="Moeda da conta")
    is_primary: Optional[bool] = Field(False, description="Conta principal para documentos")


class UpdateTenantSettingsHttpRequest(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=255, description="Denominação Social")
    trade_name: Optional[str] = Field(None, max_length=255, description="Nome Comercial / Marca")
    nif: Optional[str] = Field(None, min_length=5, max_length=20, description="NIF")
    address_detail: Optional[str] = Field(None, description="Endereço completo da sede")
    city: Optional[str] = Field(None, max_length=128, description="Município / Cidade")
    province: Optional[str] = Field(None, max_length=128, description="Província")
    postal_code: Optional[str] = Field(None, max_length=32, description="Código Postal / Caixa Postal")
    country: Optional[str] = Field(None, max_length=2, description="Código ISO do País (ex: AO)")
    phone: Optional[str] = Field(None, max_length=64, description="Telefone oficial")
    email: Optional[str] = Field(None, max_length=255, description="E-mail oficial nos documentos")
    website: Optional[str] = Field(None, max_length=255, description="Website oficial")
    logo_data_url: Optional[str] = Field(None, description="Logótipo da empresa em Base64 Data URL ou URL")
    commercial_registry: Optional[str] = Field(None, max_length=64, description="Conservatória / Matrícula Comercial")
    share_capital: Optional[str] = Field(None, max_length=64, description="Capital Social")
    currency: Optional[str] = Field(None, max_length=3, description="Moeda operacional (AOA, USD, EUR)")
    tax_regime_code: Optional[str] = Field(None, max_length=32, description="Regime de IVA (REGIME_GERAL, REGIME_SIMPLIFICADO, REGIME_EXCLUSAO)")
    tax_office_code: Optional[str] = Field(None, max_length=128, description="Repartição Fiscal")
    agt_cert_number: Optional[str] = Field(None, max_length=64, description="Número de Certificação de Software")
    default_withholding_rate: Optional[float] = Field(None, ge=0, le=100, description="Taxa de retenção na fonte padrão (%)")
    invoice_footer_notes: Optional[str] = Field(None, description="Menções ou observações no rodapé dos documentos")
    bank_accounts: Optional[List[BankAccountHttpItem]] = Field(None, description="Coordenadas bancárias constantes nos documentos oficiais")
    onboarding_completed: Optional[bool] = Field(None, description="Indica se a parametrização inicial foi concluída")


class TestDatabaseConnectionHttpRequest(BaseModel):
    host: str = Field(default="localhost", description="Host ou IP do servidor PostgreSQL")
    port: int = Field(default=5432, ge=1, le=65535, description="Porta TCP do PostgreSQL")
    database: str = Field(default="kudiba_erp", min_length=1, max_length=128, description="Nome da Base de Dados")
    username: str = Field(default="kudiba", min_length=1, max_length=128, description="Utilizador")
    password: Optional[str] = Field(None, max_length=256, description="Palavra-passe")
    ssl_mode: str = Field(default="prefer", description="Modo SSL (disable, prefer, require)")
    timeout_seconds: int = Field(default=5, ge=1, le=30, description="Timeout de teste em segundos")


class UpdateDatabaseConnectionHttpRequest(BaseModel):
    host: str = Field(default="localhost", min_length=1, max_length=255)
    port: int = Field(default=5432, ge=1, le=65535)
    database: str = Field(default="kudiba_erp", min_length=1, max_length=128)
    username: str = Field(default="kudiba", min_length=1, max_length=128)
    password: Optional[str] = Field(None, max_length=256)
    schema_name: str = Field(default="kudiba_core", min_length=1, max_length=128)
    ssl_mode: str = Field(default="prefer")
    pool_size: int = Field(default=20, ge=1, le=200)
    timeout_seconds: int = Field(default=5, ge=1, le=60)
    read_replica_enabled: bool = Field(default=False)
    read_replica_host: Optional[str] = Field(None, max_length=255)
    read_replica_port: Optional[int] = Field(None, ge=1, le=65535)
    is_custom_configured: bool = Field(default=True)


class CreateBranchHttpRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=32, description="Código da filial (ex: LOJA01)")
    name: str = Field(..., min_length=2, max_length=128, description="Nome da filial ou estabelecimento")
    city: Optional[str] = Field(None, max_length=128, description="Município / Cidade")
    address_detail: Optional[str] = Field(None, description="Morada do estabelecimento")


class CreateRoleHttpRequest(BaseModel):
    id: str = Field(
        ...,
        min_length=2,
        max_length=32,
        pattern=r"^[A-Z][A-Z0-9_]*$",
        description="Código único do perfil em maiúsculas (ex: GERENTE_LOJA)",
    )
    name: str = Field(..., min_length=2, max_length=64, description="Nome do perfil")
    description: Optional[str] = Field(None, max_length=500, description="Descrição do perfil")
    permissions: List[str] = Field(default_factory=list, description="Permissões a atribuir ao perfil")


class UpdateRoleHttpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64, description="Nome do perfil")
    description: Optional[str] = Field(None, max_length=500, description="Descrição do perfil")


class UpdateRolePermissionsHttpRequest(BaseModel):
    permissions: List[str] = Field(default_factory=list, description="Permissões atribuídas ao perfil")


def create_auth_router() -> APIRouter:
    router = APIRouter(tags=["Kudiba Auth & Identity"])

    @router.post(
        "/login",
        summary="Autenticar Utilizador",
        description="Executa o caso de uso AuthenticateUserUseCase via Argon2id e emite Access Token + Refresh Token.",
    )
    async def login(req: LoginHttpRequest, request: Request):
        app_state = get_app_state(request)
        cmd = AuthenticateUserCommand(
            email=req.email,
            password=req.password,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        return await app_state.authenticate_user.execute(cmd)

    @router.post(
        "/refresh",
        summary="Renovar Sessão",
        description="Executa o caso de uso RotateRefreshTokenUseCase com rotação automática e detecção de roubo de sessão.",
    )
    async def refresh(req: RefreshHttpRequest, request: Request):
        app_state = get_app_state(request)
        cmd = RotateRefreshTokenCommand(
            refresh_token=req.refresh_token,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        return await app_state.rotate_refresh_token.execute(cmd)

    @router.post(
        "/logout",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Encerrar Sessão",
        description="Executa o caso de uso LogoutUserUseCase revogando a sessão no banco e adicionando o JWT à blacklist no Redis.",
    )
    async def logout(
        request: Request,
        req: Optional[RefreshHttpRequest] = None,
        authorization: Optional[str] = Header(None),
    ):
        app_state = get_app_state(request)
        access_jti = None
        access_exp = None
        user_id = None
        if authorization and authorization.startswith("Bearer "):
            try:
                claims = app_state.token_service.decode_access_token(authorization[7:].strip())
                access_jti = claims.get("jti")
                access_exp = claims.get("exp")
                user_id = uuid.UUID(claims["sub"])
            except Exception:
                pass

        cmd = LogoutUserCommand(
            user_id=user_id,
            refresh_token=req.refresh_token if req else None,
            access_token_jti=access_jti,
            access_token_exp=access_exp,
            ip_address=extract_client_ip(request),
        )
        await app_state.logout_user.execute(cmd)

    @router.post(
        "/switch-tenant",
        summary="Alternar Organização Activa",
        description="Executa o caso de uso SwitchTenantUseCase emitindo novo JWT com os privilégios da organização selecionada.",
    )
    async def switch_tenant(
        req: SwitchTenantHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(get_security_context),
    ):
        app_state = get_app_state(request)
        cmd = SwitchTenantCommand(
            user_id=ctx.user_id,
            target_tenant_id=req.tenant_id,
            target_branch_id=req.branch_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        return await app_state.switch_tenant.execute(cmd)

    @router.get(
        "/me",
        summary="Perfil do Utilizador Activo",
        description="Executa o caso de uso GetUserProfileUseCase retornando dados pessoais e organizações vinculadas.",
    )
    async def get_me(
        request: Request,
        ctx: SecurityContext = Depends(get_security_context),
    ):
        app_state = get_app_state(request)
        return await app_state.get_user_profile.execute(ctx.user_id)

    @router.get(
        "/tenant/settings",
        summary="Consultar Parametrização da Empresa Activa",
        description="Retorna os parâmetros globais, fiscais, identidade visual e coordenadas bancárias da empresa activa.",
    )
    async def get_tenant_settings(
        request: Request,
        ctx: SecurityContext = Depends(get_security_context),
    ):
        app_state = get_app_state(request)
        return await app_state.get_tenant_settings.execute(ctx.tenant_id)

    @router.put(
        "/tenant/settings",
        summary="Actualizar Parametrização da Empresa Activa",
        description="Actualiza os dados globais e específicos da empresa constantes nos documentos oficiais, exigindo 'tenant:settings:manage' ou papel ADMIN.",
    )
    async def update_tenant_settings(
        req: UpdateTenantSettingsHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("tenant:settings:manage")),
    ):
        app_state = get_app_state(request)
        cmd = UpdateTenantSettingsCommand(
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user_id,
            company_name=req.company_name,
            trade_name=req.trade_name,
            nif=req.nif,
            address_detail=req.address_detail,
            city=req.city,
            province=req.province,
            postal_code=req.postal_code,
            country=req.country,
            phone=req.phone,
            email=req.email,
            website=req.website,
            logo_data_url=req.logo_data_url,
            commercial_registry=req.commercial_registry,
            share_capital=req.share_capital,
            currency=req.currency,
            tax_regime_code=req.tax_regime_code,
            tax_office_code=req.tax_office_code,
            agt_cert_number=req.agt_cert_number,
            default_withholding_rate=req.default_withholding_rate,
            invoice_footer_notes=req.invoice_footer_notes,
            bank_accounts=[item.model_dump() for item in req.bank_accounts] if req.bank_accounts is not None else None,
            onboarding_completed=req.onboarding_completed,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        return await app_state.update_tenant_settings.execute(cmd)

    CLUSTER_DATABASES = [
        {
            "service_id": "invoicing",
            "service_name": "Kudiba Invoicing",
            "database_name": "kudiba_invoicing",
            "role": "Facturação Fiscal, Séries & SAF-T (AO)",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "inventory",
            "service_name": "Kudiba Inventory",
            "database_name": "kudiba_inventory",
            "role": "Gestão de Stocks, Armazéns & Artigos",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "treasury",
            "service_name": "Kudiba Treasury",
            "database_name": "kudiba_treasury",
            "role": "Tesouraria, Caixas POS & Bancos",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "accounting",
            "service_name": "Kudiba Accounting",
            "database_name": "kudiba_accounting",
            "role": "Plano Geral de Contabilidade & Balancetes",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "payroll",
            "service_name": "Kudiba Payroll",
            "database_name": "kudiba_payroll",
            "role": "Recursos Humanos, Folha Salarial, IRT & INSS",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "auth",
            "service_name": "Kudiba Auth & Core",
            "database_name": "kudiba_auth",
            "role": "Identidade, RBAC & Multi-tenant Core",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "backoffice",
            "service_name": "Kudiba Backoffice",
            "database_name": "kudiba_backoffice",
            "role": "Licenciamento & Subscrições Empresariais",
            "driver": "PostgreSQL 16 (Async)",
        },
        {
            "service_id": "erp_replica",
            "service_name": "Kudiba ERP (Geral)",
            "database_name": "kudiba_erp",
            "role": "Repositório Central & Réplica de Leitura",
            "driver": "PostgreSQL 16 (Async)",
        },
    ]

    def _get_default_db_creds(st):
        try:
            url_str = st.config.database_url.replace("postgresql+asyncpg://", "postgresql://")
            parsed = urlparse(url_str)
            return (
                parsed.hostname or "localhost",
                parsed.port or 5432,
                parsed.username or "kudiba",
                parsed.password or "kudiba_secret_pass",
            )
        except Exception:
            return ("localhost", 5432, "kudiba", "kudiba_secret_pass")

    @router.get(
        "/tenant/database-connections",
        summary="Consultar Estado do Cluster de Bases de Dados & Conexão do Tenant",
        description="Retorna a monitorização em tempo real das bases de dados dos microsserviços e a parametrização de conexão da empresa activa.",
    )
    async def get_database_connections(
        request: Request,
        ctx: SecurityContext = Depends(get_security_context),
    ):
        app_state = get_app_state(request)
        tenant = await app_state.tenant_repo.find_by_id(ctx.tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

        def_host, def_port, def_user, def_pass = _get_default_db_creds(app_state)

        async def ping_db(node_info: dict) -> dict:
            t0 = time.perf_counter()
            db_name = node_info["database_name"]
            try:
                conn = await asyncpg.connect(
                    host=def_host,
                    port=def_port,
                    user=def_user,
                    password=def_pass,
                    database=db_name,
                    timeout=2.0,
                )
                latency = (time.perf_counter() - t0) * 1000.0
                ver = await conn.fetchval("SELECT version();")
                conn_count = await conn.fetchval("SELECT count(*) FROM pg_stat_activity WHERE datname = $1;", db_name)
                await conn.close()
                short_ver = ver.split(",")[0] if ver else "PostgreSQL"
                return {
                    **node_info,
                    "host": def_host,
                    "port": def_port,
                    "status": "ONLINE",
                    "latency_ms": round(latency, 1),
                    "version": short_ver,
                    "active_connections": conn_count or 1,
                    "error": None,
                }
            except Exception as e:
                return {
                    **node_info,
                    "host": def_host,
                    "port": def_port,
                    "status": "OFFLINE",
                    "latency_ms": None,
                    "version": None,
                    "active_connections": 0,
                    "error": str(e),
                }

        nodes = await asyncio.gather(*[ping_db(svc) for svc in CLUSTER_DATABASES])

        raw_custom = tenant.database_connections or {}
        custom_config = {
            "host": raw_custom.get("host") or def_host,
            "port": raw_custom.get("port") or def_port,
            "database": raw_custom.get("database") or "kudiba_erp",
            "username": raw_custom.get("username") or def_user,
            "schema_name": raw_custom.get("schema_name") or "kudiba_core",
            "ssl_mode": raw_custom.get("ssl_mode") or "prefer",
            "pool_size": raw_custom.get("pool_size") or 20,
            "timeout_seconds": raw_custom.get("timeout_seconds") or 5,
            "read_replica_enabled": bool(raw_custom.get("read_replica_enabled", False)),
            "read_replica_host": raw_custom.get("read_replica_host") or "",
            "read_replica_port": raw_custom.get("read_replica_port") or def_port,
            "is_custom_configured": bool(raw_custom.get("is_custom_configured", False)),
            "last_tested_at": raw_custom.get("last_tested_at"),
            "last_test_status": raw_custom.get("last_test_status"),
            "last_test_latency_ms": raw_custom.get("last_test_latency_ms"),
            "has_password": bool(raw_custom.get("password")),
        }

        return {
            "tenant_id": str(ctx.tenant_id),
            "cluster_nodes": nodes,
            "custom_connection": custom_config,
        }

    @router.post(
        "/tenant/database-connections/test",
        summary="Testar Conexão PostgreSQL em Tempo Real",
        description="Efectua uma verificação assíncrona de conectividade, medindo latência e versão do motor de base de dados.",
    )
    async def test_database_connection(
        req: TestDatabaseConnectionHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("tenant:settings:manage")),
    ):
        app_state = get_app_state(request)
        tenant = await app_state.tenant_repo.find_by_id(ctx.tenant_id)
        def_host, def_port, def_user, def_pass = _get_default_db_creds(app_state)

        target_pass = req.password
        if not target_pass or target_pass == "••••••••":
            if tenant and tenant.database_connections and tenant.database_connections.get("password"):
                target_pass = tenant.database_connections["password"]
            elif req.host in {"localhost", "127.0.0.1"} and req.username == def_user:
                target_pass = def_pass
            else:
                target_pass = ""

        now_iso = datetime.now(timezone.utc).isoformat()
        t0 = time.perf_counter()
        try:
            conn = await asyncpg.connect(
                host=req.host,
                port=req.port,
                user=req.username,
                password=target_pass,
                database=req.database,
                timeout=float(req.timeout_seconds),
            )
            lat_ms = (time.perf_counter() - t0) * 1000.0
            ver = await conn.fetchval("SELECT version();")
            info = await conn.fetchrow("SELECT current_database() as db, current_user as usr, current_schema() as sch;")
            await conn.close()
            return {
                "success": True,
                "latency_ms": round(lat_ms, 2),
                "version": ver.split(",")[0] if ver else "PostgreSQL",
                "database": info["db"] if info else req.database,
                "user": info["usr"] if info else req.username,
                "schema": info["sch"] if info else "public",
                "error": None,
                "tested_at": now_iso,
            }
        except Exception as e:
            return {
                "success": False,
                "latency_ms": 0.0,
                "version": None,
                "database": req.database,
                "user": req.username,
                "schema": None,
                "error": str(e),
                "tested_at": now_iso,
            }

    @router.put(
        "/tenant/database-connections",
        summary="Actualizar Parametrização de Bases de Dados da Empresa",
        description="Guarda a configuração de base de dados e réplica para a empresa activa e gera registo de auditoria.",
    )
    async def update_database_connection(
        req: UpdateDatabaseConnectionHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("tenant:settings:manage")),
    ):
        app_state = get_app_state(request)
        tenant = await app_state.tenant_repo.find_by_id(ctx.tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

        existing_connections = dict(tenant.database_connections or {})
        
        final_password = req.password
        if not final_password or final_password == "••••••••":
            final_password = existing_connections.get("password", "")

        new_config = {
            "host": req.host.strip(),
            "port": int(req.port),
            "database": req.database.strip(),
            "username": req.username.strip(),
            "password": final_password,
            "schema_name": req.schema_name.strip() or "kudiba_core",
            "ssl_mode": req.ssl_mode,
            "pool_size": int(req.pool_size),
            "timeout_seconds": int(req.timeout_seconds),
            "read_replica_enabled": bool(req.read_replica_enabled),
            "read_replica_host": req.read_replica_host.strip() if req.read_replica_host else "",
            "read_replica_port": int(req.read_replica_port) if req.read_replica_port else None,
            "is_custom_configured": bool(req.is_custom_configured),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        tenant.database_connections = new_config
        await app_state.tenant_repo.update_tenant(tenant)

        await app_state.audit_repo.record_event(
            action="TENANT_DATABASE_CONFIG_UPDATED",
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            details={
                "host": req.host,
                "port": req.port,
                "database": req.database,
                "username": req.username,
                "schema_name": req.schema_name,
                "read_replica_enabled": req.read_replica_enabled,
                "is_custom_configured": req.is_custom_configured,
            },
        )

        return {
            "success": True,
            "message": "Parâmetros de base de dados atualizados com sucesso.",
            "custom_connection": {
                **new_config,
                "password": "••••••••" if final_password else "",
                "has_password": bool(final_password),
            },
        }

    @router.get(
        "/users",
        summary="Listar Membros da Organização",
        description="Executa o caso de uso ListTenantMembersUseCase exigindo a permissão 'users:read'.",
    )
    async def list_members(
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:read")),
    ):
        app_state = get_app_state(request)
        return await app_state.list_tenant_members.execute(ctx.tenant_id)

    @router.get(
        "/audit-logs",
        summary="Consultar Registos de Auditoria e Acessos",
        description="Devolve o histórico de eventos de autenticação e segurança da empresa.",
    )
    async def get_audit_logs(
        request: Request,
        limit: int = 100,
        offset: int = 0,
        ctx: SecurityContext = Depends(require_permission("users:read")),
    ):
        if not (ctx.has_role("ADMIN") or ctx.has_role("SUPER_ADMIN") or ctx.has_role("AUDITOR")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores têm permissão para consultar os registos de auditoria.",
            )
        app_state = get_app_state(request)
        items = await app_state.audit_repo.list_events(tenant_id=ctx.tenant_id, limit=limit, offset=offset)
        total = await app_state.audit_repo.count_events(tenant_id=ctx.tenant_id)
        return {"items": items, "total": total}

    @router.post(
        "/users/invite",
        status_code=status.HTTP_201_CREATED,
        summary="Convidar Membro",
        description="Executa o caso de uso InviteUserUseCase exigindo a permissão 'users:invite'.",
    )
    async def invite_member(
        req: InviteHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:invite")),
    ):
        app_state = get_app_state(request)
        ensure_role_grant_is_allowed(ctx, req.roles, await app_state.role_repo.list_role_ids(ctx.tenant_id))
        cmd = InviteUserCommand(
            target_tenant_id=ctx.tenant_id,
            email=req.email,
            full_name=req.full_name,
            roles=req.roles,
            branch_id=req.branch_id,
            actor_user_id=ctx.user_id,
            password=req.password,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        return await app_state.invite_user.execute(cmd)

    @router.put(
        "/users/{target_user_id}/roles",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Modificar Papéis de um Membro",
        description="Executa o caso de uso UpdateUserRolesUseCase exigindo a permissão 'users:manage_roles'.",
    )
    async def update_member_roles(
        target_user_id: uuid.UUID,
        req: UpdateRolesHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        ensure_role_grant_is_allowed(ctx, req.roles, await app_state.role_repo.list_role_ids(ctx.tenant_id))
        cmd = UpdateUserRolesCommand(
            tenant_id=ctx.tenant_id,
            target_user_id=target_user_id,
            roles=req.roles,
            actor_user_id=ctx.user_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        await app_state.update_user_roles.execute(cmd)

    @router.patch(
        "/users/{target_user_id}/status",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Alterar Estado de um Membro",
        description="Ativa ou suspende o acesso de um membro à organização.",
    )
    async def update_member_status(
        target_user_id: uuid.UUID,
        req: UpdateMemberStatusHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        cmd = UpdateMemberStatusCommand(
            tenant_id=ctx.tenant_id,
            target_user_id=target_user_id,
            status=req.status,
            actor_user_id=ctx.user_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        await app_state.update_member_status.execute(cmd)

    @router.delete(
        "/users/{target_user_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Remover Membro da Organização",
        description="Desvincula um membro da organização activa.",
    )
    async def remove_member(
        target_user_id: uuid.UUID,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        cmd = RemoveMemberCommand(
            tenant_id=ctx.tenant_id,
            target_user_id=target_user_id,
            actor_user_id=ctx.user_id,
            ip_address=extract_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
        await app_state.remove_member.execute(cmd)

    @router.get(
        "/branches",
        summary="Listar Filiais da Organização",
        description="Executa o caso de uso ListBranchesUseCase.",
    )
    async def list_branches(
        request: Request,
        ctx: SecurityContext = Depends(get_security_context),
    ):
        app_state = get_app_state(request)
        return await app_state.list_branches.execute(ctx.tenant_id)

    @router.post(
        "/branches",
        status_code=status.HTTP_201_CREATED,
        summary="Registar Nova Filial / Estabelecimento Comercial",
        description="Cria uma nova filial ou loja associada à empresa activa.",
    )
    async def create_branch(
        req: CreateBranchHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("tenant:settings:manage")),
    ):
        app_state = get_app_state(request)
        cmd = CreateBranchCommand(
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user_id,
            code=req.code,
            name=req.name,
            city=req.city,
            address_detail=req.address_detail,
        )
        return await app_state.create_branch.execute(cmd)

    @router.get(
        "/roles",
        summary="Catálogo de Papéis e Permissões",
        description="Perfis de sistema globais + perfis personalizados da empresa activa.",
    )
    async def list_roles(request: Request, ctx: SecurityContext = Depends(get_security_context)):
        app_state = get_app_state(request)
        return await app_state.list_roles.execute(ctx.tenant_id, ctx.roles)

    @router.get(
        "/permissions",
        summary="Catálogo de Permissões Disponíveis",
        description="Lista todas as permissões do sistema agrupadas por módulo.",
    )
    async def list_permissions(
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:read")),
    ):
        app_state = get_app_state(request)
        return await app_state.list_permissions.execute()

    @router.post(
        "/roles",
        status_code=status.HTTP_201_CREATED,
        summary="Criar Perfil de Acesso Personalizado",
        description="Cria um novo perfil RBAC no âmbito da empresa activa com o conjunto de permissões indicado.",
    )
    async def create_role(
        req: CreateRoleHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        cmd = CreateRoleCommand(
            tenant_id=ctx.tenant_id,
            role_id=req.id,
            name=req.name,
            description=req.description,
            permissions=req.permissions,
        )
        return await app_state.create_role.execute(cmd)

    @router.put(
        "/roles/{role_id}",
        summary="Editar Dados de um Perfil de Acesso",
        description="Actualiza o nome e a descrição de um perfil personalizado da empresa activa.",
    )
    async def update_role(
        role_id: str,
        req: UpdateRoleHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        cmd = UpdateRoleCommand(tenant_id=ctx.tenant_id, role_id=role_id, name=req.name, description=req.description)
        return await app_state.update_role.execute(cmd)

    @router.put(
        "/roles/{role_id}/permissions",
        summary="Definir Permissões de um Perfil de Acesso",
        description="Substitui o conjunto de permissões de um perfil personalizado da empresa activa.",
    )
    async def update_role_permissions(
        role_id: str,
        req: UpdateRolePermissionsHttpRequest,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        cmd = UpdateRolePermissionsCommand(
            tenant_id=ctx.tenant_id,
            role_id=role_id,
            permissions=req.permissions,
            actor_roles=ctx.roles,
        )
        return await app_state.update_role_permissions.execute(cmd)

    @router.delete(
        "/roles/{role_id}/permissions/override",
        summary="Repor Permissões Predefinidas de um Perfil de Sistema",
        description="Remove a personalização das permissões de um perfil de Sistema nesta empresa, "
        "restaurando o conjunto predefinido do Kudiba ERP.",
    )
    async def reset_role_permissions(
        role_id: str,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        return await app_state.reset_role_permissions.execute(role_id, ctx.tenant_id, ctx.roles)

    @router.delete(
        "/roles/{role_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Eliminar Perfil de Acesso",
        description="Remove um perfil personalizado da empresa activa sem utilizadores atribuídos.",
    )
    async def delete_role(
        role_id: str,
        request: Request,
        ctx: SecurityContext = Depends(require_permission("users:manage_roles")),
    ):
        app_state = get_app_state(request)
        await app_state.delete_role.execute(role_id, ctx.tenant_id)

    return router

