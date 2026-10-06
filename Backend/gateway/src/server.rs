use axum::{
    body::Body,
    extract::State,
    http::{header::CONTENT_TYPE, StatusCode},
    middleware as axum_mw,
    response::{Html, IntoResponse, Json, Redirect, Response},
    routing::{any, get},
    Router,
};
use chrono::Utc;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;

use crate::config::Config;
use crate::middleware::{
    auth::auth_middleware,
    contingency::agt_contingency_middleware,
    correlation::correlation_id_middleware,
    idempotency::idempotency_middleware,
    ratelimit::rate_limit_middleware,
    tenant::tenant_resolver_middleware,
};
use crate::proxy::{forward_to_core, forward_to_fiscal};

/// Estado global compartilhado entre os handlers e middlewares do Gateway
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub redis_client: redis::Client,
    pub redis_conn: Option<redis::aio::ConnectionManager>,
    pub http_client: Client,
}

impl AppState {
    pub async fn get_redis_conn(&self) -> Option<redis::aio::ConnectionManager> {
        if let Some(conn) = &self.redis_conn {
            Some(conn.clone())
        } else {
            // Tenta inicializar sob demanda caso tenha falhado no startup
            redis::aio::ConnectionManager::new(self.redis_client.clone()).await.ok()
        }
    }
}

/// Constrói a pipeline completa de middlewares e roteador Axum do Gateway
pub fn create_router(
    config: Config,
    redis_client: redis::Client,
    redis_conn: Option<redis::aio::ConnectionManager>,
) -> Router {
    // Pool de cliente HTTP para encaminhamento do Reverse Proxy
    let http_client = Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(200)
        .tcp_keepalive(Duration::from_secs(30))
        .timeout(config.read_timeout)
        .build()
        .expect("Falha ao criar o pool HTTP do cliente reqwest");

    let state = AppState {
        config: Arc::new(config),
        redis_client,
        redis_conn,
        http_client,
    };

    // =========================================================================
    // ROTAS DE INFRAESTRUTURA E OBSERVABILIDADE (PÚBLICAS)
    // =========================================================================
    let infra_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/ready", get(ready_handler))
        .route("/metrics", get(metrics_handler));

    // =========================================================================
    // DOCUMENTAÇÃO INTERATIVA DA API (SCALAR API REFERENCE & OPENAPI 3.1)
    // =========================================================================
    let docs_routes = Router::new()
        .route("/scalar", get(scalar_handler))
        .route("/scalar/", get(scalar_handler))
        .route("/scalar/{*path}", get(scalar_handler))
        .route("/docs", get(scalar_handler))
        .route("/docs/", get(scalar_handler))
        .route("/docs/{*path}", get(scalar_handler))
        .route("/swagger-ui", get(|| async { Redirect::permanent("/scalar") }))
        .route("/swagger-ui/", get(|| async { Redirect::permanent("/scalar") }))
        .route("/swagger-ui/{*path}", get(|| async { Redirect::permanent("/scalar") }))
        .route("/swagger", get(|| async { Redirect::permanent("/scalar") }))
        .route("/api-docs/openapi.yaml", get(openapi_yaml_handler));

    // =========================================================================
    // ROTAS DE AUTENTICAÇÃO E SESSÕES (PÚBLICAS / CORE API)
    // =========================================================================
    let auth_routes = Router::new()
        .route("/auth/{*path}", any(forward_to_core))
        .route("/auth", any(forward_to_core))
        .layer(axum_mw::from_fn_with_state(state.clone(), rate_limit_middleware))
        .layer(axum_mw::from_fn(tenant_resolver_middleware));

    // =========================================================================
    // ROTAS PROTEGIDAS DO ENTRYPOINT (REVERSE PROXY)
    // =========================================================================
    let api_routes = Router::new()
        // Rotas Fiscais de Alta Criticidade e Facturação (KudibaInvoicing)
        .route("/api/v1/fiscal/{*path}", any(forward_to_fiscal))
        .route("/api/v1/fiscal", any(forward_to_fiscal))
        .route("/api/v1/invoices/{*path}", any(forward_to_fiscal))
        .route("/api/v1/invoices", any(forward_to_fiscal))
        // Rotas de Sincronização POS (Edge Tauri) e Módulos Comerciais
        .route("/api/v1/{*path}", any(forward_to_core))
        .route("/api/v1", any(forward_to_core))
        // Encadeamento de Middlewares de Negócio e Segurança (executados em ordem)
        .layer(axum_mw::from_fn_with_state(state.clone(), idempotency_middleware))
        .layer(axum_mw::from_fn_with_state(state.clone(), agt_contingency_middleware))
        .layer(axum_mw::from_fn_with_state(state.clone(), auth_middleware))
        .layer(axum_mw::from_fn_with_state(state.clone(), rate_limit_middleware))
        .layer(axum_mw::from_fn(tenant_resolver_middleware));

    // =========================================================================
    // CONFIGURAÇÃO DINÂMICA DE CORS
    // =========================================================================
    let cors_layer = if state.config.allowed_origins == "*" {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let origins: Vec<_> = state
            .config
            .allowed_origins
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(Any)
            .allow_headers(Any)
            .allow_credentials(true)
    }
    .expose_headers([
        "X-Correlation-ID".parse().unwrap(),
        "X-RateLimit-Limit".parse().unwrap(),
        "X-RateLimit-Remaining".parse().unwrap(),
        "X-RateLimit-Reset".parse().unwrap(),
        "Idempotent-Replay".parse().unwrap(),
    ]);

    // =========================================================================
    // JUNÇÃO DAS ROTAS E CAMADAS PERIMÉTRICAS GLOBAIS
    // =========================================================================
    Router::new()
        .merge(infra_routes)
        .merge(docs_routes)
        .merge(auth_routes)
        .merge(api_routes)
        .with_state(state.clone())
        // Camadas globais de rede e transporte
        .layer(axum_mw::from_fn(correlation_id_middleware))
        .layer(TimeoutLayer::new(state.config.write_timeout))
        .layer(RequestBodyLimitLayer::new(state.config.max_body_bytes))
        .layer(cors_layer)
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "UP",
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn ready_handler(State(state): State<AppState>) -> (StatusCode, Json<serde_json::Value>) {
    let mut redis_ok = false;
    if let Some(mut conn) = state.get_redis_conn().await {
        redis_ok = redis::cmd("PING").query_async::<String>(&mut conn).await.is_ok();
    }

    if redis_ok {
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "READY",
                "redis": "CONNECTED",
            })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "status": "NOT_READY",
                "redis": "DISCONNECTED",
            })),
        )
    }
}

