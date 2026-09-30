"""FastAPI application factory for Glow's non-sensitive baseline."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from glow_api.database import db_manager
from glow_api.errors import GlowError
from glow_api.logging import configure_logging
from glow_api.routers.account_router import router as account_router
from glow_api.routers.avatar import router as avatar_router
from glow_api.routers.billing_router import router as billing_router
from glow_api.routers.dev_bootstrap import router as dev_bootstrap_router
from glow_api.routers.session_extras import router as session_extras_router
from glow_api.routers.session_router import router as session_router
from glow_api.settings import Settings, get_settings

configure_logging()

logger = logging.getLogger("glow_api")


def _init_database() -> None:
    """Initialize the database engine and create tables when available."""
    db_manager.initialize()
    if db_manager._engine is None:
        logger.warning(
            "Database engine NOT initialized — GLOW_DATABASE_URL may be unset. "
            "DB-dependent endpoints will return 503."
        )
        return

    logger.info("Database engine initialized (%s)", db_manager._engine.url)
    try:
        import asyncio as _asyncio

        loop = _asyncio.get_event_loop()
    except RuntimeError:
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)

    if loop.is_running():

        def _deferred_create() -> None:
            from glow_api.database import Base
            import asyncio as _a

            async def _create() -> None:
                async with db_manager._engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)

            _a.create_task(_create())

        loop.call_soon_threadsafe(_deferred_create)
        logger.info("Database tables creation deferred to running event loop")
        return

    async def _create_tables() -> None:
        from glow_api.database import Base

        async with db_manager._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    loop.run_until_complete(_create_tables())
    logger.info("Database tables verified/created")


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

    @app.exception_handler(GlowError)
    async def glow_error_handler(request: Request, exc: GlowError) -> JSONResponse:
        logger = logging.getLogger("glow_api.errors")
        if exc.http_status >= 500:
            logger.error(f"GlowError: {exc.code} - {exc.detail}")
        else:
            logger.info(f"GlowError: {exc.code} - {exc.detail}")

        return JSONResponse(
            status_code=exc.http_status,
            content={
                "error": exc.code,
                "detail": exc.detail if exc.safe_for_client else "An error occurred.",
            },
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
    app.include_router(session_extras_router)
    app.include_router(dev_bootstrap_router)
    app.include_router(account_router)
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


app = create_app()
