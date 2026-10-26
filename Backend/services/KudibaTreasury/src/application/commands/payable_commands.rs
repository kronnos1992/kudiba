use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::application::dto::{
    CreatePayableRequest, InvoicePayableResponse, PayableSettlementResponse, SettlePayableRequest,
};
use crate::domain::error::DomainError;

#[derive(Clone)]
pub struct PayableCommands {
    pool: PgPool,
}

impl PayableCommands {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_payable(
        &self,
        tenant_id: Uuid,
        req: CreatePayableRequest,
    ) -> Result<InvoicePayableResponse, DomainError> {
        if req.supplier_name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "O nome do fornecedor é obrigatório".to_string(),
            ));
        }
        if req.invoice_number.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "O número da fatura do fornecedor é obrigatório".to_string(),
            ));
        }
        if req.gross_total <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O valor bruto da fatura deve ser superior a zero".to_string(),
            ));
        }

        let rate = req.withholding_rate.unwrap_or(Decimal::ZERO);
        let withholding_amount = if rate > Decimal::ZERO {
            (req.gross_total * rate / dec!(100.0)).round_dp(4)
        } else {
            Decimal::ZERO
        };
        let net_payable = req.gross_total - withholding_amount;
        let id = Uuid::new_v4();
        let now = Utc::now();
        let issue_date = req.issue_date.unwrap_or_else(|| now.date_naive());
        let currency = req.currency.unwrap_or_else(|| "AOA".to_string());
        let activity_type = req.activity_type.unwrap_or_else(|| "OPERATIONAL".to_string());
        let category = req.category.unwrap_or_else(|| "FORNECEDORES_MERCADORIAS".to_string());

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.invoice_payables (
                id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
                activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
                net_payable, amount_paid, due_date, issue_date, payment_method, status, notes,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7::kudiba_treasury.activity_type, $8, $9::kudiba_treasury.currency_code, $10, $11, $12,
                $13, 0, $14, $15, $16::kudiba_treasury.payment_method, 'OUTSTANDING', $17,
                $18, $18
            )
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(&req.supplier_id)
        .bind(&req.supplier_name)
        .bind(&req.supplier_nif)
        .bind(&req.invoice_number)
        .bind(&activity_type)
        .bind(&category)
        .bind(&currency)
        .bind(req.gross_total)
        .bind(rate)
        .bind(withholding_amount)
        .bind(net_payable)
        .bind(req.due_date)
        .bind(issue_date)
        .bind(req.payment_method.as_deref().unwrap_or("TRANSFERENCIA"))
        .bind(&req.notes)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(InvoicePayableResponse {
            id,
            tenant_id,
            supplier_id: req.supplier_id,
            supplier_name: req.supplier_name,
            supplier_nif: req.supplier_nif,
            invoice_number: req.invoice_number,
            activity_type,
            category,
            currency,
            gross_total: req.gross_total,
            withholding_rate: rate,
            withholding_amount,
            net_payable,
            amount_paid: Decimal::ZERO,
            due_date: req.due_date,
            issue_date,
            payment_method: req.payment_method,
            status: "OUTSTANDING".to_string(),
            notes: req.notes,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn settle_payable(
        &self,
        tenant_id: Uuid,
        payable_id: Uuid,
        operator_user_id: &str,
        req: SettlePayableRequest,
    ) -> Result<PayableSettlementResponse, DomainError> {
        if req.amount_paid <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante de liquidação deve ser positivo".to_string(),
            ));
        }

        let mut tx = self.pool.begin().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let payable_row = sqlx::query(
            "SELECT id, net_payable, amount_paid, status::text AS status, invoice_number, supplier_name \
             FROM kudiba_treasury.invoice_payables \
             WHERE tenant_id = $1 AND id = $2 FOR UPDATE",
        )
        .bind(tenant_id)
        .bind(payable_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?
        .ok_or_else(|| DomainError::NotFound(format!("Conta a pagar '{}' não encontrada", payable_id)))?;

        let net_payable: Decimal = payable_row.try_get("net_payable").unwrap_or(Decimal::ZERO);
        let current_amount_paid: Decimal = payable_row.try_get("amount_paid").unwrap_or(Decimal::ZERO);
        let remaining = net_payable - current_amount_paid;

        if req.amount_paid > remaining {
            return Err(DomainError::ValidationError(format!(
                "Montante a liquidar ({}) superior ao saldo pendente da fatura ({})",
                req.amount_paid, remaining
            )));
        }

        let new_amount_paid = current_amount_paid + req.amount_paid;
        let new_status = if new_amount_paid >= net_payable {
            "SETTLED"
        } else {
            "PARTIALLY_PAID"
        };

        if let Some(bank_id) = req.bank_account_id {
            let bank_res = sqlx::query(
                "UPDATE kudiba_treasury.bank_accounts \
                 SET current_balance = current_balance - $1, updated_at = NOW() \
                 WHERE tenant_id = $2 AND id = $3 AND current_balance >= $1",
            )
            .bind(req.amount_paid)
            .bind(tenant_id)
            .bind(bank_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            if bank_res.rows_affected() == 0 {
                return Err(DomainError::InsufficientFunds(
                    "Saldo bancário insuficiente para efetuar o pagamento da fatura".to_string(),
                ));
            }
        }

        let settlement_id = Uuid::new_v4();
        let now = Utc::now();
        let payment_method_str = req.payment_method.to_string();

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.payable_settlements (
                id, tenant_id, payable_id, bank_account_id, session_id,
                amount_paid, payment_method, payment_reference, settled_at,
                operator_user_id, notes
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7::kudiba_treasury.payment_method, $8, $9,
                $10, $11
            )
            "#,
        )
        .bind(settlement_id)
        .bind(tenant_id)
        .bind(payable_id)
        .bind(req.bank_account_id)
        .bind(req.session_id)
        .bind(req.amount_paid)
        .bind(&payment_method_str)
        .bind(&req.payment_reference)
        .bind(now)
        .bind(operator_user_id)
        .bind(&req.notes)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        sqlx::query(
            "UPDATE kudiba_treasury.invoice_payables \
             SET amount_paid = $1, status = $2::kudiba_treasury.payable_status, updated_at = NOW() \
             WHERE tenant_id = $3 AND id = $4",
        )
        .bind(new_amount_paid)
        .bind(new_status)
        .bind(tenant_id)
        .bind(payable_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(PayableSettlementResponse {
            id: settlement_id,
            tenant_id,
            payable_id,
            bank_account_id: req.bank_account_id,
            session_id: req.session_id,
            amount_paid: req.amount_paid,
            payment_method: payment_method_str,
            payment_reference: req.payment_reference,
            settled_at: now,
            operator_user_id: operator_user_id.to_string(),
            notes: req.notes,
        })
    }

    pub async fn list_payables(
        &self,
        tenant_id: Uuid,
        status: Option<&str>,
        activity_type: Option<&str>,
    ) -> Result<Vec<InvoicePayableResponse>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number, \
                    activity_type::text AS activity_type, category, currency::text AS currency, \
                    gross_total, withholding_rate, withholding_amount, net_payable, amount_paid, \
                    due_date, issue_date, payment_method::text AS payment_method, \
                    status::text AS status, notes, created_at, updated_at \
             FROM kudiba_treasury.invoice_payables \
             WHERE tenant_id = $1 \
               AND ($2::text IS NULL OR status::text = $2) \
               AND ($3::text IS NULL OR activity_type::text = $3) \
             ORDER BY due_date ASC",
        )
        .bind(tenant_id)
        .bind(status)
        .bind(activity_type)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(InvoicePayableResponse {
                id: r.try_get("id").unwrap(),
                tenant_id: r.try_get("tenant_id").unwrap(),
                supplier_id: r.try_get("supplier_id").ok(),
                supplier_name: r.try_get("supplier_name").unwrap_or_default(),
                supplier_nif: r.try_get("supplier_nif").ok(),
                invoice_number: r.try_get("invoice_number").unwrap_or_default(),
                activity_type: r.try_get("activity_type").unwrap_or_else(|_| "OPERATIONAL".to_string()),
                category: r.try_get("category").unwrap_or_else(|_| "FORNECEDORES".to_string()),
                currency: r.try_get("currency").unwrap_or_else(|_| "AOA".to_string()),
                gross_total: r.try_get("gross_total").unwrap_or(Decimal::ZERO),
                withholding_rate: r.try_get("withholding_rate").unwrap_or(Decimal::ZERO),
                withholding_amount: r.try_get("withholding_amount").unwrap_or(Decimal::ZERO),
                net_payable: r.try_get("net_payable").unwrap_or(Decimal::ZERO),
                amount_paid: r.try_get("amount_paid").unwrap_or(Decimal::ZERO),
                due_date: r.try_get("due_date").unwrap(),
                issue_date: r.try_get("issue_date").unwrap(),
                payment_method: r.try_get("payment_method").ok(),
                status: r.try_get("status").unwrap_or_else(|_| "OUTSTANDING".to_string()),
                notes: r.try_get("notes").ok(),
                created_at: r.try_get("created_at").unwrap(),
                updated_at: r.try_get("updated_at").unwrap(),
            });
        }

        Ok(list)
    }

    pub async fn list_settlements_for_payable(
        &self,
        tenant_id: Uuid,
        payable_id: Uuid,
    ) -> Result<Vec<PayableSettlementResponse>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, tenant_id, payable_id, bank_account_id, session_id, \
                    amount_paid, payment_method::text AS payment_method, payment_reference, \
                    settled_at, operator_user_id, notes \
             FROM kudiba_treasury.payable_settlements \
             WHERE tenant_id = $1 AND payable_id = $2 \
             ORDER BY settled_at DESC",
        )
        .bind(tenant_id)
        .bind(payable_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(PayableSettlementResponse {
                id: r.try_get("id").unwrap(),
                tenant_id: r.try_get("tenant_id").unwrap(),
                payable_id: r.try_get("payable_id").unwrap(),
                bank_account_id: r.try_get("bank_account_id").ok(),
                session_id: r.try_get("session_id").ok(),
                amount_paid: r.try_get("amount_paid").unwrap_or(Decimal::ZERO),
                payment_method: r.try_get("payment_method").unwrap_or_else(|_| "TRANSFERENCIA".to_string()),
                payment_reference: r.try_get("payment_reference").ok(),
                settled_at: r.try_get("settled_at").unwrap(),
                operator_user_id: r.try_get("operator_user_id").unwrap_or_default(),
                notes: r.try_get("notes").ok(),
            });
        }

        Ok(list)
    }
}
