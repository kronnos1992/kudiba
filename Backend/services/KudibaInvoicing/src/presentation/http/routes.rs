use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
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
        // REST: emissão de documento fiscal (rota directa e rota encaminhada pelo Gateway)
        .route("/api/v1/invoices", post(issue_invoice_handler))
        .route("/api/v1/fiscal/invoices", post(issue_invoice_handler))
        // REST: consulta de documento fiscal
        .route("/api/v1/invoices/{id}", get(get_invoice_handler))
        .route("/api/v1/fiscal/invoices/{id}", get(get_invoice_handler))
        // REST: anulação / estorno de documento fiscal via Nota de Crédito
        .route("/api/v1/invoices/{id}/cancel", post(cancel_invoice_handler))
        .route("/api/v1/fiscal/invoices/{id}/cancel", post(cancel_invoice_handler))
        // REST: renderização oficial do documento (PDF A4, Talão Térmico 80mm e QR Code AGT)
        .route("/api/v1/invoices/{id}/pdf", get(get_invoice_pdf_handler))
        .route("/api/v1/fiscal/invoices/{id}/pdf", get(get_invoice_pdf_handler))
        .route("/api/v1/invoices/{id}/thermal", get(get_invoice_thermal_handler))
        .route("/api/v1/fiscal/invoices/{id}/thermal", get(get_invoice_thermal_handler))
        .route("/api/v1/invoices/{id}/qr", get(get_invoice_qr_handler))
        .route("/api/v1/fiscal/invoices/{id}/qr", get(get_invoice_qr_handler))
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
        // REST: Exportação mensal e validação XSD do SAF-T (AO) no schema oficial da AGT
        .route("/api/v1/fiscal/saft", get(export_saft_handler))
        .route("/api/v1/fiscal/saft/validate", post(validate_saft_handler))
        .route("/api/v1/fiscal/saft/jobs", post(trigger_saft_job_handler))
        .route("/api/v1/fiscal/saft/jobs/{id}", get(get_saft_job_handler))
        .route("/api/v1/fiscal/saft/jobs/{id}/download", get(download_saft_job_handler))
        .route("/api/v1/fiscal/reports/tax", get(fiscal_report_handler))
        .route("/api/v1/fiscal/reports/tax/excel", get(fiscal_report_excel_handler))
        .route("/api/v1/fiscal/reports/tax/pdf", get(fiscal_report_pdf_handler))
        // REST: Relatórios de Caixa e Memória Fiscal POS (Leitura X e Fecho Z)
        .route("/api/v1/fiscal/pos/reports/x", get(pos_leitura_x_handler))
        .route("/api/v1/fiscal/pos/reports/x/thermal", get(pos_leitura_x_thermal_handler))
        .route("/api/v1/fiscal/pos/reports/z", post(pos_fecho_z_handler))
        .route("/api/v1/fiscal/pos/reports/z/thermal", post(pos_fecho_z_thermal_handler))
        // REST: Conector AGT (Heartbeat/Liveness e sincronização de lotes)
        .route("/api/v1/fiscal/agt/status", get(agt_status_handler))
        .route("/api/v1/fiscal/agt/sync", post(sync_agt_handler))
        // REST: Gestão de chaves criptográficas para certificação AGT
        .route("/api/v1/fiscal/keys/generate", post(generate_keys_handler))
        .merge(crate::presentation::http::scalar::router::<AppState>())
        .with_state(state)
}

fn authorize_role(headers: &HeaderMap, allowed_roles: &[&str]) -> Result<(), Response> {
    authorized_tenant_id(headers, allowed_roles).map(|_| ())
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
        Err(response) => return response,
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
        return response;
    }

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
        Err(response) => return response,
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant();
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
        Err(response) => return response,
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
        Err(response) => return response,
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant();
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

    let company_name = "Kudiba ERP";
    match crate::infrastructure::reports::InvoicePdfGenerator::generate_pdf(
        &invoice,
        company_name,
        &state.config.agt_software_cert,
    ) {
        Ok(bytes) => {
            let mut resp_headers = HeaderMap::new();
            resp_headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_static("application/pdf"),
            );
            let filename = format!(
                "{}.pdf",
                invoice.document_number.replace('/', "_").replace(' ', "_")
            );
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
        Err(response) => return response,
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant();
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

    let company_name = "Kudiba ERP";
    let requested_format = params.format.as_deref().unwrap_or("pdf").to_lowercase();

    if requested_format == "text" || requested_format == "txt" {
        match crate::infrastructure::reports::InvoiceThermalGenerator::generate_text(
            &invoice,
            company_name,
            &state.config.agt_software_cert,
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
            &state.config.agt_software_cert,
        ) {
            Ok(bytes) => {
                let mut resp_headers = HeaderMap::new();
                resp_headers.insert(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/pdf"),
                );
                let filename = format!(
                    "TALAO_{}.pdf",
                    invoice.document_number.replace('/', "_").replace(' ', "_")
                );
                if let Ok(disp) = HeaderValue::from_str(&format!("inline; filename=\"{filename}\"")) {
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
        Err(response) => return response,
    };
    if params
        .tenant_id
        .is_some_and(|requested| requested != tenant_id)
    {
        return forbidden_tenant();
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
        let svg = crate::domain::services::fiscal_qr::AgtQrCodeService::generate_svg(&payload, 4).ok();
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
        return response;
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
        return response;
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
        return response;
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
        return response;
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
        return response;
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
        return response;
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
        return response;
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
        return response;
    }

    let job_id = state.saft_jobs.enqueue(
        payload.tenant_id,
        payload.fiscal_year,
        payload.fiscal_month,
    );

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
        return response;
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
        return response;
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

    let filename = job.filename.unwrap_or_else(|| format!("SAFT_AO_{}.xml", job.job_id));
    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/xml; charset=utf-8"),
    );
    if let Ok(disposition) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
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
        return response;
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
                    if let Some(accept) = headers.get(axum::http::header::ACCEPT).and_then(|v| v.to_str().ok()) {
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
        return response;
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
        return response;
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
            if let Ok(disp) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
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
            if let Ok(disp) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
                headers.insert(axum::http::header::CONTENT_DISPOSITION, disp);
            }
            (StatusCode::OK, headers, bytes).into_response()
        }
        Err(err) => domain_error(err),
    }
}

