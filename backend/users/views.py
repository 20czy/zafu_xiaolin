from django.contrib.auth import authenticate, login
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User

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
            return Response({
                'status': 'success',
                'data': {
                    'username': user.username,
                    'id': user.id
                }
            })
        else:
            return Response({
                'status': 'error',
                'message': '用户名或密码错误'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
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
            # 可以在这里设置其他字段，比如：
            # user.email = request.data.get('email')
            # user.phone = request.data.get('phone')
            user.save()
            
            # 自动登录新用户
            login(request, user)
            
            return Response({
                'status': 'success',
                'data': {
                    'username': user.username,
                    'id': user.id
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': '注册失败'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
