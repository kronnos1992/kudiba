//! Conector de Comunicação Externa com a Administração Geral Tributária (AGT)
//!
//! Conformidade:
//!   • Decreto Presidencial n.º 71/25 — Facturação Electrónica e Comunicação em Tempo Real
//!   • Canal Webservices AGT (REST / SOAP)
//!
//! Responsabilidades:
//!   1. Configuração do ambiente de homologação ou produção
//!   2. Submissão e acompanhamento de documentos fiscais pela API oficial
//!   3. Sinalização explícita de capacidades ainda não configuradas

use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::config::Config;
use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::tenant::Tenant;

/// Erros decorrentes da comunicação directa com os webservices da AGT
#[derive(Debug, Error)]
pub enum AgtClientError {
    #[error("Falha de rede ao construir o cliente fiscal: {0}")]
    Network(String),

    #[allow(dead_code)]
    #[error("Resposta inválida dos webservices fiscais: {0}")]
    InvalidResponse(String),
}

/// Estado do teste de comunicação (Heartbeat) com a AGT
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

/// Resultado da submissão do lote de documentos à AGT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtSubmissionResult {
    pub batch_id: String,
    pub protocol_number: String,
    pub status: String, // "ACCEPTED", "REJECTED", "CONTINGENCY_QUEUED"
    pub total_documents: usize,
    pub accepted_count: usize,
    pub rejected_count: usize,
    pub processed_at: DateTime<Utc>,
    pub details: Option<String>,
}

/// Carga de documento individual no lote da AGT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct AgtDocumentItem {
    pub document_number: String,
    pub document_type: String,
    pub hash_sha256: String,
    pub signature_rsa_base64: String,
    pub validation_chars: String,
    pub key_version: String,
    pub customer_nif: String,
    pub customer_name: String,
    pub net_total: f64,
    pub tax_total: f64,
    pub gross_total: f64,
    pub currency: String,
    pub is_contingency: bool,
    pub tax_regime_code: String,
    pub issued_at: String,
    pub line_count: usize,
}

/// Carga completa de submissão de lote para a AGT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct AgtBatchPayload {
    pub batch_id: String,
    pub producer_nif: String,
    pub cert_number: String,
    pub submission_timestamp: String,
    pub documents: Vec<AgtDocumentItem>,
}

/// Cliente de comunicação com os webservices da AGT
#[derive(Clone)]
pub struct AgtClient {
    #[allow(dead_code)]
    client: Client,
    base_url: String,
    #[allow(dead_code)]
    api_token: Option<String>,
    /// Heartbeat memoizado: o canal AGT não deve ser sondado a cada pedido de
    /// estado, sob pena de taxa de utilização rejeitada pelo gateway tributário.
    heartbeat_cache: std::sync::Arc<tokio::sync::Mutex<Option<(Instant, AgtHeartbeatStatus)>>>,
}

/// Janela mínima entre duas sondagens de heartbeat ao canal AGT
const HEARTBEAT_CACHE_TTL: Duration = Duration::from_secs(30);

impl AgtClient {
    /// Inicializa o conector HTTP com timeout e cabeçalhos de conformidade
    pub fn new(
        base_url: &str,
        timeout: Duration,
        api_token: Option<String>,
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
            heartbeat_cache: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
        })
    }

    /// Inicializa a partir das configurações do motor fiscal
    pub fn from_config(config: &Config) -> Result<Self, AgtClientError> {
        let api_token = std::env::var("AGT_API_TOKEN")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let timeout_secs = std::env::var("AGT_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(15);

        Self::new(
            &config.agt_platform_url,
            Duration::from_secs(timeout_secs),
            api_token,
        )
    }

    /// A documentação AGT não define um endpoint de health-check.
    ///
    /// O estado indica que a conectividade só pode ser confirmada através de uma
    /// chamada autenticada a um serviço documentado, não por um `/health` fictício.
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

    /// Não contacta um caminho de health-check que não consta da especificação AGT.
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

    /// Submete um lote de faturas aos webservices da AGT
    pub async fn submit_invoice_batch(
        &self,
        _tenant: &Tenant,
        _invoices: &[Invoice],
    ) -> Result<AgtSubmissionResult, AgtClientError> {
        Err(AgtClientError::InvalidResponse(
            "Submissão AGT bloqueada: o conector anterior utilizava um endpoint e um protocolo não documentados. A emissão mantém-se local até ser configurada a integração oficial com credenciais e chaves por contribuinte.".to_string(),
        ))
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
}
