use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::signal;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod errors;
mod middleware;
mod proxy;
mod server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // =========================================================================
    // ETAPA 1: INICIALIZAÇÃO DE LOGS ESTRUTURADOS E TELEMETRIA
    // =========================================================================
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,kudiba_gateway=debug".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    tracing::info!("==================================================================");
    tracing::info!("Iniciando Kudiba ERP - API Gateway Entrypoint em RUST (v1.0.0)");
    tracing::info!("Conformidade AGT: Decreto Presidencial n.º 71/25 de Angola");
    tracing::info!("==================================================================");

    // =========================================================================
    // ETAPA 2: CARREGAMENTO DE CONFIGURAÇÕES DE AMBIENTE
    // =========================================================================
    let cfg = config::Config::from_env();
    tracing::info!(
        port = cfg.port,
        env = %cfg.env,
        core_api = %cfg.core_api_url,
        fiscal_engine = %cfg.fiscal_engine_url,
        agt_max_contingency_days = cfg.agt_contingency_max_days,
        "Configurações carregadas com sucesso"
    );

    // =========================================================================
    // ETAPA 3: CONEXÃO COM A CAMADA DE ESTADO PERIMÉTRICO (REDIS 7+)
    // =========================================================================
    tracing::info!("Conectando ao cluster Redis...");
    let redis_client = redis::Client::open(cfg.redis_url.clone())
        .expect("URL de conexão Redis inválida");

    match redis_client.get_multiplexed_async_connection().await {
        Ok(_) => tracing::info!("Conexão com Redis estabelecida com sucesso."),
        Err(err) => tracing::warn!("Aviso: Falha inicial com Redis ({:?}). Gateway operando em modo degradado.", err),
    }

    // =========================================================================
    // ETAPA 4: MONTAGEM DA PIPELINE DE EXECUÇÃO E ROTEAMENTO AXUM
    // =========================================================================
    let app = server::create_router(cfg.clone(), redis_client);

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    tracing::info!("Servidor escutando em http://{}", addr);

    let listener = TcpListener::bind(addr).await?;

    // =========================================================================
    // ETAPA 5: EXECUÇÃO DO SERVIDOR COM GRACEFUL SHUTDOWN
    // =========================================================================
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("API Gateway encerrado com sucesso.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("falha ao instalar o handler Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("falha ao instalar o handler SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Recebido sinal SIGINT (Ctrl+C). Iniciando encerramento gracioso...");
        },
        _ = terminate => {
            tracing::info!("Recebido sinal SIGTERM (Docker/K8s). Iniciando encerramento gracioso...");
        },
    }
}
