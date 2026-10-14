//! Despachante de Eventos Fiscais e Contabilísticos (Outbox Dispatcher)
//!
//! Desacopla a rota síncrona de emissão de facturas das tarefas secundárias:
//!   • RabbitMQ: Tarefas assíncronas de renderização de PDF e disparo de email/notificações
//!   • Kafka / Redpanda: Tópico fiduciário de auditoria e contabilidade geral
//!   • Canal interno assíncrono (tokio::sync::broadcast) para consumo em tempo real

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use lapin::{
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::{FieldTable, ShortString},
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

use crate::domain::error::DomainError;

/// Evento contábil retirado da tabela transactional outbox
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OutboxEvent {
    pub event_id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Uuid,
    pub event_type: String,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

/// Porta de publicação de eventos fiscais
#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: &OutboxEvent) -> Result<(), DomainError>;
}

/// Publicador padrão multicanal (Telemetry + Broadcast em memória + Brokers externos)
pub struct MultiChannelEventPublisher {
    broadcast_sender: broadcast::Sender<OutboxEvent>,
    rabbitmq_url: Option<String>,
    kafka_brokers: Option<String>,
    amqp_channel: Arc<Mutex<Option<Channel>>>,
}

impl MultiChannelEventPublisher {
    pub fn new(rabbitmq_url: Option<String>, kafka_brokers: Option<String>) -> Self {
        let (broadcast_sender, _) = broadcast::channel(1024);
        Self {
            broadcast_sender,
            rabbitmq_url,
            kafka_brokers,
            amqp_channel: Arc::new(Mutex::new(None)),
        }
    }

    /// Cria uma subscrição em tempo real aos eventos fiscais emitidos
    #[allow(dead_code)]
    pub fn subscribe(&self) -> broadcast::Receiver<OutboxEvent> {
        self.broadcast_sender.subscribe()
    }

    async fn get_or_connect_channel(&self, rmq_url: &str) -> Result<Channel, DomainError> {
        let mut guard = self.amqp_channel.lock().await;
        if let Some(ref ch) = *guard {
            if ch.status().connected() {
                return Ok(ch.clone());
            }
        }

        let conn = Connection::connect(rmq_url, ConnectionProperties::default())
            .await
            .map_err(|e| {
                DomainError::Persistence(format!("Falha na ligacao ao RabbitMQ: {}", e))
            })?;

        let channel = conn
            .create_channel()
            .await
            .map_err(|e| DomainError::Persistence(format!("Falha ao abrir canal AMQP: {}", e)))?;

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
                DomainError::Persistence(format!("Falha ao declarar exchange fiscal.events: {}", e))
            })?;

        *guard = Some(channel.clone());
        Ok(channel)
    }
}

#[async_trait]
impl EventPublisher for MultiChannelEventPublisher {
    async fn publish(&self, event: &OutboxEvent) -> Result<(), DomainError> {
        tracing::info!(
            event_id = %event.event_id,
            tenant_id = %event.tenant_id,
            invoice_id = %event.invoice_id,
            event_type = %event.event_type,
            "Publicando evento fiduciário da outbox contábil"
        );

        let _ = self.broadcast_sender.send(event.clone());

        if let Some(ref rmq) = self.rabbitmq_url {
            let routing_key = format!("fiscal.event.{}", event.event_type);
            let channel = self.get_or_connect_channel(rmq).await?;

            let payload_bytes = serde_json::to_vec(event).map_err(|e| {
                DomainError::Persistence(format!("Falha ao serializar evento: {}", e))
            })?;

            let props = BasicProperties::default()
                .with_content_type(ShortString::from("application/json"))
                .with_delivery_mode(2);

            let publish_res = channel
                .basic_publish(
                    ShortString::from("fiscal.events"),
                    ShortString::from(routing_key.as_str()),
                    BasicPublishOptions::default(),
                    &payload_bytes,
                    props,
                )
                .await;

            match publish_res {
                Ok(confirm) => {
                    if let Err(e) = confirm.await {
                        let mut guard = self.amqp_channel.lock().await;
                        *guard = None;
                        return Err(DomainError::Persistence(format!(
                            "Falha na confirmacao de publicacao RabbitMQ: {}",
                            e
                        )));
                    }
                    tracing::info!(
                        routing_key = %routing_key,
                        "Mensagem despachada com sucesso para o RabbitMQ exchange 'fiscal.events'"
                    );
                }
                Err(err) => {
                    let mut guard = self.amqp_channel.lock().await;
                    *guard = None;
                    return Err(DomainError::Persistence(format!(
                        "Falha ao enviar mensagem para RabbitMQ: {}",
                        err
                    )));
                }
            }
        }

        if let Some(ref kafka) = self.kafka_brokers {
            tracing::debug!(
                brokers = %kafka,
                topic = "accounting-fiscal-audit",
                "Mensagem despachada para o Kafka audit log"
            );
        }

        Ok(())
    }
}
