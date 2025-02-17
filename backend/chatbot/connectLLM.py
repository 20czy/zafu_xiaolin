import os
from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.schema.messages import HumanMessage
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)
# 加载 .env 文件中的环境变量
load_dotenv()

def create_llm(model_name='deepseek-chat', stream=False):
    """
    创建并返回一个 LLM 实例
    Args:
        model_name: 模型名称，默认为 'deepseek-chat'
        stream: 是否启用流式输出，默认为 False
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    url = 'https://api.deepseek.com'
    
    if not api_key:
        raise ValueError("未找到 API_KEY 环境变量。请在 .env 文件中设置。")

    if model_name != 'deepseek-chat':
        match model_name:
            case 'chatglm':
                model_name = 'glm-4-flash'
                url = 'https://open.bigmodel.cn/api/paas/v4/'
                api_key = os.getenv("GLM_API_KEY")
            case _:
                raise ValueError(f"不支持的模型: {model_name}")
    
    # 创建 LLM 实例，添加流式输出支持
    llm = ChatOpenAI(
        model=model_name,
        openai_api_key=api_key,
        openai_api_base=url,
        max_tokens=1024,
        streaming=stream,
        callbacks=[StreamingStdOutCallbackHandler()] if stream else None
    )
    
    return llm

def create_streaming_response(llm, message, chat_history=None):
    """
    创建流式响应
    Args:
        llm: LLM 实例
        message: 用户输入的消息
        chat_history: 聊天历史记录，默认为 None
    Returns:
        生成器，用于流式输出响应
    """
    try:
        # 系统基础的提示词
        system_prompt = "你是一个专业的招投标文件审阅助手，可以帮助用户分析和比对招标文件与投标文件。"

        # 构建聊天上下文
        messages = [{"role": "system", "content": system_prompt}]
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
    测试 LLM 模型的连接和响应
    Args:
        model_name: 要测试的模型名称，默认为 'deepseek-chat'
        stream: 是否启用流式输出，默认为 False
    """
    try:
        # 修复：使用传入的 stream 参数，而不是硬编码为 True
        llm = create_llm('chatglm', stream=stream)
        test_prompt = "你好，请做个简单的自我介绍。"
        
        print(f"正在测试 {model_name} 模型...")
        if stream:
            # 修复：打印流式输出的内容
            print("流式输出开始:")
            for chunk in create_streaming_response(llm, test_prompt):
                print(chunk, end='', flush=True)  # 实时打印每个片段
            print("\n流式输出结束")
        else:
            response = llm.invoke(test_prompt)
            print(f"模型响应:\n{response.content}")
        print("\n测试成功！")
        
    except Exception as e:
        print(f"测试失败: {str(e)}")

if __name__ == "__main__":
    # 测试普通输出
    print("测试普通输出:")
    test_llm(stream=False)
    
    print("\n" + "="*50 + "\n")
    
    # 测试流式输出
    print("测试流式输出:")
    test_llm(stream=True)

    