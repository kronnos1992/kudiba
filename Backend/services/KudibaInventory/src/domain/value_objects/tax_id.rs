use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::domain::error::InventoryError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaxIdKind {
    LegalEntity,
    NaturalPersonBi,
    FinalConsumer,
    Foreign,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaxId {
    value: String,
    kind: TaxIdKind,
}

impl TaxId {
    pub fn new(raw: &str, kind: TaxIdKind) -> Result<Self, InventoryError> {
        let cleaned = raw.trim().to_uppercase();

        match kind {
            TaxIdKind::FinalConsumer => {
                if cleaned == "999999999" {
                    Ok(Self {
                        value: cleaned,
                        kind,
                    })
                } else {
                    Err(InventoryError::InvalidTaxId(
                        "Consumidor final deve ter o identificador canónico '999999999'"
                            .to_string(),
                    ))
                }
            }
            TaxIdKind::LegalEntity => {
                let re = Regex::new(r"^\d{10}$").map_err(|e| {
                    InventoryError::ValidationError(format!("Erro interno regex: {}", e))
                })?;
                if re.is_match(&cleaned) {
                    Ok(Self {
                        value: cleaned,
                        kind,
                    })
                } else {
                    Err(InventoryError::InvalidTaxId(
                        "NIF de pessoa coletiva deve conter exatamente 10 dígitos numéricos"
                            .to_string(),
                    ))
                }
            }
            TaxIdKind::NaturalPersonBi => {
                let re = Regex::new(r"^\d{9}[A-Z]{2}\d{3}$").map_err(|e| {
                    InventoryError::ValidationError(format!("Erro interno regex: {}", e))
                })?;
                if re.is_match(&cleaned) {
                    Ok(Self {
                        value: cleaned,
                        kind,
                    })
                } else {
                    Err(InventoryError::InvalidTaxId(
                        "Bilhete de Identidade (BI) angolano deve conter 9 dígitos + 2 letras + 3 dígitos (ex: 000123456LA012)".to_string(),
                    ))
                }
            }
            TaxIdKind::Foreign => {
                if cleaned.len() >= 3 && cleaned.len() <= 30 {
                    Ok(Self {
                        value: cleaned,
                        kind,
                    })
                } else {
                    Err(InventoryError::InvalidTaxId(
                        "Identificador fiscal estrangeiro deve ter entre 3 e 30 caracteres"
                            .to_string(),
                    ))
                }
            }
        }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    pub fn kind(&self) -> TaxIdKind {
        self.kind
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valida_nif_pessoa_coletiva_angolana() {
        assert!(TaxId::new("5412345678", TaxIdKind::LegalEntity).is_ok());
        assert!(TaxId::new("541234567", TaxIdKind::LegalEntity).is_err());
        assert!(TaxId::new("54123456789", TaxIdKind::LegalEntity).is_err());
        assert!(TaxId::new("541234567A", TaxIdKind::LegalEntity).is_err());
    }

    #[test]
    fn valida_bi_pessoa_singular_angolana() {
        assert!(TaxId::new("000123456LA012", TaxIdKind::NaturalPersonBi).is_ok());
        assert!(TaxId::new("000123456la012", TaxIdKind::NaturalPersonBi).is_ok()); // to_uppercase
        assert!(TaxId::new("00012345LA012", TaxIdKind::NaturalPersonBi).is_err()); // 8 dígitos antes
        assert!(TaxId::new("000123456L1012", TaxIdKind::NaturalPersonBi).is_err());
        // 1 letra e 1 número
    }

    #[test]
    fn valida_consumidor_final() {
        assert!(TaxId::new("999999999", TaxIdKind::FinalConsumer).is_ok());
        assert!(TaxId::new("999999998", TaxIdKind::FinalConsumer).is_err());
    }

    #[test]
    fn valida_estrangeiro() {
        assert!(TaxId::new("PT123456789", TaxIdKind::Foreign).is_ok());
        assert!(TaxId::new("AB", TaxIdKind::Foreign).is_err());
    }
}
