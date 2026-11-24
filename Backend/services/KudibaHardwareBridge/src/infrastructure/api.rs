use std::env;
use std::sync::{Arc, OnceLock};

use axum::{
    extract::{Request, State},
    http::{
        header::{self, HeaderName, AUTHORIZATION},
        HeaderValue, Method, StatusCode,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use kudiba_gateway_signature::{canonical_json_bytes, verify_payload_signature};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use subtle::ConstantTimeEq;
use tower_http::cors::{AllowOrigin, CorsLayer};
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::job::{CopyType, JobClass, PrintJob, PrintState};
use crate::domain::port::{DrawerPort, JobRepository, PrinterPort, TransportOutcome};
use crate::infrastructure::credential::CredentialStore;
use crate::infrastructure::escp::{self, EscPosProfile};

const DEVELOPMENT_INTERNAL_GATEWAY_SECRET: &str =
    "kudiba_internal_gateway_secret_development_key_change_in_production_2026";

#[derive(Clone)]
pub struct BridgeState {
    pub printer: Arc<dyn PrinterPort>,
    pub drawer: Arc<dyn DrawerPort>,
    pub repository: Arc<dyn JobRepository>,
    pub credentials: Arc<CredentialStore>,
    pub profile: EscPosProfile,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Money {
    Text(String),
    Number(f64),
}

impl Default for Money {
    fn default() -> Self {
        Self::Number(0.0)
    }
}

impl Money {
    fn canonical(&self) -> String {
        match self {
            Self::Text(value) => value.clone(),
            Self::Number(value) => format!("{value:.2}"),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintEnvelopeLine {
    #[serde(default)]
    pub line_number: Value,
    pub description: String,
    #[serde(default)]
    pub quantity: Value,
    #[serde(default)]
    pub unit_price: Money,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintEnvelope {
    #[serde(default)]
    pub document_type: String,
    pub document_number: String,
    #[serde(default)]
    pub customer_name: String,
    #[serde(default)]
    pub customer_nif: Option<String>,
    pub hash: String,
    pub validation_chars: String,
    #[serde(default)]
    pub total_amount: Money,
    #[serde(default)]
    pub lines: Vec<PrintEnvelopeLine>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintRequest {
    pub print_job_id: String,
    pub tenant_id: Uuid,
    #[serde(default)]
    pub terminal_id: Option<Uuid>,
    pub document_number: String,
    pub job_class: String,
    pub copy_type: String,
    #[serde(default = "default_copy_id")]
    pub copy_id: String,
    pub payload_hash: String,
    #[serde(default)]
    pub print_authorization: Option<String>,
    pub envelope: PrintEnvelope,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawerRequest {
    pub print_job_id: String,
    pub tenant_id: Uuid,
    pub reason: String,
    pub confirm: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRequest {
    pub code: String,
    pub tenant_id: Uuid,
    #[serde(default)]
    pub label: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantRequest {
    pub tenant_id: Uuid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintResponse {
    pub print_job_id: String,
    pub state: String,
    pub replay: bool,
    pub attempts: u32,
}

fn default_copy_id() -> String {
    "1".to_string()
}

fn state_name(state: PrintState) -> &'static str {
    match state {
        PrintState::Queued => "QUEUED",
        PrintState::Submitting => "SUBMITTING",
        PrintState::TransportAccepted => "TRANSPORT_ACCEPTED",
        PrintState::Failed => "FAILED",
        PrintState::Unknown => "UNKNOWN",
        PrintState::PhysicalOutputConfirmed => "PHYSICAL_OUTPUT_CONFIRMED",
        PrintState::ResolvedByOperator => "RESOLVED_BY_OPERATOR",
    }
}

fn error_response(error: DeviceError) -> Response {
    let status = match error {
        DeviceError::InvalidIdempotencyKey | DeviceError::EmptyField(_) => {
            StatusCode::UNPROCESSABLE_ENTITY
        }
        DeviceError::InvalidTransition(_, _) => StatusCode::CONFLICT,
        DeviceError::TransportUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        DeviceError::PairingExpired | DeviceError::PairingInvalid => {
            StatusCode::UNPROCESSABLE_ENTITY
        }
        DeviceError::PairingLocked | DeviceError::Busy(_) | DeviceError::InvalidProfile(_) => {
            StatusCode::CONFLICT
        }
        DeviceError::NotPaired | DeviceError::FixedToken => StatusCode::PRECONDITION_FAILED,
    };
    (status, Json(json!({ "error": error.to_string() }))).into_response()
}

fn parse_job_class(value: &str) -> Option<JobClass> {
    match value.trim().to_ascii_uppercase().as_str() {
        "FISCAL_ENVELOPE" => Some(JobClass::FiscalEnvelope),
        "CONTINGENCY_LOCAL" => Some(JobClass::ContingencyLocal),
        _ => None,
    }
}

fn parse_copy_type(value: &str) -> Option<CopyType> {
    match value.trim().to_ascii_uppercase().as_str() {
        "ORIGINAL" => Some(CopyType::Original),
        "COPY" => Some(CopyType::Copy),
        _ => None,
    }
}

fn receipt_lines(envelope: &PrintEnvelope) -> Vec<String> {
    let mut lines = Vec::new();
    if !envelope.document_type.is_empty() {
        lines.push(format!(
            "{} {}",
            envelope.document_type, envelope.document_number
        ));
    } else {
        lines.push(envelope.document_number.clone());
    }
    if !envelope.customer_name.is_empty() {
        lines.push(format!("Cliente: {}", envelope.customer_name));
    }
    for line in &envelope.lines {
        let description = line.description.trim();
        if description.is_empty() {
            continue;
        }
        lines.push(format!(
            "{} x {}  {}",
            line.quantity,
            line.unit_price.canonical(),
            description
        ));
    }
    lines.push(format!("TOTAL {}", envelope.total_amount.canonical()));
    lines.push(format!("HASH {}", envelope.hash));
    lines.push(format!("VAL {}", envelope.validation_chars));
    lines
}

fn is_allowed_origin(origin: &str) -> bool {
    let raw = origin.trim().trim_end_matches('/');
    if let Ok(configured) = env::var("KUDIBA_BRIDGE_ALLOWED_ORIGINS") {
        for entry in configured.split(',') {
            let item = entry.trim().trim_end_matches('/');
            if item == "*" || item.eq_ignore_ascii_case(raw) {
                return true;
            }
        }
    }
    // Suporte para desenvolvimento local, ngrok e domínios Kudiba
    if raw.starts_with("http://localhost:")
        || raw == "http://localhost"
        || raw.starts_with("https://localhost:")
        || raw == "https://localhost"
        || raw.starts_with("http://127.0.0.1:")
        || raw == "http://127.0.0.1"
        || raw.starts_with("https://127.0.0.1:")
        || raw == "https://127.0.0.1"
        || raw.ends_with(".ngrok-free.dev")
        || raw.ends_with(".ngrok-free.app")
        || raw.ends_with(".ngrok.io")
        || raw.ends_with(".kudiba.ao")
    {
        return true;
    }
    false
}

async fn private_network_access_middleware(request: Request, next: Next) -> Response {
    let is_pna_requested = request
        .headers()
        .get("access-control-request-private-network")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut response = next.run(request).await;

    if is_pna_requested {
        response.headers_mut().insert(
            HeaderName::from_static("access-control-allow-private-network"),
            HeaderValue::from_static("true"),
        );
    }
    response
}

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _| {
            origin.to_str().map(is_allowed_origin).unwrap_or(false)
        }))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static("access-control-request-private-network"),
        ])
        .max_age(std::time::Duration::from_secs(600))
}

fn is_public_path(path: &str) -> bool {
    matches!(
        path,
        "/health" | "/pair" | "/pair/status" | "/pair/challenge" | "/diag"
    )
}

async fn authorize(State(state): State<BridgeState>, request: Request, next: Next) -> Response {
    if let Some(origin) = request.headers().get(header::ORIGIN) {
        let allowed = origin
            .to_str()
            .map(is_allowed_origin)
            .unwrap_or(false);
        if !allowed {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "Origem não autorizada a usar o agente local." })),
            )
                .into_response();
        }
    }

    if is_public_path(request.uri().path()) {
        return next.run(request).await;
    }

    let supplied = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let valid = supplied
        .zip(state.credentials.current_token())
        .map(|(token, current)| bool::from(token.as_bytes().ct_eq(current.as_bytes())))
        .unwrap_or(false);

    if !valid {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Token do agente local inválido." })),
        )
            .into_response();
    }

    next.run(request).await
}

static PRINT_SIGNING_SECRET: OnceLock<String> = OnceLock::new();

fn is_production_environment() -> bool {
    env::var("ENVIRONMENT")
        .map(|value| {
            value.trim().eq_ignore_ascii_case("production")
                || value.trim().eq_ignore_ascii_case("prod")
        })
        .unwrap_or(false)
}

pub fn initialize_print_signing_secret() -> Result<(), DeviceError> {
    let configured = env::var("KUDIBA_PRINT_SIGNING_SECRET")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            env::var("INTERNAL_GATEWAY_SECRET")
                .ok()
                .filter(|value| !value.is_empty())
        });
    let secret = configured.unwrap_or_else(|| {
        if is_production_environment() {
            String::new()
        } else {
            DEVELOPMENT_INTERNAL_GATEWAY_SECRET.to_string()
        }
    });
    if is_production_environment()
        && (secret.is_empty() || secret == DEVELOPMENT_INTERNAL_GATEWAY_SECRET || secret.len() < 32)
    {
        return Err(DeviceError::InvalidProfile(
            "KUDIBA_PRINT_SIGNING_SECRET ou INTERNAL_GATEWAY_SECRET deve ser um segredo não development em produção".to_string(),
        ));
    }
    let _ = PRINT_SIGNING_SECRET.set(secret);
    Ok(())
}

