from __future__ import annotations

from fastapi import Header, HTTPException

from .config import shared_secret


def require_secret(x_verifier_key: str | None = Header(default=None, alias="x-verifier-key")) -> None:
    secret = shared_secret()
    if not secret:
        return
    if not x_verifier_key or x_verifier_key != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
