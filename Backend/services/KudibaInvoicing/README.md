# KudibaInvoicing — Motor Fiscal & Microserviço de Facturação (Angola)

Microserviço fiscal de alta performance, missão crítica e conformidade estrita desenvolvido em **Rust (Clean Architecture + CQRS + Unit of Work + Axum + Tonic gRPC)** para o ecossistema **Kudiba ERP**. O serviço foi desenhado em estrita aderência à legislação tributária e às normas de certificação de software da **Administração Geral Tributária (AGT)** da República de Angola:

* **Decreto Presidencial n.º 71/25** — *Regime Jurídico das Facturas e Documentos Equivalentes (RJFDE)*: Regras mandatórias de faturação eletrónica, assinatura digital encadeada, 4 caracteres de controlo, QR Code fiscal canónico, campos logísticos obrigatórios de transporte, anulação formal com emissão de Nota de Crédito (NC) e relatórios de memória fiscal POS (Leitura X e Fecho Z).
* **Decreto Executivo n.º 385/20** — *Estrutura e Validação do Ficheiro SAF-T (AO) v1.01_01*: Regras de validação de dados mestre, reconciliação de débitos e créditos e validação estrita do schema XSD oficial.
* **Código do Imposto sobre o Valor Acrescentado (CIVA)** — Enquadramento nos regimes de Exclusão (< 25M AOA), Simplificado (25M a 350M AOA) e Geral (> 350M AOA), catálogo oficial de códigos de isenção de IVA (M00 a M99).
* **Código do Imposto de Selo & Lei do Imposto Industrial** — Retenção na fonte automática de 6,5% sobre prestação de serviços e liquidação de Imposto de Selo (0,7% em recibos de quitação e 1,0% em operações gerais de crédito).

---

## 🏛️ Arquitetura do Sistema

O microserviço adota **Hexagonal Architecture (Ports & Adapters)** combinada com **CQRS (Command Query Responsibility Segregation)** e **Unit of Work** sobre PostgreSQL 16 com isolamento transacional estrito:

```
Backend/services/KudibaInvoicing/
├── src/
│   ├── domain/                         # Núcleo Puro: Entidades, Value Objects e Portas (Zero I/O externo)
│   │   ├── entities/                   # Invoice, InvoiceLine, FiscalSeries, Tenant
│   │   ├── value_objects/              # CanonicalBuffer, ValidationCode, TaxRegime, DocumentType, TransportMovement
│   │   ├── services/                   # ChainedHashCalculator, TaxValidator, TaxAndDutyCalculator, FiscalQrCodeGenerator
│   │   └── ports/                      # InvoiceRepository, SeriesRepository, TenantRepository, TaxRegimeRepository,
│   │                                   # CryptoSigner, DbSession, UnitOfWork, EventPublisher
│   ├── application/                    # Casos de Uso (CQRS) e DTOs tipados
│   │   ├── commands/                   # IssueInvoice, CancelInvoice, CreateSeries, SignDirect, ResolveTaxRegime, SyncAgt
│   │   ├── queries/                    # GetInvoice, ExportSaft, FiscalReports, PosReports, VerifySignature,
│   │   │                               # ValidateSeriesSequence, TaxRegimeQueries
│   │   └── dto/                        # Contratos de transferência de dados (Serde JSON/Decimal)
│   ├── infrastructure/                 # Adaptadores Secundários (Tecnologia e I/O)
│   │   ├── persistence/                # PgInvoiceRepository, PgSeriesRepository, PgTenantRepository, PgUnitOfWork
│   │   ├── crypto/                     # RsaCryptoSigner (RSA-2048 PKCS#1 v1.5 + SHA-256 + PKCS#8)
│   │   ├── saft/                       # SaftXmlGenerator (Streaming O(1)), SaftValidator (XSD AO_1.01_01), SaftJobRegistry
│   │   ├── reports/                    # InvoicePdfGenerator (A4), InvoiceThermalGenerator (80mm/ESC-POS),
│   │   │                               # TaxPdfReportGenerator (PDF), TaxExcelReportGenerator (.xlsx)
│   │   ├── outbox/                     # Transactional Outbox Worker e MultiChannelEventPublisher (RabbitMQ/Kafka)
│   │   └── agt/                        # AgtClient (Webservices REST da AGT, Heartbeat e Sincronização em Lote)
│   ├── presentation/                   # Adaptadores Primários (Entrada)
│   │   ├── http/                       # Servidor REST (Axum 0.8), Rotas Fiscais, OpenAPI Scalar Docs
│   │   └── grpc/                       # Servidor gRPC (Tonic) implementando kudiba.fiscal.v1
│   ├── config.rs                       # Configuração com suporte a read-replicas (DATABASE_READ_URL)
│   ├── state.rs                        # Contêiner de injeção de dependências (AppState) com roteamento de pools
│   └── main.rs                         # Ponto de entrada dual (REST :9090 e gRPC :9091 concorrentes)
├── schemas/                            # Schemas oficiais da AGT (SAFTAO1.01_01.xsd)
├── proto/                              # Contratos Protocol Buffers (fiscal/v1)
└── docs/                               # Especificação OpenAPI 3.1 completa (KUDIBA_INVOICING_OPENAPI.yaml)
```

