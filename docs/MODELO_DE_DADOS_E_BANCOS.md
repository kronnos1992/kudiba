# Modelo de Dados e Persistência — Kudiba ERP

**Projeto:** Kudiba ERP (Bases de Dados Relacionais PostgreSQL 16)  
**Versão:** 1.1.0  
**Data:** Outubro de 2026  
**Padrão:** *Database-per-Service* (Isolamento Físico e Lógico por Microsserviço)

---

## 1. Princípio Arquitetural: Database-per-Service

No Kudiba ERP, a persistência de dados segue rigorosamente o princípio **Database-per-Service**. Nenhum microsserviço acede diretamente às tabelas ou ao banco de dados de outro serviço. Toda a troca de dados entre domínios é realizada exclusivamente através de:
1. APIs REST / gRPC síncronas.
2. Cabeçalhos de contexto confiáveis injetados pelo API Gateway (`X-Resolved-Tenant-ID`, `X-Resolved-User-ID`, `X-Resolved-Roles`, `X-Resolved-Branch-ID`).
3. Mensageria assíncrona orientada a eventos (RabbitMQ / Kafka via Transactional Outbox).

```
                     ┌────────────────────────┐
                     │     PostgreSQL 16      │
                     │  (Container / Cluster) │
                     └───────────┬────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           │                                           │
           ▼                                           ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│   DATABASE: kudiba_auth      │            │  DATABASE: kudiba_invoicing  │
│                              │            │                              │
│ Schemas:                     │            │ Schemas:                     │
│  - kudiba_core               │            │  - kudiba_core               │
│  - kudiba_audit              │            │  - kudiba_audit              │
│                              │            │                              │
│ Microsserviço Exclusivo:     │            │ Microsserviço Exclusivo:     │
│  ► KudibaAuth (Python/FastAPI│            │  ► KudibaInvoicing (Rust/Axum│
│    Porta :8082)              │            │    Porta :9090 & :9091)      │
└──────────────────────────────┘            └──────────────────────────────┘
```

---

## 2. Base de Dados: `kudiba_auth`

