# Manual de Desenvolvimento, Testes e Deploy — Kudiba ERP

**Projeto:** Kudiba ERP  
**Versão:** 1.1.0  
**Data:** Outubro de 2026  
**Ambiente Alvo:** Linux (Ubuntu 22.04+ / Debian 12 / WSL 2 no Windows 11)

---

## 1. Pré-requisitos de Ambiente

Para executar ou desenvolver no Kudiba ERP, certifique-se de dispor das seguintes ferramentas instaladas:

1. **Docker Engine & Docker Compose v2**:
   - Docker 24.0+ com `docker compose` integrado.
   - No Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/) com integração WSL 2 ativada para a sua distribuição (ex.: `Ubuntu`).
2. **Ambiente Rust (para Gateway e KudibaInvoicing)**:
   - Rust 1.85+ (Edição 2021/2024) com `rustup` e `cargo`.
   - `libssl-dev`, `pkg-config`, `libxml2-dev` instalados no sistema operacional hospedeiro.
3. **Ambiente Python (para KudibaAuth)**:
   - Python 3.12+ (ou 3.14) com `pip` e `venv`.
4. **Clientes Opcionais de Diagnóstico**:
   - `curl` ou `httpie` para testes REST.
   - `grpcurl` para testes na porta gRPC `:9091`.
   - `psql` para inspeção direta das bases de dados PostgreSQL.

---

## 2. Execução Rápida via Docker Compose

O ecossistema Kudiba organiza os seus componentes através de **Docker Compose Profiles** em [`docker-compose.yml`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docker-compose.yml):

