from datetime import datetime, timezone
from typing import Any


def observation_document(source: str, station_id: str, observed_at: datetime, location: dict, values: dict[str, Any]) -> dict:
    return {"source": source, "station_id": station_id, "observed_at": observed_at, "location": {"type": "Point", "coordinates": [location["longitude"], location["latitude"]]}, "values": values, "fetched_at": datetime.now(timezone.utc), "schema_version": 1}


def weather_document(source: str, location: dict, payload: dict[str, Any]) -> dict:
    return {"source": source, "observed_at": payload["observed_at"], "location": {"type": "Point", "coordinates": [location["longitude"], location["latitude"]]}, "measurements": payload, "fetched_at": datetime.now(timezone.utc), "schema_version": 1}


def historical_aqi_document(
    timestamp: datetime,
    latitude: float,
    longitude: float,
    city: str,
    pm25: float | None = None,
    pm10: float | None = None,
    o3: float | None = None,
    no2: float | None = None,
    co: float | None = None,
    so2: float | None = None,
    temperature: float | None = None,
    humidity: float | None = None,
    wind_speed: float | None = None,
    pressure: float | None = None,
    overall_aqi: int | None = None,
) -> dict:
    return {
        "timestamp": timestamp,
        "latitude": latitude,
        "longitude": longitude,
        "city": city,
        "pm25": pm25,
        "pm10": pm10,
        "o3": o3,
        "no2": no2,
        "co": co,
        "so2": so2,
        "temperature": temperature,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "pressure": pressure,
        "overall_aqi": overall_aqi,
        "fetched_at": datetime.now(timezone.utc),
    }

