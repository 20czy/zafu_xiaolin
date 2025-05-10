import json
import logging
import re
from typing import Dict, Any, List, Optional

from .mcpConfigManager import McpSession

# 配置日志
logger = logging.getLogger(__name__)

class TaskExecutor:
    """
    Executes tasks according to the plan using selected API tools
    """
    
    @classmethod
    async def execute_task(cls, task: Dict[str, Any], tool_selection: Dict[str, Any], task_results: Dict[int, Any], mcp_session: McpSession) -> Any:
        """
        Execute a single task with the selected tool
        
        Args:
            task: Task definition
            tool_selection: Selected tool and parameters for this task
            task_results: Results of previously executed tasks
            mcp_session: MCP session for accessing server tools
            
        Returns:
            Task execution result
        """
        task_id = task.get("id")
        tool_name = tool_selection.get("tool", "unknown_tool")
        
        logger.info(f"开始执行任务 ID: {task_id}, 任务描述: {task.get('task')}, 使用工具: {tool_name}")
        
        try:
            # Get tool and parameters
            params = tool_selection.get("params", {}).copy()
            logger.debug(f"任务 {task_id} 初始参数: {params}")
            
            # 解决任务的参数依赖问题，即当前执行的任务依赖前面执行任务作为参数
            for param_key, param_value in list(params.items()):
                if isinstance(param_value, str) and "{" in param_value:
                    placeholders = re.findall(r"\{TASK_\d+_RESULT(?:\.\w+)*\}", param_value)
                    logger.debug(f"任务 {task_id} 参数 {param_key} 包含占位符: {placeholders}")
                    for ph in placeholders:
                        resolved = cls.resolve_placeholder(ph, task_results)
                        params[param_key] = param_value.replace(ph, str(resolved))
            
            logger.debug(f"任务 {task_id} 最终参数: {params}")

            # 如果是通用助手工具，直接返回结果
            if tool_name == "general_assistant":
                return {
                    "result": f"通用助手回答: 关于 '{params.get('keywords', '未提供关键词')}' 的查询",
                    "source": "general_assistant"
                }
            
            # 在MCP服务器中查找并执行工具
            server = await cls._find_server_with_tool(tool_name, mcp_session)
            if server:
                try:
                    logger.info(f"在服务器 {server.name} 上执行工具 {tool_name}")
                    result = await server.execute_tool(tool_name, params)
                    logger.info(f"工具 {tool_name} 执行成功")
                    logger.debug(f"工具 {tool_name} 执行结果: {result}")
                    return result
                except Exception as e:
                    error_msg = f"执行工具 {tool_name} 时出错: {str(e)}"
                    logger.error(error_msg)
                    return {"error": error_msg, "task_id": task_id, "tool": tool_name}
            else:
                error_msg = f"找不到支持工具 {tool_name} 的服务器"
                logger.warning(error_msg)
                return {"error": error_msg, "task_id": task_id, "tool": tool_name}
            
        except Exception as e:
            logger.error(f"任务 {task_id} 执行错误: {str(e)}", exc_info=True)
            return {"error": f"执行任务时出错: {str(e)}", "task_id": task_id, "tool": tool_name}
    
    @classmethod
    async def _find_server_with_tool(cls, tool_name: str, mcp_session: McpSession) -> Optional[Any]:
        """
        Find a server that supports the specified tool
        
        Args:
            tool_name: Name of the tool to find
            mcp_session: MCP session containing server connections
            
        Returns:
            Server object if found, None otherwise
        """
        if not mcp_session or not mcp_session.servers:
            logger.warning("MCP会话未初始化或没有可用服务器")
            return None
        
        for server in mcp_session.servers:
            try:
                tools = await server.list_tools()
                if any(tool.name == tool_name for tool in tools):
                    return server
            except Exception as e:
                logger.warning(f"从服务器 {server.name} 获取工具列表失败: {str(e)}")
        
        return None
            
    @classmethod
    def resolve_placeholder(cls, placeholder: str, task_results: Dict[int, Any]) -> Any:
        """
        Resolve a placeholder referencing a previous task result
        
        Args:
            placeholder: Placeholder string in the format {TASK_X_RESULT.key1.key2...}
            task_results: Dictionary of task results indexed by task ID
            
        Returns:
            Resolved value or error message
        """
        if not placeholder.startswith("{TASK_") or not placeholder.endswith("}"):
            return placeholder
        
        try:
            parts = placeholder[1:-1].split(".")
            task_id_part = parts[0].split("_")
            if len(task_id_part) < 2:
                return f"{{INVALID_TASK_ID_FORMAT}}"
            
            task_id = int(task_id_part[1])
            key_path = parts[1:] if len(parts) > 1 else []
            
            if task_id not in task_results:
                return f"{{TASK_{task_id}_RESULT_NOT_FOUND}}"
                
            if task_results[task_id].get("status") != "success":
                return f"{{TASK_{task_id}_FAILED}}"
                
            value = task_results[task_id].get("api_result", {})
            
            for key in key_path:
                if isinstance(value, dict):
                    if key in value:
                        value = value[key]
                    else:
                        return f"{{KEY_{key}_NOT_FOUND}}"
                elif isinstance(value, list) and key.isdigit():
                    index = int(key)
                    if 0 <= index < len(value):
                        value = value[index]
                    else:
                        return f"{{INDEX_{key}_OUT_OF_RANGE}}"
                else:
                    return f"{{CANNOT_ACCESS_{key}_IN_NON_DICT_OR_LIST}}"
            
            return value
            
        except Exception as e:
            logger.error(f"解析占位符 {placeholder} 时出错: {str(e)}")
            return f"{{PLACEHOLDER_ERROR: {str(e)}}}"