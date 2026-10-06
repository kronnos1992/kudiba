//! Container de injecção de dependências partilhado pelos adaptadores de entrada
use std::sync::Arc;

use sqlx::PgPool;

use crate::application::commands::create_fiscal_series::CreateFiscalSeriesUseCase;
use crate::application::commands::issue_invoice::IssueInvoiceUseCase;
use crate::application::commands::resolve_tax_regime::ResolveTaxRegimeUseCase;
use crate::application::commands::sign_direct::SignDirectUseCase;
use crate::application::commands::sync_agt::SyncAgtUseCase;
use crate::application::queries::export_saft::ExportSaftUseCase;
use crate::application::queries::get_invoice::GetInvoiceUseCase;
use crate::application::queries::tax_regime::{
    GetTaxRegimeUseCase, ListTaxRegimesUseCase, ValidateExemptionCodeUseCase,
};
use crate::application::queries::validate_series_sequence::ValidateSeriesSequenceUseCase;
use crate::application::queries::verify_signature::VerifySignatureUseCase;
use crate::config::Config;
use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::invoice_repository::InvoiceRepository;
use crate::domain::ports::series_repository::FiscalSeriesRepository;
use crate::domain::ports::tax_regime_repository::TaxRegimeRepository;
use crate::domain::ports::tenant_repository::TenantRepository;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::infrastructure::agt::AgtClient;
use crate::infrastructure::crypto::rsa_signer::RsaCryptoSigner;
use crate::infrastructure::persistence::invoice_repository::PgInvoiceRepository;
use crate::infrastructure::persistence::series_repository::PgFiscalSeriesRepository;
use crate::infrastructure::persistence::tax_regime_repository::PgTaxRegimeRepository;
use crate::infrastructure::persistence::tenant_repository::PgTenantRepository;
use crate::infrastructure::persistence::unit_of_work::{PgSessionFactory, PgUnitOfWorkFactory};

/// Estado partilhado da aplicação (casos de uso + infra-estrutura)
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub signer: Arc<RsaCryptoSigner>,
    pub agt_client: Arc<AgtClient>,
    pub issue_invoice: Arc<IssueInvoiceUseCase>,
    pub create_series: Arc<CreateFiscalSeriesUseCase>,
    pub get_invoice: Arc<GetInvoiceUseCase>,
    pub sign_direct: Arc<SignDirectUseCase>,
    pub verify_signature: Arc<VerifySignatureUseCase>,
    pub validate_series: Arc<ValidateSeriesSequenceUseCase>,
    pub resolve_tax_regime: Arc<ResolveTaxRegimeUseCase>,
    pub get_tax_regime: Arc<GetTaxRegimeUseCase>,
    pub list_tax_regimes: Arc<ListTaxRegimesUseCase>,
    pub validate_exemption_code: Arc<ValidateExemptionCodeUseCase>,
    pub export_saft: Arc<ExportSaftUseCase>,
    pub sync_agt: Arc<SyncAgtUseCase>,
}

impl AppState {
    /// Monta o grafo de dependências da Clean Architecture
    pub fn bootstrap(
        config: Config,
        pool: PgPool,
        signer: Arc<RsaCryptoSigner>,
    ) -> Result<Self, DomainError> {
        let session_factory: Arc<dyn DbSessionFactory> =
            Arc::new(PgSessionFactory::new(pool.clone()));
        let uow_factory: Arc<dyn UnitOfWorkFactory> = Arc::new(PgUnitOfWorkFactory::new(pool));
        let series_repository: Arc<dyn FiscalSeriesRepository> =
            Arc::new(PgFiscalSeriesRepository::new());
        let invoice_repository: Arc<dyn InvoiceRepository> = Arc::new(PgInvoiceRepository::new());
        let tax_regime_repository: Arc<dyn TaxRegimeRepository> =
            Arc::new(PgTaxRegimeRepository::new());
        let tenant_repository: Arc<dyn TenantRepository> =
            Arc::new(PgTenantRepository::new());
        let crypto_signer: Arc<dyn CryptoSigner> = signer.clone();

        let agt_client = Arc::new(AgtClient::from_config(&config).map_err(|err| {
            DomainError::invalid(format!("Falha ao inicializar conector AGT: {err}"))
        })?);

        Ok(Self {
            issue_invoice: Arc::new(IssueInvoiceUseCase::new(
                uow_factory.clone(),
                series_repository.clone(),
                invoice_repository.clone(),
                tax_regime_repository.clone(),
                crypto_signer.clone(),
            )),
            create_series: Arc::new(CreateFiscalSeriesUseCase::new(
                session_factory.clone(),
                series_repository.clone(),
            )),
            get_invoice: Arc::new(GetInvoiceUseCase::new(
                session_factory.clone(),
                invoice_repository.clone(),
            )),
            sign_direct: Arc::new(SignDirectUseCase::new(crypto_signer.clone())),
            verify_signature: Arc::new(VerifySignatureUseCase::new(crypto_signer.clone())),
            validate_series: Arc::new(ValidateSeriesSequenceUseCase::new(
                session_factory.clone(),
                series_repository,
            )),
            resolve_tax_regime: Arc::new(ResolveTaxRegimeUseCase::new(
                uow_factory.clone(),
                tax_regime_repository.clone(),
            )),
            get_tax_regime: Arc::new(GetTaxRegimeUseCase::new(
                session_factory.clone(),
                tax_regime_repository.clone(),
            )),
            list_tax_regimes: Arc::new(ListTaxRegimesUseCase::new(
                session_factory.clone(),
                tax_regime_repository.clone(),
            )),
            validate_exemption_code: Arc::new(ValidateExemptionCodeUseCase::new(
                session_factory.clone(),
                tax_regime_repository,
            )),
            export_saft: Arc::new(ExportSaftUseCase::new(
                session_factory.clone(),
                tenant_repository.clone(),
                invoice_repository.clone(),
                config.service_version,
            )),
            sync_agt: Arc::new(SyncAgtUseCase::new(
                session_factory,
                tenant_repository,
                invoice_repository,
                agt_client.clone(),
            )),
            agt_client,
            signer,
            config,
        })
    }
}
