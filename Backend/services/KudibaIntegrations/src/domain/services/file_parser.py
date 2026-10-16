import csv
import io
from typing import Any, Dict, List

from src.domain.error import ValidationError
from src.domain.value_objects.enums import DataFormat


def parse_csv(
    content: bytes, delimiter: str = ",", has_header: bool = True, encoding: str = "utf-8"
) -> List[Dict[str, Any]]:
    text = content.decode(encoding, errors="replace").lstrip("\ufeff")
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        return []

    if has_header:
        header = [column.strip() for column in rows[0]]
        data_rows = rows[1:]
    else:
        width = max(len(row) for row in rows)
        header = [f"column_{index}" for index in range(width)]
        data_rows = rows

    records: List[Dict[str, Any]] = []
    for row in data_rows:
        record = {header[i]: row[i] for i in range(min(len(header), len(row)))}
        records.append(record)
    return records


def parse_fixed_width(
    content: bytes, column_widths: List[Dict[str, Any]], encoding: str = "utf-8"
) -> List[Dict[str, Any]]:
    if not column_widths:
        raise ValidationError("A importação de largura fixa exige 'column_widths' configurado.")

    text = content.decode(encoding, errors="replace")
    records: List[Dict[str, Any]] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        cursor = 0
        record: Dict[str, Any] = {}
        for column in column_widths:
            name = column.get("name")
            width = int(column.get("width", 0))
            if not name or width <= 0:
                raise ValidationError("Cada coluna de largura fixa exige 'name' e 'width'.")
            record[name] = line[cursor : cursor + width].strip()
            cursor += width
        records.append(record)
    return records


def parse_file(
    content: bytes,
    data_format: DataFormat,
    delimiter: str = ",",
    has_header: bool = True,
    encoding: str = "utf-8",
    column_widths: List[Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    if data_format == DataFormat.CSV:
        return parse_csv(content, delimiter=delimiter, has_header=has_header, encoding=encoding)
    if data_format == DataFormat.FIXED_WIDTH:
        return parse_fixed_width(content, column_widths or [], encoding=encoding)
    raise ValidationError(
        f"Formato de ficheiro '{data_format.value}' não suportado na importação de ficheiros."
    )
