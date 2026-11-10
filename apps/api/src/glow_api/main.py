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


class HealthResponse(BaseModel):
    """Public, non-sensitive process health response."""

    status: str
    service: str
    environment: str


def _cors_origins(settings: Settings) -> list[str]:
    """Resolve allowed browser origins.

    Credentials cannot be used with a wildcard origin, so development defaults to
    common local web origins. Production requires explicit configuration.
    """
    if settings.cors_origins:
        return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if settings.environment == "production":
        return []
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API application."""

    active_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        db_manager.initialize()
        await db_manager.configure_sqlite()
        try:
            await _ensure_tables()
        except Exception as exc:  # noqa: BLE001
            # Never let a transient database problem crash the whole
            # serverless function. The app still boots and /healthz responds;
            # individual DB-backed endpoints surface their own errors.
            logger.error("Database startup check failed: %s", exc)
        yield
        await db_manager.close()

    async def _ensure_tables() -> None:
        """Create tables after engine init.

        This is a local/dev convenience. Production and controlled pilots should
        use Alembic migrations as the source of truth.
        """
        if db_manager._engine is None:
            logger.warning("No DB engine — skipping table creation")
            return
        from glow_api.database import Base

        async with db_manager._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Lightweight forward-compatible migration for local/dev SQLite and
            # pilot Postgres databases. Production should still use Alembic.
            def _ensure_wellness_columns(sync_conn) -> None:
                from sqlalchemy import inspect, text

                inspector = inspect(sync_conn)
                if "mood_entries" not in inspector.get_table_names():
                    return
                columns = {c["name"] for c in inspector.get_columns("mood_entries")}
                if "emotions_json" not in columns:
                    sync_conn.execute(
                        text("ALTER TABLE mood_entries ADD COLUMN emotions_json TEXT")
                    )

                if "users" in inspector.get_table_names():
                    user_columns = {c["name"] for c in inspector.get_columns("users")}
                    blob_type = "BYTEA" if sync_conn.dialect.name == "postgresql" else "BLOB"
                    for column, ddl in (
                        ("gender", "ALTER TABLE users ADD COLUMN gender VARCHAR(20)"),
                        ("age", "ALTER TABLE users ADD COLUMN age INTEGER"),
                        (
                            "medications_encrypted",
                            f"ALTER TABLE users ADD COLUMN medications_encrypted {blob_type}",
                        ),
                        (
                            "medications_key_id",
                            "ALTER TABLE users ADD COLUMN medications_key_id VARCHAR(64)",
                        ),
                        (
                            "email_verified_at",
                            "ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ",
                        ),
                    ):
                        if column not in user_columns:
                            sync_conn.execute(text(ddl))

            await conn.run_sync(_ensure_wellness_columns)
        logger.info("Database tables created/verified")

    app = FastAPI(
        title="Glow API",
        version="0.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    origins = _cors_origins(active_settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        if active_settings.environment != "production" and not origins
        else None,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
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

    from glow_api.routers.session_history import router as session_history_router

    app.include_router(session_router)
    app.include_router(avatar_router)
    app.include_router(session_extras_router)
    app.include_router(session_history_router)
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
