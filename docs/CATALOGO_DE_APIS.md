# Catálogo Unificado de APIs e Contratos — Kudiba ERP

**Projeto:** Kudiba ERP  
**Versão:** 1.1.0  
**Data:** Outubro de 2026  
**Formatos:** REST (JSON / RFC 7807 Problem Details) e gRPC (Protocol Buffers v3)

---

## 1. Convenções Globais, Cabeçalhos e Segurança

Todas as chamadas externas de clientes (Web SPA, POS Tauri Desktop, integrações bancárias) passam obrigatoriamente pelo **API Gateway** na porta `8080`.

### 1.1 Cabeçalhos de Entrada (Cliente $\rightarrow$ API Gateway)

| Cabeçalho | Obrigatório | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `Authorization` | Sim (rotas seguras) | Token JWT emitido pelo KudibaAuth no formato Bearer. | `Bearer eyJhbGciOi...` |
| `X-Tenant-ID` | Condicional | Identificador do tenant em UUID (se não deduzido por subdomínio ou token). | `11111111-1111-1111-1111-111111111111` |
| `Idempotency-Key` | Opcional | Chave de idempotência (RFC 8935) para prevenir duplicação de vendas e faturas. | `uuidv4-ou-chave-unica` |

### 1.2 Cabeçalhos Downstream Confiáveis (Gateway $\rightarrow$ Microsserviços)

O Gateway valida o JWT, elimina cabeçalhos externos forjados (*anti-spoofing*) e injeta nos serviços internos:

| Cabeçalho Injetado | Descrição |
| :--- | :--- |
| `X-Resolved-Tenant-ID` | UUID do tenant autenticado. |
| `X-Resolved-User-ID` | UUID do utilizador logado. |
| `X-Resolved-Roles` | Lista de perfis do utilizador separada por vírgula (ex.: `ADMIN,CONTABILISTA`). |
| `X-Resolved-Branch-ID` | UUID da filial ativa da sessão (se aplicável). |
| `X-Request-ID` | Correlation ID gerado pelo Gateway para rastreamento distribuído de logs. |

### 1.3 Formato Padronizado de Erros (RFC 7807 Problem Details)

Todas as falhas de domínio e validação retornam o tipo `application/problem+json`:

```json
{
  "type": "https://kudiba.ao/errors/insufficient-permissions",
  "title": "Acesso Proibido",
  "status": 403,
  "detail": "O perfil OPERADOR_CAIXA não possui a permissão fiscal:saft:export.",
  "instance": "/api/v1/fiscal/saft/export"
}
```

---

## 2. Microsserviço de Identidade: KudibaAuth (`:8082`)

Roteado pelo API Gateway em `/auth/*`.

### 2.1 Resumo de Endpoints

| Método | Caminho | Descrição | Permissão Exigida |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Autenticação via e-mail e senha. Emite par Access Token + Refresh Token. | Pública |
| `POST` | `/auth/refresh` | Renovação do Access Token com rotação de Refresh Token (RTR). | Pública (com refresh token) |
| `POST` | `/auth/logout` | Revogação da sessão no banco e adição do JTI na blacklist do Redis. | Autenticado |
| `POST` | `/auth/switch-tenant` | Alterna a organização ativa da sessão sem exigir novo login. | Autenticado |
| `GET` | `/auth/me` | Retorna o perfil do utilizador logado, filiais e empresas associadas. | Autenticado |
| `GET` | `/auth/users` | Lista membros ativos da organização atual. | `users:read` ou `ADMIN` |
| `POST` | `/auth/users/invite` | Adiciona um novo colaborador e atribui papéis. | `users:invite` ou `ADMIN` |
| `PUT` | `/auth/users/{id}/roles` | Atualiza perfis de acesso atribuídos a um colaborador. | `roles:manage` ou `ADMIN` |
| `GET` | `/health` | Verificação de liveness do serviço. | Pública |
| `GET` | `/ready` | Verificação de conectividade com PostgreSQL e Redis. | Pública |

### 2.2 Exemplo: Login (`POST /auth/login`)

**Requisição:**
```json
{
  "email": "utilizador@empresa.ao",
  "password": "<password-definida-no-provisionamento>"
}
```

