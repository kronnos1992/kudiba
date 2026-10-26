#!/usr/bin/env python3
"""
Kudiba ERP - Povoamento Completo do Módulo de Gestão de Stock e Inventário
Popula artigos, fornecedores, lotes, saldos de armazém e movimentos de stock.
"""
import uuid
import subprocess

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
ADMIN_USER_ID = "10000000-0000-0000-0000-000000000001"
ARM_SEDE_ID = "20000000-0000-0000-0000-000000000001"
ARM_CAZENGA_ID = "f3c073b8-c250-454b-a0db-0bcb9e0c172f"

sql = ["BEGIN;"]

# 1. Garante que a coluna ref_id e índices existem
sql.append("""
ALTER TABLE kudiba_inventory.products ADD COLUMN IF NOT EXISTS ref_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_products_ref_id ON kudiba_inventory.products(tenant_id, ref_id) WHERE ref_id IS NOT NULL;
""")

# 2. Entidades Comerciais (Fornecedores e Clientes Cadastrados)
ENTITIES = [
    ("SUPPLIER", "LEGAL_ENTITY", "5408877665", "Refriango Indústria Lda", "Refriango", "comercial@refriango.ao", "+244 923 111 222", "Luanda", "Viana", "Complexo Industrial do Kikuxi, Viana", "AO06004000001234567890101"),
    ("SUPPLIER", "LEGAL_ENTITY", "5403322114", "Nova Cimangola S.A.", "Nova Cimangola", "vendas@cimangola.co.ao", "+244 923 222 333", "Luanda", "Cacuaco", "Estrada de Cacuaco km 8", "AO06004000002345678901202"),
    ("SUPPLIER", "LEGAL_ENTITY", "5412233445", "AngoAlissar Alimentos Lda", "AngoAlissar", "contacto@angoalissar.com", "+244 923 333 444", "Luanda", "Viana", "Pólo Industrial de Viana, Rua 4", "AO06004000003456789012303"),
    ("SUPPLIER", "LEGAL_ENTITY", "5401122334", "NCR Angola Comercial Lda", "NCR Angola", "empresas@ncrangola.com", "+244 923 444 555", "Luanda", "Luanda", "Avenida Lenine 62, Ingombota", "AO06004000004567890123404"),
    ("SUPPLIER", "LEGAL_ENTITY", "5406655443", "Pumangol Lda", "Pumangol", "corporate@pumangol.ao", "+244 923 555 666", "Luanda", "Luanda", "Edifício Presidente Business Park", "AO06004000005678901234505"),
    ("CUSTOMER", "LEGAL_ENTITY", "5417892341", "Unitel S.A.", "Unitel", "corporate@unitel.ao", "+244 923 000 111", "Luanda", "Maianga", "Rua do Cergal 10, Maianga", "AO06004000006789012345606"),
    ("CUSTOMER", "LEGAL_ENTITY", "5401234567", "Banco BAI S.A.", "BAI", "apoio@bancobai.ao", "+244 222 693 800", "Luanda", "Luanda", "Avenida Lenine 35, Luanda", "AO06004000007890123456707"),
    ("BOTH", "LEGAL_ENTITY", "5400012345", "Sonangol Distribuidora E.P.", "Sonangol", "info@sonangol.co.ao", "+244 226 642 000", "Luanda", "Luanda", "Rua Rainha Ginga 29, Luanda", "AO06004000008901234567808"),
]

for e_type, t_kind, nif, name, trade, email, phone, prov, city, addr, iban in ENTITIES:
    sql.append(f"""
    INSERT INTO kudiba_inventory.entities (
        id, tenant_id, entity_type, tax_id_type, tax_id, name, trade_name, email, phone,
        country_code, province, city, address_detail, iban, is_active
    ) VALUES (
        gen_random_uuid(), '{TENANT_ID}', '{e_type}', '{t_kind}', '{nif}', '{name}', '{trade}', '{email}', '{phone}',
        'AO', '{prov}', '{city}', '{addr}', '{iban}', true
    ) ON CONFLICT (tenant_id, tax_id) DO UPDATE SET
        name = EXCLUDED.name, trade_name = EXCLUDED.trade_name, email = EXCLUDED.email, phone = EXCLUDED.phone;
    """)

