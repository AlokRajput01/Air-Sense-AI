from contextlib import asynccontextmanager
import logging
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .api.router import api_router
from .config import settings
from .database import connect_database, close_database
from .errors import install_error_handlers
from .logging_config import configure_logging
from .services.providers import ProviderClient

configure_logging()
logger = logging.getLogger(__name__)


import asyncio
from .services.scheduler import run_hourly_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.provider = ProviderClient()
    await connect_database(app)
    scheduler_task = asyncio.create_task(run_hourly_scheduler(app))
    yield
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    await app.state.provider.close()
    await close_database(app)



app = FastAPI(title=settings.app_name, version="1.0.0", description="Real-source air quality, weather and fire intelligence API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False, allow_methods=["GET"], allow_headers=["*"])
install_error_handlers(app)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info("HTTP request", extra={"request_id": request_id, "method": request.method, "path": request.url.path, "status_code": response.status_code, "duration_ms": round((time.perf_counter() - started) * 1000, 2)})
    return response


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health/live", tags=["health"])
async def live():
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
async def ready(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        from fastapi import HTTPException
        raise HTTPException(503, "MongoDB is unavailable")
    try:
        await db.command("ping")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(503, "MongoDB is unavailable")
    return {"status": "ready", "dependencies": {"mongodb": "available"}}
