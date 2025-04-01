from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('chat/sessions/', views.chat_sessions, name='chat_sessions'),
    path('chat/sessions/<int:session_id>/messages/', views.session_messages, name='session_messages'),
    path('chat/sessions/<int:session_id>/process_info/', views.get_process_info_view, name='get_session_process_info'),
    # path('chat/sessions/<int:session_id>/delete/', views.delete_session, name='delete_session'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)