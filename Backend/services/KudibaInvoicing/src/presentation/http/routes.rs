use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Datelike, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::application::commands::sync_agt::SyncAgtCommand;
use crate::application::dto::{
    CancelInvoiceCommand, CreateFiscalSeriesCommand, GetInvoiceQuery, GetTaxRegimeQuery,
    IssueInvoiceCommand, ResolveTaxRegimeCommand, SignDirectCommand, ValidateSeriesSequenceQuery,
    VerifySignatureQuery,
};
use crate::application::queries::export_saft::ExportSaftQuery;
use crate::application::queries::fiscal_reports::FiscalReportQuery;
use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::infrastructure::crypto::rsa_signer::generate_agt_keypair;
use crate::state::AppState;

/// Constrói o router REST interno do motor fiscal
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_handler))
        // REST: emissão e consulta/listagem de documentos fiscais
        .route(
            "/api/v1/invoices",
            post(issue_invoice_handler).get(list_invoices_handler),
        )
        .route(
            "/api/v1/fiscal/invoices",
            post(issue_invoice_handler).get(list_invoices_handler),
        )
        // REST: consulta de documento fiscal
        .route("/api/v1/invoices/{id}", get(get_invoice_handler))
        .route("/api/v1/fiscal/invoices/{id}", get(get_invoice_handler))
        // REST: anulação / estorno de documento fiscal via Nota de Crédito
        .route("/api/v1/invoices/{id}/cancel", post(cancel_invoice_handler))
        .route(
            "/api/v1/fiscal/invoices/{id}/cancel",
            post(cancel_invoice_handler),
        )
        // REST: renderização oficial do documento (PDF A4, Talão Térmico 80mm e QR Code AGT)
        .route("/api/v1/invoices/{id}/pdf", get(get_invoice_pdf_handler))
        .route(
            "/api/v1/fiscal/invoices/{id}/pdf",
            get(get_invoice_pdf_handler),
        )
        .route(
            "/api/v1/invoices/{id}/thermal",
            get(get_invoice_thermal_handler),
        )
        .route(
            "/api/v1/fiscal/invoices/{id}/thermal",
            get(get_invoice_thermal_handler),
        )
        .route("/api/v1/invoices/{id}/qr", get(get_invoice_qr_handler))
        .route(
            "/api/v1/fiscal/invoices/{id}/qr",
            get(get_invoice_qr_handler),
        )
        // REST: chave pública RSA para verificação independente das assinaturas
        .route("/api/v1/public-key", get(public_key_handler))
        .route("/api/v1/fiscal/public-key", get(public_key_handler))
        // REST: abertura explícita e listagem de séries fiscais
        .route(
            "/api/v1/fiscal/series",
            post(create_series_handler).get(list_series_handler),
        )
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
        // REST: Exportação mensal e validação XSD do SAF-T (AO) no schema oficial da AGT
        .route("/api/v1/fiscal/saft", get(export_saft_handler))
        .route("/api/v1/fiscal/saft/validate", post(validate_saft_handler))
        .route("/api/v1/fiscal/saft/jobs", post(trigger_saft_job_handler))
        .route("/api/v1/fiscal/saft/jobs/{id}", get(get_saft_job_handler))
        .route(
            "/api/v1/fiscal/saft/jobs/{id}/download",
            get(download_saft_job_handler),
        )
        .route("/api/v1/fiscal/reports/tax", get(fiscal_report_handler))
        .route(
            "/api/v1/fiscal/reports/tax/excel",
            get(fiscal_report_excel_handler),
        )
        .route(
            "/api/v1/fiscal/reports/tax/pdf",
            get(fiscal_report_pdf_handler),
        )
        // REST: Painel Executivo de Faturação (agregação do exercício)
        .route(
            "/api/v1/fiscal/dashboard/summary",
            get(dashboard_summary_handler),
        )
        // REST: Relatórios de Caixa e Memória Fiscal POS (Leitura X e Fecho Z)
        .route("/api/v1/fiscal/pos/reports/x", get(pos_leitura_x_handler))
        .route(
            "/api/v1/fiscal/pos/reports/x/thermal",
            get(pos_leitura_x_thermal_handler),
        )
        .route(
            "/api/v1/fiscal/pos/reports",
            get(pos_z_reports_history_handler),
        )
        .route("/api/v1/fiscal/pos/reports/z", post(pos_fecho_z_handler))
        .route(
            "/api/v1/fiscal/pos/reports/z/thermal",
            post(pos_fecho_z_thermal_handler),
        )
        // REST: Conector AGT (Heartbeat/Liveness e sincronização de lotes)
        .route("/api/v1/fiscal/agt/status", get(agt_status_handler))
        .route("/api/v1/fiscal/agt/sync", post(sync_agt_handler))
        // REST: Gestão de chaves criptográficas para certificação AGT
        .route("/api/v1/fiscal/keys/generate", post(generate_keys_handler))
        // REST: Parametrização cadastral e fiscal da empresa (Tenant)
        .route(
            "/api/v1/fiscal/tenant",
            get(get_fiscal_tenant_handler).put(upsert_fiscal_tenant_handler),
        )
        .merge(crate::presentation::http::swagger::router::<AppState>())
        .with_state(state)
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    #[cfg_attr(not(test), allow(dead_code))]
    fn status(&self) -> StatusCode {
        self.status
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

fn authorize_role(headers: &HeaderMap, allowed_roles: &[&str]) -> Result<(), ApiError> {
    authorized_tenant_id(headers, allowed_roles).map(|_| ())
}

async fn root_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "service": "KudibaInvoicing Engine & Fiscal Core",
        "version": state.config.service_version,
        "framework": "Rust (Axum + Tokio)",
        "rest": format!("REST on port {}", state.config.http_port),
        "grpc": format!("FiscalEngineService (kudiba.fiscal.v1) on port {}", state.config.grpc_port),
        "docs": "/swagger",
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
    headers: HeaderMap,
    Json(mut command): Json<IssueInvoiceCommand>,
) -> Response {
    let actor = match authorize_tenant(
        &headers,
        command.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(actor) => actor,
        Err(response) => return response.into_response(),
    };
    command.actor_user_id = Some(actor);

    match state.issue_invoice.execute(command).await {
        Ok(result) => (StatusCode::CREATED, Json(result)).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn create_series_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(command): Json<CreateFiscalSeriesCommand>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        command.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        return response.into_response();
    }

    match state.create_series.execute(command).await {
        Ok(series_id) => {
            (StatusCode::CREATED, Json(json!({ "seriesId": series_id }))).into_response()
        }
        Err(err) => domain_error(err),
    }
}

