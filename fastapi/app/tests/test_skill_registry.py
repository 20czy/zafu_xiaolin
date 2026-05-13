import pytest

from ..agent.TaskExecutor import TaskExecutor
from ..skills import schedule
from ..skills import SkillRegistry


@pytest.mark.asyncio
async def test_course_schedule_skill_filters_by_major_and_day(monkeypatch):
    async def fake_fetch(query_params):
        assert query_params == {"major": "计算机科学", "day_of_week": "周二"}
        return {
            "status": "success",
            "filters": {"major": "计算机科学", "day_of_week": 2},
            "count": 1,
            "courses": [
                {
                    "course_id": "CS102",
                    "course_name": "数据结构",
                    "day_label": "周二",
                }
            ],
            "message": "查询成功",
        }

    monkeypatch.setattr(schedule, "_fetch_course_schedule_from_api", fake_fetch)
    result = await SkillRegistry.execute_tool(
        "course-schedule",
        {"major": "计算机科学", "day_of_week": "周二"},
    )

    assert result["status"] == "success"
    assert result["skill"] == "course-schedule"
    assert result["count"] == 1
    assert result["courses"][0]["course_name"] == "数据结构"
    assert result["courses"][0]["day_label"] == "周二"
    assert result["activation"]["name"] == "course-schedule"
    assert "<skill_content name=\"course-schedule\">" in result["activation"]["content"]


@pytest.mark.asyncio
async def test_task_executor_runs_local_skill_before_mcp(monkeypatch):
    async def fake_fetch(query_params):
        return {
            "status": "success",
            "count": 1,
            "courses": [{"course_id": "CS101"}],
            "message": "查询成功",
        }

    monkeypatch.setattr(schedule, "_fetch_course_schedule_from_api", fake_fetch)
    task = {"id": 1, "task": "查询课表", "input": "查计算机科学周一课表"}
    tool_selection = {
        "tool": "course-schedule",
        "params": {"major": "计算机科学", "day_of_week": "周一"},
    }

    result = await TaskExecutor.execute_task(task, tool_selection, {})

    assert result["skill"] == "course-schedule"
    assert result["count"] == 1
    assert result["courses"][0]["course_id"] == "CS101"


def test_skill_registry_exposes_llm_tool_format():
    tools = SkillRegistry.list_tools()
    course_schedule_tool = next(tool for tool in tools if tool.name == "course-schedule")

    assert any(tool.name == "course-schedule" for tool in tools)
    assert "Tool: course-schedule" in course_schedule_tool.format_for_llm()
    assert "Location:" in course_schedule_tool.format_for_llm()


def test_legacy_course_schedule_alias_still_works():
    skill = SkillRegistry.get_tool("course_schedule")

    assert skill is not None
    assert skill.name == "course-schedule"
