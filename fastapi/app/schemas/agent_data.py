from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


class AgentDataBase(BaseModel):
    """AgentData基础模式"""
    type: str = Field(..., description="数据类型: table, form, image, code, text, chart, file, markdown")
    title: Optional[str] = Field(None, description="数据标题")
    content: Dict[str, Any] = Field(..., description="存储各种类型的内容数据")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class AgentDataCreate(AgentDataBase):
    """创建AgentData的模式"""
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), description="唯一标识符")
    session_id: Optional[str] = Field(None, description="关联的聊天会话ID")
    message_id: Optional[int] = Field(None, description="关联的消息ID")
    user_id: int = Field(..., description="关联的用户ID")


class AgentDataUpdate(BaseModel):
    """更新AgentData的模式"""
    type: Optional[str] = Field(None, description="数据类型")
    title: Optional[str] = Field(None, description="数据标题")
    content: Optional[Dict[str, Any]] = Field(None, description="内容数据")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class AgentData(AgentDataBase):
    """完整的AgentData模式"""
    id: str = Field(..., description="唯一标识符")
    timestamp: datetime = Field(..., description="时间戳")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    session_id: Optional[str] = Field(None, description="关联的聊天会话ID")
    message_id: Optional[int] = Field(None, description="关联的消息ID")
    user_id: int = Field(..., description="关联的用户ID")

    class Config:
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AgentDataResponse(BaseModel):
    """AgentData响应模式"""
    status: str = Field(..., description="响应状态")
    message: Optional[str] = Field(None, description="响应消息")
    data: Optional[AgentData] = Field(None, description="AgentData数据")


class AgentDataListResponse(BaseModel):
    """AgentData列表响应模式"""
    status: str = Field(..., description="响应状态")
    message: Optional[str] = Field(None, description="响应消息")
    data: Optional[list[AgentData]] = Field(None, description="AgentData列表")
    total: Optional[int] = Field(None, description="总数量")
    page: Optional[int] = Field(None, description="当前页码")
    page_size: Optional[int] = Field(None, description="每页大小")