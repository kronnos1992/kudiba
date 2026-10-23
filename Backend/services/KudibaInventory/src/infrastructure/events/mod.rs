use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    types::{AMQPValue, FieldTable, ShortString},
    BasicProperties, Connection, ConnectionProperties, ExchangeKind,
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
            let command = self.command.clone();
            let mut amqp_shutdown_rx = shutdown_rx.clone();

            tokio::spawn(async move {
                Self::run_rabbitmq_listener(rmq_url, command, &mut amqp_shutdown_rx).await;
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
                            let result = crate::config::with_tenant_context(
                                Some(tenant_id),
                                self.command.execute(tenant_id, Uuid::nil(), event),
                            )
                            .await;
                            match result {
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
        command: Arc<ProcessInvoiceIssuedCommand>,
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

            Self::declare_dlq(&channel).await;

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
                    ShortString::from("fiscal.event.#"),
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
                                let routing_key = delivery.routing_key.to_string();
                                let correlation_id = delivery
                                    .properties
                                    .correlation_id()
                                    .as_ref()
                                    .map(|v| v.as_str().to_string())
                                    .unwrap_or_default();
                                match Self::parse_invoice_event(&delivery.data) {
                                    Ok(payload) => {
                                        let document = payload.document_number.clone();
                                        let tenant_id = payload.tenant_id;
                                        let result = crate::config::with_tenant_context(
                                            Some(tenant_id),
                                            command.execute(tenant_id, Uuid::nil(), payload),
                                        )
                                        .await;
                                        match result {
                                            Ok(res) => {
                                                tracing::info!(
                                                    correlation_id = %correlation_id,
                                                    document = %res.document_number,
                                                    movements = res.movements_recorded,
                                                    skipped_intangible = res.items_skipped_intangible,
                                                    "Evento de faturação processado com sucesso"
                                                );
                                                if let Err(err) = delivery.ack(BasicAckOptions::default()).await {
                                                    tracing::warn!(error = %err, "Falha ao confirmar (ack) mensagem AMQP");
                                                }
                                            }
                                            Err(err) => {
                                                tracing::error!(
                                                    correlation_id = %correlation_id,
                                                    document = %document,
                                                    error = %err,
                                                    "Falha ao processar evento de faturação; encaminhando para DLQ"
                                                );
                                                Self::handle_failure(&channel, &delivery, &routing_key, &err.to_string()).await;
                                            }
                                        }
                                    }
                                    Err(err) => {
                                        tracing::error!(
                                            correlation_id = %correlation_id,
                                            error = %err,
                                            "Payload de evento fiscal inválido; encaminhando para DLQ"
                                        );
                                        Self::handle_failure(&channel, &delivery, &routing_key, &err.to_string()).await;
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

    async fn handle_failure(
        channel: &lapin::Channel,
        delivery: &lapin::message::Delivery,
        routing_key: &str,
        error: &str,
    ) {
        match Self::publish_to_dlq(channel, &delivery.data, routing_key, error).await {
            Ok(()) => {
                if let Err(err) = delivery.ack(BasicAckOptions::default()).await {
                    tracing::warn!(error = %err, "Falha ao confirmar mensagem encaminhada para DLQ");
                }
            }
            Err(err) => {
                tracing::error!(error = %err, "Falha ao publicar na DLQ; mensagem será reenfileirada");
                let _ = delivery
                    .nack(BasicNackOptions {
                        requeue: true,
                        multiple: false,
                    })
                    .await;
            }
        }
    }

    async fn declare_dlq(channel: &lapin::Channel) {
        if let Err(err) = channel
            .exchange_declare(
                ShortString::from("fiscal.events.dlx"),
                ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
        {
            tracing::warn!(error = %err, "Falha ao declarar exchange de dead-letter 'fiscal.events.dlx'");
            return;
        }

        if let Err(err) = channel
            .queue_declare(
                ShortString::from("fiscal.events.dlq"),
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
        {
            tracing::warn!(error = %err, "Falha ao declarar fila de dead-letter 'fiscal.events.dlq'");
            return;
        }

        if let Err(err) = channel
            .queue_bind(
                ShortString::from("fiscal.events.dlq"),
                ShortString::from("fiscal.events.dlx"),
                ShortString::from("#"),
                QueueBindOptions::default(),
                FieldTable::default(),
            )
            .await
        {
            tracing::warn!(error = %err, "Falha ao associar fila de dead-letter 'fiscal.events.dlq'");
        }
    }

    async fn publish_to_dlq(
        channel: &lapin::Channel,
        data: &[u8],
        routing_key: &str,
        error: &str,
    ) -> Result<(), lapin::Error> {
        let mut headers = FieldTable::default();
        headers.insert(
            ShortString::from("x-error"),
            AMQPValue::LongString(error.to_string().into()),
        );
        headers.insert(
            ShortString::from("x-original-routing-key"),
            AMQPValue::LongString(routing_key.to_string().into()),
        );
        headers.insert(
            ShortString::from("x-original-queue"),
            AMQPValue::LongString("inventory.invoice_issued".into()),
        );
        headers.insert(
            ShortString::from("x-compensation-hint"),
            AMQPValue::LongString(
                "Documento fiscal certificado: emitir Nota de Crédito (NC) ou ajuste de inventário assistido; não apagar a fatura."
                    .into(),
            ),
        );

        let properties = BasicProperties::default()
            .with_content_type(ShortString::from("application/json"))
            .with_headers(headers);

        channel
            .basic_publish(
                ShortString::from("fiscal.events.dlx"),
                ShortString::from("fiscal.event.failed"),
                BasicPublishOptions::default(),
                data,
                properties,
            )
            .await?;

        Ok(())
    }

    pub fn parse_invoice_event(data: &[u8]) -> Result<InvoiceIssuedPayload, InventoryError> {
        if let Ok(payload) = serde_json::from_slice::<InvoiceIssuedPayload>(data) {
            if !payload.document_number.is_empty() {
                return Ok(payload);
            }
        }

        if let Ok(mut val) = serde_json::from_slice::<serde_json::Value>(data) {
            let outer_tenant = val
                .get("tenant_id")
                .or_else(|| val.get("tenantId"))
                .cloned();
            let outer_invoice = val
                .get("invoice_id")
                .or_else(|| val.get("invoiceId"))
                .cloned();

            if let Some(inner) = val.get_mut("payload") {
                if let Some(inner_obj) = inner.as_object_mut() {
                    if !inner_obj.contains_key("tenantId") && !inner_obj.contains_key("tenant_id") {
                        if let Some(t) = outer_tenant {
                            inner_obj.insert("tenantId".to_string(), t);
                        }
                    }
                    if !inner_obj.contains_key("invoiceId") && !inner_obj.contains_key("invoice_id")
                    {
                        if let Some(i) = outer_invoice {
                            inner_obj.insert("invoiceId".to_string(), i);
                        }
                    }
                }
                if let Ok(payload) = serde_json::from_value::<InvoiceIssuedPayload>(inner.clone()) {
                    if !payload.document_number.is_empty() {
                        return Ok(payload);
                    }
                }
            }
        }

        Err(InventoryError::ValidationError(
            "Payload do evento fiscal inválido ou ausente".to_string(),
        ))
    }
}
