# 💎 Guia do Sistema de Design (Liquid Glass UI) — Kudiba ERP

> **Localização:** `Frontend/docs/DESIGN_SYSTEM_GUIDE.md`  
> **Identidade Visual:** Paleta Corporativa Angolana (Verde Esmeralda `#0D5C3A` & Ouro Imperial `#C59B27`) com interface Liquid Glass translúcida e suporte completo a Tema Claro e Escuro.

---

## 🎨 1. Tokens de Cores & Variáveis CSS

### Paleta Primária & Secundária
| Token | Cor Hex (Claro) | Cor Hex (Escuro) | Aplicação |
| :--- | :--- | :--- | :--- |
| `--emerald-primary` | `#0D5C3A` | `#10B981` | Ações primárias, botões, estados ativos e identidade fiscal |
| `--emerald-light` | `#168253` | `#34D399` | Hover de botões, destaques e gradientes |
| `--gold-primary` | `#C59B27` | `#FBBF24` | Ações financeiras, Fecho Z, moeda Kwanza e badges |
| `--bg-main` | `#F5F2EB` (Marfim) | `#0A0E14` (Obsidiana) | Fundo da aplicação |
| `--bg-sidebar` | `#FCFAF6` | `#0F141D` | Fundo da barra lateral fixa |
| `--glass-bg` | `rgba(255, 253, 249, 0.78)` | `rgba(15, 20, 29, 0.72)` | Cartões e superfícies translúcidas com blur |
| `--glass-border` | `rgba(13, 92, 58, 0.16)` | `rgba(16, 185, 129, 0.22)` | Contorno de cartões em vidro líquido |

### Semáforo de Estados
* **Sucesso / Regularizado (`--color-ok`):** `#0D5C3A` (Claro) / `#34D399` (Escuro)
* **Atenção / Pendente (`--color-medio`):** `#D97706` (Claro) / `#FBBF24` (Escuro)
* **Crítico / Vencido (`--color-critico`):** `#DC2626` (Claro) / `#F87171` (Escuro)
* **Acompanhar / Informativo (`--color-acompanhar`):** `#2563EB` (Claro) / `#60A5FA` (Escuro)

---

## ✍️ 2. Tipografia

* **Fonte Principal (Interface & Títulos):** `'Plus Jakarta Sans', system-ui, sans-serif`
  * Pesos utilizados: 400 (Regular), 500 (Médio), 600 (Semibold), 700/800 (Bold).
* **Fonte Numérica & Monetária:** `'IBM Plex Mono', monospace`
  * Utilizada obrigatoriamente para todos os valores monetários em Kwanzas (`Kz`), identificadores de faturas (`FT 2026/00142`), NIF de clientes e números de série da AGT, garantindo alinhamento tabular perfeito.

---

## 🖨️ 3. Regras de Impressão Fiscal (`@media print`)

O sistema suporta dois motores de impressão comutáveis via Styled-Components:
1. **Formato Térmico (80mm / 58mm):**
   * Otimizado para impressoras de talão ESC/POS de balcão.
   * Impressão monocromática de alto contraste, logótipo reduzido, discriminação rápida de artigos, totais de IVA e QR Code AGT no rodapé.
2. **Formato A4 Homologado AGT:**
   * Margens padrão de 15mm, cabeçalho fiscal com NIF do emissor e cliente, mapa discriminado de taxas de IVA, menção à certificação do software e 4 caracteres do Hash criptográfico J-1.
