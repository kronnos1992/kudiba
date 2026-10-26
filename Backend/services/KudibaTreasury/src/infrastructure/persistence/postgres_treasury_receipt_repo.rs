use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::{CashMovement, TreasuryReceipt};
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

        let seq_res: Result<(i64,), sqlx::Error> = sqlx::query_as(
            r#"
            INSERT INTO kudiba_treasury.treasury_sequences (tenant_id, sequence_type, fiscal_year, current_number, updated_at)
            VALUES ($1, 'RECEIPT', $2, 1, NOW())
            ON CONFLICT (tenant_id, sequence_type, fiscal_year)
            DO UPDATE SET current_number = kudiba_treasury.treasury_sequences.current_number + 1, updated_at = NOW()
            RETURNING current_number
            "#,
        )
        .bind(tenant_id)
        .bind(year)
        .fetch_one(&self.pool)
        .await;

        let seq = match seq_res {
            Ok((seq,)) => seq,
            Err(_) => {
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
                count_row.0 + 1
            }
        };

        Ok(format!("{}{:04}", prefix, seq))
    }

    async fn save(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError> {
        self.save_with_settlement(receipt, None, None).await
    }

    async fn save_with_settlement(
        &self,
        receipt: &TreasuryReceipt,
        cash_movement: Option<&CashMovement>,
        bank_adjustment: Option<(Uuid, rust_decimal::Decimal)>,
    ) -> Result<(), DomainError> {
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

            if !line.invoice_id.trim().is_empty() || !line.invoice_number.trim().is_empty() {
                let _ = sqlx::query(
                    r#"
                    UPDATE kudiba_treasury.invoice_receivables
                    SET paid_amount = paid_amount + $3,
                        remaining_amount = GREATEST(0, gross_total - (paid_amount + $3)),
                        status = CASE 
                            WHEN (paid_amount + $3) >= gross_total THEN 'SETTLED' 
                            ELSE 'PARTIAL' 
                        END,
                        updated_at = NOW()
                    WHERE tenant_id = $1 AND (invoice_id = $2 OR document_number = $4)
                    "#,
                )
                .bind(receipt.tenant_id)
                .bind(&line.invoice_id)
                .bind(line.amount_settled)
                .bind(&line.invoice_number)
                .execute(&mut *tx)
                .await;
            }
        }

        if let Some(ref notes) = receipt.notes {
            if let Some(doc_num) = notes.strip_prefix("Liquidação da fatura ") {
                let doc_num = doc_num.trim();
                if !doc_num.is_empty() && receipt.lines.is_empty() {
                    let _ = sqlx::query(
                        r#"
                        UPDATE kudiba_treasury.invoice_receivables
                        SET paid_amount = paid_amount + $3,
                            remaining_amount = GREATEST(0, gross_total - (paid_amount + $3)),
                            status = CASE 
                                WHEN (paid_amount + $3) >= gross_total THEN 'SETTLED' 
                                ELSE 'PARTIAL' 
                            END,
                            updated_at = NOW()
                        WHERE tenant_id = $1 AND document_number = $2
                        "#,
                    )
                    .bind(receipt.tenant_id)
                    .bind(doc_num)
                    .bind(receipt.total_amount)
                    .execute(&mut *tx)
                    .await;
                }
            }
        }

        if let Some(movement) = cash_movement {
            sqlx::query(
                r#"
                INSERT INTO kudiba_treasury.cash_movements
                    (id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#,
            )
            .bind(movement.id)
            .bind(movement.tenant_id)
            .bind(movement.session_id)
            .bind(movement.register_id)
            .bind(movement.movement_type)
            .bind(movement.amount)
            .bind(&movement.reason)
            .bind(&movement.operator_user_id)
            .bind(movement.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        if let Some((bank_account_id, amount)) = bank_adjustment {
            let res = sqlx::query(
                r#"
                UPDATE kudiba_treasury.bank_accounts
                SET current_balance = current_balance + $1, updated_at = NOW()
                WHERE tenant_id = $2 AND id = $3 AND is_active = TRUE
                "#,
            )
            .bind(amount)
            .bind(receipt.tenant_id)
            .bind(bank_account_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            if res.rows_affected() == 0 {
                return Err(DomainError::ValidationError(
                    "Conta bancária não encontrada ou inativa para crédito".to_string(),
                ));
            }
        }

        let audit_details = serde_json::json!({
            "receipt_number": receipt.receipt_number,
            "total_amount": receipt.total_amount.to_string(),
            "payment_method": format!("{:?}", receipt.payment_method),
            "customer_id": receipt.customer_id,
            "customer_name": receipt.customer_name,
            "bank_account_id": receipt.bank_account_id,
            "lines_count": receipt.lines.len()
        });

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_audit.system_audit_trail
                (tenant_id, module, action, entity_type, entity_id, document_reference, actor_user_id, actor_name, details, created_at)
            VALUES ($1, 'TESOURARIA', 'EMISSAO_RECIBO_RC', 'RECIBO_RC', $2, $3, 'operador_tesouraria', $4, $5, NOW())
            "#
        )
        .bind(receipt.tenant_id)
        .bind(receipt.id.to_string())
        .bind(&receipt.receipt_number)
        .bind(&receipt.customer_name)
        .bind(audit_details)
        .execute(&mut *tx)
        .await;

        tracing::info!(
            target: "audit::treasury",
            receipt_number = %receipt.receipt_number,
            tenant_id = %receipt.tenant_id,
            total = %receipt.total_amount,
            customer = %receipt.customer_name,
            "[AUDIT_TREASURY] Recibo de quitação RC emitido e auditado na trilha de operações"
        );

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
