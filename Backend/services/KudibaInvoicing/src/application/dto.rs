//! DTOs da aplicação (contratos de entrada e saída dos casos de uso)
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Moeda padrão do mercado angolano (Kwanza)
pub const DEFAULT_CURRENCY: &str = "AOA";

/// Versão da chave privada RSA registada na AGT
pub const DEFAULT_KEY_VERSION: &str = "1";

fn default_currency() -> String {
    DEFAULT_CURRENCY.to_string()
}

fn default_key_version() -> String {
    DEFAULT_KEY_VERSION.to_string()
}

fn default_fiscal_year() -> i32 {
    chrono::Utc::now().year()
}

fn default_true() -> bool {
    true
}

// =============================================================================
// ENQUADRAMENTO FISCAL DE IVA
// =============================================================================

/// Comando de resolução automática do regime de IVA por volume de facturação
///
/// Se `declared_regime_code` for enviado, o enquadramento declarado no cadastro
/// da AGT prevalece sobre o automático e fica registado como `MANUAL`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveTaxRegimeCommand {
    pub tenant_id: Uuid,
    #[serde(default = "default_fiscal_year")]
    pub fiscal_year: i32,
    /// Enquadramento declarado na AGT; quando presente, sobrepõe ao automático
    #[serde(default)]
    pub declared_regime_code: Option<String>,
    /// Persiste o resultado em `kudiba_core.tenants` (default: true)
    #[serde(default = "default_true")]
    pub persist: bool,
}

/// Resultado da resolução do regime de IVA
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveTaxRegimeResult {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub regime_code: String,
    pub display_name: String,
    pub source: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub annual_turnover: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub standard_rate: Decimal,
    pub previous_regime_code: String,
    pub regime_changed: bool,
    pub allowed_rates: Vec<f64>,
    pub is_vat_exempt: bool,
    pub allows_input_vat_credit: bool,
    pub resolved_at: DateTime<Utc>,
}

/// Consulta do enquadramento fiscal vigente
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTaxRegimeQuery {
    pub tenant_id: Uuid,
}

/// Enquadramento fiscal e agregado do volume de facturação
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTaxRegimeResult {
    pub tenant_id: Uuid,
    pub regime_code: String,
    pub display_name: String,
    pub source: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub basis_turnover: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub standard_rate: Decimal,
    pub allowed_rates: Vec<f64>,
    pub is_vat_exempt: bool,
    pub allows_input_vat_credit: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_year: Option<i32>,
}

/// Descrição de um regime do catálogo fiscal
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxRegimeView {
    pub regime_code: String,
    pub display_name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub min_turnover: Decimal,
    #[serde(with = "rust_decimal::serde::float_option")]
    pub max_turnover: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::float")]
    pub standard_rate: Decimal,
    pub allowed_rates: Vec<f64>,
    pub requires_credit_note: bool,
    pub is_vat_exempt: bool,
    pub allows_input_vat_credit: bool,
}

// =============================================================================
// COMMAND STACK
// =============================================================================

/// Linha de artigo de entrada na emissão da fatura
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceLineInput {
    pub product_code: String,
    pub description: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub unit_price: Decimal,
    #[serde(default, with = "rust_decimal::serde::float_option")]
    pub discount_amount: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_rate: Decimal,
    #[serde(default)]
    pub tax_exemption_code: Option<String>,
    /// Identifica se a linha é uma prestação de serviço (sujeita a retenção na fonte de 6.5%)
    #[serde(default)]
    pub is_service: Option<bool>,
}

