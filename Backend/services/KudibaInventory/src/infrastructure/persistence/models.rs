use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::entities::{
    CommercialEntity, EntityKind, Product, ProductBatch, StockBalance, StockMovement,
    StockMovementType, Warehouse,
};
use crate::domain::error::InventoryError;
use crate::domain::value_objects::{ProductType, TaxId, TaxIdKind};

#[derive(Debug, FromRow)]
pub struct ProductRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub product_type: String,
    pub is_stockable: bool,
    pub track_lots: bool,
    pub unit_of_measure: String,
    pub sale_price: Decimal,
    pub cost_price: Decimal,
    pub current_cmp: Decimal,
    pub tax_type: String,
    pub tax_code: String,
    pub tax_percentage: Decimal,
    pub exemption_reason_code: Option<String>,
    pub exemption_reason_text: Option<String>,
    pub has_withholding_tax: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TryFrom<ProductRow> for Product {
    type Error = InventoryError;

    fn try_from(row: ProductRow) -> Result<Self, Self::Error> {
        let p_type = ProductType::from_saft_code(&row.product_type).unwrap_or(ProductType::Goods);

        Ok(Product {
            id: row.id,
            tenant_id: row.tenant_id,
            code: row.code,
            barcode: row.barcode,
            name: row.name,
            description: row.description,
            product_type: p_type,
            is_stockable: row.is_stockable,
            track_lots: row.track_lots,
            unit_of_measure: row.unit_of_measure,
            sale_price: row.sale_price,
            cost_price: row.cost_price,
            current_cmp: row.current_cmp,
            tax_type: row.tax_type,
            tax_code: row.tax_code,
            tax_percentage: row.tax_percentage,
            exemption_reason_code: row.exemption_reason_code,
            exemption_reason_text: row.exemption_reason_text,
            has_withholding_tax: row.has_withholding_tax,
            is_active: row.is_active,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
pub struct EntityRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: String,
    pub tax_id_type: String,
    pub tax_id: String,
    pub name: String,
    pub trade_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_withholding_agent: bool,
    pub country_code: String,
    pub province: Option<String>,
    pub city: Option<String>,
    pub address_detail: Option<String>,
    pub iban: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TryFrom<EntityRow> for CommercialEntity {
    type Error = InventoryError;

    fn try_from(row: EntityRow) -> Result<Self, Self::Error> {
        let kind = match row.tax_id_type.as_str() {
            "LEGAL_ENTITY" => TaxIdKind::LegalEntity,
            "NATURAL_PERSON_BI" => TaxIdKind::NaturalPersonBi,
            "FINAL_CONSUMER" => TaxIdKind::FinalConsumer,
            _ => TaxIdKind::Foreign,
        };
        let tax_id = TaxId::new(&row.tax_id, kind)?;

        let entity_type = match row.entity_type.as_str() {
            "SUPPLIER" => EntityKind::Supplier,
            "BOTH" => EntityKind::Both,
            _ => EntityKind::Customer,
        };

        Ok(CommercialEntity {
            id: row.id,
            tenant_id: row.tenant_id,
            entity_type,
            tax_id,
            name: row.name,
            trade_name: row.trade_name,
            email: row.email,
            phone: row.phone,
            is_withholding_agent: row.is_withholding_agent,
            country_code: row.country_code,
            province: row.province,
            city: row.city,
            address_detail: row.address_detail,
            iban: row.iban,
            is_active: row.is_active,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, FromRow)]
pub struct WarehouseRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub branch_id: Uuid,
    pub code: String,
    pub name: String,
    pub is_default: bool,
    pub address_detail: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<WarehouseRow> for Warehouse {
    fn from(row: WarehouseRow) -> Self {
        Warehouse {
            id: row.id,
            tenant_id: row.tenant_id,
            branch_id: row.branch_id,
            code: row.code,
            name: row.name,
            is_default: row.is_default,
            address_detail: row.address_detail,
            is_active: row.is_active,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct StockBalanceRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    pub quantity_on_hand: Decimal,
    pub quantity_reserved: Decimal,
    pub reorder_point: Decimal,
    pub updated_at: DateTime<Utc>,
}

impl From<StockBalanceRow> for StockBalance {
    fn from(row: StockBalanceRow) -> Self {
        StockBalance {
            id: row.id,
            tenant_id: row.tenant_id,
            warehouse_id: row.warehouse_id,
            product_id: row.product_id,
            quantity_on_hand: row.quantity_on_hand,
            quantity_reserved: row.quantity_reserved,
            reorder_point: row.reorder_point,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct StockMovementRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    pub batch_id: Option<Uuid>,
    pub movement_type: String,
    pub quantity: Decimal,
    pub unit_cost: Decimal,
    pub total_cost: Decimal,
    pub resulting_cmp: Decimal,
    pub document_ref: Option<String>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

impl From<StockMovementRow> for StockMovement {
    fn from(row: StockMovementRow) -> Self {
        let m_type = match row.movement_type.as_str() {
            "IN_PURCHASE" => StockMovementType::InPurchase,
            "IN_TRANSFER" => StockMovementType::InTransfer,
            "IN_ADJUSTMENT" => StockMovementType::InAdjustment,
            "OUT_SALE" => StockMovementType::OutSale,
            "OUT_TRANSFER" => StockMovementType::OutTransfer,
            "OUT_WASTE" => StockMovementType::OutWaste,
            _ => StockMovementType::OutAdjustment,
        };

        StockMovement {
            id: row.id,
            tenant_id: row.tenant_id,
            warehouse_id: row.warehouse_id,
            product_id: row.product_id,
            batch_id: row.batch_id,
            movement_type: m_type,
            quantity: row.quantity,
            unit_cost: row.unit_cost,
            total_cost: row.total_cost,
            resulting_cmp: row.resulting_cmp,
            document_ref: row.document_ref,
            notes: row.notes,
            created_by: row.created_by,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct BatchRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub product_id: Uuid,
    pub batch_number: String,
    pub manufacture_date: Option<chrono::NaiveDate>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub created_at: DateTime<Utc>,
}

impl From<BatchRow> for ProductBatch {
    fn from(row: BatchRow) -> Self {
        Self {
            id: row.id,
            tenant_id: row.tenant_id,
            product_id: row.product_id,
            batch_number: row.batch_number,
            manufacture_date: row.manufacture_date,
            expiry_date: row.expiry_date,
            created_at: row.created_at,
        }
    }
}