---

## ⚡ Capacidades e Funcionalidades Implementadas

### 1. Emissão de Faturas e Documentos Comerciais Fiscais
* **Tipos de Documento Suportados**: Fatura (`FT`), Fatura-Recibo (`FR`), Nota de Crédito (`NC`), Nota de Débito (`ND`), Guia de Transporte (`GT`) e Guia de Remessa (`GR`).
* **Numeração Rigorosa Sequencial (*Zero Gaps*)**: Bloqueio pessimista por série fiscal (`SELECT ... FOR UPDATE`) garante atomicidade total e impede buracos de numeração mesmo sob concorrência maciça de múltiplos pontos de venda.
* **Aritmética Decimal Exata**: Todos os cálculos monetários e percentuais utilizam `rust_decimal` de 128 bits sem perda de precisão ou erros de ponto flutuante, com arredondamento fiscal e bancário afastando do zero (`RoundAwayFromZero`).
* **Imutabilidade**: As tabelas de faturas e linhas no PostgreSQL são protegidas por triggers estritos contra `UPDATE` ou `DELETE`.

### 2. Retenção na Fonte e Imposto de Selo Automáticos
* **Retenção na Fonte de 6,5%**: Calculada automaticamente sobre serviços prestados nos termos do Artigo 12.º do Decreto 71/25 e da Lei do Imposto Industrial, com segregação explícita nas linhas (`isService: true`) e no totalizador (`withholdingTotal`).
* **Imposto de Selo**:
  * **0,7%** aplicado sobre faturas-recibo (`FR`) e documentos com quitação imediata.
  * **1,0%** em operações gerais sujeitas a imposto de selo.
  * Suporte a taxa explícita personalizada ou cálculo automático via parâmetros `applyWithholding` e `applyStampDuty`.
* **Cálculo do Valor a Pagar (`amountDue`)**: `GrossTotal + StampDutyTotal - WithholdingTotal`.

### 3. Campos Logísticos e Guias de Transporte (`GT`) e Remessa (`GR`)
* Conforme o Artigo 18.º do Decreto 71/25, emissões do tipo `GT` e `GR` exigem validação rigorosa dos dados de transporte:
  * **Matrícula do Veículo** (`vehicleRegistration`)
  * **Identificação do Transportador** (`carrierName`, `carrierNif`)
  * **Locais de Carga e Descarga** (`loadAddress`, `loadCity`, `loadCountry`, `unloadAddress`, etc.)
  * **Data/Hora de Início do Transporte** (`loadDateTime`) e previsão de descarga.
* Validações de domínio bloqueiam a emissão de guias caso faltem locais de transporte ou datas válidas.

### 4. Anulação Legal com Emissão de Nota de Crédito (`NC`)
* **Retificação e Estorno**: Em conformidade com o RJFDE, faturas emitidas não podem ser excluídas do sistema. O endpoint `POST /api/v1/fiscal/invoices/{id}/cancel` emite automaticamente uma Nota de Crédito retificativa vinculada.
* **Integridade**:
  * Valida que o documento original não é uma Nota de Crédito (proibição de anular NC com NC).
  * Verifica se já existe uma NC emitida para aquele documento (idempotência fiscal estrita).
  * Clona as linhas, inverte débitos e créditos, preserva o enquadramento fiscal e associa o `sourceDocumentNumber`.
  * Exige obrigatoriamente motivo formal de cancelamento (`reason`).