/// Comando de emissão de documento fiscal (POST /api/v1/invoices)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueInvoiceCommand {
    /// Identidade injectada pelo Gateway; nunca aceita valor do JSON público.
    #[serde(skip)]
    pub actor_user_id: Option<String>,
    pub tenant_id: Uuid,
    pub document_type: String,
    pub series_code: String,
    pub fiscal_year: i32,
    pub customer_name: String,
    #[serde(default)]
    pub customer_address: Option<String>,
    #[serde(default)]
    pub customer_city: Option<String>,
    #[serde(default)]
    pub customer_country: Option<String>,
    #[serde(default)]
    pub customer_nif: Option<String>,
    #[serde(default)]
    pub source_document_number: Option<String>,
    #[serde(default)]
    pub payment_methods: Vec<String>,
    /// Valor explícito de retenção na fonte. Se omitido, pode ser calculado automaticamente via `applyWithholding`.
    #[serde(default, with = "rust_decimal::serde::float_option")]
    pub withholding_total: Option<Decimal>,
    /// Ativa o cálculo automático de retenção na fonte (padrão 6.5% sobre serviços ou base líquida)
    #[serde(default)]
    pub apply_withholding: Option<bool>,
    /// Taxa personalizada de retenção na fonte (ex.: 6.5). Se omitida e `applyWithholding` for true, assume 6.5%.
    #[serde(default, with = "rust_decimal::serde::float_option")]
    pub withholding_rate: Option<Decimal>,
    /// Valor explícito de imposto de selo. Se omitido, pode ser calculado automaticamente via `applyStampDuty`.
    #[serde(default, with = "rust_decimal::serde::float_option")]
    pub stamp_duty_total: Option<Decimal>,
    /// Ativa o cálculo automático do imposto de selo (1.0% geral ou 0.7% em recibos/FR)
    #[serde(default)]
    pub apply_stamp_duty: Option<bool>,
    /// Taxa personalizada de imposto de selo (ex.: 1.0 ou 0.7). Se omitida e `applyStampDuty` for true, assume a taxa padrão.
    #[serde(default, with = "rust_decimal::serde::float_option")]
    pub stamp_duty_rate: Option<Decimal>,
    #[serde(default = "default_currency")]
    pub currency: String,
    pub lines: Vec<InvoiceLineInput>,
    #[serde(default)]
    pub is_contingency: bool,
    #[serde(default = "default_key_version")]
    pub key_version: String,
    /// Dados de transporte e movimentação de mercadorias (obrigatórios em GT e GR pelo Decreto 71/25)
    #[serde(default)]
    pub transport: Option<TransportMovementInput>,
}

pub type TransportMovementInput = crate::domain::value_objects::transport::TransportMovement;

/// Comprovativo fiscal devolvido imediatamente ao cliente
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueInvoiceResult {
    pub invoice_id: Uuid,
    pub document_number: String,
    pub sequence_number: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub stamp_duty_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_due: Decimal,
    pub hash_sha256: String,
    pub signature_rsa_base64: String,
    pub validation_chars: String,
    pub issued_at: DateTime<Utc>,
    pub system_entry_date: DateTime<Utc>,
    pub is_contingency: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transport: Option<TransportMovementInput>,
}

/// Comando de anulação / estorno de documento fiscal com emissão de Nota de Crédito
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelInvoiceCommand {
    /// Identidade injectada pelo Gateway; nunca aceita valor do JSON público.
    #[serde(skip)]
    pub actor_user_id: Option<String>,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub reason: String,
    /// Código de série a usar para a Nota de Crédito. Se omitido, usa a mesma série do documento original.
    #[serde(default)]
    pub series_code: Option<String>,
}

/// Comprovativo de anulação e de emissão da Nota de Crédito rectificativa
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelInvoiceResult {
    pub original_invoice_id: Uuid,
    pub original_document_number: String,
    pub credit_note_id: Uuid,
    pub credit_note_document_number: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_refunded: Decimal,
    pub validation_chars: String,
    pub reason: String,
    pub issued_at: DateTime<Utc>,
}


/// Comando de abertura/recuperação de uma série fiscal
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFiscalSeriesCommand {
    pub tenant_id: Uuid,
    pub document_type: String,
    pub series_code: String,
    pub fiscal_year: i32,
}

/// Comando de assinatura directa (gRPC SignDocument) — assinatura de um
/// documento já emitido por um terminal POS em modo contingência
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignDirectCommand {
    pub tenant_id: Uuid,
    pub document_number: String,
    pub invoice_date: String,
    pub system_entry_date: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(default)]
    pub previous_hash: String,
    #[serde(default = "default_key_version")]
    pub key_version: String,
}

/// Resultado da assinatura directa
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignDirectResult {
    pub document_number: String,
    pub signature_base64: String,
    pub hash_sha256: String,
    pub validation_chars: String,
    pub signed_at: DateTime<Utc>,
    pub is_contingency: bool,
}

