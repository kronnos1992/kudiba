use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::{JournalEntry, JournalLine};
use crate::domain::error::DomainError;
use crate::domain::ports::JournalEntryRepository;
use crate::infrastructure::persistence::models::{JournalEntryRow, JournalLineRow};

pub struct PostgresJournalEntryRepository {
    pool: PgPool,
}

impl PostgresJournalEntryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl JournalEntryRepository for PostgresJournalEntryRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<JournalEntry>, DomainError> {
        let entry_row: Option<JournalEntryRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, fiscal_year_id, journal_id, entry_number,
                   transaction_date, system_entry_date, period, description,
                   source_service, source_document_type, source_document_id,
                   source_document_ref, total_debit, total_credit, status::text,
                   reversal_of_entry_id, created_by, created_at
            FROM kudiba_accounting.journal_entries
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let entry = match entry_row {
            Some(e) => e,
            None => return Ok(None),
        };

        let line_rows: Vec<JournalLineRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, entry_id, line_number, account_code, description,
                   debit_amount, credit_amount, entity_id, cost_center_id, currency,
                   exchange_rate, foreign_amount, created_at
            FROM kudiba_accounting.journal_lines
            WHERE entry_id = $1
            ORDER BY line_number ASC
            "#,
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let lines: Vec<JournalLine> = line_rows.into_iter().map(|l| l.into_domain()).collect();
        Ok(Some(entry.into_domain(lines)))
    }

    async fn find_by_source_ref(
        &self,
        tenant_id: Uuid,
        source_ref: &str,
    ) -> Result<Option<JournalEntry>, DomainError> {
        let entry_row: Option<JournalEntryRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, fiscal_year_id, journal_id, entry_number,
                   transaction_date, system_entry_date, period, description,
                   source_service, source_document_type, source_document_id,
                   source_document_ref, total_debit, total_credit, status::text,
                   reversal_of_entry_id, created_by, created_at
            FROM kudiba_accounting.journal_entries
            WHERE tenant_id = $1 AND source_document_ref = $2
            ORDER BY entry_number DESC
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(source_ref)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let entry = match entry_row {
            Some(e) => e,
            None => return Ok(None),
        };

        let line_rows: Vec<JournalLineRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, entry_id, line_number, account_code, description,
                   debit_amount, credit_amount, entity_id, cost_center_id, currency,
                   exchange_rate, foreign_amount, created_at
            FROM kudiba_accounting.journal_lines
            WHERE entry_id = $1
            ORDER BY line_number ASC
            "#,
        )
        .bind(entry.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let lines: Vec<JournalLine> = line_rows.into_iter().map(|l| l.into_domain()).collect();
        Ok(Some(entry.into_domain(lines)))
    }

    async fn list_entries(
        &self,
        tenant_id: Uuid,
        journal_id: Option<Uuid>,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<JournalEntry>, DomainError> {
        let entry_rows: Vec<JournalEntryRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, fiscal_year_id, journal_id, entry_number,
                   transaction_date, system_entry_date, period, description,
                   source_service, source_document_type, source_document_id,
                   source_document_ref, total_debit, total_credit, status::text,
                   reversal_of_entry_id, created_by, created_at
            FROM kudiba_accounting.journal_entries
            WHERE tenant_id = $1
              AND ($2::uuid IS NULL OR journal_id = $2)
              AND ($3::date IS NULL OR transaction_date >= $3)
              AND ($4::date IS NULL OR transaction_date <= $4)
            ORDER BY transaction_date DESC, entry_number DESC
            LIMIT $5 OFFSET $6
            "#,
        )
        .bind(tenant_id)
        .bind(journal_id)
        .bind(from_date)
        .bind(to_date)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut results = Vec::with_capacity(entry_rows.len());

        for entry_row in entry_rows {
            let line_rows: Vec<JournalLineRow> = sqlx::query_as(
                r#"
                SELECT id, tenant_id, entry_id, line_number, account_code, description,
                       debit_amount, credit_amount, entity_id, cost_center_id, currency,
                       exchange_rate, foreign_amount, created_at
                FROM kudiba_accounting.journal_lines
                WHERE entry_id = $1
                ORDER BY line_number ASC
                "#,
            )
            .bind(entry_row.id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            let lines: Vec<JournalLine> = line_rows.into_iter().map(|l| l.into_domain()).collect();
            results.push(entry_row.into_domain(lines));
        }

        Ok(results)
    }

    async fn save(&self, entry: &JournalEntry) -> Result<(), DomainError> {
        self.save_with_event(entry, None, None, None).await
    }

    async fn update(&self, entry: &JournalEntry) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let res = sqlx::query(
            r#"
            UPDATE kudiba_accounting.journal_entries
            SET transaction_date = $3, period = $4, description = $5,
                total_debit = $6, total_credit = $7
            WHERE tenant_id = $1 AND id = $2
              AND status IN ('DRAFT'::kudiba_accounting.entry_status, 'POSTED'::kudiba_accounting.entry_status)
            "#,
        )
        .bind(entry.tenant_id)
        .bind(entry.id)
        .bind(entry.transaction_date)
        .bind(entry.period)
        .bind(&entry.description)
        .bind(entry.total_debit)
        .bind(entry.total_credit)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if res.rows_affected() == 0 {
            return Err(DomainError::Conflict(
                "Lançamento não encontrado ou não editável (estornado ou inexistente)".to_string(),
            ));
        }

        sqlx::query(
            r#"
            DELETE FROM kudiba_accounting.journal_lines
            WHERE entry_id = $1 AND tenant_id = $2
            "#,
        )
        .bind(entry.id)
        .bind(entry.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for line in &entry.lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.journal_lines (
                    id, tenant_id, entry_id, line_number, account_code, description,
                    debit_amount, credit_amount, entity_id, cost_center_id, currency,
                    exchange_rate, foreign_amount, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                "#,
            )
            .bind(line.id)
            .bind(line.tenant_id)
            .bind(entry.id)
            .bind(line.line_number)
            .bind(&line.account_code)
            .bind(&line.description)
            .bind(line.debit_amount)
            .bind(line.credit_amount)
            .bind(line.entity_id)
            .bind(line.cost_center_id)
            .bind(line.currency.as_str())
            .bind(line.exchange_rate)
            .bind(line.foreign_amount)
            .bind(line.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn save_with_event(
        &self,
        entry: &JournalEntry,
        event_id: Option<Uuid>,
        event_type: Option<&str>,
        source_ref: Option<&str>,
    ) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if let Some(orig_id) = entry.reversal_of_entry_id {
            let res = sqlx::query(
                r#"
                UPDATE kudiba_accounting.journal_entries
                SET status = 'REVERSED'::kudiba_accounting.entry_status
                WHERE tenant_id = $1 AND id = $2 AND status = 'POSTED'::kudiba_accounting.entry_status
                "#,
            )
            .bind(entry.tenant_id)
            .bind(orig_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            if res.rows_affected() == 0 {
                return Err(DomainError::Conflict(
                    "O lançamento de origem já foi estornado ou não se encontra em estado confirmado".to_string(),
                ));
            }
        }

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.journal_entries (
                id, tenant_id, fiscal_year_id, journal_id, entry_number,
                transaction_date, system_entry_date, period, description,
                source_service, source_document_type, source_document_id,
                source_document_ref, total_debit, total_credit, status,
                reversal_of_entry_id, created_by, created_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16::kudiba_accounting.entry_status, $17, $18, $19
            )
            "#,
        )
        .bind(entry.id)
        .bind(entry.tenant_id)
        .bind(entry.fiscal_year_id)
        .bind(entry.journal_id)
        .bind(entry.entry_number)
        .bind(entry.transaction_date)
        .bind(entry.system_entry_date)
        .bind(entry.period)
        .bind(&entry.description)
        .bind(&entry.source_service)
        .bind(&entry.source_document_type)
        .bind(entry.source_document_id)
        .bind(&entry.source_document_ref)
        .bind(entry.total_debit)
        .bind(entry.total_credit)
        .bind(entry.status.as_str())
        .bind(entry.reversal_of_entry_id)
        .bind(entry.created_by)
        .bind(entry.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for line in &entry.lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.journal_lines (
                    id, tenant_id, entry_id, line_number, account_code, description,
                    debit_amount, credit_amount, entity_id, cost_center_id, currency,
                    exchange_rate, foreign_amount, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                "#,
            )
            .bind(line.id)
            .bind(line.tenant_id)
            .bind(entry.id)
            .bind(line.line_number)
            .bind(&line.account_code)
            .bind(&line.description)
            .bind(line.debit_amount)
            .bind(line.credit_amount)
            .bind(line.entity_id)
            .bind(line.cost_center_id)
            .bind(line.currency.as_str())
            .bind(line.exchange_rate)
            .bind(line.foreign_amount)
            .bind(line.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        if let (Some(ev_id), Some(ev_type), Some(s_ref)) = (event_id, event_type, source_ref) {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.processed_events (event_id, tenant_id, event_type, source_ref, processed_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (event_id) DO NOTHING
                "#,
            )
            .bind(ev_id)
            .bind(entry.tenant_id)
            .bind(ev_type)
            .bind(s_ref)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let audit_details = serde_json::json!({
            "entry_number": entry.entry_number,
            "period": entry.period,
            "total_debit": entry.total_debit.to_string(),
            "total_credit": entry.total_credit.to_string(),
            "lines_count": entry.lines.len(),
            "source_service": entry.source_service,
            "source_document_ref": entry.source_document_ref
        });

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_audit.system_audit_trail
                (tenant_id, module, action, entity_type, entity_id, document_reference, actor_user_id, actor_name, details, created_at)
            VALUES ($1, 'CONTABILIDADE', 'LANCAMENTO_LIVRO_DIARIO', 'LANCAMENTO_CONTABILISTICO', $2, $3, 'contabilista_sistema', 'Contabilidade PGC', $4, NOW())
            "#
        )
        .bind(entry.tenant_id)
        .bind(entry.id.to_string())
        .bind(entry.source_document_ref.as_deref().unwrap_or(&entry.description))
        .bind(audit_details)
        .execute(&mut *tx)
        .await;

        tracing::info!(
            target: "audit::accounting",
            entry_number = entry.entry_number,
            total = %entry.total_debit,
            source_ref = ?entry.source_document_ref,
            "[AUDIT_ACCOUNTING] Lançamento contabilístico registado e auditado"
        );

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    async fn is_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
    ) -> Result<bool, DomainError> {
        let row: Option<(Uuid,)> = sqlx::query_as(
            r#"
            SELECT event_id
            FROM kudiba_accounting.processed_events
            WHERE tenant_id = $1 AND event_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.is_some())
    }

    async fn mark_event_processed(
        &self,
        tenant_id: Uuid,
        event_id: Uuid,
        event_type: &str,
        source_ref: &str,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.processed_events (event_id, tenant_id, event_type, source_ref, processed_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (event_id) DO NOTHING
            "#,
        )
        .bind(event_id)
        .bind(tenant_id)
        .bind(event_type)
        .bind(source_ref)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
