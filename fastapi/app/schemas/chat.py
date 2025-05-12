from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid


class ChatMessageBase(BaseModel):
    content: str


class ChatMessageCreate(ChatMessageBase):
    is_user: bool = True


class ChatMessage(ChatMessageBase):
    id: int
    is_user: bool
    created_at: datetime
    session_id: str

    class Config:
        orm_mode = True


class ProcessInfoBase(BaseModel):
    steps: Optional[List[str]] = None
    task_plan: Optional[Dict[str, Any]] = None
    tool_selections: Optional[Dict[str, Any]] = None
    task_results: Optional[Dict[str, Any]] = None


class ProcessInfo(ProcessInfoBase):
    id: int
    created_at: datetime
    message_id: Optional[int] = None
    session_id: str

    class Config:
        orm_mode = True


class ChatSessionBase(BaseModel):
    title: Optional[str] = None


class ChatSessionCreate(ChatSessionBase):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[int] = None


class ChatSession(ChatSessionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    user_id: Optional[int] = None
    messages: List[ChatMessage] = []

    class Config:
        orm_mode = True


class ChatRequest(BaseModel):
    message: str
    session_id: str


class ChatResponse(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class StreamingEvent(BaseModel):
    type: str
    content: Any
    subtype: Optional[str] = None
