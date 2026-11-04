import re
import time
from datetime import date, datetime, timezone
from typing import List, Optional
from urllib.parse import quote_plus

import httpx

from src.application.dto import AlvaraPlatformCheckDto, AlvaraVerificationResultDto

ALVARA_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9/\-_. ]{2,63}$")

OFFICIAL_PLATFORMS = [
    {
        "id": "SILAC_MINDCOM",
        "name": "SILAC / MINDCOM — Licenciamento da Actividade Comercial",
        "entity": "Ministério da Indústria e Comércio de Angola",
        "portal_url": "https://silac.mindcom.gov.ao",
        "url_template": "https://silac.mindcom.gov.ao/?alvara={alvara}&nif={nif}",
    },
    {
        "id": "GUE_AO",
        "name": "GUE — Guiché Único da Empresa",
        "entity": "Ministério da Justiça e dos Direitos Humanos",
        "portal_url": "https://gue.gov.ao",
        "url_template": "https://gue.gov.ao/?nif={nif}&alvara={alvara}",
    },
    {
        "id": "SEPE_AO",
        "name": "SEPE — Portal de Serviços Públicos Electrónicos",
        "entity": "Governo de Angola",
        "portal_url": "https://www.sepe.gov.ao",
        "url_template": "https://www.sepe.gov.ao/ao/pesquisa/?q={alvara}",
    },
    {
        "id": "AGT_PORTAL",
        "name": "Portal do Contribuinte — Consulta de NIF & Cadastro",
        "entity": "Administração Geral Tributária (MINFIN)",
        "portal_url": "https://portaldocontribuinte.minfin.gov.ao",
        "url_template": "https://portaldocontribuinte.minfin.gov.ao/?nif={nif}",
    },
]


def evaluate_alvara_status(
    alvara_number: Optional[str],
    issue_date: Optional[date],
    expiry_date: Optional[date],
    today: Optional[date] = None,
) -> tuple[str, bool, bool, bool, Optional[int], str]:
    today = today or date.today()
    cleaned = (alvara_number or "").strip()
    format_valid = bool(cleaned and ALVARA_PATTERN.match(cleaned))

    if not format_valid:
        return (
            "INVALID",
            False,
            False,
            False,
            None,
            "Formato do número de alvará comercial inválido.",
        )

    if issue_date is None or expiry_date is None:
        return (
            "INVALID",
            True,
            False,
            False,
            None,
            "Indique a data de emissão e a data de validade do alvará comercial.",
        )

    if issue_date > today:
        return (
            "INVALID",
            True,
            False,
            False,
            None,
            "A data de emissão do alvará não pode ser posterior à data actual.",
        )

    if expiry_date <= issue_date:
        return (
            "INVALID",
            True,
            False,
            False,
            None,
            "A data de validade do alvará deve ser posterior à data de emissão.",
        )

    days_remaining = (expiry_date - today).days
    if days_remaining < 0:
        return (
            "EXPIRED",
            True,
            True,
            True,
            days_remaining,
            f"Alvará comercial expirado há {abs(days_remaining)} dia(s) (vencido em {expiry_date.isoformat()}).",
        )

    if days_remaining <= 30:
        return (
            "EXPIRING_SOON",
            True,
            True,
            False,
            days_remaining,
            f"Alvará comercial válido, mas expira em {days_remaining} dia(s) ({expiry_date.isoformat()}).",
        )

    return (
        "VALID",
        True,
        True,
        False,
        days_remaining,
        f"Alvará comercial válido e dentro do prazo ({days_remaining} dias restantes até {expiry_date.isoformat()}).",
    )


async def _probe_url(client: httpx.AsyncClient, url: str) -> tuple[Optional[bool], Optional[int], str]:
    start = time.perf_counter()
    try:
        resp = await client.get(url, follow_redirects=True)
        latency = int((time.perf_counter() - start) * 1000)
        reachable = resp.status_code < 500
        msg = (
            f"Plataforma oficial acessível (HTTP {resp.status_code} • {latency} ms)."
            if reachable
            else f"Plataforma respondeu com HTTP {resp.status_code}."
        )
        return reachable, latency, msg
    except Exception:
        latency = int((time.perf_counter() - start) * 1000)
        return (
            False,
            latency,
            "Ligação directa indisponível a partir deste servidor; utilize o link oficial para consulta no navegador.",
        )


class VerifyAlvaraUseCase:
    EXPIRING_SOON_DAYS = 30

    async def execute(
        self,
        *,
        alvara_number: str,
        nif: Optional[str] = None,
        alvara_issue_date: Optional[date] = None,
        alvara_expiry_date: Optional[date] = None,
        probe_remote: bool = True,
    ) -> AlvaraVerificationResultDto:
        cleaned_alvara = (alvara_number or "").strip()
        cleaned_nif = (nif or "").strip()

        status, format_valid, dates_valid, is_expired, days_remaining, message = (
            evaluate_alvara_status(
                cleaned_alvara,
                alvara_issue_date,
                alvara_expiry_date,
            )
        )

        platforms: List[AlvaraPlatformCheckDto] = []
        encoded_alvara = quote_plus(cleaned_alvara)
        encoded_nif = quote_plus(cleaned_nif)

        if probe_remote:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(3.0, connect=2.0),
                headers={"User-Agent": "KudibaERP-AlvaraVerifier/1.0"},
            ) as http_client:
                for p in OFFICIAL_PLATFORMS:
                    ver_url = p["url_template"].format(alvara=encoded_alvara, nif=encoded_nif)
                    reachable, latency_ms, status_msg = await _probe_url(
                        http_client, p["portal_url"]
                    )
                    platforms.append(
                        AlvaraPlatformCheckDto(
                            id=p["id"],
                            name=p["name"],
                            entity=p["entity"],
                            portal_url=p["portal_url"],
                            verification_url=ver_url,
                            reachable=reachable,
                            latency_ms=latency_ms,
                            status_message=status_msg,
                        )
                    )
        else:
            for p in OFFICIAL_PLATFORMS:
                ver_url = p["url_template"].format(alvara=encoded_alvara, nif=encoded_nif)
                platforms.append(
                    AlvaraPlatformCheckDto(
                        id=p["id"],
                        name=p["name"],
                        entity=p["entity"],
                        portal_url=p["portal_url"],
                        verification_url=ver_url,
                        reachable=None,
                        latency_ms=None,
                        status_message="Link oficial pronto para consulta externa.",
                    )
                )

        return AlvaraVerificationResultDto(
            alvara_number=cleaned_alvara,
            nif=cleaned_nif or None,
            alvara_issue_date=alvara_issue_date,
            alvara_expiry_date=alvara_expiry_date,
            valid=status in ("VALID", "EXPIRING_SOON"),
            status=status,
            format_valid=format_valid,
            dates_valid=dates_valid,
            is_expired=is_expired,
            days_remaining=days_remaining,
            message=message,
            checked_at=datetime.now(timezone.utc),
            official_platforms=platforms,
        )
