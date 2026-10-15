use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, ExchangeDeclareOptions,
        QueueBindOptions, QueueDeclareOptions,
    },
    types::{FieldTable, ShortString},
    Connection, ConnectionProperties, ExchangeKind,
};
use std::sync::Arc;
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::application::commands::ProcessInvoiceIssuedCommand;
use crate::application::dto::{InvoiceIssuedPayload, ProcessInvoiceIssuedResult};
use crate::domain::error::InventoryError;

pub mod publisher;
pub use publisher::MultiChannelInventoryEventPublisher;

pub struct InvoiceEventConsumer {
    command: Arc<ProcessInvoiceIssuedCommand>,
    rabbitmq_url: Option<String>,
    sender: mpsc::Sender<InvoiceIssuedPayload>,
    receiver: Mutex<mpsc::Receiver<InvoiceIssuedPayload>>,
}

impl InvoiceEventConsumer {
    pub fn new(command: Arc<ProcessInvoiceIssuedCommand>, rabbitmq_url: Option<String>) -> Self {
        let (sender, receiver) = mpsc::channel(1024);
        Self {
            command,
            rabbitmq_url,
            sender,
            receiver: Mutex::new(receiver),
        }
    }

    pub fn sender(&self) -> mpsc::Sender<InvoiceIssuedPayload> {
        self.sender.clone()
    }

    pub async fn dispatch(&self, event: InvoiceIssuedPayload) -> Result<(), InventoryError> {
        self.sender.send(event).await.map_err(|e| {
            InventoryError::ValidationError(format!(
                "Canal de eventos cheio ou indisponível: {}",
                e
            ))
        })
    }

    pub async fn process_direct(
        &self,
        event: InvoiceIssuedPayload,
    ) -> Result<ProcessInvoiceIssuedResult, InventoryError> {
        self.command
            .execute(event.tenant_id, Uuid::nil(), event)
            .await
    }

