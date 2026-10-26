#!/usr/bin/env python3
"""
Kudiba ERP - Adicionar Vendas Recentes e Sincronizar Tesouraria
Adiciona vendas desde 17 de Outubro até hoje (25 de Outubro de 2026),
mantendo a cadeia de hash fiscal ininterrupta (AGT Angola) e povoando
as tabelas de tesouraria (recebíveis, recibos e movimentos de caixa).
"""
import uuid
import hashlib
from datetime import datetime
import subprocess

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
FT_SERIES_ID = "b0000000-0000-0000-0000-000000000001"
FR_SERIES_ID = "b0000000-0000-0000-0000-000000000002"

ISSUER_NIF = "5001234567"
ISSUER_ADDR = "Avenida 4 de Fevereiro, n.º 120, Marginal de Luanda"
ISSUER_CITY = "Luanda"
ISSUER_COUNTRY = "AO"

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
    ("Soba Store Angola Lda", "5416677889", "Avenida Comandante Valódia, Luanda", "Luanda"),
    ("Multitel Serviços de Telecomunicações", "5413344556", "Talatona Park, Edifício 2, Luanda", "Luanda"),
    ("TotalEnergies EP Angola", "5407788990", "Avenida 4 de Fevereiro 140, Luanda", "Luanda"),
    ("Angola Cables S.A.", "5418899001", "Talatona Central Park, Luanda", "Luanda"),
    ("Secil Marítima S.A.", "5404455667", "Terminal Marítimo de Luanda", "Luanda"),
    ("Standard Bank Angola", "5411122334", "Condomínio Belas Business Park, Luanda", "Luanda"),
    ("Nova Cimangola S.A.", "5403322114", "Estrada de Cacuaco, Luanda", "Luanda"),
    ("Africell Angola S.A.", "5419900112", "Edifício Kings Tower, Luanda", "Luanda"),
    ("Pumangol Lda", "5406655443", "Zona Industrial de Viana, Luanda", "Luanda"),
    ("Refriango Indústria Lda", "5408877665", "Complexo Industrial do Kikuxi, Viana", "Luanda"),
    ("Grupo Castel Angola Lda", "5402211334", "Estrada de Catete km 14, Luanda", "Luanda"),
]

RETAIL_CUSTOMERS = [
    ("Consumidor Final", "999999999", "Luanda", "Luanda"),
    ("Hipermercado Kero", "5412233445", "Nova Vida, Luanda", "Luanda"),
    ("Restaurante Marginal", "5415566778", "Ilha de Luanda", "Luanda"),
    ("Farmácia Popular Lda", "5416677880", "Maianga, Luanda", "Luanda"),
    ("Alimenta Angola Viana", "5417788992", "Viana, Luanda", "Luanda"),
    ("Padaria e Pastelaria Luanda", "5418899003", "Ingombota, Luanda", "Luanda"),
    ("Clínica Girassol Lda", "5419900114", "Maianga, Luanda", "Luanda"),
    ("Hotel Epic Sana Luanda", "5410011225", "Rua da Missão, Luanda", "Luanda"),
    ("Supermercado Candando", "5413344557", "Talatona, Luanda", "Luanda"),
    ("Distribuidora Viana Lda", "5414455668", "Viana Park, Luanda", "Luanda"),
    ("Papelaria Central Lda", "5415566779", "Mutamba, Luanda", "Luanda"),
]

CATALOG = [
    ("PROD-001", "Arroz Agulha Kudiba 5Kg", 4500.00, 14.00, None),
    ("PROD-002", "Óleo Alimentar Kudiba 1L", 1850.00, 14.00, None),
    ("PROD-003", "Farinha de Trigo Nacional 1Kg", 950.00, 0.00, "M04"),
    ("PROD-004", "Açúcar Branco Kudiba 1Kg", 1100.00, 0.00, "M04"),
    ("PRD-005", "Computador Portátil HP ProBook", 450000.00, 14.00, None),
    ("PRD-006", "Monitor LED 24 polegadas Dell", 125000.00, 14.00, None),
    ("SRV-001", "Consultoria e Suporte Técnico TI", 150000.00, 14.00, None),
    ("SRV-002", "Serviços de Manutenção e Rede", 85000.00, 14.00, None),
]

