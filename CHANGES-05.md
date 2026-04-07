# BookScan — Iteration 5 Change Document

## Context
Two targeted bug fixes to be completed before the CHANGES-06 UI redesign. Claude Code should read CLAUDE.md and this file, identify the relevant code paths, and fix both issues without touching any other code. Do not refactor or redesign anything not listed here. Continue working on the existing CHANGES-05 worktree branch and do not merge to main.

---

## BUG-05: Positive and negative sounds not triggering
Audio feedback is not firing correctly in the current photo workflow. Reinstate all trigger points without reimplementing — find where existing sound calls were lost and rewire them:
- Successful Lookup (complete metadata): positive sound
- Failed Lookup (no barcode found): negative sound
- Lookup returns incomplete metadata: negative sound
- Successful Save: positive sound

Test all four trigger points explicitly before marking complete.

---

## BUG-06: Cancel buttons non-functional on all workflow screens
Cancel buttons do not work on any screen in the current workflow. Expected behavior per screen:

- Photograph: discard in-memory photos, reset to fresh Photograph screen
- Metadata camera mode: discard in-memory photos and lookup state, reset to fresh Photograph screen
- Metadata keyboard mode: discard in-memory photos and lookup state, reset to fresh Photograph screen
- Review: discard in-memory photos and all record data, reset to fresh Photograph screen
- Dashboard button (all screens): navigate to dashboard, discard all in-progress record data

Each Cancel path must be tested explicitly before marking complete.

---

## Notes for Claude Code
- These are wiring fixes only — do not touch UI code
- Continue on existing CHANGES-05 worktree branch
- Do not merge to main under any circumstances
- Update CLAUDE.md at end of session
- After deployment provide exact server commands:
```
  git pull
  docker compose up -d --build
```
- No database migrations expected — flag immediately if any are needed
