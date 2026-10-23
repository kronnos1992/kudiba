use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use reqwest::Client;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::errors::ProblemDetail;
use crate::server::AppState;

/// Handler de Reverse Proxy para o Core API Server
///
/// O Core API (módulos comerciais) é opcional: quando não está configurado,
/// devolvemos 404 em vez de contactar um host inexistente.
pub async fn forward_to_core(State(state): State<AppState>, req: Request) -> Response {
    let Some(base_url) = state.config.core_api_url.as_deref() else {
        let instance_path = req
            .uri()
            .path_and_query()
            .map(|pq| pq.as_str().to_string())
            .unwrap_or_else(|| req.uri().path().to_string());
        return ProblemDetail::new(
            "https://api.kudiba.ao/errors/not-found",
            "Recurso Não Encontrado",
            StatusCode::NOT_FOUND,
            "O módulo Core API não está implantado neste ambiente e o recurso solicitado não corresponde a nenhum serviço disponível.",
            instance_path.as_str(),
            "CORE_API_NOT_CONFIGURED",
        )
        .into_response();
    };

    forward_request(
        &state.http_client,
        base_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

/// Handler de Reverse Proxy para o Serviço de Autenticação (KudibaAuth)
pub async fn forward_to_auth(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.auth_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

/// Handler dedicado ao OpenAPI do KudibaAuth (`/api-docs/openapi.json`),
/// exposto no perímetro para o Swagger UI agregar a documentação.
pub async fn forward_to_auth_openapi(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.auth_service_url,
        req,
        state.config.max_body_bytes,
        Some("/api-docs/openapi.json"),
        &state.config.internal_gateway_secret,
    )
    .await
}

/// Handler de Reverse Proxy para o Fiscal Engine Service (AGT Criptografia & Séries)
pub async fn forward_to_fiscal(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.fiscal_engine_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub async fn forward_to_inventory(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.inventory_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub async fn forward_to_treasury(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.treasury_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub async fn forward_to_accounting(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.accounting_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub async fn forward_to_payroll(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.payroll_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub async fn forward_to_integrations(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.integrations_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

/// Handler de Reverse Proxy para o Backoffice B2B (KudibaBackoffice — Clientes & Licenças)
pub async fn forward_to_backoffice(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.backoffice_service_url,
        req,
        state.config.max_body_bytes,
        None,
        &state.config.internal_gateway_secret,
    )
    .await
}

pub fn compute_gateway_signature(secret: &[u8], payload: &str) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret);
    let tag = ring::hmac::sign(&key, payload.as_bytes());
    tag.as_ref()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

fn ensure_correlation_id(headers: &hyper::HeaderMap) -> String {
    headers
        .get("x-correlation-id")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

fn build_traceparent(correlation_id: &str) -> String {
    let trace_id = Uuid::parse_str(correlation_id)
        .ok()
        .filter(|id| id.as_u128() != 0)
        .map(|id| id.simple().to_string())
        .unwrap_or_else(|| Uuid::new_v4().simple().to_string());

    let span_id = Uuid::new_v4().simple().to_string();
    format!("00-{trace_id}-{}-01", &span_id[..16])
}

fn is_valid_traceparent(value: &str) -> bool {
    let parts: Vec<_> = value.split('-').collect();
    parts.len() == 4
        && parts[0] == "00"
        && parts[1].len() == 32
        && parts[1].bytes().all(|byte| byte.is_ascii_hexdigit())
        && parts[1].bytes().any(|byte| byte != b'0')
        && parts[2].len() == 16
        && parts[2].bytes().all(|byte| byte.is_ascii_hexdigit())
        && parts[2].bytes().any(|byte| byte != b'0')
        && parts[3].len() == 2
        && parts[3].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn build_child_traceparent(parent: &str) -> String {
    let parts: Vec<_> = parent.split('-').collect();
    let span_id = Uuid::new_v4().simple().to_string();
    format!("00-{}-{}-{}", parts[1], &span_id[..16], parts[3])
}

async fn forward_request(
    client: &Client,
    base_url: &str,
    req: Request,
    max_body_bytes: usize,
    path_override: Option<&str>,
    internal_secret: &str,
) -> Response {
    let client_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip().to_string());
    let (parts, body) = req.into_parts();
    let instance_path = parts
        .uri
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_default();
    let path_and_query = path_override
        .map(|p| p.to_string())
        .unwrap_or_else(|| instance_path.clone());
    let base = base_url.trim_end_matches('/');
    let target_url = format!("{}{}", base, path_and_query);

    // Converte body axum para bytes respeitando o limite perimétrico de segurança
    let body_bytes = match axum::body::to_bytes(body, max_body_bytes).await {
        Ok(b) => b,
        Err(_) => {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/bad-request",
                "Payload Inválido ou Excessivo",
                StatusCode::PAYLOAD_TOO_LARGE,
                "O tamanho da requisição excedeu o limite máximo perimétrico permitido.",
                instance_path.as_str(),
                "REQUEST_BODY_LIMIT_EXCEEDED",
            )
            .into_response();
        }
    };

    // Constrói requisição upstream
    let method = parts.method;
    let mut builder = client.request(method.clone(), &target_url);

    // Copia headers, filtrando hop-by-hop, tracers do próprio gateway e preservando
    // o contexto de correlação para toda a cadeia de microsserviços.
    for (k, v) in &parts.headers {
        if k != "host"
            && k != "content-length"
            && k != "x-forwarded-for"
            && k != "traceparent"
            && k != "x-correlation-id"
        {
            builder = builder.header(k.as_str(), v.as_bytes());
        }
    }
    if let Some(client_ip) = client_ip {
        builder = builder.header("X-Forwarded-For", client_ip);
    }

    let correlation_id = ensure_correlation_id(&parts.headers);
    builder = builder.header("X-Correlation-ID", correlation_id.clone());

    // Contexto de rastreabilidade W3C (OpenTelemetry): reutiliza o traceparent
    // recebido ou gera um novo trace/span para a chamada ao microsserviço.
    let traceparent = parts
        .headers
        .get("traceparent")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|value| is_valid_traceparent(value))
        .map(build_child_traceparent)
        .unwrap_or_else(|| build_traceparent(&correlation_id));
    builder = builder.header("traceparent", traceparent);

    let timestamp = chrono::Utc::now().timestamp().to_string();
    let uri_path = parts.uri.path();
    let canonical = format!("{}:{}:{}", timestamp, method.as_str(), uri_path);
    let signature = compute_gateway_signature(internal_secret.as_bytes(), &canonical);

    builder = builder
        .header("X-Gateway-Timestamp", timestamp)
        .header("X-Gateway-Signature", signature);

    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes);
    }

    match builder.send().await {
        Ok(upstream_resp) => {
            let status = upstream_resp.status();
            let mut response_builder = Response::builder().status(status.as_u16());

            // Transfere cabeçalhos da resposta upstream, filtrando cabeçalhos hop-by-hop (RFC 9110 / RFC 7230)
            for (k, v) in upstream_resp.headers() {
                let name = k.as_str().to_ascii_lowercase();
                if name != "transfer-encoding"
                    && name != "connection"
                    && name != "keep-alive"
                    && name != "proxy-authenticate"
                    && name != "proxy-authorization"
                    && name != "te"
                    && name != "trailers"
                    && name != "upgrade"
                {
                    response_builder = response_builder.header(k.as_str(), v.as_bytes());
                }
            }

            match upstream_resp.bytes().await {
                Ok(bytes) => response_builder
                    .body(Body::from(bytes))
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
                Err(_) => ProblemDetail::new(
                    "https://api.kudiba.ao/errors/bad-gateway",
                    "Falha ao Receber Resposta do Upstream",
                    StatusCode::BAD_GATEWAY,
                    "O serviço interno retornou erro ao enviar o fluxo de dados.",
                    instance_path.as_str(),
                    "UPSTREAM_STREAM_ERROR",
                )
                .into_response(),
            }
        }
        Err(err) => {
            tracing::error!("Falha de conexão com upstream ({}): {:?}", target_url, err);
            ProblemDetail::new(
                "https://api.kudiba.ao/errors/bad-gateway",
                "Serviço Interno Indisponível",
                StatusCode::BAD_GATEWAY,
                "Não foi possível estabelecer comunicação com o microsserviço no cluster interno.",
                instance_path.as_str(),
                "UPSTREAM_COMMUNICATION_ERROR",
            )
            .into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_child_traceparent, build_traceparent, ensure_correlation_id, is_valid_traceparent,
    };
    use hyper::HeaderMap;

    #[test]
    fn ensure_correlation_id_reuses_incoming_value() {
        let mut headers = HeaderMap::new();
        headers.insert("x-correlation-id", "corr-123".parse().unwrap());
        assert_eq!(ensure_correlation_id(&headers), "corr-123");
    }

    #[test]
    fn build_traceparent_uses_32_char_trace_id() {
        let traceparent = build_traceparent("550e8400-e29b-41d4-a716-446655440000");
        let parts: Vec<_> = traceparent.split('-').collect();
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "00");
        assert_eq!(parts[1].len(), 32);
        assert_eq!(parts[3], "01");
        assert!(is_valid_traceparent(&traceparent));
    }

    #[test]
    fn rejects_malformed_w3c_traceparent() {
        assert!(!is_valid_traceparent("corr-123"));
        assert!(!is_valid_traceparent(
            "00-00000000000000000000000000000000-1111111111111111-01"
        ));
    }

    #[test]
    fn child_traceparent_keeps_trace_and_flags_but_changes_span() {
        let parent = "00-550e8400e29b41d4a716446655440000-1111111111111111-03";
        let child = build_child_traceparent(parent);
        let parent_parts: Vec<_> = parent.split('-').collect();
        let child_parts: Vec<_> = child.split('-').collect();

        assert_eq!(child_parts[1], parent_parts[1]);
        assert_ne!(child_parts[2], parent_parts[2]);
        assert_eq!(child_parts[3], parent_parts[3]);
        assert!(is_valid_traceparent(&child));
    }
}
