Sure — let me take a swing at this:

```
BOOKSCAN DEVELOPMENT WORKFLOW
═══════════════════════════════════════════════════════════════

PLANNING (in Claude.ai chat)
────────────────────────────
  Brain dump ideas/bugs
       │
       ▼
  Claude.ai structures → CHANGES-XX.md
  (with wireframes if UI work)
       │
       ▼
  Save to project root
       └── docs/wireframes/changes-XX-wireframe.png (if needed)


START SESSION (in Claude Code CLI)
───────────────────────────────────
  $ claude  (in project directory, on correct branch)
       │
       ▼
  Paste START-SESSION.md prompt
       │
       ├── reads CLAUDE.md          (current project state)
       ├── reads SPEC.md            (original requirements)
       ├── reads CHANGES-XX.md      (highest numbered = current work)
       ├── reads wireframe PNG      (if referenced in CHANGES-XX.md)
       └── explores codebase
       │
       ▼
  Verifies + updates CLAUDE.md if stale
       │
       ▼
  Superpowers: brainstorm → plan → approve
       │
       ▼
  Superpowers: subagent execution
       ├── Haiku 4.5  (simple tasks)
       └── Sonnet 4.6 (complex tasks, review)


DURING SESSION
──────────────
  Each task cycle:
       │
       ├── Write failing test (TDD)
       ├── Write code to pass test
       ├── Claude Code: request approval for commands/files
       ├── Sonnet reviews: spec compliance
       ├── Sonnet reviews: code quality
       └── Commit to branch
       │
  If context getting low (~20%):
       └── "Please update CLAUDE.md with current progress"


END SESSION
───────────
  Paste END-SESSION.md prompt
       │
       ├── Updates CLAUDE.md        (what done, what remains)
       ├── Updates CHANGES-XX.md    (marks completed items)
       ├── git commit               (meaningful message)
       ├── git push                 (to GitHub)
       └── Reports server deploy commands:
               git pull
               docker compose up -d --build


BRANCH STRATEGY
───────────────
  main ──────────────────────────────────── (stable, CHANGES-04)
         \
          photo-workflow ─────────────────── (active branch)
          (CHANGES-05 ✓)
          (CHANGES-06 in progress)
               │
               └── merge to main when iteration proves stable


FILE ROLES
──────────
  CLAUDE.md          living document — current project state
  SPEC.md            frozen — original requirements and decisions
  CHANGES-XX.md      current iteration — bugs + features
  START-SESSION.md   opening prompt — reads all docs, starts work
  END-SESSION.md     closing prompt — updates docs, commits, pushes
  settings.json      Claude Code permissions — allowedTools etc
  docs/wireframes/   PNG mockups referenced by CHANGES-XX.md


HANDOFF BETWEEN ACCOUNTS
─────────────────────────
  Account A finishes:
       └── END-SESSION.md runs → commit → push

  Account B starts:
       └── git pull → START-SESSION.md prompt → continues
```

Does this capture the workflow accurately, or are there steps missing or out of order?
