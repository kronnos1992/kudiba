from decimal import Decimal, ROUND_HALF_UP
from typing import Tuple


class InssCalculator:
    EMPLOYEE_RATE: Decimal = Decimal("0.03")
    EMPLOYER_RATE: Decimal = Decimal("0.08")
    FOOD_ALLOWANCE_EXEMPT_LIMIT: Decimal = Decimal("30000.00")
    TRANSPORT_ALLOWANCE_EXEMPT_LIMIT: Decimal = Decimal("30000.00")

    @classmethod
    def calculate_base(
        cls,
        base_salary: Decimal,
        food_allowance: Decimal = Decimal("0.00"),
        transport_allowance: Decimal = Decimal("0.00"),
        overtime_total: Decimal = Decimal("0.00"),
        other_taxable_earnings: Decimal = Decimal("0.00"),
    ) -> Decimal:
        taxable_food = max(Decimal("0.00"), food_allowance - cls.FOOD_ALLOWANCE_EXEMPT_LIMIT)
        taxable_transport = max(Decimal("0.00"), transport_allowance - cls.TRANSPORT_ALLOWANCE_EXEMPT_LIMIT)
        
        base = base_salary + taxable_food + taxable_transport + overtime_total + other_taxable_earnings
        return base.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def calculate_contributions(cls, inss_base: Decimal) -> Tuple[Decimal, Decimal]:
        employee_part = (inss_base * cls.EMPLOYEE_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        employer_part = (inss_base * cls.EMPLOYER_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return employee_part, employer_part
