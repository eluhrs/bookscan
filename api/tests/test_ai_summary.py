import pytest
import httpx
import respx

from app.services.ai_summary import (
    GEMINI_URL,
    GeminiRateLimitError,
    build_prompt,
    generate_summary_text,
)


def test_build_prompt_includes_all_metadata():
    prompt = build_prompt(
        title="Dune",
        author="Frank Herbert",
        year=1965,
        publisher="Chilton Books",
    )
    assert "Dune" in prompt
    assert "Frank Herbert" in prompt
    assert "1965" in prompt
    assert "Chilton Books" in prompt
    assert "sentence" in prompt.lower()
    assert "booksell" in prompt.lower()


def test_build_prompt_handles_missing_fields():
    prompt = build_prompt(title="Untitled", author=None, year=None, publisher=None)
    assert "Untitled" in prompt
    assert "None" not in prompt  # do not leak Python None into the prompt


def test_build_prompt_has_scholarly_tone_guardrails():
    from app.services.ai_summary import build_prompt
    p = build_prompt("Bauhaus", "Nicholas Fox Weber", 2009, "Knopf")
    lower = p.lower()
    # Positive guidance
    assert "factual" in lower or "scholarly" in lower
    assert "3" in p and "5" in p and "sentence" in lower
    # Explicit bans
    for banned in ["captivating", "perfect for", "delve", "journey", "exploration"]:
        assert banned in lower, f"prompt should name-ban the phrase '{banned}'"
    # Do-not-fabricate rule retained
    assert "fabricate" in lower or "inferable" in lower


@pytest.mark.asyncio
async def test_generate_summary_text_success():
    body = {
        "candidates": [
            {"content": {"parts": [{"text": "A desert epic about politics, religion, and ecology. "
                                              "A landmark of science fiction."}]}}
        ]
    }
    with respx.mock(assert_all_called=True) as router:
        router.post(GEMINI_URL).mock(return_value=httpx.Response(200, json=body))
        result = await generate_summary_text(
            api_key="fake",
            title="Dune",
            author="Frank Herbert",
            year=1965,
            publisher="Chilton",
        )
    assert result is not None
    assert "desert" in result.lower() or "ecology" in result.lower()


@pytest.mark.asyncio
async def test_generate_summary_text_empty_response_returns_none():
    with respx.mock() as router:
        router.post(GEMINI_URL).mock(return_value=httpx.Response(200, json={"candidates": []}))
        result = await generate_summary_text(api_key="fake", title="X", author=None, year=None, publisher=None)
    assert result is None


@pytest.mark.asyncio
async def test_generate_summary_text_500_returns_none():
    with respx.mock() as router:
        router.post(GEMINI_URL).mock(return_value=httpx.Response(500, text="boom"))
        result = await generate_summary_text(api_key="fake", title="X", author=None, year=None, publisher=None)
    assert result is None


@pytest.mark.asyncio
async def test_generate_summary_text_429_raises():
    with respx.mock() as router:
        router.post(GEMINI_URL).mock(return_value=httpx.Response(429, text="rate"))
        with pytest.raises(GeminiRateLimitError):
            await generate_summary_text(api_key="fake", title="X", author=None, year=None, publisher=None)


@pytest.mark.asyncio
async def test_generate_summary_text_timeout_returns_none():
    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=httpx.ReadTimeout("slow"))
        result = await generate_summary_text(api_key="fake", title="X", author=None, year=None, publisher=None)
    assert result is None


@pytest.mark.asyncio
async def test_generate_summary_text_retries_once_on_5xx_then_succeeds():
    """First attempt returns 503, second attempt returns 200 — final result succeeds."""
    success_body = {
        "candidates": [{"content": {"parts": [{"text": "A retry-rescued blurb about the book."}]}}]
    }
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return httpx.Response(503, text="high demand")
        return httpx.Response(200, json=success_body)

    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=handler)
        result = await generate_summary_text(
            api_key="fake", title="X", author=None, year=None, publisher=None
        )
    assert result is not None
    assert "retry-rescued" in result
    assert call_count["n"] == 2


@pytest.mark.asyncio
async def test_generate_summary_text_retries_at_most_once_on_5xx():
    """Two 5xx failures in a row → return None (no third attempt)."""
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        return httpx.Response(503, text="still down")

    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=handler)
        result = await generate_summary_text(
            api_key="fake", title="X", author=None, year=None, publisher=None
        )
    assert result is None
    assert call_count["n"] == 2  # exactly 2 attempts — original + 1 retry


@pytest.mark.asyncio
async def test_generate_summary_text_retries_once_on_timeout_then_succeeds():
    """First attempt times out, second succeeds."""
    success_body = {
        "candidates": [{"content": {"parts": [{"text": "After a timeout recovery."}]}}]
    }
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise httpx.ReadTimeout("first one slow")
        return httpx.Response(200, json=success_body)

    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=handler)
        result = await generate_summary_text(
            api_key="fake", title="X", author=None, year=None, publisher=None
        )
    assert result is not None
    assert "timeout recovery" in result
    assert call_count["n"] == 2


