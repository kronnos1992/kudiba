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
    BankAccountResponse, BankStatementLineResponse, BankStatementResponse, CashMovementResponse,
    CashRegisterResponse, CashSessionResponse, CashTransferResponse, CloseCashSessionRequest,
    ClosePosSessionRequest, CreateBankAccountRequest, CreateBankStatementLineRequest,
    CreateBankStatementRequest, CreateCashRegisterRequest, CreateCashTransferRequest,
    CreatePayableRequest, InvoicePayableResponse, InvoiceReceivableResponse,
    IssueTreasuryReceiptRequest, OpenCashSessionRequest, OpenPosSessionRequest,
    PayableSettlementResponse, PosSessionResponse, ReconcileLineRequest, RecordCashMovementRequest,
    SessionReportResponse, SettlePayableRequest, TreasuryReceiptResponse,
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

pub fn extract_user_id(headers: &HeaderMap) -> Result<String, (StatusCode, Json<ProblemDetail>)> {
    let raw = headers
        .get("X-Resolved-User-ID")
        .or_else(|| headers.get("x-resolved-user-id"))
        .and_then(|h| h.to_str().ok());

    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some(id) => Ok(id.to_string()),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(ProblemDetail::new(
                StatusCode::UNAUTHORIZED,
                "Utilizador Não Identificado",
                "O cabeçalho X-Resolved-User-ID é obrigatório.",
                "USER_HEADER_MISSING",
            )),
        )),
    }
}

pub fn require_roles(
    headers: &HeaderMap,
    allowed: &[&str],
) -> Result<(), (StatusCode, Json<ProblemDetail>)> {
    let roles: Vec<String> = headers
        .get("X-Resolved-Roles")
        .and_then(|h| h.to_str().ok())
        .map(|raw| {
            raw.split(',')
                .map(|r| r.trim().to_uppercase())
                .filter(|r| !r.is_empty())
                .collect()
        })
        .unwrap_or_default();

    if roles
        .iter()
        .any(|r| r == "SUPER_ADMIN" || allowed.contains(&r.as_str()))
    {
        return Ok(());
    }

    Err((
        StatusCode::FORBIDDEN,
        Json(ProblemDetail::new(
            StatusCode::FORBIDDEN,
            "Acesso Negado",
            "O seu perfil não tem permissão para executar esta operação.",
            "FORBIDDEN",
        )),
    ))
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

#[derive(Debug, Deserialize)]
pub struct ReceivablesListQuery {
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
// POS Sessions (Nível Gestor)
// -----------------------------------------------------------------------------

pub async fn open_pos_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<OpenPosSessionRequest>,
) -> Result<(StatusCode, Json<PosSessionResponse>), (StatusCode, Json<ProblemDetail>)> {
    require_roles(&headers, &["ADMIN"])?;
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers)?;
    let session = state
        .open_pos_session_cmd
        .execute(tenant_id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(session)))
}

pub async fn close_pos_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<ClosePosSessionRequest>,
) -> Result<Json<PosSessionResponse>, (StatusCode, Json<ProblemDetail>)> {
    require_roles(&headers, &["ADMIN"])?;
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers)?;
    let session = state
        .close_pos_session_cmd
        .execute(tenant_id, id, user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(session))
}

pub async fn get_current_pos_session_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<CurrentSessionQuery>,
) -> Result<Json<Option<PosSessionResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let session = state
        .pos_session_repo
        .find_open_session_by_register(tenant_id, query.register_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(session.map(Into::into)))
}

pub async fn pos_panel_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PosPanelQuery>,
) -> Result<
    Json<crate::application::queries::pos_panel::PosPanelResponse>,
    (StatusCode, Json<ProblemDetail>),
> {
    let tenant_id = extract_tenant_id(&headers)?;
    let date = query
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let panel = crate::application::queries::pos_panel::fetch(
        &state.db_pool,
        tenant_id,
        query.register_id,
        date,
    )
    .await
    .map_err(map_domain_error)?;

    Ok(Json(panel))
}

#[derive(Debug, Deserialize)]
pub struct PosPanelQuery {
    pub register_id: Option<Uuid>,
    pub date: Option<chrono::NaiveDate>,
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

// -----------------------------------------------------------------------------
// Invoice Receivables Handlers
// -----------------------------------------------------------------------------

pub async fn list_receivables_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ReceivablesListQuery>,
) -> Result<Json<Vec<InvoiceReceivableResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let receivables = state
        .receivable_repo
        .list(tenant_id, limit)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(receivables.into_iter().map(Into::into).collect()))
}

// -----------------------------------------------------------------------------
// Dashboard Executivo
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Dashboard Executivo & Fluxo de Caixa
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CashFlowQuery {
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
}

pub async fn cash_flow_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<CashFlowQuery>,
) -> Result<Json<crate::application::queries::cash_flow::CashFlowReport>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let report = crate::application::queries::cash_flow::fetch(
        &state.db_pool,
        tenant_id,
        query.start_date,
        query.end_date,
    )
    .await
    .map_err(map_domain_error)?;

    Ok(Json(report))
}

// -----------------------------------------------------------------------------
// Contas a Pagar (Payables) Handlers
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct PayablesQuery {
    pub status: Option<String>,
    pub activity_type: Option<String>,
}

pub async fn list_payables_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PayablesQuery>,
) -> Result<Json<Vec<InvoicePayableResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let payables = state
        .payable_cmd
        .list_payables(tenant_id, query.status.as_deref(), query.activity_type.as_deref())
        .await
        .map_err(map_domain_error)?;

    Ok(Json(payables))
}

pub async fn create_payable_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreatePayableRequest>,
) -> Result<(StatusCode, Json<InvoicePayableResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let payable = state
        .payable_cmd
        .create_payable(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(payable)))
}

