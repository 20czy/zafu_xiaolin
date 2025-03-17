from django.contrib.auth import authenticate, login, logout
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User
from django.middleware.csrf import get_token
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UserPreferencesSerializer

class LoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'status': 'error',
                'message': '用户名和密码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        
        if user is not None:
            login(request, user)
            response = Response({
                'status': 'success',
                'data': {
                    'username': user.username,
                    'id': user.id
                }
            })
            # 设置会话过期时间（可选）
            request.session.set_expiry(7 * 24 * 60 * 60)  # 7天
            return response
        else:
            return Response({
                'status': 'error',
                'message': '用户名或密码错误'
            }, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        response = Response({
            'status': 'success',
            'message': '已成功推出登录'
        })
        return response

class RegisterView(APIView):  
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        # 验证输入
        if not username or not password:
            return Response({
                'status': 'error',
                'message': '用户名和密码不能为空'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 检查用户名是否已存在
        if User.objects.filter(username=username).exists():
            return Response({
                'status': 'error',
                'message': '用户名已存在'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 创建新用户
        try:
            user = User.objects.create_user(username=username, password=password)
            user.save()
            
            # 自动登录新用户
            login(request, user)
            
            response = Response({
                'status': 'success',
                'data': {
                    'username': user.username,
                    'id': user.id
                }
            }, status=status.HTTP_201_CREATED)
            
            # 设置会话过期时间（可选）
            request.session.set_expiry(7 * 24 * 60 * 60)  # 7天
            return response
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': '注册失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@api_view(['GET'])
def get_user_preferences(request):
    root_user = User.objects.get(username='root')  # 获取 root 用户
    serializer = UserPreferencesSerializer(root_user)
    return Response(serializer.data)
