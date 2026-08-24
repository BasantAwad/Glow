"""FastAPI application factory for Glow's non-sensitive baseline."""

from fastapi import FastAPI
from pydantic import BaseModel

from glow_api.settings import Settings, get_settings
from glow_api.routers.session_router import router as session_router
from glow_api.routers.avatar import router as avatar_router
from glow_api.logging import configure_logging
import logging
import time
from fastapi import Request


class HealthResponse(BaseModel):
    """Public, non-sensitive process health response."""

    status: str
    service: str
    environment: str


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API without connecting to any data, model, or safety provider."""

    active_settings = settings or get_settings()
    app = FastAPI(
        title="Glow API",
        version="0.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz", response_model=HealthResponse, include_in_schema=False)
    async def health_check() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=active_settings.service_name,
            environment=active_settings.environment,
        )

    # Note: Full payload logging is omitted to prevent therapy data from entering logs
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger = logging.getLogger("glow_api.http")
        start_time = time.time()
        
        # We DO NOT log request body because it could contain therapy transcript text.
        
        response = await call_next(request)
        process_time = time.time() - start_time
        
        logger.info(f"{request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")
        
        return response

    app.include_router(session_router)
    app.include_router(avatar_router)

    return app


configure_logging()
app = create_app()

