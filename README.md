# Kudiba ERP — Cloud-Native & Edge-Ready (Angola)

[![Rust](https://img.shields.io/badge/Rust-2021%20%7C%20Axum%200.8-orange.svg)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/Python-3.12%2B%20%7C%20FastAPI-blue.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20v2-blue.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B%20%7C%20Database--per--Service-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.4-red.svg)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-orange.svg)](https://www.rabbitmq.com/)
[![Conformidade](https://img.shields.io/badge/Conformidade-AGT%20Decreto%2071%2F25%20%26%20385%2F20-green.svg)](docs/ARQUITETURA_DO_SISTEMA.md)

**Kudiba ERP** é um ecossistema de software empresarial de alto desempenho, desenhado sob medida para o mercado angolano e da África Subsaariana. Substitui soluções legadas (Primavera, PHC, Sage) com arquitetura distribuída moderna, custo total de posse (TCO) reduzido em mais de 60%, operação resiliente a falhas de rede e conformidade fiscal contínua certificada pela **Administração Geral Tributária (AGT)**.

---

## 🚀 Arquitetura Rápida do Ecossistema

```
[ Clientes Web SPA / POS Desktop Tauri Local-First ]
                       │
                       ▼ (HTTPS TLS 1.3 / REST / gRPC)
┌────────────────────────────────────────────────────────┐
│            API GATEWAY PERIMÉTRICO (RUST)              │
│  - Porta 8080                                          │
│  - Middlewares: Tenant, Rate Limit, Auth, Contingência │
│  - Verificação imediata de Blacklist no Redis          │
│  - Documentação Swagger UI: /swagger-ui                │
└────────────────────────────────────────────────────────┘
              │
              ├───────────────► KudibaAuth Identity & RBAC Service (:8082)
              │                 - Python 3.12+ (FastAPI + AsyncIO + SQLAlchemy)
              │                 - Argon2id, JWT HMAC-SHA256, Refresh Token Rotation
              │                 - Multi-Tenant N:N, Filiais (Branches) e Perfis RBAC
              │                 - Base de Dados Isolada: kudiba_auth
              │
              ├───────────────► KudibaInvoicing Fiscal Engine (:9090 REST / :9091 gRPC)
              │                 - Rust (Clean Arch + CQRS + Unit of Work + Axum + Tonic)
              │                 - Motor Fiscal AGT (Decreto 71/25 & 385/20)
              │                 - Assinatura RSA-2048, 4 Caracteres, QR Code (SVG/ASCII)
              │                 - SAF-T (AO) v1.01_01 em Streaming O(1) e Validação XSD libxml2
              │                 - Faturas em PDF A4 institucional e Talão Térmico 80mm ESC/POS
              │                 - Memória Fiscal POS (Leitura X e Fecho Z com fecho anual)
              │                 - Base de Dados Isolada: kudiba_invoicing
              │
              ├───────────────► PostgreSQL 16 (:5432)
              │                 - Database-per-Service: kudiba_auth e kudiba_invoicing
              │                 - Triggers de imutabilidade de faturas (trg_protect_invoices)
              │
              ├───────────────► Redis 7.4 Alpine (:6379)
              │                 - Blacklist de JWTs revogados (jwt:blacklist:{jti})
              │                 - Sliding window rate limiting e sessões efêmeras
              │
              └───────────────► RabbitMQ 3.13 Alpine (:5672 / :15672)
                                - Filas de tarefas assíncronas pesadas (SAF-T Jobs)
                                - Eventos transacionais via Transactional Outbox
```

---

## 🛠️ Como Executar com Docker

### 1. Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) em execução (com integração WSL 2 ativada no Windows).

### 2. Inicialização dos Serviços

#### Modo Recomendado Completo (`--profile full`): Todos os Microsserviços e Infraestrutura
Inicia Gateway, KudibaAuth, KudibaInvoicing, PostgreSQL (com as bases `kudiba_auth` e `kudiba_invoicing`), Redis e RabbitMQ:
```bash
docker compose --profile full up -d
```

#### Modo Padrão (Leve): Gateway + Redis
Inicia apenas a camada de borda:
```bash
docker compose up -d
```

#### Modo Streaming (`--profile streaming`): Event Log Kafka / Redpanda
```bash
docker compose --profile streaming up -d
```

---

## 📖 Endpoints Principais & Interfaces

Com os containers em execução:

* **Swagger UI Interativo Unificado**: [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui)
* **Especificação OpenAPI 3.1 do Gateway**: [http://localhost:8080/api-docs/openapi.yaml](http://localhost:8080/api-docs/openapi.yaml)
* **KudibaAuth Swagger Docs**: available on the internal service network; port `8082` is not published on the host.
* **Healthcheck Liveness do Gateway**: [http://localhost:8080/health](http://localhost:8080/health)
* **Readiness Probe do Gateway**: [http://localhost:8080/ready](http://localhost:8080/ready)
* **Métricas Prometheus**: [http://localhost:8080/metrics](http://localhost:8080/metrics)
* **Painel RabbitMQ Management**: [http://localhost:15672](http://localhost:15672) *(Utilizador: `kudiba` / Senha: `kudiba_rabbit_pass`)*

---

## 📚 Portal de Documentação Oficial de Engenharia

Consulte a pasta [`docs/`](docs/) para especificações completas:

| Guia | Descrição |
| :--- | :--- |
| [**Portal de Documentação**](docs/README.md) | Índice geral, guia por perfil e boas práticas de desenvolvimento. |
| [**Arquitetura do Sistema**](docs/ARQUITETURA_DO_SISTEMA.md) | Visão detalhada da Clean Architecture, CQRS, Unit of Work, Zero-Trust e AGT. |
| [**Modelo de Dados e Bancos**](docs/MODELO_DE_DADOS_E_BANCOS.md) | Padrão *Database-per-Service*, dicionário de dados de `kudiba_auth` e `kudiba_invoicing`. |
| [**Catálogo Unificado de APIs**](docs/CATALOGO_DE_APIS.md) | Referência completa de endpoints REST, contratos gRPC Protobuf e erros RFC 7807. |
| [**Manual de Desenvolvimento e Deploy**](docs/MANUAL_DE_DESENVOLVIMENTO_E_DEPLOY.md) | Guia prático de setup local, variáveis `.env`, Docker profiles e comandos de testes. |
| [**Registo Técnico de Evolução**](docs/PROCESSO_E_PASSOS_ARQUITETURA.md) | Diário de bordo das decisões arquiteturais e diagnósticos técnicos superados. |
| [**Especificação Técnica Mestre do ERP**](docs/ESPECIFICACAO_TECNICA_ERP.md) | Visão de produto, proposta de valor e roadmap inicial. |
| [**Decreto Presidencial n.º 71/25 da AGT**](docs/03%20Decreto%20Presidencial%20n.%C2%BA%207125.pdf) | Regulamento oficial sobre emissão e certificação de software fiscal em Angola. |

---

## 🧪 Testes Automatizados

O projeto conta com baterias rigorosas de testes automatizados com 100% de aprovação:

- **KudibaAuth (Python / `pytest`)**: **15 testes aprovados** cobrindo autenticação Argon2id, rotação de refresh tokens, detecção de reúso, configuração segura e endpoints HTTP.
  ```bash
  cd Backend/services/KudibaAuth && PYTHONPATH=. pytest tests/
  ```
- **KudibaInvoicing (Rust / `cargo test`)**: **84 testes aprovados** cobrindo conformidade do Decreto Presidencial 71/25, criptografia RSA-2048, SAF-T streaming e relatórios fiscais.
  ```bash
  cargo test --bin kudiba-invoicing
  ```

---

## 📄 Licença & Legislação
Desenvolvido em conformidade com o **Decreto Presidencial n.º 71/25** e o **Decreto Executivo n.º 385/20** da República de Angola.
