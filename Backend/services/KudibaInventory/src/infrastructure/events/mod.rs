use std::sync::Arc;
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::application::commands::ProcessInvoiceIssuedCommand;
use crate::application::dto::{InvoiceIssuedPayload, ProcessInvoiceIssuedResult};
use crate::domain::error::InventoryError;

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
}
