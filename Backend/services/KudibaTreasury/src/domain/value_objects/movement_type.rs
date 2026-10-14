use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(
    type_name = "kudiba_treasury.movement_type",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum MovementType {
    #[default]
    #[serde(rename = "SUPPLY")]
    Supply,
    #[serde(rename = "BLEED")]
    Bleed,
    #[serde(rename = "SALE_RECEIPT")]
    SaleReceipt,
    #[serde(rename = "EXPENSE")]
    Expense,
}

impl MovementType {
    pub fn is_cash_in(&self) -> bool {
        matches!(self, Self::Supply | Self::SaleReceipt)
    }

    pub fn is_cash_out(&self) -> bool {
        matches!(self, Self::Bleed | Self::Expense)
    }
}

impl fmt::Display for MovementType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Supply => write!(f, "SUPPLY"),
            Self::Bleed => write!(f, "BLEED"),
            Self::SaleReceipt => write!(f, "SALE_RECEIPT"),
            Self::Expense => write!(f, "EXPENSE"),
        }
    }
}

impl FromStr for MovementType {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "SUPPLY" | "SUPRIMENTO" | "REFORCO" => Ok(Self::Supply),
            "BLEED" | "SANGRIA" | "RECOLHA" => Ok(Self::Bleed),
            "SALE_RECEIPT" | "RECEIPT" | "VENDA" => Ok(Self::SaleReceipt),
            "EXPENSE" | "DESPESA" | "SAIDA" => Ok(Self::Expense),
            other => Err(DomainError::ValidationError(format!(
                "Tipo de movimento de caixa desconhecido: {}",
                other
            ))),
        }
    }
}
