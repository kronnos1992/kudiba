use chrono::NaiveDate;
use futures_util::StreamExt;
use lapin::{
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    types::{AMQPValue, FieldTable, ShortString},
    BasicProperties, Connection, ConnectionProperties, ExchangeKind,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, watch, Mutex};
use uuid::Uuid;

use crate::application::commands::{
    ProcessInvoiceIssuedCommand, ProcessPayrollPeriodClosedCommand, ProcessStockDispatchCommand,
    ProcessTreasuryReceiptCommand,
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
    PayrollPeriodClosed {
        event_id: Uuid,
        tenant_id: Uuid,
        period_title: String,
        year: i32,
        month: u32,
        total_gross: Decimal,
        total_net: Decimal,
        total_inss_employee: Decimal,
        total_inss_employer: Decimal,
        total_irt: Decimal,
        employee_count: usize,
    },
}

impl AccountingEvent {
    fn tenant_id(&self) -> Uuid {
        match self {
            AccountingEvent::InvoiceIssued { tenant_id, .. }
            | AccountingEvent::StockDispatch { tenant_id, .. }
            | AccountingEvent::TreasuryReceipt { tenant_id, .. }
            | AccountingEvent::PayrollPeriodClosed { tenant_id, .. } => *tenant_id,
        }
    }
}

pub struct AccountingEventConsumer {
    rabbitmq_url: Option<String>,
    sender: mpsc::Sender<AccountingEvent>,
    receiver: Mutex<mpsc::Receiver<AccountingEvent>>,
    invoice_cmd: Option<Arc<ProcessInvoiceIssuedCommand>>,
    stock_cmd: Option<Arc<ProcessStockDispatchCommand>>,
    receipt_cmd: Option<Arc<ProcessTreasuryReceiptCommand>>,
    payroll_cmd: Option<Arc<ProcessPayrollPeriodClosedCommand>>,
}

