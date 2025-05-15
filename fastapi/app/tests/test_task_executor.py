import pytest
import json
import asyncio
from typing import Dict, Any
from unittest.mock import patch, MagicMock
from ..agent.TaskExecutor import TaskExecutor
from ..agent.TaskPlanner import TaskPlanner
from ..agent.ToolSelector import ToolSelector
from ..services.server_manager import ServerManager
from ..services.mcp_server import Server, Configuration
import os

# @pytest.mark.asyncio
# async def test_task_executor_with_dependencies():
#     """
#     测试TaskExecutor处理任务依赖关系的能力
#     验证参数占位符替换功能
#     """
#     # 模拟服务器和工具
#     mock_server = MagicMock()
#     mock_server.list_tools.return_value = [
#         MagicMock(name="get_weather"),
#         MagicMock(name="send_notification")
#     ]
#     mock_server.execute_tool.side_effect = lambda tool_name, params: (
#         {"status": "success", "city": "杭州", "weather": "晴天", "temperature": "25°C"}
#         if tool_name == "get_weather" else
#         {"status": "success", "message": "通知已发送"}
#     )
    
#     # 模拟ServerManager._servers字典
#     with patch.object(ServerManager, '_servers', {'mock_server': mock_server}):
#         print("\n\n===== 测试用例2：任务依赖关系 =====")
        
#         # 第一个任务：获取天气
#         task1 = {
#             "id": 1,
#             "task": "获取天气信息",
#             "description": "获取指定城市的天气信息"
#         }
        
#         tool_selection1 = {
#             "tool": "get_weather",
#             "params": {
#                 "city": "杭州"
#             }
#         }
        
#         task_results = {}
        
#         # 执行第一个任务
#         result1 = await TaskExecutor.execute_task(task1, tool_selection1, task_results)
#         print("任务1执行结果:")
#         print(json.dumps(result1, ensure_ascii=False, indent=2))
        
#         # 更新任务结果字典
#         task_results[1] = {"status": "success", "api_result": result1}
        
#         # 第二个任务：发送通知，依赖第一个任务的结果
#         task2 = {
#             "id": 2,
#             "task": "发送天气通知",
#             "description": "根据天气情况发送通知",
#             "depends_on": [1]
#         }
        
#         tool_selection2 = {
#             "tool": "send_notification",
#             "params": {
#                 "message": "今天{TASK_1_RESULT.city}的天气是{TASK_1_RESULT.weather}，温度{TASK_1_RESULT.temperature}"
#             }
#         }
        
#         # 执行第二个任务
#         result2 = await TaskExecutor.execute_task(task2, tool_selection2, task_results)
#         print("任务2执行结果:")
#         print(json.dumps(result2, ensure_ascii=False, indent=2))
        
#         # 验证占位符被正确替换
#         expected_message = "今天杭州的天气是晴天，温度25°C"
#         mock_server.execute_tool.assert_any_call("send_notification", {"message": expected_message})

# 在模块级别初始化 ServerManager
_server_manager_init_task = None

def ensure_server_manager_initialized():
    global _server_manager_init_task
    if _server_manager_init_task is None:
        import asyncio
        loop = asyncio.get_event_loop()
        _server_manager_init_task = loop.create_task(ServerManager.get_instance())
    return _server_manager_init_task

# 确保在导入模块时启动初始化


@pytest.mark.asyncio
async def test_task_executor_error_handling():
    """
    测试TaskExecutor的错误处理能力
    包括工具不存在和工具执行失败的情况
    """
    # 模拟服务器和工具
    mock_server = MagicMock()
    mock_server.list_tools.return_value = [MagicMock(name="existing_tool")]
    mock_server.execute_tool.side_effect = Exception("模拟的工具执行错误")
    
    # 模拟ServerManager._servers字典
    with patch.object(ServerManager, '_servers', {'mock_server': mock_server}):
        print("\n\n===== 测试用例3：错误处理 =====")
        
        # 测试工具不存在的情况
        task1 = {
            "id": 1,
            "task": "使用不存在的工具",
            "description": "尝试使用一个不存在的工具"
        }
        
        tool_selection1 = {
            "tool": "non_existing_tool",
            "params": {
                "param1": "value1"
            }
        }
        
        task_results = {}
        
        result1 = await TaskExecutor.execute_task(task1, tool_selection1, task_results)
        print("不存在工具的执行结果:")
        print(json.dumps(result1, ensure_ascii=False, indent=2))
        
        # 测试工具执行失败的情况
        task2 = {
            "id": 2,
            "task": "使用会失败的工具",
            "description": "尝试使用一个会执行失败的工具"
        }
        
        tool_selection2 = {
            "tool": "existing_tool",
            "params": {
                "param1": "value1"
            }
        }
        
        result2 = await TaskExecutor.execute_task(task2, tool_selection2, task_results)
        print("工具执行失败的结果:")
        print(json.dumps(result2, ensure_ascii=False, indent=2))


