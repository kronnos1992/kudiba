use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, ExchangeDeclareOptions, QueueBindOptions,
        QueueDeclareOptions,
    },
    types::{FieldTable, ShortString},
    Connection, ConnectionProperties, ExchangeKind,
};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::domain::error::DomainError;

pub mod publisher;

pub use publisher::{MultiChannelTreasuryEventPublisher, NoopTreasuryEventPublisher};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoicePaymentEvent {
    pub invoice_id: Uuid,
    pub tenant_id: Uuid,
    pub document_number: String,
    pub document_type: String,
    pub payment_mechanism: Option<String>,
    pub gross_total: rust_decimal::Decimal,
}

pub struct TreasuryEventConsumer {
    rabbitmq_url: Option<String>,
    sender: mpsc::Sender<InvoicePaymentEvent>,
    receiver: Mutex<mpsc::Receiver<InvoicePaymentEvent>>,
}

impl TreasuryEventConsumer {
    pub fn new(rabbitmq_url: Option<String>) -> Self {
        let (sender, receiver) = mpsc::channel(1024);
        Self {
            rabbitmq_url,
            sender,
            receiver: Mutex::new(receiver),
        }
    }

    pub fn sender(&self) -> mpsc::Sender<InvoicePaymentEvent> {
        self.sender.clone()
    }

    pub async fn dispatch(&self, event: InvoicePaymentEvent) -> Result<(), DomainError> {
        self.sender.send(event).await.map_err(|e| {
            DomainError::ValidationError(format!("Canal de eventos cheio ou indisponível: {}", e))
        })
    }