impl AccountingEventConsumer {
    pub fn new(
        rabbitmq_url: Option<String>,
        invoice_cmd: Option<Arc<ProcessInvoiceIssuedCommand>>,
        stock_cmd: Option<Arc<ProcessStockDispatchCommand>>,
        receipt_cmd: Option<Arc<ProcessTreasuryReceiptCommand>>,
        payroll_cmd: Option<Arc<ProcessPayrollPeriodClosedCommand>>,
    ) -> Self {
        let (sender, receiver) = mpsc::channel(1024);
        Self {
            rabbitmq_url,
            sender,
            receiver: Mutex::new(receiver),
            invoice_cmd,
            stock_cmd,
            receipt_cmd,
            payroll_cmd,
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
            "payroll.period.closed" => {
                let period_title = payload
                    .get("periodTitle")
                    .or_else(|| payload.get("period_title"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("Processamento Salarial")
                    .to_string();

                let year = payload.get("year").and_then(|v| v.as_i64()).unwrap_or(2026) as i32;

                let month = payload.get("month").and_then(|v| v.as_u64()).unwrap_or(1) as u32;

                let total_gross = payload
                    .get("totalGross")
                    .or_else(|| payload.get("total_gross"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let total_net = payload
                    .get("totalNet")
                    .or_else(|| payload.get("total_net"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let total_inss_employee = payload
                    .get("totalInssEmployee")
                    .or_else(|| payload.get("total_inss_employee"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let total_inss_employer = payload
                    .get("totalInssEmployer")
                    .or_else(|| payload.get("total_inss_employer"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let total_irt = payload
                    .get("totalIrt")
                    .or_else(|| payload.get("total_irt"))
                    .map(parse_dec_val)
                    .unwrap_or(Decimal::ZERO);

                let employee_count = payload
                    .get("employeeCount")
                    .or_else(|| payload.get("employee_count"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as usize;

                Some(AccountingEvent::PayrollPeriodClosed {
                    event_id,
                    tenant_id,
                    period_title,
                    year,
                    month,
                    total_gross,
                    total_net,
                    total_inss_employee,
                    total_inss_employer,
                    total_irt,
                    employee_count,
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

    pub async fn run_loop(self: Arc<Self>, mut shutdown_rx: watch::Receiver<bool>) {
        if let Some(ref rmq) = self.rabbitmq_url {
            tracing::info!(
                endpoint = %rmq,
                exchange = "fiscal.events",
                queue = "accounting.general_ledger",
                "Consumidor AMQP de contabilidade configurado para RabbitMQ"
            );

            let rmq_url = rmq.clone();
            let amqp_consumer = Arc::clone(&self);
            let mut amqp_shutdown_rx = shutdown_rx.clone();

            tokio::spawn(async move {
                amqp_consumer
                    .run_rabbitmq_listener(rmq_url, &mut amqp_shutdown_rx)
                    .await;
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
                            let tenant_id = event.tenant_id();
                            let result = crate::config::with_tenant_context(
                                Some(tenant_id),
                                self.process_event(event),
                            )
                            .await;
                            if let Err(err) = result {
                                tracing::error!(error = %err, "Falha ao processar evento de contabilidade em memória");
                            }
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

    async fn process_event(&self, event: AccountingEvent) -> Result<(), DomainError> {
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
                        .await?
                    {
                        Some(entry) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                doc_number = %doc_number,
                                "Lançamento contabilístico automático gerado com sucesso para fatura"
                            );
                        }
                        None => {
                            tracing::debug!(event_id = %event_id, "Evento de fatura já processado anteriormente (idempotência)");
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
                        .await?
                    {
                        Some(entry) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                doc_ref = %doc_ref,
                                "Lançamento de CMVMC gerado com sucesso para saída de stock"
                            );
                        }
                        None => {
                            tracing::debug!(event_id = %event_id, "Evento de stock já processado anteriormente");
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
                        .await?
                    {
                        Some(entry) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                receipt_number = %receipt_number,
                                "Lançamento de quitação gerado com sucesso para recibo de tesouraria"
                            );
                        }
                        None => {
                            tracing::debug!(event_id = %event_id, "Evento de recibo já processado anteriormente");
                        }
                    }
                }
            }
            AccountingEvent::PayrollPeriodClosed {
                event_id,
                tenant_id,
                period_title,
                year,
                month,
                total_gross,
                total_net,
                total_inss_employee,
                total_inss_employer,
                total_irt,
                employee_count,
            } => {
                if let Some(ref cmd) = self.payroll_cmd {
                    match cmd
                        .execute(
                            event_id,
                            tenant_id,
                            &period_title,
                            year,
                            month,
                            total_gross,
                            total_net,
                            total_inss_employee,
                            total_inss_employer,
                            total_irt,
                        )
                        .await?
                    {
                        Some(entry) => {
                            tracing::info!(
                                entry_number = entry.entry_number,
                                period = %period_title,
                                employee_count,
                                "Lançamento contabilístico de folha salarial gerado com sucesso"
                            );
                        }
                        None => {
                            tracing::debug!(event_id = %event_id, "Evento de folha salarial já processado anteriormente");
                        }
                    }
                }
            }
        }

        Ok(())
    }

    async fn run_rabbitmq_listener(
        self: Arc<Self>,
        url: String,
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

                            Self::declare_dlq(&channel).await;

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
                                    exchange.clone(),
                                    ShortString::from("treasury.event.#"),
                                    QueueBindOptions::default(),
                                    FieldTable::default(),
                                )
                                .await;

                            let _ = channel
                                .queue_bind(
                                    queue.clone(),
                                    exchange.clone(),
                                    ShortString::from("payroll.event.#"),
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
                                                        let routing = delivery.routing_key.to_string();
                                                        match Self::parse_incoming_event(&delivery.data) {
                                                            Some(event) => {
                                                                let result = crate::config::with_tenant_context(
                                                                    Some(event.tenant_id()),
                                                                    self.process_event(event),
                                                                )
                                                                .await;
                                                                match result {
                                                                    Ok(()) => {
                                                                        if let Err(err) = delivery.ack(BasicAckOptions::default()).await {
                                                                            tracing::warn!(error = %err, "Falha ao confirmar (ack) mensagem AMQP");
                                                                        }
                                                                    }
                                                                    Err(err) => {
                                                                        tracing::error!(
                                                                            error = %err,
                                                                            "Falha ao processar evento de contabilidade; encaminhando para DLQ"
                                                                        );
                                                                        Self::handle_failure(&channel, &delivery, &routing, &err.to_string()).await;
                                                                    }
                                                                }
                                                            }
                                                            None => {
                                                                tracing::warn!(
                                                                    raw = %String::from_utf8_lossy(&delivery.data),
                                                                    "Mensagem AMQP não reconhecida; encaminhando para DLQ"
                                                                );
                                                                Self::handle_failure(&channel, &delivery, &routing, "payload de evento inválido").await;
                                                            }
                                                        }
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
            AMQPValue::LongString("accounting.general_ledger".into()),
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