# Novas vendas a adicionar até hoje (25 de Outubro de 2026)
NEW_DATES = [
    ("2026-10-17 10:15:00+00", "FT"),
    ("2026-10-18 15:30:00+00", "FR"),
    ("2026-10-19 11:20:00+00", "FT"),
    ("2026-10-20 16:45:00+00", "FR"),
    ("2026-10-21 09:30:00+00", "FT"),
    ("2026-10-22 14:15:00+00", "FR"),
    ("2026-10-23 11:00:00+00", "FT"),
    ("2026-10-23 17:10:00+00", "FR"),
    ("2026-10-24 10:20:00+00", "FT"),
    ("2026-10-24 16:30:00+00", "FR"),
    ("2026-10-25 09:15:00+00", "FT"), # Hoje de manhã
    ("2026-10-25 11:30:00+00", "FR"), # Hoje meio-dia
    ("2026-10-25 14:00:00+00", "FT"), # Hoje tarde
    ("2026-10-25 15:45:00+00", "FR"), # Hoje agora
]

def make_hash(doc_num, prev_hash, dt_str, gross):
    raw = f"{doc_num}-{prev_hash}-{dt_str}-{gross}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

# 1. Obter a sequência atual e último hash
cmd_ft = "docker exec kudiba-postgres psql -U kudiba -d kudiba_invoicing -t -A -c \"SELECT sequence_number, hash_sha256 FROM kudiba_core.invoices WHERE series_id = 'b0000000-0000-0000-0000-000000000001' ORDER BY sequence_number DESC LIMIT 1;\""
cmd_fr = "docker exec kudiba-postgres psql -U kudiba -d kudiba_invoicing -t -A -c \"SELECT sequence_number, hash_sha256 FROM kudiba_core.invoices WHERE series_id = 'b0000000-0000-0000-0000-000000000002' ORDER BY sequence_number DESC LIMIT 1;\""

ft_res = subprocess.check_output(cmd_ft, shell=True).decode().strip().split("|")
fr_res = subprocess.check_output(cmd_fr, shell=True).decode().strip().split("|")

ft_seq = int(ft_res[0])
prev_hash_ft = ft_res[1]

fr_seq = int(fr_res[0])
prev_hash_fr = fr_res[1]

print(f"Sequência atual FT: {ft_seq}, Hash: {prev_hash_ft[:8]}...")
print(f"Sequência atual FR: {fr_seq}, Hash: {prev_hash_fr[:8]}...")

invoicing_sql = ["BEGIN;"]
dummy_sig = "MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0=="

