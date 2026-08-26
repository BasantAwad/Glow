"""FastAPI application factory for Glow's non-sensitive baseline."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from pydantic import BaseModel

from glow_api.logging import configure_logging
from glow_api.routers.avatar import router as avatar_router
from glow_api.routers.session_router import router as session_router
from glow_api.settings import Settings, get_settings


class HealthResponse(BaseModel):
    """Public, non-sensitive process health response."""

    status: str
    service: str
    environment: str


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API without connecting to any data, model, or safety provider."""

    active_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        from glow_api.database import db_manager
        db_manager.initialize()
        yield
        await db_manager.close()

    app = FastAPI(
        title="Glow API",
        version="0.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
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

    # Dev-only bootstrap (404s in production; see module docstring).
    from glow_api.routers.dev_bootstrap import router as dev_bootstrap_router
    app.include_router(dev_bootstrap_router)

    from glow_api.routers.account_router import router as account_router
    app.include_router(account_router)

    from glow_api.routers.billing_router import router as billing_router
    app.include_router(billing_router)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        """OWASP hardening headers on every response."""
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), geolocation=(), payment=()"
        )
        # HSTS only in production (TLS terminated upstream in dev).
        if active_settings.environment == "production":
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response

    return app


configure_logging()
app = create_app()

