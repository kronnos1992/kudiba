use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum Currency {
    #[default]
    Aoa,
    Usd,
    Eur,
}

impl Currency {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Aoa => "AOA",
            Self::Usd => "USD",
            Self::Eur => "EUR",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "AOA" => Some(Self::Aoa),
            "USD" => Some(Self::Usd),
            "EUR" => Some(Self::Eur),
            _ => None,
        }
    }
}
