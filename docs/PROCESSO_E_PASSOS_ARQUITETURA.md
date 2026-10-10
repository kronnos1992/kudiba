# Registo Técnico de Evolução, Diagnóstico e Arquitetura - ERP Kudiba

**Projeto:** Kudiba ERP (Entrypoint API Gateway & Microservices)  
**Data:** Outubro de 2026  
**Repositório Oficial:** `https://github.com/kronnos1992/kudiba`  
**Conformidade Regulatória:** Decreto Presidencial n.º 71/25 de 20 de Março (República de Angola - Facturação Electrónica e Regime Jurídico de Facturas)

---

## 1. Contexto e Ponto de Partida

O projeto Kudiba foi concebido como um ERP de nova geração para Angola, desenhado para substituir sistemas legados (Primavera, PHC, Sage) com uma stack moderna, livre de licenças proprietárias caras (Linux, Rust, PostgreSQL, Redis, RabbitMQ/Kafka).

O repositório possuía inicialmente:
1. O diploma legal em PDF: `03 Decreto Presidencial n.º 7125.pdf`.
2. A especificação técnica de alto nível: `ESPECIFICACAO_TECNICA_ERP.md`.
3. O código-fonte em Rust do **API Gateway Perimétrico** em `Backend/src/`.
4. A documentação OpenAPI 3.1 em `Backend/docs/API_GATEWAY_OPENAPI.yaml`.

---

## 2. Diagnósticos e Desafios Técnicos Superados

### 2.1 Integração do Docker Desktop com WSL 2
- **Problema:** Ao tentar executar comandos `docker`, o ambiente WSL retornava `The command 'docker' could not be found in this WSL 2 distro`.
- **Causa:** O Docker Desktop havia sido instalado/atualizado no Windows (build v46 em `AppData/Local/Programs/DockerDesktop`), porém a integração com a distribuição `Ubuntu` estava desativada por padrão em `settings-store.json` (`EnableIntegrationWithDefaultWslDistro: false, IntegratedWslDistros: []`).
- **Resolução:** O arquivo de configuração do Docker Desktop foi atualizado para registrar explicitamente a distro `Ubuntu`, ativando o serviço `docker-desktop-user-distro proxy` e disponibilizando o socket `/var/run/docker.sock`.

### 2.2 Dependências Rust e o "Rust Edition 2024"
- **Problema:** A compilação em Docker falhava com o erro:
  `feature edition2024 is required. The package requires the Cargo feature called edition2024, but that feature is not stabilized in this version of Cargo (1.81.0)`.
- **Causa:** Crates modernas (como `time-core v0.1.9` e `time-macros`) adotaram o Rust Edition 2024, que requer Rust 1.85+. O Dockerfile usava a imagem legada `rust:1.81-alpine`.
- **Resolução:** A imagem base no `Dockerfile.gateway` foi atualizada para `rust:alpine` (equipado com Cargo 1.99 e suporte pleno ao Edition 2024).

### 2.3 Sintaxe de Rota Wildcard no Axum 0.8
- **Problema:** O Gateway entrava em pânico na inicialização (`panic at src/server.rs:66:10`):
  `Path segments must not start with *. For wildcard capture, use {*wildcard}`.
- **Causa:** O framework Axum atualizou a sintaxe de captura curinga na versão 0.8.x.
- **Resolução:** As rotas `/api/v1/fiscal/*path` e `/api/v1/*path` foram migradas para `/api/v1/fiscal/{*path}` e `/api/v1/{*path}`.

### 2.4 Healthcheck IPv6 vs. IPv4 no Alpine
- **Problema:** O container do Gateway ficava em estado `unhealthy` apesar de a API estar respondendo externamente.
- **Causa:** O Alpine Linux resolve `localhost` para IPv6 `::1` prioritariamente. O servidor Axum vincula em IPv4 (`0.0.0.0:8080`), fazendo com que o `wget` de verificação de integridade tomasse `Connection refused`.
- **Resolução:** O `HEALTHCHECK` no Dockerfile foi ajustado para `http://127.0.0.1:8080/health`.

### 2.5 Otimização de Cache e Build Context
- **Problema:** O envio de contexto do Docker demorava excessivamente e transferia centenas de megabytes.
- **Causa:** A pasta `Backend/target/` continha ~480MB de artefatos de compilação da máquina hospedeira.
- **Resolução:** Criação de arquivos `.dockerignore` na raiz e em `Backend/`, além da cópia determinística de `Cargo.lock` junto ao `Cargo.toml` para maximizar o reuso de camadas compiladas.

---