async fn list_series_handler(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };

    let rows = match sqlx::query(
        "SELECT id, tenant_id, document_type, series_code, fiscal_year, current_sequence, is_active \
         FROM kudiba_core.series_fiscais WHERE tenant_id = $1 \
         ORDER BY fiscal_year DESC, document_type ASC, series_code ASC"
    )
    .bind(tenant_id)
    .fetch_all(&state.pool)
    .await {
        Ok(rows) => rows,
        Err(err) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": err.to_string()}))).into_response(),
    };

    let list: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            use sqlx::Row;
            json!({
                "id": r.try_get::<Uuid, _>("id").unwrap_or_default(),
                "tenantId": r.try_get::<Uuid, _>("tenant_id").unwrap_or_default(),
                "documentType": r.try_get::<String, _>("document_type").unwrap_or_default(),
                "seriesCode": r.try_get::<String, _>("series_code").unwrap_or_default(),
                "fiscalYear": r.try_get::<i32, _>("fiscal_year").unwrap_or_default(),
                "currentSequence": r.try_get::<i64, _>("current_sequence").unwrap_or_default(),
                "isActive": r.try_get::<bool, _>("is_active").unwrap_or(true),
            })
        })
        .collect();

    Json(list).into_response()
}

#[derive(Debug, Deserialize)]
pub struct ListInvoicesParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    #[serde(rename = "fiscalYear")]
    pub fiscal_year: Option<i32>,
    #[serde(rename = "fiscalMonth")]
    pub fiscal_month: Option<u32>,
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

async fn list_invoices_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ListInvoicesParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let year = params.fiscal_year.unwrap_or_else(|| Utc::now().year());
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50).min(100);

    match state
        .get_invoice
        .list(tenant_id, year, params.fiscal_month, offset, limit)
        .await
    {
        Ok(invoices) => Json(invoices).into_response(),
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
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(params): Query<GetInvoiceParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let query = GetInvoiceQuery {
        invoice_id: Some(id),
        tenant_id: Some(tenant_id),
        document_number: None,
    };

    match state.get_invoice.execute(query).await {
        Ok(invoice) => Json(invoice).into_response(),
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct CancelInvoicePayload {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub reason: String,
    #[serde(rename = "seriesCode")]
    pub series_code: Option<String>,
}

async fn cancel_invoice_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(payload): Json<CancelInvoicePayload>,
) -> Response {
    let actor = match authorize_tenant(
        &headers,
        payload.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(actor) => actor,
        Err(response) => return response.into_response(),
    };

    let command = CancelInvoiceCommand {
        actor_user_id: Some(actor),
        tenant_id: payload.tenant_id,
        invoice_id: id,
        reason: payload.reason,
        series_code: payload.series_code,
    };

    match state.cancel_invoice.execute(command).await {
        Ok(result) => (StatusCode::CREATED, Json(result)).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn get_invoice_pdf_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(params): Query<GetInvoiceParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let query = GetInvoiceQuery {
        invoice_id: Some(id),
        tenant_id: Some(tenant_id),
        document_number: None,
    };

    let invoice = match state.get_invoice.execute(query).await {
        Ok(invoice) => invoice,
        Err(err) => return domain_error(err),
    };

    let tenant = load_tenant_by_id(&state.pool, tenant_id).await;
    let company_name = tenant
        .as_ref()
        .map(|t| t.company_name.as_str())
        .unwrap_or("Kudiba ERP");
    let software_cert = tenant
        .as_ref()
        .and_then(|t| t.agt_cert_number.as_deref())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(&state.config.agt_software_cert);

    match crate::infrastructure::reports::InvoicePdfGenerator::generate_pdf_with_tenant(
        &invoice,
        tenant.as_ref(),
        company_name,
        software_cert,
    ) {
        Ok(bytes) => {
            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("application/pdf"),
            );
            let filename = format!("{}.pdf", invoice.document_number.replace(['/', ' '], "_"));
            if let Ok(disp) = HeaderValue::from_str(&format!("inline; filename=\"{filename}\"")) {
                resp_headers.insert(axum::http::header::CONTENT_DISPOSITION, disp);
            }
            (StatusCode::OK, resp_headers, bytes).into_response()
        }
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct ThermalParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub format: Option<String>,
}

async fn get_invoice_thermal_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(params): Query<ThermalParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let query = GetInvoiceQuery {
        invoice_id: Some(id),
        tenant_id: Some(tenant_id),
        document_number: None,
    };

    let invoice = match state.get_invoice.execute(query).await {
        Ok(invoice) => invoice,
        Err(err) => return domain_error(err),
    };

    let tenant = load_tenant_by_id(&state.pool, tenant_id).await;
    let company_name = tenant
        .as_ref()
        .and_then(|t| t.trade_name.as_deref())
        .filter(|s| !s.trim().is_empty())
        .or_else(|| tenant.as_ref().map(|t| t.company_name.as_str()))
        .unwrap_or("Kudiba ERP");
    let software_cert = tenant
        .as_ref()
        .and_then(|t| t.agt_cert_number.as_deref())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(&state.config.agt_software_cert);
    let requested_format = params.format.as_deref().unwrap_or("pdf").to_lowercase();

    if requested_format == "text" || requested_format == "txt" {
        match crate::infrastructure::reports::InvoiceThermalGenerator::generate_text(
            &invoice,
            company_name,
            software_cert,
        ) {
            Ok(text) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("text/plain; charset=utf-8"),
                );
                (StatusCode::OK, resp_headers, text).into_response()
            }
            Err(err) => domain_error(err),
        }
    } else {
        match crate::infrastructure::reports::InvoiceThermalGenerator::generate_pdf(
            &invoice,
            company_name,
            software_cert,
        ) {
            Ok(bytes) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/pdf"),
                );
                let filename = format!(
                    "TALAO_{}.pdf",
                    invoice.document_number.replace(['/', ' '], "_")
                );
                if let Ok(disp) = HeaderValue::from_str(&format!("inline; filename=\"{filename}\""))
                {
                    resp_headers.insert(axum::http::header::CONTENT_DISPOSITION, disp);
                }
                (StatusCode::OK, resp_headers, bytes).into_response()
            }
            Err(err) => domain_error(err),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct QrParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub format: Option<String>,
}

