import json
import select

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

for selection in tool_selections.get("tool_selections", []):
    params = selection["params"]
    for param_key, param_value in params.items():
        if isinstance(param_value, dict):
            continue

        import re
        placeholders = re.findall(r"\{TASK_\d+_RESULT(?:\.\w+)*\}", param_value)

        print(placeholders)



