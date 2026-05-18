from typing import Optional

from fastapi import APIRouter, Query

from app.services.campus_notice_service import query_mock_campus_notices


router = APIRouter()


@router.get("/")
async def get_campus_notices(
    keyword: Optional[str] = Query(None, description="关键词，例如：奖学金、开学、运动会"),
    query: Optional[str] = Query(None, description="用户原始查询，兼容字段"),
    category: Optional[str] = Query(None, description="通知类别，例如：奖学金、教务、活动、安全"),
    audience: Optional[str] = Query(None, description="面向对象，例如：本科生、全体学生"),
    department: Optional[str] = Query(None, description="发布部门，例如：教务处、学生处"),
    priority: Optional[str] = Query(None, description="优先级：high、medium、low"),
    date_from: Optional[str] = Query(None, description="发布日期起始，YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="发布日期截止，YYYY-MM-DD"),
    limit: int = Query(5, ge=1, le=20, description="最多返回通知数量"),
):
    """返回 mock 校园通知数据，支持按关键词、类别、受众、部门和日期筛选。"""

    return query_mock_campus_notices(
        {
            "keyword": keyword,
            "query": query,
            "category": category,
            "audience": audience,
            "department": department,
            "priority": priority,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
        }
    )
