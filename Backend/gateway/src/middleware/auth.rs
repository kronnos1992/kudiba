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
use crate::middleware::is_public_path;
use crate::server::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct KudibaClaims {
    pub sub: String,
    pub tenant_id: String,
    pub tenant_slug: Option<String>,
    pub branch_id: Option<String>,
    pub roles: Vec<String>,
    pub exp: usize,
    #[serde(default)]
    pub iat: Option<usize>,
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

    // 1. Validação Criptográfica do Token JWT usando segredo configurado no ambiente
    let key = DecodingKey::from_secret(state.config.jwt_secret.as_bytes());
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
        let is_revoked = match state.get_redis_conn().await {
            Some(mut redis_conn) => match redis_conn
                .exists::<_, bool>(format!("jwt:blacklist:{}", jti))
                .await
            {
                Ok(is_revoked) => is_revoked,
                Err(_) => {
                    return ProblemDetail::new(
                        "https://api.kudiba.ao/errors/auth-state-unavailable",
                        "Serviço de Autenticação Indisponível",
                        StatusCode::SERVICE_UNAVAILABLE,
                        "Não foi possível verificar o estado de revogação da sessão.",
                        path,
                        "AUTH_STATE_UNAVAILABLE",
                    )
                    .into_response();
                }
            },
            None => {
                return ProblemDetail::new(
                    "https://api.kudiba.ao/errors/auth-state-unavailable",
                    "Serviço de Autenticação Indisponível",
                    StatusCode::SERVICE_UNAVAILABLE,
                    "Não foi possível verificar o estado de revogação da sessão.",
                    path,
                    "AUTH_STATE_UNAVAILABLE",
                )
                .into_response();
            }
        };

        if is_revoked {
            return ProblemDetail::new(
                "https://api.kudiba.ao/errors/token-revoked",
                "Sessão Encerrada",
                StatusCode::UNAUTHORIZED,
                "Este token foi revogado via logout anterior e não pode ser reutilizado.",
                path,
                "AUTH_TOKEN_REVOKED",
            )
            .into_response();
        }
    }

    // 2b. Verificar se a sessão foi revogada por alteração de papéis:
    // qualquer token emitido antes do instante de revogação do utilizador/tenant é rejeitado.
    if let Some(iat) = claims.iat {
        let revoked_before = match state.get_redis_conn().await {
            Some(mut redis_conn) => {
                let key = format!("jwt:revoked-before:{}:{}", claims.sub, claims.tenant_id);
                match redis_conn.get::<_, Option<String>>(key).await {
                    Ok(value) => value.and_then(|raw| raw.parse::<u64>().ok()),
                    Err(_) => {
                        return ProblemDetail::new(
                            "https://api.kudiba.ao/errors/auth-state-unavailable",
                            "Serviço de Autenticação Indisponível",
                            StatusCode::SERVICE_UNAVAILABLE,
                            "Não foi possível verificar o estado de revogação da sessão.",
                            path,
                            "AUTH_STATE_UNAVAILABLE",
                        )
                        .into_response();
                    }
                }
            }
            None => {
                return ProblemDetail::new(
                    "https://api.kudiba.ao/errors/auth-state-unavailable",
                    "Serviço de Autenticação Indisponível",
                    StatusCode::SERVICE_UNAVAILABLE,
                    "Não foi possível verificar o estado de revogação da sessão.",
                    path,
                    "AUTH_STATE_UNAVAILABLE",
                )
                .into_response();
            }
        };

        if let Some(revoked_before) = revoked_before {
            if (iat as u64) < revoked_before {
                return ProblemDetail::new(
                    "https://api.kudiba.ao/errors/token-revoked",
                    "Sessão Encerrada",
                    StatusCode::UNAUTHORIZED,
                    "As permissões desta sessão foram alteradas e o token foi revogado por segurança.",
                    path,
                    "AUTH_TOKEN_REVOKED",
                )
                .into_response();
            }
        }
    }

    // 3. Validação Cruzada de Tenant:
    // O tenant resolvido (UUID ou slug) deve corresponder ao tenant do JWT
    let resolved_tenant = req.headers().get("X-Resolved-Tenant-ID").and_then(|h| h.to_str().ok());
    let resolved_slug = req.headers().get("X-Resolved-Tenant-Slug").and_then(|h| h.to_str().ok());

    let mut tenant_matches = false;
    if let Some(res_t) = resolved_tenant {
        if res_t == claims.tenant_id || claims.tenant_slug.as_deref() == Some(res_t) {
            tenant_matches = true;
        }
    }
    if !tenant_matches {
        if let Some(res_s) = resolved_slug {
            if claims.tenant_slug.as_deref() == Some(res_s) || res_s == claims.tenant_id {
                tenant_matches = true;
            }
        }
    }

    if resolved_tenant.is_some() && !tenant_matches {
        return ProblemDetail::new(
            "https://api.kudiba.ao/errors/tenant-mismatch",
            "Conflito de Organização",
            StatusCode::FORBIDDEN,
            "O identificador de organização do token não corresponde ao recurso ou subdomínio solicitado.",
            path,
            "TENANT_CROSS_VALIDATION_FAILED",
        ).into_response();
    }

    // Garante que o header downstream contenha o UUID canônico do tenant
    if let Ok(tenant_uuid_val) = HeaderValue::from_str(&claims.tenant_id) {
        req.headers_mut().insert("X-Resolved-Tenant-ID", tenant_uuid_val);
    }

    // 4. Injeta cabeçalhos autenticados seguros para os serviços internos downstream
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

#[cfg(test)]
mod tests {
    use super::KudibaClaims;

    #[test]
    fn claims_sem_iat_continuam_desserializaveis() {
        let json = r#"{"sub":"u1","tenant_id":"t1","roles":["ADMIN"],"exp":999,"jti":"j1"}"#;
        let claims: KudibaClaims = serde_json::from_str(json).expect("deve desserializar claims legadas");
        assert_eq!(claims.iat, None);
    }

    #[test]
    fn claims_com_iat_sao_lidas_para_verificacao_de_revogacao() {
        let json = r#"{"sub":"u1","tenant_id":"t1","roles":["ADMIN"],"exp":999,"iat":123,"jti":"j1"}"#;
        let claims: KudibaClaims = serde_json::from_str(json).expect("deve desserializar claims com iat");
        assert_eq!(claims.iat, Some(123));
    }
}
