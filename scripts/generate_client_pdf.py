#!/usr/bin/env python3
"""
Gerador da Apresentação Comercial e Guia do Utilizador em PDF do Kudiba ERP.
Produz um documento profissional de alta fidelidade para entrega a clientes.
"""
import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

PDF_PATH = "docs/Kudiba_ERP_Apresentacao_e_Guia_do_Utilizador.pdf"
os.makedirs("docs", exist_ok=True)

# ----------------------------------------------------------------------
# Numbered Canvas para Cabeçalhos e Rodapés com "Página X de Y"
# ----------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Página de capa não leva cabeçalho nem rodapé
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Cabeçalho
        self.drawString(36, 806, "KUDIBA ERP — Sistema Integrado de Gestão Empresarial para Angola")
        self.drawRightString(559, 806, "Apresentação Comercial & Manual")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.6)
        self.line(36, 800, 559, 800)

        # Rodapé
        self.line(36, 40, 559, 40)
        self.drawString(36, 28, "Confidencial | Proposta Comercial & Documentação Oficial")
        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(559, 28, page_str)

        # Barra decorativa de cor esmeralda no topo
        self.setFillColor(colors.HexColor("#0f766e"))
        self.rect(36, 818, 523, 3, fill=True, stroke=False)

        self.restoreState()


