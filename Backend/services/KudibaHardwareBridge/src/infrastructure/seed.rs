use std::path::PathBuf;
use std::str::FromStr;

use async_trait::async_trait;
use chrono::Utc;
use kudiba_gateway_signature::{canonical_json_bytes, verify_payload_signature};
use rusqlite::{params, Connection, OptionalExtension};
use rust_decimal::Decimal;

use crate::domain::error::DeviceError;
use crate::domain::port::SeedRepository;
use crate::domain::seed::{CatalogItem, SeedPayload};

pub struct SqliteSeedRepository {
    path: PathBuf,
}

impl SqliteSeedRepository {
    pub fn new(path: PathBuf) -> Result<Self, DeviceError> {
        let connection = open(path.clone())?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS seed_meta (
                     key TEXT PRIMARY KEY,
                     value TEXT NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS catalog_items (
                     barcode TEXT PRIMARY KEY,
                     code TEXT NOT NULL,
                     description TEXT NOT NULL,
                     price TEXT NOT NULL,
                     tax_rate TEXT NOT NULL
                 );",
            )
            .map_err(|error| DeviceError::Busy(format!("seed schema: {error}")))?;
        Ok(Self { path })
    }
}

fn open(path: PathBuf) -> Result<Connection, DeviceError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| DeviceError::Busy(format!("diretório do seed: {error}")))?;
    }
    let connection = Connection::open(path)
        .map_err(|error| DeviceError::Busy(format!("seed sqlite: {error}")))?;
    connection
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|error| DeviceError::Busy(format!("seed pragma: {error}")))?;
    Ok(connection)
}

