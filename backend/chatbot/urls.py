from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('upload_pdf/', views.upload_pdf, name='upload_pdf'),
    path('chat/sessions/', views.chat_sessions, name='chat_sessions'),
    path('chat/sessions/<int:session_id>/messages/', views.session_messages, name='session_messages'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)