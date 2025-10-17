from sqlalchemy.engine import result
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
import json
import logging
import asyncio
from ...db.session import get_db
from ...db import models
from ...schemas import chat as schemas
from ...agent.LLMController import get_process_info
from ...agent.ResponseGenerator import ResponseGenerator
from ...services.chat_history_manager import ChatHistoryManager
from ...core.config import DJANGO_API_BASE_URL
import pydantic
import requests

# Custom JSON encoder to handle CallToolResult and other non-serializable types
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

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.ChatResponse)
async def chat(
    request: schemas.ChatRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    处理用户的聊天请求，加工用户的信息，检索相关的文档，生成回复
    """
    try:
        # 获取请求体中的数据
        message = request.message.strip()
        session_id = request.session_id
        is_agent = request.is_agent
        
        # 验证消息和会话ID不为空
        if not message or not session_id:
            return schemas.ChatResponse(
                status="error",
                message="消息内容和会话ID不能为空"
            )
        
        # 记录请求信息
        logger.info("="*50)
        logger.info("新的聊天请求")
        logger.info(f"用户输入: {message}")
        logger.info(f"会话ID: {session_id}")
        logger.info("-"*30)

        try:
            # 将刚刚输入的用户信息保存到指定的session数据库
            django_response = requests.post(
                f"{DJANGO_API_BASE_URL}/{session_id}/history/update/",
                json={"role": "user", "content": message},
                timeout=10
            )
            if django_response.status_code != 200:
                logger.error(f"更新聊天历史失败: {django_response.status_code}")
                raise HTTPException(status_code=500, detail="更新聊天历史失败")
        except requests.RequestException as e:
            logger.error(f"更新聊天历史请求失败: {str(e)}")
            raise HTTPException(status_code=500, detail="更新聊天历史请求失败")
        
        try:
            chat_history_response = requests.get(
                f"{DJANGO_API_BASE_URL}/{session_id}/history/",
                timeout=10  # 添加超时设置
            )
            if chat_history_response.status_code != 200:
                logger.error(f"获取聊天历史失败: {chat_history_response.status_code}")
                raise HTTPException(status_code=500, detail="获取聊天历史失败")
            chat_history_response = json.loads(chat_history_response.text)
            chat_history = chat_history_response['data']['history']
        except Exception as e:
            logger.error(f"获取聊天历史失败: {str(e)}")
            raise HTTPException(status_code=500, detail="获取聊天历史失败")
        
        try:
            # 使用流式响应
            return StreamingResponse(
                generate_streaming_response(message, session_id, chat_history, db, is_agent),
                media_type="text/event-stream"
            )
        except Exception as e:
            logger.warning(f"流式响应失败，切换到普通对话模式: {str(e)}")
            # 使用普通响应
            return await generate_standard_response(message, session_id, chat_history, db)
            
    except Exception as e:
        logger.error(f"未预期的错误: {str(e)}", exc_info=True)
        return schemas.ChatResponse(
            status="error",
            message="服务器内部错误"
        )

@router.get("/sessions", response_model=List[schemas.ChatSession])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """
    获取所有聊天会话
    """
    try:
        result = await db.execute(
            select(models.ChatSession).order_by(
                models.ChatSession.updated_at.desc()
            )
        )
        sessions = result.scalars().all()
        
        return sessions
    except Exception as e:
        logger.error(f"获取聊天会话失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取聊天会话失败")

@router.get("/sessions/{session_id}/messages", response_model=List[schemas.ChatMessage])
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    获取指定会话的所有消息
    """
    try:
        result = await db.execute(
            select(models.ChatMessage)
            .where(models.ChatMessage.session_id == session_id)
            .order_by(models.ChatMessage.created_at)
        )
        messages = result.scalars().all()
        
        if not messages:
            raise HTTPException(status_code=404, detail="会话不存在或没有消息")
            
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话消息失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取会话消息失败")

@router.get("/process-info/{session_id}", response_model=List[schemas.ProcessInfo])
async def aget_process_info(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    获取指定会话的处理过程信息
    """
    try:
        result = await db.execute(
            select(models.ProcessInfo)
            .where(models.ProcessInfo.session_id == session_id)
            .order_by(models.ProcessInfo.created_at.desc())
        )
        process_infos = result.scalars().all()
        
        return process_infos
    except Exception as e:
        logger.error(f"获取处理过程信息失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取处理过程信息失败")

async def generate_streaming_response(message: str, session_id: str, chat_history: List[Dict[str, str]], db: AsyncSession, is_agent: bool):
    """
    生成流式响应并持久化
    
    Args:
        message: 用户消息
        session_id: 会话ID
        chat_history: 聊天历史
        db: 数据库会话
        is_agent: 是否使用智能代理模式
    """
    full_response = ""
    ai_message = None
    process_info = None

    try:
        if is_agent:
            # 智能代理模式：使用完整的处理流程
            process_steps = []
            task_plan = None
            tool_selections = None
            task_results = {}

            # 使用异步生成器获取处理过程信息
            async for event in get_process_info(message):
                # 处理事件数据
                if isinstance(event, pydantic.BaseModel):
                    result = event.model_dump()
                else:
                    result = event  # 如果不是pydantic模型，直接使用原始事件
                    
                # 使用自定义编码器转换为JSON字符串并发送
                yield f"data: {json.dumps(result, cls=CustomJSONEncoder)}\n\n"
                
                # 记录事件数据 - 使用result而不是event
                if result.get("type") == "step":
                    process_steps.append(result.get("content"))
                elif result.get("type") == "data":
                    if result.get("subtype") == "task_plan":
                        task_plan = result.get("content")
                    elif result.get("subtype") == "task_result":
                        task_results[result.get("content", {}).get("task_id")] = result.get("content", {}).get("result")
                    elif result.get("subtype") == "tool_selections":
                        tool_selections = result.get("content")
                
                logger.info(f"发送事件: {result}")
            
            # 获取处理过程信息
            process_info = {
                "user_input": message,
                "steps": process_steps,
                "task_planning": {"tasks": task_plan} if task_plan else {},
                "tool_selection": {"tool_selections": tool_selections} if tool_selections else {},
                "task_execution": task_results
            }
            
            # 生成最终响应
            async for chunk in ResponseGenerator.create_streaming_response(message, process_info, chat_history):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
        else:
            # 普通模式：直接生成简单回复
            async for chunk in ResponseGenerator.create_simple_streaming_response(message, chat_history):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
    finally:
        if full_response:
            try:
                ai_message_response = requests.post(
                    f"{DJANGO_API_BASE_URL}/{session_id}/history/update/",
                    json={"role": "assistant", "content": full_response},
                    timeout=10
                )
                if ai_message_response.status_code != 200:
                    logger.error(f"保存ai聊天历史失败: {ai_message_response.status_code}")
                    raise HTTPException(status_code=500, detail="更新ai聊天历史失败")
                
                # 解析响应获取message_id
                ai_message_data = ai_message_response.json()
                ai_message_id = ai_message_data.get('message_id')
                
            except requests.RequestException as e:
                logger.error(f"更新ai聊天历史请求失败: {str(e)}")
                raise HTTPException(status_code=500, detail="更新ai聊天历史请求失败")
            
            # 只有在智能代理模式下才保存处理过程信息
            if is_agent and process_info and ai_message_id:
                try:
                    save_processInfo_response = requests.post(
                        f"{DJANGO_API_BASE_URL.replace('/chat/sessions', '')}/process_info/create/",
                        json={
                            "message_id": ai_message_id,
                            "session_id": session_id,
                            "process_info": process_info
                        },
                        timeout=10
                    )
                except requests.RequestException as e:
                    logger.error(f"保存处理过程信息请求失败: {str(e)}")
                    raise HTTPException(status_code=500, detail="保存处理过程信息请求失败")

async def generate_standard_response(message: str, session_id: str, chat_history: List[Dict[str, str]], db: AsyncSession):
    """
    生成标准（非流式）响应
    
    Args:
        message: 用户消息
        session_id: 会话ID
        chat_history: 聊天历史
        db: 数据库会话
    """
    try:
        # 获取处理过程信息
        process_info = {}
        async for event in get_process_info(message):
            # 记录事件数据
            if event["type"] == "step":
                if "steps" not in process_info:
                    process_info["steps"] = []
                process_info["steps"].append(event["content"])
            elif event["type"] == "data":
                if event["subtype"] == "task_plan":
                    process_info["task_planning"] = {"tasks": event["content"]}
                elif event["subtype"] == "task_result":
                    if "task_execution" not in process_info:
                        process_info["task_execution"] = {}
                    process_info["task_execution"][event["content"]["task_id"]] = event["content"]["result"]
                elif event["subtype"] == "tool_selections":
                    process_info["tool_selection"] = {"tool_selections": event["content"]}
        
        # 生成最终响应
        response_content = await ResponseGenerator.create_response(message, process_info, chat_history)
        
        # 保存AI响应到数据库
        ai_message = await ChatHistoryManager.save_message(
            session_id=session_id,
            content=response_content,
            is_user=False,
            db=db
        )
        
        # 保存处理过程信息
        if ai_message:
            await ChatHistoryManager.save_process_info(
                message_id=ai_message.id,
                session_id=session_id,
                process_info=process_info,
                db=db
            )
        
        return schemas.ChatResponse(
            status="success",
            data={"content": response_content}
        )
    except Exception as e:
        logger.error(f"生成标准响应失败: {str(e)}", exc_info=True)
        return schemas.ChatResponse(
            status="error",
            message="生成响应失败"
        )
