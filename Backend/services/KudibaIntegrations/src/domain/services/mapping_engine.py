import hashlib
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from src.domain.error import ValidationError

_SUPPORTED_TYPES = {"string", "int", "float", "decimal", "bool", "datetime", "date"}
_TRUE_VALUES = {"1", "true", "yes", "sim", "y", "s", "v"}
_FALSE_VALUES = {"0", "false", "no", "nao", "não", "n", "f"}


def resolve_path(data: Any, path: Optional[str]) -> Any:
    if not path:
        return data
    current = data
    for raw_part in path.split("."):
        if current is None:
            return None
        part = raw_part
        index: Optional[int] = None
        if raw_part.endswith("]") and "[" in raw_part:
            part, _, idx = raw_part[:-1].partition("[")
            try:
                index = int(idx)
            except ValueError:
                return None
        if part:
            if not isinstance(current, dict):
                return None
            current = current.get(part)
        if index is not None:
            if not isinstance(current, list) or index >= len(current):
                return None
            current = current[index]
    return current


def extract_records(payload: Any, record_path: Optional[str]) -> List[Dict[str, Any]]:
    resolved = resolve_path(payload, record_path)
    if resolved is None:
        return []
    if isinstance(resolved, dict):
        return [resolved]
    if isinstance(resolved, list):
        return [item for item in resolved if isinstance(item, dict)]
    return []


def _apply_string_transform(value: Any, transform: Optional[str]) -> Any:
    if not transform:
        return value
    text = (value if isinstance(value, str) else str(value)).strip()
    if transform == "trim":
        return text.strip()
    if transform == "upper":
        return text.upper()
    if transform == "lower":
        return text.lower()
    if transform == "title":
        return text.title()
    raise ValidationError(f"Transformação desconhecida: '{transform}'.")


def _coerce(value: Any, spec: Dict[str, Any]) -> Any:
    type_name = spec.get("type", "string")
    if type_name not in _SUPPORTED_TYPES:
        raise ValidationError(f"Tipo de campo desconhecido: '{type_name}'.")

    if type_name == "string":
        return str(value)

    if type_name == "int":
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            raise ValidationError(f"Valor '{value}' não é um inteiro válido.")

    if type_name == "float":
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            raise ValidationError(f"Valor '{value}' não é um número decimal válido.")

    if type_name == "decimal":
        try:
            return str(Decimal(str(value).strip()))
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError(f"Valor '{value}' não é um decimal válido.")

    if type_name == "bool":
        text = str(value).strip().lower()
        if text in _TRUE_VALUES:
            return True
        if text in _FALSE_VALUES:
            return False
        raise ValidationError(f"Valor '{value}' não é um booleano válido.")

    if type_name in ("datetime", "date"):
        fmt = spec.get("format")
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(float(value), tz=timezone.utc)
        elif isinstance(value, str):
            text = value.strip()
            try:
                parsed = datetime.strptime(text, fmt) if fmt else datetime.fromisoformat(text)
            except ValueError:
                raise ValidationError(
                    f"Valor de data/hora '{value}' inválido (formato esperado: {fmt or 'ISO-8601'})."
                )
        elif isinstance(value, datetime):
            parsed = value
        elif isinstance(value, date):
            parsed = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
        else:
            raise ValidationError(f"Valor de data/hora inválido: '{value}'.")

        if type_name == "date":
            return parsed.date().isoformat()
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()

    return value


def apply_field_mappings(
    record: Dict[str, Any], field_mappings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for spec in field_mappings:
        target = spec.get("target")
        if not target:
            continue

        if "const" in spec:
            raw: Any = spec.get("const")
        else:
            source = spec.get("source")
            raw = resolve_path(record, source) if source else None

        if raw is None or (isinstance(raw, str) and raw.strip() == ""):
            default = spec.get("default")
            if default is not None:
                raw = default
            elif spec.get("required"):
                raise ValidationError(
                    f"Campo obrigatório '{source or target}' ausente no registo de origem."
                )
            else:
                result[target] = None
                continue

        value = _apply_string_transform(raw, spec.get("transform"))

        value_map = spec.get("value_map")
        if value_map and isinstance(value_map, dict):
            value = value_map.get(str(value), value)

        result[target] = _coerce(value, spec)
    return result


def compute_dedup_hash(dedup_fields: List[str], mapped: Dict[str, Any]) -> Optional[str]:
    if not dedup_fields:
        return None
    parts = []
    for field in dedup_fields:
        parts.append(str(mapped.get(field, "")))
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return digest
