# BookScan — Iteration 18 Change Document

## Context
Bug fixes, UI refinements, and AI description flow correction. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-17 should already be in place.

---

## ✓ BUG-01: AI description flow broken on Review step
New book scans show a message directing the user to the edit page to generate an AI description instead of generating inline on the Review step. This is incorrect — per CHANGES-17 spec, the Gemini summary should fire in parallel during LookupStep and be ready (or still generating) when the user lands on Review. The commit 70cd6f6 attempted to fix this but the behavior is still not correct for new scans.

Fix: ensure the lookup-time generation approach from 70cd6f6 is working correctly for all new book scans. The Review step should show "Generating summary..." immediately on mount for books without an existing description, and the description + review description toggle should appear within 1-3 seconds without any redirect message.

---

## ✓ BUG-02: Duplicate ISBN lookup loads existing record into Review step
When a user looks up an ISBN that already exists in the database, the existing record is incorrectly loaded into the Review step, allowing a duplicate save attempt that fails with an ISBN conflict error. 

Fix: when LookupStep detects that a looked-up ISBN already exists in the database, do not proceed to Review step. Instead show a clear message on the Metadata step: "This book is already in your library" with a button to navigate directly to that book's edit page. Do not allow the workflow to proceed to Review for duplicate ISBNs.

---

## ✓ BUG-03: 26 failing backend tests — test infrastructure problem
Pre-existing test infrastructure failure unrelated to CHANGES-17 features. The :memory: SQLite + module-scoped engine pattern started failing after the most recent API container rebuild — likely a transitive dependency version bump in pytest-asyncio, SQLAlchemy, or aiosqlite.

Fix: diagnose and fix the test infrastructure so all backend tests pass cleanly. Do not modify test assertions to make tests pass — fix the underlying infrastructure issue.

---

## ✓ BUG-04: Edit page header/footer not consistently pinned on mobile
The navbar and footer on the mobile edit page do not reliably stay pinned to the top and bottom of the viewport. The behavior should match the multi-step workflow screens which are the reference implementation.

Fix: audit the pinning implementation on the edit page and ensure header and footer are reliably fixed on mobile using the same approach as the workflow screens.

---

## ✓ BUG-05: Rubber band overscroll effect on edit page mobile
The edit page shows a rubber band/bounce effect when scrolling up or down on mobile. Apply `overscroll-behavior: none` to the scrollable content zone on the edit page to suppress this, consistent with the workflow screens.

---

## ✓ FIX-15: Status filter button border color matches active filter
The filter button currently shows a 1px blue border when any filter is active. Update to match the color of the active filter:
- Needs metadata review: amber border (#BA7517)
- Needs photography: blue border (#0070F3)
- Needs description review: purple border (#7F77DD)
- All records (no active filter): default gray border (#CCCCCC)

---

## ✓ FIX-16: CSV/scan icon navbar context switching
- Remove CSV button from mobile dashboard navbar — not useful on mobile
- On desktop: move CSV button to the right side of the navbar, left of Log out button
- On mobile: scan/camera icon remains in that position (already implemented)
- Result: navbar right side shows context-appropriate button — CSV on desktop, scan icon on mobile

---

## ✓ FIX-17: Condition and review toggle button layout — two rows of three
Replace the current five-button condition bar and two-button review toggle row with two stacked rows of three buttons each. Apply on Review step (scan workflow) and edit page (mobile and desktop):

**Row 1 — Condition (connected segmented bar):**
- Three connected buttons: Very Good | Good | Acceptable
- Single-select, connected segmented style (borders touching, no gaps)
- Selected state: #0070F3 fill, white text

**Row 2 — Review toggles (three separate independent buttons):**
- Three separate buttons with gaps between them: review metadata | review photography | review description
- Multi-select — each toggles independently
- Selected state: #0070F3 fill, white text — identical to condition

**Both rows:**
- Identical button height
- Two-line labels allowed, line-height ~1.1-1.2 to keep height compact
- Same width per button (flex: 1 within each respective row)
- Apply consistently on Review step and edit page (mobile and desktop)

---

## ✓ FIX-18: Remove New and Poor from condition options
Remove "New" and "Poor" as condition options throughout the app — Review step, edit page (mobile and desktop), any dropdowns, selectors, or hardcoded lists. Remaining options: Very Good | Good | Acceptable — aligning exactly with eBay's book condition scale for used books. Update all hardcoded condition lists, validation, and tests. No database migration needed — existing records with "New" or "Poor" retain their stored values, they just cannot be set going forward.

---

## Implementation Order
1. BUG-03 — fix failing tests first so the test suite is reliable before making any changes
2. BUG-01 — AI description flow, highest impact
3. BUG-02 — duplicate ISBN handling
4. BUG-04 — mobile pinning
5. BUG-05 — rubber band effect
6. FIX-17 — button layout, touches Review step and edit page
7. FIX-18 — condition options, depends on FIX-17 being done first
8. FIX-15 — filter button border colors, dashboard only
9. FIX-16 — CSV/scan navbar context switching

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move completed iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist:

   **AI description flow:**
   - [ ] New book scan — Review step shows "Generating summary..." immediately on mount
   - [ ] Description fills in within 1-3 seconds, review description toggle appears ON
   - [ ] No redirect message to edit page on new scans
   - [ ] Duplicate ISBN shows "already in library" message with link to edit page
   - [ ] Duplicate ISBN does not proceed to Review step

   **Backend tests:**
   - [ ] All backend tests pass cleanly
   - [ ] No test assertions modified — infrastructure fix only

   **Mobile edit page:**
   - [ ] Navbar pinned at top on mobile — does not scroll off screen
   - [ ] Footer pinned at bottom on mobile — SAVE always visible
   - [ ] No rubber band/bounce effect on mobile edit page

   **Button layout — Review step and edit page:**
   - [ ] Condition row: Very Good | Good | Acceptable — three connected buttons
   - [ ] New and Poor removed from all condition selectors
   - [ ] Review toggle row: three separate buttons with gaps
   - [ ] Both rows identical height
   - [ ] Selected state same blue (#0070F3) on both rows
   - [ ] Two-line labels render cleanly with tight line-height
   - [ ] Condition is single-select — only one button blue at a time
   - [ ] Review toggles are independent — any combination can be blue

   **Dashboard:**
   - [ ] Filter button border color matches active filter — amber/blue/purple/gray
   - [ ] CSV button visible on desktop navbar, left of Log out
   - [ ] CSV button not visible on mobile navbar
   - [ ] Scan icon visible on mobile navbar, not on desktop

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- Fix BUG-03 (failing tests) first — reliable tests are essential before making other changes
- FIX-17 and FIX-18 are tightly coupled — implement together in one pass
- BUG-01 and BUG-02 both touch the LookupStep/Review flow — review together before implementing
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
