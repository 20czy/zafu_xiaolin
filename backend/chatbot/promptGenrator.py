import os
from pathlib import Path
from typing import Dict
from .documentSearch import search_document, search_all_documents

class PromptGenerator:
    def __init__(self):
        self.template_dir = Path(os.getenv("TEMPLATE_DIR"))
        self.default_template = os.getenv("DEFAULT_TEMPLATE")
        
    def load_template(self, template_name: str = None) -> str:
        """加载模板文件"""
        template_name = template_name or self.default_template
        template_path = self.template_dir / template_name
        
        if not template_path.exists():
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
        
        try:
            return template.format(**slot_data)
        except KeyError as e:
            raise ValueError(f"Missing required slot data: {e}")

    def generate_prompt_with_search(
        self,
        query: str,
        slot_data: Dict[str, str],
        document_id: int = None,
        top_k: int = 3,
        template_name: str = None
    ) -> str:
        """
        生成包含文档搜索结果的提示
        
        Args:
            query: 用户查询
            slot_data: 基础插槽数据
            document_id: 指定文档ID，如果为None则搜索所有文档
            top_k: 返回的相关文档数量
            template_name: 模板名称
        """
        
        try:
            # 执行文档搜索
            if document_id is not None:
                search_results = search_document(document_id, query, top_k)
            else:
                search_results = search_all_documents(query, top_k)
            
            # 格式化搜索结果
            formatted_docs = []
            for result in search_results:
                doc_text = f"文档：{result.get('document_title', '未知文档')}\n"
                doc_text += f"内容：{result['content']}\n"
                formatted_docs.append(doc_text)
            
            # 将搜索结果添加到插槽数据中
            slot_data['documents'] = '\n'.join(formatted_docs)
            
            # 生成最终提示
            return self.generate_prompt(slot_data, template_name)
            
        except Exception as e:
            raise Exception(f"生成带搜索结果的提示时发生错误: {str(e)}")

