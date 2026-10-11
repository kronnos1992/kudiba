use std::net::SocketAddr;
use std::time::Duration;
use tokio::signal;
use tracing::info;

use kudiba_inventory::config::Config;
use kudiba_inventory::presentation::http::create_router;
use kudiba_inventory::state::AppState;

const MAX_DB_CONNECT_ATTEMPTS: u32 = 10;
const DB_CONNECT_RETRY_DELAY: Duration = Duration::from_secs(5);

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kudiba_inventory=info,tower_http=info".into()),
        )
        .init();

    info!("Iniciando KudibaInventory Service (Fase 2)...");

    let config = Config::from_env();
    let pool = connect_with_retry(&config).await?;

    let app_state = AppState::new(config.clone(), pool);

    let (event_shutdown_tx, event_shutdown_rx) = tokio::sync::watch::channel(false);
    let event_consumer = app_state.event_consumer.clone();
    tokio::spawn(async move {
        event_consumer.run_loop(event_shutdown_rx).await;
    });

    let app = create_router(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.http_port));
    info!("KudibaInventory escutando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = event_shutdown_tx.send(true);
    info!("KudibaInventory encerrado com sucesso.");
    Ok(())
}

async fn connect_with_retry(config: &Config) -> Result<sqlx::PgPool, sqlx::Error> {
    let mut attempt = 1;
    loop {
        match config.create_db_pool().await {
            Ok(pool) => {
                info!("Pool de conexões PostgreSQL estabelecido com sucesso.");
                return Ok(pool);
            }
            Err(err) if attempt < MAX_DB_CONNECT_ATTEMPTS => {
                tracing::warn!(
                    attempt,
                    max_attempts = MAX_DB_CONNECT_ATTEMPTS,
                    "Não foi possível ligar ao PostgreSQL ({}). Nova tentativa em {}s.",
                    err,
                    DB_CONNECT_RETRY_DELAY.as_secs()
                );
                attempt += 1;
                tokio::time::sleep(DB_CONNECT_RETRY_DELAY).await;
            }
            Err(err) => return Err(err),
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("falha ao instalar handler de Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("falha ao instalar handler de SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
