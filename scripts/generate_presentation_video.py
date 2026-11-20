#!/usr/bin/env python3
import asyncio
import math
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "video"
WORK_DIR = OUT_DIR / "work"
SCREENSHOTS = ROOT / "docs" / "screenshots"
LOGO = ROOT / "Frontend" / "public" / "favicon-192x192.png"

W, H, FPS = 1920, 1080, 30
TRANSITION = 0.6
LEAD_IN = 0.5
TAIL = 0.8
VOICE = "pt-PT-DuarteNeural"
RATE = "-3%"

BG_TOP = (3, 19, 31)
BG_BOTTOM = (8, 32, 44)
EMERALD = (16, 185, 129)
TEAL = (20, 184, 166)
LIME = (152, 211, 114)
AMBER = (245, 158, 11)
WHITE = (248, 250, 252)
SLATE_300 = (203, 213, 225)
SLATE_400 = (148, 163, 184)
SLATE_600 = (71, 85, 105)
CARD = (10, 23, 36)

FONT_CANDIDATES = [
    (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
    (Path("C:/Windows/Fonts/segoeui.ttf"), Path("C:/Windows/Fonts/segoeuib.ttf")),
    (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
]
FONT_REGULAR, FONT_BOLD = next(
    (regular, bold) for regular, bold in FONT_CANDIDATES if regular.exists() and bold.exists()
)

DISCLAIMER = "Dados de demonstração. Módulos e integrações dependem da configuração e homologação aplicáveis."

SCENES = [
    {
        "id": "01-intro",
        "layout": "title",
        "kicker": "GESTÃO QUE MOVE EMPRESAS",
        "title": "Kudiba ERP",
        "subtitle": "Venda. Controlo. Cresça.",
        "narration": (
            "Kudiba ERP. Uma plataforma de gestão feita para a realidade das empresas angolanas. "
            "Do primeiro produto no carrinho ao controlo financeiro, ligue as operações essenciais "
            "e ganhe clareza para crescer."
        ),
    },
    {
        "id": "02-desafio",
        "layout": "collage",
        "kicker": "O DESAFIO",
        "title": "Menos silos. Mais controlo.",
        "subtitle": "Uma visão comum para as operações do dia a dia.",
        "bullets": [
            "Vendas, stock e recebimentos ligados",
            "Dados registados uma vez, disponíveis às equipas",
            "Processos organizados por empresa e função",
        ],
        "images": [
            "dashboard_executivo.png",
            "invoicing_certificacao.png",
            "treasury_fluxo_caixa.png",
        ],
        "narration": (
            "Quando vendas, stock e finanças vivem separados, reconciliar informação consome tempo "
            "e esconde o que realmente acontece. O Kudiba reúne os processos essenciais numa única "
            "plataforma, com acessos por função e registos que ajudam cada equipa a trabalhar com "
            "a mesma informação."
        ),
    },
    {
        "id": "03-inventario",
        "layout": "split",
        "kicker": "STOCK PARA RETALHO",
        "title": "Compra em caixas. Vende à unidade.",
        "subtitle": "Do fornecedor ao balcão, cada movimento conta.",
        "bullets": [
            "Converta embalagens em unidades de venda",
            "Registe custo de compra e fornecedor",
            "Acompanhe armazéns, lotes e custo médio",
        ],
        "image": "inventory_stock.png",
        "narration": (
            "Compre por caixa e venda por unidade. O Kudiba converte a embalagem para a unidade de "
            "stock, regista o custo de compra e identifica o fornecedor. No momento da venda, "
            "informe a quantidade e o preço unitário. Acompanhe existências, armazéns e movimentos "
            "sem perder o rasto da mercadoria."
        ),
    },
    {
        "id": "04-vendas",
        "layout": "split",
        "kicker": "PONTO DE VENDA",
        "title": "O atendimento não pára.",
        "subtitle": "Um fluxo rápido, com contingência quando a ligação falha.",
        "bullets": [
            "Pesquise, leia o código e ajuste quantidades",
            "Registo local de vendas pendentes",
            "Sincronização posterior e acompanhamento",
        ],
        "image": "pos_vendas.png",
        "narration": (
            "No ponto de venda, pesquise ou leia o código do artigo, ajuste a quantidade e avance "
            "para o pagamento. Se a ligação falhar, o modo de contingência guarda a operação neste "
            "dispositivo para sincronização posterior. O estado da sincronização fica visível para "
            "a equipa, sem confundir um registo pendente com uma confirmação fiscal."
        ),
    },
    {
        "id": "05-faturacao",
        "layout": "split",
        "kicker": "DOCUMENTOS & FATURAÇÃO",
        "title": "Cada documento, no seu momento.",
        "subtitle": "Venda primeiro. Registe o recebimento com clareza.",
        "bullets": [
            "Pró-forma, fatura e fatura-recibo",
            "Recibo pelo valor efetivamente recebido",
            "Imposto de selo apenas quando aplicável",
            "Submissão AGT exige credenciação e homologação",
        ],
        "image": "invoicing_certificacao.png",
        "image_crop": (170, 82, 910, 410),
        "narration": (
            "Prepare uma pró-forma, emita a fatura ou a fatura-recibo e mantenha o foco na venda. "
            "O comprovativo de pagamento pode ser associado sem bloquear a emissão. Quando recebe "
            "um pagamento, emita o recibo pelo valor realmente recebido. O imposto de selo é "
            "opcional e só deve ser aplicado aos documentos a que se destina. A submissão e aceitação "
            "pela AGT dependem da credenciação e homologação oficiais."
        ),
    },
    {
        "id": "06-tesouraria",
        "layout": "split",
        "kicker": "CAIXA & TESOURARIA",
        "title": "Cada recebimento deixa rasto.",
        "subtitle": "Conferência clara, do balcão ao fecho.",
        "bullets": [
            "Dinheiro, TPA e transferência",
            "Pagamentos parciais e recibos",
            "Comprovativo interno com responsável de caixa",
        ],
        "image": "treasury_fluxo_caixa.png",
        "narration": (
            "Registe recebimentos em dinheiro, TPA ou transferência, de forma total ou parcial. "
            "Para o dinheiro recebido em caixa, gere o comprovativo interno com o nome do cliente, "
            "o valor e o espaço para assinatura do responsável de caixa. Concilie movimentos, "
            "acompanhe saldos e feche cada sessão com mais controlo."
        ),
    },
    {
        "id": "07-gestao",
        "layout": "split",
        "kicker": "CONTABILIDADE & PESSOAS",
        "title": "O negócio inteiro, organizado.",
        "subtitle": "Operações, equipas e números sob a mesma gestão.",
        "bullets": [
            "Contabilidade e centros de custo",
            "Contratos, assiduidade e férias",
            "Processamento de salários e exportações",
        ],
        "image": "payroll_vencimento.png",
        "narration": (
            "Organize lançamentos e centros de custo na contabilidade. Na gestão de pessoas, "
            "acompanhe contratos, assiduidade, férias e processamento salarial. Os cálculos fiscais "
            "e as exportações devem ser conferidos com os parâmetros e regras em vigor na sua "
            "empresa."
        ),
    },
    {
        "id": "08-decisao",
        "layout": "security",
        "kicker": "VISIBILIDADE & GOVERNANÇA",
        "title": "Decidir com dados. Gerir com controlo.",
        "subtitle": "Informação registada, acessos definidos e operações auditáveis.",
        "bullets": [
            "Painéis para acompanhar a atividade",
            "Acessos por utilizador e função",
            "Auditoria e cópias de segurança cifradas",
        ],
        "narration": (
            "Acompanhe a atividade nos painéis do sistema e aprofunde os dados registados por cada "
            "módulo. Defina o que cada utilizador pode consultar ou executar. A trilha de auditoria "
            "e as cópias de segurança cifradas reforçam a rastreabilidade e a recuperação. "
            "Configuração, permissões e rotinas de cópia devem acompanhar a política da sua empresa."
        ),
    },
    {
        "id": "09-cta",
        "layout": "outro",
        "kicker": "O PRÓXIMO PASSO",
        "title": "Veja o Kudiba em ação.",
        "subtitle": "Uma demonstração alinhada com a sua operação.",
        "narration": (
            "Kudiba ERP. Mais clareza na gestão. Mais controlo em cada venda. Agende uma demonstração "
            "e descubra como adaptar a plataforma à realidade da sua empresa. Visite kudiba ponto ao."
        ),
    },
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def ffmpeg() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Comando falhou: {' '.join(cmd)}\n{result.stderr[-4000:]}")


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [ffmpeg(), "-i", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"Não foi possível obter a duração de {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def background() -> Image.Image:
    base = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(base)
    for y in range(H):
        t = y / (H - 1)
        color = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        draw.line((0, y, W, y), fill=color)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((-260, -340, 900, 620), fill=(*TEAL, 54))
    gdraw.ellipse((1250, 620, 2160, 1420), fill=(*EMERALD, 40))
    gdraw.ellipse((650, -240, 1350, 380), fill=(*LIME, 18))
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    base = Image.alpha_composite(base.convert("RGBA"), glow)

    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grid)
    for x in range(0, W, 80):
        gdraw.line((x, 0, x, H), fill=(255, 255, 255, 5))
    for y in range(0, H, 80):
        gdraw.line((0, y, W, y), fill=(255, 255, 255, 5))
    base = Image.alpha_composite(base, grid)

    vignette = Image.new("L", (W, H), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((-380, -320, W + 380, H + 320), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(220))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 150))
    base = Image.composite(base, Image.alpha_composite(base, shade), vignette)
    return base.convert("RGB")


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_paragraph(
    draw: ImageDraw.ImageDraw,
    text: str,
    fnt: ImageFont.FreeTypeFont,
    x: int,
    y: int,
    max_width: int,
    fill: tuple[int, int, int],
    line_gap: int = 12,
) -> int:
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def draw_brand(img: Image.Image, x: int, y: int, scale: float = 1.0) -> None:
    size = int(46 * scale)
    logo = Image.open(LOGO).convert("RGBA").resize((size, size), Image.LANCZOS)
    img.paste(logo, (x, y), logo)
    draw = ImageDraw.Draw(img)
    name_font = font(FONT_BOLD, int(30 * scale))
    draw.text((x + size + int(14 * scale), y + int(2 * scale)), "Kudiba", font=name_font, fill=WHITE)
    offset = draw.textlength("Kudiba ", font=name_font)
    draw.text((x + size + int(14 * scale) + offset, y + int(2 * scale)), "ERP", font=name_font, fill=AMBER)


def draw_kicker(draw: ImageDraw.ImageDraw, text: str, x: int, y: int) -> None:
    fnt = font(FONT_BOLD, 20)
    draw.rounded_rectangle((x, y, x + 12, y + 12), radius=3, fill=EMERALD)
    draw.text((x + 24, y - 5), text, font=fnt, fill=EMERALD)


def draw_bullets(draw: ImageDraw.ImageDraw, bullets: list[str], x: int, y: int, max_width: int) -> int:
    fnt = font(FONT_REGULAR, 27)
    for bullet in bullets:
        draw.ellipse((x, y + 11, x + 10, y + 21), fill=LIME)
        y = draw_paragraph(draw, bullet, fnt, x + 30, y, max_width - 30, SLATE_300, line_gap=8) + 16
    return y


def screenshot_card(
    path: Path, width: int, crop: tuple[int, int, int, int] | None = None
) -> tuple[Image.Image, int]:
    src = Image.open(path).convert("RGB")
    crop = crop or (0, 80, src.width, src.height)
    src = src.crop(crop)
    height = round(src.height * width / src.width)
    src = src.resize((width, height), Image.LANCZOS)
    pad = 10
    card_w, card_h = width + pad * 2, height + pad * 2
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (card_w + 80, card_h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((40, 48, card_w + 40, card_h + 48), radius=26, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    card = Image.alpha_composite(card, shadow.crop((0, 0, card_w, card_h)))
    body = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(body)
    bdraw.rounded_rectangle((0, 0, card_w - 1, card_h - 1), radius=22, fill=(*CARD, 255), outline=(45, 65, 82, 255), width=2)
    body.paste(src, (pad, pad), rounded_mask(src.size, 14))
    card = Image.alpha_composite(card, body)
    return card, height


def scene_split(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    img = base.copy()
    draw = ImageDraw.Draw(img)
    draw_brand(img, 90, 58)
    draw_kicker(draw, scene["kicker"], 110, 210)

    title_font = font(FONT_BOLD, 66)
    y = 250
    y = draw_paragraph(draw, scene["title"], title_font, 110, y, 760, WHITE, line_gap=6)
    draw.rounded_rectangle((110, y + 18, 178, y + 24), radius=3, fill=EMERALD)
    y += 58
    subtitle_font = font(FONT_REGULAR, 30)
    y = draw_paragraph(draw, scene["subtitle"], subtitle_font, 110, y, 720, SLATE_400, line_gap=10)
    y += 34
    draw_bullets(draw, scene["bullets"], 110, y, 760)

    card, _ = screenshot_card(
        SCREENSHOTS / scene["image"], 880, scene.get("image_crop")
    )
    card_draw = ImageDraw.Draw(card)
    label_font = font(FONT_BOLD, 14)
    label = "DEMONSTRAÇÃO · DADOS ILUSTRATIVOS"
    label_width = int(card_draw.textlength(label, font=label_font))
    label_box = (card.width - label_width - 44, 18, card.width - 18, 50)
    card_draw.rounded_rectangle(label_box, radius=12, fill=(8, 30, 40, 235), outline=AMBER, width=1)
    card_draw.text((label_box[0] + 13, label_box[1] + 7), label, font=label_font, fill=WHITE)
    img.paste(card, (930, 280), card)
    draw_scene_footer(draw, index, total)
    return img


def scene_collage(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    img = base.copy()
    draw = ImageDraw.Draw(img)
    draw_brand(img, 90, 58)
    draw_kicker(draw, scene["kicker"], 110, 210)

    title_font = font(FONT_BOLD, 66)
    y = draw_paragraph(draw, scene["title"], title_font, 110, 250, 720, WHITE, line_gap=6)
    draw.rounded_rectangle((110, y + 18, 178, y + 24), radius=3, fill=EMERALD)
    y += 58
    y = draw_paragraph(draw, scene["subtitle"], font(FONT_REGULAR, 30), 110, y, 690, SLATE_400, line_gap=10)
    y += 40
    draw_bullets(draw, scene["bullets"], 110, y, 700)

    placements = [(1000, 250, 620, -3), (1120, 430, 620, 2), (930, 610, 620, 1)]
    for name, (x, yy, cw, angle) in zip(scene["images"], placements):
        card, _ = screenshot_card(SCREENSHOTS / name, cw)
        card = card.rotate(angle, expand=True, resample=Image.BICUBIC)
        img.paste(card, (x, yy), card)

    draw_scene_footer(draw, index, total)
    return img


def scene_security(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    img = base.copy()
    draw = ImageDraw.Draw(img)
    draw_brand(img, 90, 58)
    draw_kicker(draw, scene["kicker"], 110, 210)

    y = draw_paragraph(draw, scene["title"], font(FONT_BOLD, 66), 110, 250, 740, WHITE, line_gap=6)
    draw.rounded_rectangle((110, y + 18, 178, y + 24), radius=3, fill=EMERALD)
    y += 58
    y = draw_paragraph(draw, scene["subtitle"], font(FONT_REGULAR, 30), 110, y, 700, SLATE_400, line_gap=10)
    y += 40
    draw_bullets(draw, scene["bullets"], 110, y, 700)

    cx, cy = 1430, 540
    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring)
    for radius, alpha in [(245, 40), (190, 55), (135, 75)]:
        rdraw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(*TEAL, alpha), width=2)
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        x = cx + math.cos(rad) * 245
        yy = cy + math.sin(rad) * 245
        rdraw.ellipse((x - 4, yy - 4, x + 4, yy + 4), fill=(*LIME, 190))
    img = Image.alpha_composite(img.convert("RGBA"), ring)
    draw = ImageDraw.Draw(img)

    shield = Image.new("RGBA", (240, 280), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shield)
    sdraw.polygon(
        [(120, 8), (222, 56), (222, 150), (120, 268), (18, 150), (18, 56)],
        fill=(*EMERALD, 235),
    )
    sdraw.polygon(
        [(120, 34), (194, 70), (194, 145), (120, 238), (46, 145), (46, 70)],
        fill=(12, 40, 50, 255),
    )
    check = font(FONT_BOLD, 74)
    sdraw.text((78, 92), "✓", font=check, fill=LIME)
    img.paste(shield, (cx - 120, cy - 140), shield)

    labels = [
        ("Multi-tenant", 1010, 230),
        ("RBAC granular", 1540, 235),
        ("Auditoria imutável", 1540, 800),
        ("Backups & contingência", 930, 795),
    ]
    label_font = font(FONT_BOLD, 22)
    for text, x, yy in labels:
        width = int(draw.textlength(text, font=label_font))
        draw.rounded_rectangle((x - 18, yy - 12, x + width + 18, yy + 38), radius=16, fill=(8, 30, 40, 220), outline=(*TEAL, 120), width=1)
        draw.text((x, yy), text, font=label_font, fill=SLATE_300)

    draw_scene_footer(draw, index, total)
    return img


def scene_title(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    img = base.convert("RGBA")
    backdrop = Image.open(SCREENSHOTS / "dashboard_executivo.png").convert("RGB").resize((W, H), Image.LANCZOS)
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(24))
    overlay = Image.new("RGBA", (W, H), (3, 19, 31, 214))
    img = Image.alpha_composite(backdrop.convert("RGBA"), overlay)
    img = Image.alpha_composite(img, base.convert("RGBA"))
    img = img.convert("RGB")
    draw = ImageDraw.Draw(img)

    logo = Image.open(LOGO).convert("RGBA").resize((190, 190), Image.LANCZOS)
    img.paste(logo, ((W - 190) // 2, 180), logo)

    kicker_font = font(FONT_BOLD, 22)
    kicker = scene["kicker"]
    kw = draw.textlength(kicker, font=kicker_font)
    draw.text(((W - kw) / 2, 420), kicker, font=kicker_font, fill=EMERALD)

    title_font = font(FONT_BOLD, 118)
    title = scene["title"]
    tw = draw.textlength(title, font=title_font)
    draw.text(((W - tw) / 2, 470), title, font=title_font, fill=WHITE)

    subtitle_font = font(FONT_REGULAR, 36)
    subtitle = scene["subtitle"]
    sw = draw.textlength(subtitle, font=subtitle_font)
    draw.text(((W - sw) / 2, 640), subtitle, font=subtitle_font, fill=SLATE_300)

    line_w = 220
    draw.rounded_rectangle(((W - line_w) / 2, 740, (W + line_w) / 2, 747), radius=3, fill=AMBER)

    tagline_font = font(FONT_BOLD, 24)
    tagline = "ANGOLA  •  RETALHO  •  GESTÃO INTEGRADA"
    tw = draw.textlength(tagline, font=tagline_font)
    draw.text(((W - tw) / 2, 800), tagline, font=tagline_font, fill=SLATE_400)

    draw_scene_footer(draw, index, total)
    return img


def scene_outro(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    img = base.copy()
    draw = ImageDraw.Draw(img)

    logo = Image.open(LOGO).convert("RGBA").resize((210, 210), Image.LANCZOS)
    img.paste(logo, ((W - 210) // 2, 170), logo)

    title_font = font(FONT_BOLD, 92)
    title = scene["title"]
    tw = draw.textlength(title, font=title_font)
    draw.text(((W - tw) / 2, 430), title, font=title_font, fill=WHITE)

    sub_font = font(FONT_REGULAR, 34)
    subtitle = scene["subtitle"]
    sw = draw.textlength(subtitle, font=sub_font)
    draw.text(((W - sw) / 2, 570), subtitle, font=sub_font, fill=SLATE_300)

    cta_font = font(FONT_BOLD, 40)
    cta = "Peça uma demonstração"
    cw = draw.textlength(cta, font=cta_font)
    pad_x, pad_y = 46, 26
    box_w, box_h = cw + pad_x * 2, cta_font.size + pad_y * 2
    x0, y0 = (W - box_w) / 2, 690
    draw.rounded_rectangle((x0, y0, x0 + box_w, y0 + box_h), radius=18, fill=EMERALD)
    draw.text((x0 + pad_x, y0 + pad_y - 4), cta, font=cta_font, fill=(4, 24, 20))

    url_font = font(FONT_BOLD, 30)
    url = "kudiba.ao"
    uw = draw.textlength(url, font=url_font)
    draw.text(((W - uw) / 2, y0 + box_h + 34), url, font=url_font, fill=LIME)
    contact_font = font(FONT_REGULAR, 23)
    contact = "comercial@kudiba.ao"
    contact_width = draw.textlength(contact, font=contact_font)
    draw.text(((W - contact_width) / 2, y0 + box_h + 84), contact, font=contact_font, fill=SLATE_300)

    draw_scene_footer(draw, index, total)
    return img


def draw_scene_footer(draw: ImageDraw.ImageDraw, index: int, total: int) -> None:
    fnt = font(FONT_BOLD, 18)
    note_font = font(FONT_REGULAR, 16)
    draw.text((110, H - 94), DISCLAIMER, font=note_font, fill=SLATE_400)
    draw.text((110, H - 66), "KUDIBA ERP  •  APRESENTAÇÃO INSTITUCIONAL", font=fnt, fill=SLATE_400)
    label = f"{index:02d} / {total:02d}"
    lw = draw.textlength(label, font=fnt)
    draw.text((W - 110 - lw, H - 66), label, font=fnt, fill=SLATE_600)
    bar_w = W - 220
    draw.rounded_rectangle((110, H - 30, 110 + bar_w, H - 26), radius=2, fill=(30, 48, 60))
    draw.rounded_rectangle((110, H - 30, 110 + bar_w * index / total, H - 26), radius=2, fill=EMERALD)


def render_slide(scene: dict, index: int, total: int, base: Image.Image) -> Image.Image:
    layout = scene["layout"]
    if layout == "title":
        return scene_title(scene, index, total, base)
    if layout == "outro":
        return scene_outro(scene, index, total, base)
    if layout == "collage":
        return scene_collage(scene, index, total, base)
    if layout == "security":
        return scene_security(scene, index, total, base)
    return scene_split(scene, index, total, base)


async def synthesize(text: str, path: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(path))


def make_music(duration: float, path: Path) -> None:
    sr = 44100
    total = int(duration * sr) + sr
    t = np.arange(total) / sr

    progression = [
        (110.00, 164.81, 220.00, 261.63),
        (87.31, 130.81, 174.61, 220.00),
        (130.81, 196.00, 261.63, 329.63),
        (98.00, 146.83, 196.00, 246.94),
    ]
    bar = 9.0
    mix = np.zeros(total, dtype=np.float64)
    for i, chord in enumerate(progression):
        start = i * bar
        while start < duration + 2:
            idx = (t >= start) & (t < start + bar + 3)
            local = t[idx] - start
            env = np.minimum(local / 3.5, 1.0) * np.maximum(0.0, 1.0 - np.maximum(0.0, local - bar) / 3.0)
            voice = np.zeros_like(local)
            for j, freq in enumerate(chord):
                amp = 0.22 / (j + 1)
                voice += amp * np.sin(2 * np.pi * freq * local + 0.12 * np.sin(2 * np.pi * 0.07 * local))
                voice += amp * 0.35 * np.sin(2 * np.pi * (freq * 2) * local)
            mix[idx] += voice * env
            start += bar

    lfo = 0.82 + 0.18 * np.sin(2 * np.pi * 0.035 * t)
    mix *= lfo
    mix = np.tanh(mix * 0.9)
    mix = mix[: int(duration * sr)]
    fade = int(3.0 * sr)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix = mix / max(1e-9, np.max(np.abs(mix))) * 0.32

    stereo = np.stack([mix, np.roll(mix, int(0.011 * sr))], axis=1)
    pcm = (stereo * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as fh:
        fh.setnchannels(2)
        fh.setsampwidth(2)
        fh.setframerate(sr)
        fh.writeframes(pcm.tobytes())


def build_scene(index: int, scene: dict, slide: Path) -> tuple[Path, float]:
    narration = WORK_DIR / f"{scene['id']}.mp3"
    asyncio.run(synthesize(scene["narration"], narration))
    narration_duration = probe_duration(narration)
    duration = LEAD_IN + narration_duration + TAIL
    out = WORK_DIR / f"{scene['id']}.mp4"

    zoom = "min(1+0.00022*on,1.045)"
    vf = (
        f"scale={W}:{H},format=yuv420p,"
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"
    )
    af = (
        f"adelay={int(LEAD_IN*1000)}|{int(LEAD_IN*1000)},"
        f"apad=whole_dur={duration:.3f},atrim=0:{duration:.3f}"
    )
    run(
        [
            ffmpeg(),
            "-y",
            "-loop", "1",
            "-framerate", str(FPS),
            "-i", str(slide),
            "-i", str(narration),
            "-filter_complex", f"[0:v]{vf}[v];[1:a]{af}[a]",
            "-map", "[v]",
            "-map", "[a]",
            "-t", f"{duration:.3f}",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            str(out),
        ]
    )
    return out, duration


def compose(scene_files: list[Path], durations: list[float]) -> Path:
    silent = WORK_DIR / "video_silent.mp4"
    inputs: list[str] = []
    for path in scene_files:
        inputs += ["-i", str(path)]

    filters: list[str] = []
    for i in range(len(scene_files) - 1):
        target = f"[v{i}]" if i < len(scene_files) - 2 else "[vout]"
        left = "[0:v]" if i == 0 else f"[v{i-1}]"
        offset = sum(durations[: i + 1]) - TRANSITION * (i + 1)
        filters.append(
            f"{left}[{i+1}:v]xfade=transition=fade:duration={TRANSITION}:offset={offset:.3f}{target}"
        )

    for i in range(len(scene_files) - 1):
        target = f"[a{i}]" if i < len(scene_files) - 2 else "[aout]"
        left = "[0:a]" if i == 0 else f"[a{i-1}]"
        filters.append(f"{left}[{i+1}:a]acrossfade=d={TRANSITION}:c1=tri:c2=tri{target}")

    run(
        [
            ffmpeg(),
            "-y",
            *inputs,
            "-filter_complex",
            ";".join(filters),
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(silent),
        ]
    )
    return silent


def finalize(video: Path, duration: float) -> Path:
    music = WORK_DIR / "music.wav"
    make_music(duration, music)
    out = OUT_DIR / "kudiba-apresentacao.mp4"
    run(
        [
            ffmpeg(),
            "-y",
            "-i", str(video),
            "-i", str(music),
            "-filter_complex",
            (
                "[0:a]aformat=channel_layouts=stereo[n];"
                "[1:a]volume=0.16,aformat=channel_layouts=stereo[m];"
                "[n][m]amix=inputs=2:duration=first:weights='1 1',"
                "alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[a]"
            ),
            "-map", "0:v",
            "-map", "[a]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-movflags", "+faststart",
            "-t", f"{duration:.3f}",
            str(out),
        ]
    )
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    base = background()
    total = len(SCENES)

    scene_files: list[Path] = []
    durations: list[float] = []
    for index, scene in enumerate(SCENES, start=1):
        print(f"[{index}/{total}] {scene['id']}: slide + narração")
        slide = WORK_DIR / f"{scene['id']}.png"
        frame = render_slide(scene, index, total, base)
        frame.save(slide)
        if index == 1:
            frame.save(OUT_DIR / "kudiba-apresentacao-poster.jpg", quality=94, optimize=True)
        scene_file, duration = build_scene(index, scene, slide)
        scene_files.append(scene_file)
        durations.append(duration)
        print(f"    {duration:.2f}s")

    print("A compor transições...")
    silent = compose(scene_files, durations)
    final_duration = sum(durations) - TRANSITION * (total - 1)
    print(f"Duração final: {final_duration/60:.2f} min")
    print("A misturar música...")
    out = finalize(silent, final_duration)
    print(f"Vídeo: {out}")


if __name__ == "__main__":
    main()