fn print_signing_secret() -> &'static str {
    PRINT_SIGNING_SECRET
        .get_or_init(|| DEVELOPMENT_INTERNAL_GATEWAY_SECRET.to_string())
        .as_str()
}

fn canonical_print_payload(request: &PrintRequest) -> Value {
    json!({
        "printJobId": request.print_job_id,
        "tenantId": request.tenant_id,
        "terminalId": request.terminal_id,
        "documentNumber": request.document_number,
        "jobClass": request.job_class,
        "copyType": request.copy_type,
        "payloadHash": request.payload_hash,
        "envelope": {
            "documentType": request.envelope.document_type,
            "documentNumber": request.envelope.document_number,
            "customerName": request.envelope.customer_name,
            "customerNif": request.envelope.customer_nif,
            "hash": request.envelope.hash,
            "validationChars": request.envelope.validation_chars,
            "totalAmount": request.envelope.total_amount.canonical(),
            "lines": request.envelope.lines.iter().map(|line| json!({
                "lineNumber": line.line_number,
                "description": line.description,
                "quantity": line.quantity,
                "unitPrice": line.unit_price.canonical(),
            })).collect::<Vec<_>>(),
        },
    })
}

fn authorization_matches(request: &PrintRequest, payload: &Value) -> bool {
    let Some(authorization) = request
        .print_authorization
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return false;
    };
    let Ok(bytes) = canonical_json_bytes(payload) else {
        return false;
    };
    verify_payload_signature(print_signing_secret(), &bytes, authorization)
}