async fn get_invoice_qr_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Query(params): Query<QrParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let query = GetInvoiceQuery {
        invoice_id: Some(id),
        tenant_id: Some(tenant_id),
        document_number: None,
    };

    let invoice = match state.get_invoice.execute(query).await {
        Ok(invoice) => invoice,
        Err(err) => return domain_error(err),
    };

    let payload = crate::domain::services::fiscal_qr::AgtQrCodeService::build_payload(
        &invoice,
        &state.config.agt_software_cert,
    );

    let requested_format = params.format.as_deref().unwrap_or("json").to_lowercase();
    if requested_format == "svg" {
        match crate::domain::services::fiscal_qr::AgtQrCodeService::generate_svg(&payload, 4) {
            Ok(svg) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("image/svg+xml"),
                );
                (StatusCode::OK, resp_headers, svg).into_response()
            }
            Err(err) => domain_error(err),
        }
    } else if requested_format == "ascii" || requested_format == "txt" {
        match crate::domain::services::fiscal_qr::AgtQrCodeService::generate_ascii(&payload) {
            Ok(ascii) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("text/plain; charset=utf-8"),
                );
                (StatusCode::OK, resp_headers, ascii).into_response()
            }
            Err(err) => domain_error(err),
        }
    } else {
        let svg =
            crate::domain::services::fiscal_qr::AgtQrCodeService::generate_svg(&payload, 4).ok();
        (
            StatusCode::OK,
            Json(json!({
                "documentNumber": invoice.document_number,
                "validationChars": invoice.validation_chars,
                "softwareCert": state.config.agt_software_cert,
                "qrPayload": payload,
                "svg": svg,
            })),
        )
            .into_response()
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
    headers: HeaderMap,
    Json(command): Json<SignDirectCommand>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        command.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        return response.into_response();
    }

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
    headers: HeaderMap,
    Json(query): Json<ValidateSeriesSequenceQuery>,
) -> Response {
    let requested_tenant = match Uuid::parse_str(&query.tenant_id) {
        Ok(tenant_id) => tenant_id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "tenantId inválido." })),
            )
                .into_response()
        }
    };
    if let Err(response) = authorize_tenant(
        &headers,
        requested_tenant,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        return response.into_response();
    }

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
    headers: HeaderMap,
    Json(command): Json<ResolveTaxRegimeCommand>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        command.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match state.resolve_tax_regime.execute(command).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn get_tax_regime_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(tenant_id): Path<Uuid>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

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
    headers: HeaderMap,
    Path((_tenant_id, code)): Path<(Uuid, String)>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        _tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        return response.into_response();
    }

    match state.validate_exemption_code.execute(&code).await {
        Ok(exists) => Json(json!({
            "code": code.trim().to_uppercase(),
            "exists": exists,
        }))
        .into_response(),
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct SaftQueryParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub year: i32,
    pub month: Option<u32>,
}

async fn export_saft_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<SaftQueryParams>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        params.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    let query = ExportSaftQuery {
        tenant_id: params.tenant_id,
        fiscal_year: params.year,
        fiscal_month: params.month,
    };

    match state.export_saft.execute(query).await {
        Ok(result) => {
            let mut headers = axum::http::HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                axum::http::HeaderValue::from_static("application/xml; charset=utf-8"),
            );
            if let Ok(disposition) = axum::http::HeaderValue::from_str(&format!(
                "attachment; filename=\"{}\"",
                result.filename
            )) {
                headers.insert(axum::http::header::CONTENT_DISPOSITION, disposition);
            }
            (StatusCode::OK, headers, result.xml_content).into_response()
        }
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct ValidateSaftPayload {
    pub xml_content: String,
}

