#!/usr/bin/env python3
"""
Kudiba ERP — Master Data Reset & Realistic Historical Seeding Script
Período: 01 de Janeiro de 2026 a 05 de Novembro de 2026.
Volumes de vendas mensais variáveis, múltiplos clientes subscritores B2B com
diferentes combinações de módulos, tesouraria, inventário, contabilidade e salários.
Preserva integralmente o utilizador SYSADMIN e administradores da plataforma.
"""
import asyncio
import hashlib
import json
import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
import asyncpg

PG_BASE = "postgresql://kudiba:kudiba_secret_pass@localhost:5432"

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
BRANCH_ID = "b0000000-0000-0000-0000-000000000001"
SYSADMIN_ID = "e0000000-0000-0000-0000-000000000000"
ADMIN_ID = "6d4df40e-0616-4736-809c-acb1b56487b8"

FT_SERIES_ID = "b0000000-0000-0000-0000-000000000001"
FR_SERIES_ID = "b0000000-0000-0000-0000-000000000002"

ISSUER_NIF = "5417089123"
ISSUER_NAME = "Kudiba Comércio & Serviços, Lda."
ISSUER_ADDR = "Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda"
ISSUER_CITY = "Luanda"
ISSUER_COUNTRY = "AO"
AGT_CERT = "FE/528/AGT/2026"

# =====================================================================
# 1. CLIENTES SUBSCRITORES DO BACKOFFICE (B2B) COM MÓDULOS DIVERSOS
# =====================================================================
SUBSCRIBER_CLIENTS = [
    {
        "id": "c1000000-0000-0000-0000-000000000001",
        "tenant_id": "d1000000-0000-0000-0000-000000000001",
        "company_name": "Sonangol Distribuição E.P.",
        "nif": "5401002341",
        "alvara_number": "ALV-2025/00142",
        "alvara_issue_date": date(2025, 1, 15),
        "alvara_expiry_date": date(2028, 12, 31),
        "contact_name": "Dr. Fernando Manuel dos Santos",
        "contact_email": "f.santos@sonangol.co.ao",
        "contact_phone": "+244 923 111 222",
        "plan": "ENTERPRISE",
        "seats": 50,
        "modules": ["invoicing", "inventory", "treasury", "accounting", "payroll", "integrations"],
        "license_key": "KUDIBA-ENT-SONA-2026-9901",
        "valid_from": date(2026, 1, 1),
        "valid_until": date(2027, 1, 1),
        "status": "ACTIVE",
        "notes": "Cliente corporativo petrolífero; faturação e contabilidade analítica por postos de abastecimento."
    },
    {
        "id": "c2000000-0000-0000-0000-000000000002",
        "tenant_id": "d2000000-0000-0000-0000-000000000002",
        "company_name": "Hipermercados Kero & Candando, S.A.",
        "nif": "5412003456",
        "alvara_number": "ALV-2024/00891",
        "alvara_issue_date": date(2024, 6, 20),
        "alvara_expiry_date": date(2027, 6, 30),
        "contact_name": "Eng.ª Isabel da Conceição",
        "contact_email": "isabel.conceicao@kero.co.ao",
        "contact_phone": "+244 924 333 444",
        "plan": "ENTERPRISE",
        "seats": 35,
        "modules": ["invoicing", "inventory", "treasury", "payroll"],
        "license_key": "KUDIBA-ENT-KERO-2026-8802",
        "valid_from": date(2026, 2, 1),
        "valid_until": date(2027, 2, 1),
        "status": "ACTIVE",
        "notes": "Grande retalhista com 8 lojas e terminal POS offline integrado."
    },
    {
        "id": "c3000000-0000-0000-0000-000000000003",
        "tenant_id": "d3000000-0000-0000-0000-000000000003",
        "company_name": "Clínica Médica Girassol, S.A.",
        "nif": "5419004567",
        "alvara_number": "ALV-2025/00345",
        "alvara_issue_date": date(2025, 5, 10),
        "alvara_expiry_date": date(2028, 5, 15),
        "contact_name": "Dr. Carlos Alberto Neto",
        "contact_email": "carlos.neto@girassol.co.ao",
        "contact_phone": "+244 925 555 666",
        "plan": "PROFESSIONAL",
        "seats": 15,
        "modules": ["invoicing", "treasury", "payroll", "accounting"],
        "license_key": "KUDIBA-PRO-GIRA-2026-7703",
        "valid_from": date(2026, 1, 15),
        "valid_until": date(2027, 1, 15),
        "status": "ACTIVE",
        "notes": "Serviços hospitalares e médicos com isenção de IVA (M04) e processamento salarial com IRT."
    },
    {
        "id": "c4000000-0000-0000-0000-000000000004",
        "tenant_id": "d4000000-0000-0000-0000-000000000004",
        "company_name": "Farmácia Popular de Luanda, Lda.",
        "nif": "5416005678",
        "alvara_number": "ALV-2026/00112",
        "alvara_issue_date": date(2026, 1, 10),
        "alvara_expiry_date": date(2029, 1, 20),
        "contact_name": "Dra. Esperança de Carvalho",
        "contact_email": "esperanca@farmaciapopular.ao",
        "contact_phone": "+244 926 777 888",
        "plan": "STANDARD",
        "seats": 5,
        "modules": ["invoicing", "inventory", "treasury"],
        "license_key": "KUDIBA-STD-FARM-2026-6604",
        "valid_from": date(2026, 3, 1),
        "valid_until": date(2027, 3, 1),
        "status": "ACTIVE",
        "notes": "Retalho farmacêutico: faturação certificada e gestão rigorosa de lotes e validades."
    },
    {
        "id": "c5000000-0000-0000-0000-000000000005",
        "tenant_id": "d5000000-0000-0000-0000-000000000005",
        "company_name": "Luanda Logística & Transportes S.A.",
        "nif": "5408006789",
        "alvara_number": "ALV-2025/00780",
        "alvara_issue_date": date(2025, 9, 1),
        "alvara_expiry_date": date(2028, 9, 30),
        "contact_name": "Mateus Bento Kapita",
        "contact_email": "mateus.kapita@luandatrans.ao",
        "contact_phone": "+244 927 999 000",
        "plan": "PROFESSIONAL",
        "seats": 12,
        "modules": ["invoicing", "inventory", "treasury", "accounting"],
        "license_key": "KUDIBA-PRO-LOGI-2026-5505",
        "valid_from": date(2026, 2, 15),
        "valid_until": date(2027, 2, 15),
        "status": "ACTIVE",
        "notes": "Transporte de cargas para as províncias; centros de custos por frota."
    },
    {
        "id": "c6000000-0000-0000-0000-000000000006",
        "tenant_id": "d6000000-0000-0000-0000-000000000006",
        "company_name": "Refriango Indústria de Bebidas, Lda.",
        "nif": "5405007890",
        "alvara_number": "ALV-2024/00450",
        "alvara_issue_date": date(2024, 11, 5),
        "alvara_expiry_date": date(2027, 11, 10),
        "contact_name": "Eng. Paulo Jorge Neves",
        "contact_email": "paulo.neves@refriango.co.ao",
        "contact_phone": "+244 928 123 456",
        "plan": "ENTERPRISE",
        "seats": 40,
        "modules": ["invoicing", "inventory", "treasury", "accounting", "payroll", "integrations"],
        "license_key": "KUDIBA-ENT-REFR-2026-4406",
        "valid_from": date(2026, 1, 1),
        "valid_until": date(2027, 1, 1),
        "status": "ACTIVE",
        "notes": "Complexo fabril em Viana; vendas a distribuidores e integração com automação industrial."
    },
    {
        "id": "c7000000-0000-0000-0000-000000000007",
        "tenant_id": "d7000000-0000-0000-0000-000000000007",
        "company_name": "Pastelaria & Panificadora Mutamba, Lda.",
        "nif": "5417008901",
        "alvara_number": "ALV-2026/00204",
        "alvara_issue_date": date(2026, 3, 20),
        "alvara_expiry_date": date(2029, 4, 12),
        "contact_name": "Dona Maria da Glória",
        "contact_email": "gloria@panificadoramutamba.ao",
        "contact_phone": "+244 929 234 567",
        "plan": "STANDARD",
        "seats": 3,
        "modules": ["invoicing", "inventory"],
        "license_key": "KUDIBA-STD-PANI-2026-3307",
        "valid_from": date(2026, 4, 1),
        "valid_until": date(2027, 4, 1),
        "status": "ACTIVE",
        "notes": "Ponto de venda balcão e controlo de farinha e matérias-primas."
    },
    {
        "id": "c8000000-0000-0000-0000-000000000008",
        "tenant_id": "d8000000-0000-0000-0000-000000000008",
        "company_name": "Sociedade de Advogados & Consultores Coxi",
        "nif": "5413009012",
        "alvara_number": "ALV-2025/00912",
        "alvara_issue_date": date(2025, 3, 1),
        "alvara_expiry_date": date(2028, 3, 31),
        "contact_name": "Dr. Jaime Coxi",
        "contact_email": "jaime.coxi@advocacia.ao",
        "contact_phone": "+244 925 171 233",
        "plan": "STANDARD",
        "seats": 4,
        "modules": ["invoicing", "payroll"],
        "license_key": "KUDIBA-STD-COXI-2026-2208",
        "valid_from": date(2026, 1, 1),
        "valid_until": date(2027, 1, 1),
        "status": "ACTIVE",
        "notes": "Sociedade de prestação de serviços jurídicos com retenção na fonte 6.5%."
    }
]

