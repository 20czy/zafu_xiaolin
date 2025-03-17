from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Course
from .serializers import CourseSerializer
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.response import Response
from .models import Club
from .serializers import ClubSerializer
from rest_framework.decorators import action
from rest_framework.decorators import api_view
from chatbot.LLMService import LLMService

@api_view(['POST'])
def academic_chat(request):
    """处理学术相关的AI对话请求"""
    try:
        # 获取用户输入
        user_input = request.data.get('message')
        if not user_input:
            return Response({
                'error': '请提供消息内容',
                'required_params': ['message']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 获取LLM实例
        llm = LLMService.get_llm(model_name='chatglm')
        
        # 生成响应
        response = llm.predict(user_input)
        
        return Response({
            'status': 'success',
            'data': {
                'response': response
            }
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@api_view(['GET'])
def linan_weather(request):
    """返回临安市的模拟天气预报数据"""
    weather_data = {
        'city': '临安市',
        'date': '2024-01-21',
        'weather': '多云',
        'temperature': {
           'min': 6,
           'max': 14
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-22',
        'weather': '阴天',
        'temperature': {
           'min': 5,
           'max': 13
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-23',
        'weather': '小雨转多云',
        'temperature': {
           'min': 7,
           'max': 15
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-24',
        'weather': '晴',
        'temperature': {
           'min': 8,
           'max': 17
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-25',
        'weather': '多云',
        'temperature': {
           'min': 9,
           'max': 16
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-26',
        'weather': '阴天',
        'temperature': {
           'min': 7,
           'max': 14
        }
    },
    {
        'city': '临安市',
        'date': '2024-01-27',
        'weather': '小雨',
        'temperature': {
           'min': 6,
           'max': 12
    }
    }
    
    return Response({
        'status': 'success',
        'data': weather_data
    })

class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all()
    serializer_class = ClubSerializer

    @action(detail=False, methods=['get'])
    def basic_info(self, request):
        clubs = Club.objects.values('club_name', 'description')
        return Response({
            'status': 'success',
            'data': list(clubs)
        })
    
@api_view(['GET'])
def campus_events(request):
    """返回模拟的校园活动安排数据"""
    events_data = {
        'events': [
            {
                'title': '2024春季校园招聘会',
                'date': '2024-02-01',
                'time': '14:00-17:00',
                'location': '图书馆报告厅',
                'organizer': '就业指导中心',
                'description': '邀请50家企业参加的大型招聘会'
            },
            {
                'title': '元宵节文化晚会',
                'date': '2024-02-15',
                'time': '19:00-21:00',
                'location': '大学生活动中心',
                'organizer': '学生会',
                'description': '传统文化展示与互动游戏'
            },
        ]
    }
    
    return Response({
        'status': 'success',
        'data': events_data
    })

class CourseSchedulerView(APIView):
    def get(self, request):
        # 获取查询参数（可选）
        major = request.query_params.get('major')
        semester = request.query_params.get('semester')
        course_id = request.query_params.get('course_id')
        instructor = request.query_params.get('instructor')
        day_of_week = request.query_params.get('day_of_week')
        
        # 初始化查询条件
        query = Q()
        
        # 添加可选查询条件
        if major:
            query &= Q(major=major)
        if semester:
            query &= Q(semester=semester)
        if course_id:
            query &= Q(course_id=course_id)
        if instructor:
            query &= Q(instructor=instructor)
        if day_of_week:
            query &= Q(day_of_week=day_of_week)
            
        # 查询所有课程
        courses = Course.objects.filter(query)
        serializer = CourseSerializer(courses, many=True)
        
        # 构建返回数据
        response_data = {
            'status': 'success',
            'data': {
                'courses': serializer.data
            }
        }
        
        return Response(response_data)