async fn validate_saft_handler(
    headers: HeaderMap,
    Json(payload): Json<ValidateSaftPayload>,
) -> Response {
    if let Err(response) = authorize_role(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match crate::infrastructure::saft::SaftValidator::validate_xml(&payload.xml_content) {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({
                "valid": true,
                "schema": "AO_1.01_01",
                "message": "Ficheiro SAF-T (AO) estritamente válido segundo o schema oficial XSD da AGT."
            })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "valid": false,
                "schema": "AO_1.01_01",
                "error": err.to_string()
            })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct TriggerSaftJobPayload {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    #[serde(rename = "fiscalYear")]
    pub fiscal_year: i32,
    #[serde(rename = "fiscalMonth")]
    pub fiscal_month: Option<u32>,
}

async fn trigger_saft_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TriggerSaftJobPayload>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        payload.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    let job_id =
        state
            .saft_jobs
            .enqueue(payload.tenant_id, payload.fiscal_year, payload.fiscal_month);

    let query = ExportSaftQuery {
        tenant_id: payload.tenant_id,
        fiscal_year: payload.fiscal_year,
        fiscal_month: payload.fiscal_month,
    };

    let export_saft = state.export_saft.clone();
    let saft_jobs = state.saft_jobs.clone();
    let job_id_cloned = job_id.clone();

    tokio::spawn(async move {
        saft_jobs.mark_processing(&job_id_cloned);
        match export_saft.execute(query).await {
            Ok(res) => {
                saft_jobs.mark_completed(
                    &job_id_cloned,
                    res.filename,
                    res.invoice_count,
                    res.total_gross,
                    res.xml_content,
                );
            }
            Err(err) => {
                saft_jobs.mark_failed(&job_id_cloned, err.to_string());
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "jobId": job_id,
            "status": "QUEUED",
            "estimatedTime": "30s"
        })),
    )
        .into_response()
}

async fn get_saft_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Response {
    let job = match state.saft_jobs.get_job(&job_id) {
        Some(job) => job,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Trabalho SAF-T não encontrado." })),
            )
                .into_response()
        }
    };

    if let Err(response) = authorize_tenant(
        &headers,
        job.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    Json(job).into_response()
}

async fn download_saft_job_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Response {
    let job = match state.saft_jobs.get_job(&job_id) {
        Some(job) => job,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Trabalho SAF-T não encontrado." })),
            )
                .into_response()
        }
    };

    if let Err(response) = authorize_tenant(
        &headers,
        job.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    if job.status == "PROCESSING" || job.status == "QUEUED" {
        return (
            StatusCode::ACCEPTED,
            Json(json!({
                "jobId": job.job_id,
                "status": job.status,
                "message": "O ficheiro SAF-T ainda se encontra em processamento."
            })),
        )
            .into_response();
    }

    if job.status == "FAILED" {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "jobId": job.job_id,
                "status": "FAILED",
                "error": job.error.unwrap_or_else(|| "Erro desconhecido durante a exportação SAF-T.".to_string())
            })),
        )
            .into_response();
    }

    let xml = match job.xml_content {
        Some(xml) => xml,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Conteúdo XML indisponível." })),
            )
                .into_response()
        }
    };

    let filename = job
        .filename
        .unwrap_or_else(|| format!("SAFT_AO_{}.xml", job.job_id));
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/xml; charset=utf-8"),
    );
    if let Ok(disposition) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
    {
        resp_headers.insert(axum::http::header::CONTENT_DISPOSITION, disposition);
    }

    (StatusCode::OK, resp_headers, xml).into_response()
}

#[derive(Debug, Deserialize)]
pub struct FiscalReportQueryParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Uuid,
    pub year: i32,
    pub month: Option<u32>,
    pub format: Option<String>,
}

async fn fiscal_report_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<FiscalReportQueryParams>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        params.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match state
        .fiscal_reports
        .execute(FiscalReportQuery {
            tenant_id: params.tenant_id,
            fiscal_year: params.year,
            fiscal_month: params.month,
        })
        .await
    {
        Ok(report) => {
            let requested_format = params
                .format
                .as_deref()
                .map(|s| s.to_lowercase())
                .unwrap_or_else(|| {
                    if let Some(accept) = headers
                        .get(axum::http::header::ACCEPT)
                        .and_then(|v| v.to_str().ok())
                    {
                        if accept.contains("application/pdf") {
                            "pdf".to_string()
                        } else if accept.contains("spreadsheet") || accept.contains("excel") {
                            "xlsx".to_string()
                        } else {
                            "json".to_string()
                        }
                    } else {
                        "json".to_string()
                    }
                });

            if requested_format == "xlsx" || requested_format == "excel" {
                build_excel_report_response(&report)
            } else if requested_format == "pdf" {
                build_pdf_report_response(&report)
            } else {
                Json(report).into_response()
            }
        }
        Err(err) => domain_error(err),
    }
}

async fn fiscal_report_excel_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<FiscalReportQueryParams>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        params.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match state
        .fiscal_reports
        .execute(FiscalReportQuery {
            tenant_id: params.tenant_id,
            fiscal_year: params.year,
            fiscal_month: params.month,
        })
        .await
    {
        Ok(report) => build_excel_report_response(&report),
        Err(err) => domain_error(err),
    }
}

