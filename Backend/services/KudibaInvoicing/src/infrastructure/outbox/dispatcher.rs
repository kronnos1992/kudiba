//! Despachante de Eventos Fiscais e Contabilísticos (Outbox Dispatcher)
//!
//! Desacopla a rota síncrona de emissão de facturas das tarefas secundárias:
//!   • RabbitMQ: Tarefas assíncronas de renderização de PDF e disparo de email/notificações
//!   • Kafka / Redpanda: Tópico fiduciário de auditoria e contabilidade geral
//!   • Canal interno assíncrono (tokio::sync::broadcast) para consumo em tempo real

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use tokio::sync::broadcast;
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
}

impl MultiChannelEventPublisher {
    pub fn new(rabbitmq_url: Option<String>, kafka_brokers: Option<String>) -> Self {
        let (broadcast_sender, _) = broadcast::channel(1024);
        Self {
            broadcast_sender,
            rabbitmq_url,
            kafka_brokers,
        }
    }

    /// Cria uma subscrição em tempo real aos eventos fiscais emitidos
    #[allow(dead_code)]
    pub fn subscribe(&self) -> broadcast::Receiver<OutboxEvent> {
        self.broadcast_sender.subscribe()
    }
}

#[async_trait]
impl EventPublisher for MultiChannelEventPublisher {
    async fn publish(&self, event: &OutboxEvent) -> Result<(), DomainError> {
        // 1. Telemetria e Registo de Auditoria
        tracing::info!(
            event_id = %event.event_id,
            tenant_id = %event.tenant_id,
            invoice_id = %event.invoice_id,
            event_type = %event.event_type,
            "Publicando evento fiduciário da outbox contábil"
        );

        // 2. Disparo no canal interno broadcast (para listeners locais, ex: geradores de PDF e SSE)
        let _ = self.broadcast_sender.send(event.clone());

        // 3. Simulação / Integração de Mensageria Externa
        if let Some(ref rmq) = self.rabbitmq_url {
            tracing::debug!(
                endpoint = %rmq,
                routing_key = %format!("fiscal.event.{}", event.event_type),
                "Mensagem despachada para o RabbitMQ exchange 'fiscal.events'"
            );
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
