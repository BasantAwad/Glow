"""FastAPI application factory for Glow's non-sensitive baseline."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

from glow_api.settings import Settings, get_settings
from glow_api.routers.session_router import router as session_router
from glow_api.routers.avatar import router as avatar_router
from glow_api.routers.session_extras import router as session_extras_router
from glow_api.logging import configure_logging
from glow_api.database import db_manager
from glow_api.errors import AuthenticationError, AuthorizationError
import logging
import time
from fastapi import Request
from fastapi.responses import JSONResponse

configure_logging()

logger = logging.getLogger("glow_api")


def _init_database() -> None:
    """Initialize the database on module import (sync startup).

    This mirrors the FastAPI lifespan pattern — the DB is available
    by the time the first request arrives.
    """
    db_manager.initialize()
    if db_manager._engine is not None:
        logger.info("Database engine initialized (%s)", db_manager._engine.url)
        # Create tables if they don't exist yet (first-run convenience).
        # Use asyncio.get_event_loop() instead of asyncio.run() because uvicorn
        # may already have an event loop running when this is called at import.
        import asyncio as _asyncio
        try:
            loop = _asyncio.get_event_loop()
        except RuntimeError:
            loop = _asyncio.new_event_loop()
            _asyncio.set_event_loop(loop)
        if loop.is_running():
            # Defer to the running loop via a callback — tables will be
            # created before the first request completes.
            def _deferred_create() -> None:
                from glow_api.database import Base
                import asyncio as _a

                async def _create() -> None:
                    async with db_manager._engine.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)

                _a.create_task(_create())

            loop.call_soon_threadsafe(_deferred_create)
            logger.info("Database tables creation deferred to running event loop")
        else:
            async def _create_tables() -> None:
                from glow_api.database import Base
                async with db_manager._engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)

            loop.run_until_complete(_create_tables())
            logger.info("Database tables verified/created")
    else:
        logger.warning(
            "Database engine NOT initialized — GLOW_DATABASE_URL may be unset. "
            "DB-dependent endpoints will return 503."
        )


class HealthResponse(BaseModel):
    """Public, non-sensitive process health response."""

    status: str
    service: str
    environment: str


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API without connecting to any data, model, or safety provider."""

    active_settings = settings or get_settings()
    _init_database()  # Eager DB init for factory-created apps
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

    # Exception handlers for clean HTTP responses
    @app.exception_handler(AuthenticationError)
    async def auth_error_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content={"error": exc.detail, "code": exc.code})

    @app.exception_handler(AuthorizationError)
    async def authz_error_handler(request: Request, exc: AuthorizationError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content={"error": exc.detail, "code": exc.code})

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
    app.include_router(session_extras_router)

    return app


# Initialize the database eagerly on module import so that the first request
# does not race against engine creation.
_init_database()

app = create_app()