Gerida pelo microsserviço **KudibaAuth** ([`Backend/services/KudibaAuth`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/services/KudibaAuth)).  
Script de inicialização: [`Backend/deploy/02-auth-schema.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/02-auth-schema.sql).

### 2.1 Esquema `kudiba_core`

#### Tabela `users`
Armazena as contas de utilizador e credenciais de acesso global.
| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador único universal do utilizador. |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | E-mail corporativo normalizado. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Hash da palavra-passe gerado via Argon2id. |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | Nome completo do operador. |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Estado da conta no sistema. |
| `failed_login_attempts` | `INT` | `DEFAULT 0` | Contador de tentativas consecutivas incorretas. |
| `locked_until` | `TIMESTAMPTZ` | `NULL` | Data e hora de expiração de bloqueio por bruteforce. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Carimbo temporal de criação. |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Carimbo temporal da última atualização. |

#### Tabela `tenants`
Registo de organizações e empresas registadas no Kudiba ERP.
| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador do tenant. |
| `name` | `VARCHAR(255)` | `NOT NULL` | Razão social da empresa. |
| `slug` | `VARCHAR(100)` | `NOT NULL UNIQUE` | Identificador textual amigável (subdomínio). |
| `nif` | `VARCHAR(20)` | `NOT NULL UNIQUE` | Número de Identificação Fiscal angolano. |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Estado da subscrição da empresa. |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Carimbo de registo. |

#### Tabela `branches`
Filiais, lojas físicas e armazéns pertencentes a um tenant.
| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador da filial. |
| `tenant_id` | `UUID` | `REFERENCES tenants(id)` | Empresa proprietária da filial. |
| `code` | `VARCHAR(50)` | `NOT NULL` | Código abreviado da loja (ex.: `SEDE`, `LOJA-01`). |
| `name` | `VARCHAR(255)` | `NOT NULL` | Nome legível do estabelecimento. |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Ativação operacional da filial. |

#### Tabela `user_tenants`
Relação N:N de associação entre utilizadores, empresas e filiais padrão.
| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador do vínculo. |
| `user_id` | `UUID` | `REFERENCES users(id) ON DELETE CASCADE` | Utilizador vinculado. |
| `tenant_id` | `UUID` | `REFERENCES tenants(id) ON DELETE CASCADE` | Empresa associada. |
| `is_default` | `BOOLEAN` | `DEFAULT FALSE` | Empresa pré-selecionada no login inicial. |
| `default_branch_id` | `UUID` | `REFERENCES branches(id) ON DELETE SET NULL` | Filial preferencial. |

#### Tabelas de RBAC (`roles`, `permissions`, `role_permissions`, `role_permission_overrides`, `user_roles`)
- `roles`: Catálogo de perfis (`ADMIN`, `SYSADMIN`, `CONTABILISTA`, `OPERADOR_CAIXA`, `GESTOR_STOCK`, `GESTOR_RH`, `AUDITOR`).
- `permissions`: Permissões atómicas (`invoices:issue`, `invoices:cancel`, `fiscal:saft:export`, `pos:sale`, `users:invite`, `inventory:manage`, etc.).
- `role_permissions`: Permissões predefinidas do Kudiba ERP por perfil. Nunca são alteradas em runtime.
- `role_permission_overrides`: Personalizações das permissões de um perfil. Uma linha por âmbito, com o conjunto completo de permissões no array `permissions` (array vazio = perfil sem acessos). `tenant_id IS NULL` representa o âmbito global (definido pelo `SYSADMIN`, afecta todos os tenants); `tenant_id` preenchido representa o âmbito da empresa (definido pelo `ADMIN` da empresa). Resolução: override da empresa > override global > predefinições do ERP. Os perfis de administrador (`ADMIN`, `SYSADMIN`, `SUPER_ADMIN`) têm acesso total e não são editáveis.
- `user_roles`: Associação entre utilizador, organização (`tenant_id`) e papéis atribuídos.

#### Tabela `refresh_tokens`
Gestão segura de sessões com suporte a rotação contínua (RTR).
| Coluna | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Identificador do token. |
| `user_id` | `UUID` | `REFERENCES users(id) ON DELETE CASCADE` | Proprietário da sessão. |
| `token_hash` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Hash SHA-256 do segredo CSPRNG do token. |
| `family_id` | `UUID` | `NOT NULL` | Identificador da família de emissão (rastreia reúso). |
| `is_revoked` | `BOOLEAN` | `DEFAULT FALSE` | Indica se o token já foi consumido ou invalidado. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Data de validade da sessão (ex.: 30 dias). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Momento da emissão do par de tokens. |

### 2.2 Esquema `kudiba_audit`

#### Tabela `auth_audit_log`
Trilha imutável de eventos de autenticação e segurança.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do evento de auditoria. |
| `user_id` | `UUID NULL` | Utilizador envolvido (se conhecido). |
| `email` | `VARCHAR(255) NULL` | E-mail submetido no evento. |
| `event_type` | `VARCHAR(50) NOT NULL` | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `TOKEN_ROTATED`, `TOKEN_REUSE_DETECTED`, `LOGOUT`. |
| `ip_address` | `VARCHAR(45) NULL` | Endereço IP do cliente. |
| `user_agent` | `TEXT NULL` | Informação do navegador/aplicação cliente. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Carimbo de gravação. |

---

## 3. Base de Dados: `kudiba_invoicing`

Gerida pelo microsserviço **KudibaInvoicing** ([`Backend/services/KudibaInvoicing`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/services/KudibaInvoicing)).  
Script de inicialização: [`Backend/deploy/01-invoicing-schema.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/01-invoicing-schema.sql).

### 3.1 Esquema `kudiba_core`

#### Tabela `tenants` (Fiscal)
Registo dos dados cadastrais fiscais da empresa emitente de faturas.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do tenant fiscal. |
| `name` | `VARCHAR(255) NOT NULL` | Razão social exata registada na AGT. |
| `tax_id` | `VARCHAR(20) NOT NULL UNIQUE` | NIF da empresa. |
| `address` | `TEXT NULL` | Endereço da sede fiscal. |
| `city` | `VARCHAR(100) NULL` | Província / Cidade. |
| `tax_regime` | `VARCHAR(50) DEFAULT 'GERAL'` | `EXCLUSAO`, `SIMPLIFICADO` ou `GERAL`. |

