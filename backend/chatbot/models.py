from django.db import models
from django.conf import settings
import uuid

class ChatSession(models.Model):
    """聊天会话模型"""
    # 将id定义为字符串类型，与数据库中的类型匹配
    id = models.CharField(max_length=36, primary_key=True)
    title = models.CharField(max_length=200, default="新对话")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_sessions',
        verbose_name='用户'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # 如果id为空，生成一个新的UUID作为id
        if not self.id:
            self.id = str(uuid.uuid4())
        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['-updated_at']
        db_table = 'chat_sessions'  # 指定实际的数据库表名

class ChatMessage(models.Model):
    """聊天消息模型"""
    # 修改session字段，确保它能正确引用ChatSession模型的字符串类型主键
    session = models.ForeignKey(
        ChatSession, 
        on_delete=models.CASCADE, 
        related_name='messages',
        to_field='id'
    )
    content = models.TextField()
    is_user = models.BooleanField(default=True)  # True表示用户消息，False表示AI响应
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        db_table = 'chat_messages'  # 指定实际的数据库表名
    
class ProcessInfo(models.Model):
    """处理过程信息模型"""
    message = models.OneToOneField(ChatMessage, on_delete=models.CASCADE, related_name='process_info')
    steps = models.JSONField(default=list)
    task_plan = models.JSONField(null=True, blank=True)
    tool_selections = models.JSONField(null=True, blank=True)
    task_results = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'process_infos'  # 指定实际的数据库表名