## 3. Implementações Realizadas

### 3.1 Swagger UI v5 e OpenAPI 3.1 Nativos
- Integrado o Swagger UI v5 diretamente no binário do Gateway via `include_str!`, garantindo documentação interativa sem depender de arquivos soltos em disco no container:
  - `GET /swagger-ui`: Interface visual do Swagger.
  - `GET /api-docs/openapi.yaml`: Arquivo OpenAPI 3.1 em formato YAML.
  - `GET /swagger` e `GET /docs`: Redirecionamento permanente automático.

### 3.2 Contratos gRPC e Protocol Buffers (`proto/`)
- **`proto/fiscal/v1/fiscal_engine.proto`**: Formaliza o serviço criptográfico do Decreto Presidencial 71/25 (assinatura RSA 2048-bit, encadeamento de hash SHA-256 e extração dos 4 caracteres de validação).
- **`proto/events/v1/events.proto`**: Define os eventos assíncronos (`InvoiceIssuedEvent`, `StockMovementEvent`, `PaymentConfirmedEvent`, `AgtContingencyAlertEvent`).

### 3.3 Persistência e Gatilho Tributário de Imutabilidade
- **`Backend/deploy/init-db.sql`**: Inicializador do PostgreSQL 16 com:
  - Schemas `kudiba_core` e `kudiba_audit`.
  - Tabelas de `tenants`, `series_fiscais`, `invoices`, `invoice_lines`.
  - **Trigger `trg_protect_invoices`**: Rejeita qualquer tentativa de `UPDATE` ou `DELETE` em faturas emitidas, registrando a infração na tabela de auditoria.

### 3.4 Orquestração Multi-Serviço com Profiles (`docker-compose.yml`)
- **Modo Padrão (`docker compose up -d`)**: Sobe Gateway (`:8080`) e Redis 7.4 (`:6379`).
- **Modo Completo (`docker compose --profile full up -d`)**: Adiciona PostgreSQL 16 (`:5432`) e RabbitMQ 3.13 Management (`:5672` / `:15672`).
- **Modo Streaming (`docker compose --profile streaming up -d`)**: Adiciona Kafka / Redpanda (`:19092`).

### 3.5 Remoção Integral de Mocks e Saneamento do Swagger
- **Eliminação de Mocks**: Removidos os scripts `mock_core_api.py` e `mock_fiscal_engine.py`, assim como os containers `kudiba-core-api` e `kudiba-fiscal-engine`. Não há simulação de respostas falsas.
- **Saneamento do Swagger UI / OpenAPI 3.1**: Removidos todos os endpoints de negócio teóricos que ainda não foram desenvolvidos (`/auth/*`, `/fiscal/*`, `/pos/*`, `/catalog/*`, etc.).
- **Catálogo Transparente**: O Swagger agora expõe exclusivamente os endpoints nativos reais e operacionais desenvolvidos no API Gateway Rust (`/health`, `/ready`, `/metrics`, `/api-docs/openapi.yaml`). Conforme novos módulos forem sendo desenvolvidos, os seus contratos reais serão adicionados.

---

## 4. Estado Atual dos Serviços em Execução

| Serviço | Porta | Tecnologia | Papel | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **kudiba-api-gateway** | 8080 | Rust (Axum + Tokio) | Entrada única, Rate Limit, Tenant Resolver, Swagger UI | Ativo & Saudável (UP) |
| **kudiba-gateway-redis** | 6379 | Redis 7.4 Alpine | Cache efêmero, sliding-window rate limiting e sessões | Ativo & Saudável (READY) |
| **kudiba-postgres** | 5432 | PostgreSQL 16 Alpine | Banco relacional com triggers de imutabilidade da AGT | Ativo & Saudável |
| **kudiba-rabbitmq** | 5672 / 15672 | RabbitMQ 3.13 Alpine | Fila de tarefas pesadas (SAF-T, emails, webhooks) | Ativo & Saudável |
| **kudiba-invoicing** | 9090 (REST) / 9091 (gRPC) | Rust (Clean Arch + CQRS) | Motor Fiscal AGT (Decreto 71/25 & 385/20), SAF-T (AO), Conector AGT, Renderizador PDF/Térmico, POS Fecho Z | Testado & Validado (84 testes, 100% sucesso) |

---

## 5. Implementação Integral do Motor Fiscal (KudibaInvoicing) & Conformidade AGT

O motor fiscal `KudibaInvoicing` atende plenamente ao **Decreto Presidencial n.º 71/25 (Regime Jurídico das Facturas)**, ao **Decreto Executivo n.º 385/20 (SAF-T AO v1.01_01)** e às exigências de certificação de software da **AGT**:

