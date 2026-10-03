# Especificação de Recursos e Endpoints do API Gateway - ERP Kudiba

**Documento:** Catálogo de Endpoints, Contratos e Especificação de Recursos da API  
**Versão:** 1.0.0  
**Data:** Outubro de 2026  
**Ambiente Base:** `https://api.kudiba.ao/api/v1` (Produção) | `https://staging-api.kudiba.ao/api/v1` (Homologação)  
**Normas:** RFC 7807 (Problem Details), RFC 8935 (Idempotency), OpenAPI 3.1.0, Decreto Presidencial n.º 71/25  

---

## 1. Padrões Globais da API

### 1.1 Convenção de Cabeçalhos HTTP (Headers)

#### Cabeçalhos de Requisição (Entrada no Gateway)
| Header | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `Authorization` | String | Em rotas privadas | Token JWT no formato: `Bearer <token>` |
| `X-Tenant-ID` | UUIDv4 | Sim (exceto rotas públicas) | Identificador da empresa/organização assinante |
| `Idempotency-Key` | UUIDv4 | Obrigatório em `POST` fiscais e pagamentos | Garante que requisições repetidas não dupliquem operações |
| `X-Correlation-ID` | UUIDv4 | Opcional | Identificador de rastreamento do cliente; se omitido, o Gateway gera um |
| `X-Client-Version` | String | Recomendado | Versão do aplicativo cliente (ex: `kudiba-pos-desktop/1.4.2`) |
| `Content-Type` | String | Obrigatório em `POST`/`PUT` | `application/json` ou `multipart/form-data` |
| `Accept` | String | Recomendado | `application/json`, `application/pdf`, ou `application/xml` |

#### Cabeçalhos de Resposta (Saída do Gateway)
| Header | Tipo | Descrição |
| :--- | :--- | :--- |
| `X-Correlation-ID` | UUIDv4 | Identificador único de correlação para fins de auditoria e suporte |
| `X-RateLimit-Limit` | Inteiro | Número máximo de requisições permitidas na janela temporal atual |
| `X-RateLimit-Remaining` | Inteiro | Saldo de requisições disponíveis na janela |
| `X-RateLimit-Reset` | Inteiro | Timestamp Unix (segundos) em que a cota será renovada |
| `Idempotent-Replay` | Booleano | Retornado como `true` caso a resposta tenha sido servida a partir do cache de idempotência |

---

### 1.2 Estrutura Padronizada de Erros (RFC 7807)
Todas as respostas com código HTTP $\ge 400$ retornam o tipo `application/problem+json`:

```json
{
  "type": "https://api.kudiba.ao/errors/invalid-tax-exemption",
  "title": "Motivo de Isenção Inválido ou Ausente",
  "status": 422,
  "detail": "O artigo com código 'SERV-CONS-01' tem taxa de IVA a 0%, porém não foi informado o código de isenção regulamentado pela AGT.",
  "instance": "/api/v1/fiscal/invoices",
  "code": "TAX_EXEMPTION_REQUIRED",
  "timestamp": "2026-10-02T22:35:10Z",
  "invalid_params": [
    {
      "name": "items[0].tax_exemption_code",
      "reason": "Obrigatório para taxas de IVA iguais a 0%"
    }
  ]
}
```

---

## 2. Catálogo Completo de Recursos e Endpoints

### 2.1 Módulo de Autenticação e Gestão de Sessões (`/auth`)

