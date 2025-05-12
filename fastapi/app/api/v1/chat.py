from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
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

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.ChatResponse)
async def chat(
    request: schemas.ChatRequest, 
    db: Session = Depends(get_db)
):
    """
    处理用户的聊天请求，加工用户的信息，检索相关的文档，生成回复
    """
    try:
        # 获取请求体中的数据
        message = request.message.strip()
        session_id = request.session_id
        
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
        
        # 保存用户消息
        await ChatHistoryManager.save_message(
            session_id=session_id,
            content=message,
            is_user=True,
            db=db
        )
        
        # 获取聊天历史
        chat_history = await ChatHistoryManager.get_chat_history(session_id, db)
        
        try:
            # 使用流式响应
            return StreamingResponse(
                generate_streaming_response(message, session_id, chat_history, db),
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
async def get_chat_sessions(db: Session = Depends(get_db)):
    """
    获取所有聊天会话
    """
    try:
        sessions = db.query(models.ChatSession).order_by(
            models.ChatSession.updated_at.desc()
        ).all()
        
        return sessions
    except Exception as e:
        logger.error(f"获取聊天会话失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取聊天会话失败")

@router.get("/sessions/{session_id}/messages", response_model=List[schemas.ChatMessage])
async def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    """
    获取指定会话的所有消息
    """
    try:
        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session_id
        ).order_by(models.ChatMessage.created_at).all()
        
        if not messages:
            raise HTTPException(status_code=404, detail="会话不存在或没有消息")
            
        return messages
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话消息失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取会话消息失败")

@router.get("/process-info/{session_id}", response_model=List[schemas.ProcessInfo])
async def get_process_info(session_id: str, db: Session = Depends(get_db)):
    """
    获取指定会话的处理过程信息
    """
    try:
        process_infos = db.query(models.ProcessInfo).filter(
            models.ProcessInfo.session_id == session_id
        ).order_by(models.ProcessInfo.created_at.desc()).all()
        
        return process_infos
    except Exception as e:
        logger.error(f"获取处理过程信息失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="获取处理过程信息失败")

async def generate_streaming_response(message: str, session_id: str, chat_history: List[Dict[str, str]], db: Session):
    """
    生成流式响应并持久化
    
    Args:
        message: 用户消息
        session_id: 会话ID
        chat_history: 聊天历史
        db: 数据库会话
    """
    full_response = ""
    process_steps = []
    task_plan = None
    tool_selections = None
    task_results = {}
    ai_message = None

    try:
        # 使用异步生成器获取处理过程信息
        async for event in get_process_info(message):
            # 转换为JSON字符串并发送
            yield f"data: {json.dumps(event)}\n\n"
            
            # 记录事件数据
            if event["type"] == "step":
                process_steps.append(event["content"])
            elif event["type"] == "data":
                if event["subtype"] == "task_plan":
                    task_plan = event["content"]
                elif event["subtype"] == "task_result":
                    task_results[event["content"]["task_id"]] = event["content"]["result"]
                elif event["subtype"] == "tool_selections":
                    tool_selections = event["content"]
            
            logger.info(f"发送事件: {event}")
        
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
    finally:
        if full_response:
            # 保存AI响应到数据库
            ai_message = await ChatHistoryManager.save_message(
                session_id=session_id,
                content=full_response,
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

async def generate_standard_response(message: str, session_id: str, chat_history: List[Dict[str, str]], db: Session):
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