async fn metrics_handler() -> String {
    "# HELP http_requests_total Total number of HTTP requests processed.\n\
     # TYPE http_requests_total counter\n\
     http_requests_total{status=\"200\"} 0\n"
        .to_string()
}

// =============================================================================
// SCALAR API REFERENCE & ESPECIFICAÇÃO OPENAPI 3.1
// =============================================================================
const OPENAPI_SPEC: &str = include_str!("../docs/API_GATEWAY_OPENAPI.yaml");

const SCALAR_HTML: &str = r#"<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kudiba ERP — API Reference (Scalar)</title>
  <link rel="icon" type="image/svg+xml" href="https://scalar.com/favicon.svg" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f0f13;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    type="application/json"
    data-url="/api-docs/openapi.yaml"
    data-configuration='{
      "theme": "purple",
      "layout": "modern",
      "showSidebar": true,
      "darkMode": true,
      "searchHotKey": "k",
      "metaData": {
        "title": "Kudiba ERP — API Reference (Scalar)"
      }
    }'>
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>"#;

async fn openapi_yaml_handler() -> Response {
    Response::builder()
        .header(CONTENT_TYPE, "application/yaml; charset=utf-8")
        .body(Body::from(OPENAPI_SPEC))
        .unwrap()
}

async fn scalar_handler() -> Html<&'static str> {
    Html(SCALAR_HTML)
}
