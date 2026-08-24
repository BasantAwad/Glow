"""
Database session management and Base models.

This module provides the SQLAlchemy 2.0 async engine and session factory
configuration, plus the `Base` declarative class for ORM models.

Provider: PostgreSQL (via asyncpg and SQLAlchemy[asyncio]).
"""



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


# Naming convention for predictable constraint names in Alembic migrations.
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


class DatabaseManager:
    """Manages the database engine and session factory lifecycle.

    Because Glow uses an unconfigured DB in Phase 0/1 testing, this class
    tolerates a missing GLOW_DATABASE_URL by deferring engine creation.
    Routes that attempt to get a DB session will fail loudly with
    ProviderNotConfiguredError.
    """

    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    def initialize(self) -> None:
        """Initialize the database engine if a URL is configured."""
        if not settings.database_url:
            return  # Will fail on first session access

        # Translate `postgres://` to `postgresql+asyncpg://` if needed
        db_url = settings.database_url
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        self._engine = create_async_engine(
            db_url,
            echo=settings.environment == "development",
            future=True,
            pool_pre_ping=True,
        )
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
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
