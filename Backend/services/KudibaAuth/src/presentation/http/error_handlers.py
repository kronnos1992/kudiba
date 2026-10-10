from fastapi import Request, status
from fastapi.responses import JSONResponse
from src.domain.error import (
    AccountInactiveError,
    AccountLockedError,
    AuthorizationError,
    ConflictError,
    DomainError,
    EntityNotFoundError,
    InvalidCredentialsError,
    SessionExpiredError,
    TenantAccessForbiddenError,
    TokenReusedError,
)


def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    path = request.url.path
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = exc.code

    if isinstance(exc, (InvalidCredentialsError, SessionExpiredError, TokenReusedError)):
        status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, (AccountInactiveError, TenantAccessForbiddenError, AuthorizationError)):
        status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, EntityNotFoundError):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, ConflictError):
        status_code = status.HTTP_409_CONFLICT
    elif isinstance(exc, AccountLockedError):
        status_code = status.HTTP_423_LOCKED

    problem = {
        "type": f"https://api.kudiba.ao/errors/{error_code.lower().replace('_', '-')}",
        "title": exc.message,
        "status": status_code,
        "detail": exc.message,
        "instance": path,
        "code": error_code,
    }

    headers = {}
    if status_code == status.HTTP_401_UNAUTHORIZED:
        headers["WWW-Authenticate"] = "Bearer"

    return JSONResponse(status_code=status_code, content=problem, headers=headers)
