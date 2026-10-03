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
    pub http_client: Client,
}

/// Constrói a pipeline completa de middlewares e roteador Axum do Gateway
pub fn create_router(config: Config, redis_client: redis::Client) -> Router {
    // Pool de cliente HTTP para encaminhamento do Reverse Proxy
    let http_client = Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(200)
        .tcp_keepalive(Duration::from_secs(30))
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Falha ao criar o pool HTTP do cliente reqwest");

    let state = AppState {
        config: Arc::new(config),
        redis_client,
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
    // DOCUMENTAÇÃO INTERATIVA DA API (SWAGGER UI & OPENAPI 3.1)
    // =========================================================================
    let docs_routes = Router::new()
        .route("/swagger-ui", get(swagger_ui_handler))
        .route("/swagger-ui/", get(swagger_ui_handler))
        .route("/swagger-ui/{*path}", get(swagger_ui_handler))
        .route("/swagger", get(|| async { Redirect::permanent("/swagger-ui") }))
        .route("/docs", get(|| async { Redirect::permanent("/swagger-ui") }))
        .route("/api-docs/openapi.yaml", get(openapi_yaml_handler));

    // =========================================================================
    // ROTAS PROTEGIDAS DO ENTRYPOINT (REVERSE PROXY)
    // =========================================================================
    let api_routes = Router::new()
        // Rotas Fiscais de Alta Criticidade (AGT RSA & Séries)
        .route("/api/v1/fiscal/{*path}", any(forward_to_fiscal))
        .route("/api/v1/fiscal", any(forward_to_fiscal))
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
    // JUNÇÃO DAS ROTAS E CAMADAS PERIMÉTRICAS GLOBAIS
    // =========================================================================
    Router::new()
        .merge(infra_routes)
        .merge(docs_routes)
        .merge(api_routes)
        .with_state(state.clone())
        // Camadas globais de rede e transporte
        .layer(axum_mw::from_fn(correlation_id_middleware))
        .layer(TimeoutLayer::new(Duration::from_secs(60)))
        .layer(RequestBodyLimitLayer::new(state.config.max_body_bytes))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
                .expose_headers([
                    "X-Correlation-ID".parse().unwrap(),
                    "X-RateLimit-Limit".parse().unwrap(),
                    "X-RateLimit-Remaining".parse().unwrap(),
                    "X-RateLimit-Reset".parse().unwrap(),
                    "Idempotent-Replay".parse().unwrap(),
                ]),
        )
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "UP",
        "timestamp": Utc::now().to_rfc3339(),
    }))
}

async fn ready_handler(State(state): State<AppState>) -> (StatusCode, Json<serde_json::Value>) {
    let redis_ok = match state.redis_client.get_multiplexed_async_connection().await {
        Ok(_) => true,
        Err(_) => false,
    };

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
// SWAGGER UI & ESPECIFICAÇÃO OPENAPI 3.1
// =============================================================================
const OPENAPI_SPEC: &str = include_str!("../docs/API_GATEWAY_OPENAPI.yaml");

const SWAGGER_UI_HTML: &str = r#"<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kudiba ERP - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.18.2/favicon-32x32.png" sizes="32x32" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .swagger-ui .topbar {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api-docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        displayRequestDuration: true,
        docExpansion: "list",
        filter: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>"#;

async fn openapi_yaml_handler() -> Response {
    Response::builder()
        .header(CONTENT_TYPE, "application/yaml; charset=utf-8")
        .body(Body::from(OPENAPI_SPEC))
        .unwrap()
}

async fn swagger_ui_handler() -> Html<&'static str> {
    Html(SWAGGER_UI_HTML)
}
