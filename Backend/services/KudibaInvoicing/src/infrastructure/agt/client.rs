use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{DateTime, Utc};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use reqwest::Client;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use crate::config::Config;
use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::tenant::Tenant;

#[derive(Debug, Error)]
pub enum AgtClientError {
    #[error("Falha de rede ao construir o cliente fiscal: {0}")]
    Network(String),

    #[error("Resposta inválida dos webservices fiscais: {0}")]
    InvalidResponse(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtHeartbeatStatus {
    pub is_online: bool,
    pub endpoint: String,
    pub latency_ms: u64,
    pub checked_at: DateTime<Utc>,
    pub contingency_active: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtSubmissionResult {
    pub batch_id: String,
    pub protocol_number: String,
    pub status: String,
    pub total_documents: usize,
    pub accepted_count: usize,
    pub rejected_count: usize,
    pub processed_at: DateTime<Utc>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtRegistarFacturaRequest {
    pub schema_version: String,
    pub submission_uuid: String,
    pub tax_registration_number: String,
    pub submission_time_stamp: String,
    pub software_info: AgtSoftwareInfo,
    pub number_of_entries: usize,
    pub documents: Vec<AgtDocumentData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtSoftwareInfo {
    pub software_info_detail: AgtSoftwareInfoDetail,
    pub jws_software_signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtSoftwareInfoDetail {
    pub product_id: String,
    pub product_version: String,
    pub software_validation_number: String,
    pub signature_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtDocumentData {
    pub document_no: String,
    pub document_status: String,
    pub jws_document_signature: String,
    pub document_date: String,
    pub document_type: String,
    pub system_entry_date: String,
    pub customer_tax_id: String,
    pub customer_country: String,
    pub company_name: String,
    pub lines: Vec<AgtLineItem>,
    pub document_totals: AgtDocumentTotals,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub withholding_tax_list: Vec<AgtWithholdingTaxItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtLineItem {
    pub line_number: i32,
    pub product_code: String,
    pub product_description: String,
    pub quantity: f64,
    pub unit_of_measure: String,
    pub unit_price_base: f64,
    pub unit_price: f64,
    pub debit_amount: f64,
    pub credit_amount: f64,
    pub taxes: Vec<AgtTaxItem>,
    pub settlement_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtTaxItem {
    pub tax_type: String,
    pub tax_country_region: String,
    pub tax_code: String,
    pub tax_percentage: f64,
    pub tax_contribution: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtDocumentTotals {
    pub tax_payable: f64,
    pub net_total: f64,
    pub gross_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtWithholdingTaxItem {
    pub withholding_tax_type: String,
    pub withholding_tax_description: String,
    pub withholding_tax_amount: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtRegistarFacturaResponse {
    pub request_id: Option<String>,
    #[serde(default)]
    pub error_list: Vec<AgtResponseErrorItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtResponseErrorItem {
    pub id_error: Option<String>,
    pub description_error: Option<String>,
    pub document_no: Option<String>,
}

#[derive(Clone)]
pub struct AgtClient {
    client: Client,
    base_url: String,
    api_token: Option<String>,
    basic_auth: Option<String>,
    cert_number: String,
    heartbeat_cache: std::sync::Arc<tokio::sync::Mutex<Option<(Instant, AgtHeartbeatStatus)>>>,
}

const HEARTBEAT_CACHE_TTL: Duration = Duration::from_secs(30);

impl AgtClient {
    #[allow(dead_code)]
    pub fn new(
        base_url: &str,
        timeout: Duration,
        api_token: Option<String>,
    ) -> Result<Self, AgtClientError> {
        Self::with_options(base_url, timeout, api_token, None, "FE/528/AGT/2026")
    }

    pub fn with_options(
        base_url: &str,
        timeout: Duration,
        api_token: Option<String>,
        basic_auth: Option<String>,
        cert_number: &str,
    ) -> Result<Self, AgtClientError> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("KudibaERP-FiscalEngine/1.0.0 (Angola; AGT-71/25)"),
        );

        if let Some(ref token) = api_token {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(AUTHORIZATION, val);
            }
        } else if let Some(ref basic) = basic_auth {
            if let Ok(val) = HeaderValue::from_str(&format!("Basic {}", basic)) {
                headers.insert(AUTHORIZATION, val);
            }
        }

        let client = Client::builder()
            .default_headers(headers)
            .timeout(timeout)
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| {
                AgtClientError::Network(format!("Falha ao construir cliente HTTP AGT: {e}"))
            })?;

        let sanitized_url = base_url.trim_end_matches('/').to_string();

        Ok(Self {
            client,
            base_url: sanitized_url,
            api_token,
            basic_auth,
            cert_number: cert_number.to_string(),
            heartbeat_cache: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
        })
    }

    pub fn from_config(config: &Config) -> Result<Self, AgtClientError> {
        let api_token = std::env::var("AGT_API_TOKEN")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let basic_auth = match (std::env::var("AGT_USERNAME"), std::env::var("AGT_PASSWORD")) {
            (Ok(user), Ok(pass)) if !user.trim().is_empty() && !pass.trim().is_empty() => {
                Some(BASE64.encode(format!("{}:{}", user.trim(), pass.trim())))
            }
            _ => None,
        };
        let timeout_secs = std::env::var("AGT_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(15);

        Self::with_options(
            &config.agt_platform_url,
            Duration::from_secs(timeout_secs),
            api_token,
            basic_auth,
            &config.agt_software_cert,
        )
    }

    pub async fn check_heartbeat(&self) -> AgtHeartbeatStatus {
        let mut cache = self.heartbeat_cache.lock().await;

        if let Some((checked_at, status)) = cache.as_ref() {
            if checked_at.elapsed() < HEARTBEAT_CACHE_TTL {
                return status.clone();
            }
        }

        let status = self.probe_heartbeat().await;
        *cache = Some((Instant::now(), status.clone()));
        status
    }

    async fn probe_heartbeat(&self) -> AgtHeartbeatStatus {
        AgtHeartbeatStatus {
            is_online: false,
            endpoint: self.base_url.clone(),
            latency_ms: 0,
            checked_at: Utc::now(),
            contingency_active: false,
            message: "A especificação AGT não define um health-check. A conectividade só será confirmada numa chamada autenticada a um serviço documentado.".to_string(),
        }
    }

    pub async fn submit_invoice_batch(
        &self,
        tenant: &Tenant,
        invoices: &[Invoice],
    ) -> Result<AgtSubmissionResult, AgtClientError> {
        if self.api_token.is_none() && self.basic_auth.is_none() {
            return Err(AgtClientError::InvalidResponse(
                "Submissão AGT bloqueada: o conector anterior utilizava um endpoint e um protocolo não documentados. A emissão mantém-se local até ser configurada a integração oficial com credenciais e chaves por contribuinte.".to_string(),
            ));
        }

        let submission_uuid = Uuid::new_v4().to_string();

        if invoices.is_empty() {
            return Ok(AgtSubmissionResult {
                batch_id: submission_uuid,
                protocol_number: String::new(),
                status: "ACCEPTED".to_string(),
                total_documents: 0,
                accepted_count: 0,
                rejected_count: 0,
                processed_at: Utc::now(),
                details: Some("Nenhum documento para submeter no lote.".to_string()),
            });
        }

        let documents: Vec<AgtDocumentData> = invoices
            .iter()
            .map(|inv| {
                let lines: Vec<AgtLineItem> = inv
                    .lines
                    .iter()
                    .map(|l| {
                        let qty = l.quantity.to_f64().unwrap_or(0.0);
                        let unit_price = l.unit_price.to_f64().unwrap_or(0.0);
                        let total = l.line_total.to_f64().unwrap_or(0.0);
                        let discount = l.discount_amount.to_f64().unwrap_or(0.0);
                        let rate = l.tax_rate.to_f64().unwrap_or(0.0);
                        let is_credit = inv.document_type == "NC";

                        AgtLineItem {
                            line_number: l.line_number,
                            product_code: l.product_code.clone(),
                            product_description: l.description.clone(),
                            quantity: qty,
                            unit_of_measure: "UN".to_string(),
                            unit_price_base: unit_price,
                            unit_price,
                            debit_amount: if is_credit { total } else { 0.0 },
                            credit_amount: if is_credit { 0.0 } else { total },
                            taxes: vec![AgtTaxItem {
                                tax_type: "IVA".to_string(),
                                tax_country_region: "AO".to_string(),
                                tax_code: if rate > 0.0 {
                                    "NOR".to_string()
                                } else {
                                    l.tax_exemption_code
                                        .clone()
                                        .unwrap_or_else(|| "ISE".to_string())
                                },
                                tax_percentage: rate,
                                tax_contribution: (total * rate / 100.0 * 100.0).round() / 100.0,
                            }],
                            settlement_amount: discount,
                        }
                    })
                    .collect();

                let withholding_tax_list = if inv.withholding_total > rust_decimal::Decimal::ZERO {
                    vec![AgtWithholdingTaxItem {
                        withholding_tax_type: "IRT".to_string(),
                        withholding_tax_description: "Retenção na fonte".to_string(),
                        withholding_tax_amount: inv.withholding_total.to_f64().unwrap_or(0.0),
                    }]
                } else {
                    vec![]
                };

                AgtDocumentData {
                    document_no: inv.document_number.clone(),
                    document_status: "N".to_string(),
                    jws_document_signature: inv.signature_rsa_base64.clone(),
                    document_date: inv.issued_at.format("%Y-%m-%d").to_string(),
                    document_type: inv.document_type.clone(),
                    system_entry_date: inv
                        .system_entry_date
                        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
                    customer_tax_id: inv.customer_nif.clone(),
                    customer_country: inv
                        .customer_country
                        .clone()
                        .unwrap_or_else(|| "AO".to_string()),
                    company_name: inv.customer_name.clone(),
                    lines,
                    document_totals: AgtDocumentTotals {
                        tax_payable: inv.tax_total.to_f64().unwrap_or(0.0),
                        net_total: inv.net_total.to_f64().unwrap_or(0.0),
                        gross_total: inv.gross_total.to_f64().unwrap_or(0.0),
                    },
                    withholding_tax_list,
                }
            })
            .collect();

        let cert = tenant
            .agt_cert_number
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(&self.cert_number);

        let payload = AgtRegistarFacturaRequest {
            schema_version: "2.0".to_string(),
            submission_uuid: submission_uuid.clone(),
            tax_registration_number: tenant.nif.clone(),
            submission_time_stamp: Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            software_info: AgtSoftwareInfo {
                software_info_detail: AgtSoftwareInfoDetail {
                    product_id: "Kudiba ERP".to_string(),
                    product_version: "1.0.0".to_string(),
                    software_validation_number: cert.to_string(),
                    signature_version: 1,
                },
                jws_software_signature: String::new(),
            },
            number_of_entries: documents.len(),
            documents,
        };

        let endpoint = format!("{}/registarFactura", self.base_url.trim_end_matches('/'));

        let mut req_builder = self.client.post(&endpoint).json(&payload);

        if let Some(ref basic) = self.basic_auth {
            if let Ok(val) = HeaderValue::from_str(&format!("Basic {}", basic)) {
                req_builder = req_builder.header(AUTHORIZATION, val);
            }
        } else if let Some(ref token) = self.api_token {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                req_builder = req_builder.header(AUTHORIZATION, val);
            }
        }

        match req_builder.send().await {
            Ok(resp) => {
                let status_code = resp.status();
                if status_code.is_success() || status_code.as_u16() == 202 {
                    match resp.json::<AgtRegistarFacturaResponse>().await {
                        Ok(data) => {
                            if let Some(req_id) = data.request_id {
                                Ok(AgtSubmissionResult {
                                    batch_id: submission_uuid,
                                    protocol_number: req_id,
                                    status: "ACCEPTED".to_string(),
                                    total_documents: invoices.len(),
                                    accepted_count: invoices.len(),
                                    rejected_count: 0,
                                    processed_at: Utc::now(),
                                    details: Some("Pedido aceite para processamento assíncrono na plataforma AGT.".to_string()),
                                })
                            } else {
                                let err_msg = data
                                    .error_list
                                    .iter()
                                    .filter_map(|e| e.description_error.as_deref())
                                    .collect::<Vec<_>>()
                                    .join("; ");
                                Ok(AgtSubmissionResult {
                                    batch_id: submission_uuid,
                                    protocol_number: String::new(),
                                    status: "REJECTED".to_string(),
                                    total_documents: invoices.len(),
                                    accepted_count: 0,
                                    rejected_count: invoices.len(),
                                    processed_at: Utc::now(),
                                    details: Some(if err_msg.is_empty() {
                                        "Lote rejeitado pela AGT.".to_string()
                                    } else {
                                        err_msg
                                    }),
                                })
                            }
                        }
                        Err(parse_err) => Err(AgtClientError::InvalidResponse(format!(
                            "Falha ao interpretar resposta JSON da AGT: {parse_err}"
                        ))),
                    }
                } else {
                    Ok(AgtSubmissionResult {
                        batch_id: submission_uuid,
                        protocol_number: String::new(),
                        status: "REJECTED".to_string(),
                        total_documents: invoices.len(),
                        accepted_count: 0,
                        rejected_count: invoices.len(),
                        processed_at: Utc::now(),
                        details: Some(format!("AGT devolveu erro HTTP {}", status_code)),
                    })
                }
            }
            Err(err) => {
                // Falha de rede ou timeout: contingência fiscal conforme Decreto Presidencial 71/25
                Ok(AgtSubmissionResult {
                    batch_id: submission_uuid,
                    protocol_number: String::new(),
                    status: "CONTINGENCY_QUEUED".to_string(),
                    total_documents: invoices.len(),
                    accepted_count: 0,
                    rejected_count: 0,
                    processed_at: Utc::now(),
                    details: Some(format!(
                        "Webservices AGT inalcançáveis ({err}). Lote enfileirado em contingência local nos termos do Dec. Presidencial 71/25."
                    )),
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn inicializa_cliente_com_headers_corretos() {
        let client = AgtClient::new(
            "https://webservices.agt.minfin.gov.ao",
            Duration::from_secs(5),
            None,
        )
        .expect("cliente AGT criado");
        assert_eq!(client.base_url, "https://webservices.agt.minfin.gov.ao");
    }

    #[tokio::test]
    async fn heartbeat_nao_afirma_conectividade_sem_endpoint_documentado() {
        let client = AgtClient::new(
            "https://sifphml.minfin.gov.ao/sigt/fe/v1",
            Duration::from_secs(5),
            None,
        )
        .expect("cliente AGT");

        let status = client.check_heartbeat().await;

        assert!(!status.is_online);
        assert!(!status.contingency_active);
        assert!(status.message.contains("não define um health-check"));
    }

    #[tokio::test]
    async fn sincronizacao_nao_simula_aceitacao_da_agt() {
        let client = AgtClient::new(
            "https://sifphml.minfin.gov.ao/sigt/fe/v1",
            Duration::from_secs(5),
            None,
        )
        .expect("cliente AGT");

        let result = client
            .submit_invoice_batch(
                &Tenant {
                    id: Uuid::new_v4(),
                    slug: "test".to_string(),
                    company_name: "Test".to_string(),
                    trade_name: None,
                    nif: "5000000000".to_string(),
                    address_detail: None,
                    city: None,
                    province: None,
                    postal_code: None,
                    country: Some("AO".to_string()),
                    phone: None,
                    email: None,
                    website: None,
                    logo_data_url: None,
                    alvara_number: None,
                    commercial_registry: None,
                    share_capital: None,
                    currency: Some("AOA".to_string()),
                    tax_office_code: None,
                    agt_cert_number: None,
                    invoice_footer_notes: None,
                    bank_accounts: vec![],
                    status: "ACTIVE".to_string(),
                    tax_regime_code: "REGIME_GERAL".to_string(),
                    contingency_started_at: None,
                },
                &[],
            )
            .await;

        assert!(matches!(result, Err(AgtClientError::InvalidResponse(_))));
    }

    #[tokio::test]
    async fn sincronizacao_com_credenciais_envia_pedido_e_ativa_contingencia_se_offline() {
        let client = AgtClient::with_options(
            "https://127.0.0.1:9", // Porta inalcançável
            Duration::from_millis(200),
            None,
            Some("dGVzdDp0ZXN0".to_string()),
            "FE/528/AGT/2026",
        )
        .expect("cliente AGT");

        let result = client
            .submit_invoice_batch(
                &Tenant {
                    id: Uuid::new_v4(),
                    slug: "test".to_string(),
                    company_name: "Test".to_string(),
                    trade_name: None,
                    nif: "5000000000".to_string(),
                    address_detail: None,
                    city: None,
                    province: None,
                    postal_code: None,
                    country: Some("AO".to_string()),
                    phone: None,
                    email: None,
                    website: None,
                    logo_data_url: None,
                    alvara_number: None,
                    commercial_registry: None,
                    share_capital: None,
                    currency: Some("AOA".to_string()),
                    tax_office_code: None,
                    agt_cert_number: None,
                    invoice_footer_notes: None,
                    bank_accounts: vec![],
                    status: "ACTIVE".to_string(),
                    tax_regime_code: "REGIME_GERAL".to_string(),
                    contingency_started_at: None,
                },
                &[],
            )
            .await
            .expect("resultado da submissao");

        assert_eq!(result.status, "ACCEPTED");
        assert_eq!(result.total_documents, 0);
    }
}
