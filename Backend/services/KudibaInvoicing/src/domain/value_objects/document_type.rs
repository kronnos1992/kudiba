use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocumentType {
    Invoice,
    InvoiceReceipt,
    ProForma,
    CreditNote,
    DebitNote,
    Receipt,
    GoodsReturn,
    GoodsTransport,
}

impl DocumentType {
    pub fn requires_bank_coordinates(self) -> bool {
        matches!(self, Self::Invoice | Self::DebitNote | Self::ProForma)
    }

    pub fn parse(value: &str) -> Result<Self, DomainError> {
        match value.trim().to_ascii_uppercase().as_str() {
            "FT" => Ok(Self::Invoice),
            "FR" => Ok(Self::InvoiceReceipt),
            "FP" => Ok(Self::ProForma),
            "NC" => Ok(Self::CreditNote),
            "ND" => Ok(Self::DebitNote),
            "RC" => Ok(Self::Receipt),
            "GR" => Ok(Self::GoodsReturn),
            "GT" => Ok(Self::GoodsTransport),
            other => Err(DomainError::invalid(format!(
                "Tipo documental não suportado: '{other}'."
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aceita_tipos_previstos_e_rejeita_valores_desconhecidos() {
        for kind in ["FT", "FR", "NC", "ND", "RC"] {
            assert!(DocumentType::parse(kind).is_ok(), "{kind}");
        }
        assert!(DocumentType::parse("DOCUMENTO-FAKE").is_err());
    }

    #[test]
    fn exige_coordenadas_bancarias_apenas_nos_documentos_de_liquidacao() {
        for kind in ["FT", "ND", "FP"] {
            assert!(DocumentType::parse(kind)
                .unwrap()
                .requires_bank_coordinates());
        }
        for kind in ["FR", "RC", "NC", "GR", "GT"] {
            assert!(!DocumentType::parse(kind)
                .unwrap()
                .requires_bank_coordinates());
        }
    }
}
