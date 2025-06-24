from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from enum import Enum
import uuid

Base = declarative_base()

# 块类型枚举
class BlockType(str, Enum):
    TABLE = "table"           # 表格数据
    FORM = "form"            # 表单
    IMAGE = "image"          # 图片
    CODE = "code"            # 代码块
    TEXT = "text"            # 文本内容
    CHART = "chart"          # 图表
    FILE = "file"            # 文件
    MARKDOWN = "markdown"     # Markdown内容

# 表单状态枚举
class FormStatus(str, Enum):
    PENDING = "pending"       # 等待填写
    SUBMITTED = "submitted"   # 已提交
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成

# 工作台会话表
class WorkbenchSession(Base):
    __tablename__ = "workbench_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False, comment="会话标题")
    user_id = Column(String(100), nullable=False, comment="用户ID")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    is_active = Column(Boolean, default=True, comment="是否激活")
    metadata = Column(JSON, comment="会话元数据")
    
    # 关联关系 一个会话有多个块 使用session进行双向绑定 当前对象删除会删除所有对应的blocks
    blocks = relationship("WorkbenchBlock", back_populates="session", cascade="all, delete-orphan")

# 工作台块表
class WorkbenchBlock(Base):
    __tablename__ = "workbench_blocks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("workbench_sessions.id"), nullable=False)
    block_type = Column(SQLEnum(BlockType), nullable=False, comment="块类型")
    title = Column(String(255), comment="块标题")
    description = Column(Text, comment="块描述")
    order_index = Column(Integer, default=0, comment="排序索引")
    
    # 工具执行相关信息
    tool_name = Column(String(100), comment="工具名称")
    tool_execution_id = Column(String(255), comment="工具执行ID")
    execution_status = Column(String(50), default="completed", comment="执行状态")
    
    # 块内容和配置
    content = Column(JSON, comment="块内容数据")
    display_config = Column(JSON, comment="显示配置")
    interaction_config = Column(JSON, comment="交互配置")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    session = relationship("WorkbenchSession", back_populates="blocks")
    form_submissions = relationship("FormSubmission", back_populates="block", cascade="all, delete-orphan")

# 表单提交表
class FormSubmission(Base):
    __tablename__ = "form_submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    block_id = Column(UUID(as_uuid=True), ForeignKey("workbench_blocks.id"), nullable=False)
    user_id = Column(String(100), nullable=False, comment="提交用户ID")
    
    # 表单数据
    form_data = Column(JSON, nullable=False, comment="表单提交数据")
    status = Column(SQLEnum(FormStatus), default=FormStatus.SUBMITTED, comment="提交状态")
    
    # AI处理相关
    ai_processed = Column(Boolean, default=False, comment="是否已被AI处理")
    ai_response = Column(JSON, comment="AI响应数据")
    processing_notes = Column(Text, comment="处理备注")
    
    # 时间戳
    submitted_at = Column(DateTime, default=datetime.utcnow, comment="提交时间")
    processed_at = Column(DateTime, comment="处理时间")
    
    # 关联关系
    block = relationship("WorkbenchBlock", back_populates="form_submissions")

# 文件存储表
class FileStorage(Base):
    __tablename__ = "file_storage"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False, comment="文件名")
    original_filename = Column(String(255), nullable=False, comment="原始文件名")
    file_path = Column(String(500), nullable=False, comment="文件路径")
    file_size = Column(Integer, comment="文件大小(字节)")
    mime_type = Column(String(100), comment="MIME类型")
    file_hash = Column(String(64), comment="文件哈希值")
    
    # 关联信息
    block_id = Column(UUID(as_uuid=True), ForeignKey("workbench_blocks.id"), nullable=True)
    user_id = Column(String(100), nullable=False, comment="上传用户ID")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 文件元数据
    metadata = Column(JSON, comment="文件元数据")

# 块模板表（预定义的块模板）
class BlockTemplate(Base):
    __tablename__ = "block_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, comment="模板名称")
    block_type = Column(SQLEnum(BlockType), nullable=False, comment="块类型")
    description = Column(Text, comment="模板描述")
    
    # 模板配置
    template_config = Column(JSON, nullable=False, comment="模板配置")
    default_content = Column(JSON, comment="默认内容")
    schema_definition = Column(JSON, comment="数据结构定义")
    
    # 分类和标签
    category = Column(String(50), comment="模板分类")
    tags = Column(JSON, comment="标签列表")
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否激活")
    is_system = Column(Boolean, default=False, comment="是否为系统模板")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 数据表结构示例JSON
BLOCK_CONTENT_EXAMPLES = {
    "table": {
        "columns": [
            {"key": "name", "title": "姓名", "type": "string"},
            {"key": "age", "title": "年龄", "type": "number"},
            {"key": "email", "title": "邮箱", "type": "string"}
        ],
        "data": [
            {"name": "张三", "age": 25, "email": "zhangsan@example.com"},
            {"name": "李四", "age": 30, "email": "lisi@example.com"}
        ],
        "pagination": {"page": 1, "size": 10, "total": 2}
    },
    
    "form": {
        "fields": [
            {
                "name": "username",
                "label": "用户名",
                "type": "text",
                "required": True,
                "placeholder": "请输入用户名"
            },
            {
                "name": "email",
                "label": "邮箱",
                "type": "email",
                "required": True,
                "validation": {"pattern": "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$"}
            },
            {
                "name": "category",
                "label": "分类",
                "type": "select",
                "options": [
                    {"value": "tech", "label": "技术"},
                    {"value": "business", "label": "商务"}
                ]
            }
        ],
        "submit_config": {
            "button_text": "提交",
            "success_message": "提交成功",
            "api_endpoint": "/api/form/submit"
        }
    },
    
    "code": {
        "language": "python",
        "code": "def hello_world():\n    print('Hello, World!')",
        "executable": True,
        "theme": "dark"
    },
    
    "image": {
        "url": "/uploads/images/example.jpg",
        "alt": "示例图片",
        "caption": "这是一个示例图片",
        "size": {"width": 800, "height": 600}
    },
    
    "chart": {
        "type": "line",
        "data": {
            "labels": ["1月", "2月", "3月", "4月"],
            "datasets": [{
                "label": "销售额",
                "data": [120, 150, 180, 200],
                "borderColor": "rgb(75, 192, 192)"
            }]
        },
        "options": {
            "responsive": True,
            "scales": {
                "y": {"beginAtZero": True}
            }
        }
    }
}

# 显示配置示例
DISPLAY_CONFIG_EXAMPLES = {
    "table": {
        "striped": True,
        "bordered": True,
        "hover": True,
        "sortable": True,
        "filterable": True,
        "exportable": True
    },
    
    "form": {
        "layout": "vertical",  # vertical, horizontal, inline
        "show_labels": True,
        "show_required_asterisk": True,
        "submit_button_position": "right"
    },
    
    "code": {
        "show_line_numbers": True,
        "theme": "dark",
        "font_size": 14,
        "word_wrap": True
    }
}

# 交互配置示例
INTERACTION_CONFIG_EXAMPLES = {
    "form": {
        "auto_save": True,
        "validation_on_blur": True,
        "submit_confirmation": True,
        "reset_after_submit": False
    },
    
    "table": {
        "selectable": True,
        "editable": False,
        "actions": ["export", "filter", "sort"]
    },
    
    "code": {
        "editable": True,
        "executable": True,
        "copy_button": True
    }
}