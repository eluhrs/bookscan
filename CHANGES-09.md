# BookScan — Iteration 9 Change Document

> **Status: COMPLETE** — All items implemented and merged to master (2026-04-08).
> BUG-01, FEAT-01, FEAT-02, FEAT-03 done. BUG-02 was already completed in CHANGES-08.



## Context
Workflow streamlining and routing fixes. Claude Code should read CLAUDE.md, SPEC.md, and this file, then use Superpowers to plan before writing any code. Continue on the existing worktree branch and do not merge to main under any circumstances. Wireframe alignment from CHANGES-07 and CHANGES-08 should already be in place.

---

## Already Implemented (do not re-implement)
The following items were completed ahead of schedule in previous iterations:
- "Cancel" renamed "Start Over" on all workflow screens
- "Review Metadata?" and "Review Photography?" checkboxes on Review screen
- Review Photography? auto-checks when SKIP used or all photos deleted

---

## Routing

### BUG-01: Root URL routing
- / currently redirects to /scan on mobile devices
- Change behavior: / always redirects to /dashboard regardless of device type
- Remove device detection routing logic entirely
- Applies to both mobile and desktop

---

## Dashboard

### FEAT-01: Mobile scan link
Add a scan link/icon to /dashboard that is only visible when accessed from a mobile device:
- Desktop visiting /dashboard: no scan link visible
- Mobile visiting /dashboard: scan link/icon visible, tapping navigates to /scan
- Use Lucide Camera icon for the link
- Placement: prominent but not disruptive — top right of dashboard header, left of log out button
- This is the correct inversion of the previously removed scan button which was visible on both device types

### BUG-02: Two-line ellipsis on dashboard
Apply the same text truncation rules established in CHANGES-08 to the dashboard inventory table:
- Title column: two-line max with ellipsis
- Author column: one-line max with ellipsis
- Prevents long titles and author lists from breaking table layout

---

## Workflow Streamlining

### FEAT-02: Full-screen confirmation between save and restart
After successful Save on the Review screen, before returning to fresh Photograph screen:
- Display a brief full-screen confirmation — Lucide Check icon, large, centered, on #FAFAFA background
- Duration: approximately 800ms — long enough to register, short enough not to slow workflow
- No animation required — simple appear/disappear transition
- After 800ms: transition to fresh Photograph screen automatically
- Positive sound plays at the moment the checkmark appears — confirm still fires correctly
- Haptic feedback fires at the moment the checkmark appears — medium intensity

### FEAT-03: Haptic feedback
Implement medium intensity haptic feedback (`navigator.vibrate(25)`) for all four key events:
- Photo captured (Capture tap)
- Lookup success
- Lookup failure
- Save success
Consistent medium intensity for all events — no variation between events.
Note: Safari/iOS does not support the Web Vibration API — document this as a known limitation in CLAUDE.md. Android browsers support it fully. Do not treat iOS lack of haptics as a bug.

---

## Notes for Claude Code
- Read CLAUDE.md, SPEC.md, and this file before planning
- Use Superpowers to decompose into small tasks
- BUG-01 routing fix should be done first — it is independent and low risk
- FEAT-02 and FEAT-03 are related — implement haptic feedback at the same time as the confirmation screen since they share the same trigger point (successful Save)
- Continue on existing worktree branch — do not merge to main under any circumstances
- Update CLAUDE.md at end of iteration
- After deployment provide exact server commands:
```
  git pull
  docker compose up -d --build
```
- No database migrations expected — flag immediately if any are needed
