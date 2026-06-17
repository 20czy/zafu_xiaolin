import pytest

from ..services import weather_service


@pytest.mark.asyncio
async def test_query_weather_formats_open_meteo_payload(monkeypatch):
    def fake_fetch_json(url):
        assert "latitude=" in url
        return {
            "current": {
                "temperature_2m": 28.5,
                "relative_humidity_2m": 72,
                "precipitation": 0,
                "weather_code": 2,
                "wind_speed_10m": 9.1,
            },
            "daily": {
                "time": ["2026-05-27"],
                "weather_code": [2],
                "temperature_2m_max": [31.0],
                "temperature_2m_min": [22.0],
                "precipitation_probability_max": [20],
            },
        }

    monkeypatch.setattr(weather_service, "_fetch_json", fake_fetch_json)

    result = await weather_service.query_weather(location="浙江农林大学", days=1)

    assert result["status"] == "success"
    assert result["location"]["name"] == "浙江农林大学"
    assert result["current"]["weather"] == "局部多云"
    assert result["forecast"][0]["precipitation_probability"] == 20


def test_resolve_unknown_location_defaults_to_hangzhou():
    result = weather_service.resolve_location("未知校区")

    assert result["name"] == "未知校区"
    assert result["latitude"] == 30.2741
    assert "默认使用杭州坐标" in result["note"]
