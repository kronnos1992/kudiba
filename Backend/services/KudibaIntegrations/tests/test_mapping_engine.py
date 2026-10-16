from datetime import datetime, timezone
from decimal import Decimal

import pytest

from src.domain.error import ValidationError
from src.domain.services.mapping_engine import (
    apply_field_mappings,
    compute_dedup_hash,
    extract_records,
    resolve_path,
)


def test_resolve_path_dotted_and_index():
    payload = {"client": {"name": "Ana"}}
    assert resolve_path(payload, "client.name") == "Ana"
    rows = {"items": [{"sku": "A"}, {"sku": "B"}]}
    assert resolve_path(rows, "items[1].sku") == "B"


def test_resolve_path_returns_none_when_missing():
    assert resolve_path({}, "a.b") is None
    assert resolve_path({"a": 5}, "b.c") is None
    assert resolve_path({"a": {"b": 1}}, "") == {"a": {"b": 1}}


def test_extract_records_wraps_single_object():
    assert extract_records({"sku": "A"}, None) == [{"sku": "A"}]


def test_extract_records_uses_record_path():
    payload = {"data": {"rows": [{"sku": "A"}, {"sku": "B"}]}}
    records = extract_records(payload, "data.rows")
    assert len(records) == 2
    assert records[1]["sku"] == "B"


def test_extract_records_ignores_non_dict_items():
    assert extract_records({"rows": ["x", {"a": 1}]}, "rows") == [{"a": 1}]
    assert extract_records({"rows": 5}, "rows") == []


def test_apply_field_mappings_types_and_transforms():
    record = {
        "name": "  ana silva ",
        "price": "12.50",
        "qty": "7",
        "active": "true",
        "ts": "2025-03-01 10:15:00",
        "day": "2025-03-01",
    }
    spec = [
        {"target": "employee_name", "source": "name", "type": "string", "transform": "title"},
        {"target": "amount", "source": "price", "type": "decimal"},
        {"target": "qty", "source": "qty", "type": "int"},
        {"target": "is_active", "source": "active", "type": "bool"},
        {"target": "punched_at", "source": "ts", "type": "datetime", "format": "%Y-%m-%d %H:%M:%S"},
        {"target": "work_date", "source": "day", "type": "date"},
    ]
    result = apply_field_mappings(record, spec)
    assert result["employee_name"] == "Ana Silva"
    assert result["amount"] == "12.50"
    assert result["qty"] == 7
    assert result["is_active"] is True
    assert result["punched_at"] == "2025-03-01T10:15:00+00:00"
    assert result["work_date"] == "2025-03-01"


def test_apply_field_mappings_datetime_from_epoch_and_naive():
    spec = [{"target": "ts", "source": "epoch", "type": "datetime"}]
    result = apply_field_mappings({"epoch": 1740826800}, spec)
    assert result["ts"].endswith("+00:00")
    assert datetime.fromisoformat(result["ts"]).tzinfo == timezone.utc


def test_apply_field_mappings_const_default_required_and_value_map():
    record = {"qty": 3, "status": "P"}
    spec = [
        {"target": "company", "const": "KUDIBA"},
        {"target": "qty", "source": "qty", "type": "int"},
        {"target": "missing", "source": "nope", "default": 0, "type": "int"},
        {"target": "state", "source": "status", "value_map": {"P": "PRESENT", "A": "ABSENT"}},
        {"target": "note", "source": "nope2"},
    ]
    result = apply_field_mappings(record, spec)
    assert result["company"] == "KUDIBA"
    assert result["qty"] == 3
    assert result["missing"] == 0
    assert result["state"] == "PRESENT"
    assert result["note"] is None


def test_apply_field_mappings_required_missing_raises():
    spec = [{"target": "employee_code", "source": "code", "required": True}]
    with pytest.raises(ValidationError):
        apply_field_mappings({"other": 1}, spec)


def test_apply_field_mappings_unknown_type_and_transform_raise():
    with pytest.raises(ValidationError):
        apply_field_mappings({"a": "1"}, [{"target": "x", "source": "a", "type": "blob"}])
    with pytest.raises(ValidationError):
        apply_field_mappings({"a": "1"}, [{"target": "x", "source": "a", "transform": "slug"}])


def test_apply_field_mappings_invalid_date_raises():
    with pytest.raises(ValidationError):
        apply_field_mappings(
            {"d": "01/03/2025"},
            [{"target": "d", "source": "d", "type": "datetime", "format": "%Y-%m-%d"}],
        )


def test_compute_dedup_hash_is_stable_and_sensitive_to_values():
    mapped = {"employee_code": "EMP001", "punched_at": "2025-03-01T07:59:00+00:00"}
    h1 = compute_dedup_hash(["employee_code", "punched_at"], mapped)
    h1_again = compute_dedup_hash(["employee_code", "punched_at"], dict(mapped))
    assert h1 == h1_again
    assert compute_dedup_hash([], mapped) is None
    assert compute_dedup_hash(["employee_code"], mapped) != compute_dedup_hash(
        ["employee_code"], {**mapped, "employee_code": "EMP002"}
    )
    assert h1 != compute_dedup_hash(["punched_at"], mapped)


def test_apply_field_mappings_preserves_decimal_as_string():
    spec = [{"target": "amount", "source": "price", "type": "decimal"}]
    result = apply_field_mappings({"price": "10.00"}, spec)
    assert result["amount"] == str(Decimal("10.00"))
