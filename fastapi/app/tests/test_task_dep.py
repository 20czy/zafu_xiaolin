import json

task_plan_result = {
  "tasks": [
    {
      "id": 1,
      "task": "获取今天的课程安排",
      "input": "当前日期",
      "depends_on": []
    },
    {
      "id": 2,
      "task": "解析课程安排，获取课程链接和结束时间",
      "input": "课程安排数据",
      "depends_on": [
        1
      ]
    },
    {
      "id": 3,
      "task": "打开课程链接",
      "input": "课程链接",
      "depends_on": [
        2
      ]
    },
    {
      "id": 4,
      "task": "设置课程结束后的复习提醒",
      "input": "课程结束时间",
      "depends_on": [
        2
      ]
    }
  ]
}

json_string = json.dumps(task_plan_result, ensure_ascii=False, indent=2)

task_plan = json.loads(json_string)
tasks = task_plan.get("tasks", [])

tool_selection_result = {
  "tool_selections": [
    {
      "task_id": 1,
      "tool": "puppeteer_navigate",
      "params": {
        "url": "https://zafu.edu.cn/student/course",
        "launchOptions": {
          "headless": True
        }
      },
      "reason": "需要导航到学校课程安排页面获取今天的课程信息"
    },
    {
      "task_id": 2,
      "tool": "puppeteer_evaluate",
      "params": {
        "script": "return Array.from(document.querySelectorAll('.course-item')).map(item => ({ link: item.querySelector('a').href, endTime: item.querySelector('.end-time').innerText }))"
      },
      "reason": "需要执行JavaScript代码从页面中提取课程链接和结束时间"
    },
    {
      "task_id": 3,
      "tool": "puppeteer_navigate",
      "params": {
        "url": "{TASK_2_RESULT.link}"
      },
      "reason": "需要打开从任务2获取的课程链接"
    },
    {
      "task_id": 4,
      "tool": "puppeteer_evaluate",
      "params": {
        "script": "alert(`课程将在${new Date('{TASK_2_RESULT.endTime}').toLocaleString()}结束，请记得复习`)"
      },
      "reason": "需要根据课程结束时间设置提醒，使用JavaScript alert作为简单提醒方式"
    }
  ]
}

tool_string = json.dumps(tool_selection_result, ensure_ascii=False, indent=2)
tool_selections = json.loads(tool_string)

task_to_tool_map = {
        selection["task_id"]: selection
        for selection in tool_selections.get("tool_selections", [])
    }

first_task = next(iter(tasks))
task_id = first_task.get("id")
first_selection = task_to_tool_map.get(task_id)

# start task execution
tool = first_selection.get("tool")
params = first_selection["params"].copy()

for param_key, param_value in params.items():
    if isinstance(param_value, str) and "{" in param_value:
        import re
        placeholders = re.findall(r"\{TASK_\d+_RESULT(?:\.\w+)*\}", param_value)
        logger.debug(f"任务 {task_id} 参数 {param_key} 包含占位符: {placeholders}")
        for ph in placeholders:
            resolved = cls.resolve_placeholder(ph, task_results)
            params[param_key] = param_value.replace(ph, str(resolved))

    print("param_key: ", param_key)
    print("param_value: ", param_value)

# print(first_task)
# print("\n")
# print(first_selection)