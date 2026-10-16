use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::InvoiceReceivable;
use crate::domain::error::DomainError;
use crate::domain::ports::InvoiceReceivableRepository;
use crate::infrastructure::persistence::models::InvoiceReceivableRow;

pub struct PostgresInvoiceReceivableRepository {
    pool: PgPool,
}

impl PostgresInvoiceReceivableRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvoiceReceivableRepository for PostgresInvoiceReceivableRepository {
    async fn upsert(&self, receivable: &InvoiceReceivable) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.invoice_receivables
                (id, tenant_id, invoice_id, document_number, document_type, payment_mechanism,
                 gross_total, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (tenant_id, invoice_id) DO UPDATE SET
                document_number   = EXCLUDED.document_number,
                document_type     = EXCLUDED.document_type,
                payment_mechanism = EXCLUDED.payment_mechanism,
                gross_total       = EXCLUDED.gross_total,
                status            = EXCLUDED.status,
                updated_at        = EXCLUDED.updated_at
            "#,
        )
        .bind(receivable.id)
        .bind(receivable.tenant_id)
        .bind(&receivable.invoice_id)
        .bind(&receivable.document_number)
        .bind(&receivable.document_type)
        .bind(&receivable.payment_mechanism)
        .bind(receivable.gross_total)
        .bind(receivable.status.as_str())
        .bind(receivable.created_at)
        .bind(receivable.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn list(
        &self,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<InvoiceReceivable>, DomainError> {
        let rows = sqlx::query_as::<_, InvoiceReceivableRow>(
            r#"
            SELECT id, tenant_id, invoice_id, document_number, document_type, payment_mechanism,
                   gross_total, status, created_at, updated_at
            FROM kudiba_treasury.invoice_receivables
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }
}
