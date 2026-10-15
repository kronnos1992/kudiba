from datetime import date
from decimal import Decimal
from typing import Dict, List, Any


class Ps2Exporter:
    @classmethod
    def generate(
        cls,
        ordenante_empresa: str,
        ordenante_nif: str,
        ordenante_iban: str,
        data_execucao: date,
        payslips_data: List[Dict[str, Any]],
    ) -> str:
        lines: List[str] = []
        
        # Registro Tipo 0 - Cabeçalho do Ficheiro de Lote
        header = (
            f"0"
            f"{data_execucao.strftime('%Y%m%d')}"
            f"{ordenante_nif[:14]:<14}"
            f"{ordenante_empresa[:30]:<30}"
            f"{ordenante_iban[:25]:<25}"
        )
        lines.append(header)

        total_centimos = 0
        total_registos = 0

        # Registros Tipo 1 - Detalhe de Transferência
        for p in payslips_data:
            net_amount = p["net_salary"] if isinstance(p["net_salary"], Decimal) else Decimal(str(p["net_salary"]))
            centimos = int(net_amount * 100)
            total_centimos += centimos
            total_registos += 1

            beneficiary_iban = p.get("iban", "")
            beneficiary_name = p.get("full_name", "")
            reference = p.get("reference", f"VENCIMENTO-{data_execucao.strftime('%Y%m')}")

            record = (
                f"1"
                f"{beneficiary_iban[:25]:<25}"
                f"{beneficiary_name[:30]:<30}"
                f"{centimos:015d}"
                f"{reference[:30]:<30}"
            )
            lines.append(record)

        # Registro Tipo 9 - Rodapé e Totais de Controlo
        trailer = (
            f"9"
            f"{total_registos:06d}"
            f"{total_centimos:018d}"
        )
        lines.append(trailer)

        return "\r\n".join(lines) + "\r\n"
