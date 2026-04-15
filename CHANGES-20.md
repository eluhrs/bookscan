# BookScan — Iteration 20 Change Document

## Context
Unified BookCard component shared between Review step and Edit page,
field layout redesign, and technical cleanup. Claude Code should read
CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before
writing any code. All previous iterations through CHANGES-19 should
already be in place.

## Mockup Reference
See docs/wireframes/changes-20-mockup.jpg for the target layout for
both Review and Edit views.

---

## FEAT-01: Shared BookCard component

Create a new shared `BookCard` component that replaces the current
separate implementations in ReviewStep and BookEditCard. The component
accepts an `editable` boolean prop that controls behavior and
appearance.

### Shared between both modes
- Filmstrip (cover image with blue accent border + user photos with
  gray ✕ buttons)
- Title / Author / Publisher / Year+ISBN+Pages / Description field
  layout (see FEAT-02)
- Condition segmented button bar (Very Good / Good / Acceptable)
- Three review toggle buttons (review metadata / review photography /
  review description)
- Description field with source icon (Database or Sparkles)
- Same typography hierarchy throughout (see FEAT-02)
- Same #E0E0E0 / #F5F5F5 / white zone colors

### editable=false (Review step)
- Step indicator in header: ○ Photograph · ○ Metadata · ● Review
- All fields display only — no dashed underlines, no tap-to-edit
- No + button in filmstrip
- No additional fields section (Edition/Dimensions/Weight)
- Footer: SAVE (full width blue) + Dashboard + Start Over

