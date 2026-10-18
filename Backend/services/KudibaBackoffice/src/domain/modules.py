from dataclasses import dataclass
from typing import List, Sequence

from src.domain.error import InvalidModulesError


@dataclass(frozen=True)
class ModuleDefinition:
    key: str
    name: str
    description: str


BILLABLE_MODULES: Sequence[ModuleDefinition] = (
    ModuleDefinition("invoicing", "Faturação AGT", "Facturas, séries fiscais e SAF-T Facturação"),
    ModuleDefinition("inventory", "Artigos & Armazéns", "Catálogo, stock e movimentações"),
    ModuleDefinition("treasury", "Tesouraria & Caixa", "Caixas, bancos e liquidações"),
    ModuleDefinition("payroll", "Recursos Humanos", "Contratos, folha salarial e assiduidade"),
    ModuleDefinition("accounting", "Contabilidade PGC", "Lançamentos, mapas e SAF-T Contabilidade"),
    ModuleDefinition("integrations", "Integrações & ETL", "Conectores, webhooks e importações"),
)

MODULE_KEYS = tuple(m.key for m in BILLABLE_MODULES)


def validate_modules(modules: Sequence[str]) -> List[str]:
    unique = list(dict.fromkeys(modules))
    if not unique:
        raise InvalidModulesError("É necessário subscrever pelo menos um módulo.")
    unknown = [m for m in unique if m not in MODULE_KEYS]
    if unknown:
        raise InvalidModulesError(
            "Módulos desconhecidos: " + ", ".join(sorted(unknown)) + "."
        )
    return unique
