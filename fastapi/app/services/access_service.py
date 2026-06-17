import base64
import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models


COOKIE_NAME = "xiaolin_trial_session"
LOCAL_DEV_USER_ID = 1
LOCAL_DEV_LABEL = "local-dev"


@dataclass(frozen=True)
class AccessPrincipal:
    access_id: int
    user_id: int
    label: str
    expires_at: datetime
    max_calls: int
    calls_used: int

    @property
    def calls_remaining(self) -> int:
        return max(self.max_calls - self.calls_used, 0)


def _secret(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise RuntimeError(f"缺少必要环境变量: {name}")
    return value


def hash_trial_token(token: str) -> str:
    pepper = _secret("TRIAL_TOKEN_PEPPER")
    return hashlib.sha256(f"{pepper}:{token}".encode("utf-8")).hexdigest()


def generate_trial_token() -> str:
    return f"trial_{secrets.token_urlsafe(32)}"


def trial_access_required() -> bool:
    return os.getenv("REQUIRE_TRIAL_ACCESS", "false").lower() in {"1", "true", "yes", "on"}


async def ensure_local_dev_access(db: AsyncSession) -> AccessPrincipal:
    result = await db.execute(
        select(models.User).where(models.User.id == LOCAL_DEV_USER_ID)
    )
    user = result.scalars().first()
    if not user:
        user = models.User(
            id=LOCAL_DEV_USER_ID,
            username=LOCAL_DEV_LABEL,
            email="local-dev@xiaolin.local",
            password="!local-dev-only!",
            is_active=True,
        )
        db.add(user)
        await db.commit()

    return AccessPrincipal(
        access_id=0,
        user_id=LOCAL_DEV_USER_ID,
        label=LOCAL_DEV_LABEL,
        expires_at=datetime.utcnow() + timedelta(days=3650),
        max_calls=10**9,
        calls_used=0,
    )


def create_session_cookie(access: models.TrialAccess) -> str:
    lifetime_hours = int(os.getenv("SESSION_LIFETIME_HOURS", "24"))
    session_expiry = min(
        access.expires_at,
        datetime.utcnow() + timedelta(hours=lifetime_hours),
    )
    payload = {
        "aid": access.id,
        "uid": access.user_id,
        "exp": int(session_expiry.timestamp()),
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("ascii").rstrip("=")
    signature = hmac.new(
        _secret("SESSION_SECRET").encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{encoded}.{signature}"


def decode_session_cookie(cookie: str) -> dict:
    try:
        encoded, signature = cookie.rsplit(".", 1)
        expected = hmac.new(
            _secret("SESSION_SECRET").encode("utf-8"),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        if int(payload["exp"]) <= int(datetime.utcnow().timestamp()):
            raise ValueError("expired")
        return payload
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="访问会话无效或已过期",
        ) from exc


async def authenticate_request(request: Request, db: AsyncSession) -> AccessPrincipal:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=401, detail="请先输入试用访问码")

    payload = decode_session_cookie(cookie)
    result = await db.execute(
        select(models.TrialAccess).where(models.TrialAccess.id == payload["aid"])
    )
    access = result.scalars().first()
    now = datetime.utcnow()
    if (
        not access
        or not access.is_active
        or access.user_id != payload["uid"]
        or access.expires_at <= now
    ):
        raise HTTPException(status_code=401, detail="访问码已失效")

    return AccessPrincipal(
        access_id=access.id,
        user_id=access.user_id,
        label=access.label,
        expires_at=access.expires_at,
        max_calls=access.max_calls,
        calls_used=access.calls_used,
    )


def current_access(request: Request) -> AccessPrincipal:
    principal = getattr(request.state, "access", None)
    if principal is None:
        raise HTTPException(status_code=401, detail="请先输入试用访问码")
    return principal


async def consume_call(db: AsyncSession, principal: AccessPrincipal) -> int:
    if principal.access_id == 0:
        return principal.calls_remaining

    result = await db.execute(
        select(models.TrialAccess).where(models.TrialAccess.id == principal.access_id)
    )
    access = result.scalars().first()
    if not access or not access.is_active or access.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=401, detail="访问码已失效")
    if access.calls_used >= access.max_calls:
        raise HTTPException(status_code=429, detail="该访问码的试用调用额度已用完")

    access.calls_used += 1
    access.last_used_at = datetime.utcnow()
    await db.commit()
    return max(access.max_calls - access.calls_used, 0)
