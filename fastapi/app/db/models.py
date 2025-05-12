from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid
from typing import List

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    
    # Relationship
    chat_sessions = relationship("ChatSession", back_populates="user")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    process_infos = relationship("ProcessInfo", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    is_user = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    
    # Relationship
    session = relationship("ChatSession", back_populates="messages")
    process_info = relationship("ProcessInfo", back_populates="message", uselist=False)


class ProcessInfo(Base):
    __tablename__ = "process_infos"
    
    id = Column(Integer, primary_key=True, index=True)
    steps = Column(JSON)
    task_plan = Column(JSON)
    tool_selections = Column(JSON)
    task_results = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    message_id = Column(Integer, ForeignKey("chat_messages.id"))
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    
    # Relationships
    message = relationship("ChatMessage", back_populates="process_info")
    session = relationship("ChatSession", back_populates="process_infos")