### 5. Criptografia AGT: Assinatura RSA-2048 e 4 Caracteres de Controlo
* **Chave Criptográfica**: RSA-2048 com PKCS#1 v1.5 e SHA-256 encadeado.
* **Buffer Canónico AGT**: `DataEmissao;DataEntrada;NumeroDocumento;TotalGrosso;HashAnterior`.
* **4 Caracteres de Controlo**: Extraídos rigorosamente das posições **1.ª, 11.ª, 21.ª e 31.ª** da assinatura digital Base64 e impressos em todos os documentos fiscais em formato `X;Y;W;Z`.
* **Segurança em Produção**: Quando `ENVIRONMENT=production`, o serviço recusa o arranque se uma chave efémera for usada, exigindo a chave privada RSA certificada pela AGT via `AGT_RSA_PRIVATE_KEY_PATH` ou `AGT_RSA_PRIVATE_KEY_PEM`.
* **Utilitário de Credenciação**: Endpoint `POST /api/v1/fiscal/keys/generate` para gerar pares RSA compatíveis para submissão no portal da AGT.

### 6. QR Code Fiscal Oficial AGT
* **String Canónica AGT**: `A:NIF*B:DocNo*C:Total*D:Data*E:HashChave` respeitando todas as regras de formatação (incluindo consumidor final genérico `999999999`).
* **Formatos de Saída**: O serviço disponibiliza o QR Code em:
  * Imagem vectorial **SVG** com correção de erro nível M.
  * Matriz gráfica **ASCII/Texto** para impressoras matriciais/ESC-POS.
  * String canónica pura para integração em terminais POS.
* Endpoint: `GET /api/v1/fiscal/invoices/{id}/qr`.

### 7. Motor de Renderização de Faturas (PDF A4 e Talão Térmico 80mm)
* **Fatura Formal em PDF A4 (`/pdf`)**:
  * Cabeçalho institucional com dados do emitente e adquirente.
  * Tabela discriminada de produtos e serviços, descontos e taxas de IVA.
  * Quadro de desdobramento de impostos (Base de Incidência, IVA, Retenção, Imposto de Selo).
  * Impressão dos 4 caracteres de validação (`Validação AGT: x-y-w-z`) e número de certificação do software.
  * QR Code fiscal incorporado em alta definição.
* **Talão Térmico de Caixa 80mm (`/thermal`)**:
  * Saída em PDF 80mm com layout condensado e otimizado para rolos de papel térmico.
  * Saída em texto puro compatível com comandos ESC/POS (48 colunas).
  * QR Code em arte ASCII/texto e dados essenciais legíveis por fiscalizadores.

### 8. Memória Fiscal POS: Leitura X e Fecho Z
* **Leitura X (`GET /api/v1/fiscal/pos/reports/x`)**:
  * Relatório intradiário não vinculativo para conferência de caixa a qualquer momento do dia.
  * Total de vendas do dia, discriminado por taxas de IVA (14%, 7%, 0%) e por meios de pagamento (Numerário, Multicaixa, TPA, Transferência).
  * Versão em texto térmico ESC/POS via `.../x/thermal`.
* **Fecho Z (`POST /api/v1/fiscal/pos/reports/z`)**:
  * Fecho fiscal diário obrigatório de fim de dia com bloqueio da jornada de faturação.
  * **Numeração Anual Sequencial**: Formato `Z YYYY/NNNNNN` gerado via sequência transacional no banco.
  * **Persistência Imutável**: Armazenado na tabela `kudiba_core.pos_z_reports` com garantia de idempotência (mesmo dia retorna o fecho existente sem re-incrementar).
  * Renderização em texto térmico e PDF 80mm via `.../z/thermal`.

### 9. SAF-T (AO 1.01_01) em Streaming $O(1)$ e Validação XSD
* **Geração Oficial**: Em conformidade com o Decreto Executivo n.º 385/20 no namespace `urn:OECD:StandardAuditFile-Tax:AO_1.01_01`.
* **Streaming de Memória Constante $O(1)$**: Implementado através de `SaftXmlGenerator::write_xml_stream`, permitindo gerar arquivos com milhões de faturas sem estourar a memória RAM do servidor.
* **Paginação no Banco de Dados**: A leitura das faturas e linhas é realizada em lotes paginados pelo `PgInvoiceRepository` com `LIMIT`/`OFFSET` e busca em lote de linhas (`WHERE invoice_id = ANY($1)`).
* **Validação XSD Oficial Embutida**: Validação formal contra o schema oficial da AGT (`SAFTAO1.01_01.xsd`) via biblioteca nativa `libxml2`, garantindo conformidade prévia antes da submissão à AGT.
* **Processamento Assíncrono por Jobs**: Endpoints `POST /api/v1/fiscal/saft/jobs` e `GET /api/v1/fiscal/saft/jobs/{id}` permitem delegar a exportação de períodos longos em segundo plano.

