# Arquitetura de Integração & Mensageria - ERP Kudiba

**Sistema:** ERP Kudiba (Cloud-Native & Edge-Ready)  
**Conformidade:** Decreto Presidencial n.º 71/25 de Angola (AGT)  
**Versão:** 1.0.0  

---

## 1. Visão Geral da Topologia

O ecossistema Kudiba organiza a comunicação entre componentes em três camadas bem desacopladas:

```
[ FRONTEND / POS CLIENTES ]
             │
             │ HTTPS / WSS (REST / OpenAPI 3.1)
             ▼
┌────────────────────────────────────────────────────────┐
│            1. API GATEWAY PERIMÉTRICO (RUST)           │
│  - Porta 8080                                          │
│  - Middlewares: Tenant, Rate Limit, Auth, Contingência │
│  - Cache Perimétrico: Redis 7.4 (Porta 6379)           │
│  - Swagger UI: /swagger-ui                             │
└────────────────────────────────────────────────────────┘
             │
             ├───────────────► 2. COMUNICAÇÃO SÍNCRONA INTERNA (gRPC)
             │                 Fiscal Engine (Porta 9090)
             │                 - Assinatura Digital RSA-SHA256
             │                 - Encadeamento de Hashes AGT
             │
             ▼
┌────────────────────────────────────────────────────────┐
│            3. CORE API SERVER (GO / PYTHON)            │
│  - Porta 8081                                          │
│  - Gestão Comercial, Séries, Clientes, Inventário      │
└────────────────────────────────────────────────────────┘
             │
             ├───────────────► 4. BASE DE DADOS TRANSACIONAL (POSTGRESQL 16+)
             │                 - Schemas: kudiba_core, kudiba_audit
             │                 - Triggers de Imutabilidade Legal (Decreto 71/25)
             │
             ├───────────────► 5. FILAS DE TRABALHO ASSÍNCRONAS (RABBITMQ)
             │                 - Fila: kudiba.saft.generation (Geração SAF-T)
             │                 - Fila: kudiba.notifications (Email / SMS)
             │                 - Fila: kudiba.payments.webhook (Multicaixa / EMIS)
             │                 - Painel Web: http://localhost:15672
             │
             └───────────────► 6. EVENT STREAMING & AUDIT TRAIL (KAFKA / REDPANDA)
                               - Tópico: kudiba.invoicing.events (Particionado por Tenant)
                               - Tópico: kudiba.pos.sync (Lotes de sincronização offline)
                               - Broker: localhost:19092
```

---

## 2. Contratos gRPC / Protocol Buffers (`proto/`)

Os contratos gRPC estão formalizados em `proto/`:

- **[`proto/fiscal/v1/fiscal_engine.proto`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/proto/fiscal/v1/fiscal_engine.proto)**:
  - `SignDocument`: Cálculo do Hash SHA-256 e assinatura RSA 2048-bit com os 4 caracteres de validação impressos.
  - `VerifySignature`: Validação perimétrica de integridade.
  - `ValidateSeriesSequence`: Garantia de ausência de lacunas (*gaps*) em séries.
  - `TriggerSaftGeneration`: Envio da tarefa de exportação do SAF-T (AO).

- **[`proto/events/v1/events.proto`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/proto/events/v1/events.proto)**:
  - `InvoiceIssuedEvent`: Evento canónico emitido a cada documento faturado.
  - `StockMovementEvent`: Ajustes e movimentações de inventário.
  - `PaymentConfirmedEvent`: Confirmações de pagamento (GPO / Multicaixa Express).
  - `AgtContingencyAlertEvent`: Alerta de dias acumulados em contingência (bloqueio mandatado após 60 dias).

---

## 3. Gestão de Perfis no Docker Compose

Para evitar consumir recursos desnecessários na máquina local, o `docker-compose.yml` utiliza **Profiles**:

### Modo Padrão (Leve): Gateway + Redis
Sobe apenas a camada perimétrica de alta performance:
```bash
docker compose up -d
```
- API Gateway: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui`
- Redis: `localhost:6379`

### Modo Completo (`--profile full`): Todos os Serviços
Sobe Gateway, Redis, Core API, Fiscal Engine, PostgreSQL 16 e RabbitMQ:
```bash
docker compose --profile full up -d
```
- **PostgreSQL 16**: `localhost:5432` (Base: `kudiba_erp`, User: `kudiba`, Pass: `kudiba_secret_pass`)
- **RabbitMQ**: AMQP `localhost:5672` | Painel de Gestão: `http://localhost:15672` (User: `kudiba`, Pass: `kudiba_rabbit_pass`)
- **Core API**: `http://localhost:8081`
- **Fiscal Engine**: `http://localhost:9090`

### Modo Streaming (`--profile streaming`): Event Log Kafka / Redpanda
```bash
docker compose --profile streaming up -d
```
- Kafka Broker: `localhost:19092`
- Redpanda Admin: `localhost:9644`

---

## 4. Banco de Dados & Conformidade Tributária AGT

O script [`Backend/deploy/init-db.sql`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/deploy/init-db.sql) é montado automaticamente no PostgreSQL:
1. **Multi-Tenancy**: Esquema `kudiba_core` com tabela `tenants`.
2. **Séries Documentais**: Tabela `series_fiscais` com validação de sequência estrita.
3. **Imutabilidade Mandatada**: A trigger `trg_protect_invoices` rejeita qualquer tentativa física de `UPDATE` ou `DELETE` em faturas emitidas, registando imediatamente a tentativa na tabela `kudiba_audit.fiscal_audit_trail`.
