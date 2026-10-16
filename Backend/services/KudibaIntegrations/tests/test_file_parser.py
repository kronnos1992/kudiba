import pytest

from src.domain.error import ValidationError
from src.domain.services.file_parser import parse_csv, parse_fixed_width, parse_file
from src.domain.value_objects.enums import DataFormat


def test_parse_csv_with_header():
    content = b"employee_code,punched_at,direction\nEMP001,2025-03-01T07:59:00,IN\nEMP001,2025-03-01T17:01:00,OUT\n"
    rows = parse_csv(content)
    assert rows == [
        {"employee_code": "EMP001", "punched_at": "2025-03-01T07:59:00", "direction": "IN"},
        {"employee_code": "EMP001", "punched_at": "2025-03-01T17:01:00", "direction": "OUT"},
    ]


def test_parse_csv_without_header_uses_indexed_keys():
    content = b"EMP001;2025-03-01T07:59:00;IN\n"
    rows = parse_csv(content, has_header=False, delimiter=";")
    assert rows == [{"column_0": "EMP001", "column_1": "2025-03-01T07:59:00", "column_2": "IN"}]


def test_parse_csv_handles_bom_and_crlf():
    content = "﻿code;value\r\nA;1\r\nB;2\r\n".encode("utf-8")
    rows = parse_csv(content, delimiter=";")
    assert rows == [{"code": "A", "value": "1"}, {"code": "B", "value": "2"}]


def test_parse_csv_skips_blank_lines():
    content = b"a,b\n\n1,2\n\n"
    assert parse_csv(content) == [{"a": "1", "b": "2"}]


def test_parse_fixed_width():
    content = b"EMP001      20250301 075900 IN\nEMP002      20250301 170100 OUT\n"
    widths = [
        {"name": "employee_code", "width": 12},
        {"name": "punched_at", "width": 16},
        {"name": "direction", "width": 3},
    ]
    rows = parse_fixed_width(content, widths)
    assert rows[0] == {"employee_code": "EMP001", "punched_at": "20250301 075900", "direction": "IN"}
    assert rows[1]["direction"] == "OUT"


def test_parse_fixed_width_requires_widths():
    with pytest.raises(ValidationError):
        parse_fixed_width(b"anything", [])


def test_parse_fixed_width_requires_name_and_width_per_column():
    with pytest.raises(ValidationError):
        parse_fixed_width(b"anything", [{"name": "code", "width": 0}])


def test_parse_file_dispatches_to_csv_and_fixed_width():
    csv_content = b"a,b\n1,2\n"
    assert parse_file(csv_content, DataFormat.CSV) == [{"a": "1", "b": "2"}]
    fixed = parse_file(
        b"EMP001      IN",
        DataFormat.FIXED_WIDTH,
        column_widths=[{"name": "employee_code", "width": 12}, {"name": "direction", "width": 3}],
    )
    assert fixed == [{"employee_code": "EMP001", "direction": "IN"}]


def test_parse_file_unsupported_format_raises():
    with pytest.raises(ValidationError):
        parse_file(b"whatever", DataFormat.JSON)
