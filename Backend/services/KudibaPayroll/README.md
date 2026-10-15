# KudibaPayroll — Microsserviço de Recursos Humanos e Processamento Salarial

Microsserviço de Recursos Humanos, Cadastro de Colaboradores, Contratos de Trabalho, Processamento Salarial, Retenção de IRT, Encargos de Segurança Social (INSS), Ficheiro Bancário de Remessa PS2 e Integração Contabilística em Partidas Dobradas.

## Normas e Legislação de Angola Suportadas

- **Lei Geral do Trabalho (Lei n.º 12/23)**:
  - Horários, tipologias contratuais e remuneração base.
  - Horas extraordinárias a 50% (dias úteis diurnos) e 75% (nocturnos e dias de descanso).
  - Cálculo de valor-hora padrão com base no divisor de 173.33 horas mensais (semana de 40 horas).
- **Código do IRT (Lei n.º 18/14 e alteração pela Lei n.º 28/20)**:
  - Tabela progressiva com 11 escalões de rendimento.
  - Isenção até 100.000,00 Kz.
  - Taxas marginais de 13% até 25% com parcelas fixas dedutíveis.
- **Protecção Social Obrigatória (Decreto Presidencial n.º 227/18)**:
  - Retenção do trabalhador de 3%.
  - Encargo patronal da entidade empregadora de 8%.
  - Isenção fiscal e contributiva dos subsídios de alimentação e transporte até 30.000,00 Kz cada.
- **Normas Bancárias de Compensação (EMIS / Bancos Comerciais de Angola)**:
  - Geração de ficheiro ASCII de transferência em lote no formato padrão PS2 / SEPA ASCII (registros tipo 0, 1 e 9).
- **Plano Geral de Contabilidade (PGC - Decreto n.º 82/01)**:
  - Integração via eventos RabbitMQ (`payroll.period.closed`) com equação equilibrada $\sum \text{Débito} = \sum \text{Crédito}$.

## Execução de Testes

```bash
cd Backend/services/KudibaPayroll
PYTHONPATH=. python3 -m pytest tests/ -q
```