# 3. Catálogo de Artigos Completo (Alimentar, Informática e Serviços)
PRODUCTS = [
    # id, code, ref_id, barcode, name, description, type, stockable, lots, uom, sale_price, cost_price, cmp, tax_pct, ex_code, ex_text
    ("30000000-0000-0000-0000-000000000001", "PROD-001", "REF-ARR-01", "5600123400001", "Arroz Agulha Kudiba 5Kg", "Saco de arroz agulha selecionado 5Kg", "P", True, False, "UN", 4500.0, 3200.0, 3200.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000002", "PROD-002", "REF-OLE-01", "5600123400002", "Óleo Alimentar Kudiba 1L", "Garrafa de óleo alimentar 100% vegetal 1L", "P", True, True, "UN", 1850.0, 1300.0, 1300.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000003", "PROD-003", "REF-FAR-01", "5600123400003", "Farinha de Trigo Nacional 1Kg", "Farinha de trigo fina tipo 55 - Cesta Básica", "P", True, True, "KG", 950.0, 680.0, 680.0, 0.0, "M04", "Isenção - Bens da Cesta Básica"),
    ("30000000-0000-0000-0000-000000000004", "PROD-004", "REF-ACU-01", "5600123400004", "Açúcar Branco Kudiba 1Kg", "Açúcar refinado branco nacional - Cesta Básica", "P", True, False, "KG", 1100.0, 800.0, 800.0, 0.0, "M04", "Isenção - Bens da Cesta Básica"),
    ("30000000-0000-0000-0000-000000000005", "PROD-005", "REF-FEI-01", "5600123400005", "Feijão Manteiga Nacional 1Kg", "Feijão manteiga de produção nacional 1Kg", "P", True, False, "KG", 1600.0, 1150.0, 1150.0, 0.0, "M04", "Isenção - Bens da Cesta Básica"),
    ("30000000-0000-0000-0000-000000000006", "PROD-006", "REF-LEI-01", "5600123400006", "Leite UHT Meio Gordo 1L", "Leite longa vida meio gordo enriquecido 1L", "P", True, True, "UN", 1450.0, 1050.0, 1050.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000007", "PRD-005", "REF-NB-HP", "5600123400007", "Computador Portátil HP ProBook 450 G10", "Intel Core i7, 16GB RAM, 512GB SSD NVMe, 15.6 FHD", "P", True, False, "UN", 450000.0, 340000.0, 340000.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000008", "PRD-006", "REF-MON-DELL", "5600123400008", "Monitor LED 24 polegadas Dell P2422H", "Painel IPS Full HD, HDMI/DP/VGA, Hub USB regulável", "P", True, False, "UN", 125000.0, 92000.0, 92000.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000009", "PRD-007", "REF-TECL-LOG", "5600123400009", "Combo Teclado e Rato Sem Fios Logitech MK270", "Conexão sem fios 2.4GHz, autonomia de até 36 meses", "P", True, False, "UN", 22500.0, 15500.0, 15500.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000010", "PRD-008", "REF-IMP-HP", "5600123400010", "Impressora Multifunções HP LaserJet Pro M428fdw", "Impressão laser mono, scanner frente e verso, Wi-Fi", "P", True, False, "UN", 320000.0, 245000.0, 245000.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000011", "SRV-001", "REF-SRV-TI", None, "Consultoria e Suporte Técnico TI", "Serviços especializados de consultoria e suporte de sistemas", "S", False, False, "UN", 150000.0, 0.0, 0.0, 14.0, None, None),
    ("30000000-0000-0000-0000-000000000012", "SRV-002", "REF-SRV-REDES", None, "Serviços de Manutenção e Rede", "Instalação, configuração de cablagem estruturada e routers", "S", False, False, "UN", 85000.0, 0.0, 0.0, 14.0, None, None),
]

for p_id, code, ref, barcode, name, desc, p_type, is_stk, track_lot, uom, s_price, c_price, cmp, tax_pct, ex_code, ex_text in PRODUCTS:
    b_val = f"'{barcode}'" if barcode else "NULL"
    r_val = f"'{ref}'" if ref else "NULL"
    d_val = f"'{desc}'" if desc else "NULL"
    ex_c = f"'{ex_code}'" if ex_code else "NULL"
    ex_t = f"'{ex_text}'" if ex_text else "NULL"
    
    sql.append(f"""
    INSERT INTO kudiba_inventory.products (
        id, tenant_id, code, ref_id, barcode, name, description, product_type,
        is_stockable, track_lots, unit_of_measure, sale_price, cost_price, current_cmp,
        tax_type, tax_code, tax_percentage, exemption_reason_code, exemption_reason_text,
        has_withholding_tax, is_active
    ) VALUES (
        '{p_id}', '{TENANT_ID}', '{code}', {r_val}, {b_val}, '{name}', {d_val}, '{p_type}',
        {str(is_stk).lower()}, {str(track_lot).lower()}, '{uom}', {s_price:.4f}, {c_price:.4f}, {cmp:.4f},
        'IVA', 'NOR', {tax_pct:.2f}, {ex_c}, {ex_t}, false, true
    ) ON CONFLICT (tenant_id, code) DO UPDATE SET
        ref_id = EXCLUDED.ref_id, barcode = EXCLUDED.barcode, name = EXCLUDED.name,
        description = EXCLUDED.description, is_stockable = EXCLUDED.is_stockable,
        track_lots = EXCLUDED.track_lots, sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price, current_cmp = EXCLUDED.current_cmp,
        tax_percentage = EXCLUDED.tax_percentage, exemption_reason_code = EXCLUDED.exemption_reason_code,
        exemption_reason_text = EXCLUDED.exemption_reason_text;
    """)

# 4. Lotes de Produtos (para os que têm controlo de validade)
BATCHES = [
    # batch_id, product_id, batch_number, mfg_date, exp_date
    ("40000000-0000-0000-0000-000000000001", "30000000-0000-0000-0000-000000000002", "LOTE-OLEO-2026-A1", "2026-03-01", "2027-03-01"),
    ("40000000-0000-0000-0000-000000000002", "30000000-0000-0000-0000-000000000003", "LOTE-TRIGO-2026-T2", "2026-05-10", "2027-05-10"),
    ("40000000-0000-0000-0000-000000000003", "30000000-0000-0000-0000-000000000006", "LOTE-LEITE-2026-L4", "2026-08-01", "2027-02-01"),
]

for b_id, prod_id, b_num, m_date, e_date in BATCHES:
    sql.append(f"""
    INSERT INTO kudiba_inventory.product_batches (
        id, tenant_id, product_id, batch_number, manufacture_date, expiry_date
    ) VALUES (
        '{b_id}', '{TENANT_ID}', '{prod_id}', '{b_num}', '{m_date}', '{e_date}'
    ) ON CONFLICT (product_id, batch_number) DO NOTHING;
    """)

# 5. Saldos de Stock nos 2 Armazéns
STOCK_BALANCES = [
    # warehouse_id, product_id, q_on_hand, q_reserved, reorder_pt
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000001", 1250.0, 50.0, 200.0), # Arroz 5kg
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000002", 2400.0, 100.0, 300.0), # Óleo 1L
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000003", 1800.0, 0.0, 250.0),   # Farinha
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000004", 1500.0, 50.0, 200.0),  # Açúcar
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000005", 900.0, 0.0, 150.0),    # Feijão
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000006", 1100.0, 40.0, 200.0),  # Leite
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000007", 35.0, 5.0, 10.0),      # Portátil HP
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000008", 60.0, 4.0, 15.0),      # Monitor Dell
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000009", 120.0, 10.0, 30.0),    # Teclado Logitech
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000010", 18.0, 2.0, 5.0),       # Impressora HP
    # Armazém Cazenga
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000001", 600.0, 0.0, 100.0),
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000002", 850.0, 0.0, 150.0),
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000003", 700.0, 0.0, 100.0),
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000007", 12.0, 0.0, 5.0),
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000008", 25.0, 0.0, 5.0),
]

for wh_id, prod_id, q_hand, q_res, r_point in STOCK_BALANCES:
    sql.append(f"""
    INSERT INTO kudiba_inventory.stock_balances (
        id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
    ) VALUES (
        gen_random_uuid(), '{TENANT_ID}', '{wh_id}', '{prod_id}', {q_hand:.4f}, {q_res:.4f}, {r_point:.4f}, NOW()
    ) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity_on_hand = EXCLUDED.quantity_on_hand,
        quantity_reserved = EXCLUDED.quantity_reserved,
        reorder_point = EXCLUDED.reorder_point,
        updated_at = NOW();
    """)

# 6. Movimentos de Histórico de Stock (Entradas de Compra, Saídas por Venda e Transferências)
MOVEMENTS = [
    # wh_id, prod_id, batch_id, mov_type, qty, unit_cost, doc_ref, notes, created_at
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000001", None, "IN_PURCHASE", 1500.0, 3200.0, "V/FT 2026/8901", "Compra inicial AngoAlissar", "2026-05-02 08:30:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000002", "40000000-0000-0000-0000-000000000001", "IN_PURCHASE", 3000.0, 1300.0, "V/FT 2026/4432", "Entrada Refriango", "2026-05-05 09:15:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000007", None, "IN_PURCHASE", 50.0, 340000.0, "V/FT 2026/1129", "Remessa NCR Informática", "2026-05-10 11:00:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000008", None, "IN_PURCHASE", 80.0, 92000.0, "V/FT 2026/1130", "Monitores Dell NCR", "2026-05-12 14:20:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000007", None, "OUT_SALE", 8.0, 340000.0, "FT 2026B/000017", "Venda Unitel S.A.", "2026-06-14 11:35:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000001", None, "OUT_TRANSFER", 300.0, 3200.0, "TR-2026-001", "Abastecimento Armazém Cazenga", "2026-07-05 10:00:00+00"),
    (ARM_CAZENGA_ID, "30000000-0000-0000-0000-000000000001", None, "IN_TRANSFER", 300.0, 3200.0, "TR-2026-001", "Recebido da Sede Luanda", "2026-07-05 14:30:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000007", None, "OUT_SALE", 12.0, 340000.0, "FT 2026B/000021", "Venda Angola Telecom", "2026-08-14 11:15:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000002", "40000000-0000-0000-0000-000000000001", "IN_PURCHASE", 1000.0, 1300.0, "V/FT 2026/7821", "Reforço de stock Refriango", "2026-09-05 09:00:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000007", None, "OUT_SALE", 5.0, 340000.0, "FT 2026B/000026", "Venda TAAG Linhas Aéreas", "2026-10-25 14:00:00+00"),
    (ARM_SEDE_ID, "30000000-0000-0000-0000-000000000001", None, "IN_ADJUSTMENT", 50.0, 3200.0, "AJ-2026-10", "Ajuste de inventário físico mensal", "2026-10-25 16:30:00+00"),
]

# Limpar movimentos anteriores de demonstração para não duplicar
sql.append(f"DELETE FROM kudiba_inventory.stock_movements WHERE tenant_id = '{TENANT_ID}';")

for wh_id, prod_id, b_id, m_type, qty, u_cost, doc_ref, notes, c_at in MOVEMENTS:
    tot_cost = qty * u_cost
    b_val = f"'{b_id}'" if b_id else "NULL"
    sql.append(f"""
    INSERT INTO kudiba_inventory.stock_movements (
        id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
        quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
        created_by, created_at
    ) VALUES (
        gen_random_uuid(), '{TENANT_ID}', '{wh_id}', '{prod_id}', {b_val}, '{m_type}',
        {qty:.4f}, {u_cost:.4f}, {tot_cost:.4f}, {u_cost:.4f}, '{doc_ref}', '{notes}',
        '{ADMIN_USER_ID}', '{c_at}'
    );
    """)

sql.append("COMMIT;")

with open("/tmp/seed_inventory.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql))

print("Ficheiro /tmp/seed_inventory.sql gerado com sucesso!")
subprocess.check_call("docker exec -i kudiba-postgres psql -U kudiba -d kudiba_inventory < /tmp/seed_inventory.sql", shell=True)
print("Base kudiba_inventory povoada com sucesso!")
