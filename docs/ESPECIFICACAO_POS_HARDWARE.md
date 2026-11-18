# Especificação de Integração POS — Impressora Térmica, Gaveta e Terminal de Caixa

**Versão do Documento:** 0.3.2  
**Data:** 18 de Novembro de 2026  
**Estado:** Especificação técnica aprofundada (v0.3.2) — inclui ciclo de vida de provisionamento assistido, emparelhamento, sincronização inicial de catálogo, recuperação de desastre, transporte local seguro, spooler Windows, coordenação durável de checkout e conformidade fiscal AGT. Requer validação jurídica AGT antes da entrada em produção.  
**Escopo:** `Kudiba POS` (browser/SPA), `kudiba-hardware-bridge` (agente local), `KudibaInvoicing`, `KudibaTreasury` e `KudibaInventory`.

**Histórico de versões:**
- `0.1.0` — diagnóstico inicial, agente local, estados de impressão e matriz de compatibilidade.
- `0.3.0` — emparelhamento, seed inicial, recuperação de desastre, transporte local, spooler Windows e coordenação durável de checkout.
- `0.3.1` — revisão da terminologia fiscal e do transporte; pendência AGT explícita.
- `0.3.2` — separação `FISCAL_ENVELOPE` / `CONTINGENCY_LOCAL`, unificação de estados, chaves de terminal no modelo de dados e regras de reimpressão.

---

## 1. Princípios (não negociáveis)

1. **O negócio decide antes do hardware.** A venda é persistida e o documento fiscal é resolvido antes de qualquer byte ser enviado à impressora. Uma falha de hardware não apaga nem duplica uma venda.
2. **Orquestração durável no backend (fim da coordenação no browser).** O browser nunca orquestra faturamento, caixa e stock em chamadas HTTP sequenciais e desprotegidas. Um endpoint de checkout coordena o processo no backend, mas não torna atómicas operações em bases de dados ou serviços distintos. Usar transações locais com outbox, consumidores idempotentes, estados explícitos, retries duráveis e reconciliação; pagamentos em TPA exigem fluxo próprio.
3. **Hardware é incerto por definição.** Modelos, ligações, drivers, páginas de código, voltagens e firmwares diferentes. Não existe "impressora universal". Automatizar não é presumir que funciona; é detetar, declarar capacidades e falhar de forma explícita.
4. **O acesso ao hardware é local e controlado.** Um agente nativo é a camada recomendada para centralizar o acesso ao spooler do SO, portas série, USB, rede e gaveta. APIs web com permissões explícitas existem, mas não oferecem o mesmo suporte portátil e silencioso para a matriz de dispositivos pretendida.
5. **Nunca fingir certeza.** `TRANSPORT_ACCEPTED`, `FAILED` e `UNKNOWN` são estados distintos. "O transporte aceitou o trabalho" não é "o papel saiu".
6. **Toda a impressão é ligada à venda e idempotente.** Reimpressão é uma cópia auditada (`COPY`), nunca um novo documento fiscal e nunca um novo pulso na gaveta.
7. **A gaveta não é um efeito colateral.** Só abre por ação explícita, autorizada e registada (ex: pagamento em `NUMERARIO`, suprimento ou sangria). Nunca abre apenas porque um talão foi impresso ou reimpresso.
8. **Falha de hardware não impede venda — mas tem de ser gerida.** A venda pode prosseguir com comprovativo pendente, desde que haja trilha, limite e resolução posterior. Não se confunde isto com contingência fiscal não homologada: se a classe `CONTINGENCY_LOCAL` estiver desativada ou os limites da §7 esgotados, o terminal bloqueia novas vendas. Isto é uma decisão de negócio/regulatória, não um detalhe de UI.
9. **Sem configuração manual de baixo nível no balcão.** O operador não deve digitar UUIDs, portas COM ou comandos de rede. Instalação, emparelhamento, diagnóstico e recuperação continuam a exigir passos guiados e, quando necessário, autorização de administrador; não são “zero-config” nem necessariamente auto-recuperáveis.

---

## 2. Diagnóstico do estado atual (com evidência)

O que o repositório diz e o que o código faz divergem. Factos verificáveis:

| Afirmação documentada | Realidade no código | Impacto |
| :--- | :--- | :--- |
| "POS Desktop Tauri Local-First" (`README.md:18`, `Frontend/README.md:11`) | Não existe `@tauri-apps` em `Frontend/package.json`, nem `src-tauri/`, nem `tauri.conf.json`. O "offline" é IndexedDB no browser (`Frontend/src/services/posOfflineDb.ts:66`) e um *service worker* (`Frontend/src/main.tsx:25`). | Nenhum acesso universal a USB/COM. Vendas offline ainda não sincronizadas dependem do armazenamento local do browser e podem perder-se se os dados forem limpos. |
| "Talão térmico 80mm ESC/POS" (`Backend/services/KudibaInvoicing/README.md`) | `InvoiceThermalGenerator::generate_text()` (`invoice_thermal.rs:452`) devolve uma `String` de 48 colunas. Não existe um único byte `0x1B` no backend Rust. O PDF 80mm é um PDF, não um fluxo de impressora. | Nenhum comando real de negrito, corte, QR ou gaveta. |
| "Emissão em menos de 1 segundo [F9]" (`docs/APRESENTACAO_CLIENTES_E_GUIA_UTILIZADOR.md`) | Impressão é `window.print()` dentro de modais (`PosView.tsx:2275`, `:2386`, `:2419`, `:2477`). Não existe handler F9 — apenas `handleSearchKeyDown` para Enter (`:341`). | O diálogo interrompe o fluxo e pode perder foco do leitor; medir latência real em hardware antes de quantificar o impacto por venda. |
| "Caixas físicos e PDV" | Gaveta é apenas saldo financeiro: "Estimado em Gaveta" (`:1643`), contagem cega, `cash_sessions`/`pos_sessions` (`KudibaTreasury/src/main.rs:148`, `:169`). | Nenhum pulso elétrico, nenhum sensor, nenhum evento de abertura auditável. |
| "Integração Tesouraria e Inventário" | `recordMovement` e `processInvoiceIssued` estão em `try { ... } catch { /* segue sem bloquear */ }` (`PosView.tsx:667-669`, `:687-689`). | FR assinada com caixa e stock possivelmente desencontrados, sem incidente registado. |
| Identificação do terminal | `activeRegister?.code || 'POS-01'` (`:617`) e ano fiscal via `new Date().getFullYear()` do browser (`:524`). | Terminal inventado e ano fiscal dependente do relógio do cliente. |
| "Memória Fiscal POS (Leitura X e Fecho Z)" | `pos_z_reports` em `01-invoicing-schema.sql:505` é uma tabela Postgres. | Registo de software, não dispositivo fiscal certificado. Exige validação AGT. |

**Conclusão:** hoje não existe automação de hardware. Existe uma SPA que abre a janela de impressão do browser e uma gaveta abstrata em bases de dados. Prometer "kit POS pronto" neste estado é prometer suporte impossível.

---

## 3. Realidade física do kit POS

### 3.1 Gaveta de dinheiro

- Na maioria das instalações, a gaveta **não liga ao computador**. Tem cabo RJ11/RJ12 que encaixa na traseira da impressora térmica.
- A abertura é um pulso elétrico (~24 V; existem modelos de 12 V) disparado pela impressora ao receber `ESC p m t1 t2` (`0x1B 0x70 m t1 t2`).
- Pinagem (4P4C vs 6P6C), voltagem e tempos `t1/t2` variam por fabricante. `0x19 0xFA` é um exemplo, não uma constante universal.
- Gavetas normais **não confirmam que abriram**. Eventual sensor de "aberta" é exceção, não regra.

### 3.2 Impressora térmica

- O fluxo profissional envia **bytes ESC/POS**: texto pré-formatado, alinhamento, página de código, QR nativo (`GS ( k`), alimentação e corte (`GS V 0/1` ou `GS V B n`, conforme firmware).
- `window.print()` usa o pipeline de impressão do browser e do sistema operativo; conversão e qualidade dependem do driver. Não garante envio de bytes ESC/POS nem controlo da gaveta e abre o diálogo de impressão no fluxo atual.
- Largura útil: **80 mm ≈ 48 colunas (Font A) / 64 (Font B)**; **58 mm ≈ 32 / 42**. "80 colunas" não é um alvo realista em papel de 80 mm.
- **Páginas de código e acentuação no contexto de Angola (CPLP):**
  - Impressoras genéricas asiáticas (POS-80, Xprinter, etc.) não suportam UTF-8 nativo por omissão e corrompem carateres como `ç`, `ã`, `õ`, `é`, `º`, `ª`.
  - O agente deve selecionar explicitamente a tabela de carateres conforme o perfil certificado do modelo e firmware. CP850 e CP1252 são candidatos, mas os valores de `ESC t n` e os carateres suportados não são universais.
  - **Transliteração determinística (modo ASCII):** Para modelos sem suporte adequado a acentos, o agente aplica um mapeamento definido e testado por perfil, preservando a legibilidade e o significado; não assumir um código de tabela ou substituição universal.
- Nem toda a impressora tem guilhotina; nunca enviar comando de corte sem capacidade declarada no perfil.

### 3.3 Leitor de código de barras

- Funciona na maioria dos casos como *keyboard wedge*: digita o código e envia Enter.
- Se a UI abrir modal ou janela do SO, o próximo `bip` pode não chegar ao campo de leitura.
- **Leitura de códigos de barras:** Preferir um campo dedicado com foco recuperável e configurar o scanner com prefixo/sufixo, quando suportado. Um listener global só pode ser opção para scanners e contextos testados: a cadência entre teclas é heurística, não identificação garantida. Não interceptar texto de outros campos, diálogos, atalhos, métodos de composição ou entrada acessível.

### 3.4 TPA / Multicaixa

- Hoje é apenas `PaymentMethodType = 'MULTICAIXA'` (`Frontend/src/api/treasury.ts:3`). Não há transaction id, confirmação, reversão nem fecho de lote.
- Pagamento offline com cartão depende da autorização do próprio terminal físico (GPO / EMV), não da vontade do operador.

---

## 4. Arquitetura alvo

### 4.1 Separação de responsabilidades e transporte de rede

```
   [ Browser / SPA POS ]          [ Kudiba Hardware Agent ]          [ Core / Gateway ]
   (https://app.kudiba.ao)       (loopback HTTPS/WSS, a validar)       (https://api.kudiba.ao)
    - carrinho e UX                - WinSpool / USB / COM / IP        - coordenação do checkout
    - pedidos ao agente            - montagem de bytes ESC/POS        - numeração e assinatura
    - sem I/O direto de hardware    - pulso da gaveta                  - auditoria central
    - estados para o operador      - SQLite local (WAL)               - X/Z, tesouraria, stock
    - campo de leitura dedicado    - telemetria de dispositivos       - idempotência fiscal
              |                              |                                |
              +--- HTTPS/WSS (Loopback) -----+---- HTTPS / gRPC ---------------+
              (Emparelhamento + PNA*)                (JWT + tenant)
```

