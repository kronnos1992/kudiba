use chrono::Utc;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::application::dto::{CashTransferResponse, CreateCashTransferRequest};
use crate::domain::error::DomainError;

#[derive(Clone)]
pub struct TransferCommands {
    pool: PgPool,
}

impl TransferCommands {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn execute_transfer(
        &self,
        tenant_id: Uuid,
        operator_user_id: &str,
        req: CreateCashTransferRequest,
    ) -> Result<CashTransferResponse, DomainError> {
        if req.amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante a transferir deve ser positivo".to_string(),
            ));
        }

        let source_type = req.source_type.to_uppercase();
        let target_type = req.target_type.to_uppercase();

        if source_type == target_type && req.source_id == req.target_id {
            return Err(DomainError::ValidationError(
                "A conta de origem e de destino não podem ser as mesmas".to_string(),
            ));
        }

        let fee = req.fee_amount.unwrap_or(Decimal::ZERO);
        let currency = req.currency.unwrap_or_else(|| "AOA".to_string());
        let total_source_debit = req.amount + fee;

        let mut tx = self.pool.begin().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut source_name = String::new();
        let mut target_name = String::new();

        if source_type == "BANK" {
            let res = sqlx::query(
                "UPDATE kudiba_treasury.bank_accounts \
                 SET current_balance = current_balance - $1, updated_at = NOW() \
                 WHERE tenant_id = $2 AND id = $3 AND current_balance >= $1 \
                 RETURNING bank_name",
            )
            .bind(total_source_debit)
            .bind(tenant_id)
            .bind(req.source_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            match res {
                Some(r) => source_name = r.try_get("bank_name").unwrap_or_default(),
                None => {
                    return Err(DomainError::InsufficientFunds(
                        "Saldo bancário insuficiente na conta de origem para a transferência e respetiva comissão".to_string(),
                    ));
                }
            }
        } else if source_type == "REGISTER" {
            let session_opt = sqlx::query(
                "SELECT cs.id, cr.name \
                 FROM kudiba_treasury.cash_sessions cs \
                 JOIN kudiba_treasury.cash_registers cr ON cs.register_id = cr.id \
                 WHERE cs.tenant_id = $1 AND cs.register_id = $2 AND cs.status = 'OPEN'",
            )
            .bind(tenant_id)
            .bind(req.source_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            match session_opt {
                Some(row) => {
                    let session_id: Uuid = row.try_get("id").unwrap();
                    source_name = row.try_get("name").unwrap_or_default();
                    sqlx::query(
                        r#"
                        INSERT INTO kudiba_treasury.cash_movements (
                            id, tenant_id, session_id, register_id, movement_type,
                            amount, reason, operator_user_id, created_at, activity_type, category
                        ) VALUES ($1, $2, $3, $4, 'BLEED', $5, $6, $7, NOW(), 'OPERATIONAL', 'TRANSFERENCIA_INTERNA')
                        "#,
                    )
                    .bind(Uuid::new_v4())
                    .bind(tenant_id)
                    .bind(session_id)
                    .bind(req.source_id)
                    .bind(req.amount)
                    .bind(format!("Transferência interna: Saída de caixa ({})", req.notes.as_deref().unwrap_or("Sangria de transferência")))
                    .bind(operator_user_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
                }
                None => {
                    return Err(DomainError::InvalidSessionState(
                        "O caixa de origem não tem uma sessão aberta no momento".to_string(),
                    ));
                }
            }
        }

        if target_type == "BANK" {
            let res = sqlx::query(
                "UPDATE kudiba_treasury.bank_accounts \
                 SET current_balance = current_balance + $1, updated_at = NOW() \
                 WHERE tenant_id = $2 AND id = $3 \
                 RETURNING bank_name",
            )
            .bind(req.amount)
            .bind(tenant_id)
            .bind(req.target_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            match res {
                Some(r) => target_name = r.try_get("bank_name").unwrap_or_default(),
                None => {
                    return Err(DomainError::NotFound(
                        "Conta bancária de destino não encontrada".to_string(),
                    ));
                }
            }
        } else if target_type == "REGISTER" {
            let session_opt = sqlx::query(
                "SELECT cs.id, cr.name \
                 FROM kudiba_treasury.cash_sessions cs \
                 JOIN kudiba_treasury.cash_registers cr ON cs.register_id = cr.id \
                 WHERE cs.tenant_id = $1 AND cs.register_id = $2 AND cs.status = 'OPEN'",
            )
            .bind(tenant_id)
            .bind(req.target_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            match session_opt {
                Some(row) => {
                    let session_id: Uuid = row.try_get("id").unwrap();
                    target_name = row.try_get("name").unwrap_or_default();
                    sqlx::query(
                        r#"
                        INSERT INTO kudiba_treasury.cash_movements (
                            id, tenant_id, session_id, register_id, movement_type,
                            amount, reason, operator_user_id, created_at, activity_type, category
                        ) VALUES ($1, $2, $3, $4, 'SUPPLY', $5, $6, $7, NOW(), 'OPERATIONAL', 'TRANSFERENCIA_INTERNA')
                        "#,
                    )
                    .bind(Uuid::new_v4())
                    .bind(tenant_id)
                    .bind(session_id)
                    .bind(req.target_id)
                    .bind(req.amount)
                    .bind(format!("Transferência interna: Entrada em caixa ({})", req.notes.as_deref().unwrap_or("Suprimento por transferência")))
                    .bind(operator_user_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
                }
                None => {
                    return Err(DomainError::InvalidSessionState(
                        "O caixa de destino não tem uma sessão aberta no momento".to_string(),
                    ));
                }
            }
        }

        let transfer_id = Uuid::new_v4();
        let now = Utc::now();
        let transfer_number = format!("TRF-INT-{}-{}", now.format("%Y%m%d"), &transfer_id.to_string()[..6].to_uppercase());

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.cash_transfers (
                id, tenant_id, transfer_number, source_type, source_id,
                target_type, target_id, amount, fee_amount, currency,
                status, operator_user_id, notes, transferred_at, created_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10::kudiba_treasury.currency_code,
                'COMPLETED', $11, $12, $13, $13
            )
            "#,
        )
        .bind(transfer_id)
        .bind(tenant_id)
        .bind(&transfer_number)
        .bind(&source_type)
        .bind(req.source_id)
        .bind(&target_type)
        .bind(req.target_id)
        .bind(req.amount)
        .bind(fee)
        .bind(&currency)
        .bind(operator_user_id)
        .bind(&req.notes)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(CashTransferResponse {
            id: transfer_id,
            tenant_id,
            transfer_number,
            source_type,
            source_id: req.source_id,
            source_name: Some(source_name),
            target_type,
            target_id: req.target_id,
            target_name: Some(target_name),
            amount: req.amount,
            fee_amount: fee,
            currency,
            status: "COMPLETED".to_string(),
            operator_user_id: operator_user_id.to_string(),
            notes: req.notes,
            transferred_at: now,
            created_at: now,
        })
    }

    pub async fn list_transfers(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<CashTransferResponse>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, tenant_id, transfer_number, source_type, source_id, \
                    target_type, target_id, amount, fee_amount, currency::text AS currency, \
                    status, operator_user_id, notes, transferred_at, created_at \
             FROM kudiba_treasury.cash_transfers \
             WHERE tenant_id = $1 \
             ORDER BY transferred_at DESC",
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(CashTransferResponse {
                id: r.try_get("id").unwrap(),
                tenant_id: r.try_get("tenant_id").unwrap(),
                transfer_number: r.try_get("transfer_number").unwrap_or_default(),
                source_type: r.try_get("source_type").unwrap_or_default(),
                source_id: r.try_get("source_id").unwrap(),
                source_name: None,
                target_type: r.try_get("target_type").unwrap_or_default(),
                target_id: r.try_get("target_id").unwrap(),
                target_name: None,
                amount: r.try_get("amount").unwrap_or(Decimal::ZERO),
                fee_amount: r.try_get("fee_amount").unwrap_or(Decimal::ZERO),
                currency: r.try_get("currency").unwrap_or_else(|_| "AOA".to_string()),
                status: r.try_get("status").unwrap_or_else(|_| "COMPLETED".to_string()),
                operator_user_id: r.try_get("operator_user_id").unwrap_or_default(),
                notes: r.try_get("notes").ok(),
                transferred_at: r.try_get("transferred_at").unwrap(),
                created_at: r.try_get("created_at").unwrap(),
            });
        }

        Ok(list)
    }
}
