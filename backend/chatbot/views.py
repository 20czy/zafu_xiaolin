from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .connectLLM import create_llm
from .models import PDFDocument

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from .documentProcess import process_pdf_document
from .documentEmbedding import add_documents_to_faiss
import os
import logging
from django.conf import settings

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
        
        # 验证消息不为空
        if not message:
            return Response({
                'status': 'error',
                'message': '消息内容不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 调用LLM获取响应
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
                'chunks_count': len(docs),
                'vector_store': index_path
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"上传处理失败: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'服务器错误: {str(e)}',
            'detail': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)