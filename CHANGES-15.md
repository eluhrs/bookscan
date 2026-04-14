# BookScan — Iteration 15 Change Document

## Context
Desktop edit page layout redesign — proper page structure matching the dashboard, workflow-style footer, and field reordering. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. All previous iterations through CHANGES-14 should already be in place.

## Mockup Reference
See docs/wireframes/changes-15-mockup.png for the target layout. Note: field order in the mockup is incorrect — follow the written spec in FEAT-02 for field ordering, not the mockup.

---

## ✓ BUG-01: data_complete auto-recompute on PATCH overwrites user review flags
The server currently auto-recomputes `data_complete` on every PATCH /books/{id} request. This silently overwrites user-set review flags when any client omits the field from the request payload — for example, a manual "review metadata" flag can be silently cleared by a subsequent edit.

Fix: only auto-recompute `data_complete` on POST (record creation). On PATCH, treat `data_complete` as a regular user-managed field — only update it if explicitly included in the request payload. No database migration required.

---

## ✓ FEAT-01: Edit page — full page structure matching dashboard

### Page layout
Replace the current edit page structure with a proper full-page layout consistent with the dashboard:

**Navbar (identical to dashboard):**
- BookScan title + book count on the left
- "Edit Book" centered as page title
- Log out button on the right
- Same background, same height, same border-bottom as dashboard navbar

**Page content:**
- Gray page background (var(--color-background-tertiary)) behind the card — same as dashboard
- max-width matching the dashboard container, centered with margin: 0 auto
- 24px padding around the card

**Card:**
- White background (var(--color-background-primary))
- 0.5px border (var(--color-border-tertiary)) on all sides
- border-radius: var(--border-radius-lg)
- Scrollable content — card fills the space between navbar and footer

**Footer (outside and below the card):**
- Full-width SAVE button — blue (#0070F3), white text, ALL CAPS, full width, prominent height (~44px), border-radius: var(--border-radius-md)
- Below SAVE: two equal-width buttons side by side — Dashboard (left) and Generate Listing (right)
- Both secondary buttons: light background (var(--color-background-primary)), var(--color-text-secondary) text, standard border, same height
- No date displayed — removed entirely
- Footer sits below the card within the max-width container, not anchored/fixed — scrolls naturally with page content on desktop
- On mobile: footer anchored to bottom of viewport so SAVE is always accessible without scrolling

---

## ✓ FEAT-02: Field order change
Swap the order of Description and Additional Fields sections within the card:

**New order top to bottom:**
1. Filmstrip
2. Title / Author / Year · Publisher
3. Condition button bar
4. Review checkboxes
5. ISBN / Pages / Publisher (three-column grid)
6. Additional Fields (Edition / Dimensions / Weight) — compact, em dashes when empty
7. Description — full width, textarea when editing, benefits from remaining vertical space

Rationale: Description is the most likely field to contain substantial content. Placing it last means it naturally expands into available space rather than pushing Additional Fields off screen.

---

## ✓ FEAT-03: Remove anchored header/footer from desktop edit page
The current implementation has an anchored (position fixed) header and footer on the edit page. On desktop this is no longer needed — the page has proper navbar and footer structure and the card scrolls naturally within the page.

On mobile: retain anchored footer so the SAVE button remains accessible without scrolling. The navbar remains at the top naturally.

---

## Mobile considerations
On mobile the edit page should:
- Show the same navbar (BookScan + Edit Book + Log out) at the top
- Card content scrolls
- Footer (SAVE + Dashboard + Generate Listing) anchored to bottom of viewport
- Same field order as desktop

---

## End of Iteration Tasks
When all items in this document are complete, perform the following in order without being asked:

1. Update CLAUDE.md to reflect current project state — what was completed, any architectural decisions made, anything a fresh session needs to know. Move completed iteration history to docs/HISTORY.md if CLAUDE.md exceeds 30,000 characters.
2. Mark all completed items in this CHANGES file with ✓
3. Commit all changes with a meaningful message summarizing the iteration
4. Push to GitHub
5. Restart the local development server so changes are live for testing
6. Print a bulleted QA checklist:

   **Bug fix:**
   - [ ] Manually set "review metadata" flag on a record, then edit another field (e.g. title) and save — confirm the review flag is not cleared
   - [ ] Create a new record — confirm data_complete is correctly computed on creation

   **Desktop:**
   - [ ] Navbar matches dashboard — BookScan left, Edit Book center, Log out right
   - [ ] Gray page background behind card
   - [ ] Card has border on all sides
   - [ ] Card max-width matches dashboard
   - [ ] SAVE button full width, blue, ALL CAPS, prominent height
   - [ ] Dashboard and Generate Listing buttons equal width below SAVE
   - [ ] No date displayed anywhere
   - [ ] Footer scrolls with page — not anchored on desktop
   - [ ] Field order: filmstrip → title/author → condition → checkboxes → ISBN/pages/publisher → additional fields → description

   **Mobile:**
   - [ ] Same navbar as desktop
   - [ ] Footer anchored to bottom — SAVE always visible
   - [ ] Same field order as desktop
   - [ ] Description at bottom expands naturally

   **Both:**
   - [ ] Description field is last content item in card
   - [ ] Additional fields (edition/dimensions/weight) appear before description
   - [ ] Em dashes in additional fields when empty
   - [ ] All inline editing still works correctly after reorder

7. Provide exact server deployment commands:
```
   git pull
   docker compose up -d --build
```
8. Report back with a brief summary of what was completed, what if anything remains unfinished, and any decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- See docs/wireframes/changes-15-mockup.png for visual reference — field order in mockup is incorrect, follow FEAT-02 written spec instead
- Use Superpowers to decompose into small tasks
- BUG-01 is lowest risk — implement first
- FEAT-03 is important — remove position fixed from desktop, retain only on mobile footer
- The navbar must be identical to the dashboard navbar — reuse the same component if possible
- Never join shell commands with && — run each as a separate tool call
- Update CLAUDE.md at end of iteration per End of Iteration Tasks above
