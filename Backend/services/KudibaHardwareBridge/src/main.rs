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
    CloudBootstrapPort, DrawerPort, JobRepository, PrinterPort, ScannerPort, SeedRepository,
    TransportOutcome,
};
use kudiba_hardware_bridge::infrastructure::api::BridgeState;
use kudiba_hardware_bridge::infrastructure::cloud::HttpCloudBootstrap;
use kudiba_hardware_bridge::infrastructure::credential::CredentialStore;
use kudiba_hardware_bridge::infrastructure::escp::{self, CodePage, EscPosProfile};
use kudiba_hardware_bridge::infrastructure::scanner::BrowserScanner;
use kudiba_hardware_bridge::infrastructure::seed::SqliteSeedRepository;
use kudiba_hardware_bridge::infrastructure::sqlite::SqliteJobRepository;
use kudiba_hardware_bridge::infrastructure::transport::parse_printer_spec;

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

fn printer_connection_spec() -> String {
    if let Ok(spec) = env::var("KUDIBA_PRINTER_CONNECTION") {
        if !spec.trim().is_empty() {
            return spec.trim().to_string();
        }
    }
    let host = env::var("KUDIBA_PRINTER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("KUDIBA_PRINTER_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(9100);
    format!("RAW_TCP:{host}:{port}")
}

fn code_page() -> CodePage {
    match env::var("KUDIBA_ESC_POS_CODE_PAGE")
        .unwrap_or_default()
        .trim()
        .to_ascii_uppercase()
        .as_str()
    {
        "CP850" => CodePage::Cp850,
        "CP1252" => CodePage::Cp1252,
        "UTF8" | "UTF-8" => CodePage::Utf8,
        _ => CodePage::Ascii,
    }
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
    let connection_spec = printer_connection_spec();
    let model = env::var("KUDIBA_PRINTER_MODEL").unwrap_or_else(|_| "POS-80".to_string());
    let columns = env::var("KUDIBA_ESC_POS_COLUMNS")
        .ok()
        .and_then(|value| value.parse::<u8>().ok())
        .unwrap_or(48);
    let selected_code_page = code_page();
    let profile = EscPosProfile {
        columns,
        code_page: selected_code_page,
        ascii_only: selected_code_page == CodePage::Ascii,
        has_cutter: !env::var("KUDIBA_ESC_POS_HAS_CUTTER")
            .map(|value| value.trim().eq_ignore_ascii_case("false"))
            .unwrap_or(false),
        ..EscPosProfile::default()
    };
    let printer_transport = parse_printer_spec(&connection_spec)?;
    let printer: Arc<dyn PrinterPort> = Arc::new(printer_transport);
    tracing::info!(connection = %connection_spec, "transporte de impressora configurado");
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
    let seed: Arc<dyn SeedRepository> = Arc::new(SqliteSeedRepository::new(db_file.clone())?);
    let scanner: Arc<dyn ScannerPort> = Arc::new(BrowserScanner::new());
    let cloud_url =
        env::var("KUDIBA_CLOUD_API_URL").unwrap_or_else(|_| "https://api.kudiba.ao".to_string());
    let cloud: Arc<dyn CloudBootstrapPort> = Arc::new(HttpCloudBootstrap::new(cloud_url)?);

    let state = BridgeState {
        printer,
        drawer,
        repository,
        credentials,
        profile,
        cloud,
        seed,
        scanner,
        model,
        connection_mode: connection_spec,
    };

    let app = kudiba_hardware_bridge::infrastructure::api::router(state);
    let certificate = env::var("KUDIBA_BRIDGE_TLS_CERT").ok();
    let key = env::var("KUDIBA_BRIDGE_TLS_KEY").ok();
    match (certificate, key) {
        (Some(certificate), Some(key)) => {
            let config =
                axum_server::tls_rustls::RustlsConfig::from_pem_file(certificate, key).await?;
            tracing::info!("agente de hardware local a escutar em HTTPS 127.0.0.1:{port}");
            axum_server::bind_rustls(([127, 0, 0, 1], port).into(), config)
                .serve(app.into_make_service())
                .await?;
        }
        _ => {
            let listener = TcpListener::bind(("127.0.0.1", port)).await?;
            tracing::info!("agente de hardware local a escutar em 127.0.0.1:{port}");
            serve(listener, app).await?;
        }
    }
    Ok(())
}
