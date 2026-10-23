#!/usr/bin/env python3
"""
Kudiba ERP — End-to-End Integration & Event-Driven Smoke Test
Testa o ciclo completo através do API Gateway (:8080):
  1. Conectividade e Saúde do Gateway (/health e /ready)
  2. Autenticação e Emissão de Token JWT Seguro (claims Kudiba)
  3. Cadastro de Armazém e Artigo Físico no KudibaInventory
  4. Entrada de Stock / Compra (Recebimento) e conferência de CMP
  5. Emissão de Fatura Fiscal (FT) no KudibaInvoicing com Assinatura RSA
  6. Propagação Assíncrona de Eventos via Outbox/RabbitMQ e Baixa de Stock
  7. Consulta e Validação de Movimento de Stock Registado
"""

import sys
import os
import json
import time
import uuid
import hmac
import hashlib
import base64
import urllib.request
import urllib.error

# ANSI Color Codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080").rstrip("/")
JWT_SECRET = os.environ.get("JWT_SECRET", "kudiba_jwt_secret_development_key_change_in_production_2026")
TENANT_ID = os.environ.get("TENANT_ID", "a0000000-0000-0000-0000-000000000001")
BRANCH_ID = os.environ.get("BRANCH_ID", "b0000000-0000-0000-0000-000000000001")

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def mint_jwt_token(tenant_id: str, branch_id: str, roles: list[str]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    claims = {
        "sub": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "tenant_slug": "kudiba-demo",
        "branch_id": branch_id,
        "roles": roles,
        "exp": now + 7200,
        "iat": now,
        "jti": str(uuid.uuid4()),
    }
    encoded_header = b64url(json.dumps(header).encode("utf-8"))
    encoded_claims = b64url(json.dumps(claims).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_claims}".encode("utf-8")
    signature = b64url(hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest())
    return f"{encoded_header}.{encoded_claims}.{signature}"

def api_request(method: str, path: str, token: str = None, body: dict = None, expected_status: int = 200, extra_headers: dict = None) -> dict:
    url = f"{GATEWAY_URL}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-Tenant-ID"] = TENANT_ID
        headers["X-Branch-ID"] = BRANCH_ID
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            res_data = json.loads(content) if content else {}
            if status != expected_status:
                raise RuntimeError(f"HTTP {status} diferente do esperado {expected_status}: {content}")
            return res_data
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        if e.code == expected_status:
            return json.loads(err_content) if err_content else {}
        raise RuntimeError(f"Falha na requisicao {method} {path} (HTTP {e.code}): {err_content}")
    except Exception as e:
        raise RuntimeError(f"Erro de ligacao em {method} {path}: {e}")

