use axum::{
    extract::Request,
    http::HeaderValue,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

/// Middleware de injeção e propagação de X-Correlation-ID para rastreabilidade
pub async fn correlation_id_middleware(mut req: Request, next: Next) -> Response {
    let correlation_id = req
        .headers()
        .get("X-Correlation-ID")
        .and_then(|val| val.to_str().ok().map(|s| s.to_string()))
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if let Ok(header_val) = HeaderValue::from_str(&correlation_id) {
        req.headers_mut().insert("X-Correlation-ID", header_val.clone());
        let mut response = next.run(req).await;
        response.headers_mut().insert("X-Correlation-ID", header_val);
        response
    } else {
        next.run(req).await
    }
}
