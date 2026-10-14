use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::TreasuryReceipt;
use crate::domain::error::DomainError;
use crate::domain::ports::TreasuryReceiptRepository;
use crate::infrastructure::persistence::models::{TreasuryReceiptLineRow, TreasuryReceiptRow};

pub struct PostgresTreasuryReceiptRepository {
    pool: PgPool,
}

impl PostgresTreasuryReceiptRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TreasuryReceiptRepository for PostgresTreasuryReceiptRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<TreasuryReceipt>, DomainError> {
        let receipt_row = sqlx::query_as::<_, TreasuryReceiptRow>(
            r#"
            SELECT id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                   session_id, bank_account_id, payment_method, total_amount, currency,
                   notes, issued_at, created_at
            FROM kudiba_treasury.treasury_receipts
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let Some(r) = receipt_row else {
            return Ok(None);
        };

        let lines_rows = sqlx::query_as::<_, TreasuryReceiptLineRow>(
            r#"
            SELECT id, receipt_id, invoice_id, invoice_number, amount_settled, notes, created_at
            FROM kudiba_treasury.treasury_receipt_lines
            WHERE receipt_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(r.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let lines = lines_rows.into_iter().map(Into::into).collect();

        Ok(Some(TreasuryReceipt {
            id: r.id,
            tenant_id: r.tenant_id,
            receipt_number: r.receipt_number,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            customer_nif: r.customer_nif,
            session_id: r.session_id,
            bank_account_id: r.bank_account_id,
            payment_method: r.payment_method,
            total_amount: r.total_amount,
            currency: r.currency,
            notes: r.notes,
            issued_at: r.issued_at,
            created_at: r.created_at,
            lines,
        }))
    }

    async fn find_by_number(
        &self,
        tenant_id: Uuid,
        number: &str,
    ) -> Result<Option<TreasuryReceipt>, DomainError> {
        let receipt_row = sqlx::query_as::<_, TreasuryReceiptRow>(
            r#"
            SELECT id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                   session_id, bank_account_id, payment_method, total_amount, currency,
                   notes, issued_at, created_at
            FROM kudiba_treasury.treasury_receipts
            WHERE tenant_id = $1 AND receipt_number = $2
            "#,
        )
        .bind(tenant_id)
        .bind(number)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let Some(r) = receipt_row else {
            return Ok(None);
        };

        let lines_rows = sqlx::query_as::<_, TreasuryReceiptLineRow>(
            r#"
            SELECT id, receipt_id, invoice_id, invoice_number, amount_settled, notes, created_at
            FROM kudiba_treasury.treasury_receipt_lines
            WHERE receipt_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(r.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let lines = lines_rows.into_iter().map(Into::into).collect();

        Ok(Some(TreasuryReceipt {
            id: r.id,
            tenant_id: r.tenant_id,
            receipt_number: r.receipt_number,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            customer_nif: r.customer_nif,
            session_id: r.session_id,
            bank_account_id: r.bank_account_id,
            payment_method: r.payment_method,
            total_amount: r.total_amount,
            currency: r.currency,
            notes: r.notes,
            issued_at: r.issued_at,
            created_at: r.created_at,
            lines,
        }))
    }

    async fn list(
        &self,
        tenant_id: Uuid,
        customer_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<TreasuryReceipt>, DomainError> {
        let rows = if let Some(cust_id) = customer_id {
            sqlx::query_as::<_, TreasuryReceiptRow>(
                r#"
                SELECT id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                       session_id, bank_account_id, payment_method, total_amount, currency,
                       notes, issued_at, created_at
                FROM kudiba_treasury.treasury_receipts
                WHERE tenant_id = $1 AND customer_id = $2
                ORDER BY issued_at DESC
                LIMIT $3
                "#,
            )
            .bind(tenant_id)
            .bind(cust_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?
        } else {
            sqlx::query_as::<_, TreasuryReceiptRow>(
                r#"
                SELECT id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                       session_id, bank_account_id, payment_method, total_amount, currency,
                       notes, issued_at, created_at
                FROM kudiba_treasury.treasury_receipts
                WHERE tenant_id = $1
                ORDER BY issued_at DESC
                LIMIT $2
                "#,
            )
            .bind(tenant_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?
        };

        let mut receipts = Vec::with_capacity(rows.len());
        for r in rows {
            let lines_rows = sqlx::query_as::<_, TreasuryReceiptLineRow>(
                r#"
                SELECT id, receipt_id, invoice_id, invoice_number, amount_settled, notes, created_at
                FROM kudiba_treasury.treasury_receipt_lines
                WHERE receipt_id = $1
                ORDER BY created_at ASC
                "#,
            )
            .bind(r.id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            receipts.push(TreasuryReceipt {
                id: r.id,
                tenant_id: r.tenant_id,
                receipt_number: r.receipt_number,
                customer_id: r.customer_id,
                customer_name: r.customer_name,
                customer_nif: r.customer_nif,
                session_id: r.session_id,
                bank_account_id: r.bank_account_id,
                payment_method: r.payment_method,
                total_amount: r.total_amount,
                currency: r.currency,
                notes: r.notes,
                issued_at: r.issued_at,
                created_at: r.created_at,
                lines: lines_rows.into_iter().map(Into::into).collect(),
            });
        }

        Ok(receipts)
    }

    async fn next_receipt_number(&self, tenant_id: Uuid, year: i32) -> Result<String, DomainError> {
        let prefix = format!("RC {}/", year);
        let count_row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM kudiba_treasury.treasury_receipts
            WHERE tenant_id = $1 AND receipt_number LIKE $2
            "#,
        )
        .bind(tenant_id)
        .bind(format!("{}%", prefix))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let seq = count_row.0 + 1;
        Ok(format!("{}{:04}", prefix, seq))
    }

    async fn save(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.treasury_receipts
                (id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                 session_id, bank_account_id, payment_method, total_amount, currency, notes, issued_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            "#,
        )
        .bind(receipt.id)
        .bind(receipt.tenant_id)
        .bind(&receipt.receipt_number)
        .bind(&receipt.customer_id)
        .bind(&receipt.customer_name)
        .bind(&receipt.customer_nif)
        .bind(receipt.session_id)
        .bind(receipt.bank_account_id)
        .bind(receipt.payment_method)
        .bind(receipt.total_amount)
        .bind(receipt.currency)
        .bind(&receipt.notes)
        .bind(receipt.issued_at)
        .bind(receipt.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for line in &receipt.lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_treasury.treasury_receipt_lines
                    (id, receipt_id, invoice_id, invoice_number, amount_settled, notes, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#,
            )
            .bind(line.id)
            .bind(line.receipt_id)
            .bind(&line.invoice_id)
            .bind(&line.invoice_number)
            .bind(line.amount_settled)
            .bind(&line.notes)
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
}
