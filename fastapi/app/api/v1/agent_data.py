from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import logging

from ...db.session import get_db
from ...schemas import agent_data as schemas
from ...services.agent_data_service import AgentDataService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=schemas.AgentDataResponse)
async def create_agent_data(
    agent_data: schemas.AgentDataCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建新的AgentData"""
    try:
        db_agent_data = await AgentDataService.create_agent_data(db, agent_data)
        return schemas.AgentDataResponse(
            status="success",
            message="AgentData创建成功",
            data=schemas.AgentData.from_orm(db_agent_data) # 将ORM模型转换为Pydantic模型
        )
    except Exception as e:
        logger.error(f"创建AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="创建AgentData失败")


@router.get("/{agent_data_id}", response_model=schemas.AgentDataResponse)
async def get_agent_data(
    agent_data_id: str,
    db: AsyncSession = Depends(get_db)
):
    """根据ID获取AgentData"""
    try:
        db_agent_data = await AgentDataService.get_agent_data_by_id(db, agent_data_id)
        if not db_agent_data:
            raise HTTPException(status_code=404, detail="AgentData不存在")
        
        return schemas.AgentDataResponse(
            status="success",
            data=schemas.AgentData.from_orm(db_agent_data)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取AgentData失败")


@router.get("/", response_model=schemas.AgentDataListResponse)
async def get_agent_data_list(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回的记录数"),
    user_id: Optional[int] = Query(None, description="用户ID过滤"),
    session_id: Optional[str] = Query(None, description="会话ID过滤"),
    data_type: Optional[str] = Query(None, description="数据类型过滤"),
    db: AsyncSession = Depends(get_db)
):
    """获取AgentData列表"""
    try:
        # 获取数据列表
        agent_data_list = await AgentDataService.get_agent_data_list(
            db=db,
            skip=skip,
            limit=limit,
            user_id=user_id,
            session_id=session_id,
            data_type=data_type
        )
        
        # 获取总数
        total = await AgentDataService.get_agent_data_count(
            db=db,
            user_id=user_id,
            session_id=session_id,
            data_type=data_type
        )
        
        return schemas.AgentDataListResponse(
            status="success",
            data=[schemas.AgentData.from_orm(item) for item in agent_data_list],
            total=total,
            page=skip // limit + 1,
            page_size=limit
        )
    except Exception as e:
        logger.error(f"获取AgentData列表失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取AgentData列表失败")


@router.put("/{agent_data_id}", response_model=schemas.AgentDataResponse)
async def update_agent_data(
    agent_data_id: str,
    agent_data_update: schemas.AgentDataUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新AgentData"""
    try:
        # 检查AgentData是否存在
        existing_agent_data = await AgentDataService.get_agent_data_by_id(db, agent_data_id)
        if not existing_agent_data:
            raise HTTPException(status_code=404, detail="AgentData不存在")
        
        # 更新AgentData
        updated_agent_data = await AgentDataService.update_agent_data(
            db, agent_data_id, agent_data_update
        )
        
        return schemas.AgentDataResponse(
            status="success",
            message="AgentData更新成功",
            data=schemas.AgentData.from_orm(updated_agent_data)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="更新AgentData失败")


@router.delete("/{agent_data_id}", response_model=schemas.AgentDataResponse)
async def delete_agent_data(
    agent_data_id: str,
    db: AsyncSession = Depends(get_db)
):
    """删除AgentData"""
    try:
        # 检查AgentData是否存在
        existing_agent_data = await AgentDataService.get_agent_data_by_id(db, agent_data_id)
        if not existing_agent_data:
            raise HTTPException(status_code=404, detail="AgentData不存在")
        
        # 删除AgentData
        success = await AgentDataService.delete_agent_data(db, agent_data_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除AgentData失败")
        
        return schemas.AgentDataResponse(
            status="success",
            message="AgentData删除成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="删除AgentData失败")


@router.get("/session/{session_id}", response_model=schemas.AgentDataListResponse)
async def get_agent_data_by_session(
    session_id: str,
    data_type: Optional[str] = Query(None, description="数据类型过滤"),
    db: AsyncSession = Depends(get_db)
):
    """根据会话ID获取AgentData列表"""
    try:
        agent_data_list = await AgentDataService.get_agent_data_by_session(
            db, session_id, data_type
        )
        
        return schemas.AgentDataListResponse(
            status="success",
            data=[schemas.AgentData.from_orm(item) for item in agent_data_list],
            total=len(agent_data_list)
        )
    except Exception as e:
        logger.error(f"根据会话ID获取AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取AgentData失败")


@router.get("/message/{message_id}", response_model=schemas.AgentDataListResponse)
async def get_agent_data_by_message(
    message_id: int,
    db: AsyncSession = Depends(get_db)
):
    """根据消息ID获取AgentData列表"""
    try:
        agent_data_list = await AgentDataService.get_agent_data_by_message(db, message_id)
        
        return schemas.AgentDataListResponse(
            status="success",
            data=[schemas.AgentData.from_orm(item) for item in agent_data_list],
            total=len(agent_data_list)
        )
    except Exception as e:
        logger.error(f"根据消息ID获取AgentData失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取AgentData失败")