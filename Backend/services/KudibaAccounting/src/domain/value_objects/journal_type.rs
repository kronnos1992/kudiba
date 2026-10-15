use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JournalType {
    Sales,
    Purchases,
    Cash,
    Bank,
    Operations,
    Closing,
}

impl JournalType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Sales => "SALES",
            Self::Purchases => "PURCHASES",
            Self::Cash => "CASH",
            Self::Bank => "BANK",
            Self::Operations => "OPERATIONS",
            Self::Closing => "CLOSING",
        }
    }
}
