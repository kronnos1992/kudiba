# KudibaAuth — Microsserviço de Identidade, Sessões & RBAC (Python / FastAPI)

Microsserviço de autenticação e governança de acessos de alta performance construído em **Python 3.12+ (FastAPI + AsyncIO + SQLAlchemy 2.0 async + Redis)** para o ecossistema **Kudiba ERP**. O serviço foi concebido seguindo os mesmos padrões de engenharia de software de missão crítica adotados no `KudibaInvoicing`: **Clean Architecture (Hexagonal / Ports & Adapters)**, **CQRS (Command Query Responsibility Segregation)**, **Unit of Work (UoW)** e isolamento absoluto de dados com **Database-per-Service**.

---

## 🏛️ Arquitetura do Sistema

O microsserviço organiza-se em camadas rigorosamente desacopladas:

```
Backend/services/KudibaAuth/src/
├── domain/                         # Núcleo Puro: Entidades, Value Objects e Portas (Zero frameworks)
│   ├── entities/                   # User, Tenant, Branch, UserTenant, Role, Permission, RefreshToken
│   ├── value_objects/              # Email, RoleType, KudibaClaims
│   ├── ports/                      # IUnitOfWork, IUserRepository, ITenantRepository, IUserTenantRepository,
│   │                               # IRefreshTokenRepository, IPasswordHasher, ITokenService, ICacheService, IAuditRepository
│   ├── services/                   # AccountSecurityPolicy (anti-bruteforce), RbacEvaluator
│   └── error.py                    # Exceções semânticas de domínio (mapeadas para RFC 7807)
│
├── application/                    # Casos de Uso & Orquestração (CQRS)
│   ├── commands/                   # AuthenticateUser, RotateRefreshToken, LogoutUser, SwitchTenant,
│   │                               # InviteUser, UpdateUserRoles
│   ├── queries/                    # GetUserProfile, ListTenantMembers, ListBranches, ListRoles
│   └── dto.py                      # Contratos de entrada e saída (Pydantic V2)
│
├── infrastructure/                 # Adaptadores de Tecnologia e I/O
│   ├── persistence/                # SqlAlchemyUnitOfWork, SqlAlchemyUserRepository, SqlAlchemyTenantRepository,
│   │                               # SqlAlchemyUserTenantRepository, SqlAlchemyRefreshTokenRepository,
│   │                               # SqlAlchemyAuditRepository, models.py (Mapeamento ORM assíncrono)
│   ├── security/                   # Argon2PasswordHasher (Argon2id OWASP), JwtTokenService (HMAC-SHA256)
│   └── cache/                      # RedisCacheService (blacklist imediata jwt:blacklist:{jti})
│
├── presentation/                   # Adaptadores Primários de Entrada
│   └── http/                       # routes.py (FastAPI), deps.py (Injeção de dependências), error_handlers.py
│
├── state.py                        # Contêiner de Injeção de Dependências (AppState) espelhando state.rs do Rust
└── main.py                         # Ponto de entrada FastAPI com lifespan, CORS e documentação OpenAPI
```

---

## ⚡ Capacidades e Mecanismos de Segurança

### 1. Criptografia de Palavras-passe com Argon2id
- Implementado em [`Argon2PasswordHasher`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/services/KudibaAuth/src/infrastructure/security/argon2_hasher.py) utilizando `argon2-cffi`.
- Parâmetros alinhados com as recomendações de alta segurança do OWASP:
  - Custo de memória: 64 MB
  - Custo de tempo (iterações): 3
  - Paralelismo: 4 threads
- Altamente resistente a ataques de força bruta acelerados por GPU ou ASIC.

### 2. Emissão de Tokens de Acesso com `KudibaClaims`
- Assinatura simétrica HMAC-SHA256 utilizando a chave secreta compartilhada com o API Gateway (`JWT_SECRET`).
- Emissão de claims padronizados no padrão `KudibaClaims`:
  - `sub`: ID do utilizador (UUID).
  - `tenant_id`: ID da organização ativa.
  - `tenant_slug`: Identificador slug do tenant.
  - `branch_id`: ID da filial ativa vinculada à sessão.
  - `roles`: Vetor de perfis do utilizador (`ADMIN`, `CONTABILISTA`, `OPERADOR_CAIXA`, etc.).
  - `permissions`: Vetor de permissões atómicas concedidas.
  - `exp`: Expiração curta (15 minutos) para mitigar riscos de roubo de credencial.
  - `jti`: Identificador único do token para suporte a revogação instantânea.