### 5.1 Capacidades Completas Implementadas
1. **Emissão e Bloqueio Pessimista de Séries**: Numeração rigorosamente sequencial (*zero gaps*) com `SELECT ... FOR UPDATE` por série, cálculo exato em decimal 128 bits e suporte a FT, FR, NC, ND, GT e GR.
2. **Retenção na Fonte (6,5%) e Imposto de Selo (0,7% / 1%) Automáticos**: Cálculo em conformidade com o Artigo 12.º e 15.º do Decreto 71/25, com arredondamento afastando do zero e totalizadores segregados.
3. **Validação XSD Oficial do SAF-T (AO 1.01_01)**: Validação estrutural e semântica do XML contra o schema oficial da AGT (`schemas/SAFTAO1.01_01.xsd`) via biblioteca nativa `libxml2`.
4. **Exportação de Relatórios Fiscais em PDF e Excel**: Geração de mapas de IVA, Imposto de Selo e Retenções em folha de cálculo formatada Microsoft Excel (`.xlsx`) e documento formal PDF.
5. **Transactional Outbox Pattern & Dispatcher Multicanal**: Persistência atómica de eventos fiscais na tabela `kudiba_core.accounting_outbox`, despachados assincronamente via RabbitMQ, Apache Kafka e broadcast in-memory.
6. **Processamento Assíncrono por Jobs**: Enfileiramento e acompanhamento de extrações volumosas de SAF-T via REST (`/api/v1/fiscal/saft/jobs`) e gRPC (`TriggerSaftGeneration`).
7. **Motor de Renderização de Faturas**:
   - PDF A4 institucional diagramado com cabeçalho fiscal, discriminação de impostos, menção AGT e QR Code.
   - Talão térmico de caixa de 80mm em PDF condensado e em texto puro com comandos ESC/POS (48 colunas).
8. **QR Code Fiscal Oficial AGT**: Geração da string canónica oficial (`A:NIF*B:Doc*C:Total*D:Data*E:Hash`), matriz gráfica ASCII e imagem vectorial SVG com correção de erro nível M.
9. **Anulação Legal com Emissão de Nota de Crédito (NC)**: Anulação e retificação formal vinculada ao documento de origem com inversão contábil, idempotência fiscal e preservação de histórico.
10. **Memória Fiscal POS (Leitura X e Fecho Z)**:
    - Leitura X intradiária para conferência de vendas e meios de pagamento a qualquer momento.
    - Fecho Z diário oficial obrigatório com numeração anual sequencial (`Z YYYY/NNNNNN`) persistido na tabela `kudiba_core.pos_z_reports` com idempotência diária e renderização térmica/PDF.
11. **Campos Logísticos de Transporte para Guias (GT e GR)**: Registo e validações obrigatórias de matrícula, transportador, locais e datas/horas de carga e descarga nos termos do Artigo 18.º do RJFDE.
12. **Streaming SAF-T XML em Memória Constante $O(1)$**: Leitura paginada no PostgreSQL e streaming contínuo via `SaftXmlGenerator::write_xml_stream`, viabilizando arquivos gigantes sem estouro de memória RAM.
13. **Separação de Pools para Read-Replicas**: Roteamento de relatórios pesados e exportações analíticas para `DATABASE_READ_URL`, preservando o pool primário `DATABASE_URL` para escritas transacionais ACID.
14. **Conector Webservices da AGT**: Heartbeat contínuo de conectividade e latência com ativação automática de modo de contingência fiscal, além de despacho em lote de faturas assinadas.
15. **Regimes Tributários e Catálogo de Isenções**: Enquadramento automático por volume de negócios (Exclusão, Simplificado e Geral) e validação de códigos legais de isenção M00 a M99.

### 5.2 Validação por Testes Automatizados
- **84 testes unitários e de integração** executados e aprovados com 100% de sucesso (`cargo test --bin kudiba-invoicing`):
  - Cálculos de IVA, retenção de serviços e imposto de selo.
  - Criptografia RSA-2048, encadeamento de hash SHA-256 e 4 caracteres de controlo.
  - Integridade de séries e bloqueio de lacunas de numeração.
  - Schemas XSD e streaming XML.
  - Relatórios térmicos, PDF e Excel.
  - Trilha de autorização por perfil e isolamento multi-tenant.

---

## 6. Implementação do Microsserviço de Autenticação e RBAC (KudibaAuth)

