import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

def create_llm(model_name='deepseek-chat'):
    """
    default model is deepseek-chat
    创建并返回一个 DeepSeek LLM 实例
    使用 .env 文件中的 API 密钥
    """
    # 从环境变量获取 API 密钥
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
            
    # 创建 LLM 实例
    llm = ChatOpenAI(
        model=model_name, 
        openai_api_key=api_key, 
        openai_api_base=url,
        max_tokens=1024
    )
    
    return llm

    