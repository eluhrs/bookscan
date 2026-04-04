import pytest


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
