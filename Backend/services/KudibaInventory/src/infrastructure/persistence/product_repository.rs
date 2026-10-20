use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::Product;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::ProductRepository;
use crate::infrastructure::persistence::models::ProductRow;

fn to_product(row: ProductRow) -> Result<Product, RepositoryError> {
    row.try_into()
        .map_err(|err: InventoryError| RepositoryError::Database(err.to_string()))
}

pub struct PostgresProductRepository;

impl PostgresProductRepository {
    pub fn new() -> Self {
        Self
    }
}

impl Default for PostgresProductRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ProductRepository for PostgresProductRepository {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Product>, RepositoryError> {
        let opt: Option<ProductRow> = sqlx::query_as(
            "SELECT id, tenant_id, code, ref_id, barcode, name, description, \
             product_type::text, is_stockable, track_lots, unit_of_measure, \
             sale_price, cost_price, current_cmp, tax_type, tax_code, \
             tax_percentage, exemption_reason_code, exemption_reason_text, \
             has_withholding_tax, is_active, created_at, updated_at \
             FROM kudiba_inventory.products WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *session.connection())
        .await?;

        opt.map(to_product).transpose()
    }

    async fn find_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Product>, RepositoryError> {
        let opt: Option<ProductRow> = sqlx::query_as(
            "SELECT id, tenant_id, code, ref_id, barcode, name, description, \
             product_type::text, is_stockable, track_lots, unit_of_measure, \
             sale_price, cost_price, current_cmp, tax_type, tax_code, \
             tax_percentage, exemption_reason_code, exemption_reason_text, \
             has_withholding_tax, is_active, created_at, updated_at \
             FROM kudiba_inventory.products WHERE tenant_id = $1 AND code = $2",
        )
        .bind(tenant_id)
        .bind(code.trim().to_uppercase())
        .fetch_optional(&mut *session.connection())
        .await?;

        opt.map(to_product).transpose()
    }

    async fn lock_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Product>, RepositoryError> {
        let opt: Option<ProductRow> = sqlx::query_as(
            "SELECT id, tenant_id, code, ref_id, barcode, name, description, \
             product_type::text, is_stockable, track_lots, unit_of_measure, \
             sale_price, cost_price, current_cmp, tax_type, tax_code, \
             tax_percentage, exemption_reason_code, exemption_reason_text, \
             has_withholding_tax, is_active, created_at, updated_at \
             FROM kudiba_inventory.products WHERE tenant_id = $1 AND id = $2 FOR UPDATE",
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *session.connection())
        .await?;

        opt.map(to_product).transpose()
    }

