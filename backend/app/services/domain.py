from datetime import datetime, timezone


async def save_weather(db, weather: dict) -> None:
    doc = {**weather, "location": {"type": "Point", "coordinates": [weather["location"]["longitude"], weather["location"]["latitude"]]}}
    await db.weather_observations.insert_one(doc)


async def save_fires(db, hotspots: list[dict]) -> None:
    for item in hotspots:
        doc = {**item, "fetched_at": datetime.now(timezone.utc), "schema_version": 1, "location": {"type": "Point", "coordinates": [item["longitude"], item["latitude"]]}}
        await db.fire_hotspots.update_one({"source": "NASA FIRMS", "source_id": item["source_id"]}, {"$set": doc}, upsert=True)


def inversion_indicator(weather: dict):
    # Surface observations cannot establish a vertical temperature inversion.
    return {"status": "unavailable", "indicator": None, "explanation": "A surface weather observation cannot establish a vertical temperature inversion. A validated vertical temperature profile is required.", "inputs": {"surface_temperature_c": weather.get("temperature_c"), "pressure_hpa": weather.get("pressure_hpa"), "wind_speed_mps": weather.get("wind_speed_mps")}, "observed_at": weather["observed_at"]}
