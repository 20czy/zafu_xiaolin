import os
from pathlib import Path
from typing import Dict
from .PDFdocument.documentSearch import search_document, search_all_documents
import logging

logger = logging.getLogger(__name__)


class PromptGenerator:
    def __init__(self):
        self.template_dir = Path(os.getenv("TEMPLATE_DIR"))
        self.default_template = os.getenv("DEFAULT_TEMPLATE")
        
    def load_template(self, template_name) -> str:
        """加载模板文件"""
        template_name = template_name or self.default_template
        template_path = self.template_dir / template_name

        logger.info(f"尝试加载模板文件: {template_name} from {template_path}")
        
        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template {template_name} not found")
            
        with open(template_path, 'r') as f:
            return f.read()

    def generate_prompt(
        self, 
        slot_data: Dict[str, str], 
        template_name: str = None
    ) -> str:
        """生成最终提示"""
        template = self.load_template(template_name)

        if not slot_data:
            return template
        
        try:
            # 使用字典解包（**）将 slot_data 字典中的键值对展开，
            # 并将其作为参数传递给 template.format 方法，
            # 该方法会将模板中的占位符({})替换为 slot_data 中对应的值，
            # 最后返回填充好数据的最终提示字符串
            return template.format(**slot_data)
        except KeyError as e:
            raise ValueError(f"Missing required slot data: {e}")

    
