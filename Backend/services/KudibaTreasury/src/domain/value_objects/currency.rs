use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(
    type_name = "kudiba_treasury.currency_code",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum Currency {
    #[default]
    AOA,
    USD,
    EUR,
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AOA => write!(f, "AOA"),
            Self::USD => write!(f, "USD"),
            Self::EUR => write!(f, "EUR"),
        }
    }
}

impl FromStr for Currency {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "AOA" | "KZ" => Ok(Self::AOA),
            "USD" => Ok(Self::USD),
            "EUR" => Ok(Self::EUR),
            other => Err(DomainError::ValidationError(format!(
                "Moeda desconhecida ou não suportada: {}",
                other
            ))),
        }
    }
}
