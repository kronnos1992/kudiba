from typing import Any, Dict

import jwt


class JwtTokenService:
    def __init__(self, secret: str, algorithm: str = "HS256"):
        self.secret = secret
        self.algorithm = algorithm

    def decode_access_token(self, token: str) -> Dict[str, Any]:
        return jwt.decode(
            token,
            self.secret,
            algorithms=[self.algorithm],
            options={"require": ["sub", "exp"]},
        )