`*` O suporte PNA depende do browser e da versão; não é mecanismo de autenticação.

#### Transporte local entre o browser e o agente
Um frontend HTTPS não deve depender de HTTP inseguro para comunicar com o agente. O transporte e o mecanismo de confiança têm de ser validados nas versões de browser suportadas; requisitos de *Mixed Content*, CORS e *Private Network Access* variam por browser e versão. HTTPS em loopback ou um domínio local com TLS são opções a avaliar num protótipo, não uma solução universal. Respostas PNA/CORS não autenticam o chamador. Não publicar um domínio que resolva para loopback sem avaliar o comportamento de DNS, TLS e políticas dos browsers-alvo.

Critérios obrigatórios: bind apenas a loopback, origem permitida por configuração, validação de preflight conforme o browser, credencial local obtida por emparelhamento explícito e autorização independente para cada operação privilegiada.

#### Modos de Driver de Hardware no Agente
Para evitar falhas de concorrência com drivers do fabricante no Windows:
1. **`WIN_SPOOL:NomeDaImpressora` (modo primário candidato no Windows):** Envia o fluxo ESC/POS como trabalho RAW através do spooler do Windows (`OpenPrinterW`, `StartDocPrinterW`, `WritePrinter`). Não contorna o spooler nem o seu acesso à porta USB; evita que o agente tente abrir diretamente uma porta já gerida pelo driver. Validar o comportamento com cada driver e modelo certificado.
2. **`RAW_SERIAL:COMx` ou `/dev/ttyUSBx`:** Para impressoras com interface serial nativa ou adaptadores USB-UART (CH340/FTDI).
3. **`RAW_TCP:host:9100`:** Para impressoras térmicas Ethernet ou Wi-Fi na rede local.
4. **`RAW_USB_DIRECT:vid:pid`:** Para Linux com regras `udev` ou Windows com driver genérico WinUSB.

---

### 4.2 Agente local — decisão

- **Caminho preferido:** avaliar `kudiba-hardware-bridge`, sidecar nativo em Rust instalado no PC do POS, a correr em `127.0.0.1` como serviço de fundo. `axum`, `tokio`, `rusqlite` e `windows-sys` são candidatos, não decisões fechadas. Consumo de RAM, tamanho do instalador e dependências devem ser medidos em builds de produção; não assumir um binário único sem dependências do sistema.
- **Caminho alternativo:** Tauri com backend Rust. Vantagem de um só binário; desvantagem de duas linhas de release (web + desktop), permissões de WebView e complexidade de distribuição Windows (assinatura de código, SmartScreen, auto-update).
- **Ordem de implementação:** prototipar o transporte e o modelo de distribuição antes de escolher. Se a SPA não conseguir emparelhar com segurança nos browsers suportados, avaliar Tauri ou outro mecanismo nativo em vez de assumir que loopback/PNA funcionará.

---

### 4.3 Contrato do agente e campos fiscais AGT

Todos os pedidos exigem uma credencial local obtida por emparelhamento explícito do terminal. Validar `Origin` e escutar só em `127.0.0.1`, mas não tratar `Origin` como autenticação. Definir rotação e revogação das credenciais; não confiar num `user_id` enviado pelo browser nem num RBAC local sem identidade verificável. Para `drawer.open` e `print.reprint`, o agente valida uma autorização curta e verificável, vinculada ao utilizador, tenant, terminal, ação e motivo. Em `FISCAL_ENVELOPE` a assinatura vem do backend; em `CONTINGENCY_LOCAL` vem da chave local provisionada no seed, com validade e época. Qualquer outro mecanismo precisa de aprovação explícita.

O browser não é autoridade para o conteúdo fiscal. O backend cria o trabalho de impressão a partir do documento emitido e fornece um envelope imutável, assinado e vinculado ao `tenant_id`, terminal, documento e `print_job_id`. O checkout pode devolver esse envelope para a SPA o encaminhar opacamente ao agente, que o valida e persiste localmente antes de imprimir; assim, uma perda de rede após a emissão não impede necessariamente a impressão de um documento já emitido. Se o envelope não chegar ao agente, este pode recuperá-lo da API quando voltar a estar online. Nunca imprimir valores fiscais arbitrários enviados pelo browser. A credencial local usada pela SPA não autoriza, por si só, a impressão ou a abertura da gaveta.

#### Classes de trabalho de impressão

O agente distingue duas classes, com autorizações e regras diferentes. Um `print_job` pertence a uma e apenas uma classe:

| Classe | Origem da autorização | Conteúdo | Onde pode ser criado |
| :--- | :--- | :--- | :--- |
| `FISCAL_ENVELOPE` | Backend, assinado por chave do servidor | Documento fiscal já emitido, `document_number` real, `payload_hash` | Online, no `POST /api/pos/checkout`; recuperável por `GET /api/pos/print-jobs/{id}` |
| `CONTINGENCY_LOCAL` | Chave local provisionada no emparelhamento, com faixa de números reservada pelo servidor | Comprovativo **não fiscal**, número temporário por terminal | Somente no agente, quando o backend está inalcançável, dentro dos limites da §7 |

