import logging
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import os, json, requests
from langchain_openai import ChatOpenAI
import asyncio
from .LLMService import LLMService
from .CampusToolHub import CampusToolHub
from .logger_config import setup_logger


# 加载 .env 文件中的环境变量
load_dotenv()

logger = setup_logger(__name__)

class TaskPlaner:
    """
    Central planning LLM that decomposes user requests into subtasks
    """

    # system prompt for task planning
    PLANNING_PROMPT = """你是浙江农林大学智能校园系统的中央规划器。你的任务是在校园场景下，分析用户的请求，并将其分解为可处理的子任务。
    
分析用户请求，并以下格式返回任务计划：

{{
  "tasks": [
    {{
      "id": 1,
      "task": "具体任务描述",
      "input": "给该任务的输入",
      "depends_on": []
    }},
    {{
      "id": 2,
      "task": "具体任务描述",
      "input": "给该任务的输入",
      "depends_on": [1]  // 这表示此任务依赖于任务1的结果
    }}
  ],
}}

规则：
1. 每个任务应尽可能精确
2. 如果任务之间有依赖关系，请使用depends_on字段指定
3. 复杂请求应分解为多个子任务
4. 简单请求可以是单个任务

用户请求："{user_request}"
    """
    @classmethod
    def create_task_plan(cls, user_request: str) -> Dict[str, Any]:
        """
        Create a plan for handling the user's request
        
        Args:
            user_request: The user's message
            
        Returns:
            Task plan dictionary
        """
        logger.info("开始创建任务计划")
        logger.debug(f"用户请求: {user_request}")
        
        try:
            # Create planning prompt
            prompt = cls.PLANNING_PROMPT.format(
                user_request=user_request
            )
            logger.debug("已生成规划提示词")

            # Use planning LLM to generate task plan
            logger.info("初始化 LLM 模型")
            llm = LLMService.get_llm(model_name='deepseek-chat', temperature=0.2)

            logger.info("向 LLM 发送请求")
            planning_response = llm.invoke([
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_request}
            ])
            logger.debug("已收到 LLM 响应")

            # Extract JSON from response
            response_text = planning_response.content
            json_match = response_text.strip()
            logger.debug("开始解析 LLM 响应")

            # Parse the plan
            if "```json" in json_match:
                logger.debug("检测到 JSON 代码块，进行提取")
                json_match = json_match.split("```json")[1].split("```")[0]
            
            task_plan = json.loads(json_match)
            logger.info(f"成功生成任务计划，包含 {len(task_plan.get('tasks', []))} 个任务")
            logger.debug(f"任务计划详情: {json.dumps(task_plan, ensure_ascii=False, indent=2)}")
            
            return task_plan

        except json.JSONDecodeError as je:
            logger.error(f"JSON 解析错误: {str(je)}")
            logger.debug(f"导致错误的响应内容: {response_text}")
            return cls._get_fallback_plan(user_request)
        except Exception as e:
            logger.error(f"任务规划过程出错: {str(e)}", exc_info=True)
            return cls._get_fallback_plan(user_request)

    @classmethod
    def _get_fallback_plan(cls, user_request: str) -> Dict[str, Any]:
        """
        生成降级方案
        """
        logger.warning("使用降级方案处理请求")
        return {
            "tasks": [
                {
                    "id": 1,
                    "task": "处理用户请求",
                    "input": user_request,
                    "depends_on": []
                }
            ],
            "final_output_task_id": 1
        }
        
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
    def select_tools_for_tasks(cls, task_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Select appropriate tools for each task in the plan
        
        Args:
            task_plan: The task plan from the TaskPlanner
            
        Returns:
            Tool selection dictionary
        """
        logger.info("开始为任务计划选择工具")
        logger.debug(f"输入的任务计划: {json.dumps(task_plan, ensure_ascii=False)}")
        
        try:
            # Get tool capabilities for selection
            logger.debug("获取工具能力信息")
            tool_capabilities = CampusToolHub.get_tool_info_for_planner()
            
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
        生成默认的工具选择方案
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

class TaskExecutor:
    """
    Executes tasks according to the plan using selected API tools
    """
    
    @classmethod
    def execute_task(cls, task: Dict[str, Any], tool_selection: Dict[str, Any], task_results: Dict[int, Any]) -> Any:
        """
        Execute a single task with the selected tool
        
        Args:
            task: Task definition
            tool_selection: Selected tool and parameters for this task
            task_results: Results of previously executed tasks
            包含前置任务的执行结果
            
        Returns:
            Task execution result
        """
        task_id = task.get("id")
        tool = tool_selection.get("tool", "unknown_tool")
        
        logger.info(f"开始执行任务 ID: {task_id}, 任务描述: {task.get('task')}, 使用工具: {tool}")
        
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
            api_result = CampusToolHub.call_api(tool, params)
            return api_result  # Always return raw API result
            
        except Exception as e:
            logger.error(f"任务 {task_id} 执行错误: {str(e)}", exc_info=True)
            return {"error": f"执行任务时出错: {str(e)}", "task_id": task_id, "tool": tool}
            
    @classmethod
    def resolve_placeholder(cls, placeholder: str, task_results: Dict[int, Any]) -> Any:
        if not placeholder.startswith("{TASK_") or not placeholder.endswith("}"):
            return placeholder
        try:
            parts = placeholder[1:-1].split(".")
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
        
    
def LLMcontroller(message: str, session_id: str = None, chat_history=None):
    """
    the central controller of the chatbot
    Process campus queries using tool-based architecture
    聊天机器人控制器
    
    Args:
        message: User message
        session_id: User session ID
        chat_history: Previous conversation history
        
    Returns:
        Response from campus assistant
    """
    try:
        # 获取处理信息
        process_info = get_process_info(message, session_id, chat_history)
        
        # 生成完整响应
        full_response = generate_process_response(process_info)
        return full_response
    
    except Exception as e:
        logger.error(f"处理请求时出错: {str(e)}", exc_info=True)
        return "抱歉，处理您的请求时出现了错误。请稍后再试。"
    
def get_process_info(message: str, session_id: str = None, chat_history=None):
    """
    获取处理用户请求的过程信息
    
    Args:
        message: User message
        session_id: User session ID
        chat_history: Previous conversation history
        
    Returns:
        包含处理过程信息的字典
    """
    # 1. Task Planning: Decompose user request into subtasks
    task_plan = TaskPlaner.create_task_plan(message)
    tasks = task_plan.get("tasks", [])

    # 2. Tool Selection: Select appropriate tools for each task
    tool_selections = ToolSelector.select_tools_for_tasks(task_plan) 
    # Create a mapping of task_id to selected tool
    task_to_tool_map = {
        selection["task_id"]: selection
        for selection in tool_selections.get("tool_selections", [])
    }
    logger.info("Create a mapping of task_id to selected tool", task_to_tool_map)

    # 3. Task Execution: Execute each task with selected tool
    task_results = {}
    for task in tasks:
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
        if "error" in result:
            task_results[task_id] = {"status": "error", "error": result["error"]}
        else:
            task_results[task_id] = {"status": "success", "api_result": result}

    # 4. 返回处理过程信息
    process_info = {
        "user_input": message,
        "task_planning": task_plan,
        "tool_selection": tool_selections,
        "task_execution": task_results
    }
    logger.info(f"Process description: {process_info}")
    
    return process_info
    
def generate_process_response(process_info: Dict[str, Any]) -> str:
    prompt = f"""🌟✨ 浙江农林大学智能校园助手「农林小智」上线啦！
Hi～我是你的专属校园小管家，今天要帮你解决什么问题呀？(≧∇≦)ﾉ

📢【直接回答区】
（这里会直接告诉你答案哟～）

━━━━━━━━━━━━━━━━━━
🎭【幕后小剧场】
让我悄悄告诉你，我刚才是怎么思考的吧！(｡•̀ᴗ-)✧

1️⃣ 用户提问时间：
   ➤ 原话是：{process_info['user_input']} 
   （偷偷说：这个问题看起来呢！）

2️⃣ 我的小计划：
   📝 行动清单：
   {json.dumps(process_info['task_planning'], ensure_ascii=False, indent=2)}
   
3️⃣ 工具装备库：
   🛠️ 我偷偷用了这些小工具～
   {json.dumps(process_info['tool_selection'], ensure_ascii=False, indent=2)}

4️⃣ 任务执行日记：
   🚀 闯关记录：
   {json.dumps(process_info['task_execution'], ensure_ascii=False, indent=2)}
   ● 成功任务：打勾✅
   ● 跳过任务：休息⏸️
   ● 失败任务：哎呀😢（附解决方案）

💡 小贴士：
如果看到红色感叹号❗，说明我需要人工老师帮忙啦～
随时可以戳我「重新思考」按钮哦！

（结尾彩蛋）今天陪你探索校园的旅程就到这里啦～
要记得给我点赞❤️+收藏⭐️哟！
"""
    llm = LLMService.get_llm(model_name='deepseek-chat', temperature=0.7)
    response = llm.invoke([{"role": "system", "content": prompt}])
    return response.content
