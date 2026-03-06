"""
database.py  —  Async SQLAlchemy engine + session factory
Supports:
  • PostgreSQL (production) via DATABASE_URL env var
  • SQLite     (local dev)  when DATABASE_URL is not set
"""

import os
import logging

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

log = logging.getLogger("safetyhub.db")

# ── Determine database URL ────────────────────────────────────
_raw_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./safetyhub.db")

# Render / Heroku supply postgres:// but SQLAlchemy 2.x needs postgresql+asyncpg://
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _raw_url

log.info("Database URL scheme: %s", DATABASE_URL.split("://")[0])

# ── Engine ────────────────────────────────────────────────────
_connect_args = {}
if "sqlite" in DATABASE_URL:
    _connect_args = {"check_same_thread": False}

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,             # set True to log SQL queries during dev
    pool_pre_ping=True,     # test connection before using from pool
    pool_recycle=300,       # recycle connections every 5 min
    connect_args=_connect_args,
)

# ── Session factory ───────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ── Base class for ORM models ─────────────────────────────────
class Base(DeclarativeBase):
    pass

# ── DB init (create tables) ───────────────────────────────────
async def init_db():
    """Create all tables on startup if they don't exist."""
    # Import models so their metadata is registered before create_all
    from models import SensorReading  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database tables verified / created")

# ── FastAPI dependency ────────────────────────────────────────
async def get_db():
    """Yield an async session; close it when the request is done."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
