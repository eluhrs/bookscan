"""Shared test infrastructure — engine + session maker for the test DB.

The engine is file-based (not ``:memory:``) so that the multiple connections
opened by the setup_db fixture, the route's ``Depends(get_db)`` session, and
any subsequent session within a single test all see the same tables. The
file is created in ``/tmp`` and reset per test by the autouse ``setup_db``
fixture in conftest.py.
"""
import tempfile
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

# Use a persistent path under /tmp so the same SQLite file is shared across
# all connections opened in the test session. Tables are dropped and recreated
# per test by the autouse setup_db fixture.
_TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "bookscan_test.db")
TEST_DB_URL = f"sqlite+aiosqlite:///{_TEST_DB_PATH}"
test_engine = create_async_engine(TEST_DB_URL)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)
