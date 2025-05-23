import json
import logging
from logging.handlers import RotatingFileHandler
from typing import Dict, Any

from ..services.llm_service import LLMService
from ..services.campus_tool_hub import CampusToolHub
from ..services.mcp_server import Server, Tool, Configuration
from ..services.server_manager import ServerManager
import os

logger = logging.getLogger(__name__)

# 创建文件处理程序（输出到文件）
file_handler = RotatingFileHandler(
    filename='tool_selector.log',  # 日志文件路径
    maxBytes=10 * 1024 * 1024,   # 文件最大大小（10MB）
    backupCount=5,               # 保留的备份文件数
    encoding='utf-8',
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(file_handler)

class ToolSelector:
    """
    Component that selects appropriate API tools for each task - FastAPI async version
    """
    
    # System prompt for tool selection
    TOOL_SELECTION_PROMPT = """你是浙江农林大学智能校园系统的工具选择器。你需要为每个任务选择最合适的工具。
    
<可用工具及其能力>
{tool_capabilities}
</可用工具及其能力>

任务计划：
{task_plan}

请为每个任务选择最合适的工具，并以下格式返回工具选择方案：

{{
  "tool_selections": [
    {{
      "task_id": 1,
      "tool": "最适合处理此任务的工具名称",
      "params": {{
        "param1": "值1",
        "param2": "值2"
      }},
      "reason": "选择该工具的简短理由"
    }},
    {{
      "task_id": 2,
      "tool": "最适合处理此任务的工具名称",
      "params": {{
        "param1": "值1",
        "param2": "值2"
      }},
      "reason": "选择该工具的简短理由"
    }}
  ]
}}

规则：
1. 为每个任务选择一个最合适的API工具
2. 确保提供该工具所需的所有必要参数
3. 可以提供可选参数以提高结果准确性
4. 参数值应基于任务描述和用户请求提取
5. 如果必要参数在用户请求中不清楚，使用合理的默认值并在reason中说明
6. 如果任务非常一般，可以选择general_assistant工具
7. 如果任务依赖于其他任务的结果，可以使用占位符格式：{{TASK_X_RESULT}}，其中X是任务ID，key是结果中的键
    """
    
    @classmethod
    async def select_tools_for_tasks(cls, task_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Select appropriate tools for each task in the plan - async version
        
        Args:
            task_plan: The task plan from the TaskPlanner
            
        Returns:
            Tool selection dictionary
        """
        logger.info("开始为任务计划选择工具")
        logger.debug(f"输入的任务计划: {json.dumps(task_plan, ensure_ascii=False)}")
        
        try:
            # get the server manager instance
            server_manager = await ServerManager.get_instance()

            # get all tools from all the servers - using the cached tools (not async)
            all_tools = ServerManager.get_cached_tools()
            
            # If cached tools are empty, try to get them directly
            if not all_tools:
                logger.warning("缓存的工具列表为空，尝试直接从服务器获取工具列表")
                all_tools = await server_manager.list_all_tools()
                
            logger.debug(f"获取到 {len(all_tools)} 个工具")
            logger.debug("生成工具选择提示词")
            tools_description = "\n".join([tool.format_for_llm() for tool in all_tools])
                
            # Create selection prompt
            logger.debug("生成工具选择提示词")
            prompt = cls.TOOL_SELECTION_PROMPT.format(
                tool_capabilities=tools_description,
                task_plan=json.dumps(task_plan, ensure_ascii=False, indent=2)
            )
            logger.debug(f"提示词长度: {len(prompt)} 字符")
            
            # Use selection LLM to select tools
            logger.info("初始化工具选择 LLM 模型")
            llm = await LLMService.get_llm(model_name='deepseek-chat', temperature=0.1)
            
            logger.info("向 LLM 发送工具选择请求")
            selection_response = await llm.ainvoke([
                {"role": "system", "content": prompt}
            ])
            logger.debug("已收到 LLM 响应")
            
            # Extract JSON from response
            response_text = selection_response.content
            json_match = response_text.strip()
            logger.debug("开始解析工具选择响应")
            
            # Parse the selections
            if "```json" in json_match:
                logger.debug("检测到 JSON 代码块，进行提取")
                json_match = json_match.split("```json")[1].split("```")[0]
            
            tool_selections = json.loads(json_match)
            num_selections = len(tool_selections.get("tool_selections", []))
            logger.info(f"成功生成工具选择方案，共 {num_selections} 个工具选择")
            logger.debug(f"工具选择详情: {json.dumps(tool_selections, ensure_ascii=False, indent=2)}")
            
            # Validate tool selections
            for selection in tool_selections.get("tool_selections", []):
                tool_name = selection.get("tool", "unknown")
                task_id = selection.get("task_id")
                logger.debug(f"任务 {task_id} 选择了工具: {tool_name}, 原因: {selection.get('reason', 'unknown')}")
            
            return tool_selections
            
        except json.JSONDecodeError as je:
            logger.error(f"工具选择 JSON 解析错误: {str(je)}")
            logger.debug(f"导致解析错误的响应内容: {response_text}")
            return await cls._get_default_selections(task_plan)
        except Exception as e:
            logger.error(f"工具选择过程出错: {str(e)}", exc_info=True)
            return await cls._get_default_selections(task_plan)

    @classmethod
    async def _get_default_selections(cls, task_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成默认的工具选择方案 - 异步版本
        """
        logger.warning("使用默认工具选择方案")
        default_selections = {
            "tool_selections": [
                {
                    "task_id": task["id"],
                    "tool": "general_assistant",
                    "params": {"query_type": "general", "keywords": task["input"]},
                    "reason": "Default selection due to error"
                }
                for task in task_plan.get("tasks", [])
            ]
        }
        logger.debug(f"生成的默认选择方案: {json.dumps(default_selections, ensure_ascii=False)}")
        return default_selections
