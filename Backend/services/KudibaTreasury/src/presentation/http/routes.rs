use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::dto::{
    BankAccountResponse, CashMovementResponse, CashRegisterResponse, CashSessionResponse,
    CloseCashSessionRequest, CreateBankAccountRequest, CreateCashRegisterRequest,
    IssueTreasuryReceiptRequest, OpenCashSessionRequest, RecordCashMovementRequest,
    SessionReportResponse, TreasuryReceiptResponse,
};
use crate::domain::error::DomainError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ProblemDetail {
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
    pub error_code: String,
}

impl ProblemDetail {
    pub fn new(status: StatusCode, title: &str, detail: &str, error_code: &str) -> Self {
        Self {
            r#type: format!(
                "https://api.kudiba.ao/errors/{}",
                error_code.to_lowercase().replace('_', "-")
            ),
            title: title.to_string(),
            status: status.as_u16(),
            detail: detail.to_string(),
            error_code: error_code.to_string(),
        }
    }
}

pub fn map_domain_error(err: DomainError) -> (StatusCode, Json<ProblemDetail>) {
    match err {
        DomainError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetail::new(
                StatusCode::NOT_FOUND,
                "Registo Não Encontrado",
                &msg,
                "NOT_FOUND",
            )),
        ),
        DomainError::AlreadyExists(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Registo Já Existente",
                &msg,
                "ALREADY_EXISTS",
            )),
        ),
        DomainError::ValidationError(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Dados Inválidos",
                &msg,
                "VALIDATION_ERROR",
            )),
        ),
        DomainError::InvalidSessionState(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Estado de Sessão Inválido",
                &msg,
                "INVALID_SESSION_STATE",
            )),
        ),
        DomainError::InsufficientFunds(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Saldo Insuficiente",
                &msg,
                "INSUFFICIENT_FUNDS",
            )),
        ),
        DomainError::DatabaseError(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetail::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erro de Base de Dados",
                &err,
                "DATABASE_ERROR",
            )),
        ),
    }
}

pub fn extract_tenant_id(headers: &HeaderMap) -> Result<Uuid, (StatusCode, Json<ProblemDetail>)> {
    let raw = headers
        .get("X-Resolved-Tenant-ID")
        .or_else(|| headers.get("X-Tenant-ID"))
        .or_else(|| headers.get("x-tenant-id"))
        .and_then(|h| h.to_str().ok());

    match raw.and_then(|s| Uuid::parse_str(s).ok()) {
        Some(id) => Ok(id),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(ProblemDetail::new(
                StatusCode::UNAUTHORIZED,
                "Tenant Não Identificado",
                "O cabeçalho X-Resolved-Tenant-ID ou X-Tenant-ID é obrigatório e deve ser um UUID válido.",
                "TENANT_HEADER_MISSING",
            )),
        )),
    }
}

#[derive(Debug, Deserialize)]
pub struct CurrentSessionQuery {
    pub register_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct ReceiptsListQuery {
    pub customer_id: Option<String>,
    pub limit: Option<i64>,
}

pub async fn health_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "UP",
            "service": "kudiba-treasury",
            "timestamp": chrono::Utc::now()
        })),
    )
}

pub async fn ready_handler(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query("SELECT 1").execute(&state.db_pool).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "READY",
                "database": "CONNECTED",
                "service": "kudiba-treasury"
            })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "status": "UNREADY",
                "database": "DISCONNECTED",
                "error": e.to_string()
            })),
        ),
    }
}

// -----------------------------------------------------------------------------
// Cash Registers Handlers
// -----------------------------------------------------------------------------

pub async fn create_register_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateCashRegisterRequest>,
) -> Result<(StatusCode, Json<CashRegisterResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let register = state
        .create_register_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(register)))
}

pub async fn list_registers_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<CashRegisterResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let registers = state
        .queries
        .list_cash_registers(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(registers))
}

pub async fn get_register_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<CashRegisterResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let register = state
        .queries
        .get_cash_register(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(register))
}

