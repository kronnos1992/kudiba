import base64
import hashlib
import json
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

from src.domain.error import ValidationError


class SecretCipher:
    def __init__(self, raw_key: Optional[str] = None, fallback_seed: str = ""):
        self._fernet = Fernet(self._normalize_key(raw_key, fallback_seed))

    @staticmethod
    def _normalize_key(raw_key: Optional[str], fallback_seed: str) -> bytes:
        candidate = (raw_key or "").strip()
        if candidate:
            try:
                decoded = base64.urlsafe_b64decode(candidate)
                if len(decoded) == 32:
                    return candidate.encode("utf-8")
            except Exception:
                pass
        seed = (candidate or fallback_seed or "kudiba-integrations-dev-key").encode("utf-8")
        digest = hashlib.sha256(seed).digest()
        return base64.urlsafe_b64encode(digest)

    def encrypt_dict(self, data: Optional[Dict[str, Any]]) -> Optional[str]:
        if not data:
            return None
        raw = json.dumps(data, default=str).encode("utf-8")
        return self._fernet.encrypt(raw).decode("utf-8")

    def decrypt_dict(self, token: Optional[str]) -> Dict[str, Any]:
        if not token:
            return {}
        try:
            raw = self._fernet.decrypt(token.encode("utf-8"))
        except InvalidToken:
            raise ValidationError(
                "Não foi possível decifrar as credenciais da integração (chave inválida)."
            )
        return json.loads(raw.decode("utf-8"))
