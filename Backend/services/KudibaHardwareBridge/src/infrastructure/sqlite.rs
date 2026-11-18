use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::job::PrintJob;
use crate::domain::port::JobRepository;

#[derive(Clone)]
pub struct SqliteJobRepository {
    connection: Arc<Mutex<Connection>>,
}

impl SqliteJobRepository {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, DeviceError> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| DeviceError::Busy(format!("diretório do repositório: {error}")))?;
        }
        let connection = Connection::open(path)
            .map_err(|error| DeviceError::Busy(format!("abrir repositório: {error}")))?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS print_jobs (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    state TEXT NOT NULL,
                    attempts INTEGER NOT NULL,
                    snapshot TEXT NOT NULL,
                    UNIQUE (tenant_id, idempotency_key)
                 );",
            )
            .map_err(|error| DeviceError::Busy(format!("esquema do repositório: {error}")))?;
        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    fn persist(connection: &mut Connection, job: &PrintJob) -> Result<(), DeviceError> {
        let snapshot = serde_json::to_string(job)
            .map_err(|error| DeviceError::Busy(format!("snapshot do job: {error}")))?;
        let transaction = connection
            .transaction()
            .map_err(|error| DeviceError::Busy(format!("transação: {error}")))?;
        let existing: Option<String> = transaction
            .query_row(
                "SELECT id FROM print_jobs WHERE tenant_id = ?1 AND idempotency_key = ?2",
                params![
                    job.tenant_id().to_string(),
                    job.idempotency_key().to_string()
                ],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| DeviceError::Busy(format!("leitura do repositório: {error}")))?;
        if let Some(existing_id) = existing {
            if existing_id != job.id().to_string() {
                return Err(DeviceError::Busy("chave de idempotência duplicada".into()));
            }
        }
        transaction
            .execute(
                "INSERT INTO print_jobs (id, tenant_id, idempotency_key, state, attempts, snapshot)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(tenant_id, idempotency_key) DO UPDATE SET
                     state = excluded.state,
                     attempts = excluded.attempts,
                     snapshot = excluded.snapshot",
                params![
                    job.id().to_string(),
                    job.tenant_id().to_string(),
                    job.idempotency_key().to_string(),
                    format!("{:?}", job.state()),
                    job.attempts(),
                    snapshot,
                ],
            )
            .map_err(|error| DeviceError::Busy(format!("escrita do repositório: {error}")))?;
        transaction
            .commit()
            .map_err(|error| DeviceError::Busy(format!("commit do repositório: {error}")))?;
        Ok(())
    }

    fn read_snapshot(snapshot: String) -> Result<PrintJob, DeviceError> {
        serde_json::from_str(&snapshot)
            .map_err(|error| DeviceError::Busy(format!("snapshot corrompido: {error}")))
    }
}

#[async_trait]
impl JobRepository for SqliteJobRepository {
    async fn save(&self, job: PrintJob) -> Result<(), DeviceError> {
        let connection = self.connection.clone();
        tokio::task::spawn_blocking(move || {
            let mut guard = connection
                .lock()
                .map_err(|_| DeviceError::Busy("repositório".into()))?;
            Self::persist(&mut guard, &job)
        })
        .await
        .map_err(|_| DeviceError::Busy("repositório".into()))?
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<PrintJob>, DeviceError> {
        let connection = self.connection.clone();
        tokio::task::spawn_blocking(move || {
            let guard = connection
                .lock()
                .map_err(|_| DeviceError::Busy("repositório".into()))?;
            let snapshot: Option<String> = guard
                .query_row(
                    "SELECT snapshot FROM print_jobs WHERE id = ?1",
                    params![id.to_string()],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| DeviceError::Busy(format!("leitura do repositório: {error}")))?;
            snapshot.map(Self::read_snapshot).transpose()
        })
        .await
        .map_err(|_| DeviceError::Busy("repositório".into()))?
    }

    async fn find_by_idempotency_key(
        &self,
        tenant_id: Uuid,
        key: &str,
    ) -> Result<Option<PrintJob>, DeviceError> {
        let key = key.to_string();
        let connection = self.connection.clone();
        tokio::task::spawn_blocking(move || {
            let guard = connection
                .lock()
                .map_err(|_| DeviceError::Busy("repositório".into()))?;
            let snapshot: Option<String> = guard
                .query_row(
                    "SELECT snapshot FROM print_jobs WHERE tenant_id = ?1 AND idempotency_key = ?2",
                    params![tenant_id.to_string(), key],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| DeviceError::Busy(format!("leitura do repositório: {error}")))?;
            snapshot.map(Self::read_snapshot).transpose()
        })
        .await
        .map_err(|_| DeviceError::Busy("repositório".into()))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::job::{CopyType, JobClass, PrintState};

    fn job(key: &str, tenant: Uuid) -> PrintJob {
        PrintJob::new_original(
            tenant,
            Uuid::from_u128(2),
            JobClass::FiscalEnvelope,
            "FR 2026A/000123",
            key,
            "sha256:abc",
        )
        .unwrap()
    }

    fn database_file() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("kudiba-bridge-{}.sqlite3", Uuid::new_v4()))
    }

    #[tokio::test]
    async fn replay_survives_repository_recreation() {
        let path = database_file();
        let tenant = Uuid::from_u128(1);
        let repository = SqliteJobRepository::new(&path).unwrap();
        let mut first = job("sale-1", tenant);
        first.mark_submitting().unwrap();
        first.mark_transport_accepted().unwrap();
        let id = first.id();
        repository.save(first).await.unwrap();
        drop(repository);

        let recreated = SqliteJobRepository::new(&path).unwrap();
        let replayed = recreated
            .find_by_idempotency_key(tenant, "sale-1")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(replayed.id(), id);
        assert_eq!(replayed.tenant_id(), tenant);
        assert_eq!(replayed.state(), PrintState::TransportAccepted);
        assert_eq!(replayed.attempts(), 1);
        assert_eq!(replayed.copy_type(), CopyType::Original);

        let duplicate = job("sale-1", tenant);
        assert!(matches!(
            recreated.save(duplicate).await,
            Err(DeviceError::Busy(_))
        ));
        fs::remove_file(path).ok();
    }

    #[tokio::test]
    async fn same_key_in_a_different_tenant_is_allowed() {
        let path = database_file();
        let repository = SqliteJobRepository::new(&path).unwrap();
        repository
            .save(job("sale-1", Uuid::from_u128(1)))
            .await
            .unwrap();
        repository
            .save(job("sale-1", Uuid::from_u128(2)))
            .await
            .unwrap();
        assert_eq!(
            repository
                .find_by_idempotency_key(Uuid::from_u128(1), "sale-1")
                .await
                .unwrap()
                .unwrap()
                .tenant_id(),
            Uuid::from_u128(1)
        );
        assert_eq!(
            repository
                .find_by_idempotency_key(Uuid::from_u128(2), "sale-1")
                .await
                .unwrap()
                .unwrap()
                .tenant_id(),
            Uuid::from_u128(2)
        );
        fs::remove_file(path).ok();
    }
}
