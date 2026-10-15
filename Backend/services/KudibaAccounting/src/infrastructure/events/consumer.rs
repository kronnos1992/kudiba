use chrono::NaiveDate;
use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, ExchangeDeclareOptions, QueueBindOptions,
        QueueDeclareOptions,
    },
    types::{FieldTable, ShortString},
    Connection, ConnectionProperties, ExchangeKind,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::application::commands::{
    ProcessInvoiceIssuedCommand, ProcessStockDispatchCommand, ProcessTreasuryReceiptCommand,
};
use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AccountingEvent {
    InvoiceIssued {
        event_id: Uuid,
        tenant_id: Uuid,
        doc_type: String,
        doc_number: String,
        customer_name: String,
        issue_date: NaiveDate,
        net_total: Decimal,
        tax_total: Decimal,
        retention_total: Decimal,
        gross_total: Decimal,
    },
    StockDispatch {
        event_id: Uuid,
        tenant_id: Uuid,
        doc_ref: String,
        movement_date: NaiveDate,
        cmp_total_cost: Decimal,
    },
    TreasuryReceipt {
        event_id: Uuid,
        tenant_id: Uuid,
        receipt_number: String,
        customer_name: String,
        receipt_date: NaiveDate,
        amount: Decimal,
        is_bank: bool,
    },
}

pub struct AccountingEventConsumer {
    rabbitmq_url: Option<String>,
    sender: mpsc::Sender<AccountingEvent>,
    receiver: Mutex<mpsc::Receiver<AccountingEvent>>,
    invoice_cmd: Option<Arc<ProcessInvoiceIssuedCommand>>,
    stock_cmd: Option<Arc<ProcessStockDispatchCommand>>,
    receipt_cmd: Option<Arc<ProcessTreasuryReceiptCommand>>,
}

impl AccountingEventConsumer {
    pub fn new(
        rabbitmq_url: Option<String>,
        invoice_cmd: Option<Arc<ProcessInvoiceIssuedCommand>>,
        stock_cmd: Option<Arc<ProcessStockDispatchCommand>>,
        receipt_cmd: Option<Arc<ProcessTreasuryReceiptCommand>>,
    ) -> Self {
        let (sender, receiver) = mpsc::channel(1024);
        Self {
            rabbitmq_url,
            sender,
            receiver: Mutex::new(receiver),
            invoice_cmd,
            stock_cmd,
            receipt_cmd,
        }
    }

