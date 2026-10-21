from typing import List, Set

from src.domain.value_objects.role_type import ADMINISTRATOR_ROLE_IDS


class RbacEvaluator:
    @staticmethod
    def normalize_roles(roles: List[str]) -> List[str]:
        return sorted(list({r.strip().upper() for r in roles if r.strip()}))

    @staticmethod
    def has_permission(user_roles: List[str], user_permissions: List[str], required_permission: str) -> bool:
        roles_set: Set[str] = {r.upper() for r in user_roles}
        if roles_set & ADMINISTRATOR_ROLE_IDS:
            return True
        return required_permission in user_permissions
