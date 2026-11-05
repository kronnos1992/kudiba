#!/usr/bin/env python3
"""
Gera mockups visuais profissionais em PNG dos ecrãs do Kudiba ERP
para inclusão na documentação comercial em PDF.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = "docs/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Font loading helper
def get_font(size, bold=False):
    sans_path = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf"
    if os.path.exists(sans_path):
        return ImageFont.truetype(sans_path, size)
    return ImageFont.load_default()

def draw_window_frame(draw, width, height, title):
    # Window background
    draw.rectangle([0, 0, width, height], fill="#0f172a") # Dark slate outer
    # Window header bar
    draw.rectangle([0, 0, width, 36], fill="#1e293b")
    # Window controls (mac style)
    draw.ellipse([14, 12, 26, 24], fill="#ef4444")
    draw.ellipse([34, 12, 46, 24], fill="#f59e0b")
    draw.ellipse([54, 12, 66, 24], fill="#10b981")
    # Title
    font_sm = get_font(12, bold=True)
    draw.text((width // 2 - 120, 10), title, fill="#94a3b8", font=font_sm)

def draw_app_shell(width, height, title, active_tab="Dashboard"):
    img = Image.new("RGB", (width, height), "#f8fafc")
    draw = ImageDraw.Draw(img)
    draw_window_frame(draw, width, height, title)
    
    # App Header (under window bar)
    draw.rectangle([0, 36, width, 76], fill="#ffffff")
    draw.line([0, 76, width, 76], fill="#e2e8f0", width=1)
    
    # Logo
    draw.rounded_rectangle([16, 44, 44, 68], radius=6, fill="#0f766e")
    font_logo = get_font(14, bold=True)
    draw.text((23, 47), "K", fill="#ffffff", font=font_logo)
    
    font_brand = get_font(15, bold=True)
    draw.text((52, 47), "Kudiba ERP", fill="#0f172a", font=font_brand)
    
    font_sub = get_font(11)
    draw.text((150, 50), "Empresa: Luanda Comércio & Serviços, Lda (NIF: 5417089123)", fill="#64748b", font=font_sub)
    
    # Right header items
    draw.rounded_rectangle([width - 240, 44, width - 110, 68], radius=4, fill="#f1f5f9")
    draw.text((width - 230, 49), "AGT: Certificado 2026/04", fill="#0f766e", font=get_font(11, bold=True))
    draw.rounded_rectangle([width - 95, 44, width - 16, 68], radius=4, fill="#0f766e")
    draw.text((width - 85, 49), "Online (Sync)", fill="#ffffff", font=get_font(11, bold=True))
    
    # Sidebar
    sidebar_w = 170
    draw.rectangle([0, 76, sidebar_w, height], fill="#ffffff")
    draw.line([sidebar_w, 76, sidebar_w, height], fill="#e2e8f0", width=1)
    
    modules = [
        ("Dashboard", "📊"),
        ("Ponto de Venda (POS)", "🛒"),
        ("Faturação & AGT", "📄"),
        ("Inventário & Stocks", "📦"),
        ("Tesouraria & Caixa", "💰"),
        ("Contabilidade PGC", "📑"),
        ("Recursos Humanos", "👥"),
        ("Auditoria & Licença", "🛡️")
    ]
    
    y = 90
    for mod_name, icon in modules:
        is_active = (mod_name.startswith(active_tab) or active_tab in mod_name)
        if is_active:
            draw.rounded_rectangle([10, y, sidebar_w - 10, y + 32], radius=6, fill="#f0fdf4")
            draw.line([10, y + 4, 10, y + 28], fill="#0f766e", width=3)
            draw.text((22, y + 8), f"{icon} {mod_name[:15]}", fill="#0f766e", font=get_font(11, bold=True))
        else:
            draw.text((22, y + 8), f"{icon} {mod_name[:15]}", fill="#475569", font=get_font(11))
        y += 38
        
    return img, draw, sidebar_w

def generate_dashboard_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Dashboard Executivo & KPIs Financeiros", "Dashboard")
    
    # Content Area
    cx = sb_w + 18
    # Page Title
    draw.text((cx, 90), "Painel Executivo da Empresa", fill="#0f172a", font=get_font(16, bold=True))
    draw.text((cx, 112), "Visão financeira consolidada em Kwanzas (Kz) | Outubro 2026", fill="#64748b", font=get_font(11))
    
    # KPI Cards
    kpis = [
        ("Receita Total Faturada", "128.450.000 Kz", "+12.8% vs mês ant.", "#0f766e", "#f0fdf4"),
        ("Cobranças Realizadas", "96.320.000 Kz", "75% liquidado", "#0284c7", "#f0f9ff"),
        ("Pendente em Cobrança", "32.130.000 Kz", "24 faturas abertas", "#d97706", "#fffbeb"),
        ("Em Risco de Vencimento", "8.240.000 Kz", "6 faturas >30 dias", "#dc2626", "#fef2f2")
    ]
    
    card_w = (w - cx - 18 - 3 * 12) // 4
    for i, (k_title, val, sub, col, bg) in enumerate(kpis):
        bx = cx + i * (card_w + 12)
        by = 135
        draw.rounded_rectangle([bx, by, bx + card_w, by + 85], radius=8, fill=bg, outline="#e2e8f0")
        draw.line([bx, by, bx + 4, by + 85], fill=col, width=4)
        draw.text((bx + 12, by + 10), k_title, fill="#475569", font=get_font(10, bold=True))
        draw.text((bx + 12, by + 32), val, fill="#0f172a", font=get_font(13, bold=True))
        draw.text((bx + 12, by + 60), sub, fill=col, font=get_font(9, bold=True))
        
    # Lower Section: Left = Recent Invoices Table, Right = AGT Compliance & Cash Flow
    tbl_x = cx
    tbl_y = 236
    tbl_w = 440
    tbl_h = 265
    draw.rounded_rectangle([tbl_x, tbl_y, tbl_x + tbl_w, tbl_y + tbl_h], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((tbl_x + 14, tbl_y + 12), "Últimas Faturas Emitidas (Certificação AGT)", fill="#0f172a", font=get_font(12, bold=True))
    
    # Table headers
    draw.rectangle([tbl_x + 10, tbl_y + 36, tbl_x + tbl_w - 10, tbl_y + 58], fill="#f8fafc")
    draw.text((tbl_x + 16, tbl_y + 42), "Documento", fill="#64748b", font=get_font(9, bold=True))
    draw.text((tbl_x + 105, tbl_y + 42), "Cliente / NIF", fill="#64748b", font=get_font(9, bold=True))
    draw.text((tbl_x + 245, tbl_y + 42), "Total (Kz)", fill="#64748b", font=get_font(9, bold=True))
    draw.text((tbl_x + 340, tbl_y + 42), "Hash AGT", fill="#64748b", font=get_font(9, bold=True))
    
    rows = [
        ("FT 2026/00148", "Sonangol Distribuição (5401...)", "14.500.000", "g7K1 (Válido)", "#10b981"),
        ("FT 2026/00147", "Banco BFA S.A. (5402...)", "8.250.000", "p9W3 (Válido)", "#10b981"),
        ("FR 2026/00092", "Unitel Telecom (5403...)", "3.120.000", "x2R8 (Válido)", "#10b981"),
        ("FT 2026/00146", "Movicel SA (5404...)", "5.400.000", "k4T9 (Válido)", "#10b981"),
        ("NC 2026/00012", "Cuca BBI Lda (5405...)", "-450.000", "m1L5 (Válido)", "#f59e0b"),
    ]
    
    ry = tbl_y + 64
    for doc, cli, tot, hsh, st_col in rows:
        draw.text((tbl_x + 16, ry), doc, fill="#0f766e", font=get_font(9, bold=True))
        draw.text((tbl_x + 105, ry), cli[:22], fill="#1e293b", font=get_font(9))
        draw.text((tbl_x + 245, ry), tot, fill="#0f172a", font=get_font(9, bold=True))
        draw.rounded_rectangle([tbl_x + 338, ry - 2, tbl_x + 425, ry + 16], radius=4, fill="#f0fdf4")
        draw.text((tbl_x + 344, ry), hsh, fill=st_col, font=get_font(8, bold=True))
        draw.line([tbl_x + 10, ry + 22, tbl_x + tbl_w - 10, ry + 22], fill="#f1f5f9", width=1)
        ry += 32
        
    # Right Panel: AGT & System Health Box
    r_x = cx + tbl_w + 14
    r_w = w - r_x - 18
    draw.rounded_rectangle([r_x, tbl_y, r_x + r_w, tbl_y + tbl_h], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((r_x + 14, tbl_y + 12), "Conformidade Fiscal & SAF-T (AO)", fill="#0f172a", font=get_font(12, bold=True))
    
    # AGT badge
    draw.rounded_rectangle([r_x + 14, tbl_y + 40, r_x + r_w - 14, tbl_y + 95], radius=6, fill="#f8fafc", outline="#cbd5e1")
    draw.text((r_x + 22, tbl_y + 48), "Cadeia RSA-SHA256: 100% Integra", fill="#0f766e", font=get_font(10, bold=True))
    draw.text((r_x + 22, tbl_y + 64), "Algoritmo: RSA 2048 / SHA-256 encadeado", fill="#475569", font=get_font(9))
    draw.text((r_x + 22, tbl_y + 78), "Série Ativa: 2026/A (Sequência sem lacunas)", fill="#475569", font=get_font(9))
    
    # Export SAF-T box
    draw.rounded_rectangle([r_x + 14, tbl_y + 110, r_x + r_w - 14, tbl_y + 185], radius=6, fill="#f0f9ff", outline="#bae6fd")
    draw.text((r_x + 22, tbl_y + 118), "Ficheiro Mensal SAF-T (AO) 1.01", fill="#0369a1", font=get_font(10, bold=True))
    draw.text((r_x + 22, tbl_y + 136), "Período: Outubro 2026 (148 docs)", fill="#475569", font=get_font(9))
    draw.text((r_x + 22, tbl_y + 150), "Validação Prévia: 0 erros fiscais", fill="#16a34a", font=get_font(9, bold=True))
    draw.rounded_rectangle([r_x + 22, tbl_y + 165, r_x + 140, tbl_y + 182], radius=4, fill="#0284c7")
    draw.text((r_x + 30, tbl_y + 168), "Descarregar XML", fill="#ffffff", font=get_font(8, bold=True))
    
    # Bottom Note
    draw.rounded_rectangle([r_x + 14, tbl_y + 198, r_x + r_w - 14, tbl_y + 250], radius=6, fill="#fefce8", outline="#fef08a")
    draw.text((r_x + 22, tbl_y + 206), "Alvará Comercial Verificado:", fill="#854d0e", font=get_font(9, bold=True))
    draw.text((r_x + 22, tbl_y + 222), "SILAC/MINDCOM Válido até 31/12/2026", fill="#713f12", font=get_font(9))

    img.save(f"{OUTPUT_DIR}/dashboard_executivo.png")

def generate_pos_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Ponto de Venda (POS) & Venda Rápida de Balcão", "Ponto de Venda")
    
    cx = sb_w + 14
    # POS Title & Offline indicator
    draw.text((cx, 88), "Terminal POS #01 — Caixa Central Balcão", fill="#0f172a", font=get_font(15, bold=True))
    draw.rounded_rectangle([w - 230, 86, w - 18, 108], radius=4, fill="#f0fdf4", outline="#86efac")
    draw.text((w - 222, 91), "● Local-First Ativo (Offline Ready)", fill="#16a34a", font=get_font(9, bold=True))
    
    # Left 60%: Product Catalog & Quick Search
    cat_w = 430
    draw.rounded_rectangle([cx, 118, cx + cat_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    
    # Search input
    draw.rounded_rectangle([cx + 10, 128, cx + cat_w - 10, 160], radius=6, fill="#f8fafc", outline="#cbd5e1")
    draw.text((cx + 20, 138), "🔍 Digite nome, código ou passe o leitor de código de barras...", fill="#94a3b8", font=get_font(10))
    
    # Quick Grid of Products
    products = [
        ("Resma Papel A4 80g", "4.500 Kz", "Stock: 142 un", "#0f766e"),
        ("Toner HP LaserJet 85A", "28.000 Kz", "Stock: 18 un", "#0284c7"),
        ("Água Mineral 1.5L (Cx 12)", "2.200 Kz", "Stock: 85 cx", "#d97706"),
        ("Café Ginga 250g", "1.850 Kz", "Stock: 64 un", "#7c3aed"),
        ("Caneta Esferográfica Bic (Cx 50)", "6.500 Kz", "Stock: 29 cx", "#0f766e"),
        ("Impressora Térmica POS 80mm", "65.000 Kz", "Stock: 8 un", "#0284c7"),
    ]
    
    pw = (cat_w - 30) // 2
    ph = 70
    for idx, (pname, pprice, pstock, pcol) in enumerate(products):
        row = idx // 2
        col = idx % 2
        px = cx + 10 + col * (pw + 10)
        py = 175 + row * (ph + 10)
        draw.rounded_rectangle([px, py, px + pw, py + ph], radius=6, fill="#f8fafc", outline="#e2e8f0")
        draw.line([px, py, px + 4, py + ph], fill=pcol, width=4)
        draw.text((px + 10, py + 8), pname[:22], fill="#0f172a", font=get_font(9, bold=True))
        draw.text((px + 10, py + 28), pprice, fill="#0f766e", font=get_font(12, bold=True))
        draw.text((px + 10, py + 50), pstock, fill="#64748b", font=get_font(8))
        draw.rounded_rectangle([px + pw - 45, py + 42, px + pw - 8, py + 62], radius=4, fill="#0f766e")
        draw.text((px + pw - 38, py + 46), "+ Add", fill="#ffffff", font=get_font(8, bold=True))
        
    # Keyboard Shortcuts bar
    draw.rounded_rectangle([cx + 10, 445, cx + cat_w - 10, 488], radius=6, fill="#f1f5f9")
    draw.text((cx + 18, 454), "Atalhos de Teclado Operador:", fill="#475569", font=get_font(9, bold=True))
    draw.text((cx + 18, 470), "[F2] Nova Venda  |  [F4] Quantidade  |  [F9] Finalizar  |  [ESC] Cancelar", fill="#0f766e", font=get_font(8, bold=True))

    # Right 40%: Shopping Cart & Checkout
    cart_x = cx + cat_w + 14
    cart_w = w - cart_x - 14
    draw.rounded_rectangle([cart_x, 118, cart_x + cart_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cart_x + 14, 128), "Cesto de Compras (Venda em Curso)", fill="#0f172a", font=get_font(12, bold=True))
    
    # Cart items
    cart_items = [
        ("Resma Papel A4 80g", "2 un x 4.500", "9.000 Kz"),
        ("Toner HP LaserJet 85A", "1 un x 28.000", "28.000 Kz"),
        ("Água Mineral 1.5L (Cx 12)", "3 cx x 2.200", "6.600 Kz"),
    ]
    cy = 160
    for ciname, ciqty, citot in cart_items:
        draw.text((cart_x + 14, cy), ciname, fill="#1e293b", font=get_font(9, bold=True))
        draw.text((cart_x + 14, cy + 14), ciqty, fill="#64748b", font=get_font(8))
        draw.text((cart_x + cart_w - 80, cy + 6), citot, fill="#0f172a", font=get_font(10, bold=True))
        draw.line([cart_x + 14, cy + 32, cart_x + cart_w - 14, cy + 32], fill="#f1f5f9", width=1)
        cy += 40
        
    # Totals breakdown
    tot_y = 295
    draw.rectangle([cart_x + 10, tot_y, cart_x + cart_w - 10, tot_y + 110], fill="#f8fafc")
    draw.text((cart_x + 18, tot_y + 10), "Subtotal:", fill="#64748b", font=get_font(9))
    draw.text((cart_x + cart_w - 95, tot_y + 10), "43.600,00 Kz", fill="#1e293b", font=get_font(9))
    draw.text((cart_x + 18, tot_y + 30), "IVA (14% Normal):", fill="#64748b", font=get_font(9))
    draw.text((cart_x + cart_w - 95, tot_y + 30), "6.104,00 Kz", fill="#1e293b", font=get_font(9))
    draw.line([cart_x + 18, tot_y + 52, cart_x + cart_w - 18, tot_y + 52], fill="#cbd5e1", width=1)
    draw.text((cart_x + 18, tot_y + 64), "TOTAL A PAGAR:", fill="#0f172a", font=get_font(12, bold=True))
    draw.text((cart_x + cart_w - 125, tot_y + 60), "49.704,00 Kz", fill="#0f766e", font=get_font(15, bold=True))
    
    # Payment Method Buttons
    draw.rounded_rectangle([cart_x + 10, 420, cart_x + 95, 450], radius=4, fill="#0f766e")
    draw.text((cart_x + 22, 428), "💳 TPA / Multicaixa", fill="#ffffff", font=get_font(8, bold=True))
    
    draw.rounded_rectangle([cart_x + 105, 420, cart_x + 185, 450], radius=4, fill="#f1f5f9", outline="#cbd5e1")
    draw.text((cart_x + 118, 428), "💵 Dinheiro", fill="#334155", font=get_font(8, bold=True))
    
    draw.rounded_rectangle([cart_x + 195, 420, cart_x + cart_w - 10, 450], radius=4, fill="#f1f5f9", outline="#cbd5e1")
    draw.text((cart_x + 205, 428), "🔄 Transferência", fill="#334155", font=get_font(8, bold=True))
    
    # Finalize Button
    draw.rounded_rectangle([cart_x + 10, 460, cart_x + cart_w - 10, 490], radius=6, fill="#10b981")
    draw.text((cart_x + 75, 468), "EMITIR FATURA-RECIBO (FR) [F9]", fill="#ffffff", font=get_font(11, bold=True))
    
    img.save(f"{OUTPUT_DIR}/pos_vendas.png")

def generate_invoicing_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Emissão e Certificação Fiscal AGT", "Faturação")
    
    cx = sb_w + 14
    # Header
    draw.text((cx, 88), "Nova Fatura Comercial (FT) — Certificação AGT", fill="#0f172a", font=get_font(15, bold=True))
    draw.rounded_rectangle([w - 180, 86, w - 18, 108], radius=4, fill="#0f766e")
    draw.text((w - 170, 92), "+ Emitir & Assinar RSA", fill="#ffffff", font=get_font(9, bold=True))
    
    # Form layout: Client Data Box
    f_w = w - cx - 18
    draw.rounded_rectangle([cx, 118, cx + f_w, 205], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cx + 14, 126), "Identificação do Cliente & Regime Fiscal", fill="#0f172a", font=get_font(11, bold=True))
    
    # Inputs row
    draw.rounded_rectangle([cx + 14, 148, cx + 240, 186], radius=4, fill="#f8fafc", outline="#cbd5e1")
    draw.text((cx + 20, 153), "Cliente:", fill="#64748b", font=get_font(8))
    draw.text((cx + 20, 168), "TotalEnergies EP Angola", fill="#0f172a", font=get_font(9, bold=True))
    
    draw.rounded_rectangle([cx + 252, 148, cx + 420, 186], radius=4, fill="#f8fafc", outline="#cbd5e1")
    draw.text((cx + 258, 153), "NIF Empresa (10 dígitos):", fill="#64748b", font=get_font(8))
    draw.text((cx + 258, 168), "5418092144 (Válido AGT)", fill="#16a34a", font=get_font(9, bold=True))
    
    draw.rounded_rectangle([cx + 432, 148, cx + 570, 186], radius=4, fill="#f8fafc", outline="#cbd5e1")
    draw.text((cx + 438, 153), "Série Documental:", fill="#64748b", font=get_font(8))
    draw.text((cx + 438, 168), "Série 2026/A", fill="#0f172a", font=get_font(9, bold=True))
    
    draw.rounded_rectangle([cx + 582, 148, cx + f_w - 14, 186], radius=4, fill="#f8fafc", outline="#cbd5e1")
    draw.text((cx + 588, 153), "Retenção na Fonte:", fill="#64748b", font=get_font(8))
    draw.text((cx + 588, 168), "6.5% Serviços (Aplicar)", fill="#0284c7", font=get_font(9, bold=True))
    
    # Items Table Box
    draw.rounded_rectangle([cx, 218, cx + f_w, 400], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cx + 14, 226), "Linhas da Fatura & Impostos", fill="#0f172a", font=get_font(11, bold=True))
    
    # Table header
    draw.rectangle([cx + 10, 246, cx + f_w - 10, 268], fill="#f8fafc")
    draw.text((cx + 16, 252), "Artigo / Descrição", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 270, 252), "Qtd / UoM", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 360, 252), "Preço Unit. (Kz)", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 480, 252), "Taxa IVA", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 570, 252), "Retenção 6.5%", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 665, 252), "Total Líquido", fill="#64748b", font=get_font(9, bold=True))
    
    items = [
        ("Consultoria Técnica de Manutenção Industrial", "40 horas", "75.000", "IVA 14% (Normal)", "195.000 Kz", "3.225.000 Kz"),
        ("Peças Sobresselentes Gerador CAT 250kVA", "2 un", "1.250.000", "IVA 14% (Normal)", "0 Kz (Material)", "2.850.000 Kz"),
        ("Software de Gestão Kudiba (Licença Anual)", "1 lic", "1.800.000", "IVA 14% (Normal)", "117.000 Kz", "1.935.000 Kz"),
    ]
    iy = 276
    for desc, qtd, prc, iva, ret, tot in items:
        draw.text((cx + 16, iy), desc[:38], fill="#1e293b", font=get_font(9, bold=True))
        draw.text((cx + 270, iy), qtd, fill="#475569", font=get_font(9))
        draw.text((cx + 360, iy), prc, fill="#0f172a", font=get_font(9))
        draw.text((cx + 480, iy), iva, fill="#0f766e", font=get_font(9))
        draw.text((cx + 570, iy), ret, fill="#dc2626", font=get_font(9))
        draw.text((cx + 665, iy), tot, fill="#0f172a", font=get_font(9, bold=True))
        draw.line([cx + 10, iy + 22, cx + f_w - 10, iy + 22], fill="#f1f5f9", width=1)
        iy += 32
        
    # Bottom Certification Preview & Totals
    bot_y = 412
    draw.rounded_rectangle([cx, bot_y, cx + 460, 498], radius=6, fill="#f0fdf4", outline="#bbf7d0")
    draw.text((cx + 14, bot_y + 8), "Verificação de Conformidade Fiscal (AGT Angola):", fill="#166534", font=get_font(9, bold=True))
    draw.text((cx + 14, bot_y + 24), "• Assinatura Digital RSA-SHA256 encadeada com a fatura FT 2026/00147.", fill="#15803d", font=get_font(8))
    draw.text((cx + 14, bot_y + 38), "• 4 Caracteres de Controlo AGT gerados: a8F4", fill="#15803d", font=get_font(8, bold=True))
    draw.text((cx + 14, bot_y + 52), "• QR Code Oficial AGT com payload fiscal pronto para impressão.", fill="#15803d", font=get_font(8))
    draw.text((cx + 14, bot_y + 66), "• Código de Isenção / Motivo: N/A (Regime Geral de Tributação)", fill="#15803d", font=get_font(8))
    
    # Totals card
    tot_x = cx + 475
    tot_w = w - tot_x - 18
    draw.rounded_rectangle([tot_x, bot_y, tot_x + tot_w, 498], radius=6, fill="#ffffff", outline="#cbd5e1")
    draw.text((tot_x + 14, bot_y + 8), "Total Ilíquido: 7.300.000 Kz", fill="#475569", font=get_font(9))
    draw.text((tot_x + 14, bot_y + 24), "Total IVA (14%): +1.022.000 Kz", fill="#0f766e", font=get_font(9))
    draw.text((tot_x + 14, bot_y + 40), "Retenção na Fonte (6.5%): -312.000 Kz", fill="#dc2626", font=get_font(9))
    draw.line([tot_x + 14, bot_y + 56, tot_x + tot_w - 14, bot_y + 56], fill="#e2e8f0", width=1)
    draw.text((tot_x + 14, bot_y + 64), "TOTAL FINAL: 8.010.000 Kz", fill="#0f172a", font=get_font(12, bold=True))
    
    img.save(f"{OUTPUT_DIR}/invoicing_certificacao.png")

def generate_inventory_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Gestão de Inventário, Armazéns & UoM", "Inventário")
    
    cx = sb_w + 14
    # Header
    draw.text((cx, 88), "Catálogo de Artigos, Armazéns & Conversão de UoM", fill="#0f172a", font=get_font(15, bold=True))
    draw.rounded_rectangle([w - 220, 86, w - 18, 108], radius=4, fill="#0f766e")
    draw.text((w - 210, 92), "+ Entrada de Mercadoria", fill="#ffffff", font=get_font(9, bold=True))
    
    # Summary cards
    c_w = (w - cx - 18 - 24) // 3
    scards = [
        ("Valor Global em Stock", "84.230.000 Kz", "Preço Médio Ponderado (PMP)", "#0f766e"),
        ("Artigos Abaixo do Mínimo", "14 Referências", "Necessidade de Compra Imediata", "#dc2626"),
        ("Armazéns Ativos", "3 Armazéns", "Viana, Talatona e Porto de Luanda", "#0284c7")
    ]
    for i, (stitle, sval, ssub, scol) in enumerate(scards):
        sx = cx + i * (c_w + 12)
        draw.rounded_rectangle([sx, 118, sx + c_w, 185], radius=6, fill="#ffffff", outline="#e2e8f0")
        draw.line([sx, 118, sx + 4, 185], fill=scol, width=4)
        draw.text((sx + 12, 126), stitle, fill="#64748b", font=get_font(9, bold=True))
        draw.text((sx + 12, 144), sval, fill="#0f172a", font=get_font(12, bold=True))
        draw.text((sx + 12, 166), ssub, fill=scol, font=get_font(8))
        
    # Main Inventory Table
    tbl_y = 198
    f_w = w - cx - 18
    draw.rounded_rectangle([cx, tbl_y, cx + f_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cx + 14, tbl_y + 10), "Listagem de Artigos com Conversão de Unidades (Compra vs Venda)", fill="#0f172a", font=get_font(11, bold=True))
    
    # Table header
    draw.rectangle([cx + 10, tbl_y + 30, cx + f_w - 10, tbl_y + 52], fill="#f8fafc")
    draw.text((cx + 16, tbl_y + 36), "Código / Artigo", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 210, tbl_y + 36), "UoM Compra -> Venda", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 380, tbl_y + 36), "Stock Atual", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 480, tbl_y + 36), "PMP (Custo)", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 575, tbl_y + 36), "PVP Venda", fill="#64748b", font=get_font(9, bold=True))
    draw.text((cx + 660, tbl_y + 36), "Armazém", fill="#64748b", font=get_font(9, bold=True))
    
    items = [
        ("OLEO-01", "Óleo Vegetal Alimentar 1L", "CX (24 UN) -> UN", "340 UN (14.1 CX)", "850 Kz", "1.200 Kz", "Viana (Geral)"),
        ("ARROZ-25", "Arroz Agulha Extra 25kg", "PAL (40 SC) -> SC", "180 SC (4.5 PAL)", "14.200 Kz", "18.500 Kz", "Porto Luanda"),
        ("CIM-50", "Cimento Portland 42.5R 50kg", "PAL (30 SC) -> SC", "450 SC (15 PAL)", "4.800 Kz", "6.200 Kz", "Viana (Geral)"),
        ("LEIT-01", "Leite UHT Gordo 1L", "CX (12 UN) -> UN", "48 UN (4 CX)", "920 Kz", "1.350 Kz", "Talatona (Loja)"),
        ("SUM-330", "Refrigerante Cola Lata 330ml", "CX (24 LT) -> LT", "520 LT (21.6 CX)", "310 Kz", "500 Kz", "Talatona (Loja)"),
        ("AGUA-500", "Água de Mesa 500ml", "CX (24 GF) -> GF", "1.200 GF (50 CX)", "110 Kz", "200 Kz", "Viana (Geral)"),
    ]
    
    iy = tbl_y + 58
    for cod, desc, conv, stk, pmp, pvp, arm in items:
        draw.text((cx + 16, iy), f"[{cod}] {desc[:24]}", fill="#1e293b", font=get_font(9, bold=True))
        draw.rounded_rectangle([cx + 208, iy - 2, cx + 365, iy + 16], radius=4, fill="#f0fdf4")
        draw.text((cx + 214, iy), conv, fill="#166534", font=get_font(8, bold=True))
        draw.text((cx + 380, iy), stk, fill="#0f766e", font=get_font(9, bold=True))
        draw.text((cx + 480, iy), pmp, fill="#475569", font=get_font(9))
        draw.text((cx + 575, iy), pvp, fill="#0f172a", font=get_font(9, bold=True))
        draw.text((cx + 660, iy), arm, fill="#64748b", font=get_font(8))
        draw.line([cx + 10, iy + 22, cx + f_w - 10, iy + 22], fill="#f1f5f9", width=1)
        iy += 32
        
    img.save(f"{OUTPUT_DIR}/inventory_stock.png")

def generate_payroll_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Recursos Humanos & Folha Salarial (IRT/INSS)", "Recursos Humanos")
    
    cx = sb_w + 14
    # Header
    draw.text((cx, 88), "Processamento Salarial & Recibos de Vencimento (Lei Geral Angola)", fill="#0f172a", font=get_font(15, bold=True))
    draw.rounded_rectangle([w - 220, 86, w - 18, 108], radius=4, fill="#0f766e")
    draw.text((w - 210, 92), "+ Processar Folha do Mês", fill="#ffffff", font=get_font(9, bold=True))
    
    # Left: Colaboradores list (45%)
    left_w = 320
    draw.rounded_rectangle([cx, 118, cx + left_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cx + 14, 128), "Colaboradores (Outubro 2026)", fill="#0f172a", font=get_font(11, bold=True))
    
    colabs = [
        ("Manuel António Coxi", "Diretor Financeiro", "1.250.000 Kz", True),
        ("Esperança de Carvalho", "Chefe de Contabilidade", "850.000 Kz", False),
        ("João Baptista Silva", "Técnico de Redes & IT", "550.000 Kz", False),
        ("Maria de Fátima Neto", "Assistente Comercial", "320.000 Kz", False),
        ("Mateus Bento Kapita", "Motorista de Pesados", "240.000 Kz", False),
        ("Ana Paula Domingos", "Caixa Balcão Central", "180.000 Kz", False),
    ]
    cy = 155
    for name, cargo, base, active in colabs:
        bg = "#f0fdf4" if active else "#ffffff"
        draw.rounded_rectangle([cx + 10, cy, cx + left_w - 10, cy + 48], radius=6, fill=bg, outline="#cbd5e1" if active else "#f1f5f9")
        if active:
            draw.line([cx + 10, cy, cx + 14, cy + 48], fill="#0f766e", width=4)
        draw.text((cx + 20, cy + 6), name, fill="#0f172a", font=get_font(9, bold=True))
        draw.text((cx + 20, cy + 24), cargo, fill="#64748b", font=get_font(8))
        draw.text((cx + left_w - 95, cy + 14), base, fill="#0f766e", font=get_font(9, bold=True))
        cy += 54

    # Right: Detailed Payslip (55%)
    r_x = cx + left_w + 14
    r_w = w - r_x - 14
    draw.rounded_rectangle([r_x, 118, r_x + r_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    
    # Recibo header
    draw.rounded_rectangle([r_x + 10, 126, r_x + r_w - 10, 168], radius=6, fill="#f8fafc", outline="#e2e8f0")
    draw.text((r_x + 18, 132), "RECIBO DE VENCIMENTO — OUTUBRO 2026", fill="#0f172a", font=get_font(11, bold=True))
    draw.text((r_x + 18, 148), "Colaborador: Manuel António Coxi | NIF: 005481920LA042 | INSS: 928371948", fill="#64748b", font=get_font(8))
    
    # Breakdown table
    draw.rectangle([r_x + 10, 175, r_x + r_w - 10, 195], fill="#f1f5f9")
    draw.text((r_x + 16, 180), "Rubrica Salarial", fill="#475569", font=get_font(9, bold=True))
    draw.text((r_x + 230, 180), "Rendimento", fill="#166534", font=get_font(9, bold=True))
    draw.text((r_x + 325, 180), "Desconto Legal", fill="#991b1b", font=get_font(9, bold=True))
    
    lines = [
        ("Vencimento Base Mensal", "1.250.000,00 Kz", "-"),
        ("Subsídio de Alimentação (Isento até limite legal)", "60.000,00 Kz", "-"),
        ("Subsídio de Transporte (Isento até limite legal)", "50.000,00 Kz", "-"),
        ("Subsídio de Função / Isenção Horário", "120.000,00 Kz", "-"),
        ("Segurança Social - INSS Trabalhador (3%)", "-", "41.100,00 Kz"),
        ("Segurança Social - INSS Patronal (8% - s/ custo trab.)", "[109.600,00]", "-"),
        ("Imposto sobre o Rendimento do Trabalho (IRT 2026)", "-", "231.425,00 Kz"),
    ]
    ly = 202
    for rub, rend, desc in lines:
        draw.text((r_x + 16, ly), rub[:42], fill="#1e293b", font=get_font(8))
        draw.text((r_x + 230, ly), rend, fill="#166534" if rend != "-" else "#64748b", font=get_font(8, bold=(rend != "-")))
        draw.text((r_x + 325, ly), desc, fill="#dc2626" if desc != "-" else "#64748b", font=get_font(8, bold=(desc != "-")))
        draw.line([r_x + 10, ly + 18, r_x + r_w - 10, ly + 18], fill="#f8fafc", width=1)
        ly += 22
        
    # Net salary banner
    net_y = 368
    draw.rounded_rectangle([r_x + 10, net_y, r_x + r_w - 10, net_y + 65], radius=6, fill="#f0fdf4", outline="#86efac")
    draw.text((r_x + 20, net_y + 10), "Total Rendimentos: 1.480.000 Kz   |   Total Descontos: 272.525 Kz", fill="#475569", font=get_font(9))
    draw.text((r_x + 20, net_y + 32), "LÍQUIDO A RECEBER:", fill="#0f172a", font=get_font(12, bold=True))
    draw.text((r_x + 180, net_y + 28), "1.207.475,00 Kz", fill="#0f766e", font=get_font(15, bold=True))
    
    # Export options
    draw.rounded_rectangle([r_x + 10, 450, r_x + 140, 485], radius=4, fill="#0f766e")
    draw.text((r_x + 22, 460), "📄 Imprimir Recibo PDF", fill="#ffffff", font=get_font(8, bold=True))
    
    draw.rounded_rectangle([r_x + 150, 450, r_x + 300, 485], radius=4, fill="#0284c7")
    draw.text((r_x + 162, 460), "🏦 Exportar Ficheiro PS2", fill="#ffffff", font=get_font(8, bold=True))
    
    img.save(f"{OUTPUT_DIR}/payroll_vencimento.png")

def generate_treasury_screenshot():
    w, h = 920, 520
    img, draw, sb_w = draw_app_shell(w, h, "Kudiba ERP — Tesouraria, Caixa & Previsão de Fluxo", "Tesouraria")
    
    cx = sb_w + 14
    # Header
    draw.text((cx, 88), "Gestão de Caixa, Bancos & Previsão Financeira (Cash Flow)", fill="#0f172a", font=get_font(15, bold=True))
    draw.rounded_rectangle([w - 200, 86, w - 18, 108], radius=4, fill="#0f766e")
    draw.text((w - 190, 92), "+ Pagamento / Recebimento", fill="#ffffff", font=get_font(9, bold=True))
    
    # 3 bank cards
    c_w = (w - cx - 18 - 24) // 3
    accounts = [
        ("Conta Corrente BFA (Kz)", "48.210.500 Kz", "IBAN: AO06.0006.0000.1234.5678.9", "#0f766e"),
        ("Conta BAI Negócios (Kz)", "32.480.000 Kz", "IBAN: AO06.0040.0000.9876.5432.1", "#0284c7"),
        ("Caixa Central / Numerário", "4.150.000 Kz", "Terminal Luanda Sede", "#d97706")
    ]
    for i, (aname, abal, aiban, acol) in enumerate(accounts):
        ax = cx + i * (c_w + 12)
        draw.rounded_rectangle([ax, 118, ax + c_w, 185], radius=6, fill="#ffffff", outline="#e2e8f0")
        draw.line([ax, 118, ax + 4, 185], fill=acol, width=4)
        draw.text((ax + 12, 126), aname, fill="#475569", font=get_font(9, bold=True))
        draw.text((ax + 12, 144), abal, fill="#0f172a", font=get_font(13, bold=True))
        draw.text((ax + 12, 166), aiban[:28], fill="#64748b", font=get_font(8))
        
    # Lower: Cash Flow Projection & Accounts Payable/Receivable
    f_w = w - cx - 18
    tbl_y = 198
    draw.rounded_rectangle([cx, tbl_y, cx + f_w, 498], radius=8, fill="#ffffff", outline="#e2e8f0")
    draw.text((cx + 14, tbl_y + 10), "Previsão de Fluxo de Caixa a 30 Dias & Liquidações Pendentes", fill="#0f172a", font=get_font(11, bold=True))
    
    # Visual Cashflow bar chart mockup
    chart_y = tbl_y + 35
    draw.rectangle([cx + 14, chart_y, cx + f_w - 14, chart_y + 80], fill="#f8fafc", outline="#e2e8f0")
    draw.text((cx + 22, chart_y + 8), "Projeção Semanal de Entradas (Recebimentos) vs Saídas (Pagamentos)", fill="#64748b", font=get_font(8, bold=True))
    
    weeks = [
        ("Semana 1", 28000, 12000),
        ("Semana 2", 34000, 22000),
        ("Semana 3", 18000, 15000),
        ("Semana 4", 42000, 28000),
    ]
    for widx, (wlabel, inflow, outflow) in enumerate(weeks):
        wx = cx + 160 + widx * 125
        # Inflow bar (emerald)
        in_h = int((inflow / 50000) * 45)
        out_h = int((outflow / 50000) * 45)
        base_bar_y = chart_y + 68
        draw.rectangle([wx, base_bar_y - in_h, wx + 18, base_bar_y], fill="#10b981")
        draw.rectangle([wx + 22, base_bar_y - out_h, wx + 40, base_bar_y], fill="#f43f5e")
        draw.text((wx + 4, chart_y + 69), wlabel, fill="#475569", font=get_font(7, bold=True))
        
    draw.text((cx + f_w - 150, chart_y + 10), "■ Entradas (Faturas)", fill="#10b981", font=get_font(8))
    draw.text((cx + f_w - 150, chart_y + 24), "■ Saídas (Fornec./Sal.)", fill="#f43f5e", font=get_font(8))
    
    # Table of Pending Payables
    py = chart_y + 92
    draw.rectangle([cx + 14, py, cx + f_w - 14, py + 22], fill="#f1f5f9")
    draw.text((cx + 20, py + 5), "Fornecedor / Credor", fill="#64748b", font=get_font(8, bold=True))
    draw.text((cx + 230, py + 5), "Doc. Origem", fill="#64748b", font=get_font(8, bold=True))
    draw.text((cx + 340, py + 5), "Vencimento", fill="#64748b", font=get_font(8, bold=True))
    draw.text((cx + 440, py + 5), "Valor Pendente", fill="#64748b", font=get_font(8, bold=True))
    draw.text((cx + 560, py + 5), "Estado / Pagamento", fill="#64748b", font=get_font(8, bold=True))
    
    rows = [
        ("Refinaria de Luanda (Combustíveis)", "FAT-FOR-9021", "10/11/2026", "4.200.000 Kz", "A Pagar (Parcial permit.)", "#d97706"),
        ("ENDE - E.P. (Energia Elétrica)", "REC-ENDE-441", "12/11/2026", "890.000 Kz", "A Pagar (BFA Multicaixa)", "#0f766e"),
        ("EPAL - E.P. (Águas de Luanda)", "REC-EPAL-109", "15/11/2026", "340.000 Kz", "A Pagar", "#0f766e"),
        ("ZAP Fibra Empresarial", "ZAP-CORP-8832", "18/11/2026", "185.000 Kz", "Agendado Débito Direto", "#0284c7"),
    ]
    ry = py + 26
    for forn, doc, venc, val, st, col in rows:
        draw.text((cx + 20, ry), forn[:32], fill="#1e293b", font=get_font(8, bold=True))
        draw.text((cx + 230, ry), doc, fill="#475569", font=get_font(8))
        draw.text((cx + 340, ry), venc, fill="#475569", font=get_font(8))
        draw.text((cx + 440, ry), val, fill="#0f172a", font=get_font(8, bold=True))
        draw.text((cx + 560, ry), st, fill=col, font=get_font(8, bold=True))
        draw.line([cx + 14, ry + 16, cx + f_w - 14, ry + 16], fill="#f8fafc", width=1)
        ry += 20
        
    img.save(f"{OUTPUT_DIR}/treasury_fluxo_caixa.png")

if __name__ == "__main__":
    generate_dashboard_screenshot()
    generate_pos_screenshot()
    generate_invoicing_screenshot()
    generate_inventory_screenshot()
    generate_payroll_screenshot()
    generate_treasury_screenshot()
    print("All 6 screenshots generated successfully in docs/screenshots!")
