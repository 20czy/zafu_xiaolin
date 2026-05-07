from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import models
from app.db.session import get_db
from app.services.chat_history_manager import ChatHistoryManager

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


def ok(data: Any = None, **extra: Any) -> dict[str, Any]:
    response = {"status": "success", "data": data}
    response.update(extra)
    return response


def serialize_session(session: models.ChatSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "title": session.title or "新的对话",
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
        "user_id": session.user_id,
    }


def serialize_message(message: models.ChatMessage) -> dict[str, Any]:
    process_info = message.process_infos
    return {
        "id": message.id,
        "content": message.content,
        "is_user": message.is_user,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "session_id": message.session_id,
        "process_info": {
            "steps": process_info.steps,
            "task_plan": process_info.task_plan,
            "tool_selection": process_info.tool_selections,
            "task_results": process_info.task_results,
        }
        if process_info
        else None,
    }


@router.get("/csrf/")
async def csrf():
    return {"csrfToken": "demo-token"}


@router.post("/login/")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User).where(models.User.username == payload.username)
    )
    user = result.scalars().first()

    if not user:
        user = models.User(
            username=payload.username,
            email=f"{payload.username}@demo.local",
            password=payload.password,
            last_login=datetime.utcnow(),
        )
        db.add(user)
    else:
        user.last_login = datetime.utcnow()

    await db.commit()
    await db.refresh(user)
    return ok({"id": user.id, "username": user.username})


@router.get("/chat/sessions/")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ChatSession).order_by(models.ChatSession.updated_at.desc())
    )
    return ok([serialize_session(session) for session in result.scalars().all()])


@router.post("/chat/sessions/")
async def create_session(db: AsyncSession = Depends(get_db)):
    session = models.ChatSession(title="新的对话")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ok(serialize_session(session))


@router.get("/chat/sessions/{session_id}/messages/")
async def list_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ChatMessage)
        .options(selectinload(models.ChatMessage.process_infos))
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at)
    )
    return ok([serialize_message(message) for message in result.scalars().all()])


@router.get("/chat/sessions/{session_id}/documents/")
async def list_documents(session_id: str):
    return ok([])


@router.delete("/chat/sessions/{session_id}/messages/")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(models.ChatSession).where(models.ChatSession.id == session_id))
    await db.commit()
    return ok({"id": session_id})


@router.get("/chat/sessions/{session_id}/history/")
async def get_history(session_id: str, db: AsyncSession = Depends(get_db)):
    history = await ChatHistoryManager.get_chat_history(session_id, db)
    return ok({"history": history})


@router.post("/chat/sessions/{session_id}/history/update/")
async def update_history(
    session_id: str, payload: dict[str, str], db: AsyncSession = Depends(get_db)
):
    role = payload.get("role")
    content = (payload.get("content") or "").strip()
    if role not in {"user", "assistant"} or not content:
        raise HTTPException(status_code=400, detail="消息格式不正确")

    message = await ChatHistoryManager.save_message(
        session_id=session_id,
        content=content,
        is_user=role == "user",
        db=db,
    )
    return ok({"message_id": message.id}, message_id=message.id)


@router.post("/process_info/create/")
async def create_process_info(payload: dict[str, Any], db: AsyncSession = Depends(get_db)):
    info = await ChatHistoryManager.save_process_info(
        message_id=payload["message_id"],
        session_id=payload["session_id"],
        process_info=payload.get("process_info", {}),
        db=db,
    )
    return ok({"id": info.id if info else None})
