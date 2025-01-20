import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

def create_llm():
    """
    创建并返回一个 DeepSeek LLM 实例
    使用 .env 文件中的 API 密钥
    """
    # 从环境变量获取 API 密钥
    api_key = os.getenv("DEEPSEEK_API_KEY")
    
    if not api_key:
        raise ValueError("未找到 DEEPSEEK_API_KEY 环境变量。请在 .env 文件中设置。")

    # 创建 DeepSeek LLM 实例
    llm = ChatOpenAI(
        model='deepseek-chat', 
        openai_api_key=api_key, 
        openai_api_base='https://api.deepseek.com',
        max_tokens=1024
    )
    
    return llm

if __name__ == "__main__":
    try:
        llm = create_llm()
        # 测试模型
        response = llm.invoke("你好，请介绍一下你自己。")
        print(response)
    except Exception as e:
        print(f"发生错误: {str(e)}")