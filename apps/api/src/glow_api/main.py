"""FastAPI application factory for Glow's non-sensitive baseline."""

from fastapi import FastAPI
from pydantic import BaseModel

from glow_api.settings import Settings, get_settings
from glow_api.routers.session_router import router as session_router
from glow_api.routers.avatar import router as avatar_router


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

    app.include_router(session_router)
    app.include_router(avatar_router)

    return app


app = create_app()