// =============================================================================
// QUERY STACK
// =============================================================================

/// Consulta de fatura por identificador ou por número de documento legal
#[derive(Debug, Clone)]
pub struct GetInvoiceQuery {
    pub invoice_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub document_number: Option<String>,
}

/// Consulta de verificação de assinatura de um documento emitido
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifySignatureQuery {
    pub document_number: String,
    pub signature_base64: String,
    pub invoice_date: String,
    pub system_entry_date: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(default)]
    pub previous_hash: String,
    #[serde(default = "default_key_version")]
    pub key_version: String,
}

/// Resultado da verificação de assinatura
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifySignatureResult {
    pub is_valid: bool,
    pub validation_chars: String,
    pub error_message: String,
}

/// Consulta de consistência sequencial de uma série fiscal
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSeriesSequenceQuery {
    pub tenant_id: String,
    pub series_code: String,
    pub expected_sequence: i64,
    pub document_year: i32,
    #[serde(default = "default_document_type")]
    pub document_type: String,
}

fn default_document_type() -> String {
    "FT".to_string()
}

/// Resultado da validação de sequência da série
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSeriesSequenceResult {
    pub is_valid: bool,
    pub last_recorded_sequence: i64,
    pub last_document_hash: String,
    pub is_gap_detected: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn totais_sao_serializados_como_numeros_json() {
        let result = IssueInvoiceResult {
            invoice_id: Uuid::new_v4(),
            document_number: "FT KUD26/000001".into(),
            sequence_number: 1,
            net_total: Decimal::from(600000),
            tax_total: Decimal::from(84000),
            gross_total: Decimal::from(684000),
            withholding_total: Decimal::ZERO,
            stamp_duty_total: Decimal::ZERO,
            amount_due: Decimal::from(684000),
            hash_sha256: "abc".into(),
            signature_rsa_base64: "sig".into(),
            validation_chars: "Lk5H".into(),
            issued_at: Utc::now(),
            system_entry_date: Utc::now(),
            is_contingency: false,
            transport: None,
        };

        let json = serde_json::to_value(&result).expect("serialização do comprovativo");

        assert!(
            json["grossTotal"].is_number(),
            "grossTotal deve ser número JSON"
        );
        assert_eq!(json["grossTotal"].as_f64(), Some(684000.0));
        assert_eq!(json["netTotal"].as_f64(), Some(600000.0));
    }

    #[test]
    fn aceita_totais_como_numero_ou_string() {
        let from_number: InvoiceLineInput = serde_json::from_str(
            r#"{"productCode":"P1","description":"D","quantity":2,"unitPrice":250000.55,"taxRate":14}"#,
        )
        .expect("linha com números JSON");

        assert_eq!(
            from_number.unit_price,
            "250000.55".parse::<Decimal>().unwrap()
        );
        assert_eq!(from_number.discount_amount, None);

        let from_string: InvoiceLineInput = serde_json::from_str(
            r#"{"productCode":"P1","description":"D","quantity":"2","unitPrice":"250000.55","taxRate":"14"}"#,
        )
        .expect("linha com strings numéricas");

        assert_eq!(from_string.unit_price, from_number.unit_price);
    }

    #[test]
    fn recebe_retencao_e_imposto_de_selo_como_numeros_json() {
        let command: IssueInvoiceCommand = serde_json::from_str(
            r#"{
                "tenantId":"a0000000-0000-0000-0000-000000000001",
                "documentType":"FT","seriesCode":"S1","fiscalYear":2026,
                "customerName":"Cliente","customerAddress":"Rua 1",
                "customerCity":"Luanda","customerCountry":"AO",
                "paymentMethods":["A crédito"],
                "withholdingTotal":10.25,"stampDutyTotal":2.5,
                "lines":[{"productCode":"P1","description":"D","quantity":1,"unitPrice":100,"taxRate":14}]
            }"#,
        )
        .expect("pedido fiscal");

        assert_eq!(command.withholding_total, Some(Decimal::new(1025, 2)));
        assert_eq!(command.stamp_duty_total, Some(Decimal::new(25, 1)));
        assert_eq!(command.actor_user_id, None);
    }
}