async fn fiscal_report_pdf_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<FiscalReportQueryParams>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        params.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match state
        .fiscal_reports
        .execute(FiscalReportQuery {
            tenant_id: params.tenant_id,
            fiscal_year: params.year,
            fiscal_month: params.month,
        })
        .await
    {
        Ok(report) => build_pdf_report_response(&report),
        Err(err) => domain_error(err),
    }
}

fn build_excel_report_response(
    report: &crate::application::queries::fiscal_reports::FiscalReportResult,
) -> Response {
    match crate::infrastructure::reports::TaxExcelReportGenerator::generate_xlsx(report) {
        Ok(bytes) => {
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            );
            let filename = match report.fiscal_month {
                Some(m) => format!("MAPA_FISCAL_IVA_{}_{:02}.xlsx", report.fiscal_year, m),
                None => format!("MAPA_FISCAL_IVA_{}_ANUAL.xlsx", report.fiscal_year),
            };
            if let Ok(disp) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            {
                headers.insert(axum::http::header::CONTENT_DISPOSITION, disp);
            }
            (StatusCode::OK, headers, bytes).into_response()
        }
        Err(err) => domain_error(err),
    }
}

fn build_pdf_report_response(
    report: &crate::application::queries::fiscal_reports::FiscalReportResult,
) -> Response {
    match crate::infrastructure::reports::TaxPdfReportGenerator::generate_pdf(report) {
        Ok(bytes) => {
            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("application/pdf"),
            );
            let filename = match report.fiscal_month {
                Some(m) => format!("MAPA_FISCAL_IVA_{}_{:02}.pdf", report.fiscal_year, m),
                None => format!("MAPA_FISCAL_IVA_{}_ANUAL.pdf", report.fiscal_year),
            };
            if let Ok(disp) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            {
                headers.insert(axum::http::header::CONTENT_DISPOSITION, disp);
            }
            (StatusCode::OK, headers, bytes).into_response()
        }
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct DashboardSummaryQueryParams {
    pub year: Option<i32>,
}

async fn dashboard_summary_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<DashboardSummaryQueryParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };

    let year = params
        .year
        .unwrap_or_else(|| Utc::now().year());
    let query = crate::application::queries::dashboard_summary::DashboardSummaryQuery {
        tenant_id,
        year,
    };

    match state.dashboard_summary.execute(query).await {
        Ok(summary) => Json(summary).into_response(),
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct PosReportQueryParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub date: Option<chrono::NaiveDate>,
    #[serde(rename = "posTerminalId", alias = "seriesCode")]
    pub pos_terminal_id: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseZReportPayload {
    pub tenant_id: Option<Uuid>,
    pub fiscal_year: Option<i32>,
    pub date: Option<chrono::NaiveDate>,
    #[serde(alias = "seriesCode")]
    pub pos_terminal_id: Option<String>,
    pub format: Option<String>,
}

async fn pos_leitura_x_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PosReportQueryParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_CAIXA",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let query = crate::application::queries::pos_reports::PosDailyReportQuery {
        tenant_id,
        date,
        pos_terminal_id: params.pos_terminal_id,
    };

    match state.pos_reports.execute_leitura_x(query).await {
        Ok(report) => Json(report).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn pos_leitura_x_thermal_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PosReportQueryParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_CAIXA",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let query = crate::application::queries::pos_reports::PosDailyReportQuery {
        tenant_id,
        date,
        pos_terminal_id: params.pos_terminal_id,
    };

    let report = match state.pos_reports.execute_leitura_x(query).await {
        Ok(r) => r,
        Err(err) => return domain_error(err),
    };

    let requested_format = params.format.as_deref().unwrap_or("pdf").to_lowercase();
    if requested_format == "text" || requested_format == "txt" {
        let text = crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_text(
            &report,
        );
        let mut resp_headers = HeaderMap::new();
        resp_headers.insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        (StatusCode::OK, resp_headers, text).into_response()
    } else {
        match crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_pdf(
            &report,
        ) {
            Ok(pdf) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/pdf"),
                );
                (StatusCode::OK, resp_headers, pdf).into_response()
            }
            Err(err) => domain_error(err),
        }
    }
}

async fn pos_z_reports_history_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<PosReportQueryParams>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_CAIXA",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let query = crate::application::queries::pos_reports::ZReportListQuery {
        tenant_id,
        from: None,
        to: params.date,
        pos_terminal_id: params.pos_terminal_id,
        limit: None,
    };

    match state.pos_reports.execute_list_z_reports(query).await {
        Ok(reports) => Json(reports).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn pos_fecho_z_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CloseZReportPayload>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };
    if payload
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let date = payload
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let fiscal_year = payload
        .fiscal_year
        .unwrap_or_else(|| chrono::Datelike::year(&date));
    let actor_user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let command = crate::application::queries::pos_reports::CloseZReportCommand {
        actor_user_id,
        tenant_id,
        fiscal_year,
        date,
        pos_terminal_id: payload.pos_terminal_id,
    };

    match state.pos_reports.execute_fecho_z(command).await {
        Ok(report) => (StatusCode::CREATED, Json(report)).into_response(),
        Err(err) => domain_error(err),
    }
}

