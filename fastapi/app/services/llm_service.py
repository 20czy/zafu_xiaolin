from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
import os
from dotenv import load_dotenv

load_dotenv()

class LLMService:
    """
    LLM服务类，用于处理用户输入并生成响应
    """

    # 缓存llm实例防止多次创建
    _llm_instances = {}

    @classmethod
    async def get_llm(cls, model_name='deepseek-chat', stream=False, temperature=0.7):
        """
        Get or create an LLM instance based on model_name and stream settings
        
        Args:
            model_name: Model to use ('deepseek-chat', 'chatglm', etc.)
            stream: Whether to enable streaming output
            temperature: 控制输出随机性的温度参数 (0.0-2.0)
            
        Returns:
            LLM instance
        """
        cache_key = f"{model_name}_{stream}_{temperature}"
        if cache_key not in cls._llm_instances:
            cls._llm_instances[cache_key] = cls._create_llm(model_name, stream, temperature)
        return cls._llm_instances[cache_key]
    
    @staticmethod
    def _create_llm(model_name='deepseek-chat', stream=False, temperature=0.7):
        """
        Create and return an LLM instance
        
        Args:
            model_name: 模型名称
            stream: 是否启用流式输出
            temperature: 控制输出随机性的温度参数 (0.0-2.0)
        """
        api_key = None
        url = None
        
        # Configure based on model type
        if model_name == 'deepseek-chat':
            api_key = os.getenv("DEEPSEEK_API_KEY")
            url = 'https://api.deepseek.com'
        elif model_name == 'chatglm':
            model_name = 'glm-4-flash'
            url = 'https://open.bigmodel.cn/api/paas/v4/'
            api_key = os.getenv("GLM_API_KEY")
        else:
            raise ValueError(f"Unsupported model: {model_name}")
        
        if not api_key:
            raise ValueError(f"API key for {model_name} not found in environment variables")
            
        # Create LLM instance with streaming support if needed
        llm = ChatOpenAI(
            model=model_name,
            openai_api_key=api_key,
            openai_api_base=url,
            temperature=temperature,
            streaming=stream,
            callbacks=[StreamingStdOutCallbackHandler()] if stream else None
        )
        
        return llm
    
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
        max_tokens=1024, # 生成回复的最大token数量
        streaming=stream, 
        # 将流式输出打印到控制台
        callbacks=[StreamingStdOutCallbackHandler()] if stream else None
    )
    
    return llm