# =====================================================================
# 2. CATÁLOGO DE PRODUTOS E CLIENTES DE COMPRA
# =====================================================================
CUSTOMERS = [
    ("Unitel S.A.", "5417892341", "Rua do Cergal 10, Maianga, Luanda", "Luanda"),
    ("Banco BAI S.A.", "5401234567", "Avenida Lenine 35, Luanda", "Luanda"),
    ("Sonangol Distribuidora E.P.", "5400012345", "Rua Rainha Ginga 29, Luanda", "Luanda"),
    ("Catoca Sociedade Mineira", "5409876543", "Saurimo, Lunda Sul", "Saurimo"),
    ("ENSA Seguros de Angola", "5412345678", "Largo 4 de Fevereiro, Luanda", "Luanda"),
    ("Angola Telecom E.P.", "5405556677", "Rua Frederico Welwitsch, Luanda", "Luanda"),
    ("TAAG Linhas Aéreas de Angola", "5401122334", "Rua da Missão 123, Luanda", "Luanda"),
    ("Porto de Luanda E.P.", "5409988776", "Largo do Porto, Luanda", "Luanda"),
    ("Banco BFA S.A.", "5402233445", "Rua Major Kanhangulo, Luanda", "Luanda"),
    ("TotalEnergies EP Angola", "5407788990", "Avenida 4 de Fevereiro 140, Luanda", "Luanda"),
    ("Africell Angola S.A.", "5419900112", "Edifício Kings Tower, Luanda", "Luanda"),
    ("Pumangol Lda", "5406655443", "Zona Industrial de Viana, Luanda", "Luanda"),
    ("Nova Cimangola S.A.", "5403322114", "Estrada de Cacuaco, Luanda", "Luanda"),
    ("Refriango Indústria Lda", "5408877665", "Complexo Industrial do Kikuxi, Viana", "Luanda"),
    ("Secil Marítima S.A.", "5404455667", "Terminal Marítimo de Luanda", "Luanda"),
    ("Multitel Telecomunicações", "5413344556", "Talatona Park, Edifício 2, Luanda", "Luanda"),
    ("Grupo Castel Angola Lda", "5402211334", "Estrada de Catete km 14, Luanda", "Luanda"),
    ("Soba Store Angola Lda", "5416677889", "Avenida Comandante Valódia, Luanda", "Luanda"),
]

RETAIL_CUSTOMERS = [
    ("Consumidor Final", "999999999", "Luanda", "Luanda"),
    ("Hipermercado Kero", "5412233445", "Nova Vida, Luanda", "Luanda"),
    ("Restaurante Marginal", "5415566778", "Ilha de Luanda", "Luanda"),
    ("Farmácia Popular Lda", "5416677880", "Maianga, Luanda", "Luanda"),
    ("Alimenta Angola Viana", "5417788992", "Viana, Luanda", "Luanda"),
    ("Padaria e Pastelaria Luanda", "5418899003", "Ingombota, Luanda", "Luanda"),
    ("Supermercado Candando", "5413344557", "Talatona, Luanda", "Luanda"),
    ("Hotel Epic Sana Luanda", "5410011225", "Rua da Missão, Luanda", "Luanda"),
    ("Papelaria Central Lda", "5415566779", "Mutamba, Luanda", "Luanda"),
]

CATALOG = [
    # code, description, price, tax_rate, ex_code, is_service, uom
    ("PROD-001", "Arroz Agulha Kudiba 25Kg", 18500.00, 14.00, None, False, "SC"),
    ("PROD-002", "Óleo Alimentar Kudiba 1L (Cx 24)", 28800.00, 14.00, None, False, "CX"),
    ("PROD-003", "Farinha de Trigo Nacional 1Kg", 950.00, 0.00, "M04", False, "UN"),
    ("PROD-004", "Açúcar Branco Kudiba 1Kg", 1100.00, 0.00, "M04", False, "UN"),
    ("PRD-005", "Computador Portátil HP ProBook G9", 580000.00, 14.00, None, False, "UN"),
    ("PRD-006", "Monitor LED Dell 24 polegadas Full HD", 145000.00, 14.00, None, False, "UN"),
    ("PRD-007", "Cimento Portland 42.5R (Saco 50Kg)", 5800.00, 14.00, None, False, "SC"),
    ("PRD-008", "Refrigerante Cola 330ml (Cx 24 Latas)", 8400.00, 14.00, None, False, "CX"),
    ("PRD-009", "Água Mineral de Mesa 1.5L (Pack 6)", 2100.00, 14.00, None, False, "PK"),
    ("SRV-001", "Consultoria Técnica de TI e Infraestruturas", 250000.00, 14.00, None, True, "HORA"),
    ("SRV-002", "Serviços de Manutenção e Redes Industriais", 120000.00, 14.00, None, True, "HORA"),
    ("SRV-003", "Auditoria de Segurança da Informação e Compliance", 650000.00, 14.00, None, True, "PROJ"),
]