#### Tabela `series_fiscais`
Controlo de séries documentais com bloqueio pessimista atómico (*Zero Gaps*).
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador da série fiscal. |
| `tenant_id` | `UUID REFERENCES tenants(id)` | Empresa à qual a série pertence. |
| `serie_code` | `VARCHAR(50) NOT NULL` | Código da série (ex.: `2026A`, `POS01`). |
| `doc_type` | `VARCHAR(10) NOT NULL` | `FT`, `FR`, `NC`, `ND`, `GT`, `GR`. |
| `current_sequence` | `BIGINT DEFAULT 0` | Último número emitido. Incrementado via `SELECT FOR UPDATE`. |
| `is_active` | `BOOLEAN DEFAULT TRUE` | Estado da série fiscal. |

#### Tabela `invoices`
Cabeçalho do documento fiscal emitido. Protegida por gatilho contra modificação.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador único da fatura. |
| `tenant_id` | `UUID REFERENCES tenants(id)` | Empresa emitente. |
| `serie_id` | `UUID REFERENCES series_fiscais(id)` | Série fiscal de numeração. |
| `invoice_number` | `VARCHAR(100) NOT NULL UNIQUE` | Número oficial no formato `FT 2026A/1`. |
| `doc_type` | `VARCHAR(10) NOT NULL` | Tipo documental (FT, FR, NC, ND, GT, GR). |
| `customer_tax_id`| `VARCHAR(20) NOT NULL` | NIF do adquirente (ou `999999999` para consumidor final). |
| `customer_name` | `VARCHAR(255) NOT NULL` | Nome do cliente. |
| `issue_date` | `TIMESTAMPTZ NOT NULL` | Data e hora oficial de emissão. |
| `net_total` | `NUMERIC(18,2) NOT NULL` | Total líquido (incidência). |
| `tax_total` | `NUMERIC(18,2) NOT NULL` | Total de IVA liquidado. |
| `gross_total` | `NUMERIC(18,2) NOT NULL` | Total bruto faturado. |
| `withholding_total`| `NUMERIC(18,2) DEFAULT 0` | Retenção na fonte automática de 6,5% (serviços). |
| `stamp_duty_total` | `NUMERIC(18,2) DEFAULT 0` | Imposto de selo liquidado (0,7% ou 1,0%). |
| `hash` | `VARCHAR(255) NOT NULL` | Assinatura digital RSA-2048 em Base64 encadeada. |
| `hash_control` | `VARCHAR(20) NOT NULL` | 4 caracteres de controlo AGT no formato `X;Y;W;Z`. |
| `source_doc_number`| `VARCHAR(100) NULL` | Número do documento de origem retificado (para NC e ND). |

#### Tabela `invoice_lines`
Linhas de itens faturados (produtos e serviços).
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador da linha. |
| `invoice_id` | `UUID REFERENCES invoices(id) ON DELETE RESTRICT` | Fatura proprietária. |
| `line_number` | `INT NOT NULL` | Posição sequencial do item (1, 2, 3...). |
| `item_code` | `VARCHAR(100) NOT NULL` | Código de barras ou referência SKU. |
| `description` | `TEXT NOT NULL` | Descrição comercial do produto/serviço. |
| `quantity` | `NUMERIC(14,4) NOT NULL` | Quantidade movimentada. |
| `unit_price` | `NUMERIC(18,2) NOT NULL` | Preço unitário sem IVA. |
| `tax_rate` | `NUMERIC(5,2) NOT NULL` | Taxa de IVA aplicada (14%, 7%, 5%, 0%). |
| `is_service` | `BOOLEAN DEFAULT FALSE` | Indica se é serviço sujeito a retenção na fonte. |
| `exemption_code` | `VARCHAR(10) NULL` | Código de motivo de isenção oficial AGT (`M00` a `M99`). |

