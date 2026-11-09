FROM python:3.13-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY apps/api/pyproject.toml apps/api/README.md ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115,<1" \
    "pydantic-settings>=2.5,<3" \
    "uvicorn[standard]>=0.30,<1" \
    "sqlalchemy[asyncio]>=2.0,<3" \
    "alembic>=1.13,<2" \
    "asyncpg>=0.29,<1" \
    "pgvector>=0.3.6,<1" \
    "httpx>=0.27,<1" \
    "cryptography>=41.0,<44" \
    "faster-whisper>=1.0.3,<2" \
    "pyjwt>=2.8,<3" \
    "aiosqlite>=0.19,<2"

# Copy source
COPY apps/api/src ./src

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM python:3.13-slim

WORKDIR /app

# Runtime dependencies (ffmpeg for faster-whisper if needed, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /build/src ./src

ENV GLOW_ENVIRONMENT=production
ENV GLOW_DATABASE_URL=sqlite+aiosqlite:///./glow.db
ENV GLOW_AUTH_SECRET_KEY=change-me-in-production-min-32-bytes-hex
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn glow_api.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info"]