    pub async fn run_loop(&self, mut shutdown_rx: watch::Receiver<bool>) {
        if let Some(ref rmq) = self.rabbitmq_url {
            tracing::info!(
                endpoint = %rmq,
                exchange = "fiscal.events",
                queue = "inventory.invoice_issued",
                "Consumidor de eventos fiscais configurado para RabbitMQ"
            );

            let rmq_url = rmq.clone();
            let amqp_sender = self.sender.clone();
            let mut amqp_shutdown_rx = shutdown_rx.clone();

            tokio::spawn(async move {
                Self::run_rabbitmq_listener(rmq_url, amqp_sender, &mut amqp_shutdown_rx).await;
            });
        } else {
            tracing::info!("Consumidor assíncrono de eventos fiscais iniciado no canal em memória");
        }

        loop {
            tokio::select! {
                Ok(()) = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        tracing::info!("Consumidor de eventos fiscais a encerrar graciosamente...");
                        break;
                    }
                }
                event_opt = async {
                    let mut rx = self.receiver.lock().await;
                    rx.recv().await
                } => {
                    match event_opt {
                        Some(event) => {
                            let tenant_id = event.tenant_id;
                            let doc_num = event.document_number.clone();
                            match self.command.execute(tenant_id, Uuid::nil(), event).await {
                                Ok(res) => {
                                    tracing::info!(
                                        document = %res.document_number,
                                        movements = res.movements_recorded,
                                        skipped_intangible = res.items_skipped_intangible,
                                        "Evento de faturação processado com sucesso"
                                    );
                                }
                                Err(err) => {
                                    tracing::error!(
                                        document = %doc_num,
                                        error = %err,
                                        "Falha ao processar evento de faturação para baixa de stock"
                                    );
                                }
                            }
                        }
                        None => {
                            tracing::info!("Canal de eventos de faturação terminado.");
                            break;
                        }
                    }
                }
            }
        }
    }

    async fn run_rabbitmq_listener(
        rmq_url: String,
        sender: mpsc::Sender<InvoiceIssuedPayload>,
        shutdown_rx: &mut watch::Receiver<bool>,
    ) {
        loop {
            if *shutdown_rx.borrow() {
                break;
            }

            tracing::info!(endpoint = %rmq_url, "Conectando ao RabbitMQ...");
            let conn = match Connection::connect(&rmq_url, ConnectionProperties::default()).await {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!(error = %e, "Falha ao conectar ao RabbitMQ; nova tentativa em 5s");
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                        _ = shutdown_rx.changed() => break,
                    }
                }
            };

            let channel = match conn.create_channel().await {
                Ok(ch) => ch,
                Err(e) => {
                    tracing::warn!(error = %e, "Falha ao abrir canal AMQP; nova tentativa em 5s");
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                        _ = shutdown_rx.changed() => break,
                    }
                }
            };

            if let Err(e) = channel
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
            {
                tracing::warn!(error = %e, "Falha ao declarar exchange 'fiscal.events'");
                tokio::select! {
                    _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                    _ = shutdown_rx.changed() => break,
                }
            }

            let queue = match channel
                .queue_declare(
                    ShortString::from("inventory.invoice_issued"),
                    QueueDeclareOptions {
                        durable: true,
                        ..Default::default()
                    },
                    FieldTable::default(),
                )
                .await
            {
                Ok(q) => q,
                Err(e) => {
                    tracing::warn!(error = %e, "Falha ao declarar fila 'inventory.invoice_issued'");
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                        _ = shutdown_rx.changed() => break,
                    }
                }
            };

            if let Err(e) = channel
                .queue_bind(
                    queue.name().clone(),
                    ShortString::from("fiscal.events"),
                    ShortString::from("fiscal.event.*"),
                    QueueBindOptions::default(),
                    FieldTable::default(),
                )
                .await
            {
                tracing::warn!(error = %e, "Falha ao associar fila à exchange 'fiscal.events'");
                tokio::select! {
                    _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                    _ = shutdown_rx.changed() => break,
                }
            }

            let mut consumer = match channel
                .basic_consume(
                    queue.name().clone(),
                    ShortString::from("inventory_invoice_issued_consumer"),
                    BasicConsumeOptions::default(),
                    FieldTable::default(),
                )
                .await
            {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!(error = %e, "Falha ao iniciar consumidor AMQP");
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => continue,
                        _ = shutdown_rx.changed() => break,
                    }
                }
            };

            tracing::info!("Consumidor RabbitMQ activo na fila 'inventory.invoice_issued'");

            loop {
                tokio::select! {
                    Ok(()) = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            tracing::info!("Encerrando consumidor RabbitMQ...");
                            return;
                        }
                    }
                    delivery_opt = consumer.next() => {
                        match delivery_opt {
                            Some(Ok(delivery)) => {
                                match Self::parse_invoice_event(&delivery.data) {
                                    Ok(payload) => {
                                        if let Err(err) = sender.send(payload).await {
                                            tracing::error!(error = %err, "Canal interno cheio; reenfileirando mensagem");
                                            let _ = delivery.nack(BasicNackOptions { requeue: true, multiple: false }).await;
                                        } else {
                                            let _ = delivery.ack(BasicAckOptions::default()).await;
                                        }
                                    }
                                    Err(err) => {
                                        tracing::error!(error = %err, "Mensagem descartada por payload incompatível");
                                        let _ = delivery.ack(BasicAckOptions::default()).await;
                                    }
                                }
                            }
                            Some(Err(err)) => {
                                tracing::warn!(error = %err, "Erro no stream RabbitMQ; reconectando em 5s...");
                                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                                break;
                            }
                            None => {
                                tracing::warn!("Stream AMQP fechado; reconectando em 5s...");
                                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn parse_invoice_event(data: &[u8]) -> Result<InvoiceIssuedPayload, InventoryError> {
        if let Ok(payload) = serde_json::from_slice::<InvoiceIssuedPayload>(data) {
            if !payload.document_number.is_empty() {
                return Ok(payload);
            }
        }

        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(data) {
            if let Some(inner) = val.get("payload") {
                if let Ok(payload) = serde_json::from_value::<InvoiceIssuedPayload>(inner.clone()) {
                    return Ok(payload);
                }
            }
        }

        Err(InventoryError::ValidationError(
            "Payload do evento fiscal inválido ou ausente".to_string(),
        ))
    }
}
