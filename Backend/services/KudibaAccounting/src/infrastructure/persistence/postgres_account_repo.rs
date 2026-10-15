use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::Account;
use crate::domain::error::DomainError;
use crate::domain::ports::AccountRepository;
use crate::infrastructure::persistence::models::AccountRow;

pub struct PostgresAccountRepository {
    pool: PgPool,
}

impl PostgresAccountRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AccountRepository for PostgresAccountRepository {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Account>, DomainError> {
        let row: Option<AccountRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, account_code, parent_account_code, account_name,
                   account_class::text, account_nature::text, is_analytical,
                   is_system_reserved, saft_grouping_code, is_active, created_at
            FROM kudiba_accounting.chart_of_accounts
            WHERE tenant_id = $1 AND account_code = $2
            "#,
        )
        .bind(tenant_id)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(|r| r.into_domain()))
    }

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Account>, DomainError> {
        let rows: Vec<AccountRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, account_code, parent_account_code, account_name,
                   account_class::text, account_nature::text, is_analytical,
                   is_system_reserved, saft_grouping_code, is_active, created_at
            FROM kudiba_accounting.chart_of_accounts
            WHERE tenant_id = $1 AND is_active = TRUE
            ORDER BY account_code ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(|r| r.into_domain()).collect())
    }

    async fn save(&self, account: &Account) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.chart_of_accounts (
                id, tenant_id, account_code, parent_account_code, account_name,
                account_class, account_nature, is_analytical, is_system_reserved,
                saft_grouping_code, is_active, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::kudiba_accounting.account_class, $7::kudiba_accounting.account_nature, $8, $9, $10, $11, $12)
            ON CONFLICT (tenant_id, account_code) DO UPDATE SET
                account_name = EXCLUDED.account_name,
                parent_account_code = EXCLUDED.parent_account_code,
                is_analytical = EXCLUDED.is_analytical,
                saft_grouping_code = EXCLUDED.saft_grouping_code,
                is_active = EXCLUDED.is_active
            "#,
        )
        .bind(account.id)
        .bind(account.tenant_id)
        .bind(&account.account_code)
        .bind(&account.parent_account_code)
        .bind(&account.account_name)
        .bind(account.account_class.as_str())
        .bind(account.account_nature.as_str())
        .bind(account.is_analytical)
        .bind(account.is_system_reserved)
        .bind(&account.saft_grouping_code)
        .bind(account.is_active)
        .bind(account.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn save_batch(&self, accounts: &[Account]) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for account in accounts {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.chart_of_accounts (
                    id, tenant_id, account_code, parent_account_code, account_name,
                    account_class, account_nature, is_analytical, is_system_reserved,
                    saft_grouping_code, is_active, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6::kudiba_accounting.account_class, $7::kudiba_accounting.account_nature, $8, $9, $10, $11, $12)
                ON CONFLICT (tenant_id, account_code) DO NOTHING
                "#,
            )
            .bind(account.id)
            .bind(account.tenant_id)
            .bind(&account.account_code)
            .bind(&account.parent_account_code)
            .bind(&account.account_name)
            .bind(account.account_class.as_str())
            .bind(account.account_nature.as_str())
            .bind(account.is_analytical)
            .bind(account.is_system_reserved)
            .bind(&account.saft_grouping_code)
            .bind(account.is_active)
            .bind(account.created_at)
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
