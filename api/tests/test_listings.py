import types
import pytest
from app.routers.listings import generate_listing_text
from app.models import Book
import uuid


def make_book(**kwargs) -> Book:
    defaults = dict(
        id=uuid.uuid4(),
        isbn="9780134757599",
        title="Refactoring",
        author="Martin Fowler",
        publisher="Addison-Wesley",
        edition="2nd ed.",
        year=2018,
        pages=448,
        dimensions=None,
        weight=None,
        subject="Software Engineering",
        description="Improving the design of existing code.",
        cover_image_url=None,
        cover_image_local=None,
        data_sources={},
        data_complete=True,
        condition=None,
    )
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


def test_listing_title_format():
    book = make_book()
    text = generate_listing_text(book)
    assert "LISTING TITLE: Refactoring by Martin Fowler (2018) 2nd ed. - Addison-Wesley" in text


def test_listing_includes_condition():
    book = make_book()
    text = generate_listing_text(book)
    assert "CONDITION: Used" in text


def test_listing_includes_description():
    book = make_book()
    text = generate_listing_text(book)
    assert "Improving the design of existing code." in text


def test_listing_handles_missing_fields():
    book = make_book(title=None, author=None, year=None, publisher=None, edition=None)
    text = generate_listing_text(book)
    assert "LISTING TITLE: Unknown by Unknown (n.d.) - Unknown" in text


def test_listing_no_edition_in_title():
    book = make_book(edition=None)
    text = generate_listing_text(book)
    assert "LISTING TITLE: Refactoring by Martin Fowler (2018) - Addison-Wesley" in text


@pytest.mark.asyncio
async def test_create_listing_endpoint(client, auth_headers):
    # Create a book first
    book_resp = await client.post(
        "/api/books",
        json={"isbn": "9780134757599", "title": "Refactoring", "author": "Fowler", "publisher": "AW", "year": 2018},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    resp = await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    assert resp.status_code == 201
    assert "LISTING TITLE: Refactoring" in resp.json()["listing_text"]


@pytest.mark.asyncio
async def test_get_book_listings(client, auth_headers):
    book_resp = await client.post(
        "/api/books", json={"isbn": "111222"}, headers=auth_headers
    )
    book_id = book_resp.json()["id"]
    await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    resp = await client.get(f"/api/books/{book_id}/listings", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_all_listings(client, auth_headers):
    book_resp = await client.post(
        "/api/books",
        json={"isbn": "9999999999", "title": "All Listings Test"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    resp = await client.get("/api/listings", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert any(item["book_id"] == book_id for item in data)


@pytest.mark.asyncio
async def test_get_all_listings_csv(client, auth_headers):
    book_resp = await client.post(
        "/api/books",
        json={"isbn": "8888888888", "title": "CSV Export Test", "author": "Auth", "condition": "Good"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    await client.post(f"/api/books/{book_id}/listings", headers=auth_headers)
    resp = await client.get("/api/listings?format=csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().splitlines()
    header = lines[0]
    assert "title" in header
    assert "condition" in header
    assert "isbn" in header
    assert "listing_text" in header
    # Data row contains the book's title
    assert "CSV Export Test" in resp.text


@pytest.mark.asyncio
async def test_csv_includes_books_without_listings(client, auth_headers):
    """Books with no listing must still appear as a row in the CSV."""
    resp = await client.post(
        "/api/books",
        json={"isbn": "NO-LISTING-CSV", "title": "No Listing Book", "author": "Nobody"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    csv_resp = await client.get("/api/listings?format=csv", headers=auth_headers)
    assert csv_resp.status_code == 200
    assert "No Listing Book" in csv_resp.text


def test_listing_uses_condition():
    book = make_book(condition="Very Good")
    text = generate_listing_text(book)
    assert "CONDITION: Very Good" in text


def test_listing_condition_defaults_to_used():
    book = make_book(condition=None)
    text = generate_listing_text(book)
    assert "CONDITION: Used" in text
