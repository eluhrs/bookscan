# BookScan — Known Issues (FIXES.md)

This file tracks known issues discovered during testing that do not yet have a dedicated CHANGES document. When enough items accumulate, or when a natural checkpoint is reached, these will be compiled into a numbered CHANGES-XX.md for implementation.

---

## FIX-01: Primary buttons uniformly too short across all screens
CAPTURE, LOOKUP, and SAVE buttons are all shorter than the wireframe design specifies. This is a global issue affecting all three workflow screens. Button height should be increased uniformly — implement as a shared style token so all three buttons are identical height. Reference: docs/wireframes/changes-06-wireframe.png for correct proportions.

---

## FIX-02: Global color, button, and zone height system redesign
Multiple related visual issues that must be solved together as a unified design pass in the shared WorkflowWrapper component. Do not fix screen by screen.

**Issues to resolve:**

**A — Header/footer background too light:**
Current #F0F0F0 is insufficient contrast against #FAFAFA content zone. Needs a darker coordinating Geist-palette gray.

**B — Header and footer bars unequal height:**
Step indicator header and Dashboard/Start Over footer bar are different heights. Both should be equal height and anchored (position fixed or sticky) so they never scroll off screen regardless of content or keyboard state.

**C — Toolbar border reads as search bar:**
Current 1px border around the entire toolbar row looks like an input/search container rather than a controls bar. Remove the full-row border entirely. Replace with individual button styling — each button (#dropdown, keyboard, torch, camera) gets its own subtle background fill and 1px border. Buttons feel like distinct interactive controls, not a grouped row.

**D — Toolbar narrower than header:**
Toolbar row is narrower than the header zone above it, making it look like a floating element. Toolbar should be full width, consistent with header and footer zones.

**E — Three gray button types need visual hierarchy:**
Three distinct button types all appear gray and must be clearly distinguishable:
- Toolbar buttons: # dropdown, keyboard, torch, camera icons
- Footer buttons: Dashboard, Start Over
- SAVE button in disabled/unselected state

Recommended approach: Claude Code to propose a complete coordinating color system using the Geist palette for approval before implementing. Suggested starting point:
- Header/footer background: #E0E0E0 or darker
- Header/footer equal fixed height: Claude Code to propose appropriate value
- Toolbar buttons: individual styling, #FAFAFA background with 1px #CCCCCC border
- Footer buttons: slightly lighter than background with clear border
- SAVE disabled: #D0D0D0 with muted text

All changes implemented globally in WorkflowWrapper — not screen by screen.

---

## FIX-03: Toolbar icons are emoji, not Lucide line art
Keyboard and torch icons in the toolbar controls bar are currently emoji rather than Lucide React line art icons. Both must be replaced with Lucide equivalents:
- Keyboard icon: Lucide `Keyboard` component
- Torch icon: Lucide `Flashlight` or `Zap` component — Claude Code to choose best fit
- Camera icon (keyboard mode): Lucide `Camera` component — verify if already correct
All three icons must match in size, stroke width, and color. Styled consistently with individual button treatment from FIX-02.

---

## FIX-04: Header and toolbar scroll off screen on keyboard ISBN input screen
When the iOS keyboard opens on the Metadata keyboard input screen, the step indicator header and controls bar scroll off the top of the screen. Expected behavior: both must remain anchored at the top of the visible viewport at all times regardless of keyboard state.

Implementation note: use `position: fixed` or `position: sticky` for the header and controls bar zones, combined with the visualViewport resize event handler already implemented for the keyboard-aware layout. The equal-height fixed header from FIX-02B should address this naturally — verify after FIX-02 is implemented.

Believed to be isolated to the keyboard ISBN input screen only — camera screens appear unaffected. Verify this assumption during implementation and fix any other screens exhibiting the same behavior.

---

## FIX-05: ISBN input placeholder text too wide for input box
The placeholder text in the ISBN input field on the keyboard mode screen is too long to fit the input box width at current font size. Fix: reduce font size of the placeholder text just enough to fit the full text within the input box width without truncation or scrolling. Do not change placeholder font size on other screens — Capture and Lookup hint text is already correctly sized.

Current placeholder text: "Type ISBN-10 or ISBN-13, then tap Lookup"

---

## BUG-06: 26 backend tests failing on master — pre-existing test infra rot
After the api Docker container was rebuilt during CHANGES-17 deployment (2026-04-14), 26 backend tests began failing with `sqlalchemy.exc.OperationalError: no such table: books` despite the autouse `setup_db` fixture creating tables on the same engine. Affects test_books, test_listings, test_photos. test_auth, test_lookup, test_ai_summary still pass.

Verified pre-existing (NOT caused by CHANGES-17 lookup-time AI work): stashing all post-merge edits and running pytest on clean master HEAD reproduces the same 26 failures. Most likely cause is a transitive dependency version bump (pytest-asyncio, SQLAlchemy, or aiosqlite) that no longer tolerates the current `:memory:` SQLite + module-scoped engine + session-scoped (deprecated) `event_loop` fixture pattern in `api/tests/conftest.py` and `api/tests/_helpers.py`.

Symptom: routes that go through `Depends(get_db)` see an empty DB even after `setup_db` creates tables. Tried StaticPool, temp-file SQLite, and monkey-patching `app.database.engine` / `async_session_maker` — none fixed it. The deprecation warning visible in test output ("event_loop fixture provided by pytest-asyncio has been redefined ... deprecated and will lead to errors in the future") is the strongest hint about the underlying cause.

Suggested fix path:
1. Remove the deprecated session-scoped `event_loop` fixture from `conftest.py`.
2. Configure pytest-asyncio's modern API: set `asyncio_default_fixture_loop_scope = "session"` in `pytest.ini` (or use `@pytest_asyncio.fixture(loop_scope="session")` on `setup_db`).
3. Make `test_engine` lazily-constructed inside a session-scoped fixture rather than at module import time so the engine and the event loop have aligned lifetimes.
4. Verify with `pytest -q` — should restore all 66 tests to passing.

Until then: the new lookup-time AI generation feature works correctly in the running app despite these test failures. test_ai_summary.py (the unit tests for the AI summary service) still passes 11/11 because it doesn't use the `client` fixture.

---

## BUG-07: AI description on Review step not behaving per spec
After the lookup-time generation rewrite (commit 70cd6f6), the AI description block on the Review step has two issues:

1. **New book scans show a redirect message instead of generating inline.** Spec intent (CHANGES-17 FEAT-04): on a fresh ISBN scan with no description from public lookup sources, the Review step should display "Generating summary…" italic placeholder immediately on mount, then fill in with the AI-generated description within 1–8 seconds, then surface the third "review description" toggle. Current behavior: instead of showing inline generation state, the block displays a "Summary unavailable — you can add one on the edit page" fallback message, directing the user away from the Review step. This indicates the `aiSummary.status === 'failed'` branch is firing on the happy path, not just on real failures — likely the `generateSummary()` call in `PhotoWorkflowPage.handleLookupComplete` is short-circuiting (auth, network, or response-shape mismatch) and silently reporting failed status. Verify by watching the api logs for the `/api/books/generate-summary` POST and checking the response JSON.

2. **Duplicate ISBN lookups load existing records into the Review step and try to generate a new description.** When a user scans an ISBN that is already in the database, `LookupStep` should either refuse with a "this book is already in your library" message OR jump directly to the existing record on the dashboard edit page. Current behavior: the lookup endpoint returns the same metadata regardless, and `PhotoWorkflowPage` proceeds into Review as if it were a fresh scan, then fires a Gemini call (wasting API budget) and attempts to POST a duplicate book — which the backend correctly rejects with 409, but the user sees a confusing save error instead of the existing record.

Spec intent: AI summary generates in parallel during/after `LookupStep` and is ready when Review mounts; duplicate ISBNs should be handled distinctly from fresh scans (probably by routing to the existing record's edit page, or by refusing the scan with a clear message before reaching the Review step).

Investigation pointers:
- `frontend/src/pages/PhotoWorkflowPage.tsx` `handleLookupComplete` — the `.catch` and `resp.description` falsy branches both set `failed`. Make sure they're firing for the right reasons.
- `frontend/src/components/workflow/LookupStep.tsx` — does it call any duplicate-check endpoint before completing? Likely not.
- `api/app/routers/books.py` `lookup_book` — read-only, doesn't know about existing records. Either the lookup route or the workflow controller should consult `GET /api/books?search={isbn}` before entering Review.

---

## Notes for Claude Code
When this file is referenced in a CHANGES document:
- Treat each FIX as a discrete task
- FIX-02 is the most complex — propose the complete color/sizing system for approval before implementing
- FIX-01 and FIX-02 are global — implement in shared WorkflowWrapper before touching individual screens
- FIX-02B (equal height anchored bars) may naturally resolve FIX-04 — verify after FIX-02 is complete before implementing FIX-04 separately
- FIX-03 can be done screen by screen but verify all icons are consistent when complete
- FIX-05 is a single CSS change — lowest risk, do last
