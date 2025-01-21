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
        
        document = PDFDocument.objects.create(
            title=pdf_file.name,
            file=pdf_file
        )
        
        return Response({
            'status': 'success',
            'data': {
                'id': document.id,
                'title': document.title,
                'url': request.build_absolute_uri(document.file.url)
            }
        }, status=status.HTTP_201_CREATED)
    except ValidationError as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f'服务器错误: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)