MONTH_VOLUMES = [
    (1, 2026, 18, 31),
    (2, 2026, 22, 28),
    (3, 2026, 32, 31),
    (4, 2026, 36, 30),
    (5, 2026, 42, 31),
    (6, 2026, 48, 30),
    (7, 2026, 45, 31),
    (8, 2026, 52, 31),
    (9, 2026, 60, 30),
    (10, 2026, 74, 31),
    (11, 2026, 16, 5),   # Até hoje, 5 de Novembro de 2026!
]

def make_hash(doc_num, prev_hash, dt_str, gross):
    raw = f"{doc_num}-{prev_hash}-{dt_str}-{gross:.2f}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

async def reset_all_data():
    print("=================================================================")
    print("1. LIMPANDO DADOS DE NEGÓCIO EM TODOS OS MICROSSERVIÇOS...")
    print("=================================================================")

    # A. KudibaInvoicing
    c_inv = await asyncpg.connect(f"{PG_BASE}/kudiba_invoicing")
    await c_inv.execute("""
        ALTER TABLE kudiba_core.invoices DISABLE TRIGGER trg_protect_invoices;
        TRUNCATE TABLE kudiba_core.invoice_lines, kudiba_core.invoices, kudiba_core.accounting_outbox CASCADE;
        ALTER TABLE kudiba_core.invoices ENABLE TRIGGER trg_protect_invoices;
        DELETE FROM kudiba_core.series_fiscais WHERE series_code = '2026B';
        DELETE FROM kudiba_core.pos_z_reports;
        UPDATE kudiba_core.tenants 
           SET agt_cert_number = 'FE/528/AGT/2026', 
               company_name = 'Kudiba Comércio & Serviços, Lda.', 
               nif = '5417089123'
         WHERE id = 'a0000000-0000-0000-0000-000000000001';
    """)
    await c_inv.close()
    print("  ✓ kudiba_invoicing: faturas e linhas limpas.")

    # B. KudibaTreasury
    c_tre = await asyncpg.connect(f"{PG_BASE}/kudiba_treasury")
    await c_tre.execute("""
        DELETE FROM kudiba_treasury.payable_settlements;
        DELETE FROM kudiba_treasury.invoice_payables;
        DELETE FROM kudiba_treasury.treasury_receipt_lines;
        DELETE FROM kudiba_treasury.treasury_receipts;
        DELETE FROM kudiba_treasury.invoice_receivables;
        DELETE FROM kudiba_treasury.cash_movements;
        DELETE FROM kudiba_treasury.cash_transfers;
        DELETE FROM kudiba_treasury.bank_statement_lines;
        DELETE FROM kudiba_treasury.bank_statements;
        DELETE FROM kudiba_treasury.cash_sessions;
    """)
    await c_tre.close()
    print("  ✓ kudiba_treasury: recebíveis, recibos, caixa e movimentos limpos.")

    # C. KudibaInventory
    c_est = await asyncpg.connect(f"{PG_BASE}/kudiba_inventory")
    await c_est.execute("""
        ALTER TABLE kudiba_inventory.products
            ADD COLUMN IF NOT EXISTS purchase_unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'UN',
            ADD COLUMN IF NOT EXISTS purchase_conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1;

        DELETE FROM kudiba_inventory.stock_movements;
        DELETE FROM kudiba_inventory.stock_balances;
        DELETE FROM kudiba_inventory.product_batches;
        DELETE FROM kudiba_inventory.products;
        DELETE FROM kudiba_inventory.warehouses;
    """)
    await c_est.close()
    print("  ✓ kudiba_inventory: produtos, armazéns e stocks limpos.")

    # D. KudibaAccounting
    c_acc = await asyncpg.connect(f"{PG_BASE}/kudiba_accounting")
    await c_acc.execute("""
        DELETE FROM kudiba_accounting.cost_tracking_reclassifications;
        DELETE FROM kudiba_accounting.cost_center_allocations;
        DELETE FROM kudiba_accounting.cost_center_budgets;
        DELETE FROM kudiba_accounting.cost_allocation_rule_lines;
        DELETE FROM kudiba_accounting.cost_allocation_rules;
        DELETE FROM kudiba_accounting.journal_lines;
        DELETE FROM kudiba_accounting.journal_entries;
        DELETE FROM kudiba_accounting.processed_events;
    """)
    await c_acc.close()
    print("  ✓ kudiba_accounting: diários e lançamentos limpos.")

    # E. KudibaPayroll
    c_pay = await asyncpg.connect(f"{PG_BASE}/kudiba_payroll")
    await c_pay.execute("""
        DELETE FROM kudiba_payroll.conflict_follow_ups;
        DELETE FROM kudiba_payroll.conflict_meetings;
        DELETE FROM kudiba_payroll.conflict_actions;
        DELETE FROM kudiba_payroll.conflict_participants;
        DELETE FROM kudiba_payroll.conflict_cases;
        DELETE FROM kudiba_payroll.payslip_lines;
        DELETE FROM kudiba_payroll.payslips;
        DELETE FROM kudiba_payroll.payroll_periods;
        DELETE FROM kudiba_payroll.absence_records;
        DELETE FROM kudiba_payroll.attendance_records;
        DELETE FROM kudiba_payroll.vacation_requests;
        DELETE FROM kudiba_payroll.contracts;
        DELETE FROM kudiba_payroll.employees;
    """)
    await c_pay.close()
    print("  ✓ kudiba_payroll: funcionários, contratos e processamentos limpos.")

    # F. KudibaBackoffice
    c_bo = await asyncpg.connect(f"{PG_BASE}/kudiba_backoffice")
    await c_bo.execute("""
        ALTER TABLE kudiba_backoffice.clients
            ADD COLUMN IF NOT EXISTS alvara_number VARCHAR(64),
            ADD COLUMN IF NOT EXISTS alvara_issue_date DATE,
            ADD COLUMN IF NOT EXISTS alvara_expiry_date DATE;

        DELETE FROM kudiba_backoffice.licenses;
        DELETE FROM kudiba_backoffice.clients;
    """)
    await c_bo.close()
    print("  ✓ kudiba_backoffice: licenças e clientes limpos.")

    # G. KudibaAuth: Limpar utilizadores efêmeros, mantendo SYSADMIN e ADMIN
    c_auth = await asyncpg.connect(f"{PG_BASE}/kudiba_auth")
    await c_auth.execute("""
        DELETE FROM kudiba_core.refresh_tokens;
        DELETE FROM kudiba_core.user_roles 
         WHERE user_id NOT IN ('e0000000-0000-0000-0000-000000000000', '6d4df40e-0616-4736-809c-acb1b56487b8');
        DELETE FROM kudiba_core.user_tenants 
         WHERE user_id NOT IN ('e0000000-0000-0000-0000-000000000000', '6d4df40e-0616-4736-809c-acb1b56487b8');
        DELETE FROM kudiba_core.users 
         WHERE id NOT IN ('e0000000-0000-0000-0000-000000000000', '6d4df40e-0616-4736-809c-acb1b56487b8')
           AND email NOT IN ('sysadmin@kudiba.ao', 'admin@kudiba.ao');
        
        -- Atualizar tenant principal com dados oficiais
        UPDATE kudiba_core.tenants
           SET agt_cert_number = 'FE/528/AGT/2026',
               company_name = 'Kudiba Comércio & Serviços, Lda.',
               trade_name = 'Kudiba Tech Angola',
               nif = '5417089123',
               phone = '+244 929 774 155',
               email = 'geral@kudiba.ao',
               alvara_number = 'ALV-2026/00412',
               alvara_issue_date = '2026-01-10',
               alvara_expiry_date = '2029-01-10',
               subscribed_modules = ARRAY['invoicing', 'inventory', 'treasury', 'payroll', 'accounting', 'integrations'],
               license_valid_until = NOW() + INTERVAL '2 years'
         WHERE id = 'a0000000-0000-0000-0000-000000000001';

        -- Garante sysadmin associado e com papéis SYSADMIN e ADMIN
        INSERT INTO kudiba_core.user_tenants (user_id, tenant_id, default_branch_id, status, created_at, updated_at)
        VALUES ('e0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET status = 'ACTIVE';

        INSERT INTO kudiba_core.user_roles (user_id, role_id, tenant_id)
        VALUES ('e0000000-0000-0000-0000-000000000000', 'SYSADMIN', 'a0000000-0000-0000-0000-000000000001')
        ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;

        INSERT INTO kudiba_core.user_roles (user_id, role_id, tenant_id)
        VALUES ('e0000000-0000-0000-0000-000000000000', 'ADMIN', 'a0000000-0000-0000-0000-000000000001')
        ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;
    """)
    await c_auth.close()
    print("  ✓ kudiba_auth: SysAdmin e Admin preservados e tenant principal atualizado.")

    # H. kudiba_erp (compatibilidade regressiva)
    c_erp = await asyncpg.connect(f"{PG_BASE}/kudiba_erp")
    await c_erp.execute("""
        ALTER TABLE kudiba_core.invoices DISABLE TRIGGER trg_protect_invoices;
        TRUNCATE TABLE kudiba_core.invoice_lines, kudiba_core.invoices CASCADE;
        ALTER TABLE kudiba_core.invoices ENABLE TRIGGER trg_protect_invoices;
        DELETE FROM kudiba_core.series_fiscais WHERE series_code = '2026B';
        UPDATE kudiba_core.tenants 
           SET agt_cert_number = 'FE/528/AGT/2026', 
               company_name = 'Kudiba Comércio & Serviços, Lda.', 
               nif = '5417089123'
         WHERE id = 'a0000000-0000-0000-0000-000000000001';
    """)
    await c_erp.close()
    print("  ✓ kudiba_erp: sincronizado.")