### 2.1 Modo Padrão (Leve)
Inicia o API Gateway e a camada de cache/rate limit:
```bash
docker compose up -d
```
- **API Gateway (Rust):** [http://localhost:8080](http://localhost:8080)
- **Redis Cache:** `localhost:6379`

### 2.2 Modo Completo (`--profile full`) — Recomendado
Inicia toda a infraestrutura: Gateway, Redis, PostgreSQL (com bases segregadas `kudiba_auth` e `kudiba_invoicing`), KudibaAuth, KudibaInvoicing e RabbitMQ:
```bash
docker compose --profile full up -d
```
Serviços disponíveis:
- **API Gateway (Proxy Perimétrico & Swagger):** [http://localhost:8080](http://localhost:8080)
- **Swagger UI Unificado:** [http://localhost:8080/swagger-ui](http://localhost:8080/swagger-ui)
- **KudibaAuth (Identidade e Sessões):** [http://localhost:8082](http://localhost:8082)
- **KudibaInvoicing (Motor Fiscal AGT REST):** [http://localhost:9090](http://localhost:9090)
- **KudibaInvoicing (Motor Fiscal AGT gRPC):** `localhost:9091`
- **PostgreSQL 16 (Bases `kudiba_auth` e `kudiba_invoicing`):** `localhost:5432`
- **RabbitMQ Painel de Gestão:** [http://localhost:15672](http://localhost:15672) (*Utilizador:* `kudiba` / *Senha:* `kudiba_rabbit_pass`)

### 2.3 Modo Streaming (`--profile streaming`)
Adiciona o broker de eventos Kafka / Redpanda na porta `19092`:
```bash
docker compose --profile streaming up -d
```

---

## 3. Inicialização e Isolamento de Bases de Dados

O container PostgreSQL executa o script [`Backend/deploy/00-init-databases.sh`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/00-init-databases.sh) na sua primeira subida, efetuando:
1. Criação da base de dados `kudiba_auth`.
2. Criação da base de dados `kudiba_invoicing`.
3. Execução de [`02-auth-schema.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/02-auth-schema.sql) na base `kudiba_auth`:
   - Cria schemas `kudiba_core` e `kudiba_audit`.
   - Cria tabelas de utilizadores, filiais, multitenant, RBAC e refresh tokens.
   - Insere dados não privilegiados:
     - **Tenant Padrão:** `Kudiba Comércio Geral Lda` (NIF: `5001234567`, slug: `kudiba-comercio`).
     - Não cria utilizadores nem credenciais padrão; o primeiro administrador deve ser provisionado com o comando seguro do KudibaAuth.
4. Execução de [`01-invoicing-schema.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/01-invoicing-schema.sql) na base `kudiba_invoicing`:
   - Cria schemas `kudiba_core` e `kudiba_audit`.
   - Cria tabelas fiscais, gatilho de imutabilidade `trg_protect_invoices`, séries fiscais, outbox e memória de fecho Z.
   - Insere a série fiscal padrão: `2026A` para o tipo `FT`.

Em instalações que já tinham uma base de dados antes desta alteração, execute uma vez `docker compose exec -T postgres psql -U kudiba -d kudiba_auth < Backend/deploy/03-retire-demo-admin.sql`; reiniciar os containers não volta a executar automaticamente os scripts de inicialização sobre um volume existente. A rotação do `JWT_SECRET` invalida os tokens antigos e obriga a autenticação novamente.

---

## 4. Execução Local para Desenvolvimento (Bare Metal / Sem Docker)

Para iterar rapidamente no código com recarregamento a quente (*hot-reload*):

### 4.1 Subir Dependências de Infraestrutura
Inicie apenas o PostgreSQL e o Redis via Docker:
```bash
docker compose up -d postgres redis rabbitmq
```

### 4.2 Executar o KudibaAuth (Python / FastAPI)
```bash
cd Backend/services/KudibaAuth

# 1. Instalar dependências
pip install -r requirements.txt

# 2. Configurar variáveis de ambiente
export DATABASE_URL="postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_auth"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="kudiba_super_secret_jwt_key_2026_change_in_production"
export PORT="8082"
export CORS_ALLOWED_ORIGINS='["http://localhost:3000","http://localhost:5173"]'

# 3. Iniciar servidor com recarregamento automático
uvicorn src.main:app --host 0.0.0.0 --port 8082 --reload
```
Para criar o primeiro administrador do tenant:
```bash
python -m src.bootstrap_admin --tenant-id <UUID_DO_TENANT>
```
O comando pede e valida o e-mail, nome e uma password definida no momento. Em produção, configure o mesmo `JWT_SECRET` de pelo menos 32 bytes no Auth e no Gateway e defina `ENVIRONMENT=production`, `GATEWAY_ENV=production` e `CORS_ALLOWED_ORIGINS` com origens explícitas. O serviço Auth não publica a porta `8082` no host quando executado pelo Docker Compose.

### 4.3 Executar o KudibaInvoicing (Rust / Axum + Tonic)
```bash
cd Backend/services/KudibaInvoicing

# Configurar variáveis de ambiente
export DATABASE_URL="postgres://kudiba:kudiba_secret_pass@localhost:5432/kudiba_invoicing"
export PORT="9090"
export GRPC_PORT="9091"
export ENVIRONMENT="development"

# Compilar e executar
cargo run --bin kudiba-invoicing
```

### 4.4 Executar o API Gateway (Rust / Axum)
```bash
cd Backend/gateway

export PORT="8080"
export REDIS_URL="redis://localhost:6379/0"
export AUTH_SERVICE_URL="http://localhost:8082"
export FISCAL_SERVICE_URL="http://localhost:9090"
export JWT_SECRET="kudiba_super_secret_jwt_key_2026_change_in_production"

cargo run
```

---

## 5. Execução de Testes Automatizados

O ecossistema possui suítes completas de testes unitários e de integração sem dependências externas obrigatórias (usam SQLite em memória para o Python e mocks criptográficos para o Rust).

### 5.1 Testes do KudibaAuth (Python / `pytest`)
```bash
cd Backend/services/KudibaAuth
PYTHONPATH=. pytest tests/ -v
```
**Resultado esperado:** **15 testes aprovados** cobrindo hashing Argon2id, emissão/rotação/revogação de JWTs, detecção de reúso de refresh tokens, lock out por tentativas excessivas, configuração segura e endpoints HTTP.

### 5.2 Testes do KudibaInvoicing (Rust / `cargo test`)
```bash
cd Backend/services/KudibaInvoicing
cargo test
```
**Resultado esperado:** **84 testes aprovados** com 100% de sucesso cobrindo regras fiscais do Decreto Presidencial 71/25, cálculo exato de IVA/Retenção/Selo, assinatura RSA-2048, extração dos 4 caracteres de controlo, validação XSD do SAF-T e relatórios.

### 5.3 Verificação de Compilação do Gateway (Rust / `cargo check`)
```bash
cd Backend/gateway
cargo check
```

---

## 6. Variáveis de Ambiente Críticas

| Variável | Padrão Recomendado | Descrição |
| :--- | :--- | :--- |
| `JWT_SECRET` | *(string forte)* | Chave secreta compartilhada HMAC-SHA256 usada pelo Auth e pelo Gateway. |
| `DATABASE_URL` (Auth) | `postgresql+asyncpg://.../kudiba_auth` | Conexão assíncrona SQLAlchemy para o banco de dados de identidade. |
| `DATABASE_URL` (Invoicing) | `postgres://.../kudiba_invoicing` | Conexão SQLx transacional para o banco de dados fiscal. |
| `DATABASE_READ_URL` | *(opcional)* | Conexão para réplica de leitura do banco de dados fiscal (relatórios pesados). |
| `REDIS_URL` | `redis://redis:6379/0` | Conexão Redis para rate limiting e blacklist instantânea. |
| `RABBITMQ_URL` | `amqp://kudiba:pass@rabbitmq:5672` | Broker AMQP para despacho assíncrono de eventos do Outbox. |
| `ENVIRONMENT` | `development` / `production` | Em `production`, bloqueia o uso de chaves RSA efémeras e exige chaves certificadas AGT. |
| `AGT_RSA_PRIVATE_KEY_PEM` | *(PEM Base64)* | Chave privada oficial certificada pela AGT para assinar faturas. |
