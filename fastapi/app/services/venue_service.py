from datetime import datetime
from typing import Any, Dict, List, Optional


MOCK_VENUES: List[Dict[str, Any]] = [
    {
        "venue_id": "DH-AUD-001",
        "name": "东湖校区图书馆报告厅",
        "campus": "东湖校区",
        "building": "图书馆",
        "floor": "二楼",
        "capacity": 260,
        "venue_type": "报告厅",
        "manager_department": "图书馆",
        "contact": "0571-63740001",
        "equipment": ["投影", "音响", "无线麦克风", "固定座椅", "签到屏"],
        "suitable_for": ["讲座", "培训", "报告会", "宣讲会"],
        "status": "available",
        "notes": "适合 150-260 人讲座，支持会前 30 分钟入场调试。",
    },
    {
        "venue_id": "DH-TEACH-201",
        "name": "东湖校区教学楼 201 阶梯教室",
        "campus": "东湖校区",
        "building": "教学楼",
        "floor": "二楼",
        "capacity": 220,
        "venue_type": "阶梯教室",
        "manager_department": "教务处",
        "contact": "0571-63740002",
        "equipment": ["投影", "有线麦克风", "黑板", "固定座椅"],
        "suitable_for": ["讲座", "公开课", "考试", "培训"],
        "status": "available",
        "notes": "课后时段优先开放，适合常规讲座与培训。",
    },
    {
        "venue_id": "DH-ACT-101",
        "name": "东湖校区学生活动中心多功能厅",
        "campus": "东湖校区",
        "building": "学生活动中心",
        "floor": "一楼",
        "capacity": 180,
        "venue_type": "多功能厅",
        "manager_department": "学生处",
        "contact": "0571-63740003",
        "equipment": ["投影", "音响", "移动桌椅", "舞台灯光"],
        "suitable_for": ["沙龙", "社团活动", "小型讲座", "培训"],
        "status": "available",
        "notes": "容量不足 200 人，适合作为小规模备选。",
    },
    {
        "venue_id": "YJ-HALL-301",
        "name": "衣锦校区行政楼会议厅",
        "campus": "衣锦校区",
        "building": "行政楼",
        "floor": "三楼",
        "capacity": 240,
        "venue_type": "会议厅",
        "manager_department": "党校办",
        "contact": "0571-63740004",
        "equipment": ["投影", "音响", "无线麦克风", "会议桌"],
        "suitable_for": ["会议", "讲座", "报告会"],
        "status": "available",
        "notes": "衣锦校区场地，跨校区活动需考虑交通时间。",
    },
]


MOCK_BOOKINGS: List[Dict[str, Any]] = [
    {
        "booking_id": "BK-20260603-001",
        "venue_id": "DH-TEACH-201",
        "date": "2026-06-03",
        "period": "14:00-16:00",
        "event_name": "学院就业指导讲座",
        "status": "confirmed",
    },
    {
        "booking_id": "BK-20260603-002",
        "venue_id": "DH-AUD-001",
        "date": "2026-06-03",
        "period": "09:00-11:30",
        "event_name": "图书馆资源培训",
        "status": "confirmed",
    },
]


def _contains(value: Any, keyword: Any) -> bool:
    if keyword in (None, ""):
        return True
    return str(keyword).strip().lower() in str(value).strip().lower()


def _normalize_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if not digits:
        return None
    return int(digits)


def _period_overlaps(left: str, right: str) -> bool:
    try:
        left_start, left_end = left.split("-", 1)
        right_start, right_end = right.split("-", 1)
        return left_start < right_end and right_start < left_end
    except ValueError:
        return left == right


def _venue_bookings(venue_id: str, date: Optional[str], period: Optional[str]) -> List[Dict[str, Any]]:
    bookings = []
    for booking in MOCK_BOOKINGS:
        if booking["venue_id"] != venue_id:
            continue
        if date and booking["date"] != date:
            continue
        if period and not _period_overlaps(booking["period"], period):
            continue
        bookings.append(booking)
    return bookings


def _format_venue(venue: Dict[str, Any], date: Optional[str], period: Optional[str]) -> Dict[str, Any]:
    conflicts = _venue_bookings(venue["venue_id"], date, period)
    formatted = dict(venue)
    formatted["available"] = venue["status"] == "available" and not conflicts
    formatted["conflicts"] = conflicts
    formatted["recommendation_score"] = 100
    if conflicts:
        formatted["recommendation_score"] -= 50
    if venue["capacity"] > 300:
        formatted["recommendation_score"] -= 5
    return formatted