async def seed_backoffice_subscribers():
    print("\n=================================================================")
    print("2. INSERINDO CLIENTES SUBSCRITORES COM MÓDULOS DIVERSOS NO BACKOFFICE...")
    print("=================================================================")
    c_bo = await asyncpg.connect(f"{PG_BASE}/kudiba_backoffice")
    c_auth = await asyncpg.connect(f"{PG_BASE}/kudiba_auth")

    for cli in SUBSCRIBER_CLIENTS:
        cli_uuid = uuid.UUID(cli["id"])
        ten_uuid = uuid.UUID(cli["tenant_id"])

        # 1. Inserir cliente no Backoffice
        await c_bo.execute("""
            INSERT INTO kudiba_backoffice.clients (
                id, tenant_id, company_name, nif, alvara_number, alvara_issue_date, alvara_expiry_date,
                contact_name, contact_email, contact_phone, notes, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
            )
        """, cli_uuid, ten_uuid, cli["company_name"], cli["nif"],
             cli["alvara_number"], cli["alvara_issue_date"], cli["alvara_expiry_date"],
             cli["contact_name"], cli["contact_email"], cli["contact_phone"], cli["notes"])

        # 2. Inserir licença anual com os módulos escolhidos
        await c_bo.execute("""
            INSERT INTO kudiba_backoffice.licenses (
                id, client_id, license_key, plan, seats, modules, valid_from, valid_until, status, notes, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
            )
        """, cli_uuid, cli["license_key"], cli["plan"], cli["seats"],
             cli["modules"], cli["valid_from"], cli["valid_until"], cli["status"], cli["notes"])

        # 3. Provisionar o tenant correspondente no kudiba_auth para login e permissões
        slug = cli["company_name"].lower().replace(" ", "-").replace(".", "").replace(",", "")[:32]
        await c_auth.execute("""
            INSERT INTO kudiba_core.tenants (
                id, slug, company_name, trade_name, nif, address_detail, city, country, status,
                phone, email, alvara_number, alvara_issue_date, alvara_expiry_date,
                currency, tax_regime_code, agt_cert_number, default_withholding_rate,
                onboarding_completed, license_valid_until, subscribed_modules, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $3, $4, 'Luanda, Angola', 'Luanda', 'AO', 'ACTIVE',
                $5, $6, $7, $8, $9,
                'AOA', 'REGIME_GERAL', 'FE/528/AGT/2026', 6.50,
                TRUE, $10, $11, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                nif = EXCLUDED.nif,
                alvara_number = EXCLUDED.alvara_number,
                alvara_issue_date = EXCLUDED.alvara_issue_date,
                alvara_expiry_date = EXCLUDED.alvara_expiry_date,
                license_valid_until = EXCLUDED.license_valid_until,
                subscribed_modules = EXCLUDED.subscribed_modules
        """, ten_uuid, slug, cli["company_name"], cli["nif"],
             cli["contact_phone"], cli["contact_email"], cli["alvara_number"], cli["alvara_issue_date"],
             cli["alvara_expiry_date"], datetime.combine(cli["valid_until"], datetime.min.time(), tzinfo=timezone.utc),
             cli["modules"])

    await c_bo.close()
    await c_auth.close()
    print(f"  ✓ Inseridos {len(SUBSCRIBER_CLIENTS)} clientes subscritores B2B com planos Standard, Pro e Enterprise.")


