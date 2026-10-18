# KudibaBackoffice

Microsserviço de Backoffice B2B (Python/FastAPI, Clean Architecture) responsável
pela gestão de clientes corporativos que subscrevem o Kudiba ERP e das suas
licenças anuais.

## Responsabilidades

- CRUD de clientes (empresas subscritoras) com contacto comercial.
- Emissão e renovação de licenças anuais, com **módulos escolhidos pelo cliente**
  (`invoicing`, `inventory`, `treasury`, `payroll`, `accounting`, `integrations`).
- Provisionamento do tenant correspondente no `kudiba_auth`
  (`kudiba_core.tenants` + filial SEDE + administrador opcional).
- Sincronização do espelho de licença no tenant
  (`license_valid_until`, `subscribed_modules`, `status`), consumido pelo
  KudibaAuth no login e pelo API Gateway no encaminhamento por módulo.
- Suspensão / reactivação de clientes.

## Base de dados

- `kudiba_backoffice` — `clients`, `licenses` (fonte de verdade das renovações).
- `kudiba_auth` — escrita pontual no `kudiba_core.tenants` (provisionamento +
  espelho de licença). Ver `Backend/deploy/09-backoffice-schema.sql`.

## Endpoints (`/api/v1/backoffice`)

Todos exigem JWT válido de um **superadmin** da plataforma (verificado no
`kudiba_core.users`).

| Método | Rota                              | Descrição                          |
|--------|-----------------------------------|------------------------------------|
| GET    | `/modules`                        | Catálogo de módulos subscritíveis  |
| GET    | `/clients`                        | Lista clientes + licença actual    |
| POST   | `/clients`                        | Cria cliente, tenant e 1ª licença  |
| GET    | `/clients/{id}`                   | Detalhe + histórico de licenças    |
| PATCH  | `/clients/{id}`                   | Actualiza contacto do cliente      |
| POST   | `/clients/{id}/licenses`          | Renova (novo período anual)        |
| POST   | `/clients/{id}/suspend`           | Suspende cliente/licença           |
| POST   | `/clients/{id}/activate`          | Reactiva cliente/licença           |

## Arranque local

```bash
PYTHONPATH=. DATABASE_URL=postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_backoffice \
AUTH_DATABASE_URL=postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_auth \
JWT_SECRET=kudiba_jwt_secret_development_key_change_in_production_2026 \
python3 -m uvicorn src.main:app --host 127.0.0.1 --port 8088
```

## Testes

```bash
PYTHONPATH=. python3 -m pytest tests/ -q
```
