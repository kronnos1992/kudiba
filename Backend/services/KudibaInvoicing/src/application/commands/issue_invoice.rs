use std::sync::Arc;
use uuid::Uuid;

use chrono::{DateTime, TimeZone, Utc};
use rust_decimal::Decimal;
use sqlx::Row;

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
use crate::domain::services::tax_and_duty::{TaxAndDutyCalculator, STANDARD_SERVICE_WITHHOLDING_RATE};
use crate::domain::services::tax_validator::{is_valid_exemption_code_format, TaxRateValidator};
use crate::domain::value_objects::document_type::DocumentType;

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
        mut command: IssueInvoiceCommand,
    ) -> Result<IssueInvoiceResult, DomainError> {
        if command.lines.is_empty() {
            return Err(DomainError::invalid(
                "Invoice must have at least one line item.",
            ));
        }
        command.document_type = command.document_type.trim().to_uppercase();
        let document_type = DocumentType::parse(&command.document_type)?;
        if matches!(
            document_type,
            DocumentType::CreditNote | DocumentType::DebitNote
        ) && command
            .source_document_number
            .as_deref()
            .map_or(true, |reference| reference.trim().is_empty())
        {
            return Err(DomainError::invalid(
                "Notas de crédito e de débito exigem referência ao documento original.",
            ));
        }
        if let Some(reference) = command.source_document_number.as_mut() {
            *reference = reference.trim().to_string();
        }
        if command.customer_name.trim().is_empty() {
            return Err(DomainError::invalid(
                "Nome/razão social do cliente é obrigatório.",
            ));
        }
        if command
            .customer_address
            .as_deref()
            .map_or(true, |value| value.trim().is_empty())
            || command
                .customer_city
                .as_deref()
                .map_or(true, |value| value.trim().is_empty())
            || command
                .customer_country
                .as_deref()
                .map_or(true, |value| value.trim().is_empty())
        {
            return Err(DomainError::invalid(
                "Morada, município e país do cliente são obrigatórios.",
            ));
        }
        if command.payment_methods.is_empty() {
            return Err(DomainError::invalid(
                "Indique pelo menos um meio de pagamento ou 'A crédito'.",
            ));
        }
        if command
            .payment_methods
            .iter()
            .any(|method| method.trim().is_empty())
        {
            return Err(DomainError::invalid(
                "Os meios de pagamento não podem estar vazios.",
            ));
        }

        let mut uow = self.uow_factory.begin().await.map_err(persistence_error)?;

        sqlx::query("SELECT set_config('app.actor_user_id', $1, true)")
            .bind(command.actor_user_id.as_deref().unwrap_or("system"))
            .execute(&mut *uow.connection())
            .await
            .map_err(|err| DomainError::Persistence(err.to_string()))?;

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
        let issuer = sqlx::query(
            "SELECT nif, address_detail, city, country FROM kudiba_core.tenants WHERE id = $1",
        )
        .bind(command.tenant_id)
        .fetch_optional(&mut *session.connection())
        .await
        .map_err(|err| DomainError::Persistence(err.to_string()))?
        .ok_or_else(|| DomainError::invalid("Empresa emitente não encontrada."))?;
        let issuer_nif: String = issuer
            .try_get("nif")
            .map_err(|err| DomainError::Persistence(err.to_string()))?;
        let issuer_address = required_tenant_field(&issuer, "address_detail")?;
        let issuer_city = required_tenant_field(&issuer, "city")?;
        let issuer_country = required_tenant_field(&issuer, "country")?;

        if matches!(command.document_type.as_str(), "NC" | "ND") {
            let reference = command
                .source_document_number
                .as_deref()
                .unwrap_or_default();
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM kudiba_core.invoices \
                 WHERE tenant_id = $1 AND document_number = $2)",
            )
            .bind(command.tenant_id)
            .bind(reference.trim())
            .fetch_one(&mut *session.connection())
            .await
            .map_err(|err| DomainError::Persistence(err.to_string()))?;
            if !exists {
                return Err(DomainError::invalid(format!(
                    "Documento de referência '{reference}' não encontrado nesta empresa."
                )));
            }
        }

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
            .ok_or_else(|| {
                DomainError::invalid(format!(
                    "Empresa {} sem regime de IVA cadastrado; a emissão foi bloqueada.",
                    command.tenant_id
                ))
            })?
            .regime;

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
        let mut services_net_total = Decimal::ZERO;
        let mut has_explicit_service = false;
        let mut invoice_lines: Vec<InvoiceLine> = Vec::with_capacity(command.lines.len());

        for (index, input) in command.lines.iter().enumerate() {
            let line = build_invoice_line(
                invoice_id,
                index as i32 + 1,
                input,
                &mut net_total,
                &mut tax_total,
            )?;
            if input.is_service == Some(true) {
                services_net_total += line.line_base();
                has_explicit_service = true;
            }
            invoice_lines.push(line);
        }

        let gross_total = net_total + tax_total;

        // Resolução de Retenção na Fonte (explícita ou cálculo automático legal a 6.5%)
        let withholding_total = match command.withholding_total {
            Some(explicit) => explicit,
            None if command.apply_withholding.unwrap_or(false) => {
                let base = if has_explicit_service {
                    services_net_total
                } else {
                    net_total
                };
                let rate = command
                    .withholding_rate
                    .unwrap_or(STANDARD_SERVICE_WITHHOLDING_RATE);
                TaxAndDutyCalculator::calculate_withholding(base, rate)
            }
            None => Decimal::ZERO,
        };

        // Resolução de Imposto de Selo (explícito ou cálculo automático legal)
        let stamp_duty_total = match command.stamp_duty_total {
            Some(explicit) => explicit,
            None if command.apply_stamp_duty.unwrap_or(false) => {
                let rate = command.stamp_duty_rate.unwrap_or_else(|| {
                    TaxAndDutyCalculator::default_stamp_duty_rate(&command.document_type)
                });
                TaxAndDutyCalculator::calculate_stamp_duty(net_total, rate)
            }
            None => Decimal::ZERO,
        };

        if withholding_total < Decimal::ZERO
            || withholding_total > gross_total
            || stamp_duty_total < Decimal::ZERO
            || withholding_total.scale() > 2
            || stamp_duty_total.scale() > 2
        {
            return Err(DomainError::invalid(
                "Retenção e imposto de selo devem ter até duas casas decimais e ser não negativos; a retenção não pode exceder o total bruto.",
            ));
        }

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

        // Validação de dados logísticos de transporte para Guias (GT e GR)
        let doc_kind = command.document_type.trim().to_ascii_uppercase();
        if (doc_kind == "GT" || doc_kind == "GR") && command.transport.is_none() {
            return Err(DomainError::invalid(format!(
                "Documentos de movimentação de mercadorias ('{doc_kind}') exigem os metadados de transporte (local de carga, descarga e data de início) pelo Decreto Presidencial 71/25."
            )));
        }
        if let Some(ref transport) = command.transport {
            transport.validate_for_document_type(&command.document_type)?;
        }

        // 6. Constrói o agregado imutável do documento fiscal
        let invoice = Invoice::new(
            invoice_id,
            command.tenant_id,
            issuer_nif,
            issuer_address,
            issuer_city,
            issuer_country,
            series.id,
            document_number.clone(),
            new_sequence,
            command.document_type.clone(),
            command.customer_name.clone(),
            command.customer_nif.clone(),
            command.customer_address.clone(),
            command.customer_city.clone(),
            command.customer_country.clone(),
            command.source_document_number.clone(),
            command.payment_methods.clone(),
            command.currency.clone(),
            net_total,
            tax_total,
            gross_total,
            withholding_total,
            stamp_duty_total,
            signature.hash_sha256.clone(),
            signature.signature_base64.clone(),
            signature.validation_chars.clone(),
            command.key_version.clone(),
            command.is_contingency,
            regime.code().to_string(),
            issued_at,
            system_entry_date,
            invoice_lines,
        ).with_transport(command.transport.clone());

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
            withholding_total: invoice.withholding_total,
            stamp_duty_total: invoice.stamp_duty_total,
            amount_due: invoice.amount_due,
            hash_sha256: invoice.hash_sha256,
            signature_rsa_base64: invoice.signature_rsa_base64,
            validation_chars: invoice.validation_chars,
            issued_at: invoice.issued_at,
            system_entry_date: invoice.system_entry_date,
            is_contingency: invoice.is_contingency,
            transport: invoice.transport.clone(),
        })
    }
}