    pub fn parse_incoming_event(data: &[u8]) -> Option<AccountingEvent> {
        if let Ok(event) = serde_json::from_slice::<AccountingEvent>(data) {
            return Some(event);
        }

        let v: serde_json::Value = serde_json::from_slice(data).ok()?;
        let event_type = v.get("event_type").and_then(|s| s.as_str())?;
        let event_id = v
            .get("event_id")
            .and_then(|id| id.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_else(Uuid::new_v4);
        let tenant_id = v
            .get("tenant_id")
            .and_then(|id| id.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())?;

        let payload = v.get("payload").unwrap_or(&serde_json::Value::Null);

        match event_type {
            "fiscal.document.issued" | "invoice.issued" => {
                let doc_type = payload
                    .get("documentType")
                    .or_else(|| payload.get("document_type"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("FT")
                    .to_string();

                let doc_number = payload
                    .get("documentNumber")
                    .or_else(|| payload.get("document_number"))
                    .and_then(|s| s.as_str())?
                    .to_string();

                let customer_name = payload
                    .get("customerName")
                    .or_else(|| payload.get("customer_name"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("Consumidor Final")
                    .to_string();

                let issue_date = payload
                    .get("issuedAt")
                    .or_else(|| payload.get("issued_at"))
                    .and_then(|s| s.as_str())
                    .map(parse_date_str)
                    .unwrap_or_else(|| chrono::Utc::now().date_naive());

                let net_total = payload
                    .get("netTotal")
                    .or_else(|| payload.get("net_total"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let tax_total = payload
                    .get("taxTotal")
                    .or_else(|| payload.get("tax_total"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let retention_total = payload
                    .get("withholdingTotal")
                    .or_else(|| payload.get("withholding_total"))
                    .or_else(|| payload.get("retention_total"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let gross_total = payload
                    .get("grossTotal")
                    .or_else(|| payload.get("gross_total"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                Some(AccountingEvent::InvoiceIssued {
                    event_id,
                    tenant_id,
                    doc_type,
                    doc_number,
                    customer_name,
                    issue_date,
                    net_total,
                    tax_total,
                    retention_total,
                    gross_total,
                })
            }
            "inventory.stock_movement.dispatched"
            | "stock.movement.dispatched"
            | "inventory.stock_dispatch" => {
                let doc_ref = payload
                    .get("documentRef")
                    .or_else(|| payload.get("doc_ref"))
                    .and_then(|s| s.as_str())?
                    .to_string();

                let movement_date = payload
                    .get("movementDate")
                    .or_else(|| payload.get("movement_date"))
                    .and_then(|s| s.as_str())
                    .map(parse_date_str)
                    .unwrap_or_else(|| chrono::Utc::now().date_naive());

                let cmp_total_cost = payload
                    .get("cmpTotalCost")
                    .or_else(|| payload.get("cmp_total_cost"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                Some(AccountingEvent::StockDispatch {
                    event_id,
                    tenant_id,
                    doc_ref,
                    movement_date,
                    cmp_total_cost,
                })
            }
            "treasury.receipt.issued" | "receipt.issued" => {
                let receipt_number = payload
                    .get("receiptNumber")
                    .or_else(|| payload.get("receipt_number"))
                    .and_then(|s| s.as_str())?
                    .to_string();

                let customer_name = payload
                    .get("customerName")
                    .or_else(|| payload.get("customer_name"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("Cliente")
                    .to_string();

                let receipt_date = payload
                    .get("receiptDate")
                    .or_else(|| payload.get("receipt_date"))
                    .and_then(|s| s.as_str())
                    .map(parse_date_str)
                    .unwrap_or_else(|| chrono::Utc::now().date_naive());

                let amount = payload
                    .get("amount")
                    .or_else(|| payload.get("grossTotal"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let is_bank = payload
                    .get("isBank")
                    .or_else(|| payload.get("is_bank"))
                    .and_then(|b| b.as_bool())
                    .unwrap_or(false);

                Some(AccountingEvent::TreasuryReceipt {
                    event_id,
                    tenant_id,
                    receipt_number,
                    customer_name,
                    receipt_date,
                    amount,
                    is_bank,
                })
            }
            _ => None,
        }
    }

    pub fn sender(&self) -> mpsc::Sender<AccountingEvent> {
        self.sender.clone()
    }

    pub async fn dispatch(&self, event: AccountingEvent) -> Result<(), DomainError> {
        self.sender.send(event).await.map_err(|e| {
            DomainError::ValidationError(format!("Canal de eventos cheio ou indisponível: {}", e))
        })
    }

    pub async fn run_loop(&self, mut shutdown_rx: watch::Receiver<bool>) {
        if let Some(ref rmq) = self.rabbitmq_url {
            tracing::info!(
                endpoint = %rmq,
                exchange = "fiscal.events",
                queue = "accounting.general_ledger",
                "Consumidor AMQP de contabilidade configurado para RabbitMQ"
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
                biased;
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        tracing::info!("Consumidor de contabilidade recebendo sinal de paragem.");
                        break;
                    }
                }
                event_opt = async {
                    let mut rx = self.receiver.lock().await;
                    rx.recv().await
                } => {
                    match event_opt {
                        Some(event) => {
                            self.process_event(event).await;
                        }
                        None => {
                            tracing::info!("Canal interno de eventos fechado.");
                            break;
                        }
                    }
                }
            }
        }
    }

    async fn process_event(&self, event: AccountingEvent) {
        match event {
            AccountingEvent::InvoiceIssued {
                event_id,
                tenant_id,
                doc_type,
                doc_number,
                customer_name,
                issue_date,
                net_total,
                tax_total,
                retention_total,
                gross_total,
            } => {
                if let Some(ref cmd) = self.invoice_cmd {
                    match cmd
                        .execute(
                            event_id,
                            tenant_id,
                            &doc_type,
                            &doc_number,
                            &customer_name,
                            issue_date,
                            net_total,
                            tax_total,
                            retention_total,
                            gross_total,
                        )
                        .await
                    {
                        Ok(Some(entry)) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                doc_number = %doc_number,
                                "Lançamento contabilístico automático gerado com sucesso para fatura"
                            );
                        }
                        Ok(None) => {
                            tracing::debug!(event_id = %event_id, "Evento de fatura já processado anteriormente (idempotência)");
                        }
                        Err(e) => {
                            tracing::error!(error = %e, doc_number = %doc_number, "Falha ao gerar lançamento para fatura");
                        }
                    }
                }
            }
            AccountingEvent::StockDispatch {
                event_id,
                tenant_id,
                doc_ref,
                movement_date,
                cmp_total_cost,
            } => {
                if let Some(ref cmd) = self.stock_cmd {
                    match cmd
                        .execute(event_id, tenant_id, &doc_ref, movement_date, cmp_total_cost)
                        .await
                    {
                        Ok(Some(entry)) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                doc_ref = %doc_ref,
                                "Lançamento de CMVMC gerado com sucesso para saída de stock"
                            );
                        }
                        Ok(None) => {
                            tracing::debug!(event_id = %event_id, "Evento de stock já processado anteriormente");
                        }
                        Err(e) => {
                            tracing::error!(error = %e, doc_ref = %doc_ref, "Falha ao gerar lançamento de CMVMC");
                        }
                    }
                }
            }
            AccountingEvent::TreasuryReceipt {
                event_id,
                tenant_id,
                receipt_number,
                customer_name,
                receipt_date,
                amount,
                is_bank,
            } => {
                if let Some(ref cmd) = self.receipt_cmd {
                    match cmd
                        .execute(
                            event_id,
                            tenant_id,
                            &receipt_number,
                            &customer_name,
                            receipt_date,
                            amount,
                            is_bank,
                        )
                        .await
                    {
                        Ok(Some(entry)) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                receipt_number = %receipt_number,
                                "Lançamento de quitação gerado com sucesso para recibo de tesouraria"
                            );
                        }
                        Ok(None) => {
                            tracing::debug!(event_id = %event_id, "Evento de recibo já processado anteriormente");
                        }
                        Err(e) => {
                            tracing::error!(error = %e, receipt_number = %receipt_number, "Falha ao gerar lançamento de recibo");
                        }
                    }
                }
            }
        }
    }

    async fn run_rabbitmq_listener(
        url: String,
        sender: mpsc::Sender<AccountingEvent>,
        shutdown_rx: &mut watch::Receiver<bool>,
    ) {
        loop {
            if *shutdown_rx.borrow() {
                break;
            }

            match Connection::connect(&url, ConnectionProperties::default()).await {
                Ok(conn) => {
                    tracing::info!("Ligação AMQP ao RabbitMQ estabelecida com sucesso.");

                    match conn.create_channel().await {
                        Ok(channel) => {
                            let exchange = ShortString::from("fiscal.events");
                            let queue = ShortString::from("accounting.general_ledger");

                            let _ = channel
                                .exchange_declare(
                                    exchange.clone(),
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
                                    queue.clone(),
                                    QueueDeclareOptions {
                                        durable: true,
                                        ..Default::default()
                                    },
                                    FieldTable::default(),
                                )
                                .await;

                            let _ = channel
                                .queue_bind(
                                    queue.clone(),
                                    exchange.clone(),
                                    ShortString::from("fiscal.event.#"),
                                    QueueBindOptions::default(),
                                    FieldTable::default(),
                                )
                                .await;

                            let _ = channel
                                .queue_bind(
                                    queue.clone(),
                                    exchange.clone(),
                                    ShortString::from("inventory.event.#"),
                                    QueueBindOptions::default(),
                                    FieldTable::default(),
                                )
                                .await;

                            let _ = channel
                                .queue_bind(
                                    queue.clone(),
                                    exchange,
                                    ShortString::from("treasury.event.#"),
                                    QueueBindOptions::default(),
                                    FieldTable::default(),
                                )
                                .await;

                            match channel
                                .basic_consume(
                                    queue.clone(),
                                    ShortString::from("kudiba_accounting_consumer"),
                                    BasicConsumeOptions::default(),
                                    FieldTable::default(),
                                )
                                .await
                            {
                                Ok(mut consumer) => {
                                    tracing::info!("Consumidor AMQP iniciado na fila '{}'", queue);

                                    loop {
                                        tokio::select! {
                                            biased;
                                            _ = shutdown_rx.changed() => {
                                                if *shutdown_rx.borrow() {
                                                    break;
                                                }
                                            }
                                            delivery = consumer.next() => {
                                                match delivery {
                                                    Some(Ok(delivery)) => {
                                                        match Self::parse_incoming_event(&delivery.data) {
                                                            Some(event) => {
                                                                if let Err(e) = sender.send(event).await {
                                                                    tracing::error!(error = %e, "Erro ao enfileirar evento de contabilidade");
                                                                }
                                                            }
                                                            None => {
                                                                tracing::warn!(
                                                                    raw = %String::from_utf8_lossy(&delivery.data),
                                                                    "Mensagem AMQP ignorada por formato não reconhecido"
                                                                );
                                                            }
                                                        }
                                                        let _ = delivery.ack(BasicAckOptions::default()).await;
                                                    }
                                                    Some(Err(err)) => {
                                                        tracing::warn!("Erro no stream de mensagens AMQP: {}", err);
                                                        break;
                                                    }
                                                    None => break,
                                                }
                                            }
                                        }
                                    }
                                }
                                Err(err) => {
                                    tracing::warn!("Falha ao registar basic_consume: {}", err);
                                }
                            }
                        }
                        Err(err) => {
                            tracing::warn!("Falha ao criar canal AMQP: {}", err);
                        }
                    }
                }
                Err(err) => {
                    tracing::warn!(
                        "RabbitMQ não disponível ({}). Tentando novamente em 10s...",
                        err
                    );
                }
            }

            tokio::select! {
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() { break; }
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(10)) => {}
            }
        }
    }
}

fn parse_dec_val(v: &serde_json::Value) -> Decimal {
    if let Some(s) = v.as_str() {
        s.parse::<Decimal>().unwrap_or(Decimal::ZERO)
    } else if let Some(n) = v.as_f64() {
        Decimal::try_from(n).unwrap_or(Decimal::ZERO)
    } else if let Some(n) = v.as_i64() {
        Decimal::from(n)
    } else {
        Decimal::ZERO
    }
}

fn parse_date_str(s: &str) -> NaiveDate {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return dt.date_naive();
    }
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return d;
    }
    chrono::Utc::now().date_naive()
}
