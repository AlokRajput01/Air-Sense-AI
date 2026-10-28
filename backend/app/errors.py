from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

logger = logging.getLogger(__name__)


class ProviderUnavailable(Exception):
    def __init__(self, provider: str, detail: str = "The data provider is unavailable"):
        self.provider, self.detail = provider, detail


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProviderUnavailable)
    async def provider_error(request: Request, exc: ProviderUnavailable):
        request_id = getattr(request.state, "request_id", "unknown")
        return JSONResponse(status_code=503, headers={"Retry-After": "30"}, content={"error": {"code": "provider_unavailable", "message": "Data Currently Unavailable", "provider": exc.provider, "detail": exc.detail, "request_id": request_id, "retryable": True}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": "Request parameters are invalid", "fields": [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()], "request_id": getattr(request.state, "request_id", "unknown"), "retryable": False}})

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, headers=exc.headers, content={"error": {"code": "http_error", "message": str(exc.detail), "request_id": getattr(request.state, "request_id", "unknown"), "retryable": exc.status_code >= 500}})

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.exception("Unhandled request error", extra={"request_id": getattr(request.state, "request_id", "unknown")})
        return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "An unexpected server error occurred", "request_id": getattr(request.state, "request_id", "unknown"), "retryable": False}})