#[async_trait]
impl SeedRepository for SqliteSeedRepository {
    async fn apply(
        &self,
        seed: &SeedPayload,
        signature: &str,
        secret: &str,
    ) -> Result<(), DeviceError> {
        if seed.expires_at <= Utc::now() {
            return Err(DeviceError::InvalidProfile("seed expirado".to_string()));
        }
        let value = serde_json::to_value(seed)
            .map_err(|error| DeviceError::InvalidProfile(format!("seed: {error}")))?;
        let bytes = canonical_json_bytes(&value)
            .map_err(|error| DeviceError::InvalidProfile(format!("seed: {error}")))?;
        if !verify_payload_signature(secret, &bytes, signature) {
            return Err(DeviceError::InvalidProfile(
                "assinatura do seed inválida".to_string(),
            ));
        }

        let path = self.path.clone();
        let payload = serde_json::to_string(seed)
            .map_err(|error| DeviceError::InvalidProfile(format!("seed: {error}")))?;
        let catalog = seed.catalog.clone();
        let version = seed.version;
        tokio::task::spawn_blocking(move || -> Result<(), DeviceError> {
            let mut connection = open(path)?;
            let transaction = connection
                .transaction()
                .map_err(|error| DeviceError::Busy(format!("seed transação: {error}")))?;
            transaction
                .execute(
                    "INSERT INTO seed_meta (key, value) VALUES ('current', ?1)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![payload],
                )
                .map_err(|error| DeviceError::Busy(format!("seed meta: {error}")))?;
            transaction
                .execute(
                    "INSERT INTO seed_meta (key, value) VALUES ('version', ?1)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![version.to_string()],
                )
                .map_err(|error| DeviceError::Busy(format!("seed versão: {error}")))?;
            transaction
                .execute("DELETE FROM catalog_items", [])
                .map_err(|error| DeviceError::Busy(format!("catálogo limpeza: {error}")))?;
            for item in &catalog {
                transaction
                    .execute(
                        "INSERT INTO catalog_items (barcode, code, description, price, tax_rate)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![
                            item.barcode,
                            item.code,
                            item.description,
                            item.price.to_string(),
                            item.tax_rate.to_string()
                        ],
                    )
                    .map_err(|error| DeviceError::Busy(format!("catálogo item: {error}")))?;
            }
            transaction
                .commit()
                .map_err(|error| DeviceError::Busy(format!("seed commit: {error}")))?;
            Ok(())
        })
        .await
        .map_err(|error| DeviceError::Busy(format!("seed aplicação: {error}")))?
    }

    async fn current(&self) -> Result<Option<SeedPayload>, DeviceError> {
        let path = self.path.clone();
        tokio::task::spawn_blocking(move || -> Result<Option<SeedPayload>, DeviceError> {
            let connection = open(path)?;
            let raw: Option<String> = connection
                .query_row(
                    "SELECT value FROM seed_meta WHERE key = 'current'",
                    [],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| DeviceError::Busy(format!("seed leitura: {error}")))?;
            raw.map(|value| {
                serde_json::from_str(&value)
                    .map_err(|error| DeviceError::Busy(format!("seed corrompido: {error}")))
            })
            .transpose()
        })
        .await
        .map_err(|error| DeviceError::Busy(format!("seed leitura: {error}")))?
    }

    async fn catalog(&self) -> Result<Vec<CatalogItem>, DeviceError> {
        let path = self.path.clone();
        tokio::task::spawn_blocking(move || -> Result<Vec<CatalogItem>, DeviceError> {
            let connection = open(path)?;
            let mut statement = connection
                .prepare(
                    "SELECT barcode, code, description, price, tax_rate
                     FROM catalog_items ORDER BY description, barcode",
                )
                .map_err(|error| DeviceError::Busy(format!("catálogo leitura: {error}")))?;
            let rows = statement
                .query_map([], |row| {
                    let price: String = row.get(3)?;
                    let tax_rate: String = row.get(4)?;
                    Ok(CatalogItem {
                        barcode: row.get(0)?,
                        code: row.get(1)?,
                        description: row.get(2)?,
                        price: Decimal::from_str(&price).unwrap_or_default(),
                        tax_rate: Decimal::from_str(&tax_rate).unwrap_or_default(),
                    })
                })
                .map_err(|error| DeviceError::Busy(format!("catálogo leitura: {error}")))?;
            let mut items = Vec::new();
            for row in rows {
                items.push(
                    row.map_err(|error| DeviceError::Busy(format!("catálogo linha: {error}")))?,
                );
            }
            Ok(items)
        })
        .await
        .map_err(|error| DeviceError::Busy(format!("catálogo leitura: {error}")))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::seed::SeedPayload;
    use chrono::Duration;
    use kudiba_gateway_signature::compute_payload_signature;
    use rust_decimal::Decimal;

    fn seed() -> SeedPayload {
        SeedPayload {
            version: 3,
            expires_at: Utc::now() + Duration::hours(1),
            catalog: vec![CatalogItem {
                barcode: "5601234567890".to_string(),
                code: "CAF001".to_string(),
                description: "Café".to_string(),
                price: Decimal::new(450, 0),
                tax_rate: Decimal::new(14, 0),
            }],
            series: Vec::new(),
        }
    }

    #[tokio::test]
    async fn apply_persists_signed_seed_and_catalog() {
        let path =
            std::env::temp_dir().join(format!("kudiba-seed-{}.sqlite", uuid::Uuid::new_v4()));
        let repository = SqliteSeedRepository::new(path).unwrap();
        let seed = seed();
        let value = serde_json::to_value(&seed).unwrap();
        let bytes = canonical_json_bytes(&value).unwrap();
        let signature = compute_payload_signature("secret", &bytes);

        repository.apply(&seed, &signature, "secret").await.unwrap();
        let current = repository.current().await.unwrap().unwrap();
        assert_eq!(current.version, 3);
        let catalog = repository.catalog().await.unwrap();
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].description, "Café");
    }

    #[tokio::test]
    async fn apply_rejects_bad_signature() {
        let path =
            std::env::temp_dir().join(format!("kudiba-seed-{}.sqlite", uuid::Uuid::new_v4()));
        let repository = SqliteSeedRepository::new(path).unwrap();
        let error = repository
            .apply(&seed(), "bad-signature", "secret")
            .await
            .unwrap_err();
        assert_eq!(
            error,
            DeviceError::InvalidProfile("assinatura do seed inválida".to_string())
        );
    }
}
