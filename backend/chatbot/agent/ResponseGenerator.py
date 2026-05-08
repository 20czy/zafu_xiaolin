import json
import logging
from typing import Dict, Any
from ..LLMService import LLMService
from ..logger_config import setup_logger

logger = setup_logger(__name__)

class ResponseGenerator:
    """
    生成最终用户响应的类
    """

    @classmethod
    def _create_response_prompt(cls, process_info: Dict[str, Any]) -> str:
        """
        根据用户的请求生成的过程信息（包括任务规划、工具选择和任务执行的信息）
        组合到prompt模板中生成最终的prompt
        
        Args: 
            process_info: 处理过程信息

        Returns:
            生成最终回复的prompt
        """

        # 构建用于流式输出的提示
        prompt = f"""你是浙江农林大学智能校园助手「农林小林」。你的回答要自然、亲切、简洁，像一位靠谱的校园服务同学在和用户聊天。

回答风格：
1. 先直接回应用户的问题，不要绕到“我准备如何处理”。
2. 简单寒暄、问候、闲聊时，用1-2句轻松回应即可，不要自我介绍过长。
3. 涉及校园事务时保持准确、清楚、友好；信息不足时自然说明，并给出可行建议。
4. 可以少量使用emoji，但不要连续堆叠，不要显得刻意卖萌。
5. 除非用户明确要求，否则不要暴露任务规划、工具选择、工具名称、服务器状态、调用失败、内部错误等处理过程。
6. 如果工具结果为空、失败或不可用，请基于已有信息给出自然回复；无法确定时说“我这边暂时没有查到准确信息”，不要提“工具/服务器/MCP/任务失败”。
7. 不要重复用户原话来凑字数，不要说“刚才我收到了你的问候”这类流程化表达。

以下过程信息只供你理解上下文，不要原样展示给用户：
**过程信息：**
用户输入: {process_info['user_input']}

任务规划:
{json.dumps(process_info['task_planning'], ensure_ascii=False, indent=2)}

工具选择:
{json.dumps(process_info['tool_selection'], ensure_ascii=False, indent=2)}

任务执行:
{json.dumps(process_info['task_execution'], ensure_ascii=False, indent=2)}

请基于以上信息生成最终回复。
"""
        return prompt
    
    @classmethod
    def create_streaming_response(cls, message: str, process_info: Dict[str, Any], chat_history=None):
        """
        生成流式响应
        Args:
            message: 用户输入的消息
            process_info: 包含处理过程信息的字典
            chat_history: Previous conversation history
        Returns:
            生成器，用于流式输出响应
        """
        try:
        # Create LLM with streaming enabled
            llm = LLMService.get_llm(model_name='deepseek-chat', stream=True)

            prompt = cls._create_response_prompt(process_info)

            # 构建聊天上下文
            messages = [{"role": "system", "content": prompt}]
            
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": message})

            logger.info(f"sending messages: {messages}")
            logger.info("-"*30)

            # 使用流式方式生成回复
            for chunk in llm.stream(messages):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Error during reply: {str(e)}")
            yield "抱歉，生成回复时出现错误。"

    @classmethod
    def create_response(cls, message: str) -> str:
        """
        生成一个标准的非流式的响应
        
        Args:
            process_info: 包含处理过程信息的字典
            
        Returns:
            格式化的用户响应
        """
        logger.info("开始生成最终响应")
        
        try:

            logger.debug("已生成响应提示词")
            
            # 使用LLM生成最终响应
            logger.info("初始化响应生成 LLM 模型")
            llm = LLMService.get_llm(model_name='deepseek-chat', temperature=0.7)
            prompt = cls._create_response_prompt(message)
            
            logger.info("向 LLM 发送响应生成请求")
            response = llm.invoke([{"role": "system", "content": prompt}])
            logger.debug("已收到 LLM 响应")
            
            return response.content
            
        except Exception as e:
            logger.error(f"生成响应过程出错: {str(e)}", exc_info=True)
            return "抱歉，在处理您的请求时出现了问题。请稍后再试。"
