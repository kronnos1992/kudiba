use sqlx::PgPool;
use std::sync::Arc;

use crate::application::commands::{
    CloseFiscalYearHandler, CreateAccountHandler, OpenFiscalYearHandler, PostManualEntryHandler,
    ProcessInvoiceIssuedCommand, ProcessStockDispatchCommand, ProcessTreasuryReceiptCommand,
    ReverseEntryHandler, SeedStandardPgcHandler,
};
use crate::application::queries::AccountingQueries;
use crate::config::Config;
use crate::infrastructure::events::AccountingEventConsumer;
use crate::infrastructure::persistence::{
    PostgresAccountRepository, PostgresFiscalYearRepository, PostgresJournalEntryRepository,
    PostgresJournalRepository,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: PgPool,
    pub create_account: Arc<CreateAccountHandler>,
    pub seed_standard_pgc: Arc<SeedStandardPgcHandler>,
    pub open_fiscal_year: Arc<OpenFiscalYearHandler>,
    pub close_fiscal_year: Arc<CloseFiscalYearHandler>,
    pub post_manual_entry: Arc<PostManualEntryHandler>,
    pub reverse_entry: Arc<ReverseEntryHandler>,
    pub queries: Arc<AccountingQueries>,
    pub event_consumer: Arc<AccountingEventConsumer>,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool) -> Self {
        let account_repo = Arc::new(PostgresAccountRepository::new(pool.clone()));
        let year_repo = Arc::new(PostgresFiscalYearRepository::new(pool.clone()));
        let journal_repo = Arc::new(PostgresJournalRepository::new(pool.clone()));
        let entry_repo = Arc::new(PostgresJournalEntryRepository::new(pool.clone()));

        let create_account = Arc::new(CreateAccountHandler::new(account_repo.clone()));
        let seed_standard_pgc = Arc::new(SeedStandardPgcHandler::new(account_repo.clone()));
        let open_fiscal_year = Arc::new(OpenFiscalYearHandler::new(year_repo.clone()));
        let close_fiscal_year = Arc::new(CloseFiscalYearHandler::new(year_repo.clone()));

        let post_manual_entry = Arc::new(PostManualEntryHandler::new(
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
            account_repo.clone(),
        ));
        let reverse_entry = Arc::new(ReverseEntryHandler::new(
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
        ));

        let queries = Arc::new(AccountingQueries::new(
            account_repo.clone(),
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
        ));

        let invoice_cmd = Arc::new(ProcessInvoiceIssuedCommand::new(
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
        ));
        let stock_cmd = Arc::new(ProcessStockDispatchCommand::new(
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
        ));
        let receipt_cmd = Arc::new(ProcessTreasuryReceiptCommand::new(
            entry_repo.clone(),
            journal_repo.clone(),
            year_repo.clone(),
        ));

        let rabbitmq_url = if config.rabbitmq_url.is_empty() {
            None
        } else {
            Some(config.rabbitmq_url.clone())
        };

        let event_consumer = Arc::new(AccountingEventConsumer::new(
            rabbitmq_url,
            Some(invoice_cmd),
            Some(stock_cmd),
            Some(receipt_cmd),
        ));

        Self {
            config,
            pool,
            create_account,
            seed_standard_pgc,
            open_fiscal_year,
            close_fiscal_year,
            post_manual_entry,
            reverse_entry,
            queries,
            event_consumer,
        }
    }
}
