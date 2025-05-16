import re
import logging
from typing import Dict, Any
from ..services.campus_tool_hub import CampusToolHub
from ..services.server_manager import ServerManager

logger = logging.getLogger(__name__)

class TaskExecutor:
    """
    Executes tasks according to the plan using selected API tools - FastAPI async version
    """
    
    @classmethod
    async def execute_task(cls, task: Dict[str, Any], tool_selection: Dict[str, Any], task_results: Dict[int, Any]) -> Any:
        """
        Execute a single task with the selected tool - async version
        
        Args:
            task: Task definition
            tool_selection: Selected tool and parameters for this task
            task_results: Results of previously executed tasks
            包含前置任务的执行结果
            
        Returns:
            Task execution result
        """
        task_id = task.get("id")
        tool_name = tool_selection.get("tool", "unknown_tool")
        
        logger.info(f"开始执行任务 ID: {task_id}, 任务描述: {task.get('task')}, 使用工具: {tool_name}")
        
        try:
            # Get tool and parameters
            params = tool_selection["params"].copy()
            logger.debug(f"任务 {task_id} 初始参数: {params}")
            
            # 解决任务的参数依赖问题，即当前执行的任务依赖前面执行任务作为参数
            for param_key, param_value in params.items():
                if isinstance(param_value, str) and "{" in param_value:
                    import re
                    placeholders = re.findall(r"\{TASK_\d+_RESULT(?:\.\w+)*\}", param_value)
                    logger.debug(f"任务 {task_id} 参数 {param_key} 包含占位符: {placeholders}")
                    for ph in placeholders:
                        resolved = cls.resolve_placeholder(ph, task_results)
                        params[param_key] = param_value.replace(ph, str(resolved))
            logger.debug(f"任务 {task_id} 最终参数: {params}")

            # Call the API
            for server_name, server in ServerManager._servers.items():
                try:
                    # Get the list of tools from the server
                    tools = await server.list_tools()
                    
                    # Check if the requested tool is available
                    if any(tool.name == tool_name for tool in tools):
                        try:
                            tool_result = await server.execute_tool(tool_name, params)
                            return tool_result
                        except Exception as e:
                            error_msg = f"Error executing tool {tool_name} on server {server_name}: {str(e)}"
                            logging.error(error_msg)
                            return error_msg
                except Exception as e:
                    logging.error(f"Error listing tools from server {server_name}: {str(e)}")
                    continue
           
            # api_result = await CampusToolHub.call_api(tool_name, params)
            # return api_result  # Always return raw API result
            return f"No server found with tool: {tool_name}"

        except Exception as e:
            logger.error(f"任务 {task_id} 执行错误: {str(e)}", exc_info=True)
            return {"error": f"执行任务时出错: {str(e)}", "task_id": task_id, "tool": tool_name}
            
    @classmethod
    def resolve_placeholder(cls, placeholder: str, task_results: Dict[int, Any]) -> Any:
        """
        解析占位符，从前置任务结果中获取数据
        """
        if not placeholder.startswith("{TASK_") or not placeholder.endswith("}"):
            return placeholder
        try:
            parts = placeholder[1:-1].split(".") # 去掉{}，按照.进行分割
            task_id = int(parts[0].split("_")[1])
            key_path = parts[1:]
            if task_id not in task_results or task_results[task_id].get("status") != "success":
                return f"{{TASK_{task_id}_RESULT_NOT_FOUND}}"
            value = task_results[task_id]["api_result"]
            for key in key_path:
                if isinstance(value, dict):
                    value = value.get(key, f"{{KEY_{key}_NOT_FOUND}}")
                else:
                    return f"{{INVALID_KEY_PATH}}"
            return value
        except Exception as e:
            return f"{{PLACEHOLDER_ERROR: {str(e)}}}"
