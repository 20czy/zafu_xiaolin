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
import json

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

def task_classification(message):
    """
    使用LLM判断用户输入的任务类型，并返回是否需要使用RAG以及文档类型
    """
    try:
        llm = create_llm(model_name='chatglm', stream=False)
        
        messages = [
            {
                "role": "system", 
                "content": """你是一个任务分类助手。请分析用户输入属于以下哪种任务类型：
1. 回答招投标业务专业问题（不需要查询文档）
2. 询问招标书相关问题（需要查询招标书，请提供供查询使用的query）
3. 询问应标书相关问题（需要查询应标书，请提供供查询使用的query）
4. 比对招投标文件进行审核（需要同时查询招标书和应标书，请提供供查询使用的query）
请只返回如下格式的答案：
{
    "task_type": 1-4的数字,
    "explanation": "简要解释原因",
    "query": "供查询使用的query"
}"""
            },
            {"role": "user", "content": message}
        ]

        response = llm.invoke(messages)
        
        # 解析LLM返回的JSON响应
        result = json.loads(response.content)
        task_type = result.get('task_type')
        query = result.get('query', '')
        
        # 根据任务类型确定是否需要RAG和文档类型
        if task_type == 1:
            return False, None, None  # 不需要RAG
        elif task_type == 2:
            return True, 'invitation', query  # 查询招标书
        elif task_type == 3:
            return True, 'offer', query  # 查询应标书
        elif task_type == 4:
            return True, 'both', query  # 查询两种文档
        else:
            logger.warning(f"未知的任务类型: {task_type}")
            return False, None, None
            
    except Exception as e:
        logger.error(f"任务分类失败: {str(e)}")
        # 发生错误时使用默认行为
        return False, None, None
    
def create_system_prompt(llm, message, session_id):
    """
    生成系统提示词
    """
    
    # 获取任务类型和相关文档
    need_rag, doc_type, query = task_classification(message)
    
    if need_rag:
        if doc_type == 'both':
            # 同时检索招标书和应标书
            invitation_docs = search_session_documents(query, session_id, 'invitation')
            offer_docs = search_session_documents(query, session_id, 'offer')
            
            invitation_context = "\n\n".join([
                f"在招标文件《{doc['document_title']}》中找到相关内容：\n{doc['content']}" 
                for doc in invitation_docs
            ])
            
            offer_context = "\n\n".join([
                f"在投标文件《{doc['document_title']}》中找到相关内容：\n{doc['content']}" 
                for doc in offer_docs
            ])
            
            system_prompt = create_prompt_with_slot(invitation_context, offer_context)
        else:
            # 检索单一类型文档
            relevant_docs = search_session_documents(query, session_id, doc_type)
            context = "\n\n".join([
                f"在《{doc['document_title']}》中找到相关内容：\n{doc['content']}" 
                for doc in relevant_docs
            ])
            
            if doc_type == 'invitation':
                system_prompt = create_prompt_with_slot(context, "")
            else:
                system_prompt = create_prompt_with_slot("", context)
    else:
        # 不需要RAG，使用基础提示词
        system_prompt = "你是一个专业的招投标文件审阅助手，可以帮助用户解答招投标相关的专业问题。"
    
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
        system_prompt = """你是一个专业的招投标文档查询优化助手,
        在当前的任务中系统需要根据用户的输入去检索一些内容，帮助llm回答用户的问题
        你的任务是在招投标的场景下优化用户的输入，
        请推测用户的意图，将用户的输入优化为更准确的查询，
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

    