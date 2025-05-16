import pytest
import json
import asyncio
from ..agent.TaskPlanner import TaskPlanner


@pytest.mark.asyncio
async def test_task_planner_real_llm():
    """
    使用真实LLM服务测试TaskPlanner.create_task_plan
    直接调用LLMService，不使用mock，查看完整输出结果
    """
    # 测试用例1：简单查询
    user_request1 = "帮我查询图书馆的开放时间"
    print("\n\n===== 测试用例1：简单查询 =====")
    print(f"用户请求: {user_request1}")
    result1 = await TaskPlanner.create_task_plan(user_request1)
    print("任务计划结果:")
    print(json.dumps(result1, ensure_ascii=False, indent=2))
    
    # 测试用例2：多步骤任务
    user_request2 = "帮我查询明天的天气，并提醒我带伞"
    print("\n\n===== 测试用例2：多步骤任务 =====")
    print(f"用户请求: {user_request2}")
    result2 = await TaskPlanner.create_task_plan(user_request2)
    print("任务计划结果:")
    print(json.dumps(result2, ensure_ascii=False, indent=2))
    
    # 测试用例3：复杂任务
    user_request3 = "我想了解一下浙江农林大学的历史和主要学科，以及如何申请入学"
    print("\n\n===== 测试用例3：复杂任务 =====")
    print(f"用户请求: {user_request3}")
    result3 = await TaskPlanner.create_task_plan(user_request3)
    print("任务计划结果:")
    print(json.dumps(result3, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    # 直接运行此文件时执行测试
    asyncio.run(test_task_planner_real_llm())
