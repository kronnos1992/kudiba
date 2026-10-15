use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::dto::{
    AccountResponse, CreateAccountRequest, CreateFiscalYearRequest, CurrencyRevaluationRequest,
    JournalEntryResponse, JournalLineResponse, PostManualEntryRequest, ReverseEntryRequest,
};
use crate::domain::error::DomainError;
use crate::infrastructure::saft::SaftAccountingGenerator;
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
        DomainError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetail::new(
                StatusCode::CONFLICT,
                "Conflito de Unicidade",
                &msg,
                "CONFLICT",
            )),
        ),
        DomainError::ValidationError(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Dados Inválidos",
                &msg,
                "VALIDATION_ERROR",
            )),
        ),
        DomainError::UnbalancedEntry(deb, cred) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Partidas Dobradas Desequilibradas",
                &format!("O total de débitos ({}) difere do total de créditos ({}). A contabilidade exige equilíbrio estrito.", deb, cred),
                "UNBALANCED_ENTRY",
            )),
        ),
        DomainError::InvalidFiscalYear(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetail::new(
                StatusCode::BAD_REQUEST,
                "Exercício Fiscal Inválido",
                &msg,
                "INVALID_FISCAL_YEAR",
            )),
        ),
        DomainError::InvalidLine(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Linha Contabilística Inválida",
                &msg,
                "INVALID_LINE",
            )),
        ),
        DomainError::NonAnalyticalAccount(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetail::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Conta Sintética Não Admite Lançamentos",
                &msg,
                "NON_ANALYTICAL_ACCOUNT",
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

pub async fn health_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "UP",
            "service": "kudiba-accounting",
            "version": "1.0.0"
        })),
    )
}

pub async fn ready_handler() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({"status": "READY"})))
}

// -----------------------------------------------------------------------------
// PLANO GERAL DE CONTAS (PGC)
// -----------------------------------------------------------------------------

pub async fn get_chart_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let accounts = state
        .queries
        .get_chart(tenant_id)
        .await
        .map_err(map_domain_error)?;

    let resp: Vec<AccountResponse> = accounts
        .into_iter()
        .map(|a| AccountResponse {
            id: a.id,
            account_code: a.account_code,
            parent_account_code: a.parent_account_code,
            account_name: a.account_name,
            account_class: a.account_class.as_str().to_string(),
            account_nature: a.account_nature.as_str().to_string(),
            is_analytical: a.is_analytical,
            is_system_reserved: a.is_system_reserved,
            saft_grouping_code: a.saft_grouping_code,
        })
        .collect();

    Ok((StatusCode::OK, Json(resp)))
}

pub async fn create_account_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateAccountRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let acc = state
        .create_account
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let resp = AccountResponse {
        id: acc.id,
        account_code: acc.account_code,
        parent_account_code: acc.parent_account_code,
        account_name: acc.account_name,
        account_class: acc.account_class.as_str().to_string(),
        account_nature: acc.account_nature.as_str().to_string(),
        is_analytical: acc.is_analytical,
        is_system_reserved: acc.is_system_reserved,
        saft_grouping_code: acc.saft_grouping_code,
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

pub async fn seed_standard_pgc_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let total = state
        .seed_standard_pgc
        .execute(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": "Plano Geral de Contabilidade de Angola inicializado com sucesso",
            "accounts_created": total
        })),
    ))
}

// -----------------------------------------------------------------------------
// EXERCÍCIOS FISCAIS
// -----------------------------------------------------------------------------

pub async fn list_fiscal_years_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let years = state
        .queries
        .list_fiscal_years(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::OK, Json(years)))
}

pub async fn open_fiscal_year_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateFiscalYearRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let year = state
        .open_fiscal_year
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(year)))
}

pub async fn close_fiscal_year_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(year_code): Path<i32>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let year = state
        .close_fiscal_year
        .execute(tenant_id, year_code)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::OK, Json(year)))
}

// -----------------------------------------------------------------------------
// DIÁRIOS E LANÇAMENTOS (PARTIDAS DOBRADAS)
// -----------------------------------------------------------------------------

pub async fn list_journals_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let journals = state
        .queries
        .list_journals(tenant_id)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::OK, Json(journals)))
}