async fn pos_fecho_z_thermal_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CloseZReportPayload>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp.into_response(),
    };
    if payload
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant().into_response();
    }

    let date = payload
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let fiscal_year = payload
        .fiscal_year
        .unwrap_or_else(|| chrono::Datelike::year(&date));
    let actor_user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let command = crate::application::queries::pos_reports::CloseZReportCommand {
        actor_user_id,
        tenant_id,
        fiscal_year,
        date,
        pos_terminal_id: payload.pos_terminal_id,
    };

    let report = match state.pos_reports.execute_fecho_z(command).await {
        Ok(r) => r,
        Err(err) => return domain_error(err),
    };

    let requested_format = payload.format.as_deref().unwrap_or("pdf").to_lowercase();
    if requested_format == "text" || requested_format == "txt" {
        let text = crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_text(
            &report,
        );
        let mut resp_headers = HeaderMap::new();
        resp_headers.insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        (StatusCode::CREATED, resp_headers, text).into_response()
    } else {
        match crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_pdf(
            &report,
        ) {
            Ok(pdf) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/pdf"),
                );
                (StatusCode::CREATED, resp_headers, pdf).into_response()
            }
            Err(err) => domain_error(err),
        }
    }
}

async fn agt_status_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let status = state.agt_client.check_heartbeat().await;
    Json(serde_json::to_value(status).unwrap_or_else(|_| json!({ "isOnline": false })))
}

async fn sync_agt_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(command): Json<SyncAgtCommand>,
) -> Response {
    if let Err(response) = authorize_tenant(
        &headers,
        command.tenant_id,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
        ],
    ) {
        return response.into_response();
    }

    match state.sync_agt.execute(command).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(err) => domain_error(err),
    }
}

#[allow(dead_code)]
fn compute_gateway_signature(secret: &[u8], payload: &str) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret);
    let tag = ring::hmac::sign(&key, payload.as_bytes());
    tag.as_ref()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

#[allow(dead_code)]
fn verify_internal_gateway_signature(
    headers: &HeaderMap,
    method: &str,
    uri_path: &str,
    secret: &str,
    enforce: bool,
) -> Result<(), ApiError> {
    let sig_opt = headers
        .get("X-Gateway-Signature")
        .and_then(|v| v.to_str().ok());
    let ts_opt = headers
        .get("X-Gateway-Timestamp")
        .and_then(|v| v.to_str().ok());

    if let (Some(sig), Some(ts)) = (sig_opt, ts_opt) {
        let timestamp = ts.parse::<i64>().map_err(|_| {
            ApiError::new(
                StatusCode::UNAUTHORIZED,
                "Timestamp perimétrico do Gateway inválido.",
            )
        })?;
        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > 300 {
            return Err(ApiError::new(
                StatusCode::UNAUTHORIZED,
                "Timestamp perimétrico do Gateway expirado ou desincronizado.",
            ));
        }

        let canonical = format!("{}:{}:{}", ts, method, uri_path);
        let expected = compute_gateway_signature(secret.as_bytes(), &canonical);
        if sig != expected {
            return Err(ApiError::new(
                StatusCode::UNAUTHORIZED,
                "Assinatura perimétrica do Gateway inválida.",
            ));
        }
    } else if enforce {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Assinatura perimétrica do Gateway ausente.",
        ));
    }

    Ok(())
}

fn authorized_tenant_id(headers: &HeaderMap, allowed_roles: &[&str]) -> Result<Uuid, ApiError> {
    let tenant = headers
        .get("X-Resolved-Tenant-ID")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or_else(unauthorized_identity)?;
    let actor_present = headers
        .get("X-Resolved-User-ID")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| !value.trim().is_empty());
    let roles = headers
        .get("X-Resolved-Roles")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .map(str::to_ascii_uppercase)
        .collect::<Vec<_>>();

    if !actor_present
        || !roles
            .iter()
            .any(|role| allowed_roles.contains(&role.as_str()))
    {
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "O utilizador não tem perfil autorizado para esta operação fiscal.",
        ));
    }
    Ok(tenant)
}

fn authorize_tenant(
    headers: &HeaderMap,
    requested_tenant: Uuid,
    allowed_roles: &[&str],
) -> Result<String, ApiError> {
    let tenant_id = authorized_tenant_id(headers, allowed_roles)?;
    if tenant_id != requested_tenant {
        return Err(forbidden_tenant());
    }
    Ok(headers
        .get("X-Resolved-User-ID")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string())
}

fn unauthorized_identity() -> ApiError {
    ApiError::new(
        StatusCode::UNAUTHORIZED,
        "Contexto de utilizador e empresa autenticado é obrigatório.",
    )
}

fn forbidden_tenant() -> ApiError {
    ApiError::new(
        StatusCode::FORBIDDEN,
        "A empresa solicitada não corresponde à empresa autenticada.",
    )
}

async fn generate_keys_handler(headers: HeaderMap) -> Response {
    if let Err(response) = authorize_role(&headers, &["ADMIN", "ADMINISTRADOR"]) {
        return response.into_response();
    }

    match generate_agt_keypair() {
        Ok(keypair) => (
            StatusCode::CREATED,
            Json(json!({
                "keySizeBits": keypair.key_size_bits,
                "privateKeyPem": keypair.private_key_pem,
                "publicKeyPem": keypair.public_key_pem,
                "instructions": "Guarde a chave privada no servidor em AGT_RSA_PRIVATE_KEY_PATH e submeta a chave pública no portal da AGT para certificação de software fiscal."
            })),
        )
            .into_response(),
        Err(err) => domain_error(err),
    }
}