async fn authorized_copy_reprint(state: &BridgeState, request: &PrintRequest) -> bool {
    let Some(mut payload) = canonical_print_payload(request).as_object().cloned() else {
        return false;
    };
    payload.insert("copyType".to_string(), json!("ORIGINAL"));
    if !authorization_matches(request, &Value::Object(payload)) {
        return false;
    }
    let Ok(Some(original)) = state
        .repository
        .find_by_idempotency_key(request.tenant_id, &request.print_job_id)
        .await
    else {
        return false;
    };
    original.copy_type() == CopyType::Original
        && original.tenant_id() == request.tenant_id
        && original.payload_hash() == request.payload_hash
        && original.is_terminal_success()
}

async fn health() -> Response {
    (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
}

async fn diag(State(state): State<BridgeState>) -> Response {
    let status = state.credentials.status();
    Json(json!({
        "status": "ok",
        "service": "kudiba-hardware-bridge",
        "version": "0.1.0",
        "port": 17842,
        "paired": status.paired,
        "awaitingCode": status.awaiting_code,
        "locked": status.locked,
        "profile": {
            "columns": state.profile.columns,
            "has_cutter": state.profile.has_cutter,
            "ascii_only": state.profile.ascii_only,
        }
    }))
    .into_response()
}

async fn pair_status(State(state): State<BridgeState>) -> Response {
    Json(state.credentials.status()).into_response()
}

async fn regenerate_challenge(State(state): State<BridgeState>) -> Response {
    match state.credentials.regenerate_challenge() {
        Ok(code) => {
            tracing::warn!(code = %code, "novo código de emparelhamento emitido (válido 5 minutos)");
            (StatusCode::OK, Json(json!({ "reissued": true }))).into_response()
        }
        Err(error) => error_response(error),
    }
}

async fn pair(State(state): State<BridgeState>, Json(request): Json<PairRequest>) -> Response {
    match state
        .credentials
        .pair(&request.code, request.tenant_id, &request.label)
    {
        Ok(token) => (
            StatusCode::OK,
            Json(json!({ "token": token, "tenantId": request.tenant_id })),
        )
            .into_response(),
        Err(error) => error_response(error),
    }
}

async fn rotate_token(
    State(state): State<BridgeState>,
    Json(_request): Json<TenantRequest>,
) -> Response {
    match state.credentials.rotate() {
        Ok(token) => (StatusCode::OK, Json(json!({ "token": token }))).into_response(),
        Err(error) => error_response(error),
    }
}

async fn revoke_token(
    State(state): State<BridgeState>,
    Json(_request): Json<TenantRequest>,
) -> Response {
    match state.credentials.revoke() {
        Ok(new_code) => {
            tracing::warn!(new_code = %new_code, "credencial local revogada; novo código de emparelhamento emitido");
            (StatusCode::OK, Json(json!({ "revoked": true }))).into_response()
        }
        Err(error) => error_response(error),
    }
}

async fn print(State(state): State<BridgeState>, Json(request): Json<PrintRequest>) -> Response {
    let job_class = match parse_job_class(&request.job_class) {
        Some(value) => value,
        None => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": "jobClass desconhecido." })),
            )
                .into_response()
        }
    };
    let copy_type = match parse_copy_type(&request.copy_type) {
        Some(value) => value,
        None => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": "copyType desconhecido." })),
            )
                .into_response()
        }
    };

    let canonical = canonical_print_payload(&request);
    if !(authorization_matches(&request, &canonical)
        || (copy_type == CopyType::Copy && authorized_copy_reprint(&state, &request).await))
    {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Autorização de impressão ausente ou inválida." })),
        )
            .into_response();
    }

    if let Some(credential) = state.credentials.credential() {
        if !credential.tenant_id.is_nil() && credential.tenant_id != request.tenant_id {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "O agente local está emparelhado com outra empresa."
                })),
            )
                .into_response();
        }
    }

    if request.print_job_id.trim().is_empty()
        || request.document_number.trim().is_empty()
        || request.payload_hash.trim().is_empty()
        || request.envelope.hash.trim().is_empty()
    {
        return error_response(DeviceError::EmptyField("printJobId/documentNumber/hash"));
    }
    if request.payload_hash != request.envelope.hash {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": "O hash do envelope não coincide com o hash da venda." })),
        )
            .into_response();
    }
    if request.document_number != request.envelope.document_number {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": "O número do documento não coincide com o envelope." })),
        )
            .into_response();
    }

    let idempotency_key = if copy_type == CopyType::Copy {
        let copy_id = request.copy_id.trim();
        if copy_id.is_empty() {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": "copyId é obrigatório para reimpressões." })),
            )
                .into_response();
        }
        format!("{}:copy:{}", request.print_job_id, copy_id)
    } else {
        request.print_job_id.clone()
    };

    if copy_type == CopyType::Copy {
        tracing::info!(
            print_job_id = %request.print_job_id,
            copy_id = %request.copy_id,
            tenant_id = %request.tenant_id,
            "auditoria: reimpressão COPY sem abertura de gaveta"
        );
    }

    if let Ok(Some(existing)) = state
        .repository
        .find_by_idempotency_key(request.tenant_id, &idempotency_key)
        .await
    {
        if existing.payload_hash() != request.payload_hash {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "printJobId reutilizado com outro payload." })),
            )
                .into_response();
        }
        return Json(PrintResponse {
            print_job_id: idempotency_key,
            state: state_name(existing.state()).to_string(),
            replay: true,
            attempts: existing.attempts(),
        })
        .into_response();
    }

    let new_job = || -> Result<PrintJob, DeviceError> {
        if copy_type == CopyType::Copy {
            let seed = PrintJob::new_original(
                request.tenant_id,
                request.terminal_id.unwrap_or_default(),
                job_class,
                request.document_number.clone(),
                format!("{idempotency_key}:seed"),
                request.payload_hash.clone(),
            )?;
            seed.new_copy(idempotency_key.clone())
        } else {
            PrintJob::new_original(
                request.tenant_id,
                request.terminal_id.unwrap_or_default(),
                job_class,
                request.document_number.clone(),
                idempotency_key.clone(),
                request.payload_hash.clone(),
            )
        }
    };

    let mut job = match new_job() {
        Ok(job) => job,
        Err(error) => return error_response(error),
    };
    if let Err(error) = state.repository.save(job.clone()).await {
        return error_response(error);
    }
    if let Err(error) = job.mark_submitting() {
        return error_response(error);
    }
    if let Err(error) = state.repository.save(job.clone()).await {
        return error_response(error);
    }

    let bytes = escp::build_receipt(&receipt_lines(&request.envelope), &state.profile);
    match state.printer.print_bytes(&bytes).await {
        Ok(TransportOutcome::TransportAccepted) => {
            if let Err(error) = job.mark_transport_accepted() {
                return error_response(error);
            }
        }
        Ok(TransportOutcome::Failed) => {
            if let Err(error) = job.mark_failed() {
                return error_response(error);
            }
        }
        Ok(TransportOutcome::Unknown) => {
            if let Err(error) = job.mark_unknown() {
                return error_response(error);
            }
        }
        Err(error) => {
            if let Err(state_error) = job.mark_failed() {
                return error_response(state_error);
            }
            if let Err(save_error) = state.repository.save(job.clone()).await {
                return error_response(save_error);
            }
            return error_response(error);
        }
    }

    if let Err(error) = state.repository.save(job.clone()).await {
        return error_response(error);
    }

    Json(PrintResponse {
        print_job_id: idempotency_key,
        state: state_name(job.state()).to_string(),
        replay: false,
        attempts: job.attempts(),
    })
    .into_response()
}

