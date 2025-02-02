from django.contrib import admin
from .models import PDFDocument, ChatSession, ChatMessage

admin.site.register(PDFDocument)
admin.site.register(ChatSession)
admin.site.register(ChatMessage)