Regras da classe `CONTINGENCY_LOCAL`:
- Não é documento fiscal e não entra em SAF-T, X/Z ou reconciliação AGT como fatura emitida.
- A chave local tem validade curta, é rodada no emparelhamento e é revogada em conjunto com a credencial do terminal.
- A faixa de números temporários é pré-alocada pelo servidor e recebida no seed (§8.2); o agente nunca inventa séries.
- A aplicação da classe depende de parecer jurídico AGT (§14). Até lá, a funcionalidade fica **desativada por configuração**; esgotado o limite de pendências, o terminal bloqueia novas vendas em contingência em vez de imprimir um documento não aprovado.
- Ao regressar a rede, cada comprovativo é convertido num `FISCAL_ENVELOPE`; o número fiscal final e a prova de entrega ao cliente ficam ligados ao `print_job_id` original.

Em ambas as classes, uma autorização verificável é exigida para cada trabalho, incluindo o original, e restringe tipo de cópia e destino. Isto não autoriza emissão fiscal offline; essa permanece sujeita à validação da AGT.

```http
POST /device/print
Authorization: Bearer <credencial local emparelhada>
{
  "job_envelope": {
    "print_job_id": "uuid",
    "job_class": "FISCAL_ENVELOPE | CONTINGENCY_LOCAL",
    "tenant_id": "uuid",
    "terminal_id": "uuid",
    "document_number": "FR 2026A/000123",
    "copy_type": "ORIGINAL | COPY",
    "payload": "<documento imutável emitido pelo backend>",
    "payload_hash": "...",
    "authorization": "<assinatura do backend em FISCAL_ENVELOPE; chave local em CONTINGENCY_LOCAL>",
    "signature": "..."
  },
  "profile_id": "printer-balcao-01"
}

GET /api/pos/print-jobs/{print_job_id}
Authorization: Bearer <credencial de dispositivo>
Response: o mesmo envelope assinado, para recuperação/reconciliação online

POST /device/drawer
Authorization: Bearer <credencial local emparelhada>
{
  "event_id": "uuid",
  "reason": "CASH_SALE | CASH_MOVEMENT | SHIFT_CLOSE",
  "authorized_by": "user-uuid",
  "authorization": "<backend online; chave local do seed em CONTINGENCY_LOCAL>",
  "sale_id": "uuid | null"
}

GET  /device/status          # capacidades/estados reportados; UNKNOWN quando não observáveis
POST /device/selftest        # amostra + pulso controlado, usado na instalação
```

`authorized_by` é metadado de auditoria, não prova de identidade nem autorização por si só. O agente deve validar a autorização assinada antes de executar a ação privilegiada.

Respostas de `print`: `TRANSPORT_ACCEPTED`, `FAILED`, `UNKNOWN`. `TRANSPORT_ACCEPTED` significa apenas que o spooler ou transporte local aceitou os dados; não confirma a saída do papel. Usar `PHYSICAL_OUTPUT_CONFIRMED` apenas quando houver confirmação física fiável ou verificação humana registada.

---

## 5. Máquina de estados e coordenação do checkout

### 5.1 Eliminação da orquestração frágil no browser
O browser **nunca** coordena chamadas isoladas para `Invoicing`, `Treasury` e `Inventory` com blocos `catch {}` que silenciam erros.
O backend disponibiliza um endpoint coordenador:
`POST /api/pos/checkout`
1. Cria a Fatura-Recibo assinada e a respetiva outbox na mesma transação local (`KudibaInvoicing`).
2. Publica eventos duráveis para inventário e tesouraria; cada consumidor processa-os de forma idempotente e regista falhas para retry e reconciliação.
3. Retorna ao POS o estado fiscal e os identificadores necessários para consultar o progresso das operações assíncronas.

Este fluxo é uma saga/eventual consistency, não uma transação ACID distribuída. A API deve expor estados parciais e procedimentos de reconciliação; não reportar sucesso integral enquanto as operações obrigatórias estiverem pendentes. A autorização/captura de TPA é um passo externo separado, com idempotência e tratamento de reversão.

### 5.2 Fluxo de hardware após checkout
```
RASCUNHO POS
   |  (Pagamento confirmado; para numerário, valor recebido e troco validados)
   v
CHECKOUT_COORDENADO_BACKEND  (Fatura assinada + stock/caixa agendados)
   |
   +---> VENDA/FATURA PERSISTIDA (estado comercial/fiscal)
   |
   +---> Se pagamento confirmado incluir dinheiro vivo: EVENTO_GAVETA
   |         ├─ TRANSPORT_ACCEPTED / FAILED / UNKNOWN
   |         └─ UNKNOWN bloqueia novo pulso até reconciliação
   |
   +---> PRINT_JOB durável no agente
             ├─ TRANSPORT_ACCEPTED (não confirma saída física)
             ├─ FAILED → operador pode solicitar COPY auditada
             └─ UNKNOWN → bloquear retry automático e reconciliar
```

Regras:
- `UNKNOWN` bloqueia nova impressão automática até resolução explícita pelo operador.
- A gaveta só é acionada após confirmação de pagamento com componente em dinheiro vivo.
- Reimpressão (`COPY`) **nunca** reenvia comando de pulso de gaveta.
- A venda comercial permanece íntegra na base de dados mesmo que a impressora esteja desligada ou sem papel.
- Um resultado `UNKNOWN` da gaveta também bloqueia novo pulso automático. Um identificador idempotente evita duplicar o registo lógico, mas não garante execução física exatamente uma vez; exigir reconciliação explícita e auditada.
- A classe do trabalho (`FISCAL_ENVELOPE` ou `CONTINGENCY_LOCAL`, §4.3) determina quem assina e se o documento é fiscal; nunca misturar as duas classes num mesmo `print_job`.

