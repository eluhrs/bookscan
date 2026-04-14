# BookScan — Iteration 16 Change Document

## Context
Unified design language across dashboard and edit page, dashboard table refinements, status filter, and review toggle buttons. Claude Code should read CLAUDE.md, SPEC.md, and this file, examine the mockup at docs/wireframes/changes-16-mockup.jpg, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-15 should already be in place.

---

## Design System — Unified Color Language
All pages (dashboard, edit page, and multi-step workflow screens) must use the same color system consistently. Implement as shared CSS variables or tokens so changes propagate everywhere.

**Zone colors:**
- Top/bottom zones (navbar, footer, action bars): #E0E0E0
- Table header row / filmstrip background: #F5F5F5 (lighter than #E0E0E0, darker than white)
- Content zones (table rows, card content): white (#FFFFFF)
- All zone borders: 1px solid #CCCCCC

**Content zone borders:**
- 1px solid #CCCCCC on left and right sides only — no gray page background anywhere
- Top and bottom borders provided by the #E0E0E0 zones above and below

**Primary button:**
- #0070F3 background, white text, ALL CAPS, always sits within the #E0E0E0 footer zone
- Apply consistently to workflow screens too — move primary button into #E0E0E0 footer zone on Photograph, Metadata, and Review screens if not already there

**Secondary buttons (Dashboard, Generate Listing, Log out, filter controls):**
- White background, #CCCCCC border, #666 text
- Same height and border-radius as primary button where used in footer

**Review toggle buttons (on/off state):**
- Off: white background, #CCCCCC border, #666 text
- On: #0070F3 background, no border, white text, font-weight 500
- Two separate independent buttons — do NOT connect them as a segmented control

Reference mockup for exact visual treatment of all zones and button states.

---

## Dashboard Changes

### ✓ FEAT-01: Unified design language on dashboard
Apply the design system above to the dashboard:
- Navbar: #E0E0E0 background, BookScan title left, Log out button right
- Table header row: #F5F5F5 background, 1px #E0E0E0 border-bottom
- Table content rows: white background, 1px #F0F0F0 border-bottom between rows
- Content zone: 1px #CCCCCC border left and right
- Footer bar: #E0E0E0 background, 1px #CCCCCC border-top, shows record count centered
- No gray page background — dashboard goes edge to edge

### ✓ FEAT-02: Review column — single centered column
Replace the current two-slot fixed-width review column with a single centered column:
- Green Lucide Check (#3B6D11) when neither flag is set — all good
- Amber FileWarning when needs_metadata_review only
- Blue Camera when needs_photo_review only
- Both icons stacked vertically (amber on top, blue below) when both flags set
- Column centered, row height adjusts naturally to content — do not force uniform row height
- Column header: "review" lowercase, centered

### ✓ FEAT-03: Remove Listing button from table rows
Remove the List/Listing button from every table row. Generate Listing belongs on the edit page only.

### ✓ FEAT-04: Replace Edit/Delete text with icons
Replace text Edit and Delete buttons with Lucide icon equivalents — same icons used on mobile:
- Edit: Lucide Pencil/Edit icon
- Delete: Lucide Trash icon
- Both icons in #888, centered in the actions column
- Remove any extra padding or fixed width around the actions column that creates unused space

### ✓ FEAT-05: Replace Incomplete checkbox with status filter dropdown
Remove the "Incomplete" checkbox. Replace with a compact filter button:
- Appearance: funnel/filter icon + chevron-down, no text label, white background, #CCCCCC border, same height as search bar
- On click: dropdown opens with options:
  - All records
  - Needs metadata review
  - Needs photography
  - Ready to list (neither flag set)
  - Archived (grayed out, not yet implemented)
- Active filter (anything other than "All records") shows the filter button with #0070F3 border to indicate a filter is applied
- Filters by querying needs_metadata_review and needs_photo_review fields directly

### ✓ FEAT-06: Remove data_complete field
Remove `data_complete` entirely:
- Drop the column from the database via Alembic migration
- Remove all server-side computation of data_complete
- Remove any references in the codebase
- The status filter (FEAT-05) replaces all functionality previously served by data_complete

---

## Edit Page Changes

### ✓ FEAT-07: Unified design language on edit page
Apply the design system above to the edit page:
- Navbar: #E0E0E0, BookScan left, Edit Book centered, Log out right — identical to dashboard navbar
- Filmstrip zone: #F5F5F5 background
- Content zone: white, 1px #CCCCCC border left and right
- Footer zone: #E0E0E0, contains SAVE + Dashboard + Generate Listing buttons
- No gray page background — edit page goes edge to edge

### ✓ FEAT-08: Review toggle buttons
Replace the bordered checkbox group with two independent toggle buttons:
- Labels: "review metadata" and "review photography"
- Equal width, side by side, two-column grid layout
- Off state: white background, 1px #CCCCCC border, #666 text
- On state: #0070F3 background, no border, white text, font-weight 500
- Each toggles independently — they are NOT connected as a segmented control
- Save immediately on toggle — no Save button needed for these
- Reference mockup for exact visual treatment

### ✓ BUG-01: Vertical scroll broken on desktop edit page
The edit page content does not scroll vertically on desktop. Investigate and fix — likely a CSS height or overflow conflict introduced in CHANGES-15. Content zone must scroll between the anchored navbar and footer on both desktop and mobile.

### ✓ FEAT-09: Anchor footer on desktop edit page
The footer (SAVE + Dashboard + Generate Listing) should be anchored to the bottom of the viewport on both desktop and mobile, so the primary action is always visible regardless of scroll position. Retain existing mobile anchoring behavior, extend same behavior to desktop.

---

## Workflow Screens

### ✓ FEAT-10: Primary button in #E0E0E0 footer zone on workflow screens
Verify that the primary action button (CAPTURE, LOOKUP, SAVE) on the Photograph, Metadata, and Review workflow screens sits within the #E0E0E0 footer zone rather than on a white background. If any screen has the primary button on white, move it into the #E0E0E0 zone. Secondary buttons (Dashboard, Start Over) should also be in the #E0E0E0 zone — this should already be the case, confirm it is.

---

## Implementation Order
1. FEAT-06 — remove data_complete, database migration first, lowest risk to get out of the way
2. FEAT-01 — unified design on dashboard, establishes the color tokens for everything else
3. FEAT-07 — unified design on edit page, reuses same tokens
4. FEAT-10 — verify/fix workflow screens, reuses same tokens
5. FEAT-02 — review column redesign
6. FEAT-03 — remove Listing button
7. FEAT-04 — icon-only edit/delete
8. FEAT-05 — status filter dropdown
9. FEAT-08 — review toggle buttons
10. BUG-01 — vertical scroll fix
11. FEAT-09 — anchor footer on desktop

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move completed iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist:

   **Design system — all pages:**
   - [ ] #E0E0E0 top/bottom zones consistent across dashboard, edit page, and workflow screens
   - [ ] #F5F5F5 table header and filmstrip backgrounds
   - [ ] White content zones with 1px #CCCCCC left/right borders
   - [ ] No gray page background on any page
   - [ ] Primary button always in #E0E0E0 footer zone
   - [ ] Secondary buttons white with #CCCCCC border

   **Dashboard:**
   - [ ] Review column single centered — green checkmark, single icon, or stacked icons
   - [ ] Row height adjusts naturally — no forced uniform height
   - [ ] Listing button removed from all rows
   - [ ] Edit and Delete are icon-only
   - [ ] No extra padding around actions column
   - [ ] Status filter dropdown present — funnel icon + chevron, no text label
   - [ ] Filter options: All records / Needs metadata review / Needs photography / Ready to list / Archived (grayed)
   - [ ] Active filter shows blue border on filter button
   - [ ] Incomplete checkbox removed

   **Edit page:**
   - [ ] Review metadata and review photography are toggle buttons, not checkboxes
   - [ ] Toggle off: white background, gray border
   - [ ] Toggle on: blue fill, white text
   - [ ] Toggles are independent — both can be on simultaneously
   - [ ] Toggles save immediately without hitting SAVE
   - [ ] Vertical scroll works on desktop
   - [ ] Footer anchored on both desktop and mobile

   **Database:**
   - [ ] data_complete column removed from books table
   - [ ] No references to data_complete remain in codebase
   - [ ] Migration runs cleanly

   **Workflow screens:**
   - [ ] Primary button in #E0E0E0 zone on all three workflow steps
   - [ ] Secondary buttons (Dashboard, Start Over) in #E0E0E0 zone

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
   Note: database migration required for FEAT-06 — provide exact migration commands.
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine docs/wireframes/changes-16-mockup.jpg carefully before planning — it shows the exact color hierarchy, toggle button states, filter icon, and stacked review icons
- Use Superpowers to decompose into small tasks
- Implement shared CSS color tokens first (FEAT-01) — everything else depends on them
- FEAT-06 (remove data_complete) requires a database migration — provide exact commands
- Review toggles (FEAT-08) must be independent, not connected — do not implement as a segmented control
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
