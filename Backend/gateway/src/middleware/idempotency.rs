use axum::{
    body::{to_bytes, Body},
    extract::{Request, State},
    http::{HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::errors::ProblemDetail;
use crate::server::AppState;

#[derive(Serialize, Deserialize)]
struct CachedIdempotentResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

pub async fn idempotency_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let idempotency_key = req
        .headers()
        .get("Idempotency-Key")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    if req.method() != Method::POST || idempotency_key.is_none() {
        return next.run(req).await;
    }

    let key = idempotency_key.unwrap();
    let tenant_id = req
        .headers()
        .get("X-Resolved-Tenant-ID")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("global");

    // A chave de idempotência é rigorosamente escopada por Organização, Método HTTP, Caminho e Chave
    let method = req.method().as_str();
    let path = req.uri().path();
    let redis_key = format!("idempotency:{}:{}:{}:{}", tenant_id, method, path, key);

    let mut redis_conn = match state.get_redis_conn().await {
        Some(c) => c,
        None => return next.run(req).await, // Fail-open se o Redis falhar para não bloquear vendas
    };

    // 1. Tentar adquirir lock exclusivo para esta chave (TTL de 120 segundos)
    let acquired: bool = match redis::cmd("SET")
        .arg(&redis_key)
        .arg("IN_PROGRESS")
        .arg("NX")
        .arg("EX")
        .arg(120)
        .query_async(&mut redis_conn)
        .await
    {
        Ok(val) => val,
        Err(_) => return next.run(req).await,
    };

    if !acquired {
        // Chave já existe: verificar se ainda está em processamento ou concluída
        let val: Option<String> = redis_conn.get(&redis_key).await.ok();
        if let Some(data) = val {
            if data == "IN_PROGRESS" {
                return ProblemDetail::new(
                    "https://api.kudiba.ao/errors/operation-in-progress",
                    "Operação Idempotente em Andamento",
                    StatusCode::CONFLICT, // 409 Conflict
                    "Uma requisição com esta Idempotency-Key já está a ser processada. Aguarde a conclusão.",
                    path,
                    "IDEMPOTENCY_IN_PROGRESS",
                ).into_response();
            }

            // Resposta em cache: devolver replay com header Idempotent-Replay
            if let Ok(cached) = serde_json::from_str::<CachedIdempotentResponse>(&data) {
                let status = StatusCode::from_u16(cached.status).unwrap_or(StatusCode::OK);
                let mut resp = Response::builder().status(status);
                for (k, v) in cached.headers {
                    if let (Ok(hk), Ok(hv)) = (k.parse::<axum::http::HeaderName>(), HeaderValue::from_str(&v)) {
                        resp = resp.header(hk, hv);
                    }
                }
                let mut final_resp = resp.body(Body::from(cached.body)).unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
                final_resp.headers_mut().insert("Idempotent-Replay", HeaderValue::from_static("true"));
                return final_resp;
            }
        }
    }

    // 2. Executar o serviço interno downstream
    let response = next.run(req).await;
    let status = response.status();

    // 3. APENAS respostas bem-sucedidas (2xx) são cacheadas por 24 horas (86400 segundos)
    if status.is_success() {
        let (parts, body) = response.into_parts();
        let bytes = to_bytes(body, state.config.max_body_bytes).await.unwrap_or_default();

        let mut headers_map = HashMap::new();
        for (k, v) in &parts.headers {
            if let Ok(str_val) = v.to_str() {
                headers_map.insert(k.as_str().to_string(), str_val.to_string());
            }
        }

        let cached_obj = CachedIdempotentResponse {
            status: status.as_u16(),
            headers: headers_map,
            body: bytes.to_vec(),
        };

        if let Ok(serialized) = serde_json::to_string(&cached_obj) {
            let _: Result<(), _> = redis_conn.set_ex(&redis_key, serialized, 86400).await;
        }

        Response::from_parts(parts, Body::from(bytes))
    } else {
        // Em caso de erro (4xx ou 5xx), libera o lock para permitir que o cliente corrija o payload e tente novamente
        let _: Result<(), _> = redis_conn.del(&redis_key).await;
        response
    }
}
