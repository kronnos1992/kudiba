use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::{
    CommercialEntity, EntityKind, Product, ProductBatch, StockBalance, StockMovement, Warehouse,
};
use crate::domain::value_objects::TaxIdKind;

// ----------------------------------------------------------------------------
// DTOs de Artigos e Serviços
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProductRequest {
    pub code: String,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub product_type: Option<String>, // "P", "S", "O"
    pub is_stockable: Option<bool>,
    pub track_lots: Option<bool>,
    pub unit_of_measure: Option<String>,
    pub sale_price: Decimal,
    pub cost_price: Option<Decimal>,
    pub tax_percentage: Option<Decimal>,
    pub exemption_reason_code: Option<String>,
    pub exemption_reason_text: Option<String>,
    pub has_withholding_tax: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProductPriceRequest {
    pub sale_price: Decimal,
    pub cost_price: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductResponse {
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

impl From<Product> for ProductResponse {
    fn from(p: Product) -> Self {
        Self {
            id: p.id,
            tenant_id: p.tenant_id,
            code: p.code,
            barcode: p.barcode,
            name: p.name,
            description: p.description,
            product_type: p.product_type.as_saft_code().to_string(),
            is_stockable: p.is_stockable,
            track_lots: p.track_lots,
            unit_of_measure: p.unit_of_measure,
            sale_price: p.sale_price,
            cost_price: p.cost_price,
            current_cmp: p.current_cmp,
            tax_type: p.tax_type,
            tax_code: p.tax_code,
            tax_percentage: p.tax_percentage,
            exemption_reason_code: p.exemption_reason_code,
            exemption_reason_text: p.exemption_reason_text,
            has_withholding_tax: p.has_withholding_tax,
            is_active: p.is_active,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }
    }
}

// ----------------------------------------------------------------------------
// DTOs de Clientes e Fornecedores
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterEntityRequest {
    pub entity_type: Option<String>, // "CUSTOMER", "SUPPLIER", "BOTH"
    pub tax_id: String,
    pub tax_id_kind: String, // "LEGAL_ENTITY", "NATURAL_PERSON_BI", "FINAL_CONSUMER", "FOREIGN"
    pub name: String,
    pub trade_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_withholding_agent: Option<bool>,
    pub country_code: Option<String>,
    pub province: Option<String>,
    pub city: Option<String>,
    pub address_detail: Option<String>,
    pub iban: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntityResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: String,
    pub tax_id: String,
    pub tax_id_type: String,
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

impl From<CommercialEntity> for EntityResponse {
    fn from(e: CommercialEntity) -> Self {
        let type_str = match e.entity_type {
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

        Self {
            id: e.id,
            tenant_id: e.tenant_id,
            entity_type: type_str.to_string(),
            tax_id: e.tax_id.value().to_string(),
            tax_id_type: tax_kind_str.to_string(),
            name: e.name,
            trade_name: e.trade_name,
            email: e.email,
            phone: e.phone,
            is_withholding_agent: e.is_withholding_agent,
            country_code: e.country_code,
            province: e.province,
            city: e.city,
            address_detail: e.address_detail,
            iban: e.iban,
            is_active: e.is_active,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}

// ----------------------------------------------------------------------------
// DTOs de Armazéns
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateWarehouseRequest {
    pub branch_id: Uuid,
    pub code: String,
    pub name: String,
    pub is_default: Option<bool>,
    pub address_detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WarehouseResponse {
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

impl From<Warehouse> for WarehouseResponse {
    fn from(w: Warehouse) -> Self {
        Self {
            id: w.id,
            tenant_id: w.tenant_id,
            branch_id: w.branch_id,
            code: w.code,
            name: w.name,
            is_default: w.is_default,
            address_detail: w.address_detail,
            is_active: w.is_active,
            created_at: w.created_at,
            updated_at: w.updated_at,
        }
    }
}

// ----------------------------------------------------------------------------
// DTOs de Movimentos de Stock e CMP
// ----------------------------------------------------------------------------
// DTOs de Lotes e Validades
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBatchRequest {
    pub product_id: Uuid,
    pub batch_number: String,
    pub manufacture_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub product_id: Uuid,
    pub batch_number: String,
    pub manufacture_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub is_expired: bool,
    pub created_at: DateTime<Utc>,
}

impl From<ProductBatch> for BatchResponse {
    fn from(b: ProductBatch) -> Self {
        let is_expired = b.is_expired(chrono::Utc::now().date_naive());
        Self {
            id: b.id,
            tenant_id: b.tenant_id,
            product_id: b.product_id,
            batch_number: b.batch_number,
            manufacture_date: b.manufacture_date,
            expiry_date: b.expiry_date,
            is_expired,
            created_at: b.created_at,
        }
    }
}

// ----------------------------------------------------------------------------
// DTOs de Movimentos de Stock e CMP
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ReceivePurchaseRequest {
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    #[serde(default)]
    pub batch_id: Option<Uuid>,
    pub quantity: Decimal,
    pub unit_cost: Decimal,
    pub document_ref: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TransferStockRequest {
    pub from_warehouse_id: Uuid,
    pub to_warehouse_id: Uuid,
    pub product_id: Uuid,
    #[serde(default)]
    pub batch_id: Option<Uuid>,
    pub quantity: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DispatchSaleRequest {
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    #[serde(default)]
    pub batch_id: Option<Uuid>,
    pub quantity: Decimal,
    pub document_ref: String,
    pub is_reserved: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AdjustStockRequest {
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    #[serde(default)]
    pub batch_id: Option<Uuid>,
    pub quantity_delta: Decimal,
    pub is_waste: Option<bool>,
    pub document_ref: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockBalanceResponse {
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    pub quantity_on_hand: Decimal,
    pub quantity_reserved: Decimal,
    pub available_quantity: Decimal,
    pub reorder_point: Decimal,
    pub updated_at: DateTime<Utc>,
}

impl From<StockBalance> for StockBalanceResponse {
    fn from(b: StockBalance) -> Self {
        Self {
            warehouse_id: b.warehouse_id,
            product_id: b.product_id,
            quantity_on_hand: b.quantity_on_hand,
            quantity_reserved: b.quantity_reserved,
            available_quantity: b.available_quantity(),
            reorder_point: b.reorder_point,
            updated_at: b.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StockMovementResponse {
    pub id: Uuid,
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
    pub created_at: DateTime<Utc>,
}

impl From<StockMovement> for StockMovementResponse {
    fn from(m: StockMovement) -> Self {
        Self {
            id: m.id,
            warehouse_id: m.warehouse_id,
            product_id: m.product_id,
            batch_id: m.batch_id,
            movement_type: format!("{:?}", m.movement_type),
            quantity: m.quantity,
            unit_cost: m.unit_cost,
            total_cost: m.total_cost,
            resulting_cmp: m.resulting_cmp,
            document_ref: m.document_ref,
            notes: m.notes,
            created_at: m.created_at,
        }
    }
}

pub fn deserialize_decimal_flexible<'de, D>(deserializer: D) -> Result<Decimal, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    match val {
        serde_json::Value::Number(num) => num
            .to_string()
            .parse::<Decimal>()
            .map_err(serde::de::Error::custom),
        serde_json::Value::String(s) => s
            .trim()
            .parse::<Decimal>()
            .map_err(serde::de::Error::custom),
        _ => Err(serde::de::Error::custom(
            "Esperado número ou string decimal",
        )),
    }
}

pub fn deserialize_decimal_flexible_opt<'de, D>(
    deserializer: D,
) -> Result<Option<Decimal>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<serde_json::Value>::deserialize(deserializer)?;
    match opt {
        None | Some(serde_json::Value::Null) => Ok(None),
        Some(serde_json::Value::Number(num)) => num
            .to_string()
            .parse::<Decimal>()
            .map(Some)
            .map_err(serde::de::Error::custom),
        Some(serde_json::Value::String(s)) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                trimmed
                    .parse::<Decimal>()
                    .map(Some)
                    .map_err(serde::de::Error::custom)
            }
        }
        _ => Err(serde::de::Error::custom(
            "Esperado número ou string decimal",
        )),
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceIssuedLine {
    pub line_number: i32,
    pub product_code: String,
    pub description: String,
    #[serde(deserialize_with = "deserialize_decimal_flexible")]
    pub quantity: Decimal,
    #[serde(default, deserialize_with = "deserialize_decimal_flexible_opt")]
    pub unit_price: Option<Decimal>,
    #[serde(default)]
    pub batch_id: Option<Uuid>,
    #[serde(default)]
    pub batch_number: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceIssuedPayload {
    pub invoice_id: Uuid,
    pub tenant_id: Uuid,
    pub document_number: String,
    pub document_type: String,
    #[serde(default)]
    pub lines: Vec<InvoiceIssuedLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInvoiceIssuedResult {
    pub invoice_id: Uuid,
    pub document_number: String,
    pub document_type: String,
    pub processed: bool,
    pub movements_recorded: usize,
    pub items_skipped_intangible: usize,
}