#[derive(Debug, Deserialize)]
pub struct EntriesQuery {
    pub journal_id: Option<Uuid>,
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list_entries_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<EntriesQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entries = state
        .queries
        .list_entries(
            tenant_id,
            q.journal_id,
            q.from_date,
            q.to_date,
            q.limit.unwrap_or(50),
            q.offset.unwrap_or(0),
        )
        .await
        .map_err(map_domain_error)?;

    let resp: Vec<JournalEntryResponse> = entries
        .into_iter()
        .map(|e| JournalEntryResponse {
            id: e.id,
            entry_number: e.entry_number,
            transaction_date: e.transaction_date,
            period: e.period,
            description: e.description,
            source_service: e.source_service,
            source_document_type: e.source_document_type,
            source_document_ref: e.source_document_ref,
            total_debit: e.total_debit,
            total_credit: e.total_credit,
            status: e.status.as_str().to_string(),
            lines: e
                .lines
                .into_iter()
                .map(|l| JournalLineResponse {
                    id: l.id,
                    line_number: l.line_number,
                    account_code: l.account_code,
                    description: l.description,
                    debit_amount: l.debit_amount,
                    credit_amount: l.credit_amount,
                    entity_id: l.entity_id,
                })
                .collect(),
        })
        .collect();

    Ok((StatusCode::OK, Json(resp)))
}

pub async fn get_entry_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entry = state
        .queries
        .get_entry(tenant_id, id)
        .await
        .map_err(map_domain_error)?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ProblemDetail::new(
                    StatusCode::NOT_FOUND,
                    "Lançamento Não Encontrado",
                    &format!("Lançamento com ID '{}' não encontrado", id),
                    "ENTRY_NOT_FOUND",
                )),
            )
        })?;

    let resp = JournalEntryResponse {
        id: entry.id,
        entry_number: entry.entry_number,
        transaction_date: entry.transaction_date,
        period: entry.period,
        description: entry.description,
        source_service: entry.source_service,
        source_document_type: entry.source_document_type,
        source_document_ref: entry.source_document_ref,
        total_debit: entry.total_debit,
        total_credit: entry.total_credit,
        status: entry.status.as_str().to_string(),
        lines: entry
            .lines
            .into_iter()
            .map(|l| JournalLineResponse {
                id: l.id,
                line_number: l.line_number,
                account_code: l.account_code,
                description: l.description,
                debit_amount: l.debit_amount,
                credit_amount: l.credit_amount,
                entity_id: l.entity_id,
            })
            .collect(),
    };

    Ok((StatusCode::OK, Json(resp)))
}

pub async fn post_entry_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PostManualEntryRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let entry = state
        .post_manual_entry
        .execute(tenant_id, payload, None)
        .await
        .map_err(map_domain_error)?;

    let resp = JournalEntryResponse {
        id: entry.id,
        entry_number: entry.entry_number,
        transaction_date: entry.transaction_date,
        period: entry.period,
        description: entry.description,
        source_service: entry.source_service,
        source_document_type: entry.source_document_type,
        source_document_ref: entry.source_document_ref,
        total_debit: entry.total_debit,
        total_credit: entry.total_credit,
        status: entry.status.as_str().to_string(),
        lines: entry
            .lines
            .into_iter()
            .map(|l| JournalLineResponse {
                id: l.id,
                line_number: l.line_number,
                account_code: l.account_code,
                description: l.description,
                debit_amount: l.debit_amount,
                credit_amount: l.credit_amount,
                entity_id: l.entity_id,
            })
            .collect(),
    };

    Ok((StatusCode::CREATED, Json(resp)))
}

pub async fn reverse_entry_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReverseEntryRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let reversed = state
        .reverse_entry
        .execute(tenant_id, payload)
        .await
        .map_err(map_domain_error)?;

    let resp = JournalEntryResponse {
        id: reversed.id,
        entry_number: reversed.entry_number,
        transaction_date: reversed.transaction_date,
        period: reversed.period,
        description: reversed.description,
        source_service: reversed.source_service,
        source_document_type: reversed.source_document_type,
        source_document_ref: reversed.source_document_ref,
        total_debit: reversed.total_debit,
        total_credit: reversed.total_credit,
        status: reversed.status.as_str().to_string(),
        lines: reversed
            .lines
            .into_iter()
            .map(|l| JournalLineResponse {
                id: l.id,
                line_number: l.line_number,
                account_code: l.account_code,
                description: l.description,
                debit_amount: l.debit_amount,
                credit_amount: l.credit_amount,
                entity_id: l.entity_id,
            })
            .collect(),
    };

    Ok((StatusCode::OK, Json(resp)))
}

