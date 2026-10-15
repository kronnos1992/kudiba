from decimal import Decimal, ROUND_HALF_UP
from typing import NamedTuple, List


class IrtBracket(NamedTuple):
    limit_min: Decimal
    limit_max: Decimal
    fixed_amount: Decimal
    rate: Decimal
    excess_base: Decimal


class IrtCalculator:
    BRACKETS: List[IrtBracket] = [
        IrtBracket(Decimal("0.00"), Decimal("100000.00"), Decimal("0.00"), Decimal("0.00"), Decimal("0.00")),
        IrtBracket(Decimal("100000.01"), Decimal("150000.00"), Decimal("0.00"), Decimal("0.13"), Decimal("100000.00")),
        IrtBracket(Decimal("150000.01"), Decimal("200000.00"), Decimal("6500.00"), Decimal("0.16"), Decimal("150000.00")),
        IrtBracket(Decimal("200000.01"), Decimal("300000.00"), Decimal("14500.00"), Decimal("0.18"), Decimal("200000.00")),
        IrtBracket(Decimal("300000.01"), Decimal("500000.00"), Decimal("32500.00"), Decimal("0.19"), Decimal("300000.00")),
        IrtBracket(Decimal("500000.01"), Decimal("1000000.00"), Decimal("70500.00"), Decimal("0.20"), Decimal("500000.00")),
        IrtBracket(Decimal("1000000.01"), Decimal("1500000.00"), Decimal("170500.00"), Decimal("0.21"), Decimal("1000000.00")),
        IrtBracket(Decimal("1500000.01"), Decimal("2000000.00"), Decimal("275500.00"), Decimal("0.22"), Decimal("1500000.00")),
        IrtBracket(Decimal("2000000.01"), Decimal("2500000.00"), Decimal("385500.00"), Decimal("0.23"), Decimal("2000000.00")),
        IrtBracket(Decimal("2500000.01"), Decimal("3000000.00"), Decimal("500500.00"), Decimal("0.24"), Decimal("2500000.00")),
        IrtBracket(Decimal("3000000.01"), Decimal("999999999999.00"), Decimal("620500.00"), Decimal("0.25"), Decimal("3000000.00")),
    ]

    @classmethod
    def calculate(cls, taxable_income: Decimal) -> Decimal:
        if taxable_income <= Decimal("100000.00"):
            return Decimal("0.00")

        for bracket in cls.BRACKETS:
            if taxable_income <= bracket.limit_max:
                excess = taxable_income - bracket.excess_base
                tax = bracket.fixed_amount + (excess * bracket.rate)
                return tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        last_bracket = cls.BRACKETS[-1]
        excess = taxable_income - last_bracket.excess_base
        tax = last_bracket.fixed_amount + (excess * last_bracket.rate)
        return tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
