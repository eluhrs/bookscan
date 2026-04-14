# BookScan — Iteration 13 Change Document

## Context
Mobile dashboard responsive design, desktop dashboard cleanup, and visual consistency fixes. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-12 should already be in place.

---

## ✓ FIX-12: Horizontal scroll on camera screens
The Photograph and Metadata camera steps allow slight horizontal scrolling — the live camera view appears to extend slightly beyond the screen boundary, allowing the page to be dragged left and right. The Review step does not exhibit this behavior, suggesting the camera view element is the cause.

Fix: prevent horizontal overflow on all workflow screens. Claude Code to investigate the camera view element width and apply the appropriate fix — likely a combination of constraining the camera view to 100vw maximum width and adding overflow-x: hidden to the page container. Verify fix on both Photograph and Metadata camera steps. Confirm Review step and keyboard ISBN step are unaffected.

---

## ✓ FIX-13: 1px border lines too light throughout
The 1px divider lines throughout the app on both desktop and mobile are too light and provide insufficient contrast against the #FAFAFA background.

Fix: unify all 1px border and divider colors to match the same darkness as the header/footer background color established in CHANGES-11 FIX-02. All borders throughout the app — zone dividers on mobile workflow screens, table row borders on dashboard, card borders on edit page — should use a single unified border color. Implement as a CSS variable update so it applies globally rather than screen by screen.

Note: this fix depends on FIX-02 from CHANGES-11 being in place. Verify the header/footer color is implemented before matching border color to it.

---

## ✓ FEAT-01: Mobile dashboard — responsive column display
The /dashboard table is wider than the mobile screen, requiring horizontal scrolling to see all values. Fix by hiding non-essential columns on mobile and replacing action buttons with icons.

**Mobile columns (small screens, breakpoint to match existing responsive breakpoints in the codebase):**
- Status icons column (two-slot FileWarning/Camera icons) — always visible
- Title column — always visible, two-line max with ellipsis
- Edit action icon — Lucide `Pencil` or `Edit` icon, tapping opens the book edit card
- Delete action icon — Lucide `Trash` icon, tapping triggers delete with confirmation

**All other columns hidden on mobile:** author, publisher, year, pages, ISBN, condition, any other existing columns.

**Desktop columns unchanged** — all existing columns remain visible on desktop.

**Implementation notes:**
- Use CSS media queries or existing responsive utility classes — do not use JavaScript for column visibility
- Edit and delete icons should be the same size, vertically centered in the row
- Delete confirmation behavior should match existing delete implementation
- Tapping a row on mobile (outside the icon buttons) should navigate to the edit card — same as clicking edit icon

---

## ✓ FEAT-02: Desktop dashboard — remove Condition column
Remove the Condition column from the desktop dashboard inventory table. Condition remains visible and editable on the book edit/detail card — it is not lost, just removed from the table view.

No database changes required.

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state — what was completed, any architectural decisions made, anything a fresh session needs to know
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist organized by area:

   **Camera screens (mobile):**
   - [ ] Photograph step — no horizontal scrolling
   - [ ] Metadata camera step — no horizontal scrolling
   - [ ] Review step — confirm still no horizontal scrolling
   - [ ] Keyboard ISBN step — confirm still no horizontal scrolling

   **Border contrast (desktop and mobile):**
   - [ ] 1px zone dividers on mobile workflow screens match header/footer darkness
   - [ ] Table row borders on dashboard match header/footer darkness
   - [ ] Card borders on edit page match header/footer darkness
   - [ ] All borders visually consistent throughout app

   **Mobile dashboard:**
   - [ ] Only status icons, title, edit icon, delete icon visible on mobile
   - [ ] No horizontal scrolling on mobile dashboard
   - [ ] Title truncates at two lines with ellipsis
   - [ ] Edit icon navigates to book edit card
   - [ ] Delete icon triggers delete with confirmation
   - [ ] Tapping row (outside icons) also navigates to edit card
   - [ ] Desktop dashboard columns unchanged

   **Desktop dashboard:**
   - [ ] Condition column removed from table
   - [ ] Condition still visible and editable on book edit card
   - [ ] All other desktop columns unchanged

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
- FIX-13 depends on CHANGES-11 FIX-02 being in place — verify before implementing
- FEAT-01 must use CSS media queries only — no JavaScript for column visibility
- FEAT-02 is a single column removal — lowest risk, do last
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
