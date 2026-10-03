# Kudiba ERP - Cloud-Native & Edge-Ready (Angola)

[![Rust](https://img.shields.io/badge/Rust-2021%20%7C%20Axum%200.8-orange.svg)](https://www.rust-lang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20v2-blue.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.4-red.svg)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-orange.svg)](https://www.rabbitmq.com/)
[![Conformidade](https://img.shields.io/badge/Conformidade-AGT%20Decreto%2071%2F25-green.svg)](docs/PROCESSO_E_PASSOS_ARQUITETURA.md)

**Kudiba ERP** é um ecossistema de software empresarial de alto desempenho projetado especificamente para o mercado angolano e da África Subsaariana. Construído em arquitetura distribuída, segura e livre de custos abusivos de licenciamento legado.

---

## 🚀 Arquitetura Rápida

```
[ Clientes Web / POS Tauri ]
             │
             ▼ (HTTPS / REST)
┌────────────────────────────────────────────────────────┐
│            API GATEWAY PERIMÉTRICO (RUST)              │
│  - Porta 8080                                          │
│  - Middlewares: Tenant, Rate Limit, Auth, Contingência │
│  - Documentação Swagger UI: /swagger-ui                │
└────────────────────────────────────────────────────────┘
             │
             ├───────────────► Core API Server (:8081)
             │                 - Negócio, Vendas, Armazéns, Utilizadores
             │
             ├───────────────► Fiscal Engine (:9090 - gRPC)
             │                 - Assinatura RSA-SHA256 (Decreto 71/25)
             │
             ├───────────────► PostgreSQL 16 (:5432)
             │                 - Schemas kudiba_core e kudiba_audit
             │
             └───────────────► RabbitMQ 3.13 (:5672 / :15672)
                               - Filas de SAF-T, Notificações e Webhooks
```

---

## 🛠️ Como Executar com Docker

### 1. Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) em execução (com integração WSL 2 ativada se estiver no Windows).

### 2. Inicialização dos Serviços

#### Modo Padrão (Leve): Gateway + Redis
Inicia o API Gateway e a camada de cache/rate limit:
```bash
docker compose up -d
```

#### Modo Completo (`--profile full`): Todos os Serviços de Infraestrutura
Inicia Gateway, Redis, PostgreSQL 16 e RabbitMQ:
```bash
docker compose --profile full up -d
```

#### Modo Streaming (`--profile streaming`): Event Log Kafka / Redpanda
```bash
docker compose --profile streaming up -d
```

---

## 📖 Documentação & Endpoints

Com os containers em execução:

* **Swagger UI Interativo**: [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui)
* **Especificação OpenAPI 3.1**: [http://localhost:8080/api-docs/openapi.yaml](http://localhost:8080/api-docs/openapi.yaml)
* **Healthcheck Liveness**: [http://localhost:8080/health](http://localhost:8080/health)
* **Readiness Probe**: [http://localhost:8080/ready](http://localhost:8080/ready)
* **Métricas Prometheus**: [http://localhost:8080/metrics](http://localhost:8080/metrics)
* **Painel RabbitMQ Management**: [http://localhost:15672](http://localhost:15672) *(User: `kudiba` / Senha: `kudiba_rabbit_pass`)*

---

## 📚 Documentos de Engenharia

Consulte a pasta [`docs/`](docs/) e [`Backend/docs/`](Backend/docs/) para aprofundamento:
- [**Registo Técnico de Evolução e Passos Dados**](docs/PROCESSO_E_PASSOS_ARQUITETURA.md)
- [**Arquitetura do Microserviço de Facturação (Clean Arch, CQRS, UOW, Repo)**](Backend/docs/FISCAL_INVOICING_MICROSERVICE_ARCHITECTURE.md)
- [**Guia de Integração gRPC, RabbitMQ e Kafka**](Backend/docs/ARCHITECTURE_INTEGRATION_GUIDE.md)
- [**Arquitetura do API Gateway e ADRs**](Backend/docs/API_GATEWAY_ARCHITECTURE.md)
- [**Especificação Técnica Mestre do ERP**](ESPECIFICACAO_TECNICA_ERP.md)
- [**Contratos Protobuf (gRPC)**](proto/)

---

## 📄 Licença & Legislação
Desenvolvido em conformidade com o **Decreto Presidencial n.º 71/25 de 20 de Março de 2025/2026** da República de Angola.
