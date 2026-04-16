"""Tests for the eBay CSV export endpoints."""
import csv
import io
import pytest
import pytest_asyncio
from httpx import AsyncClient


def _ready_book(isbn, title="Test Book", author="Author"):
    """Payload for a book that passes the 'ready' filter."""
    return {
        "isbn": isbn,
        "title": title,
        "author": author,
        "publisher": "Pub",
        "year": 2020,
        "needs_metadata_review": False,
        "needs_photo_review": False,
        "needs_description_review": False,
        "price": 9.99,
        "condition": "Good",
        "ebay_category_id": 279,
    }


@pytest.mark.asyncio
async def test_export_csv_downloads(client: AsyncClient, auth_headers: dict):
    # Create a ready book
    await client.post("/api/books", json=_ready_book("9780000000001"), headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "bookscan-export-" in resp.headers["content-disposition"]

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    assert len(rows) == 2  # header + 1 data row
    header = rows[0]
    assert "Action" in header
    assert "Title" in header
    assert "ISBN" in header
    assert "StartPrice" in header
    assert "ConditionID" in header
    assert "PictureName" in header

    data = dict(zip(header, rows[1]))
    assert data["Action"] == "Add"
    assert data["Title"] == "Test Book by Author"
    assert data["ISBN"] == "9780000000001"
    assert data["StartPrice"] == "9.99"
    assert data["Quantity"] == "1"
    assert data["Format"] == "FixedPrice"
    assert data["Duration"] == "GTC"
    assert data["Category"] == "279"
    assert data["ConditionID"] == "5000"  # Good


@pytest.mark.asyncio
async def test_export_condition_mapping(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/books", json=_ready_book("9780000000002"), headers=auth_headers)
    book_id = resp.json()["id"]
    await client.patch(f"/api/books/{book_id}", json={"condition": "Very Good"}, headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    header = rows[0]
    data = dict(zip(header, rows[1]))
    assert data["ConditionID"] == "4000"


@pytest.mark.asyncio
async def test_export_archives_records(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000003"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Book should now be archived
    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    # And not in the ready filter
    resp = await client.get("/api/books", params={"status": "ready"}, headers=auth_headers)
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_export_creates_batch(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/books", json=_ready_book("9780000000004"), headers=auth_headers)
    book_id = resp.json()["id"]

    await client.post("/api/exports", headers=auth_headers)

    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert body["count"] == 1
    assert book_id in body["book_ids"]


@pytest.mark.asyncio
async def test_export_no_ready_books_returns_empty(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    assert len(rows) == 1  # header only


@pytest.mark.asyncio
async def test_undo_restores_books(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000005"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Undo
    resp = await client.post("/api/exports/batch/undo", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1

    # Book should be back in ready
    resp = await client.get("/api/books", params={"status": "ready"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    # Batch should be gone
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None


@pytest.mark.asyncio
async def test_dismiss_batch(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000006"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Dismiss
    resp = await client.delete("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 204

    # Batch is gone
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None

    # But book is still archived
    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_no_batch_returns_null(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_new_export_replaces_old_batch(client: AsyncClient, auth_headers: dict):
    # First book + export
    await client.post("/api/books", json=_ready_book("9780000000007", title="Book One"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    # Second book + export
    resp = await client.post("/api/books", json=_ready_book("9780000000008", title="Book Two"), headers=auth_headers)
    book2_id = resp.json()["id"]
    await client.post("/api/exports", headers=auth_headers)

    # Batch should only contain the second book
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    body = resp.json()
    assert body["count"] == 1
    assert book2_id in body["book_ids"]


@pytest.mark.asyncio
async def test_export_requires_auth(client: AsyncClient):
    resp = await client.post("/api/exports")
    assert resp.status_code == 401
