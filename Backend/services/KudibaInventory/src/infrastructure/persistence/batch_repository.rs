use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::ProductBatch;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::BatchRepository;
use crate::infrastructure::persistence::models::BatchRow;

pub struct PostgresBatchRepository;

impl PostgresBatchRepository {
    pub fn new() -> Self {
        Self
    }
}

impl Default for PostgresBatchRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BatchRepository for PostgresBatchRepository {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<ProductBatch>, RepositoryError> {
        let opt: Option<BatchRow> = sqlx::query_as(
            "SELECT id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at \
             FROM kudiba_inventory.product_batches \
             WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(ProductBatch::from))
    }

    async fn find_by_number(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
        batch_number: &str,
    ) -> Result<Option<ProductBatch>, RepositoryError> {
        let opt: Option<BatchRow> = sqlx::query_as(
            "SELECT id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at \
             FROM kudiba_inventory.product_batches \
             WHERE tenant_id = $1 AND product_id = $2 AND batch_number = $3",
        )
        .bind(tenant_id)
        .bind(product_id)
        .bind(batch_number)
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(ProductBatch::from))
    }

    async fn save(
        &self,
        session: &mut dyn DbSession,
        batch: &ProductBatch,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO kudiba_inventory.product_batches \
             (id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             ON CONFLICT (product_id, batch_number) DO UPDATE SET \
             manufacture_date = EXCLUDED.manufacture_date, \
             expiry_date = EXCLUDED.expiry_date",
        )
        .bind(batch.id)
        .bind(batch.tenant_id)
        .bind(batch.product_id)
        .bind(&batch.batch_number)
        .bind(batch.manufacture_date)
        .bind(batch.expiry_date)
        .bind(batch.created_at)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn list_by_product(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<ProductBatch>, RepositoryError> {
        let rows: Vec<BatchRow> = sqlx::query_as(
            "SELECT id, tenant_id, product_id, batch_number, manufacture_date, expiry_date, created_at \
             FROM kudiba_inventory.product_batches \
             WHERE tenant_id = $1 AND product_id = $2 \
             ORDER BY created_at DESC",
        )
        .bind(tenant_id)
        .bind(product_id)
        .fetch_all(&mut *session.connection())
        .await?;

        Ok(rows.into_iter().map(ProductBatch::from).collect())
    }
}
