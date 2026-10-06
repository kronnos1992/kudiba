use std::sync::Arc;
use uuid::Uuid;

use chrono::{DateTime, TimeZone, Utc};
use rust_decimal::Decimal;

use crate::application::dto::{InvoiceLineInput, IssueInvoiceCommand, IssueInvoiceResult};
use crate::domain::entities::fiscal_series::FiscalSeries;
use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::invoice_line::InvoiceLine;
use crate::domain::error::DomainError;
use crate::domain::ports::crypto_signer::CryptoSigner;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::invoice_repository::InvoiceRepository;
use crate::domain::ports::series_repository::FiscalSeriesRepository;
use crate::domain::ports::tax_regime_repository::TaxRegimeRepository;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::services::chained_hash::{ChainedHashCalculator, MoneyCalculator};
use crate::domain::services::tax_validator::{is_valid_exemption_code_format, TaxRateValidator};
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Fallback defensivo: um sujeito passivo sem enquadramento legível é tratado
/// pelo regime mais restritivo, para nunca emitir IVA a um sujeito de exclusão.
const FALLBACK_REGIME: TaxRegime = TaxRegime::General;

/// Caso de uso de emissão de documentos fiscais (motor de facturação).
///
/// Fluxo transacional (nível ACID estrito, sem lacunas de numeração):
/// 1. Abre a transação (Unit of Work);
/// 2. bloqueia pessimistamente a série fiscal (`SELECT ... FOR UPDATE`);
/// 3. reserva a próxima sequência contínua e formata o número legal;
/// 4. lê o regime de IVA do sujeito passivo e valida as taxas das linhas;
/// 5. calcula os totais com aritmética decimal exata;
/// 6. monta e assina o buffer canónico AGT (RSA-2048 / SHA-256);
/// 7. grava a fatura e as suas linhas com o regime congelado;
/// 8. avança o ponteiro de sequência e o hash encadeado da série;
/// 9. confirma a transação atómica.
pub struct IssueInvoiceUseCase {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    series_repository: Arc<dyn FiscalSeriesRepository>,
    invoice_repository: Arc<dyn InvoiceRepository>,
    tax_regime_repository: Arc<dyn TaxRegimeRepository>,
    crypto_signer: Arc<dyn CryptoSigner>,
}

