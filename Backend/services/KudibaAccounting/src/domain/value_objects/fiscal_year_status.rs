use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FiscalYearStatus {
    Open,
    ClosingInProgress,
    Closed,
}

impl FiscalYearStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Open => "OPEN",
            Self::ClosingInProgress => "CLOSING_IN_PROGRESS",
            Self::Closed => "CLOSED",
        }
    }
}
