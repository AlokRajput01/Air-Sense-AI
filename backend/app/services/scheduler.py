"""Background scheduler and collector for historical hourly AQI & weather data."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import math
import random
from ..models.documents import historical_aqi_document
from .air_quality_index import calculate_overall_aqi

logger = logging.getLogger(__name__)

DELHI_NCR_CITIES = {
    "Delhi": {"latitude": 28.6139, "longitude": 77.2090},
    "Noida": {"latitude": 28.5355, "longitude": 77.3910},
    "Gurugram": {"latitude": 28.4595, "longitude": 77.0266},
    "Ghaziabad": {"latitude": 28.6692, "longitude": 77.4538},
    "Faridabad": {"latitude": 28.4089, "longitude": 77.3178},
}


async def record_historical_observation(
    db, city: str, latitude: float, longitude: float, provider
) -> dict | None:
    """Fetch current observations and record to db.HistoricalAQI."""
    try:
        air_task = provider.air_quality(latitude, longitude)
        weather_task = provider.weather(latitude, longitude)
        air, weather = await asyncio.gather(air_task, weather_task, return_exceptions=True)

        air_data = air if isinstance(air, dict) else {}
        weather_data = weather if isinstance(weather, dict) else {}

        pm25 = air_data.get("pm25")
        pm10 = air_data.get("pm10")
        no2 = air_data.get("no2")
        o3 = air_data.get("o3")
        co = air_data.get("co")
        so2 = air_data.get("so2")

        temp = weather_data.get("temperature_c")
        humidity = weather_data.get("humidity_percent")
        wind_speed = weather_data.get("wind_speed_mps")
        pressure = weather_data.get("pressure_hpa")

        overall_aqi, _, _ = calculate_overall_aqi(pm25=pm25, pm10=pm10, o3=o3, no2=no2, co=co, so2=so2)
        if overall_aqi is None:
            overall_aqi = air_data.get("aqi")

        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        doc = historical_aqi_document(
            timestamp=now,
            latitude=latitude,
            longitude=longitude,
            city=city,
            pm25=pm25,
            pm10=pm10,
            o3=o3,
            no2=no2,
            co=co,
            so2=so2,
            temperature=temp,
            humidity=humidity,
            wind_speed=wind_speed,
            pressure=pressure,
            overall_aqi=overall_aqi,
        )

        if db is not None:
            await db.HistoricalAQI.update_one(
                {"city": city, "timestamp": now},
                {"$set": doc},
                upsert=True,
            )
        return doc
    except Exception as exc:
        logger.warning(f"Failed to record historical observation for {city}: {exc}")
        return None


async def seed_historical_data_if_needed(db, provider):
    """Seed past 7 days of realistic time-series for Delhi NCR if collection is sparse."""
    if db is None:
        return
    try:
        count = await db.HistoricalAQI.count_documents({})
        if count >= 200:
            logger.info(f"HistoricalAQI already has {count} records; skipping initial seed.")
            return

        logger.info("HistoricalAQI collection has few records. Bootstrapping past 7 days of historical data...")
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        for city, coords in DELHI_NCR_CITIES.items():
            lat, lon = coords["latitude"], coords["longitude"]
            base_pm25 = 145.0 + (hash(city) % 35)
            base_pm10 = base_pm25 * 1.6 + 15
            base_no2 = 65.0 + (hash(city) % 20)
            base_o3 = 42.0 + (hash(city) % 15)
            base_co = 1.6
            base_so2 = 18.0

            records = []
            for hours_ago in range(168, -1, -1):
                ts = now - timedelta(hours=hours_ago)
                hour = ts.hour
                day_of_week = ts.weekday()

                # Diurnal curve: Delhi NCR particulate peak in late evening / early morning
                # (due to inversion and commercial truck movement), lower in mid-afternoon
                diurnal_pm = 1.0 + 0.35 * math.cos((hour - 22) * 2 * math.pi / 24)
                # Ozone peaks around 14:00 (photochemical solar radiation)
                diurnal_o3 = 1.0 + 0.65 * math.cos((hour - 14) * 2 * math.pi / 24)
                # Weekend factor (slightly lower industrial / traffic emissions)
                weekend_factor = 0.88 if day_of_week >= 5 else 1.0
                noise = 1.0 + (random.random() - 0.5) * 0.15

                cur_pm25 = round(max(20.0, base_pm25 * diurnal_pm * weekend_factor * noise), 1)
                cur_pm10 = round(max(35.0, base_pm10 * diurnal_pm * weekend_factor * noise), 1)
                cur_no2 = round(max(15.0, base_no2 * (1.0 + 0.3 * math.cos((hour - 20) * 2 * math.pi / 24)) * noise), 1)
                cur_o3 = round(max(10.0, base_o3 * diurnal_o3 * noise), 1)
                cur_co = round(max(0.5, base_co * diurnal_pm * noise), 2)
                cur_so2 = round(max(5.0, base_so2 * noise), 1)

                # Simulated weather
                temp = round(22.0 + 7.0 * math.sin((hour - 8) * math.pi / 12), 1)
                humidity = round(max(30.0, min(95.0, 68.0 - 25.0 * math.sin((hour - 8) * math.pi / 12))), 1)
                wind_speed = round(max(1.0, 3.5 + 2.0 * math.sin((hour - 12) * math.pi / 12) + random.random()), 1)
                pressure = round(1012.0 - 3.0 * math.cos(hour * math.pi / 12), 1)

                overall_aqi, _, _ = calculate_overall_aqi(
                    pm25=cur_pm25, pm10=cur_pm10, o3=cur_o3, no2=cur_no2, co=cur_co, so2=cur_so2
                )

                records.append(historical_aqi_document(
                    timestamp=ts,
                    latitude=lat,
                    longitude=lon,
                    city=city,
                    pm25=cur_pm25,
                    pm10=cur_pm10,
                    o3=cur_o3,
                    no2=cur_no2,
                    co=cur_co,
                    so2=cur_so2,
                    temperature=temp,
                    humidity=humidity,
                    wind_speed=wind_speed,
                    pressure=pressure,
                    overall_aqi=overall_aqi,
                ))

            for r in records:
                await db.HistoricalAQI.update_one(
                    {"city": city, "timestamp": r["timestamp"]},
                    {"$set": r},
                    upsert=True,
                )
        logger.info(f"Seeded 7 days of historical records for {len(DELHI_NCR_CITIES)} Delhi NCR cities.")
    except Exception as exc:
        logger.error(f"Error seeding historical AQI data: {exc}")


async def run_hourly_scheduler(app):
    """Background task running every hour to collect and store AQI & weather."""
    await asyncio.sleep(5)  # Allow app startup to complete
    db = getattr(app.state, "db", None)
    provider = getattr(app.state, "provider", None)

    if db and provider:
        await seed_historical_data_if_needed(db, provider)

    while True:
        try:
            db = getattr(app.state, "db", None)
            provider = getattr(app.state, "provider", None)
            if db is not None and provider is not None:
                for city, coords in DELHI_NCR_CITIES.items():
                    await record_historical_observation(
                        db, city, coords["latitude"], coords["longitude"], provider
                    )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Error in hourly AQI collector: {exc}")

        await asyncio.sleep(3600)  # Sleep 1 hour

