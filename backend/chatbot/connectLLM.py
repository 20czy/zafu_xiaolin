import os
from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from dotenv import load_dotenv
import logging
from . import promptGenerator as pg
from .LLMController import LLMcontroller, get_process_info
from .LLMService import LLMService
import json

logger = logging.getLogger(__name__)
# 加载 .env 文件中的环境变量
load_dotenv()

# 初始化 PromptGenerator
prompt_generator = pg.PromptGenerator()
    
def create_streaming_response(message: str, chat_history=None, session_id=None):
    """
    创建流式响应
    Args:
        message: 用户输入的消息
        chat_history: 聊天历史记录，默认为 None
        session_id: Session id for document retrieval
    Returns:
        生成器，用于流式输出响应
    """
    try:
       # Create LLM with streaming enabled
        llm = LLMService.get_llm(model_name='deepseek-chat', stream=True)

        process_info = get_process_info(message, session_id, chat_history)

        # 构建用于流式输出的提示
        prompt = f"""你是浙江农林大学智能校园助手「农林小林」，请用活泼可爱的语气回答用户的请求并且以第一人称解释我处理请求的过程，包括我计划的任务、使用的工具和每个任务的结果。如果有任务失败或被跳过，也请说明。以下是任务处理的过程信息：
**过程信息：**
用户输入: {process_info['user_input']}

任务规划:
{json.dumps(process_info['task_planning'], ensure_ascii=False, indent=2)}

工具选择:
{json.dumps(process_info['tool_selection'], ensure_ascii=False, indent=2)}

任务执行:
{json.dumps(process_info['task_execution'], ensure_ascii=False, indent=2)}

在回答过程中可以适当的使用emoji活跃一下气氛，如果遇到工具调用失败则尝试用自己的能力去解答，如果实在缺乏足够的信息回答用户的问题请向用户说明
"""

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

def test_llm(model_name='deepseek-chat', stream=False):
    """
    Test LLM model connection and response
    
    Args:
        model_name: Model to test
        stream: Whether to use streaming output
    """
    try:
        llm = LLMService.get_llm(model_name, stream=stream)
        test_prompt = "你好，请做个简单的自我介绍。"
        
        print(f"Testing {model_name} model...")
        if stream:
            print("Streaming output start:")
            for chunk in llm.stream([{"role": "user", "content": test_prompt}]):
                print(chunk.content, end='', flush=True)
            print("\nStreaming output end")
        else:
            response = llm.invoke(test_prompt)
            print(f"Model response:\n{response.content}")
        print("\nTest successful!")
        
    except Exception as e:
        print(f"Test failed: {str(e)}")        


if __name__ == "__main__":
    # 测试普通输出
    print("测试普通输出:")
    test_llm(stream=False)
    
    print("\n" + "="*50 + "\n")
    
    # 测试流式输出
    print("测试流式输出:")
    test_llm(stream=True)

    