"""Auth guard utilities for optional Firebase Identity Platform enforcement."""
from __future__ import annotations

import os
from typing import Any

import firebase_admin
from fastapi import Depends, Header, HTTPException
from firebase_admin import auth, credentials


REQUIRE_AUTH = os.environ.get("REQUIRE_AUTH", "false").strip().lower() == "true"


def _ensure_firebase_admin() -> None:
    if firebase_admin._apps:
        return
    firebase_admin.initialize_app(credentials.ApplicationDefault())


async def require_identity(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Return authenticated identity claims or anonymous context when auth is optional."""
    if not REQUIRE_AUTH:
        return {"uid": "anonymous", "authenticated": False, "claims": {}}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid bearer token")

    try:
        _ensure_firebase_admin()
        claims = auth.verify_id_token(token, check_revoked=True)
    except Exception as exc:
        print(f"[AUTH] Token verification failed: {exc}")
        raise HTTPException(status_code=401, detail="Authentication failed") from exc

    return {
        "uid": claims.get("uid", "unknown"),
        "authenticated": True,
        "claims": claims,
    }


async def require_admin(identity: dict[str, Any] = Depends(require_identity)) -> dict[str, Any]:
    """Require admin claim only when auth enforcement is enabled."""
    if not REQUIRE_AUTH:
        return identity

    claims = identity.get("claims", {})
    is_admin = bool(claims.get("admin", False))
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    return identity
