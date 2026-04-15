import pytest


@pytest.mark.asyncio
async def test_create_book(client, auth_headers):
    payload = {
        "isbn": "9780134757599",
        "title": "Refactoring",
        "author": "Martin Fowler",
        "publisher": "Addison-Wesley",
        "year": 2018,
        "needs_metadata_review": False,
    }
    resp = await client.post("/api/books", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["isbn"] == "9780134757599"
    assert data["needs_metadata_review"] is False


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
        "/api/books", json={"isbn": "333", "needs_metadata_review": True}, headers=auth_headers
    )
    await client.post(
        "/api/books", json={"isbn": "444", "needs_metadata_review": False}, headers=auth_headers
    )
    resp = await client.get("/api/books?status=needs_metadata_review", headers=auth_headers)
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


@pytest.mark.asyncio
async def test_create_book_schedules_ai_summary_when_description_empty(
    client, auth_headers, monkeypatch
):
    calls: list = []

    async def fake_task(book_id, **kw):
        calls.append(book_id)

    monkeypatch.setattr(
        "app.routers.books.generate_and_store_summary", fake_task, raising=False
    )
    monkeypatch.setattr("app.routers.books.settings.gemini_api_key", "fake-key", raising=False)

    resp = await client.post(
        "/api/books",
        headers=auth_headers,
        json={"isbn": "9780000000101", "title": "Test", "author": "A", "year": 2000, "publisher": "P"},
    )
    assert resp.status_code == 201
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_create_book_does_not_schedule_when_description_present(
    client, auth_headers, monkeypatch
):
    calls: list = []

    async def fake_task(book_id, **kw):
        calls.append(book_id)

    monkeypatch.setattr(
        "app.routers.books.generate_and_store_summary", fake_task, raising=False
    )
    monkeypatch.setattr("app.routers.books.settings.gemini_api_key", "fake-key", raising=False)

    resp = await client.post(
        "/api/books",
        headers=auth_headers,
        json={
            "isbn": "9780000000102",
            "title": "Test",
            "description": "Already has one",
            "description_source": "google_books",
        },
    )
    assert resp.status_code == 201
    assert len(calls) == 0


@pytest.mark.asyncio
async def test_create_book_does_not_schedule_when_no_api_key(
    client, auth_headers, monkeypatch
):
    calls: list = []

    async def fake_task(book_id, **kw):
        calls.append(book_id)

    monkeypatch.setattr(
        "app.routers.books.generate_and_store_summary", fake_task, raising=False
    )
    monkeypatch.setattr("app.routers.books.settings.gemini_api_key", None, raising=False)

    resp = await client.post(
        "/api/books",
        headers=auth_headers,
        json={"isbn": "9780000000103", "title": "Test"},
    )
    assert resp.status_code == 201
    assert len(calls) == 0


@pytest.mark.asyncio
async def test_status_filter_needs_description_review(client, auth_headers):
    from tests._helpers import TestSession
    from app.models import Book
    async with TestSession() as db:
        db.add(Book(isbn="9780000000010", title="A", needs_description_review=True))
        db.add(Book(isbn="9780000000011", title="B", needs_description_review=False))
        await db.commit()

    resp = await client.get("/api/books?status=needs_description_review", headers=auth_headers)
    assert resp.status_code == 200
    isbns = [b["isbn"] for b in resp.json()["items"]]
    assert "9780000000010" in isbns
    assert "9780000000011" not in isbns


@pytest.mark.asyncio
async def test_status_filter_ready_excludes_description_review(client, auth_headers):
    from tests._helpers import TestSession
    from app.models import Book
    async with TestSession() as db:
        db.add(Book(
            isbn="9780000000020",
            title="Ready",
            needs_metadata_review=False,
            needs_photo_review=False,
            needs_description_review=False,
        ))
        db.add(Book(
            isbn="9780000000021",
            title="NotReady",
            needs_metadata_review=False,
            needs_photo_review=False,
            needs_description_review=True,
        ))
        await db.commit()

    resp = await client.get("/api/books?status=ready", headers=auth_headers)
    assert resp.status_code == 200
    isbns = [b["isbn"] for b in resp.json()["items"]]
    assert "9780000000020" in isbns
    assert "9780000000021" not in isbns
