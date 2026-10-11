use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{EntityResponse, RegisterEntityRequest};
use crate::domain::entities::{CommercialEntity, EntityKind};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::EntityRepository;
use crate::domain::value_objects::{TaxId, TaxIdKind};

pub struct RegisterEntityCommand {
    session_factory: Arc<dyn DbSessionFactory>,
    entity_repo: Arc<dyn EntityRepository>,
}

impl RegisterEntityCommand {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        entity_repo: Arc<dyn EntityRepository>,
    ) -> Self {
        Self {
            session_factory,
            entity_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: RegisterEntityRequest,
    ) -> Result<EntityResponse, InventoryError> {
        let tax_kind = match req.tax_id_kind.trim().to_uppercase().as_str() {
            "LEGAL_ENTITY" => TaxIdKind::LegalEntity,
            "NATURAL_PERSON_BI" => TaxIdKind::NaturalPersonBi,
            "FINAL_CONSUMER" => TaxIdKind::FinalConsumer,
            "FOREIGN" => TaxIdKind::Foreign,
            other => {
                return Err(InventoryError::ValidationError(format!(
                    "Tipo de identificador fiscal inválido: '{}'. Use LEGAL_ENTITY, NATURAL_PERSON_BI, FINAL_CONSUMER ou FOREIGN.",
                    other
                )));
            }
        };

        let tax_id = TaxId::new(&req.tax_id, tax_kind)?;

        let entity_kind = match req
            .entity_type
            .as_deref()
            .unwrap_or("CUSTOMER")
            .trim()
            .to_uppercase()
            .as_str()
        {
            "CUSTOMER" => EntityKind::Customer,
            "SUPPLIER" => EntityKind::Supplier,
            "BOTH" => EntityKind::Both,
            other => {
                return Err(InventoryError::ValidationError(format!(
                    "Tipo de entidade inválido: '{}'. Use CUSTOMER, SUPPLIER ou BOTH.",
                    other
                )));
            }
        };

        let mut session = self.session_factory.open().await?;

        if let Some(existing) = self
            .entity_repo
            .find_by_tax_id(session.as_mut(), tenant_id, tax_id.value())
            .await?
        {
            return Err(InventoryError::DuplicateTaxId(
                existing.tax_id.value().to_string(),
            ));
        }

        let entity = CommercialEntity::new(
            tenant_id,
            entity_kind,
            tax_id,
            req.name,
            req.trade_name,
            req.email,
            req.phone,
            req.is_withholding_agent.unwrap_or(false),
            req.country_code,
            req.province,
            req.city,
            req.address_detail,
            req.iban,
        )?;

        self.entity_repo.save(session.as_mut(), &entity).await?;
        Ok(EntityResponse::from(entity))
    }
}
