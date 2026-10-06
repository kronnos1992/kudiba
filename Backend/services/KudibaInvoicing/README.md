# KudibaInvoicing — Motor Fiscal & Microserviço de Facturação (Angola)

Microserviço fiscal de alta performance desenvolvido em **Rust (Clean Architecture + CQRS + Axum + Tonic gRPC)** em estrita conformidade com a legislação tributária da República de Angola:
* **Decreto Presidencial n.º 71/25** — Regime Jurídico das Facturas e Documentos Equivalentes (Facturação Electrónica e Comunicação em Tempo Real).
* **Decreto Executivo n.º 385/20** — Estrutura e Validação do Ficheiro SAF-T (AO) mensal (v1.01_01).

---

## 🏛️ Arquitetura (Clean Architecture & CQRS)

```
Backend/services/KudibaInvoicing/
├── src/
│   ├── domain/               # Entidades, Value Objects e Portas (Zero dependências externas de I/O)
│   │   ├── entities/         # Invoice, InvoiceLine, FiscalSeries, Tenant
│   │   ├── value_objects/    # CanonicalBuffer, ValidationCode, TaxRegime
│   │   ├── services/         # ChainedHashCalculator, TaxValidator, MoneyCalculator
│   │   └── ports/            # InvoiceRepository, TenantRepository, CryptoSigner, DbSession, UnitOfWork
│   ├── application/          # Casos de Uso (CQRS) e DTOs
│   │   ├── commands/         # IssueInvoice, CreateSeries, SignDirect, ResolveTaxRegime, SyncAgt
│   │   ├── queries/          # GetInvoice, ExportSaft, VerifySignature, ValidateSeriesSequence
│   │   └── dto/              # Contratos de entrada/saída tipados e validados
│   ├── infrastructure/       # Adaptadores de Tecnologia e Infraestrutura Externa
│   │   ├── persistence/      # PgInvoiceRepository, PgTenantRepository, PgSeriesRepository (SQLx/PostgreSQL)
│   │   ├── crypto/           # RsaCryptoSigner (RSA-2048 PKCS#1 v1.5 + SHA-256 + PKCS#8)
│   │   ├── saft/             # SaftXmlGenerator (urn:OECD:StandardAuditFile-Tax:AO_1.01_01)
│   │   └── agt/              # AgtClient (Webservices REST/SOAP da AGT, Heartbeat e Lotes)
│   ├── presentation/         # Camadas de Exposição
│   │   ├── http/             # REST Endpoints (Axum 0.8), OpenAPI e Scalar Docs
│   │   └── grpc/             # gRPC Service (Tonic) implementando kudiba.fiscal.v1
│   ├── config.rs             # Carregamento e validação estrita de variáveis de ambiente
│   ├── state.rs              # Injeção de dependências e estado partilhado (Arc)
│   └── main.rs               # Bootstrap dual (Servidor REST e Servidor gRPC concorrentes)
├── proto/                    # Contratos Protocol Buffers (fiscal/v1)
└── docs/                     # Especificação OpenAPI 3.1 (KUDIBA_INVOICING_OPENAPI.yaml)
```

---

## 🚀 Funcionalidades Core

### 1. Módulo de Exportação SAF-T (AO) v1.01_01
* Geração do arquivo XML oficial padronizado no namespace `urn:OECD:StandardAuditFile-Tax:AO_1.01_01`.
* **`<Header>`**: Metadados do sujeito passivo, período fiscal, identificação do software e número de certificação da AGT.
* **`<MasterFiles>`**:
  * `Customer`: Registo dos clientes com validação do NIF angolano e fallback para Consumidor Final (`999999999`).
  * `Product`: Catálogo de bens e serviços faturados no período.
  * `TaxTable`: Tabela de incidência do IVA (Isento `ISE`, Normal `NOR` 14%, Intermédio `INT` 7%).
* **`<SourceDocuments>`**:
  * Estruturação de todas as faturas (`FT`), faturas-recibo (`FR`) e notas de crédito (`NC`).
  * Totalizadores de Débito e Crédito reconciliados com aritmética decimal exata de 128 bits (`rust_decimal`).
  * Motivos e códigos legais de isenção de IVA (M00 a M99, ex: M04 Cesta Básica, M02 Regime de Exclusão).
