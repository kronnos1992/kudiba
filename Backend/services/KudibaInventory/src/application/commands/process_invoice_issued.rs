use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{InvoiceIssuedPayload, ProcessInvoiceIssuedResult};
use crate::domain::entities::{StockBalance, StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, InventoryEventPublisher, ProductRepository, StockRepository,
    WarehouseRepository,
};
use crate::domain::services::StockPolicy;

pub struct ProcessInvoiceIssuedCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
    event_publisher: Arc<dyn InventoryEventPublisher>,
}

impl ProcessInvoiceIssuedCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        product_repo: Arc<dyn ProductRepository>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
        stock_repo: Arc<dyn StockRepository>,
        batch_repo: Arc<dyn BatchRepository>,
        event_publisher: Arc<dyn InventoryEventPublisher>,
    ) -> Self {
        Self {
            uow_factory,
            product_repo,
            warehouse_repo,
            stock_repo,
            batch_repo,
            event_publisher,
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
            Ok((result, total_cmp_cost)) => {
                uow.commit().await?;

                if result.movements_recorded > 0 && total_cmp_cost > rust_decimal::Decimal::ZERO {
                    let today = chrono::Utc::now().date_naive();
                    if let Err(e) = self
                        .event_publisher
                        .publish_stock_dispatch(
                            tenant_id,
                            &payload.document_number,
                            today,
                            total_cmp_cost,
                        )
                        .await
                    {
                        tracing::warn!(
                            error = %e,
                            doc = %payload.document_number,
                            "Falha ao publicar evento de saída de stock ao CMP para contabilidade"
                        );
                    }
                }

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
    ) -> Result<(ProcessInvoiceIssuedResult, rust_decimal::Decimal), InventoryError> {
        // Idempotência: verificar se este documento já teve saída de stock processada
        if self
            .stock_repo
            .has_movement_for_document(
                session,
                tenant_id,
                &payload.document_number,
                StockMovementType::OutSale,
            )
            .await?
        {
            tracing::info!(
                document = %payload.document_number,
                "Movimento de stock para a fatura já processado anteriormente. Retornando resultado idempotente."
            );
            return Ok((
                ProcessInvoiceIssuedResult {
                    invoice_id: payload.invoice_id,
                    document_number: payload.document_number.clone(),
                    document_type: payload.document_type.clone(),
                    processed: true,
                    movements_recorded: 0,
                    items_skipped_intangible: 0,
                },
                rust_decimal::Decimal::ZERO,
            ));
        }

        let mut movements_recorded = 0;
        let mut items_skipped_intangible = 0;
        let mut total_cmp_cost = rust_decimal::Decimal::ZERO;

        let has_stockable_lines = payload
            .lines
            .iter()
            .any(|l| l.quantity > rust_decimal::Decimal::ZERO);

        let active_warehouses = if has_stockable_lines {
            self.warehouse_repo
                .list_all(session, tenant_id)
                .await?
                .into_iter()
                .filter(|w| w.is_active)
                .collect::<Vec<_>>()
        } else {
            Vec::new()
        };

        if has_stockable_lines && active_warehouses.is_empty() {
            return Err(InventoryError::WarehouseNotFound(Uuid::nil()));
        }

        let default_warehouse = active_warehouses
            .iter()
            .find(|w| w.is_default)
            .cloned()
            .or_else(|| active_warehouses.first().cloned());

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

            // Resolução inteligente de armazém:
            // 1. Se indicado na linha ou payload, respeitar
            // 2. Se armazém padrão tiver stock suficiente, usar o padrão
            // 3. Caso contrário, selecionar armazém activo que contenha stock suficiente
            // 4. Se nenhum tiver o total, usar o que tiver maior saldo disponível ou o padrão
            let warehouse = if let Some(wid) = line.warehouse_id {
                active_warehouses
                    .iter()
                    .find(|w| w.id == wid)
                    .cloned()
                    .ok_or(InventoryError::WarehouseNotFound(wid))?
            } else if let Some(wid) = payload.warehouse_id {
                active_warehouses
                    .iter()
                    .find(|w| w.id == wid)
                    .cloned()
                    .ok_or(InventoryError::WarehouseNotFound(wid))?
            } else {
                let balances = self
                    .stock_repo
                    .list_balances_by_product(session, tenant_id, product.id)
                    .await?;

                let default_has_stock = default_warehouse.as_ref().is_some_and(|dw| {
                    balances
                        .iter()
                        .any(|b| b.warehouse_id == dw.id && b.available_quantity() >= line.quantity)
                });

                if default_has_stock {
                    default_warehouse.clone().unwrap()
                } else {
                    let wh_with_stock = balances
                        .iter()
                        .filter(|b| b.available_quantity() >= line.quantity)
                        .filter_map(|b| {
                            active_warehouses
                                .iter()
                                .find(|w| w.id == b.warehouse_id)
                                .map(|w| (w, b.available_quantity()))
                        })
                        .max_by_key(|(_, avail)| *avail)
                        .map(|(w, _)| w.clone());

                    if let Some(wh) = wh_with_stock {
                        wh
                    } else {
                        let wh_with_any_stock = balances
                            .iter()
                            .filter(|b| b.available_quantity() > rust_decimal::Decimal::ZERO)
                            .filter_map(|b| {
                                active_warehouses
                                    .iter()
                                    .find(|w| w.id == b.warehouse_id)
                                    .map(|w| (w, b.available_quantity()))
                            })
                            .max_by_key(|(_, avail)| *avail)
                            .map(|(w, _)| w.clone());

                        wh_with_any_stock
                            .or_else(|| default_warehouse.clone())
                            .ok_or(InventoryError::WarehouseNotFound(Uuid::nil()))?
                    }
                }
            };

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

            let mut balance = match self
                .stock_repo
                .find_balance_for_update(session, tenant_id, warehouse.id, product.id)
                .await?
            {
                Some(b) => b,
                None => StockBalance::new(tenant_id, warehouse.id, product.id, None),
            };

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
            total_cmp_cost += line.quantity * product.current_cmp;
        }

        Ok((
            ProcessInvoiceIssuedResult {
                invoice_id: payload.invoice_id,
                document_number: payload.document_number.clone(),
                document_type: payload.document_type.clone(),
                processed: true,
                movements_recorded,
                items_skipped_intangible,
            },
            total_cmp_cost,
        ))
    }
}
