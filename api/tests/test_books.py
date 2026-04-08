import pytest


@pytest.mark.asyncio
async def test_create_book(client, auth_headers):
    payload = {
        "isbn": "9780134757599",
        "title": "Refactoring",
        "author": "Martin Fowler",
        "publisher": "Addison-Wesley",
        "year": 2018,
        "data_complete": True,
    }
    resp = await client.post("/api/books", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["isbn"] == "9780134757599"
    assert data["data_complete"] is True


@pytest.mark.asyncio
async def test_create_book_duplicate_isbn(client, auth_headers):
    payload = {"isbn": "9780134757599", "title": "Refactoring"}
    await client.post("/api/books", json=payload, headers=auth_headers)
    resp = await client.post("/api/books", json=payload, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_books(client, auth_headers):
    await client.post("/api/books", json={"isbn": "111", "title": "A"}, headers=auth_headers)
    await client.post("/api/books", json={"isbn": "222", "title": "B"}, headers=auth_headers)
    resp = await client.get("/api/books", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_list_books_incomplete_filter(client, auth_headers):
    await client.post(
        "/api/books", json={"isbn": "333", "data_complete": False}, headers=auth_headers
    )
    await client.post(
        "/api/books", json={"isbn": "444", "data_complete": True}, headers=auth_headers
    )
    resp = await client.get("/api/books?incomplete_only=true", headers=auth_headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_update_book(client, auth_headers):
    create = await client.post(
        "/api/books", json={"isbn": "555", "title": "Old Title"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    resp = await client.patch(
        f"/api/books/{book_id}", json={"title": "New Title"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


@pytest.mark.asyncio
async def test_delete_book(client, auth_headers):
    create = await client.post(
        "/api/books", json={"isbn": "666", "title": "To Delete"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    resp = await client.delete(f"/api/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 204
    resp = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client):
    resp = await client.get("/api/books")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_book_with_condition(client, auth_headers):
    resp = await client.post(
        "/api/books",
        json={"isbn": "9780000000001", "title": "Cond Test", "condition": "Very Good"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["condition"] == "Very Good"


@pytest.mark.asyncio
async def test_update_book_condition(client, auth_headers):
    create = await client.post(
        "/api/books", json={"isbn": "9780000000002", "title": "No Cond"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    resp = await client.patch(
        f"/api/books/{book_id}", json={"condition": "Good"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["condition"] == "Good"


@pytest.mark.asyncio
async def test_book_condition_defaults_null(client, auth_headers):
    resp = await client.post(
        "/api/books", json={"isbn": "9780000000003"}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["condition"] is None


@pytest.mark.asyncio
async def test_delete_book_with_listing(client, auth_headers):
    """Deleting a book that has listings must succeed (FK cascade)."""
    create = await client.post(
        "/api/books", json={"isbn": "DELETE-CASCADE-TEST", "title": "Has Listing"}, headers=auth_headers
    )
    assert create.status_code == 201
    book_id = create.json()["id"]
    listing = await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    assert listing.status_code == 201
    resp = await client.delete(f"/api/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 204
    gone = await client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_create_book_needs_photo_review_default(client, auth_headers):
    resp = await client.post(
        "/api/books", json={"isbn": "9780001000001"}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["needs_photo_review"] is False


@pytest.mark.asyncio
async def test_create_book_needs_photo_review_true(client, auth_headers):
    resp = await client.post(
        "/api/books",
        json={"isbn": "9780001000002", "needs_photo_review": True},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["needs_photo_review"] is True


@pytest.mark.asyncio
async def test_update_book_needs_photo_review(client, auth_headers):
    create = await client.post(
        "/api/books", json={"isbn": "9780001000003"}, headers=auth_headers
    )
    book_id = create.json()["id"]
    resp = await client.patch(
        f"/api/books/{book_id}",
        json={"needs_photo_review": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["needs_photo_review"] is True
