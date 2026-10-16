from decimal import Decimal
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from src.domain.entities.employee import Employee
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip
from src.domain.value_objects.enums import PayslipLineType


def _fmt(value: Decimal) -> str:
    return f"{value:,.2f}".replace(",", " ") + " Kz"


class PayslipPdfExporter:
    @classmethod
    def generate(
        cls,
        payslip: Payslip,
        employee: Employee,
        period: PayrollPeriod,
        company_name: str = "Kudiba Soluções Tecnológicas, Lda.",
        company_nif: str = "5412345678",
    ) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            title=f"Recibo de Vencimento - {employee.full_name}",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "PayslipTitle",
            parent=styles["Heading2"],
            alignment=1,
            spaceAfter=2 * mm,
        )
        company_style = ParagraphStyle(
            "Company",
            parent=styles["Normal"],
            alignment=1,
            fontSize=10,
            spaceAfter=1 * mm,
        )
        info_style = ParagraphStyle(
            "Info",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
        )

        story = [
            Paragraph("RECIBO DE VENCIMENTO", title_style),
            Paragraph(company_name, company_style),
            Paragraph(f"NIF: {company_nif}", company_style),
            Spacer(1, 4 * mm),
            Paragraph(f"<b>Período:</b> {period.title} ({period.month:02d}/{period.year})", info_style),
            Paragraph(f"<b>Colaborador:</b> {employee.full_name} ({employee.code})", info_style),
            Paragraph(f"<b>NIF:</b> {employee.nif} &nbsp;&nbsp; <b>BI:</b> {employee.identity_card_number}", info_style),
            Paragraph(f"<b>IBAN:</b> {employee.iban}", info_style),
            Paragraph(f"<b>Dias Trabalhados:</b> {payslip.days_worked}", info_style),
            Spacer(1, 4 * mm),
        ]

        header = ["Código", "Descrição", "Qtd.", "Taxa", "Valor (Kz)"]
        rows = [header]
        for line in payslip.lines:
            if line.line_type == PayslipLineType.EMPLOYER_COST:
                continue
            amount = line.amount if line.line_type == PayslipLineType.EARNING else -line.amount
            rows.append([
                line.code,
                line.description,
                f"{line.quantity:.2f}",
                f"{line.rate:.4f}",
                f"{amount:,.2f}",
            ])

        table = Table(rows, colWidths=[28 * mm, 72 * mm, 18 * mm, 22 * mm, 30 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F3864")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B0B0B0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F2F2")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(table)
        story.append(Spacer(1, 4 * mm))

        totals = [
            ["Remuneração Bruta", _fmt(payslip.total_gross)],
            ["INSS Trabalhador (3%)", _fmt(payslip.inss_employee)],
            ["IRT", _fmt(payslip.irt)],
            ["Total de Descontos", _fmt(payslip.total_deductions)],
            ["SALÁRIO LÍQUIDO", _fmt(payslip.net_salary)],
        ]
        totals_table = Table(totals, colWidths=[60 * mm, 45 * mm], hAlign="RIGHT")
        totals_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#D9E2F3")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B0B0B0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(totals_table)
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph(
            f"Encargo Patronal INSS (8%): {_fmt(payslip.inss_employer)} — "
            "Documento gerado electronicamente pelo Kudiba ERP.",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, textColor=colors.grey),
        ))

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def filename(employee_code: str, period: PayrollPeriod) -> str:
        return f"RECIBO_{employee_code}_{period.year}_{period.month:02d}.pdf"