async def seed_inventory_and_warehouses():
    print("\n=================================================================")
    print("3. INSERINDO ARMAZÉNS, PRODUTOS E CONVERSÃO DE UNIDADES (UoM)...")
    print("=================================================================")
    c_est = await asyncpg.connect(f"{PG_BASE}/kudiba_inventory")
    t_uuid = uuid.UUID(TENANT_ID)
    b_uuid = uuid.UUID(BRANCH_ID)

    # 1. Armazéns
    warehouses = [
        (uuid.UUID("a1000000-0000-0000-0000-000000000001"), "ARM-01", "Armazém Central Viana", "Pólo Industrial de Viana, Luanda", True),
        (uuid.UUID("a2000000-0000-0000-0000-000000000002"), "ARM-02", "Loja & Balcão Talatona", "Talatona Shopping, Luanda", False),
        (uuid.UUID("a3000000-0000-0000-0000-000000000003"), "ARM-03", "Entreposto Portuário de Luanda", "Porto de Luanda, Terminal de Cargas", False),
    ]
    for w_id, w_code, w_name, w_loc, w_def in warehouses:
        await c_est.execute("""
            INSERT INTO kudiba_inventory.warehouses (id, tenant_id, branch_id, code, name, is_default, address_detail, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
        """, w_id, t_uuid, b_uuid, w_code, w_name, w_def, w_loc)

    # 2. Produtos com UoM de compra e venda
    products = [
        ("30000000-0000-0000-0000-000000000001", "PROD-001", "REF-ARR-01", "5600123400001", "Arroz Agulha Kudiba 25Kg", "P", "SC", "PAL", 40.0, 18500.0, 14200.0, 14.0, None, 450.0, 50.0),
        ("30000000-0000-0000-0000-000000000002", "PROD-002", "REF-OLE-01", "5600123400002", "Óleo Alimentar Kudiba 1L (Cx 24)", "P", "CX", "PAL", 60.0, 28800.0, 22000.0, 14.0, None, 320.0, 30.0),
        ("30000000-0000-0000-0000-000000000003", "PROD-003", "REF-FAR-01", "5600123400003", "Farinha de Trigo Nacional 1Kg", "P", "UN", "CX", 25.0, 950.0, 720.0, 0.0, "M04", 850.0, 100.0),
        ("30000000-0000-0000-0000-000000000004", "PROD-004", "REF-ACU-01", "5600123400004", "Açúcar Branco Kudiba 1Kg", "P", "UN", "FD", 50.0, 1100.0, 850.0, 0.0, "M04", 920.0, 100.0),
        ("30000000-0000-0000-0000-000000000005", "PRD-005", "REF-NOT-01", "5600123400005", "Computador Portátil HP ProBook G9", "P", "UN", "CX", 1.0, 580000.0, 440000.0, 14.0, None, 45.0, 10.0),
        ("30000000-0000-0000-0000-000000000006", "PRD-006", "REF-MON-01", "5600123400006", "Monitor LED Dell 24 polegadas Full HD", "P", "UN", "CX", 1.0, 145000.0, 110000.0, 14.0, None, 68.0, 15.0),
        ("30000000-0000-0000-0000-000000000007", "PRD-007", "REF-CIM-01", "5600123400007", "Cimento Portland 42.5R (Saco 50Kg)", "P", "SC", "PAL", 30.0, 5800.0, 4400.0, 14.0, None, 1200.0, 150.0),
        ("30000000-0000-0000-0000-000000000008", "PRD-008", "REF-COL-01", "5600123400008", "Refrigerante Cola 330ml (Cx 24 Latas)", "P", "CX", "PAL", 72.0, 8400.0, 6200.0, 14.0, None, 640.0, 50.0),
        ("30000000-0000-0000-0000-000000000009", "PRD-009", "REF-AGU-01", "5600123400009", "Água Mineral de Mesa 1.5L (Pack 6)", "P", "PK", "PAL", 84.0, 2100.0, 1500.0, 14.0, None, 890.0, 80.0),
        ("30000000-0000-0000-0000-000000000010", "SRV-001", "REF-SRV-01", None, "Consultoria Técnica de TI e Infraestruturas", "S", "HORA", "HORA", 1.0, 250000.0, 100000.0, 14.0, None, 0.0, 0.0),
        ("30000000-0000-0000-0000-000000000011", "SRV-002", "REF-SRV-02", None, "Serviços de Manutenção e Redes Industriais", "S", "HORA", "HORA", 1.0, 120000.0, 50000.0, 14.0, None, 0.0, 0.0),
        ("30000000-0000-0000-0000-000000000012", "SRV-003", "REF-SRV-03", None, "Auditoria de Segurança da Informação e Compliance", "S", "PROJ", "PROJ", 1.0, 650000.0, 250000.0, 14.0, None, 0.0, 0.0),
    ]

    for pid, pcode, ref_id, bcode, pname, ptype, uom_sale, uom_buy, factor, pvp, pmp, tax, ex, stk, min_stk in products:
        p_uuid = uuid.UUID(pid)
        is_stk = (ptype == "P")
        await c_est.execute("""
            INSERT INTO kudiba_inventory.products (
                id, tenant_id, code, ref_id, barcode, name, description, product_type,
                is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
                tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
                has_withholding_tax, is_active, purchase_unit_of_measure, purchase_conversion_factor,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, FALSE, $10, $11, $12, $12,
                'IVA', 'NOR', $13, $14, NULL,
                FALSE, TRUE, $15, $16,
                NOW(), NOW()
            )
        """, p_uuid, t_uuid, pcode, ref_id, bcode, pname, pname, ptype,
             is_stk, uom_sale, Decimal(str(pvp)), Decimal(str(pmp)),
             Decimal(str(tax)), ex, uom_buy, Decimal(str(factor)))

        if is_stk:
            await c_est.execute("""
                INSERT INTO kudiba_inventory.stock_balances (
                    id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, 0.00, $5, NOW()
                )
            """, t_uuid, warehouses[0][0], p_uuid, Decimal(str(stk)), Decimal(str(min_stk)))

    await c_est.close()
    print("  ✓ Armazéns e catálogo de produtos/serviços de inventário criados.")


async def seed_treasury_infrastructure():
    print("\n=================================================================")
    print("4. CONFIGURANDO INFRAESTRUTURA DE TESOURARIA & CONTAS BANCÁRIAS...")
    print("=================================================================")
    c_tre = await asyncpg.connect(f"{PG_BASE}/kudiba_treasury")
    t_uuid = uuid.UUID(TENANT_ID)

    # 1. Caixas POS
    await c_tre.execute("""
        INSERT INTO kudiba_treasury.cash_registers (id, tenant_id, code, name, is_active)
        VALUES 
            ('c1000000-0000-0000-0000-000000000001', $1, 'CAIXA-01', 'Caixa Central — Sede Luanda', TRUE),
            ('c2000000-0000-0000-0000-000000000002', $1, 'CAIXA-02', 'Terminal Balcão Talatona', TRUE)
        ON CONFLICT (tenant_id, code) DO NOTHING;
    """, t_uuid)

    # 2. Contas Bancárias
    await c_tre.execute("""
        INSERT INTO kudiba_treasury.bank_accounts (id, tenant_id, bank_name, account_number, iban, currency, current_balance, is_active)
        VALUES 
            ('b1000000-0000-0000-0000-000000000001', $1, 'Banco Angolano de Investimentos (BAI)', '0040.1234.5678.9', 'AO06004000001234567890123', 'AOA', 58450000.0000, TRUE),
            ('b2000000-0000-0000-0000-000000000002', $1, 'Banco de Fomento Angola (BFA)', '0006.9876.5432.1', 'AO06000600009876543210987', 'AOA', 42890000.0000, TRUE)
        ON CONFLICT (tenant_id, iban) DO UPDATE SET current_balance = EXCLUDED.current_balance;
    """, t_uuid)

    # 3. Sessão de Caixa contínua
    await c_tre.execute("""
        INSERT INTO kudiba_treasury.cash_sessions (id, tenant_id, register_id, operator_user_id, status, opening_balance, notes)
        VALUES ('ea000000-0000-0000-0000-000000000001'::uuid, $1, 'c1000000-0000-0000-0000-000000000001'::uuid, 'operador@kudiba.ao', 'OPEN', 50000.0000, 'Sessão operacional contínua')
        ON CONFLICT DO NOTHING;
    """, t_uuid)

    # 4. Contas a Pagar a Fornecedores (ENDE, EPAL, Sonangol, ENSA)
    payables = [
        ("ENDE — Empresa Nacional de Distribuição de Eletricidade", "5412984712", "ENDE-2026/10-09", Decimal("1850000.00"), "2026-11-15", "OUTSTANDING"),
        ("EPAL — Empresa Pública de Águas de Luanda", "5418294012", "EPAL-2026/10-44", Decimal("420000.00"), "2026-11-20", "OUTSTANDING"),
        ("Sonangol Combustíveis & Lubrificantes", "5401928374", "SONA-FAT-99120", Decimal("6800000.00"), "2026-11-10", "PARTIALLY_PAID"),
        ("ENSA Seguros Angola (Apólice Frotas & Instalações)", "5408271923", "ENSA-APO-2026", Decimal("3500000.00"), "2026-11-25", "OUTSTANDING"),
    ]
    for entity, nif, doc_no, amt, due, st in payables:
        paid = Decimal("3000000.00") if st == "PARTIALLY_PAID" else Decimal("0.00")
        await c_tre.execute("""
            INSERT INTO kudiba_treasury.invoice_payables (
                id, tenant_id, supplier_id, supplier_name, supplier_nif, invoice_number,
                activity_type, category, currency, gross_total, withholding_rate, withholding_amount,
                net_payable, amount_paid, due_date, issue_date, payment_method, status, notes, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5,
                'OPERATIONAL', 'Utilities', 'AOA', $6, 0.00, 0.00,
                $6, $7, $8, NOW()::date, 'TRANSFERENCIA', $9, 'Despesas correntes e fornecedores', NOW(), NOW()
            )
        """, t_uuid, nif, entity, nif, doc_no, amt, paid, date.fromisoformat(due), st)

    await c_tre.close()
    print("  ✓ Tesouraria: caixas, contas BAI/BFA e contas a pagar configuradas.")


