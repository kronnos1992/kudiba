use async_trait::async_trait;
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::{FieldTable, ShortString},
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::entities::TreasuryReceipt;
use crate::domain::error::DomainError;
use crate::domain::ports::TreasuryEventPublisher;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryReceiptIssuedEvent {
    pub event_id: Uuid,
    pub tenant_id: Uuid,
    pub receipt_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
}

pub struct MultiChannelTreasuryEventPublisher {
    rabbitmq_url: Option<String>,
    channel: Arc<Mutex<Option<Channel>>>,
}

impl MultiChannelTreasuryEventPublisher {
    pub fn new(rabbitmq_url: Option<String>) -> Self {
        Self {
            rabbitmq_url,
            channel: Arc::new(Mutex::new(None)),
        }
    }

    async fn get_channel(&self, rmq_url: &str) -> Result<Channel, DomainError> {
        let mut guard = self.channel.lock().await;
        if let Some(ref ch) = *guard {
            if ch.status().connected() {
                return Ok(ch.clone());
            }
        }

        let conn = Connection::connect(rmq_url, ConnectionProperties::default())
            .await
            .map_err(|e| DomainError::DatabaseError(format!("AMQP connect error: {}", e)))?;

        let channel = conn
            .create_channel()
            .await
            .map_err(|e| DomainError::DatabaseError(format!("AMQP create_channel error: {}", e)))?;

        channel
            .exchange_declare(
                ShortString::from("fiscal.events"),
                ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| {
                DomainError::DatabaseError(format!("AMQP exchange_declare error: {}", e))
            })?;

        *guard = Some(channel.clone());
        Ok(channel)
    }
}

#[async_trait]
impl TreasuryEventPublisher for MultiChannelTreasuryEventPublisher {
    async fn publish_receipt_issued(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError> {
        let event_id = Uuid::new_v4();
        let payload = serde_json::json!({
            "receiptNumber": receipt.receipt_number,
            "customerName": receipt.customer_name,
            "receiptDate": receipt.issued_at.format("%Y-%m-%d").to_string(),
            "amount": receipt.total_amount,
            "isBank": receipt.bank_account_id.is_some(),
        });

        let event = TreasuryReceiptIssuedEvent {
            event_id,
            tenant_id: receipt.tenant_id,
            receipt_id: receipt.id,
            event_type: "treasury.receipt.issued".to_string(),
            payload,
        };

        tracing::info!(
            event_id = %event.event_id,
            receipt_number = %receipt.receipt_number,
            total = %receipt.total_amount,
            "Disparando evento de recibo de tesouraria emitido"
        );

        if let Some(ref rmq) = self.rabbitmq_url {
            let channel = self.get_channel(rmq).await?;
            let payload_bytes = serde_json::to_vec(&event).map_err(|e| {
                DomainError::DatabaseError(format!("Falha ao serializar evento: {}", e))
            })?;

            let props = BasicProperties::default()
                .with_content_type(ShortString::from("application/json"))
                .with_delivery_mode(2);

            let publish_res = channel
                .basic_publish(
                    ShortString::from("fiscal.events"),
                    ShortString::from("treasury.event.receipt.issued"),
                    BasicPublishOptions::default(),
                    &payload_bytes,
                    props,
                )
                .await;

            match publish_res {
                Ok(confirm) => {
                    if let Err(e) = confirm.await {
                        let mut guard = self.channel.lock().await;
                        *guard = None;
                        return Err(DomainError::DatabaseError(format!(
                            "Falha na confirmação de publicação AMQP: {}",
                            e
                        )));
                    }
                }
                Err(err) => {
                    let mut guard = self.channel.lock().await;
                    *guard = None;
                    return Err(DomainError::DatabaseError(format!(
                        "Erro ao publicar AMQP: {}",
                        err
                    )));
                }
            }
        }

        Ok(())
    }
}

#[derive(Debug, Default, Clone)]
pub struct NoopTreasuryEventPublisher;

#[async_trait]
impl TreasuryEventPublisher for NoopTreasuryEventPublisher {
    async fn publish_receipt_issued(&self, _receipt: &TreasuryReceipt) -> Result<(), DomainError> {
        Ok(())
    }
}
