from typing import List, Dict

class PromptTemplate:
    """提示词模板类"""
    
    @staticmethod
    def get_base_template(template_type: str) -> str:
        """
        获取基础模板
        
        Args:
            template_type: 模板类型，如 'qa', 'summary', 'analysis' 等
            
        Returns:
            str: 基础模板字符串
        """
        templates = {
            'qa': """请你作为一个专业的助手，基于以下参考文档内容回答用户的问题。
如果无法从参考文档中找到相关信息，请明确告知。
请保持专业、简洁和客观。

参考文档内容:
{context}

用户问题: {question}

请基于上述参考文档回答用户问题：""",

            'summary': """请你作为一个专业的助手，对以下文档内容进行总结。
请确保总结简洁、准确，并突出重点信息。

文档内容:
{context}

请提供总结：""",

            'analysis': """请你作为一个专业的助手，对以下文档内容进行深入分析。
请从内容的重要性、关联性和可能的影响等方面进行分析。

文档内容:
{context}

请提供分析："""
        }
        
        return templates.get(template_type, templates['qa'])  # 默认返回qa模板
    
    @staticmethod
    def format_context(search_results: List[Dict]) -> str:
        """
        格式化检索结果为上下文字符串
        
        Args:
            search_results: 从文档检索得到的结果列表
            
        Returns:
            str: 格式化后的上下文字符串
        """
        context_parts = []
        for i, result in enumerate(search_results, 1):
            content = result.get('content', '').strip()
            if content:
                context_parts.append(f"[段落 {i}]\n{content}")
        
        return "\n\n".join(context_parts)
    
    @staticmethod
    def generate_prompt(template_type: str, search_results: List[Dict], question: str = None) -> str:
        """
        生成完整的提示词
        
        Args:
            template_type: 模板类型
            search_results: 检索结果列表
            question: 用户问题（对于qa类型必需）
            
        Returns:
            str: 完整的提示词
        """
        # 获取基础模板
        base_template = PromptTemplate.get_base_template(template_type)
        
        # 格式化上下文
        context = PromptTemplate.format_context(search_results)
        
        # 根据模板类型填充内容
        if template_type == 'qa':
            if question is None:
                raise ValueError("qa模板类型需要提供question参数")
            prompt = base_template.replace('{context}', context)
            prompt = prompt.replace('{question}', question)
            return prompt
        else:
            return base_template.replace('{context}', context)

# 使用示例
def create_chat_prompt(search_results: List[Dict], question: str) -> str:
    """
    创建聊天提示词的便捷函数
    
    Args:
        search_results: 检索结果列表
        question: 用户问题
        
    Returns:
        str: 格式化后的提示词
    """
    return PromptTemplate.generate_prompt('qa', search_results, question)

def create_summary_prompt(search_results: List[Dict]) -> str:
    """
    创建总结提示词的便捷函数
    
    Args:
        search_results: 检索结果列表
        
    Returns:
        str: 格式化后的提示词
    """
    return PromptTemplate.generate_prompt('summary', search_results) 