---

## 6. Regras da gaveta

| Situação | Abre? | Condição |
| :--- | :--- | :--- |
| `NUMERARIO` concluído | Sim | Documento resolvido + movimento de caixa registado. |
| Misto com componente em dinheiro | Sim | Pelo valor em dinheiro; reason `CASH_SALE`. |
| `MULTICAIXA` / `TRANSFERENCIA` / `GPO_REFERENCE` | **Não** | Sem dinheiro a movimentar, sem justificação para abrir o cofre. |
| Reimpressão | **Nunca** | Cópia não é evento de caixa. |
| Suprimento / sangria / troco | Sim | PIN de supervisor ou permissão explícita + motivo + valor. |
| Fecho Z / recolha total | Sim | Dupla custódia (operador + supervisor), contagem física e movimento de sangria registado. |
| Leitura X | Não | Relatório de conferência não move dinheiro físico. |

Cada abertura gera `pos_drawer_events` com operador, autorizador, data/hora, motivo, valor e terminal. Abertura manual sem venda associada sem autorização é incidente de segurança auditável.

---

## 7. Offline e contingência

- A fila durável passa da IndexedDB do browser para o **SQLite do agente** (WAL, transacional). O browser deixa de ser a autoridade offline.
- Em offline, o agente coordena a venda localmente com outbox própria (comprovativo de contingência, caixa e stock como eventos locais) e reconcilia com o backend ao regressar a rede. A coordenação durável da §5.1 é o caminho online; a coordenação local é o caminho de contingência e usa a classe `CONTINGENCY_LOCAL` da §4.3.
- Enquanto a AGT não aprovar o formato, `CONTINGENCY_LOCAL` fica **desativada por configuração**. Esgotado o limite de pendências, o terminal bloqueia novas vendas em contingência em vez de imprimir um documento não aprovado.
- **Proposta sujeita a validação jurídica, não autorizada para produção:** eventual talão de contingência poderá ser identificado no cabeçalho em tamanho duplo como:  
  `DOCUMENTO EMITIDO EM REGIME DE CONTINGÊNCIA`  
  com número de série temporário extraído da faixa pré-alocada pelo servidor (§8.2) e código identificador para posterior recolha da fatura oficial, apenas se esse formato e fluxo forem aprovados pela AGT.
- Limites obrigatórios de contingência — teto financeiro máximo acumulado, número máximo de faturas pendentes e janela temporal máxima — são **configurados e assinados pelo servidor no seed**, não fixos no documento nem escolhidos no balcão. Esgotado um limite → bloqueio preventivo e pedido de autorização de supervisor.
- Ano, série e timestamps fiscais são definidos pelo servidor. Em contingência, o agente usa a faixa de séries pré-alocada e o timestamp local apenas como metadado não fiscal; a hora fiscal autoritativa é atribuída na reconciliação. Monitorizar desvio do relógio local para diagnóstico; NTP pode ser recomendado para operação, mas não substitui a hora do servidor.
- **Pendência jurídica:** Confirmar com a AGT o enquadramento exato de contingência do Regime Jurídico das Faturas e Documentos Equivalentes (RJFDE) e a dispensa ou exigência de dispositivos de hardware fiscal dedicados.

---

## 8. Ciclo de vida do terminal: Provisionamento, Emparelhamento e Diagnóstico

### 8.1 Provisionamento e Emparelhamento Inicial (assistido)

O objetivo é não exigir que o operador configure portas ou digite identificadores técnicos. Instalação, emparelhamento e diagnóstico continuam a exigir passos explícitos, permissões de instalação e validação no browser suportado.

```
[ Kudiba Web (Admin / Onboarding) ] ───────── 1. "Ativar Terminal POS-01" ─────────┐
         │                                                                          │
         ▼                                                                          ▼
(Gera token de ativação aleatório)                                      (Descarrega instalador assinado)
Token opaco, uso único, TTL curto                                       Tamanho medido por release
         │                                                                          │
         │                                                                          ▼
         │                                                            (Instala serviço de fundo)
         │                                                            Agente arranca em 127.0.0.1
         │                                                                          │
         ▼                                                                          ▼
[ SPA Web deteta Agente via Loopback ] <──── 2. Handshake Local ──────── [ Kudiba Hardware Bridge ]
         │
         ├─ 3. Após ação explícita do administrador, envia token ao agente
         │
         ▼
[ Agente troca token e nonce com a Cloud ] ── 4. Bootstrap autenticado ───> [ Kudiba Core API ]
         │                                                                          │
         ├<────────────── 5. Emite credencial vinculada ao terminal ────────────────┤
         │                                                                          │
         ▼                                                                          ▼
(Grava credencial protegida localmente)                                   (Regista Terminal Ativo)
```

