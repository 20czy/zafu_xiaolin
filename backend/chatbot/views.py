from django.views.decorators.csrf import csrf_exempt
import json
from .connectLLM import  LLMService
from .models import PDFDocument, ChatSession
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .PDFdocument.documentProcess import process_pdf_document
from .PDFdocument.documentEmbedding import add_documents_to_faiss
from .PDFdocument.documentSearch import search_all_documents
import os
import logging
from django.conf import settings
from .promptGenerator import PromptGenerator
from django.http import StreamingHttpResponse
from .connectLLM import  create_streaming_response
from django.core.cache import cache
from .PDFdocument.documentSearch import search_session_documents

MAX_HISTORY_LENGTH = 10  # 可根据需要调整
# 配置日志
logger = logging.getLogger(__name__)

@api_view(['POST'])
def chat(request):
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
            chat_session = ChatSession.objects.get(id=session_id)
            chat_history = ChatHistoryManager.get_chat_history(session_id)
                     
            # 添加当前用户消息
            chat_session.messages.create(
                content=message,
                is_user=True
            )
            
            # 更新缓存中的对话历史
            chat_history.append({"role": "user", "content": message})
            
            try:
                return generate_streaming_response(message, chat_session, chat_history)
            except Exception as e:
                logger.warning(f"流式响应失败，切换到普通对话模式: {str(e)}")
                return generate_standard_response(message, chat_session, chat_history)

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
    
