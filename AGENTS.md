# AGENTS.md

Guia para agentes de código que trabalham neste repositório.

## Estrutura

- `Backend/gateway/` — API Gateway perimétrico em Rust (Axum), faz auth JWT, rate-limit e reverse proxy.
- `Backend/services/KudibaInvoicing/` — microserviço de faturação em Rust (workspace Cargo).
- `Backend/services/KudibaInventory/` — microserviço de inventário, armazéns e catálogo em Rust (workspace Cargo).
- `Backend/services/KudibaTreasury/` — microserviço de tesouraria, caixa e pagamentos em Rust (workspace Cargo).
- `Backend/services/KudibaAuth/` — microserviço de Autenticação & RBAC em **Python/FastAPI** (Clean Architecture). NÃO faz parte do workspace Rust.
- `Backend/services/KudibaPayroll/` — microserviço de Recursos Humanos, contratos, folha salarial (IRT/INSS), férias e assiduidade em **Python/FastAPI** (Clean Architecture + CQRS). NÃO faz parte do workspace Rust.
- `Backend/services/KudibaBackoffice/` — microserviço de Backoffice B2B: clientes subscritores, licenças anuais por módulos e espelho da licença em `kudiba_core.tenants`, em **Python/FastAPI** (Clean Architecture). NÃO faz parte do workspace Rust.
- `Backend/deploy/` — scripts SQL de inicialização das bases de dados.
- `Frontend/`, `proto/`, `docs/`, `scripts/` — ver README raiz.

## Comandos

### Rust (Gateway + Invoicing + Inventory + Treasury)

```bash
# Build do workspace completo
cargo build --workspace --manifest-path Backend/Cargo.toml

# Testes do Gateway
cargo test --manifest-path Backend/gateway/Cargo.toml

# Testes do Invoicing
cargo test --manifest-path Backend/services/KudibaInvoicing/Cargo.toml

# Testes do Inventory
cargo test --manifest-path Backend/services/KudibaInventory/Cargo.toml

# Testes do Treasury
cargo test --manifest-path Backend/services/KudibaTreasury/Cargo.toml

# Lint / formato (padrão do CI)
cargo fmt --manifest-path Backend/Cargo.toml --all -- --check
cargo clippy --workspace --manifest-path Backend/Cargo.toml -- -D warnings
```

`protoc` é necessário para compilar os serviços que usam gRPC.

### Python (KudibaAuth + KudibaPayroll + KudibaIntegrations + KudibaBackoffice)

```bash
# KudibaAuth
cd Backend/services/KudibaAuth
PYTHONPATH=. python3 -m pytest tests/ -q

# KudibaPayroll
cd Backend/services/KudibaPayroll
PYTHONPATH=. python3 -m pytest tests/ -q

# KudibaBackoffice
cd Backend/services/KudibaBackoffice
PYTHONPATH=. python3 -m pytest tests/ -q
```

Requer as dependências do `pyproject.toml` (incluindo o extra `test`: `pytest`, `pytest-asyncio`, `httpx`). Instalação: `make auth-install` / `make payroll-install` / `make backoffice-install`. Ou corre via Makefile: `make test-auth`, `make test-payroll`, `make test-backoffice`.

## Notas de ambiente (Windows)

A toolchain Rust por omissão nesta máquina é `stable-x86_64-pc-windows-gnu`, mas a instalação **está incompleta**: falta o `as.exe` (assembler), pelo que o `dlltool` falha com `CreateProcess` ao linkar.

Em vez de usar o default GNU, compilar/testar com **MSVC** a partir do Visual Studio Developer Command Prompt:

```bat
call "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
cargo +stable-x86_64-pc-windows-msvc test
```

O VS Community 18 fornece o `link.exe` necessário. Não é preciso alterar a toolchain default do rustup.

## Convenções

- Não adicionar comentários no código, salvo quando estritamente necessário.
- Seguir a arquitetura existente (Clean Architecture / Ports & Adapters) e os padrões dos ficheiros vizinhos.
- Só fazer commit quando explicitamente solicitado.