#### `POST /auth/login`
Autenticação primária de utilizadores (Operadores de Caixa, Faturistas, Gestores, Contabilistas).
* **Visibilidade:** Pública (Rate Limit estrito: 10 req/min por IP).
* **Request Body:**
```json
{
  "email": "operador@empresa.ao",
  "password": "senha_segura_123",
  "tenant_id": "4e7d4a22-26cb-4029-a78b-3d607f2df412",
  "terminal_identifier": "pos-terminal-caixa-01"
}
```
* **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJFZERTQSI...",
  "refresh_token": "rft_89a0b12c...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "b2f679e0-8fa3-4217-a02b-a0d33e9d8e01",
    "name": "António Manuel",
    "email": "operador@empresa.ao",
    "roles": ["CASHIER"],
    "tenant": {
      "id": "4e7d4a22-26cb-4029-a78b-3d607f2df412",
      "name": "Comercial Kudiba Lda",
      "tax_id": "5412345678"
    }
  }
}
```

#### `POST /auth/refresh`
Renovação de access token utilizando refresh token de uso único com rotação automática.
* **Request Body:** `{"refresh_token": "rft_89a0b12c..."}`
* **Response `200 OK`:** Novo par `access_token` e `refresh_token`.

#### `POST /auth/logout`
Revogação imediata da sessão atual. O Gateway adiciona o `jti` do token à lista de revogação no Redis.
* **Headers:** `Authorization: Bearer <token>`
* **Response `204 No Content`**

#### `GET /auth/.well-known/jwks.json`
Exposição pública das chaves criptográficas (JWKS) usadas para assinar os tokens JWT (Ed25519 / RS256).
* **Visibilidade:** Pública (Cacheável por 24h via `Cache-Control`).

---

### 2.2 Módulo Multi-Tenant e Organizações (`/tenants`)

#### `GET /tenants/current`
Retorna as configurações fiscais, dados cadastrais e certificação AGT da organização atual.
* **Headers:** `Authorization: Bearer <token>`, `X-Tenant-ID: <uuid>`
* **Response `200 OK`:**
```json
{
  "id": "4e7d4a22-26cb-4029-a78b-3d607f2df412",
  "legal_name": "Kudiba Distribuidora e Comércio Geral, Lda",
  "trade_name": "Kudiba Supermercados",
  "tax_id": "5409876543",
  "commercial_register": "1234-21/2024",
  "share_capital": "5000000.00",
  "currency": "AOA",
  "agt_software_certificate": "999/AGT/2026",
  "tax_regime": "REGIME_GERAL",
  "contingency_status": {
    "is_blocked": false,
    "last_agt_sync_at": "2026-10-02T20:15:00Z",
    "days_since_sync": 0,
    "max_allowed_days": 60
  }
}
```

---

### 2.3 Módulo Fiscal e Motor de Faturação (`/fiscal`)
Em estrita conformidade com o **Decreto Presidencial n.º 71/25** e as normas de homologação de software de faturação da AGT.

#### `POST /fiscal/invoices`
Emissão e assinatura digital instantânea de um documento fiscal (Fatura FT, Fatura-Recibo FR, Nota de Crédito NC, Nota de Débito ND).

* **Headers Obrigatórios:**
  * `Authorization: Bearer <token>`
  * `X-Tenant-ID: <uuid>`
  * `Idempotency-Key: <uuid>` (Obrigatório para prevenção de duplicações fiscais)
* **Request Body:**
```json
{
  "doc_type": "FT",
  "series_code": "2026A",
  "customer": {
    "customer_id": "c7a8b901-52d3-412e-9d21-998877665544",
    "tax_id": "5419998888",
    "name": "Sonangol Distribuidora EP",
    "address": "Rua Rainha Ginga, Edifício Sonangol, Luanda",
    "country": "AO"
  },
  "payment_mechanism": "MULTICAIXA",
  "issue_date": "2026-10-02",
  "items": [
    {
      "product_id": "p01-arroz-25kg",
      "product_code": "ARROZ-AGULHA-25",
      "description": "Saco de Arroz Agulha 25kg Kudiba",
      "quantity": 10.0000,
      "unit_price": 28500.0000,
      "discount_amount": 0.0000,
      "tax_rate": 14.00,
      "tax_exemption_code": null,
      "tax_exemption_reason": null
    },
    {
      "product_id": "p02-livro-escolar",
      "product_code": "LIV-ESC-01",
      "description": "Manual Escolar Matemática 6ª Classe",
      "quantity": 5.0000,
      "unit_price": 4000.0000,
      "discount_amount": 0.0000,
      "tax_rate": 0.00,
      "tax_exemption_code": "M04",
      "tax_exemption_reason": "Isenção nos termos da alínea d) do n.º 1 do art.º 12.º do CIVA"
    }
  ],
  "withholding_tax_rate": 0.00
}
```

* **Processamento Interno no Gateway / Fiscal Service:**
  1. Verificação do limite legal de 60 dias de contingência AGT (DP n.º 71/25).
  2. Validação de regras de negócio e tabela de códigos de isenção AGT.
  3. Obtenção do lock da série e leitura atómica do hash da fatura anterior (`previous_document_hash`).
  4. Execução do algoritmo de assinatura RSA com SHA-256:
     $$\text{DocumentHash} = \text{Sign}_{PrivKey}(\text{DataEmissao} + ";" + \text{DataGravacao} + ";" + \text{NumeroDoc} + ";" + \text{TotalBruto} + ";" + \text{HashAnterior})$$
  5. Extração dos 4 caracteres de validação do hash (1º, 11º, 21º e 31º caracteres).
  6. Disparo assíncrono para transmissão em tempo real à Plataforma Electrónica da AGT.

* **Response `201 Created`:**
```json
{
  "id": "e4b52319-3891-49b0-9831-2910fa312984",
  "document_number": "FT 2026A/000142",
  "doc_type": "FT",
  "series_code": "2026A",
  "sequence_number": 142,
  "issue_date": "2026-10-02",
  "system_entry_date": "2026-10-02T22:36:12Z",
  "customer": {
    "tax_id": "5419998888",
    "name": "Sonangol Distribuidora EP"
  },
  "financials": {
    "net_total": 305000.0000,
    "tax_total": 39900.0000,
    "withholding_tax_total": 0.0000,
    "gross_total": 344900.0000,
    "currency": "AOA"
  },
  "fiscal_security": {
    "hash": "u8Fk9...c7Za==",
    "hash_control": "u9Za",
    "certificate_version": "1.0",
    "agt_software_cert": "999/AGT/2026",
    "qr_code_payload": "https://agt.minfin.gov.ao/portal/valida-doc?nif=5409876543&doc=FT2026A/000142&val=u9Za&total=344900.00"
  },
  "transmission_status": "ENQUEUED_REALTIME"
}
```

#### `GET /fiscal/invoices/{id}`
Consulta individual de documento fiscal por UUID ou número de fatura formatado.

#### `GET /fiscal/invoices/{id}/pdf`
Geração e download do ficheiro PDF em formato A4 ou Ticket Térmico de 80mm com todos os requisitos legais impressos.
* **Query Parameters:** `format=A4` ou `format=THERMAL_80MM`
* **Response `200 OK`:** `Content-Type: application/pdf` com cabeçalho `Content-Disposition: inline; filename="FT_2026A_000142.pdf"`.

#### `POST /fiscal/invoices/{id}/annul`
Anulação de fatura de acordo com o Artigo 18.º do Decreto Presidencial n.º 71/25.
* **Atenção:** Em Angola, faturas emitidas e assinadas não sofrem `DELETE`. A anulação gera registo de anulação imutável com preservação de hash ou emissão de Nota de Crédito correlacionada.
* **Request Body:**
```json
{
  "reason": "Erro no preenchimento do NIF do cliente",
  "credit_note_series": "2026A"
}
```

#### `GET /fiscal/series`
Lista todas as séries de faturação ativas ou fechadas para a organização.

#### `POST /fiscal/series`
Abertura e registo de nova série de faturação para o exercício corrente.

---

### 2.4 Módulo de Sincronização POS Offline-First (`/sync/pos`)

Este conjunto de endpoints atende aos requisitos de conectividade instável e operação de caixas em modo local (Tauri POS / SQLite).

```
[ TERMINAL POS LOCAL ]                            [ API GATEWAY KUDIBA ]
         |                                                 |
         | 1. POST /sync/pos/handshake                     |
         |------------------------------------------------>|
         | 2. 200 OK (Validação de Terminal & NTP Time)    |
         |<------------------------------------------------|
         |                                                 |
         | 3. POST /sync/pos/upload-batch (Faturas Offline)|
         |------------------------------------------------>|
         | 4. 200 OK (Confirmação de Hashes & Batch ID)    |
         |<------------------------------------------------|
         |                                                 |
         | 5. GET /sync/pos/delta-download?since=1790890000|
         |------------------------------------------------>|
         | 6. 200 OK (Novos Preços, Artigos e Clientes)    |
         |<------------------------------------------------|