### 10. Mapas e Relatórios Fiscais (PDF e Excel)
* **Mapa Fiscal de IVA e Impostos (`GET /api/v1/fiscal/reports/tax`)**:
  * Resumo por taxas de IVA, total de faturação líquida, total de imposto liquidado, volume de retenções na fonte efetuadas e total de imposto de selo cobrado.
* **Exportação para Microsoft Excel (`.xlsx`)**: Endpoint `.../tax/excel` gera folha de cálculo com estilos profissionais, cabeçalhos destacados e formatação numérica exata para entrega à contabilidade.
* **Exportação para PDF Formal (`.../tax/pdf`)**: Endpoint `.../tax/pdf` gera relatório diagramado com sumário de obrigações tributárias.

### 11. Regimes de IVA e Catálogo de Isenções
* **Resolução Automática por Volume**:
  * Volume anual < 25.000.000 AOA $\rightarrow$ **Regime de Exclusão** (taxa 0%, obrigatório motivo de isenção).
  * Volume anual entre 25.000.000 e 350.000.000 AOA $\rightarrow$ **Regime Simplificado** (taxa 7%).
  * Volume anual > 350.000.000 AOA $\rightarrow$ **Regime Geral** (taxa padrão 14% + taxas reduzidas).
* **Prevalência Declarada**: Suporte a regime declarado expressamente na AGT (`MANUAL`).
* **Validação de Códigos de Isenção**: Endpoint `/api/v1/fiscal/tax-regime/{tenantId}/exemption-codes/{code}` valida motivos legais (M00 a M99, ex: M02 Regime de Exclusão, M04 Cesta Básica) contra o enquadramento da empresa.

### 12. Transactional Outbox Pattern e Mensageria Multicanal
* **Garantia de Entrega Atómica**: Cada emissão de fatura grava na mesma transação ACID do banco um registo na tabela `kudiba_core.accounting_outbox` com payload JSON completo.
* **Worker em Segundo Plano (`OutboxWorker`)**: Processa periodicamente eventos com polling configurável (`OUTBOX_POLL_INTERVAL_MS`).
* **Publicador Multicanal (`MultiChannelEventPublisher`)**:
  * **RabbitMQ** (AMQP 0-9-1) com fallback automático.
  * **Apache Kafka / Redpanda** para streaming de eventos de alta vazão.
  * **In-Memory Broadcast Channel** para distribuição em tempo real no cluster gRPC.

### 13. Conector Webservices da AGT (Comunicação em Tempo Real)
* **Heartbeat & Detecção de Contingência (`GET /api/v1/fiscal/agt/status`)**:
  * Monitora a conectividade com o portal da AGT, mede a latência em tempo real e sinaliza automaticamente o modo de contingência fiscal se o canal estiver indisponível.
* **Despacho em Lote (`POST /api/v1/fiscal/agt/sync`)**:
  * Agrupa documentos fiscais do período com hashes encadeados e assinaturas RSA em Base64 e submete ao endpoint oficial com protocolo de entrega `AGT-REC-YYYYMMDD-...`.

### 14. Suporte a Read-Replicas do PostgreSQL
* O microserviço suporta separação transparente de tráfego de leitura e escrita:
  * **Pool de Escrita (`DATABASE_URL`)**: Utilizado exclusivamente para transações ACID de emissão, anulação e criação de séries.
  * **Pool de Leitura (`DATABASE_READ_URL`)**: Roteia consultas analíticas pesadas (exportação SAF-T, relatórios fiscais, fechos de caixa, listagens) diretamente para réplicas de leitura, aliviando o banco primário.
  * Fallback automático para o pool primário caso a réplica não esteja configurada.

---

## 📡 Tabela Completa de Endpoints REST

