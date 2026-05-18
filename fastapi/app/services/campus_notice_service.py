import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


NOTICE_REFERENCE_PATH = (
    Path(__file__).resolve().parents[1]
    / "skills"
    / "campus-notice"
    / "references"
    / "notices.json"
)
NOTICE_REFERENCE_DIR = NOTICE_REFERENCE_PATH.parent
GENERIC_NOTICE_QUERY_TOKENS = (
    "查询",
    "获取",
    "查看",
    "最新",
    "最近",
    "校园",
    "学校",
    "通知",
    "公告",
    "信息",
    "一下",
    "相关",
    "的",
)


@lru_cache(maxsize=1)
def load_mock_campus_notices() -> List[Dict[str, Any]]:
    with NOTICE_REFERENCE_PATH.open("r", encoding="utf-8") as file:
        notices = json.load(file)
    if not isinstance(notices, list):
        return []

    hydrated_notices = []
    for notice in notices:
        if not isinstance(notice, dict):
            continue
        hydrated_notice = dict(notice)
        content_file = hydrated_notice.get("content_file")
        if content_file:
            content_path = NOTICE_REFERENCE_DIR / str(content_file)
            try:
                hydrated_notice["content"] = content_path.read_text(encoding="utf-8").strip()
            except OSError:
                hydrated_notice["content"] = ""
        else:
            hydrated_notice["content"] = ""
        hydrated_notices.append(hydrated_notice)
    return hydrated_notices


def _contains(value: Any, keyword: Any) -> bool:
    if keyword in (None, ""):
        return True
    return str(keyword).strip().lower() in str(value).strip().lower()


def _normalize_keyword(keyword: Any) -> str:
    if keyword in (None, ""):
        return ""

    normalized = str(keyword).strip()
    for token in GENERIC_NOTICE_QUERY_TOKENS:
        normalized = normalized.replace(token, "")
    return normalized.strip()


def _parse_date(value: Any) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value).strip())
    except ValueError:
        return None


def _matches_keyword(notice: Dict[str, Any], keyword: str) -> bool:
    if not keyword:
        return True

    searchable_values = [
        notice.get("title", ""),
        notice.get("category", ""),
        notice.get("department", ""),
        notice.get("summary", ""),
        notice.get("content", ""),
        " ".join(notice.get("audience", [])),
        " ".join(notice.get("tags", [])),
    ]
    return any(_contains(value, keyword) for value in searchable_values)


def query_mock_campus_notices(params: Dict[str, Any]) -> Dict[str, Any]:
    raw_keyword = params.get("keyword") or params.get("query") or params.get("keywords") or ""
    keyword = _normalize_keyword(raw_keyword)
    category = params.get("category")
    audience = params.get("audience")
    department = params.get("department")
    priority = params.get("priority")
    date_from = _parse_date(params.get("date_from") or params.get("start_date"))
    date_to = _parse_date(params.get("date_to") or params.get("end_date"))

    try:
        limit = int(params.get("limit") or 5)
    except (TypeError, ValueError):
        limit = 5
    limit = max(1, min(limit, 20))

    notices: List[Dict[str, Any]] = []
    for notice in load_mock_campus_notices():
        publish_date = _parse_date(notice["publish_date"])
        if not _matches_keyword(notice, keyword):
            continue
        if category and not _contains(notice["category"], category):
            continue
        if audience and not any(_contains(item, audience) for item in notice.get("audience", [])):
            continue
        if department and not _contains(notice["department"], department):
            continue
        if priority and notice.get("priority") != str(priority).strip().lower():
            continue
        if date_from and publish_date and publish_date < date_from:
            continue
        if date_to and publish_date and publish_date > date_to:
            continue
        notices.append(dict(notice))

    notices.sort(key=lambda item: item["publish_date"], reverse=True)
    notices = notices[:limit]

    return {
        "status": "success",
        "filters": {
            "keyword": keyword,
            "category": category,
            "audience": audience,
            "department": department,
            "priority": priority,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "limit": limit,
        },
        "count": len(notices),
        "notices": notices,
        "message": "查询成功" if notices else "没有找到符合条件的校园通知",
    }
