# BookScan — Iteration 19 Change Document

## Context
iOS viewport fixes, AI description improvements, filter button polish,
description source icons, and mobile scrollbar consistency. Claude Code
should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to
plan before writing any code. All previous iterations through CHANGES-18
should already be in place.

---

## ✓ BUG-01: iOS auto-zoom on input field focus
iOS Safari automatically zooms in when tapping any text input or
textarea. Fix by adding maximum-scale=1 to the viewport meta tag
in index.html:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, 
maximum-scale=1">
```

This is a personal single-user app so the accessibility tradeoff
is acceptable. Do not change any input font sizes.

---

## ✓ BUG-02: Content wider than viewport on mobile
Certain views are occasionally wider than the device screen on mobile,
allowing horizontal scrolling or requiring pinch to zoom out.

Fix: audit every page and component in the app — dashboard, edit page,
all three workflow steps (Photograph, Metadata, Review), login page —
and identify any elements causing horizontal overflow. Common causes
to look for: tables without fixed layout, flex rows without flex-wrap,
explicit pixel widths wider than viewport, absolutely positioned
elements, and inputs or textareas that expand beyond their container.

Apply overflow-x: hidden at the root container level AND fix individual
overflow sources so content is genuinely contained rather than just
hidden. Add touch-action: manipulation to the html element to prevent
double-tap zoom. Test every page after fixes.

---

## ✓ BUG-03: Review toggle buttons inconsistent line wrapping on mobile
On mobile, "review metadata" fits on one line while "review
photography" and "review description" wrap to two lines — inconsistent
button heights across the three toggles.

Fix: on mobile viewports only, force all three review toggle labels
to wrap consistently to two lines. On desktop all three should remain
single line as currently working. All three buttons must be identical
height on both mobile and desktop.

Implementation: use a responsive approach — insert a line break after
"review" in each label that is only active below the mobile breakpoint,
or adjust button width so all three wrap consistently at the same
breakpoint. Desktop layout must not be affected.

---

## ✓ FEAT-01: Improve AI description prompt — tone and length
The current Gemini-generated descriptions are overly promotional.
Update the prompt to produce factual, scholarly, understated
descriptions suitable for serious book buyers.

Updated prompt guidelines:
- Tone: sedate, scholarly, factual — no promotional language, no
  filler phrases like "captivating", "perfect for", "delve into",
  "journey", "exploration", or similar marketing language
- Content: state what the book is about, its academic or intellectual
  context where inferable from metadata, and its likely audience —
  based only on facts directly inferable from title, author, year,
  publisher
- Length: 3-5 sentences
- Do not fabricate specific facts not directly inferable from metadata
- Do not use superlatives or value judgments
- Write as a librarian or bookseller would describe the work, not
  as a marketing copywriter

Example of bad tone:
"A captivating exploration perfect for anyone seeking deeper
insights into Japan's hidden wonders..."

Example of good tone:
"A historical survey of modernist design movements in early
twentieth-century Germany, focusing on the Bauhaus school and
its principal figures. Written by Nicholas Fox Weber, a prominent
Bauhaus scholar, the work draws on extensive archival research
and personal interviews."

---

## ✓ FEAT-02: Filter button — active state color ring and subtle fill
Update the dashboard status filter button to show a colored ring and
subtle fill when an active filter is selected, matching the color of
the active filter type.

Active states:
- Needs metadata review: amber ring (#BA7517) + amber fill (#FAEEDA)
- Needs photography: blue ring (#0070F3) + blue fill (#E6F1FB)
- Needs description review: purple ring (#7F77DD) + purple fill (#EEEDFE)
- Ready to list: green ring (#3B6D11) + green fill (#EAF3DE)
- All records (no active filter): default gray border (#CCCCCC),
  no fill — neutral state

Fill should be subtle — use the lightest Geist ramp stop for each
color at reduced opacity if needed. The ring (border) is the primary
signal, the fill is secondary reinforcement. Reference the Geist color
ramps already in use throughout the app.

---

## ✓ FEAT-03: Description source icon — display and tap-to-regenerate

Show a small icon next to the "DESCRIPTION" field label on both the
Review step and edit page, indicating where the description came from.

### Icon by source
**Catalog sources** (open_library, google_books, library_of_congress):
- Lucide Database icon, neutral gray (#888)
- Display only — not tappable
- needs_description_review stays OFF — catalog sources are
  considered authoritative, no review needed

**AI generated** (ai_generated):
- Lucide Sparkles icon, purple (#7F77DD)
- Tappable — fires a new Gemini request to regenerate description
- On tap: field shows "Generating..." while request is in progress
- On success: new description replaces existing,
  needs_description_review set back ON
- On failure: retain existing description, show brief error state
- needs_description_review automatically set ON when AI summary
  first arrives
- After regeneration: needs_description_review set back ON

**Manual** (manual):
- No icon displayed

**No description:**
- No icon displayed

### Icon behavior after manual edit
- If user manually edits an AI-generated description:
  description_source → manual, Sparkles icon disappears,
  needs_description_review stays at current state
- If user manually edits a catalog description:
  description_source → manual, Database icon disappears

### Review toggle behavior by source
- ai_generated: needs_description_review automatically ON
- open_library, google_books, library_of_congress:
  needs_description_review stays OFF
- manual: needs_description_review stays OFF
- After regeneration: needs_description_review set back ON

### Consistency
Apply identically on both Review step and edit page. The description
field label, icon, and toggle behavior must be consistent across
both screens.

---

## ✓ FEAT-04: Consistent scrollbar on Review and Edit mobile views
The Review step shows a visible scrollbar with approximately 20px
of right margin whitespace. The Edit page shows no equivalent
scrollbar. Standardize both:

- Reduce the right margin/padding on the Review step scrollbar
  to the minimum needed to keep the scrollbar visible and
  not overlapping content — aim for 4-6px
- Add the same styled scrollbar to the Edit page scrollable
  content zone on mobile
- Both screens should have identical scrollbar appearance and
  margin treatment
- Desktop is not affected — desktop scrollbar behavior unchanged

---

## Implementation Order
1. BUG-01 — viewport meta tag, one line change, lowest risk
2. BUG-02 — mobile overflow audit, do all pages in one pass
3. BUG-03 — review toggle line wrapping, CSS only
4. FEAT-01 — prompt update, backend only, easy to test immediately
5. FEAT-02 — filter button active states, dashboard CSS only
6. FEAT-04 — scrollbar consistency, CSS only
7. FEAT-03 — description source icons, touches both Review and Edit,
   most complex — do last

---

## End of Iteration Tasks
When all items in this document are complete, perform the following
in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move completed
   iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000
   characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the
   iteration — do not push to GitHub
4. Print a bulleted QA checklist:

   **iOS viewport:**
   - [ ] Tapping any input field on mobile does not trigger auto-zoom
   - [ ] Viewport stays locked at natural zoom level throughout app

   **Mobile overflow:**
   - [ ] Dashboard fits within screen width on mobile — no horizontal
     scroll
   - [ ] Edit page fits within screen width on mobile
   - [ ] All three workflow steps fit within screen width on mobile
   - [ ] Login page fits within screen width on mobile
   - [ ] No page requires pinch to zoom out after fix

   **Review toggle wrapping:**
   - [ ] On mobile: all three review toggle buttons wrap to two lines
     consistently
   - [ ] On mobile: all three buttons identical height
   - [ ] On desktop: all three buttons single line, unchanged

   **AI description prompt:**
   - [ ] Generated descriptions are 3-5 sentences
   - [ ] No promotional or marketing language in generated descriptions
   - [ ] Tone is factual and scholarly
   - [ ] Test with at least 3 different books

   **Filter button active states:**
   - [ ] Metadata filter active: amber ring + amber fill
   - [ ] Photography filter active: blue ring + blue fill
   - [ ] Description filter active: purple ring + purple fill
   - [ ] Ready to list filter active: green ring + green fill
   - [ ] All records: gray border, no fill

   **Scrollbar consistency:**
   - [ ] Review step scrollbar right margin reduced to 4-6px on mobile
   - [ ] Edit page shows same scrollbar treatment on mobile
   - [ ] Both screens identical scrollbar appearance
   - [ ] Desktop scrollbar behavior unchanged

   **Description source icons:**
   - [ ] Database icon (gray) shown for catalog-sourced descriptions
     on both Review and Edit
   - [ ] Sparkles icon (purple) shown for AI-generated descriptions
     on both Review and Edit
   - [ ] No icon shown for manual descriptions
   - [ ] Sparkles icon is tappable — triggers regeneration
   - [ ] Database icon is not tappable
   - [ ] Regeneration shows "Generating..." then replaces description
   - [ ] needs_description_review set ON for AI, OFF for catalog
   - [ ] Manual edit removes icon and sets source to manual
   - [ ] Behavior consistent between Review step and edit page

5. Report back with a brief summary of what was completed, what if
   anything remains unfinished, and any decisions or issues to revisit

---

## Post-iteration fixes (2026-04-15)

Four follow-ups shipped after initial CHANGES-19 completion:

1. ✓ **Regeneration shows "Summary unavailable" on every Sparkles tap.** Root cause: `gemini-2.5-flash` free-tier quota on the project key is capped at 20 requests per ~30s rolling window; every call after the daily burn surfaces HTTP 429. Fix: switch `GEMINI_MODEL` to `gemini-2.5-flash-lite` (separate quota, same prompt/config), add error-body logging so future quota issues are visible in `docker compose logs api`. Backend retry loop (3 attempts, 2s backoff on 429) retained.

2. ✓ **Database icon missing on the edit page for catalog-sourced books.** Root cause: `ReviewStep.handleSave` had a dead ternary (`lookupResult.description ? null : null`) that wrote `description_source = null` for every catalog-sourced book, defeating the backend's auto-derive path. Fix: pipe `lookupResult.data_sources?.description` (e.g. `'google_books'`) through on POST. Also added a frontend fallback in `BookEditCard` that reads `book.data_sources?.description` when `book.description_source` is null, so older books without explicit source still show the correct icon retroactively.

3. ✓ **`needs_description_review` user toggle ignored when no AI summary.** Root cause: save path had `needs_description_review: aiDescription ? reviewDescription : false` — forced false whenever no Gemini summary. Fix: honor the user's toggle state regardless.

4. ✓ **Post-save follow-up bugs discovered during CHANGES-19 manual QA.** Covered by the same three commits above. Tests: 91/91 frontend, 67/67 backend.

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- Do not push to GitHub this session — commit locally only
- BUG-02 requires auditing every page — do not skip any screens
- FEAT-03 is the most complex item — implement last, test thoroughly
  on both Review step and edit page
- The Database icon for catalog sources is display only — do not
  add tap behavior
- Never join shell commands with && — run each as a separate tool
  call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks
  above
