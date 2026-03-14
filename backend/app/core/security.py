from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any


class AuthService:
    def __init__(self, secret: str, token_ttl_minutes: int) -> None:
        self.secret = secret.encode("utf-8")
        self.token_ttl_minutes = token_ttl_minutes

    def hash_password(self, password: str, salt_hex: str | None = None) -> tuple[str, str]:
        salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            200_000,
        )
        return salt.hex(), digest.hex()

    def verify_password(self, password: str, salt_hex: str, password_hash: str) -> bool:
        _, candidate_hash = self.hash_password(password, salt_hex=salt_hex)
        return hmac.compare_digest(candidate_hash, password_hash)

    def issue_token(self, username: str, role: str) -> dict[str, str]:
        expires_at = datetime.now(UTC) + timedelta(minutes=self.token_ttl_minutes)
        payload = {
            "sub": username,
            "role": role,
            "exp": int(expires_at.timestamp()),
        }
        token = self._encode_token(payload)
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_at": expires_at.isoformat(),
            "username": username,
            "role": role,
        }

    def decode_token(self, token: str) -> dict[str, Any]:
        try:
            encoded_header, encoded_payload, encoded_signature = token.split(".")
        except ValueError as error:
            raise ValueError("Malformed access token.") from error

        unsigned = f"{encoded_header}.{encoded_payload}".encode("utf-8")
        expected_signature = self._sign(unsigned)
        if not hmac.compare_digest(expected_signature, encoded_signature):
            raise ValueError("Invalid token signature.")

        payload = json.loads(self._urlsafe_decode(encoded_payload))
        if int(payload["exp"]) < int(datetime.now(UTC).timestamp()):
            raise ValueError("Access token expired.")
        return payload

    def _encode_token(self, payload: dict[str, Any]) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        encoded_header = self._urlsafe_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        encoded_payload = self._urlsafe_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = self._sign(f"{encoded_header}.{encoded_payload}".encode("utf-8"))
        return f"{encoded_header}.{encoded_payload}.{signature}"

    def _sign(self, value: bytes) -> str:
        digest = hmac.new(self.secret, value, hashlib.sha256).digest()
        return self._urlsafe_encode(digest)

    @staticmethod
    def _urlsafe_encode(value: bytes) -> str:
        return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")

    @staticmethod
    def _urlsafe_decode(value: str) -> bytes:
        padding = "=" * (-len(value) % 4)
        return base64.urlsafe_b64decode(f"{value}{padding}")
