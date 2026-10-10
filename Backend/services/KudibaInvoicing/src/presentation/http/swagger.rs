use axum::{response::Html, routing::get, Router};

/// Especificação OpenAPI 3.1 embebida no binário (garante documentação sempre disponível)
const OPENAPI_SPEC: &str = include_str!("../../../docs/KUDIBA_INVOICING_OPENAPI.yaml");

/// Swagger UI — interface de documentação interactiva
const SWAGGER_HTML: &str = r##"<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KudibaInvoicing — API Reference (Swagger UI)</title>
  <link rel="icon" type="image/svg+xml" href="https://swagger.io/favicon.png" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api-docs/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>"##;

/// Rotas de documentação interactiva (Swagger UI) e da especificação bruta
pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/swagger", get(swagger_handler))
        .route("/swagger/", get(swagger_handler))
        .route("/swagger/{*path}", get(swagger_handler))
        .route("/docs", get(swagger_handler))
        .route("/docs/", get(swagger_handler))
        .route("/docs/{*path}", get(swagger_handler))
        .route("/swagger-ui", get(swagger_handler))
        .route("/swagger-ui/", get(swagger_handler))
        .route("/swagger-ui/{*path}", get(swagger_handler))
        // Compatibilidade: a antiga Scalar API Reference redirecciona para o Swagger UI
        .route(
            "/scalar",
            get(|| async { axum::response::Redirect::permanent("/swagger") }),
        )
        .route(
            "/scalar/",
            get(|| async { axum::response::Redirect::permanent("/swagger") }),
        )
        .route(
            "/scalar/{*path}",
            get(|| async { axum::response::Redirect::permanent("/swagger") }),
        )
        .route("/api-docs/openapi.yaml", get(openapi_yaml_handler))
}

async fn swagger_handler() -> Html<&'static str> {
    Html(SWAGGER_HTML)
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
