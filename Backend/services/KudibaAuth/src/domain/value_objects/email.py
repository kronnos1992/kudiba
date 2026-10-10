import re
from dataclasses import dataclass
from src.domain.error import DomainError

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self):
        clean_value = self.value.strip().lower()
        if not EMAIL_REGEX.match(clean_value):
            raise DomainError(f"Formato de e-mail inválido: '{self.value}'", code="INVALID_EMAIL")
        object.__setattr__(self, "value", clean_value)

    def __str__(self) -> str:
        return self.value