@pytest.mark.asyncio
async def test_resolve_placeholder():
    """
    测试TaskExecutor.resolve_placeholder方法
    验证不同类型的占位符解析
    """
    print("\n\n===== 测试用例4：占位符解析 =====")
    
    # 准备测试数据
    task_results = {
        1: {
            "status": "success",
            "api_result": {
                "name": "测试用户",
                "age": 25,
                "address": {
                    "city": "杭州",
                    "district": "西湖区"
                }
            }
        }
    }
    
    # 测试基本占位符
    placeholder1 = "{TASK_1_RESULT.name}"
    result1 = TaskExecutor.resolve_placeholder(placeholder1, task_results)
    print(f"占位符 '{placeholder1}' 解析结果: {result1}")
    assert result1 == "测试用户"
    
    # 测试嵌套属性占位符
    placeholder2 = "{TASK_1_RESULT.address.city}"
    result2 = TaskExecutor.resolve_placeholder(placeholder2, task_results)
    print(f"占位符 '{placeholder2}' 解析结果: {result2}")
    assert result2 == "杭州"
    
    # 测试不存在的任务ID
    placeholder3 = "{TASK_999_RESULT.name}"
    result3 = TaskExecutor.resolve_placeholder(placeholder3, task_results)
    print(f"占位符 '{placeholder3}' 解析结果: {result3}")
    assert "NOT_FOUND" in result3
    
    # 测试不存在的属性
    placeholder4 = "{TASK_1_RESULT.non_existing}"
    result4 = TaskExecutor.resolve_placeholder(placeholder4, task_results)
    print(f"占位符 '{placeholder4}' 解析结果: {result4}")
    assert "NOT_FOUND" in result4


@pytest.mark.asyncio
async def test_task_executor_with_real_server():
    """
    使用真实服务器测试TaskExecutor.execute_task
    按照LLMController.py中的完整工作流程：任务规划、工具选择和任务执行
    """
    ensure_server_manager_initialized()
    # 初始化ServerManager
    server_manager = await ServerManager.get_instance()
    if len(ServerManager._servers) > 0:
        print("server initialized successfully")
    else:
        print("server initialized failed")
    
    # 确保ServerManager已初始化并包含服务器
    assert ServerManager._initialized, "ServerManager未正确初始化"
    assert len(ServerManager._servers) > 0, "ServerManager中没有可用的服务器"
    
    print("\n\n===== 测试用例：使用真实服务器执行完整工作流程 =====")
    
    # 测试用户输入
    user_message = "查询浙江农林大学的信息"
    print(f"用户输入: {user_message}")
    
    # 步骤1: 任务规划 - 将用户请求分解为子任务
    print("\n1. 任务规划阶段...")
    task_plan = await TaskPlanner.create_task_plan(user_message)
    tasks = task_plan.get("tasks", [])
    print("任务计划:")
    print(json.dumps(tasks, ensure_ascii=False, indent=2))
    assert len(tasks) > 0, "任务计划不应为空"
    
    # 步骤2: 工具选择 - 为每个任务选择合适的工具
    print("\n2. 工具选择阶段...")
    tool_selections = await ToolSelector.select_tools_for_tasks(task_plan)
    # 创建任务ID到所选工具的映射
    task_to_tool_map = {
        selection["task_id"]: selection
        for selection in tool_selections.get("tool_selections", [])
    }
    print("工具选择:")
    print(json.dumps(task_to_tool_map, ensure_ascii=False, indent=2))
    
    # 步骤3: 任务执行 - 使用所选工具执行每个任务
    print("\n3. 任务执行阶段...")
    task_results = {}
    
    for task in tasks:
        task_id = task.get("id")
        print(f"\n执行任务 {task_id}: {task.get('task')}")
        
        # 检查任务依赖
        deps = task.get("depends_on", [])
        deps_met = all(dep_id in task_results and task_results[dep_id].get("status") == "success" for dep_id in deps)
        if not deps_met and deps:
            print(f"任务 {task_id} 的依赖未满足，跳过执行")
            task_results[task_id] = {"status": "skipped", "reason": "依赖任务失败"}
            continue
        
        # 获取为此任务选择的工具
        tool_selection = task_to_tool_map.get(task_id, {
            "tool": "general_assistant",
            "params": {"query_type": "general", "keywords": task.get("input", "")}
        })
        print(f"选择的工具: {tool_selection['tool']}")
        
        # 执行任务
        result = await TaskExecutor.execute_task(task, tool_selection, task_results)
        print(f"任务 {task_id} 执行结果:")
        print(result)
        
        # 更新任务结果
        if isinstance(result, dict) and "error" in result:
            task_results[task_id] = {"status": "error", "error": result["error"]}
        else:
            task_results[task_id] = {"status": "success", "api_result": result}
    
    # 步骤4: 生成处理过程摘要
    print("\n4. 生成处理过程摘要...")
    process_info = {
        "user_input": user_message,
        "task_planning": task_plan,
        "tool_selection": tool_selections,
        "task_execution": task_results
    }
    
    print("\n处理过程摘要:")
    print(json.dumps({
        "user_input": process_info["user_input"],
        "tasks_count": len(tasks),
        "completed_tasks": sum(1 for task_id, result in task_results.items() if result.get("status") == "success"),
        "failed_tasks": sum(1 for task_id, result in task_results.items() if result.get("status") in ["error", "skipped"])
    }, ensure_ascii=False, indent=2))
    
    # 验证结果
    assert process_info is not None, "处理过程信息不应为None"
    assert "task_execution" in process_info, "处理过程信息应包含任务执行结果"
    
    # 清理资源
    await server_manager.cleanup()


if __name__ == "__main__":
    # 直接运行此文件时执行测试
    
    asyncio.run(test_task_executor_with_real_server())
    asyncio.run(test_task_executor_error_handling())
    asyncio.run(test_resolve_placeholder())
