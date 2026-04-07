Please perform the following end-of-session tasks in order:

1. **Update CLAUDE.md** to accurately reflect the current state of the project. Include what was completed this session, what remains unfinished, any architectural decisions made, and anything a fresh session would need to know to continue the work effectively.

2. **Update the latest CHANGES file** (highest numbered CHANGES-XX.md in the project root) to mark completed items and note any that are partially done or blocked. If all items are complete, add a brief summary at the top noting the iteration is finished.

3. **Commit all changes to git** with a meaningful commit message summarizing what was accomplished this session.

4. **Push to GitHub.**

5. **Provide the exact commands to run on the Hetzner server** to deploy the current state, if anything deployable was completed this session:
```
   git pull
   docker compose up -d --build
```
   If a database migration is required, call that out explicitly with the exact commands needed.

6. **Report back** with a brief summary of what was completed, what is unfinished, and any decisions or issues that should be revisited next session.
