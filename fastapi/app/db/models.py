from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid
from typing import List
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users_user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    
    # 添加自定义字段
    phone = Column(String(15), nullable=True)
    avatar = Column(String, nullable=True)  # 存储头像路径
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String, nullable=True)
    interests = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    
    # Relationship
    chat_sessions = relationship("ChatSession", back_populates="user")
    
    def __repr__(self):
        return f"User(id={self.id}, username={self.username}, {'(管理员)' if self.is_staff else ''})"


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    user_id = Column(Integer, ForeignKey("users_user.id"))
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    process_infos = relationship("ProcessInfo", back_populates="session", cascade="all, delete-orphan")
    agent_data = relationship("AgentData", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    is_user = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    session_id = Column(String, ForeignKey("chat_sessions.id"))
    
    # Relationship
    session = relationship("ChatSession", back_populates="messages")
    process_infos = relationship("ProcessInfo", back_populates="message", uselist=False)
    agent_data = relationship("AgentData", back_populates="message", cascade="all, delete-orphan")


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
    message = relationship("ChatMessage", back_populates="process_infos")
    session = relationship("ChatSession", back_populates="process_infos")


class AgentData(Base):
    __tablename__ = "agent_data"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    type = Column(String, index=True)  # table, form, image, code, text, chart, file, markdown
    title = Column(String, nullable=True)
    content = Column(JSON)  # 存储各种类型的内容数据
    meta_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联到聊天会话
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    
    # 关联到用户
    user_id = Column(Integer, ForeignKey("users_user.id"))
    
    # Relationships
    user = relationship("User")
    session = relationship("ChatSession")
    message = relationship("ChatMessage")
    
    def __repr__(self):
        return f"AgentData(id={self.id}, type={self.type}, title={self.title})"

    