### editable=true (Edit page)
- Full navbar: BookScan left, Edit Book center, Log out right
- Dashed underline (1px dashed #DDDDDD) on all editable fields —
  Title, Author, Publisher, Year, ISBN, Pages, Description
- Tap any underlined field to edit inline — blur to save
- + button in filmstrip — opens camera inline, appends photo,
  returns to edit state (same behavior as existing + button)
- Additional fields section below Description (see FEAT-03)
- Footer: SAVE (full width blue) + Dashboard + Generate Listing

---

## FEAT-02: Field layout redesign

Replace the current field layout on both Review and Edit with the
following unified structure. Apply identically on both screens
(display only on Review, editable on Edit per FEAT-01).

### Typography hierarchy
Four distinct levels, each quieter than the last:
- Title: 18px, font-weight 500, #222
- Author: 14px, font-weight 400, #222
- Publisher label + value: 12px value (#222), 10px small-caps label
  (#BBBBBB)
- Year / ISBN / Pages labels + values: 11px values (#222), 10px
  small-caps labels (#BBBBBB). ISBN in monospace font.

### Field order and layout
```
[Title]                              ← 18px/500, full width
[Author]                             ← 14px/400, full width
Publisher  [Tor Books]               ← label + value, full width
Year [2012]  ISBN [978...]  Pages [336]  ← three inline pairs, one row
```

### Label style
All field labels: font-size 10px, text-transform uppercase,
letter-spacing 0.05em, color #BBBBBB. Labels appear immediately
before their value with a small right margin (3-4px). No separate
label rows, no grid layout — inline label+value pairs throughout.

### Edit affordance
On editable=true only: 1px dashed #DDDDDD underline on each editable
value. Title and Author span full width. Publisher value underlined.
Year, ISBN, Pages values individually underlined. Description text
underlined.

---

## FEAT-03: Additional fields — hide when empty

On the Edit page (editable=true only):
- Show Edition, Dimensions, Weight below Description
- If all three are empty: hide the entire section — do not show
  labels, em dashes, or section header
- If any one has a value: show all three with em dashes for empty ones
- Remove the "ADDITIONAL FIELDS" section label entirely — the three
  field labels (Edition, Dimensions, Weight) are sufficient
- Same label style as other fields: 10px small-caps #BBBBBB

---

## FEAT-04: Year and Publisher inline editable on Edit page

Year and Publisher are currently display-only on the Edit page.
Make them inline editable consistent with Title, Author, and other
fields:
- Tap to edit, blur to save (same pattern as existing inline fields)
- Year: numeric input, 4 digits
- Publisher: text input, full width of its line
- Both get dashed underline affordance per FEAT-02
- Update the PATCH /books/{id} endpoint if needed to accept year
  and publisher updates

---

## FEAT-05: + button on Review step filmstrip

Add a + button to the filmstrip on the Review step, matching the
existing + button on the Edit page:
- Appears after the last user photo, same position as Edit page
- Tapping opens camera inline — does not navigate away from Review
  step, does not reset workflow state
- Photo appends to filmstrip on capture
- No hard limit on additional photos via this button
- Reuse the same camera open/capture/append logic as the Edit page
  + button

---

## TECH-01: tsconfig.json test directory exclusion cleanup
tsconfig.json currently excludes both test directories to keep
tsc --noEmit happy. This is a pre-existing workaround. Proper fix:
set up a dedicated vitest tsconfig that handles test files correctly
so they no longer need to be excluded from the main tsconfig. Low
priority — do after all other items are complete.

---

## Implementation Order
1. FEAT-02 — field layout and typography, establish the visual
   foundation first, implement as a standalone presentational
   component
2. FEAT-04 — make Year and Publisher editable, backend + frontend,
   while building the new field layout
3. FEAT-01 — shared BookCard component, build around the new field
   layout. Implement editable=true (Edit page) first, then
   editable=false (Review step). Retire the old BookEditCard and
   ReviewStep field implementations once BookCard is confirmed working
4. FEAT-03 — additional fields hide-when-empty, small addition to
   BookCard
5. FEAT-05 — + button on Review step, reuse existing camera logic
6. TECH-01 — tsconfig cleanup, do last, lowest risk to ship

---

## End of Iteration Tasks
When all items in this document are complete, perform the following
in order without being asked:

1. Update CLAUDE.md to reflect current project state. Move completed
   iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000
   characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the
   iteration — do not push to GitHub until instructed
4. Print a bulleted QA checklist:

   **Field layout — both screens:**
   - [ ] Title 18px/500, Author 14px/400, correct hierarchy
   - [ ] Publisher appears on its own line below Author
   - [ ] Publisher label small-caps #BBBBBB, value #222
   - [ ] Year / ISBN / Pages on one line, inline label+value pairs
   - [ ] All labels 10px small-caps #BBBBBB
   - [ ] All values #222
   - [ ] ISBN in monospace font
   - [ ] Description label small-caps with source icon

   **Review step (editable=false):**
   - [ ] Step indicator in header
   - [ ] All fields display only — no dashed underlines
   - [ ] No + button in filmstrip
   - [ ] No additional fields section
   - [ ] Footer: SAVE + Dashboard + Start Over
   - [ ] + button added to filmstrip, opens camera inline
   - [ ] Photo appends to filmstrip without leaving Review step

   **Edit page (editable=true):**
   - [ ] Full navbar present
   - [ ] Dashed underlines on Title, Author, Publisher, Year, ISBN,
     Pages, Description
   - [ ] Tap to edit works on all underlined fields including Year
     and Publisher (newly editable)
   - [ ] + button in filmstrip works as before
   - [ ] Additional fields section hidden when all three empty
   - [ ] Additional fields visible when any one has a value
   - [ ] "ADDITIONAL FIELDS" section label removed
   - [ ] Footer: SAVE + Dashboard + Generate Listing

   **Shared behavior:**
   - [ ] Condition buttons identical on both screens
   - [ ] Review toggle buttons identical on both screens
   - [ ] Description source icon identical on both screens
   - [ ] Filmstrip identical on both screens (except + button)
   - [ ] Design language (#E0E0E0/#F5F5F5/white) consistent

   **Technical:**
   - [ ] Old BookEditCard component removed
   - [ ] ReviewStep field implementation replaced by BookCard
   - [ ] PATCH /books/{id} accepts year and publisher updates
   - [ ] All existing tests pass after component consolidation
   - [ ] tsconfig.json test exclusion workaround resolved (TECH-01)

5. Report back with a brief summary of what was completed, what if
   anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Examine docs/wireframes/changes-20-mockup.jpg carefully before
  planning — it shows the exact field layout, typography hierarchy,
  dashed underline affordance, and both editable/display modes
- Use Superpowers to decompose into small tasks
- Do not push to GitHub until explicitly instructed
- Build FEAT-01 (BookCard) around FEAT-02 (field layout) — do not
  build the component first and retrofit the layout
- Retire BookEditCard only after BookCard editable=true is confirmed
  working on the Edit page
- Year and Publisher editable fields (FEAT-04) need backend PATCH
  support — verify before implementing frontend
- The + button on Review (FEAT-05) must not reset any workflow state
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks
  above
- The app is currently using gemini-2.5-flash-lite for AI description
  generation. This model is on the free tier but has limited daily
  quota. If generation starts failing with quota errors, the fix is
  to enable billing on the Google Cloud project — the same API key
  and configuration will upgrade seamlessly without code changes.
  Do not change the model string unless explicitly instructed.
