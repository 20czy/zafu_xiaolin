from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):
    # 继承默认字段：username, password, email, first_name, last_name
    
    # 添加自定义字段
    phone = models.CharField(max_length=15, blank=True, null=True, verbose_name='手机号码')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='头像')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    last_login_ip = models.GenericIPAddressField(blank=True, null=True, verbose_name='最后登录IP')

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'
        
    def __str__(self):
        return f"{self.username} {'(管理员)' if self.is_staff else ''}"
