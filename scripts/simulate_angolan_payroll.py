#!/usr/bin/env python3
"""
Kudiba ERP — Simulador e Especificação Executável de Recursos Humanos & Payroll (Angola)
========================================================================================

Demonstra e documenta com exatidão matemática fiduciária:
  1. Cálculo de INSS (Decreto Presidencial n.º 227/18): 3% empregado, 8% empregador,
     com isenções de alimentação e transporte até 30.000 Kz.
  2. Cálculo de IRT Grupo A (Lei n.º 18/14 alterada pela Lei n.º 28/20):
     Tabela progressiva de 11 escalões (0% a 25%), com dedução prévia obrigatória
     dos 3% de Segurança Social (INSS) da matéria coletável (Art. 6.º do CIRT).
  3. Geração de Ficheiro Bancário de Remessa em Lote (Formato Oficial PS2 / SEPA ASCII).
  4. Geração de Payload de Evento AMQP para Integração Contabilística (PGC Angolano).
"""

from decimal import Decimal, ROUND_HALF_UP
import json
import uuid
from datetime import date
from typing import Dict, List, Tuple


def round_cur(val: Decimal) -> Decimal:
    """Arredonda para 2 casas decimais de acordo com as normas cambiais e bancárias (AOA)."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class InssCalculator:
    """Motor de cálculo da Proteção Social Obrigatória (INSS) de Angola."""
    TAXA_TRABALHADOR = Decimal("0.03")
    TAXA_EMPREGADOR = Decimal("0.08")
    LIMITE_ISENCAO_SUBSIDIOS = Decimal("30000.00")

    @classmethod
    def calculate(
        cls,
        salario_base: Decimal,
        subsidio_alimentacao: Decimal = Decimal("0.00"),
        subsidio_transporte: Decimal = Decimal("0.00"),
        outros_suplementos_tributaveis: Decimal = Decimal("0.00"),
    ) -> Tuple[Decimal, Decimal, Decimal]:
        """
        Retorna:
          (base_incidencia_inss, inss_trabalhador_3pct, inss_patronal_8pct)
        """
        excesso_alim = max(Decimal("0.00"), subsidio_alimentacao - cls.LIMITE_ISENCAO_SUBSIDIOS)
        excesso_transp = max(Decimal("0.00"), subsidio_transporte - cls.LIMITE_ISENCAO_SUBSIDIOS)

        base_inss = salario_base + excesso_alim + excesso_transp + outros_suplementos_tributaveis
        inss_trab = round_cur(base_inss * cls.TAXA_TRABALHADOR)
        inss_patr = round_cur(base_inss * cls.TAXA_EMPREGADOR)
        return (base_inss, inss_trab, inss_patr)


class IrtCalculator:
    """
    Motor de cálculo do Imposto sobre o Rendimento do Trabalho (IRT)
    Grupo A — Trabalhadores por conta de outrem (Lei n.º 28/20).
    """
    # Escalões: (limite_superior, parcela_fixa, taxa, excesso_sobre)
    ESCALOES = [
        (Decimal("100000.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00")),
        (Decimal("150000.00"), Decimal("0.00"), Decimal("0.13"), Decimal("100000.00")),
        (Decimal("200000.00"), Decimal("6500.00"), Decimal("0.16"), Decimal("150000.00")),
        (Decimal("300000.00"), Decimal("14500.00"), Decimal("0.18"), Decimal("200000.00")),
        (Decimal("500000.00"), Decimal("32500.00"), Decimal("0.19"), Decimal("300000.00")),
        (Decimal("1000000.00"), Decimal("70500.00"), Decimal("0.20"), Decimal("500000.00")),
        (Decimal("1500000.00"), Decimal("170500.00"), Decimal("0.21"), Decimal("1000000.00")),
        (Decimal("2000000.00"), Decimal("275500.00"), Decimal("0.22"), Decimal("1500000.00")),
        (Decimal("2500000.00"), Decimal("385500.00"), Decimal("0.23"), Decimal("2000000.00")),
        (Decimal("3000000.00"), Decimal("500500.00"), Decimal("0.24"), Decimal("2500000.00")),
        (Decimal("Infinity"), Decimal("620500.00"), Decimal("0.25"), Decimal("3000000.00")),
    ]

    @classmethod
    def calculate(cls, materia_coletavel: Decimal) -> Decimal:
        """Calcula o montante exato de IRT para uma matéria coletável dada."""
        if materia_coletavel <= Decimal("100000.00"):
            return Decimal("0.00")

        for limite_sup, parcela_fixa, taxa, excesso in cls.ESCALOES:
            if materia_coletavel <= limite_sup:
                imposto = parcela_fixa + ((materia_coletavel - excesso) * taxa)
                return round_cur(imposto)

        return Decimal("0.00")


class PayrollEngine:
    """Motor orquestrador de processamento salarial."""

    @classmethod
    def process_payslip(
        cls,
        employee_id: str,
        name: str,
        iban: str,
        salario_base: Decimal,
        subsidio_alimentacao: Decimal = Decimal("0.00"),
        subsidio_transporte: Decimal = Decimal("0.00"),
        horas_extras_50: Decimal = Decimal("0.00"),
        horas_extras_75: Decimal = Decimal("0.00"),
        outras_deducoes: Decimal = Decimal("0.00"),
    ) -> Dict:
        # 1. Total Bruto (Earnings)
        total_bruto = (
            salario_base
            + subsidio_alimentacao
            + subsidio_transporte
            + horas_extras_50
            + horas_extras_75
        )

        # 2. Segurança Social (INSS)
        outros_suplementos = horas_extras_50 + horas_extras_75
        base_inss, inss_trab, inss_patr = InssCalculator.calculate(
            salario_base=salario_base,
            subsidio_alimentacao=subsidio_alimentacao,
            subsidio_transporte=subsidio_transporte,
            outros_suplementos_tributaveis=outros_suplementos,
        )

        # 3. Matéria Coletável para IRT:
        # Base Tributável = Total Bruto - Subsídios Isentos (até 30k cada) - Dedução INSS 3%
        isencao_alim = min(subsidio_alimentacao, Decimal("30000.00"))
        isencao_transp = min(subsidio_transporte, Decimal("30000.00"))
        total_isencoes = isencao_alim + isencao_transp

        materia_coletavel_irt = max(Decimal("0.00"), total_bruto - total_isencoes - inss_trab)
        irt = IrtCalculator.calculate(materia_coletavel_irt)

        # 4. Salário Líquido
        salario_liquido = total_bruto - inss_trab - irt - outras_deducoes

        return {
            "employee_id": employee_id,
            "name": name,
            "iban": iban,
            "salario_base": salario_base,
            "subsidio_alimentacao": subsidio_alimentacao,
            "subsidio_transporte": subsidio_transporte,
            "horas_extras": horas_extras_50 + horas_extras_75,
            "total_bruto": total_bruto,
            "base_inss": base_inss,
            "inss_trabalhador": inss_trab,
            "inss_patronal": inss_patr,
            "total_inss_11pct": inss_trab + inss_patr,
            "materia_coletavel_irt": materia_coletavel_irt,
            "irt": irt,
            "outras_deducoes": outras_deducoes,
            "salario_liquido": salario_liquido,
        }


class Ps2Exporter:
    """Gerador oficial do ficheiro de transferências em lote (PS2 / SEPA ASCII)."""

    @classmethod
    def generate(
        cls,
        ordenante_empresa: str,
        ordenante_nif: str,
        ordenante_iban: str,
        data_execucao: date,
        payslips: List[Dict],
    ) -> str:
        lines = []
        # Header (Registo Tipo 0)
        dt_str = data_execucao.strftime("%Y%m%d")
        lines.append(f"0{dt_str}{ordenante_nif[:14]:<14}{ordenante_empresa[:30]:<30}{ordenante_iban:<25}")

        total_valor = Decimal("0.00")
        # Details (Registo Tipo 1)
        for p in payslips:
            valor_cents = int(p["salario_liquido"] * 100)
            total_valor += p["salario_liquido"]
            lines.append(f"1{p['iban']:<25}{p['name'][:30]:<30}{valor_cents:015d}VENCIMENTO-{dt_str[:6]}")

        # Footer (Registo Tipo 9)
        total_cents = int(total_valor * 100)
        lines.append(f"9{len(payslips):06d}{total_cents:018d}")

        return "\r\n".join(lines)


class AccountingEventFactory:
    """Constrói o envelope de evento AMQP para integração automática com KudibaAccounting."""

    @classmethod
    def build_closed_period_event(
        cls,
        tenant_id: str,
        period_id: str,
        period_title: str,
        year: int,
        month: int,
        payslips: List[Dict],
    ) -> Dict:
        total_gross = sum((p["total_bruto"] for p in payslips), Decimal("0.00"))
        total_net = sum((p["salario_liquido"] for p in payslips), Decimal("0.00"))
        total_inss_employee = sum((p["inss_trabalhador"] for p in payslips), Decimal("0.00"))
        total_inss_employer = sum((p["inss_patronal"] for p in payslips), Decimal("0.00"))
        total_irt = sum((p["irt"] for p in payslips), Decimal("0.00"))

        return {
            "event_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "period_id": period_id,
            "event_type": "payroll.period.closed",
            "payload": {
                "periodTitle": period_title,
                "year": year,
                "month": month,
                "totalGross": str(total_gross),
                "totalNet": str(total_net),
                "totalInssEmployee": str(total_inss_employee),
                "totalInssEmployer": str(total_inss_employer),
                "totalIrt": str(total_irt),
                "employeeCount": len(payslips),
            },
        }


# ==============================================================================
# Demonstração e Verificação Interativa
# ==============================================================================
if __name__ == "__main__":
    print("=" * 80)
    print(" KUDIBA ERP — DEMONSTRAÇÃO DO MOTOR DE PAYROLL (LEGISLAÇÃO DE ANGOLA)")
    print("=" * 80)

    # Exemplo com 3 colaboradores com faixas salariais distintas:
    # 1. Operador de Caixa: Salário modesto (abaixo do teto de isenção de IRT)
    # 2. Técnico Contabilista: Salário intermédio (Escalão 300k - 500k)
    # 3. Diretor Financeiro: Salário alto (Escalão > 1.500.000 Kz)
    colaboradores = [
        {
            "id": "EMP-001",
            "name": "Maria Silva Manuel",
            "iban": "AO06004000001234567890123",
            "base": Decimal("95000.00"),
            "alim": Decimal("30000.00"),
            "transp": Decimal("30000.00"),
            "he50": Decimal("0.00"),
            "he75": Decimal("0.00"),
        },
        {
            "id": "EMP-002",
            "name": "João Baptista Domingos",
            "iban": "AO06005500009876543210145",
            "base": Decimal("350000.00"),
            "alim": Decimal("45000.00"),  # 15.000 tributáveis
            "transp": Decimal("35000.00"), # 5.000 tributáveis
            "he50": Decimal("25000.00"),
            "he75": Decimal("0.00"),
        },
        {
            "id": "EMP-003",
            "name": "Carlos Alberto Ferreira",
            "iban": "AO06000600005556667770189",
            "base": Decimal("1800000.00"),
            "alim": Decimal("50000.00"),
            "transp": Decimal("50000.00"),
            "he50": Decimal("0.00"),
            "he75": Decimal("0.00"),
        },
    ]

    payslips = []
    for c in colaboradores:
        res = PayrollEngine.process_payslip(
            employee_id=c["id"],
            name=c["name"],
            iban=c["iban"],
            salario_base=c["base"],
            subsidio_alimentacao=c["alim"],
            subsidio_transporte=c["transp"],
            horas_extras_50=c["he50"],
            horas_extras_75=c["he75"],
        )
        payslips.append(res)
        print(f"\n👤 Colaborador: {res['name']} ({res['employee_id']})")
        print(f"   • Salário Base:            {res['salario_base']:>14,.2f} Kz")
        print(f"   • Total Ilíquido (Bruto):  {res['total_bruto']:>14,.2f} Kz")
        print(f"   • Base Incidência INSS:    {res['base_inss']:>14,.2f} Kz")
        print(f"   • INSS Trabalhador (3%):   {res['inss_trabalhador']:>14,.2f} Kz")
        print(f"   • Encargo INSS Patronal (8%): {res['inss_patronal']:>11,.2f} Kz")
        print(f"   • Matéria Coletável IRT:   {res['materia_coletavel_irt']:>14,.2f} Kz")
        print(f"   • Retenção de IRT:         {res['irt']:>14,.2f} Kz")
        print(f"   ------------------------------------------------")
        print(f"   💰 Salário Líquido:        {res['salario_liquido']:>14,.2f} Kz")

    # 1. Geração do Ficheiro Bancário de Remessa PS2
    ps2_content = Ps2Exporter.generate(
        ordenante_empresa="Kudiba Solucoes Tecnologicas Lda",
        ordenante_nif="5412345678",
        ordenante_iban="AO06004000000010002000301",
        data_execucao=date(2026, 3, 31),
        payslips=payslips,
    )
    print("\n" + "=" * 80)
    print(" 📄 FICHEIRO BANCÁRIO DE REMESSA DE VENCIMENTOS (PS2 / SEPA ASCII):")
    print("=" * 80)
    print(ps2_content)

    # 2. Geração do Payload de Evento Contabilístico
    event_payload = AccountingEventFactory.build_closed_period_event(
        tenant_id=str(uuid.uuid4()),
        period_id=str(uuid.uuid4()),
        period_title="Folha Salarial - Março 2026",
        year=2026,
        month=3,
        payslips=payslips,
    )
    print("\n" + "=" * 80)
    print(" 📡 ENVELOPE DE EVENTO AMQP (RABBITMQ fiscal.events -> payroll.period.closed):")
    print("=" * 80)
    print(json.dumps(event_payload, indent=2))

    # Validação da Equação Contabilística de Partidas Dobradas:
    # Débitos = Salários Brutos (63.1) + INSS 8% (63.2)
    # Créditos = Salários Líquidos (36.1) + IRT Retido (34.1) + INSS 11% (34.3)
    total_debitos = Decimal(event_payload["payload"]["totalGross"]) + Decimal(event_payload["payload"]["totalInssEmployer"])
    total_creditos = (
        Decimal(event_payload["payload"]["totalNet"])
        + Decimal(event_payload["payload"]["totalIrt"])
        + Decimal(event_payload["payload"]["totalInssEmployee"])
        + Decimal(event_payload["payload"]["totalInssEmployer"])
    )
    print("\n" + "=" * 80)
    print(f" ⚖️ EQUAÇÃO DE FECHO CONTABILÍSTICO (PGC ANGOLA):")
    print(f"    Σ Débitos  (Custos 63.1 + 63.2): {total_debitos:>15,.2f} Kz")
    print(f"    Σ Créditos (36.1 + 34.1 + 34.3): {total_creditos:>15,.2f} Kz")
    assert total_debitos == total_creditos, "ERRO: Desequilíbrio em partidas dobradas!"
    print("    ✅ Partidas dobradas perfeitamente equilibradas (Σ Débito = Σ Crédito)!")
    print("=" * 80)