async fn load_tenant_by_id(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Option<crate::domain::entities::tenant::Tenant> {
    let sql = "SELECT id, slug, company_name, trade_name, nif, address_detail, city, province, postal_code, country, \
               phone, email, website, commercial_registry, share_capital, currency, tax_office_code, \
               agt_cert_number, invoice_footer_notes, bank_accounts, status, tax_regime_code, contingency_started_at \
               FROM kudiba_core.tenants WHERE id = $1";
    let row = sqlx::query(sql).bind(tenant_id).fetch_optional(pool).await.ok()??;
    crate::infrastructure::persistence::tenant_repository::PgTenantRepository::map_row(&row).ok()
}

async fn get_fiscal_tenant_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &[
            "ADMIN",
            "ADMINISTRADOR",
            "GESTOR",
            "CONTABILISTA",
            "ACCOUNTANT",
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
            "OPERADOR_CAIXA",
        ],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };

    match load_tenant_by_id(&state.pool, tenant_id).await {
        Some(tenant) => (StatusCode::OK, Json(tenant)).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Tenant não encontrado na base fiscal." })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertFiscalTenantRequest {
    #[serde(alias = "slug")]
    pub slug: Option<String>,
    #[serde(alias = "company_name")]
    pub company_name: String,
    #[serde(alias = "trade_name")]
    pub trade_name: Option<String>,
    pub nif: String,
    #[serde(alias = "address_detail")]
    pub address_detail: Option<String>,
    pub city: Option<String>,
    pub province: Option<String>,
    #[serde(alias = "postal_code")]
    pub postal_code: Option<String>,
    pub country: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    #[serde(alias = "logo_data_url")]
    pub logo_data_url: Option<String>,
    #[serde(alias = "commercial_registry")]
    pub commercial_registry: Option<String>,
    #[serde(alias = "share_capital")]
    pub share_capital: Option<String>,
    pub currency: Option<String>,
    #[serde(alias = "tax_regime_code")]
    pub tax_regime_code: Option<String>,
    #[serde(alias = "tax_office_code")]
    pub tax_office_code: Option<String>,
    #[serde(alias = "agt_cert_number")]
    pub agt_cert_number: Option<String>,
    #[serde(alias = "default_withholding_rate")]
    pub default_withholding_rate: Option<f64>,
    #[serde(alias = "invoice_footer_notes")]
    pub invoice_footer_notes: Option<String>,
    #[serde(alias = "bank_accounts")]
    pub bank_accounts: Option<serde_json::Value>,
    #[serde(alias = "onboarding_completed")]
    pub onboarding_completed: Option<bool>,
}

