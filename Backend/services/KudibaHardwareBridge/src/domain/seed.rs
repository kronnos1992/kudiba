use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogItem {
    pub barcode: String,
    pub code: String,
    pub description: String,
    pub price: Decimal,
    pub tax_rate: Decimal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedPayload {
    pub version: i32,
    pub expires_at: DateTime<Utc>,
    pub catalog: Vec<CatalogItem>,
    pub series: Vec<serde_json::Value>,
}
