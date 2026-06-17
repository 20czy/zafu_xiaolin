from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.chat_history_manager import ChatHistoryManager


def _execute_result(first_value=None, all_values=None):
    scalars = MagicMock()
    scalars.first.return_value = first_value
    scalars.all.return_value = all_values or []

    result = MagicMock()
    result.scalars.return_value = scalars
    return result


@pytest.mark.asyncio
async def test_update_session_title_generates_short_title_for_default_title():
    session = SimpleNamespace(id="session-1", title="新的对话")
    messages = [
        SimpleNamespace(is_user=True, content="帮我规划明天下午的校园讲座安排"),
        SimpleNamespace(is_user=False, content="可以，我会结合时间、地点、通知和物料准备来规划。"),
    ]
    db = AsyncMock()
    db.execute.side_effect = [
        _execute_result(first_value=session),
        _execute_result(all_values=messages),
    ]

    with patch.object(ChatHistoryManager, "_generate_session_title", new=AsyncMock(return_value="校园讲座规划")):
        title = await ChatHistoryManager.update_session_title_if_needed("session-1", db)

    assert title == "校园讲座规划"
    assert session.title == "校园讲座规划"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(session)


@pytest.mark.asyncio
async def test_update_session_title_keeps_custom_title():
    session = SimpleNamespace(id="session-1", title="已有标题")
    db = AsyncMock()
    db.execute.return_value = _execute_result(first_value=session)

    with patch.object(ChatHistoryManager, "_generate_session_title", new=AsyncMock()) as generate_title:
        title = await ChatHistoryManager.update_session_title_if_needed("session-1", db)

    assert title == "已有标题"
    assert session.title == "已有标题"
    generate_title.assert_not_awaited()
    db.commit.assert_not_awaited()
