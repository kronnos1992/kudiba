import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class Tenant:
    id: uuid.UUID
    slug: str
    company_name: str
    nif: str
    status: str = "ACTIVE"
    trade_name: Optional[str] = None
    address_detail: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "AO"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    logo_data_url: Optional[str] = None
    commercial_registry: Optional[str] = None
    share_capital: Optional[str] = None
    currency: str = "AOA"
    tax_regime_code: str = "REGIME_GERAL"
    tax_office_code: Optional[str] = None
    agt_cert_number: Optional[str] = None
    default_withholding_rate: float = 6.50
    invoice_footer_notes: Optional[str] = None
    bank_accounts: List[Dict[str, Any]] = field(default_factory=list)
    onboarding_completed: bool = False
    license_valid_until: Optional[datetime] = None
    subscribed_modules: Optional[List[str]] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_active(self) -> bool:
        return self.status.upper() == "ACTIVE"

    def license_expired(self, now: Optional[datetime] = None) -> bool:
        if self.license_valid_until is None:
            return False
        now = now or datetime.now(timezone.utc)
        until = self.license_valid_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        return until < now

