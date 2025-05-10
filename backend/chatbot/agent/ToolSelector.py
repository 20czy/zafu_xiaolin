import json
import logging
from typing import Dict, Any, List

from ..LLMService import LLMService
from ..CampusToolHub import CampusToolHub
from ..logger_config import setup_logger
from .mcpConfigManager import McpSession, Tool

logger = setup_logger(__name__)

class ToolSelector:
    """
    Component that selects appropriate API tools for each task
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
    async def select_tools_for_tasks(cls, task_plan: Dict[str, Any], mcp_session: McpSession) -> Dict[str, Any]:
        """
        Select appropriate tools for each task in the plan
        
        Args:
            task_plan: The task plan from the TaskPlanner
            mcp_session: MCP session for accessing server tools
            
        Returns:
            Tool selection dictionary
        """
        logger.info("开始为任务计划选择工具")
        logger.debug(f"输入的任务计划: {json.dumps(task_plan, ensure_ascii=False)}")
        
        try:
            # Get tool capabilities for selection
            logger.debug("通过mcp_session获取工具能力信息")
            all_mcp_tool_formatted: List[str] = []
            
            # 从MCP服务器获取工具列表
            if mcp_session and mcp_session.servers:
                for server in mcp_session.servers:
                    try:
                        # 使用异步方式获取工具列表
                        tools = await server.list_tools()
                        
                        # 格式化工具信息
                        for tool in tools:
                            tool_info = f"工具名称: {tool.name}\n"
                            tool_info += f"描述: {tool.description}\n"
                            
                            # 添加参数信息
                            if hasattr(tool, 'input_schema') and tool.input_schema:
                                tool_info += "参数:\n"
                                properties = tool.input_schema.get('properties', {})
                                for param_name, param_info in properties.items():
                                    required = "必需" if param_name in tool.input_schema.get('required', []) else "可选"
                                    param_type = param_info.get('type', '未知')
                                    param_desc = param_info.get('description', '无描述')
                                    tool_info += f"  - {param_name} ({param_type}, {required}): {param_desc}\n"
                            
                            all_mcp_tool_formatted.append(tool_info)
                    except Exception as e:
                        logger.warning(f"从服务器 {server.name} 获取工具列表失败: {str(e)}")
            
            # 如果没有MCP工具，使用默认的通用工具
            if not all_mcp_tool_formatted:
                all_mcp_tool_formatted = [
                    "工具名称: general_assistant\n描述: 通用助手，可以回答一般性问题\n参数:\n  - query_type (string, 必需): 查询类型\n  - keywords (string, 必需): 关键词"
                ]
            
            # 合并所有工具信息
            tool_capabilities = "\n\n".join(all_mcp_tool_formatted)
            
            # Create selection prompt
            logger.debug("生成工具选择提示词")
            prompt = cls.TOOL_SELECTION_PROMPT.format(
                tool_capabilities=tool_capabilities,
                task_plan=json.dumps(task_plan, ensure_ascii=False, indent=2)
            )
            logger.debug(f"提示词长度: {len(prompt)} 字符")
            
            # Use selection LLM to select tools
            logger.info("初始化工具选择 LLM 模型")
            llm = LLMService.get_llm(model_name='deepseek-chat', temperature=0.1)
            
            logger.info("向 LLM 发送工具选择请求")
            selection_response = llm.invoke([
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
            return cls._get_default_selections(task_plan)
        except Exception as e:
            logger.error(f"工具选择过程出错: {str(e)}", exc_info=True)
            return cls._get_default_selections(task_plan)
    
    @classmethod
    def _get_default_selections(cls, task_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate default tool selections when the normal process fails
        
        Args:
            task_plan: The task plan from the TaskPlanner
            
        Returns:
            Default tool selection dictionary
        """
        logger.info("生成默认工具选择")
        default_selections = {"tool_selections": []}
        
        # Extract tasks from the plan
        tasks = task_plan.get("tasks", [])
        
        # Create a default selection for each task
        for task in tasks:
            task_id = task.get("id")
            task_description = task.get("task", "")
            
            default_selections["tool_selections"].append({
                "task_id": task_id,
                "tool": "general_assistant",
                "params": {
                    "query_type": "general",
                    "keywords": task_description
                },
                "reason": "默认选择通用助手工具，因为工具选择过程失败"
            })
        
        logger.debug(f"默认工具选择: {json.dumps(default_selections, ensure_ascii=False)}")
        return default_selections