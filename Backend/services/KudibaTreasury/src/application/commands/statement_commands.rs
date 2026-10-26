use chrono::Utc;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::application::dto::{
    BankStatementLineResponse, BankStatementResponse, CreateBankStatementLineRequest,
    CreateBankStatementRequest, ReconcileLineRequest,
};
use crate::domain::error::DomainError;

#[derive(Clone)]
pub struct StatementCommands {
    pool: PgPool,
}

impl StatementCommands {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_statement(
        &self,
        tenant_id: Uuid,
        req: CreateBankStatementRequest,
    ) -> Result<BankStatementResponse, DomainError> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.bank_statements (
                id, tenant_id, bank_account_id, reference_period, start_balance,
                end_balance, statement_date, file_name, status, created_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, 'OPEN', $9
            )
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(req.bank_account_id)
        .bind(&req.reference_period)
        .bind(req.start_balance)
        .bind(req.end_balance)
        .bind(req.statement_date)
        .bind(&req.file_name)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(BankStatementResponse {
            id,
            tenant_id,
            bank_account_id: req.bank_account_id,
            bank_name: None,
            reference_period: req.reference_period,
            start_balance: req.start_balance,
            end_balance: req.end_balance,
            statement_date: req.statement_date,
            file_name: req.file_name,
            status: "OPEN".to_string(),
            created_at: now,
        })
    }

    pub async fn add_statement_line(
        &self,
        tenant_id: Uuid,
        statement_id: Uuid,
        req: CreateBankStatementLineRequest,
    ) -> Result<BankStatementLineResponse, DomainError> {
        let id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.bank_statement_lines (
                id, statement_id, tenant_id, line_date, description,
                document_ref, amount, balance_after, movement_type, is_reconciled
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, false
            )
            "#,
        )
        .bind(id)
        .bind(statement_id)
        .bind(tenant_id)
        .bind(req.line_date)
        .bind(&req.description)
        .bind(&req.document_ref)
        .bind(req.amount)
        .bind(req.balance_after)
        .bind(&req.movement_type)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(BankStatementLineResponse {
            id,
            statement_id,
            tenant_id,
            line_date: req.line_date,
            description: req.description,
            document_ref: req.document_ref,
            amount: req.amount,
            balance_after: req.balance_after,
            movement_type: req.movement_type,
            is_reconciled: false,
            matched_type: None,
            matched_id: None,
            reconciled_at: None,
            reconciled_by: None,
        })
    }

    pub async fn reconcile_line(
        &self,
        tenant_id: Uuid,
        line_id: Uuid,
        operator_user_id: &str,
        req: ReconcileLineRequest,
    ) -> Result<BankStatementLineResponse, DomainError> {
        let mut tx = self.pool.begin().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let line_row = sqlx::query(
            "SELECT bsl.id, bsl.statement_id, bsl.tenant_id, bsl.line_date, bsl.description, \
                    bsl.document_ref, bsl.amount, bsl.balance_after, bsl.movement_type, \
                    bsl.is_reconciled, bs.bank_account_id \
             FROM kudiba_treasury.bank_statement_lines bsl \
             JOIN kudiba_treasury.bank_statements bs ON bsl.statement_id = bs.id \
             WHERE bsl.tenant_id = $1 AND bsl.id = $2 FOR UPDATE",
        )
        .bind(tenant_id)
        .bind(line_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?
        .ok_or_else(|| DomainError::NotFound(format!("Linha de extrato '{}' não encontrada", line_id)))?;

        let is_reconciled: bool = line_row.try_get("is_reconciled").unwrap_or(false);
        if is_reconciled {
            return Err(DomainError::ValidationError(
                "Esta linha de extrato já se encontra conciliada".to_string(),
            ));
        }

        let amount: Decimal = line_row.try_get("amount").unwrap_or(Decimal::ZERO);
        let bank_account_id: Uuid = line_row.try_get("bank_account_id").unwrap();
        let statement_id: Uuid = line_row.try_get("statement_id").unwrap();
        let line_date: chrono::NaiveDate = line_row.try_get("line_date").unwrap();
        let description: String = line_row.try_get("description").unwrap_or_default();
        let document_ref: Option<String> = line_row.try_get("document_ref").ok();
        let balance_after: Decimal = line_row.try_get("balance_after").unwrap_or(Decimal::ZERO);
        let movement_type: String = line_row.try_get("movement_type").unwrap_or_default();

        let now = Utc::now();

        sqlx::query(
            "UPDATE kudiba_treasury.bank_statement_lines \
             SET is_reconciled = true, matched_type = $1, matched_id = $2, \
                 reconciled_at = $3, reconciled_by = $4 \
             WHERE tenant_id = $5 AND id = $6",
        )
        .bind(&req.matched_type)
        .bind(req.matched_id)
        .bind(now)
        .bind(operator_user_id)
        .bind(tenant_id)
        .bind(line_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        sqlx::query(
            "UPDATE kudiba_treasury.bank_accounts \
             SET reconciled_balance = reconciled_balance + $1, updated_at = NOW() \
             WHERE tenant_id = $2 AND id = $3",
        )
        .bind(amount)
        .bind(tenant_id)
        .bind(bank_account_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit().await.map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(BankStatementLineResponse {
            id: line_id,
            statement_id,
            tenant_id,
            line_date,
            description,
            document_ref,
            amount,
            balance_after,
            movement_type,
            is_reconciled: true,
            matched_type: Some(req.matched_type),
            matched_id: req.matched_id,
            reconciled_at: Some(now),
            reconciled_by: Some(operator_user_id.to_string()),
        })
    }

    pub async fn list_statements(
        &self,
        tenant_id: Uuid,
        bank_account_id: Option<Uuid>,
    ) -> Result<Vec<BankStatementResponse>, DomainError> {
        let rows = sqlx::query(
            "SELECT bs.id, bs.tenant_id, bs.bank_account_id, ba.bank_name, \
                    bs.reference_period, bs.start_balance, bs.end_balance, \
                    bs.statement_date, bs.file_name, bs.status, bs.created_at \
             FROM kudiba_treasury.bank_statements bs \
             JOIN kudiba_treasury.bank_accounts ba ON bs.bank_account_id = ba.id \
             WHERE bs.tenant_id = $1 \
               AND ($2::uuid IS NULL OR bs.bank_account_id = $2) \
             ORDER BY bs.statement_date DESC",
        )
        .bind(tenant_id)
        .bind(bank_account_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(BankStatementResponse {
                id: r.try_get("id").unwrap(),
                tenant_id: r.try_get("tenant_id").unwrap(),
                bank_account_id: r.try_get("bank_account_id").unwrap(),
                bank_name: r.try_get("bank_name").ok(),
                reference_period: r.try_get("reference_period").unwrap_or_default(),
                start_balance: r.try_get("start_balance").unwrap_or(Decimal::ZERO),
                end_balance: r.try_get("end_balance").unwrap_or(Decimal::ZERO),
                statement_date: r.try_get("statement_date").unwrap(),
                file_name: r.try_get("file_name").ok(),
                status: r.try_get("status").unwrap_or_else(|_| "OPEN".to_string()),
                created_at: r.try_get("created_at").unwrap(),
            });
        }

        Ok(list)
    }

    pub async fn list_statement_lines(
        &self,
        tenant_id: Uuid,
        statement_id: Uuid,
    ) -> Result<Vec<BankStatementLineResponse>, DomainError> {
        let rows = sqlx::query(
            "SELECT id, statement_id, tenant_id, line_date, description, \
                    document_ref, amount, balance_after, movement_type, \
                    is_reconciled, matched_type, matched_id, reconciled_at, reconciled_by \
             FROM kudiba_treasury.bank_statement_lines \
             WHERE tenant_id = $1 AND statement_id = $2 \
             ORDER BY line_date ASC, id ASC",
        )
        .bind(tenant_id)
        .bind(statement_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(BankStatementLineResponse {
                id: r.try_get("id").unwrap(),
                statement_id: r.try_get("statement_id").unwrap(),
                tenant_id: r.try_get("tenant_id").unwrap(),
                line_date: r.try_get("line_date").unwrap(),
                description: r.try_get("description").unwrap_or_default(),
                document_ref: r.try_get("document_ref").ok(),
                amount: r.try_get("amount").unwrap_or(Decimal::ZERO),
                balance_after: r.try_get("balance_after").unwrap_or(Decimal::ZERO),
                movement_type: r.try_get("movement_type").unwrap_or_default(),
                is_reconciled: r.try_get("is_reconciled").unwrap_or(false),
                matched_type: r.try_get("matched_type").ok(),
                matched_id: r.try_get("matched_id").ok(),
                reconciled_at: r.try_get("reconciled_at").ok(),
                reconciled_by: r.try_get("reconciled_by").ok(),
            });
        }

        Ok(list)
    }
}
