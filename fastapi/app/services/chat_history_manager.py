import logging
from typing import List, Dict, Any, Optional
from fastapi import Depends
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..db import models
from ..schemas import chat as schemas

logger = logging.getLogger(__name__)

class ChatHistoryManager:
    """
    聊天历史管理器，用于管理和缓存聊天历史 - FastAPI版本
    """
    
    MAX_HISTORY_LENGTH = 10  # 可根据需要调整
    
    @classmethod
    async def get_chat_history(cls, session_id: str, db: Session) -> List[Dict[str, str]]:
        """
        从数据库获取聊天历史
        
        Args:
            session_id: 会话ID
            db: 数据库会话
            
        Returns:
            聊天历史列表，格式为 [{"role": "user", "content": "..."}]
        """
        try:
            logger.info(f"获取会话 {session_id} 的聊天历史")
            
            # 从数据库获取消息
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.session_id == session_id
            ).order_by(models.ChatMessage.created_at).all()
            
            # 转换为LLM所需的格式
            chat_history = []
            for msg in messages[-cls.MAX_HISTORY_LENGTH:]:  # 只保留最近的N条消息
                role = "user" if msg.is_user else "assistant"
                chat_history.append({"role": role, "content": msg.content})
            
            logger.debug(f"获取到 {len(chat_history)} 条历史消息")
            return chat_history
            
        except Exception as e:
            logger.error(f"获取聊天历史出错: {str(e)}", exc_info=True)
            return []
    
    @classmethod
    async def save_message(cls, 
                     session_id: str, 
                     content: str, 
                     is_user: bool, 
                     db: Session) -> models.ChatMessage:
        """
        保存消息到数据库
        
        Args:
            session_id: 会话ID
            content: 消息内容
            is_user: 是否为用户消息
            db: 数据库会话
            
        Returns:
            保存的消息对象
        """
        try:
            # 检查会话是否存在
            session = db.query(models.ChatSession).filter(
                models.ChatSession.id == session_id
            ).first()
            
            if not session:
                logger.warning(f"会话 {session_id} 不存在，创建新会话")
                session = models.ChatSession(id=session_id)
                db.add(session)
                db.commit()
                db.refresh(session)
            
            # 创建新消息
            message = models.ChatMessage(
                content=content,
                is_user=is_user,
                session_id=session_id
            )
            
            db.add(message)
            db.commit()
            db.refresh(message)
            
            # 如果这是第一条消息，设置会话标题
            if is_user and session.title is None:
                title = content[:50] + ('...' if len(content) > 50 else '')
                session.title = title
                db.commit()
            
            logger.info(f"已保存{'用户' if is_user else 'AI'}消息到会话 {session_id}")
            return message
            
        except Exception as e:
            db.rollback()
            logger.error(f"保存消息出错: {str(e)}", exc_info=True)
            raise
    
    @classmethod
    async def save_process_info(cls,
                          message_id: int,
                          session_id: str,
                          process_info: Dict[str, Any],
                          db: Session) -> models.ProcessInfo:
        """
        保存处理过程信息到数据库
        
        Args:
            message_id: 消息ID
            session_id: 会话ID
            process_info: 处理过程信息
            db: 数据库会话
            
        Returns:
            保存的处理过程信息对象
        """
        try:
            # 从process_info中提取需要的数据
            steps = process_info.get("steps", [])
            task_plan = process_info.get("task_planning", {})
            tool_selections = process_info.get("tool_selection", {})
            task_results = process_info.get("task_execution", {})
            
            # 创建ProcessInfo对象
            process_info_obj = models.ProcessInfo(
                steps=steps,
                task_plan=task_plan,
                tool_selections=tool_selections,
                task_results=task_results,
                message_id=message_id,
                session_id=session_id
            )
            
            db.add(process_info_obj)
            db.commit()
            db.refresh(process_info_obj)
            
            logger.info(f"已保存处理过程信息，消息ID: {message_id}, 会话ID: {session_id}")
            return process_info_obj
            
        except Exception as e:
            db.rollback()
            logger.error(f"保存处理过程信息出错: {str(e)}", exc_info=True)
            raise
