//! Validador de Conformidade SAF-T (AO) contra o Schema Oficial XSD da AGT
//!
//! Conformidade Legal:
//!   • Decreto Executivo n.º 385/20 — Aprovação da Estrutura SAF-T (AO) v1.01_01
//!   • Decreto Presidencial n.º 71/25 — Regime Jurídico das Facturas e Documentos Equivalentes
//!
//! Realiza a validação sintáctica e estrutural em memória contra o ficheiro XSD
//! oficial fornecido pela AGT/ASSOFT e validações semânticas de integridade contabilística.

use std::sync::OnceLock;
use crate::domain::error::DomainError;

/// Schema oficial SAF-T (AO) v1.01_01 embutido no binário
pub const SAFT_AO_XSD_SCHEMA: &str = include_str!("../../../schemas/SAFTAO1.01_01.xsd");

static CACHED_SCHEMA: OnceLock<Result<xmlschema::Schema, String>> = OnceLock::new();

/// Validador de ficheiros SAF-T (AO)
pub struct SaftValidator;

impl SaftValidator {
    /// Obtém a árvore compilada do schema XSD oficial
    pub fn get_schema() -> Result<&'static xmlschema::Schema, DomainError> {
        let cached = CACHED_SCHEMA.get_or_init(|| {
            let clean_xsd = SAFT_AO_XSD_SCHEMA
                .strip_prefix('\u{feff}')
                .unwrap_or(SAFT_AO_XSD_SCHEMA)
                .trim();
            xmlschema::parse_schema(clean_xsd)
                .map_err(|e| format!("Falha ao compilar schema XSD SAF-T (AO): {e:?}"))
        });

        match cached {
            Ok(schema) => Ok(schema),
            Err(msg) => Err(DomainError::invalid(msg.clone())),
        }
    }

    /// Valida o documento XML contra o schema oficial XSD da AGT e regras semânticas
    pub fn validate_xml(xml: &str) -> Result<(), DomainError> {
        // 1. Validação de sintaxe e árvore XML
        let doc = oxml::parse(xml)
            .map_err(|e| DomainError::invalid(format!("Estrutura XML inválida no SAF-T (AO): {e}")))?;

        // 2. Validação contra o Schema XSD compilado
        let schema = Self::get_schema()?;
        let report = xmlschema::validate(&doc, schema);

        if !report.is_valid() {
            let error_details: Vec<String> = report
                .violations
                .iter()
                .map(|v| format!("[{}] {}", v.path, v.message))
                .collect();

            return Err(DomainError::invalid(format!(
                "SAF-T (AO) viola o schema oficial XSD da AGT ({} erros detectados): {}",
                error_details.len(),
                error_details.join(" | ")
            )));
        }

        // 3. Validações complementares de integridade contabilística AGT
        Self::validate_accounting_rules(xml)?;

        Ok(())
    }

    /// Validações de integridade semântica exigidas pelo Decreto 71/25
    fn validate_accounting_rules(xml: &str) -> Result<(), DomainError> {
        // Garante a presença do namespace oficial
        if !xml.contains("urn:OECD:StandardAuditFile-Tax:AO_1.01_01") {
            return Err(DomainError::invalid(
                "SAF-T (AO) não declara o namespace oficial obrigatório: urn:OECD:StandardAuditFile-Tax:AO_1.01_01",
            ));
        }

        // Garante a presença dos blocos essenciais
        if !xml.contains("<Header>") || !xml.contains("</Header>") {
            return Err(DomainError::invalid("Elemento <Header> ausente no ficheiro SAF-T."));
        }

        if !xml.contains("<MasterFiles>") || !xml.contains("</MasterFiles>") {
            return Err(DomainError::invalid("Elemento <MasterFiles> ausente no ficheiro SAF-T."));
        }

        if !xml.contains("<SourceDocuments>") || !xml.contains("</SourceDocuments>") {
            return Err(DomainError::invalid("Elemento <SourceDocuments> ausente no ficheiro SAF-T."));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_oficial_compila_com_sucesso() {
        let schema = SaftValidator::get_schema();
        assert!(schema.is_ok(), "O schema oficial XSD da AGT deve compilar sem erro: {:?}", schema.err());
    }

    #[test]
    fn xml_invalido_e_rejeitado() {
        let xml_corrompido = "<AuditFile><InvalidNode>Teste</InvalidNode></AuditFile>";
        let res = SaftValidator::validate_xml(xml_corrompido);
        assert!(res.is_err());
    }
}
