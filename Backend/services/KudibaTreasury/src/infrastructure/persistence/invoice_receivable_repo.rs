use async_trait::async_trait;
use rust_decimal::Decimal;
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
                 gross_total, paid_amount, remaining_amount, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (tenant_id, invoice_id) DO UPDATE SET
                document_number   = EXCLUDED.document_number,
                document_type     = EXCLUDED.document_type,
                payment_mechanism = EXCLUDED.payment_mechanism,
                gross_total       = EXCLUDED.gross_total,
                paid_amount       = GREATEST(
                    kudiba_treasury.invoice_receivables.paid_amount,
                    EXCLUDED.paid_amount
                ),
                remaining_amount  = GREATEST(
                    0,
                    EXCLUDED.gross_total - GREATEST(
                        kudiba_treasury.invoice_receivables.paid_amount,
                        EXCLUDED.paid_amount
                    )
                ),
                status            = CASE
                    WHEN GREATEST(
                        kudiba_treasury.invoice_receivables.paid_amount,
                        EXCLUDED.paid_amount
                    ) >= EXCLUDED.gross_total THEN 'SETTLED'
                    WHEN GREATEST(
                        kudiba_treasury.invoice_receivables.paid_amount,
                        EXCLUDED.paid_amount
                    ) > 0 THEN 'PARTIAL'
                    ELSE EXCLUDED.status
                END,
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
        .bind(receivable.paid_amount)
        .bind(receivable.remaining_amount)
        .bind(receivable.status.as_str())
        .bind(receivable.created_at)
        .bind(receivable.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn apply_payment(
        &self,
        tenant_id: Uuid,
        invoice_id: &str,
        payment_id: Uuid,
        amount: Decimal,
    ) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O pagamento recebido deve ser positivo".to_string(),
            ));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        let inserted = sqlx::query(
            "INSERT INTO kudiba_treasury.invoice_receivable_payments \
             (payment_id, tenant_id, invoice_id, amount) VALUES ($1, $2, $3, $4) \
             ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id",
        )
        .bind(payment_id)
        .bind(tenant_id)
        .bind(invoice_id)
        .bind(amount)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if inserted.is_some() {
            let result = sqlx::query(
                "UPDATE kudiba_treasury.invoice_receivables \
                 SET paid_amount = paid_amount + $1, \
                     remaining_amount = gross_total - paid_amount - $1, \
                     status = CASE WHEN gross_total - paid_amount - $1 <= 0 THEN 'SETTLED' ELSE 'PARTIAL' END, \
                     updated_at = NOW() \
                 WHERE tenant_id = $2 AND invoice_id = $3 \
                   AND gross_total - paid_amount >= $1",
            )
            .bind(amount)
            .bind(tenant_id)
            .bind(invoice_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
            if result.rows_affected() != 1 {
                return Err(DomainError::ValidationError(
                    "Pagamento duplicado, factura não encontrada ou valor superior ao saldo da conta-corrente."
                        .to_string(),
                ));
            }
        }

        tx.commit()
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
                   gross_total, COALESCE(paid_amount, 0) as paid_amount,
                   COALESCE(remaining_amount, gross_total - COALESCE(paid_amount, 0)) as remaining_amount,
                   status, created_at, updated_at
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
