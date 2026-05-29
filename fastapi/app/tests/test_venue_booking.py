import pytest

from ..services.venue_service import query_mock_venues, reserve_mock_venue
from ..skills import SkillRegistry


def test_venue_query_filters_by_capacity_campus_and_conflict():
    result = query_mock_venues(
        {
            "campus": "东湖校区",
            "attendee_count": 200,
            "date": "2026-06-03",
            "period": "15:30-17:30",
            "event_type": "讲座",
            "equipment": "投影,音响",
        }
    )

    assert result["status"] == "success"
    assert result["available_count"] >= 1
    assert result["venues"][0]["venue_id"] == "DH-AUD-001"
    assert result["venues"][0]["available"] is True
    assert all(venue["capacity"] >= 200 for venue in result["venues"])


def test_venue_reservation_detects_time_conflict():
    result = reserve_mock_venue(
        {
            "venue_id": "DH-TEACH-201",
            "date": "2026-06-03",
            "period": "15:30-17:30",
            "event_name": "计科讲座",
            "attendee_count": 200,
        }
    )

    assert result["status"] == "conflict"
    assert result["conflicts"][0]["booking_id"] == "BK-20260603-001"


@pytest.mark.asyncio
async def test_venue_booking_skill_queries_venues():
    result = await SkillRegistry.execute_tool(
        "venue-booking",
        {
            "campus": "东湖校区",
            "attendee_count": 200,
            "date": "2026-06-03",
            "period": "15:30-17:30",
            "event_type": "讲座",
        },
    )

    assert result["status"] == "success"
    assert result["skill"] == "venue-booking"
    assert result["available_count"] >= 1
    assert result["activation"]["name"] == "venue-booking"


@pytest.mark.asyncio
async def test_venue_booking_skill_creates_mock_reservation():
    result = await SkillRegistry.execute_tool(
        "场地预约",
        {
            "action": "reserve",
            "venue_id": "DH-AUD-001",
            "date": "2026-06-03",
            "period": "15:30-17:30",
            "event_name": "计科 2023 级专题讲座",
            "attendee_count": 200,
        },
    )

    assert result["status"] == "success"
    assert result["skill"] == "venue-booking"
    assert result["booking"]["status"] == "pending_approval"
