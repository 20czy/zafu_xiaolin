import asyncio
import json
from datetime import date
from typing import Any, Dict, List
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen


KNOWN_LOCATIONS: Dict[str, Dict[str, Any]] = {
    "杭州": {"name": "杭州", "latitude": 30.2741, "longitude": 120.1551},
    "杭州市": {"name": "杭州", "latitude": 30.2741, "longitude": 120.1551},
    "临安": {"name": "杭州临安", "latitude": 30.2344, "longitude": 119.7247},
    "东湖校区": {"name": "浙江农林大学东湖校区", "latitude": 30.2572, "longitude": 119.7319},
    "衣锦校区": {"name": "浙江农林大学衣锦校区", "latitude": 30.2366, "longitude": 119.7182},
    "浙江农林大学": {"name": "浙江农林大学", "latitude": 30.2572, "longitude": 119.7319},
}

WEATHER_CODES: Dict[int, str] = {
    0: "晴",
    1: "基本晴朗",
    2: "局部多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "中等毛毛雨",
    55: "大毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    80: "阵雨",
    81: "中等阵雨",
    82: "强阵雨",
    95: "雷暴",
    96: "雷暴伴小冰雹",
    99: "雷暴伴大冰雹",
}


def resolve_location(location: str | None) -> Dict[str, Any]:
    normalized = (location or "杭州").strip()
    return KNOWN_LOCATIONS.get(
        normalized,
        {
            "name": normalized,
            "latitude": 30.2741,
            "longitude": 120.1551,
            "note": "未找到精确坐标，默认使用杭州坐标",
        },
    )


def _fetch_json(url: str) -> Dict[str, Any]:
    with urlopen(url, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _build_weather_url(latitude: float, longitude: float, days: int) -> str:
    query = urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "Asia/Shanghai",
            "forecast_days": max(1, min(days, 7)),
        }
    )
    return f"https://api.open-meteo.com/v1/forecast?{query}"


def _format_daily_forecast(daily: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
    forecasts = []
    for index, day in enumerate(daily.get("time", [])):
        code = daily.get("weather_code", [None])[index]
        forecasts.append(
            {
                "date": day,
                "weather": WEATHER_CODES.get(code, f"天气代码 {code}"),
                "temperature_max": daily.get("temperature_2m_max", [None])[index],
                "temperature_min": daily.get("temperature_2m_min", [None])[index],
                "precipitation_probability": daily.get("precipitation_probability_max", [None])[index],
            }
        )
    return forecasts


async def query_weather(location: str | None = None, days: int = 1) -> Dict[str, Any]:
    resolved_location = resolve_location(location)
    url = _build_weather_url(
        resolved_location["latitude"],
        resolved_location["longitude"],
        days,
    )

    try:
        payload = await asyncio.to_thread(_fetch_json, url)
    except (TimeoutError, URLError, OSError) as exc:
        return {
            "status": "error",
            "location": resolved_location,
            "message": f"天气服务暂时不可用: {exc}",
            "source": "Open-Meteo",
        }

    current = payload.get("current", {})
    weather_code = current.get("weather_code")
    return {
        "status": "success",
        "location": resolved_location,
        "query_date": date.today().isoformat(),
        "current": {
            "temperature": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "wind_speed": current.get("wind_speed_10m"),
            "weather": WEATHER_CODES.get(weather_code, f"天气代码 {weather_code}"),
        },
        "forecast": _format_daily_forecast(payload.get("daily", {})),
        "source": "Open-Meteo",
    }