* **Endpoints:**
  * REST: `GET /api/v1/fiscal/saft?tenantId={uuid}&year=2026&month=10` (devolve XML com `Content-Disposition: attachment`).
  * gRPC: `TriggerSaftGeneration` (disparo assíncrono para integração com RabbitMQ).

### 2. Conector Webservices da AGT (Comunicação em Tempo Real)
* Cliente HTTP/REST assíncrono (`AgtClient`) optimizado com connection pooling e timeout configurável (`AGT_TIMEOUT_SECS`).
* **Heartbeat & Liveness (`GET /api/v1/fiscal/agt/status`)**:
  * Testa conectividade contra o canal oficial da AGT (`AGT_PLATFORM_URL`).
  * Mede a latência em milissegundos e alerta se a comunicação estiver degradada.
  * Em caso de indisponibilidade da AGT, sinaliza automaticamente o modo de **contingência fiscal**.
* **Despacho de Lotes (`POST /api/v1/fiscal/agt/sync`)**:
  * Agrupa faturas e documentos fiscais do período com os respetivos hashes SHA-256 encadeados e assinaturas RSA em Base64.
  * Submete com protocolo de entrega (`AGT-REC-YYYYMMDD-...`) e tratamento resiliente de erros.

### 3. Gestão e Validação de Chaves de Produção (AGT RSA-2048)
* Conformidade rigorosa com o processo de credenciação da AGT:
  * **Em Produção (`ENVIRONMENT=production`)**: O serviço **bloqueia o arranque** se não for fornecida a chave privada RSA certificada pela AGT. O uso de chaves efémeras é expressamente proibido.
  * **Carregamento Seguro**: Suporta caminho de ficheiro no host (`AGT_RSA_PRIVATE_KEY_PATH`) ou variável de ambiente direta (`AGT_RSA_PRIVATE_KEY_PEM`) em formato PKCS#8 ou PKCS#1.
  * **Utilitário de Credenciação (`POST /api/v1/fiscal/keys/generate`)**:
    * Gera um par RSA-2048 oficial.
    * Fornece a chave pública X.509 em PEM para submissão no portal da AGT e a chave privada PKCS#8 correspondente para instalação no servidor.

---

## ⚙️ Variáveis de Ambiente

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `9090` | Porta do servidor REST HTTP interno |
| `GRPC_PORT` | `9091` | Porta do servidor gRPC (`kudiba.fiscal.v1`) |
| `DATABASE_URL` | `postgres://...` | Ligação PostgreSQL 16+ aos schemas `kudiba_core` |
| `ENVIRONMENT` | `development` | Ambiente (`development`, `staging`, `production`) |
| `AGT_KEY_VERSION` | `1` | Versão da chave privada registada na AGT |
| `AGT_RSA_PRIVATE_KEY_PATH` | *(opcional)* | Caminho absoluto do ficheiro `.pem` com a chave privada |
| `AGT_RSA_PRIVATE_KEY_PEM` | *(opcional)* | Conteúdo PEM da chave privada RSA-2048 |
| `AGT_PLATFORM_URL` | `https://webservices.agt...` | URL dos webservices de Facturação Electrónica da AGT |
| `AGT_API_TOKEN` | *(opcional)* | Bearer Token para autenticação mútua junto da AGT |
| `AGT_TIMEOUT_SECS` | `15` | Timeout em segundos para chamadas externas à AGT |

---

## 🧪 Testes Unitários e de Integração

Execução da suite de testes completa:
```bash
cargo test --manifest-path Backend/services/KudibaInvoicing/Cargo.toml
```

**Cobertura de Testes (47 testes passando com 100% de sucesso):**
* Cálculo exato e arredondamento afastando do zero (norma bancária e fiscal angolana).
* Validação de regimes de IVA (Exclusão, Simplificado 7%, Geral 14%) e códigos de isenção M00–M99.
* Imutabilidade e assinatura digital RSA-SHA256 encadeada.
* Detecção e rejeição de adulterações de documento assinado.
* Bloqueio estrito de chave efémera em produção.
* Geração do XML SAF-T (AO) v1.01_01 com validação de nós e totais.
* Conector de headers e payload dos webservices da AGT.
* Contratos e chamadas gRPC para o Edge POS.
