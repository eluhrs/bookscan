# BookScan — Iteration 21 Change Document

## Context
Security hardening, session management, and database preparation
for listing fields. Claude Code should read CLAUDE.md, SPEC.md,
and this file, then use Superpowers to plan before writing any
code. All previous iterations through CHANGES-20 should already
be in place. No mockups required for this iteration.

---

## AUDIT-01: Security review ✓
Perform a security audit and report findings before making any
changes. Cover:
- JWT expiry settings and current token lifetime
- Verify all API endpoints require authentication — no unprotected
  routes
- .env file permissions and secrets management
- Input validation on all user-supplied fields (ISBN, text inputs)
- Rate limiting on login endpoint to prevent brute force
- Docker container privilege levels — are containers running
  as root?
- Dependency vulnerability scan (pip audit + npm audit)

Report findings with severity levels. Do not fix anything without
explicit instruction after the report is reviewed.

---

## FEAT-01: Sliding session expiry ✓
Implement sliding session expiry on JWT tokens:
- Token lifetime: 12 hours from last activity
- On every authenticated API request: if token is valid and has
  more than 1 hour remaining, issue a refreshed token in the
  response header (X-Refresh-Token)
- Frontend: on every API response, check for refreshed token
  and update stored token if present
- On 401: clear stored token and redirect to login page
- On login page: show "Your session has expired, please log in
  again" message when redirected due to expiry — not on first
  visit
- Initial token lifetime on login: 12 hours

---

## FEAT-02: Database — price, category, archived fields ✓
Add the following fields to the books table via Alembic migration:

- `price` DECIMAL(10,2) — asking price, nullable, default null
- `ebay_category_id` INTEGER — eBay category ID, nullable,
  default null
- `ebay_category_name` VARCHAR — human-readable category name
  for display, nullable, default null
- `archived` BOOLEAN — default false

"Ready to list" is a computed state (not stored): archived=false
AND needs_metadata_review=false AND needs_photo_review=false AND
needs_description_review=false AND price IS NOT NULL AND price > 0

Add PATCH /books/{id} support for all four new fields so they
can be set programmatically. Verify existing PATCH endpoint
handles them correctly.

Provide exact Alembic migration commands.

---

## Implementation Order
1. AUDIT-01 — security audit, report only, no fixes
2. FEAT-02 — database migration, get fields in place
3. FEAT-01 — session expiry, backend then frontend

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

   **Security audit:**
   - [ ] Audit report produced with severity levels
   - [ ] No changes made without explicit instruction

   **Session expiry:**
   - [ ] Token expires after 12 hours of inactivity
   - [ ] Active sessions receive refreshed token on each request
   - [ ] 401 redirects to login with expiry message
   - [ ] Fresh login visit shows no expiry message

   **Database migration:**
   - [ ] price field present, decimal, nullable
   - [ ] ebay_category_id field present, integer, nullable
   - [ ] ebay_category_name field present, varchar, nullable
   - [ ] archived field present, boolean, default false
   - [ ] Migration runs cleanly
   - [ ] PATCH /books/{id} accepts all four new fields

6. Report back with summary of completed work, anything
   unfinished, and decisions or issues to revisit

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- AUDIT-01 is report-only — do not fix security issues without
  explicit instruction after report is reviewed
- Never join shell commands with && — run each as a separate
  tool call
- Do not push to GitHub until explicitly instructed
- Update CLAUDE.md at end of iteration per End of Iteration
  Tasks above
