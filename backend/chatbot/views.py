from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .connectLLM import create_llm

@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    try:
        # 创建LLM实例
        llm = create_llm()
        
        # 获取请求体中的数据
        data = json.loads(request.body)
        message = data.get('message', '你好，请介绍一下你自己。')
        
        # 调用LLM获取响应
        response = llm.invoke(message)
        
        # 只返回content内容
        return JsonResponse({
            'status': 'success',
            'content': response.content
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
