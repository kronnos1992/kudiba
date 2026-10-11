use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StockMovementType {
    InPurchase,    // Entrada por compra de fornecedor (recalcula CMP)
    InTransfer,    // Transferência recebida de outro armazém
    InAdjustment,  // Acerto positivo de inventário
    OutSale,       // Saída por venda / faturação
    OutTransfer,   // Transferência enviada para outro armazém
    OutWaste,      // Quebra, avaria, perda
    OutAdjustment, // Acerto negativo de inventário
}

impl StockMovementType {
    pub fn is_incoming(&self) -> bool {
        matches!(
            self,
            StockMovementType::InPurchase
                | StockMovementType::InTransfer
                | StockMovementType::InAdjustment
        )
    }

    pub fn is_outgoing(&self) -> bool {
        !self.is_incoming()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    pub batch_id: Option<Uuid>,
    pub movement_type: StockMovementType,
    pub quantity: Decimal,
    pub unit_cost: Decimal,
    pub total_cost: Decimal,
    pub resulting_cmp: Decimal,
    pub document_ref: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

impl StockMovement {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
        batch_id: Option<Uuid>,
        movement_type: StockMovementType,
        quantity: Decimal,
        unit_cost: Decimal,
        resulting_cmp: Decimal,
        document_ref: Option<String>,
        notes: Option<String>,
        created_by: Uuid,
    ) -> Result<Self, InventoryError> {
        if quantity <= Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "Quantidade do movimento deve ser maior que zero".to_string(),
            ));
        }

        if unit_cost < Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Custo unitário não pode ser negativo".to_string(),
            ));
        }

        let total_cost = quantity * unit_cost;

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            warehouse_id,
            product_id,
            batch_id,
            movement_type,
            quantity,
            unit_cost,
            total_cost,
            resulting_cmp,
            document_ref: document_ref.map(|d| d.trim().to_string()),
            notes: notes.map(|n| n.trim().to_string()),
            created_by,
            created_at: Utc::now(),
        })
    }
}