1. **Download e instalação:** Um administrador autorizado descarrega um instalador assinado; documentar os privilégios exigidos, a origem do instalador e o processo de atualização.
2. **Ativação:** Um utilizador autorizado inicia a ativação do terminal. O backend emite um token aleatório de alta entropia, de uso único, curto prazo e escopo limitado a um `tenant_id` e `terminal_id`. Guardar apenas o hash do token, consumi-lo atomicamente e limitar tentativas por utilizador, terminal e origem. Nunca registá-lo em logs.
3. **Handshake local:** A SPA deteta o agente apenas depois de validar transporte, certificados, CORS/PNA e versão do browser no protótipo. A origem permitida e uma ação local explícita são necessárias; se o browser não suportar o fluxo seguro, usar uma alternativa nativa em vez de relaxar a segurança.
4. **Bootstrap:** O agente envia o token e um nonce à API por TLS, valida a identidade do servidor e troca a autorização de uso único por uma credencial vinculada ao terminal. O backend associa o terminal à conta que iniciou a ativação. Isto é bootstrap com token, não autenticação mútua; após o bootstrap, definir autenticação mútua ou assinatura de pedidos com chaves protegidas pelo SO quando disponível.
5. **Persistência e ativação:** Proteger a credencial localmente com o mecanismo apropriado ao SO e limitar-lhe o acesso à conta de serviço. Marcar o terminal `PAIRED` apenas depois de confirmar a ativação na cloud; depois carregar o catálogo e testar os periféricos.

---

### 8.2 Carga Inicial e Sincronização do Catálogo (*Seed Local*)

Imediatamente após o emparelhamento com sucesso, antes de autorizar qualquer venda, o agente realiza a sua primeira carga de sincronização a partir da cloud:

1. **Catálogo de Artigos:** Códigos de barras (EAN/GTIN/SKU), descrições, preços de venda com IVA discriminado e regras/motivos de isenção fiscal.
2. **Operadores e autorização offline:** Não replicar PINs nem hashes simples reutilizáveis como autorização. Preferir autorizações assinadas, limitadas por operador, terminal, prazo e ações permitidas. Se um verificador local de PIN for indispensável, definir hash com sal e custo resistente a brute force, armazenamento protegido pelo SO, rate limit, bloqueio progressivo e limites separados para descontos e outras ações privilegiadas.
3. **Parâmetros Fiscais e Séries:** Séries ativas emitidas pelo servidor central, faixa reservada de números temporários de contingência, limites de contingência assinados (teto, contagem e janela temporal), chave local de `CONTINGENCY_LOCAL` com validade e época, e a policy de emissão offline (ativada/desativada). Todos os valores com assinatura e validade explícitas.
4. **Sincronização contínua por deltas:** Aplicar deltas com sequência, versão, assinatura/integridade e tombstones, de forma transacional. Guardar a versão e hora da última sincronização bem-sucedida; definir validade máxima por tipo de dado e bloquear operações quando preços, regras fiscais ou séries excederem a validade permitida. Um delta incompleto ou inválido não pode substituir o último snapshot íntegro.

---

### 8.3 Recuperação de Desastre e Substituição de Terminal (*Disaster Recovery*)

Em retalho de alto tráfego, computadores de caixa podem sofrer avarias físicas. O tempo de recuperação é uma meta operacional a medir, não uma promessa; depende de computador preparado, instalador disponível, permissões, drivers, conectividade e volume do catálogo.

1. **Substituição Física:** O operador instala um computador de reserva no balcão e liga os cabos da impressora térmica e do leitor de códigos.
2. **Revogação e novo token:** O supervisor revoga a credencial antiga e inicia novo emparelhamento. Usar uma geração/época de credencial para rejeitar pedidos do terminal antigo assim que este voltar a comunicar. Uma máquina isolada da rede não pode receber a revogação imediatamente; definir e comunicar o limite de operação offline.
3. **Novo emparelhamento:** Instalar e emparelhar o computador de reserva, com privilégios e drivers já disponíveis ou incluídos no processo aprovado.
4. **Restauração do seed:** Descarregar e validar o snapshot e os deltas; não permitir vendas até os dados obrigatórios estarem íntegros e dentro da validade definida.
5. **Retoma de vendas:** Medir o tempo ponta-a-ponta em cenários representativos e publicar um SLO apenas depois de repetidos testes de recuperação.

---

### 8.4 Matriz mínima certificada

| Dimensão | Valores a suportar | Nota de Implementação |
| :--- | :--- | :--- |
| **Ligação da impressora** | `WIN_SPOOL` (Windows Driver Spooler), `RAW_SERIAL` (COM/tty), `RAW_TCP` (porto 9100), `RAW_USB_DIRECT` | Preferir o spooler a abrir diretamente uma porta USB já gerida pelo driver; certificar o comportamento por modelo/driver. |
| **Largura do papel** | 80 mm (48/64 colunas), 58 mm (32/42 colunas) | Configurável por perfil de posto no agente. |
| **Páginas de código** | CP850, CP1252, UTF-8 nativo quando suportado, modo de transliteração ASCII | Comando e tabela selecionados por perfil de modelo/firmware certificado. |
| **QR Code Fiscal** | `GS ( k` nativo ou rasterização suportada pelo perfil | Formato, conteúdo e obrigatoriedade dependem de validação AGT; não assumir um fallback ASCII. |
| **Corte de papel** | `GS V 0/1`, `GS V B n`, sem guilhotina (manual) | Capacidade declarada no perfil para evitar erros em modelos sem corte motorizado. |
| **Gaveta de dinheiro** | 12 V / 24 V, RJ11 4P4C / RJ12 6P6C, tempos `t1/t2` por modelo | Pulso disparado através do conector DK da impressora. |
| **Leitor de códigos** | Keyboard Wedge com campo dedicado; listener global opcional | Testar prefixo/sufixo, foco e compatibilidade por modelo. |