    async fn save(&self, session: &mut dyn DbSession, p: &Product) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_inventory.products (
                id, tenant_id, code, ref_id, barcode, name, description,
                product_type, is_stockable, track_lots, unit_of_measure,
                sale_price, cost_price, current_cmp, tax_type, tax_code,
                tax_percentage, exemption_reason_code, exemption_reason_text,
                has_withholding_tax, is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8::kudiba_inventory.product_kind, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23
            )
            ON CONFLICT (tenant_id, code) DO UPDATE SET
                ref_id = EXCLUDED.ref_id,
                barcode = EXCLUDED.barcode,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                unit_of_measure = EXCLUDED.unit_of_measure,
                sale_price = EXCLUDED.sale_price,
                cost_price = EXCLUDED.cost_price,
                current_cmp = EXCLUDED.current_cmp,
                tax_type = EXCLUDED.tax_type,
                tax_code = EXCLUDED.tax_code,
                tax_percentage = EXCLUDED.tax_percentage,
                exemption_reason_code = EXCLUDED.exemption_reason_code,
                exemption_reason_text = EXCLUDED.exemption_reason_text,
                has_withholding_tax = EXCLUDED.has_withholding_tax,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(p.id)
        .bind(p.tenant_id)
        .bind(&p.code)
        .bind(&p.ref_id)
        .bind(&p.barcode)
        .bind(&p.name)
        .bind(&p.description)
        .bind(p.product_type.as_saft_code())
        .bind(p.is_stockable)
        .bind(p.track_lots)
        .bind(&p.unit_of_measure)
        .bind(p.sale_price)
        .bind(p.cost_price)
        .bind(p.current_cmp)
        .bind(&p.tax_type)
        .bind(&p.tax_code)
        .bind(p.tax_percentage)
        .bind(&p.exemption_reason_code)
        .bind(&p.exemption_reason_text)
        .bind(p.has_withholding_tax)
        .bind(p.is_active)
        .bind(p.created_at)
        .bind(p.updated_at)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn update(
        &self,
        session: &mut dyn DbSession,
        p: &Product,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            UPDATE kudiba_inventory.products SET
                ref_id = $1,
                barcode = $2,
                name = $3,
                description = $4,
                unit_of_measure = $5,
                sale_price = $6,
                cost_price = $7,
                current_cmp = $8,
                tax_type = $9,
                tax_code = $10,
                tax_percentage = $11,
                exemption_reason_code = $12,
                exemption_reason_text = $13,
                has_withholding_tax = $14,
                is_active = $15,
                updated_at = $16
            WHERE tenant_id = $17 AND id = $18
            "#,
        )
        .bind(&p.ref_id)
        .bind(&p.barcode)
        .bind(&p.name)
        .bind(&p.description)
        .bind(&p.unit_of_measure)
        .bind(p.sale_price)
        .bind(p.cost_price)
        .bind(p.current_cmp)
        .bind(&p.tax_type)
        .bind(&p.tax_code)
        .bind(p.tax_percentage)
        .bind(&p.exemption_reason_code)
        .bind(&p.exemption_reason_text)
        .bind(p.has_withholding_tax)
        .bind(p.is_active)
        .bind(p.updated_at)
        .bind(p.tenant_id)
        .bind(p.id)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn update_prices_and_cmp(
        &self,
        session: &mut dyn DbSession,
        p: &Product,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "UPDATE kudiba_inventory.products \
             SET sale_price = $1, cost_price = $2, current_cmp = $3, updated_at = $4 \
             WHERE tenant_id = $5 AND id = $6",
        )
        .bind(p.sale_price)
        .bind(p.cost_price)
        .bind(p.current_cmp)
        .bind(p.updated_at)
        .bind(p.tenant_id)
        .bind(p.id)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn list(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<Product>, RepositoryError> {
        let rows: Vec<ProductRow> = sqlx::query_as(
            "SELECT id, tenant_id, code, ref_id, barcode, name, description, \
             product_type::text, is_stockable, track_lots, unit_of_measure, \
             sale_price, cost_price, current_cmp, tax_type, tax_code, \
             tax_percentage, exemption_reason_code, exemption_reason_text, \
             has_withholding_tax, is_active, created_at, updated_at \
             FROM kudiba_inventory.products WHERE tenant_id = $1 \
             ORDER BY name ASC LIMIT $2 OFFSET $3",
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&mut *session.connection())
        .await?;

        rows.into_iter().map(to_product).collect()
    }

    async fn next_product_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        prefix: &str,
    ) -> Result<String, RepositoryError> {
        let pattern = format!("{}-%", prefix);
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT code FROM kudiba_inventory.products \
             WHERE tenant_id = $1 AND code LIKE $2 \
             ORDER BY LENGTH(code) DESC, code DESC LIMIT 100",
        )
        .bind(tenant_id)
        .bind(&pattern)
        .fetch_all(&mut *session.connection())
        .await?;

        let mut max_num = 0u64;
        let prefix_dash = format!("{}-", prefix);
        for (code,) in rows {
            if let Some(suffix) = code.strip_prefix(&prefix_dash) {
                if let Ok(num) = suffix.parse::<u64>() {
                    if num > max_num {
                        max_num = num;
                    }
                }
            }
        }

        let next_code = format!("{}-{:03}", prefix, max_num + 1);
        Ok(next_code)
    }
}
