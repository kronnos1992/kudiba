use chrono::{DateTime, Datelike, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCenterDto {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub parent_cost_center_id: Option<Uuid>,
    pub parent_code: Option<String>,
    pub parent_name: Option<String>,
    pub center_type: String,
    pub branch_name: String,
    pub department_name: Option<String>,
    pub responsible_employee_id: Option<Uuid>,
    pub responsible_name: Option<String>,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub monthly_budget: Decimal,
    pub committed_amount: Decimal,
    pub realized_opex: Decimal,
    pub realized_capex: Decimal,
    pub monthly_depreciation: Decimal,
    pub available_budget: Decimal,
    pub utilization_pct: Decimal,
    pub alert_threshold_pct: Decimal,
    pub budget_status: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCostCenterRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub parent_cost_center_id: Option<Uuid>,
    pub center_type: Option<String>,
    pub branch_name: Option<String>,
    pub department_name: Option<String>,
    pub responsible_name: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub monthly_budget: Option<Decimal>,
    pub alert_threshold_pct: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCostCenterRequest {
    pub name: String,
    pub description: Option<String>,
    pub parent_cost_center_id: Option<Uuid>,
    pub center_type: Option<String>,
    pub branch_name: Option<String>,
    pub department_name: Option<String>,
    pub responsible_name: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub monthly_budget: Option<Decimal>,
    pub alert_threshold_pct: Option<Decimal>,
    pub is_active: bool,
    pub committed_amount: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationRuleLineDto {
    pub id: Uuid,
    pub cost_center_id: Uuid,
    pub cost_center_code: String,
    pub cost_center_name: String,
    pub branch_name: String,
    pub percentage: Decimal,
    pub justification: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationRuleDto {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub allocation_basis: String,
    pub default_account_code: Option<String>,
    pub is_active: bool,
    pub total_percentage: Decimal,
    pub lines: Vec<AllocationRuleLineDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAllocationRuleLineReq {
    pub cost_center_id: Uuid,
    pub percentage: Decimal,
    pub justification: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAllocationRuleRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub allocation_basis: String,
    pub default_account_code: Option<String>,
    pub lines: Vec<CreateAllocationRuleLineReq>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocateExpenseLineReq {
    pub cost_center_id: Uuid,
    pub percentage: Decimal,
    pub allocated_units: Option<Decimal>,
    pub asset_tags: Option<String>,
    pub recipient_responsible: Option<String>,
    pub project_code: Option<String>,
    pub vehicle_or_asset: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocateExpenseRequest {
    pub tracking_scope: Option<String>,
    pub source_module: String,
    pub source_document_ref: String,
    pub supplier_name: Option<String>,
    pub purchase_order_ref: Option<String>,
    pub receipt_delivery_ref: Option<String>,
    pub payment_settlement_ref: Option<String>,
    pub journal_entry_ref: Option<String>,
    pub allocation_date: Option<NaiveDate>,
    pub account_code: String,
    pub account_name: String,
    pub is_capex: bool,
    pub total_amount: Decimal,
    pub total_units: Option<Decimal>,
    pub unit_measure: Option<String>,
    pub useful_life_months: Option<i32>,
    pub allocation_rule_id: Option<Uuid>,
    pub allocation_criterion: Option<String>,
    pub project_code: Option<String>,
    pub vehicle_or_asset: Option<String>,
    pub notes: Option<String>,
    pub lines: Vec<AllocateExpenseLineReq>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostAllocationRecordDto {
    pub id: Uuid,
    pub batch_id: Uuid,
    pub tracking_scope: String,
    pub source_module: String,
    pub source_document_ref: String,
    pub supplier_name: Option<String>,
    pub purchase_order_ref: Option<String>,
    pub receipt_delivery_ref: Option<String>,
    pub payment_settlement_ref: Option<String>,
    pub journal_entry_ref: Option<String>,
    pub allocation_date: NaiveDate,
    pub account_code: String,
    pub account_name: String,
    pub is_capex: bool,
    pub cost_center_id: Uuid,
    pub cost_center_code: String,
    pub cost_center_name: String,
    pub department_name: Option<String>,
    pub branch_name: String,
    pub project_code: Option<String>,
    pub vehicle_or_asset: Option<String>,
    pub allocation_criterion: Option<String>,
    pub percentage: Decimal,
    pub allocated_amount: Decimal,
    pub total_document_amount: Decimal,
    pub total_units: Option<Decimal>,
    pub allocated_units: Option<Decimal>,
    pub unit_measure: Option<String>,
    pub asset_tags: Option<String>,
    pub recipient_responsible: Option<String>,
    pub useful_life_months: Option<i32>,
    pub monthly_depreciation: Decimal,
    pub notes: Option<String>,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostTraceChainDto {
    pub batch_id: Uuid,
    pub tracking_scope: String,
    pub source_module: String,
    pub source_document_ref: String,
    pub supplier_name: Option<String>,
    pub purchase_order_ref: Option<String>,
    pub receipt_delivery_ref: Option<String>,
    pub payment_settlement_ref: Option<String>,
    pub journal_entry_ref: Option<String>,
    pub allocation_date: NaiveDate,
    pub account_code: String,
    pub account_name: String,
    pub is_capex: bool,
    pub total_document_amount: Decimal,
    pub total_units: Option<Decimal>,
    pub unit_measure: Option<String>,
    pub useful_life_months: Option<i32>,
    pub total_monthly_depreciation: Decimal,
    pub project_code: Option<String>,
    pub vehicle_or_asset: Option<String>,
    pub allocation_criterion: Option<String>,
    pub splits: Vec<CostAllocationRecordDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostReclassificationDto {
    pub id: Uuid,
    pub allocation_id: Option<Uuid>,
    pub batch_id: Uuid,
    pub source_document_ref: String,
    pub from_cost_center_id: Uuid,
    pub from_cost_center_code: String,
    pub from_cost_center_name: String,
    pub to_cost_center_id: Uuid,
    pub to_cost_center_code: String,
    pub to_cost_center_name: String,
    pub transferred_units: Option<Decimal>,
    pub transferred_amount: Decimal,
    pub asset_tags_moved: Option<String>,
    pub reason: String,
    pub performed_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReclassifyCostAllocationRequest {
    pub allocation_id: Uuid,
    pub to_cost_center_id: Uuid,
    pub transferred_amount: Decimal,
    pub transferred_units: Option<Decimal>,
    pub asset_tags_moved: Option<String>,
    pub reason: String,
    pub performed_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepartmentCostSummaryDto {
    pub department_name: String,
    pub branch_name: String,
    pub budget_amount: Decimal,
    pub realized_opex: Decimal,
    pub committed_amount: Decimal,
    pub realized_capex: Decimal,
    pub monthly_depreciation: Decimal,
    pub utilization_pct: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchCostSummaryDto {
    pub branch_name: String,
    pub centers_count: i64,
    pub total_budget: Decimal,
    pub realized_opex: Decimal,
    pub committed_amount: Decimal,
    pub realized_capex: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAssetSummaryDto {
    pub dimension_type: String,
    pub code: String,
    pub total_opex: Decimal,
    pub total_capex: Decimal,
    pub monthly_depreciation: Decimal,
    pub total_units: Option<Decimal>,
    pub unit_measure: Option<String>,
    pub documents_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyCostTrendDto {
    pub month_label: String,
    pub period_month: i32,
    pub budget_total: Decimal,
    pub realized_opex: Decimal,
    pub realized_capex: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnassignedExpenseDto {
    pub entry_id: Uuid,
    pub entry_number: i64,
    pub transaction_date: NaiveDate,
    pub source_document_ref: Option<String>,
    pub account_code: String,
    pub description: String,
    pub amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCenterAuditLogDto {
    pub id: Uuid,
    pub action: String,
    pub entity_ref: String,
    pub details: String,
    pub performed_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCenterDashboardResponse {
    pub total_budget_monthly: Decimal,
    pub total_realized_opex: Decimal,
    pub total_committed: Decimal,
    pub total_realized_capex: Decimal,
    pub total_monthly_depreciation: Decimal,
    pub total_available_budget: Decimal,
    pub overall_utilization_pct: Decimal,
    pub active_centers_count: usize,
    pub centers_over_80_pct: usize,
    pub centers_over_100_pct: usize,
    pub centers_without_responsible_or_budget: usize,
    pub unassigned_expenses_count: usize,
    pub centers: Vec<CostCenterDto>,
    pub by_department: Vec<DepartmentCostSummaryDto>,
    pub by_branch: Vec<BranchCostSummaryDto>,
    pub by_project_and_asset: Vec<ProjectAssetSummaryDto>,
    pub monthly_trend: Vec<MonthlyCostTrendDto>,
    pub allocation_rules: Vec<AllocationRuleDto>,
    pub recent_allocations: Vec<CostAllocationRecordDto>,
    pub trace_chains: Vec<CostTraceChainDto>,
    pub reclassifications: Vec<CostReclassificationDto>,
    pub unassigned_expenses: Vec<UnassignedExpenseDto>,
    pub audit_logs: Vec<CostCenterAuditLogDto>,
}

pub struct CostCenterService {
    pool: PgPool,
}

impl CostCenterService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn ensure_seeded(&self, tenant_id: Uuid) -> Result<(), DomainError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM kudiba_accounting.cost_centers WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if count > 0 {
            return Ok(());
        }

        self.seed_default_structure(tenant_id).await
    }

    pub async fn seed_default_structure(&self, tenant_id: Uuid) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let root_luanda_id = Uuid::new_v4();
        let root_benguela_id = Uuid::new_v4();
        let cc_ti_id = Uuid::new_v4();
        let cc_rh_id = Uuid::new_v4();
        let cc_vnd_id = Uuid::new_v4();
        let cc_ops_id = Uuid::new_v4();
        let cc_fin_id = Uuid::new_v4();
        let cc_ben_adm_id = Uuid::new_v4();
        let cc_ben_vnd_id = Uuid::new_v4();
        let cc_mkt_id = Uuid::new_v4();

        let centers = vec![
            (
                root_luanda_id,
                "CC-LUA-000",
                "Sede Corporativa — Luanda",
                Some("Unidade agregadora da Sede Principal em Luanda (Talatona / Ingombota)"),
                None::<Uuid>,
                "SHARED_SERVICE",
                "Sede - Luanda",
                Some("Direção Geral"),
                Some("Dr. Mateus Domingos"),
                Decimal::new(0, 0),
                Decimal::new(80, 0),
            ),
            (
                root_benguela_id,
                "CC-BEN-000",
                "Filial Regional Sul — Benguela",
                Some("Unidade agregadora da Filial de Benguela e entreposto comercial"),
                None::<Uuid>,
                "SHARED_SERVICE",
                "Filial - Benguela",
                Some("Direção Regional"),
                Some("Eng.ª Carla Joaquim"),
                Decimal::new(0, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_ti_id,
                "CC-TI-001",
                "Departamento de TI & Sistemas",
                Some("Infraestrutura tecnológica, servidores, ERP, telecomunicações e suporte técnico"),
                Some(root_luanda_id),
                "COST_CENTER",
                "Sede - Luanda",
                Some("TI"),
                Some("Eng.º Osvaldo Neto"),
                Decimal::new(1_500_000, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_rh_id,
                "CC-RH-001",
                "Departamento de Recursos Humanos",
                Some("Gestão de pessoal, formação profissional, medicina no trabalho e recrutamento"),
                Some(root_luanda_id),
                "COST_CENTER",
                "Sede - Luanda",
                Some("RH"),
                Some("Dra. Helena Sebastião"),
                Decimal::new(1_400_000, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_vnd_id,
                "CC-VND-001",
                "Direção Comercial & Vendas Luanda",
                Some("Equipa comercial de Luanda, showroom, prospeção e atendimento B2B/B2C"),
                Some(root_luanda_id),
                "PROFIT_CENTER",
                "Sede - Luanda",
                Some("Vendas"),
                Some("Paulo Cassule"),
                Decimal::new(2_800_000, 0),
                Decimal::new(85, 0),
            ),
            (
                cc_ops_id,
                "CC-OPS-001",
                "Operações, Frota & Logística",
                Some("Distribuição, armazém central, manutenção de frota automóvel e geradores"),
                Some(root_luanda_id),
                "COST_CENTER",
                "Sede - Luanda",
                Some("Operações"),
                Some("João Baptista"),
                Decimal::new(5_500_000, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_fin_id,
                "CC-FIN-001",
                "Departamento de Finanças & Contabilidade",
                Some("Contabilidade geral e analítica, tesouraria, auditoria e obrigações fiscais AGT"),
                Some(root_luanda_id),
                "COST_CENTER",
                "Sede - Luanda",
                Some("Finanças"),
                Some("Dr. António Manuel"),
                Decimal::new(1_500_000, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_ben_adm_id,
                "CC-BEN-ADM",
                "Administração Local — Benguela",
                Some("Gestão administrativa, segurança, renda e serviços gerais do estabelecimento de Benguela"),
                Some(root_benguela_id),
                "COST_CENTER",
                "Filial - Benguela",
                Some("Administração Local"),
                Some("Eng.ª Carla Joaquim"),
                Decimal::new(900_000, 0),
                Decimal::new(80, 0),
            ),
            (
                cc_ben_vnd_id,
                "CC-BEN-VND",
                "Vendas & Balcão Comercial — Benguela",
                Some("Operação comercial e distribuição na província de Benguela e Lobito"),
                Some(root_benguela_id),
                "PROFIT_CENTER",
                "Filial - Benguela",
                Some("Vendas"),
                Some("Sebastião Lemos"),
                Decimal::new(1_200_000, 0),
                Decimal::new(85, 0),
            ),
            (
                cc_mkt_id,
                "CC-MKT-002",
                "Núcleo de Eventos & Feiras (FILDA)",
                Some("Centro temporário para feiras e exposições — pendente de nomeação de responsável e orçamento"),
                Some(root_luanda_id),
                "PROJECT_UNIT",
                "Sede - Luanda",
                Some("Marketing"),
                None::<&str>,
                Decimal::new(0, 0),
                Decimal::new(80, 0),
            ),
        ];

        for (id, code, name, desc, parent_id, ctype, branch, dept, resp, budget, alert_pct) in centers {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_centers (
                    id, tenant_id, code, name, description, parent_cost_center_id,
                    center_type, branch_name, department_name, responsible_name,
                    valid_from, monthly_budget, alert_threshold_pct, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '2026-01-01', $11, $12, TRUE)
                ON CONFLICT (tenant_id, code) DO NOTHING
                "#,
            )
            .bind(id)
            .bind(tenant_id)
            .bind(code)
            .bind(name)
            .bind(desc)
            .bind(parent_id)
            .bind(ctype)
            .bind(branch)
            .bind(dept)
            .bind(resp)
            .bind(budget)
            .bind(alert_pct)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let current_month = Utc::now().month() as i32;
        let budgets = vec![
            (cc_ti_id, Decimal::new(1_500_000, 0), Decimal::new(150_000, 0), "Licenças cloud e contrato manutenção UPS"),
            (cc_rh_id, Decimal::new(1_400_000, 0), Decimal::new(80_000, 0), "Formação Lei Geral do Trabalho e Seguros"),
            (cc_vnd_id, Decimal::new(2_800_000, 0), Decimal::new(220_000, 0), "Campanha comercial e deslocações clientes"),
            (cc_ops_id, Decimal::new(5_500_000, 0), Decimal::new(480_000, 0), "Encomenda de peças de revisão de frota"),
            (cc_fin_id, Decimal::new(1_500_000, 0), Decimal::new(90_000, 0), "Auditoria externa e certificação OCPCA"),
            (cc_ben_adm_id, Decimal::new(900_000, 0), Decimal::new(60_000, 0), "Serviços de segurança e conservação Benguela"),
            (cc_ben_vnd_id, Decimal::new(1_200_000, 0), Decimal::new(110_000, 0), "Logística comercial Lobito/Benguela"),
        ];

        for (cid, approved, committed, note) in budgets {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_budgets (
                    tenant_id, cost_center_id, fiscal_year, period_month,
                    account_category, approved_budget, committed_amount, notes
                )
                VALUES ($1, $2, 2026, $3, 'GERAL', $4, $5, $6)
                ON CONFLICT (tenant_id, cost_center_id, fiscal_year, period_month, account_category) DO NOTHING
                "#,
            )
            .bind(tenant_id)
            .bind(cid)
            .bind(current_month)
            .bind(approved)
            .bind(committed)
            .bind(note)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let rule_ende_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_allocation_rules (
                id, tenant_id, code, name, description, allocation_basis, default_account_code, is_active
            )
            VALUES (
                $1, $2, 'REG-ENDE-01',
                'Repartição de Energia Elétrica (ENDE — Sede Luanda)',
                'Distribuição mensal da fatura partilhada de eletricidade com base na potência instalada (servidores/AC) e área ocupada por departamento.',
                'CONSUMO_POTENCIA_E_AREA',
                '75.2.11',
                TRUE
            )
            ON CONFLICT (tenant_id, code) DO NOTHING
            "#,
        )
        .bind(rule_ende_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let ende_lines = vec![
            (cc_ti_id, Decimal::new(30, 0), "30% — Datacenter, servidores e refrigeração dedicada 24/7"),
            (cc_rh_id, Decimal::new(20, 0), "20% — Piso administrativo RH e sala de formação"),
            (cc_vnd_id, Decimal::new(35, 0), "35% — Showroom comercial e atendimento ao cliente"),
            (cc_fin_id, Decimal::new(15, 0), "15% — Gabinetes de Contabilidade e Tesouraria"),
        ];
        for (cid, pct, just) in ende_lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_allocation_rule_lines (
                    rule_id, tenant_id, cost_center_id, percentage, justification
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(rule_ende_id)
            .bind(tenant_id)
            .bind(cid)
            .bind(pct)
            .bind(just)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let rule_net_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_allocation_rules (
                id, tenant_id, code, name, description, allocation_basis, default_account_code, is_active
            )
            VALUES (
                $1, $2, 'REG-NET-02',
                'Repartição de Internet Fibra Dedicada & Redundância',
                'Distribuição por largura de banda reservada e número de postos de trabalho ativos.',
                'POSTOS_TRABALHO_E_BANDA',
                '75.2.20',
                TRUE
            )
            ON CONFLICT (tenant_id, code) DO NOTHING
            "#,
        )
        .bind(rule_net_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let net_lines = vec![
            (cc_ti_id, Decimal::new(40, 0), "40% — Infraestrutura VPN, servidores cloud e backups"),
            (cc_vnd_id, Decimal::new(30, 0), "30% — Terminais POS, CRM comercial e equipa de vendas"),
            (cc_fin_id, Decimal::new(15, 0), "15% — Submissão SAF-T AGT, Homebanking e Contabilidade"),
            (cc_rh_id, Decimal::new(15, 0), "15% — Portal de RH, relógio de ponto e processamento salarial"),
        ];
        for (cid, pct, just) in net_lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_allocation_rule_lines (
                    rule_id, tenant_id, cost_center_id, percentage, justification
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(rule_net_id)
            .bind(tenant_id)
            .bind(cid)
            .bind(pct)
            .bind(just)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let rule_beng_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_allocation_rules (
                id, tenant_id, code, name, description, allocation_basis, default_account_code, is_active
            )
            VALUES (
                $1, $2, 'REG-BEN-RENDA',
                'Repartição de Renda e Condomínio — Filial Benguela',
                'Critério de área útil ocupada em metros quadrados (m²) no imóvel da Filial de Benguela.',
                'AREA_OCUPADA_M2',
                '75.2.21',
                TRUE
            )
            ON CONFLICT (tenant_id, code) DO NOTHING
            "#,
        )
        .bind(rule_beng_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let beng_lines = vec![
            (cc_ben_adm_id, Decimal::new(40, 0), "40% — Escritórios administrativos (80 m²)"),
            (cc_ben_vnd_id, Decimal::new(60, 0), "60% — Loja comercial e showroom Benguela (120 m²)"),
        ];
        for (cid, pct, just) in beng_lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_allocation_rule_lines (
                    rule_id, tenant_id, cost_center_id, percentage, justification
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(rule_beng_id)
            .bind(tenant_id)
            .bind(cid)
            .bind(pct)
            .bind(just)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let batch_a = Uuid::new_v4();
        let batch_b = Uuid::new_v4();
        let batch_c = Uuid::new_v4();
        let batch_d = Uuid::new_v4();
        let batch_e = Uuid::new_v4();
        let batch_f = Uuid::new_v4();
        let batch_g = Uuid::new_v4();
        let batch_h = Uuid::new_v4();
        let batch_i = Uuid::new_v4();

        let alloc_ti_pc_id = Uuid::new_v4();
        let alloc_rh_pc_id = Uuid::new_v4();
        let alloc_vnd_pc_id = Uuid::new_v4();

        // 1. OPERAÇÃO PRINCIPAL DE RASTREIO: Compra de 10 Computadores por Kz 5.000.000
        // Distribuídos por TI (4 un = 2.000.000 Kz), RH (3 un = 1.500.000 Kz) e Comercial/Vendas (3 un = 1.500.000 Kz)
        // Reconhecidos como Ativo Fixo (Conta 11.5) com depreciação contabilística mensal em 48 meses (25%/ano).
        let pc_splits = vec![
            (
                alloc_ti_pc_id,
                cc_ti_id,
                Decimal::new(40, 0),
                Decimal::new(2_000_000, 0),
                Decimal::new(4, 0),
                "PAT-TI-001, PAT-TI-002, PAT-TI-003, PAT-TI-004",
                "Eng.º Osvaldo Neto",
                Decimal::new(416_666_7, 2),
                "4 computadores atribuídos ao Departamento de TI (Kz 2.000.000 CAPEX | Quota mensal de amortização 73.1: Kz 41.666,67).",
            ),
            (
                alloc_rh_pc_id,
                cc_rh_id,
                Decimal::new(30, 0),
                Decimal::new(1_500_000, 0),
                Decimal::new(3, 0),
                "PAT-RH-001, PAT-RH-002, PAT-RH-003",
                "Dra. Helena Sebastião",
                Decimal::new(312_500_0, 2),
                "3 computadores atribuídos ao Departamento de RH (Kz 1.500.000 CAPEX | Quota mensal de amortização 73.1: Kz 31.250,00).",
            ),
            (
                alloc_vnd_pc_id,
                cc_vnd_id,
                Decimal::new(30, 0),
                Decimal::new(1_500_000, 0),
                Decimal::new(3, 0),
                "PAT-VND-001, PAT-VND-002, PAT-VND-003",
                "Paulo Cassule",
                Decimal::new(312_500_0, 2),
                "3 computadores atribuídos ao Departamento Comercial / Vendas (Kz 1.500.000 CAPEX | Quota mensal de amortização 73.1: Kz 31.250,00).",
            ),
        ];

        for (alloc_id, cid, pct, alloc_amt, units, tags, resp, monthly_dep, note) in pc_splits {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_allocations (
                    id, tenant_id, batch_id, tracking_scope, source_module, source_document_ref,
                    supplier_name, purchase_order_ref, receipt_delivery_ref, payment_settlement_ref, journal_entry_ref,
                    allocation_date, period_month, fiscal_year, account_code, account_name,
                    is_capex, cost_center_id, branch_name, project_code, vehicle_or_asset,
                    allocation_criterion, percentage, allocated_amount, total_document_amount,
                    total_units, allocated_units, unit_measure, asset_tags, recipient_responsible,
                    useful_life_months, monthly_depreciation, notes, created_by
                )
                VALUES (
                    $1, $2, $3, 'ATIVO_UNIDADE', 'COMPRAS', 'FT SISTEC-2026/00412',
                    'SISTEC Angola, S.A.', 'OC 2026/00142', 'GR 2026/00089 (10 Computadores)', 'RC 2026/00310 (BAI)', 'COMP #2026/0045',
                    $4, $5, 2026, '11.5', 'Equipamento Administrativo e Informático (Ativo Imobilizado)',
                    TRUE, $6, 'Sede - Luanda', 'PRJ-RENOV-PARQUE-26', 'Lote 10 Computadores Dell Latitude 5540',
                    'Distribuição Física por Termo de Entrega de Equipamentos (10 Unidades = Kz 5.000.000)',
                    $7, $8, 5000000.00,
                    10.00, $9, 'Computadores', $10, $11,
                    48, $12, $13, 'Dr. António Manuel (OCPCA)'
                )
                "#,
            )
            .bind(alloc_id)
            .bind(tenant_id)
            .bind(batch_a)
            .bind(NaiveDate::from_ymd_opt(2026, 10, 5).unwrap())
            .bind(current_month)
            .bind(cid)
            .bind(pct)
            .bind(alloc_amt)
            .bind(units)
            .bind(tags)
            .bind(resp)
            .bind(monthly_dep)
            .bind(note)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        // Registar um histórico de reclassificação demonstrativo para o lote de computadores
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_tracking_reclassifications (
                tenant_id, allocation_id, batch_id, source_document_ref,
                from_cost_center_id, to_cost_center_id, transferred_units, transferred_amount,
                asset_tags_moved, reason, performed_by
            )
            VALUES (
                $1, $2, $3, 'FT SISTEC-2026/00412',
                $4, $5, 1.00, 500000.00,
                'PAT-TI-004',
                'Reafetação de 1 portátil (PAT-TI-004) inicialmente previsto para reserva comercial para o novo Engenheiro de Redes admitido no Departamento de TI (ajustando a distribuição final para 4 TI / 3 RH / 3 Comercial).',
                'Dr. António Manuel (Contabilista Chefe OCPCA)'
            )
            "#,
        )
        .bind(tenant_id)
        .bind(alloc_ti_pc_id)
        .bind(batch_a)
        .bind(cc_vnd_id)
        .bind(cc_ti_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        // 2. Demais operações rastreadas (Casos B, C, D + Folhas + Filial Benguela)
        let sample_allocations = vec![
            // Caso B — Fatura de Eletricidade Partilhada (Kz 600.000 distribuída 30% / 20% / 35% / 15%)
            (
                batch_b,
                "DOCUMENTO",
                "TESOURARIA",
                "FT ENDE-2026/10982",
                Some("ENDE — Empresa Nacional de Distribuição de Electricidade"),
                Some("CONTRATO-ENDE-LUA"),
                Some("LEITURA-OUT-2026 (18.400 kWh)"),
                Some("RC 2026/00318 (Multicaixa Corporate)"),
                Some("CAIXA #2026/0112"),
                NaiveDate::from_ymd_opt(2026, 10, 10).unwrap(),
                current_month,
                "75.2.11",
                "Água e Electricidade (FSE)",
                false,
                cc_ti_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                Some(rule_ende_id),
                Some("Regra REG-ENDE-01 (30% Consumo Datacenter)"),
                Decimal::new(30, 0),
                Decimal::new(180_000, 0),
                Decimal::new(600_000, 0),
                Some(Decimal::new(18_400, 0)),
                Some(Decimal::new(5_520, 0)),
                Some("kWh"),
                Some("Contador Quadro Datacenter Q-TI-01"),
                Some("Eng.º Osvaldo Neto"),
                "Caso B: Quota-parte TI (30%) da fatura mensal de eletricidade ENDE.",
            ),
            (
                batch_b,
                "DOCUMENTO",
                "TESOURARIA",
                "FT ENDE-2026/10982",
                Some("ENDE — Empresa Nacional de Distribuição de Electricidade"),
                Some("CONTRATO-ENDE-LUA"),
                Some("LEITURA-OUT-2026 (18.400 kWh)"),
                Some("RC 2026/00318 (Multicaixa Corporate)"),
                Some("CAIXA #2026/0112"),
                NaiveDate::from_ymd_opt(2026, 10, 10).unwrap(),
                current_month,
                "75.2.11",
                "Água e Electricidade (FSE)",
                false,
                cc_rh_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                Some(rule_ende_id),
                Some("Regra REG-ENDE-01 (20% Área Administrativa RH)"),
                Decimal::new(20, 0),
                Decimal::new(120_000, 0),
                Decimal::new(600_000, 0),
                Some(Decimal::new(18_400, 0)),
                Some(Decimal::new(3_680, 0)),
                Some("kWh"),
                Some("Piso 1 — Ala Recursos Humanos"),
                Some("Dra. Helena Sebastião"),
                "Caso B: Quota-parte RH (20%) da fatura mensal de eletricidade ENDE.",
            ),
            (
                batch_b,
                "DOCUMENTO",
                "TESOURARIA",
                "FT ENDE-2026/10982",
                Some("ENDE — Empresa Nacional de Distribuição de Electricidade"),
                Some("CONTRATO-ENDE-LUA"),
                Some("LEITURA-OUT-2026 (18.400 kWh)"),
                Some("RC 2026/00318 (Multicaixa Corporate)"),
                Some("CAIXA #2026/0112"),
                NaiveDate::from_ymd_opt(2026, 10, 10).unwrap(),
                current_month,
                "75.2.11",
                "Água e Electricidade (FSE)",
                false,
                cc_vnd_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                Some(rule_ende_id),
                Some("Regra REG-ENDE-01 (35% Showroom Vendas)"),
                Decimal::new(35, 0),
                Decimal::new(210_000, 0),
                Decimal::new(600_000, 0),
                Some(Decimal::new(18_400, 0)),
                Some(Decimal::new(6_440, 0)),
                Some("kWh"),
                Some("Showroom R/C Luanda"),
                Some("Paulo Cassule"),
                "Caso B: Quota-parte Vendas (35%) da fatura mensal de eletricidade ENDE.",
            ),
            (
                batch_b,
                "DOCUMENTO",
                "TESOURARIA",
                "FT ENDE-2026/10982",
                Some("ENDE — Empresa Nacional de Distribuição de Electricidade"),
                Some("CONTRATO-ENDE-LUA"),
                Some("LEITURA-OUT-2026 (18.400 kWh)"),
                Some("RC 2026/00318 (Multicaixa Corporate)"),
                Some("CAIXA #2026/0112"),
                NaiveDate::from_ymd_opt(2026, 10, 10).unwrap(),
                current_month,
                "75.2.11",
                "Água e Electricidade (FSE)",
                false,
                cc_fin_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                Some(rule_ende_id),
                Some("Regra REG-ENDE-01 (15% Gabinetes Finanças)"),
                Decimal::new(15, 0),
                Decimal::new(90_000, 0),
                Decimal::new(600_000, 0),
                Some(Decimal::new(18_400, 0)),
                Some(Decimal::new(2_760, 0)),
                Some("kWh"),
                Some("Piso 2 — Finanças e Contabilidade"),
                Some("Dr. António Manuel"),
                "Caso B: Quota-parte Finanças (15%) da fatura mensal de eletricidade ENDE.",
            ),
            // Caso C — Combustível de Viatura (Operações & Logística)
            (
                batch_c,
                "ATIVO_UNIDADE",
                "INVENTARIO",
                "FR SONANGOL-2026/8821",
                Some("Sonangol Distribuidora, S.A."),
                Some("REQ-FROTA-2026/114"),
                Some("GT 2026/089 (Guia de Abastecimento)"),
                Some("Cartão Frota Pumangol/Sonangol #4491"),
                Some("DIV #2026/0098"),
                NaiveDate::from_ymd_opt(2026, 10, 14).unwrap(),
                current_month,
                "75.2.13",
                "Combustíveis e Lubrificantes (Frota)",
                false,
                cc_ops_id,
                "Sede - Luanda",
                Some("PRJ-DISTRIB-SUL"),
                Some("Viatura LD-44-82-IA (Toyota Hilux)"),
                None::<Uuid>,
                Some("Quilometragem e Guia de Transporte GT 2026/089"),
                Decimal::new(100, 0),
                Decimal::new(850_000, 0),
                Decimal::new(850_000, 0),
                Some(Decimal::new(4_250, 0)),
                Some(Decimal::new(4_250, 0)),
                Some("Litros Gasóleo"),
                Some("Viatura LD-44-82-IA + Cisterna Apoio"),
                Some("João Baptista"),
                "Caso C: Abastecimento de frota logística afeta às entregas interprovinciais.",
            ),
            // Caso D — Desenvolvimento de Projeto (Modernização Datacenter & ERP)
            (
                batch_d,
                "PROJETO",
                "COMPRAS",
                "FT CONSULT-2026/0095",
                Some("Angola Cables / NetOne Tech Services"),
                Some("OC 2026/00155"),
                Some("AUTO-MEDICAO-DC-04"),
                Some("RC 2026/00342 (BFA)"),
                Some("COMP #2026/0051"),
                NaiveDate::from_ymd_opt(2026, 10, 18).unwrap(),
                current_month,
                "75.2.20",
                "Comunicações, Cloud e Serviços Técnicos de TI",
                false,
                cc_ti_id,
                "Sede - Luanda",
                Some("PRJ-DATACENTER-26"),
                Some("Cluster Servidores Luanda"),
                None::<Uuid>,
                Some("Horas técnicas de implementação e conectividade"),
                Decimal::new(100, 0),
                Decimal::new(1_020_000, 0),
                Decimal::new(1_020_000, 0),
                Some(Decimal::new(68, 0)),
                Some(Decimal::new(68, 0)),
                Some("Horas Técnicas"),
                Some("Rack Principal DC-LUA-01"),
                Some("Eng.º Osvaldo Neto"),
                "Caso D: Serviços externos e infraestrutura do projeto Modernização do Datacenter.",
            ),
            // Custos adicionais dos departamentos para compor o Mapa Mensal de ~13.200.000 Kz
            (
                batch_e,
                "DOCUMENTO",
                "RH",
                "FOLHA-OUT-2026/OPS",
                Some("Processamento Salarial Interno (KudibaPayroll)"),
                Some("LOTE-SAL-2026/10"),
                Some("MAPA-IRT-INSS-OUT26"),
                Some("ORD-TRANSF-BAI-1026"),
                Some("SAL #2026/0010"),
                NaiveDate::from_ymd_opt(2026, 10, 22).unwrap(),
                current_month,
                "72.2",
                "Remunerações e Encargos Operacionais & Manutenção",
                false,
                cc_ops_id,
                "Sede - Luanda",
                None::<&str>,
                Some("Frota de 6 Viaturas + Armazém Central"),
                None::<Uuid>,
                Some("Folha Salarial + Manutenção Preventiva de Frota"),
                Decimal::new(100, 0),
                Decimal::new(4_150_000, 0),
                Decimal::new(4_150_000, 0),
                Some(Decimal::new(18, 0)),
                Some(Decimal::new(18, 0)),
                Some("Colaboradores"),
                Some("Equipa Logística & Motoristas"),
                Some("João Baptista"),
                "Custos operacionais de armazém, motoristas e conservação de frota (Total Operações = 5.000.000 Kz).",
            ),
            (
                batch_f,
                "DOCUMENTO",
                "RH",
                "FOLHA-OUT-2026/VND-LUA",
                Some("Processamento Salarial Interno (KudibaPayroll)"),
                Some("LOTE-SAL-2026/10"),
                Some("MAPA-COMISSOES-OUT26"),
                Some("ORD-TRANSF-BAI-1026"),
                Some("SAL #2026/0010"),
                NaiveDate::from_ymd_opt(2026, 10, 22).unwrap(),
                current_month,
                "72.2",
                "Remunerações e Comissões Equipa Comercial Luanda",
                false,
                cc_vnd_id,
                "Sede - Luanda",
                Some("PRJ-EXPANSAO-B2B"),
                None::<&str>,
                None::<Uuid>,
                Some("Imputação Direta Folha Comercial Luanda"),
                Decimal::new(100, 0),
                Decimal::new(2_290_000, 0),
                Decimal::new(2_290_000, 0),
                Some(Decimal::new(10, 0)),
                Some(Decimal::new(10, 0)),
                Some("Colaboradores"),
                Some("Equipa Comercial Sede Luanda"),
                Some("Paulo Cassule"),
                "Salários base, subsídios de alimentação/transporte e comissões de vendas Luanda.",
            ),
            (
                batch_g,
                "DOCUMENTO",
                "RH",
                "FOLHA-OUT-2026/RH-ADM",
                Some("Processamento Salarial Interno (KudibaPayroll)"),
                Some("LOTE-SAL-2026/10"),
                Some("MAPA-RH-FORMACAO-OUT26"),
                Some("ORD-TRANSF-BAI-1026"),
                Some("SAL #2026/0010"),
                NaiveDate::from_ymd_opt(2026, 10, 22).unwrap(),
                current_month,
                "72.2",
                "Remunerações, Medicina no Trabalho e Formação RH",
                false,
                cc_rh_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                None::<Uuid>,
                Some("Imputação Direta Departamento de RH"),
                Decimal::new(100, 0),
                Decimal::new(1_080_000, 0),
                Decimal::new(1_080_000, 0),
                Some(Decimal::new(5, 0)),
                Some(Decimal::new(5, 0)),
                Some("Colaboradores"),
                Some("Equipa de Gestão de Capital Humano"),
                Some("Dra. Helena Sebastião"),
                "Custos mensais de funcionamento do departamento de Recursos Humanos (Total RH = 1.200.000 Kz).",
            ),
            (
                batch_h,
                "DOCUMENTO",
                "CONTABILIDADE",
                "FT AUDIT-2026/0310",
                Some("PKF Angola / Consultoria & Pessoal Financeiro"),
                Some("OC 2026/00119"),
                Some("REL-AUDITORIA-Q3"),
                Some("RC 2026/00350"),
                Some("DIV #2026/0104"),
                NaiveDate::from_ymd_opt(2026, 10, 23).unwrap(),
                current_month,
                "75.2.26",
                "Serviços Financeiros, Auditoria e Pessoal de Finanças",
                false,
                cc_fin_id,
                "Sede - Luanda",
                None::<&str>,
                None::<&str>,
                None::<Uuid>,
                Some("Imputação Direta Departamento Financeiro"),
                Decimal::new(100, 0),
                Decimal::new(1_210_000, 0),
                Decimal::new(1_210_000, 0),
                Some(Decimal::new(6, 0)),
                Some(Decimal::new(6, 0)),
                Some("Colaboradores/Serviços"),
                Some("Contabilidade, Tesouraria e Fiscalidade"),
                Some("Dr. António Manuel"),
                "Custos mensais do Departamento de Finanças (Total Finanças = 1.300.000 Kz).",
            ),
            (
                batch_i,
                "DOCUMENTO",
                "TESOURARIA",
                "FT IMOB-BEN-2026/10",
                Some("Sociedade Imobiliária Acácias de Benguela, Lda."),
                Some("CONTRATO-ARREND-BEN-01"),
                Some("RECIBO-RENDA-OUT26"),
                Some("RC 2026/00360 (BAI)"),
                Some("CAIXA #2026/0120"),
                NaiveDate::from_ymd_opt(2026, 10, 24).unwrap(),
                current_month,
                "75.2.21",
                "Rendas, Operação e Equipa da Filial de Benguela",
                false,
                cc_ben_adm_id,
                "Filial - Benguela",
                None::<&str>,
                None::<&str>,
                Some(rule_beng_id),
                Some("Regra REG-BEN-RENDA (40% Administração Local Benguela)"),
                Decimal::new(40, 0),
                Decimal::new(800_000, 0),
                Decimal::new(2_000_000, 0),
                Some(Decimal::new(200, 0)),
                Some(Decimal::new(80, 0)),
                Some("m²"),
                Some("Escritórios Administrativos Benguela (80 m²)"),
                Some("Eng.ª Carla Joaquim"),
                "Quota-parte administrativa dos custos operacionais da Filial de Benguela.",
            ),
            (
                batch_i,
                "DOCUMENTO",
                "TESOURARIA",
                "FT IMOB-BEN-2026/10",
                Some("Sociedade Imobiliária Acácias de Benguela, Lda."),
                Some("CONTRATO-ARREND-BEN-01"),
                Some("RECIBO-RENDA-OUT26"),
                Some("RC 2026/00360 (BAI)"),
                Some("CAIXA #2026/0120"),
                NaiveDate::from_ymd_opt(2026, 10, 24).unwrap(),
                current_month,
                "75.2.21",
                "Rendas, Operação e Equipa da Filial de Benguela",
                false,
                cc_ben_vnd_id,
                "Filial - Benguela",
                Some("PRJ-EXPANSAO-SUL"),
                Some("Viatura BG-19-04-AA"),
                Some(rule_beng_id),
                Some("Regra REG-BEN-RENDA (60% Vendas Benguela)"),
                Decimal::new(60, 0),
                Decimal::new(1_200_000, 0),
                Decimal::new(2_000_000, 0),
                Some(Decimal::new(200, 0)),
                Some(Decimal::new(120, 0)),
                Some("m²"),
                Some("Showroom Comercial Benguela (120 m²)"),
                Some("Sebastião Lemos"),
                "Quota-parte comercial dos custos operacionais da Filial de Benguela.",
            ),
        ];

        for (
            batch_id,
            scope,
            module,
            doc_ref,
            supplier,
            po_ref,
            gr_ref,
            pay_ref,
            je_ref,
            dt,
            p_month,
            acc_code,
            acc_name,
            is_capex,
            cid,
            branch,
            prj,
            veh,
            rule_id,
            crit,
            pct,
            alloc_amt,
            total_amt,
            tot_units,
            alloc_units,
            unit_meas,
            tags,
            resp,
            notes,
        ) in sample_allocations
        {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_allocations (
                    tenant_id, batch_id, tracking_scope, source_module, source_document_ref,
                    supplier_name, purchase_order_ref, receipt_delivery_ref, payment_settlement_ref, journal_entry_ref,
                    allocation_date, period_month, fiscal_year, account_code, account_name,
                    is_capex, cost_center_id, branch_name, project_code, vehicle_or_asset,
                    allocation_rule_id, allocation_criterion, percentage,
                    allocated_amount, total_document_amount, total_units, allocated_units,
                    unit_measure, asset_tags, recipient_responsible, notes, created_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, 2026, $13, $14,
                    $15, $16, $17, $18, $19,
                    $20, $21, $22,
                    $23, $24, $25, $26,
                    $27, $28, $29, $30, 'Sistema / Contabilista Chefe'
                )
                "#,
            )
            .bind(tenant_id)
            .bind(batch_id)
            .bind(scope)
            .bind(module)
            .bind(doc_ref)
            .bind(supplier)
            .bind(po_ref)
            .bind(gr_ref)
            .bind(pay_ref)
            .bind(je_ref)
            .bind(dt)
            .bind(p_month)
            .bind(acc_code)
            .bind(acc_name)
            .bind(is_capex)
            .bind(cid)
            .bind(branch)
            .bind(prj)
            .bind(veh)
            .bind(rule_id)
            .bind(crit)
            .bind(pct)
            .bind(alloc_amt)
            .bind(total_amt)
            .bind(tot_units)
            .bind(alloc_units)
            .bind(unit_meas)
            .bind(tags)
            .bind(resp)
            .bind(notes)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, cost_center_id, action, entity_ref, details, performed_by
            )
            VALUES
            ($1, $2, 'ESTRUTURA_INICIALIZADA', 'Sede Luanda & Filial Benguela', 'Hierarquia de Centros de Custos, Orçamentos Mensais e Regras de Repartição (ENDE, Internet, Renda) configurada.', 'Dr. António Manuel (OCPCA)'),
            ($1, $2, 'RASTREIO_COMPRA_ATIVOS', 'FT SISTEC-2026/00412', 'Compra de 10 computadores (5.000.000,00 Kz) rastreada desde o fornecedor SISTEC até à entrega física: 4 un TI (2.000.000 Kz), 3 un RH (1.500.000 Kz) e 3 un Comercial (1.500.000 Kz).', 'Dr. António Manuel (OCPCA)'),
            ($1, $2, 'REPARTICAO_AUTOMATICA', 'FT ENDE-2026/10982', 'Fatura de eletricidade de 600.000,00 Kz distribuída segundo regra REG-ENDE-01 (TI 30%, RH 20%, Vendas 35%, Finanças 15%).', 'Dr. António Manuel (OCPCA)')
            "#,
        )
        .bind(tenant_id)
        .bind(cc_ti_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    pub async fn list_cost_centers(&self, tenant_id: Uuid) -> Result<Vec<CostCenterDto>, DomainError> {
        self.ensure_seeded(tenant_id).await?;

        let rows = sqlx::query(
            r#"
            SELECT
                c.id,
                c.tenant_id,
                c.code,
                c.name,
                c.description,
                c.parent_cost_center_id,
                p.code AS parent_code,
                p.name AS parent_name,
                c.center_type,
                c.branch_name,
                c.department_name,
                c.responsible_employee_id,
                c.responsible_name,
                c.valid_from,
                c.valid_to,
                c.monthly_budget,
                c.alert_threshold_pct,
                c.is_active,
                c.created_at,
                COALESCE((
                    SELECT SUM(b.committed_amount)
                    FROM kudiba_accounting.cost_center_budgets b
                    WHERE b.tenant_id = c.tenant_id AND b.cost_center_id = c.id
                ), 0) AS committed_amount,
                COALESCE((
                    SELECT SUM(a.allocated_amount)
                    FROM kudiba_accounting.cost_center_allocations a
                    WHERE a.tenant_id = c.tenant_id AND a.cost_center_id = c.id AND a.is_capex = FALSE
                ), 0) + COALESCE((
                    SELECT SUM(jl.debit_amount - jl.credit_amount)
                    FROM kudiba_accounting.journal_lines jl
                    JOIN kudiba_accounting.journal_entries je ON je.id = jl.entry_id
                    WHERE jl.tenant_id = c.tenant_id
                      AND jl.cost_center_id = c.id
                      AND je.status = 'POSTED'
                      AND jl.account_code LIKE '7%'
                ), 0) AS realized_opex,
                COALESCE((
                    SELECT SUM(a.allocated_amount)
                    FROM kudiba_accounting.cost_center_allocations a
                    WHERE a.tenant_id = c.tenant_id AND a.cost_center_id = c.id AND a.is_capex = TRUE
                ), 0) + COALESCE((
                    SELECT SUM(jl.debit_amount - jl.credit_amount)
                    FROM kudiba_accounting.journal_lines jl
                    JOIN kudiba_accounting.journal_entries je ON je.id = jl.entry_id
                    WHERE jl.tenant_id = c.tenant_id
                      AND jl.cost_center_id = c.id
                      AND je.status = 'POSTED'
                      AND jl.account_code LIKE '1%'
                ), 0) AS realized_capex,
                COALESCE((
                    SELECT SUM(a.monthly_depreciation)
                    FROM kudiba_accounting.cost_center_allocations a
                    WHERE a.tenant_id = c.tenant_id AND a.cost_center_id = c.id AND a.is_capex = TRUE
                ), 0) AS monthly_depreciation
            FROM kudiba_accounting.cost_centers c
            LEFT JOIN kudiba_accounting.cost_centers p ON p.id = c.parent_cost_center_id
            WHERE c.tenant_id = $1
            ORDER BY c.branch_name ASC, c.code ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut list = Vec::with_capacity(rows.len());
        let hundred = Decimal::new(100, 0);
        let ninety = Decimal::new(90, 0);

        for r in rows {
            let monthly_budget: Decimal = r.try_get("monthly_budget").unwrap_or_default();
            let committed_amount: Decimal = r.try_get("committed_amount").unwrap_or_default();
            let realized_opex: Decimal = r.try_get("realized_opex").unwrap_or_default();
            let realized_capex: Decimal = r.try_get("realized_capex").unwrap_or_default();
            let monthly_depreciation: Decimal = r.try_get("monthly_depreciation").unwrap_or_default();
            let alert_threshold_pct: Decimal = r
                .try_get("alert_threshold_pct")
                .unwrap_or_else(|_| Decimal::new(80, 0));

            let total_consumed = realized_opex + committed_amount;
            let available_budget = monthly_budget - total_consumed;
            let utilization_pct = if monthly_budget > Decimal::ZERO {
                ((realized_opex / monthly_budget) * hundred).round_dp(2)
            } else {
                Decimal::ZERO
            };

            let budget_status = if monthly_budget <= Decimal::ZERO {
                "SEM_ORCAMENTO".to_string()
            } else if utilization_pct >= hundred {
                "EXCEDIDO_100".to_string()
            } else if utilization_pct >= ninety {
                "CRITICO_90".to_string()
            } else if utilization_pct >= alert_threshold_pct {
                "ALERTA_80".to_string()
            } else {
                "DENTRO_ORCAMENTO".to_string()
            };

            list.push(CostCenterDto {
                id: r.get("id"),
                tenant_id: r.get("tenant_id"),
                code: r.get("code"),
                name: r.get("name"),
                description: r.get("description"),
                parent_cost_center_id: r.get("parent_cost_center_id"),
                parent_code: r.get("parent_code"),
                parent_name: r.get("parent_name"),
                center_type: r.get("center_type"),
                branch_name: r.get("branch_name"),
                department_name: r.get("department_name"),
                responsible_employee_id: r.get("responsible_employee_id"),
                responsible_name: r.get("responsible_name"),
                valid_from: r.get("valid_from"),
                valid_to: r.get("valid_to"),
                monthly_budget,
                committed_amount,
                realized_opex,
                realized_capex,
                monthly_depreciation,
                available_budget,
                utilization_pct,
                alert_threshold_pct,
                budget_status,
                is_active: r.get("is_active"),
                created_at: r.get("created_at"),
            });
        }

        Ok(list)
    }

    pub async fn create_cost_center(
        &self,
        tenant_id: Uuid,
        req: CreateCostCenterRequest,
    ) -> Result<CostCenterDto, DomainError> {
        let code = req.code.trim().to_uppercase();
        if code.is_empty() {
            return Err(DomainError::ValidationError(
                "O código do centro de custos é obrigatório (ex.: CC-TI-001).".to_string(),
            ));
        }
        let name = req.name.trim().to_string();
        if name.is_empty() {
            return Err(DomainError::ValidationError(
                "O nome do centro de custos é obrigatório.".to_string(),
            ));
        }

        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM kudiba_accounting.cost_centers WHERE tenant_id = $1 AND code = $2",
        )
        .bind(tenant_id)
        .bind(&code)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if exists > 0 {
            return Err(DomainError::Conflict(format!(
                "Já existe um centro de custos com o código '{}' nesta empresa.",
                code
            )));
        }

        if let Some(pid) = req.parent_cost_center_id {
            let parent_exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM kudiba_accounting.cost_centers WHERE tenant_id = $1 AND id = $2",
            )
            .bind(tenant_id)
            .bind(pid)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
            if parent_exists == 0 {
                return Err(DomainError::ValidationError(
                    "O centro de custos superior selecionado não pertence a esta empresa.".to_string(),
                ));
            }
        }

        let id = Uuid::new_v4();
        let center_type = req.center_type.unwrap_or_else(|| "COST_CENTER".to_string());
        let branch_name = req.branch_name.unwrap_or_else(|| "Sede - Luanda".to_string());
        let valid_from = req
            .valid_from
            .unwrap_or_else(|| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
        let budget = req.monthly_budget.unwrap_or(Decimal::ZERO);
        let alert_pct = req
            .alert_threshold_pct
            .unwrap_or_else(|| Decimal::new(80, 0));

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_centers (
                id, tenant_id, code, name, description, parent_cost_center_id,
                center_type, branch_name, department_name, responsible_name,
                valid_from, valid_to, monthly_budget, alert_threshold_pct, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(&code)
        .bind(&name)
        .bind(&req.description)
        .bind(req.parent_cost_center_id)
        .bind(&center_type)
        .bind(&branch_name)
        .bind(&req.department_name)
        .bind(&req.responsible_name)
        .bind(valid_from)
        .bind(req.valid_to)
        .bind(budget)
        .bind(alert_pct)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if budget > Decimal::ZERO {
            let current_month = Utc::now().month() as i32;
            let _ = sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_budgets (
                    tenant_id, cost_center_id, fiscal_year, period_month,
                    account_category, approved_budget, committed_amount, notes
                )
                VALUES ($1, $2, 2026, $3, 'GERAL', $4, 0, 'Orçamento inicial aprovado')
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(tenant_id)
            .bind(id)
            .bind(current_month)
            .bind(budget)
            .execute(&self.pool)
            .await;
        }

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, cost_center_id, action, entity_ref, details, performed_by
            )
            VALUES ($1, $2, 'CENTRO_CRIADO', $3, $4, 'Utilizador Autenticado')
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .bind(&code)
        .bind(format!(
            "Centro '{}' ({}) criado na filial '{}' com orçamento mensal de {} Kz.",
            name, code, branch_name, budget
        ))
        .execute(&self.pool)
        .await;

        let all = self.list_cost_centers(tenant_id).await?;
        all.into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| DomainError::NotFound("Centro de custos recém-criado não encontrado".to_string()))
    }

    pub async fn update_cost_center(
        &self,
        tenant_id: Uuid,
        id: Uuid,
        req: UpdateCostCenterRequest,
    ) -> Result<CostCenterDto, DomainError> {
        if req.parent_cost_center_id == Some(id) {
            return Err(DomainError::ValidationError(
                "Um centro de custos não pode ser superior de si próprio (ciclo hierárquico inválido).".to_string(),
            ));
        }

        let center_type = req.center_type.unwrap_or_else(|| "COST_CENTER".to_string());
        let branch_name = req.branch_name.unwrap_or_else(|| "Sede - Luanda".to_string());
        let valid_from = req
            .valid_from
            .unwrap_or_else(|| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap());
        let budget = req.monthly_budget.unwrap_or(Decimal::ZERO);
        let alert_pct = req
            .alert_threshold_pct
            .unwrap_or_else(|| Decimal::new(80, 0));

        let res = sqlx::query(
            r#"
            UPDATE kudiba_accounting.cost_centers
            SET name = $3,
                description = $4,
                parent_cost_center_id = $5,
                center_type = $6,
                branch_name = $7,
                department_name = $8,
                responsible_name = $9,
                valid_from = $10,
                valid_to = $11,
                monthly_budget = $12,
                alert_threshold_pct = $13,
                is_active = $14,
                updated_at = NOW()
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .bind(req.name.trim())
        .bind(&req.description)
        .bind(req.parent_cost_center_id)
        .bind(&center_type)
        .bind(&branch_name)
        .bind(&req.department_name)
        .bind(&req.responsible_name)
        .bind(valid_from)
        .bind(req.valid_to)
        .bind(budget)
        .bind(alert_pct)
        .bind(req.is_active)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if res.rows_affected() == 0 {
            return Err(DomainError::NotFound(
                "Centro de custos não encontrado para esta empresa.".to_string(),
            ));
        }

        if let Some(committed) = req.committed_amount {
            let current_month = Utc::now().month() as i32;
            let _ = sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_budgets (
                    tenant_id, cost_center_id, fiscal_year, period_month,
                    account_category, approved_budget, committed_amount, notes
                )
                VALUES ($1, $2, 2026, $3, 'GERAL', $4, $5, 'Atualização de orçamento e compromissos')
                ON CONFLICT (tenant_id, cost_center_id, fiscal_year, period_month, account_category)
                DO UPDATE SET approved_budget = EXCLUDED.approved_budget,
                              committed_amount = EXCLUDED.committed_amount,
                              updated_at = NOW()
                "#,
            )
            .bind(tenant_id)
            .bind(id)
            .bind(current_month)
            .bind(budget)
            .bind(committed)
            .execute(&self.pool)
            .await;
        }

        let _ = sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, cost_center_id, action, entity_ref, details, performed_by
            )
            VALUES ($1, $2, 'CENTRO_ATUALIZADO', $3, $4, 'Utilizador Autenticado')
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .bind(req.name.trim())
        .bind(format!(
            "Centro atualizado (Ativo: {}, Orçamento: {} Kz, Responsável: {}).",
            req.is_active,
            budget,
            req.responsible_name.clone().unwrap_or_else(|| "Não atribuído".to_string())
        ))
        .execute(&self.pool)
        .await;

        let all = self.list_cost_centers(tenant_id).await?;
        all.into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| DomainError::NotFound("Centro de custos não encontrado".to_string()))
    }

    pub async fn list_allocation_rules(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<AllocationRuleDto>, DomainError> {
        self.ensure_seeded(tenant_id).await?;

        let rules = sqlx::query(
            r#"
            SELECT id, code, name, description, allocation_basis, default_account_code, is_active
            FROM kudiba_accounting.cost_allocation_rules
            WHERE tenant_id = $1
            ORDER BY code ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let mut out = Vec::with_capacity(rules.len());
        for r in rules {
            let rule_id: Uuid = r.get("id");
            let line_rows = sqlx::query(
                r#"
                SELECT
                    l.id,
                    l.cost_center_id,
                    c.code AS cost_center_code,
                    c.name AS cost_center_name,
                    c.branch_name,
                    l.percentage,
                    l.justification
                FROM kudiba_accounting.cost_allocation_rule_lines l
                JOIN kudiba_accounting.cost_centers c ON c.id = l.cost_center_id
                WHERE l.rule_id = $1 AND l.tenant_id = $2
                ORDER BY l.percentage DESC
                "#,
            )
            .bind(rule_id)
            .bind(tenant_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            let mut total_pct = Decimal::ZERO;
            let mut lines = Vec::with_capacity(line_rows.len());
            for lr in line_rows {
                let pct: Decimal = lr.get("percentage");
                total_pct += pct;
                lines.push(AllocationRuleLineDto {
                    id: lr.get("id"),
                    cost_center_id: lr.get("cost_center_id"),
                    cost_center_code: lr.get("cost_center_code"),
                    cost_center_name: lr.get("cost_center_name"),
                    branch_name: lr.get("branch_name"),
                    percentage: pct,
                    justification: lr.get("justification"),
                });
            }

            out.push(AllocationRuleDto {
                id: rule_id,
                code: r.get("code"),
                name: r.get("name"),
                description: r.get("description"),
                allocation_basis: r.get("allocation_basis"),
                default_account_code: r.get("default_account_code"),
                is_active: r.get("is_active"),
                total_percentage: total_pct,
                lines,
            });
        }

        Ok(out)
    }

    pub async fn create_allocation_rule(
        &self,
        tenant_id: Uuid,
        req: CreateAllocationRuleRequest,
    ) -> Result<AllocationRuleDto, DomainError> {
        if req.lines.is_empty() {
            return Err(DomainError::ValidationError(
                "A regra de repartição deve conter pelo menos um centro de custos.".to_string(),
            ));
        }

        let total_pct: Decimal = req.lines.iter().map(|l| l.percentage).sum();
        let hundred = Decimal::new(100, 0);
        if (total_pct - hundred).abs() > Decimal::new(1, 2) {
            return Err(DomainError::ValidationError(format!(
                "A soma das percentagens da regra de repartição deve ser exatamente 100,00% (atual: {}%).",
                total_pct
            )));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let rule_id = Uuid::new_v4();
        let code = req.code.trim().to_uppercase();

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_allocation_rules (
                id, tenant_id, code, name, description, allocation_basis, default_account_code, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            "#,
        )
        .bind(rule_id)
        .bind(tenant_id)
        .bind(&code)
        .bind(req.name.trim())
        .bind(&req.description)
        .bind(&req.allocation_basis)
        .bind(&req.default_account_code)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for line in &req.lines {
            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_allocation_rule_lines (
                    rule_id, tenant_id, cost_center_id, percentage, justification
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(rule_id)
            .bind(tenant_id)
            .bind(line.cost_center_id)
            .bind(line.percentage)
            .bind(&line.justification)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, action, entity_ref, details, performed_by
            )
            VALUES ($1, 'REGRA_RATEIO_CRIADA', $2, $3, 'Utilizador Autenticado')
            "#,
        )
        .bind(tenant_id)
        .bind(&code)
        .bind(format!(
            "Regra de repartição '{}' criada com critério '{}' ({} centros, total 100%).",
            req.name,
            req.allocation_basis,
            req.lines.len()
        ))
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let rules = self.list_allocation_rules(tenant_id).await?;
        rules
            .into_iter()
            .find(|r| r.id == rule_id)
            .ok_or_else(|| DomainError::NotFound("Regra criada não encontrada".to_string()))
    }

    pub async fn allocate_expense(
        &self,
        tenant_id: Uuid,
        req: AllocateExpenseRequest,
    ) -> Result<Vec<CostAllocationRecordDto>, DomainError> {
        if req.total_amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante total do documento a distribuir deve ser superior a zero.".to_string(),
            ));
        }

        if req.lines.is_empty() {
            return Err(DomainError::ValidationError(
                "Deve indicar pelo menos uma linha de centro de custos para imputação.".to_string(),
            ));
        }

        let total_pct: Decimal = req.lines.iter().map(|l| l.percentage).sum();
        let hundred = Decimal::new(100, 0);
        if (total_pct - hundred).abs() > Decimal::new(1, 2) {
            return Err(DomainError::ValidationError(format!(
                "A distribuição analítica deve totalizar exatamente 100,00% do documento (soma atual: {}%).",
                total_pct
            )));
        }

        let alloc_date = req
            .allocation_date
            .unwrap_or_else(|| Utc::now().date_naive());
        let batch_id = Uuid::new_v4();
        let tracking_scope = req
            .tracking_scope
            .clone()
            .unwrap_or_else(|| if req.is_capex { "ATIVO_UNIDADE".to_string() } else { "DOCUMENTO".to_string() });
        let useful_life = req.useful_life_months.or(if req.is_capex { Some(48) } else { None });

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        for line in &req.lines {
            let center_row = sqlx::query(
                r#"
                SELECT code, name, branch_name, responsible_name, is_active, valid_from, valid_to
                FROM kudiba_accounting.cost_centers
                WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(line.cost_center_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            let Some(cr) = center_row else {
                return Err(DomainError::ValidationError(
                    "Centro de custos inválido ou pertencente a outra empresa.".to_string(),
                ));
            };

            let is_active: bool = cr.get("is_active");
            let code: String = cr.get("code");
            let branch_name: String = cr.get("branch_name");
            let default_resp: Option<String> = cr.get("responsible_name");
            let valid_to: Option<NaiveDate> = cr.get("valid_to");

            if !is_active {
                return Err(DomainError::ValidationError(format!(
                    "O centro de custos '{}' está inativo e não pode receber novas imputações.",
                    code
                )));
            }

            if let Some(vt) = valid_to {
                if alloc_date > vt {
                    return Err(DomainError::ValidationError(format!(
                        "O centro de custos '{}' expirou em {} e não permite movimentos em {}.",
                        code, vt, alloc_date
                    )));
                }
            }

            let allocated_amount = ((req.total_amount * line.percentage) / hundred).round_dp(2);
            let allocated_units = line.allocated_units.or_else(|| {
                req.total_units
                    .map(|tu| ((tu * line.percentage) / hundred).round_dp(2))
            });
            let monthly_depreciation = if req.is_capex {
                if let Some(months) = useful_life {
                    if months > 0 {
                        (allocated_amount / Decimal::new(months as i64, 0)).round_dp(2)
                    } else {
                        Decimal::ZERO
                    }
                } else {
                    Decimal::ZERO
                }
            } else {
                Decimal::ZERO
            };

            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_allocations (
                    tenant_id, batch_id, tracking_scope, source_module, source_document_ref,
                    supplier_name, purchase_order_ref, receipt_delivery_ref, payment_settlement_ref, journal_entry_ref,
                    allocation_date, period_month, fiscal_year, account_code, account_name,
                    is_capex, cost_center_id, branch_name, project_code, vehicle_or_asset,
                    allocation_rule_id, allocation_criterion, percentage,
                    allocated_amount, total_document_amount, total_units, allocated_units,
                    unit_measure, asset_tags, recipient_responsible, useful_life_months, monthly_depreciation,
                    notes, created_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18, $19, $20,
                    $21, $22, $23,
                    $24, $25, $26, $27,
                    $28, $29, $30, $31, $32,
                    $33, 'Contabilista Autenticado'
                )
                "#,
            )
            .bind(tenant_id)
            .bind(batch_id)
            .bind(&tracking_scope)
            .bind(&req.source_module)
            .bind(req.source_document_ref.trim())
            .bind(&req.supplier_name)
            .bind(&req.purchase_order_ref)
            .bind(&req.receipt_delivery_ref)
            .bind(&req.payment_settlement_ref)
            .bind(&req.journal_entry_ref)
            .bind(alloc_date)
            .bind(alloc_date.month() as i32)
            .bind(alloc_date.year())
            .bind(req.account_code.trim())
            .bind(req.account_name.trim())
            .bind(req.is_capex)
            .bind(line.cost_center_id)
            .bind(branch_name)
            .bind(line.project_code.as_ref().or(req.project_code.as_ref()))
            .bind(line.vehicle_or_asset.as_ref().or(req.vehicle_or_asset.as_ref()))
            .bind(req.allocation_rule_id)
            .bind(&req.allocation_criterion)
            .bind(line.percentage)
            .bind(allocated_amount)
            .bind(req.total_amount)
            .bind(req.total_units)
            .bind(allocated_units)
            .bind(&req.unit_measure)
            .bind(&line.asset_tags)
            .bind(line.recipient_responsible.as_ref().or(default_resp.as_ref()))
            .bind(useful_life)
            .bind(monthly_depreciation)
            .bind(line.notes.as_ref().or(req.notes.as_ref()))
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, action, entity_ref, details, performed_by
            )
            VALUES ($1, 'RASTREIO_E_IMPUTACAO', $2, $3, 'Contabilista Autenticado')
            "#,
        )
        .bind(tenant_id)
        .bind(req.source_document_ref.trim())
        .bind(format!(
            "Operação '{}' ({}) no valor de {} Kz rastreada e distribuída por {} centro(s) de custo (Conta {} - {}).",
            req.source_document_ref,
            req.source_module,
            req.total_amount,
            req.lines.len(),
            req.account_code,
            if req.is_capex { "CAPEX / Imobilizado com Depreciação Mensal" } else { "OPEX / Custo Operacional" }
        ))
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        self.list_recent_allocations(tenant_id).await
    }

    pub async fn reclassify_allocation(
        &self,
        tenant_id: Uuid,
        req: ReclassifyCostAllocationRequest,
    ) -> Result<CostReclassificationDto, DomainError> {
        if req.reason.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "É obrigatório indicar o motivo / justificação da alteração de atribuição (rastreabilidade auditável).".to_string(),
            ));
        }

        if req.transferred_amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O valor a reclassificar/transferir deve ser superior a zero.".to_string(),
            ));
        }

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let src_row = sqlx::query(
            r#"
            SELECT
                a.id, a.batch_id, a.tracking_scope, a.source_module, a.source_document_ref,
                a.supplier_name, a.purchase_order_ref, a.receipt_delivery_ref,
                a.payment_settlement_ref, a.journal_entry_ref, a.allocation_date,
                a.period_month, a.fiscal_year, a.account_code, a.account_name,
                a.is_capex, a.cost_center_id, a.project_code, a.vehicle_or_asset,
                a.allocation_rule_id, a.allocation_criterion, a.percentage,
                a.allocated_amount, a.total_document_amount, a.total_units,
                a.allocated_units, a.unit_measure, a.asset_tags, a.recipient_responsible,
                a.useful_life_months, a.monthly_depreciation,
                c.code AS from_code, c.name AS from_name
            FROM kudiba_accounting.cost_center_allocations a
            JOIN kudiba_accounting.cost_centers c ON c.id = a.cost_center_id
            WHERE a.tenant_id = $1 AND a.id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(req.allocation_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let Some(src) = src_row else {
            return Err(DomainError::NotFound(
                "Registo de atribuição original não encontrado.".to_string(),
            ));
        };

        let from_cc_id: Uuid = src.get("cost_center_id");
        if from_cc_id == req.to_cost_center_id {
            return Err(DomainError::ValidationError(
                "O centro de custos de destino deve ser diferente do centro de origem.".to_string(),
            ));
        }

        let current_amount: Decimal = src.get("allocated_amount");
        if req.transferred_amount > current_amount {
            return Err(DomainError::ValidationError(format!(
                "O montante a transferir ({} Kz) excede o saldo atual atribuído a esta linha ({} Kz).",
                req.transferred_amount, current_amount
            )));
        }

        let dest_row = sqlx::query(
            r#"
            SELECT code, name, branch_name, responsible_name, is_active
            FROM kudiba_accounting.cost_centers
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(req.to_cost_center_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let Some(dest) = dest_row else {
            return Err(DomainError::NotFound(
                "Centro de custos de destino não encontrado.".to_string(),
            ));
        };

        let dest_active: bool = dest.get("is_active");
        let to_code: String = dest.get("code");
        let to_name: String = dest.get("name");
        let to_branch: String = dest.get("branch_name");
        let to_resp: Option<String> = dest.get("responsible_name");

        if !dest_active {
            return Err(DomainError::ValidationError(format!(
                "O centro de custos de destino '{}' está inativo e não pode receber transferências.",
                to_code
            )));
        }

        let batch_id: Uuid = src.get("batch_id");
        let doc_ref: String = src.get("source_document_ref");
        let from_code: String = src.get("from_code");
        let from_name: String = src.get("from_name");
        let total_doc_amt: Decimal = src.get("total_document_amount");
        let is_capex: bool = src.get("is_capex");
        let useful_life: Option<i32> = src.get("useful_life_months");
        let current_units: Option<Decimal> = src.get("allocated_units");
        let hundred = Decimal::new(100, 0);

        let transferred_pct = if total_doc_amt > Decimal::ZERO {
            ((req.transferred_amount / total_doc_amt) * hundred).round_dp(2)
        } else {
            Decimal::ZERO
        };
        let transferred_dep = if is_capex {
            if let Some(m) = useful_life {
                if m > 0 {
                    (req.transferred_amount / Decimal::new(m as i64, 0)).round_dp(2)
                } else {
                    Decimal::ZERO
                }
            } else {
                Decimal::ZERO
            }
        } else {
            Decimal::ZERO
        };

        if (current_amount - req.transferred_amount).abs() <= Decimal::new(1, 2) {
            sqlx::query(
                r#"
                UPDATE kudiba_accounting.cost_center_allocations
                SET cost_center_id = $3,
                    branch_name = $4,
                    recipient_responsible = COALESCE($5, recipient_responsible),
                    notes = CONCAT(COALESCE(notes, ''), ' | [Reclassificado de ', $6, ': ', $7, ']')
                WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(req.allocation_id)
            .bind(req.to_cost_center_id)
            .bind(&to_branch)
            .bind(&to_resp)
            .bind(&from_code)
            .bind(req.reason.trim())
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        } else {
            let new_src_amt = current_amount - req.transferred_amount;
            let new_src_pct = if total_doc_amt > Decimal::ZERO {
                ((new_src_amt / total_doc_amt) * hundred).round_dp(2)
            } else {
                Decimal::ZERO
            };
            let new_src_units = match (current_units, req.transferred_units) {
                (Some(cu), Some(tu)) if cu >= tu => Some(cu - tu),
                (Some(cu), None) => Some(cu),
                _ => None,
            };
            let current_dep: Decimal = src.get("monthly_depreciation");
            let new_src_dep = (current_dep - transferred_dep).max(Decimal::ZERO);

            sqlx::query(
                r#"
                UPDATE kudiba_accounting.cost_center_allocations
                SET allocated_amount = $3,
                    percentage = $4,
                    allocated_units = $5,
                    monthly_depreciation = $6
                WHERE tenant_id = $1 AND id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(req.allocation_id)
            .bind(new_src_amt)
            .bind(new_src_pct)
            .bind(new_src_units)
            .bind(new_src_dep)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

            sqlx::query(
                r#"
                INSERT INTO kudiba_accounting.cost_center_allocations (
                    tenant_id, batch_id, tracking_scope, source_module, source_document_ref,
                    supplier_name, purchase_order_ref, receipt_delivery_ref, payment_settlement_ref, journal_entry_ref,
                    allocation_date, period_month, fiscal_year, account_code, account_name,
                    is_capex, cost_center_id, branch_name, project_code, vehicle_or_asset,
                    allocation_rule_id, allocation_criterion, percentage,
                    allocated_amount, total_document_amount, total_units, allocated_units,
                    unit_measure, asset_tags, recipient_responsible, useful_life_months, monthly_depreciation,
                    notes, created_by
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18, $19, $20,
                    $21, $22, $23,
                    $24, $25, $26, $27,
                    $28, $29, $30, $31, $32,
                    $33, $34
                )
                "#,
            )
            .bind(tenant_id)
            .bind(batch_id)
            .bind(src.get::<String, _>("tracking_scope"))
            .bind(src.get::<String, _>("source_module"))
            .bind(&doc_ref)
            .bind(src.get::<Option<String>, _>("supplier_name"))
            .bind(src.get::<Option<String>, _>("purchase_order_ref"))
            .bind(src.get::<Option<String>, _>("receipt_delivery_ref"))
            .bind(src.get::<Option<String>, _>("payment_settlement_ref"))
            .bind(src.get::<Option<String>, _>("journal_entry_ref"))
            .bind(src.get::<NaiveDate, _>("allocation_date"))
            .bind(src.get::<i32, _>("period_month"))
            .bind(src.get::<i32, _>("fiscal_year"))
            .bind(src.get::<String, _>("account_code"))
            .bind(src.get::<String, _>("account_name"))
            .bind(is_capex)
            .bind(req.to_cost_center_id)
            .bind(&to_branch)
            .bind(src.get::<Option<String>, _>("project_code"))
            .bind(src.get::<Option<String>, _>("vehicle_or_asset"))
            .bind(src.get::<Option<Uuid>, _>("allocation_rule_id"))
            .bind(format!("Reclassificação interna a partir de {}", from_code))
            .bind(transferred_pct)
            .bind(req.transferred_amount)
            .bind(total_doc_amt)
            .bind(src.get::<Option<Decimal>, _>("total_units"))
            .bind(req.transferred_units)
            .bind(src.get::<Option<String>, _>("unit_measure"))
            .bind(req.asset_tags_moved.clone().or_else(|| src.get("asset_tags")))
            .bind(to_resp)
            .bind(useful_life)
            .bind(transferred_dep)
            .bind(format!("Transferido de {} — Motivo: {}", from_code, req.reason.trim()))
            .bind(req.performed_by.clone().unwrap_or_else(|| "Dr. António Manuel (OCPCA)".to_string()))
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        }

        let reclass_id = Uuid::new_v4();
        let performed_by = req
            .performed_by
            .unwrap_or_else(|| "Dr. António Manuel (OCPCA)".to_string());

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_tracking_reclassifications (
                id, tenant_id, allocation_id, batch_id, source_document_ref,
                from_cost_center_id, to_cost_center_id, transferred_units, transferred_amount,
                asset_tags_moved, reason, performed_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#,
        )
        .bind(reclass_id)
        .bind(tenant_id)
        .bind(req.allocation_id)
        .bind(batch_id)
        .bind(&doc_ref)
        .bind(from_cc_id)
        .bind(req.to_cost_center_id)
        .bind(req.transferred_units)
        .bind(req.transferred_amount)
        .bind(&req.asset_tags_moved)
        .bind(req.reason.trim())
        .bind(&performed_by)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.cost_center_audit_logs (
                tenant_id, cost_center_id, action, entity_ref, details, performed_by
            )
            VALUES ($1, $2, 'RECLASSIFICACAO_CUSTO', $3, $4, $5)
            "#,
        )
        .bind(tenant_id)
        .bind(req.to_cost_center_id)
        .bind(&doc_ref)
        .bind(format!(
            "Reclassificação de {} Kz do centro {} ({}) para {} ({}). Motivo: {}",
            req.transferred_amount,
            from_code,
            from_name,
            to_code,
            to_name,
            req.reason.trim()
        ))
        .bind(&performed_by)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(CostReclassificationDto {
            id: reclass_id,
            allocation_id: Some(req.allocation_id),
            batch_id,
            source_document_ref: doc_ref,
            from_cost_center_id: from_cc_id,
            from_cost_center_code: from_code,
            from_cost_center_name: from_name,
            to_cost_center_id: req.to_cost_center_id,
            to_cost_center_code: to_code,
            to_cost_center_name: to_name,
            transferred_units: req.transferred_units,
            transferred_amount: req.transferred_amount,
            asset_tags_moved: req.asset_tags_moved,
            reason: req.reason,
            performed_by,
            created_at: Utc::now(),
        })
    }

    pub async fn list_recent_allocations(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<CostAllocationRecordDto>, DomainError> {
        let rows = sqlx::query(
            r#"
            SELECT
                a.id,
                a.batch_id,
                a.tracking_scope,
                a.source_module,
                a.source_document_ref,
                a.supplier_name,
                a.purchase_order_ref,
                a.receipt_delivery_ref,
                a.payment_settlement_ref,
                a.journal_entry_ref,
                a.allocation_date,
                a.account_code,
                a.account_name,
                a.is_capex,
                a.cost_center_id,
                c.code AS cost_center_code,
                c.name AS cost_center_name,
                c.department_name,
                a.branch_name,
                a.project_code,
                a.vehicle_or_asset,
                a.allocation_criterion,
                a.percentage,
                a.allocated_amount,
                a.total_document_amount,
                a.total_units,
                a.allocated_units,
                a.unit_measure,
                a.asset_tags,
                a.recipient_responsible,
                a.useful_life_months,
                a.monthly_depreciation,
                a.notes,
                a.created_by
            FROM kudiba_accounting.cost_center_allocations a
            JOIN kudiba_accounting.cost_centers c ON c.id = a.cost_center_id
            WHERE a.tenant_id = $1
            ORDER BY a.is_capex DESC, a.allocation_date DESC, a.percentage DESC
            LIMIT 100
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| CostAllocationRecordDto {
                id: r.get("id"),
                batch_id: r.get("batch_id"),
                tracking_scope: r.try_get("tracking_scope").unwrap_or_else(|_| "DOCUMENTO".to_string()),
                source_module: r.get("source_module"),
                source_document_ref: r.get("source_document_ref"),
                supplier_name: r.try_get("supplier_name").ok().flatten(),
                purchase_order_ref: r.try_get("purchase_order_ref").ok().flatten(),
                receipt_delivery_ref: r.try_get("receipt_delivery_ref").ok().flatten(),
                payment_settlement_ref: r.try_get("payment_settlement_ref").ok().flatten(),
                journal_entry_ref: r.try_get("journal_entry_ref").ok().flatten(),
                allocation_date: r.get("allocation_date"),
                account_code: r.get("account_code"),
                account_name: r.get("account_name"),
                is_capex: r.get("is_capex"),
                cost_center_id: r.get("cost_center_id"),
                cost_center_code: r.get("cost_center_code"),
                cost_center_name: r.get("cost_center_name"),
                department_name: r.get("department_name"),
                branch_name: r.get("branch_name"),
                project_code: r.get("project_code"),
                vehicle_or_asset: r.get("vehicle_or_asset"),
                allocation_criterion: r.get("allocation_criterion"),
                percentage: r.get("percentage"),
                allocated_amount: r.get("allocated_amount"),
                total_document_amount: r.get("total_document_amount"),
                total_units: r.try_get("total_units").ok().flatten(),
                allocated_units: r.try_get("allocated_units").ok().flatten(),
                unit_measure: r.try_get("unit_measure").ok().flatten(),
                asset_tags: r.try_get("asset_tags").ok().flatten(),
                recipient_responsible: r.try_get("recipient_responsible").ok().flatten(),
                useful_life_months: r.try_get("useful_life_months").ok().flatten(),
                monthly_depreciation: r.try_get("monthly_depreciation").unwrap_or_default(),
                notes: r.get("notes"),
                created_by: r.get("created_by"),
            })
            .collect())
    }

    pub async fn list_reclassifications(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<CostReclassificationDto>, DomainError> {
        let rows = sqlx::query(
            r#"
            SELECT
                r.id,
                r.allocation_id,
                r.batch_id,
                r.source_document_ref,
                r.from_cost_center_id,
                cf.code AS from_code,
                cf.name AS from_name,
                r.to_cost_center_id,
                ct.code AS to_code,
                ct.name AS to_name,
                r.transferred_units,
                r.transferred_amount,
                r.asset_tags_moved,
                r.reason,
                r.performed_by,
                r.created_at
            FROM kudiba_accounting.cost_tracking_reclassifications r
            JOIN kudiba_accounting.cost_centers cf ON cf.id = r.from_cost_center_id
            JOIN kudiba_accounting.cost_centers ct ON ct.id = r.to_cost_center_id
            WHERE r.tenant_id = $1
            ORDER BY r.created_at DESC
            LIMIT 50
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| CostReclassificationDto {
                id: r.get("id"),
                allocation_id: r.get("allocation_id"),
                batch_id: r.get("batch_id"),
                source_document_ref: r.get("source_document_ref"),
                from_cost_center_id: r.get("from_cost_center_id"),
                from_cost_center_code: r.get("from_code"),
                from_cost_center_name: r.get("from_name"),
                to_cost_center_id: r.get("to_cost_center_id"),
                to_cost_center_code: r.get("to_code"),
                to_cost_center_name: r.get("to_name"),
                transferred_units: r.get("transferred_units"),
                transferred_amount: r.get("transferred_amount"),
                asset_tags_moved: r.get("asset_tags_moved"),
                reason: r.get("reason"),
                performed_by: r.get("performed_by"),
                created_at: r.get("created_at"),
            })
            .collect())
    }

    pub async fn get_dashboard(
        &self,
        tenant_id: Uuid,
    ) -> Result<CostCenterDashboardResponse, DomainError> {
        self.ensure_seeded(tenant_id).await?;

        let centers = self.list_cost_centers(tenant_id).await?;
        let allocation_rules = self.list_allocation_rules(tenant_id).await?;
        let recent_allocations = self.list_recent_allocations(tenant_id).await?;
        let reclassifications = self.list_reclassifications(tenant_id).await?;

        // Agrupar alocações em Cadeias de Rastreio (CostTraceChainDto) sem duplicar valores
        let mut trace_chains: Vec<CostTraceChainDto> = Vec::new();
        for a in &recent_allocations {
            if let Some(chain) = trace_chains.iter_mut().find(|c| c.batch_id == a.batch_id) {
                chain.total_monthly_depreciation += a.monthly_depreciation;
                chain.splits.push(a.clone());
            } else {
                trace_chains.push(CostTraceChainDto {
                    batch_id: a.batch_id,
                    tracking_scope: a.tracking_scope.clone(),
                    source_module: a.source_module.clone(),
                    source_document_ref: a.source_document_ref.clone(),
                    supplier_name: a.supplier_name.clone(),
                    purchase_order_ref: a.purchase_order_ref.clone(),
                    receipt_delivery_ref: a.receipt_delivery_ref.clone(),
                    payment_settlement_ref: a.payment_settlement_ref.clone(),
                    journal_entry_ref: a.journal_entry_ref.clone(),
                    allocation_date: a.allocation_date,
                    account_code: a.account_code.clone(),
                    account_name: a.account_name.clone(),
                    is_capex: a.is_capex,
                    total_document_amount: a.total_document_amount,
                    total_units: a.total_units,
                    unit_measure: a.unit_measure.clone(),
                    useful_life_months: a.useful_life_months,
                    total_monthly_depreciation: a.monthly_depreciation,
                    project_code: a.project_code.clone(),
                    vehicle_or_asset: a.vehicle_or_asset.clone(),
                    allocation_criterion: a.allocation_criterion.clone(),
                    splits: vec![a.clone()],
                });
            }
        }

        let mut total_budget_monthly = Decimal::ZERO;
        let mut total_realized_opex = Decimal::ZERO;
        let mut total_committed = Decimal::ZERO;
        let mut total_realized_capex = Decimal::ZERO;
        let mut total_monthly_depreciation = Decimal::ZERO;
        let mut active_centers_count = 0usize;
        let mut centers_over_80_pct = 0usize;
        let mut centers_over_100_pct = 0usize;
        let mut centers_without_responsible_or_budget = 0usize;

        let hundred = Decimal::new(100, 0);
        let eighty = Decimal::new(80, 0);

        for c in &centers {
            if c.is_active {
                active_centers_count += 1;
            }
            total_budget_monthly += c.monthly_budget;
            total_realized_opex += c.realized_opex;
            total_committed += c.committed_amount;
            total_realized_capex += c.realized_capex;
            total_monthly_depreciation += c.monthly_depreciation;

            if c.utilization_pct >= hundred {
                centers_over_100_pct += 1;
            } else if c.utilization_pct >= eighty {
                centers_over_80_pct += 1;
            }

            if c.parent_cost_center_id.is_some()
                && (c.responsible_name.is_none() || c.monthly_budget <= Decimal::ZERO)
            {
                centers_without_responsible_or_budget += 1;
            }
        }

        let total_available_budget = total_budget_monthly - (total_realized_opex + total_committed);
        let overall_utilization_pct = if total_budget_monthly > Decimal::ZERO {
            ((total_realized_opex / total_budget_monthly) * hundred).round_dp(2)
        } else {
            Decimal::ZERO
        };

        let mut by_department: Vec<DepartmentCostSummaryDto> = Vec::new();
        for c in &centers {
            if c.parent_cost_center_id.is_none() && c.monthly_budget == Decimal::ZERO && c.realized_opex == Decimal::ZERO {
                continue;
            }
            let dept = c
                .department_name
                .clone()
                .unwrap_or_else(|| c.name.clone());
            if let Some(existing) = by_department
                .iter_mut()
                .find(|d| d.department_name == dept && d.branch_name == c.branch_name)
            {
                existing.budget_amount += c.monthly_budget;
                existing.realized_opex += c.realized_opex;
                existing.committed_amount += c.committed_amount;
                existing.realized_capex += c.realized_capex;
                existing.monthly_depreciation += c.monthly_depreciation;
                if existing.budget_amount > Decimal::ZERO {
                    existing.utilization_pct =
                        ((existing.realized_opex / existing.budget_amount) * hundred).round_dp(2);
                }
            } else {
                by_department.push(DepartmentCostSummaryDto {
                    department_name: dept,
                    branch_name: c.branch_name.clone(),
                    budget_amount: c.monthly_budget,
                    realized_opex: c.realized_opex,
                    committed_amount: c.committed_amount,
                    realized_capex: c.realized_capex,
                    monthly_depreciation: c.monthly_depreciation,
                    utilization_pct: c.utilization_pct,
                });
            }
        }
        by_department.sort_by(|a, b| b.realized_opex.cmp(&a.realized_opex));

        let mut by_branch: Vec<BranchCostSummaryDto> = Vec::new();
        for c in &centers {
            if let Some(b) = by_branch.iter_mut().find(|x| x.branch_name == c.branch_name) {
                if c.parent_cost_center_id.is_some() {
                    b.centers_count += 1;
                }
                b.total_budget += c.monthly_budget;
                b.realized_opex += c.realized_opex;
                b.committed_amount += c.committed_amount;
                b.realized_capex += c.realized_capex;
            } else {
                by_branch.push(BranchCostSummaryDto {
                    branch_name: c.branch_name.clone(),
                    centers_count: if c.parent_cost_center_id.is_some() { 1 } else { 0 },
                    total_budget: c.monthly_budget,
                    realized_opex: c.realized_opex,
                    committed_amount: c.committed_amount,
                    realized_capex: c.realized_capex,
                });
            }
        }

        let mut by_project_and_asset: Vec<ProjectAssetSummaryDto> = Vec::new();
        for a in &recent_allocations {
            if let Some(prj) = &a.project_code {
                if !prj.trim().is_empty() {
                    if let Some(ex) = by_project_and_asset
                        .iter_mut()
                        .find(|p| p.dimension_type == "PROJETO" && &p.code == prj)
                    {
                        if a.is_capex {
                            ex.total_capex += a.allocated_amount;
                        } else {
                            ex.total_opex += a.allocated_amount;
                        }
                        ex.monthly_depreciation += a.monthly_depreciation;
                        if let Some(u) = a.allocated_units {
                            ex.total_units = Some(ex.total_units.unwrap_or(Decimal::ZERO) + u);
                        }
                        ex.documents_count += 1;
                    } else {
                        by_project_and_asset.push(ProjectAssetSummaryDto {
                            dimension_type: "PROJETO".to_string(),
                            code: prj.clone(),
                            total_opex: if a.is_capex { Decimal::ZERO } else { a.allocated_amount },
                            total_capex: if a.is_capex { a.allocated_amount } else { Decimal::ZERO },
                            monthly_depreciation: a.monthly_depreciation,
                            total_units: a.allocated_units,
                            unit_measure: a.unit_measure.clone(),
                            documents_count: 1,
                        });
                    }
                }
            }
            if let Some(veh) = &a.vehicle_or_asset {
                if !veh.trim().is_empty() {
                    if let Some(ex) = by_project_and_asset
                        .iter_mut()
                        .find(|p| p.dimension_type == "VIATURA_EQUIPAMENTO" && &p.code == veh)
                    {
                        if a.is_capex {
                            ex.total_capex += a.allocated_amount;
                        } else {
                            ex.total_opex += a.allocated_amount;
                        }
                        ex.monthly_depreciation += a.monthly_depreciation;
                        if let Some(u) = a.allocated_units {
                            ex.total_units = Some(ex.total_units.unwrap_or(Decimal::ZERO) + u);
                        }
                        ex.documents_count += 1;
                    } else {
                        by_project_and_asset.push(ProjectAssetSummaryDto {
                            dimension_type: "VIATURA_EQUIPAMENTO".to_string(),
                            code: veh.clone(),
                            total_opex: if a.is_capex { Decimal::ZERO } else { a.allocated_amount },
                            total_capex: if a.is_capex { a.allocated_amount } else { Decimal::ZERO },
                            monthly_depreciation: a.monthly_depreciation,
                            total_units: a.allocated_units,
                            unit_measure: a.unit_measure.clone(),
                            documents_count: 1,
                        });
                    }
                }
            }
        }

        let monthly_trend = vec![
            MonthlyCostTrendDto {
                month_label: "Maio".to_string(),
                period_month: 5,
                budget_total: total_budget_monthly,
                realized_opex: Decimal::new(11_450_000, 0),
                realized_capex: Decimal::new(450_000, 0),
            },
            MonthlyCostTrendDto {
                month_label: "Junho".to_string(),
                period_month: 6,
                budget_total: total_budget_monthly,
                realized_opex: Decimal::new(11_980_000, 0),
                realized_capex: Decimal::new(0, 0),
            },
            MonthlyCostTrendDto {
                month_label: "Julho".to_string(),
                period_month: 7,
                budget_total: total_budget_monthly,
                realized_opex: Decimal::new(12_310_000, 0),
                realized_capex: Decimal::new(820_000, 0),
            },
            MonthlyCostTrendDto {
                month_label: "Agosto".to_string(),
                period_month: 8,
                budget_total: total_budget_monthly,
                realized_opex: Decimal::new(12_640_000, 0),
                realized_capex: Decimal::new(300_000, 0),
            },
            MonthlyCostTrendDto {
                month_label: "Setembro".to_string(),
                period_month: 9,
                budget_total: total_budget_monthly,
                realized_opex: Decimal::new(12_890_000, 0),
                realized_capex: Decimal::new(650_000, 0),
            },
            MonthlyCostTrendDto {
                month_label: "Outubro (Atual)".to_string(),
                period_month: 10,
                budget_total: total_budget_monthly,
                realized_opex: total_realized_opex,
                realized_capex: total_realized_capex,
            },
        ];

        let unassigned_rows = sqlx::query(
            r#"
            SELECT
                je.id AS entry_id,
                je.entry_number,
                je.transaction_date,
                je.source_document_ref,
                jl.account_code,
                COALESCE(jl.description, je.description) AS description,
                (jl.debit_amount - jl.credit_amount) AS amount
            FROM kudiba_accounting.journal_lines jl
            JOIN kudiba_accounting.journal_entries je ON je.id = jl.entry_id
            WHERE jl.tenant_id = $1
              AND je.status = 'POSTED'
              AND jl.cost_center_id IS NULL
              AND (jl.account_code LIKE '72%' OR jl.account_code LIKE '75%' OR jl.account_code LIKE '76%')
              AND jl.debit_amount > 0
            ORDER BY je.transaction_date DESC
            LIMIT 25
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let unassigned_expenses: Vec<UnassignedExpenseDto> = unassigned_rows
            .into_iter()
            .map(|r| UnassignedExpenseDto {
                entry_id: r.get("entry_id"),
                entry_number: r.get("entry_number"),
                transaction_date: r.get("transaction_date"),
                source_document_ref: r.get("source_document_ref"),
                account_code: r.get("account_code"),
                description: r.get("description"),
                amount: r.get("amount"),
            })
            .collect();

        let audit_rows = sqlx::query(
            r#"
            SELECT id, action, entity_ref, details, performed_by, created_at
            FROM kudiba_accounting.cost_center_audit_logs
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 30
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let audit_logs = audit_rows
            .into_iter()
            .map(|r| CostCenterAuditLogDto {
                id: r.get("id"),
                action: r.get("action"),
                entity_ref: r.get("entity_ref"),
                details: r.get("details"),
                performed_by: r.get("performed_by"),
                created_at: r.get("created_at"),
            })
            .collect();

        Ok(CostCenterDashboardResponse {
            total_budget_monthly,
            total_realized_opex,
            total_committed,
            total_realized_capex,
            total_monthly_depreciation,
            total_available_budget,
            overall_utilization_pct,
            active_centers_count,
            centers_over_80_pct,
            centers_over_100_pct,
            centers_without_responsible_or_budget,
            unassigned_expenses_count: unassigned_expenses.len(),
            centers,
            by_department,
            by_branch,
            by_project_and_asset,
            monthly_trend,
            allocation_rules,
            recent_allocations,
            trace_chains,
            reclassifications,
            unassigned_expenses,
            audit_logs,
        })
    }
}
