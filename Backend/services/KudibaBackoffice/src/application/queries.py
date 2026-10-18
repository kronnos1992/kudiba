from typing import List, Optional
from datetime import date, datetime, timezone

from src.application.commands import build_client_detail, license_to_dto
from src.application.dto import (
    ClientDetailDto,
    ClientDto,
    PlatformClientStats,
    PlatformLicenseStats,
    PlatformModuleAdoption,
    PlatformSummaryDto,
)
from src.domain.error import EntityNotFoundError
from src.domain.modules import BILLABLE_MODULES
from src.domain.ports import IClientRepository, ILicenseRepository


class ListClientsUseCase:
    def __init__(self, client_repo: IClientRepository, license_repo: ILicenseRepository):
        self.client_repo = client_repo
        self.license_repo = license_repo

    async def execute(self, search: Optional[str] = None, status: Optional[str] = None) -> List[ClientDto]:
        clients = await self.client_repo.list_all(search=search)
        current_map = await self.license_repo.find_current_map([c.id for c in clients])
        dtos = [
            ClientDto(
                id=client.id,
                tenant_id=client.tenant_id,
                company_name=client.company_name,
                nif=client.nif,
                contact_name=client.contact_name,
                contact_email=client.contact_email,
                contact_phone=client.contact_phone,
                notes=client.notes,
                license_status=current_map[client.id].derived_status() if client.id in current_map else "NONE",
                license=license_to_dto(current_map[client.id]) if client.id in current_map else None,
                created_at=client.created_at,
                updated_at=client.updated_at,
            )
            for client in clients
        ]
        if status:
            wanted = status.upper()
            dtos = [d for d in dtos if d.license_status == wanted]
        return dtos


class GetClientUseCase:
    def __init__(self, client_repo: IClientRepository, license_repo: ILicenseRepository):
        self.client_repo = client_repo
        self.license_repo = license_repo

    async def execute(self, client_id) -> ClientDetailDto:
        client = await self.client_repo.find_by_id(client_id)
        if not client:
            raise EntityNotFoundError("Cliente", str(client_id))
        current = await self.license_repo.find_current_for_client(client.id)
        history = await self.license_repo.list_for_client(client.id)
        return build_client_detail(client, current, history)


class GetPlatformSummaryUseCase:
    EXPIRING_SOON_DAYS = 30

    def __init__(self, client_repo: IClientRepository, license_repo: ILicenseRepository):
        self.client_repo = client_repo
        self.license_repo = license_repo

    async def execute(self) -> PlatformSummaryDto:
        today = date.today()
        clients = await self.client_repo.list_all()
        current_map = await self.license_repo.find_current_map([c.id for c in clients])

        client_counts = {"ACTIVE": 0, "EXPIRED": 0, "SUSPENDED": 0, "NONE": 0}
        license_counts = {"total": 0, "ACTIVE": 0, "EXPIRED": 0, "SUSPENDED": 0}
        expiring_soon = 0
        active_seats = 0
        module_adoption = {module.key: 0 for module in BILLABLE_MODULES}

        for client in clients:
            license = current_map.get(client.id)
            if license is None:
                client_counts["NONE"] += 1
                continue

            status = license.derived_status(today)
            client_counts[status] += 1
            license_counts["total"] += 1

            if status == "ACTIVE":
                license_counts["ACTIVE"] += 1
                active_seats += license.seats
                for module_key in license.modules:
                    if module_key in module_adoption:
                        module_adoption[module_key] += 1
                if (license.valid_until - today).days <= self.EXPIRING_SOON_DAYS:
                    expiring_soon += 1
            elif status == "EXPIRED":
                license_counts["EXPIRED"] += 1
            elif status == "SUSPENDED":
                license_counts["SUSPENDED"] += 1

        modules = [
            PlatformModuleAdoption(
                key=module.key,
                name=module.name,
                client_count=module_adoption[module.key],
            )
            for module in BILLABLE_MODULES
        ]

        return PlatformSummaryDto(
            generated_at=datetime.now(timezone.utc),
            clients=PlatformClientStats(
                total=len(clients),
                active=client_counts["ACTIVE"],
                expired=client_counts["EXPIRED"],
                suspended=client_counts["SUSPENDED"],
                none=client_counts["NONE"],
            ),
            licenses=PlatformLicenseStats(
                total=license_counts["total"],
                active=license_counts["ACTIVE"],
                expiring_soon=expiring_soon,
                expired=license_counts["EXPIRED"],
                suspended=license_counts["SUSPENDED"],
            ),
            active_seats=active_seats,
            modules=modules,
        )
