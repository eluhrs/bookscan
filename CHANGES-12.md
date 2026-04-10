# BookScan — Iteration 12 Change Document

## Context
This document redesigns the dashboard book edit/detail page from a plain form dump into a structured card layout. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. No wireframe is provided — the layout is fully described below. All previous iterations should already be in place.

---

## ✓ FEAT-01: Dashboard book edit page redesign

### Overview
Replace the current plain form layout on the book edit/detail page with a structured card design. The page should feel like a reference card — clear visual hierarchy, inline editing, compact status controls, and empty fields that stay present but unobtrusive.

### Remove
- ✓ Subject field entirely — remove from the edit page UI and from the database. Create an Alembic migration to drop the column.

---

### Layout — top to bottom

**Zone 1: Filmstrip**
- Background: `var(--color-background-secondary)`
- Horizontal scrollable row of images, same filmstrip component used on the Review screen — reuse, do not reimplement
- Cover image first (leftmost), accent border (2px #0070F3) to distinguish from user photos — not deletable
- User photos follow in capture order, each with small ✕ delete button (positioned top-right of thumbnail)
- ✕ button: small circle, danger color, removes photo immediately on click with confirmation
- + placeholder at the end: dashed border, clicking opens native file picker to add a photo
- No download button in this zone — download lives on the listing page only

**Zone 2: Title / Author / Status**
- Two-column grid: left column takes remaining space, right column fixed width (~160px)
- Left column:
  - Title: 20px, weight 500, inline editable (click to edit, hover shows border)
  - Author: 15px, secondary color, inline editable
  - Year · Publisher: 13px, tertiary color, not editable here (edit via core fields below)
- Right column, left-aligned, full width:
  - Condition dropdown: full width of right column, options New / Very Good / Good / Acceptable / Poor
  - Review Metadata? checkbox: left-aligned, same width as dropdown
  - Review Photography? checkbox: left-aligned, same width as dropdown
  - All three controls share the same left edge and same width
  - Checkboxes save immediately on click — no Save Changes needed
  - Condition saves with Save Changes button

**Zone 3: Core fields**
- Three-column grid
- Fields: ISBN (monospace font), Pages, Publisher
- Each field: small caps label above (11px, uppercase, letter-spacing), value below (13px)
- All three inline editable — click value to edit, hover shows border, blur to confirm

**Zone 4: Description**
- Single zone, full width
- Small caps label: "description"
- If empty: em dash (—) in italic tertiary color, clickable to edit
- If populated: 13px secondary color, line-height 1.6, clickable to edit
- Edit mode: textarea, min-height 80px

**Zone 5: Additional fields**
- Three-column grid
- Fields: Edition, Dimensions, Weight
- Same label/value style as Zone 3
- All three inline editable
- If empty: em dash (—) in italic tertiary color
- These fields are almost always empty — the zone should feel compact and unobtrusive when all three are dashes

**Zone 6: Footer**
- Left: "added {date}" in 11px tertiary color
- Right: two buttons — "generate listing" (standard style) and "save changes" (blue #0070F3, white text)
- Save Changes commits all pending inline edits and condition dropdown change
- Save Changes does NOT affect checkboxes (those already saved immediately)

---

### Inline editing behavior
- All editable fields show a hover state: 0.5px border appears on hover (`var(--color-border-secondary)`)
- Clicking switches the display element to an input/textarea
- Blur (clicking away) switches back to display mode
- No explicit save per field — all pending edits commit together on Save Changes
- Empty fields display as em dash (—) in italic tertiary color
- Fields with content display in their normal style

---

### Database change
- ✓ Remove `subject` field: create Alembic migration to drop the column from the books table
- ✓ Verify no other part of the codebase references the subject field before dropping — remove all references cleanly

---

### What is not changing
- Filmstrip component — reuse exactly as built for Review screen
- All other dashboard pages and table views
- The listing page — download button stays there, not here

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state — what was completed, any architectural decisions made, anything a fresh session needs to know
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist of everything that should be verified, organized by area — specific enough that each item can be checked off manually during QA:

   **Filmstrip:**
   - [ ] Cover image appears first with blue accent border
   - [ ] User photos appear in capture order with ✕ delete button
   - [ ] Cover image has no ✕ button
   - [ ] + placeholder at end opens file picker
   - [ ] Filmstrip scrolls horizontally with many photos
   - [ ] No download button in filmstrip zone

   **Title / Author / Status zone:**
   - [ ] Title is large (20px), inline editable on click
   - [ ] Author is medium (15px), inline editable on click
   - [ ] Year · Publisher displays but is not editable in this zone
   - [ ] Condition dropdown full width of right column
   - [ ] Review Metadata? checkbox left-aligns with dropdown
   - [ ] Review Photography? checkbox left-aligns with dropdown
   - [ ] All three right-column controls same width and left edge
   - [ ] Checkboxes save immediately without Save Changes
   - [ ] Hover on editable fields shows border indicator

   **Core fields:**
   - [ ] ISBN displays in monospace font
   - [ ] Pages and Publisher display correctly
   - [ ] All three inline editable on click
   - [ ] Hover shows border indicator

   **Description:**
   - [ ] Empty shows em dash in italic tertiary color
   - [ ] Click opens textarea
   - [ ] Populated description shows correctly in secondary color

   **Additional fields:**
   - [ ] Edition, Dimensions, Weight display as em dash when empty
   - [ ] Zone feels compact when all three are empty
   - [ ] All three inline editable on click

   **Footer:**
   - [ ] Added date displays correctly
   - [ ] Generate listing button present
   - [ ] Save Changes button blue, commits all pending edits
   - [ ] Save Changes does not affect checkbox state

   **Database:**
   - [ ] Subject field removed from edit page UI
   - [ ] Subject column dropped from database via migration
   - [ ] No references to subject field remain in codebase

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
   Note: database migration required — provide exact migration commands separately.
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- Reuse the existing filmstrip component — do not reimplement
- The database migration to drop subject is required — provide exact commands and flag any references to subject found in the codebase
- Inline editing pattern should be consistent across all editable fields
- Checkboxes must save immediately and independently of the Save Changes button
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