### 3. Rotação Contínua de Refresh Tokens (RTR) e Detecção de Reúso
- Refresh tokens são sequências criptográficas aleatórias (CSPRNG) de uso único armazenadas no banco via hash SHA-256.
- A cada chamada de renovação (`POST /auth/refresh`), o refresh token anterior é marcado como revogado e um novo par é gerado.
- **Detecção de Reúso (Family Revocation):** Se um refresh token já revogado for submetido, o sistema deteta uma tentativa de violação de sessão, invalida imediatamente todos os tokens emitidos sob a mesma família (`family_id`) e exige nova autenticação formal.

### 4. Revogação Instantânea via Blacklist no Redis
- Quando o utilizador faz logout (`POST /auth/logout`):
  1. O refresh token é revogado no banco de dados `kudiba_auth`.
  2. O identificador do JWT (`jti`) é gravado no Redis com a chave `jwt:blacklist:{jti}` com tempo de vida (TTL) correspondente ao tempo restante para expiração do access token.
  3. O API Gateway perimétrico em Rust consulta essa chave no Redis em $O(1)$, bloqueando imediatamente qualquer nova requisição feita com o token sem esperar pelos 15 minutos de expiração.

### 5. Multi-Tenancy e Alternância a Quente (*Tenant Switching*)
- Um utilizador pode ter vínculos com múltiplas empresas e filiais (`user_tenants`).
- O endpoint `POST /auth/switch-tenant` permite trocar a empresa ativa em tempo de execução, reavaliando perfis e permissões da nova organização e emitindo novos tokens sem exigir que o utilizador insira a senha novamente.

### 6. Isolamento com Base de Dados Dedicada (`kudiba_auth`)
- Em cumprimento ao padrão **Database-per-Service**, o KudibaAuth conecta-se exclusivamente ao banco `kudiba_auth` no PostgreSQL 16.
- Scripts de criação e migração: [`Backend/deploy/02-auth-schema.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/02-auth-schema.sql).

---

## 📋 Catálogo de Endpoints HTTP

| Método | Endpoint | Descrição | Permissão / Autenticação |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Login com e-mail e senha $\rightarrow$ Retorna Access Token + Refresh Token | Pública |
| `POST` | `/auth/refresh` | Renovação do Access Token com rotação automática do Refresh Token | Pública (com refresh token) |
| `POST` | `/auth/logout` | Revogação de sessão no banco e adição do JTI na blacklist do Redis | Autenticado |
| `POST` | `/auth/switch-tenant` | Alterna a empresa ativa da sessão sem exigir nova senha | Autenticado |
| `GET` | `/auth/me` | Retorna o perfil completo do utilizador logado e empresas associadas | Autenticado |
| `GET` | `/auth/users` | Lista os membros e colaboradores da empresa atual | `users:read` ou `ADMIN` |
| `POST` | `/auth/users/invite` | Convida/adiciona colaborador e atribui perfis RBAC | `users:invite` ou `ADMIN` |
| `PUT` | `/auth/users/{id}/roles` | Atualiza os perfis RBAC atribuídos a um colaborador | `users:manage_roles` ou `ADMIN` |
| `GET` | `/health` | Healthcheck de liveness (`UP`) | Pública |
| `GET` | `/ready` | Readiness probe (valida conexão com PostgreSQL e Redis) | Pública |

---

## 🛠️ Execução e Testes

### 1. Instalação e Execução Local
```bash
cd Backend/services/KudibaAuth

# Instalar dependências runtime e de teste
pip install -e ".[test]"

# Configurar variáveis de ambiente
export DATABASE_URL="postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_auth"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="kudiba_super_secret_jwt_key_2026_change_in_production"
export PORT="8082"

# Iniciar Uvicorn ASGI com reload
uvicorn src.main:app --host 0.0.0.0 --port 8082 --reload
```

### 2. Documentação Interativa
- **Swagger UI:** [http://localhost:8082/docs](http://localhost:8082/docs)
- **ReDoc:** [http://localhost:8082/redoc](http://localhost:8082/redoc)

### 3. Execução da Suíte de Testes Automatizados
```bash
PYTHONPATH=. pytest tests/ -v
```
**Resultado:** **18 testes aprovados** cobrindo hashing Argon2id, emissão/rotação/revogação de JWTs, detecção de reúso de refresh tokens, validação de tenants, proteção do último administrador, convites/auditoria, configuração segura e endpoints HTTP.

Não existe conta nem palavra-passe padrão. Para provisionar o primeiro administrador do tenant, execute `python -m src.bootstrap_admin --tenant-id <UUID>` com o serviço configurado para aceder ao PostgreSQL. O comando recolhe as credenciais interactivamente e só cria o administrador quando o tenant ainda não tem um.
