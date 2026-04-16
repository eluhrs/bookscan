import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt


@pytest.mark.asyncio
async def test_login_success(client):
    resp = await client.post(
        "/api/login", data={"username": "testuser", "password": "testpass"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post(
        "/api/login", data={"username": "testuser", "password": "wrongpass"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/api/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_token(client, auth_headers):
    resp = await client.get("/api/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


@pytest.mark.asyncio
async def test_refresh_token_header_present(client, auth_headers):
    """FEAT-01: authenticated requests receive X-Refresh-Token header."""
    resp = await client.get("/api/me", headers=auth_headers)
    assert resp.status_code == 200
    assert "x-refresh-token" in resp.headers


@pytest.mark.asyncio
async def test_refresh_token_is_valid_jwt(client, auth_headers):
    """FEAT-01: the refresh token is a valid JWT with extended expiry."""
    resp = await client.get("/api/me", headers=auth_headers)
    refresh = resp.headers["x-refresh-token"]
    from app.config import settings
    payload = jwt.decode(refresh, settings.secret_key, algorithms=["HS256"])
    assert payload["sub"] == "testuser"
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    now = datetime.now(timezone.utc)
    remaining = (exp - now).total_seconds()
    # Should be close to 12 hours (within 60 seconds tolerance)
    assert 11 * 3600 < remaining < 12 * 3600 + 60


@pytest.mark.asyncio
async def test_no_refresh_when_token_near_expiry(client):
    """FEAT-01: no X-Refresh-Token when token has < 1 hour remaining."""
    from app.config import settings
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    short_token = jwt.encode(
        {"sub": "testuser", "exp": expire},
        settings.secret_key,
        algorithm="HS256",
    )
    resp = await client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {short_token}"},
    )
    assert resp.status_code == 200
    assert "x-refresh-token" not in resp.headers


@pytest.mark.asyncio
async def test_expired_token_returns_401(client):
    """FEAT-01: expired tokens get 401."""
    from app.config import settings
    expire = datetime.now(timezone.utc) - timedelta(minutes=5)
    expired_token = jwt.encode(
        {"sub": "testuser", "exp": expire},
        settings.secret_key,
        algorithm="HS256",
    )
    resp = await client.get(
        "/api/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401