**Resposta de Sucesso (`200 OK`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "refresh_token": "rt_8f149ab0c2e9...",
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "utilizador@empresa.ao",
    "fullName": "Administrador Kudiba",
    "roles": ["ADMIN"]
  },
  "currentTenant": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Kudiba Comércio Geral Lda",
    "slug": "kudiba-comercio",
    "nif": "5001234567"
  }
}
```

---

## 3. Microsserviço Fiscal: KudibaInvoicing (`:9090` REST / `:9091` gRPC)

Roteado pelo API Gateway em `/api/v1/fiscal/*`.

### 3.1 Resumo de Endpoints REST

| Método | Caminho | Descrição | Permissão Exigida |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/fiscal/invoices` | Emissão de fatura (FT, FR, NC, ND, GT, GR) com assinatura RSA e lock sequencial. | `invoices:issue` |
| `GET` | `/api/v1/fiscal/invoices/{id}` | Consulta detalhada de documento fiscal emitido. | `invoices:read` |
| `POST` | `/api/v1/fiscal/invoices/{id}/cancel` | Anulação formal com emissão automática de Nota de Crédito vinculada. | `invoices:cancel` |
| `GET` | `/api/v1/fiscal/invoices/{id}/qr` | Consulta do QR Code fiscal oficial em SVG, ASCII ou string canónica. | `invoices:read` |
| `GET` | `/api/v1/fiscal/invoices/{id}/pdf` | Download do PDF A4 oficial da fatura com QR Code e layout fiscal. | `invoices:read` |
| `GET` | `/api/v1/fiscal/invoices/{id}/thermal`| Download do talão térmico de caixa (PDF 80mm ou texto puro ESC/POS). | `invoices:read` |
| `POST` | `/api/v1/fiscal/series` | Abertura de nova série fiscal documental (ex.: `2026A`, `POS01`). | `series:manage` |
| `GET` | `/api/v1/fiscal/series/{id}/verify` | Validação de integridade e auditoria de continuidade da cadeia de faturas. | `audit:read` |
| `POST` | `/api/v1/fiscal/keys/generate` | Geração de par de chaves RSA-2048 para credenciação no portal da AGT. | `keys:manage` |
| `GET` | `/api/v1/fiscal/saft/export` | Geração e download do ficheiro XML SAF-T (AO) v1.01_01 em streaming $O(1)$. | `fiscal:saft:export` |
| `POST` | `/api/v1/fiscal/saft/jobs` | Enfileiramento de geração assíncrona de SAF-T para grandes volumes. | `fiscal:saft:export` |
| `GET` | `/api/v1/fiscal/reports/tax` | Exportação de mapa de apuramento de impostos (PDF ou Excel `.xlsx`). | `fiscal:reports` |
| `GET` | `/api/v1/fiscal/pos/x-report` | Emissão de relatório de Leitura X intradiária de conferência de caixa. | `pos:x_report` |
| `POST` | `/api/v1/fiscal/pos/z-report` | Emissão e fecho do Fecho Z diário oficial obrigatório com memória fiscal. | `pos:z_report` |

### 3.2 Exemplo: Emissão de Fatura (`POST /api/v1/fiscal/invoices`)

**Requisição:**
```json
{
  "serieId": "22222222-2222-2222-2222-222222222222",
  "docType": "FT",
  "customerTaxId": "5412345678",
  "customerName": "Sociedade Comercial Luanda Lda",
  "lines": [
    {
      "itemCode": "PROD-001",
      "description": "Licença de Software de Gestão",
      "quantity": 1.0,
      "unitPrice": 100000.0,
      "taxRate": 14.0,
      "isService": true
    }
  ]
}
```

**Resposta de Sucesso (`201 Created`):**
```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "invoiceNumber": "FT 2026A/1",
  "docType": "FT",
  "issueDate": "2026-10-10T10:30:00Z",
  "netTotal": 100000.00,
  "taxTotal": 14000.00,
  "grossTotal": 114000.00,
  "withholdingTotal": 6500.00,
  "stampDutyTotal": 0.00,
  "amountDue": 107500.00,
  "hash": "tWvB4d9c...Base64Signature...",
  "hashControl": "t;d;K;1",
  "qrPayload": "A:5001234567*B:FT 2026A/1*C:114000.00*D:2026-10-10*E:tWvB4d9c"
}
```

---

## 4. Interface de Alta Performance gRPC (`:9091`)

Contratos formais em Protocol Buffers v3 localizados em [`proto/fiscal/v1/fiscal_engine.proto`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/proto/fiscal/v1/fiscal_engine.proto).

### 4.1 Definição do Serviço `FiscalEngineService`

```protobuf
syntax = "proto3";
package kudiba.fiscal.v1;

service FiscalEngineService {
  // Assinatura digital RSA-2048 de buffer canónico AGT
  rpc SignDocument (SignDocumentRequest) returns (SignDocumentResponse);

  // Validação matemática de assinatura e dos 4 caracteres de controlo
  rpc VerifySignature (VerifySignatureRequest) returns (VerifySignatureResponse);

  // Disparo assíncrono de extração de SAF-T (AO) para processamento em background
  rpc TriggerSaftGeneration (TriggerSaftRequest) returns (TriggerSaftResponse);
}
```
