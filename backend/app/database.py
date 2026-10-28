import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

logger = logging.getLogger(__name__)


async def connect_database(app) -> None:
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=4000)
    app.state.mongo_client = client
    app.state.db = None
    try:
        db = client[settings.mongodb_database]
        await client.admin.command("ping")
        await ensure_indexes(db)
        app.state.db = db
        logger.info("MongoDB connected")
    except Exception:
        # Keep provider-backed reads available when MongoDB is offline. Readiness
        # continues to report the missing database dependency.
        app.state.db = None
        logger.exception("MongoDB connection/index setup failed")


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.observations.create_index([("source", 1), ("station_id", 1), ("observed_at", 1)], unique=True)
    await db.observations.create_index([("location", "2dsphere")])
    await db.weather_observations.create_index([("location", "2dsphere")])
    await db.weather_observations.create_index([("observed_at", -1)])
    await db.fire_hotspots.create_index([("source", 1), ("source_id", 1)], unique=True)
    await db.fire_hotspots.create_index([("location", "2dsphere")])
    await db.fire_hotspots.create_index([("acquired_at", -1)])
    await db.forecasts.create_index([("cell", 1), ("model_version", 1), ("target_at", 1), ("pollutant", 1)], unique=True)
    await db.audit_events.create_index([("time", -1)])
    await db.HistoricalAQI.create_index([("city", 1), ("timestamp", -1)])
    await db.HistoricalAQI.create_index([("city", 1), ("timestamp", 1)], unique=True)
    await db.HistoricalAQI.create_index([("latitude", 1), ("longitude", 1), ("timestamp", -1)])
    await db.HistoricalAQI.create_index([("timestamp", -1)])


async def close_database(app) -> None:
    client = getattr(app.state, "mongo_client", None)
    if client:
        client.close()
