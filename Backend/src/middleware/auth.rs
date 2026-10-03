use axum::{
    extract::{Request, State},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

use crate::errors::ProblemDetail;
use crate::server::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct KudibaClaims {
    pub sub: String,
    pub tenant_id: String,
    pub branch_id: Option<String>,
    pub roles: Vec<String>,
    pub exp: usize,
    pub jti: Option<String>,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();

    if is_public_path(&path) {
        return next.run(req).await;
    }

    let auth_header = match req.headers().get("Authorization").and_then(|h| h.to_str().ok()) {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/unauthorized",
                "Não Autorizado",
                StatusCode::UNAUTHORIZED,
                "Cabeçalho de Autorização ausente ou em formato inválido. Utilize 'Bearer <token>'.",
                path,
                "AUTH_TOKEN_MISSING",
            ).into_response();
        }
    };

    // 1. Validação Criptográfica do Token JWT
    let key = DecodingKey::from_secret(b"kudiba_jwt_secret_development_key_change_in_production_2026");
    let validation = Validation::default();

    let token_data = match decode::<KudibaClaims>(auth_header, &key, &validation) {
        Ok(data) => data,
        Err(_) => {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/invalid-token",
                "Token Inválido ou Expirado",
                StatusCode::UNAUTHORIZED,
                "A assinatura do token não confere ou o prazo de validade expirou.",
                path,
                "AUTH_TOKEN_INVALID",
            ).into_response();
        }
    };

    let claims = token_data.claims;

    // 2. Verificar se o JTI está na Blacklist do Redis (ex: logout recente)
    if let Some(jti) = &claims.jti {
        if let Ok(mut redis_conn) = state.redis_client.get_multiplexed_async_connection().await {
            let is_revoked: bool = redis_conn
                .exists(format!("jwt:blacklist:{}", jti))
                .await
                .unwrap_or(false);

            if is_revoked {
                return ProblemDetail::new(
                    "https://api.kudiba.ao/errors/token-revoked",
                    "Sessão Encerrada",
                    StatusCode::UNAUTHORIZED,
                    "Este token foi revogado via logout anterior e não pode ser reutilizado.",
                    path,
                    "AUTH_TOKEN_REVOKED",
                ).into_response();
            }
        }
    }

    // 3. Validação Cruzada de Tenant: o tenant do JWT deve coincidir com o tenant resolvido
    if let Some(resolved_tenant) = req.headers().get("X-Resolved-Tenant-ID").and_then(|h| h.to_str().ok()) {
        if resolved_tenant != claims.tenant_id {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/tenant-mismatch",
                "Conflito de Organização",
                StatusCode::FORBIDDEN,
                "O identificador de organização do token não corresponde ao recurso solicitado.",
                path,
                "TENANT_CROSS_VALIDATION_FAILED",
            ).into_response();
        }
    }

    // 4. Injeta cabeçalhos autenticados para os serviços internos downstream
    if let Ok(sub_val) = HeaderValue::from_str(&claims.sub) {
        req.headers_mut().insert("X-Resolved-User-ID", sub_val);
    }
    if let Ok(roles_val) = HeaderValue::from_str(&claims.roles.join(",")) {
        req.headers_mut().insert("X-Resolved-Roles", roles_val);
    }
    if let Some(branch) = claims.branch_id {
        if let Ok(branch_val) = HeaderValue::from_str(&branch) {
            req.headers_mut().insert("X-Resolved-Branch-ID", branch_val);
        }
    }

    next.run(req).await
}

fn is_public_path(path: &str) -> bool {
    let public_paths = [
        "/health",
        "/ready",
        "/metrics",
        "/auth/login",
        "/auth/refresh",
        "/auth/.well-known/jwks.json",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/.well-known/jwks.json",
    ];
    public_paths.contains(&path)
}