async fn open_drawer(
    State(state): State<BridgeState>,
    Json(request): Json<DrawerRequest>,
) -> Response {
    if !request.confirm || request.reason.trim().is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "error": "A abertura da gaveta exige reason e confirm=true."
            })),
        )
            .into_response();
    }

    if let Some(credential) = state.credentials.credential() {
        if !credential.tenant_id.is_nil() && credential.tenant_id != request.tenant_id {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "O agente local está emparelhado com outra empresa."
                })),
            )
                .into_response();
        }
    }

    let job = match state
        .repository
        .find_by_idempotency_key(request.tenant_id, &request.print_job_id)
        .await
    {
        Ok(Some(job)) => job,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Print job desconhecido." })),
            )
                .into_response()
        }
        Err(error) => return error_response(error),
    };

    if job.tenant_id() != request.tenant_id {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "O job pertence a outra empresa." })),
        )
            .into_response();
    }
    if job.copy_type() != CopyType::Original || !job.is_terminal_success() {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "A gaveta só abre após um original com saída concluída; reimpressões nunca abrem a gaveta."
            })),
        )
            .into_response();
    }

    let outcome = state.drawer.open().await;
    let (status, outcome_name, body) = match outcome {
        Ok(TransportOutcome::TransportAccepted) => (
            StatusCode::OK,
            "TRANSPORT_ACCEPTED",
            json!({ "state": "TRANSPORT_ACCEPTED" }),
        ),
        Ok(TransportOutcome::Unknown) => (StatusCode::OK, "UNKNOWN", json!({ "state": "UNKNOWN" })),
        Ok(TransportOutcome::Failed) => (
            StatusCode::SERVICE_UNAVAILABLE,
            "FAILED",
            json!({ "state": "FAILED", "error": "Falha na abertura da gaveta." }),
        ),
        Err(error) => {
            tracing::info!(
                job_id = %job.id(),
                tenant_id = %request.tenant_id,
                reason = %request.reason,
                outcome = "ERROR",
                "auditoria: abertura de gaveta"
            );
            return error_response(error);
        }
    };

    tracing::info!(
        job_id = %job.id(),
        tenant_id = %request.tenant_id,
        reason = %request.reason,
        outcome = %outcome_name,
        "auditoria: abertura de gaveta"
    );
    (status, Json(body)).into_response()
}