def query_mock_venues(params: Dict[str, Any]) -> Dict[str, Any]:
    params = params or {}
    date = params.get("date")
    period = params.get("period") or params.get("time_range")
    capacity_min = _normalize_int(params.get("capacity_min") or params.get("attendee_count"))
    required_equipment = params.get("equipment") or []
    if isinstance(required_equipment, str):
        required_equipment = [item.strip() for item in required_equipment.replace("，", ",").split(",") if item.strip()]

    venues = []
    for venue in MOCK_VENUES:
        if params.get("campus") and not _contains(venue["campus"], params["campus"]):
            continue
        if params.get("venue_type") and not _contains(venue["venue_type"], params["venue_type"]):
            continue
        if params.get("event_type") and not any(_contains(item, params["event_type"]) for item in venue["suitable_for"]):
            continue
        if capacity_min is not None and venue["capacity"] < capacity_min:
            continue
        if required_equipment and not all(
            any(_contains(equipment, required) for equipment in venue["equipment"])
            for required in required_equipment
        ):
            continue
        venues.append(_format_venue(venue, date, period))

    available_venues = [venue for venue in venues if venue["available"]]
    unavailable_venues = [venue for venue in venues if not venue["available"]]
    sorted_venues = sorted(available_venues, key=lambda item: (-item["recommendation_score"], item["capacity"]))
    sorted_venues.extend(sorted(unavailable_venues, key=lambda item: item["capacity"]))

    return {
        "status": "success",
        "filters": {
            "campus": params.get("campus"),
            "capacity_min": capacity_min,
            "date": date,
            "period": period,
            "venue_type": params.get("venue_type"),
            "event_type": params.get("event_type"),
            "equipment": required_equipment,
        },
        "count": len(sorted_venues),
        "available_count": len(available_venues),
        "venues": sorted_venues,
        "message": "查询成功" if sorted_venues else "没有找到符合条件的场地",
    }


def reserve_mock_venue(params: Dict[str, Any]) -> Dict[str, Any]:
    params = params or {}
    venue_id = params.get("venue_id")
    date = params.get("date")
    period = params.get("period") or params.get("time_range")
    event_name = params.get("event_name") or params.get("title") or "未命名活动"
    attendee_count = _normalize_int(params.get("attendee_count") or params.get("capacity_min"))

    missing = [
        field
        for field, value in {
            "venue_id": venue_id,
            "date": date,
            "period": period,
            "event_name": event_name,
        }.items()
        if value in (None, "")
    ]
    if missing:
        return {
            "status": "error",
            "message": "预约参数不完整",
            "missing_fields": missing,
        }

    venue = next((item for item in MOCK_VENUES if item["venue_id"] == venue_id), None)
    if venue is None:
        return {
            "status": "error",
            "message": f"未找到场地: {venue_id}",
        }

    if attendee_count is not None and attendee_count > venue["capacity"]:
        return {
            "status": "error",
            "message": "预约人数超过场地容量",
            "venue": venue,
            "attendee_count": attendee_count,
        }

    conflicts = _venue_bookings(venue_id, date, period)
    if conflicts:
        return {
            "status": "conflict",
            "message": "该场地在目标时段已有预约",
            "venue": venue,
            "conflicts": conflicts,
        }

    booking_id = f"BK-{str(date).replace('-', '')}-{len(MOCK_BOOKINGS) + 1:03d}"
    booking = {
        "booking_id": booking_id,
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "date": date,
        "period": period,
        "event_name": event_name,
        "attendee_count": attendee_count,
        "status": "pending_approval",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "manager_department": venue["manager_department"],
        "contact": venue["contact"],
    }

    return {
        "status": "success",
        "booking": booking,
        "venue": venue,
        "next_steps": [
            "联系场地管理部门确认审批",
            "提前 30 分钟完成投影、音响和麦克风调试",
            "如涉及校外嘉宾，补充入校和安保备案信息",
        ],
        "message": "已生成 mock 场地预约单，状态为待审批",
    }


def handle_venue_request(params: Dict[str, Any]) -> Dict[str, Any]:
    action = str((params or {}).get("action") or "query").strip().lower()
    if action in {"reserve", "book", "预约", "booking"}:
        return reserve_mock_venue(params)
    return query_mock_venues(params)
