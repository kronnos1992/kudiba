from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import get_settings
from src.domain.error import DomainError
from src.presentation.http.error_handlers import domain_error_handler
from src.presentation.http.routes import create_auth_router
from src.state import create_app_state

settings = get_settings()
logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Inicializa o container AppState (mirroring state.rs do Invoicing)
app_state = create_app_state(settings, session_factory)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Armazena app_state no estado global da aplicação
    app.state.app_state = app_state
    yield
    # Fechamento gracioso
    await app_state.cache.close()
    await engine.dispose()


app = FastAPI(
    title="Kudiba ERP — Auth & Identity Microservice",
    description="Microsserviço de Autenticação e RBAC (Clean Architecture + CQRS + Unit of Work).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api-docs/openapi.json",
    lifespan=lifespan,
)

# Registra o tratador global de erros de domínio RFC 7807
app.add_exception_handler(DomainError, domain_error_handler)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    path = request.url.path
    status_code = exc.status_code
    error_code = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "UNPROCESSABLE_ENTITY",
        423: "LOCKED",
    }.get(status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=status_code,
        content={
            "type": f"https://api.kudiba.ao/errors/{error_code.lower().replace('_', '-')}",
            "title": exc.detail if isinstance(exc.detail, str) else "Erro na Requisição",
            "status": status_code,
            "detail": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "instance": path,
            "code": error_code,
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    errors = [
        {
            "loc": list(error["loc"]),
            "msg": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "type": "https://api.kudiba.ao/errors/request-validation-failed",
            "title": "Erro de Validação",
            "status": 422,
            "detail": "Um ou mais campos da requisição são inválidos.",
            "instance": request.url.path,
            "code": "UNPROCESSABLE_ENTITY",
            "errors": errors,
        },
    )


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Infraestrutura"])
async def health_check():
    return {
        "status": "UP",
        "service": "kudiba-auth",
        "architecture": "Clean Architecture + CQRS + UoW",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["Infraestrutura"])
async def readiness_check():
    postgres_ok = False
    redis_ok = False
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        postgres_ok = True
    except Exception:
        logger.exception("KudibaAuth PostgreSQL readiness check failed.")
    try:
        redis_ok = await app_state.cache.ping()
    except Exception:
        logger.exception("KudibaAuth Redis readiness check failed.")

    if postgres_ok and redis_ok:
        return {"status": "READY", "postgres": "CONNECTED", "redis": "CONNECTED"}
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "NOT_READY",
            "postgres": "CONNECTED" if postgres_ok else "DISCONNECTED",
            "redis": "CONNECTED" if redis_ok else "DISCONNECTED",
        },
    )


# Registra o router HTTP do Auth
auth_router = create_auth_router()
app.include_router(auth_router, prefix="/auth")
app.include_router(auth_router, prefix="/api/v1/auth")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
