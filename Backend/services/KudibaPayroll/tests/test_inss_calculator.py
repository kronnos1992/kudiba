from decimal import Decimal
from src.domain.services.inss_calculator import InssCalculator


def test_inss_base_without_allowance_exemption_excess():
    # Salário base 100k, alimentação 30k (isento), transporte 30k (isento)
    # Base de incidência = 100k
    base = InssCalculator.calculate_base(
        base_salary=Decimal("100000.00"),
        food_allowance=Decimal("30000.00"),
        transport_allowance=Decimal("30000.00"),
    )
    assert base == Decimal("100000.00")

    emp, empr = InssCalculator.calculate_contributions(base)
    assert emp == Decimal("3000.00")  # 3%
    assert empr == Decimal("8000.00")  # 8%


def test_inss_base_with_excess_allowances():
    # Salário base 350k, alimentação 60k (excesso de 30k), transporte 45k (excesso de 15k)
    # Base de incidência = 350k + 30k + 15k = 395k
    base = InssCalculator.calculate_base(
        base_salary=Decimal("350000.00"),
        food_allowance=Decimal("60000.00"),
        transport_allowance=Decimal("45000.00"),
    )
    assert base == Decimal("395000.00")

    emp, empr = InssCalculator.calculate_contributions(base)
    assert emp == Decimal("11850.00")  # 395k * 3%
    assert empr == Decimal("31600.00")  # 395k * 8%
