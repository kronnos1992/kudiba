use axum::{
    body::{Body, Bytes},
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use reqwest::Client;

use crate::errors::ProblemDetail;
use crate::server::AppState;

/// Handler de Reverse Proxy para o Core API Server
pub async fn forward_to_core(
    State(state): State<AppState>,
    req: Request,
) -> Response {
    forward_request(&state.http_client, &state.config.core_api_url, req, state.config.max_body_bytes).await
}

/// Handler de Reverse Proxy para o Fiscal Engine Service (AGT Criptografia & Séries)
pub async fn forward_to_fiscal(
    State(state): State<AppState>,
    req: Request,
) -> Response {
    forward_request(&state.http_client, &state.config.fiscal_engine_url, req, state.config.max_body_bytes).await
}

async fn forward_request(client: &Client, base_url: &str, req: Request, max_body_bytes: usize) -> Response {
    let (parts, body) = req.into_parts();
    let path_and_query = parts.uri.path_and_query().map(|pq| pq.as_str()).unwrap_or("");
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
                path_and_query,
                "REQUEST_BODY_LIMIT_EXCEEDED",
            ).into_response();
        }
    };

    // Constrói requisição upstream
    let mut builder = client.request(parts.method, &target_url);

    // Copia headers, filtrando host
    for (k, v) in &parts.headers {
        if k != "host" && k != "content-length" {
            builder = builder.header(k.as_str(), v.as_bytes());
        }
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
                    path_and_query,
                    "UPSTREAM_STREAM_ERROR",
                ).into_response(),
            }
        }
        Err(err) => {
            tracing::error!("Falha de conexão com upstream ({}): {:?}", target_url, err);
            ProblemDetail::new(
                "https://api.kudiba.ao/errors/bad-gateway",
                "Serviço Interno Indisponível",
                StatusCode::BAD_GATEWAY,
                "Não foi possível estabelecer comunicação com o microsserviço no cluster interno.",
                path_and_query,
                "UPSTREAM_COMMUNICATION_ERROR",
            ).into_response()
        }
    }
}
