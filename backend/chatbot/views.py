from django.views.decorators.csrf import csrf_exempt
import json
from .connectLLM import create_llm
from .models import PDFDocument

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

# 配置日志
logger = logging.getLogger(__name__)

@api_view(['POST'])
@csrf_exempt
def chat(request):
    try:
        # 创建LLM实例
        llm = create_llm()
        
        # 获取请求体中的数据
        data = json.loads(request.body)
        message = data.get('message')
        logger.info("="*50)
        logger.info("新的聊天请求")
        logger.info(f"用户输入: {message}")
        logger.info("-"*30)
        
        # 验证消息不为空
        if not message:
            return Response({
                'status': 'error',
                'message': '消息内容不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # 创建PromptGenerator实例
            prompt_generator = PromptGenerator()
            
            # 准备基础插槽数据
            slot_data = {
                "topic": "招标审核",
                "query": message,
                "language": "中文"
            }
            
            # 生成包含文档搜索结果的提示（仅用于测试）
            prompt = prompt_generator.generate_prompt_with_search(
                query=message,
                slot_data=slot_data,
                top_k=3
            )
            
            # 仅打印生成的prompt用于测试
            logger.info("[测试] 文档检索和Prompt生成结果:")
            logger.info("-"*30)
            logger.info(f"生成的完整prompt:\n{prompt}")
            logger.info("-"*30)
            
            # 使用普通对话模式
            response = llm.invoke(message)
            logger.info(f"LLM响应:\n{response.content}")
            logger.info("="*50)
                
        except Exception as e:
            logger.warning("-"*30)
            logger.warning(f"文档检索或提示生成失败: {str(e)}")
            logger.warning("切换到普通对话模式")
            logger.warning("-"*30)
            response = llm.invoke(message)
            
        return Response({
            'status': 'success',
            'data': {
                'content': response.content
            }
        }, status=status.HTTP_200_OK)
    
    except json.JSONDecodeError:
        return Response({
            'status': 'error',
            'message': '无效的JSON格式'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f'服务器错误: {str(e)}'
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