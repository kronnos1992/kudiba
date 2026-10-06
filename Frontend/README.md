# Frontend — ERP Kudiba

Este diretório centraliza todas as aplicações de interface do utilizador (*Frontend*) do ecossistema Kudiba ERP:

## 📱 Aplicações Previstas

1. **Backoffice Web (Next.js SPA / Dashboard Administrativo)**
   - Gestão empresarial, compras, vendas, armazéns, contabilidade e relatórios fiscais.
   - Comunicação via HTTPS com o API Gateway (`https://api.kudiba.ao/api/v1`).

2. **Terminal de Ponto de Venda (Tauri POS — Desktop Edge Offline-First)**
   - Aplicação de caixa de secretária (Rust + Webview) com base de dados local SQLite.
   - Emissão rápida e sincronização em lote com o API Gateway e Motor Fiscal.