pub async fn settle_payable_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<SettlePayableRequest>,
) -> Result<(StatusCode, Json<PayableSettlementResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers)?;
    let settlement = state
        .payable_cmd
        .settle_payable(tenant_id, id, &user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(settlement)))
}

pub async fn list_settlements_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PayableSettlementResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let settlements = state
        .payable_cmd
        .list_settlements_for_payable(tenant_id, id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(settlements))
}

// -----------------------------------------------------------------------------
// Transferências Internas (Transfers) Handlers
// -----------------------------------------------------------------------------

pub async fn list_transfers_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<CashTransferResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let transfers = state
        .transfer_cmd
        .list_transfers(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(transfers))
}

pub async fn execute_transfer_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateCashTransferRequest>,
) -> Result<(StatusCode, Json<CashTransferResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers)?;
    let transfer = state
        .transfer_cmd
        .execute_transfer(tenant_id, &user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(transfer)))
}

// -----------------------------------------------------------------------------
// Extratos Bancários e Conciliação Handlers
// -----------------------------------------------------------------------------

pub async fn list_bank_statements_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(bank_id): Path<Uuid>,
) -> Result<Json<Vec<BankStatementResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let statements = state
        .statement_cmd
        .list_statements(tenant_id, Some(bank_id))
        .await
        .map_err(map_domain_error)?;

    Ok(Json(statements))
}

pub async fn create_bank_statement_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(bank_id): Path<Uuid>,
    Json(mut payload): Json<CreateBankStatementRequest>,
) -> Result<(StatusCode, Json<BankStatementResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    payload.bank_account_id = bank_id;
    let statement = state
        .statement_cmd
        .create_statement(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(statement)))
}

pub async fn list_statement_lines_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(statement_id): Path<Uuid>,
) -> Result<Json<Vec<BankStatementLineResponse>>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let lines = state
        .statement_cmd
        .list_statement_lines(tenant_id, statement_id)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(lines))
}

pub async fn add_statement_line_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(statement_id): Path<Uuid>,
    Json(payload): Json<CreateBankStatementLineRequest>,
) -> Result<(StatusCode, Json<BankStatementLineResponse>), (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let line = state
        .statement_cmd
        .add_statement_line(tenant_id, statement_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(line)))
}

pub async fn reconcile_line_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(line_id): Path<Uuid>,
    Json(payload): Json<ReconcileLineRequest>,
) -> Result<Json<BankStatementLineResponse>, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let user_id = extract_user_id(&headers)?;
    let line = state
        .statement_cmd
        .reconcile_line(tenant_id, line_id, &user_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok(Json(line))
}

pub async fn dashboard_summary_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<crate::application::queries::dashboard_summary::TreasuryDashboardSummary>,
    (StatusCode, Json<ProblemDetail>),
> {
    let tenant_id = extract_tenant_id(&headers)?;
    let summary = crate::application::queries::dashboard_summary::fetch(&state.db_pool, tenant_id)
        .await
        .map_err(map_domain_error)?;
    Ok(Json(summary))
}

async fn tenant_scope_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let tenant = req
        .headers()
        .get("X-Resolved-Tenant-ID")
        .or_else(|| req.headers().get("X-Tenant-ID"))
        .and_then(|value| value.to_str().ok())
        .and_then(|value| Uuid::parse_str(value.trim()).ok());

    crate::config::with_tenant_context(tenant, next.run(req)).await
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        // Dashboard Executivo & Fluxo de Caixa
        .route(
            "/api/v1/treasury/dashboard/summary",
            get(dashboard_summary_handler),
        )
        .route("/api/v1/treasury/cash-flow", get(cash_flow_handler))
        // Contas a Pagar (Payables)
        .route(
            "/api/v1/treasury/payables",
            post(create_payable_handler).get(list_payables_handler),
        )
        .route(
            "/api/v1/treasury/payables/{id}/settle",
            post(settle_payable_handler),
        )
        .route(
            "/api/v1/treasury/payables/{id}/settlements",
            get(list_settlements_handler),
        )
        // Transferências Internas (Transfers)
        .route(
            "/api/v1/treasury/transfers",
            post(execute_transfer_handler).get(list_transfers_handler),
        )
        // Extratos Bancários e Conciliação
        .route(
            "/api/v1/treasury/bank-accounts/{id}/statements",
            post(create_bank_statement_handler).get(list_bank_statements_handler),
        )
        .route(
            "/api/v1/treasury/statements/{id}/lines",
            post(add_statement_line_handler).get(list_statement_lines_handler),
        )
        .route(
            "/api/v1/treasury/statements/lines/{id}/reconcile",
            post(reconcile_line_handler),
        )
        // Cash Registers
        .route(
            "/api/v1/treasury/registers",
            post(create_register_handler).get(list_registers_handler),
        )
        .route("/api/v1/treasury/registers/{id}", get(get_register_handler))
        // POS Sessions (Nível Gestor)
        .route(
            "/api/v1/treasury/pos-sessions/open",
            post(open_pos_session_handler),
        )
        .route(
            "/api/v1/treasury/pos-sessions/{id}/close",
            post(close_pos_session_handler),
        )
        .route(
            "/api/v1/treasury/pos-sessions/current",
            get(get_current_pos_session_handler),
        )
        .route("/api/v1/treasury/pos/panel", get(pos_panel_handler))
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
        // Invoice Receivables (registados a partir dos eventos fiscais)
        .route(
            "/api/v1/treasury/receivables",
            get(list_receivables_handler),
        )
        .layer(axum::middleware::from_fn(tenant_scope_middleware))
        .with_state(state)
}
