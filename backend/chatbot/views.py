from django.views.decorators.csrf import csrf_exempt
import json
from .connectLLM import create_llm
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
from .promptGenrator import PromptGenerator
from django.http import StreamingHttpResponse
from .connectLLM import create_llm, create_streaming_response

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
        
        # 记录请求信息
        logger.info("="*50)
        logger.info("新的聊天请求")
        logger.info(f"用户输入: {message}")
        logger.info(f"会话ID: {session_id}")
        logger.info("-"*30)
        
        try:
            chat_session = ChatSession.objects.get(id=session_id)
        except ChatSession.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)
            
        # 保存用户消息
        chat_session.messages.create(
            content=message,
            is_user=True
        )
        
        try:
            # 创建LLM实例
            llm = create_llm(model_name='chatglm', stream=True)
            
            # 创建流式响应生成器
            def response_generator():
                full_response = ""
                try:
                    for chunk in create_streaming_response(llm, message):
                        if chunk:  # 确保chunk不为空
                            full_response += chunk
                            # logger.info(f"流式响应: {chunk}")
                            yield f"data: {json.dumps({'content': chunk})}\n\n"
                finally:
                    if full_response:  # 只在有响应时保存
                        # 保存完整的响应消息
                        chat_session.messages.create(
                            content=full_response,
                            is_user=False
                        )
                        
                        # 更新会话标题（如果是第一条消息）
                        if chat_session.messages.count() <= 2:
                            chat_session.title = message[:50] + ('...' if len(message) > 50 else '')
                            chat_session.save()

            # 返回 SSE 流式响应
            response = StreamingHttpResponse(
                response_generator(),
                content_type='text/event-stream'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response
                
        except Exception as e:
            logger.warning("-"*30)
            logger.warning(f"流式响应失败，切换到普通对话模式: {str(e)}")
            logger.warning("-"*30)
            
            try:
                response = llm.invoke(message)
                response_content = getattr(response, 'content', str(response))
                
                # 保存响应消息
                chat_session.messages.create(
                    content=response_content,
                    is_user=False
                )
                
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
    
    except json.JSONDecodeError:
        return Response({
            'status': 'error',
            'message': '无效的JSON格式'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"未预期的错误: {str(e)}")
        return Response({
            'status': 'error',
            'message': '服务器内部错误'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# 上传pdf文件
@api_view(['POST'])
def upload_pdf(request):
    try:
        if 'file' not in request.FILES:
            return Response({
                'status': 'error',
                'message': '没有文件被上传'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        pdf_file = request.FILES['file']
        if not pdf_file.name.endswith('.pdf'):
            return Response({
                'status': 'error',
                'message': '只能上传PDF文件'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 保存PDF文档
        document = PDFDocument.objects.create(
            title=pdf_file.name,
            file=pdf_file
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
    