# =============================================================================
# Kudiba ERP - Makefile raiz
# =============================================================================
# Uso: make <alvo>   (ex.: make help, make test, make up-local)
# Requer GNU Make (WSL/Linux/macOS). No Windows usa-se via WSL.
# =============================================================================

SHELL := /bin/bash

CARGO_MANIFEST     := Backend/Cargo.toml
GATEWAY_MANIFEST   := Backend/gateway/Cargo.toml
INVOICING_MANIFEST := Backend/services/KudibaInvoicing/Cargo.toml
INVENTORY_MANIFEST := Backend/services/KudibaInventory/Cargo.toml
AUTH_DIR           := Backend/services/KudibaAuth
PAYROLL_DIR        := Backend/services/KudibaPayroll
INTEGRATIONS_DIR   := Backend/services/KudibaIntegrations
LOGS_DIR           := .run_logs
COMPOSE            := docker-compose

.DEFAULT_GOAL := help

# -----------------------------------------------------------------------------
# Ajuda
# -----------------------------------------------------------------------------
.PHONY: help
help: ## Mostra esta ajuda
	@echo "Kudiba ERP - alvos disponiveis:"
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
.PHONY: build build-release clean
build: ## Compila o workspace Rust (debug)
	cargo build --workspace --manifest-path $(CARGO_MANIFEST)

build-release: ## Compila o workspace Rust (release)
	cargo build --workspace --release --manifest-path $(CARGO_MANIFEST)

clean: ## Remove artefactos de build do Cargo
	cargo clean --manifest-path $(CARGO_MANIFEST)

# -----------------------------------------------------------------------------
# Qualidade de codigo (CI)
# -----------------------------------------------------------------------------
.PHONY: fmt fmt-check clippy lint check
fmt: ## Formata todo o workspace Rust
	cargo fmt --manifest-path $(CARGO_MANIFEST) --all

fmt-check: ## Verifica a formatacao (bloqueante no CI)
	cargo fmt --manifest-path $(CARGO_MANIFEST) --all -- --check

clippy: ## Corre o Clippy com warnings como erros
	cargo clippy --manifest-path $(CARGO_MANIFEST) --workspace --all-targets -- -D warnings

lint: fmt-check clippy ## fmt-check + clippy

check: lint test ## Lint + todos os testes

# -----------------------------------------------------------------------------
# Testes
# -----------------------------------------------------------------------------
.PHONY: test test-rust test-gateway test-invoicing test-inventory test-auth test-payroll test-integrations
test: test-rust test-auth test-payroll test-integrations ## Corre todos os testes (Rust + Python)

test-rust: ## Testes do workspace Rust (Gateway + Invoicing + Inventory)
	cargo test --workspace --manifest-path $(CARGO_MANIFEST)

test-gateway: ## Testes do Gateway
	cargo test --manifest-path $(GATEWAY_MANIFEST)

test-invoicing: ## Testes do KudibaInvoicing
	cargo test --manifest-path $(INVOICING_MANIFEST)

test-inventory: ## Testes do KudibaInventory
	cargo test --manifest-path $(INVENTORY_MANIFEST)

test-auth: ## Testes do KudibaAuth (pytest)
	cd $(AUTH_DIR) && PYTHONPATH=. python3 -m pytest tests/ -q

test-payroll: ## Testes do KudibaPayroll (pytest)
	cd $(PAYROLL_DIR) && PYTHONPATH=. python3 -m pytest tests/ -q

test-integrations: ## Testes do KudibaIntegrations (pytest)
	cd $(INTEGRATIONS_DIR) && PYTHONPATH=. python3 -m pytest tests/ -q

test-e2e: ## Corre o teste de integracao ponta-a-ponta (E2E smoke test via Gateway)
	bash scripts/test-e2e-flow.sh

# -----------------------------------------------------------------------------
# KudibaAuth (Python)
# -----------------------------------------------------------------------------
.PHONY: auth-install auth-run
auth-install: ## Instala as dependencias do KudibaAuth (com extra de testes)
	cd $(AUTH_DIR) && python3 -m pip install -e ".[test]"

auth-run: ## Corre o KudibaAuth isolado (uvicorn :8082)
	cd $(AUTH_DIR) && PYTHONPATH=. ENVIRONMENT=development \
		python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8082

# -----------------------------------------------------------------------------
# KudibaPayroll (Python)
# -----------------------------------------------------------------------------
.PHONY: payroll-install payroll-run
payroll-install: ## Instala as dependencias do KudibaPayroll (com extra de testes)
	cd $(PAYROLL_DIR) && python3 -m pip install -e ".[test]"

payroll-run: ## Corre o KudibaPayroll isolado (uvicorn :8086)
	cd $(PAYROLL_DIR) && PYTHONPATH=. ENVIRONMENT=development \
		python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8086

# -----------------------------------------------------------------------------
# KudibaIntegrations (Python)
# -----------------------------------------------------------------------------
.PHONY: integrations-install integrations-run
integrations-install: ## Instala as dependencias do KudibaIntegrations (com extra de testes)
	cd $(INTEGRATIONS_DIR) && python3 -m pip install -e ".[test]"

integrations-run: ## Corre o KudibaIntegrations isolado (uvicorn :8087)
	cd $(INTEGRATIONS_DIR) && PYTHONPATH=. ENVIRONMENT=development \
		python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8087

# -----------------------------------------------------------------------------
# Servidores locais (fora do Docker)
# -----------------------------------------------------------------------------
.PHONY: up-local down-local restart-local status-local logs-local
up-local: ## Arranca Auth + Invoicing + Inventory + Treasury + Accounting + Payroll + Integrations + Gateway nativos
	bash scripts/start-local.sh

down-local: ## Para os servidores locais nativos
	bash scripts/stop-local.sh

restart-local: down-local up-local ## Reinicia os servidores locais

status-local: ## Mostra o estado dos servidores locais
	bash scripts/status-local.sh

logs-local: ## Segue os logs locais (.run_logs/*.log)
	tail -n 50 -f $(LOGS_DIR)/kudiba-auth.log $(LOGS_DIR)/kudiba-invoicing.log $(LOGS_DIR)/kudiba-inventory.log $(LOGS_DIR)/kudiba-payroll.log $(LOGS_DIR)/kudiba-integrations.log $(LOGS_DIR)/kudiba-gateway.log

# -----------------------------------------------------------------------------
# Docker
# -----------------------------------------------------------------------------
.PHONY: infra docker-up docker-down docker-ps docker-logs docker-build
infra: ## Sobe apenas Postgres + Redis em Docker (para uso com up-local)
	$(COMPOSE) up -d postgres gateway-redis

docker-up: ## Sobe a stack completa (perfil full) com build
	$(COMPOSE) --profile full up -d --build

docker-down: ## Para e remove a stack
	$(COMPOSE) --profile full down

docker-ps: ## Lista os contentores
	$(COMPOSE) ps

docker-logs: ## Segue os logs da stack Docker
	$(COMPOSE) logs -f

docker-build: ## Reconstroi as imagens sem arrancar
	$(COMPOSE) --profile full build

# -----------------------------------------------------------------------------
# Atalhos
# -----------------------------------------------------------------------------
.PHONY: ci dev
ci: fmt-check clippy test-rust test-auth test-payroll test-integrations ## Espelha os passos de CI
dev: infra up-local ## Sobe infra (Docker) + servidores locais nativos