@pytest.mark.asyncio
async def test_generate_summary_text_empty_candidates_retries_once():
    """Empty candidates (possible safety block) retries once before giving up."""
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        return httpx.Response(200, json={"candidates": []})

    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=handler)
        result = await generate_summary_text(
            api_key="fake", title="X", author=None, year=None, publisher=None
        )
    assert result is None
    assert call_count["n"] == 2


@pytest.mark.asyncio
async def test_generate_summary_text_429_does_not_retry_inline():
    """429 raises on first attempt — caller schedules a longer-delay retry."""
    call_count = {"n": 0}

    def handler(request):
        call_count["n"] += 1
        return httpx.Response(429, text="rate")

    with respx.mock() as router:
        router.post(GEMINI_URL).mock(side_effect=handler)
        with pytest.raises(GeminiRateLimitError):
            await generate_summary_text(
                api_key="fake", title="X", author=None, year=None, publisher=None
            )
    assert call_count["n"] == 1


# ---------------------------------------------------------------------------
# generate_and_store_summary background task tests
# ---------------------------------------------------------------------------

from app.models import Book
from app.services.ai_summary import generate_and_store_summary


@pytest.mark.asyncio
async def test_generate_and_store_summary_success(monkeypatch):
    from tests._helpers import TestSession
    monkeypatch.setattr("app.services.ai_summary.async_session_maker", TestSession, raising=True)
    monkeypatch.setattr("app.services.ai_summary.settings.gemini_api_key", "fake-key", raising=False)

    async with TestSession() as db:
        book = Book(isbn="9999999990001", title="Dune", author="Herbert", year=1965, publisher="Chilton")
        db.add(book)
        await db.commit()
        await db.refresh(book)
        book_id = book.id

    async def fake_generate(**kwargs):
        return "An epic about sand."

    monkeypatch.setattr("app.services.ai_summary.generate_summary_text", fake_generate, raising=True)

    await generate_and_store_summary(book_id)

    async with TestSession() as db:
        b = await db.get(Book, book_id)
        assert b.description == "An epic about sand."
        assert b.description_source == "ai_generated"
        assert b.needs_description_review is True
        assert b.description_generation_failed is False


@pytest.mark.asyncio
async def test_generate_and_store_summary_failure(monkeypatch):
    from tests._helpers import TestSession
    monkeypatch.setattr("app.services.ai_summary.async_session_maker", TestSession, raising=True)
    monkeypatch.setattr("app.services.ai_summary.settings.gemini_api_key", "fake-key", raising=False)

    async with TestSession() as db:
        book = Book(isbn="9999999990002", title="X", author="Y", year=2000, publisher="Z")
        db.add(book)
        await db.commit()
        await db.refresh(book)
        book_id = book.id

    async def fake_generate(**kwargs):
        return None

    monkeypatch.setattr("app.services.ai_summary.generate_summary_text", fake_generate, raising=True)

    await generate_and_store_summary(book_id)

    async with TestSession() as db:
        b = await db.get(Book, book_id)
        assert b.description is None
        assert b.description_source is None
        assert b.needs_description_review is False
        assert b.description_generation_failed is True


@pytest.mark.asyncio
async def test_generate_and_store_summary_skips_when_description_already_set(monkeypatch):
    from tests._helpers import TestSession
    monkeypatch.setattr("app.services.ai_summary.async_session_maker", TestSession, raising=True)
    monkeypatch.setattr("app.services.ai_summary.settings.gemini_api_key", "fake-key", raising=False)

    async with TestSession() as db:
        book = Book(
            isbn="9999999990003",
            title="X",
            description="already populated by lookup",
            description_source="google_books",
        )
        db.add(book)
        await db.commit()
        await db.refresh(book)
        book_id = book.id

    called = False

    async def fake_generate(**kwargs):
        nonlocal called
        called = True
        return "should not run"

    monkeypatch.setattr("app.services.ai_summary.generate_summary_text", fake_generate, raising=True)

    await generate_and_store_summary(book_id)
    assert called is False

    async with TestSession() as db:
        b = await db.get(Book, book_id)
        assert b.description == "already populated by lookup"
        assert b.description_source == "google_books"


@pytest.mark.asyncio
async def test_generate_and_store_summary_no_api_key_does_nothing(monkeypatch):
    from tests._helpers import TestSession
    monkeypatch.setattr("app.services.ai_summary.async_session_maker", TestSession, raising=True)
    monkeypatch.setattr("app.services.ai_summary.settings.gemini_api_key", None, raising=False)

    async with TestSession() as db:
        book = Book(isbn="9999999990004", title="X")
        db.add(book)
        await db.commit()
        await db.refresh(book)
        book_id = book.id

    await generate_and_store_summary(book_id)

    async with TestSession() as db:
        b = await db.get(Book, book_id)
        assert b.description_generation_failed is False
        assert b.description is None
