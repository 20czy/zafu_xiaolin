import json
import logging
from typing import Dict, Any, AsyncGenerator
from ..services.llm_service import LLMService
from ..services.student_profile_service import format_student_profile_for_prompt

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
    """生成最终用户响应的类 - FastAPI 异步版本"""

    @classmethod
    def _student_profile_prompt(cls) -> str:
        return format_student_profile_for_prompt()

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

以下是当前用户的学生画像，只供你理解用户背景和提供个性化校园服务，不要主动完整展示：
{cls._student_profile_prompt()}

以下过程信息只供你理解上下文，不要原样展示给用户：
**过程信息：**
用户输入: {process_info['user_input']}

任务规划:
{json.dumps(process_info['task_planning'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

工具选择:
{json.dumps(process_info['tool_selection'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

任务执行:
{json.dumps(process_info['task_execution'], ensure_ascii=False, indent=2, cls=CustomJSONEncoder)}

请基于以上信息生成最终回复。
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
    async def create_simple_streaming_response(cls, message: str, chat_history=None) -> AsyncGenerator[str, None]:
        """
        生成简单流式响应（不需要process_info）- 异步版本
        
        Args:
            message: 用户输入的消息
            chat_history: 聊天历史
            
        Yields:
            生成器，用于流式输出响应
        """
        try:
            # Create LLM with streaming enabled
            llm = await LLMService.get_llm(model_name='deepseek-chat', stream=True)

            # 简单的系统提示词，不包含复杂的处理过程信息
            system_prompt = f"""你是浙江农林大学智能校园助手「农林小林」。请用自然、亲切、简洁的方式回答用户。
简单问候用1-2句回应即可；校园事务要清楚可靠；不确定时请诚实说明并给出可行建议。可以少量使用emoji，但不要过度卖萌，不要暴露内部处理过程。

以下是当前用户的学生画像，只供你理解用户背景和提供个性化校园服务，不要主动完整展示：
{cls._student_profile_prompt()}"""

            # 构建聊天上下文
            messages = [{"role": "system", "content": system_prompt}]
            
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": message})

            logger.info(f"sending simple messages: {messages}")
            logger.info("-"*30)

            # 使用流式方式生成回复
            async for chunk in llm.astream(messages):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Error during simple reply: {str(e)}")
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