---

### 8.5 Wizard de diagnóstico de hardware em loja

Concluído o emparelhamento e o seed inicial, o assistente na web guia o teste físico dos equipamentos:
1. **Descoberta de Periféricos:** O agente lista portas COM ativas, impressoras instaladas no spooler do Windows e interfaces de rede.
2. **Aplicação do Perfil:** Seleção do modelo a partir da lista homologada. Candidatos iniciais a homologação: Epson TM-T20III, Bixolon SRP-330, Xprinter XP-N160II — nenhum é considerado certificado antes do teste desta secção.
3. **Teste de Impressão:** Imprime talão diagnóstico com acentuação (`ç`, `ã`, `Kz`), alinhamento e corte.
4. **Teste de Gaveta:** Dispara o pulso elétrico e solicita confirmação visual do operador: *"A gaveta abriu fisicamente? [Sim] / [Não]"*.
5. **Assinatura do Perfil:** Gravação do perfil validado no SQLite do agente e replicação para a cloud (`kudiba_treasury.pos_devices`).

---

## 9. Segurança

- Bind exclusivo a `127.0.0.1`; portas externas nunca abertas para `0.0.0.0`.
- Credencial local emparelhada, com rotação/revogação e escopo limitado; validar `Origin` (`https://app.kudiba.ao`) como defesa adicional, não como autenticação.
- Responder aos preflights PNA com os cabeçalhos exigidos apenas quando aplicável ao browser suportado e à origem permitida; estes cabeçalhos não autenticam o chamador.
- Operações críticas (`drawer.open`, `print.reprint`, `device.selftest`) exigem autorização verificável, registo de autor e motivo; não confiar em identificadores fornecidos pelo browser.
- A impressora é vetor de fraude: limitar cópias e auditar explicitamente toda a impressão de 2ª via.

---

## 10. Modelo de dados proposto (esquema `kudiba_treasury`)

As tabelas abaixo são o registo central de auditoria/configuração. A fila operacional de retries pertence ao SQLite local do agente; cada trabalho tem um ID estável e os estados são sincronizados para o servidor. O servidor não deve reenviar automaticamente um trabalho só porque ainda não recebeu uma atualização do agente. O estado local governa o retry; o servidor governa auditoria e reconciliação.

`connection_params` no servidor contém apenas metadados não secretos. Credenciais de impressoras/rede e chaves privadas ficam protegidas localmente; nunca replicá-las em claro para a cloud.

