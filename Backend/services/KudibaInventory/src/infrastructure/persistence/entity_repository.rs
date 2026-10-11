use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{CommercialEntity, EntityKind};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::EntityRepository;
use crate::domain::value_objects::TaxIdKind;
use crate::infrastructure::persistence::models::EntityRow;

fn to_entity(row: EntityRow) -> Result<CommercialEntity, RepositoryError> {
    row.try_into()
        .map_err(|err: InventoryError| RepositoryError::Database(err.to_string()))
}

pub struct PostgresEntityRepository;

impl PostgresEntityRepository {
    pub fn new() -> Self {
        Self
    }
}

impl Default for PostgresEntityRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EntityRepository for PostgresEntityRepository {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CommercialEntity>, RepositoryError> {
        let opt: Option<EntityRow> = sqlx::query_as(
            "SELECT id, tenant_id, entity_type::text, tax_id_type::text, tax_id, \
             name, trade_name, email, phone, is_withholding_agent, \
             country_code, province, city, address_detail, iban, \
             is_active, created_at, updated_at \
             FROM kudiba_inventory.entities WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut *session.connection())
        .await?;

        opt.map(to_entity).transpose()
    }

    async fn find_by_tax_id(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        tax_id: &str,
    ) -> Result<Option<CommercialEntity>, RepositoryError> {
        let opt: Option<EntityRow> = sqlx::query_as(
            "SELECT id, tenant_id, entity_type::text, tax_id_type::text, tax_id, \
             name, trade_name, email, phone, is_withholding_agent, \
             country_code, province, city, address_detail, iban, \
             is_active, created_at, updated_at \
             FROM kudiba_inventory.entities WHERE tenant_id = $1 AND tax_id = $2",
        )
        .bind(tenant_id)
        .bind(tax_id.trim().to_uppercase())
        .fetch_optional(&mut *session.connection())
        .await?;

        opt.map(to_entity).transpose()
    }

    async fn save(
        &self,
        session: &mut dyn DbSession,
        e: &CommercialEntity,
    ) -> Result<(), RepositoryError> {
        let entity_type_str = match e.entity_type {
            EntityKind::Customer => "CUSTOMER",
            EntityKind::Supplier => "SUPPLIER",
            EntityKind::Both => "BOTH",
        };
        let tax_kind_str = match e.tax_id.kind() {
            TaxIdKind::LegalEntity => "LEGAL_ENTITY",
            TaxIdKind::NaturalPersonBi => "NATURAL_PERSON_BI",
            TaxIdKind::FinalConsumer => "FINAL_CONSUMER",
            TaxIdKind::Foreign => "FOREIGN",
        };

        sqlx::query(
            r#"
            INSERT INTO kudiba_inventory.entities (
                id, tenant_id, entity_type, tax_id_type, tax_id,
                name, trade_name, email, phone, is_withholding_agent,
                country_code, province, city, address_detail, iban,
                is_active, created_at, updated_at
            ) VALUES (
                $1, $2, $3::kudiba_inventory.entity_kind, $4::kudiba_inventory.tax_id_kind, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18
            )
            ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
                entity_type = EXCLUDED.entity_type,
                name = EXCLUDED.name,
                trade_name = EXCLUDED.trade_name,
                email = EXCLUDED.email,
                phone = EXCLUDED.phone,
                is_withholding_agent = EXCLUDED.is_withholding_agent,
                country_code = EXCLUDED.country_code,
                province = EXCLUDED.province,
                city = EXCLUDED.city,
                address_detail = EXCLUDED.address_detail,
                iban = EXCLUDED.iban,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(e.id)
        .bind(e.tenant_id)
        .bind(entity_type_str)
        .bind(tax_kind_str)
        .bind(e.tax_id.value())
        .bind(&e.name)
        .bind(&e.trade_name)
        .bind(&e.email)
        .bind(&e.phone)
        .bind(e.is_withholding_agent)
        .bind(&e.country_code)
        .bind(&e.province)
        .bind(&e.city)
        .bind(&e.address_detail)
        .bind(&e.iban)
        .bind(e.is_active)
        .bind(e.created_at)
        .bind(e.updated_at)
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
    ) -> Result<Vec<CommercialEntity>, RepositoryError> {
        let rows: Vec<EntityRow> = sqlx::query_as(
            "SELECT id, tenant_id, entity_type::text, tax_id_type::text, tax_id, \
             name, trade_name, email, phone, is_withholding_agent, \
             country_code, province, city, address_detail, iban, \
             is_active, created_at, updated_at \
             FROM kudiba_inventory.entities WHERE tenant_id = $1 \
             ORDER BY name ASC LIMIT $2 OFFSET $3",
        )
        .bind(tenant_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&mut *session.connection())
        .await?;

        rows.into_iter().map(to_entity).collect()
    }
}
