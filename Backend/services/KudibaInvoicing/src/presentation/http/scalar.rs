use axum::{response::Html, routing::get, Router};

/// Especificação OpenAPI 3.1 embebida no binário (garante documentação sempre disponível)
const OPENAPI_SPEC: &str = include_str!("../../../docs/KUDIBA_INVOICING_OPENAPI.yaml");

/// Scalar API Reference — substitui o antigo Swagger UI
const SCALAR_HTML: &str = r#"<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KudibaInvoicing — API Reference (Scalar)</title>
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
        "title": "KudibaInvoicing — API Reference (Scalar)"
      }
    }'>
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>"#;

/// Rotas de documentação interativa (Scalar) e da especificação bruta
pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/scalar", get(scalar_handler))
        .route("/scalar/", get(scalar_handler))
        .route("/scalar/{*path}", get(scalar_handler))
        .route("/docs", get(scalar_handler))
        .route("/docs/", get(scalar_handler))
        .route("/docs/{*path}", get(scalar_handler))
        // Compatibilidade: as antigas rotas do Swagger UI redireccionam para o Scalar
        .route(
            "/swagger",
            get(|| async { axum::response::Redirect::permanent("/scalar") }),
        )
        .route(
            "/swagger-ui",
            get(|| async { axum::response::Redirect::permanent("/scalar") }),
        )
        .route(
            "/swagger-ui/",
            get(|| async { axum::response::Redirect::permanent("/scalar") }),
        )
        .route(
            "/swagger-ui/{*path}",
            get(|| async { axum::response::Redirect::permanent("/scalar") }),
        )
        .route("/api-docs/openapi.yaml", get(openapi_yaml_handler))
}

async fn scalar_handler() -> Html<&'static str> {
    Html(SCALAR_HTML)
}

async fn openapi_yaml_handler() -> impl axum::response::IntoResponse {
    (
        [(
            axum::http::header::CONTENT_TYPE,
            "application/yaml; charset=utf-8",
        )],
        OPENAPI_SPEC,
    )
}
