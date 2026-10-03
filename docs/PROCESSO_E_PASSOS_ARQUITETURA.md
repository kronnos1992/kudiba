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
- **Modo Completo (`docker compose --profile full up -d`)**: Adiciona PostgreSQL 16 (`:5432`), RabbitMQ 3.13 Management (`:5672` / `:15672`), Core API (`:8081`) e Fiscal Engine (`:9090`).
- **Modo Streaming (`docker compose --profile streaming up -d`)**: Adiciona Kafka / Redpanda (`:19092`).

---

## 4. Estado Atual dos Serviços

| Serviço | Porta | Tecnologia | Papel |
| :--- | :--- | :--- | :--- |
| **kudiba-api-gateway** | 8080 | Rust (Axum + Tokio) | Entrada única, Rate Limit, Tenant Resolver, Swagger UI |
| **kudiba-gateway-redis** | 6379 | Redis 7.4 Alpine | Cache efêmero, sliding-window rate limiting e sessões |
| **kudiba-postgres** | 5432 | PostgreSQL 16 Alpine | Banco relacional com triggers de imutabilidade da AGT |
| **kudiba-rabbitmq** | 5672 / 15672 | RabbitMQ 3.13 Alpine | Fila de tarefas pesadas (SAF-T, emails, webhooks) |
| **kudiba-core-api** | 8081 | Python (Mock) / Go | Lógica de negócio comercial e ERP |
| **kudiba-fiscal-engine** | 9090 | Python (Mock) / gRPC | Criptografia RSA e regras do DP 71/25 |
