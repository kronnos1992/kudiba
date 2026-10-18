import uuid
from typing import List, Optional

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
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None


class RenewLicenseHttpRequest(BaseModel):
    modules: Optional[List[str]] = Field(None, min_length=1)
    plan: Optional[str] = Field(None, max_length=32)
    seats: Optional[int] = Field(None, ge=1, le=100000)
    notes: Optional[str] = None


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

    @router.post(
        "/clients",
        status_code=status.HTTP_201_CREATED,
        summary="Criar Cliente",
        description="Cria o cliente, provisiona o tenant (com administrador opcional) e emite a 1ª licença anual.",
    )
    async def create_client(
        req: CreateClientHttpRequest,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = CreateClientCommand(
            company_name=req.company_name,
            nif=req.nif,
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
        return await app_state.create_client.execute(cmd)

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

    @router.patch(
        "/clients/{client_id}",
        summary="Actualizar Cliente",
        description="Actualiza dados de contacto do cliente.",
    )
    async def update_client(
        client_id: uuid.UUID,
        req: UpdateClientHttpRequest,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = UpdateClientCommand(
            client_id=client_id,
            company_name=req.company_name,
            contact_name=req.contact_name,
            contact_email=req.contact_email,
            contact_phone=req.contact_phone,
            notes=req.notes,
        )
        return await app_state.update_client.execute(cmd)

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
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        cmd = RenewLicenseCommand(
            client_id=client_id,
            modules=req.modules,
            plan=req.plan,
            seats=req.seats,
            notes=req.notes,
        )
        return await app_state.renew_license.execute(cmd)

    @router.post(
        "/clients/{client_id}/suspend",
        summary="Suspender Cliente",
        description="Suspende a licença corrente e bloqueia o acesso dos utilizadores do tenant.",
    )
    async def suspend_client(
        client_id: uuid.UUID,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.set_license_status.execute(
            SetLicenseStatusCommand(client_id=client_id, action="suspend")
        )

    @router.post(
        "/clients/{client_id}/activate",
        summary="Reactivar Cliente",
        description="Reactiva a licença corrente (se o período ainda estiver vigente).",
    )
    async def activate_client(
        client_id: uuid.UUID,
        request: Request,
        _: SecurityContext = Depends(require_platform_admin),
    ):
        app_state = get_app_state(request)
        return await app_state.set_license_status.execute(
            SetLicenseStatusCommand(client_id=client_id, action="activate")
        )

    return router
