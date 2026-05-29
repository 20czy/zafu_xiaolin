from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.venue_service import query_mock_venues, reserve_mock_venue


router = APIRouter()


class VenueReservationRequest(BaseModel):
    venue_id: str = Field(..., description="场地编号，例如 DH-AUD-001")
    date: str = Field(..., description="预约日期，YYYY-MM-DD")
    period: str = Field(..., description="预约时段，例如 15:30-17:30")
    event_name: str = Field(..., description="活动名称")
    attendee_count: Optional[int] = Field(None, description="预计人数")
    requester: Optional[str] = Field(None, description="申请人")
    department: Optional[str] = Field(None, description="申请部门")


@router.get("/")
async def get_venues(
    campus: Optional[str] = Query(None, description="校区，例如：东湖校区"),
    capacity_min: Optional[int] = Query(None, ge=1, description="最低容量，例如：200"),
    attendee_count: Optional[int] = Query(None, ge=1, description="预计人数，兼容字段"),
    date: Optional[str] = Query(None, description="使用日期，YYYY-MM-DD"),
    period: Optional[str] = Query(None, description="使用时段，例如：15:30-17:30"),
    venue_type: Optional[str] = Query(None, description="场地类型，例如：报告厅、阶梯教室"),
    event_type: Optional[str] = Query(None, description="活动类型，例如：讲座、培训"),
    equipment: Optional[str] = Query(None, description="设备要求，逗号分隔，例如：投影,音响"),
):
    """返回 mock 场地数据，支持按校区、容量、日期、时段、类型和设备筛选。"""

    return query_mock_venues(
        {
            "campus": campus,
            "capacity_min": capacity_min,
            "attendee_count": attendee_count,
            "date": date,
            "period": period,
            "venue_type": venue_type,
            "event_type": event_type,
            "equipment": equipment,
        }
    )


@router.post("/reservations")
async def create_venue_reservation(request: VenueReservationRequest):
    """创建 mock 场地预约单，返回待审批预约结果。"""

    return reserve_mock_venue(request.model_dump())