#### Tabela `pos_z_reports`
Relatórios de fecho de caixa fiscal diário (Fecho Z), imutáveis e com numeração sequencial anual (`Z YYYY/NNNNNN`). Expostos ao frontend via `GET /api/v1/fiscal/pos/reports`.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do fecho fiscal. |
| `tenant_id` | `UUID REFERENCES tenants(id)` | Empresa proprietária. |
| `fiscal_year` | `INT NOT NULL` | Ano fiscal do fecho. |
| `sequence_number` | `BIGINT NOT NULL` | Sequência dentro do ano (`UNIQUE (tenant_id, fiscal_year, sequence_number)`). |
| `z_number` | `VARCHAR(64) NOT NULL` | Numeração anual no formato `Z 2026/000001` (`UNIQUE (tenant_id, z_number)`). |
| `closing_date` | `DATE NOT NULL` | Dia fiscal fechado. |
| `pos_terminal_id` | `VARCHAR(64) NULL` | Terminal/caixa que originou o fecho. |
| `opened_at` / `closed_at` | `TIMESTAMPTZ` | Início e instante de gravação do fecho. |
| `first_document_number` / `last_document_number` | `VARCHAR(64) NULL` | Primeiro e último documento do período. |
| `invoices_count` / `credit_notes_count` | `BIGINT NOT NULL` | Contagem de faturas e notas de crédito. |
| `gross_sales_total`, `discounts_total`, `credit_notes_total`, `net_sales_total`, `vat_total`, `withholding_total`, `stamp_duty_total`, `final_total` | `NUMERIC(18,4) NOT NULL` | Totalizadores fiscais do dia. |
| `taxes_summary` / `payment_methods_summary` | `JSONB NOT NULL` | Desdobramentos por taxa de imposto e por meio de pagamento. |
| `actor_user_id` | `VARCHAR(64) NULL` | Utilizador que executou o fecho. |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Momento de criação do registo. |

#### Tabela `accounting_outbox`
Padrão *Transactional Outbox* para publicação atómica e garantida de eventos.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do evento enfileirado. |
| `aggregate_type` | `VARCHAR(100) NOT NULL` | `INVOICE`, `POS_Z_REPORT`, `FISCAL_SERIES`. |
| `aggregate_id` | `UUID NOT NULL` | ID da entidade relacionada. |
| `event_type` | `VARCHAR(100) NOT NULL` | `InvoiceIssued`, `InvoiceCancelled`, `ZReportClosed`. |
| `payload` | `JSONB NOT NULL` | Dados completos serializados para consumo externo. |
| `status` | `VARCHAR(30) DEFAULT 'PENDING'` | `PENDING`, `DISPATCHED`, `FAILED`. |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | Momento em que a transação foi confirmada. |

---

## 4. Gatilhos de Imutabilidade e Auditoria Fiscal

Para satisfazer as exigências de certificação de software da AGT de proteção contra manipulação retroativa de dados contábeis, o banco de dados `kudiba_invoicing` implementa o seguinte gatilho procedural:

```sql
CREATE OR REPLACE FUNCTION kudiba_core.fn_protect_invoices()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO kudiba_audit.fiscal_audit_trail (
        action_attempted,
        doc_number,
        details
    ) VALUES (
        TG_OP,
        OLD.invoice_number,
        'Tentativa ilegal de modificar ou eliminar registo fiscal protegido pelo Decreto Presidencial 71/25.'
    );

    RAISE EXCEPTION 'VIOLACAO FISCAL AGT: Documentos fiscais sao imutaveis. Proibido UPDATE ou DELETE no registo %!', OLD.invoice_number;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_invoices
BEFORE UPDATE OR DELETE ON kudiba_core.invoices
FOR EACH ROW EXECUTE FUNCTION kudiba_core.fn_protect_invoices();
```

---

## 5. Base de Dados: `kudiba_treasury`

Base de dados isolada do microsserviço **KudibaTreasury** (`:8084`), no esquema `kudiba_treasury`. Suporta caixas físicos/virtuais, sessões de caixa e Sessões POS (turno do gestor), movimentos, contas bancárias e recibos de quitação. O schema é criado no arranque do serviço (`ensure_schema`) e espelhado em `Backend/deploy/05-treasury-schema.sql`.

