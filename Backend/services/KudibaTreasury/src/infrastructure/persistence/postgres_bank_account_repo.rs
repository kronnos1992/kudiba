use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::BankAccount;
use crate::domain::error::DomainError;
use crate::domain::ports::BankAccountRepository;
use crate::infrastructure::persistence::models::BankAccountRow;

pub struct PostgresBankAccountRepository {
    pool: PgPool,
}

impl PostgresBankAccountRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BankAccountRepository for PostgresBankAccountRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<BankAccount>, DomainError> {
        let row = sqlx::query_as::<_, BankAccountRow>(
            r#"
            SELECT id, tenant_id, bank_name, account_number, iban, currency, current_balance,
                   is_active, created_at, updated_at
            FROM kudiba_treasury.bank_accounts
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn find_by_iban(
        &self,
        tenant_id: Uuid,
        iban: &str,
    ) -> Result<Option<BankAccount>, DomainError> {
        let row = sqlx::query_as::<_, BankAccountRow>(
            r#"
            SELECT id, tenant_id, bank_name, account_number, iban, currency, current_balance,
                   is_active, created_at, updated_at
            FROM kudiba_treasury.bank_accounts
            WHERE tenant_id = $1 AND iban = $2
            "#,
        )
        .bind(tenant_id)
        .bind(iban)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn list(&self, tenant_id: Uuid) -> Result<Vec<BankAccount>, DomainError> {
        let rows = sqlx::query_as::<_, BankAccountRow>(
            r#"
            SELECT id, tenant_id, bank_name, account_number, iban, currency, current_balance,
                   is_active, created_at, updated_at
            FROM kudiba_treasury.bank_accounts
            WHERE tenant_id = $1
            ORDER BY bank_name ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn save(&self, account: &BankAccount) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.bank_accounts
                (id, tenant_id, bank_name, account_number, iban, currency, current_balance, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(account.id)
        .bind(account.tenant_id)
        .bind(&account.bank_name)
        .bind(&account.account_number)
        .bind(&account.iban)
        .bind(account.currency)
        .bind(account.current_balance)
        .bind(account.is_active)
        .bind(account.created_at)
        .bind(account.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, account: &BankAccount) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_treasury.bank_accounts
            SET bank_name = $1, account_number = $2, iban = $3, currency = $4,
                current_balance = $5, is_active = $6, updated_at = $7
            WHERE tenant_id = $8 AND id = $9
            "#,
        )
        .bind(&account.bank_name)
        .bind(&account.account_number)
        .bind(&account.iban)
        .bind(account.currency)
        .bind(account.current_balance)
        .bind(account.is_active)
        .bind(account.updated_at)
        .bind(account.tenant_id)
        .bind(account.id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
