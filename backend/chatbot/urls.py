from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('chat/sessions/', views.chat_sessions, name='chat_sessions'),
    path('chat/sessions/<str:session_id>/messages/', views.session_messages, name='session_messages'),
    path('chat/sessions/<str:session_id>/process_info/', views.get_process_info_view, name='get_session_process_info'),
    # 根据session_id获取聊天历史记录
    path('chat/sessions/<str:session_id>/history/', views.get_chat_history, name='get_chat_history'),
    path('chat/sessions/<str:session_id>/history/update/', views.update_chat_history, name='update_chat_history'),
    path('chat/sessions/<str:session_id>/history/clear/', views.clear_chat_history, name='clear_chat_history'),
    # ProcessInfo相关端点
    path('process_info/create/', views.create_process_info, name='create_process_info'),
    path('process_info/<int:process_info_id>/update/', views.update_process_info, name='update_process_info'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)