from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import get_settings
from src.domain.error import DomainError
from src.presentation.http.error_handlers import domain_error_handler
from src.presentation.http.routes import create_backoffice_router
from src.state import create_app_state

settings = get_settings()
logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

auth_engine = create_async_engine(
    settings.async_auth_database_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

auth_session_factory = async_sessionmaker(
    bind=auth_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

accounting_engine = create_async_engine(
    settings.async_accounting_database_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

accounting_session_factory = async_sessionmaker(
    bind=accounting_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

invoicing_session_factory = None
if settings.async_invoicing_database_url:
    invoicing_engine = create_async_engine(
        settings.async_invoicing_database_url,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )
    invoicing_session_factory = async_sessionmaker(
        bind=invoicing_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

app_state = create_app_state(
    settings,
    session_factory,
    auth_session_factory,
    accounting_session_factory=accounting_session_factory,
    invoicing_session_factory=invoicing_session_factory,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "ALTER TABLE kudiba_backoffice.clients "
                    "ADD COLUMN IF NOT EXISTS alvara_number VARCHAR(64), "
                    "ADD COLUMN IF NOT EXISTS alvara_issue_date DATE, "
                    "ADD COLUMN IF NOT EXISTS alvara_expiry_date DATE, "
                    "ADD COLUMN IF NOT EXISTS sector_code VARCHAR(32) NOT NULL DEFAULT 'GERAL', "
                    "ADD COLUMN IF NOT EXISTS accounting_template_code VARCHAR(64) NOT NULL DEFAULT 'PGC_GENERIC'"
                )
            )
    except Exception as e:
        logger.warning("Migração automática em kudiba_backoffice.clients ignorada: %s", e)

    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS kudiba_audit"))
            await conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS kudiba_audit.system_audit_trail ("
                    "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
                    "tenant_id UUID NOT NULL, "
                    "module VARCHAR(50) NOT NULL, "
                    "action VARCHAR(100) NOT NULL, "
                    "entity_type VARCHAR(50) NOT NULL, "
                    "entity_id VARCHAR(100), "
                    "document_reference VARCHAR(100), "
                    "actor_user_id VARCHAR(100) DEFAULT 'sistema', "
                    "actor_name VARCHAR(255) DEFAULT 'Sistema / Administrador', "
                    "ip_address INET, "
                    "details JSONB DEFAULT '{}'::jsonb, "
                    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                    ")"
                )
            )
    except Exception as e:
        logger.warning("Migração automática da trilha de auditoria ignorada: %s", e)

    try:
        async with auth_engine.begin() as conn:
            await conn.execute(
                text(
                    "ALTER TABLE kudiba_core.tenants "
                    "ADD COLUMN IF NOT EXISTS alvara_number VARCHAR(64), "
                    "ADD COLUMN IF NOT EXISTS alvara_issue_date DATE, "
                    "ADD COLUMN IF NOT EXISTS alvara_expiry_date DATE, "
                    "ADD COLUMN IF NOT EXISTS email VARCHAR(255), "
                    "ADD COLUMN IF NOT EXISTS phone VARCHAR(64), "
                    "ADD COLUMN IF NOT EXISTS sector_code VARCHAR(32) NOT NULL DEFAULT 'GERAL', "
                    "ADD COLUMN IF NOT EXISTS accounting_template_code VARCHAR(64) NOT NULL DEFAULT 'PGC_GENERIC', "
                    "ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ, "
                    "ADD COLUMN IF NOT EXISTS subscribed_modules TEXT[]"
                )
            )
    except Exception as e:
        logger.warning("Migração automática em kudiba_core.tenants ignorada: %s", e)

    yield
    await engine.dispose()
    await auth_engine.dispose()


app = FastAPI(
    title="Kudiba ERP — Backoffice (Clientes & Licenças)",
    description="Microsserviço de Backoffice B2B — gestão de clientes subscritores e licenças anuais com módulos.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api-docs/openapi.json",
    lifespan=lifespan,
)

app.state.app_state = app_state

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
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
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


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.exception("Violação de integridade na base de dados em %s: %s", request.url.path, exc)
    msg = str(getattr(exc, "orig", exc)).lower()
    detail = "Conflito de integridade de dados."
    if "users_email" in msg or "idx_users_email" in msg:
        detail = "Já existe um utilizador registado com o e-mail fornecido."
    elif "tenants_nif" in msg or "clients_nif" in msg or "uq_tenants_nif" in msg:
        detail = "Já existe uma empresa registada com o NIF fornecido."
    elif "slug" in msg:
        detail = "Já existe uma empresa registada com este identificador único."
    return JSONResponse(
        status_code=409,
        content={
            "type": "https://api.kudiba.ao/errors/conflict",
            "title": "Conflito de Dados",
            "status": 409,
            "detail": detail,
            "instance": request.url.path,
            "code": "DATA_INTEGRITY_CONFLICT",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Erro interno não tratado em %s: %s", request.url.path, exc)
    detail_msg = str(exc) if str(exc) else "Ocorreu um erro interno inesperado no servidor."
    return JSONResponse(
        status_code=500,
        content={
            "type": "https://api.kudiba.ao/errors/internal-error",
            "title": "Erro Interno do Servidor",
            "status": 500,
            "detail": detail_msg,
            "instance": request.url.path,
            "code": "INTERNAL_SERVER_ERROR",
        },
    )


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
        "service": "kudiba-backoffice",
        "architecture": "Clean Architecture",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/ready", tags=["Infraestrutura"])
async def readiness_check():
    backoffice_ok = False
    auth_ok = False
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        backoffice_ok = True
    except Exception:
        logger.exception("KudibaBackoffice readiness check (backoffice DB) failed.")
    try:
        async with auth_engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        auth_ok = True
    except Exception:
        logger.exception("KudibaBackoffice readiness check (auth DB) failed.")

    if backoffice_ok and auth_ok:
        return {
            "status": "READY",
            "postgres_backoffice": "CONNECTED",
            "postgres_auth": "CONNECTED",
        }
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "NOT_READY",
            "postgres_backoffice": "CONNECTED" if backoffice_ok else "DISCONNECTED",
            "postgres_auth": "CONNECTED" if auth_ok else "DISCONNECTED",
        },
    )


backoffice_router = create_backoffice_router()
app.include_router(backoffice_router, prefix="/api/v1/backoffice")
app.include_router(backoffice_router, prefix="/backoffice", include_in_schema=False)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port, reload=True)
