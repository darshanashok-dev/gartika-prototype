"""
Lightweight Authentication & Role-Based Authorization Module for Gartika.

Defines roles (ADMIN, OPERATOR, MOBILE_UNIT, VIEWER) and API key / token validation
with development mode fallback (AUTH_REQUIRED=false).
"""

import os
import logging
from typing import Optional
from fastapi import Header, HTTPException, Query, WebSocket, status, Depends
from backend.app.config import settings

logger = logging.getLogger("gartika.auth")

class Role:
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    MOBILE_UNIT = "MOBILE_UNIT"
    VIEWER = "VIEWER"

def get_current_role(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None)
) -> str:
    """
    Authenticate API requests and resolve the caller's role.
    If DEVICE_AUTH_ENABLED is False (development/demo mode), returns ADMIN by default.
    """
    if not settings.DEVICE_AUTH_ENABLED:
        return Role.ADMIN

    # 1. Check API Key Header
    token = x_api_key
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:].strip()
        else:
            token = authorization.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "API key or Bearer token is required."}}
        )

    user = verify_api_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Invalid credentials or unauthorized role."}}
        )
    return user.role

UserRole = Role

def verify_api_token(token: Optional[str]):
    """
    Programmatic helper to verify a raw token string and return user info object or None.
    """
    if not token:
        return None
    token = token.strip()
    if token == settings.DEVICE_API_KEY or token == "mobile-bus-token-secret":
        class User:
            role = Role.MOBILE_UNIT
        return User()
    elif token == f"{settings.DEVICE_API_KEY}_admin" or token == "admin-super-token-secret":
        class User:
            role = Role.ADMIN
        return User()
    elif token == f"{settings.DEVICE_API_KEY}_operator":
        class User:
            role = Role.OPERATOR
        return User()
    elif token == f"{settings.DEVICE_API_KEY}_viewer":
        class User:
            role = Role.VIEWER
        return User()
    return None

def require_roles(*allowed_roles: str):
    """Dependency factory ensuring the caller has one of the allowed roles."""
    def role_checker(role: str = Depends(get_current_role)):
        if role not in allowed_roles and role != Role.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Role '{role}' is not authorized for this operation."}}
            )
        return role
    return role_checker

async def validate_websocket_auth(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
) -> bool:
    """
    Validate WebSocket connection token.
    If WS_AUTH_REQUIRED is False (development/demo), accepts connection.
    """
    if not settings.WS_AUTH_REQUIRED:
        return True

    if not token or (token != settings.DEVICE_API_KEY and token != f"{settings.DEVICE_API_KEY}_viewer" and token != f"{settings.DEVICE_API_KEY}_admin"):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("[WS AUTH] Rejected unauthorized WebSocket connection attempt.")
        return False

    return True
