from django.contrib import admin
from .models import ChatSession, ChatMessage

admin.site.register(ChatSession)
admin.site.register(ChatMessage)

