import logging
from typing import Dict, Any
import json

from app.services.llm_service import LLMService
from app.services.student_profile_service import format_student_profile_for_prompt

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
                "description": "通用大模型辅助工具。当任务没有专用 Skill 或 MCP Tool 可处理时，调用一次大模型，基于任务描述、用户输入、已有任务结果和学生画像生成辅助分析或回答。",
                "parameters": [
                    {"name": "query_type", "description": "查询类型，如 general、analysis、planning", "required": False},
                    {"name": "keywords", "description": "用户问题、任务输入或需要分析的关键词", "required": True},
                    {"name": "task", "description": "当前任务对象，包含任务描述、输入和依赖关系", "required": False},
                    {"name": "task_results", "description": "前置任务执行结果，可用于汇总与推理", "required": False}
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
        调用一次大模型辅助完成没有专用工具覆盖的任务。
        """
        query_type = params.get("query_type", "general")
        keywords = (
            params.get("keywords")
            or params.get("query")
            or params.get("input")
            or params.get("task_description")
            or ""
        )
        task = params.get("task") or {}
        task_results = params.get("task_results") or {}

        system_prompt = f"""你是浙江农林大学校园大脑中的通用大模型辅助工具。
你的职责是在没有专用 Tool / Skill 覆盖时，调用一次大模型辅助解决当前子任务。

要求：
1. 只回答当前子任务，不要编造工具没有返回的数据。
2. 如果需要外部系统数据但当前没有提供，请说明缺口并给出下一步建议。
3. 涉及校园事务时，优先结合学生画像和已有任务结果。
4. 输出应清晰、可执行，适合作为后续最终回复的中间结果。

当前用户画像：
{format_student_profile_for_prompt()}
"""

        user_prompt = f"""查询类型：{query_type}

当前任务：
{json.dumps(task, ensure_ascii=False, indent=2)}

用户输入 / 关键词：
{keywords}

已有任务结果：
{json.dumps(task_results, ensure_ascii=False, indent=2)}

请基于以上信息完成这一步任务。"""

        llm = await LLMService.get_llm(model_name="deepseek-chat", temperature=0.2)
        response = await llm.ainvoke(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )

        return {
            "status": "success",
            "tool": "general_assistant",
            "query_type": query_type,
            "keywords": keywords,
            "result": response.content,
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
