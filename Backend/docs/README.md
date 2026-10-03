# Documentação de Engenharia de Backend - ERP Kudiba

Bem-vindo ao repositório de documentação e engenharia da camada de **Backend** do **ERP Kudiba**.  
Este diretório concentra as diretrizes arquiteturais, especificações formais de interfaces de rede (APIs) e regras de conformidade regulatória para o mercado angolano e da África Subsaariana.

---

## 1. Índice de Documentos do API Gateway & Entrypoint

| Documento | Descrição e Finalidade | Formato |
| :--- | :--- | :--- |
| [**API_GATEWAY_ARCHITECTURE.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_ARCHITECTURE.md) | **Arquitetura Geral e ADRs do Gateway**: Topologia de rede perimétrica, seleção oficial de **Rust (Axum + Tokio)** e Redis 7+, comparativo detalhado (Nest, Flask, .NET, Rust, Go), estratégia de segurança Zero-Trust, resolução Multi-Tenant, rate limiting distribuído, sincronização POS Offline-First e cumprimento estrito do **Decreto Presidencial n.º 71/25** (bloqueio mandatário de 60 dias de contingência AGT). | Markdown |
| [**API_GATEWAY_LIFECYCLE_STEPS.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_LIFECYCLE_STEPS.md) | **Guia Detalhado Passo a Passo do Ciclo de Vida**: Documentação e comentários técnicos exaustivos de cada uma das 10 etapas da pipeline de execução em Rust (TLS, Correlation ID, Sanitização, Multi-Tenancy, Rate Limiting, JWT/JWKS, Guarda AGT 60 Dias, Idempotência RFC 8935, Proxy Pooling e Respostas RFC 7807). | Markdown |
| [**API_GATEWAY_ENDPOINTS_SPEC.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_ENDPOINTS_SPEC.md) | **Catálogo Detalhado de Recursos e Endpoints**: Especificação exaustiva de rotas (`/auth`, `/tenants`, `/fiscal`, `/sync/pos`, `/catalog`, `/sales`, `/saft`, `/integrations`), cabeçalhos, contratos JSON, tratamento de erros RFC 7807 e fluxos de transação. | Markdown |
| [**API_GATEWAY_OPENAPI.yaml**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_OPENAPI.yaml) | **Contrato Formal de Interface (OpenAPI 3.1.0)**: Especificação interativa e importável no Swagger UI, Postman, Insomnia ou geradores automáticos de código cliente (SDKs TypeScript/Rust). | YAML / OpenAPI 3.1 |
| [**ESPECIFICACAO_TECNICA_ERP.md**](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/ESPECIFICACAO_TECNICA_ERP.md) | **Especificação Técnica Mestre do ERP**: Visão executiva, comparativo com Primavera/PHC/Sage, modelo de dados DDL PostgreSQL e fases de roadmap (MVP, Stocks, Contabilidade). | Markdown |

---

## 2. Mapa Rápido da Arquitetura Perimétrica

```
                                [ CLIENTES ]
            +------------------------+------------------------+
            |                        |                        |
       Web Backoffice            Tauri POS               Fintechs
         (Next.js)              (Edge Local)             (Multicaixa)
            |                        |                        |
            +------------------------+------------------------+
                                     |
                                     | HTTPS (TLS 1.3) / WSS
                                     v
                  +--------------------------------------+
                  |         ENTRYPOINT GATEWAY           |
                  |     (Rust 2021 / Axum + Tokio)       |
                  |                                      |
                  |  - Sanitização de Headers            |
                  |  - Resolução de Tenant               |
                  |  - Validação de JWT Ed25519          |
                  |  - Rate Limit (Sliding Window Redis) |
                  |  - Idempotência (RFC 8935)           |
                  |  - Monitor AGT 60 Dias (DP 71/25)    |
                  +--------------------------------------+
                                     |
                       +-------------+-------------+
                       |                           |
                       v                           v
             [ CORE API SERVER ]       [ FISCAL ENGINE SERVICE ]
             - Comercial & Vendas      - Assinatura RSA SHA-256
             - Armazéns & Stocks       - Cadeia Imutável de Hashes
             - RBAC & Contabilidade    - Validador SAF-T AO
                       |                           |
                       +-------------+-------------+
                                     |
                                     v
                       [ POSTGRESQL 16+ & REDIS 7+ ]
```

---

## 3. Principais Decisões Tecnológicas do Gateway

1. **Stack de Execução:** Rust (Edição 2021) com `axum 0.7`, `tokio`, `tower` e `reqwest/hyper`, compilado para binário único estático (`alpine` Docker container < 20MB).
2. **Latência de Trânsito:** < 0.8ms (p99) de overhead em operações de roteamento e autenticação (Zero Garbage Collection).
3. **Estado Perimétrico:** Redis 7.4+ em cluster para contadores de rate limiting, chaves de idempotência (24h TTL) e cache de chaves públicas JWKS.
4. **Resolução de Multi-Tenancy:** Identificação por subdomínio (`empresa.kudiba.ao`), header `X-Tenant-ID` e conferência estrita cruzada com o claim `tenant_id` no JWT para prevenção de escalonamento indevido.
5. **Conformidade Regulatória (AGT):**
   * Transmissão contínua em tempo real com a Plataforma Electrónica da AGT (conforme o novo Decreto Presidencial n.º 71/25).
   * Interceptação e bloqueio de faturamento com status HTTP `423 Locked` caso uma entidade opere offline por mais de 60 dias ininterruptos.
6. **Sinergia com Tauri POS:** Como o POS desktop é desenvolvido em Rust (Tauri), os modelos e algoritmos fiscais são compartilhados diretamente.

---

## 4. Como Usar esta Documentação

1. **Para Desenvolvedores de Backend (Rust):** Consulte o [API_GATEWAY_ARCHITECTURE.md](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_ARCHITECTURE.md) e [API_GATEWAY_LIFECYCLE_STEPS.md](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_LIFECYCLE_STEPS.md) para compreender a estrutura interna de middlewares Tower, políticas de concorrência Tokio e connection pooling.
2. **Para Desenvolvedores Frontend (Next.js) e Desktop (Tauri POS):** Consulte o [API_GATEWAY_ENDPOINTS_SPEC.md](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_ENDPOINTS_SPEC.md) para conhecer as rotas exatas, payloads esperados e protocolos de sincronização em lote.
3. **Para Testes Automatizados e Swagger UI:** Importe o arquivo [API_GATEWAY_OPENAPI.yaml](file:///mnt/c/Users/Jaime/Documents/Repos/Kudiba/Backend/docs/API_GATEWAY_OPENAPI.yaml) no Swagger Editor, Postman ou utilize geradores como `openapi-typescript` para tipagem estática e segura no cliente.
