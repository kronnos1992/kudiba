use chrono::{Datelike, DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignCurrencyAccount {
    pub bank_name: String,
    pub currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub balance_original: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub exchange_rate_to_aoa: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub converted_aoa: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentLiquidityBreakdown {
    #[serde(with = "rust_decimal::serde::float")]
    pub total_available_aoa: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub cash_in_hand_aoa: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub bank_balances_aoa: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub reconciled_balance_aoa: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub pending_clearance_aoa: Decimal,
    pub foreign_reserves: Vec<ForeignCurrencyAccount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityFlow {
    #[serde(with = "rust_decimal::serde::float")]
    pub inflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub outflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodBreakdown {
    pub method: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub category: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealizedCashFlow {
    #[serde(with = "rust_decimal::serde::float")]
    pub total_inflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_outflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_cash_flow: Decimal,
    pub operational: ActivityFlow,
    pub investment: ActivityFlow,
    pub financing: ActivityFlow,
    pub inflows_by_method: Vec<MethodBreakdown>,
    pub outflows_by_category: Vec<CategoryBreakdown>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxObligationForecast {
    pub tax_type: String,
    pub due_date: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_amount: Decimal,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastCashFlow {
    #[serde(with = "rust_decimal::serde::float")]
    pub receivables_due: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub payables_due: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_taxes: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_payroll: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_expected_inflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_expected_outflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_expected_flow: Decimal,
    pub tax_obligations: Vec<TaxObligationForecast>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyProjectionPoint {
    pub date: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub starting_balance: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expected_inflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expected_outflows: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub ending_balance: Decimal,
    pub is_deficit_risk: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryAlert {
    pub severity: String,
    pub title: String,
    pub message: String,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashFlowReport {
    pub tenant_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub base_currency: String,
    pub period_start: String,
    pub period_end: String,
    pub current_liquidity: CurrentLiquidityBreakdown,
    pub realized: RealizedCashFlow,
    pub forecast: ForecastCashFlow,
    pub projections: Vec<DailyProjectionPoint>,
    pub alerts: Vec<TreasuryAlert>,
}

pub async fn fetch(
    pool: &PgPool,
    tenant_id: Uuid,
    period_start: Option<NaiveDate>,
    period_end: Option<NaiveDate>,
) -> Result<CashFlowReport, DomainError> {
    let now = Utc::now();
    let today = now.date_naive();
    let p_start = period_start.unwrap_or_else(|| {
        NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap_or(today)
    });
    let p_end = period_end.unwrap_or_else(|| {
        let next_month = if today.month() == 12 { 1 } else { today.month() + 1 };
        let next_year = if today.month() == 12 { today.year() + 1 } else { today.year() };
        NaiveDate::from_ymd_opt(next_year, next_month, 1)
            .unwrap_or(today)
            .pred_opt()
            .unwrap_or(today)
    });

    let current_liquidity = fetch_liquidity_details(pool, tenant_id).await?;
    let realized = fetch_realized_flow(pool, tenant_id, p_start, p_end).await?;
    let forecast = fetch_forecast_flow(pool, tenant_id).await?;
    let projections = build_projections(
        today,
        current_liquidity.total_available_aoa,
        pool,
        tenant_id,
    ).await?;
    let alerts = generate_alerts(pool, tenant_id, &forecast).await?;

    Ok(CashFlowReport {
        tenant_id,
        generated_at: now,
        base_currency: "AOA".to_string(),
        period_start: p_start.to_string(),
        period_end: p_end.to_string(),
        current_liquidity,
        realized,
        forecast,
        projections,
        alerts,
    })
}

async fn fetch_liquidity_details(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<CurrentLiquidityBreakdown, DomainError> {
    let accounts_rows = sqlx::query(
        "SELECT bank_name, currency::text AS currency, current_balance, \
                reconciled_balance, exchange_rate_to_aoa, is_active \
         FROM kudiba_treasury.bank_accounts \
         WHERE tenant_id = $1 AND is_active = true",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let mut bank_balances_aoa = Decimal::ZERO;
    let mut reconciled_balance_aoa = Decimal::ZERO;
    let mut foreign_reserves = Vec::new();

    for r in accounts_rows {
        let bank_name: String = r.try_get("bank_name").unwrap_or_default();
        let currency: String = r.try_get("currency").unwrap_or_else(|_| "AOA".to_string());
        let current_balance: Decimal = r.try_get("current_balance").unwrap_or(Decimal::ZERO);
        let reconciled: Decimal = r.try_get("reconciled_balance").unwrap_or(current_balance);
        let rate: Decimal = r.try_get("exchange_rate_to_aoa").unwrap_or(dec!(1.0));

        if currency == "AOA" {
            bank_balances_aoa += current_balance;
            reconciled_balance_aoa += reconciled;
        } else {
            let converted = current_balance * rate;
            foreign_reserves.push(ForeignCurrencyAccount {
                bank_name,
                currency,
                balance_original: current_balance,
                exchange_rate_to_aoa: rate,
                converted_aoa: converted,
            });
            bank_balances_aoa += converted;
            reconciled_balance_aoa += reconciled * rate;
        }
    }

    let cash_row = sqlx::query(
        "SELECT COALESCE(SUM(opening_balance), 0) AS total_opening \
         FROM kudiba_treasury.cash_sessions \
         WHERE tenant_id = $1 AND status = 'OPEN'",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let cash_in_hand_aoa: Decimal = cash_row.try_get("total_opening").unwrap_or(dec!(500000.0));
    let total_available_aoa = bank_balances_aoa + cash_in_hand_aoa;
    let pending_clearance_aoa = if total_available_aoa > reconciled_balance_aoa {
        total_available_aoa - reconciled_balance_aoa
    } else {
        Decimal::ZERO
    };

    Ok(CurrentLiquidityBreakdown {
        total_available_aoa,
        cash_in_hand_aoa,
        bank_balances_aoa,
        reconciled_balance_aoa,
        pending_clearance_aoa,
        foreign_reserves,
    })
}

async fn fetch_realized_flow(
    pool: &PgPool,
    tenant_id: Uuid,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<RealizedCashFlow, DomainError> {
    let start_ts = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end_ts = end_date.and_hms_opt(23, 59, 59).unwrap().and_utc();

    let receipt_rows = sqlx::query(
        "SELECT payment_method::text AS method, COUNT(*) AS count, \
                COALESCE(SUM(total_amount), 0) AS amount \
         FROM kudiba_treasury.treasury_receipts \
         WHERE tenant_id = $1 AND issued_at >= $2 AND issued_at <= $3 \
         GROUP BY payment_method",
    )
    .bind(tenant_id)
    .bind(start_ts)
    .bind(end_ts)
    .fetch_all(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let mut inflows_by_method = Vec::new();
    let mut total_receipts = Decimal::ZERO;

    for r in receipt_rows {
        let method: String = r.try_get("method").unwrap_or_else(|_| "TRANSFERENCIA".to_string());
        let amount: Decimal = r.try_get("amount").unwrap_or(Decimal::ZERO);
        let count: i64 = r.try_get("count").unwrap_or(0);
        total_receipts += amount;
        inflows_by_method.push(MethodBreakdown {
            method,
            amount,
            count,
        });
    }

    let pos_inflows_row = sqlx::query(
        "SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count \
         FROM kudiba_treasury.cash_movements \
         WHERE tenant_id = $1 AND movement_type = 'SALE_RECEIPT' \
           AND created_at >= $2 AND created_at <= $3",
    )
    .bind(tenant_id)
    .bind(start_ts)
    .bind(end_ts)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let pos_amount: Decimal = pos_inflows_row.try_get("amount").unwrap_or(Decimal::ZERO);
    let pos_count: i64 = pos_inflows_row.try_get("count").unwrap_or(0);
    if pos_count > 0 {
        inflows_by_method.push(MethodBreakdown {
            method: "NUMERARIO_POS".to_string(),
            amount: pos_amount,
            count: pos_count,
        });
    }

    let total_inflows = total_receipts + pos_amount;

    let payable_settlements = sqlx::query(
        "SELECT ip.category, ip.activity_type::text AS activity_type, \
                COALESCE(SUM(ps.amount_paid), 0) AS total \
         FROM kudiba_treasury.payable_settlements ps \
         JOIN kudiba_treasury.invoice_payables ip ON ps.payable_id = ip.id \
         WHERE ps.tenant_id = $1 AND ps.settled_at >= $2 AND ps.settled_at <= $3 \
         GROUP BY ip.category, ip.activity_type",
    )
    .bind(tenant_id)
    .bind(start_ts)
    .bind(end_ts)
    .fetch_all(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let mut operational_outflows = Decimal::ZERO;
    let mut investment_outflows = Decimal::ZERO;
    let mut financing_outflows = Decimal::ZERO;
    let mut outflows_by_category = Vec::new();

    for r in payable_settlements {
        let cat: String = r.try_get("category").unwrap_or_else(|_| "FORNECEDORES".to_string());
        let act: String = r.try_get("activity_type").unwrap_or_else(|_| "OPERATIONAL".to_string());
        let total: Decimal = r.try_get("total").unwrap_or(Decimal::ZERO);

        match act.as_str() {
            "INVESTMENT" => investment_outflows += total,
            "FINANCING" => financing_outflows += total,
            _ => operational_outflows += total,
        }

        outflows_by_category.push(CategoryBreakdown {
            category: cat,
            amount: total,
        });
    }

    let cash_expenses_row = sqlx::query(
        "SELECT COALESCE(SUM(amount), 0) AS amount \
         FROM kudiba_treasury.cash_movements \
         WHERE tenant_id = $1 AND movement_type = 'EXPENSE' \
           AND created_at >= $2 AND created_at <= $3",
    )
    .bind(tenant_id)
    .bind(start_ts)
    .bind(end_ts)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let cash_expenses: Decimal = cash_expenses_row.try_get("amount").unwrap_or(Decimal::ZERO);
    if cash_expenses > Decimal::ZERO {
        operational_outflows += cash_expenses;
        outflows_by_category.push(CategoryBreakdown {
            category: "DESPESAS_DE_CAIXA".to_string(),
            amount: cash_expenses,
        });
    }

    let total_outflows = operational_outflows + investment_outflows + financing_outflows;
    let net_cash_flow = total_inflows - total_outflows;

    Ok(RealizedCashFlow {
        total_inflows,
        total_outflows,
        net_cash_flow,
        operational: ActivityFlow {
            inflows: total_inflows,
            outflows: operational_outflows,
            net: total_inflows - operational_outflows,
        },
        investment: ActivityFlow {
            inflows: Decimal::ZERO,
            outflows: investment_outflows,
            net: -investment_outflows,
        },
        financing: ActivityFlow {
            inflows: Decimal::ZERO,
            outflows: financing_outflows,
            net: -financing_outflows,
        },
        inflows_by_method,
        outflows_by_category,
    })
}

async fn fetch_forecast_flow(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<ForecastCashFlow, DomainError> {
    let rec_row = sqlx::query(
        "SELECT COALESCE(SUM(gross_total), 0) AS total \
         FROM kudiba_treasury.invoice_receivables \
         WHERE tenant_id = $1 AND status = 'OUTSTANDING'",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let receivables_due: Decimal = rec_row.try_get("total").unwrap_or(Decimal::ZERO);

    let pay_row = sqlx::query(
        "SELECT COALESCE(SUM(net_payable - amount_paid), 0) AS total \
         FROM kudiba_treasury.invoice_payables \
         WHERE tenant_id = $1 AND status IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let payables_due: Decimal = pay_row.try_get("total").unwrap_or(Decimal::ZERO);

    let withholding_row = sqlx::query(
        "SELECT COALESCE(SUM(withholding_amount), 0) AS total \
         FROM kudiba_treasury.invoice_payables \
         WHERE tenant_id = $1 AND withholding_amount > 0 \
           AND status IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let withholding_retention: Decimal = withholding_row.try_get("total").unwrap_or(Decimal::ZERO);

    let estimated_iva = dec!(1850000.0);
    let estimated_irt = dec!(620000.0);
    let estimated_inss = dec!(340000.0);
    let estimated_payroll = dec!(4200000.0);

    let tax_obligations = vec![
        TaxObligationForecast {
            tax_type: "IVA_MENSAL".to_string(),
            due_date: "2026-10-30".to_string(),
            estimated_amount: estimated_iva,
            description: "Imposto sobre o Valor Acrescentado a entregar à AGT (vence dia 30)".to_string(),
        },
        TaxObligationForecast {
            tax_type: "IRT_FOLHA".to_string(),
            due_date: "2026-10-31".to_string(),
            estimated_amount: estimated_irt,
            description: "Retenção de IRT dos colaboradores a entregar à AGT (vence dia 31)".to_string(),
        },
        TaxObligationForecast {
            tax_type: "RETENCAO_6_5".to_string(),
            due_date: "2026-10-31".to_string(),
            estimated_amount: withholding_retention,
            description: "Retenção na Fonte de 6.5% sobre serviços de terceiros (vence dia 31)".to_string(),
        },
        TaxObligationForecast {
            tax_type: "INSS_SEGURANCA_SOCIAL".to_string(),
            due_date: "2026-11-10".to_string(),
            estimated_amount: estimated_inss,
            description: "Contribuição para a Segurança Social (8% entidade + 3% trabalhador, vence dia 10)".to_string(),
        },
    ];

    let estimated_taxes = estimated_iva + estimated_irt + withholding_retention + estimated_inss;
    let total_expected_inflows = receivables_due;
    let total_expected_outflows = payables_due + estimated_taxes + estimated_payroll;
    let net_expected_flow = total_expected_inflows - total_expected_outflows;

    Ok(ForecastCashFlow {
        receivables_due,
        payables_due,
        estimated_taxes,
        estimated_payroll,
        total_expected_inflows,
        total_expected_outflows,
        net_expected_flow,
        tax_obligations,
    })
}

async fn build_projections(
    today: NaiveDate,
    current_liquidity: Decimal,
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<DailyProjectionPoint>, DomainError> {
    let mut points = Vec::with_capacity(30);
    let mut running_balance = current_liquidity;
    let min_buffer = dec!(4000000.0);

    let payables_schedule = sqlx::query(
        "SELECT due_date, COALESCE(SUM(net_payable - amount_paid), 0) AS daily_payables \
         FROM kudiba_treasury.invoice_payables \
         WHERE tenant_id = $1 AND status IN ('OUTSTANDING', 'PARTIALLY_PAID') \
           AND due_date >= $2 AND due_date <= $2 + INTERVAL '30 days' \
         GROUP BY due_date",
    )
    .bind(tenant_id)
    .bind(today)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    use std::collections::HashMap;
    let mut payables_by_date: HashMap<NaiveDate, Decimal> = HashMap::new();
    for row in payables_schedule {
        if let Ok(d) = row.try_get::<NaiveDate, _>("due_date") {
            let amt = row.try_get::<Decimal, _>("daily_payables").unwrap_or(Decimal::ZERO);
            payables_by_date.insert(d, amt);
        }
    }

    for i in 0..30 {
        let date = today + chrono::Duration::days(i);
        let starting = running_balance;

        let expected_in = if i % 7 == 2 || i % 7 == 5 {
            dec!(1200000.0)
        } else if i % 7 == 0 || i % 7 == 6 {
            dec!(300000.0)
        } else {
            dec!(650000.0)
        };

        let mut expected_out = *payables_by_date.get(&date).unwrap_or(&Decimal::ZERO);

        if date.day() == 30 {
            expected_out += dec!(1850000.0); // IVA
        }
        if date.day() == 31 || (date.month() == 2 && date.day() == 28) {
            expected_out += dec!(4820000.0); // Salários + IRT
        }
        if date.day() == 10 {
            expected_out += dec!(340000.0); // INSS
        }

        let ending = starting + expected_in - expected_out;
        running_balance = ending;

        points.push(DailyProjectionPoint {
            date: date.to_string(),
            starting_balance: starting,
            expected_inflows: expected_in,
            expected_outflows: expected_out,
            ending_balance: ending,
            is_deficit_risk: ending < min_buffer,
        });
    }

    Ok(points)
}

async fn generate_alerts(
    pool: &PgPool,
    tenant_id: Uuid,
    forecast: &ForecastCashFlow,
) -> Result<Vec<TreasuryAlert>, DomainError> {
    let mut alerts = Vec::new();

    let overdue_row = sqlx::query(
        "SELECT COUNT(*) AS count, COALESCE(SUM(net_payable - amount_paid), 0) AS total \
         FROM kudiba_treasury.invoice_payables \
         WHERE tenant_id = $1 AND status IN ('OUTSTANDING', 'PARTIALLY_PAID') \
           AND due_date < CURRENT_DATE",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let overdue_count: i64 = overdue_row.try_get("count").unwrap_or(0);
    let overdue_total: Decimal = overdue_row.try_get("total").unwrap_or(Decimal::ZERO);

    if overdue_count > 0 {
        alerts.push(TreasuryAlert {
            severity: "DANGER".to_string(),
            title: "Faturas de Fornecedores Vencidas".to_string(),
            message: format!(
                "Existem {} faturas a pagar com prazo vencido, no total de {} Kz.",
                overdue_count, overdue_total
            ),
            due_date: None,
        });
    }

    alerts.push(TreasuryAlert {
        severity: "WARNING".to_string(),
        title: "Prazo AGT: Liquidação de IVA".to_string(),
        message: "O pagamento do IVA apurado do período fiscal vence a dia 30. Programe os fundos na conta bancária principal.".to_string(),
        due_date: Some("2026-10-30".to_string()),
    });

    alerts.push(TreasuryAlert {
        severity: "INFO".to_string(),
        title: "Prazo AGT: IRT e Retenções na Fonte".to_string(),
        message: format!(
            "Declaração e liquidação do IRT e Retenções na Fonte de 6.5% no total de {} Kz vencem no final do mês.",
            forecast.estimated_taxes
        ),
        due_date: Some("2026-10-31".to_string()),
    });

    let unreconciled_row = sqlx::query(
        "SELECT COUNT(*) AS count \
         FROM kudiba_treasury.bank_statement_lines \
         WHERE tenant_id = $1 AND is_reconciled = false",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

    let unreconciled_count: i64 = unreconciled_row.try_get("count").unwrap_or(0);
    if unreconciled_count > 0 {
        alerts.push(TreasuryAlert {
            severity: "INFO".to_string(),
            title: "Movimentos Pendentes de Conciliação".to_string(),
            message: format!(
                "Existem {} movimentos no extrato bancário a aguardar conciliação contra recibos ou faturas.",
                unreconciled_count
            ),
            due_date: None,
        });
    }

    Ok(alerts)
}
