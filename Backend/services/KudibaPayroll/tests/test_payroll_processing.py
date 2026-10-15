from decimal import Decimal
from src.domain.services.payroll_processor import PayrollProcessor


def test_payroll_processor_standard_employee():
    # Colaborador com base 350k, alimentação 60k, transporte 45k
    res = PayrollProcessor.process_employee_payroll(
        base_salary=Decimal("350000.00"),
        food_allowance=Decimal("60000.00"),
        transport_allowance=Decimal("45000.00"),
        days_worked=22,
    )

    assert res["base_salary"] == Decimal("350000.00")
    assert res["total_allowances"] == Decimal("105000.00")
    assert res["total_gross"] == Decimal("455000.00")
    assert res["base_inss"] == Decimal("395000.00")
    assert res["inss_employee"] == Decimal("11850.00")
    assert res["inss_employer"] == Decimal("31600.00")
    assert res["materia_coletavel_irt"] == Decimal("383150.00")
    assert res["irt"] == Decimal("48298.50")
    assert res["total_deductions"] == Decimal("60148.50")
    assert res["net_salary"] == Decimal("394851.50")

    # Equação fundamental:
    assert res["net_salary"] == res["total_gross"] - res["total_deductions"]

    # Equação de partidas dobradas (PGC Angola):
    total_debitos = res["total_gross"] + res["inss_employer"]
    total_creditos = res["net_salary"] + res["irt"] + res["inss_employee"] + res["inss_employer"]
    assert total_debitos == total_creditos


def test_payroll_processor_with_overtime_and_advances():
    # Colaborador com base 200k, 10 horas a 50%, adiantamento de 20k
    res = PayrollProcessor.process_employee_payroll(
        base_salary=Decimal("200000.00"),
        food_allowance=Decimal("30000.00"),
        transport_allowance=Decimal("30000.00"),
        overtime_50_hours=Decimal("10.00"),
        advances=Decimal("20000.00"),
        days_worked=22,
    )

    assert res["total_overtime"] > Decimal("0.00")
    assert res["net_salary"] == res["total_gross"] - res["total_deductions"]

    # Validação contábil ∑ D = ∑ C
    total_debitos = res["total_gross"] + res["inss_employer"]
    total_creditos = (
        res["net_salary"]
        + res["irt"]
        + res["inss_employee"]
        + res["inss_employer"]
        + Decimal("20000.00")  # Adiantamento a crédito de 37.2 (Adiantamentos)
    )
    assert total_debitos == total_creditos
