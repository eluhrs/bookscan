# BookScan — Iteration 14 Change Document

## Context
Dashboard table refinements, edit card redesign with unified desktop/mobile layout, and filmstrip polish. Claude Code should read CLAUDE.md, SPEC.md, and this file, examine the mockup at docs/wireframes/changes-14-mockup.jpg, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-13 should already be in place.

---

## Dashboard Table

### ✓ FEAT-01: Review column header and green checkmark
- Add "review" as a lowercase column header above the two-slot status icon column
- Table header row background: #E0E0E0 — matches the workflow header/footer color
- All header labels lowercase to match — review, title, author, publisher, year (no uppercase or title case)
- When a record has neither needs_metadata_review nor needs_photo_review set: show a single small green Lucide `Check` icon centered in the review column slot instead of two empty slots
- When one or both flags are set: show the existing FileWarning (amber) and/or Camera (blue) icons in their fixed slots as before
- Reference mockup for the three states: checkmark only, single icon + empty slot, both icons

### ✓ FEAT-02: Title, author, publisher — consistent single-line truncation
- Title currently collapses to two lines before truncating — change to single line with ellipsis, same behavior as author
- Publisher column: same single-line truncation with ellipsis
- All three text columns (title, author, publisher) behave identically — single line, overflow ellipsis, no wrapping

---

## Edit Card Redesign

### ✓ FEAT-03: Back button and page header
- Add a new anchored header zone above the filmstrip on the edit page (both desktop and mobile)
- Header background: #E0E0E0 — matches workflow header/footer
- Left: pill-style Back button — rounded pill shape (border-radius: 999px), light background (var(--color-background-primary)), 1.5px border, left-pointing chevron icon + "Back" label, font-size 12px
- Right of button: "Edit Book" page title, 14px, font-weight 500
- Back button navigates to /dashboard on both desktop and mobile
- Header anchored — does not scroll with content

### ✓ FEAT-04: Condition button bar — replace dropdown
- Remove the existing condition dropdown entirely
- Replace with a segmented button control: all five options (New / Very Good / Good / Acceptable / Poor) in a single row
- Container: 1px border (var(--color-border-secondary)), border-radius: var(--border-radius-md), overflow hidden
- Each button: flex: 1, equal width, no border except internal 1px dividers between buttons
- Selected state: #0070F3 background, white text, font-weight 500
- Unselected state: var(--color-background-primary), var(--color-text-secondary)
- Full unabbreviated labels on both desktop and mobile
- Reference mockup for exact visual treatment

### ✓ FEAT-05: Checkbox group border
- Wrap both "review metadata" and "review photography" checkboxes in a single bordered container
- Container: 1px border (var(--color-border-secondary)), border-radius: var(--border-radius-md), padding 6px 12px
- Both checkboxes on one row with a gap between them
- Checkboxes still save immediately on click — no Save needed
- Reference mockup for visual treatment

### ✓ FEAT-06: Unified layout — desktop and mobile identical structure
Both desktop and mobile use the same layout order top to bottom:
1. Anchored header — #E0E0E0, Back button + "Edit Book" title
2. Filmstrip — cover image + user photos (scrollable horizontally)
3. Content zone (scrollable vertically):
   - Title (large, inline editable)
   - Author (inline editable)
   - Year · Publisher (inline editable)
   - Condition segmented button bar
   - Review checkboxes (bordered group)
   - ISBN / Pages / Publisher fields (three-column grid, inline editable)
   - Description (inline editable, em dash when empty)
   - Additional fields: Edition / Dimensions / Weight (inline editable, em dash when empty)
4. Anchored footer — #E0E0E0, "added {date}" left, Save button right

Header and footer are anchored (position fixed or sticky) on both desktop and mobile — they never scroll off screen. Content zone scrolls between them.

Desktop Save button: small, 12px, right-aligned in footer
Mobile Save button: larger, 13px, more padding, right-aligned in footer

