import os
import asyncio
from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.schema.messages import HumanMessage
from dotenv import load_dotenv
import logging
from . import promptGenerator as pg
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from .models import PDFDocument, ChatSession
from .documentSearch import search_session_documents

logger = logging.getLogger(__name__)
# 加载 .env 文件中的环境变量
load_dotenv()

# 初始化 PromptGenerator
prompt_generator = pg.PromptGenerator()

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

def create_prompt_with_slot(invitation, offer):
    """
    创建prompt
    """
    template_name = "expert.txt"

    # 准备基础插槽数据
    slot_data = {
    "invitation": invitation if invitation else "未找到相关招标文件内容",
    "offer": offer if offer else "未找到相关投标文件内容"
    }

    # 生成最终提示
    prompt = prompt_generator.generate_prompt(slot_data, template_name)
    return prompt
    
def create_system_prompt(llm, message, session_id):
    """
    生成系统提示词
    Args:
        llm: LLM 实例
        message: 用户输入的消息
        session_id: 会话ID
    Returns:
        str: 生成的系统提示词
    """
    # 优化用户查询
    optimized_query = optimize_query(llm, message)

    logger.info(f"优化后的查询: {optimized_query}")
    logger.info(f"session_id: {session_id}")
        
    # 检索相关文档
    relevant_docs = search_session_documents(optimized_query, session_id)
    logger.warn(f"检索到的相关文档: {relevant_docs}")
    
    # 构建包含检索结果的上下文
    context = "\n\n".join([
        f"在《{doc['document_title']}》中找到相关内容：\n{doc['content']}" 
        for doc in relevant_docs
    ])
    logger.warn(f"构建的上下文: {context}")
    
    system_prompt = create_prompt_with_slot(context, "offer")

    return system_prompt

def create_streaming_response(llm, message, chat_history=None, system_prompt=None):
    """
    创建流式响应
    Args:
        llm: LLM 实例
        message: 用户输入的消息
        chat_history: 聊天历史记录，默认为 None
        system_prompt: 系统提示词，默认为 None
    Returns:
        生成器，用于流式输出响应
    """
    try:
        # 系统基础的提示词
        system_prompt = "你是一个专业的招投标文件审阅助手，可以帮助用户分析和比对招标文件与投标文件。" if not system_prompt else system_prompt

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

def optimize_query(llm, query):
    """优化用户查询"""
    try:
        system_prompt = """你是一个专业的招投标文档查询优化助手。请帮助优化用户的查询，使其更加清晰、具体和专业。
        规则：
        1. 保持查询的核心意图
        2. 添加必要的招投标专业术语
        3. 使查询更加结构化
        4. 删除无关信息
        5. 确保优化后的查询不超过200字
        请直接输出优化后的查询。
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请优化以下招投标相关查询：\n{query}"}
        ]
        
        response = llm.invoke(messages)
        optimized_query = response.content
        
        return optimized_query
    except Exception as e:
        logger.error(f"查询优化失败: {str(e)}")
        return query

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

    