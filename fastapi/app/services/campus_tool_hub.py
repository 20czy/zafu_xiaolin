import logging
from typing import Dict, Any
import json

logger = logging.getLogger(__name__)

class CampusToolHub:
    """
    校园工具集成服务 - FastAPI异步版本
    """
    
    # 工具信息缓存
    _tool_info = None
    
    @classmethod
    async def get_tool_info_for_planner(cls) -> str:
        """
        获取工具信息用于规划器 - 异步版本
        
        Returns:
            工具信息的格式化字符串
        """
        if cls._tool_info is None:
            # 初始化工具信息
            await cls._init_tool_info()
        
        return cls._tool_info
    
    @classmethod
    async def _init_tool_info(cls) -> None:
        """
        初始化工具信息 - 异步版本
        """
        # 这里可以从配置文件、数据库或API获取工具信息
        # 为了简单起见，我们使用硬编码的工具信息
        tools = [
            {
                "name": "general_assistant",
                "description": "通用助手，可以回答一般性问题",
                "parameters": [
                    {"name": "query_type", "description": "查询类型，如'general'", "required": True},
                    {"name": "keywords", "description": "关键词", "required": True}
                ]
            },
            {
                "name": "course_info",
                "description": "查询课程信息",
                "parameters": [
                    {"name": "course_id", "description": "课程ID", "required": False},
                    {"name": "course_name", "description": "课程名称", "required": False},
                    {"name": "teacher", "description": "教师姓名", "required": False}
                ]
            },
            {
                "name": "campus_map",
                "description": "查询校园地图和位置信息",
                "parameters": [
                    {"name": "location", "description": "位置名称", "required": True},
                    {"name": "detail", "description": "是否需要详细信息", "required": False}
                ]
            }
        ]
        
        # 格式化工具信息
        formatted_tools = []
        for tool in tools:
            params_info = ", ".join([f"{p['name']}({'必需' if p.get('required', False) else '可选'})" for p in tool.get("parameters", [])])
            formatted_tools.append(f"工具名称: {tool['name']}\n描述: {tool['description']}\n参数: {params_info}\n")
        
        cls._tool_info = "\n".join(formatted_tools)
        logger.info("工具信息已初始化")
    
    @classmethod
    async def call_api(cls, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用API工具 - 异步版本
        
        Args:
            tool_name: 工具名称
            params: 工具参数
            
        Returns:
            API调用结果
        """
        logger.info(f"调用API工具: {tool_name}, 参数: {json.dumps(params, ensure_ascii=False)}")
        
        try:
            # 根据工具名称调用不同的API
            if tool_name == "general_assistant":
                return await cls._call_general_assistant(params)
            elif tool_name == "course_info":
                return await cls._call_course_info(params)
            elif tool_name == "campus_map":
                return await cls._call_campus_map(params)
            else:
                logger.warning(f"未知的工具: {tool_name}")
                return {"error": f"未知的工具: {tool_name}"}
        except Exception as e:
            logger.error(f"API调用出错: {str(e)}", exc_info=True)
            return {"error": f"API调用出错: {str(e)}"}
    
    @classmethod
    async def _call_general_assistant(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用通用助手API - 异步版本
        """
        query_type = params.get("query_type", "general")
        keywords = params.get("keywords", "")
        
        # 这里应该是实际的API调用，现在我们返回模拟数据
        return {
            "result": f"这是关于 '{keywords}' 的通用回答",
            "query_type": query_type
        }
    
    @classmethod
    async def _call_course_info(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用课程信息API - 异步版本
        """
        course_id = params.get("course_id")
        course_name = params.get("course_name")
        teacher = params.get("teacher")
        
        # 这里应该是实际的API调用，现在我们返回模拟数据
        return {
            "courses": [
                {
                    "id": "CS101",
                    "name": "计算机科学导论",
                    "teacher": "张教授",
                    "schedule": "周一 8:00-10:00",
                    "location": "教学楼A-101"
                }
            ]
        }
    
    @classmethod
    async def _call_campus_map(cls, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用校园地图API - 异步版本
        """
        location = params.get("location", "")
        detail = params.get("detail", False)
        
        # 这里应该是实际的API调用，现在我们返回模拟数据
        basic_info = {
            "name": location,
            "coordinates": "30.123, 120.456",
            "category": "教学楼"
        }
        
        if detail:
            basic_info.update({
                "description": f"{location}是学校的主要教学区域之一，包含多个教室和实验室。",
                "facilities": ["电梯", "饮水机", "休息区"],
                "opening_hours": "6:00-22:00"
            })
        
        return basic_info