```sql
-- Terminais de Ponto de Venda registados
CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    warehouse_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAIRING', -- PENDING_PAIRING | PAIRED | REVOKED | SUSPENDED
    hardware_fingerprint VARCHAR(256),
    device_public_key BYTEA,
    credential_epoch BIGINT NOT NULL DEFAULT 1,
    paired_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_terminal_code UNIQUE (tenant_id, terminal_code)
);

-- Hashes de tokens aleatórios de uso único; o token em claro nunca é persistido
CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_pairing_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id),
    pairing_token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    created_by_user_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_pairing_token_hash UNIQUE (pairing_token_hash)
);

-- Dispositivos de hardware configurados no terminal
CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id),
    device_kind VARCHAR(32) NOT NULL,       -- PRINTER | DRAWER | SCANNER | TPA
    device_slot VARCHAR(64) NOT NULL,       -- RECEIPT | KITCHEN | MAIN etc.
    model VARCHAR(128) NOT NULL,
    connection_mode VARCHAR(32) NOT NULL,   -- WIN_SPOOL | RAW_TCP | RAW_SERIAL | RAW_USB
    connection_params JSONB NOT NULL,       -- Apenas metadados não secretos da ligação
    capabilities JSONB NOT NULL DEFAULT '{}',
    profile_signature VARCHAR(256),
    is_certified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_device_terminal_slot UNIQUE (tenant_id, terminal_id, device_kind, device_slot)
);

-- Fila durável e rastreabilidade de trabalhos de impressão
-- job_class (§4.3) distingue FISCAL_ENVELOPE de CONTINGENCY_LOCAL
CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id),
    device_id UUID REFERENCES kudiba_treasury.pos_devices(id),
    sale_id UUID NOT NULL,
    job_class VARCHAR(32) NOT NULL,         -- FISCAL_ENVELOPE | CONTINGENCY_LOCAL
    document_number VARCHAR(64) NOT NULL,
    copy_type VARCHAR(16) NOT NULL,         -- ORIGINAL | COPY
    idempotency_key VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,             -- QUEUED | SUBMITTING | TRANSPORT_ACCEPTED | FAILED | UNKNOWN | PHYSICAL_OUTPUT_CONFIRMED | RESOLVED_BY_OPERATOR
    attempts INT NOT NULL DEFAULT 0,
    submit_lease_expires_at TIMESTAMPTZ,    -- SUBMITTING preso é recuperado no arranque do agente
    device_error TEXT,
    actor_user_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT uq_pos_print_job_key UNIQUE (tenant_id, idempotency_key)
);

-- Auditoria e rastreabilidade de disparos de gaveta
CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_drawer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id),
    device_id UUID REFERENCES kudiba_treasury.pos_devices(id),
    sale_id UUID,
    reason VARCHAR(32) NOT NULL,            -- CASH_SALE | CASH_MOVEMENT | SHIFT_CLOSE | MANUAL_OVERRIDE
    amount NUMERIC(18, 4),
    actor_user_id VARCHAR(64) NOT NULL,
    authorized_by_user_id VARCHAR(64),
    state VARCHAR(32) NOT NULL,             -- TRANSPORT_ACCEPTED | FAILED | UNKNOWN; nunca repetir pulso automaticamente em UNKNOWN
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Reimpressão: cria um novo registo com `copy_type = 'COPY'`, **nova** `idempotency_key`, mesmo `document_number` e `payload_hash` do original e nenhum `pos_drawer_events`. Reutilizar a chave do original viola `uq_pos_print_job_key` e impede a cópia; por isso a chave nunca é herdada. O `terminal_code` legível é obtido por junção com `pos_terminals`; não é duplicado nestas tabelas.

`SUBMITTING` é um estado transitório com lease: se `submit_lease_expires_at` expirar, o agente reconcilia o trabalho no arranque com o spooler/transporte antes de o marcar como `UNKNOWN`. Nunca se assume sucesso apenas porque o lease expirou.

---

## 11. Critérios de aceitação e testes

- **Simuladores de Hardware em CI:** Mocks de `PrinterPort`, `DrawerPort` e `ScannerPort` com injeção de dependências em Rust.
- **Testes de Contrato de Bytes:** Validação dos fluxos binários ESC/POS por perfil certificado, incluindo CP850, CP1252 e modo ASCII quando suportados.
- **Resiliência a Falhas:** Queda de energia simulada durante impressão; agente recupera a fila do SQLite com integridade na reinicialização.
- **Proteção do agente local:** Testar chamadas sem credencial, com origem não permitida, credencial revogada e autorização privilegiada inválida; executar testes de PNA/CORS nos browsers e versões suportados.
- **Teste de Emparelhamento e Seed:** Validação do fluxo completo de emparelhamento por token e carga inicial do catálogo em ambiente isolado.
- **Métricas Operacionais:** Medir separadamente latência de aceitação pelo agente/spooler e tempo de saída física do papel. Definir metas P95 por modelo certificado e tamanho de talão; não assumir um limite universal de 800 ms. Sem janelas de diálogo do SO e sem perda de foco durante a leitura.

---

## 12. Plano de adoção

### P0 — Travar a fragilidade operacional
1. Corrigir documentação pública: remover falsas menções a Tauri e talões ESC/POS inexistentes.
2. Implementar coordenador de checkout no backend (`POST /api/pos/checkout`) com outbox local, consumidores idempotentes, estados parciais e reconciliação, eliminando os `catch {}` perigosos de [`PosView.tsx:667/687`](../../Frontend/src/views/pos/PosView.tsx#L665-L695).
3. Construir o `kudiba-hardware-bridge` em Rust com suporte a `WIN_SPOOL` e `RAW_TCP`, transporte local autenticado validado nos browsers-alvo e fila SQLite durável.
4. Implementar fluxo de emparelhamento assistido (*pairing token*) e download do agente nas configurações do Kudiba.
5. Substituir `window.print()` no POS pelo envio assíncrono para o agente local com chave de idempotência.

### P1 — Automação e controlo
6. Mecanismo de carga inicial (*seed*) e sincronização de catálogo offline para o SQLite local.
7. Pulso automático da gaveta condicionado a pagamentos em dinheiro e registo de `pos_drawer_events`.
8. Assistente (Wizard) de instalação e diagnóstico de periféricos no POS.
9. Campo de leitura dedicado e recuperação de foco, com listener global opcional apenas para scanners/contextos certificados.
10. Reimpressão auditada (`COPY`) com carimbo de 2ª via e sem disparo de gaveta.

### P2 — Escala e conformidade avançada
11. Fluxo automatizado de recuperação de desastre (substituição de terminal avariado).
12. Integração formal com terminais TPA Multicaixa.
13. Validação e homologação jurídica formal do fluxo de contingência e relatórios fiscais perante a AGT.

---

## 13. O que não prometer

- "Funciona com qualquer impressora" — funciona com a matriz certificada.
- "Instalação sem passos manuais" — há instalação, emparelhamento e diagnóstico assistidos.
- "Impressão confirmada" quando só temos `TRANSPORT_ACCEPTED`.
- "Gaveta aberta confirmada" quando o equipamento não tem sensor.
- "Operação totalmente silenciosa" — estados desconhecidos exigem decisão humana.
- "Conformidade AGT" assente numa tabela `pos_z_reports` sem parecer jurídico.

---

## 14. Decisões em aberto

| Decisão | Responsável | Prazo sugerido |
| :--- | :--- | :--- |
| Alistamento e homologação dos 3 primeiros modelos candidatos (ex: Epson, Xprinter, Bixolon) | Operações / Produto | Imediato |
| Definição do processo de distribuição e auto-update do `kudiba-hardware-bridge` | Engenharia / DevOps | Antes do P0 |
| Validação do transporte local (HTTPS/WSS em loopback, CORS/PNA) nos browsers-alvo | Engenharia / Segurança | Antes do P0 |
| Definição e ativação da classe `CONTINGENCY_LOCAL` (chave, faixa reservada, parecer AGT) | Arquitetura / Jurídico | Antes do P1 |
| Validação de enquadramento de contingência do RJFDE | Jurídico / AGT | Antes do P1 |
| Protocolo de integração com TPA Multicaixa (EMV / GPO) | Produto | P2 |