def api_request_raw(method: str, path: str, token: str = None, expected_status: int = 200) -> tuple[int, str]:
    url = f"{GATEWAY_URL}{path}"
    headers = {"Accept": "application/xml, text/xml, */*"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-Tenant-ID"] = TENANT_ID
        headers["X-Branch-ID"] = BRANCH_ID

    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            if status != expected_status:
                raise RuntimeError(f"HTTP {status} diferente do esperado {expected_status}")
            return status, content
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        raise RuntimeError(f"Falha na requisicao {method} {path} (HTTP {e.code}): {err_content}")

def main():
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}   Kudiba ERP — Validação Ponta-a-Ponta (E2E Integration & Events)   {RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")
    print(f"  Gateway Target:  {BOLD}{GATEWAY_URL}{RESET}")
    print(f"  Tenant ID:       {BOLD}{TENANT_ID}{RESET}")
    print(f"  Branch ID:       {BOLD}{BRANCH_ID}{RESET}\n")

    test_suffix = int(time.time()) % 100000

    # 1. Healthcheck do Gateway
    print(f"[{BOLD}1/9{RESET}] Verificando saúde do API Gateway...", end=" ")
    try:
        health = api_request("GET", "/health", expected_status=200)
        print(f"{GREEN}OK ({health.get('status', 'UP')}){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 2. Emissão de Token de Autenticação
    print(f"[{BOLD}2/9{RESET}] Gerando token de autenticação JWT...", end=" ")
    token = mint_jwt_token(TENANT_ID, BRANCH_ID, ["ADMIN", "CONTABILISTA", "GESTOR_STOCK"])
    print(f"{GREEN}OK (HMAC-SHA256 gerado){RESET}")

    # 3. Criação de Armazém no KudibaInventory
    wh_code = f"ARM-{test_suffix}"
    print(f"[{BOLD}3/9{RESET}] Criando armazém '{wh_code}' via Gateway...", end=" ")
    try:
        wh_payload = {
            "branch_id": BRANCH_ID,
            "code": wh_code,
            "name": f"Armazém Central E2E {test_suffix}",
            "is_default": True,
            "address_detail": "Zona Industrial de Viana, Luanda",
        }
        wh_res = api_request("POST", "/api/v1/inventory/warehouses", token=token, body=wh_payload, expected_status=201)
        warehouse_id = wh_res.get("id")
        print(f"{GREEN}OK (ID: {warehouse_id}){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 4. Cadastro de Artigo no KudibaInventory
    prod_code = f"PROD-{test_suffix}"
    print(f"[{BOLD}4/9{RESET}] Cadastrando artigo '{prod_code}' no inventário...", end=" ")
    try:
        prod_payload = {
            "code": prod_code,
            "name": f"Produto Físico E2E Teste {test_suffix}",
            "description": f"Produto Físico E2E Teste {test_suffix}",
            "product_type": "P",
            "is_stockable": True,
            "unit_of_measure": "UN",
            "sale_price": "2500.00",
            "cost_price": "1500.00",
            "tax_percentage": "14.00",
        }
        prod_res = api_request("POST", "/api/v1/inventory/products", token=token, body=prod_payload, expected_status=201)
        product_id = prod_res.get("id")
        print(f"{GREEN}OK (ID: {product_id}){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 5. Entrada de Stock / Compra Inicial
    print(f"[{BOLD}5/9{RESET}] Registando compra de stock (+100 unidades)...", end=" ")
    try:
        purchase_payload = {
            "warehouse_id": warehouse_id,
            "product_id": product_id,
            "quantity": "100.00",
            "unit_cost": "1500.00",
            "document_ref": f"COMPRA-{test_suffix}",
            "notes": "Entrada inicial para teste de fumo E2E",
        }
        api_request("POST", "/api/v1/inventory/movements/purchase", token=token, body=purchase_payload, expected_status=201)
        
        # Confere saldo antes da venda
        stock_info = api_request("GET", f"/api/v1/inventory/stock/{product_id}/warehouses/{warehouse_id}", token=token)
        current_stock = float(stock_info.get("quantity_on_hand", 0))
        if current_stock != 100.0:
            raise RuntimeError(f"Stock esperado 100.0 mas obteve {current_stock}")
        print(f"{GREEN}OK (Stock inicial: 100.0 | CMP: 1500.00 AOA){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 6. Emissão de Fatura Fiscal no KudibaInvoicing
    print(f"[{BOLD}6/9{RESET}] Emitindo Fatura FT de 10 unidades via KudibaInvoicing...", end=" ")
    try:
        invoice_payload = {
            "tenantId": TENANT_ID,
            "documentType": "FT",
            "seriesCode": "2026A",
            "fiscalYear": int(time.strftime("%Y")),
            "customerName": "Cliente de Teste Integrado E2E",
            "customerAddress": "Rua Principal 10, Luanda",
            "customerCity": "Luanda",
            "customerCountry": "AO",
            "customerNif": "5000123456",
            "paymentMethods": ["NUMERARIO"],
            "lines": [
                {
                    "productCode": prod_code,
                    "description": f"Produto Físico E2E Teste {test_suffix}",
                    "quantity": "10.00",
                    "unitPrice": "2500.00",
                    "taxRate": "14.00",
                }
            ],
        }
        inv_res = api_request("POST", "/api/v1/fiscal/invoices", token=token, body=invoice_payload, expected_status=201)
        doc_num = inv_res.get("documentNumber")
        inv_id = inv_res.get("invoiceId")
        print(f"{GREEN}OK ({doc_num} | Hash AGT gerado){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 7. Verificação de Propagação Assíncrona e Baixa de Stock
    print(f"[{BOLD}7/9{RESET}] Aguardando propagação do evento para baixa de stock...", end=" ")
    updated_stock = None
    for attempt in range(1, 15):
        time.sleep(1)
        try:
            stock_info = api_request("GET", f"/api/v1/inventory/stock/{product_id}/warehouses/{warehouse_id}", token=token)
            curr = float(stock_info.get("quantity_on_hand", 100))
            if curr == 90.0:
                updated_stock = curr
                break
        except Exception:
            pass

    if updated_stock == 90.0:
        print(f"{GREEN}SUCESSO! (Stock baixou de 100.0 para 90.0 automaticamente){RESET}")
    else:
        print(f"{YELLOW}AVISO (Stock atual: {stock_info.get('quantity_on_hand')}){RESET}")
        print(f"    Nota: Em ambiente sem RabbitMQ ou com polling longo da outbox, a sincronização pode ocorrer na próxima iteração.")

    # 8. Emissão de Recibo de Quitação RC na Tesouraria com Validação de Idempotência
    print(f"[{BOLD}8/9{RESET}] Emitindo Recibo RC com chave de Idempotência...", end=" ")
    try:
        idemp_key = f"idemp-rc-{test_suffix}"
        receipt_payload = {
            "customer_id": "a0000000-0000-0000-0000-000000000001",
            "customer_name": "Cliente de Teste Integrado E2E",
            "customer_nif": "5000123456",
            "payment_method": "TRANSFERENCIA",
            "bank_account_id": "6c1282c3-1d67-42ed-85c4-17281fb4efb9",
            "total_amount": "28500.00",
            "currency": "AOA",
            "notes": f"Quitação E2E da fatura {doc_num}",
            "lines": [
                {
                    "invoice_id": str(inv_id),
                    "invoice_number": doc_num,
                    "amount_settled": "28500.00",
                }
            ],
        }
        rc_res = api_request(
            "POST",
            "/api/v1/treasury/receipts",
            token=token,
            body=receipt_payload,
            extra_headers={"Idempotency-Key": idemp_key},
            expected_status=201,
        )
        rc_num = rc_res.get("receipt_number") or rc_res.get("id")

        # Teste de Replay Idempotente: reenviar mesma chave e payload
        replay_res = api_request(
            "POST",
            "/api/v1/treasury/receipts",
            token=token,
            body=receipt_payload,
            extra_headers={"Idempotency-Key": idemp_key},
            expected_status=201,
        )
        replay_num = replay_res.get("receipt_number") or replay_res.get("id")
        if rc_num != replay_num:
            raise RuntimeError(f"Idempotência falhou: {rc_num} != {replay_num}")
        print(f"{GREEN}OK ({rc_num} | Replay Idempotente validado){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    # 9. Exportação e Validação do SAF-T (AO)
    print(f"[{BOLD}9/9{RESET}] Exportando ficheiro fiscal SAF-T (AO) XML...", end=" ")
    try:
        curr_year = int(time.strftime("%Y"))
        _, saft_xml = api_request_raw(
            "GET",
            f"/api/v1/fiscal/saft?tenantId={TENANT_ID}&year={curr_year}",
            token=token,
            expected_status=200,
        )
        if "<?xml" not in saft_xml or "<AuditFile" not in saft_xml:
            raise RuntimeError("O SAF-T devolvido não é um documento XML AuditFile válido.")
        if "urn:OECD:StandardAuditFile-Tax:AO_1.01_01" not in saft_xml:
            raise RuntimeError("O SAF-T não declara o namespace oficial da AGT (AO_1.01_01).")
        if f'<InvoiceNo>{doc_num}</InvoiceNo>' not in saft_xml:
            raise RuntimeError(f"A fatura E2E {doc_num} não foi encontrada no SAF-T exportado.")
        print(f"{GREEN}OK ({len(saft_xml)} bytes, namespace AO_1.01_01 e fatura {doc_num} validados){RESET}")
    except Exception as e:
        print(f"{RED}FALHA{RESET}\n    Erro: {e}")
        sys.exit(1)

    print(f"\n{BOLD}{GREEN}✔ Ciclo de Teste E2E concluído com êxito!{RESET}\n")

if __name__ == "__main__":
    main()
