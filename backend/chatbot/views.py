from django.views.decorators.csrf import csrf_exempt
import json
from .models import ChatSession, ProcessInfo, ChatMessage
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
import os
import logging
from django.http import StreamingHttpResponse
from .agent.ResponseGenerator import ResponseGenerator
from django.core.cache import cache
from .PDFdocument.documentSearch import search_session_documents
from.LLMService import LLMService
from .agent.LLMController import get_process_info
from .agent.mcpConfigManager import ServerConfigration, Server, McpSession
from asgiref.sync import sync_to_async, async_to_sync


MAX_HISTORY_LENGTH = 10  # 可根据需要调整
# 配置日志
logger = logging.getLogger(__name__)

# 创建单独的文件处理器，用于处理特定日志
chunk_file_handler = logging.FileHandler('chunk.log')
chunk_file_handler.setLevel(logging.DEBUG)
logger.addHandler(chunk_file_handler)

@api_view(['POST'])
def chat(request):
    """
    处理用户的聊天请求，加工用户的信息，检索相关的文档，生成回复
    """
    # Use async_to_sync to wrap the async function
    return async_to_sync(async_chat)(request)

async def async_chat(request):
    """
    处理用户的聊天请求，加工用户的信息，检索相关的文档，生成回复
    """
    try:
        # 获取请求体中的数据
        message = request.data.get('message', '').strip()
        session_id = request.data.get('session_id')
        
        # 验证消息和会话ID不为空
        if not message or not session_id:
            return Response({
                'status': 'error',
                'message': '消息内容和会话ID不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 记录请求信息
        logger.info("="*50)
        logger.info("新的聊天请求")
        logger.info(f"用户输入: {message}")
        logger.info(f"会话ID: {session_id}")
        logger.info("-"*30)
        
        try:
            server_config = ServerConfigration.load_config()
            servers = [
                Server(name, srv_config)
                for name, srv_config in server_config["mcpServers"].items()
            ]
            llm = LLMService.get_llm(model_name='deepseek-chat', stream=False)
            mcp_session = McpSession(servers, llm)
            await mcp_session.start()

            # 使用异步方式获取会话
            chat_session = await sync_to_async(ChatSession.objects.get)(id=session_id)
            chat_history = await ChatHistoryManager.get_chat_history(session_id)
                     
            # 添加当前用户消息 - 使用异步方式
            await sync_to_async(chat_session.messages.create)(
                content=message,
                is_user=True
            )
            
            # 更新缓存中的对话历史
            chat_history.append({"role": "user", "content": message})
            
            try:
                # 确保响应生成函数也是异步的
                return await generate_streaming_response(message, chat_session, chat_history)
            except Exception as e:
                logger.warning(f"流式响应失败，切换到普通对话模式: {str(e)}")
                return await generate_standard_response(message, chat_session, chat_history)

        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)   

    except Exception as e:
        logger.error(f"未预期的错误: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': '服务器内部错误'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


@api_view(['GET'])
def get_process_info_view(request, session_id):        
    try:
        process_infos = ProcessInfo.objects.filter(session_id=session_id).order_by('-created_at')
        data = [{
            'steps': info.steps,
            'task_plan': info.task_plan,
            'tool_selections': info.tool_selections,
            'task_results': info.task_results
        } for info in process_infos]
        return Response({
           'status': 'success',
           'data': data
        })
    except Exception as e:
        logger.error(f"获取处理过程信息失败: {str(e)}")
        return Response({
           'status': 'error',
           'message': '获取处理过程信息失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 
    
async def generate_streaming_response(message, chat_session, chat_history):
    """
    Generate a streaming response and persist it.
    
    Args:
        message: User message
        chat_session: Database chat session object
        chat_history: List of chat history messages
        
    Returns:
        StreamingHttpResponse for SSE delivery
    """
            
    async def stream_response():
        full_response = ""
        process_steps = []
        task_plan = None
        tool_selections = None
        task_results = {}
        ai_message = None

        try:
            # Use the improved create_streaming_response function
            # 将同步生成器转为异步
            process_info_generator = await sync_to_async(get_process_info)(message)
            try:
                # 迭代生成器需要特殊处理
                process_info = None
                while True:
                    event = await sync_to_async(next)(process_info_generator)
                    # event为python字典类型
                    yield f"data: {json.dumps(event)}\n\n"
                    if event["type"] == "step":
                        process_steps.append(event["content"])
                    elif event["type"] == "data":
                        # 处理不同类型的事件
                        if event["subtype"] == "task_plan":
                            task_plan = event["content"]
                        elif event["subtype"] == "task_result":
                            task_results[event["content"]["task_id"]] = event["content"]["result"]
                        elif event["subtype"] == "tool_selections":
                            tool_selections = event["content"]
                    elif event["type"] == "final" and event["subtype"] == "process_info":
                        # 获取最终的process_info
                        process_info = event["content"]
                    logger.info(f"yield the chunk: {event}")
            except StopIteration as e:
                # 如果没有获取到process_info，创建一个简单的默认值
                if process_info is None:
                    process_info = {
                        "user_input": message,
                        "task_planning": {"tasks": []},
                        "tool_selection": {"tool_selections": []},
                        "task_execution": {}
                    }
            
            # 转换为异步调用
            response_generator = await sync_to_async(ResponseGenerator.create_streaming_response)(message, process_info, chat_history)
            for chunk in response_generator:
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                    # logger.info(f"Chunk: {chunk}")
        finally:
            if full_response:
                # Save response to database
                ai_message = await sync_to_async(chat_session.messages.create)(
                    content=full_response,
                    is_user=False
                )
                
                # Set session title if this is the first message
                message_count = await sync_to_async(chat_session.messages.count)()
                if message_count <= 2:
                    chat_session.title = message[:50] + ('...' if len(message) > 50 else '')
                    await sync_to_async(chat_session.save)()

                # Update chat history in cache
                await ChatHistoryManager.update_chat_history(
                    session_id=chat_session.id,
                    role="assistant",
                    content=full_response,
                    chat_history=chat_history
                )
            
            if ai_message:
                # 保存ProcessInfo到数据库
                await sync_to_async(ProcessInfo.objects.create)(
                    message=ai_message,
                    steps=process_steps,
                    task_plan=task_plan,
                    tool_selection=tool_selections,
                    task_results=task_results
                )

    # 使用async_to_sync包装异步生成器，使其与StreamingHttpResponse兼容
    sync_stream_generator = async_to_sync(lambda: stream_response())()
    
    response = StreamingHttpResponse(
        stream_response(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
    
async def generate_standard_response(message, chat_session, chat_history):
    """
    Generate a standard (non-streaming) response using the LLM
    
    Args:
        message: User message
        chat_session: Database chat session object
        chat_history: List of chat history messages
        
    Returns:
        Response object with generated content
    """
    try:
        # Create LLM instance
        llm = LLMService.get_llm(model_name='deepseek-chat', stream=False)
        
        # 使用基础的系统提示，不再使用PromptManager
        system_prompt = """你是浙江农林大学的智能校园助手，负责回答学生和教师关于校园信息、学术资源、教学服务等方面的问题。
        请提供准确、有帮助的回答，语气友好专业。如果你不确定某个问题的答案，请诚实地表明，并建议用户通过官方渠道获取准确信息。
        回答应简洁明了，条理清晰，必要时可使用列表或表格格式提高可读性。"""
        
        # Build messages with system prompt
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(chat_history)
        
        # Get response from LLM - 使用异步方式调用
        response = await sync_to_async(llm.invoke)(messages)
        response_content = getattr(response, 'content', str(response))
        
        # Save to database
        await sync_to_async(chat_session.messages.create)(
            content=response_content,
            is_user=False
        )

        # Update chat history
        await ChatHistoryManager.update_chat_history(
            session_id=chat_session.id,
            role="assistant",
            content=response_content,
            chat_history=chat_history
        )
        
        return Response({
            'status': 'success',
            'data': {
                'content': response_content
            }
        })
    except Exception as e:
        logger.error(f"对话失败: {str(e)}", exc_info=True)
        return Response({
            'status': 'error',
            'message': '对话生成失败，请稍后重试'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
class ChatHistoryManager:
    """
    聊天历史管理器，用于管理和缓存聊天历史
    """

    # 保存的历史记录最长的长度
    MAX_HISTORY_LENGTH = 10

    @classmethod
    async def get_chat_history(cls, session_id):
        """
        Get chat history from cache or rebuild from database
        
        Args:
            session_id: Session ID to retrieve history for
            
        Returns:
            List of chat messages in the format [{"role": "user", "content": "..."}]
        """
        # Try to get from cache first
        cache_key = f'chat_history_{session_id}'
        cached_history = await sync_to_async(cache.get)(cache_key)

        if cached_history:
            # Trim history if too long
            if len(cached_history) > cls.MAX_HISTORY_LENGTH:
                cached_history = cached_history[-cls.MAX_HISTORY_LENGTH:]
                await sync_to_async(cache.set)(cache_key, cached_history, timeout=3600)
            return cached_history
        
        # Cache miss - rebuild from database
        logger.info("缓存未命中，从数据库重建对话历史")
        try:
            chat_session = await sync_to_async(ChatSession.objects.get)(id=session_id)
            
            # Get latest messages - 使用异步方式
            history_messages = await sync_to_async(lambda: list(chat_session.messages.order_by('created_at')[:cls.MAX_HISTORY_LENGTH]))()
            history_messages = sorted(history_messages, key=lambda x: x.created_at)

            # Format messages for LLM
            chat_history = []
            for msg in history_messages:
                role = "user" if msg.is_user else "assistant"
                chat_history.append({"role": role, "content": msg.content})

            logger.info(f"从数据库重建对话历史，共 {len(chat_history)} 条消息")
            
            # Store in cache for future use
            await sync_to_async(cache.set)(cache_key, chat_history, timeout=3600)
            return chat_history
            
        except (ChatSession.DoesNotExist, Exception) as e:
            logger.error(f"重建对话历史失败: {str(e)}")
            return []
        
    @classmethod
    async def update_chat_history(cls, session_id, role, content, chat_history=None):
        """
        Update chat history in cache
        
        Args:
            session_id: Session ID
            role: Message role ("user" or "assistant")
            content: Message content
            chat_history: Optional existing chat history to update
        """
        cache_key = f'chat_history_{session_id}'
        
        if chat_history is None:
            chat_history = await cls.get_chat_history(session_id)
        
        # Add new message
        chat_history.append({"role": role, "content": content})
        
        # Trim if necessary
        if len(chat_history) > cls.MAX_HISTORY_LENGTH:
            chat_history = chat_history[-cls.MAX_HISTORY_LENGTH:]
        
        # Update cache
        await sync_to_async(cache.set)(cache_key, chat_history, timeout=3600)
        return chat_history

@api_view(['GET', 'POST', 'DELETE'])
def chat_sessions(request):
    # 检查用户是否登录
    if not request.user.is_authenticated:
        return Response({
            'status': 'error',
            'message': '请先登录'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # GET请求：获取当前用户的所有会话
    if request.method == 'GET':
        logger.info("获取当前用户的所有会话")
        logger.info(request.user)
        sessions = ChatSession.objects.filter(user=request.user)
        return Response({
            'status': 'success',
            'data': [{
                'id': session.id,
                'title': session.title,
                'updated_at': session.updated_at
            } for session in sessions]
        })
    
    # POST请求：为当前用户创建新会话
    elif request.method == 'POST':
        session = ChatSession.objects.create(user=request.user)
        return Response({
            'status': 'success',
            'data': {
                'id': session.id,
                'title': session.title,
                'created_at': session.created_at,
            }
        }, status=status.HTTP_201_CREATED)

# 根据session_id获取会话消息
@api_view(['GET', 'DELETE'])
def session_messages(request, session_id):
    if request.method == 'GET':
        try:
            session = ChatSession.objects.get(id=session_id)
            messages = session.messages.all().prefetch_related('process_info')
            response_data = []
            for msg in messages:
                message_data = {
                    'content': msg.content,
                    'is_user': msg.is_user,
                    'created_at': msg.created_at,
                }
                if hasattr(msg, 'process_info'):
                    process_info = msg.process_info
                    message_data['process_info'] = {
                        'steps': process_info.steps,
                        'task_plan': process_info.task_plan,
                        'tool_selection': process_info.tool_selection,
                        'task_results': process_info.task_results,
                        'created_at': process_info.created_at
                    }
                response_data.append(message_data)

            return Response({
                'status': 'success',
                'data': response_data
            })
        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)
    elif request.method == 'DELETE':
        try:
            session = ChatSession.objects.get(id=session_id)
            session.delete()
            return Response({
                'status': 'success',
                'message': '会话已删除'
            })
        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)