use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::config::with_tenant_context;
use crate::domain::error::DomainError;
use crate::pos_hardware::domain::{
    ConsumedPairing, CreateTerminalRequest, PairingTokenLookup, PosTerminal, TerminalLookup,
    TerminalStatus,
};
use crate::pos_hardware::ports::PosHardwareRepository;

#[derive(Debug, FromRow)]
struct TerminalRow {
    id: Uuid,
    tenant_id: Uuid,
    terminal_code: String,
    name: String,
    warehouse_id: Option<Uuid>,
    status: String,
    credential_epoch: i64,
    paired_at: Option<DateTime<Utc>>,
    last_seen_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TerminalRow> for PosTerminal {
    fn from(row: TerminalRow) -> Self {
        Self {
            id: row.id,
            tenant_id: row.tenant_id,
            code: row.terminal_code,
            name: row.name,
            warehouse_id: row.warehouse_id,
            status: row.status,
            credential_epoch: row.credential_epoch,
            paired_at: row.paired_at,
            last_seen_at: row.last_seen_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct PairingTokenRow {
    token_tenant_id: Uuid,
    token_terminal_id: Uuid,
    token_expires_at: DateTime<Utc>,
    token_consumed_at: Option<DateTime<Utc>>,
    token_revoked_at: Option<DateTime<Utc>>,
    token_failed_attempts: i16,
    token_terminal_status: String,
    token_credential_epoch: i64,
}

impl From<PairingTokenRow> for PairingTokenLookup {
    fn from(row: PairingTokenRow) -> Self {
        Self {
            tenant_id: row.token_tenant_id,
            terminal_id: row.token_terminal_id,
            expires_at: row.token_expires_at,
            consumed_at: row.token_consumed_at,
            revoked_at: row.token_revoked_at,
            failed_attempts: row.token_failed_attempts,
            terminal_status: row.token_terminal_status,
            credential_epoch: row.token_credential_epoch,
        }
    }
}

#[derive(Debug, FromRow)]
struct ConsumedPairingRow {
    tenant_id: Uuid,
    terminal_id: Uuid,
    terminal_status: String,
    credential_epoch: i64,
}

impl From<ConsumedPairingRow> for ConsumedPairing {
    fn from(row: ConsumedPairingRow) -> Self {
        Self {
            tenant_id: row.tenant_id,
            terminal_id: row.terminal_id,
            status: row.terminal_status,
            credential_epoch: row.credential_epoch,
        }
    }
}

#[derive(Debug, FromRow)]
struct TerminalStatusRow {
    status: String,
    credential_epoch: i64,
}

impl From<TerminalStatusRow> for TerminalStatus {
    fn from(row: TerminalStatusRow) -> Self {
        Self {
            status: row.status,
            credential_epoch: row.credential_epoch,
        }
    }
}

#[derive(Debug, FromRow)]
struct TerminalLookupRow {
    terminal_tenant_id: Uuid,
    terminal_status: String,
    terminal_credential_epoch: i64,
}

impl From<TerminalLookupRow> for TerminalLookup {
    fn from(row: TerminalLookupRow) -> Self {
        Self {
            tenant_id: row.terminal_tenant_id,
            status: row.terminal_status,
            credential_epoch: row.terminal_credential_epoch,
        }
    }
}

pub struct PostgresPosHardwareRepository {
    pool: PgPool,
}

impl PostgresPosHardwareRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PosHardwareRepository for PostgresPosHardwareRepository {
    async fn create_terminal(
        &self,
        tenant_id: Uuid,
        payload: &CreateTerminalRequest,
    ) -> Result<PosTerminal, DomainError> {
        let pool = self.pool.clone();
        let code = payload.code.trim().to_string();
        let name = payload
            .name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(&code)
            .to_string();
        let warehouse_id = payload.warehouse_id;

        with_tenant_context(Some(tenant_id), async move {
            let row = sqlx::query_as::<_, TerminalRow>(
                r#"
                INSERT INTO kudiba_treasury.pos_terminals
                    (id, tenant_id, terminal_code, name, warehouse_id, status, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PENDING_PAIRING', NOW(), NOW())
                ON CONFLICT (tenant_id, terminal_code) DO NOTHING
                RETURNING id, tenant_id, terminal_code, name, warehouse_id, status,
                          credential_epoch, paired_at, last_seen_at, created_at, updated_at
                "#,
            )
            .bind(tenant_id)
            .bind(&code)
            .bind(&name)
            .bind(warehouse_id)
            .fetch_optional(&pool)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            row.map(Into::into).ok_or_else(|| {
                DomainError::AlreadyExists("Já existe um terminal POS com este código.".to_string())
            })
        })
        .await
    }

    async fn list_terminals(&self, tenant_id: Uuid) -> Result<Vec<PosTerminal>, DomainError> {
        let pool = self.pool.clone();

        with_tenant_context(Some(tenant_id), async move {
            let rows = sqlx::query_as::<_, TerminalRow>(
                r#"
                SELECT id, tenant_id, terminal_code, name, warehouse_id, status,
                       credential_epoch, paired_at, last_seen_at, created_at, updated_at
                  FROM kudiba_treasury.pos_terminals
                 WHERE tenant_id = $1
                 ORDER BY created_at DESC
                "#,
            )
            .bind(tenant_id)
            .fetch_all(&pool)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            Ok(rows.into_iter().map(Into::into).collect())
        })
        .await
    }

    async fn create_pairing_token(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
        token_hash: &[u8],
        expires_at: DateTime<Utc>,
        created_by_user_id: &str,
    ) -> Result<(), DomainError> {
        let pool = self.pool.clone();
        let token_hash = token_hash.to_vec();
        let created_by = created_by_user_id.to_string();

        with_tenant_context(Some(tenant_id), async move {
            let inserted = sqlx::query(
                r#"
                INSERT INTO kudiba_treasury.pos_pairing_tokens
                    (id, tenant_id, terminal_id, pairing_token_hash, expires_at, created_by_user_id, created_at)
                SELECT gen_random_uuid(), tenant_id, id, $3, $4, $5, NOW()
                  FROM kudiba_treasury.pos_terminals
                 WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .bind(&token_hash)
            .bind(expires_at)
            .bind(&created_by)
            .execute(&pool)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            if inserted.rows_affected() == 0 {
                return Err(DomainError::NotFound(
                    "Terminal POS não encontrado para este tenant.".to_string(),
                ));
            }

            Ok(())
        })
        .await
    }

    async fn revoke_terminal(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
    ) -> Result<TerminalStatus, DomainError> {
        let pool = self.pool.clone();

        with_tenant_context(Some(tenant_id), async move {
            let mut tx = pool
                .begin()
                .await
                .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            sqlx::query(
                r#"
                UPDATE kudiba_treasury.pos_pairing_tokens
                   SET revoked_at = NOW()
                 WHERE tenant_id = $1 AND terminal_id = $2
                   AND consumed_at IS NULL AND revoked_at IS NULL
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .execute(&mut *tx)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            let row = sqlx::query_as::<_, TerminalStatusRow>(
                r#"
                UPDATE kudiba_treasury.pos_terminals
                   SET status = 'REVOKED', credential_epoch = credential_epoch + 1, updated_at = NOW()
                 WHERE tenant_id = $1 AND id = $2
                RETURNING status, credential_epoch
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            tx.commit()
                .await
                .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            row.map(Into::into).ok_or_else(|| {
                DomainError::NotFound("Terminal POS não encontrado para este tenant.".to_string())
            })
        })
        .await
    }

    async fn find_pairing_token(
        &self,
        token_hash: &[u8],
    ) -> Result<Option<PairingTokenLookup>, DomainError> {
        let row = sqlx::query_as::<_, PairingTokenRow>(
            r#"
            SELECT token_tenant_id, token_terminal_id, token_expires_at, token_consumed_at,
                   token_revoked_at, token_failed_attempts, token_terminal_status,
                   token_credential_epoch
              FROM public.kudiba_resolve_pos_pairing_token($1)
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn register_failed_attempt(
        &self,
        lookup: &PairingTokenLookup,
        token_hash: &[u8],
    ) -> Result<i16, DomainError> {
        let pool = self.pool.clone();
        let tenant_id = lookup.tenant_id;
        let terminal_id = lookup.terminal_id;
        let token_hash = token_hash.to_vec();

        with_tenant_context(Some(tenant_id), async move {
            let attempts: Option<i16> = sqlx::query_scalar(
                r#"
                UPDATE kudiba_treasury.pos_pairing_tokens
                   SET failed_attempts = failed_attempts + 1
                 WHERE tenant_id = $1 AND terminal_id = $2 AND pairing_token_hash = $3
                   AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
                RETURNING failed_attempts
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .bind(&token_hash)
            .fetch_optional(&pool)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            Ok(attempts.unwrap_or(lookup.failed_attempts.saturating_add(1)))
        })
        .await
    }

    async fn consume_pairing_token(
        &self,
        lookup: &PairingTokenLookup,
        token_hash: &[u8],
    ) -> Result<Option<ConsumedPairing>, DomainError> {
        let pool = self.pool.clone();
        let tenant_id = lookup.tenant_id;
        let terminal_id = lookup.terminal_id;
        let token_hash = token_hash.to_vec();

        with_tenant_context(Some(tenant_id), async move {
            let mut tx = pool
                .begin()
                .await
                .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            let row = sqlx::query_as::<_, ConsumedPairingRow>(
                r#"
                WITH terminal AS (
                    UPDATE kudiba_treasury.pos_terminals
                       SET status = 'PAIRED', paired_at = NOW(),
                           credential_epoch = credential_epoch + 1, updated_at = NOW()
                     WHERE tenant_id = $1 AND id = $2 AND status <> 'REVOKED'
                       AND EXISTS (
                           SELECT 1 FROM kudiba_treasury.pos_pairing_tokens
                            WHERE tenant_id = $1 AND terminal_id = $2
                              AND pairing_token_hash = $3
                              AND consumed_at IS NULL AND revoked_at IS NULL
                              AND expires_at > NOW() AND failed_attempts < 5
                       )
                    RETURNING status, credential_epoch
                ),
                consumed AS (
                    UPDATE kudiba_treasury.pos_pairing_tokens
                       SET consumed_at = NOW()
                     WHERE tenant_id = $1 AND terminal_id = $2 AND pairing_token_hash = $3
                       AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
                       AND failed_attempts < 5
                       AND EXISTS (SELECT 1 FROM terminal)
                    RETURNING tenant_id, terminal_id
                )
                SELECT c.tenant_id, c.terminal_id, t.status AS terminal_status, t.credential_epoch
                  FROM consumed c
                  CROSS JOIN terminal t
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .bind(&token_hash)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            tx.commit()
                .await
                .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            Ok(row.map(Into::into))
        })
        .await
    }

    async fn get_terminal_status(
        &self,
        tenant_id: Uuid,
        terminal_id: Uuid,
    ) -> Result<Option<TerminalStatus>, DomainError> {
        let pool = self.pool.clone();

        with_tenant_context(Some(tenant_id), async move {
            let row = sqlx::query_as::<_, TerminalStatusRow>(
                r#"
                SELECT status, credential_epoch
                  FROM kudiba_treasury.pos_terminals
                 WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(terminal_id)
            .fetch_optional(&pool)
            .await
            .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

            Ok(row.map(Into::into))
        })
        .await
    }

    async fn resolve_terminal(
        &self,
        terminal_id: Uuid,
    ) -> Result<Option<TerminalLookup>, DomainError> {
        let row = sqlx::query_as::<_, TerminalLookupRow>(
            r#"
            SELECT terminal_tenant_id, terminal_status, terminal_credential_epoch
              FROM public.kudiba_resolve_pos_terminal($1)
            "#,
        )
        .bind(terminal_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| DomainError::DatabaseError(err.to_string()))?;

        Ok(row.map(Into::into))
    }
}
