"""Database session management and Base models — SQLite-optimized.

This module provides the SQLAlchemy 2.0 async engine and session factory
configuration, plus the `Base` declarative class for ORM models.

SQLite tuning for concurrent async access:
- WAL journal mode for concurrent readers + single writer.
- SHORT_TIMEOUT connect_args so aiosqlite doesn't block the event loop
  waiting on a locked database.
- Connection pool tuned for low-concurrency async workloads.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from glow_api.settings import settings


# ---------------------------------------------------------------------------
# SQLAlchemy Declarative Base
# ---------------------------------------------------------------------------

POSTGRES_INDEXES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=POSTGRES_INDEXES_NAMING_CONVENTION)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    metadata = metadata


# ---------------------------------------------------------------------------
# Engine and Session
# ---------------------------------------------------------------------------

# How long (seconds) aiosqlite will wait for a locked database before
# raising OperationalError.  Keep this short so we never block the async
# event loop — a lock contention is better handled by retrying than by
# freezing the server.
_SQLITE_TIMEOUT = 5

# Extra connect args passed to aiosqlite for every new connection.
_SQLITE_CONNECT_ARGS = {
    "timeout": _SQLITE_TIMEOUT,
    # WAL mode lets concurrent readers proceed while a single writer holds
    # the lock.  Enable it once at startup (see _ensure_sqlite_wal below).
    "check_same_thread": False,
}


class DatabaseManager:
    """Manages the database engine and session factory lifecycle.

    Because Glow uses SQLite in local development, this class special-cases
    the SQLite driver to enable WAL mode and short lock timeouts so that
    concurrent async sessions don't deadlock.
    """

    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    def initialize(self) -> None:
        """Initialize the database engine if a URL is configured."""
        if not settings.database_url:
            return

        db_url = settings.database_url
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # SQLite-specific tuning
        connect_args: dict[str, Any] = {}
        engine_kwargs: dict[str, Any] = {
            "echo": settings.environment == "development",
            "future": True,
            "pool_pre_ping": True,
            "pool_size": 5,
            "max_overflow": 10,
            "pool_timeout": 30,
            "pool_recycle": 3600,
        }
        if db_url.startswith("sqlite"):
            connect_args.update(_SQLITE_CONNECT_ARGS)
            engine_kwargs["connect_args"] = connect_args
            # SQLite serializes writers; a tiny pool avoids needless churn.
            engine_kwargs["pool_size"] = 2
            engine_kwargs["max_overflow"] = 3

        self._engine = create_async_engine(db_url, **engine_kwargs)
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

    async def configure_sqlite(self) -> None:
        """Enable WAL journal mode so concurrent reads don't block writes.

        Called from the async application lifespan after engine initialization.
        """
        if self._engine is None or not str(self._engine.url).startswith("sqlite"):
            return
        try:
            async with self._engine.begin() as conn:
                from sqlalchemy import text

                await conn.execute(text("PRAGMA journal_mode=WAL"))
                await conn.execute(
                    text(f"PRAGMA busy_timeout={_SQLITE_TIMEOUT * 1000}")
                )
        except Exception as exc:
            # Non-fatal: the server still works without WAL, just slower.
            import logging

            logging.getLogger("glow_api.database").warning(
                "Failed to enable SQLite WAL mode: %s", exc
            )

    async def close(self) -> None:
        """Close the database engine."""
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Provide a transactional scope around a series of operations."""
        if self._session_factory is None:
            from glow_api.errors import ProviderNotConfiguredError
            raise ProviderNotConfiguredError("database")

        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise


db_manager = DatabaseManager()


# ---------------------------------------------------------------------------
# FastAPI Dependency
# ---------------------------------------------------------------------------


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency for yielding a database session."""
    async with db_manager.session() as session:
        yield session
