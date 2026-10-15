from decimal import Decimal
import pytest
from src.domain.services.irt_calculator import IrtCalculator


def test_irt_exempt_under_100k():
    assert IrtCalculator.calculate(Decimal("0.00")) == Decimal("0.00")
    assert IrtCalculator.calculate(Decimal("70000.00")) == Decimal("0.00")
    assert IrtCalculator.calculate(Decimal("100000.00")) == Decimal("0.00")


def test_irt_bracket_2_100k_to_150k():
    # Matéria: 120,000 -> excesso 20,000 * 13% = 2,600
    assert IrtCalculator.calculate(Decimal("120000.00")) == Decimal("2600.00")
    # Topo: 150,000 -> excesso 50,000 * 13% = 6,500
    assert IrtCalculator.calculate(Decimal("150000.00")) == Decimal("6500.00")


def test_irt_bracket_3_150k_to_200k():
    # Matéria: 180,000 -> 6,500 + 30,000 * 16% = 6,500 + 4,800 = 11,300
    assert IrtCalculator.calculate(Decimal("180000.00")) == Decimal("11300.00")
    # Topo: 200,000 -> 6,500 + 50,000 * 16% = 14,500
    assert IrtCalculator.calculate(Decimal("200000.00")) == Decimal("14500.00")


def test_irt_bracket_4_200k_to_300k():
    # Matéria: 250,000 -> 14,500 + 50,000 * 18% = 14,500 + 9,000 = 23,500
    assert IrtCalculator.calculate(Decimal("250000.00")) == Decimal("23500.00")
    # Topo: 300,000 -> 14,500 + 100,000 * 18% = 32,500
    assert IrtCalculator.calculate(Decimal("300000.00")) == Decimal("32500.00")


def test_irt_bracket_5_300k_to_500k():
    # Matéria: 383,150 -> 32,500 + 83,150 * 19% = 32,500 + 15,798.50 = 48,298.50
    assert IrtCalculator.calculate(Decimal("383150.00")) == Decimal("48298.50")


def test_irt_bracket_6_500k_to_1m():
    # Matéria: 750,000 -> 70,500 + 250,000 * 20% = 70,500 + 50,000 = 120,500
    assert IrtCalculator.calculate(Decimal("750000.00")) == Decimal("120500.00")


def test_irt_bracket_7_1m_to_1_5m():
    # Matéria: 1,200,000 -> 170,500 + 200,000 * 21% = 170,500 + 42,000 = 212,500
    assert IrtCalculator.calculate(Decimal("1200000.00")) == Decimal("212500.00")


def test_irt_bracket_8_1_5m_to_2m():
    # Matéria: 1,784,800 -> 275,500 + 284,800 * 22% = 275,500 + 62,656 = 338,156.00
    assert IrtCalculator.calculate(Decimal("1784800.00")) == Decimal("338156.00")


def test_irt_bracket_9_2m_to_2_5m():
    # Matéria: 2,200,000 -> 385,500 + 200,000 * 23% = 385,500 + 46,000 = 431,500
    assert IrtCalculator.calculate(Decimal("2200000.00")) == Decimal("431500.00")


def test_irt_bracket_10_2_5m_to_3m():
    # Matéria: 2,800,000 -> 500,500 + 300,000 * 24% = 500,500 + 72,000 = 572,500
    assert IrtCalculator.calculate(Decimal("2800000.00")) == Decimal("572500.00")


def test_irt_bracket_11_above_3m():
    # Matéria: 4,000,000 -> 620,500 + 1,000,000 * 25% = 620,500 + 250,000 = 870,500
    assert IrtCalculator.calculate(Decimal("4000000.00")) == Decimal("870500.00")
