from django.db import models

class PDFDocument(models.Model):
    """PDF文档模型"""
    title = models.CharField(max_length=255, verbose_name='文档标题')
    file = models.FileField(upload_to='pdfs/', verbose_name='PDF文件')
    vector_index_path = models.CharField(
        max_length=255, 
        null=True, 
        blank=True, 
        verbose_name='向量索引路径'
    )
    is_processed = models.BooleanField(
        default=False, 
        verbose_name='是否已向量化处理'
    )
    page_count = models.IntegerField(
        default=0, 
        verbose_name='页面数量'
    )
    chunk_count = models.IntegerField(
        default=0, 
        verbose_name='文档块数量'
    )
    created_at = models.DateTimeField(
        auto_now_add=True, 
        verbose_name='创建时间'
    )
    updated_at = models.DateTimeField(
        auto_now=True, 
        verbose_name='更新时间'
    )

    class Meta:
        verbose_name = 'PDF文档'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']  # 按创建时间倒序排列

    def __str__(self):
        return f"{self.title} ({'已处理' if self.is_processed else '未处理'})"