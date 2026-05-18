from typing import Any, Dict

from app.services.campus_notice_service import query_mock_campus_notices


async def query_campus_notice(params: Dict[str, Any]) -> Dict[str, Any]:
    """Query campus notices from the skill's bundled reference data."""

    return query_mock_campus_notices(params or {})
