import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from src.application.dto import (
    AuthenticateUserCommand,
    CreateBranchCommand,
    InviteUserCommand,
    LogoutUserCommand,
    RotateRefreshTokenCommand,
    SwitchTenantCommand,
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
    agt_cert_number: Optional[str] = Field(None, max_length=64, description="Número de Certificação AGT")
    default_withholding_rate: Optional[float] = Field(None, ge=0, le=100, description="Taxa de retenção na fonte padrão (%)")
    invoice_footer_notes: Optional[str] = Field(None, description="Menções ou observações no rodapé dos documentos")
    bank_accounts: Optional[List[BankAccountHttpItem]] = Field(None, description="Coordenadas bancárias constantes nos documentos oficiais")
    onboarding_completed: Optional[bool] = Field(None, description="Indica se a parametrização inicial foi concluída")


class CreateBranchHttpRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=32, description="Código da filial (ex: LOJA01)")
    name: str = Field(..., min_length=2, max_length=128, description="Nome da filial ou estabelecimento")
    city: Optional[str] = Field(None, max_length=128, description="Município / Cidade")
    address_detail: Optional[str] = Field(None, description="Morada do estabelecimento")


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
        ensure_role_grant_is_allowed(ctx, req.roles)
        app_state = get_app_state(request)
        cmd = InviteUserCommand(
            target_tenant_id=ctx.tenant_id,
            email=req.email,
            full_name=req.full_name,
            roles=req.roles,
            branch_id=req.branch_id,
            actor_user_id=ctx.user_id,
            password=req.password,
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
        ensure_role_grant_is_allowed(ctx, req.roles)
        app_state = get_app_state(request)
        cmd = UpdateUserRolesCommand(
            tenant_id=ctx.tenant_id,
            target_user_id=target_user_id,
            roles=req.roles,
            actor_user_id=ctx.user_id,
        )
        await app_state.update_user_roles.execute(cmd)

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
        description="Executa o caso de uso ListRolesUseCase.",
    )
    async def list_roles(request: Request, ctx: SecurityContext = Depends(get_security_context)):
        app_state = get_app_state(request)
        return await app_state.list_roles.execute()

    return router