Para desacoplar a complexidade de gestão de identidades e acelerar o desenvolvimento de fluxos de utilizadores sem sobrecarregar a camada determinística de baixo nível do Rust, o serviço **KudibaAuth** foi construído em **Python com FastAPI (AsyncIO)**, integrando-se perfeitamente com o API Gateway Rust e o PostgreSQL 16.

### 6.1 Capacidades e Arquitetura do KudibaAuth
1. **Hashing Criptográfico de Senhas com Argon2id**: Hashing determinístico e resistente a GPUs/ASICs (`argon2-cffi`), com parâmetros recomendados pelo OWASP (memória 64MB, custo de tempo 3, paralelismo 4).
2. **Tokens JWT com `KudibaClaims` Nativos**: Emissão de Access Tokens (15 min) com assinatura HMAC-SHA256 e claims padronizados (`sub`, `tenant_id`, `tenant_slug`, `branch_id`, `roles`, `permissions`, `exp`, `jti`), validados directamente pelo middleware perimétrico do API Gateway.
3. **Refresh Token Rotation & Detecção de Roubo**: Emissão de pares de Refresh Tokens CSPRNG de uso único (SHA-256 no banco). A reutilização de um token já revogado activa imediatamente a invalidação de toda a família de sessões associada (*family revocation*).
4. **Revogação Instantânea via Blacklist no Redis**: O endpoint de logout grava o identificador único do token (`jwt:blacklist:{jti}`) no Redis com TTL até ao prazo de expiração, bloqueando imediatamente qualquer tentativa de reuso no Gateway.
5. **Multi-Tenancy e Filiais (Branches)**: Modelo N:N onde um utilizador pode pertencer a múltiplas empresas e filiais (`user_tenants`), com alternância a quente (`POST /auth/switch-tenant`) sem exigir reautenticação.
6. **Controle de Acesso Baseado em Funções (RBAC)**:
   - Perfis padrão: `ADMIN`, `CONTABILISTA`, `OPERADOR_CAIXA`, `GESTOR_STOCK`, `AUDITOR`.
   - Permissões atómicas (`invoices:issue`, `invoices:cancel`, `fiscal:saft:export`, `pos:z_report`, `users:invite`, etc.).
7. **Proteção Anti-Bruteforce e Bloqueio Automático**: Bloqueio temporário de conta após 5 tentativas consecutivas falhadas com auditoria registada em `kudiba_audit.auth_audit_log`.
8. **Roteamento Perimétrico e Docker Compose**:
   - Gateway atualizado com `forward_to_auth` apontando para `AUTH_SERVICE_URL` (`:8082`).
   - Serviço adicionado ao `docker-compose.yml` e scripts de migração estruturados em `Backend/deploy/02-auth-schema.sql` e `Backend/deploy/00-init-databases.sh`.

---

## 7. Segregação de Bases de Dados (Database-per-Service) e Portal de Documentação

### 7.1 Padrão Database-per-Service
Em cumprimento da diretriz de desacoplamento rigoroso entre microsserviços:
1. **`kudiba_auth`**: Base de dados independente para identidade, utilizadores, filiais, multitenancy, papéis e auditoria de autenticação.
2. **`kudiba_invoicing`**: Base de dados independente para entidades fiscais, séries com bloqueio pessimista, faturas imutáveis com gatilho `trg_protect_invoices`, fechos Z de POS e tabela de outbox transacional.
3. **Script de Inicialização**: O container Postgres executa `00-init-databases.sh`, que provisiona deterministicamente ambas as bases e aplica os schemas `01-invoicing-schema.sql` e `02-auth-schema.sql`.

### 7.2 Suíte Completa de Documentação Técnica de Engenharia
Foi concebido e estruturado o portal documental em `docs/`:
- **`docs/README.md`**: Portal de navegação com mapas de leitura por perfil técnico.
- **`docs/ARQUITETURA_DO_SISTEMA.md`**: Visão global dos padrões Clean Architecture, CQRS, Unit of Work, Zero-Trust e conformidade AGT.
- **`docs/MODELO_DE_DADOS_E_BANCOS.md`**: Dicionário de tabelas, relacionamentos e gatilhos de persistência.
- **`docs/CATALOGO_DE_APIS.md`**: Referência exaustiva de rotas REST, contratos Protobuf gRPC e formato de erro RFC 7807.
- **`docs/MANUAL_DE_DESENVOLVIMENTO_E_DEPLOY.md`**: Guia passo a passo de inicialização, perfis Docker Compose e suítes de testes.
- **`Backend/services/KudibaAuth/README.md`** e **`Backend/services/KudibaInvoicing/README.md`**: Documentações específicas de engenharia de cada serviço.
