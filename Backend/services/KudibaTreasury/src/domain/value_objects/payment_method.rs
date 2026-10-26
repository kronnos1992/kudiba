use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(
    type_name = "kudiba_treasury.payment_method",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum PaymentMethod {
    #[default]
    #[serde(rename = "NUMERARIO")]
    Numerario,
    #[serde(rename = "MULTICAIXA")]
    Multicaixa,
    #[serde(rename = "TRANSFERENCIA")]
    Transferencia,
    #[serde(rename = "GPO_REFERENCE")]
    GpoReference,
    #[serde(rename = "MULTICAIXA_EXPRESS")]
    MulticaixaExpress,
    #[serde(rename = "CHEQUE")]
    Cheque,
}

impl fmt::Display for PaymentMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Numerario => write!(f, "NUMERARIO"),
            Self::Multicaixa => write!(f, "MULTICAIXA"),
            Self::Transferencia => write!(f, "TRANSFERENCIA"),
            Self::GpoReference => write!(f, "GPO_REFERENCE"),
            Self::MulticaixaExpress => write!(f, "MULTICAIXA_EXPRESS"),
            Self::Cheque => write!(f, "CHEQUE"),
        }
    }
}

impl FromStr for PaymentMethod {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "NUMERARIO" | "CASH" | "DINHEIRO" | "NU" => Ok(Self::Numerario),
            "MULTICAIXA" | "TPA" | "CARD" | "CC" | "CD" => Ok(Self::Multicaixa),
            "TRANSFERENCIA" | "TB" | "BANK_TRANSFER" => Ok(Self::Transferencia),
            "GPO_REFERENCE" | "REF" | "PAGAMENTO_REFERENCIA" | "PR" => Ok(Self::GpoReference),
            "MULTICAIXA_EXPRESS" | "MCX_EXPRESS" | "MCX" => Ok(Self::MulticaixaExpress),
            "CHEQUE" | "CHQ" => Ok(Self::Cheque),
            other => Err(DomainError::ValidationError(format!(
                "Forma de pagamento não suportada: {}",
                other
            ))),
        }
    }
}
