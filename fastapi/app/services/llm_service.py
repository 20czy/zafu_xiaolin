from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
import os
from ..core.env import load_app_env

load_app_env()

DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")
MAIN_AGENT_MODEL = os.getenv("AGENT_MAIN_MODEL", "deepseek-v4-flash")
TOOL_LIBRARY_MODEL = os.getenv("TOOL_LIBRARY_MODEL", "deepseek-v4-flash")


def _resolve_model_name(model_name: str) -> str:
    aliases = {
        "main_agent": MAIN_AGENT_MODEL,
        "tool_library": TOOL_LIBRARY_MODEL,
    }
    return aliases.get(model_name, model_name)


class LLMService:
    """
    LLM服务类，用于处理用户输入并生成响应
    """

    # 缓存llm实例防止多次创建
    _llm_instances = {}

    @classmethod
    async def get_llm(cls, model_name=MAIN_AGENT_MODEL, stream=False, temperature=0.7):
        """
        Get or create an LLM instance based on model_name and stream settings
        
        Args:
            model_name: Model to use ('deepseek-v4-pro', 'deepseek-v4-flash', 'chatglm', etc.)
            stream: Whether to enable streaming output
            temperature: 控制输出随机性的温度参数 (0.0-2.0)
            
        Returns:
            LLM instance
        """
        model_name = _resolve_model_name(model_name)
        cache_key = f"{model_name}_{stream}_{temperature}"
        if cache_key not in cls._llm_instances:
            cls._llm_instances[cache_key] = cls._create_llm(model_name, stream, temperature)
        return cls._llm_instances[cache_key]
    
    @staticmethod
    def _create_llm(model_name=MAIN_AGENT_MODEL, stream=False, temperature=0.7):
        """
        Create and return an LLM instance
        
        Args:
            model_name: 模型名称
            stream: 是否启用流式输出
            temperature: 控制输出随机性的温度参数 (0.0-2.0)
        """
        load_app_env()

        api_key = None
        url = None
        
        # Configure based on model type
        model_name = _resolve_model_name(model_name)

        if model_name.startswith('deepseek-'):
            api_key = os.getenv("DEEPSEEK_API_KEY")
            url = DEEPSEEK_API_BASE
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
    
def create_llm(model_name=MAIN_AGENT_MODEL, stream=False):
    """
    创建并返回一个 LLM 实例
    Args:
        model_name: 模型名称，默认为主 agent 模型
        stream: 是否启用流式输出，默认为 False
    """
    load_app_env()
    model_name = _resolve_model_name(model_name)
    if model_name.startswith('deepseek-'):
        api_key = os.getenv("DEEPSEEK_API_KEY")
        url = DEEPSEEK_API_BASE
    else:
        match model_name:
            case 'chatglm':
                model_name = 'glm-4-flash'
                url = 'https://open.bigmodel.cn/api/paas/v4/'
                api_key = os.getenv("GLM_API_KEY")
            case _:
                raise ValueError(f"不支持的模型: {model_name}")
    
    if not api_key:
        raise ValueError(f"未找到 {model_name} 的 API_KEY 环境变量。请在 .env 文件中设置。")
    
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
