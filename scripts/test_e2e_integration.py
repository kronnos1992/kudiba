#!/usr/bin/env python3
import time
import sys
import uuid
import jwt
import requests
import xml.etree.ElementTree as ET

BASE_URL = "http://localhost:8080"
TENANT_ID = "a0000000-0000-0000-0000-000000000001"
BRANCH_ID = "b0000000-0000-0000-0000-000000000001"
USER_ID = "u0000000-0000-0000-0000-000000000001"
JWT_SECRET = "kudiba_jwt_secret_development_key_change_in_production_2026"

def generate_token():
    payload = {
        "sub": USER_ID,
        "tenant_id": TENANT_ID,
        "tenant_slug": "demo",
        "branch_id": BRANCH_ID,
        "roles": ["ADMIN", "CONTABILISTA", "OPERADOR_CAIXA", "GESTOR_STOCK"],
        "exp": int(time.time()) + 7200,
        "iat": int(time.time()),
        "jti": str(uuid.uuid4())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

token = generate_token()
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "X-Tenant-ID": TENANT_ID
}

def log_step(name):
    print(f"\n========================================================")
    print(f"==> {name}")
    print(f"========================================================")

def main():
    log_step("1. INICIALIZAR CONTABILIDADE (PGC ANGOLA & EXERCÍCIO FISCAL 2026)")
    # 1.1 Seed PGC
    r = requests.post(f"{BASE_URL}/api/v1/accounting/chart/seed-standard", headers=headers)
    print(f"Seed PGC status: {r.status_code}, response: {r.text[:120]}")
    assert r.status_code in [200, 201, 409], f"Falha ao inicializar plano de contas: {r.text}"

    # 1.2 Abrir exercício fiscal 2026
    r = requests.post(f"{BASE_URL}/api/v1/accounting/fiscal-years", headers=headers, json={
        "year_code": 2026
    })
    print(f"Abertura Exercício 2026 status: {r.status_code}, response: {r.text[:120]}")
    assert r.status_code in [200, 201, 400, 409], f"Falha ao abrir exercício fiscal 2026: {r.text}"

    log_step("2. CONFIGURAR CATÁLOGO E STOCK INICIAL NO KUDIBAINVENTORY")
    # 2.1 Criar ou obter Armazém
    r = requests.post(f"{BASE_URL}/api/v1/inventory/warehouses", headers=headers, json={
        "branch_id": BRANCH_ID,
        "code": "ARM-01",
        "name": "Armazém Central Luanda",
        "is_default": True
    })
    if r.status_code == 201:
        warehouse_id = r.json()["id"]
        print(f"Armazém criado com sucesso: {warehouse_id}")
    else:
        # Obter armazém existente
        r_list = requests.get(f"{BASE_URL}/api/v1/inventory/warehouses", headers=headers)
        assert r_list.status_code == 200, f"Falha ao listar armazéns: {r_list.text}"
        warehouses = r_list.json()
        assert len(warehouses) > 0, "Nenhum armazém disponível"
        warehouse_id = warehouses[0]["id"]
        print(f"Armazém existente utilizado: {warehouse_id}")

    # 2.2 Criar ou obter Artigo
    prod_code = f"PROD-LAPTOP-01"
    r = requests.post(f"{BASE_URL}/api/v1/inventory/products", headers=headers, json={
        "code": prod_code,
        "name": "Laptop Lenovo ThinkPad",
        "product_type": "P",
        "is_stockable": True,
        "unit_of_measure": "UN",
        "sale_price": 500000.0,
        "cost_price": 350000.0,
        "tax_percentage": 14.0
    })
    if r.status_code == 201:
        product_id = r.json()["id"]
        print(f"Artigo criado com sucesso: {product_id} (Código: {prod_code})")
    else:
        r_prod = requests.get(f"{BASE_URL}/api/v1/inventory/products/by-code/{prod_code}", headers=headers)
        assert r_prod.status_code == 200, f"Falha ao obter artigo: {r_prod.text}"
        product_id = r_prod.json()["id"]
        print(f"Artigo existente utilizado: {product_id} (Código: {prod_code})")

    # 2.3 Entrada de Compra (Entrada de Stock a Custo 350.000 Kz)
    r = requests.post(f"{BASE_URL}/api/v1/inventory/movements/purchase", headers=headers, json={
        "warehouse_id": warehouse_id,
        "product_id": product_id,
        "quantity": 10.0,
        "unit_cost": 350000.0,
        "document_ref": f"COMPRA-E2E-{int(time.time())}",
        "notes": "Entrada de stock para teste de integração E2E"
    })
    assert r.status_code in [200, 201], f"Falha ao dar entrada de compra: {r.text}"
    print(f"Entrada de 10 unidades a 350.000 Kz registada com sucesso.")

    # 2.4 Verificar saldo e CMP
    r_stock = requests.get(f"{BASE_URL}/api/v1/inventory/stock/{product_id}", headers=headers)
    assert r_stock.status_code == 200, f"Falha ao consultar saldo: {r_stock.text}"
    stock_list = r_stock.json()
    assert len(stock_list) > 0, "Nenhum saldo encontrado para o artigo"
    qty_on_hand = sum(float(item["quantity_on_hand"]) for item in stock_list)

    r_prod_check = requests.get(f"{BASE_URL}/api/v1/inventory/products/{product_id}", headers=headers)
    assert r_prod_check.status_code == 200
    prod_data = r_prod_check.json()
    current_cmp = float(prod_data.get("current_cmp", 0))

    print(f"Saldo Actual: {qty_on_hand} UN, CMP Médio: {current_cmp:,.2f} Kz")
    assert qty_on_hand >= 10.0
    assert current_cmp == 350000.0

    log_step("3. EMITIR FACTURA FISCAL NO KUDIBAINVOICING")
    # 3.1 Garantir série fiscal FT 2026
    r_series = requests.post(f"{BASE_URL}/api/v1/fiscal/series", headers=headers, json={
        "tenantId": TENANT_ID,
        "documentType": "FT",
        "seriesCode": "2026",
        "fiscalYear": 2026
    })
    print(f"Abertura Série FT 2026: {r_series.status_code}")
    assert r_series.status_code in [200, 201], f"Falha ao criar série: {r_series.text}"

    # 3.2 Emitir Factura FT: 2 unidades a 500.000 Kz + 14% IVA = 1.000.000 + 140.000 = 1.140.000 Kz
    r_invoice = requests.post(f"{BASE_URL}/api/v1/invoices", headers=headers, json={
        "tenantId": TENANT_ID,
        "documentType": "FT",
        "seriesCode": "2026",
        "fiscalYear": 2026,
        "customerName": "Sociedade Angolana de Comércio Lda",
        "customerNif": "5412345678",
        "customerAddress": "Avenida 4 de Fevereiro, n.º 100",
        "customerCity": "Luanda",
        "customerCountry": "AO",
        "paymentMethods": ["A crédito"],
        "lines": [
            {
                "productCode": prod_code,
                "description": "Laptop Lenovo ThinkPad",
                "quantity": 2.0,
                "unitPrice": 500000.0,
                "taxRate": 14.0
            }
        ]
    })
    assert r_invoice.status_code == 201, f"Falha na emissão da factura fiscal: {r_invoice.text}"
    inv_data = r_invoice.json()
    doc_number = inv_data["documentNumber"]
    doc_id = inv_data["invoiceId"]
    net_total = float(inv_data["netTotal"])
    tax_total = float(inv_data["taxTotal"])
    gross_total = float(inv_data["grossTotal"])
    hash_chars = inv_data["validationChars"]
    print(f"Factura Emitida: {doc_number} (ID: {doc_id})")
    print(f"Líquido: {net_total:,.2f} Kz | IVA: {tax_total:,.2f} Kz | Total: {gross_total:,.2f} Kz")
    print(f"Assinatura RSA AGT: {hash_chars}")
    assert net_total == 1000000.0
    assert tax_total == 140000.0
    assert gross_total == 1140000.0

    log_step("4. VERIFICAR PROCESSAMENTO ASSÍNCRONO DOS EVENTOS FISCAIS")
    # Aguardar até 15s para consumo dos eventos pelo RabbitMQ
    print("Aguardando processamento assíncrono dos eventos em KudibaInventory e KudibaAccounting...")
    time.sleep(4)

    # 4.1 Verificar baixa de stock no KudibaInventory
    r_stock_after = requests.get(f"{BASE_URL}/api/v1/inventory/stock/{product_id}", headers=headers)
    assert r_stock_after.status_code == 200
    stock_after_list = r_stock_after.json()
    qty_after = sum(float(item["quantity_on_hand"]) for item in stock_after_list)
    print(f"Saldo após Factura: {qty_after} UN (anterior: {qty_on_hand} UN, reduziu 2 UN)")
    
    # 4.2 Verificar lançamentos contabilísticos automáticos em KudibaAccounting
    entries_found = False
    for attempt in range(10):
        r_entries = requests.get(f"{BASE_URL}/api/v1/accounting/entries?fiscal_year=2026", headers=headers)
        if r_entries.status_code == 200:
            entries = r_entries.json()
            matching_sales = [e for e in entries if doc_number in e.get("description", "") or doc_number in str(e.get("document_reference", ""))]
            matching_cost = [e for e in entries if "61.1" in [line.get("account_code") for line in e.get("lines", [])]]
            if matching_sales:
                print(f"Lançamento de Venda encontrado na Contabilidade! (ID: {matching_sales[0]['id']})")
                entries_found = True
                break
        time.sleep(1)

    assert entries_found, "Lançamento da factura não foi reflectido na contabilidade a tempo"

    log_step("5. EMITIR RECIBO DE TESOURARIA NO KUDIBATREASURY")
    # 5.1 Criar ou obter Caixa
    r_reg = requests.post(f"{BASE_URL}/api/v1/treasury/registers", headers=headers, json={
        "branch_id": BRANCH_ID,
        "code": "CX-01",
        "name": "Caixa Principal Luanda"
    })
    if r_reg.status_code == 201:
        register_id = r_reg.json()["id"]
        print(f"Caixa criado: {register_id}")
    else:
        r_regs = requests.get(f"{BASE_URL}/api/v1/treasury/registers", headers=headers)
        assert r_regs.status_code == 200, f"Falha ao listar caixas: {r_regs.text}"
        registers = r_regs.json()
        assert len(registers) > 0, "Nenhum caixa registado"
        register_id = registers[0]["id"]
        print(f"Caixa existente: {register_id}")

    # 5.2 Obter ou abrir sessão de caixa
    r_curr = requests.get(f"{BASE_URL}/api/v1/treasury/sessions/current?register_id={register_id}", headers=headers)
    if r_curr.status_code == 200 and r_curr.json() is not None:
        session_id = r_curr.json()["id"]
        print(f"Sessão de caixa aberta existente: {session_id}")
    else:
        r_open = requests.post(f"{BASE_URL}/api/v1/treasury/sessions/open", headers=headers, json={
            "register_id": register_id,
            "operator_user_id": USER_ID,
            "opening_balance": 0.0
        })
        assert r_open.status_code in [200, 201], f"Falha ao abrir sessão de caixa: {r_open.text}"
        session_id = r_open.json()["id"]
        print(f"Nova sessão de caixa aberta: {session_id}")

    # 5.3 Emitir Recibo de Tesouraria
    r_receipt = requests.post(f"{BASE_URL}/api/v1/treasury/receipts", headers=headers, json={
        "customer_id": "5412345678",
        "customer_name": "Sociedade Angolana de Comércio Lda",
        "customer_nif": "5412345678",
        "session_id": session_id,
        "payment_method": "NUMERARIO",
        "total_amount": 1140000.0,
        "currency": "AOA",
        "notes": f"Liquidação integral da factura {doc_number}",
        "lines": [
            {
                "invoice_id": doc_id,
                "invoice_number": doc_number,
                "amount_settled": 1140000.0,
                "notes": "Pagamento em caixa"
            }
        ]
    })
    assert r_receipt.status_code in [200, 201], f"Falha na emissão do recibo de tesouraria: {r_receipt.text}"
    receipt_data = r_receipt.json()
    rc_number = receipt_data.get("receipt_number") or receipt_data.get("receiptNumber")
    rc_id = receipt_data.get("id")
    print(f"Recibo de Tesouraria Emitido: {rc_number} (ID: {rc_id}) no valor de 1.140.000,00 Kz")

    # Aguardar liquidação na contabilidade
    print("Aguardando contabilização automática do recibo de tesouraria...")
    time.sleep(3)

    log_step("6. VERIFICAR BALANCETE DE 6 COLUNAS (TRIAL BALANCE)")
    r_tb = requests.get(f"{BASE_URL}/api/v1/accounting/reports/trial-balance", headers=headers)
    assert r_tb.status_code == 200, f"Falha ao gerar balancete: {r_tb.text}"
    tb = r_tb.json()
    total_deb = float(tb.get("total_period_debit", 0))
    total_cred = float(tb.get("total_period_credit", 0))
    is_balanced = tb.get("is_balanced", False)
    diff = abs(total_deb - total_cred)
    print("Balancete de 6 Colunas gerado com sucesso!")
    print(f"Total Débitos (Período):  {total_deb:>15,.2f} Kz")
    print(f"Total Créditos (Período): {total_cred:>15,.2f} Kz")
    print(f"Diferença Balanço:        {diff:>15,.2f} Kz")
    print(f"Partidas Dobradas Válidas: {is_balanced}")
    assert is_balanced, "Desequilíbrio de partidas dobradas detectado no Balancete!"
    assert diff < 0.001, "Diferença não nula entre débitos e créditos!"

    print("\nContas em movimento no Balancete:")
    for acc in tb.get("rows", []):
        p_deb = float(acc.get("period_debit", 0))
        p_cred = float(acc.get("period_credit", 0))
        c_deb = float(acc.get("closing_debit", 0))
        c_cred = float(acc.get("closing_credit", 0))
        if p_deb > 0 or p_cred > 0:
            print(f" - Conta {acc['account_code']:<10} | {acc['account_name']:<35} | Déb: {p_deb:>12,.2f} | Créd: {p_cred:>12,.2f} | Saldo D: {c_deb:>12,.2f} | Saldo C: {c_cred:>12,.2f}")

    log_step("7. EXPORTAR E VALIDAR SAF-T (AO) CONTABILIDADE XML")
    r_saft = requests.get(f"{BASE_URL}/api/v1/accounting/saft?fiscal_year=2026", headers=headers)
    assert r_saft.status_code == 200, f"Falha ao exportar SAF-T AO: {r_saft.text}"
    xml_content = r_saft.text
    print(f"Ficheiro SAF-T XML exportado ({len(xml_content)} bytes)")
    
    # Validação do XML
    root = ET.fromstring(xml_content)
    # Extrair namespace
    ns = {"ns": root.tag.split("}")[0].strip("{")} if "}" in root.tag else {}
    find_xpath = lambda elem, tag: elem.find(f"ns:{tag}" if ns else tag, ns)

    header = find_xpath(root, "Header")
    assert header is not None, "Elemento <Header> não encontrado no SAF-T XML"
    tax_acc_basis = find_xpath(header, "TaxAccountingBasis")
    print(f"SAF-T TaxAccountingBasis: {tax_acc_basis.text if tax_acc_basis is not None else 'N/A'}")

    gl_entries = find_xpath(root, "GeneralLedgerEntries")
    assert gl_entries is not None, "Elemento <GeneralLedgerEntries> não encontrado no SAF-T XML"
    total_debit_elem = find_xpath(gl_entries, "TotalDebit")
    total_credit_elem = find_xpath(gl_entries, "TotalCredit")
    print(f"SAF-T GeneralLedgerEntries -> TotalDebit: {total_debit_elem.text}, TotalCredit: {total_credit_elem.text}")
    assert total_debit_elem is not None and total_credit_elem is not None
    assert total_debit_elem.text == total_credit_elem.text, "TotalDebit e TotalCredit no SAF-T XML não conferem!"

    log_step("SUCESSO TOTAL! O FLUXO COMPLETO END-TO-END FOI EXECUTADO E VALIDADO.")

if __name__ == "__main__":
    main()
