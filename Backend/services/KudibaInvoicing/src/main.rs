//! =============================================================================
//! KUDIBA ERP — MOTOR FISCAL E MICROSSERVIÇO DE FACTURAÇÃO (RUST)
//! Conformidade: Decreto Presidencial n.º 71/25 de Angola (AGT)
//!
//! Clean Architecture (Hexagonal/Ports & Adapters) + CQRS + Unit of Work,
//! expondo os mesmos contratos do anterior núcleo .NET:
//!   • REST interno (Axum)    → :9090  (reverse proxy do API Gateway)
//!   • gRPC `kudiba.fiscal.v1` (Tonic) → :9091  (Edge POS e Core API)
//! =============================================================================

mod application;
mod config;
mod domain;
mod infrastructure;
mod presentation;
mod state;

use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::signal;
use tonic::transport::Server;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use domain::ports::crypto_signer::CryptoSigner;
use infrastructure::crypto::rsa_signer::RsaCryptoSigner;
use presentation::grpc::fiscal_engine::fiscal_engine_service_server::FiscalEngineServiceServer;
use presentation::grpc::FiscalGrpcService;
use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // =========================================================================
    // ETAPA 1: LOGS ESTRUTURADOS E TELEMETRIA
    // =========================================================================
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,kudiba_invoicing=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    tracing::info!("==================================================================");
    tracing::info!(
        "Iniciando KudibaInvoicing — Motor Fiscal em RUST (v{})",
        env!("CARGO_PKG_VERSION")
    );
    tracing::info!("Conformidade AGT: Decreto Presidencial n.º 71/25 de Angola");
    tracing::info!("==================================================================");

    // =========================================================================
    // ETAPA 2: CONFIGURAÇÃO DE AMBIENTE E INJEÇÃO DE DEPENDÊNCIAS
    // =========================================================================
    let config = Config::from_env();
    tracing::info!(
        http_port = config.http_port,
        grpc_port = config.grpc_port,
        db_max_connections = config.db_max_connections,
        agt_key_version = %config.agt_key_version,
        "Configurações carregadas com sucesso"
    );

    let pool = config.connect_pool()?;
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => tracing::info!("Ligação ao PostgreSQL (escrita) estabelecida com sucesso."),
        Err(err) => tracing::warn!(
            "Aviso: falha inicial na ligação ao PostgreSQL ({:?}). Motor em modo degradado.",
            err
        ),
    }

    let read_pool = config.connect_read_pool()?;
    if config.database_read_url.is_some() {
        match sqlx::query("SELECT 1").execute(&read_pool).await {
            Ok(_) => tracing::info!("Ligação ao PostgreSQL (read-replica) estabelecida com sucesso."),
            Err(err) => tracing::warn!(
                "Aviso: falha inicial na ligação à read-replica ({:?}). Consultas redirecionadas.",
                err
            ),
        }
    }

    let signer = std::sync::Arc::new(RsaCryptoSigner::from_config(&config)?);
    tracing::info!(
        key_version = %signer.key_version(),
        "Chave RSA-2048 do motor fiscal carregada"
    );

    let app_state = AppState::bootstrap_with_read_pool(config.clone(), pool, read_pool, signer)?;

    // =========================================================================
    // ETAPA 3: WORKER ASSÍNCRONO DA TRANSACTIONAL OUTBOX (MENSAGERIA / AUDITORIA)
    // =========================================================================
    let (outbox_shutdown_tx, outbox_shutdown_rx) = tokio::sync::watch::channel(false);
    let worker = app_state.outbox_worker.clone();
    tokio::spawn(async move {
        worker.run_loop(outbox_shutdown_rx).await;
    });

    // =========================================================================
    // ETAPA 4: SERVIDOR gRPC (CONTRATO kudiba.fiscal.v1)
    // =========================================================================
    let grpc_addr: SocketAddr = ([0, 0, 0, 0], config.grpc_port).into();
    let grpc_service = FiscalGrpcService::new(
        app_state.sign_direct.clone(),
        app_state.verify_signature.clone(),
        app_state.validate_series.clone(),
        app_state.export_saft.clone(),
        app_state.saft_jobs.clone(),
    );

    tokio::spawn(async move {
        tracing::info!(
            "Servidor gRPC FiscalEngineService a escutar em {}",
            grpc_addr
        );
        let result = Server::builder()
            .add_service(FiscalEngineServiceServer::new(grpc_service))
            .serve_with_shutdown(grpc_addr, shutdown_signal())
            .await;

        if let Err(err) = result {
            tracing::error!("Servidor gRPC terminou com erro: {}", err);
        }
    });

    // =========================================================================
    // ETAPA 5: SERVIDOR REST INTERNO (AXUM) COM ENCERRAMENTO GRACIOSO
    // =========================================================================
    let http_addr: SocketAddr = ([0, 0, 0, 0], config.http_port).into();
    let http_listener = TcpListener::bind(http_addr).await?;
    tracing::info!(
        "Servidor REST KudibaInvoicing a escutar em http://{}",
        http_addr
    );
    tracing::info!(
        "Documentação interactiva (Scalar) em http://{}:{}/scalar",
        http_addr.ip(),
        config.http_port
    );

    axum::serve(http_listener, presentation::http::routes::router(app_state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = outbox_shutdown_tx.send(true);
    tracing::info!("KudibaInvoicing encerrado com sucesso.");
    Ok(())
}

/// Encerramento gracioso por SIGINT (Ctrl+C) ou SIGTERM (Docker/Kubernetes)
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
