from fastapi import APIRouter
from ..routes.endpoints import router as data_router

api_router = APIRouter()
api_router.include_router(data_router, tags=["AirSense data"])
