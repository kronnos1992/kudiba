use axum::{
    extract::{ConnectInfo, Request},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use std::time::Instant;

/// Middleware de auditoria e logging perimétrico de todas as ações e requisições HTTP
pub async fn access_log_middleware(req: Request, next: Next) -> Response {
    let start = Instant::now();
    crate::metrics::request_started();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();

    let client_ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip().to_string())
        .or_else(|| {
            req.headers()
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        })
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let correlation_id = req
        .headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("none")
        .to_string();

    let tenant_id = req
        .headers()
        .get("x-tenant-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("none")
        .to_string();

    let user_id = req
        .headers()
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string();

    let use_case = classify_use_case(method.as_str(), &path);

    let response = next.run(req).await;
    let elapsed_duration = start.elapsed();
    let elapsed = elapsed_duration.as_millis();
    let status = response.status().as_u16();
    crate::metrics::record(status, elapsed_duration);

    if status >= 500 {
        tracing::error!(
            target: "audit::action",
            method = %method,
            path = %path,
            status = status,
            elapsed_ms = elapsed,
            client_ip = %client_ip,
            tenant_id = %tenant_id,
            user_id = %user_id,
            correlation_id = %correlation_id,
            use_case = %use_case,
            "[AUDIT_ERROR] Ação falhou com erro de servidor interno"
        );
    } else if status >= 400 {
        tracing::warn!(
            target: "audit::action",
            method = %method,
            path = %path,
            status = status,
            elapsed_ms = elapsed,
            client_ip = %client_ip,
            tenant_id = %tenant_id,
            user_id = %user_id,
            correlation_id = %correlation_id,
            use_case = %use_case,
            "[AUDIT_WARN] Ação rejeitada ou inválida"
        );
    } else {
        tracing::info!(
            target: "audit::action",
            method = %method,
            path = %path,
            status = status,
            elapsed_ms = elapsed,
            client_ip = %client_ip,
            tenant_id = %tenant_id,
            user_id = %user_id,
            correlation_id = %correlation_id,
            use_case = %use_case,
            "[AUDIT_ACTION] Ação executada com sucesso"
        );
    }

    response
}

fn classify_use_case(method: &str, path: &str) -> &'static str {
    if path.starts_with("/health") || path.starts_with("/metrics") {
        return "INFRA_HEALTHCHECK";
    }
    if path.starts_with("/auth/login") || path.starts_with("/api/v1/auth/login") {
        return "AUTH_LOGIN";
    }
    if path.starts_with("/auth/refresh") || path.starts_with("/api/v1/auth/refresh") {
        return "AUTH_TOKEN_REFRESH";
    }
    if path.contains("/invoices") || path.contains("/fiscal") {
        return match method {
            "POST" => "FATURACAO_EMISSAO_DOCUMENTO",
            "PUT" | "PATCH" => "FATURACAO_RETIFICACAO",
            "DELETE" => "FATURACAO_TENTATIVA_ANULACAO",
            _ => "FATURACAO_CONSULTA",
        };
    }
    if path.contains("/treasury/receipts") {
        return match method {
            "POST" => "TESOURARIA_EMISSAO_RECIBO_RC",
            _ => "TESOURARIA_CONSULTA_RECIBOS",
        };
    }
    if path.contains("/treasury/sessions") {
        return match method {
            "POST" => "TESOURARIA_SESSAO_CAIXA_OPERACAO",
            _ => "TESOURARIA_CONSULTA_SESSOES",
        };
    }
    if path.contains("/treasury/movements") {
        return "TESOURARIA_MOVIMENTO_CAIXA";
    }
    if path.contains("/treasury/bank-accounts") {
        return match method {
            "POST" => "TESOURARIA_CONTA_BANCARIA_CRIACAO",
            _ => "TESOURARIA_CONSULTA_CONTAS_BANCARIAS",
        };
    }
    if path.contains("/inventory/movements") || path.contains("/inventory/transfers") {
        return match method {
            "POST" => "STOCK_MOVIMENTO_TRANSFERENCIA",
            _ => "STOCK_CONSULTA_MOVIMENTOS",
        };
    }
    if path.contains("/inventory/items") || path.contains("/inventory/catalog") {
        return match method {
            "POST" => "STOCK_ARTIGO_CRIACAO",
            "PUT" | "PATCH" => "STOCK_ARTIGO_ATUALIZACAO",
            _ => "STOCK_CONSULTA_CATALOGO",
        };
    }
    if path.contains("/payroll/periods") && path.contains("/calculate") {
        return "SALARIOS_CALCULO_FOLHA";
    }
    if path.contains("/payroll/periods") && path.contains("/close") {
        return "SALARIOS_FECHO_PERIODO";
    }
    if path.contains("/payroll/payslips") {
        return match method {
            "POST" => "SALARIOS_RECIBOS_VENCIMENTO_GERACAO",
            _ => "SALARIOS_CONSULTA_RECIBOS",
        };
    }
    if path.contains("/accounting/entries") {
        return match method {
            "POST" => "CONTABILIDADE_LANCAMENTO_DIARIO",
            _ => "CONTABILIDADE_CONSULTA_DIARIO",
        };
    }
    if path.contains("/accounting/fiscal-years") {
        return match method {
            "POST" => "CONTABILIDADE_EXERCICIO_FISCAL",
            _ => "CONTABILIDADE_CONSULTA_EXERCICIOS",
        };
    }
    if path.contains("/backoffice/subscriptions") || path.contains("/backoffice/licenses") {
        return match method {
            "POST" => "BACKOFFICE_LICENCA_EMISSAO",
            _ => "BACKOFFICE_CONSULTA_CLIENTES",
        };
    }
    if path.contains("/auth/users") || path.contains("/auth/roles") {
        return match method {
            "POST" | "PUT" | "PATCH" | "DELETE" => "SEGURANCA_GESTAO_UTILIZADORES_PAPEIS",
            _ => "SEGURANCA_CONSULTA_UTILIZADORES",
        };
    }

    match method {
        "POST" => "SISTEMA_CRIACAO_REGISTO",
        "PUT" | "PATCH" => "SISTEMA_ATUALIZACAO_REGISTO",
        "DELETE" => "SISTEMA_REMOCAO_REGISTO",
        _ => "SISTEMA_CONSULTA",
    }
}
