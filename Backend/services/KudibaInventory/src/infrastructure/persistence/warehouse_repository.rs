use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::Warehouse;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::WarehouseRepository;
use crate::infrastructure::persistence::models::WarehouseRow;

pub struct PostgresWarehouseRepository;

impl PostgresWarehouseRepository {
    pub fn new() -> Self {
        Self
    }
}

impl Default for PostgresWarehouseRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl WarehouseRepository for PostgresWarehouseRepository {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Warehouse>, RepositoryError> {
        let opt: Option<WarehouseRow> = sqlx::query_as(
            "SELECT id, tenant_id, branch_id, code, name, is_default, \
             address_detail, is_active, created_at, updated_at \
             FROM kudiba_inventory.warehouses WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(Warehouse::from))
    }

    async fn find_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Warehouse>, RepositoryError> {
        let opt: Option<WarehouseRow> = sqlx::query_as(
            "SELECT id, tenant_id, branch_id, code, name, is_default, \
             address_detail, is_active, created_at, updated_at \
             FROM kudiba_inventory.warehouses WHERE tenant_id = $1 AND code = $2",
        )
        .bind(tenant_id)
        .bind(code.trim().to_uppercase())
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(Warehouse::from))
    }

    async fn save(
        &self,
        session: &mut dyn DbSession,
        w: &Warehouse,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_inventory.warehouses (
                id, tenant_id, branch_id, code, name, is_default, address_detail, is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
            ON CONFLICT (tenant_id, code) DO UPDATE SET
                branch_id = EXCLUDED.branch_id,
                name = EXCLUDED.name,
                is_default = EXCLUDED.is_default,
                address_detail = EXCLUDED.address_detail,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(w.id)
        .bind(w.tenant_id)
        .bind(w.branch_id)
        .bind(&w.code)
        .bind(&w.name)
        .bind(w.is_default)
        .bind(&w.address_detail)
        .bind(w.is_active)
        .bind(w.created_at)
        .bind(w.updated_at)
        .execute(&mut *session.connection())
        .await?;

        if w.is_default {
            sqlx::query(
                "UPDATE kudiba_inventory.warehouses SET is_default = FALSE WHERE tenant_id = $1 AND id != $2"
            )
            .bind(w.tenant_id)
            .bind(w.id)
            .execute(&mut *session.connection())
            .await?;
        }

        Ok(())
    }

    async fn update(
        &self,
        session: &mut dyn DbSession,
        w: &Warehouse,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            UPDATE kudiba_inventory.warehouses SET
                name = $1,
                is_default = $2,
                address_detail = $3,
                is_active = $4,
                updated_at = $5
            WHERE tenant_id = $6 AND id = $7
            "#,
        )
        .bind(&w.name)
        .bind(w.is_default)
        .bind(&w.address_detail)
        .bind(w.is_active)
        .bind(w.updated_at)
        .bind(w.tenant_id)
        .bind(w.id)
        .execute(&mut *session.connection())
        .await?;

        if w.is_default {
            sqlx::query(
                "UPDATE kudiba_inventory.warehouses SET is_default = FALSE WHERE tenant_id = $1 AND id != $2"
            )
            .bind(w.tenant_id)
            .bind(w.id)
            .execute(&mut *session.connection())
            .await?;
        }

        Ok(())
    }

    async fn list_by_branch(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        branch_id: Uuid,
    ) -> Result<Vec<Warehouse>, RepositoryError> {
        let rows: Vec<WarehouseRow> = sqlx::query_as(
            "SELECT id, tenant_id, branch_id, code, name, is_default, \
             address_detail, is_active, created_at, updated_at \
             FROM kudiba_inventory.warehouses \
             WHERE tenant_id = $1 AND branch_id = $2 ORDER BY name ASC",
        )
        .bind(tenant_id)
        .bind(branch_id)
        .fetch_all(&mut *session.connection())
        .await?;

        Ok(rows.into_iter().map(Warehouse::from).collect())
    }

    async fn list_all(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
    ) -> Result<Vec<Warehouse>, RepositoryError> {
        let rows: Vec<WarehouseRow> = sqlx::query_as(
            "SELECT id, tenant_id, branch_id, code, name, is_default, \
             address_detail, is_active, created_at, updated_at \
             FROM kudiba_inventory.warehouses WHERE tenant_id = $1 ORDER BY name ASC",
        )
        .bind(tenant_id)
        .fetch_all(&mut *session.connection())
        .await?;

        Ok(rows.into_iter().map(Warehouse::from).collect())
    }
}
