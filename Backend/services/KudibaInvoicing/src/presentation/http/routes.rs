use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::application::dto::{
    CreateFiscalSeriesCommand, GetInvoiceQuery, GetTaxRegimeQuery, IssueInvoiceCommand,
    ResolveTaxRegimeCommand, SignDirectCommand, ValidateSeriesSequenceQuery, VerifySignatureQuery,
};
use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::state::AppState;

/// Constrói o router REST interno do motor fiscal
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_handler))
        // REST: emissão de documento fiscal (rota directa e rota encaminhada pelo Gateway)
        .route("/api/v1/invoices", post(issue_invoice_handler))
        .route("/api/v1/fiscal/invoices", post(issue_invoice_handler))
        // REST: consulta de documento fiscal
        .route("/api/v1/invoices/{id}", get(get_invoice_handler))
        .route("/api/v1/fiscal/invoices/{id}", get(get_invoice_handler))
        // REST: chave pública RSA para verificação independente das assinaturas
        .route("/api/v1/public-key", get(public_key_handler))
        .route("/api/v1/fiscal/public-key", get(public_key_handler))
        // REST: abertura explícita de série fiscal (idempotente)
        .route("/api/v1/fiscal/series", post(create_series_handler))
        // REST: assinatura directa (POS em modo contingência fiscal)
        .route("/api/v1/fiscal/sign", post(sign_direct_handler))
        // REST: validação de assinatura e de sequência da série fiscal
        .route(
            "/api/v1/fiscal/verify-signature",
            post(verify_signature_handler),
        )
        .route(
            "/api/v1/fiscal/validate-series",
            post(validate_series_handler),
        )
        // REST: enquadramento fiscal de IVA (resolução por volume, consulta e catálogo)
        .route("/api/v1/fiscal/tax-regimes", get(list_tax_regimes_handler))
        .route(
            "/api/v1/fiscal/tax-regime",
            post(resolve_tax_regime_handler),
        )
        .route(
            "/api/v1/fiscal/tax-regime/{tenant_id}",
            get(get_tax_regime_handler),
        )
        .route(
            "/api/v1/fiscal/tax-regime/{tenant_id}/exemption-codes/{code}",
            get(validate_exemption_code_handler),
        )
        .merge(crate::presentation::http::scalar::router::<AppState>())
        .with_state(state)
}

async fn root_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "service": "KudibaInvoicing Engine & Fiscal Core",
        "version": state.config.service_version,
        "framework": "Rust (Axum + Tokio)",
        "rest": format!("REST on port {}", state.config.http_port),
        "grpc": format!("FiscalEngineService (kudiba.fiscal.v1) on port {}", state.config.grpc_port),
        "docs": "/scalar",
        "regulation": "Decreto Presidencial n.º 71/25 (AGT Angola)",
    }))
}

async fn health_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "KudibaInvoicing",
        "version": state.config.service_version,
        "framework": "Rust",
        "regulation": "Decreto Presidencial n.º 71/25 (AGT Angola)",
        "timestamp": Utc::now(),
    }))
}

async fn issue_invoice_handler(
    State(state): State<AppState>,
    Json(command): Json<IssueInvoiceCommand>,
) -> Response {
    match state.issue_invoice.execute(command).await {
        Ok(result) => (StatusCode::CREATED, Json(result)).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn create_series_handler(
    State(state): State<AppState>,
    Json(command): Json<CreateFiscalSeriesCommand>,
) -> Response {
    match state.create_series.execute(command).await {
        Ok(series_id) => {
            (StatusCode::CREATED, Json(json!({ "seriesId": series_id }))).into_response()
        }
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct GetInvoiceParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
}

async fn get_invoice_handler(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(params): Query<GetInvoiceParams>,
) -> Response {
    let query = GetInvoiceQuery {
        invoice_id: Some(id),
        tenant_id: params.tenant_id,
        document_number: None,
    };

    match state.get_invoice.execute(query).await {
        Ok(invoice) => Json(invoice).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn public_key_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "keyVersion": state.signer.key_version(),
        "publicKeyPem": state.signer.public_key_pem(),
        "algorithm": "RSA-2048 / SHA-256 PKCS#1 v1.5",
    }))
}

async fn sign_direct_handler(
    State(state): State<AppState>,
    Json(command): Json<SignDirectCommand>,
) -> Response {
    match state.sign_direct.execute(command).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn verify_signature_handler(
    State(state): State<AppState>,
    Json(query): Json<VerifySignatureQuery>,
) -> Json<serde_json::Value> {
    let result = state.verify_signature.execute(query).await;
    Json(serde_json::to_value(result).unwrap_or_else(|_| json!({ "isValid": false })))
}

async fn validate_series_handler(
    State(state): State<AppState>,
    Json(query): Json<ValidateSeriesSequenceQuery>,
) -> Response {
    match state.validate_series.execute(query).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn list_tax_regimes_handler(State(state): State<AppState>) -> Response {
    match state.list_tax_regimes.execute().await {
        Ok(regimes) => Json(json!({ "regimes": regimes })).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn resolve_tax_regime_handler(
    State(state): State<AppState>,
    Json(command): Json<ResolveTaxRegimeCommand>,
) -> Response {
    match state.resolve_tax_regime.execute(command).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn get_tax_regime_handler(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
) -> Response {
    match state
        .get_tax_regime
        .execute(GetTaxRegimeQuery { tenant_id })
        .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn validate_exemption_code_handler(
    State(state): State<AppState>,
    Path((_tenant_id, code)): Path<(Uuid, String)>,
) -> Response {
    match state.validate_exemption_code.execute(&code).await {
        Ok(exists) => Json(json!({
            "code": code.trim().to_uppercase(),
            "exists": exists,
        }))
        .into_response(),
        Err(err) => domain_error(err),
    }
}

/// Tradução de erros de domínio para respostas HTTP (RFC 7807 nos erros internos)
fn domain_error(err: DomainError) -> Response {
    let body = match err {
        DomainError::InvalidArgument(message) => {
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": message }))).into_response();
        }
        DomainError::InvoiceNotFound => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Invoice not found." })),
            )
                .into_response();
        }
        other => {
            tracing::error!(error = %other, "Falha ao processar operação fiscal");
            problem_detail(
                "https://api.kudiba.ao/errors/internal",
                "Falha na Emissão Fiscal",
                StatusCode::INTERNAL_SERVER_ERROR,
                &other.to_string(),
                "FISCAL_ENGINE_ERROR",
            )
        }
    };

    (StatusCode::INTERNAL_SERVER_ERROR, Json(body)).into_response()
}

fn problem_detail(
    problem_type: &str,
    title: &str,
    status: StatusCode,
    detail: &str,
    code: &str,
) -> serde_json::Value {
    json!({
        "type": problem_type,
        "title": title,
        "status": status.as_u16(),
        "detail": detail,
        "code": code,
        "timestamp": Utc::now(),
    })
}
