"""OpenAQ v3 client and tolerant response normalization."""

import asyncio
import json
import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import httpx

from ..config import settings
from ..errors import ProviderUnavailable
from .air_quality_index import calculate_epa_aqi

logger = logging.getLogger(__name__)
POLLUTANTS = {
    "pm2.5": "pm25", "pm25": "pm25", "pm_2_5": "pm25", "fine particulate matter": "pm25",
    "pm10": "pm10", "pm_10": "pm10", "no2": "no2", "nitrogen dioxide": "no2",
    "so2": "so2", "sulfur dioxide": "so2", "sulphur dioxide": "so2",
    "o3": "o3", "ozone": "o3", "co": "co", "carbon monoxide": "co",
}
POLLUTANT_KEYS = ("pm25", "pm10", "no2", "so2", "o3", "co")


def _objects(value: Any) -> Iterator[dict]:
    """Walk any JSON nesting and yield objects, without assuming wrapper keys."""
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from _objects(child)


def _records(payload: Any, predicate) -> list[dict]:
    return [obj for obj in _objects(payload) if predicate(obj)]


def _first(obj: dict, *keys: str) -> Any:
    for key in keys:
        value = obj.get(key)
        if value is not None:
            return value
    return None


def _number(value: Any) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError, OverflowError):
        return None


def _name(value: Any) -> str | None:
    if isinstance(value, dict):
        return _first(value, "name", "displayName", "display_name", "parameter")
    return str(value) if value is not None else None


def _timestamp(value: Any) -> str | None:
    if isinstance(value, dict):
        return _timestamp(_first(value, "utc", "datetime", "date", "local", "datetimeFrom", "datetimeTo", "datetime_from", "datetime_to"))
    return str(value) if value else None


