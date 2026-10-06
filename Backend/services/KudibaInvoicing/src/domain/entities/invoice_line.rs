use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use crate::domain::services::chained_hash::MoneyCalculator;

/// Linha de artigo imutável de um documento fiscal
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceLine {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub line_number: i32,
    pub product_code: String,
    pub description: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub unit_price: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_rate: Decimal,
    pub tax_exemption_code: Option<String>,
    #[serde(with = "rust_decimal::serde::float")]
    pub line_total: Decimal,
}

impl InvoiceLine {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: Uuid,
        invoice_id: Uuid,
        line_number: i32,
        product_code: String,
        description: String,
        quantity: Decimal,
        unit_price: Decimal,
        tax_rate: Decimal,
        tax_exemption_code: Option<String>,
        line_total: Decimal,
    ) -> Self {
        Self {
            id,
            invoice_id,
            line_number,
            product_code,
            description,
            quantity,
            unit_price,
            tax_rate,
            tax_exemption_code,
            line_total,
        }
    }

    /// Construtor de reidratação (mapeamento a partir de uma linha persistida)
    #[allow(clippy::too_many_arguments)]
    pub fn restore(
        id: Uuid,
        invoice_id: Uuid,
        line_number: i32,
        product_code: String,
        description: String,
        quantity: Decimal,
        unit_price: Decimal,
        tax_rate: Decimal,
        tax_exemption_code: Option<String>,
        line_total: Decimal,
    ) -> Self {
        Self {
            id,
            invoice_id,
            line_number,
            product_code,
            description,
            quantity,
            unit_price,
            tax_rate,
            tax_exemption_code,
            line_total,
        }
    }

    /// Base tributável da linha: `quantidade × preço unitário` (2 casas, away from zero)
    pub fn line_base(&self) -> Decimal {
        MoneyCalculator::line_base(self.quantity, self.unit_price)
    }

    /// Imposto da linha: `base × (taxa / 100)` (2 casas, away from zero)
    pub fn line_tax(&self) -> Decimal {
        MoneyCalculator::line_tax(self.line_base(), self.tax_rate)
    }
}
