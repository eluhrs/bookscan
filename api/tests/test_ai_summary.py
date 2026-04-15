from app.services.ai_summary import build_prompt


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