```

#### `POST /sync/pos/handshake`
Registo do terminal e verificação da integridade de licença e hora do sistema.
* **Request Body:**
```json
{
  "terminal_id": "pos-terminal-luanda-loja-01",
  "app_version": "1.4.2",
  "local_timestamp": "2026-10-02T22:38:00Z",
  "last_synced_sequence": 141
}
```
* **Response `200 OK`:**
```json
{
  "session_token": "sync_sess_78ab9c...",
  "server_ntp_timestamp": "2026-10-02T22:38:01Z",
  "max_allowed_clock_skew_seconds": 300,
  "requires_full_sync": false
}
```

#### `POST /sync/pos/upload-batch`
Submissão de lote de faturas e recibos emitidos localmente durante o período offline.
* **Request Body:**
```json
{
  "batch_id": "batch-20261002-terminal01-004",
  "documents": [
    {
      "local_id": "loc-doc-001",
      "doc_type": "FR",
      "series_code": "2026POS1",
      "sequence_number": 89,
      "document_number": "FR 2026POS1/000089",
      "issue_date": "2026-10-02",
      "system_entry_date": "2026-10-02T19:40:15Z",
      "customer_tax_id": "Consumidor Final",
      "customer_name": "Consumidor Final",
      "gross_total": 12500.0000,
      "previous_document_hash": "w80...==",
      "hash": "k91...==",
      "hash_control": "k1=a",
      "signature_raw": "MIIB..."
    }
  ]
}
```
* **Response `200 OK`:**
```json
{
  "batch_id": "batch-20261002-terminal01-004",
  "status": "ACCEPTED",
  "processed_count": 1,
  "failed_count": 0,
  "synced_documents": [
    {
      "local_id": "loc-doc-001",
      "server_id": "4a1b2c3d-9988-7766-5544-33221100aabb",
      "document_number": "FR 2026POS1/000089",
      "status": "CONFIRMED"
    }
  ]
}
```

#### `GET /sync/pos/delta-download`
Obtenção em formato compactado (gzip/brotli) de todas as mutações no catálogo de artigos, preços, promoções e tabelas fiscais desde o último checkpoint.
* **Query Parameters:** `since_timestamp=1790890000`

---

### 2.5 Módulo de Catálogo e Entidades Comerciais (`/catalog`)

#### `GET /catalog/products`
Pesquisa paginada de produtos com suporte a código de barras e filtro por categoria.
* **Query Parameters:** `query=arroz&limit=20&cursor=eyJ...`

#### `GET /catalog/taxes`
Tabela oficial de impostos de Angola suportada pelo sistema:
* **Taxas de IVA:** 14% (Geral), 7% (Regime Especial / Restauração e Hotelaria), 5% (Bens Essenciais de Ampla População), 0% (Isentos).
* **Códigos de Isenção Oficiais AGT (Exemplos):**
  * `M00`: Isento nos termos da alínea a) do n.º 1 do art.º 12.º do CIVA.
  * `M02`: Transmissão de bens e prestação de serviços sujeitos ao Regime Simplificado.
  * `M04`: Isenção de bens da Cesta Básica (Lei n.º 42/20).

#### `GET /catalog/customers/validate-nif/{nif}`
Validador perimétrico de NIF (Número de Identificação Fiscal) de Angola.
* Verifica formato sintático (10 dígitos numéricos) e consulta em cache de entidades fiscais.
* **Response `200 OK`:** `{"valid": true, "tax_id": "5409876543", "legal_name": "Empresa Comercial..."}`

---

### 2.6 Módulo de Caixa e Vendas de Balcão (`/sales`)

#### `POST /sales/cash-registers/open`
Abertura de turno de caixa com registo de operador e fundo de maneio inicial em kwanzas (AOA).

#### `POST /sales/cash-registers/close`
Fecho de caixa, conferência de meios de pagamento (Numerário, TPA / Multicaixa, Transferência) e cálculo automático de quebra/sobra.

#### `POST /sales/cash-registers/movements`
Movimentos de tesouraria de caixa (Entrada de Troco ou Sangria para cofre).

---

### 2.7 Módulo de Exportação SAF-T AO (`/saft`)

Geração do ficheiro oficial `SAFT_AO_1.01.xml` exigido pela Administração Geral Tributária.

#### `POST /saft/export`
Submete um pedido assíncrono de extração e validação do SAF-T de faturação ou contabilidade.
* **Request Body:**
```json
{
  "fiscal_year": 2026,
  "start_date": "2026-01-01",
  "end_date": "2026-01-31",
  "export_type": "BILLING"
}
```
* **Response `202 Accepted`:**
```json
{
  "job_id": "saft-job-77a88b99-0011",
  "status": "PROCESSING",
  "estimated_completion_seconds": 15,
  "check_status_url": "/api/v1/saft/exports/saft-job-77a88b99-0011"
}
```

#### `GET /saft/exports/{job_id}`
Consulta o progresso da extração. Quando `status == "COMPLETED"`, disponibiliza o stream do arquivo XML compactado em `.zip`.

#### `POST /saft/validate`
Valida um ficheiro XML pré-existente contra o schema XSD oficial `SAFT_AO_1.01.xsd` da AGT, retornando lista de eventuais inconformidades com número da linha e tag XML.

---

### 2.8 Integrações com Fintechs, Banca e Webhooks (`/integrations`)

#### `POST /integrations/webhooks/multicaixa`
Recepção de notificações de pagamentos efetuados via Multicaixa Express ou GPO (Gateway de Pagamentos Online).
* **Headers:** `X-Signature-SHA256: <hmac_hex>`, `X-Partner-ID: emis-gpo`
* **Response `200 OK`:** `{"status": "ACKNOWLEDGED"}`

#### `POST /integrations/payments/multicaixa-express`
Disparo de solicitação de pagamento no telemóvel do cliente através da rede Multicaixa Express.

---

### 2.9 Monitor de Comunicação AGT e Sondas Perimétricas

#### `GET /api/v1/agt/status`
Verifica a conectividade ativa com os servidores da AGT e o estado de contingência do tenant.
* **Response `200 OK`:**
```json
{
  "agt_platform_online": true,
  "last_ping_latency_ms": 42,
  "contingency_tracker": {
    "tenant_id": "4e7d4a22-26cb-4029-a78b-3d607f2df412",
    "days_without_sync": 0,
    "warning_active": false,
    "lockout_deadline": "2026-12-01T20:15:00Z"
  }
}
```

#### `GET /health` (Liveness Probe)
Verifica se o processo do API Gateway está vivo e aceitando conexões de rede.
* **Response `200 OK`:** `{"status": "UP"}`

#### `GET /ready` (Readiness Probe)
Verifica se o Gateway tem conectividade com o cluster Redis e com o Core API antes de receber tráfego do balanceador Kubernetes/Nginx.
* **Response `200 OK`:**
```json
{
  "status": "READY",
  "components": {
    "redis": "CONNECTED",
    "core_api": "HEALTHY",
    "jwks_cache": "VALID"
  }
}
```

#### `GET /metrics` (Prometheus Metrics)
Exposição de métricas de telemetria no formato oficial OpenMetrics / Prometheus para scraping automatizado:
* `http_requests_total{method="POST", path="/api/v1/fiscal/invoices", status="201"}`
* `http_request_duration_seconds_bucket{le="0.005", path="/api/v1/fiscal/invoices"}`
* `agt_contingency_days_active{tenant_id="..."}`
* `ratelimit_throttled_requests_total{tenant_id="..."}`
