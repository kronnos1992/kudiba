use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use axum::serve;
use tokio::net::TcpListener;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

use kudiba_hardware_bridge::domain::error::DeviceError;
use kudiba_hardware_bridge::domain::port::{
    DrawerPort, JobRepository, PrinterPort, TransportOutcome,
};
use kudiba_hardware_bridge::infrastructure::api::BridgeState;
use kudiba_hardware_bridge::infrastructure::credential::CredentialStore;
use kudiba_hardware_bridge::infrastructure::escp::{self, EscPosProfile};
use kudiba_hardware_bridge::infrastructure::sqlite::SqliteJobRepository;
use kudiba_hardware_bridge::infrastructure::tcp_printer::RawTcpPrinter;

struct PrinterDrawer {
    printer: Arc<dyn PrinterPort>,
    profile: EscPosProfile,
}

#[async_trait::async_trait]
impl DrawerPort for PrinterDrawer {
    async fn open(&self) -> Result<TransportOutcome, DeviceError> {
        self.printer
            .print_bytes(&escp::drawer_pulse(&self.profile))
            .await
    }
}

fn default_db_file() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".kudiba/bridge-jobs.sqlite3")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();

    kudiba_hardware_bridge::infrastructure::api::initialize_print_signing_secret()?;

    let env_token = env::var("KUDIBA_BRIDGE_TOKEN")
        .ok()
        .filter(|value| !value.is_empty());
    let credential_path = env::var("KUDIBA_BRIDGE_CREDENTIAL_FILE")
        .ok()
        .map(PathBuf::from)
        .or_else(|| {
            env::var("HOME")
                .ok()
                .map(|home| PathBuf::from(home).join(".kudiba/bridge-device.json"))
        });
    let credentials = Arc::new(CredentialStore::new(env_token.clone(), credential_path)?);
    if let Some(code) = credentials.pending_code() {
        tracing::warn!(code = %code, "emparelhe o terminal no POS com este código (válido 5 minutos)");
    } else if credentials.status().locked {
        tracing::warn!(
            lockout_until = ?credentials.status().lockout_until,
            "emparelhamento temporariamente bloqueado após tentativas falhadas"
        );
    } else if env_token.is_some() {
        tracing::warn!(
            "agente a usar KUDIBA_BRIDGE_TOKEN estático; rotação de credencial desativada"
        );
    }

    let port = env::var("KUDIBA_BRIDGE_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(17842);
    let printer_host = env::var("KUDIBA_PRINTER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let printer_port = env::var("KUDIBA_PRINTER_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(9100);
    let columns = env::var("KUDIBA_ESC_POS_COLUMNS")
        .ok()
        .and_then(|value| value.parse::<u8>().ok())
        .unwrap_or(48);

    let profile = EscPosProfile {
        columns,
        ..EscPosProfile::default()
    };
    let printer: Arc<dyn PrinterPort> = Arc::new(RawTcpPrinter::new(printer_host, printer_port));
    let drawer: Arc<dyn DrawerPort> = Arc::new(PrinterDrawer {
        printer: printer.clone(),
        profile: profile.clone(),
    });
    let db_file = env::var("KUDIBA_BRIDGE_DB_FILE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(default_db_file);
    let repository: Arc<dyn JobRepository> = Arc::new(SqliteJobRepository::new(&db_file)?);

    let state = BridgeState {
        printer,
        drawer,
        repository,
        credentials,
        profile,
    };

    let listener = TcpListener::bind(("127.0.0.1", port)).await?;
    tracing::info!("agente de hardware local a escutar em 127.0.0.1:{port}");
    serve(
        listener,
        kudiba_hardware_bridge::infrastructure::api::router(state),
    )
    .await?;
    Ok(())
}
