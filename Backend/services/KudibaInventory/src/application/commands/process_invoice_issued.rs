use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{InvoiceIssuedPayload, ProcessInvoiceIssuedResult};
use crate::domain::entities::{StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
};
use crate::domain::services::StockPolicy;

pub struct ProcessInvoiceIssuedCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl ProcessInvoiceIssuedCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        product_repo: Arc<dyn ProductRepository>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
        stock_repo: Arc<dyn StockRepository>,
        batch_repo: Arc<dyn BatchRepository>,
    ) -> Self {
        Self {
            uow_factory,
            product_repo,
            warehouse_repo,
            stock_repo,
            batch_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        payload: InvoiceIssuedPayload,
    ) -> Result<ProcessInvoiceIssuedResult, InventoryError> {
        let doc_type = payload.document_type.trim().to_uppercase();
        if !matches!(doc_type.as_str(), "FT" | "FR" | "VD") {
            return Ok(ProcessInvoiceIssuedResult {
                invoice_id: payload.invoice_id,
                document_number: payload.document_number,
                document_type: payload.document_type,
                processed: false,
                movements_recorded: 0,
                items_skipped_intangible: 0,
            });
        }

        let mut uow = self.uow_factory.begin().await?;

        match self
            .process(uow.as_mut(), tenant_id, user_id, &payload)
            .await
        {
            Ok(result) => {
                uow.commit().await?;
                Ok(result)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de consumo de fatura emitida: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn process(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        user_id: Uuid,
        payload: &InvoiceIssuedPayload,
    ) -> Result<ProcessInvoiceIssuedResult, InventoryError> {
        let mut movements_recorded = 0;
        let mut items_skipped_intangible = 0;

        let has_stockable_lines = payload
            .lines
            .iter()
            .any(|l| l.quantity > rust_decimal::Decimal::ZERO);

        let default_warehouse = if has_stockable_lines {
            let warehouses = self.warehouse_repo.list_all(session, tenant_id).await?;
            warehouses
                .iter()
                .find(|w| w.is_default && w.is_active)
                .cloned()
                .or_else(|| warehouses.into_iter().find(|w| w.is_active))
        } else {
            None
        };

        for line in &payload.lines {
            let product = self
                .product_repo
                .find_by_code(session, tenant_id, &line.product_code)
                .await?
                .ok_or_else(|| InventoryError::ProductCodeNotFound(line.product_code.clone()))?;

            if !product.is_stockable {
                items_skipped_intangible += 1;
                continue;
            }

            StockPolicy::ensure_can_move_stock(&product)?;

            let warehouse = default_warehouse
                .as_ref()
                .ok_or(InventoryError::WarehouseNotFound(Uuid::nil()))?;

            let batch_id = if product.track_lots {
                if let Some(bid) = line.batch_id {
                    let batch = self
                        .batch_repo
                        .find_by_id(session, tenant_id, bid)
                        .await?
                        .ok_or(InventoryError::BatchNotFound(bid))?;
                    if batch.product_id != product.id {
                        return Err(InventoryError::ValidationError(
                            "O lote indicado não pertence a este artigo".to_string(),
                        ));
                    }
                    if batch.is_expired(chrono::Utc::now().date_naive()) {
                        return Err(InventoryError::BatchExpired(batch.batch_number));
                    }
                    Some(batch.id)
                } else if let Some(ref bnum) = line.batch_number {
                    let batch = self
                        .batch_repo
                        .find_by_number(session, tenant_id, product.id, bnum)
                        .await?
                        .ok_or_else(|| {
                            InventoryError::ValidationError(format!(
                                "Lote '{}' não encontrado",
                                bnum
                            ))
                        })?;
                    if batch.is_expired(chrono::Utc::now().date_naive()) {
                        return Err(InventoryError::BatchExpired(batch.batch_number));
                    }
                    Some(batch.id)
                } else {
                    let batches = self
                        .batch_repo
                        .list_by_product(session, tenant_id, product.id)
                        .await?;
                    let today = chrono::Utc::now().date_naive();
                    let valid_batch = batches
                        .into_iter()
                        .filter(|b| !b.is_expired(today))
                        .min_by_key(|b| b.expiry_date);
                    let batch = valid_batch
                        .ok_or_else(|| InventoryError::BatchRequired(product.name.clone()))?;
                    Some(batch.id)
                }
            } else {
                None
            };

            let mut balance = self
                .stock_repo
                .find_balance_for_update(session, tenant_id, warehouse.id, product.id)
                .await?
                .ok_or(InventoryError::InsufficientStock {
                    product_id: product.id,
                    available: rust_decimal::Decimal::ZERO,
                    requested: line.quantity,
                })?;

            balance.apply_deduction(line.quantity, false)?;
            self.stock_repo.save_balance(session, &balance).await?;

            let movement = StockMovement::new(
                tenant_id,
                warehouse.id,
                product.id,
                batch_id,
                StockMovementType::OutSale,
                line.quantity,
                product.current_cmp,
                product.current_cmp,
                Some(payload.document_number.clone()),
                Some(format!("Faturação automática: {}", payload.document_number)),
                user_id,
            )?;

            self.stock_repo.record_movement(session, &movement).await?;
            movements_recorded += 1;
        }

        Ok(ProcessInvoiceIssuedResult {
            invoice_id: payload.invoice_id,
            document_number: payload.document_number.clone(),
            document_type: payload.document_type.clone(),
            processed: true,
            movements_recorded,
            items_skipped_intangible,
        })
    }
}
