use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use reqwest::Client;
use std::net::SocketAddr;

use crate::errors::ProblemDetail;
use crate::server::AppState;

/// Handler de Reverse Proxy para o Core API Server
pub async fn forward_to_core(State(state): State<AppState>, req: Request) -> Response {
    forward_request(
        &state.http_client,
        &state.config.core_api_url,
        req,
        state.config.max_body_bytes,
        None,
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
    )
    .await
}

async fn forward_request(
    client: &Client,
    base_url: &str,
    req: Request,
    max_body_bytes: usize,
    path_override: Option<&str>,
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
    let mut builder = client.request(parts.method, &target_url);

    // Copia headers, filtrando host
    for (k, v) in &parts.headers {
        if k != "host" && k != "content-length" && k != "x-forwarded-for" {
            builder = builder.header(k.as_str(), v.as_bytes());
        }
    }
    if let Some(client_ip) = client_ip {
        builder = builder.header("X-Forwarded-For", client_ip);
    }

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
