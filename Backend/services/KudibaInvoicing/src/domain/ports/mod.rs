//! Portas (contratos) do domínio — interfaces implementadas pelos adaptadores
//! de infraestrutura. Seguem a inversão de dependência da Clean Architecture.
pub mod crypto_signer;
pub mod db_session;
pub mod invoice_repository;
pub mod series_repository;
pub mod tax_regime_repository;
pub mod tenant_repository;
pub mod unit_of_work;
