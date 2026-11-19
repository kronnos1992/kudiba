use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DeviceError;
use crate::domain::port::{CloudBootstrap, CloudBootstrapPort, CloudTerminalStatus, SeedDocument};
use crate::domain::seed::SeedPayload;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapResponse {
    token: String,
    tenant_id: Uuid,
    terminal_id: Uuid,
    credential_epoch: i64,
    seed: SeedPayload,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
    status: String,
    credential_epoch: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedResponse {
    version: i32,
    expires_at: chrono::DateTime<chrono::Utc>,
    signature: String,
    catalog: Vec<crate::domain::seed::CatalogItem>,
    series: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapRequest<'a> {
    activation_token: &'a str,
    label: &'a str,
}

pub struct HttpCloudBootstrap {
    client: Client,
    base_url: String,
}

impl HttpCloudBootstrap {
    pub fn new(base_url: impl Into<String>) -> Result<Self, DeviceError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|error| DeviceError::InvalidProfile(format!("cliente HTTP: {error}")))?;
        Ok(Self {
            client,
            base_url: base_url.into().trim_end_matches('/').to_string(),
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn expect_success(
        response: reqwest::Response,
        operation: &str,
    ) -> Result<reqwest::Response, DeviceError> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        let body = response.text().await.unwrap_or_default();
        Err(DeviceError::TransportUnavailable(format!(
            "{operation} falhou ({status}): {}",
            body.chars().take(240).collect::<String>()
        )))
    }
}

#[async_trait]
impl CloudBootstrapPort for HttpCloudBootstrap {
    async fn bootstrap(
        &self,
        activation_token: &str,
        label: &str,
    ) -> Result<CloudBootstrap, DeviceError> {
        let response = self
            .client
            .post(self.url("/api/v1/treasury/pos/pairing/bootstrap"))
            .json(&BootstrapRequest {
                activation_token,
                label,
            })
            .send()
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("bootstrap: {error}")))?;
        let response = Self::expect_success(response, "bootstrap").await?;
        let body: BootstrapResponse = response.json().await.map_err(|error| {
            DeviceError::TransportUnavailable(format!("bootstrap inválido: {error}"))
        })?;
        Ok(CloudBootstrap {
            token: body.token,
            tenant_id: body.tenant_id,
            terminal_id: body.terminal_id,
            credential_epoch: body.credential_epoch,
            seed: body.seed,
        })
    }

    async fn terminal_status(&self, terminal_id: Uuid) -> Result<CloudTerminalStatus, DeviceError> {
        let response = self
            .client
            .get(self.url("/api/v1/treasury/pos/pairing/status"))
            .query(&[("terminalId", terminal_id.to_string())])
            .send()
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("estado: {error}")))?;
        let response = Self::expect_success(response, "estado do terminal").await?;
        let body: StatusResponse = response.json().await.map_err(|error| {
            DeviceError::TransportUnavailable(format!("estado inválido: {error}"))
        })?;
        Ok(CloudTerminalStatus {
            status: body.status,
            credential_epoch: body.credential_epoch,
        })
    }

    async fn seed(&self) -> Result<SeedDocument, DeviceError> {
        let response = self
            .client
            .get(self.url("/api/v1/treasury/pos/seed"))
            .send()
            .await
            .map_err(|error| DeviceError::TransportUnavailable(format!("seed: {error}")))?;
        let response = Self::expect_success(response, "seed").await?;
        let body: SeedResponse = response.json().await.map_err(|error| {
            DeviceError::TransportUnavailable(format!("seed inválido: {error}"))
        })?;
        Ok(SeedDocument {
            seed: SeedPayload {
                version: body.version,
                expires_at: body.expires_at,
                catalog: body.catalog,
                series: body.series,
            },
            signature: body.signature,
        })
    }
}