def generate_streaming_response(message, chat_session, chat_history):
    """
    Generate a streaming response using the LLM
    
    Args:
        message: User message
        chat_session: Database chat session object
        chat_history: List of chat history messages
        
    Returns:
        StreamingHttpResponse for SSE delivery
    """
    def response_generator():
        full_response = ""
        try:
            # Use the improved create_streaming_response function
            for chunk in create_streaming_response(message, chat_history, chat_session.id):
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
        finally:
            if full_response:
                # Save response to database
                chat_session.messages.create(
                    content=full_response,
                    is_user=False
                )
                
                # Set session title if this is the first message
                if chat_session.messages.count() <= 2:
                    chat_session.title = message[:50] + ('...' if len(message) > 50 else '')
                    chat_session.save()

                # Update chat history in cache
                ChatHistoryManager.update_chat_history(
                    session_id=chat_session.id,
                    role="assistant",
                    content=full_response,
                    chat_history=chat_history
                )

    response = StreamingHttpResponse(
        response_generator(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
    
def generate_standard_response(message, chat_session, chat_history):
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
        
        # Get response from LLM
        response = llm.invoke(messages)
        response_content = getattr(response, 'content', str(response))
        
        # Save to database
        chat_session.messages.create(
            content=response_content,
            is_user=False
        )

        # Update chat history
        ChatHistoryManager.update_chat_history(
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
    def get_chat_history(cls, session_id):
        """
        Get chat history from cache or rebuild from database
        
        Args:
            session_id: Session ID to retrieve history for
            
        Returns:
            List of chat messages in the format [{"role": "user", "content": "..."}]
        """
        # Try to get from cache first
        cache_key = f'chat_history_{session_id}'
        cached_history = cache.get(cache_key)

        if cached_history:
            # Trim history if too long
            if len(cached_history) > cls.MAX_HISTORY_LENGTH:
                cached_history = cached_history[-cls.MAX_HISTORY_LENGTH:]
                cache.set(cache_key, cached_history, timeout=3600)
            return cached_history
        
        # Cache miss - rebuild from database
        logger.info("缓存未命中，从数据库重建对话历史")
        try:
            chat_session = ChatSession.objects.get(id=session_id)
            
            # Get latest messages
            history_messages = chat_session.messages.order_by('created_at')[:cls.MAX_HISTORY_LENGTH]
            history_messages = sorted(history_messages, key=lambda x: x.created_at)

            # Format messages for LLM
            chat_history = []
            for msg in history_messages:
                role = "user" if msg.is_user else "assistant"
                chat_history.append({"role": role, "content": msg.content})

            logger.info(f"从数据库重建对话历史，共 {len(chat_history)} 条消息")
            
            # Store in cache for future use
            cache.set(cache_key, chat_history, timeout=3600)
            return chat_history
            
        except (ChatSession.DoesNotExist, Exception) as e:
            logger.error(f"重建对话历史失败: {str(e)}")
            return []
        
    @classmethod
    def update_chat_history(cls, session_id, role, content, chat_history=None):
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
            chat_history = cls.get_chat_history(session_id)
        
        # Add new message
        chat_history.append({"role": role, "content": content})
        
        # Trim if necessary
        if len(chat_history) > cls.MAX_HISTORY_LENGTH:
            chat_history = chat_history[-cls.MAX_HISTORY_LENGTH:]
        
        # Update cache
        cache.set(cache_key, chat_history, timeout=3600)
        return chat_history
    

# # 获取RAG上下文的函数
# def get_rag_context(query, session_id, max_length=5000):
#     """
#     根据查询获取相关RAG上下文

#     Args:
#         query: 查询文本
#         session_id: 会话ID
#         max_length: 上下文最大长度，默认为5000

#     Returns:
#         str: 上下文文本
#     """
#     try:
#         need_rag, doc_type, optimized_query = TaskClassifier.classify(query)

#         if not need_rag:
#             return ""
            
#         # 根据文档类型获取相关文档
#         if doc_type == 'both':
#             # 同时查询招标书和应标书
#             invitation_docs = search_session_documents(optimized_query, session_id, document_type='invitation')
#             offer_docs = search_session_documents(optimized_query, session_id, document_type='offer')
#             relevant_docs = invitation_docs + offer_docs
#         else:
#             # 查询指定类型的文档
#             relevant_docs = search_session_documents(optimized_query, session_id, document_type=doc_type)
        
#         context_parts = []
#         current_length = 0

#         # 合并并裁剪上下文
#         for doc in relevant_docs:
#             doc_text = f"[{doc['document_title']}] {doc['content']}\n\n"
#             doc_length = len(doc_text)

#             if current_length + doc_length <= max_length:
#                 context_parts.append(doc_text)
#                 current_length += doc_length
#             else:
#                 # If adding whole document exceeds length, add partial document if possible
#                 remaining_length = max_length - current_length
#                 if remaining_length > 100:  # Only add if we can include meaningful content
#                     context_parts.append(f"[{doc['document_title']}] {doc['content'][:remaining_length-50]}...\n\n")
#                 break
                
#         return "".join(context_parts)
        
#     except Exception as e:
#         logger.error(f"获取RAG上下文失败: {str(e)}")
#         return ""
    
# 上传pdf文件
@api_view(['POST'])
def upload_pdf(request):
    # 检查用户是否登录
    if not request.user.is_authenticated:
        return Response({
            'status': 'error',
            'message': '请先登录'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        if 'file' not in request.FILES:
            return Response({
                'status': 'error',
                'message': '没有文件被上传'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取文档类型
        document_type = request.data.get('document_type', 'invitation') 
        if document_type not in ['invitation', 'offer']:
            return Response({
                'status': 'error',
                'message': '无效的文档类型，必须是 invitation(招标书) 或 offer(应标书)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取会话ID
        session_id = request.data.get('session_id')
        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id)
            except ChatSession.DoesNotExist:
                return Response({
                    'status': 'error',
                    'message': '会话不存在'
                }, status=status.HTTP_404_NOT_FOUND)
        
        pdf_file = request.FILES['file']
        if not pdf_file.name.endswith('.pdf'):
            return Response({
                'status': 'error',
                'message': '只能上传PDF文件'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 保存PDF文档，添加上传者信息和会话关联
        document = PDFDocument.objects.create(
            title=pdf_file.name,
            file=pdf_file,
            uploader=request.user,
            session=session if session_id else None,  # 关联会话
            document_type=document_type # 文档类型
        )
        logger.info(f"PDF文件已保存，ID: {document.id}")
        
        try:
            # 处理PDF文档，分割成文档块
            docs = process_pdf_document(document.id)
            logger.info(f"文档分割完成，共 {len(docs)} 个块")
            
            # 创建向量存储目录
            vector_store_dir = os.path.join(settings.MEDIA_ROOT, 'vector_store')
            os.makedirs(vector_store_dir, exist_ok=True)
            
            # 生成唯一的向量存储文件名
            index_path = os.path.join(vector_store_dir, f'doc_{document.id}.faiss')
            
            # 将文档添加到向量存储
            add_documents_to_faiss(docs, index_path)
            logger.info(f"向量存储已创建: {index_path}")
            
            # 更新文档记录，添加向量存储路径
            document.vector_index_path = index_path
            document.is_processed = True
            document.page_count = len(set(doc.metadata.get('page', 0) for doc in docs))
            document.chunk_count = len(docs)
            document.save()
            
        except Exception as e:
            # 如果处理过程中出错，删除已上传的文档
            document.delete()
            logger.error(f"处理PDF时出错: {str(e)}")
            raise Exception(f"处理PDF时出错: {str(e)}")
        
        return Response({
            'status': 'success',
            'data': {
                'id': document.id,
                'title': document.title,
                'url': request.build_absolute_uri(document.file.url),
                'is_processed': document.is_processed,
                'page_count': document.page_count,
                'chunk_count': document.chunk_count,
                'document_type': document.document_type,
                'created_at': document.created_at,
                'updated_at': document.updated_at
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"上传处理失败: {str(e)}")
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            messages = session.messages.all()
            return Response({
                'status': 'success',
                'data': [{
                    'content': msg.content,
                    'is_user': msg.is_user,
                    'created_at': msg.created_at
                } for msg in messages]
            })
        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)
    elif request.method == 'DELETE':
        session = ChatSession.objects.get(id=session_id)
        try:
            session.delete()
            return Response({
                'status': 'success',
                'message': '会话已删除'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'删除会话失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def session_documents(request, session_id):
    """获取指定会话关联的文档"""
    try:
        # 检查用户是否登录
        if not request.user.is_authenticated:
            return Response({
                'status': 'error',
                'message': '请先登录'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # 获取会话
        session = ChatSession.objects.get(id=session_id)
        
        # 获取与会话关联的文档
        documents = PDFDocument.objects.filter(session_id=session_id)
        
        return Response({
            'status': 'success',
            'data': [{
                'id': doc.id,
                'title': doc.title,
                'url': request.build_absolute_uri(doc.file.url),
                'is_processed': doc.is_processed,
                'page_count': doc.page_count,
                'chunk_count': doc.chunk_count,
                'document_type': doc.document_type,
                'created_at': doc.created_at,
                'updated_at': doc.updated_at
            } for doc in documents]
        })
        
    except ChatSession.DoesNotExist:
        return Response({
            'status': 'error',
            'message': '会话不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"获取会话文档失败: {str(e)}")
        return Response({
            'status': 'error',
            'message': '获取文档失败'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    