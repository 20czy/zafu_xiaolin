from django.urls import path, include
from .views import CourseSchedulerView, ClubViewSet, academic_chat, linan_weather, campus_events
from rest_framework.routers import DefaultRouter

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'clubs', ClubViewSet, basename='club')

urlpatterns = [
    path('', include(router.urls)),
    path('academic/courses', CourseSchedulerView.as_view(), name='course_scheduler'),
    path('academic/info', academic_chat, name='academic_chat'),
    path('academic/weather', linan_weather, name='linan_weather'),
    path('academic/events', campus_events, name='campus_events'),
]