| Método | Rota | Descrição | Roles Permitidas |
|---|---|---|---|
| `GET` | `/` | Metadados do motor fiscal, versão e normas AGT | Público |
| `GET` | `/health` | Liveness probe do serviço | Público |
| `POST` | `/api/v1/invoices` *(ou `/fiscal/invoices`)* | Emitir fatura / documento fiscal com assinatura AGT | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `GET` | `/api/v1/invoices/{id}` *(ou `/fiscal/invoices/{id}`)* | Consultar fatura e linhas pelo ID | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `POST` | `/api/v1/invoices/{id}/cancel` | Anular fatura com emissão de Nota de Crédito (NC) | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/invoices/{id}/pdf` | Download da fatura em PDF A4 formal | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `GET` | `/api/v1/invoices/{id}/thermal` | Download da fatura em talão térmico 80mm | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `GET` | `/api/v1/invoices/{id}/qr` | Obter QR Code fiscal AGT (SVG, ASCII e string) | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `GET` | `/api/v1/public-key` *(ou `/fiscal/public-key`)* | Chave pública RSA-2048 para verificação independente | Público |
| `POST` | `/api/v1/fiscal/series` | Abertura/validação de série fiscal com bloqueio | `ADMIN`, `GESTOR` |
| `POST` | `/api/v1/fiscal/sign` | Assinatura direta de payload (modo contingência POS) | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `POST` | `/api/v1/fiscal/verify-signature` | Verificação criptográfica de assinatura de documento | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `POST` | `/api/v1/fiscal/validate-series` | Verificação de integridade e sequência sem lacunas | `ADMIN`, `GESTOR`, `CONTABILISTA`, `OPERADOR` |
| `GET` | `/api/v1/fiscal/tax-regimes` | Catálogo oficial de regimes de IVA angolanos | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `POST` | `/api/v1/fiscal/tax-regime` | Resolver ou alterar regime fiscal do tenant | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/tax-regime/{tenantId}` | Consultar regime fiscal ativo e volume de negócios | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/tax-regime/{tenantId}/exemption-codes/{code}` | Validar conformidade de código de isenção M00–M99 | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/saft` | Download direto do arquivo XML SAF-T (AO 1.01_01) | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `POST` | `/api/v1/fiscal/saft/validate` | Validar arquivo SAF-T XML contra o schema XSD oficial | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `POST` | `/api/v1/fiscal/saft/jobs` | Enfileirar geração assíncrona de SAF-T em background | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/saft/jobs/{id}` | Consultar progresso e status de job SAF-T | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/saft/jobs/{id}/download` | Download do arquivo gerado por job assíncrono | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/reports/tax` | Mapa consolidado de IVA, Selo e Retenção na Fonte | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/reports/tax/excel` | Exportar mapa fiscal em Microsoft Excel (`.xlsx`) | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/reports/tax/pdf` | Exportar mapa fiscal em relatório PDF formal | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `GET` | `/api/v1/fiscal/pos/reports/x` | Relatório intradiário de caixa (Leitura X em JSON) | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `GET` | `/api/v1/fiscal/pos/reports/x/thermal` | Leitura X em texto térmico ESC/POS (48 colunas) | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `POST` | `/api/v1/fiscal/pos/reports/z` | Emitir Fecho Z diário oficial (`Z YYYY/NNNNNN`) | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `POST` | `/api/v1/fiscal/pos/reports/z/thermal` | Emitir Fecho Z com talão térmico ou PDF 80mm | `ADMIN`, `GESTOR`, `OPERADOR_FACTURACAO` |
| `GET` | `/api/v1/fiscal/agt/status` | Heartbeat, latência e status de contingência da AGT | `ADMIN`, `GESTOR` |
| `POST` | `/api/v1/fiscal/agt/sync` | Submeter lote de faturas aos webservices da AGT | `ADMIN`, `GESTOR`, `CONTABILISTA` |
| `POST` | `/api/v1/fiscal/keys/generate` | Gerar par de chaves RSA-2048 para credenciação AGT | `ADMIN`, `GESTOR` |
| `GET` | `/scalar` *(ou `/docs`)* | Documentação interativa da API via Scalar UI | Público |
| `GET` | `/api-docs/openapi.yaml` | Especificação completa OpenAPI 3.1 | Público |

---

## 🔌 Contratos gRPC (`kudiba.fiscal.v1`)

O servidor gRPC roda concorrentemente na porta configurada (`GRPC_PORT`, padrão `9091`):

* `rpc SignDocument (SignDocumentRequest) returns (SignDocumentResponse)`: Assina digitalmente uma fatura ou documento fiscal gerando hash encadeado e 4 caracteres de controlo.
* `rpc VerifySignature (VerifySignatureRequest) returns (VerifySignatureResponse)`: Valida a assinatura de um documento contra a chave pública RSA ativa.
* `rpc ValidateSeriesSequence (ValidateSeriesSequenceRequest) returns (ValidateSeriesSequenceResponse)`: Verifica a continuidade rigorosa da sequência de uma série fiscal (*zero gaps*).
* `rpc TriggerSaftGeneration (TriggerSaftGenerationRequest) returns (TriggerSaftGenerationResponse)`: Enfileira a extração de SAF-T (AO) para processamento em background.

---

## ⚙️ Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `9090` | Porta do servidor HTTP REST interno |
| `GRPC_PORT` | `9091` | Porta do servidor gRPC (`kudiba.fiscal.v1`) |
| `DATABASE_URL` | `postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_erp` | String de conexão PostgreSQL primária (operações de escrita ACID) |
| `DATABASE_READ_URL` | *(opcional)* | String de conexão para réplicas de leitura PostgreSQL (relatórios e SAF-T) |
| `DB_MAX_CONNECTIONS` | `20` | Dimensão máxima do pool de conexões com o PostgreSQL |
| `ENVIRONMENT` | `development` | Ambiente de execução (`development`, `staging`, `production`) |
| `AGT_KEY_VERSION` | `1` | Versão da chave privada RSA registada no portal da AGT |
| `AGT_SOFTWARE_CERT` | `999/AGT/2026` | Número de validação / certificação do software junto da AGT |
| `AGT_RSA_PRIVATE_KEY_PATH` | *(opcional)* | Caminho absoluto no disco para o arquivo PEM da chave privada RSA |
| `AGT_RSA_PRIVATE_KEY_PEM` | *(opcional)* | Conteúdo textual direto em PEM da chave privada RSA-2048 |
| `AGT_PLATFORM_URL` | `https://webservices.agt.minfin.gov.ao/...` | URL base dos webservices de faturação eletrónica da AGT |
| `AGT_API_TOKEN` | *(opcional)* | Token Bearer de autorização mútua com a AGT |
| `AGT_TIMEOUT_SECS` | `15` | Timeout em segundos para chamadas HTTP externas à AGT |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` | Frequência de leitura da transactional outbox (em milissegundos) |
| `OUTBOX_BATCH_SIZE` | `50` | Quantidade máxima de eventos fiscais a despachar por ciclo |
| `RABBITMQ_URL` | *(opcional)* | URL de ligação ao RabbitMQ (ex: `amqp://guest:guest@localhost:5672`) |
| `KAFKA_BROKERS` | *(opcional)* | Lista de brokers Kafka / Redpanda (ex: `localhost:9092`) |

