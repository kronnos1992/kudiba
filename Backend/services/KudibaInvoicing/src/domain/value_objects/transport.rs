//! Metadados logísticos de movimentação de mercadorias
//!
//! Em conformidade com o Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas),
//! as Guias de Transporte (GT) e Guias de Remessa (GR) devem conter obrigatoriamente
//! os locais de carga/descarga, datas de início do transporte, viatura e transportador.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransportMovement {
    /// Matrícula do veículo transportador (ex.: "LD-42-88-AA")
    #[serde(default)]
    pub vehicle_registration: Option<String>,
    /// Designação social ou nome do transportador
    #[serde(default)]
    pub carrier_name: Option<String>,
    /// NIF do transportador (se aplicável)
    #[serde(default)]
    pub carrier_nif: Option<String>,
    /// Morada/Local de carga das mercadorias
    #[serde(default)]
    pub load_address: Option<String>,
    /// Cidade/Município de carga
    #[serde(default)]
    pub load_city: Option<String>,
    /// Código do país de carga (ex.: "AO")
    #[serde(default)]
    pub load_country: Option<String>,
    /// Data e hora de início do transporte/carga
    #[serde(default)]
    pub load_date_time: Option<DateTime<Utc>>,
    /// Morada/Local de descarga das mercadorias
    #[serde(default)]
    pub unload_address: Option<String>,
    /// Cidade/Município de descarga
    #[serde(default)]
    pub unload_city: Option<String>,
    /// Código do país de descarga (ex.: "AO")
    #[serde(default)]
    pub unload_country: Option<String>,
    /// Data e hora prevista de chegada/descarga
    #[serde(default)]
    pub unload_date_time: Option<DateTime<Utc>>,
}

impl TransportMovement {
    /// Validação estrita de menções obrigatórias para Guias de Transporte (GT) e Remessa (GR)
    pub fn validate_for_document_type(&self, document_type: &str) -> Result<(), DomainError> {
        let doc = document_type.trim().to_ascii_uppercase();
        if doc == "GT" || doc == "GR" {
            if self.load_address.as_deref().unwrap_or("").trim().is_empty() {
                return Err(DomainError::invalid(format!(
                    "Em documentos do tipo '{doc}', a indicação do local de carga é obrigatória pelo Decreto 71/25."
                )));
            }
            if self.unload_address.as_deref().unwrap_or("").trim().is_empty() {
                return Err(DomainError::invalid(format!(
                    "Em documentos do tipo '{doc}', a indicação do local de descarga é obrigatória pelo Decreto 71/25."
                )));
            }
            if self.load_date_time.is_none() {
                return Err(DomainError::invalid(format!(
                    "Em documentos do tipo '{doc}', a data e hora de início do transporte são obrigatórias pelo Decreto 71/25."
                )));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valida_guia_de_transporte_completa_com_sucesso() {
        let transport = TransportMovement {
            vehicle_registration: Some("LD-01-02-AA".to_string()),
            carrier_name: Some("TransAngola Lda".to_string()),
            carrier_nif: Some("5009876543".to_string()),
            load_address: Some("Armazém Central, Viana".to_string()),
            load_city: Some("Luanda".to_string()),
            load_country: Some("AO".to_string()),
            load_date_time: Some(Utc::now()),
            unload_address: Some("Loja Benguela Centro".to_string()),
            unload_city: Some("Benguela".to_string()),
            unload_country: Some("AO".to_string()),
            unload_date_time: Some(Utc::now()),
        };

        assert!(transport.validate_for_document_type("GT").is_ok());
        assert!(transport.validate_for_document_type("GR").is_ok());
        assert!(transport.validate_for_document_type("FT").is_ok());
    }

    #[test]
    fn rejeita_guia_de_transporte_sem_local_de_carga() {
        let transport = TransportMovement {
            vehicle_registration: Some("LD-01-02-AA".to_string()),
            carrier_name: None,
            carrier_nif: None,
            load_address: None,
            load_city: None,
            load_country: None,
            load_date_time: Some(Utc::now()),
            unload_address: Some("Benguela".to_string()),
            unload_city: None,
            unload_country: None,
            unload_date_time: None,
        };

        let err = transport.validate_for_document_type("GT").unwrap_err();
        match err {
            DomainError::InvalidArgument(msg) => {
                assert!(msg.contains("local de carga é obrigatória"));
            }
            _ => panic!("Esperado erro InvalidArgument"),
        }
    }

    #[test]
    fn rejeita_guia_de_remessa_sem_data_de_carga() {
        let transport = TransportMovement {
            vehicle_registration: None,
            carrier_name: None,
            carrier_nif: None,
            load_address: Some("Porto de Luanda".to_string()),
            load_city: None,
            load_country: None,
            load_date_time: None,
            unload_address: Some("Huambo".to_string()),
            unload_city: None,
            unload_country: None,
            unload_date_time: None,
        };

        let err = transport.validate_for_document_type("GR").unwrap_err();
        match err {
            DomainError::InvalidArgument(msg) => {
                assert!(msg.contains("data e hora de início do transporte"));
            }
            _ => panic!("Esperado erro InvalidArgument"),
        }
    }
}