#[derive(Debug, Deserialize)]
pub struct PosReportQueryParams {
    #[serde(rename = "tenantId")]
    pub tenant_id: Option<Uuid>,
    pub date: Option<chrono::NaiveDate>,
    #[serde(rename = "posTerminalId")]
    pub pos_terminal_id: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseZReportPayload {
    pub tenant_id: Option<Uuid>,
    pub fiscal_year: Option<i32>,
    pub date: Option<chrono::NaiveDate>,
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
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp,
    };
    if params.tenant_id.is_some_and(|requested| requested != tenant_id) {
        return forbidden_tenant();
    }

    let date = params.date.unwrap_or_else(|| chrono::Utc::now().date_naive());
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
            "OPERADOR_FACTURACAO",
            "BILLING_OPERATOR",
        ],
    ) {
        Ok(t) => t,
        Err(resp) => return resp,
    };
    if params.tenant_id.is_some_and(|requested| requested != tenant_id) {
        return forbidden_tenant();
    }

    let date = params.date.unwrap_or_else(|| chrono::Utc::now().date_naive());
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
        let text = crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_text(&report);
        let mut resp_headers = HeaderMap::new();
        resp_headers.insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        (StatusCode::OK, resp_headers, text).into_response()
    } else {
        match crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_pdf(&report) {
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
        Err(resp) => return resp,
    };
    if payload.tenant_id.is_some_and(|requested| requested != tenant_id) {
        return forbidden_tenant();
    }

    let date = payload.date.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let fiscal_year = payload.fiscal_year.unwrap_or_else(|| chrono::Datelike::year(&date));
    let actor_user_id = headers.get("x-user-id").and_then(|v| v.to_str().ok()).map(|s| s.to_string());

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
        Err(resp) => return resp,
    };
    if payload.tenant_id.is_some_and(|requested| requested != tenant_id) {
        return forbidden_tenant();
    }

    let date = payload.date.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let fiscal_year = payload.fiscal_year.unwrap_or_else(|| chrono::Datelike::year(&date));
    let actor_user_id = headers.get("x-user-id").and_then(|v| v.to_str().ok()).map(|s| s.to_string());

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
        let text = crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_text(&report);
        let mut resp_headers = HeaderMap::new();
        resp_headers.insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        (StatusCode::CREATED, resp_headers, text).into_response()
    } else {
        match crate::application::queries::pos_reports::PosReportsUseCase::render_thermal_pdf(&report) {
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
        return response;
    }

    match state.sync_agt.execute(command).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(err) => domain_error(err),
    }
}

fn authorized_tenant_id(headers: &HeaderMap, allowed_roles: &[&str]) -> Result<Uuid, Response> {
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
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "O utilizador não tem perfil autorizado para esta operação fiscal." })),
        )
            .into_response());
    }
    Ok(tenant)
}

fn authorize_tenant(
    headers: &HeaderMap,
    requested_tenant: Uuid,
    allowed_roles: &[&str],
) -> Result<String, Response> {
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

fn unauthorized_identity() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Contexto de utilizador e empresa autenticado é obrigatório." })),
    )
        .into_response()
}

fn forbidden_tenant() -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({ "error": "A empresa solicitada não corresponde à empresa autenticada." })),
    )
        .into_response()
}

async fn generate_keys_handler(headers: HeaderMap) -> Response {
    if let Err(response) = authorize_role(&headers, &["ADMIN", "ADMINISTRADOR"]) {
        return response;
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
}