---

## 🧪 Qualidade de Código e Suite de Testes

A suite de testes cobre exaustivamente todos os domínios fiscais, matemáticos, criptográficos e de integração do microserviço, sem dependência de simulações parciais:

```bash
cargo test --bin kudiba-invoicing
```

### Resultados da Validação (84 Testes — 100% de Sucesso):
* **Cálculo Monetário & Impostos**: Aritmética decimal exata de 128 bits, regras de arredondamento fiscal, cálculo automático de retenção de serviços (6,5%) e imposto de selo (0,7% / 1,0%).
* **Regimes e Isenções de IVA**: Validação de taxas nos regimes de Exclusão, Simplificado e Geral; validação de motivos de isenção M00 a M99.
* **Criptografia e Encadeamento**: Assinatura RSA-2048 PKCS#1 v1.5, hash SHA-256 encadeado, verificação de adulterações, bloqueio de chaves efémeras em produção.
* **Validação XSD do SAF-T (AO)**: Compilação de schema XSD oficial e rejeição imediata de XML mal formado.
* **Relatórios e Renderização**: Geração de faturas em PDF A4, talões térmicos 80mm, relatórios de IVA em Excel e PDF, Fecho Z e Leitura X de POS.
* **Segurança e Multitenancy**: Testes de autorização por headers injetados pelo Gateway e isolamento rigoroso entre empresas distintas.
