import pytest
import json
import asyncio
from ..agent.ToolSelector import ToolSelector
from ..agent.TaskPlanner import TaskPlanner


@pytest.mark.asyncio
async def test_tool_selector_real_llm():
    """
    使用真实LLM服务测试ToolSelector.select_tools_for_tasks
    直接调用LLMService，不使用mock，查看完整输出结果
    """
    # 测试用例1：简单查询任务计划
    user_request1 = "帮我查询图书馆的开放时间"
    print("\n\n===== 测试用例1：简单查询 =====")
    print(f"用户请求: {user_request1}")
    
    # 首先使用TaskPlanner创建任务计划
    task_plan1 = await TaskPlanner.create_task_plan(user_request1)
    print("任务计划结果:")
    print(json.dumps(task_plan1, ensure_ascii=False, indent=2))
    
    # 然后使用ToolSelector为任务选择工具
    tool_selections1 = await ToolSelector.select_tools_for_tasks(task_plan1)
    print("工具选择结果:")
    print(json.dumps(tool_selections1, ensure_ascii=False, indent=2))
    
    # 测试用例2：多步骤任务
    user_request2 = "帮我查询明天的天气，并提醒我带伞"
    print("\n\n===== 测试用例2：多步骤任务 =====")
    print(f"用户请求: {user_request2}")
    
    # 创建任务计划
    task_plan2 = await TaskPlanner.create_task_plan(user_request2)
    print("任务计划结果:")
    print(json.dumps(task_plan2, ensure_ascii=False, indent=2))
    
    # 选择工具
    tool_selections2 = await ToolSelector.select_tools_for_tasks(task_plan2)
    print("工具选择结果:")
    print(json.dumps(tool_selections2, ensure_ascii=False, indent=2))
    
    # 测试用例3：复杂任务
    user_request3 = "我想了解一下浙江农林大学的历史和主要学科，以及如何申请入学"
    print("\n\n===== 测试用例3：复杂任务 =====")
    print(f"用户请求: {user_request3}")
    
    # 创建任务计划
    task_plan3 = await TaskPlanner.create_task_plan(user_request3)
    print("任务计划结果:")
    print(json.dumps(task_plan3, ensure_ascii=False, indent=2))
    
    # 选择工具
    tool_selections3 = await ToolSelector.select_tools_for_tasks(task_plan3)
    print("工具选择结果:")
    print(json.dumps(tool_selections3, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    # 直接运行此文件时执行测试
    asyncio.run(test_tool_selector_real_llm())