# ----------------------------------------------------------------------
# Construtor do Documento
# ----------------------------------------------------------------------
def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Cores Corporativas
    c_primary = colors.HexColor("#0f766e")      # Emerald
    c_primary_dark = colors.HexColor("#0f172a") # Dark Slate
    c_accent = colors.HexColor("#0284c7")       # Sky Blue
    c_warn = colors.HexColor("#d97706")         # Amber
    c_danger = colors.HexColor("#dc2626")       # Red
    c_dark = colors.HexColor("#1e293b")         # Body dark
    c_muted = colors.HexColor("#64748b")        # Slate light
    c_light = colors.HexColor("#f8fafc")        # Table bg
    c_border = colors.HexColor("#e2e8f0")       # Border

    # Estilos de Texto
    style_cover_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=30,
        leading=36,
        textColor=c_primary_dark,
        alignment=0,
        spaceAfter=10
    )

    style_cover_sub = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=15,
        leading=20,
        textColor=c_primary,
        alignment=0,
        spaceAfter=20
    )

    style_h1 = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=21,
        textColor=c_primary,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    style_h2 = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=c_primary_dark,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    style_body = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13.5,
        textColor=c_dark,
        spaceAfter=6
    )

    style_body_bold = ParagraphStyle(
        "Body_Bold",
        parent=style_body,
        fontName="Helvetica-Bold"
    )

    style_bullet = ParagraphStyle(
        "Bullet_Custom",
        parent=style_body,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=4
    )

    style_callout = ParagraphStyle(
        "Callout_Text",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=13,
        textColor=colors.HexColor("#065f46")
    )

    style_tbl_cell = ParagraphStyle(
        "TblCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11.5,
        textColor=c_dark
    )

    style_tbl_header = ParagraphStyle(
        "TblHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.white
    )

    elements = []

    # ==================================================================
    # 1. PÁGINA DE CAPA (Cover Page)
    # ==================================================================
    elements.append(Spacer(1, 20))
    
    # Barra colorida superior da capa
    capa_header_tbl = Table(
        [[
            Paragraph("<font color='white' size=14><b>KUDIBA TECH</b></font><br/><font color='#a7f3d0' size=9>Sistemas e Tecnologias de Gestão Empresarial</font>", style_cover_title),
            Paragraph("<font color='white' size=9><b>MERCADO DE ANGOLA & PALOP</b><br/>Edição Comercial 2026</font>", ParagraphStyle("Right", parent=styles["Normal"], alignment=2))
        ]],
        colWidths=[340, 183]
    )
    capa_header_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_primary),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
    ]))
    elements.append(capa_header_tbl)

    elements.append(Spacer(1, 45))
    elements.append(Paragraph("KUDIBA ERP", style_cover_title))
    elements.append(Paragraph("A Nova Geração de Gestão Empresarial para Angola", style_cover_sub))
    elements.append(Paragraph(
        "Plataforma modular cloud-native e edge-ready desenvolvida especificamente para a realidade operacional angolana: "
        "faturação certificada pela AGT, ponto de venda offline com sincronização automática, gestão de stocks multi-unidade, "
        "processamento salarial com tabela IRT 2026/INSS, contabilidade PGC e verificação de alvarás comerciais em tempo real.",
        style_body
    ))

    elements.append(Spacer(1, 25))

    # Destaques em Cartões
    badges = [
        [
            Paragraph("<b>🛡️ Certificação AGT Nativa</b><br/><font size=7.5 color='#64748b'>Assinatura RSA-2048/SHA-256 encadeada, SAF-T (AO) 1.01 e QR Code fiscal homologado.</font>", style_tbl_cell),
            Paragraph("<b>⚡ Arquitetura Cloud & Offline</b><br/><font size=7.5 color='#64748b'>POS local-first funciona sem internet e sincroniza quando a ligação regressa.</font>", style_tbl_cell)
        ],
        [
            Paragraph("<b>🚀 Alto Desempenho em Rust</b><br/><font size=7.5 color='#64748b'>Microsserviços de faturação e inventário em Rust com latência sub-10ms.</font>", style_tbl_cell),
            Paragraph("<b>📉 Poupança de até 65% no TCO</b><br/><font size=7.5 color='#64748b'>Sem custos de licenças Microsoft SQL Server ou Windows Server em divisas.</font>", style_tbl_cell)
        ],
        [
            Paragraph("<b>🏛️ Validação Oficial de Alvarás</b><br/><font size=7.5 color='#64748b'>Verificação em tempo real com SILAC/MINDCOM, GUE, SEPE e AGT.</font>", style_tbl_cell),
            Paragraph("<b>👥 RH com IRT 2026 & INSS</b><br/><font size=7.5 color='#64748b'>Cálculo automático de escalões do IRT, INSS (3% + 8%) e ficheiro bancário PS2.</font>", style_tbl_cell)
        ]
    ]
    b_table = Table(badges, colWidths=[255, 255])
    b_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.8, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(b_table)

    elements.append(Spacer(1, 55))

    # Metadados de Rodapé da Capa
    capa_meta = [
        [
            Paragraph("<b>Destinatário:</b> Administração, Direção Geral e Direção de TI", style_body),
            Paragraph("<b>Documento:</b> Apresentação Comercial & Manual Técnico", style_body)
        ],
        [
            Paragraph("<b>Versão do Sistema:</b> Kudiba ERP v2.5 (Edição Corporativa)", style_body),
            Paragraph("<b>Data:</b> Novembro de 2026 | Luanda, Angola", style_body)
        ],
        [
            Paragraph("<b>Contacto Comercial:</b> comercial@kudiba.ao<br/>📞 (+244) 929 774 155 / 954 803 229 / 925 171 233", style_body),
            Paragraph("<b>Website:</b> www.kudiba.ao", style_body)
        ]
    ]
    meta_table = Table(capa_meta, colWidths=[260, 260])
    meta_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, c_primary),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(meta_table)

    elements.append(PageBreak())

    # ==================================================================
    # 2. SUMÁRIO EXECUTIVO & ÍNDICE
    # ==================================================================
    elements.append(Paragraph("Índice Geral do Documento", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=14))

    indice_data = [
        [Paragraph("<b>Capítulo 1: Introdução ao Kudiba ERP</b>", style_body_bold), Paragraph("<b>Pág. 3</b>", style_body_bold)],
        [Paragraph("  1.1 O que é o Kudiba ERP e Visão da Plataforma", style_body), Paragraph("3", style_body)],
        [Paragraph("  1.2 O Diagnóstico dos Softwares Existentes em Angola (Primavera, PHC, Sage)", style_body), Paragraph("3", style_body)],
        [Paragraph("  1.3 O que o Kudiba Traz de Novo (Inovações Chave)", style_body), Paragraph("4", style_body)],
        [Paragraph("  1.4 Tabela Comparativa Detalhada: Kudiba vs Softwares Tradicionais", style_body), Paragraph("4", style_body)],
        [Paragraph("<b>Capítulo 2: Módulos e Funcionalidades Detalhadas</b>", style_body_bold), Paragraph("<b>Pág. 5</b>", style_body_bold)],
        [Paragraph("  2.1 KudibaInvoicing — Faturação Comercial e Certificada AGT", style_body), Paragraph("5", style_body)],
        [Paragraph("  2.2 KudibaInventory — Gestão de Stocks, Armazéns e Conversão UoM", style_body), Paragraph("6", style_body)],
        [Paragraph("  2.3 KudibaTreasury — Tesouraria, Caixa, Contas a Pagar e Receber", style_body), Paragraph("7", style_body)],
        [Paragraph("  2.4 KudibaAccounting — Contabilidade Geral e Analítica PGC", style_body), Paragraph("8", style_body)],
        [Paragraph("  2.5 KudibaPayroll — Recursos Humanos, Folha Salarial e IRT/INSS", style_body), Paragraph("9", style_body)],
        [Paragraph("  2.6 KudibaBackoffice & Governança — Licenças e Validação de Alvará", style_body), Paragraph("10", style_body)],
        [Paragraph("  2.7 KudibaIntegrations & Gateway — API Aberta e Webhooks", style_body), Paragraph("10", style_body)],
        [Paragraph("<b>Capítulo 3: Custos, Licenciamento e Curva de Aprendizagem</b>", style_body_bold), Paragraph("<b>Pág. 11</b>", style_body_bold)],
        [Paragraph("  3.1 Modelos de Subscrição em Kwanzas (Sem Risco Cambial)", style_body), Paragraph("11", style_body)],
        [Paragraph("  3.2 Matriz de Planos e Preçário Indicativo", style_body), Paragraph("11", style_body)],
        [Paragraph("  3.3 Análise de Custo Total de Propriedade (TCO) a 3 Anos", style_body), Paragraph("12", style_body)],
        [Paragraph("  3.4 Curva de Aprendizagem e Metodologia de Onboarding", style_body), Paragraph("12", style_body)],
        [Paragraph("<b>Capítulo 4: Screenshots e Guia Prático do Utilizador</b>", style_body_bold), Paragraph("<b>Pág. 13</b>", style_body_bold)],
        [Paragraph("  4.1 Painel Executivo & Dashboard Financeiro", style_body), Paragraph("13", style_body)],
        [Paragraph("  4.2 Ponto de Venda (POS) & Operação de Caixa Offline", style_body), Paragraph("14", style_body)],
        [Paragraph("  4.3 Emissão de Faturas e Documentos Certificados AGT", style_body), Paragraph("15", style_body)],
        [Paragraph("  4.4 Gestão de Inventário e Conversão de Embalagens", style_body), Paragraph("16", style_body)],
        [Paragraph("  4.5 Processamento de Salários e Emissão de Recibo de Vencimento", style_body), Paragraph("17", style_body)],
        [Paragraph("  4.6 Gestão de Tesouraria e Projeção de Fluxo de Caixa", style_body), Paragraph("18", style_body)],
        [Paragraph("<b>Capítulo 5: FAQ Comercial, Contactos e Implementação</b>", style_body_bold), Paragraph("<b>Pág. 19</b>", style_body_bold)],
    ]
    ind_table = Table(indice_data, colWidths=[450, 65])
    ind_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor("#f1f5f9")),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(ind_table)

    elements.append(Spacer(1, 15))

    # Caixa de Destaque Executivo
    exec_box = [
        [Paragraph(
            "<b>MENSAGEM DA EQUIPA KUDIBA:</b><br/>"
            "O Kudiba foi concebido por engenheiros e consultores financeiros que viveram as dores reais do mercado angolano: "
            "quedas repentinas de internet no ponto de venda que bloqueiam as vendas, faturas que falham nas validações da AGT, "
            "custos astronómicos de licenças atreladas ao Dólar/Euro e sistemas pesados que exigem servidores caros. "
            "O Kudiba é a resposta tecnológica de Angola para a África contemporânea: leve, fiável, 100% legal e com custo justo.",
            style_callout
        )]
    ]
    eb_table = Table(exec_box, colWidths=[515])
    eb_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#ecfdf5")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#a7f3d0")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    elements.append(eb_table)

    elements.append(PageBreak())

    # ==================================================================
    # 3. CAPÍTULO 1: INTRODUÇÃO AO KUDIBA ERP
    # ==================================================================
    elements.append(Paragraph("1. Introdução ao Kudiba ERP", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=10))

    elements.append(Paragraph("1.1 O que é o Kudiba ERP?", style_h2))
    elements.append(Paragraph(
        "O <b>Kudiba ERP</b> é uma solução integrada de gestão empresarial de 4.ª geração (*Cloud-Native* e *Edge-Ready*), "
        "criada para gerir com rigor, agilidade e total conformidade legal empresas comerciais, industriais e de serviços "
        "a operar em Angola e na região dos PALOP. O nome <i>Kudiba</i> (expressão ligada ao trabalho e à produtividade) "
        "reflete a nossa missão: dotar os gestores e equipas operacionais de ferramentas fiáveis que eliminem tarefas manuais repetitivas "
        "e garantam segurança fiscal inabalável perante as autoridades.",
        style_body
    ))
    elements.append(Paragraph(
        "A plataforma cobre de forma unificada os 5 pilares estruturais da empresa: "
        "<b>(1) Faturação & Vendas Certificadas</b>, <b>(2) Inventário & Armazéns Multi-Unidade</b>, "
        "<b>(3) Tesouraria, Caixa & Bancos</b>, <b>(4) Contabilidade Geral & Analítica PGC</b> e "
        "<b>(5) Gestão de Pessoas, Folha Salarial & IRT</b>.",
        style_body
    ))

    elements.append(Spacer(1, 6))
    elements.append(Paragraph("1.2 O Diagnóstico do Mercado: Por que os Softwares Tradicionais Falham em Angola?", style_h2))
    elements.append(Paragraph(
        "Durante mais de duas décadas, as empresas angolanas viram-se obrigadas a adotar softwares legados desenhados nos anos 90 "
        "(como Primavera/Cegid, PHC ou Sage), construídos sob uma arquitetura cliente-servidor para Windows. Na prática, este modelo tradicional impõe:",
        style_body
    ))
    elements.append(Paragraph("• <b>Custos Proibitivos e Dependência Cambial:</b> Licenças cobradas por posto e por módulo, habitualmente indexadas ao Euro ou Dólar, somadas a custos exorbitantes de licenciamento Microsoft (Windows Server e MS SQL Server).", style_bullet))
    elements.append(Paragraph("• <b>Paragem das Vendas na Queda da Internet:</b> Quando a ligação de internet ou a VPN da loja falha, os sistemas cloud tradicionais deixam de emitir faturas e registar vendas no balcão, paralisando a faturação e gerando filas de clientes insatisfeitos.", style_bullet))
    elements.append(Paragraph("• <b>Morosidade nas Atualizações Fiscais da AGT:</b> Cada alteração legislativa (novos regimes de IVA, atualização do Código do IRT ou alterações ao ficheiro SAF-T AO) exige deslocações de consultores técnicos e aplicação de <i>patches</i> demorados e onerosos.", style_bullet))
    elements.append(Paragraph("• <b>Interfaces Pesadas e Pouco Ergonómicas:</b> Centenas de janelas modais sobrepostas e navegação lenta que obrigam a semanas de formação e elevam o risco de erros humanos por operadores de caixa e faturistas.", style_bullet))

    elements.append(Spacer(1, 6))
    elements.append(Paragraph("1.3 O que o Kudiba Traz de Novo? (Diferenciais Inovadores)", style_h2))
    elements.append(Paragraph(
        "O Kudiba foi desenhado do zero com recurso às tecnologias mais avançadas da engenharia de software contemporânea, "
        "trazendo diferenciais que não existem nos ERPs convencionais:",
        style_body
    ))

    inovacoes = [
        ("⚡ Tecnologia Híbrida Cloud & Local-First (POS Offline Resiliente)",
         "O Ponto de Venda (POS) do Kudiba opera localmente na máquina do operador, sem qualquer dependência de internet. As vendas continuam a ser efetuadas, com cálculo de impostos e impressão instantânea. Assim que a conectividade é restabelecida, os documentos são sincronizados de forma transparente e segura com o servidor central."),
        ("🛡️ Motor Fiscal e Criptográfico AGT Isolado e Imutável",
         "O módulo de faturação implementa a estrita cadeia de assinaturas RSA-2048 com algoritmo SHA-256 (Decreto Presidencial n.º 71/25). A integridade do hash do documento anterior é mantida de forma matematicamente inviolável, garantindo que o ficheiro SAF-T (AO) mensal seja exportado com zero erros de validação."),
        ("🏛️ Verificação Oficial de Alvarás Comerciais em Tempo Real",
         "Pela primeira vez num ERP em Angola, o Kudiba integra um motor de validação automatizada de Alvarás Comerciais cruzando os dados das plataformas oficiais: SILAC/MINDCOM, GUE, SEPE e AGT. O sistema valida prazos de validade, formato regulamentar e consistência com o NIF da empresa, prevenindo multas e irregularidades."),
        ("🚀 Núcleo de Alta Velocidade em Rust",
         "Os serviços críticos de faturação, inventário e tesouraria são compilados em Rust. Isso garante latências de resposta inferiores a 10 milissegundos, consumo mínimo de memória RAM e capacidade para processar milhões de linhas de faturação sem lentidão."),
        ("🔒 Trilha de Auditoria Universal Imutável",
         "Todas as operações críticas (criação de documentos, anulações, alterações de preços, liquidações e processamento de salários) são auditadas automaticamente com registo do IP, utilizador, data/hora e hash de integridade, assegurando governação corporativa total.")
    ]

    for ititle, idesc in inovacoes:
        elements.append(Paragraph(f"<b>{ititle}</b>", style_body_bold))
        elements.append(Paragraph(idesc, style_bullet))

    elements.append(Spacer(1, 6))
    elements.append(Paragraph("1.4 Matriz Comparativa: Kudiba vs ERPs Tradicionais", style_h2))

    comp_headers = [
        Paragraph("<b>Critério de Comparação</b>", style_tbl_header),
        Paragraph("<b>ERPs Legados (Primavera, PHC, Sage)</b>", style_tbl_header),
        Paragraph("<b>Kudiba ERP (Nova Geração)</b>", style_tbl_header)
    ]
    comp_rows = [
        comp_headers,
        [
            Paragraph("<b>Arquitetura Base</b>", style_tbl_cell),
            Paragraph("Monolítica anos 90, adaptada com camadas web lentas.", style_tbl_cell),
            Paragraph("<b>Microsserviços em Rust + Python, Cloud e Edge-Ready.</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Operação Offline no Balcão</b>", style_tbl_cell),
            Paragraph("Inexistente ou limitada. Queda de rede bloqueia o POS.", style_tbl_cell),
            Paragraph("<b>Local-First nativo: fatura offline e sincroniza em lote.</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Infraestrutura & BD</b>", style_tbl_cell),
            Paragraph("Obrigatório Windows Server e licenças caras MS SQL Server.", style_tbl_cell),
            Paragraph("<b>100% Linux, PostgreSQL e containers leves (Zero licença BD).</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Preços e Moeda</b>", style_tbl_cell),
            Paragraph("Valores indexados ao USD/EUR sujeitos a desvalorização cambial.", style_tbl_cell),
            Paragraph("<b>Preço fixo transparente em Kwanzas (Kz), sem surpresas.</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Validação de Alvarás</b>", style_tbl_cell),
            Paragraph("Manual, fora do sistema.", style_tbl_cell),
            Paragraph("<b>Verificação automática em tempo real (SILAC/MINDCOM/AGT).</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Curva de Aprendizagem</b>", style_tbl_cell),
            Paragraph("3 a 6 meses. Menus labirínticos e janelas complexas.", style_tbl_cell),
            Paragraph("<b>Produtividade em 48 horas: interface moderna e atalhos.</b>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Integração Externa</b>", style_tbl_cell),
            Paragraph("Módulos de integração pagos, APIs SOAP lentas.", style_tbl_cell),
            Paragraph("<b>API REST moderna, Webhooks e documentação OpenAPI nativa.</b>", style_tbl_cell)
        ],
    ]
    comp_table = Table(comp_rows, colWidths=[110, 200, 205])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(comp_table)

    elements.append(PageBreak())

    # ==================================================================
    # 4. CAPÍTULO 2: MÓDULOS E SUAS FUNCIONALIDADES DETALHADAS
    # ==================================================================
    elements.append(Paragraph("2. Módulos e Funcionalidades Detalhadas", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=10))

    # 2.1 KudibaInvoicing
    elements.append(Paragraph("2.1 KudibaInvoicing — Faturação Comercial e Certificada AGT", style_h2))
    elements.append(Paragraph(
        "O módulo <b>KudibaInvoicing</b> constitui o núcleo transacional e fiscal do sistema, construído em estrita obediência "
        "ao <b>Decreto Presidencial n.º 71/25</b> e regulamentação da Administração Geral Tributária (AGT) de Angola.",
        style_body
    ))
    
    inv_features = [
        ("Tipologia Integral de Documentos Comerciais", "Emissão, impressão e gestão de Faturas (FT), Faturas-Recibo (FR), Notas de Crédito (NC), Notas de Débito (ND), Faturas Pró-Forma (PP), Orçamentos (OR) e Guias de Transporte/Remessa (GT/GR)."),
        ("Assinatura Criptográfica RSA em Cadeia", "Chaves assimétricas RSA-2048 bits com algoritmo de assinatura SHA-256 encadeado: cada fatura incorpora no cálculo do hash o hash do documento anterior, assegurando sequência cronológica inviolável."),
        ("Geração Automática do QR Code Fiscal e 4 Caracteres", "Impressão direta no rodapé de cada fatura do QR Code fiscal exigido pela AGT com payload codificado e exibição destacada dos 4 caracteres de validação (1.º, 11.º, 21.º e 31.º do hash)."),
        ("Gestão de Regimes de IVA e Isenções", "Configuração dinâmica do Regime Geral de IVA (14%), Regimes Simplificados ou Transitórios, e aplicação rigorosa das tabelas de códigos de motivo de isenção da AGT (ex: M00, M10, M20) com menção legal impressa."),
        ("Retenção na Fonte Automatizada (6.5%)", "Cálculo e desconto automático da taxa de retenção na fonte de 6.5% na prestação de serviços a entidades obrigadas a reter, gerando os respetivos destaques na fatura e no balancete."),
        ("Exportação Oficial SAF-T (AO) 1.01", "Geração do ficheiro XML SAF-T (AO) em conformidade estrita com o XSD oficial, com validador sintático prévio que bloqueia erros antes do envio ao portal do contribuinte da AGT.")
    ]
    for ftitle, fdesc in inv_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(Spacer(1, 8))

    # 2.2 KudibaInventory
    elements.append(Paragraph("2.2 KudibaInventory — Gestão de Stocks, Armazéns e Logística", style_h2))
    elements.append(Paragraph(
        "Desenvolvido em Rust de alto rendimento, o <b>KudibaInventory</b> elimina discrepâncias entre o inventário físico "
        "e o inventário contabilístico, gerindo múltiplos armazéns e complexidades logísticas com precisão milimétrica.",
        style_body
    ))
    
    inv_stock_features = [
        ("Conversão Automática de Unidades de Medida (UoM)", "Suporte à compra em embalagens agregadas (ex: Paletes de 40 sacos, Caixas de 24 garrafas, Fardos) com desagregação automática para a unidade de venda a retalho com rastreio de fatores de conversão."),
        ("Custo Médio Ponderado (PMP) em Tempo Real", "Recálculo instantâneo do Preço Médio Ponderado a cada receção de compras, integrando custos de frete, direitos aduaneiros e despesas acessórias."),
        ("Controlo Multi-Armazém e Transferências Internas", "Gestão simultânea de armazéns centrais, lojas, depósitos transitórios e viaturas de distribuição, com guias de transferência numeradas e controlo de receção com conferência cega."),
        ("Rastreabilidade por Lotes e Prazos de Validade", "Gestão estrita de lotes com alertas preditivos para produtos perecíveis (FIFO/FEFO), essencial para empresas do setor farmacêutico, alimentar e químico."),
        ("Inventários Físicos e Reconciliação Periódica", "Processos estruturados de contagem física (cega ou guiada por leitor de código de barras), com apuramento automático de quebras, sobras e geração de documentos de regularização.")
    ]
    for ftitle, fdesc in inv_stock_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(Spacer(1, 8))

    # 2.3 KudibaTreasury
    elements.append(Paragraph("2.3 KudibaTreasury — Gestão Financeira, Caixa e Contas a Pagar/Receber", style_h2))
    elements.append(Paragraph(
        "O <b>KudibaTreasury</b> garante controlo rigoroso da liquidez empresarial, transformando faturas em dinheiro real "
        "e prevenindo desvios financeiros ou incumprimentos com credores.",
        style_body
    ))
    
    tre_features = [
        ("Gestão de Caixas e Terminais de Pagamento (TPA)", "Abertura, conferência intermédia e fecho cego de caixas diários, com reconciliação detalhada por meio de pagamento: Numerário, TPA Multicaixa, Transferência Bancária e Depósito."),
        ("Liquidações Parciais e Totais com Emissão de Recibos (RC)", "Suporte completo a pagamentos parcelados de faturas de clientes e fornecedores, com emissão de Recibos RC certificados e atualização imediata do saldo em dívida."),
        ("Análise de Antiguidade de Saldos (Aging de Dívidas)", "Painel visual estratificado por intervalos temporais (< 30 dias, 30-60 dias, 60-90 dias, > 90 dias) para priorização inteligente de cobranças e controlo de crédito a clientes."),
        ("Previsão Dinâmica de Fluxo de Caixa (Cash Flow)", "Projeção a 30, 60 e 90 dias que cruza faturas a receber, compromissos com fornecedores, estimativas de salários e impostos, alertando antecipadamente sobre eventuais défices de tesouraria."),
        ("Gestão Multimoeda e Contas Bancárias", "Gestão de saldos bancários em Kwanza (AOA), Dólar (USD) e Euro (EUR), com registo de taxas de câmbio diárias e apuramento de diferenças de câmbio realizadas.")
    ]
    for ftitle, fdesc in tre_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(PageBreak())

    # 2.4 KudibaAccounting
    elements.append(Paragraph("2.4 KudibaAccounting — Contabilidade Geral e Analítica (PGC Angolano)", style_h2))
    elements.append(Paragraph(
        "Concebido segundo o <b>Plano Geral de Contabilidade (PGC) de Angola</b>, o <b>KudibaAccounting</b> automatiza "
        "a integração dos atos comerciais diretamente nos diários de lançamentos, poupando centenas de horas à equipa contabilística.",
        style_body
    ))
    
    acc_features = [
        ("Plano de Contas PGC Pré-Configurado", "Estrutura completa das Classes 1 a 8 do PGC Angolano com parametrização de contas de movimento e suporte a planos de contas setoriais."),
        ("Lançamentos Automáticos a Partir da Faturação e Caixa", "Cada fatura emitida, recebimento ou liquidação gera automaticamente a respetiva partida dobrada no diário contabilístico adequado (Vendas, Compras, Caixa, Operações Diversas)."),
        ("Contabilidade Analítica por Centros de Custos", "Imputação de receitas e despesas a Projetos, Obras, Delegações Provinciais ou Departamentos, fornecendo demonstrações de resultados discriminadas por centro de responsabilidade."),
        ("Balancetes de Verificação Instantâneos", "Emissão de Balancetes a 2, 4 e 6 colunas em segundos, com filtros por período e análise de consistência de débitos e créditos."),
        ("Demonstração de Resultados e Balanço", "Relatórios financeiros formais prontos para apresentação a bancos, acionistas e anexos fiscais para o Modelo 1 do Imposto Industrial.")
    ]
    for ftitle, fdesc in acc_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(Spacer(1, 8))

    # 2.5 KudibaPayroll
    elements.append(Paragraph("2.5 KudibaPayroll — Recursos Humanos, Folha Salarial e IRT/INSS", style_h2))
    elements.append(Paragraph(
        "O <b>KudibaPayroll</b> assegura o cumprimento integral da <b>Lei Geral do Trabalho de Angola</b> e do <b>Código do IRT</b>, "
        "processando salários em lote com máxima segurança e privacidade.",
        style_body
    ))
    
    pay_features = [
        ("Motor Legal de Cálculo do IRT (Tabela Oficial)", "Aplicação estrita dos escalões do IRT de Angola, parcelas fixas e deduções legais para trabalhadores por conta de outrem (Grupo A) e prestadores de serviços independentes (Grupo B)."),
        ("Segurança Social - INSS Automático", "Cálculo e retenção dos 3% do trabalhador e apuramento dos 8% da contribuição patronal da empresa, com emissão do mapa oficial para a Segurança Social."),
        ("Gestão de Remunerações Variáveis e Subsídios", "Parametrização de Subsídio de Alimentação e Transporte (com cálculo dos limites legais de isenção), Subsídio de Férias, 13.º Mês (Natal), Horas Extras e Avenças."),
        ("Controlo de Assiduidade, Faltas e Férias", "Registo de presenças, faltas justificadas/injustificadas com desconto proporcional e gestão do plano de férias anual de cada colaborador."),
        ("Ficheiro Bancário PS2 e Recibos Individuais em PDF", "Exportação do ficheiro normalizado de transferências salariais bancárias (Multicaixa PS2 / GPO) e geração de recibos de vencimento confidenciais prontos para envio por email.")
    ]
    for ftitle, fdesc in pay_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(Spacer(1, 8))

    # 2.6 KudibaBackoffice & Governança
    elements.append(Paragraph("2.6 KudibaBackoffice & Governança — Gestão de Licenças e Alvarás", style_h2))
    elements.append(Paragraph(
        "O módulo central de governança permite à administração da empresa gerir múltiplos estabelecimentos, delegar permissões "
        "com granularidade RBAC e garantir a conformidade institucional contínua.",
        style_body
    ))
    
    back_features = [
        ("Verificador Oficial de Alvará Comercial", "Motor que valida em segundos a legitimidade, prazo e status do alvará nas plataformas SILAC/MINDCOM, GUE, SEPE e AGT, evitando que a empresa opere com documentos comerciais caducados."),
        ("Gestão de Estabelecimentos e Postos de Faturação", "Parametrização de séries documentais distintas por loja ou filial com controlo centralizado de licenças ativas e renovação anual."),
        ("Trilha de Auditoria Universal", "Registo permanente de quem acedeu, quem criou ou quem alterou qualquer dado na plataforma, essencial para auditorias internas e inspeções da AGT.")
    ]
    for ftitle, fdesc in back_features:
        elements.append(Paragraph(f"• <b>{ftitle}:</b> {fdesc}", style_bullet))

    elements.append(Spacer(1, 8))

    # 2.7 KudibaIntegrations
    elements.append(Paragraph("2.7 KudibaIntegrations & Gateway — Arquitetura Aberta para o Futuro", style_h2))
    elements.append(Paragraph(
        "Ao contrário dos sistemas fechados que cobram fortunas para conectar sistemas externos, o Kudiba possui uma **API aberta (REST & Webhooks)** "
        "que permite ligar a plataforma a lojas online (e-Commerce), aplicações móveis, sistemas de fidelização ou plataformas bancárias locais.",
        style_body
    ))

    elements.append(PageBreak())

    # ==================================================================
    # 5. CAPÍTULO 3: CUSTOS, LICENCIAMENTO E CURVA DE APRENDIZAGEM
    # ==================================================================
    elements.append(Paragraph("3. Custos, Licenciamento e Curva de Aprendizagem", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=10))

    elements.append(Paragraph("3.1 Política de Preços: Transparência em Kwanzas e Sem Surpresas Cambiais", style_h2))
    elements.append(Paragraph(
        "Um dos maiores fatores de risco financeiro para as empresas em Angola reside na aquisição de softwares cujos contratos "
        "de manutenção e subscrição são cobrados em Dólares ou Euros. Quando o Kwanza desvaloriza, o custo de TI da empresa "
        "duplica ou triplica de um ano para o outro. Com o <b>Kudiba ERP</b>, o contrato é <b>100% estabelecido em Kwanzas (Kz)</b>, "
        "sem indexação cambial, permitindo um planeamento orçamental estável e rigoroso.",
        style_body
    ))

    elements.append(Spacer(1, 4))
    elements.append(Paragraph("3.2 Matriz de Planos Comerciais Disponíveis", style_h2))

    plan_headers = [
        Paragraph("<b>Plano</b>", style_tbl_header),
        Paragraph("<b>Perfil Recomendado</b>", style_tbl_header),
        Paragraph("<b>Módulos Incluídos</b>", style_tbl_header),
        Paragraph("<b>Postos / Utilizadores</b>", style_tbl_header),
        Paragraph("<b>Suporte & Manutenção</b>", style_tbl_header)
    ]
    plan_rows = [
        plan_headers,
        [
            Paragraph("<b>Kudiba Comercial<br/>(Starter)</b>", style_tbl_cell),
            Paragraph("Lojas de retalho, comércio a grosso, oficinas e prestadores de serviços.", style_tbl_cell),
            Paragraph("Faturação AGT + POS Offline + Gestão de Stocks + Caixa Diário.", style_tbl_cell),
            Paragraph("Até 3 Postos de Faturação incluídos.", style_tbl_cell),
            Paragraph("Suporte Remoto em dias úteis + Atualizações AGT.", style_tbl_cell)
        ],
        [
            Paragraph("<b>Kudiba PME Integrado<br/>(Recomendado)</b>", style_tbl_cell),
            Paragraph("Pequenas e Médias Empresas em crescimento acelerado.", style_tbl_cell),
            Paragraph("Faturação + POS + Inventário Multi-Armazém + Tesouraria + Recursos Humanos (IRT/INSS).", style_tbl_cell),
            Paragraph("Até 8 Utilizadores / Postos incluídos.", style_tbl_cell),
            Paragraph("Suporte Prioritário (WhatsApp / Telefone) + Formação.", style_tbl_cell)
        ],
        [
            Paragraph("<b>Kudiba Corporate<br/>(Enterprise)</b>", style_tbl_cell),
            Paragraph("Grupos empresariais, indústrias, construtoras e distribuição multi-loja.", style_tbl_cell),
            Paragraph("Todos os módulos + Contabilidade Geral e Analítica PGC + API aberta + Multi-Empresa.", style_tbl_cell),
            Paragraph("Ilimitados ou escaláveis sob medida.", style_tbl_cell),
            Paragraph("Gestor de Conta Dedicado + SLA de 2 Horas + Onboarding presencial.", style_tbl_cell)
        ]
    ]
    p_table = Table(plan_rows, colWidths=[90, 105, 130, 95, 95])
    p_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(p_table)

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("3.3 Análise de Custo Total de Propriedade (TCO) a 3 Anos", style_h2))
    elements.append(Paragraph(
        "A economia real de uma solução de software não se limita ao preço inicial de aquisição, mas ao seu <b>TCO (Total Cost of Ownership)</b>. "
        "A tabela abaixo demonstra a poupança gerada por uma média empresa com 5 utilizadores ao longo de 3 anos:",
        style_body
    ))

    tco_headers = [
        Paragraph("<b>Rubrica de Custo</b>", style_tbl_header),
        Paragraph("<b>ERP Tradicional Legado</b>", style_tbl_header),
        Paragraph("<b>Kudiba ERP</b>", style_tbl_header),
        Paragraph("<b>Poupança Estimada</b>", style_tbl_header)
    ]
    tco_rows = [
        tco_headers,
        [
            Paragraph("Licenças de Software (3 Anos)", style_tbl_cell),
            Paragraph("~ 12.000.000 Kz (Taxas anuais em divisas)", style_tbl_cell),
            Paragraph("<b>4.800.000 Kz (Fixo em Kwanzas)</b>", style_tbl_cell),
            Paragraph("<font color='#16a34a'><b>-60% de poupança</b></font>", style_tbl_cell)
        ],
        [
            Paragraph("Licenças MS SQL Server + Windows Server", style_tbl_cell),
            Paragraph("~ 6.500.000 Kz (Licenciamento Microsoft)", style_tbl_cell),
            Paragraph("<b>0 Kz (Base PostgreSQL Linux aberta)</b>", style_tbl_cell),
            Paragraph("<font color='#16a34a'><b>-100% eliminado</b></font>", style_tbl_cell)
        ],
        [
            Paragraph("Infraestrutura de Servidores Físicos", style_tbl_cell),
            Paragraph("~ 5.000.000 Kz (Servidor dedicado na sede)", style_tbl_cell),
            Paragraph("<b>1.200.000 Kz (Container leve / Cloud)</b>", style_tbl_cell),
            Paragraph("<font color='#16a34a'><b>-76% de poupança</b></font>", style_tbl_cell)
        ],
        [
            Paragraph("Consultoria de Instalação e Patches AGT", style_tbl_cell),
            Paragraph("~ 4.000.000 Kz (Cobrança hora-homem)", style_tbl_cell),
            Paragraph("<b>Incluído na subscrição anual</b>", style_tbl_cell),
            Paragraph("<font color='#16a34a'><b>-100% de poupança</b></font>", style_tbl_cell)
        ],
        [
            Paragraph("<b>TCO TOTAL A 3 ANOS</b>", style_tbl_cell),
            Paragraph("<b>~ 27.500.000 Kz</b>", style_tbl_cell),
            Paragraph("<b>6.000.000 Kz</b>", style_tbl_cell),
            Paragraph("<font color='#16a34a'><b>POUPANÇA DE 78%</b></font>", style_tbl_cell)
        ]
    ]
    tco_table = Table(tco_rows, colWidths=[140, 135, 135, 105])
    tco_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary_dark),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#f0fdf4")),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(tco_table)

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("3.4 Curva de Aprendizagem Acelerada & Metodologia de Onboarding", style_h2))
    elements.append(Paragraph(
        "Enquanto os ERPs legados exigem meses de consultoria com produtividade nula, o Kudiba foi desenhado para adoção imediata:",
        style_body
    ))
    elements.append(Paragraph("• <b>Operadores Produtivos em 48 Horas:</b> O ecrã do Ponto de Venda (POS) é dominado por qualquer operador em menos de 2 horas. As operações frequentes possuem atalhos universais no teclado ([F2] Nova Venda, [F4] Quantidade, [F9] Finalizar).", style_bullet))
    elements.append(Paragraph("• <b>Migração Assistida de Dados:</b> Importadores integrados que carregam automaticamente artigos, tabelas de preços, clientes com NIF e saldos iniciais a partir de ficheiros Excel ou ficheiros SAF-T de sistemas anteriores.", style_bullet))
    elements.append(Paragraph("• <b>Formação Prática Certificada:</b> Sessões de capacitação para a administração, equipa financeira, operadores de caixa e técnicos de armazém com guias ilustrados e acompanhamento pós-arranque.", style_bullet))

    elements.append(PageBreak())

    # ==================================================================
    # 6. CAPÍTULO 4: SCREENSHOTS E GUIA DO UTILIZADOR
    # ==================================================================
    elements.append(Paragraph("4. Screenshots e Guia Prático do Utilizador", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=8))
    elements.append(Paragraph(
        "Neste capítulo apresentamos os principais ecrãs do ecossistema Kudiba ERP acompanhados de um guia passo a passo "
        "para que os utilizadores compreendam a fluidez operacional do sistema no dia a dia.",
        style_body
    ))

    # --- 4.1 Dashboard ---
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("4.1 Painel Executivo & Dashboard Financeiro", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Disponibilizar à gerência um centro de controlo em tempo real sobre a saúde comercial, cobranças e cumprimento fiscal.",
        style_body
    ))
    if os.path.exists("docs/screenshots/dashboard_executivo.png"):
        elements.append(Image("docs/screenshots/dashboard_executivo.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Filtro de Período:</b> No canto superior, selecione o período pretendido (Hoje, Mês Atual, Trimestre ou Ano Fiscal). Os indicadores são recalculados instantaneamente.", style_bullet))
    elements.append(Paragraph("2. <b>Monitorização de Cobranças:</b> Analise os cartões de KPI para verificar o total faturado versus total já liquidado em tesouraria.", style_bullet))
    elements.append(Paragraph("3. <b>Supervisão Fiscal AGT:</b> No painel lateral direito, confirme o estado da cadeia de assinaturas RSA. O indicador '100% Íntegra' confirma conformidade legal.", style_bullet))
    elements.append(Paragraph("4. <b>Exportação do SAF-T:</b> Ao final do mês, clique em <i>[Descarregar XML]</i> para obter o ficheiro pré-validado pronto a submeter no portal da AGT.", style_bullet))

    elements.append(PageBreak())

    # --- 4.2 POS ---
    elements.append(Paragraph("4.2 Ponto de Venda (POS) & Venda Rápida de Balcão (Offline Ready)", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Garantir velocidade máxima no atendimento a clientes com leitura ótica de códigos de barras e funcionamento ininterrupto sem internet.",
        style_body
    ))
    if os.path.exists("docs/screenshots/pos_vendas.png"):
        elements.append(Image("docs/screenshots/pos_vendas.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Seleção de Artigos:</b> Passe o leitor ótico pelo código de barras ou use a barra de pesquisa <i>(⌘K)</i>. O artigo entra imediatamente no cesto de compras com o stock atual visível.", style_bullet))
    elements.append(Paragraph("2. <b>Ajuste de Quantidade:</b> Pressione <i>[F4]</i> para alterar a quantidade ou clique nos botões rápidos de incremento.", style_bullet))
    elements.append(Paragraph("3. <b>Meio de Pagamento:</b> Escolha entre <i>[TPA / Multicaixa]</i>, <i>[Dinheiro]</i> ou <i>[Transferência]</i>. O sistema valida se o valor entregue cobre o total.", style_bullet))
    elements.append(Paragraph("4. <b>Emissão e Impressão [F9]:</b> Ao pressionar [F9], o documento (FR) é assinado criptograficamente e impresso na impressora térmica em menos de 1 segundo.", style_bullet))
    elements.append(Paragraph("5. <b>Trabalho sem Rede:</b> Se a internet cair, o badge verde superior indica 'Local-First Ativo'. O operador continua a vender normalmente.", style_bullet))

    elements.append(PageBreak())

    # --- 4.3 Invoicing ---
    elements.append(Paragraph("4.3 Emissão de Faturas Certificadas AGT (Com Retenção e Impostos)", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Emitir faturas comerciais formais (FT) com cálculo rigoroso de IVA (14%), retenção na fonte (6.5%) e validação do NIF do cliente.",
        style_body
    ))
    if os.path.exists("docs/screenshots/invoicing_certificacao.png"):
        elements.append(Image("docs/screenshots/invoicing_certificacao.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Identificação do Cliente:</b> Digite o NIF ou nome da entidade. O sistema valida o NIF (10 dígitos) e preenche os dados fiscais da empresa.", style_bullet))
    elements.append(Paragraph("2. <b>Inserção de Linhas:</b> Adicione as rubricas de serviços ou produtos. O Kudiba calcula o IVA correspondente e aplica a retenção na fonte de 6.5% automaticamente para serviços.", style_bullet))
    elements.append(Paragraph("3. <b>Verificação Fiscal Prévia:</b> A caixa verde inferior exibe em tempo real o hash calculado, a ligação à fatura anterior e os 4 caracteres de controlo.", style_bullet))
    elements.append(Paragraph("4. <b>Emissão & Assinatura:</b> Clique em <i>[+ Emitir & Assinar RSA]</i>. O PDF com QR Code AGT homologado é gerado e disponibilizado para impressão ou envio por email.", style_bullet))

    elements.append(PageBreak())

    # --- 4.4 Inventory ---
    elements.append(Paragraph("4.4 Gestão de Inventário, Armazéns & Conversão de Unidades (UoM)", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Controlar níveis de stock, preços médios de custo (PMP) e converter automaticamente embalagens de compra em unidades de venda.",
        style_body
    ))
    if os.path.exists("docs/screenshots/inventory_stock.png"):
        elements.append(Image("docs/screenshots/inventory_stock.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Entrada de Mercadoria:</b> Ao receber uma compra, registe a entrada na unidade do fornecedor (ex: Caixa de 24 un ou Palete de 40 sacos).", style_bullet))
    elements.append(Paragraph("2. <b>Desdobramento Automático:</b> O sistema aplica o fator de conversão e credita o armazém na unidade base de venda (ex: garrafas ou sacos).", style_bullet))
    elements.append(Paragraph("3. <b>Vigilância de Ruturas:</b> Os artigos com stock abaixo do nível mínimo de segurança surgem destacados a vermelho com sugestão de encomenda.", style_bullet))
    elements.append(Paragraph("4. <b>Transferência entre Armazéns:</b> Movimente mercadoria do Armazém Central para Lojas através de guias internas numeradas com aceitação eletrónica.", style_bullet))

    elements.append(PageBreak())

    # --- 4.5 Payroll ---
    elements.append(Paragraph("4.5 Processamento Salarial & Recibos de Vencimento (IRT/INSS Angola)", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Processar folhas salariais completas, calcular descontos do IRT e INSS e emitir recibos oficiais e ficheiros bancários.",
        style_body
    ))
    if os.path.exists("docs/screenshots/payroll_vencimento.png"):
        elements.append(Image("docs/screenshots/payroll_vencimento.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Seleção do Período:</b> Escolha o mês de processamento. A lista de colaboradores ativos é carregada com os respetivos contratos.", style_bullet))
    elements.append(Paragraph("2. <b>Lançamento de Variáveis:</b> Registe horas extras, prémios ou faltas ocorridas no mês.", style_bullet))
    elements.append(Paragraph("3. <b>Processamento Automático:</b> Clique em <i>[Processar Folha do Mês]</i>. O motor aplica a fórmula oficial do IRT e os 3% de INSS do trabalhador.", style_bullet))
    elements.append(Paragraph("4. <b>Exportação PS2 e Recibos:</b> Exporte o ficheiro bancário <i>[PS2]</i> para pagamento em lote via Internet Banking e emita os recibos individuais em PDF.", style_bullet))

    elements.append(PageBreak())

    # --- 4.6 Treasury ---
    elements.append(Paragraph("4.6 Gestão de Tesouraria, Contas a Pagar e Previsão de Fluxo de Caixa", style_h2))
    elements.append(Paragraph(
        "<b>Objetivo:</b> Controlar disponibilidades bancárias, agendar liquidações a fornecedores e prever o saldo financeiro a 30 dias.",
        style_body
    ))
    if os.path.exists("docs/screenshots/treasury_fluxo_caixa.png"):
        elements.append(Image("docs/screenshots/treasury_fluxo_caixa.png", width=6.8*inch, height=3.85*inch))
    
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("<b>Guia Passo a Passo:</b>", style_body_bold))
    elements.append(Paragraph("1. <b>Visão de Saldos Bancários:</b> No topo, acompanhe em tempo real o saldo disponível nas contas BFA, BAI e no Caixa Central.", style_bullet))
    elements.append(Paragraph("2. <b>Projeção Gráfica de Cash Flow:</b> Observe o gráfico semanal de barras comparando recebimentos previstos vs compromissos a pagar.", style_bullet))
    elements.append(Paragraph("3. <b>Liquidação de Fornecedores:</b> Na tabela inferior de contas a pagar, clique no documento pretendido para efetuar pagamento total ou parcial.", style_bullet))
    elements.append(Paragraph("4. <b>Conciliação:</b> Cada movimento é conciliado com o extrato bancário, refletindo-se automaticamente na contabilidade analítica.", style_bullet))

    elements.append(PageBreak())

    # ==================================================================
    # 7. CAPÍTULO 5: FAQ COMERCIAL, CONTACTOS E IMPLEMENTAÇÃO
    # ==================================================================
    elements.append(Paragraph("5. FAQ Comercial, Implementação & Contactos", style_h1))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=4, spaceAfter=10))

    elements.append(Paragraph("5.1 Perguntas Frequentes de Clientes (FAQ Comercial)", style_h2))

    faqs = [
        ("O software está formalmente em conformidade com as regras da AGT?",
         "Sim. O Kudiba ERP foi arquitetado com base no Decreto Presidencial n.º 71/25 e Decreto Executivo n.º 385/20. Emite assinaturas digitais RSA-2048 em cadeia com SHA-256, inclui QR Code fiscal e gera o ficheiro SAF-T (AO) 1.01 sem qualquer inconformidade."),
        ("O que acontece quando a nossa loja fica sem sinal de internet?",
         "A operação de venda de balcão (POS) continua a funcionar a 100%. O sistema armazena as transações localmente em modo seguro e emite os comprovativos. Assim que a internet regressa, o Kudiba sincroniza todos os registos com a base central automaticamente."),
        ("É possível migrar os dados do nosso sistema atual (Primavera, PHC, etc.)?",
         "Sim. Dispomos de rotinas de migração automática que importam a tabela de clientes, artigos, fornecedores, stocks e saldos iniciais a partir de ficheiros Excel normalizados ou diretamente do ficheiro SAF-T de faturação anterior."),
        ("Os valores da subscrição podem sofrer aumentos por variação do Dólar ou Euro?",
         "Não. Todos os nossos contratos são celebrados em Kwanzas (Kz), sem indexação cambial, garantindo total previsibilidade orçamental à sua empresa."),
        ("Como funciona a formação da nossa equipa?",
         "A formação pode ser presencial ou remota. Por ser uma aplicação moderna e ergonómica, a maioria dos operadores de caixa aprende a operar o sistema em menos de 2 horas. A equipa financeira e administrativa recebe formação dedicada de 2 dias.")
    ]

    for q, a in faqs:
        elements.append(Paragraph(f"<b>P: {q}</b>", style_body_bold))
        elements.append(Paragraph(f"<b>R:</b> {a}", style_bullet))
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("5.2 Roteiro de Implementação em 5 Etapas", style_h2))

    etapas = [
        [
            Paragraph("<b>Fase 1: Diagnóstico</b><br/><font size=7.5 color='#64748b'>Levantamento do parque informático, armazéns, lojas e séries fiscais da empresa.</font>", style_tbl_cell),
            Paragraph("<b>Fase 2: Parametrização</b><br/><font size=7.5 color='#64748b'>Configuração do NIF, dados fiscais, alvará comercial, utilizadores e perfis RBAC.</font>", style_tbl_cell),
            Paragraph("<b>Fase 3: Migração de Dados</b><br/><font size=7.5 color='#64748b'>Carga de clientes, artigos, preços e saldos iniciais de stocks e bancos.</font>", style_tbl_cell)
        ],
        [
            Paragraph("<b>Fase 4: Capacitação</b><br/><font size=7.5 color='#64748b'>Formação prática das equipas com simulações reais de vendas e faturação.</font>", style_tbl_cell),
            Paragraph("<b>Fase 5: Entrada em Produção</b><br/><font size=7.5 color='#64748b'>Arranque operacional com acompanhamento presencial no primeiro dia de emissão.</font>", style_tbl_cell),
            Paragraph("<b>Pós-Arranque: Suporte Contínuo</b><br/><font size=7.5 color='#64748b'>Apoio técnico permanente por telefone, WhatsApp e atualizações fiscais legais.</font>", style_tbl_cell)
        ]
    ]
    et_table = Table(etapas, colWidths=[170, 170, 173])
    et_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.8, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(et_table)

    elements.append(Spacer(1, 14))

    # Caixa Final de Chamada para Ação (Call to Action)
    cta_box = [
        [Paragraph(
            "<font size=11 color='white'><b>Pronto para Modernizar a Gestão da sua Empresa?</b></font><br/>"
            "<font size=8.5 color='#ecfdf5'>Agende uma demonstração personalizada gratuita com a nossa equipa de consultores "
            "e receba um estudo comparativo de poupança financeira para o seu negócio.</font><br/><br/>"
            "<font size=8.5 color='white'><b>📧 comercial@kudiba.ao   |   📞 (+244) 929 774 155 / 954 803 229 / 925 171 233   |   🌐 www.kudiba.ao</b><br/>"
            "Edifício Kudiba Tech, Luanda — República de Angola</font>",
            ParagraphStyle("CTA", parent=styles["Normal"], alignment=1)
        )]
    ]
    cta_table = Table(cta_box, colWidths=[515])
    cta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_primary),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
    ]))
    elements.append(cta_table)

    # Compilar Documento PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"PDF gerado com sucesso em: {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