async def seed_sales_from_jan_to_now():
    print("\n=================================================================")
    print("5. GERANDO VENDAS HISTÓRICAS DE JANEIRO A 05 DE NOVEMBRO DE 2026...")
    print("=================================================================")
    c_inv = await asyncpg.connect(f"{PG_BASE}/kudiba_invoicing")
    c_tre = await asyncpg.connect(f"{PG_BASE}/kudiba_treasury")
    c_acc = await asyncpg.connect(f"{PG_BASE}/kudiba_accounting")
    c_erp = await asyncpg.connect(f"{PG_BASE}/kudiba_erp")

    t_uuid = uuid.UUID(TENANT_ID)

    ft_series_uuid = uuid.UUID(FT_SERIES_ID)
    fr_series_uuid = uuid.UUID(FR_SERIES_ID)

    for db_conn in [c_inv, c_erp]:
        await db_conn.execute("""
            INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, fiscal_year, current_sequence, last_hash, is_active)
            VALUES 
                ($1, $3, 'FT', '2026B', 2026, 0, '', TRUE),
                ($2, $3, 'FR', '2026B', 2026, 0, '', TRUE)
            ON CONFLICT (tenant_id, document_type, series_code, fiscal_year) DO UPDATE
            SET id = EXCLUDED.id, current_sequence = 0, last_hash = '', is_active = TRUE;
        """, ft_series_uuid, fr_series_uuid, t_uuid)

    ft_seq = 0
    fr_seq = 0
    prev_hash_ft = ""
    prev_hash_fr = ""
    dummy_sig = "MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0=="
    receipt_counter = 0

    total_invoices = 0
    total_sales_kz = Decimal("0.00")

    fy_row = await c_acc.fetchrow("SELECT id FROM kudiba_accounting.fiscal_years WHERE tenant_id = $1 AND year_code = 2026 LIMIT 1;", t_uuid)
    fy_id = fy_row["id"] if fy_row else None

    j_row = await c_acc.fetchrow("SELECT id FROM kudiba_accounting.journals WHERE tenant_id = $1 AND code = 'VEND' LIMIT 1;", t_uuid)
    j_id = j_row["id"] if j_row else None

    acc_entry_seq = 0

    for m, y, num_sales, max_days in MONTH_VOLUMES:
        for s_idx in range(num_sales):
            total_invoices += 1
            day = min(max_days, max(1, int(1 + (s_idx / num_sales) * (max_days - 1))))
            hour = 9 + (s_idx * 7) % 9
            minute = (s_idx * 13) % 60
            dt = datetime(y, m, day, hour, minute, 0, tzinfo=timezone.utc)
            dt_str = dt.isoformat()

            is_ft = (s_idx % 2 == 0)
            doc_type = "FT" if is_ft else "FR"

            if is_ft:
                ft_seq += 1
                seq = ft_seq
                series_id = ft_series_uuid
                cust = CUSTOMERS[(ft_seq - 1) % len(CUSTOMERS)]
                pm = "TRANSFERENCIA"
            else:
                fr_seq += 1
                seq = fr_seq
                series_id = fr_series_uuid
                cust = RETAIL_CUSTOMERS[(fr_seq - 1) % len(RETAIL_CUSTOMERS)]
                pm = "MULTICAIXA" if fr_seq % 2 == 0 else "NUMERARIO"

            doc_num = f"{doc_type} 2026B/{seq:06d}"
            inv_uuid = uuid.uuid4()

            lines = []
            if is_ft:
                qty1 = ((seq * 3) % 15) + 2
                p1 = CATALOG[4] if seq % 2 == 1 else CATALOG[9]
                lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4], p1[5]))

                if seq % 2 == 0:
                    qty2 = ((seq * 5) % 20) + 5
                    p2 = CATALOG[0]
                    lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4], p2[5]))
            else:
                qty1 = ((seq * 2) % 8) + 1
                p1 = CATALOG[seq % len(CATALOG)]
                lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4], p1[5]))

                qty2 = ((seq * 3) % 6) + 1
                p2 = CATALOG[(seq + 2) % len(CATALOG)]
                lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4], p2[5]))

            net_total = Decimal("0.00")
            tax_total = Decimal("0.00")
            withholding_total = Decimal("0.00")

            line_inserts = []
            for l_num, code, desc, qty, price, tax_rate, ex_code, is_srv in lines:
                l_net = Decimal(str(qty)) * Decimal(str(price))
                l_tax = l_net * (Decimal(str(tax_rate)) / Decimal("100.00"))
                l_tot = l_net + l_tax
                net_total += l_net
                tax_total += l_tax

                if is_srv and is_ft:
                    withholding_total += l_net * Decimal("0.065")

                line_inserts.append((
                    uuid.uuid4(), inv_uuid, l_num, code, desc,
                    Decimal(str(qty)), Decimal(str(price)), Decimal("0.00"),
                    Decimal(str(tax_rate)), ex_code, l_tot
                ))

            gross_total = net_total + tax_total
            total_sales_kz += gross_total

            prev_h = prev_hash_ft if is_ft else prev_hash_fr
            h_sha = make_hash(doc_num, prev_h, dt_str, float(gross_total))
            if is_ft:
                prev_hash_ft = h_sha
            else:
                prev_hash_fr = h_sha

            val_chars = h_sha[:4].upper()

            # Inserir no kudiba_invoicing
            await c_inv.execute("""
                INSERT INTO kudiba_core.invoices (
                    id, tenant_id, series_id, document_number, sequence_number, document_type,
                    issuer_nif, issuer_address, issuer_city, issuer_country,
                    customer_name, customer_nif, customer_address, customer_city, customer_country,
                    payment_methods, currency, net_total, tax_total, gross_total,
                    withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
                    validation_chars, key_version, is_contingency, tax_regime_code,
                    issued_at, system_entry_date, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14, 'AO',
                    $15, 'AOA', $16, $17, $18,
                    $19, 0.0000, $20, $21,
                    $22, '1', false, 'REGIME_GERAL',
                    $23, $23, $23
                )
            """, inv_uuid, t_uuid, series_id, doc_num, seq, doc_type,
                 ISSUER_NIF, ISSUER_ADDR, ISSUER_CITY, ISSUER_COUNTRY,
                 cust[0], cust[1], cust[2], cust[3],
                 [pm], net_total, tax_total, gross_total,
                 withholding_total, h_sha, dummy_sig,
                 val_chars, dt)

            # Inserir também no kudiba_erp para paridade absoluta
            await c_erp.execute("""
                INSERT INTO kudiba_core.invoices (
                    id, tenant_id, series_id, document_number, sequence_number, document_type,
                    issuer_nif, issuer_address, issuer_city, issuer_country,
                    customer_name, customer_nif, customer_address, customer_city, customer_country,
                    payment_methods, currency, net_total, tax_total, gross_total,
                    withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
                    validation_chars, key_version, is_contingency, tax_regime_code,
                    issued_at, system_entry_date, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12, $13, $14, 'AO',
                    $15, 'AOA', $16, $17, $18,
                    $19, 0.0000, $20, $21,
                    $22, '1', false, 'REGIME_GERAL',
                    $23, $23, $23
                )
            """, inv_uuid, t_uuid, series_id, doc_num, seq, doc_type,
                 ISSUER_NIF, ISSUER_ADDR, ISSUER_CITY, ISSUER_COUNTRY,
                 cust[0], cust[1], cust[2], cust[3],
                 [pm], net_total, tax_total, gross_total,
                 withholding_total, h_sha, dummy_sig,
                 val_chars, dt)

            for lid, iid, lnum, pcode, pdesc, qty, prc, disc, tx, ex_c, ltot in line_inserts:
                await c_inv.execute("""
                    INSERT INTO kudiba_core.invoice_lines (
                        id, invoice_id, line_number, product_code, description, quantity,
                        unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """, lid, iid, lnum, pcode, pdesc, qty, prc, disc, tx, ex_c, ltot)

                await c_erp.execute("""
                    INSERT INTO kudiba_core.invoice_lines (
                        id, invoice_id, line_number, product_code, description, quantity,
                        unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """, lid, iid, lnum, pcode, pdesc, qty, prc, disc, tx, ex_c, ltot)

            # Sincronização em Tesouraria
            if is_ft:
                is_settled = (m < 10) or (m == 10 and day <= 20)
                status_rec = "SETTLED" if is_settled else "OUTSTANDING"

                paid_amt = gross_total if is_settled else Decimal("0.00")
                rem_amt = Decimal("0.00") if is_settled else gross_total

                await c_tre.execute("""
                    INSERT INTO kudiba_treasury.invoice_receivables (
                        id, tenant_id, invoice_id, document_number, document_type, payment_mechanism,
                        gross_total, paid_amount, remaining_amount, status, created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, 'FT', 'TRANSFERENCIA', $4, $5, $6, $7, $8, $8
                    )
                """, t_uuid, str(inv_uuid), doc_num, gross_total, paid_amt, rem_amt, status_rec, dt)

                if is_settled:
                    receipt_counter += 1
                    rec_num = f"RC 2026/{receipt_counter:06d}"
                    await c_tre.execute("""
                        INSERT INTO kudiba_treasury.treasury_receipts (
                            id, tenant_id, receipt_number, customer_id, customer_name, customer_nif,
                            bank_account_id, payment_method, total_amount, currency, issued_at, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, $2, $3, $4, $5,
                            'b1000000-0000-0000-0000-000000000001'::uuid, 'TRANSFERENCIA', $6, 'AOA', $7, $7
                        )
                    """, t_uuid, rec_num, cust[1], cust[0], cust[1], gross_total, dt)
            else:
                await c_tre.execute("""
                    INSERT INTO kudiba_treasury.cash_movements (
                        id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, 'ea000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
                        'SALE_RECEIPT', $2, $3, 'operador@kudiba.ao', $4
                    )
                """, t_uuid, gross_total, f"Venda POS {doc_num} - {cust[0]}", dt)

            # Lançamento em Contabilidade
            if fy_id and j_id and s_idx % 2 == 0:
                acc_entry_seq += 1
                entry_id = uuid.uuid4()
                await c_acc.execute("""
                    INSERT INTO kudiba_accounting.journal_entries (
                        id, tenant_id, fiscal_year_id, journal_id, entry_number, transaction_date,
                        system_entry_date, period, description, source_service, source_document_type,
                        source_document_id, source_document_ref, total_debit, total_credit, status, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'invoicing', $10, $11, $12, $13, $13, 'POSTED', $7
                    )
                """, entry_id, t_uuid, fy_id, j_id, acc_entry_seq, dt.date(), dt, m,
                     f"Registo da fatura {doc_num} - {cust[0]}", doc_type, inv_uuid, doc_num, gross_total)

                await c_acc.execute("""
                    INSERT INTO kudiba_accounting.journal_lines (
                        id, tenant_id, entry_id, line_number, account_code, description,
                        debit_amount, credit_amount, currency, created_at
                    ) VALUES 
                        (gen_random_uuid(), $1, $2, 1, '31.1.2.1', $3, $4, 0.00, 'AOA', $5),
                        (gen_random_uuid(), $1, $2, 2, '71.1.1', $3, 0.00, $6, 'AOA', $5),
                        (gen_random_uuid(), $1, $2, 3, '34.5.3', $3, 0.00, $7, 'AOA', $5)
                """, t_uuid, entry_id, f"Venda {doc_num}", gross_total, dt, net_total, tax_total)

    # Atualizar séries fiscais
    for db_conn in [c_inv, c_erp]:
        await db_conn.execute("""
            INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, fiscal_year, current_sequence, last_hash, is_active)
            VALUES 
                ($1, $3, 'FT', '2026B', 2026, $4, $5, TRUE),
                ($2, $3, 'FR', '2026B', 2026, $6, $7, TRUE)
            ON CONFLICT (tenant_id, document_type, series_code, fiscal_year) DO UPDATE 
            SET current_sequence = EXCLUDED.current_sequence, last_hash = EXCLUDED.last_hash, is_active = TRUE;
        """, ft_series_uuid, fr_series_uuid, t_uuid, ft_seq, prev_hash_ft, fr_seq, prev_hash_fr)

    await c_inv.close()
    await c_tre.close()
    await c_acc.close()
    await c_erp.close()

    print(f"  ✓ Geradas {total_invoices} faturas fiscais ({ft_seq} FT e {fr_seq} FR).")
    print(f"  ✓ Volume total faturado: {total_sales_kz:,.2f} Kz ao longo de 11 meses.")
    print(f"  ✓ {receipt_counter} recibos de cobrança e recebíveis gerados.")
    print(f"  ✓ {acc_entry_seq} lançamentos contabilísticos criados em partidas dobradas.")