    pub async fn run_loop(&self, mut shutdown_rx: watch::Receiver<bool>) {
        if let Some(ref rmq) = self.rabbitmq_url {
            tracing::info!(
                endpoint = %rmq,
                exchange = "fiscal.events",
                queue = "treasury.invoice_issued",
                "Consumidor AMQP de tesouraria configurado para RabbitMQ"
            );

            let rmq_url = rmq.clone();
            let amqp_sender = self.sender.clone();
            let mut amqp_shutdown_rx = shutdown_rx.clone();

            tokio::spawn(async move {
                Self::run_rabbitmq_listener(rmq_url, amqp_sender, &mut amqp_shutdown_rx).await;
            });
        }

        loop {
            tokio::select! {
                Ok(()) = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        tracing::info!("Consumidor de eventos de tesouraria a encerrar...");
                        break;
                    }
                }
                event_opt = async {
                    let mut rx = self.receiver.lock().await;
                    rx.recv().await
                } => {
                    match event_opt {
                        Some(event) => {
                            tracing::info!(
                                document = %event.document_number,
                                total = %event.gross_total,
                                "Evento fiscal recebido na tesouraria"
                            );
                        }
                        None => break,
                    }
                }
            }
        }
    }

    pub fn parse_incoming_invoice(data: &[u8]) -> Option<InvoicePaymentEvent> {
        if let Ok(event) = serde_json::from_slice::<InvoicePaymentEvent>(data) {
            if !event.document_number.is_empty() {
                return Some(event);
            }
        }

        let val = serde_json::from_slice::<serde_json::Value>(data).ok()?;
        let payload = val.get("payload").unwrap_or(&val);

        let invoice_id = val
            .get("invoice_id")
            .or_else(|| val.get("invoiceId"))
            .or_else(|| payload.get("invoice_id"))
            .or_else(|| payload.get("invoiceId"))
            .or_else(|| payload.get("id"))
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_else(Uuid::new_v4);

        let tenant_id = val
            .get("tenant_id")
            .or_else(|| val.get("tenantId"))
            .or_else(|| payload.get("tenant_id"))
            .or_else(|| payload.get("tenantId"))
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_default();

        let document_number = payload
            .get("documentNumber")
            .or_else(|| payload.get("document_number"))
            .and_then(|v| v.as_str())?
            .to_string();

        let document_type = payload
            .get("documentType")
            .or_else(|| payload.get("document_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("FT")
            .to_string();

        let payment_mechanism = payload
            .get("paymentMechanism")
            .or_else(|| payload.get("payment_mechanism"))
            .or_else(|| payload.get("paymentMethods"))
            .or_else(|| payload.get("payment_methods"))
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if let Some(arr) = v.as_array() {
                    arr.first()
                        .and_then(|item| item.as_str().map(|s| s.to_string()))
                } else {
                    None
                }
            });

        let gross_total = payload
            .get("grossTotal")
            .or_else(|| payload.get("gross_total"))
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    rust_decimal::Decimal::from_str_exact(s).ok()
                } else if let Some(n) = v.as_f64() {
                    rust_decimal::Decimal::try_from(n).ok()
                } else {
                    None
                }
            })
            .unwrap_or(rust_decimal::Decimal::ZERO);

        Some(InvoicePaymentEvent {
            invoice_id,
            tenant_id,
            document_number,
            document_type,
            payment_mechanism,
            gross_total,
        })
    }

    async fn run_rabbitmq_listener(
        rabbitmq_url: String,
        sender: mpsc::Sender<InvoicePaymentEvent>,
        shutdown_rx: &mut watch::Receiver<bool>,
    ) {
        let exchange_name = ShortString::from("fiscal.events");
        let queue_name = ShortString::from("treasury.invoice_issued");
        let routing_key = ShortString::from("fiscal.event.#");

        loop {
            if *shutdown_rx.borrow() {
                break;
            }

            match Connection::connect(&rabbitmq_url, ConnectionProperties::default()).await {
                Ok(conn) => {
                    tracing::info!("Ligação AMQP de tesouraria estabelecida");
                    if let Ok(channel) = conn.create_channel().await {
                        let _ = channel
                            .exchange_declare(
                                exchange_name.clone(),
                                ExchangeKind::Topic,
                                ExchangeDeclareOptions {
                                    durable: true,
                                    ..Default::default()
                                },
                                FieldTable::default(),
                            )
                            .await;

                        let _ = channel
                            .queue_declare(
                                queue_name.clone(),
                                QueueDeclareOptions {
                                    durable: true,
                                    ..Default::default()
                                },
                                FieldTable::default(),
                            )
                            .await;

                        let _ = channel
                            .queue_bind(
                                queue_name.clone(),
                                exchange_name.clone(),
                                routing_key.clone(),
                                QueueBindOptions::default(),
                                FieldTable::default(),
                            )
                            .await;

                        let mut consumer = match channel
                            .basic_consume(
                                queue_name.clone(),
                                ShortString::from("kudiba_treasury_consumer"),
                                BasicConsumeOptions::default(),
                                FieldTable::default(),
                            )
                            .await
                        {
                            Ok(c) => c,
                            Err(e) => {
                                tracing::warn!("Erro ao criar subscrição AMQP: {}", e);
                                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                                continue;
                            }
                        };

                        loop {
                            tokio::select! {
                                Ok(()) = shutdown_rx.changed() => {
                                    if *shutdown_rx.borrow() {
                                        break;
                                    }
                                }
                                delivery_opt = consumer.next() => {
                                    match delivery_opt {
                                        Some(Ok(delivery)) => {
                                            if let Some(event) = Self::parse_incoming_invoice(&delivery.data) {
                                                let _ = sender.send(event).await;
                                            }
                                            let _ = delivery.ack(BasicAckOptions::default()).await;
                                        }
                                        Some(Err(err)) => {
                                            tracing::warn!("Erro no stream AMQP: {}", err);
                                            break;
                                        }
                                        None => break,
                                    }
                                }
                            }
                        }
                    }
                }
                Err(err) => {
                    tracing::debug!("Aguardando broker RabbitMQ ({})...", err);
                    tokio::select! {
                        Ok(()) = shutdown_rx.changed() => {
                            if *shutdown_rx.borrow() { break; }
                        }
                        _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => {}
                    }
                }
            }
        }
    }
}