### ✓ FEAT-07: Filmstrip polish
- Remove dotted rectangle border from the + button — bare + character only, no surrounding border or rectangle
- Style + consistently with surrounding filmstrip area — font-size 22px, var(--color-text-tertiary), cursor pointer
- ✕ delete buttons on user photos: gray styling — small circle, var(--color-background-secondary) fill, var(--color-border-secondary) border, var(--color-text-secondary) × icon. Not red.
- Cover image: blue accent border (2px solid #0070F3) — not deletable, no ✕

---

## Mobile Dashboard Search Bar

### ✓ FEAT-08: Search bar and toolbar fit on one line
The mobile dashboard toolbar (search bar + Incomplete checkbox + CSV button) currently requires horizontal scrolling or wraps to multiple lines. Fix so all three elements fit on one line:
- Search input: shrink to minimum width that contains the placeholder text "Search books..."
- Checkbox label: shorten from "Show Incomplete Only" (or similar) to just "Incomplete"
- Export button: shorten label to "CSV" if not already
- If all three still don't fit on one line after these changes, Claude Code to propose the minimal additional change needed

---

## Implementation Order
1. FEAT-07 — filmstrip polish, lowest risk, independent
2. FEAT-01 — table header and checkmark, display only
3. FEAT-02 — text truncation, CSS only
4. FEAT-08 — mobile toolbar, CSS only
5. FEAT-03 — back button header, new component
6. FEAT-04 — condition button bar, replaces dropdown
7. FEAT-05 — checkbox border group
8. FEAT-06 — unified anchored layout, most complex, do last

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state — what was completed, any architectural decisions made, anything a fresh session needs to know
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist organized by area:

   **Dashboard table:**
   - [ ] Header row background is #E0E0E0
   - [ ] All header labels lowercase
   - [ ] Green checkmark shown when no review flags set
   - [ ] Amber FileWarning shown when needs_metadata_review is true
   - [ ] Blue Camera shown when needs_photo_review is true
   - [ ] Title truncates to single line with ellipsis
   - [ ] Author truncates to single line with ellipsis
   - [ ] Publisher truncates to single line with ellipsis

   **Mobile dashboard toolbar:**
   - [ ] Search bar, Incomplete checkbox, and CSV button all fit on one line
   - [ ] No horizontal scrolling on mobile toolbar

   **Edit card — filmstrip:**
   - [ ] + button has no border or rectangle
   - [ ] ✕ buttons are gray, not red
   - [ ] Cover image has blue accent border, no ✕

   **Edit card — header/footer:**
   - [ ] Back button is pill-shaped with chevron + "Back" label
   - [ ] Back button navigates to /dashboard
   - [ ] Header background is #E0E0E0, anchored top
   - [ ] Footer background is #E0E0E0, anchored bottom
   - [ ] Header and footer do not scroll on desktop or mobile

   **Edit card — condition:**
   - [ ] Condition dropdown removed
   - [ ] Segmented button bar with 5 options present
   - [ ] Selected state shows blue fill
   - [ ] Full unabbreviated labels on desktop and mobile
   - [ ] All five buttons equal width on one row

   **Edit card — checkboxes:**
   - [ ] Both checkboxes in a single bordered container
   - [ ] Both on one row
   - [ ] Checkboxes save immediately without hitting Save

   **Edit card — layout:**
   - [ ] Desktop and mobile use identical layout order
   - [ ] Content zone scrolls vertically between anchored header and footer
   - [ ] All inline editable fields work correctly (click to edit, blur to save)
   - [ ] Empty fields show em dash

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine docs/wireframes/changes-14-mockup.jpg before planning
- Use Superpowers to decompose into small tasks
- FEAT-06 (unified anchored layout) is the most complex item — build and test last
- FEAT-04 (condition button bar) replaces the dropdown entirely — remove all dropdown code
- The anchored header/footer uses the same position fixed technique as the workflow screens — reuse that pattern
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