// -----------------------------------------------------------------------------
// BALANCETES E RELATÓRIOS
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct TrialBalanceQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct SaftExportQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
    pub year: Option<i32>,
    pub fiscal_year: Option<i32>,
    pub company_name: Option<String>,
    pub tax_registration_number: Option<String>,
}

pub async fn get_trial_balance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<TrialBalanceQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let report = state
        .queries
        .get_trial_balance(tenant_id, q.from_date, q.to_date)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::OK, Json(report)))
}

pub async fn export_saft_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<SaftExportQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let accounts = state
        .queries
        .get_chart(tenant_id)
        .await
        .map_err(map_domain_error)?;
    let journals = state
        .queries
        .list_journals(tenant_id)
        .await
        .map_err(map_domain_error)?;
    let entries = state
        .queries
        .list_entries(tenant_id, None, q.from_date, q.to_date, 100_000, 0)
        .await
        .map_err(map_domain_error)?;

    let fiscal_year = q
        .fiscal_year
        .or(q.year)
        .or_else(|| q.to_date.map(|d| d.year()))
        .unwrap_or(2026);
    let start_date = q
        .from_date
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(fiscal_year, 1, 1).unwrap());
    let end_date = q
        .to_date
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(fiscal_year, 12, 31).unwrap());

    let company_name = q
        .company_name
        .as_deref()
        .or_else(|| headers.get("X-Company-Name").and_then(|h| h.to_str().ok()))
        .unwrap_or("Kudiba Enterprise Lda");

    let tax_id = q
        .tax_registration_number
        .as_deref()
        .or_else(|| {
            headers
                .get("X-Company-Tax-ID")
                .or_else(|| headers.get("X-Tenant-NIF"))
                .and_then(|h| h.to_str().ok())
        })
        .unwrap_or("5412345678");

    let xml = SaftAccountingGenerator::generate_xml(
        tenant_id,
        company_name,
        tax_id,
        fiscal_year,
        start_date,
        end_date,
        &accounts,
        &journals,
        &entries,
    );

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/xml; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"SAFT_AO_Accounting.xml\"",
            ),
        ],
        xml,
    ))
}

pub async fn revalue_currency_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CurrencyRevaluationRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ProblemDetail>)> {
    let tenant_id = extract_tenant_id(&headers)?;
    let resp = state
        .revalue_currency
        .execute(tenant_id, payload, None)
        .await
        .map_err(map_domain_error)?;

    Ok((StatusCode::CREATED, Json(resp)))
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        .route(
            "/api/v1/accounting/chart",
            get(get_chart_handler).post(create_account_handler),
        )
        .route(
            "/api/v1/accounting/chart/seed-standard",
            post(seed_standard_pgc_handler),
        )
        .route(
            "/api/v1/accounting/fiscal-years",
            get(list_fiscal_years_handler).post(open_fiscal_year_handler),
        )
        .route(
            "/api/v1/accounting/fiscal-years/{year}/close",
            post(close_fiscal_year_handler),
        )
        .route("/api/v1/accounting/journals", get(list_journals_handler))
        .route(
            "/api/v1/accounting/entries",
            get(list_entries_handler).post(post_entry_handler),
        )
        .route("/api/v1/accounting/entries/{id}", get(get_entry_handler))
        .route(
            "/api/v1/accounting/entries/reverse",
            post(reverse_entry_handler),
        )
        .route(
            "/api/v1/accounting/reports/trial-balance",
            get(get_trial_balance_handler),
        )
        .route("/api/v1/accounting/saft", get(export_saft_handler))
        .route(
            "/api/v1/accounting/currency-revaluation",
            post(revalue_currency_handler),
        )
        .with_state(state)
}