async fn upsert_fiscal_tenant_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpsertFiscalTenantRequest>,
) -> Response {
    let tenant_id = match authorized_tenant_id(
        &headers,
        &["ADMIN", "ADMINISTRADOR", "GESTOR", "CONTABILISTA"],
    ) {
        Ok(tenant_id) => tenant_id,
        Err(response) => return response.into_response(),
    };

    let slug = payload
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("tenant-{}", &tenant_id.to_string()[..8]));
    let country = payload
        .country
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("AO")
        .to_string();
    let currency = payload
        .currency
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("AOA")
        .to_string();
    let tax_regime_code = payload
        .tax_regime_code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("REGIME_GERAL")
        .to_string();
    let withholding_rate = payload.default_withholding_rate.unwrap_or(6.5);
    let bank_accounts = payload
        .bank_accounts
        .unwrap_or_else(|| json!([]))
        .to_string();
    let onboarding_completed = payload.onboarding_completed.unwrap_or(true);

    let sql = r#"
        INSERT INTO kudiba_core.tenants (
            id, slug, company_name, trade_name, nif,
            address_detail, city, province, postal_code, country,
            phone, email, website, logo_data_url,
            commercial_registry, share_capital, currency,
            tax_regime_code, tax_office_code, agt_cert_number,
            default_withholding_rate, invoice_footer_notes, bank_accounts,
            onboarding_completed, status
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20,
            $21, $22, $23::jsonb,
            $24, 'ACTIVE'
        )
        ON CONFLICT (id) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            trade_name = EXCLUDED.trade_name,
            nif = EXCLUDED.nif,
            address_detail = EXCLUDED.address_detail,
            city = EXCLUDED.city,
            province = EXCLUDED.province,
            postal_code = EXCLUDED.postal_code,
            country = EXCLUDED.country,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            website = EXCLUDED.website,
            logo_data_url = COALESCE(EXCLUDED.logo_data_url, kudiba_core.tenants.logo_data_url),
            commercial_registry = EXCLUDED.commercial_registry,
            share_capital = EXCLUDED.share_capital,
            currency = EXCLUDED.currency,
            tax_regime_code = EXCLUDED.tax_regime_code,
            tax_office_code = EXCLUDED.tax_office_code,
            agt_cert_number = EXCLUDED.agt_cert_number,
            default_withholding_rate = EXCLUDED.default_withholding_rate,
            invoice_footer_notes = EXCLUDED.invoice_footer_notes,
            bank_accounts = EXCLUDED.bank_accounts,
            onboarding_completed = EXCLUDED.onboarding_completed,
            updated_at = NOW()
    "#;

    let res = sqlx::query(sql)
        .bind(tenant_id)
        .bind(&slug)
        .bind(payload.company_name.trim())
        .bind(payload.trade_name.as_deref().map(str::trim))
        .bind(payload.nif.trim())
        .bind(payload.address_detail.as_deref().map(str::trim))
        .bind(payload.city.as_deref().map(str::trim))
        .bind(payload.province.as_deref().map(str::trim))
        .bind(payload.postal_code.as_deref().map(str::trim))
        .bind(&country)
        .bind(payload.phone.as_deref().map(str::trim))
        .bind(payload.email.as_deref().map(str::trim))
        .bind(payload.website.as_deref().map(str::trim))
        .bind(payload.logo_data_url.as_deref())
        .bind(payload.commercial_registry.as_deref().map(str::trim))
        .bind(payload.share_capital.as_deref().map(str::trim))
        .bind(&currency)
        .bind(&tax_regime_code)
        .bind(payload.tax_office_code.as_deref().map(str::trim))
        .bind(payload.agt_cert_number.as_deref().map(str::trim))
        .bind(withholding_rate)
        .bind(payload.invoice_footer_notes.as_deref().map(str::trim))
        .bind(&bank_accounts)
        .bind(onboarding_completed)
        .execute(&state.pool)
        .await;

    match res {
        Ok(_) => match load_tenant_by_id(&state.pool, tenant_id).await {
            Some(tenant) => (StatusCode::OK, Json(tenant)).into_response(),
            None => (StatusCode::OK, Json(json!({ "status": "updated" }))).into_response(),
        },
        Err(err) => domain_error(DomainError::invalid(format!(
            "Falha ao sincronizar dados fiscais da empresa: {err}"
        ))),
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

#[cfg(test)]
mod authorization_tests {
    use super::*;

    #[test]
    fn exige_tenant_utilizador_e_perfil_permitido() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Resolved-Tenant-ID",
            "a0000000-0000-0000-0000-000000000001".parse().unwrap(),
        );
        headers.insert("X-Resolved-User-ID", "user-1".parse().unwrap());
        headers.insert("X-Resolved-Roles", "CONTABILISTA".parse().unwrap());

        assert_eq!(
            authorized_tenant_id(&headers, &["CONTABILISTA"]).unwrap(),
            Uuid::parse_str("a0000000-0000-0000-0000-000000000001").unwrap()
        );
        assert!(authorized_tenant_id(&headers, &["OPERADOR_FACTURACAO"]).is_err());
    }

    #[test]
    fn nega_tenant_ausente_ou_malformado() {
        let headers = HeaderMap::new();
        assert!(authorized_tenant_id(&headers, &["ADMIN"]).is_err());

        let mut headers = HeaderMap::new();
        headers.insert("X-Resolved-Tenant-ID", "not-a-uuid".parse().unwrap());
        headers.insert("X-Resolved-User-ID", "user-1".parse().unwrap());
        headers.insert("X-Resolved-Roles", "ADMIN".parse().unwrap());
        assert!(authorized_tenant_id(&headers, &["ADMIN"]).is_err());
    }

    #[test]
    fn impede_consulta_de_outra_empresa() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Resolved-Tenant-ID",
            "a0000000-0000-0000-0000-000000000001".parse().unwrap(),
        );
        headers.insert("X-Resolved-User-ID", "user-1".parse().unwrap());
        headers.insert("X-Resolved-Roles", "CONTABILISTA".parse().unwrap());

        let response = authorize_tenant(
            &headers,
            Uuid::parse_str("a0000000-0000-0000-0000-000000000002").unwrap(),
            &["CONTABILISTA"],
        )
        .unwrap_err();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn valida_assinatura_perimetrica_com_sucesso() {
        let secret = "test_internal_gateway_secret_123456";
        let now = chrono::Utc::now().timestamp().to_string();
        let method = "POST";
        let path = "/api/v1/invoices";
        let canonical = format!("{}:{}:{}", now, method, path);
        let signature = compute_gateway_signature(secret.as_bytes(), &canonical);

        let mut headers = HeaderMap::new();
        headers.insert("X-Gateway-Timestamp", now.parse().unwrap());
        headers.insert("X-Gateway-Signature", signature.parse().unwrap());

        assert!(verify_internal_gateway_signature(&headers, method, path, secret, true).is_ok());
    }

    #[test]
    fn rejeita_assinatura_perimetrica_invalida_ou_expirada() {
        let secret = "test_internal_gateway_secret_123456";
        let now = chrono::Utc::now().timestamp().to_string();
        let method = "POST";
        let path = "/api/v1/invoices";

        let mut headers = HeaderMap::new();
        headers.insert("X-Gateway-Timestamp", now.parse().unwrap());
        headers.insert("X-Gateway-Signature", "invalid_signature".parse().unwrap());

        let err =
            verify_internal_gateway_signature(&headers, method, path, secret, true).unwrap_err();
        assert_eq!(err.status(), StatusCode::UNAUTHORIZED);

        // Expirado (mais de 300 segundos atrás)
        let expired = (chrono::Utc::now().timestamp() - 600).to_string();
        let canonical = format!("{}:{}:{}", expired, method, path);
        let signature = compute_gateway_signature(secret.as_bytes(), &canonical);

        let mut exp_headers = HeaderMap::new();
        exp_headers.insert("X-Gateway-Timestamp", expired.parse().unwrap());
        exp_headers.insert("X-Gateway-Signature", signature.parse().unwrap());

        let err_exp = verify_internal_gateway_signature(&exp_headers, method, path, secret, true)
            .unwrap_err();
        assert_eq!(err_exp.status(), StatusCode::UNAUTHORIZED);
    }
}