pub fn router(state: BridgeState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/diag", get(diag))
        .route("/pair/status", get(pair_status))
        .route("/pair/challenge", post(regenerate_challenge))
        .route("/pair", post(pair))
        .route("/device/token/rotate", post(rotate_token))
        .route("/device/token/revoke", post(revoke_token))
        .route("/device/print", post(print))
        .route("/device/drawer/open", post(open_drawer))
        .layer(middleware::from_fn_with_state(state.clone(), authorize))
        .layer(middleware::from_fn(private_network_access_middleware))
        .layer(cors_layer())
        .with_state(state)
}

pub async fn body_string(response: Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap_or_default();
    String::from_utf8_lossy(&bytes).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::credential::CredentialStore;
    use crate::infrastructure::memory::{InMemoryJobRepository, RecordingDrawer, RecordingPrinter};
    use axum::body::Body;
    use axum::http::{
        header::{
            ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_REQUEST_METHOD, CONTENT_TYPE, ORIGIN,
        },
        Method, Request,
    };
    use kudiba_gateway_signature::compute_payload_signature;
    use tower::ServiceExt;

    fn state(
        printer_outcome: TransportOutcome,
    ) -> (BridgeState, Arc<RecordingPrinter>, Arc<RecordingDrawer>) {
        let printer = Arc::new(RecordingPrinter::new(printer_outcome));
        let drawer = Arc::new(RecordingDrawer::default());
        (
            BridgeState {
                printer: printer.clone(),
                drawer: drawer.clone(),
                repository: Arc::new(InMemoryJobRepository::default()),
                credentials: Arc::new(CredentialStore::with_fixed_token("token-local")),
                profile: EscPosProfile::default(),
            },
            printer,
            drawer,
        )
    }

    fn request(body: serde_json::Value, authorized: bool) -> Request<Body> {
        let mut builder = Request::post("/device/print").header(CONTENT_TYPE, "application/json");
        if authorized {
            builder = builder.header(AUTHORIZATION, "Bearer token-local");
        }
        builder.body(Body::from(body.to_string())).unwrap()
    }

    fn post_json(path: &str, body: serde_json::Value, token: Option<&str>) -> Request<Body> {
        let mut builder = Request::post(path).header(CONTENT_TYPE, "application/json");
        if let Some(token) = token {
            builder = builder.header(AUTHORIZATION, format!("Bearer {token}"));
        }
        builder.body(Body::from(body.to_string())).unwrap()
    }

    fn payload() -> serde_json::Value {
        json!({
            "printJobId": "sale-1:print",
            "tenantId": Uuid::from_u128(1),
            "terminalId": Uuid::from_u128(2),
            "documentNumber": "FR 2026A/000001",
            "jobClass": "FISCAL_ENVELOPE",
            "copyType": "ORIGINAL",
            "payloadHash": "hash-abc",
            "envelope": {
                "documentType": "FR",
                "documentNumber": "FR 2026A/000001",
                "customerName": "Consumidor Final",
                "customerNif": "999999999",
                "hash": "hash-abc",
                "validationChars": "1234-5678",
                "totalAmount": "100.00",
                "lines": [{
                    "lineNumber": 1,
                    "description": "Produto",
                    "quantity": 1,
                    "unitPrice": "100.00"
                }]
            }
        })
    }

    fn sign_payload(payload: &serde_json::Value) -> String {
        let request: PrintRequest = serde_json::from_value(payload.clone()).unwrap();
        let canonical = canonical_json_bytes(&canonical_print_payload(&request)).unwrap();
        compute_payload_signature(print_signing_secret(), &canonical)
    }

    fn signed_payload() -> serde_json::Value {
        let mut payload = payload();
        let signature = sign_payload(&payload);
        payload
            .as_object_mut()
            .unwrap()
            .insert("printAuthorization".to_string(), json!(signature));
        payload
    }

    fn copy_payload(copy_id: &str) -> serde_json::Value {
        let mut payload = signed_payload();
        {
            let object = payload.as_object_mut().unwrap();
            object.insert("copyType".to_string(), json!("COPY"));
            object.insert("copyId".to_string(), json!(copy_id));
        }
        let signature = sign_payload(&payload);
        payload
            .as_object_mut()
            .unwrap()
            .insert("printAuthorization".to_string(), json!(signature));
        payload
    }

    #[tokio::test]
    async fn accepts_the_backend_contract_payload_shape() {
        let mut contract = payload();
        {
            let envelope = contract["envelope"].as_object_mut().unwrap();
            envelope.insert("totalAmount".to_string(), json!("116.00"));
            envelope["lines"][0]["quantity"] = json!("2");
            envelope["lines"][0]["unitPrice"] = json!("1234.55");
        }
        let signature = sign_payload(&contract);
        contract
            .as_object_mut()
            .unwrap()
            .insert("printAuthorization".to_string(), json!(signature));

        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let response = router(state)
            .oneshot(request(contract, true))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(printer.received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn rejects_requests_without_the_local_token() {
        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let response = router(state)
            .oneshot(request(signed_payload(), false))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(printer.received.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn rejects_missing_or_invalid_print_authorization() {
        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        let missing = app.clone().oneshot(request(payload(), true)).await.unwrap();
        assert_eq!(missing.status(), StatusCode::UNAUTHORIZED);

        let mut invalid = signed_payload();
        invalid["envelope"]["customerName"] = json!("Adversário");
        let invalid = app.oneshot(request(invalid, true)).await.unwrap();
        assert_eq!(invalid.status(), StatusCode::UNAUTHORIZED);
        assert!(printer.received.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn accepted_transport_is_not_claimed_as_physical_output() {
        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let response = router(state)
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = body_string(response).await;
        assert!(body.contains("TRANSPORT_ACCEPTED"));
        assert!(!body.contains("PHYSICAL_OUTPUT_CONFIRMED"));
        assert_eq!(printer.received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn replay_does_not_print_twice() {
        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        let first = app
            .clone()
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let second = app.oneshot(request(signed_payload(), true)).await.unwrap();
        let body = body_string(second).await;
        assert!(body.contains("\"replay\":true"));
        assert_eq!(printer.received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn copy_reprints_are_idempotent_and_audited() {
        let (state, printer, _) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        let original = app
            .clone()
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        assert_eq!(original.status(), StatusCode::OK);

        let first = app
            .clone()
            .oneshot(request(copy_payload("copy-1"), true))
            .await
            .unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let first_body = body_string(first).await;
        assert!(first_body.contains("sale-1:print:copy:copy-1"));

        let second = app
            .oneshot(request(copy_payload("copy-1"), true))
            .await
            .unwrap();
        let second_body = body_string(second).await;
        assert!(second_body.contains("\"replay\":true"));
        assert_eq!(printer.received.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn copy_signed_as_original_is_allowed_only_after_a_successful_original() {
        let (state, _, _) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        let mut copy = copy_payload("copy-2");
        let original_signature = sign_payload(&payload());
        copy.as_object_mut()
            .unwrap()
            .insert("printAuthorization".to_string(), json!(original_signature));
        assert_eq!(
            app.clone()
                .oneshot(request(copy.clone(), true))
                .await
                .unwrap()
                .status(),
            StatusCode::UNAUTHORIZED
        );

        assert_eq!(
            app.clone()
                .oneshot(request(signed_payload(), true))
                .await
                .unwrap()
                .status(),
            StatusCode::OK
        );
        assert_eq!(
            app.oneshot(request(copy, true)).await.unwrap().status(),
            StatusCode::OK
        );
    }

    #[tokio::test]
    async fn unknown_outcome_is_reported_honestly() {
        let (state, _, _) = state(TransportOutcome::Unknown);
        let response = router(state)
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        let body = body_string(response).await;
        assert!(body.contains("UNKNOWN"));
    }

    #[tokio::test]
    async fn pairing_exchanges_a_one_time_code_for_a_tenant_bound_token() {
        let credentials = Arc::new(CredentialStore::new(None, None).unwrap());
        let code = credentials.pending_code().unwrap();
        let tenant = Uuid::from_u128(1);
        let state = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::default()),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials: credentials.clone(),
            profile: EscPosProfile::default(),
        };
        let app = router(state);

        let status = app
            .clone()
            .oneshot(Request::get("/pair/status").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status_body = body_string(status).await;
        assert!(status_body.contains("\"paired\":false"));
        assert!(status_body.contains("\"awaitingCode\":true"));
        assert!(status_body.contains("\"locked\":false"));

        let paired = app
            .clone()
            .oneshot(post_json(
                "/pair",
                json!({ "code": code, "tenantId": tenant, "label": "Caixa 1" }),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(paired.status(), StatusCode::OK);
        let pair_response: serde_json::Value =
            serde_json::from_str(&body_string(paired).await).unwrap();
        let token = pair_response["token"].as_str().unwrap().to_string();

        let printed = app
            .clone()
            .oneshot(post_json("/device/print", signed_payload(), Some(&token)))
            .await
            .unwrap();
        assert_eq!(printed.status(), StatusCode::OK);

        let mut wrong_tenant = signed_payload();
        wrong_tenant["tenantId"] = json!(Uuid::from_u128(99));
        let signature = sign_payload(&wrong_tenant);
        wrong_tenant
            .as_object_mut()
            .unwrap()
            .insert("printAuthorization".to_string(), json!(signature));
        let rejected = app
            .oneshot(post_json("/device/print", wrong_tenant, Some(&token)))
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn challenge_can_be_reissued_without_leaking_the_code() {
        let credentials = Arc::new(CredentialStore::new(None, None).unwrap());
        let old_code = credentials.pending_code().unwrap();
        let state = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::default()),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials: credentials.clone(),
            profile: EscPosProfile::default(),
        };
        let app = router(state);

        let reissued = app
            .clone()
            .oneshot(
                Request::post("/pair/challenge")
                    .header(CONTENT_TYPE, "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(reissued.status(), StatusCode::OK);
        assert!(!body_string(reissued).await.contains(&old_code));

        let new_code = credentials.pending_code().unwrap();
        assert_ne!(new_code, old_code);
        let paired = app
            .oneshot(post_json(
                "/pair",
                json!({
                    "code": old_code,
                    "tenantId": Uuid::from_u128(1),
                    "label": "Caixa 1"
                }),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(paired.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn fifth_wrong_code_locks_pairing_and_exposes_it_in_status() {
        let credentials = Arc::new(CredentialStore::new(None, None).unwrap());
        let state = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::default()),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials: credentials.clone(),
            profile: EscPosProfile::default(),
        };
        let app = router(state);
        for _ in 0..4 {
            let response = app
                .clone()
                .oneshot(post_json(
                    "/pair",
                    json!({ "code": "000000", "tenantId": Uuid::from_u128(1) }),
                    None,
                ))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        }
        let locked = app
            .clone()
            .oneshot(post_json(
                "/pair",
                json!({ "code": "000000", "tenantId": Uuid::from_u128(1) }),
                None,
            ))
            .await
            .unwrap();
        assert_eq!(locked.status(), StatusCode::CONFLICT);
        assert_eq!(credentials.pending_code(), None);

        let status = app
            .oneshot(Request::get("/pair/status").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let body = body_string(status).await;
        assert!(body.contains("\"locked\":true"));
        assert!(body.contains("\"awaitingCode\":false"));
    }

    #[tokio::test]
    async fn paired_token_can_be_rotated() {
        let credentials = Arc::new(CredentialStore::new(None, None).unwrap());
        let code = credentials.pending_code().unwrap();
        let tenant = Uuid::from_u128(1);
        let old_token = credentials.pair(&code, tenant, "Caixa 1").unwrap();
        let state = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::default()),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials,
            profile: EscPosProfile::default(),
        };
        let response = router(state)
            .oneshot(post_json(
                "/device/token/rotate",
                json!({ "tenantId": tenant }),
                Some(&old_token),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body: serde_json::Value = serde_json::from_str(&body_string(response).await).unwrap();
        assert_ne!(body["token"].as_str().unwrap(), old_token);
    }

    async fn print_one(app: &Router) {
        let response = app
            .clone()
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    fn drawer_request(job_id: &str, tenant: Uuid) -> Request<Body> {
        post_json(
            "/device/drawer/open",
            json!({
                "printJobId": job_id,
                "tenantId": tenant,
                "reason": "Entrega de numerário",
                "confirm": true
            }),
            Some("token-local"),
        )
    }

    #[tokio::test]
    async fn drawer_opens_only_for_successful_originals_and_uses_the_drawer_port() {
        let (state, printer, drawer) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        print_one(&app).await;

        let response = app
            .clone()
            .oneshot(drawer_request("sale-1:print", Uuid::from_u128(1)))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(body_string(response).await.contains("TRANSPORT_ACCEPTED"));
        assert_eq!(*drawer.calls.lock().unwrap(), 1);
        assert_eq!(printer.received.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn drawer_never_opens_for_copy_or_wrong_tenant() {
        let (state, _, drawer) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        print_one(&app).await;
        let copy = app
            .clone()
            .oneshot(request(copy_payload("copy-3"), true))
            .await
            .unwrap();
        assert_eq!(copy.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(drawer_request(
                "sale-1:print:copy:copy-3",
                Uuid::from_u128(1),
            ))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let response = app
            .oneshot(drawer_request("sale-1:print", Uuid::from_u128(9)))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(*drawer.calls.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn drawer_requires_a_terminal_success_state() {
        let (state, _, drawer) = state(TransportOutcome::Failed);
        let app = router(state);
        let printed = app
            .clone()
            .oneshot(request(signed_payload(), true))
            .await
            .unwrap();
        assert_eq!(printed.status(), StatusCode::OK);
        let response = app
            .oneshot(drawer_request("sale-1:print", Uuid::from_u128(1)))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(*drawer.calls.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn drawer_outcome_is_reported_honestly() {
        let unknown = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::new(TransportOutcome::Unknown)),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials: Arc::new(CredentialStore::with_fixed_token("token-local")),
            profile: EscPosProfile::default(),
        };
        let app = router(unknown);
        print_one(&app).await;
        let response = app
            .oneshot(drawer_request("sale-1:print", Uuid::from_u128(1)))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(body_string(response).await.contains("UNKNOWN"));

        let failed = BridgeState {
            printer: Arc::new(RecordingPrinter::new(TransportOutcome::TransportAccepted)),
            drawer: Arc::new(RecordingDrawer::new(TransportOutcome::Failed)),
            repository: Arc::new(InMemoryJobRepository::default()),
            credentials: Arc::new(CredentialStore::with_fixed_token("token-local")),
            profile: EscPosProfile::default(),
        };
        let failed_app = router(failed);
        print_one(&failed_app).await;
        let response = failed_app
            .oneshot(drawer_request("sale-1:print", Uuid::from_u128(1)))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert!(body_string(response).await.contains("FAILED"));
    }

    #[tokio::test]
    async fn cors_allows_configured_origins_and_blocks_unknown_origins() {
        let (state, _, _) = state(TransportOutcome::TransportAccepted);
        let app = router(state);
        let preflight = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/device/print")
                    .header(ORIGIN, "http://localhost:5173")
                    .header(ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(preflight.status(), StatusCode::OK);
        assert_eq!(
            preflight
                .headers()
                .get(ACCESS_CONTROL_ALLOW_ORIGIN)
                .unwrap(),
            "http://localhost:5173"
        );

        let rejected = app
            .oneshot(
                Request::get("/health")
                    .header(ORIGIN, "https://evil.example")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn copy_jobs_are_not_allowed_to_open_the_drawer() {
        let original = PrintJob::new_original(
            Uuid::new_v4(),
            Uuid::new_v4(),
            JobClass::FiscalEnvelope,
            "FR 2026A/000001",
            "sale-1",
            "hash",
        )
        .unwrap();
        let copy = original.new_copy("sale-1:copy").unwrap();
        assert!(!original.allows_drawer());
        assert!(!copy.allows_drawer());
    }
}
