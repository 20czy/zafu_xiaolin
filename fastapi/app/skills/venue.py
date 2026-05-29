from typing import Any, Dict

from app.services.venue_service import handle_venue_request


async def query_or_reserve_venue(params: Dict[str, Any]) -> Dict[str, Any]:
    """Query venues or create a mock reservation."""

    return handle_venue_request(params or {})