// -----------------------------------------------------------------------------
// Cash Sessions Handlers
// -----------------------------------------------------------------------------

pub async fn open_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<OpenCashSessionRequest>,
) -> Result<(StatusCode, Json<CashSessionResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let session = state
        .open_session_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(session)))
}

pub async fn close_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CloseCashSessionRequest>,
) -> Result<Json<CashSessionResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let session = state
        .close_session_cmd
        .execute(tenant_id, id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(session))
}

pub async fn get_current_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<CurrentSessionQuery>,
) -> Result<Json<Option<CashSessionResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let session = state
        .queries
        .get_open_session(tenant_id, query.register_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(session))
}

pub async fn get_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<CashSessionResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let session = state
        .queries
        .get_cash_session(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(session))
}

pub async fn get_session_report_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionReportResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let report = state
        .queries
        .get_session_report(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(report))
}

// -----------------------------------------------------------------------------
// Cash Movements Handlers
// -----------------------------------------------------------------------------

pub async fn record_movement_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RecordCashMovementRequest>,
) -> Result<(StatusCode, Json<CashMovementResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let movement = state
        .record_movement_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(movement)))
}

pub async fn list_session_movements_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<CashMovementResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let movements = state
        .queries
        .list_session_movements(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(movements))
}

// -----------------------------------------------------------------------------
// Bank Accounts Handlers
// -----------------------------------------------------------------------------

pub async fn create_bank_account_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateBankAccountRequest>,
) -> Result<(StatusCode, Json<BankAccountResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let account = state
        .create_bank_account_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(account)))
}

pub async fn list_bank_accounts_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<BankAccountResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let accounts = state
        .queries
        .list_bank_accounts(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(accounts))
}

pub async fn get_bank_account_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<BankAccountResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let account = state
        .queries
        .get_bank_account(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(account))
}

// -----------------------------------------------------------------------------
// Treasury Receipts Handlers
// -----------------------------------------------------------------------------

pub async fn issue_receipt_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<IssueTreasuryReceiptRequest>,
) -> Result<(StatusCode, Json<TreasuryReceiptResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let receipt = state
        .issue_receipt_cmd
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(receipt)))
}

pub async fn list_receipts_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ReceiptsListQuery>,
) -> Result<Json<Vec<TreasuryReceiptResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let receipts = state
        .queries
        .list_receipts(tenant_id, query.customer_id.as_deref(), limit)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(receipts))
}

pub async fn get_receipt_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<TreasuryReceiptResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let receipt = state
        .queries
        .get_receipt(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(receipt))
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        // Cash Registers
        .route(
            "/api/v1/treasury/registers",
            post(create_register_handler).get(list_registers_handler),
        )
        .route("/api/v1/treasury/registers/{id}", get(get_register_handler))
        // Cash Sessions
        .route("/api/v1/treasury/sessions/open", post(open_session_handler))
        .route(
            "/api/v1/treasury/sessions/{id}/close",
            post(close_session_handler),
        )
        .route(
            "/api/v1/treasury/sessions/current",
            get(get_current_session_handler),
        )
        .route("/api/v1/treasury/sessions/{id}", get(get_session_handler))
        .route(
            "/api/v1/treasury/sessions/{id}/report",
            get(get_session_report_handler),
        )
        // Cash Movements
        .route("/api/v1/treasury/movements", post(record_movement_handler))
        .route(
            "/api/v1/treasury/sessions/{id}/movements",
            get(list_session_movements_handler),
        )
        // Bank Accounts
        .route(
            "/api/v1/treasury/bank-accounts",
            post(create_bank_account_handler).get(list_bank_accounts_handler),
        )
        .route(
            "/api/v1/treasury/bank-accounts/{id}",
            get(get_bank_account_handler),
        )
        // Treasury Receipts
        .route(
            "/api/v1/treasury/receipts",
            post(issue_receipt_handler).get(list_receipts_handler),
        )
        .route("/api/v1/treasury/receipts/{id}", get(get_receipt_handler))
        .with_state(state)
}
