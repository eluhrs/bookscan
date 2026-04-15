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
    assert "2-3 sentence" in prompt or "2–3 sentence" in prompt
    assert "eBay" in prompt


def test_build_prompt_handles_missing_fields():
    prompt = build_prompt(title="Untitled", author=None, year=None, publisher=None)
    assert "Untitled" in prompt
    assert "None" not in prompt  # do not leak Python None into the prompt


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
