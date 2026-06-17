from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

from app.services.weather_service import query_weather


mcp = FastMCP("zafugpt-weather")


@mcp.tool()
async def campus_weather(location: str = "杭州", days: int = 1) -> Dict[str, Any]:
    """查询校园或城市天气。适用于询问杭州、临安、浙江农林大学、东湖校区、衣锦校区等地的当前天气和未来 1-7 天天气预报。"""
    return await query_weather(location=location, days=days)


if __name__ == "__main__":
    mcp.run()