### 5.1 Tipos Enumerados

| Tipo | Valores |
| :--- | :--- |
| `session_status` | `OPEN`, `CLOSED` |
| `movement_type` | `SUPPLY`, `BLEED`, `SALE_RECEIPT`, `EXPENSE` |
| `payment_method` | `NUMERARIO`, `MULTICAIXA`, `TRANSFERENCIA`, `GPO_REFERENCE` |
| `currency_code` | `AOA`, `USD`, `EUR` |

### 5.2 Tabela `cash_registers`
Caixas físicos ou virtuais (PDV).
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do caixa. |
| `tenant_id` | `UUID NOT NULL` | Empresa proprietária. |
| `branch_id` | `UUID NULL` | Filial associada. |
| `code` / `name` | `VARCHAR NOT NULL` | Código e designação do caixa (`UNIQUE (tenant_id, code)`). |
| `is_active` | `BOOLEAN NOT NULL` | Estado do caixa. |
| `created_at` / `updated_at` | `TIMESTAMPTZ NOT NULL` | Auditoria temporal. |

### 5.3 Tabela `pos_sessions`
**Sessão POS** ao nível do gestor: habilita a operação do terminal e agrega os turnos de caixa do dia.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador da Sessão POS. |
| `tenant_id` | `UUID NOT NULL` | Empresa proprietária. |
| `register_id` | `UUID REFERENCES cash_registers(id)` | Terminal associado. |
| `opened_by` | `VARCHAR(100) NOT NULL` | Gestor que abriu a sessão. |
| `opened_at` | `TIMESTAMPTZ NOT NULL` | Momento de abertura. |
| `closed_by` | `VARCHAR(100) NULL` | Gestor que encerrou a sessão. |
| `closed_at` | `TIMESTAMPTZ NULL` | Momento do fecho. |
| `closing_notes` / `notes` | `TEXT NULL` | Observações de fecho e abertura. |
| `status` | `session_status NOT NULL` | `OPEN` enquanto a operação do terminal estiver ativa. |

Índice parcial `uq_open_pos_session_per_register (tenant_id, register_id) WHERE status = 'OPEN'` garante uma única Sessão POS aberta por terminal.

### 5.3.1 Tabela `cash_sessions`
Sessões de caixa (turno do operador) abertas **dentro** de uma Sessão POS. Colunas principais: `register_id`, `pos_session_id` (FK para `pos_sessions`), `operator_user_id`, `opening_balance`, `closing_balance_counted`, `closing_balance_system`, `discrepancy` e `status`. Índice parcial `uq_open_session_per_register` garante um único turno aberto por caixa; `idx_sessions_pos` acelera a contagem de turnos por Sessão POS.

### 5.4 Tabela `cash_movements`
Movimentos de caixa que alimentam a reconciliação e o **Painel dos POS** (faturação por caixa e por usuário).
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador do movimento. |
| `tenant_id` | `UUID NOT NULL` | Empresa proprietária. |
| `session_id` | `UUID REFERENCES cash_sessions(id)` | Turno de caixa de origem. |
| `register_id` | `UUID REFERENCES cash_registers(id)` | Caixa onde ocorreu. |
| `movement_type` | `movement_type NOT NULL` | Suprimento, sangria, entrada de venda ou despesa. |
| `amount` | `NUMERIC(15,4) NOT NULL` | Montante do movimento. |
| `reason` | `TEXT NOT NULL` | Justificação. |
| `operator_user_id` | `VARCHAR(100) NOT NULL` | Operador que registou (base do desdobramento por usuário). |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Instante do movimento. |

### 5.5 Outras Tabelas
- `bank_accounts`: contas bancárias da empresa (AOA/USD/EUR) com `iban` único por tenant.
- `treasury_receipts` / `treasury_receipt_lines`: recibos de quitação (RC) e respetivas linhas de fatura liquidada.
- `treasury_sequences`: sequências atómicas de tesouraria.
- `invoice_receivables`: créditos por liquidar, espelhados a partir de eventos fiscais.