for idx, (dt_str, doc_type) in enumerate(NEW_DATES):
    inv_id = str(uuid.uuid4())
    if doc_type == "FT":
        ft_seq += 1
        seq = ft_seq
        series_id = FT_SERIES_ID
        cust = CUSTOMERS[(seq - 1) % len(CUSTOMERS)]
        pm = "TRANSFERENCIA"
    else:
        fr_seq += 1
        seq = fr_seq
        series_id = FR_SERIES_ID
        cust = RETAIL_CUSTOMERS[(seq - 1) % len(RETAIL_CUSTOMERS)]
        pm = "MULTICAIXA" if seq % 2 == 0 else "NUMERARIO"

    doc_num = f"{doc_type} 2026B/{seq:06d}"

    lines = []
    if doc_type == "FT":
        qty1 = (seq * 2) % 15 + 2
        p1 = CATALOG[4] if seq % 2 == 1 else CATALOG[6]
        lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4]))

        if seq % 2 == 0:
            qty2 = (seq * 4) % 25 + 5
            p2 = CATALOG[0]
            lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4]))
    else:
        qty1 = (seq * 3) % 10 + 1
        p1 = CATALOG[seq % len(CATALOG)]
        lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4]))
        
        qty2 = (seq * 2) % 8 + 1
        p2 = CATALOG[(seq + 1) % len(CATALOG)]
        lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4]))

    net_total = 0.0
    tax_total = 0.0
    line_sqls = []

    for l_num, code, desc, qty, price, tax_rate, ex_code in lines:
        line_id = str(uuid.uuid4())
        l_net = qty * price
        l_tax = l_net * (tax_rate / 100.0)
        l_total = l_net + l_tax
        net_total += l_net
        tax_total += l_tax
        ex_val = f"'{ex_code}'" if ex_code else "NULL"
        line_sqls.append(f"""
        INSERT INTO kudiba_core.invoice_lines (
            id, invoice_id, line_number, product_code, description, quantity, unit_price, discount_amount, tax_rate, tax_exemption_code, line_total
        ) VALUES (
            '{line_id}', '{inv_id}', {l_num}, '{code}', '{desc}', {qty:.4f}, {price:.4f}, 0.0000, {tax_rate:.2f}, {ex_val}, {l_total:.4f}
        );
        """)

    gross_total = net_total + tax_total
    prev_h = prev_hash_ft if doc_type == "FT" else prev_hash_fr
    h_sha = make_hash(doc_num, prev_h, dt_str, gross_total)
    if doc_type == "FT":
        prev_hash_ft = h_sha
    else:
        prev_hash_fr = h_sha

    val_chars = h_sha[:4].upper()

    invoicing_sql.append(f"""
    INSERT INTO kudiba_core.invoices (
        id, tenant_id, series_id, document_number, sequence_number, document_type,
        issuer_nif, issuer_address, issuer_city, issuer_country,
        customer_name, customer_nif, customer_address, customer_city, customer_country,
        payment_methods, currency, net_total, tax_total, gross_total,
        withholding_total, stamp_duty_total, hash_sha256, signature_rsa_base64,
        validation_chars, key_version, is_contingency, tax_regime_code,
        issued_at, system_entry_date, created_at
    ) VALUES (
        '{inv_id}', '{TENANT_ID}', '{series_id}', '{doc_num}', {seq}, '{doc_type}',
        '{ISSUER_NIF}', '{ISSUER_ADDR}', '{ISSUER_CITY}', '{ISSUER_COUNTRY}',
        '{cust[0]}', '{cust[1]}', '{cust[2]}', '{cust[3]}', 'AO',
        ARRAY['{pm}'], 'AOA', {net_total:.4f}, {tax_total:.4f}, {gross_total:.4f},
        0.0000, 0.0000, '{h_sha}', '{dummy_sig}',
        '{val_chars}', '1', false, 'REGIME_GERAL',
        '{dt_str}', '{dt_str}', '{dt_str}'
    );
    """)
    invoicing_sql.extend(line_sqls)

# Atualizar as séries fiscais
invoicing_sql.append(f"""
UPDATE kudiba_core.series_fiscais
SET current_sequence = {ft_seq}, last_hash = '{prev_hash_ft}'
WHERE id = '{FT_SERIES_ID}';

UPDATE kudiba_core.series_fiscais
SET current_sequence = {fr_seq}, last_hash = '{prev_hash_fr}'
WHERE id = '{FR_SERIES_ID}';
""")

invoicing_sql.append("COMMIT;")

with open("/tmp/new_sales.sql", "w") as f:
    f.write("\n".join(invoicing_sql))

print(f"Geradas {len(NEW_DATES)} novas faturas até hoje. Aplicando ao banco...")
subprocess.check_call("docker exec -i kudiba-postgres psql -U kudiba -d kudiba_invoicing < /tmp/new_sales.sql", shell=True)
subprocess.check_call("docker exec -i kudiba-postgres psql -U kudiba -d kudiba_erp < /tmp/new_sales.sql", shell=True)
print("Faturas aplicadas com sucesso!")

