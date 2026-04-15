"""Shared test infrastructure — engine + session maker for the in-memory test DB.

Both conftest.py and individual test modules import from here so they all share
the same engine instance (and therefore the same in-memory database tables).
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)
