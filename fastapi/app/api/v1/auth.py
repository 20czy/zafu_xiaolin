import os
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.db.session import get_db
from app.services.access_service import (
    COOKIE_NAME,
    AccessPrincipal,
    create_session_cookie,
    current_access,
    hash_trial_token,
)


router = APIRouter()
FAILED_ATTEMPTS: dict[str, list[datetime]] = defaultdict(list)
MAX_FAILED_ATTEMPTS = int(os.getenv("MAX_FAILED_ACCESS_ATTEMPTS", "5"))
FAILED_ATTEMPT_WINDOW = timedelta(
    minutes=int(os.getenv("FAILED_ACCESS_WINDOW_MINUTES", "15"))
)


class AccessCodeRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


@router.post("/login")
async def login(
    payload: AccessCodeRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = (request.headers.get("X-Forwarded-For") or request.client.host).split(",")[0].strip()
    cutoff = datetime.utcnow() - FAILED_ATTEMPT_WINDOW
    FAILED_ATTEMPTS[client_ip] = [
        attempt for attempt in FAILED_ATTEMPTS[client_ip] if attempt > cutoff
    ]
    if len(FAILED_ATTEMPTS[client_ip]) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(status_code=429, detail="访问码尝试次数过多，请稍后再试")

    result = await db.execute(
        select(models.TrialAccess).where(
            models.TrialAccess.token_hash == hash_trial_token(payload.token.strip())
        )
    )
    access = result.scalars().first()
    now = datetime.utcnow()
    if not access or not access.is_active or access.expires_at <= now:
        FAILED_ATTEMPTS[client_ip].append(now)
        raise HTTPException(status_code=401, detail="访问码错误或已过期")
    if access.calls_used >= access.max_calls:
        raise HTTPException(status_code=429, detail="该访问码的试用调用额度已用完")

    FAILED_ATTEMPTS.pop(client_ip, None)

    response.set_cookie(
        key=COOKIE_NAME,
        value=create_session_cookie(access),
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        max_age=int(os.getenv("SESSION_LIFETIME_HOURS", "24")) * 3600,
        path="/",
    )
    return {
        "status": "success",
        "data": {
            "label": access.label,
            "expires_at": access.expires_at.isoformat(),
            "calls_remaining": max(access.max_calls - access.calls_used, 0),
        },
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "success"}


@router.get("/me")
async def me(access: AccessPrincipal = Depends(current_access)):
    return {
        "status": "success",
        "data": {
            "label": access.label,
            "expires_at": access.expires_at.isoformat(),
            "calls_remaining": access.calls_remaining,
        },
    }