# Agora sincronizar kudiba_treasury
print("Sincronizando Tesouraria...")
treasury_sql = ["BEGIN;"]

# Sessão de caixa activa
cmd_session = "docker exec kudiba-postgres psql -U kudiba -d kudiba_treasury -t -A -c \"SELECT id FROM kudiba_treasury.cash_sessions WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;\""
open_session_id = subprocess.check_output(cmd_session, shell=True).decode().strip()
if not open_session_id:
    open_session_id = "s0000000-0000-0000-0000-000000000001"

# Obter todas as faturas para alimentar a tesouraria
cmd_all_inv = "docker exec kudiba-postgres psql -U kudiba -d kudiba_invoicing -t -A -c \"SELECT id, document_number, document_type, customer_name, customer_nif, gross_total, issued_at FROM kudiba_core.invoices WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001' ORDER BY issued_at ASC;\""
all_inv = subprocess.check_output(cmd_all_inv, shell=True).decode().strip().split("\n")

receipt_counter = 0

for line in all_inv:
    if not line.strip():
        continue
    parts = line.split("|")
    i_id, doc_num, doc_type, cust_name, cust_nif, gross, dt_str = parts[0], parts[1], parts[2], parts[3], parts[4], float(parts[5]), parts[6]
    dt = datetime.fromisoformat(dt_str.replace("+00", "+00:00"))

    if doc_type == "FT":
        # Facturas a prazo: anteriores a 18 de Outubro estão liquidadas; as recentes (18 a 25 Out) estão pendentes
        is_settled = dt.month < 10 or (dt.month == 10 and dt.day < 18)
        rec_status = "SETTLED" if is_settled else "OUTSTANDING"

        treasury_sql.append(f"""
        INSERT INTO kudiba_treasury.invoice_receivables (
            id, tenant_id, invoice_id, document_number, document_type, payment_mechanism, gross_total, status, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), '{TENANT_ID}', '{i_id}', '{doc_num}', 'FT', 'TRANSFERENCIA', {gross:.4f}, '{rec_status}', '{dt_str}', '{dt_str}'
        ) ON CONFLICT (tenant_id, invoice_id) DO UPDATE SET status = EXCLUDED.status;
        """)

        if is_settled:
            receipt_counter += 1
            rec_id = str(uuid.uuid4())
            rec_num = f"RC 2026/{receipt_counter:06d}"
            treasury_sql.append(f"""
            INSERT INTO kudiba_treasury.treasury_receipts (
                id, tenant_id, receipt_number, customer_id, customer_name, customer_nif, bank_account_id, payment_method, total_amount, currency, issued_at, created_at
            ) VALUES (
                '{rec_id}', '{TENANT_ID}', '{rec_num}', '{cust_nif}', '{cust_name}', '{cust_nif}', 'b0000000-0000-0000-0000-000000000002', 'TRANSFERENCIA', {gross:.4f}, 'AOA', '{dt_str}', '{dt_str}'
            ) ON CONFLICT (tenant_id, receipt_number) DO NOTHING;
            """)
    else:
        # Faturas-Recibo geram movimento de caixa
        treasury_sql.append(f"""
        INSERT INTO kudiba_treasury.cash_movements (
            id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
        ) VALUES (
            gen_random_uuid(), '{TENANT_ID}', '{open_session_id}', 'c0000000-0000-0000-0000-000000000001',
            'SALE_RECEIPT', {gross:.4f}, 'Venda a pronto {doc_num} - {cust_name}', 'operador@kudiba.ao', '{dt_str}'
        );
        """)

treasury_sql.append("COMMIT;")

with open("/tmp/treasury_sync.sql", "w") as f:
    f.write("\n".join(treasury_sql))

subprocess.check_call("docker exec -i kudiba-postgres psql -U kudiba -d kudiba_treasury < /tmp/treasury_sync.sql", shell=True)
print(f"Tesouraria sincronizada com sucesso! {receipt_counter} recibos e carteira de cobranças atualizada.")