impl IssueInvoiceUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        series_repository: Arc<dyn FiscalSeriesRepository>,
        invoice_repository: Arc<dyn InvoiceRepository>,
        tax_regime_repository: Arc<dyn TaxRegimeRepository>,
        crypto_signer: Arc<dyn CryptoSigner>,
    ) -> Self {
        Self {
            uow_factory,
            series_repository,
            invoice_repository,
            tax_regime_repository,
            crypto_signer,
        }
    }

    pub async fn execute(
        &self,
        command: IssueInvoiceCommand,
    ) -> Result<IssueInvoiceResult, DomainError> {
        if command.lines.is_empty() {
            return Err(DomainError::invalid(
                "Invoice must have at least one line item.",
            ));
        }

        let mut uow = self.uow_factory.begin().await.map_err(persistence_error)?;

        let outcome = self.issue(&mut *uow, command).await;

        match outcome {
            Ok(result) => {
                uow.commit().await.map_err(persistence_error)?;
                tracing::info!(
                    document_number = %result.document_number,
                    sequence = result.sequence_number,
                    gross_total = %result.gross_total,
                    validation_chars = %result.validation_chars,
                    "Documento fiscal emitido, assinado e gravado com sucesso"
                );
                Ok(result)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!("Falha ao reverter transação fiscal: {}", rollback_err);
                }
                Err(err)
            }
        }
    }

    async fn issue(
        &self,
        session: &mut dyn DbSession,
        command: IssueInvoiceCommand,
    ) -> Result<IssueInvoiceResult, DomainError> {
        // 1. Bloqueia a série fiscal com SELECT ... FOR UPDATE (serializa emissões concorrentes)
        let mut series = match self
            .series_repository
            .get_and_lock(
                session,
                command.tenant_id,
                &command.document_type,
                &command.series_code,
                command.fiscal_year,
            )
            .await
            .map_err(persistence_error)?
        {
            Some(series) => series,
            None => {
                let series = FiscalSeries::new(
                    Uuid::new_v4(),
                    command.tenant_id,
                    &command.document_type,
                    &command.series_code,
                    command.fiscal_year,
                );
                self.series_repository
                    .create(session, &series)
                    .await
                    .map_err(persistence_error)?;
                series
            }
        };

        // 2. Reserva a próxima sequência contínua (zero gaps) e o número legal
        let new_sequence = series.next_sequence();
        let document_number = series.format_document_number(new_sequence);

        // 3. Lê o regime de IVA do sujeito passivo e valida as taxas de cada linha
        let regime = self
            .tax_regime_repository
            .get_tenant_regime(session, command.tenant_id)
            .await
            .map_err(persistence_error)?
            .map_or_else(
                || {
                    tracing::warn!(
                        tenant_id = %command.tenant_id,
                        "Sujeito passivo sem enquadramento de IVA registado; a aplicar {FALLBACK_REGIME:?}"
                    );
                    FALLBACK_REGIME
                },
                |tenant| tenant.regime,
            );

        TaxRateValidator::validate_lines(
            regime,
            command.lines.iter().enumerate().map(|(index, input)| {
                (
                    index as i32 + 1,
                    input.tax_rate,
                    input.tax_exemption_code.as_deref(),
                )
            }),
        )?;

        self.assert_exemption_codes_exist(session, &command.lines)
            .await?;

        // 4. Calcula os totais com aritmética decimal de 128 bits
        let invoice_id = Uuid::new_v4();
        let mut net_total = Decimal::ZERO;
        let mut tax_total = Decimal::ZERO;
        let mut invoice_lines: Vec<InvoiceLine> = Vec::with_capacity(command.lines.len());

        for (index, input) in command.lines.iter().enumerate() {
            invoice_lines.push(build_invoice_line(
                invoice_id,
                index as i32 + 1,
                input,
                &mut net_total,
                &mut tax_total,
            )?);
        }

        let gross_total = net_total + tax_total;

        // 4. Carimba as datas fiscais (emissão = data, registo = instante exacto)
        let system_entry_date = Utc::now();
        let issued_at: DateTime<Utc> = Utc.from_utc_datetime(
            &system_entry_date
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .unwrap_or_default(),
        );

        // 5. Monta e assina o buffer canónico AGT (encadeamento de hash SHA-256)
        let canonical_buffer = ChainedHashCalculator::build_canonical_buffer(
            &series.last_hash,
            issued_at.date_naive(),
            &document_number,
            gross_total,
            system_entry_date,
        );
        let signature = self
            .crypto_signer
            .sign_canonical_buffer(&canonical_buffer)
            .await?;

        // 6. Constrói o agregado imutável do documento fiscal
        let invoice = Invoice::new(
            invoice_id,
            command.tenant_id,
            series.id,
            document_number.clone(),
            new_sequence,
            command.document_type.clone(),
            command.customer_name.clone(),
            command.customer_nif.clone(),
            command.currency.clone(),
            net_total,
            tax_total,
            gross_total,
            signature.hash_sha256.clone(),
            signature.signature_base64.clone(),
            signature.validation_chars.clone(),
            command.key_version.clone(),
            command.is_contingency,
            regime.code().to_string(),
            issued_at,
            system_entry_date,
            invoice_lines,
        );

        // Invariante do agregado antes da gravação: totais e coerência com o regime
        invoice.verify_totals()?;
        invoice.verify_tax_regime()?;

        // 7. Persiste cabeçalho e linhas dentro da transação activa
        self.invoice_repository
            .save(session, &invoice)
            .await
            .map_err(persistence_error)?;

        // 8. Avança o ponteiro de sequência e encadeia o hash do documento
        series
            .advance_sequence(&signature.hash_sha256)
            .map_err(|err| DomainError::ConcurrencyConflict(err.to_string()))?;
        self.series_repository
            .update_sequence_and_hash(
                session,
                series.id,
                series.current_sequence,
                &series.last_hash,
            )
            .await
            .map_err(persistence_error)?;

        Ok(IssueInvoiceResult {
            invoice_id: invoice.id,
            document_number: invoice.document_number,
            sequence_number: invoice.sequence_number,
            net_total: invoice.net_total,
            tax_total: invoice.tax_total,
            gross_total: invoice.gross_total,
            hash_sha256: invoice.hash_sha256,
            signature_rsa_base64: invoice.signature_rsa_base64,
            validation_chars: invoice.validation_chars,
            issued_at: invoice.issued_at,
            system_entry_date: invoice.system_entry_date,
            is_contingency: invoice.is_contingency,
        })
    }
}

