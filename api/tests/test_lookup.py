import pytest
from app.services.lookup import BookData, merge_results, is_metadata_complete


def make_ol() -> BookData:
    return BookData(
        title="The Python Way",
        author="Jane Smith",
        publisher="O'Reilly",
        year=2020,
        pages=350,
        description="OL description",
        cover_image_url="https://covers.openlibrary.org/b/isbn/123.jpg",
        data_sources={
            "title": "open_library",
            "author": "open_library",
            "publisher": "open_library",
            "year": "open_library",
            "pages": "open_library",
            "description": "open_library",
            "cover_image_url": "open_library",
        },
    )


def make_gb() -> BookData:
    return BookData(
        title="The Python Way (GB)",
        author="Jane Smith (GB)",
        publisher="O'Reilly (GB)",
        year=2021,
        description="GB description — longer and better",
        cover_image_url="https://books.google.com/books/content?id=123",
        data_sources={
            "title": "google_books",
            "author": "google_books",
            "publisher": "google_books",
            "year": "google_books",
            "description": "google_books",
            "cover_image_url": "google_books",
        },
    )


def make_loc() -> BookData:
    return BookData(
        title="The Python Way (LoC)",
        author="Jane Smith (LoC)",
        publisher="O'Reilly Media",
        edition="2nd ed.",
        year=2019,
        data_sources={
            "title": "loc",
            "author": "loc",
            "publisher": "loc",
            "edition": "loc",
            "year": "loc",
        },
    )


def test_title_prefers_open_library():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert merged.title == "The Python Way"
    assert merged.data_sources["title"] == "open_library"


def test_publisher_prefers_loc():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert merged.publisher == "O'Reilly Media"
    assert merged.data_sources["publisher"] == "loc"


def test_year_prefers_loc():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert merged.year == 2019
    assert merged.data_sources["year"] == "loc"


def test_edition_from_loc():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert merged.edition == "2nd ed."
    assert merged.data_sources["edition"] == "loc"


def test_description_prefers_google_books():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert merged.description == "GB description — longer and better"
    assert merged.data_sources["description"] == "google_books"


def test_cover_prefers_open_library():
    merged = merge_results(make_ol(), make_gb(), make_loc())
    assert "openlibrary.org" in merged.cover_image_url


def test_fallback_when_source_missing():
    empty = BookData()
    merged = merge_results(empty, make_gb(), make_loc())
    assert merged.title == "The Python Way (GB)"
    assert merged.data_sources["title"] == "google_books"


def test_metadata_complete_true():
    book = BookData(title="X", author="Y", publisher="Z", year=2020)
    assert is_metadata_complete(book, "9781234567890") is True


def test_metadata_complete_false_missing_publisher():
    book = BookData(title="X", author="Y", publisher=None, year=2020)
    assert is_metadata_complete(book, "9781234567890") is False


def test_metadata_complete_false_no_isbn():
    book = BookData(title="X", author="Y", publisher="Z", year=2020)
    assert is_metadata_complete(book, "") is False
