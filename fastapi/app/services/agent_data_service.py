from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from ..db import models
from ..schemas import agent_data as schemas

class AgentDataService:
    """与AgentData相关的业务逻辑"""

    @staticmethod
    async def create_agent_data(db: AsyncSession, agent_data: schemas.AgentDataCreate) -> models.AgentData:
        """创建新的AgentData"""
        db_agent_data = models.AgentData(
            id=agent_data.id or str(uuid.uuid4()),
            type=agent_data.type,
            title=agent_data.title,
            content=agent_data.content,
            metadata=agent_data.metadata,
            session_id=agent_data.session_id,
            message_id=agent_data.message_id,
            user_id=agent_data.user_id
        )
        db.add(db_agent_data)
        await db.commit()
        await db.refresh(db_agent_data)
        return db_agent_data

    @staticmethod
    async def get_agent_data_by_id(
        db: AsyncSession,
        agent_data_id: str
    ) -> Optional[models.AgentData]:
        """根据ID获取AgentData"""
        result = await db.execute(
            select(models.AgentData)
            .options(
                selectinload(models.AgentData.user),
                selectinload(models.AgentData.session),
                selectinload(models.AgentData.message)
            )
            .where(models.AgentData.id == agent_data_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_agent_data_list(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        data_type: Optional[str] = None
    ) -> List[models.AgentData]:
        """获取AgentData列表"""
        query = select(models.AgentData).options(
            selectinload(models.AgentData.user),
            selectinload(models.AgentData.session),
            selectinload(models.AgentData.message)
        )
        
        # 添加过滤条件
        if user_id:
            query = query.where(models.AgentData.user_id == user_id)
        if session_id:
            query = query.where(models.AgentData.session_id == session_id)
        if data_type:
            query = query.where(models.AgentData.type == data_type)
        
        # 排序和分页
        query = query.order_by(models.AgentData.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_agent_data_count(
        db: AsyncSession,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        data_type: Optional[str] = None
    ) -> int:
        """获取AgentData总数"""
        query = select(models.AgentData.id)
        
        # 添加过滤条件
        if user_id:
            query = query.where(models.AgentData.user_id == user_id)
        if session_id:
            query = query.where(models.AgentData.session_id == session_id)
        if data_type:
            query = query.where(models.AgentData.type == data_type)
        
        result = await db.execute(query)
        return len(result.scalars().all())

    @staticmethod
    async def update_agent_data(
        db: AsyncSession,
        agent_data_id: str,
        agent_data_update: schemas.AgentDataUpdate
    ) -> Optional[models.AgentData]:
        """更新AgentData"""
        # 构建更新数据字典
        update_data = {}
        if agent_data_update.type is not None:
            update_data['type'] = agent_data_update.type
        if agent_data_update.title is not None:
            update_data['title'] = agent_data_update.title
        if agent_data_update.content is not None:
            update_data['content'] = agent_data_update.content
        if agent_data_update.metadata is not None:
            update_data['metadata'] = agent_data_update.metadata
        
        if not update_data:
            # 如果没有要更新的数据，直接返回原数据
            return await AgentDataService.get_agent_data_by_id(db, agent_data_id)
        
        # 添加更新时间
        update_data['updated_at'] = datetime.utcnow()
        
        # 执行更新
        await db.execute(
            update(models.AgentData)
            .where(models.AgentData.id == agent_data_id)
            .values(**update_data)
        )
        await db.commit()
        
        # 返回更新后的数据
        return await AgentDataService.get_agent_data_by_id(db, agent_data_id)

    @staticmethod
    async def delete_agent_data(
        db: AsyncSession,
        agent_data_id: str
    ) -> bool:
        """删除AgentData"""
        result = await db.execute(
            delete(models.AgentData)
            .where(models.AgentData.id == agent_data_id)
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def get_agent_data_by_session(
        db: AsyncSession,
        session_id: str,
        data_type: Optional[str] = None
    ) -> List[models.AgentData]:
        """根据会话ID获取AgentData列表"""
        query = select(models.AgentData).where(
            models.AgentData.session_id == session_id
        )
        
        if data_type:
            query = query.where(models.AgentData.type == data_type)
        
        query = query.order_by(models.AgentData.created_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def get_agent_data_by_message(
        db: AsyncSession,
        message_id: int
    ) -> List[models.AgentData]:
        """根据消息ID获取AgentData列表"""
        result = await db.execute(
            select(models.AgentData)
            .where(models.AgentData.message_id == message_id)
            .order_by(models.AgentData.created_at.desc())
        )
        return result.scalars().all()

    