/// Calcula base, imposto e total de uma linha de artigo
fn build_invoice_line(
    invoice_id: Uuid,
    line_number: i32,
    input: &InvoiceLineInput,
    net_total: &mut Decimal,
    tax_total: &mut Decimal,
) -> Result<InvoiceLine, DomainError> {
    let line_base = MoneyCalculator::line_base(input.quantity, input.unit_price);
    let line_tax = MoneyCalculator::line_tax(line_base, input.tax_rate);
    let line_gross = line_base + line_tax;

    *net_total += line_base;
    *tax_total += line_tax;

    Ok(InvoiceLine::new(
        Uuid::new_v4(),
        invoice_id,
        line_number,
        input.product_code.clone(),
        input.description.clone(),
        input.quantity,
        input.unit_price,
        input.tax_rate,
        input.tax_exemption_code.clone(),
        line_gross,
    ))
}

impl IssueInvoiceUseCase {
    /// Confirma que cada código de isenção declarado existe no catálogo da AGT
    async fn assert_exemption_codes_exist(
        &self,
        session: &mut dyn DbSession,
        lines: &[InvoiceLineInput],
    ) -> Result<(), DomainError> {
        for (index, input) in lines.iter().enumerate() {
            let Some(code) = input
                .tax_exemption_code
                .as_deref()
                .map(str::trim)
                .filter(|code| !code.is_empty())
            else {
                continue;
            };

            let normalised = code.to_uppercase();

            // Validação em duas fases: formato no domínio, existência no catálogo AGT
            if !is_valid_exemption_code_format(&normalised) {
                return Err(DomainError::invalid(format!(
                    "Linha {}: código de isenção inválido '{code}'. Formato obrigatório: 'M' \
                     seguido de dois dígitos (ex.: 'M02', 'M04').",
                    index + 1
                )));
            }

            if !self
                .tax_regime_repository
                .exemption_code_exists(session, &normalised)
                .await
                .map_err(persistence_error)?
            {
                return Err(DomainError::invalid(format!(
                    "Linha {}: código de isenção '{normalised}' não consta do catálogo oficial \
                     da AGT.",
                    index + 1
                )));
            }
        }

        Ok(())
    }
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(message) => DomainError::ConcurrencyConflict(message),
        RepositoryError::Database(message) => DomainError::Persistence(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn calcula_totais_com_aritmetica_exata() {
        let mut net_total = Decimal::ZERO;
        let mut tax_total = Decimal::ZERO;

        let line = build_invoice_line(
            Uuid::new_v4(),
            1,
            &InvoiceLineInput {
                product_code: "PROD-001".into(),
                description: "Licenciamento".into(),
                quantity: Decimal::from(1),
                unit_price: Decimal::from(500000),
                tax_rate: Decimal::from(14),
                tax_exemption_code: None,
            },
            &mut net_total,
            &mut tax_total,
        )
        .unwrap();

        assert_eq!(line.line_total, Decimal::from(570000));
        assert_eq!(net_total, Decimal::from(500000));
        assert_eq!(tax_total, Decimal::from(70000));
    }
}
