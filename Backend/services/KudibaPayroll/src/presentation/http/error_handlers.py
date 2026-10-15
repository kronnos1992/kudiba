from fastapi import Request
from fastapi.responses import JSONResponse
from src.domain.error import (
    ConflictError,
    ContractNotActiveError,
    DomainError,
    EntityNotFoundError,
    PeriodClosedError,
    ValidationError,
)


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    status_map = {
        EntityNotFoundError: 404,
        ConflictError: 409,
        ValidationError: 422,
        PeriodClosedError: 409,
        ContractNotActiveError: 400,
    }
    status_code = status_map.get(type(exc), 400)
    error_code = exc.code

    return JSONResponse(
        status_code=status_code,
        content={
            "type": f"https://api.kudiba.ao/errors/{error_code.lower().replace('_', '-')}",
            "title": exc.message,
            "status": status_code,
            "detail": exc.message,
            "instance": request.url.path,
            "code": error_code,
        },
    )
