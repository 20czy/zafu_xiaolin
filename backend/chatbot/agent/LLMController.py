import logging
from dotenv import load_dotenv
from typing import Dict, Any, Optional
import json
from .TaskPlanner import TaskPlanner
from .ToolSelector import ToolSelector
from .TaskExecutor import TaskExecutor
from ..logger_config import setup_logger

# 加载 .env 文件中的环境变量
load_dotenv()

logger = setup_logger(__name__)
    
def get_process_info(message: str):
    """
    获取处理用户请求的过程信息
    
    Args:
        message: User message
        session_id: User session ID
        chat_history: Previous conversation history
        
    Returns:
        包含处理过程信息的字典
    """
    yield {"type": "step", "content": "Planning tasks..."}
    # 1. Task Planning: Decompose user request into subtasks
    task_plan = TaskPlanner.create_task_plan(message)
    tasks = task_plan.get("tasks", [])
    yield {"type": "data", "subtype": "task_plan", "content": tasks}
    logger.debug("tasks: %s", tasks)
    

   # Step 2: Selecting tools
    yield {"type": "step", "content": "Selecting tools..."}
    tool_selections = ToolSelector.select_tools_for_tasks(task_plan)
    # Create a mapping of task_id to selected tool
    task_to_tool_map = {
        selection["task_id"]: selection
        for selection in tool_selections.get("tool_selections", [])
    }
    yield {"type": "data", "subtype": "tool_selections", "content": task_to_tool_map}
    logger.info("Create a mapping of task_id to selected tool")
    logger.debug(f"Task to tool mapping: {task_to_tool_map}")

    # 3. Task Execution: Execute each task with selected tool
    task_results = {}
    for task in tasks:
        yield {"type": "step", "content": f"Executing task: {task['task']}..."}
        task_id = task.get("id")
        deps = task.get("depends_on", [])
        deps_met = all(dep_id in task_results and task_results[dep_id].get("status") == "success" for dep_id in deps)
        if not deps_met:
            task_results[task_id] = {"status": "skipped", "reason": "依赖任务失败"}
            continue
        
        tool_selection = task_to_tool_map.get(task_id, {
            "tool": "general_assistant",
            "params": {"query_type": "general", "keywords": task.get("input", "")}
        })
        logger.info(f"Selected tool for task {task_id}: {tool_selection}")

        result = TaskExecutor.execute_task(task, tool_selection, task_results)
        if isinstance(result, dict) and "error" in result:
            task_results[task_id] = {"status": "error", "error": result["error"]}
            yield {"type": "data", "subtype": "task_result", "content": {"task_id": task['id'], "result": result}}
        else:
            task_results[task_id] = {"status": "success", "api_result": result}
            yield {"type": "data", "subtype": "task_result", "content": {"task_id": task['id'], "result": result}}
            
    # 4. 返回处理过程信息
    process_info = {
        "user_input": message,
        "task_planning": task_plan,
        "tool_selection": tool_selections,
        "task_execution": task_results
    }
    logger.info("处理过程信息已生成")
    logger.debug(f"Process info: {json.dumps(process_info, ensure_ascii=False)}")
    
    return process_info