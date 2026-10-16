# KudibaIntegrations — Integration Hub Transversal

Microsserviço responsável por integrar o Kudiba ERP com sistemas externos (ex.: relógios de ponto, ERPs de terceiros, plataformas sectoriais) através de **configuração por backoffice, sem necessidade de escrever novo código**.

O hub recebe dados externos, aplica um **mapeamento configurável** para o modelo canónico do ERP e publica os eventos resultantes no barramento RabbitMQ (`fiscal.events`), que os serviços-alvo consomem.

## Conectores Suportados

| Conector         | Descrição                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| `WEBHOOK`        | Recebe payloads empurrados pelo sistema externo num endpoint dedicado.    |
| `REST_PULL`      | Consulta periodicamente uma API REST externa (`schedule_interval_seconds`). |
| `FILE_IMPORT`    | Importa ficheiros `CSV` ou `FIXED_WIDTH` enviados por upload.             |

Formatos de dados: `JSON`, `CSV`, `FIXED_WIDTH`.
Autenticação de saída (REST): `NONE`, `API_KEY`, `BASIC`, `BEARER`.

## Modelo de Configuração

- **Endpoint**: representa a ligação a um sistema externo (tipo de conector, URL/segredo, formato, agendamento).
- **Mapping**: liga um endpoint a um evento canónico do ERP. Define `field_mappings` (lista de especificações `target`/`source`/`type`/`format`/`transform`/`value_map`...), `static_payload`, `dedup_fields` e `target_routing_key`.
- **Run**: registo de auditoria de cada execução (webhook, agendada ou manual) com contadores de recebidos/sucesso/falha/ignorados.

## Eventos Publicados

Os eventos canónicos são publicados no exchange topic `fiscal.events` com a routing key definida no mapping (ex.: `payroll.event.attendance.recorded`). Envelope:

```json
{
  "event_id": "uuid",
  "tenant_id": "uuid",
  "event_type": "attendance.recorded",
  "source": "Relógio de Ponto",
  "source_system_type": "ATTENDANCE",
  "occurred_at": "2026-01-01T08:00:00+00:00",
  "payload": { "employee_code": "EMP001", "punched_at": "...", "direction": "IN" }
}
```

## API HTTP

Backoffice (protegido por JWT, prefixo `/api/v1/integrations`):

- `GET|POST /endpoints`
- `GET|PUT|DELETE /endpoints/{endpoint_id}`
- `POST /endpoints/{endpoint_id}/mappings`
- `GET /mappings` · `PUT|DELETE /mappings/{mapping_id}`
- `GET /runs`
- `POST /endpoints/{endpoint_id}/run` (executa o pull agora)
- `POST /endpoints/{endpoint_id}/import` (body raw com o ficheiro)

Webhook (público, sem JWT):

- `POST /api/v1/integrations/webhooks/{webhook_key}`

Operacional:

- `GET /health` · `GET /ready`

## Configuração Principal

| Variável                       | Predefinição            | Descrição                                            |
| ------------------------------ | ----------------------- | ---------------------------------------------------- |
| `PORT`                         | `8087`                  | Porta HTTP.                                          |
| `DATABASE_URL`                 | Postgres local          | Base de dados `kudiba_integrations`.                 |
| `RABBITMQ_URL`                 | `amqp://…@localhost`    | Broker de eventos.                                   |
| `EVENT_EXCHANGE`               | `fiscal.events`         | Exchange topic de destino.                           |
| `INTEGRATION_ENCRYPTION_KEY`   | (fallback `JWT_SECRET`) | Chave Fernet para cifrar credenciais em BD.          |
| `SCHEDULER_ENABLED`            | `true`                  | Activa o agendador de pulls intervalares.            |
| `SCHEDULER_TICK_SECONDS`       | `30`                    | Período de verificação do agendador.                 |

## Execução de Testes

```bash
cd Backend/services/KudibaIntegrations
PYTHONPATH=. python3 -m pytest tests/ -q
```

## Execução Local

```bash
cd Backend/services/KudibaIntegrations
PYTHONPATH=. ENVIRONMENT=development python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8087
```
