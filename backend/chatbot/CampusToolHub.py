import requests, json, asyncio
from typing import List, Dict, Any, Optional
import logging
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

class CampusToolHub:
    """
    Manages and routes to different specialized tools for campus tasks
    Converted from model-based to API-based approach
    """

    # Registry of available API tools with their capabilities and parameters
    TOOL_REGISTRY = {
        "course_scheduler": {
            "description": "课程表查询API，用于查询所有专业的课程信息。",
            "capabilities": ["课表查询"],
            "endpoint": "/api/academic/courses",
            "required_params": [],
            "optional_params": [],
            "method": "get"  # 使用GET请求更符合查询特性
        },
        "event_planner": {
            "description": "校园活动和日程API",
            "capabilities": ["活动查询", "活动推荐", "日程安排"],
            "endpoint": "/api/academic/events",
            "required_params": [],
            "optional_params": [],
            "method": "GET"  # 需要提交复杂参数时使用POST
        },
        "library_assistant": {
            "description": "图书馆资源查询API",
            "capabilities": ["图书查询", "文献推荐", "借阅状态"],
            "endpoint": "/api/library/resources",
            "required_params": ["query_type"],
            "optional_params": ["title", "author", "subject", "isbn", "resource_type"],
            "method": "GET"
        },
        "weather_report": {
            "description": "天气查询，查询临安地区接下来一周的天气情况",
            "capabilities": ["图书查询", "文献推荐", "借阅状态"],
            "endpoint": "/api/academic/weather",
            "required_params": [],
            "optional_params": [],
            "method": "GET"
        },
        "general_assistant": {
            "description": "调用连接校园知识库的AI大模型回答一般问题",
            "capabilities": ["校园政策", "一般问题", "学校介绍"],
            "endpoint": "/api/academic/info",
            "required_params": ["message"],
            "optional_params": [],
            "method": "POST"
        },
        "user_preferences": {
            "description": "用户个人偏好查询API",
            "capabilities": ["用户偏好查询", "个人信息查询"],
            "endpoint": "/api/preferences/",
            "required_params": [],
            "optional_params": [],
            "method": "GET"  # 无参数查询使用GET
        },
        "club_info": {
            "description": "社团基本信息查询API",
            "capabilities": ["社团查询", "社团信息"],
            "endpoint": "/api/clubs/basic_info/",
            "required_params": [],
            "optional_params": [],
            "method": "GET"
        },
    }

    # Base URL for all API endpoints
    API_BASE_URL = "http://127.0.0.1:8000"

    @classmethod
    def get_tool_info_for_planner(cls) -> str:
        """
        Generate tool capabilities information for the task planner
        
        Returns:
            JSON string describing all available tools and capabilities
        """
        tool_capabilities = {}
        for tool_name, tool_info in cls.TOOL_REGISTRY.items():
            tool_capabilities[tool_name] = {
                "description": tool_info["description"],
                "capabilities": tool_info["capabilities"],
                "required_params": tool_info["required_params"],
                "optional_params": tool_info["optional_params"],
            }
        
        return json.dumps(tool_capabilities, ensure_ascii=False, indent=2)
    
    @classmethod
    def call_api(cls, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call the appropriate API endpoint for the selected tool
        
        Args:
            tool_name: Name of the tool to use
            params: Parameters to pass to the API (optional, defaults to None)
            
        Returns:
            API response data
        """
        if tool_name not in cls.TOOL_REGISTRY:
            logger.error(f"Unknown tool: {tool_name}")
            return {"error": "未知工具", "tool": tool_name}
        
        tool_info = cls.TOOL_REGISTRY[tool_name]
        endpoint = tool_info["endpoint"]
        method = tool_info.get("method", "POST").upper()

        if params is None:
            params = {}

        # 参数校验
        for required_param in tool_info["required_params"]:
            if required_param not in params:
                logger.error(f"Missing required parameter for {tool_name}: {required_param}")
                return {"error": f"缺少必要参数: {required_param}", "tool": tool_name}
            
        url = f"{cls.API_BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}

        try:
            if method == "GET":
                # GET请求处理（参数转查询字符串）
                response = requests.get(
                    url,
                    headers=headers,
                    params=params if params else None
                )
            else:
                # POST请求处理（参数转JSON）
                response = requests.post(
                    url,
                    json=params if params else None,
                    headers=headers
                )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP Error {e.response.status_code}: {e.response.text}")
            return {
                "error": f"API返回错误状态码: {e.response.status_code}",
                "details": e.response.json() if e.response.text else {},
                "tool": tool_name
            }
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {"error": "请求发生未知错误", "tool": tool_name}
        
async def main():
    result = CampusToolHub.call_api("course_scheduler", {})
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
