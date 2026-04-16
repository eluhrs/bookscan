# BookScan — Iteration 22 Change Document

## Context
Dashboard filter redesign, price/category listing fields on
desktop edit, and archived status support. Claude Code should
read CLAUDE.md, SPEC.md, and this file, then examine the mockups
in docs/wireframes/ before planning. Use Superpowers to plan
before writing any code. All previous iterations through
CHANGES-21 should already be in place — the price, category,
and archived database fields from CHANGES-21 FEAT-02 are
required before implementing this iteration.

## Mockup References
- docs/wireframes/changes-22-mockup-dashboard.jpg — dashboard
  toolbar with Tag + Eye icons, review column with $ indicator
- docs/wireframes/changes-22-mockup-edit-desktop.jpg — desktop
  edit page showing unset and set states for price and category
- docs/wireframes/changes-22-mockup-edit-mobile.jpg — mobile
  edit confirming no listing fields

---

## FEAT-01: Dashboard filter redesign — two independent controls ✓

Replace the current single status filter dropdown with two
independent icon buttons. Both controls are independent and
combinable. Selecting one does not clear the other.

### Control 1 — Status filter (Tag icon)
- Icon: Lucide Tag + chevron
- Default (no filter): gray border, no fill
- Ready to list: green ring (#3B6D11) + green fill (#EAF3DE)
- Archived: gray ring (#888) + gray fill (#F1EFE8)
- Single-select — selecting one option clears any previous
  selection

Dropdown options:
- All records (default)
- Ready to list
- Archived

### Control 2 — Review filter (Eye icon)
- Icon: Lucide Eye + chevron
- Replaces existing funnel/filter icon
- Default (no filter): gray border, no fill
- Active states — colored ring + fill:
  - Metadata Review: amber ring (#BA7517) + fill (#FAEEDA)
  - Photography Review: blue ring (#0070F3) + fill (#E6F1FB)
  - Description Review: purple ring (#7F77DD) + fill (#EEEDFE)
  - Price: gray ring (#888) + fill (#F1EFE8)
- Single-select — selecting one option clears any previous
  selection

Dropdown options:
- No filter (default)
- Metadata Review
- Photography Review
- Description Review
- Price

### Behavior
- Both controls sit to the right of the search bar, left of CSV
- Same height as search bar
- Both controls independent — combining returns intersection
- "Ready to list" computed: archived=false AND all review flags
  false AND price IS NOT NULL AND price > 0
- Reference mockup for exact visual treatment

---

## FEAT-02: Price indicator in dashboard review column ✓
Add a gray dollar sign icon (Lucide DollarSign, #888) to the
review column when a book has no price set:
- Stacks vertically with other review icons per existing pattern
- Appears when price field is null or zero
- Disappears when price is set
- Gray — neutral/incomplete, not an error state
- Included in "Price" filter option in FEAT-01
- Reference mockup for placement

---

## FEAT-03: Price and category fields on desktop edit page only ✓

Add price and category as a single button row on the desktop
edit page. Do not show on mobile edit page or Review step.

### Position
Below the three review toggle buttons, above the description
field. Part of the same button row group.

### Layout — single row, two equal columns (50/50)

**Price (left 50%):**
- Unset: white bg, #CCCCCC border, gray "PRICE" label separated
  by internal divider, gray $ prefix, gray "0.00" placeholder
- Set: #0070F3 bg, white "PRICE" label, white $ prefix, white
  value (e.g. "25.00")
- Tapping opens inline numeric input, saves on blur

**Category (right 50%):**
- Unset: white bg, #CCCCCC border, gray "CATEGORY" label
  separated by internal divider, gray chevron ▾
- Set: #0070F3 bg, white "CATEGORY" label, Lucide Check icon
  (white, centered in value area), white chevron ▾
- Does NOT show category name when set — checkmark only
- Tapping opens dropdown with category options

**Category options:**
- Science Fiction
- History
- Science
- Social Sciences
- Philosophy
- Travel
- Textbooks & Education
- Antiquarian & Collectible
- Other

### Visual states
Same border-radius and height as condition and review toggle
rows. When both price and category are set AND all review
toggles are white/clear, the record is visually ready to list —
all rows show blue active state except review toggles which
are white. Reference mockup for exact visual treatment.

### Desktop footer
SAVE (full width blue) + Dashboard only. Generate Listing
button removed entirely if still present.

### Mobile edit and Review step
No price or category row. SAVE + Dashboard footer only.
Unchanged from current implementation.

---

## FEAT-04: Archived status ✓
When a record's archived field is set to true:
- Record no longer appears in the default "All records" view
  — wait, reconsider: archived records SHOULD appear in All
  records but are filtered out by Status=Archived filter
- Actually: All records shows everything including archived.
  Status=Archived shows only archived. Status=Ready to list
  excludes archived.
- No UI for manually archiving individual records in this
  iteration — archived is set programmatically via export
  (CHANGES-23). This iteration just ensures the field is
  respected correctly in all filter and computed state logic.

---

## Implementation Order
1. FEAT-01 — filter redesign, replace Eye for funnel, add Tag
2. FEAT-02 — price indicator in review column
3. FEAT-03 — price and category on desktop edit
4. FEAT-04 — verify archived logic in filters

---

## End of Iteration Tasks
When all items in this document are complete, perform the
following in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move
   completed iteration history to docs/HISTORY.md if CLAUDE.md
   exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message
4. Do not push to GitHub until explicitly instructed
5. Print a bulleted QA checklist:

   **Dashboard filter:**
   - [ ] Tag icon present, sits left of Eye icon
   - [ ] Eye icon present, replaces funnel icon
   - [ ] Tag default: gray border, no fill
   - [ ] Tag Ready to list: green ring + green fill
   - [ ] Tag Archived: gray ring + gray fill
   - [ ] Eye default: gray border, no fill
   - [ ] Eye Metadata Review: amber ring + amber fill
   - [ ] Eye Photography Review: blue ring + blue fill
   - [ ] Eye Description Review: purple ring + purple fill
   - [ ] Eye Price: gray ring + gray fill
   - [ ] Both controls independent — combining works correctly
   - [ ] Ready to list computed correctly from all fields

   **Review column price indicator:**
   - [ ] Gray $ icon appears when price is null or zero
   - [ ] $ icon disappears when price is set
   - [ ] $ stacks correctly with other review icons

   **Desktop edit — price and category:**
   - [ ] Price and category row appears on desktop only
   - [ ] Price and category side by side 50/50
   - [ ] Price unset: white bg, gray label, gray $ placeholder
   - [ ] Price set: blue bg, white label, white $ and value
   - [ ] Category unset: white bg, gray label, gray chevron
   - [ ] Category set: blue bg, white label, centered checkmark
   - [ ] Category name NOT shown when set — checkmark only
   - [ ] Price saves on blur
   - [ ] Category saves on selection
   - [ ] No price or category on mobile edit or Review step
   - [ ] Generate Listing button removed if still present
   - [ ] Desktop footer: SAVE + Dashboard only

   **Archived filter:**
   - [ ] All records shows everything including archived
   - [ ] Status=Archived shows only archived records
   - [ ] Status=Ready to list excludes archived records
   - [ ] Ready to list excludes records with any review flag
   - [ ] Ready to list excludes records with no price

6. Report back with summary of completed work, anything
   unfinished, and decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine all three mockups in docs/wireframes/ before planning
- Use Superpowers to decompose into small tasks
- Price and category are desktop-only — use responsive CSS
  or a breakpoint to hide on mobile viewports
- "Ready to list" is computed, not stored — do not add a
  ready_to_list field to the database
- The Eye icon replaces the existing funnel icon — update
  the existing filter button component rather than adding
  a new one
- Category checkmark uses Lucide Check icon, not a text
  character
- Never join shell commands with && — run each as a separate
  tool call
- Do not push to GitHub until explicitly instructed
- Update CLAUDE.md at end of iteration per End of Iteration
  Tasks above
