use axum::{
    extract::{Request, State},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::Utc;
use redis::AsyncCommands;

use crate::errors::ProblemDetail;
use crate::server::AppState;

const SLIDING_WINDOW_LUA: &str = r#"
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, window)
    return {1, limit - currentRequests - 1}
else
    return {0, 0}
end
"#;

pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();

    if is_probe(&path) {
        return next.run(req).await;
    }

    let tenant_id = req
        .headers()
        .get("X-Resolved-Tenant-ID")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous");

    let client_ip = req
        .headers()
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("127.0.0.1");

    let (limit, window_sec) = get_rate_limit_policy(&path);
    let key = format!("ratelimit:{}:{}:{}", tenant_id, client_ip, sanitize_path(&path));
    let now_unix = Utc::now().timestamp();

    // Executa o script Lua atômico via Redis async
    let mut redis_conn = match state.redis_client.get_multiplexed_async_connection().await {
        Ok(conn) => conn,
        Err(_) => {
            // Fail-open resiliente: se o Redis falhar, permite a passagem para não derrubar as vendas
            return next.run(req).await;
        }
    };

    let script = redis::Script::new(SLIDING_WINDOW_LUA);
    let result: Result<(i64, i64), _> = script
        .key(&key)
        .arg(now_unix)
        .arg(window_sec)
        .arg(limit)
        .invoke_async(&mut redis_conn)
        .await;

    match result {
        Ok((allowed, remaining)) => {
            if allowed == 1 {
                let mut response = next.run(req).await;
                response.headers_mut().insert("X-RateLimit-Limit", HeaderValue::from(limit));
                response.headers_mut().insert("X-RateLimit-Remaining", HeaderValue::from(remaining));
                response.headers_mut().insert("X-RateLimit-Reset", HeaderValue::from(now_unix + window_sec));
                response
            } else {
                let mut problem_resp = ProblemDetail::new(
                    "https://api.kudiba.ao/errors/rate-limit-exceeded",
                    "Cota de Requisições Ultrapassada",
                    StatusCode::TOO_MANY_REQUESTS,
                    format!("O limite de {} requisições por {} segundos para este recurso foi excedido.", limit, window_sec),
                    path,
                    "RATE_LIMIT_EXCEEDED",
                ).into_response();

                problem_resp.headers_mut().insert("Retry-After", HeaderValue::from(window_sec));
                problem_resp
            }
        }
        Err(_) => next.run(req).await,
    }
}

fn get_rate_limit_policy(path: &str) -> (i64, i64) {
    if path.contains("/auth/") {
        (10, 60) // 10 req/min para login
    } else if path.contains("/fiscal/invoices") {
        (120, 60) // 120 emissões/min por tenant
    } else if path.contains("/sync/pos/") {
        (60, 60) // 60 syncs/min
    } else {
        (600, 60) // 600 req/min geral
    }
}

fn sanitize_path(path: &str) -> &'static str {
    if path.contains("/auth") {
        "auth"
    } else if path.contains("/fiscal") {
        "fiscal"
    } else if path.contains("/sync") {
        "sync"
    } else {
        "general"
    }
}

fn is_probe(path: &str) -> bool {
    path == "/health" || path == "/ready" || path == "/metrics"
}
