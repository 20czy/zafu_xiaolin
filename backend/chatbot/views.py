from django.views.decorators.csrf import csrf_exempt
import json
from .connectLLM import create_llm, task_classification
from .models import PDFDocument, ChatSession
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .documentProcess import process_pdf_document
from .documentEmbedding import add_documents_to_faiss
from .documentSearch import search_all_documents
import os
import logging
from django.conf import settings
from .promptGenerator import PromptGenerator
from django.http import StreamingHttpResponse
from .connectLLM import create_llm, create_streaming_response, create_system_prompt
from django.core.cache import cache
from .documentSearch import search_session_documents

MAX_HISTORY_LENGTH = 10  # 可根据需要调整
# 配置日志
logger = logging.getLogger(__name__)

@api_view(['POST'])
def chat(request):
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
        
        chat_history = []
        
        # 记录请求信息
        logger.info("="*50)
        logger.info("新的聊天请求")
        logger.info(f"用户输入: {message}")
        logger.info(f"会话ID: {session_id}")
        logger.info("-"*30)
        
        try:
            chat_session = ChatSession.objects.get(id=session_id)

            # 从 Redis 缓存获取对话历史
            cache_key = f'chat_history_{session_id}'
            cached_history = cache.get(cache_key)

            if cached_history:
                chat_history = cached_history
                # 如果历史记录太长只保存最近几条    
                if len(chat_history) > MAX_HISTORY_LENGTH:
                    chat_history = chat_history[-MAX_HISTORY_LENGTH:]
                    # 更新缓存
                    cache.set(cache_key, chat_history, timeout=3600)
            else:
                # 缓存未命中，从数据库重建对话历史
                logger.info("缓存未命中，从数据库重建对话历史")
                MAX_HISTORY_MESSAGES = 10  # 可根据需要调整
                history_messages = chat_session.messages.order_by('created_at')[:MAX_HISTORY_MESSAGES]
                history_messages = sorted(history_messages, key=lambda x: x.created_at)

                chat_history = []
                for msg in history_messages:
                    role = "user" if msg.is_user else "assistant"
                    # 限制消息内容长度为1000字符
                    # content = msg.content[:1000] if len(msg.content) > 1000 else msg.content
                    chat_history.append({"role": role, "content": msg.content})

                logger.info(f"从数据库重建对话历史，共 {len(chat_history)} 条消息")
                # 存入缓存，设置过期时间为1小时
                cache.set(cache_key, chat_history, timeout=3600)
                     
            # 添加当前用户消息
            chat_session.messages.create(
                content=message,
                is_user=True
            )
            
            # 更新缓存中的对话历史
            chat_history.append({"role": "user", "content": message})
            
            try:
                # 创建LLM实例
                llm = create_llm(model_name='chatglm', stream=True)
                
                def response_generator():
                    nonlocal chat_history
                    full_response = ""
                    try:
                        # 构建系统提示词
                        system_prompt = create_system_prompt(llm, message, session_id)
                        # 将历史记录传入对话生成函数
                        for chunk in create_streaming_response(llm, message, chat_history, system_prompt):
                            if chunk:
                                full_response += chunk
                                yield f"data: {json.dumps({'content': chunk})}\n\n"
                    finally:
                        if full_response:
                            chat_session.messages.create(
                                content=full_response,
                                is_user=False
                            )
                            
                            if chat_session.messages.count() <= 2:
                                chat_session.title = message[:50] + ('...' if len(message) > 50 else '')
                                chat_session.save()

                            # 更新缓存
                            chat_history.append({"role": "assistant", "content": full_response})
                            if len(chat_history) > MAX_HISTORY_LENGTH:
                                chat_history = chat_history[-MAX_HISTORY_LENGTH:]
                            cache.set(f'chat_history_{session_id}', chat_history, timeout=3600)

                response = StreamingHttpResponse(
                    response_generator(),
                    content_type='text/event-stream'
                )
                response['Cache-Control'] = 'no-cache'
                response['X-Accel-Buffering'] = 'no'
                return response
                    
            except Exception as e:
                logger.warning(f"流式响应失败，切换到普通对话模式: {str(e)}")
                
                try:
                    # 普通对话模式也传入历史记录
                    response = llm.invoke(message, chat_history)
                    response_content = getattr(response, 'content', str(response))
                    
                    chat_session.messages.create(
                        content=response_content,
                        is_user=False
                    )

                     # 更新缓存
                    chat_history.append({"role": "assistant", "content": response_content})
                    if len(chat_history) > MAX_HISTORY_LENGTH:
                        chat_history = chat_history[-MAX_HISTORY_LENGTH:]
                    cache.set(cache_key, chat_history, timeout=3600)
                    
                    return Response({
                        'status': 'success',
                        'data': {
                            'content': response_content
                        }
                    })
                except Exception as e:
                    logger.error(f"对话失败: {str(e)}")
                    return Response({
                        'status': 'error',
                        'message': '对话生成失败，请稍后重试'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                    
        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        logger.error(f"未预期的错误: {str(e)}")
        return Response({
            'status': 'error',
            'message': '服务器内部错误'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

# 获取RAG上下文的函数
def get_rag_context(query, session_id, max_length=8000):
    """
    根据查询获取相关RAG上下文
    """
    try:
        need_rag, doc_type, query = task_classification(query)
        if not need_rag:
            return ""
            
        # 根据文档类型获取相关文档
        if doc_type == 'both':
            # 同时查询招标书和应标书
            invitation_docs = search_session_documents(query, session_id, document_type='invitation')
            offer_docs = search_session_documents(query, session_id, document_type='offer')
            relevant_docs = invitation_docs + offer_docs
        else:
            # 查询指定类型的文档
            relevant_docs = search_session_documents(query, session_id, document_type=doc_type)
        
        # 合并并裁剪上下文
        context = ""
        for doc in relevant_docs:
            if len(context) + len(doc['content']) <= max_length:
                context += f"[{doc['document_title']}] " + doc['content'] + "\n\n"
            else:
                break
                
        return context
        
    except Exception as e:
        logger.error(f"获取RAG上下文失败: {str(e)}")
        return ""
    
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
    