async def seed_payroll_periods():
    print("\n=================================================================")
    print("6. GERANDO PROCESSAMENTO SALARIAL COM TABELA IRT 2026 & INSS...")
    print("=================================================================")
    c_pay = await asyncpg.connect(f"{PG_BASE}/kudiba_payroll")
    t_uuid = uuid.UUID(TENANT_ID)

    employees = [
        ("e1000000-0000-0000-0000-000000000001", "EMP-001", "Manuel António Coxi", "005481920LA042", "manuel.coxi@kudiba.ao", Decimal("1250000.00"), Decimal("60000.00"), Decimal("50000.00")),
        ("e2000000-0000-0000-0000-000000000002", "EMP-002", "Esperança de Carvalho", "004312890LA031", "esperanca@kudiba.ao", Decimal("850000.00"), Decimal("60000.00"), Decimal("50000.00")),
        ("e3000000-0000-0000-0000-000000000003", "EMP-003", "João Baptista Silva", "006721980LA019", "joao.silva@kudiba.ao", Decimal("950000.00"), Decimal("60000.00"), Decimal("50000.00")),
        ("e4000000-0000-0000-0000-000000000004", "EMP-004", "Maria de Fátima Neto", "007812340LA055", "fatima.neto@kudiba.ao", Decimal("350000.00"), Decimal("40000.00"), Decimal("30000.00")),
        ("e5000000-0000-0000-0000-000000000005", "EMP-005", "Mateus Bento Kapita", "008934560LA072", "mateus.kapita@kudiba.ao", Decimal("280000.00"), Decimal("40000.00"), Decimal("30000.00")),
        ("e6000000-0000-0000-0000-000000000006", "EMP-006", "Ana Paula Domingos", "009145670LA088", "ana.domingos@kudiba.ao", Decimal("190000.00"), Decimal("30000.00"), Decimal("25000.00")),
    ]

    for idx, (eid, ecode, ename, nif, email, base, sub_alim, sub_trans) in enumerate(employees, start=1):
        e_uuid = uuid.UUID(eid)
        emp_iban = f"AO0600400000123456789{idx:02d}01"
        await c_pay.execute("""
            INSERT INTO kudiba_payroll.employees (
                id, tenant_id, code, full_name, nif, inss_number, identity_card_number,
                email, phone, iban, status, hire_date, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, '928371948', $5,
                $6, '+244 923 000 000', $7, 'ACTIVE', '2025-01-01', NOW(), NOW()
            )
        """, e_uuid, t_uuid, ecode, ename, nif, email, emp_iban)

        c_id = uuid.uuid4()
        await c_pay.execute("""
            INSERT INTO kudiba_payroll.contracts (
                id, tenant_id, employee_id, contract_type, base_salary, status, start_date, created_at, updated_at
            ) VALUES (
                $1, $2, $3, 'PERMANENT', $4, 'ACTIVE', '2025-01-01', NOW(), NOW()
            )
        """, c_id, t_uuid, e_uuid, base)

    # Processamento salarial mensal de Janeiro a Outubro de 2026
    for m in range(1, 11):
        p_id = uuid.uuid4()
        start_d = date(2026, m, 1)
        end_d = date(2026, m, 28 if m == 2 else (30 if m in [4, 6, 9] else 31))
        p_title = f"Folha Salarial {m:02d}/2026"

        tot_gross_p = Decimal("0.00")
        tot_net_p = Decimal("0.00")
        tot_irt_p = Decimal("0.00")
        tot_inss_ee_p = Decimal("0.00")
        tot_inss_er_p = Decimal("0.00")

        await c_pay.execute("""
            INSERT INTO kudiba_payroll.payroll_periods (
                id, tenant_id, title, year, month, start_date, end_date,
                status, total_gross, total_net, total_irt, total_inss_employee, total_inss_employer,
                closed_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, 2026, $4, $5, $6,
                'CLOSED', 0, 0, 0, 0, 0,
                NOW(), NOW(), NOW()
            )
        """, p_id, t_uuid, p_title, m, start_d, end_d)

        for eid, ecode, ename, nif, email, base, sub_alim, sub_trans in employees:
            e_uuid = uuid.UUID(eid)
            c_row = await c_pay.fetchrow("SELECT id FROM kudiba_payroll.contracts WHERE employee_id = $1 LIMIT 1;", e_uuid)
            contract_id = c_row["id"] if c_row else uuid.uuid4()

            inss_worker = base * Decimal("0.03")
            inss_company = base * Decimal("0.08")
            allowances = sub_alim + sub_trans
            gross = base + allowances
            taxable_irt = max(Decimal("0.00"), base - inss_worker)
            irt_amt = taxable_irt * Decimal("0.17")
            deductions = inss_worker + irt_amt
            net = gross - deductions

            tot_gross_p += gross
            tot_net_p += net
            tot_irt_p += irt_amt
            tot_inss_ee_p += inss_worker
            tot_inss_er_p += inss_company

            await c_pay.execute("""
                INSERT INTO kudiba_payroll.payslips (
                    id, tenant_id, period_id, employee_id, contract_id, days_worked,
                    base_salary, total_gross, total_allowances, total_overtime,
                    base_inss, inss_employee, inss_employer, materia_coletavel_irt,
                    irt, total_deductions, net_salary, status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, 22,
                    $5, $6, $7, 0.00,
                    $5, $8, $9, $10,
                    $11, $12, $13, 'PAID', NOW(), NOW()
                )
            """, t_uuid, p_id, e_uuid, contract_id,
                 base, gross, allowances,
                 inss_worker, inss_company, taxable_irt,
                 irt_amt, deductions, net)

        await c_pay.execute("""
            UPDATE kudiba_payroll.payroll_periods
               SET total_gross = $2, total_net = $3, total_irt = $4,
                   total_inss_employee = $5, total_inss_employer = $6
             WHERE id = $1;
        """, p_id, tot_gross_p, tot_net_p, tot_irt_p, tot_inss_ee_p, tot_inss_er_p)

    await c_pay.close()
    print("  ✓ Processados 10 meses de folhas salariais para 6 colaboradores com IRT e INSS.")


async def main():
    await reset_all_data()
    await seed_backoffice_subscribers()
    await seed_inventory_and_warehouses()
    await seed_treasury_infrastructure()
    await seed_sales_from_jan_to_now()
    await seed_payroll_periods()

    print("\n=================================================================")
    print("RESUMO DA OPERAÇÃO DE RESET E REPOVOAMENTO:")
    print("=================================================================")
    print("✓ Todos os dados de teste antigos foram limpos.")
    print("✓ Utilizador SYSADMIN (sysadmin@kudiba.ao) e ADMIN mantidos e ativos.")
    print("✓ 8 Clientes subscritores B2B registados no Backoffice com diferentes planos e módulos.")
    print("✓ Vendas de Janeiro de 2026 até hoje (05 de Novembro de 2026) geradas com volumes progressivos.")
    print("✓ Certificado AGT configurado formalmente como FE/528/AGT/2026.")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(main())
