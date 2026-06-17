import logging
import json
from typing import List, Dict, Any, Optional
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.session import get_db
from ..db import models
from ..schemas import chat as schemas
from .llm_service import LLMService, TOOL_LIBRARY_MODEL

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, 'model_dump'):
            # Handle pydantic models
            return obj.model_dump()
        elif hasattr(obj, '__dict__'):
            # Handle custom classes with __dict__
            return obj.__dict__
        # Let the base class handle the rest or raise TypeError
        return super().default(obj)

logger = logging.getLogger(__name__)

class ChatHistoryManager:
    """
    聊天历史管理器，用于管理和缓存聊天历史 - FastAPI版本
    """
    
    MAX_HISTORY_LENGTH = 10  # 可根据需要调整
    DEFAULT_TITLES = {"新的对话", "新对话", "", None}
    
    @classmethod
    async def get_chat_history(cls, session_id: str, db: AsyncSession) -> List[Dict[str, str]]:
        """
        根据session_id从数据库获取聊天历史
        
        Args:
            session_id: 会话ID
            db: 数据库会话
            
        Returns:
            聊天历史列表，格式为 [{"role": "user", "content": "..."}]
        """
        try:
            logger.info(f"获取会话 {session_id} 的聊天历史")
            
            # 查询会话消息
            result = await db.execute(
                select(models.ChatMessage)
                .where(models.ChatMessage.session_id == session_id)
                .order_by(models.ChatMessage.created_at)
            )
            messages = result.scalars().all()
            
            # 转换为聊天历史格式
            history = []
            for msg in messages:
                role = "user" if msg.is_user else "assistant"
                history.append({"role": role, "content": msg.content})
            
            # 限制历史长度
            if len(history) > cls.MAX_HISTORY_LENGTH * 2:
                history = history[-cls.MAX_HISTORY_LENGTH * 2:]
                
            logger.debug(f"获取到 {len(history)} 条历史消息")
            return history
            
        except Exception as e:
            logger.error(f"获取聊天历史出错: {str(e)}", exc_info=True)
            return []
    
    @classmethod
    async def save_message(cls, 
                     session_id: str, 
                     content: str, 
                     is_user: bool, 
                     db: AsyncSession) -> models.ChatMessage:
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
            result = await db.execute(
                select(models.ChatSession).where(
                    models.ChatSession.id == session_id
                )
            )
            session = result.scalars().first()
            
            if not session:
                logger.warning(f"会话 {session_id} 不存在，创建新会话")
                session = models.ChatSession(id=session_id)
                db.add(session)
                await db.commit()
                await db.refresh(session)
            
            # 创建新消息
            message = models.ChatMessage(
                content=content,
                is_user=is_user,
                session_id=session_id
            )
            
            db.add(message)
            await db.commit()
            await db.refresh(message)
            
            # 第一条用户消息先保留默认标题，等待 AI 回复后再总结成缩略标题。
            if is_user and session.title is None:
                session.title = "新的对话"
                await db.commit()
            
            logger.info(f"已保存{'用户' if is_user else 'AI'}消息到会话 {session_id}")
            if not is_user:
                await cls.update_session_title_if_needed(session_id, db)
            return message
            
        except Exception as e:
            await db.rollback()
            logger.error(f"保存消息出错: {str(e)}", exc_info=True)
            return None

    @classmethod
    async def update_session_title_if_needed(cls, session_id: str, db: AsyncSession) -> Optional[str]:
        """
        根据会话内容生成缩略标题。仅当标题为空或仍为默认标题时更新。
        """
        try:
            result = await db.execute(
                select(models.ChatSession).where(models.ChatSession.id == session_id)
            )
            session = result.scalars().first()
            if not session or session.title not in cls.DEFAULT_TITLES:
                return session.title if session else None

            messages_result = await db.execute(
                select(models.ChatMessage)
                .where(models.ChatMessage.session_id == session_id)
                .order_by(models.ChatMessage.created_at)
                .limit(6)
            )
            messages = messages_result.scalars().all()
            if not messages:
                return session.title

            title = await cls._generate_session_title(messages)
            if not title:
                first_user_message = next((msg.content for msg in messages if msg.is_user), "")
                title = cls._normalize_title(first_user_message)

            if title:
                session.title = title
                await db.commit()
                await db.refresh(session)
                logger.info(f"已更新会话 {session_id} 标题: {title}")
                return title

            return session.title
        except Exception as e:
            await db.rollback()
            logger.warning(f"生成会话标题失败: {str(e)}", exc_info=True)
            return None

    @classmethod
    async def _generate_session_title(cls, messages: List[models.ChatMessage]) -> str:
        conversation = "\n".join(
            f"{'用户' if msg.is_user else '助手'}: {cls._truncate_for_prompt(msg.content, 500)}"
            for msg in messages
            if msg.content
        )
        if not conversation:
            return ""

        prompt = f"""请根据下面这段聊天内容生成一个中文缩略标题。

要求：
1. 标题用于聊天历史列表，必须短小清楚。
2. 优先使用 4 到 10 个中文字符，最多不超过 16 个中文字符。
3. 不要使用引号、句号、冒号、前缀说明。
4. 不要输出“新对话”“聊天记录”等泛泛标题。

聊天内容：
{conversation}

只输出标题。"""

        try:
            llm = await LLMService.get_llm(model_name=TOOL_LIBRARY_MODEL, temperature=0.2)
            response = await llm.ainvoke([{"role": "user", "content": prompt}])
            return cls._normalize_title(response.content)
        except Exception as e:
            logger.warning(f"调用标题生成模型失败: {str(e)}", exc_info=True)
            return ""

    @staticmethod
    def _truncate_for_prompt(text: str, max_length: int) -> str:
        text = (text or "").strip()
        return text if len(text) <= max_length else text[:max_length] + "..."

    @staticmethod
    def _normalize_title(title: str) -> str:
        title = (title or "").strip()
        title = title.strip("`\"'“”‘’《》<>（）()[]【】。、，,：:；;！!？? \n\t")
        title = " ".join(title.split())
        if not title:
            return ""
        return title[:16]
    
    @classmethod
    async def save_process_info(cls,
                          message_id: int,
                          session_id: str,
                          process_info: Dict[str, Any],
                          db: AsyncSession):
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
            # 使用 CustomJSONEncoder 序列化处理过程信息
            serialized_steps = json.dumps(process_info.get("steps", []), cls=CustomJSONEncoder)
            serialized_task_plan = json.dumps(process_info.get("task_planning", {}), cls=CustomJSONEncoder)
            serialized_tool_selections = json.dumps(process_info.get("tool_selection", {}), cls=CustomJSONEncoder)
            serialized_task_results = json.dumps(process_info.get("task_execution", {}), cls=CustomJSONEncoder)
            
            # 创建处理过程信息对象
            info = models.ProcessInfo(
                message_id=message_id,
                session_id=session_id,
                steps=json.loads(serialized_steps),
                task_plan=json.loads(serialized_task_plan),
                tool_selections=json.loads(serialized_tool_selections),
                task_results=json.loads(serialized_task_results)
            )
            
            db.add(info)
            await db.commit()
            await db.refresh(info)
            
            logger.info(f"已保存处理过程信息到消息 {message_id}")
            return info
            
        except Exception as e:
            await db.rollback()
            logger.error(f"保存处理过程信息出错: {str(e)}", exc_info=True)
            return None