class OpenAQService:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _get(self, path: str, params: dict | None = None) -> Any:
        if not settings.openaq_api_key:
            raise ProviderUnavailable("OpenAQ", "OpenAQ API key is not configured")
        url = f"{settings.openaq_base_url.rstrip('/')}/{path.lstrip('/')}"
        for attempt in range(3):
            try:
                logger.info("OpenAQ provider request", extra={"provider": "OpenAQ", "url": f"{settings.openaq_base_url.rstrip('/')}/{path.lstrip('/')}", "attempt": attempt + 1})
                response = await self.client.get(url, params=params, headers={"X-API-Key": settings.openaq_api_key, "Accept": "application/json"})
                # The API key is sent only in a header. Do not log request headers or
                # query values that could contain credentials if endpoint config changes.
                safe_url = str(response.request.url.copy_with(query=None))
                logger.debug("OpenAQ request URL", extra={"url": safe_url, "params": params, "attempt": attempt + 1})
                body = response.text
                logger.info("OpenAQ provider response", extra={"provider": "OpenAQ", "url": safe_url, "status_code": response.status_code, "attempt": attempt + 1})
                logger.debug("OpenAQ response", extra={"url": safe_url, "status_code": response.status_code, "body": body})
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < 2:
                        retry_after = response.headers.get("Retry-After")
                        try:
                            delay = min(8.0, max(0.25, float(retry_after))) if retry_after else (0.5 * 2**attempt + random.random() * 0.2)
                        except ValueError:
                            delay = 0.5 * 2**attempt + random.random() * 0.2
                        await asyncio.sleep(delay)
                        continue
                response.raise_for_status()
                try:
                    return response.json()
                except (ValueError, json.JSONDecodeError) as exc:
                    logger.warning("OpenAQ returned a non-JSON response", extra={"status_code": response.status_code, "body": body})
                    raise ProviderUnavailable("OpenAQ", "OpenAQ returned a non-JSON response") from exc
            except ProviderUnavailable:
                raise
            except httpx.HTTPStatusError as exc:
                logger.warning("OpenAQ request failed", extra={"status_code": exc.response.status_code, "error_type": type(exc).__name__, "error_detail": str(exc), "attempt": attempt + 1})
                raise ProviderUnavailable("OpenAQ", "OpenAQ request was rejected or unavailable") from exc
            except httpx.HTTPError as exc:
                logger.warning("OpenAQ request failed", extra={"error_type": type(exc).__name__, "error_detail": str(exc), "attempt": attempt + 1})
                if attempt < 2:
                    await asyncio.sleep(0.5 * 2**attempt + random.random() * 0.2)
                    continue
                raise ProviderUnavailable("OpenAQ") from exc
        raise ProviderUnavailable("OpenAQ")

    async def _nearby(self, latitude: float, longitude: float, radius_m: int = 25000) -> list[dict]:
        payload = await self._get("locations", {"coordinates": f"{latitude:.4f},{longitude:.4f}", "radius": radius_m, "limit": 100, "page": 1})
        locations = _records(payload, lambda obj: _first(obj, "id", "locationId", "location_id") is not None and isinstance(_first(obj, "coordinates", "coord"), (dict, list)))
        unique: dict[str, dict] = {}
        for loc in locations:
            identifier = _first(loc, "id", "locationId", "location_id")
            unique[str(identifier)] = loc
        return sorted(unique.values(), key=lambda item: self._distance(latitude, longitude, item))

    @staticmethod
    def _coords(location: dict) -> dict:
        coords = _first(location, "coordinates", "coord") or {}
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            # GeoJSON coordinate arrays use longitude, latitude order.
            return {"latitude": _number(coords[1]), "longitude": _number(coords[0])}
        if not isinstance(coords, dict):
            return {"latitude": None, "longitude": None}
        return {"latitude": _number(_first(coords, "latitude", "lat")), "longitude": _number(_first(coords, "longitude", "lon", "lng"))}

    @classmethod
    def _distance(cls, latitude: float, longitude: float, location: dict) -> float:
        coords = cls._coords(location)
        lat, lon = coords["latitude"], coords["longitude"]
        if lat is None or lon is None:
            return math.inf
        return _distance_km(latitude, longitude, lat, lon)

    @staticmethod
    def _sensor_parameters(location: dict, sensor_payload: Any = None) -> dict[str, tuple[str, str]]:
        output = {}
        for sensor in _records(sensor_payload if sensor_payload is not None else location, lambda obj: _first(obj, "id", "sensorId", "sensorsId") is not None and _first(obj, "parameter", "pollutant") is not None):
            parameter = _first(sensor, "parameter", "pollutant")
            pname = (_name(parameter) or "").strip().lower()
            pollutant = POLLUTANTS.get(pname)
            identifier = _first(sensor, "id", "sensorId", "sensorsId")
            if pollutant and identifier is not None:
                units = parameter.get("units", "") if isinstance(parameter, dict) else _first(sensor, "unit", "units") or ""
                output[str(identifier)] = (pollutant, str(units))
        return output

    @staticmethod
    def _measurement_rows(payload: Any) -> list[dict]:
        return _records(payload, lambda obj: _first(obj, "value", "reading") is not None)

    async def _latest_for_location(self, location: dict, latitude: float, longitude: float) -> dict:
        location_id = _first(location, "id", "locationId", "location_id")
        payload = await self._get(f"locations/{location_id}/latest", {"limit": 100, "page": 1})
        sensor_map = self._sensor_parameters(location)
        if not sensor_map:
            try:
                sensors = await self._get(f"locations/{location_id}/sensors", {"limit": 100, "page": 1})
                sensor_map = self._sensor_parameters(location, sensors)
            except ProviderUnavailable:
                logger.debug("OpenAQ sensor metadata unavailable", extra={"location_id": location_id})
        measurements: dict[str, dict] = {}
        for row in self._measurement_rows(payload):
            sensor_id = _first(row, "sensorsId", "sensorId", "sensor_id", "sensor")
            if isinstance(sensor_id, dict):
                sensor_id = _first(sensor_id, "id", "sensorId")
            metadata = sensor_map.get(str(sensor_id)) if sensor_id is not None else None
            parameter = _first(row, "parameter", "pollutant", "name")
            name = (_name(parameter) or "").strip().lower()
            pollutant = metadata[0] if metadata else POLLUTANTS.get(name)
            if not pollutant:
                continue
            value = _number(_first(row, "value", "reading"))
            if value is None:
                continue
            unit = metadata[1] if metadata else str(_first(row, "unit", "units") or (parameter.get("units", "") if isinstance(parameter, dict) else ""))
            stamp = _timestamp(_first(row, "datetime", "timestamp", "date", "period"))
            candidate = {"value": value, "unit": unit, "observed_at": stamp}
            previous = measurements.get(pollutant)
            if previous is None or (stamp or "") > (previous.get("observed_at") or ""):
                measurements[pollutant] = candidate

        coords = self._coords(location)
        loc_name = _first(location, "name", "locality", "city") or f"OpenAQ station {location_id}"
        aqi = calculate_epa_aqi(measurements)[0]
        return {"id": int(location_id), "name": str(loc_name), "locality": _first(location, "locality", "city"), "coordinates": coords,
                "distance_km": self._distance(latitude, longitude, location), "aqi": aqi,
                "aqi_note": "US EPA AQI sub-index estimate from available pollutant readings. Official AQI requires prescribed pollutant averaging periods; these are nearest-station latest measurements.",
                "measurements": measurements}

    async def current(self, latitude: float, longitude: float) -> dict:
        try:
            locations = await self._nearby(latitude, longitude)
            results = await asyncio.gather(*(self._latest_for_location(loc, latitude, longitude) for loc in locations[:8]), return_exceptions=True)
            stations = [item for item in results if isinstance(item, dict)]
            for item in results:
                if isinstance(item, Exception):
                    logger.warning("OpenAQ station latest request failed", extra={"error_type": type(item).__name__})
            stations.sort(key=lambda item: item.get("distance_km") if item.get("distance_km") is not None else math.inf)
            # Prefer a station with particulate readings so AQI can be derived
            # when a slightly closer station only has a different sensor.
            nearest = next((item for item in stations if "pm25" in item["measurements"] or "pm10" in item["measurements"]), None)
            nearest = nearest or next((item for item in stations if item["measurements"]), stations[0] if stations else None)
            measurements = nearest["measurements"] if nearest else {}
            aqi = nearest.get("aqi") if nearest else None
            timestamps = [record.get("observed_at") for record in measurements.values() if record.get("observed_at")]
            normalized = {
                "source": "OpenAQ", "location": {"latitude": latitude, "longitude": longitude},
                "station": nearest.get("name") if nearest else None, "station_details": nearest,
                "pm25": (measurements.get("pm25") or {}).get("value"),
                "pm10": (measurements.get("pm10") or {}).get("value"), "no2": (measurements.get("no2") or {}).get("value"),
                "so2": (measurements.get("so2") or {}).get("value"), "o3": (measurements.get("o3") or {}).get("value"),
                "co": (measurements.get("co") or {}).get("value"), "timestamp": max(timestamps) if timestamps else None,
                "aqi": aqi, "aqi_note": nearest.get("aqi_note") if nearest and aqi is not None else "OpenAQ returned no supported pollutant concentrations; AQI could not be estimated.",
                "stations": stations, "measurements": measurements, "fetched_at": datetime.now(timezone.utc),
            }
            logger.debug("OpenAQ parsed output", extra={"parsed_output": normalized})
            return normalized
        except ProviderUnavailable:
            raise
        except Exception as exc:
            # Payload drift and missing optional provider fields are data availability
            # cases. Log the exception type and safely emit a complete null record.
            logger.exception("OpenAQ response normalization failed", extra={"error_type": type(exc).__name__})
            return _empty_air_quality(latitude, longitude)

    async def history(self, latitude: float, longitude: float, days: int = 7) -> dict:
        locations = await self._nearby(latitude, longitude)
        if not locations:
            return {"source": "OpenAQ", "location": {"latitude": latitude, "longitude": longitude}, "station": None, "days": days, "measurements": []}
        station = locations[0]
        sensor_map = self._sensor_parameters(station)
        if not sensor_map:
            sensors = await self._get(f"locations/{_first(station, 'id', 'locationId')}/sensors", {"limit": 100, "page": 1})
            sensor_map = self._sensor_parameters(station, sensors)
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)

        async def fetch_sensor(sensor_id: str, pollutant: str, unit: str) -> list[dict]:
            payload = await self._get(f"sensors/{sensor_id}/measurements", {"datetime_from": start.isoformat(), "datetime_to": now.isoformat(), "limit": 1000, "page": 1})
            output = []
            for row in self._measurement_rows(payload):
                date = _timestamp(_first(row, "datetime", "timestamp", "date", "period"))
                value = _number(_first(row, "value", "reading"))
                if value is not None and date:
                    output.append({"parameter": pollutant, "value": value, "unit": unit, "observed_at": date})
            return output

        results = await asyncio.gather(*(fetch_sensor(sensor_id, *metadata) for sensor_id, metadata in sensor_map.items()), return_exceptions=True)
        items = [item for group in results if isinstance(group, list) for item in group]
        normalized = {"source": "OpenAQ", "location": {"latitude": latitude, "longitude": longitude}, "days": days,
                "station": {"id": _first(station, "id", "locationId"), "name": _first(station, "name", "locality") or "OpenAQ station", "locality": station.get("locality"), "coordinates": self._coords(station)},
                "measurements": sorted(items, key=lambda item: item["observed_at"])}
        logger.debug("OpenAQ parsed history output", extra={"parsed_output": normalized})
        return normalized


def _empty_air_quality(latitude: float, longitude: float) -> dict:
    return {"source": "OpenAQ", "location": {"latitude": latitude, "longitude": longitude}, "station": None, "station_details": None,
            "pm25": None, "pm10": None, "no2": None, "so2": None, "o3": None, "co": None, "timestamp": None,
            "aqi": None, "aqi_note": "OpenAQ returned no usable pollutant observations.", "stations": [], "measurements": {},
            "fetched_at": datetime.now(timezone.utc)}


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))
