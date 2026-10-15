use async_trait::async_trait;
use chrono::NaiveDate;
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::{FieldTable, ShortString},
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::error::InventoryError;
use crate::domain::ports::event_publisher::InventoryEventPublisher;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockDispatchEvent {
    pub event_id: Uuid,
    pub tenant_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
}

pub struct MultiChannelInventoryEventPublisher {
    rabbitmq_url: Option<String>,
    channel: Arc<Mutex<Option<Channel>>>,
}

impl MultiChannelInventoryEventPublisher {
    pub fn new(rabbitmq_url: Option<String>) -> Self {
        Self {
            rabbitmq_url,
            channel: Arc::new(Mutex::new(None)),
        }
    }

    async fn get_channel(&self, rmq_url: &str) -> Result<Channel, InventoryError> {
        let mut guard = self.channel.lock().await;
        if let Some(ref ch) = *guard {
            if ch.status().connected() {
                return Ok(ch.clone());
            }
        }

        let conn = Connection::connect(rmq_url, ConnectionProperties::default())
            .await
            .map_err(|e| InventoryError::DatabaseError(format!("AMQP connect error: {}", e)))?;

        let channel = conn.create_channel().await.map_err(|e| {
            InventoryError::DatabaseError(format!("AMQP create_channel error: {}", e))
        })?;

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
                InventoryError::DatabaseError(format!("AMQP exchange_declare error: {}", e))
            })?;

        *guard = Some(channel.clone());
        Ok(channel)
    }
}

#[async_trait]
impl InventoryEventPublisher for MultiChannelInventoryEventPublisher {
    async fn publish_stock_dispatch(
        &self,
        tenant_id: Uuid,
        document_number: &str,
        movement_date: NaiveDate,
        total_cmp_cost: Decimal,
    ) -> Result<(), InventoryError> {
        let event_id = Uuid::new_v4();
        let payload = serde_json::json!({
            "documentRef": document_number,
            "movementDate": movement_date.format("%Y-%m-%d").to_string(),
            "cmpTotalCost": total_cmp_cost,
        });

        let event = StockDispatchEvent {
            event_id,
            tenant_id,
            event_type: "inventory.stock_dispatch".to_string(),
            payload,
        };

        tracing::info!(
            event_id = %event.event_id,
            document_number = %document_number,
            total_cmp = %total_cmp_cost,
            "Publicando evento de saída de stock ao CMP para contabilidade"
        );

        if let Some(ref rmq) = self.rabbitmq_url {
            let channel = self.get_channel(rmq).await?;
            let payload_bytes = serde_json::to_vec(&event).map_err(|e| {
                InventoryError::DatabaseError(format!("Falha ao serializar evento: {}", e))
            })?;

            let props = BasicProperties::default()
                .with_content_type(ShortString::from("application/json"))
                .with_delivery_mode(2);

            let confirm = channel
                .basic_publish(
                    ShortString::from("fiscal.events"),
                    ShortString::from("inventory.event.stock_dispatch"),
                    BasicPublishOptions::default(),
                    &payload_bytes,
                    props,
                )
                .await
                .map_err(|e| {
                    InventoryError::DatabaseError(format!("Erro ao publicar AMQP: {}", e))
                })?;

            let _ = confirm.await;
        }

        Ok(())
    }
}
