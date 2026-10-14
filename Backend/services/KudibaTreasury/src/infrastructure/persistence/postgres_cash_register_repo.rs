use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::CashRegister;
use crate::domain::error::DomainError;
use crate::domain::ports::CashRegisterRepository;
use crate::infrastructure::persistence::models::CashRegisterRow;

pub struct PostgresCashRegisterRepository {
    pool: PgPool,
}

impl PostgresCashRegisterRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CashRegisterRepository for PostgresCashRegisterRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashRegister>, DomainError> {
        let row = sqlx::query_as::<_, CashRegisterRow>(
            r#"
            SELECT id, tenant_id, branch_id, code, name, is_active, created_at, updated_at
            FROM kudiba_treasury.cash_registers
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

    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<CashRegister>, DomainError> {
        let row = sqlx::query_as::<_, CashRegisterRow>(
            r#"
            SELECT id, tenant_id, branch_id, code, name, is_active, created_at, updated_at
            FROM kudiba_treasury.cash_registers
            WHERE tenant_id = $1 AND code = $2
            "#,
        )
        .bind(tenant_id)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn list(&self, tenant_id: Uuid) -> Result<Vec<CashRegister>, DomainError> {
        let rows = sqlx::query_as::<_, CashRegisterRow>(
            r#"
            SELECT id, tenant_id, branch_id, code, name, is_active, created_at, updated_at
            FROM kudiba_treasury.cash_registers
            WHERE tenant_id = $1
            ORDER BY code ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn save(&self, register: &CashRegister) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.cash_registers
                (id, tenant_id, branch_id, code, name, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(register.id)
        .bind(register.tenant_id)
        .bind(register.branch_id)
        .bind(&register.code)
        .bind(&register.name)
        .bind(register.is_active)
        .bind(register.created_at)
        .bind(register.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, register: &CashRegister) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_treasury.cash_registers
            SET branch_id = $1, name = $2, is_active = $3, updated_at = $4
            WHERE tenant_id = $5 AND id = $6
            "#,
        )
        .bind(register.branch_id)
        .bind(&register.name)
        .bind(register.is_active)
        .bind(register.updated_at)
        .bind(register.tenant_id)
        .bind(register.id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
