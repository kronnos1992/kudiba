use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};

/// Estrutura de Erro Oficial em conformidade estrita com a RFC 7807 (Problem Details for HTTP APIs)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProblemDetail {
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
    pub instance: String,
    pub code: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invalid_params: Option<Vec<InvalidParam>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvalidParam {
    pub name: String,
    pub reason: String,
}

impl ProblemDetail {
    pub fn new(
        r#type: impl Into<String>,
        title: impl Into<String>,
        status: StatusCode,
        detail: impl Into<String>,
        instance: impl Into<String>,
        code: impl Into<String>,
    ) -> Self {
        Self {
            r#type: r#type.into(),
            title: title.into(),
            status: status.as_u16(),
            detail: detail.into(),
            instance: instance.into(),
            code: code.into(),
            timestamp: Utc::now().to_rfc3339(),
            invalid_params: None,
        }
    }
}

impl IntoResponse for ProblemDetail {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let mut response = (status, Json(self)).into_response();
        response.headers_mut().insert(
            axum::http::header::CONTENT_TYPE,
            "application/problem+json".parse().unwrap(),
        );
        response
    }
}
