from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from src.domain.services.irt_calculator import IrtCalculator
from src.domain.services.inss_calculator import InssCalculator
from src.domain.value_objects.enums import PayslipLineType


class PayrollProcessor:
    STANDARD_MONTHLY_HOURS: Decimal = Decimal("173.33")
    STANDARD_WORKING_DAYS: int = 22

    @classmethod
    def process_employee_payroll(
        cls,
        base_salary: Decimal,
        food_allowance: Decimal = Decimal("0.00"),
        transport_allowance: Decimal = Decimal("0.00"),
        housing_allowance: Decimal = Decimal("0.00"),
        function_allowance: Decimal = Decimal("0.00"),
        other_allowances: Decimal = Decimal("0.00"),
        overtime_50_hours: Decimal = Decimal("0.00"),
        overtime_75_hours: Decimal = Decimal("0.00"),
        advances: Decimal = Decimal("0.00"),
        other_deductions: Decimal = Decimal("0.00"),
        days_worked: Optional[int] = None,
        absence_days: int = 0,
    ) -> Dict[str, Any]:
        effective_absence_days = max(0, absence_days)
        if days_worked is None:
            days_worked = max(0, cls.STANDARD_WORKING_DAYS - effective_absence_days)
        else:
            days_worked = max(0, days_worked)
            effective_absence_days = max(effective_absence_days, cls.STANDARD_WORKING_DAYS - days_worked)

        absence_deduction = (
            (base_salary * Decimal(effective_absence_days) / Decimal(cls.STANDARD_WORKING_DAYS))
            if effective_absence_days > 0
            else Decimal("0.00")
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        paid_base = (base_salary - absence_deduction).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        hourly_rate = (base_salary / cls.STANDARD_MONTHLY_HOURS).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        ot_50_amount = (overtime_50_hours * hourly_rate * Decimal("1.50")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        ot_75_amount = (overtime_75_hours * hourly_rate * Decimal("1.75")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_overtime = ot_50_amount + ot_75_amount

        total_allowances = food_allowance + transport_allowance + housing_allowance + function_allowance + other_allowances
        total_gross = base_salary + total_allowances + total_overtime

        base_inss = InssCalculator.calculate_base(
            base_salary=paid_base,
            food_allowance=food_allowance,
            transport_allowance=transport_allowance,
            overtime_total=total_overtime,
            other_taxable_earnings=housing_allowance + function_allowance + other_allowances,
        )

        inss_employee, inss_employer = InssCalculator.calculate_contributions(base_inss)

        exempt_food = min(food_allowance, InssCalculator.FOOD_ALLOWANCE_EXEMPT_LIMIT)
        exempt_transport = min(transport_allowance, InssCalculator.TRANSPORT_ALLOWANCE_EXEMPT_LIMIT)
        
        materia_coletavel_irt = paid_base + total_allowances + total_overtime - exempt_food - exempt_transport - inss_employee
        if materia_coletavel_irt < Decimal("0.00"):
            materia_coletavel_irt = Decimal("0.00")
        materia_coletavel_irt = materia_coletavel_irt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        irt = IrtCalculator.calculate(materia_coletavel_irt)

        total_deductions = absence_deduction + inss_employee + irt + advances + other_deductions
        net_salary = total_gross - total_deductions

        lines: List[Dict[str, Any]] = [
            {
                "line_type": PayslipLineType.EARNING,
                "code": "BASE_SALARY",
                "description": "Vencimento Base Mensal",
                "reference_value": base_salary,
                "quantity": Decimal(days_worked),
                "rate": Decimal("1.00"),
                "amount": base_salary,
            }
        ]

        if absence_deduction > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.DEDUCTION,
                "code": "ABSENCE",
                "description": f"Desconto por Faltas ({effective_absence_days} dia/s)",
                "reference_value": base_salary,
                "quantity": Decimal(effective_absence_days),
                "rate": (base_salary / Decimal(cls.STANDARD_WORKING_DAYS)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
                "amount": absence_deduction,
            })

        if food_allowance > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "FOOD_ALLOWANCE",
                "description": "Subsídio de Alimentação",
                "reference_value": food_allowance,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": food_allowance,
            })

        if transport_allowance > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "TRANSPORT_ALLOWANCE",
                "description": "Subsídio de Transporte",
                "reference_value": transport_allowance,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": transport_allowance,
            })

        if housing_allowance > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "HOUSING_ALLOWANCE",
                "description": "Subsídio de Alojamento / Renda",
                "reference_value": housing_allowance,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": housing_allowance,
            })

        if function_allowance > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "FUNCTION_ALLOWANCE",
                "description": "Subsídio de Chefia / Função",
                "reference_value": function_allowance,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": function_allowance,
            })

        if other_allowances > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "OTHER_ALLOWANCE",
                "description": "Outros Subsídios e Remunerações",
                "reference_value": other_allowances,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": other_allowances,
            })

        if ot_50_amount > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "OVERTIME_50",
                "description": "Horas Extraordinárias (50%)",
                "reference_value": hourly_rate,
                "quantity": overtime_50_hours,
                "rate": Decimal("1.50"),
                "amount": ot_50_amount,
            })

        if ot_75_amount > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.EARNING,
                "code": "OVERTIME_75",
                "description": "Horas Extraordinárias (75%)",
                "reference_value": hourly_rate,
                "quantity": overtime_75_hours,
                "rate": Decimal("1.75"),
                "amount": ot_75_amount,
            })

        lines.append({
            "line_type": PayslipLineType.DEDUCTION,
            "code": "INSS_EMPLOYEE",
            "description": "Segurança Social - INSS (3%)",
            "reference_value": base_inss,
            "quantity": Decimal("1.00"),
            "rate": Decimal("0.03"),
            "amount": inss_employee,
        })

        if irt > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.DEDUCTION,
                "code": "IRT",
                "description": "Imposto sobre o Rendimento do Trabalho (IRT)",
                "reference_value": materia_coletavel_irt,
                "quantity": Decimal("1.00"),
                "rate": Decimal("0.00"),
                "amount": irt,
            })

        if advances > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.DEDUCTION,
                "code": "ADVANCE",
                "description": "Adiantamento Salarial",
                "reference_value": advances,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": advances,
            })

        if other_deductions > Decimal("0.00"):
            lines.append({
                "line_type": PayslipLineType.DEDUCTION,
                "code": "OTHER_DEDUCTION",
                "description": "Outros Descontos Autorizados",
                "reference_value": other_deductions,
                "quantity": Decimal("1.00"),
                "rate": Decimal("1.00"),
                "amount": other_deductions,
            })

        lines.append({
            "line_type": PayslipLineType.EMPLOYER_COST,
            "code": "INSS_EMPLOYER",
            "description": "Segurança Social Patronal (8%)",
            "reference_value": base_inss,
            "quantity": Decimal("1.00"),
            "rate": Decimal("0.08"),
            "amount": inss_employer,
        })

        return {
            "days_worked": days_worked,
            "absence_days": effective_absence_days,
            "absence_deduction": absence_deduction,
            "base_salary": base_salary,
            "total_gross": total_gross,
            "total_allowances": total_allowances,
            "total_overtime": total_overtime,
            "base_inss": base_inss,
            "inss_employee": inss_employee,
            "inss_employer": inss_employer,
            "materia_coletavel_irt": materia_coletavel_irt,
            "irt": irt,
            "total_deductions": total_deductions,
            "net_salary": net_salary,
            "lines": lines,
        }
