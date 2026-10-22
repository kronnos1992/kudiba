#!/usr/bin/env python3
import uuid
import hashlib
from datetime import datetime

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
    ("PROD-003", "Farinha de Trigo Nacional 1Kg", 950.00, 0.00, "M04"), # Cesta basica
    ("PROD-004", "Açúcar Branco Kudiba 1Kg", 1100.00, 0.00, "M04"), # Cesta basica
    ("PRD-005", "Computador Portátil HP ProBook", 450000.00, 14.00, None),
    ("PRD-006", "Monitor LED 24 polegadas Dell", 125000.00, 14.00, None),
    ("SRV-001", "Consultoria e Suporte Técnico TI", 150000.00, 14.00, None),
    ("SRV-002", "Serviços de Manutenção e Rede", 85000.00, 14.00, None),
]

# 40 datas distribuídas entre Janeiro e Outubro de 2026
DATES = [
    # Janeiro (4)
    ("2026-01-08 10:15:00+00", "FT"),
    ("2026-01-16 14:30:00+00", "FR"),
    ("2026-01-24 11:20:00+00", "FT"),
    ("2026-01-29 16:45:00+00", "FR"),
    # Fevereiro (4)
    ("2026-02-05 09:30:00+00", "FT"),
    ("2026-02-14 15:10:00+00", "FR"),
    ("2026-02-20 11:50:00+00", "FT"),
    ("2026-02-26 17:00:00+00", "FR"),
    # Março (4)
    ("2026-03-04 10:00:00+00", "FT"),
    ("2026-03-12 13:40:00+00", "FR"),
    ("2026-03-19 16:15:00+00", "FT"),
    ("2026-03-27 12:25:00+00", "FR"),
    # Abril (4)
    ("2026-04-03 09:45:00+00", "FT"),
    ("2026-04-11 14:15:00+00", "FR"),
    ("2026-04-18 11:30:00+00", "FT"),
    ("2026-04-24 16:50:00+00", "FR"),
    # Maio (4)
    ("2026-05-06 10:20:00+00", "FT"),
    ("2026-05-13 15:35:00+00", "FR"),
    ("2026-05-21 11:10:00+00", "FT"),
    ("2026-05-28 17:15:00+00", "FR"),
    # Junho (4)
    ("2026-06-04 09:15:00+00", "FT"),
    ("2026-06-12 14:40:00+00", "FR"),
    ("2026-06-19 11:25:00+00", "FT"),
    ("2026-06-25 16:20:00+00", "FR"),
    # Julho (4)
    ("2026-07-03 10:30:00+00", "FT"),
    ("2026-07-10 13:50:00+00", "FR"),
    ("2026-07-17 12:05:00+00", "FT"),
    ("2026-07-24 15:45:00+00", "FR"),
    # Agosto (4)
    ("2026-08-05 09:50:00+00", "FT"),
    ("2026-08-13 14:20:00+00", "FR"),
    ("2026-08-20 11:40:00+00", "FT"),
    ("2026-08-27 16:35:00+00", "FR"),
    # Setembro (4)
    ("2026-09-03 10:10:00+00", "FT"),
    ("2026-09-11 15:05:00+00", "FR"),
    ("2026-09-18 11:15:00+00", "FT"),
    ("2026-09-25 17:00:00+00", "FR"),
    # Outubro - Dias Anteriores (4)
    ("2026-10-02 09:30:00+00", "FT"),
    ("2026-10-05 14:10:00+00", "FR"),
    ("2026-10-09 11:45:00+00", "FT"),
    ("2026-10-12 16:25:00+00", "FR"),
]

def make_hash(doc_num, prev_hash, dt_str, gross):
    raw = f"{doc_num}-{prev_hash}-{dt_str}-{gross}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

sql = []
sql.append("BEGIN;")

# 1. Garantir que as séries 2026B existem
sql.append(f"""
INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, fiscal_year, current_sequence, last_hash, is_active)
VALUES 
  ('{FT_SERIES_ID}', '{TENANT_ID}', 'FT', '2026B', 2026, 20, '', true),
  ('{FR_SERIES_ID}', '{TENANT_ID}', 'FR', '2026B', 2026, 20, '', true)
ON CONFLICT (tenant_id, document_type, series_code, fiscal_year) DO UPDATE SET current_sequence = 20, is_active = true;
""")

ft_seq = 0
fr_seq = 0
prev_hash_ft = ""
prev_hash_fr = ""

dummy_sig = "MEQCIBJ1G6yv4oA18l6j7o9u5v8w2x1y0z3A4B5C6D7E8F9GAiB9h8g7f6e5d4c3b2a1z0y9x8w7v6u5t4s3r2q1p0=="

for idx, (dt_str, doc_type) in enumerate(DATES):
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
    
    # Gerar linhas da fatura
    # Variar produtos com base no índice
    lines = []
    if doc_type == "FT":
        # Grandes encomendas corporativas
        qty1 = (seq * 3) % 20 + 2
        p1 = CATALOG[4] if seq % 2 == 1 else CATALOG[6] # Portatil ou Consultoria
        lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4]))

        if seq % 3 == 0:
            qty2 = (seq * 5) % 30 + 5
            p2 = CATALOG[0] # Arroz
            lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4]))
    else:
        # Faturas-recibo / retalho
        qty1 = (seq * 4) % 15 + 1
        p1 = CATALOG[seq % len(CATALOG)]
        lines.append((1, p1[0], p1[1], qty1, p1[2], p1[3], p1[4]))
        
        qty2 = (seq * 2) % 10 + 1
        p2 = CATALOG[(seq + 1) % len(CATALOG)]
        lines.append((2, p2[0], p2[1], qty2, p2[2], p2[3], p2[4]))

    net_total = 0.0
    tax_total = 0.0

    line_sql_parts = []
    for l_num, code, desc, qty, price, tax_rate, ex_code in lines:
        line_id = str(uuid.uuid4())
        l_net = qty * price
        l_tax = l_net * (tax_rate / 100.0)
        l_total = l_net + l_tax
        net_total += l_net
        tax_total += l_tax
        ex_val = f"'{ex_code}'" if ex_code else "NULL"
        line_sql_parts.append(f"""
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

    sql.append(f"""
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

    for l_sql in line_sql_parts:
        sql.append(l_sql)

sql.append("COMMIT;")

with open("Backend/deploy/seed-historical-invoices.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql))

print(f"Sucesso! Gerados {len(DATES)} documentos de faturação históricos em Backend/deploy/seed-historical-invoices.sql")
