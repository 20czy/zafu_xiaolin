import json
import logging
from typing import Dict, Any, AsyncGenerator
from ..services.llm_service import LLMService

logger = logging.getLogger(__name__)

# Custom JSON encoder to handle CallToolResult and other non-serializable types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, 'model_dump'):
            # Handle pydantic models
            return obj.model_dump()
        elif hasattr(obj, '__dict__'):
            # Handle custom classes with __dict__
            return obj.__dict__
        # Let the base class handle the rest or raise TypeError
        return super().default(obj)

class ResponseGenerator:
    """
    生成最终用户响应的类 - FastAPI 异步版本
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
        prompt = f"""你是浙江农林大学智能校园助手「农林小林」，请用活泼可爱的语气回答用户的请求并且以第一人称解释我处理请求的过程，包括我计划的任务、使用的工具和每个任务的结果。如果有任务失败或被跳过，也请说明。以下是任务处理的过程信息：
**过程信息：**
用户输入: {process_info['user_input']}

任务规划:
{json.dumps(process_info['task_planning'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

工具选择:
{json.dumps(process_info['tool_selection'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

任务执行:
{json.dumps(process_info['task_execution'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

在回答过程中可以适当的使用emoji活跃一下气氛，如果遇到工具调用失败则尝试用自己的能力去解答，如果实在缺乏足够的信息回答用户的问题请向用户说明
"""
        return prompt
    
    @classmethod
    async def create_streaming_response(cls, message: str, process_info: Dict[str, Any], chat_history=None) -> AsyncGenerator[str, None]:
        """
        生成流式响应 - 异步版本
        
        Args:
            message: 用户输入的消息
            process_info: 包含处理过程信息的字典
            chat_history: Previous conversation history
            
        Yields:
            生成器，用于流式输出响应
        """
        try:
            # Create LLM with streaming enabled
            llm = await LLMService.get_llm(model_name='deepseek-chat', stream=True)

            prompt = cls._create_response_prompt(process_info)

            # 构建聊天上下文
            messages = [{"role": "system", "content": prompt}]
            
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": message})

            logger.info(f"sending messages: {messages}")
            logger.info("-"*30)

            # 使用流式方式生成回复
            async for chunk in llm.astream(messages):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Error during reply: {str(e)}")
            yield "抱歉，生成回复时出现错误。"

    @classmethod
    async def create_response(cls, message: str, process_info: Dict[str, Any], chat_history=None) -> str:
        """
        生成一个标准的非流式的响应 - 异步版本
        
        Args:
            message: 用户输入的消息
            process_info: 包含处理过程信息的字典
            chat_history: Previous conversation history
            
        Returns:
            格式化的用户响应
        """
        logger.info("开始生成最终响应")
        
        try:
            logger.debug("已生成响应提示词")
            
            # 使用LLM生成最终响应
            logger.info("初始化响应生成 LLM 模型")
            llm = await LLMService.get_llm(model_name='deepseek-chat', temperature=0.7)
            
            prompt = cls._create_response_prompt(process_info)
            
            # 构建聊天上下文
            messages = [{"role": "system", "content": prompt}]
            
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": message})
            
            logger.info("向 LLM 发送响应生成请求")
            response = await llm.ainvoke(messages)
            logger.debug("已收到 LLM 响应")
            
            return response.content
            
        except Exception as e:
            logger.error(f"生成响应过程出错: {str(e)}", exc_info=True)
            return "抱歉，在处理您的请求时出现了问题。请稍后再试。"
