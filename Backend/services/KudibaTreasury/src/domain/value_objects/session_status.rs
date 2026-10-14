use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(
    type_name = "kudiba_treasury.session_status",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum SessionStatus {
    #[default]
    #[serde(rename = "OPEN")]
    Open,
    #[serde(rename = "CLOSED")]
    Closed,
}

impl fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Open => write!(f, "OPEN"),
            Self::Closed => write!(f, "CLOSED"),
        }
    }
}

impl FromStr for SessionStatus {
    type Err = DomainError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "OPEN" | "ABERTO" => Ok(Self::Open),
            "CLOSED" | "FECHADO" => Ok(Self::Closed),
            other => Err(DomainError::ValidationError(format!(
                "Estado de sessão inválido: {}",
                other
            ))),
        }
    }
}