fn required_tenant_field(row: &sqlx::postgres::PgRow, field: &str) -> Result<String, DomainError> {
    let value: Option<String> = row
        .try_get(field)
        .map_err(|err| DomainError::Persistence(err.to_string()))?;
    value
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            DomainError::invalid(format!("O cadastro fiscal do emitente não contém {field}."))
        })
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
    let discount_amount = input.discount_amount.unwrap_or(Decimal::ZERO);
    if input.quantity <= Decimal::ZERO
        || input.unit_price < Decimal::ZERO
        || discount_amount < Decimal::ZERO
        || discount_amount > line_base
        || discount_amount.scale() > 2
    {
        return Err(DomainError::invalid(format!(
            "Linha {line_number}: quantidade, preço ou desconto inválido."
        )));
    }
    let line_base = MoneyCalculator::round_currency(line_base - discount_amount);
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
        discount_amount,
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
                discount_amount: None,
                tax_rate: Decimal::from(14),
                tax_exemption_code: None,
                is_service: None,
            },
            &mut net_total,
            &mut tax_total,
        )
        .unwrap();

        assert_eq!(line.line_total, Decimal::from(570000));
        assert_eq!(net_total, Decimal::from(500000));
        assert_eq!(tax_total, Decimal::from(70000));
    }

    #[test]
    fn aplica_desconto_antes_de_calcular_iva() {
        let mut net_total = Decimal::ZERO;
        let mut tax_total = Decimal::ZERO;
        let line = build_invoice_line(
            Uuid::new_v4(),
            1,
            &InvoiceLineInput {
                product_code: "P1".into(),
                description: "Serviço".into(),
                quantity: Decimal::from(2),
                unit_price: Decimal::from(500),
                discount_amount: Some(Decimal::from(100)),
                tax_rate: Decimal::from(14),
                tax_exemption_code: None,
                is_service: Some(true),
            },
            &mut net_total,
            &mut tax_total,
        )
        .expect("linha com desconto");

        assert_eq!(line.line_base(), Decimal::from(900));
        assert_eq!(line.line_tax(), Decimal::from(126));
        assert_eq!(line.line_total, Decimal::from(1026));
        assert_eq!(net_total, Decimal::from(900));
    }

    #[test]
    fn rejeita_desconto_superior_a_base_da_linha() {
        let mut net_total = Decimal::ZERO;
        let mut tax_total = Decimal::ZERO;
        let result = build_invoice_line(
            Uuid::new_v4(),
            1,
            &InvoiceLineInput {
                product_code: "P1".into(),
                description: "Serviço".into(),
                quantity: Decimal::ONE,
                unit_price: Decimal::from(10),
                discount_amount: Some(Decimal::from(11)),
                tax_rate: Decimal::from(14),
                tax_exemption_code: None,
                is_service: None,
            },
            &mut net_total,
            &mut tax_total,
        );

        assert!(result.is_err());
    }

    #[test]
    fn calcula_retencao_automatica_de_servicos_a_6_e_meio() {
        let base_servico = Decimal::from(200000); // 200.000 Kz de serviços
        let retencao = TaxAndDutyCalculator::calculate_withholding(
            base_servico,
            STANDARD_SERVICE_WITHHOLDING_RATE,
        );
        assert_eq!(retencao, Decimal::from(13000)); // 6.5% de 200.000 = 13.000 Kz
    }

    #[test]
    fn calcula_imposto_de_selo_automatico_para_factura_e_recibo() {
        let base = Decimal::from(100000);
        let selo_ft = TaxAndDutyCalculator::calculate_stamp_duty(
            base,
            TaxAndDutyCalculator::default_stamp_duty_rate("FT"),
        );
        assert_eq!(selo_ft, Decimal::from(1000)); // 1% geral

        let selo_fr = TaxAndDutyCalculator::calculate_stamp_duty(
            base,
            TaxAndDutyCalculator::default_stamp_duty_rate("FR"),
        );
        assert_eq!(selo_fr, Decimal::from(700)); // 0.7% recibo
    }

    #[test]
    fn valida_obrigatoriedade_de_transporte_em_guia_de_transporte() {
        let transport_valido = crate::domain::value_objects::transport::TransportMovement {
            vehicle_registration: Some("LD-22-33-BB".into()),
            carrier_name: Some("Kudiba Logística".into()),
            carrier_nif: Some("5001234567".into()),
            load_address: Some("Armazém 1".into()),
            load_city: Some("Luanda".into()),
            load_country: Some("AO".into()),
            load_date_time: Some(chrono::Utc::now()),
            unload_address: Some("Supermercado Central".into()),
            unload_city: Some("Lobito".into()),
            unload_country: Some("AO".into()),
            unload_date_time: Some(chrono::Utc::now()),
        };

        assert!(transport_valido.validate_for_document_type("GT").is_ok());
        assert!(transport_valido.validate_for_document_type("GR").is_ok());

        let transport_sem_carga = crate::domain::value_objects::transport::TransportMovement {
            load_address: None,
            ..transport_valido.clone()
        };
        assert!(transport_sem_carga.validate_for_document_type("GT").is_err());
    }
}
