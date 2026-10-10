//! Background Worker / Poller da Transactional Outbox
//!
//! Lê eventos pendentes da tabela `kudiba_core.accounting_outbox`,
//! despacha-os para o `EventPublisher` (RabbitMQ, Kafka, Telemetria)
//! e atualiza atomicamente o timestamp `published_at`.

use std::sync::Arc;
use std::time::Duration;

use sqlx::Row;
use tokio::sync::watch;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::infrastructure::outbox::dispatcher::{EventPublisher, OutboxEvent};

pub struct OutboxWorker {
    session_factory: Arc<dyn DbSessionFactory>,
    publisher: Arc<dyn EventPublisher>,
    poll_interval: Duration,
    batch_size: i64,
}

impl OutboxWorker {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        publisher: Arc<dyn EventPublisher>,
        poll_interval: Duration,
        batch_size: i64,
    ) -> Self {
        Self {
            session_factory,
            publisher,
            poll_interval,
            batch_size,
        }
    }

    /// Executa uma iteração de leitura e despacho de eventos pendentes
    pub async fn process_batch(&self) -> Result<usize, DomainError> {
        let mut session = match self.session_factory.open().await {
            Ok(s) => s,
            Err(e) => return Err(DomainError::Persistence(e.to_string())),
        };

        // 1. Obter lote de eventos não publicados
        let rows = sqlx::query(
            "SELECT event_id, tenant_id, invoice_id, event_type, payload::text AS payload_text, created_at \
             FROM kudiba_core.accounting_outbox \
             WHERE published_at IS NULL \
             ORDER BY created_at ASC \
             LIMIT $1",
        )
        .bind(self.batch_size)
        .fetch_all(session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        if rows.is_empty() {
            return Ok(0);
        }

        let mut published_count = 0;
        let mut processed_ids: Vec<Uuid> = Vec::with_capacity(rows.len());

        for row in rows {
            let event_id: Uuid = row
                .try_get("event_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let tenant_id: Uuid = row
                .try_get("tenant_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let invoice_id: Uuid = row
                .try_get("invoice_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let event_type: String = row
                .try_get("event_type")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let payload_text: String = row
                .try_get("payload_text")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let payload: serde_json::Value = serde_json::from_str(&payload_text)
                .unwrap_or_else(|_| serde_json::Value::Null);
            let created_at: chrono::DateTime<chrono::Utc> = row
                .try_get("created_at")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;

            let event = OutboxEvent {
                event_id,
                tenant_id,
                invoice_id,
                event_type,
                payload,
                created_at,
            };

            // 2. Publicar evento
            match self.publisher.publish(&event).await {
                Ok(_) => {
                    processed_ids.push(event_id);
                    published_count += 1;
                }
                Err(err) => {
                    tracing::error!(
                        event_id = %event_id,
                        error = %err,
                        "Falha ao publicar evento da outbox; será tentado na próxima iteração"
                    );
                }
            }
        }

        // 3. Marcar eventos publicados na base de dados
        if !processed_ids.is_empty() {
            let mut update_session = match self.session_factory.open().await {
                Ok(s) => s,
                Err(e) => return Err(DomainError::Persistence(e.to_string())),
            };

            for id in processed_ids {
                let _ = sqlx::query(
                    "UPDATE kudiba_core.accounting_outbox \
                     SET published_at = NOW() \
                     WHERE event_id = $1",
                )
                .bind(id)
                .execute(update_session.connection())
                .await;
            }
        }

        Ok(published_count)
    }

    /// Ciclo assíncrono contínuo com encerramento gracioso
    pub async fn run_loop(&self, mut shutdown: watch::Receiver<bool>) {
        tracing::info!(
            interval_ms = self.poll_interval.as_millis(),
            batch_size = self.batch_size,
            "Outbox Worker iniciado em segundo plano"
        );

        while !*shutdown.borrow() {
            match self.process_batch().await {
                Ok(count) => {
                    if count > 0 {
                        tracing::debug!(count, "Eventos da outbox despachados com sucesso");
                    }
                }
                Err(err) => {
                    tracing::warn!(error = %err, "Erro temporário ao processar outbox contábil");
                }
            }

            tokio::select! {
                _ = tokio::time::sleep(self.poll_interval) => {},
                _ = shutdown.changed() => {
                    break;
                }
            }
        }

        tracing::info!("Outbox Worker encerrado graciosamente.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::outbox::dispatcher::MultiChannelEventPublisher;

    #[tokio::test]
    async fn publicador_despacha_evento_para_subscritores_em_tempo_real() {
        let publisher = MultiChannelEventPublisher::new(None, None);
        let mut rx = publisher.subscribe();

        let event = OutboxEvent {
            event_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            invoice_id: Uuid::new_v4(),
            event_type: "fiscal.document.issued".to_string(),
            payload: serde_json::json!({ "documentNumber": "FT TEST/001" }),
            created_at: chrono::Utc::now(),
        };

        publisher.publish(&event).await.expect("publicação com sucesso");

        let received = rx.recv().await.expect("recepção de evento no canal");
        assert_eq!(received.event_id, event.event_id);
        assert_eq!(received.event_type, "fiscal.document.issued");
        assert_eq!(received.payload["documentNumber"], "FT TEST/001");
    }
}
