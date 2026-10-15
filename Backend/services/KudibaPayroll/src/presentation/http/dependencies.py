from uuid import UUID
from fastapi import Header, HTTPException, Request, status


def get_current_tenant_id(
    x_resolved_tenant_id: str | None = Header(None, alias="X-Resolved-Tenant-ID"),
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
) -> UUID:
    raw_id = x_resolved_tenant_id or x_tenant_id
    if not raw_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'X-Resolved-Tenant-ID' ou 'X-Tenant-ID' é obrigatório.",
        )
    try:
        return UUID(raw_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador de organização (tenant_id) inválido.",
        )


def get_app_state(request: Request):
    return request.app.state.app_state
