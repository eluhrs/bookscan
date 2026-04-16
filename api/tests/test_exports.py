"""Tests for the eBay CSV export endpoints."""
import csv
import io
import pytest
import pytest_asyncio
from pathlib import Path
from unittest.mock import patch
from httpx import AsyncClient
from tests._helpers import TestSession
from app.models import Book


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
        "ebay_category_id": 261186,
    }


def _parse_csv(content: bytes) -> list[dict]:
    """Parse CSV bytes into list of dicts keyed by header."""
    text = content.decode("utf-8")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if len(rows) < 2:
        return []
    header = rows[0]
    return [dict(zip(header, row)) for row in rows[1:]]


@pytest.mark.asyncio
async def test_export_csv_downloads(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000001"), headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "bookscan-export-" in resp.headers["content-disposition"]
    assert resp.headers["content-disposition"].endswith('.csv"')

    rows = _parse_csv(resp.content)
    assert len(rows) == 1

    data = rows[0]
    assert data["*Action(SiteID=US|Country=US|Currency=USD|Version=1193)"] == "Add"
    assert data["Title"] == "Test Book by Author"
    assert data["P:ISBN"] == '="9780000000001"'
    assert data["Custom label (SKU)"] == '="9780000000001"'
    assert data["Start price"] == "9.99"
    assert data["Quantity"] == "1"
    assert data["Format"] == "FixedPrice"
    assert data["Duration"] == "GTC"
    assert data["Category ID"] == "261186"
    assert data["Category name"] == "Books"
    assert "Location" in data  # column exists
    assert data["Condition ID"] == "5000"  # Good
    assert data["C:Book Title"] == "Test Book"
    assert data["C:Author"] == "Author"
    assert data["C:Language"] == "English"


@pytest.mark.asyncio
async def test_export_condition_mapping(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/books", json=_ready_book("9780000000002"), headers=auth_headers)
    book_id = resp.json()["id"]
    await client.patch(f"/api/books/{book_id}", json={"condition": "Very Good"}, headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    rows = _parse_csv(resp.content)
    assert rows[0]["Condition ID"] == "4000"


@pytest.mark.asyncio
async def test_export_archives_records(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000003"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1

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
    assert "text/csv" in resp.headers["content-type"]

    text = resp.content.decode("utf-8")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    assert len(rows) == 1  # header only


@pytest.mark.asyncio
async def test_undo_restores_books(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000005"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    resp = await client.post("/api/exports/batch/undo", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1

    resp = await client.get("/api/books", params={"status": "ready"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None


@pytest.mark.asyncio
async def test_dismiss_batch(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000006"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    resp = await client.delete("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 204

    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.json() is None

    resp = await client.get("/api/books", params={"status": "archived"}, headers=auth_headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_no_batch_returns_null(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/exports/batch", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_new_export_replaces_old_batch(client: AsyncClient, auth_headers: dict):
    await client.post("/api/books", json=_ready_book("9780000000007", title="Book One"), headers=auth_headers)
    await client.post("/api/exports", headers=auth_headers)

    resp = await client.post("/api/books", json=_ready_book("9780000000008", title="Book Two"), headers=auth_headers)
    book2_id = resp.json()["id"]
    await client.post("/api/exports", headers=auth_headers)

    resp = await client.get("/api/exports/batch", headers=auth_headers)
    body = resp.json()
    assert body["count"] == 1
    assert book2_id in body["book_ids"]


@pytest.mark.asyncio
async def test_export_requires_auth(client: AsyncClient):
    resp = await client.post("/api/exports")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_photo_urls_pipe_separated(client: AsyncClient, auth_headers: dict):
    """Photos should appear as pipe-separated signed URLs in the CSV."""
    book_data = _ready_book("9780000000102")
    resp = await client.post("/api/books", json=book_data, headers=auth_headers)
    book_id = resp.json()["id"]

    with patch("app.routers.photos.PHOTOS_DIR", Path("/tmp/bookscan_test_photos")):
        resp = await client.post(
            f"/api/books/{book_id}/photos",
            files=[("files", ("photo.jpg", b"FAKE_PHOTO_DATA", "image/jpeg"))],
            headers=auth_headers,
        )
    assert resp.status_code == 201

    with patch("app.routers.exports.settings") as mock_settings:
        mock_settings.photo_signing_secret = "test-secret"
        mock_settings.site_url = "https://test.example.com"
        mock_settings.ebay_shipping_profile = ""
        mock_settings.ebay_return_policy = ""
        mock_settings.ebay_payment_profile = ""
        mock_settings.ebay_shipping_location = ""
        resp = await client.post("/api/exports", headers=auth_headers)

    rows = _parse_csv(resp.content)
    assert len(rows) == 1
    photo_url_cell = rows[0]["Item photo URL"]
    assert "9780000000102_1.jpg" in photo_url_cell
    assert "expires=" in photo_url_cell
    assert "token=" in photo_url_cell


@pytest.mark.asyncio
async def test_export_no_photos_empty_cell(client: AsyncClient, auth_headers: dict):
    """Books with no photos should have empty Item photo URL."""
    await client.post("/api/books", json=_ready_book("9780000000103"), headers=auth_headers)

    resp = await client.post("/api/exports", headers=auth_headers)
    rows = _parse_csv(resp.content)
    assert rows[0]["Item photo URL"] == ""


@pytest.mark.asyncio
async def test_export_payment_profile_empty_ok(client: AsyncClient, auth_headers: dict):
    """Export should not crash when EBAY_PAYMENT_PROFILE is empty."""
    await client.post("/api/books", json=_ready_book("9780000000104"), headers=auth_headers)
    resp = await client.post("/api/exports", headers=auth_headers)
    assert resp.status_code == 200
    rows = _parse_csv(resp.content)
    assert "Payment profile name" in rows[0] or rows[0].get("Payment profile name", "") == ""
