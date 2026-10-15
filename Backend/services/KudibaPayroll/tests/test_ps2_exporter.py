from datetime import date
from decimal import Decimal
from src.infrastructure.exporters.ps2_exporter import Ps2Exporter


def test_ps2_export_formatting():
    data = [
        {
            "iban": "AO06004000001234567890123",
            "full_name": "Maria Silva Manuel",
            "net_salary": Decimal("152150.00"),
        },
        {
            "iban": "AO06005500009876543210145",
            "full_name": "João Baptista Domingos",
            "net_salary": Decimal("394851.50"),
        },
    ]

    content = Ps2Exporter.generate(
        ordenante_empresa="Kudiba Solucoes Tecnologicas Lda",
        ordenante_nif="5412345678",
        ordenante_iban="AO06004000000010002000301",
        data_execucao=date(2026, 3, 31),
        payslips_data=data,
    )

    lines = content.strip().split("\r\n")
    assert len(lines) == 4  # Header, 2 records, Trailer

    # Header
    assert lines[0].startswith("020260331")
    assert "5412345678" in lines[0]
    assert "AO06004000000010002000301" in lines[0]

    # Records
    assert lines[1].startswith("1AO06004000001234567890123Maria Silva Manuel")
    assert "000000015215000" in lines[1]

    assert lines[2].startswith("1AO06005500009876543210145João Baptista Domingos")
    assert "000000039485150" in lines[2]

    # Trailer: 2 registos, total = 152,150.00 + 394,851.50 = 547,001.50 -> 54,700,150 centimos
    assert lines[3].startswith("9000002")
    assert lines[3] == "9000002000000000054700150"
