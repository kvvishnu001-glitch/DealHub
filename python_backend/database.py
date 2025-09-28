import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
# import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Convert postgres:// to postgresql:// for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# For async support, we need to use postgresql+asyncpg
if not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Handle SSL mode for asyncpg - convert sslmode parameter to connect_args
if "?sslmode=require" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("?sslmode=require", "")
    connect_args = {"ssl": "require"}
elif "sslmode=require" in DATABASE_URL:
    # Remove sslmode from URL and handle it in connect_args
    parts = DATABASE_URL.split("?")
    if len(parts) > 1:
        params = parts[1].split("&")
        filtered_params = [p for p in params if not p.startswith("sslmode=")]
        if filtered_params:
            DATABASE_URL = parts[0] + "?" + "&".join(filtered_params)
        else:
            DATABASE_URL = parts[0]
    connect_args = {"ssl": "require"}
else:
    connect_args = {}

# Create async engine with connection pooling
engine = create_async_engine(
    DATABASE_URL, 
    connect_args=connect_args,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True,
    pool_recycle=300
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_database():
    """Initialize database tables"""
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)