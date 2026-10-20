use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;
use crate::domain::value_objects::ProductType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub ref_id: Option<String>,
    pub barcode: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub product_type: ProductType,
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

impl Product {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: Uuid,
        code: String,
        barcode: Option<String>,
        name: String,
        description: Option<String>,
        product_type: ProductType,
        is_stockable: Option<bool>,
        track_lots: bool,
        unit_of_measure: String,
        sale_price: Decimal,
        cost_price: Decimal,
        tax_percentage: Decimal,
        exemption_reason_code: Option<String>,
        exemption_reason_text: Option<String>,
        has_withholding_tax: Option<bool>,
    ) -> Result<Self, InventoryError> {
        if code.trim().is_empty() {
            return Err(InventoryError::ValidationError(
                "Código do artigo não pode ser vazio".to_string(),
            ));
        }

        if name.trim().is_empty() {
            return Err(InventoryError::ValidationError(
                "Nome do artigo não pode ser vazio".to_string(),
            ));
        }

        if sale_price < Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Preço de venda não pode ser negativo".to_string(),
            ));
        }

        if cost_price < Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Preço de custo não pode ser negativo".to_string(),
            ));
        }

        // Regra para intangíveis: se for Serviço ou Outro e is_stockable não for especificado,
        // força is_stockable = false
        let stockable = match is_stockable {
            Some(val) => {
                if product_type == ProductType::Service && val {
                    return Err(InventoryError::IntangibleCannotMoveStock(name));
                }
                val
            }
            None => product_type.is_stockable_by_default(),
        };

        // Regra de retenção: prestação de serviços por padrão tem retenção de 6.5% no Decreto 71/25 Art. 12
        let withholding =
            has_withholding_tax.unwrap_or_else(|| product_type.requires_withholding_by_default());

        let tax_code = if tax_percentage == Decimal::ZERO {
            "ISE".to_string()
        } else {
            "NOR".to_string()
        };

        let clean_code = code.trim().to_uppercase();
        let default_ref = format!("REF-{}", clean_code);
        let now = Utc::now();

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            code: clean_code,
            ref_id: Some(default_ref),
            barcode: barcode.map(|b| b.trim().to_string()),
            name: name.trim().to_string(),
            description: description.map(|d| d.trim().to_string()),
            product_type,
            is_stockable: stockable,
            track_lots: if stockable { track_lots } else { false },
            unit_of_measure: unit_of_measure.trim().to_uppercase(),
            sale_price,
            cost_price,
            current_cmp: cost_price,
            tax_type: "IVA".to_string(),
            tax_code,
            tax_percentage,
            exemption_reason_code,
            exemption_reason_text,
            has_withholding_tax: withholding,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn with_ref_id(mut self, ref_id: Option<String>) -> Self {
        if let Some(r) = ref_id {
            let trimmed = r.trim();
            if !trimmed.is_empty() {
                self.ref_id = Some(trimmed.to_string());
            }
        }
        self
    }

    pub fn set_ref_id(&mut self, ref_id: Option<String>) {
        if let Some(r) = ref_id {
            let trimmed = r.trim();
            if !trimmed.is_empty() {
                self.ref_id = Some(trimmed.to_string());
                self.updated_at = Utc::now();
            }
        }
    }

    pub fn update_prices(
        &mut self,
        new_sale_price: Decimal,
        new_cost_price: Option<Decimal>,
    ) -> Result<(), InventoryError> {
        if new_sale_price < Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Preço de venda não pode ser negativo".to_string(),
            ));
        }
        self.sale_price = new_sale_price;
        if let Some(cost) = new_cost_price {
            if cost < Decimal::ZERO {
                return Err(InventoryError::InvalidPrice(
                    "Preço de custo não pode ser negativo".to_string(),
                ));
            }
            self.cost_price = cost;
        }
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn set_cmp(&mut self, new_cmp: Decimal) {
        if self.is_stockable {
            self.current_cmp = new_cmp;
            self.updated_at = Utc::now();
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_details(
        &mut self,
        name: Option<String>,
        description: Option<String>,
        barcode: Option<String>,
        unit_of_measure: Option<String>,
        sale_price: Option<Decimal>,
        cost_price: Option<Decimal>,
        tax_percentage: Option<Decimal>,
        exemption_reason_code: Option<String>,
        exemption_reason_text: Option<String>,
        has_withholding_tax: Option<bool>,
        is_active: Option<bool>,
    ) -> Result<(), InventoryError> {
        if let Some(n) = name {
            let trimmed = n.trim();
            if trimmed.is_empty() {
                return Err(InventoryError::ValidationError(
                    "Nome do artigo não pode ser vazio".to_string(),
                ));
            }
            self.name = trimmed.to_string();
        }
        if let Some(d) = description {
            self.description = Some(d.trim().to_string());
        }
        if let Some(b) = barcode {
            self.barcode = Some(b.trim().to_string());
        }
        if let Some(u) = unit_of_measure {
            self.unit_of_measure = u.trim().to_uppercase();
        }
        if let Some(sp) = sale_price {
            if sp < Decimal::ZERO {
                return Err(InventoryError::InvalidPrice(
                    "Preço de venda não pode ser negativo".to_string(),
                ));
            }
            self.sale_price = sp;
        }
        if let Some(cp) = cost_price {
            if cp < Decimal::ZERO {
                return Err(InventoryError::InvalidPrice(
                    "Preço de custo não pode ser negativo".to_string(),
                ));
            }
            self.cost_price = cp;
        }
        if let Some(tp) = tax_percentage {
            self.tax_percentage = tp;
            if tp == Decimal::ZERO {
                self.tax_code = "ISE".to_string();
            } else {
                self.tax_code = "NOR".to_string();
            }
        }
        if let Some(erc) = exemption_reason_code {
            self.exemption_reason_code = Some(erc);
        }
        if let Some(ert) = exemption_reason_text {
            self.exemption_reason_text = Some(ert);
        }
        if let Some(hwt) = has_withholding_tax {
            self.has_withholding_tax = hwt;
        }
        if let Some(act) = is_active {
            self.is_active = act;
        }
        self.updated_at = Utc::now();
        Ok(())
    }
}
