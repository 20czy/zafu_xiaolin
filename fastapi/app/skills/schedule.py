import logging
import os
import asyncio
import json
from typing import Any, Dict
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

try:
    import httpx
except ModuleNotFoundError:
    httpx = None

API_EXCEPTIONS = (HTTPError, URLError, TimeoutError, OSError)
if httpx is not None:
    API_EXCEPTIONS = (*API_EXCEPTIONS, httpx.HTTPError)


logger = logging.getLogger(__name__)

COURSE_SCHEDULE_API_BASE_URL = os.getenv(
    "COURSE_SCHEDULE_API_BASE_URL",
    os.getenv("API_BASE_URL", "http://127.0.0.1:8001"),
)
COURSE_SCHEDULE_API_PATH = "/api/v1/course-schedule/"


async def query_course_schedule(params: Dict[str, Any]) -> Dict[str, Any]:
    """Query course schedule data through the FastAPI course schedule API."""

    query_params = {
        key: value
        for key, value in (params or {}).items()
        if key
        in {
            "major",
            "semester",
            "day_of_week",
            "day",
            "course_id",
            "course_name",
            "teacher",
            "instructor",
        }
        and value not in (None, "")
    }

    if "day" in query_params and "day_of_week" not in query_params:
        query_params["day_of_week"] = query_params.pop("day")

    try:
        return await _fetch_course_schedule_from_api(query_params)
    except API_EXCEPTIONS as exc:
        logger.error("课表查询 API 调用失败: %s", exc, exc_info=True)
        return {
            "status": "error",
            "error": "课表查询 API 调用失败",
            "details": str(exc),
            "api": COURSE_SCHEDULE_API_PATH,
        }


async def _fetch_course_schedule_from_api(query_params: Dict[str, Any]) -> Dict[str, Any]:
    if httpx is not None:
        async with httpx.AsyncClient(
            base_url=COURSE_SCHEDULE_API_BASE_URL,
            timeout=5.0,
        ) as client:
            response = await client.get(COURSE_SCHEDULE_API_PATH, params=query_params)
            response.raise_for_status()
            return response.json()

    return await asyncio.to_thread(_fetch_course_schedule_with_stdlib, query_params)


def _fetch_course_schedule_with_stdlib(query_params: Dict[str, Any]) -> Dict[str, Any]:
    query_string = urlencode(query_params)
    url = f"{COURSE_SCHEDULE_API_BASE_URL}{COURSE_SCHEDULE_API_PATH}"
    if query_string:
        url = f"{url}?{query_string}"

    with urlopen(url, timeout=5.0) as response:
        return json.loads(response.read().decode("utf-8"))
