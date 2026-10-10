# Portal de Documentação Técnica — Kudiba ERP

**Bem-vindo à documentação oficial de engenharia do Kudiba ERP.**  
Este diretório reúne as especificações de arquitetura, manuais operacionais, modelos de dados, catálogos de APIs e normas de conformidade fiscal para o mercado de software empresarial da República de Angola.

---

## 🗺️ Mapa de Documentação por Perfil de Leitor

```
                             PORTAL DE DOCUMENTAÇÃO
                                       │
     ┌──────────────────┬──────────────┴───────────────┬──────────────────┐
     ▼                  ▼                              ▼                  ▼
Desenvolvedores    Desenvolvedores               DevOps & Cloud      Auditores &
Backend (Rust/Py)  Frontend & Mobile             Engineers           Contabilistas
     │                  │                              │                  │
     ├─ Arquitetura     ├─ Catálogo de APIs            ├─ Manual Deploy   ├─ Decreto 71/25
     ├─ Modelos Dados   ├─ Swagger UI                  ├─ Docker Profiles ├─ Regras AGT
     └─ Clean Arch      └─ Exemplos REST               └─ Env Vars        └─ SAF-T v1.01
```

---

## 📚 Índice de Documentos

| Documento | Assunto e Conteúdo Principal | Formato |
| :--- | :--- | :--- |
| [**ARQUITETURA_DO_SISTEMA.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/ARQUITETURA_DO_SISTEMA.md) | **Arquitetura Global e Padrões de Projeto**: Visão end-to-end, Clean Architecture, CQRS, Unit of Work, Zero-Trust perimétrico, Gateway Rust, KudibaAuth em Python e KudibaInvoicing em Rust. | Markdown |
| [**MODELO_DE_DADOS_E_BANCOS.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/MODELO_DE_DADOS_E_BANCOS.md) | **Engenharia de Dados e Database-per-Service**: Schemas `kudiba_auth` e `kudiba_invoicing`, dicionário de tabelas, gatilhos de imutabilidade fiscal AGT e auditoria. | Markdown |
| [**CATALOGO_DE_APIS.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/CATALOGO_DE_APIS.md) | **Catálogo Unificado de APIs e Contratos**: Especificação detalhada de endpoints REST (`/auth/*`, `/api/v1/fiscal/*`), contratos gRPC Protobuf (`kudiba.fiscal.v1`), cabeçalhos `X-Resolved-*` e erros RFC 7807. | Markdown |
| [**MANUAL_DE_DESENVOLVIMENTO_E_DEPLOY.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/MANUAL_DE_DESENVOLVIMENTO_E_DEPLOY.md) | **Manual de Desenvolvimento, Testes e Deploy**: Execução via Docker Compose (perfis `default`, `full`, `streaming`), desenvolvimento bare-metal, suítes de testes (`pytest` e `cargo test`), credenciais e `.env`. | Markdown |
| [**PROCESSO_E_PASSOS_ARQUITETURA.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/PROCESSO_E_PASSOS_ARQUITETURA.md) | **Registo Técnico de Evolução e Diagnósticos**: Histórico de decisões técnicas, superação de desafios (WSL2, Rust Edition 2024, rotas Axum 0.8), implementação dos microsserviços e métricas. | Markdown |
| [**ESPECIFICACAO_TECNICA_ERP.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/ESPECIFICACAO_TECNICA_ERP.md) | **Especificação Técnica Mestre do ERP**: Visão executiva inicial, proposta de valor em relação aos ERPs legados (Primavera, PHC, Sage) e roadmap conceitual. | Markdown |
| [**Decreto Presidencial n.º 71/25**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/docs/03%20Decreto%20Presidencial%20n.%C2%BA%207125.pdf) | **Diploma Legal Oficial da AGT**: Regulamentação jurídica sobre faturamento eletrónico, imutabilidade, comunicação de séries e requisitos de certificação de software. | PDF Oficial |

---

## 🏛️ Guias Específicos por Componente

Para aprofundamento nos subsistemas individuais:
- **API Gateway (Rust):** [`Backend/gateway/docs/API_GATEWAY_ARCHITECTURE.md`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/gateway/docs/API_GATEWAY_ARCHITECTURE.md)
- **KudibaInvoicing (Rust):** [`Backend/services/KudibaInvoicing/README.md`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/services/KudibaInvoicing/README.md)
- **KudibaAuth (Python):** [`Backend/services/KudibaAuth/README.md`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/services/KudibaAuth/README.md)
- **Contratos Protocol Buffers (gRPC):** [`proto/fiscal/v1/fiscal_engine.proto`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/proto/fiscal/v1/fiscal_engine.proto) e [`proto/events/v1/events.proto`](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/proto/events/v1/events.proto)
