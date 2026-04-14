import asyncio
from dataclasses import dataclass, field
from typing import Optional
import httpx

OPEN_LIBRARY_URL = "https://openlibrary.org/api/books"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
LOC_SRU_URL = "https://lx2.loc.gov/cgi-bin/sru/sru.cgi"


@dataclass
class BookData:
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    edition: Optional[str] = None
    year: Optional[int] = None
    pages: Optional[int] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    data_sources: dict = field(default_factory=dict)


async def fetch_open_library(isbn: str, client: httpx.AsyncClient) -> BookData:
    try:
        resp = await client.get(
            OPEN_LIBRARY_URL,
            params={"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"},
        )
        resp.raise_for_status()
        data = resp.json()
        book = data.get(f"ISBN:{isbn}", {})
        if not book:
            return BookData()

        result = BookData()
        if book.get("title"):
            result.title = book["title"]
            result.data_sources["title"] = "open_library"
        authors = book.get("authors", [])
        if authors:
            result.author = ", ".join(a.get("name", "") for a in authors)
            result.data_sources["author"] = "open_library"
        publishers = book.get("publishers", [])
        if publishers:
            result.publisher = publishers[0].get("name")
            result.data_sources["publisher"] = "open_library"
        if book.get("publish_date"):
            try:
                result.year = int(book["publish_date"][-4:])
                result.data_sources["year"] = "open_library"
            except (ValueError, TypeError):
                pass
        if book.get("number_of_pages"):
            result.pages = book["number_of_pages"]
            result.data_sources["pages"] = "open_library"
        covers = book.get("cover", {})
        if covers.get("medium"):
            result.cover_image_url = covers["medium"]
            result.data_sources["cover_image_url"] = "open_library"
        return result
    except Exception:
        return BookData()


async def fetch_google_books(isbn: str, client: httpx.AsyncClient) -> BookData:
    try:
        resp = await client.get(GOOGLE_BOOKS_URL, params={"q": f"isbn:{isbn}"})
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return BookData()

        info = items[0].get("volumeInfo", {})
        result = BookData()
        if info.get("title"):
            result.title = info["title"]
            result.data_sources["title"] = "google_books"
        authors = info.get("authors", [])
        if authors:
            result.author = ", ".join(authors)
            result.data_sources["author"] = "google_books"
        if info.get("publisher"):
            result.publisher = info["publisher"]
            result.data_sources["publisher"] = "google_books"
        if info.get("publishedDate"):
            try:
                result.year = int(info["publishedDate"][:4])
                result.data_sources["year"] = "google_books"
            except (ValueError, TypeError):
                pass
        if info.get("pageCount"):
            result.pages = info["pageCount"]
            result.data_sources["pages"] = "google_books"
        if info.get("description"):
            result.description = info["description"]
            result.data_sources["description"] = "google_books"
        image_links = info.get("imageLinks", {})
        cover = image_links.get("thumbnail") or image_links.get("smallThumbnail")
        if cover:
            result.cover_image_url = cover.replace("http://", "https://")
            result.data_sources["cover_image_url"] = "google_books"
        return result
    except Exception:
        return BookData()


async def fetch_loc(isbn: str, client: httpx.AsyncClient) -> BookData:
    """Library of Congress SRU endpoint — returns MODS XML."""
    try:
        resp = await client.get(
            LOC_SRU_URL,
            params={
                "version": "1.2",
                "operation": "searchRetrieve",
                "recordSchema": "mods",
                "maximumRecords": "1",
                "query": f"bath.isbn={isbn}",
            },
        )
        resp.raise_for_status()
        xml = resp.text
        if "<numberOfRecords>0</numberOfRecords>" in xml or "<mods:" not in xml:
            return BookData()

        import xml.etree.ElementTree as ET
        ns = {"mods": "http://www.loc.gov/mods/v3"}
        root = ET.fromstring(xml)
        mods = root.find(".//mods:mods", ns)
        if mods is None:
            return BookData()

        result = BookData()
        title_el = mods.find(".//mods:titleInfo/mods:title", ns)
        if title_el is not None and title_el.text:
            result.title = title_el.text.strip()
            result.data_sources["title"] = "loc"

        name_el = mods.find(".//mods:name[@type='personal']", ns)
        if name_el is not None:
            parts = name_el.findall("mods:namePart", ns)
            if parts:
                result.author = " ".join(p.text for p in parts if p.text)
                result.data_sources["author"] = "loc"

        pub_el = mods.find(".//mods:originInfo/mods:publisher", ns)
        if pub_el is not None and pub_el.text:
            result.publisher = pub_el.text.strip()
            result.data_sources["publisher"] = "loc"

        date_el = mods.find(".//mods:originInfo/mods:dateIssued", ns)
        if date_el is not None and date_el.text:
            try:
                result.year = int(date_el.text.strip()[:4])
                result.data_sources["year"] = "loc"
            except (ValueError, TypeError):
                pass

        edition_el = mods.find(".//mods:originInfo/mods:edition", ns)
        if edition_el is not None and edition_el.text:
            result.edition = edition_el.text.strip()
            result.data_sources["edition"] = "loc"

        return result
    except Exception:
        return BookData()


def merge_results(ol: BookData, gb: BookData, loc: BookData) -> BookData:
    """
    Field priority:
      title, author:          OL → GB → LoC
      publisher, edition, year: LoC → OL → GB
      description:            GB → OL → LoC
      cover_image_url:        OL → GB
      pages:                  first non-null wins
    """
    merged = BookData()
    merged.data_sources = {}

    def pick(field: str, *sources: BookData) -> None:
        for src in sources:
            val = getattr(src, field)
            if val is not None:
                setattr(merged, field, val)
                if field in src.data_sources:
                    merged.data_sources[field] = src.data_sources[field]
                return

    pick("title", ol, gb, loc)
    pick("author", ol, gb, loc)
    pick("publisher", loc, ol, gb)
    pick("edition", loc, ol, gb)
    pick("year", loc, ol, gb)
    pick("description", gb, ol, loc)
    pick("cover_image_url", ol, gb)
    pick("pages", ol, gb, loc)

    return merged


KEY_FIELDS = ("title", "author", "publisher", "year")


def is_metadata_complete(book: BookData, isbn: str) -> bool:
    """Returns True when metadata is complete (title, author, publisher, year, and isbn are all present)."""
    return bool(isbn) and all(getattr(book, f) for f in KEY_FIELDS)


async def lookup_isbn(isbn: str) -> tuple[BookData, bool]:
    """Returns (merged BookData, metadata_complete bool)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        results = await asyncio.gather(
            fetch_open_library(isbn, client),
            fetch_google_books(isbn, client),
            fetch_loc(isbn, client),
            return_exceptions=True,
        )
        ol = results[0] if isinstance(results[0], BookData) else BookData()
        gb = results[1] if isinstance(results[1], BookData) else BookData()
        loc = results[2] if isinstance(results[2], BookData) else BookData()
        merged = merge_results(ol, gb, loc)
        complete = is_metadata_complete(merged, isbn)
        return merged, complete
