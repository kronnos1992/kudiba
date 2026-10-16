use sqlx::PgPool;
use std::sync::Arc;

use crate::application::commands::{
    CloseCashSessionHandler, CreateBankAccountHandler, CreateCashRegisterHandler,
    IssueTreasuryReceiptHandler, OpenCashSessionHandler, RecordCashMovementHandler,
    RegisterInvoiceReceivableHandler,
};
use crate::application::queries::TreasuryQueries;
use crate::config::Config;
use crate::domain::ports::{InvoiceReceivableRepository, TreasuryEventPublisher};
use crate::infrastructure::events::{MultiChannelTreasuryEventPublisher, TreasuryEventConsumer};
use crate::infrastructure::persistence::{
    PostgresBankAccountRepository, PostgresCashMovementRepository, PostgresCashRegisterRepository,
    PostgresCashSessionRepository, PostgresInvoiceReceivableRepository,
    PostgresTreasuryReceiptRepository,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db_pool: PgPool,
    pub create_register_cmd: Arc<CreateCashRegisterHandler>,
    pub open_session_cmd: Arc<OpenCashSessionHandler>,
    pub close_session_cmd: Arc<CloseCashSessionHandler>,
    pub record_movement_cmd: Arc<RecordCashMovementHandler>,
    pub create_bank_account_cmd: Arc<CreateBankAccountHandler>,
    pub issue_receipt_cmd: Arc<IssueTreasuryReceiptHandler>,
    pub receivable_repo: Arc<dyn InvoiceReceivableRepository>,
    pub queries: Arc<TreasuryQueries>,
    pub event_consumer: Arc<TreasuryEventConsumer>,
    pub event_publisher: Arc<dyn TreasuryEventPublisher>,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool) -> Self {
        let register_repo = Arc::new(PostgresCashRegisterRepository::new(pool.clone()));
        let session_repo = Arc::new(PostgresCashSessionRepository::new(pool.clone()));
        let movement_repo = Arc::new(PostgresCashMovementRepository::new(pool.clone()));
        let bank_repo = Arc::new(PostgresBankAccountRepository::new(pool.clone()));
        let receipt_repo = Arc::new(PostgresTreasuryReceiptRepository::new(pool.clone()));
        let receivable_repo: Arc<dyn InvoiceReceivableRepository> =
            Arc::new(PostgresInvoiceReceivableRepository::new(pool.clone()));

        let event_publisher: Arc<dyn TreasuryEventPublisher> = Arc::new(
            MultiChannelTreasuryEventPublisher::new(Some(config.rabbitmq_url.clone())),
        );

        let create_register_cmd = Arc::new(CreateCashRegisterHandler::new(register_repo.clone()));
        let open_session_cmd = Arc::new(OpenCashSessionHandler::new(
            register_repo.clone(),
            session_repo.clone(),
        ));
        let close_session_cmd = Arc::new(CloseCashSessionHandler::new(
            session_repo.clone(),
            movement_repo.clone(),
        ));
        let record_movement_cmd = Arc::new(RecordCashMovementHandler::new(
            session_repo.clone(),
            movement_repo.clone(),
        ));
        let create_bank_account_cmd = Arc::new(CreateBankAccountHandler::new(bank_repo.clone()));
        let issue_receipt_cmd = Arc::new(IssueTreasuryReceiptHandler::new(
            receipt_repo.clone(),
            session_repo.clone(),
            bank_repo.clone(),
            event_publisher.clone(),
        ));

        let register_receivable_cmd = Arc::new(RegisterInvoiceReceivableHandler::new(
            receivable_repo.clone(),
        ));

        let queries = Arc::new(TreasuryQueries::new(
            register_repo,
            session_repo,
            movement_repo,
            bank_repo,
            receipt_repo,
        ));

        let event_consumer = Arc::new(TreasuryEventConsumer::new(
            Some(config.rabbitmq_url.clone()),
            register_receivable_cmd,
        ));

        Self {
            config: Arc::new(config),
            db_pool: pool,
            create_register_cmd,
            open_session_cmd,
            close_session_cmd,
            record_movement_cmd,
            create_bank_account_cmd,
            issue_receipt_cmd,
            receivable_repo,
            queries,
            event_consumer,
            event_publisher,
        }
    }
}
