from datetime import datetime, timezone
import csv
import io
import logging
import math
import re
from urllib.parse import urlsplit, urlunsplit
import httpx
from ..config import settings
from ..errors import ProviderUnavailable
from .openaq_service import OpenAQService
from .air_quality_index import calculate_epa_aqi

logger = logging.getLogger(__name__)


class ProviderClient:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=settings.provider_timeout_seconds, follow_redirects=True)
        self.openaq = OpenAQService(self.client)

    async def close(self):
        await self.client.aclose()

    async def _get(self, provider: str, url: str, **kwargs):
        parts = urlsplit(url)
        path = re.sub(r"(?i)(/csv/)[^/]+", r"\1[redacted]", parts.path) if provider == "NASA FIRMS" else parts.path
        safe_url = urlunsplit((parts.scheme, parts.netloc, path, "", ""))
        logger.info("Provider request", extra={"provider": provider, "url": safe_url})
        try:
            response = await self.client.get(url, **kwargs)
            logger.info("Provider response", extra={"provider": provider, "url": safe_url, "status_code": response.status_code})
            response.raise_for_status()
            return response
        except (httpx.HTTPError, ValueError) as exc:
            # Do not expose provider tokens embedded in URLs in exception messages.
            detail = re.sub(r"(?i)(appid=)[^&\s]+", r"\1[redacted]", str(exc).replace(url, safe_url))
            logger.warning("Provider request failed", extra={"provider": provider, "url": safe_url, "error_type": type(exc).__name__, "error_detail": detail})
            raise ProviderUnavailable(provider) from exc

    async def weather(self, latitude: float, longitude: float) -> dict:
        if not settings.openweather_api_key:
            raise ProviderUnavailable("OpenWeather", "OpenWeather API key is not configured")
        data = (await self._get("OpenWeather", f"{settings.openweather_base_url.rstrip('/')}/weather", params={"lat": latitude, "lon": longitude, "appid": settings.openweather_api_key, "units": "metric"})).json()
        if "main" not in data or "dt" not in data:
            raise ProviderUnavailable("OpenWeather", "Provider response did not contain current weather")
        fetched = datetime.now(timezone.utc)
        return {"source": "OpenWeather", "location": {"latitude": latitude, "longitude": longitude}, "observed_at": datetime.fromtimestamp(data["dt"], tz=timezone.utc), "fetched_at": fetched, "temperature_c": data["main"]["temp"], "feels_like_c": data["main"].get("feels_like"), "humidity_percent": data["main"].get("humidity"), "pressure_hpa": data["main"].get("pressure"), "wind_speed_mps": data.get("wind", {}).get("speed"), "wind_direction_degrees": data.get("wind", {}).get("deg"), "cloud_percent": data.get("clouds", {}).get("all"), "precipitation_mm": data.get("rain", {}).get("1h", data.get("snow", {}).get("1h")), "description": (data.get("weather") or [{}])[0].get("description")}

    async def _forecast_get(self, endpoint: str, latitude: float, longitude: float) -> dict:
        """Call an OpenWeather forecast endpoint with credential-safe diagnostics."""
        url = f"{settings.openweather_base_url.rstrip('/')}/{endpoint}"
        safe_url = f"{url}?lat={latitude}&lon={longitude}&units=metric"
        logger.info("Forecast provider called", extra={"provider": "OpenWeather", "url": safe_url})
        if not settings.openweather_api_key:
            logger.error("Forecast provider request failed", extra={"provider": "OpenWeather", "url": safe_url, "error_type": "ConfigurationError", "error_detail": "OpenWeather API key is not configured"})
            raise ProviderUnavailable("OpenWeather", "OpenWeather API key is not configured")
        params = {"lat": latitude, "lon": longitude, "appid": settings.openweather_api_key, "units": "metric"}
        try:
            response = await self.client.get(url, params=params)
            logger.info("Forecast provider response", extra={"provider": "OpenWeather", "url": safe_url, "status_code": response.status_code})
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("list"), list):
                raise ValueError("OpenWeather forecast response is missing its list field")
            return payload
        except (httpx.HTTPError, ValueError) as exc:
            # HTTPX exceptions can embed the full URL, so remove the credential before logging.
            detail = re.sub(r"(?i)(appid=)[^&\s]+", r"\1[redacted]", str(exc))
            logger.error("Forecast provider request failed", extra={"provider": "OpenWeather", "url": safe_url, "error_type": type(exc).__name__, "error_detail": detail})
            raise ProviderUnavailable("OpenWeather", f"Forecast endpoint {endpoint} failed ({type(exc).__name__})") from exc

    async def forecast_weather(self, latitude: float, longitude: float) -> dict:
        return await self._forecast_get("forecast", latitude, longitude)

    async def forecast_air_quality(self, latitude: float, longitude: float) -> dict:
        # OpenWeather Air Pollution API uses the same base path, but exposes
        # forecast air-pollutant concentrations and its documented 1–5 AQI index.
        return await self._forecast_get("air_pollution/forecast", latitude, longitude)

    async def current_air_pollution(self, latitude: float, longitude: float) -> dict:
        return await self._forecast_get("air_pollution", latitude, longitude)

    async def current_weather_for_forecast(self, latitude: float, longitude: float) -> dict:
        """Fetch current conditions as a transparent persistence fallback."""
        if not settings.openweather_api_key:
            raise ProviderUnavailable("OpenWeather", "OpenWeather API key is not configured")
        url = f"{settings.openweather_base_url.rstrip('/')}/weather"
        safe_url = f"{url}?lat={latitude}&lon={longitude}&units=metric"
        logger.info("Forecast fallback provider called", extra={"provider": "OpenWeather current weather", "url": safe_url})
        try:
            response = await self.client.get(url, params={"lat": latitude, "lon": longitude, "appid": settings.openweather_api_key, "units": "metric"})
            logger.info("Forecast fallback provider response", extra={"provider": "OpenWeather current weather", "url": safe_url, "status_code": response.status_code})
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict) or not isinstance(payload.get("main"), dict) or payload.get("dt") is None:
                raise ValueError("OpenWeather current-weather response is missing required fields")
            return payload
        except (httpx.HTTPError, ValueError) as exc:
            detail = re.sub(r"(?i)(appid=)[^&\s]+", r"\1[redacted]", str(exc))
            logger.error("Forecast fallback provider request failed", extra={"provider": "OpenWeather current weather", "url": safe_url, "error_type": type(exc).__name__, "error_detail": detail})
            raise ProviderUnavailable("OpenWeather", f"Current weather fallback failed ({type(exc).__name__})") from exc

    async def air_quality(self, latitude: float, longitude: float) -> dict:
        openaq_result = None
        try:
            openaq_result = await self.openaq.current(latitude, longitude)
            if openaq_result.get("pm25") is not None or openaq_result.get("pm10") is not None:
                return openaq_result
            logger.info("OpenAQ returned no particulate readings; trying OpenWeather air-pollution fallback")
        except ProviderUnavailable as exc:
            logger.warning("OpenAQ current data failed; trying OpenWeather fallback", extra={"error_type": type(exc).__name__, "error_detail": str(exc)})

        try:
            payload = await self.current_air_pollution(latitude, longitude)
        except ProviderUnavailable:
            if openaq_result is not None:
                logger.warning("Returning available OpenAQ pollutants after OpenWeather fallback failed")
                return openaq_result
            raise
        row = next(iter(payload.get("list", [])), {})
        components = row.get("components", {}) if isinstance(row, dict) else {}
        main = row.get("main", {}) if isinstance(row, dict) else {}
        fetched_at = datetime.now(timezone.utc)
        observed_at = datetime.fromtimestamp(row["dt"], tz=timezone.utc) if isinstance(row, dict) and row.get("dt") else fetched_at
        measurements = {}
        for key, provider_key in (("pm25", "pm2_5"), ("pm10", "pm10"), ("no2", "no2"), ("so2", "so2"), ("o3", "o3"), ("co", "co")):
            value = _number(components.get(provider_key))
            if value is not None:
                measurements[key] = {"value": value, "unit": "micrograms/m3", "observed_at": observed_at}
        values = {key: measurements.get(key, {}).get("value") for key in ("pm25", "pm10", "no2", "so2", "o3", "co")}
        aqi = calculate_epa_aqi(measurements)[0]
        result = {
            "source": "OpenWeather", "location": {"latitude": latitude, "longitude": longitude},
            "station": "OpenWeather air-pollution grid", "station_details": None,
            **values, "aqi": aqi,
            "aqi_note": "US EPA AQI sub-index estimate from available pollutant readings. Official AQI requires prescribed averaging periods; these are latest provider measurements." if aqi is not None else "No supported pollutant reading was returned.",
            "timestamp": observed_at, "stations": [], "measurements": measurements, "fetched_at": fetched_at,
        }
        if openaq_result is not None:
            # Preserve any non-PM OpenAQ pollutants while using OpenWeather PM
            # data to supply the particulate estimate and AQI.
            for key in ("pm25", "pm10", "no2", "so2", "o3", "co"):
                if openaq_result.get(key) is not None:
                    result[key] = openaq_result[key]
            result["measurements"] = {**measurements, **openaq_result.get("measurements", {})}
            result["station"] = openaq_result.get("station") or result["station"]
            result["station_details"] = openaq_result.get("station_details")
            result["stations"] = openaq_result.get("stations", [])
            result["source"] = "OpenAQ+OpenWeather"
            result["aqi"] = calculate_epa_aqi(result["measurements"])[0]
            result["aqi_note"] = "US EPA AQI sub-index estimate uses the available OpenAQ and OpenWeather pollutant measurements. Official AQI requires prescribed averaging periods."
        return result

    async def air_quality_history(self, latitude: float, longitude: float, days: int) -> dict:
        return await self.openaq.history(latitude, longitude, days)

    async def fires(self, west: float, south: float, east: float, north: float, day_range: int = 1) -> list[dict]:
        if not settings.nasa_firms_map_key:
            raise ProviderUnavailable("NASA FIRMS", "NASA FIRMS MAP key is not configured")
        area = f"{west},{south},{east},{north}"
        url = f"{settings.nasa_firms_base_url.rstrip('/')}/{settings.nasa_firms_map_key}/VIIRS_SNPP_NRT/{area}/{day_range}"
        response = await self._get("NASA FIRMS", url)
        rows = csv.DictReader(io.StringIO(response.text))
        required_columns = {"latitude", "longitude", "acq_date", "acq_time"}
        if not rows.fieldnames or not required_columns.issubset(set(rows.fieldnames)):
            raise ProviderUnavailable("NASA FIRMS", "NASA FIRMS response was not a valid active-fire CSV")
        output = []
        for row in rows:
            try:
                acquired = datetime.strptime(f"{row['acq_date']} {row['acq_time'].zfill(4)}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
                lat, lon = float(row["latitude"]), float(row["longitude"])
                output.append({"source_id": f"{row.get('latitude')}:{row.get('longitude')}:{row.get('acq_date')}:{row.get('acq_time')}:{row.get('satellite')}", "latitude": lat, "longitude": lon, "acquired_at": acquired, "confidence": row.get("confidence"), "fire_radiative_power_mw": _number(row.get("frp")), "satellite": row.get("satellite"), "instrument": row.get("instrument"), "daynight": row.get("daynight"), "source": "NASA FIRMS"})
            except (ValueError, KeyError):
                continue
        return output


def _number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError):
        return None
