import pytest

from ..agent.TaskExecutor import TaskExecutor
from ..api.v1.capabilities import list_capabilities
from ..services.server_manager import ServerManager
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


@pytest.mark.asyncio
async def test_campus_notice_skill_queries_latest_notices():
    result = await SkillRegistry.execute_tool(
        "campus-notice",
        {"keyword": "奖学金", "limit": 3},
    )

    assert result["status"] == "success"
    assert result["skill"] == "campus-notice"
    assert result["count"] == 1
    assert "奖学金" in result["notices"][0]["title"]
    assert "申请条件" in result["notices"][0]["content"]
    assert result["notices"][0]["content_file"] == "notice-2026-001.md"
    assert result["activation"]["name"] == "campus-notice"


@pytest.mark.asyncio
async def test_campus_notice_skill_returns_latest_for_generic_notice_query():
    result = await SkillRegistry.execute_tool(
        "campus-notice",
        {"query": "获取最新校园通知", "limit": 3},
    )

    assert result["status"] == "success"
    assert result["count"] == 3
    assert result["filters"]["keyword"] == ""
    assert [notice["id"] for notice in result["notices"]] == [
        "notice-2026-001",
        "notice-2026-002",
        "notice-2026-003",
    ]


@pytest.mark.asyncio
async def test_campus_notice_skill_extracts_business_keyword_from_query():
    result = await SkillRegistry.execute_tool(
        "campus-notice",
        {"query": "查询奖学金通知", "limit": 3},
    )

    assert result["status"] == "success"
    assert result["count"] == 1
    assert result["filters"]["keyword"] == "奖学金"
    assert result["notices"][0]["id"] == "notice-2026-001"


def test_legacy_campus_notice_alias_works():
    skill = SkillRegistry.get_tool("校园通知")

    assert skill is not None
    assert skill.name == "campus-notice"


@pytest.mark.asyncio
async def test_capabilities_endpoint_returns_local_skills_without_mcp_initialization(monkeypatch):
    monkeypatch.setattr(ServerManager, "_initialized", False)

    result = await list_capabilities()

    assert result["summary"]["skill_count"] >= 2
    assert result["summary"]["tool_count"] == 0
    assert any(skill["name"] == "course-schedule" for skill in result["skills"])
    assert result["errors"]
