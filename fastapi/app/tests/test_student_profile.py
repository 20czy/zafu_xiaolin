import pytest

from ..agent.ResponseGenerator import ResponseGenerator
from ..api.v1.student_profile import get_student_profile
from ..services.student_profile_service import (
    format_student_profile_for_prompt,
    load_student_profile_document,
    parse_student_profile,
)


def test_student_profile_document_contains_required_fields():
    profile = parse_student_profile(load_student_profile_document())

    assert profile == {
        "姓名": "林若溪",
        "学号": "202321450118",
        "学院": "信息工程学院",
        "专业": "计算机科学与技术",
        "年级": "2023级",
        "班级": "计科2301班",
        "导师": "陈启明",
        "校区": "东湖校区",
        "宿舍": "东湖校区 竹苑 5 幢 312 室",
        "联系方式": "138-0571-2026",
    }


def test_student_profile_is_inserted_into_agent_prompt():
    prompt = ResponseGenerator._create_response_prompt(
        {
            "user_input": "我的导师是谁？",
            "task_planning": {},
            "tool_selection": {},
            "task_execution": {},
        }
    )

    assert "当前用户学生画像" in prompt
    assert "林若溪" in prompt
    assert "陈启明" in prompt
    assert "除非用户明确询问个人信息" in prompt


def test_student_profile_prompt_has_privacy_instruction():
    prompt = format_student_profile_for_prompt()

    assert "不要主动完整复述" in prompt
    assert "不要输出手机号、宿舍等敏感字段" in prompt


@pytest.mark.asyncio
async def test_student_profile_endpoint_returns_document_and_profile():
    result = await get_student_profile()

    assert result["status"] == "success"
    assert result["profile"]["姓名"] == "林若溪"
    assert "学生画像 Mock 数据" in result["document"]
