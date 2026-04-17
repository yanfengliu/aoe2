## Core rules

- Use test-driven development for behavior changes: write or update tests first, then make them pass.
- Before finishing a code task, make sure `npx vitest run`, `npx tsc --noEmit`, and `npx vite build` pass.
- Prefer small functions, reusable utilities, composition over inheritance, and dead-code cleanup.
- Do not change game mechanics or behavior unless explicitly asked.

## Command and git rules

- Never use compound shell commands. Do not chain commands with `&&`, `|`, or `;`.
- If multiple commands are needed, run them as separate sequential tool calls.
- Always run the full test suite, not a subset.
- Do not use worktrees or branches; work directly on `main`.
- For all git commands, always use `git -C <path> <command>`.
- Never use `cd ... && git ...`; that triggers the CLI security block.
- Commit durable docs you add if you are not planning to remove them.
- Commit early, commit often.

## Subagents

- If you dispatch a subagent that cannot read repository instructions on its own, include this file and any nested instruction files in its prompt.

## Project docs

- Read `docs/devlog/summary.md` and `docs/architecture/ARCHITECTURE.md` at session start.
- Key directories:
  - `src`: game code
  - `docs`: architecture, devlogs, reviews
  - `design`: game and mechanism notes

## Architecture

- Respect the boundaries documented there. If a boundary seems wrong, flag it instead of silently violating it.
- If architecture changes, update the relevant sections in `docs/architecture/ARCHITECTURE.md`, append a row to `docs/architecture/drift-log.md`, and mention the update in the devlog.
- Do not update `docs/architecture/ARCHITECTURE.md` for non-structural fixes, refactors, UI tweaks, or test-only work.
- Never delete a Key Architectural Decision in `docs/architecture/decisions.md`; add a newer decision that supersedes it.

## Devlog

- Detailed devlogs live under `docs/devlog/detailed/` as append-only files named `YYYY-MM-DD_YYYY-MM-DD.md` (e.g. `2026-04-07_2026-04-13.md`).
- Always append new entries to the latest detailed devlog (the file with the most recent `END_DATE`). When looking something up, start from the latest file and work backwards.
- Periodically archive: when the active file grows larger than 500 lines or a significant time boundary is reached, close it (freeze its `END_DATE` in the filename) and start a new file whose `START_DATE` is the next entry's date.
- After every completed task, append a detailed entry with:
  - timestamp
  - action
  - result
  - files changed
  - reasoning
  - notes
- Keep `docs/devlog/summary.md` current after every 5 detailed entries or at the end of a session.
- If a subagent handles summary work, it should extract facts only and avoid interpretation.

## Code Review

- After you make any change, use a code reviewer subagent to review your work. The subagent should check `docs/learning/lessons.md`.

## civ-engine

- Record `civ-engine` weaknesses and misses in `docs/engine-feedback.md` as you work. Before you write to it, use a subagent to audit if its content is still valid and up to date. If too long, stale, or the issues are already addressed, it should be adjusted.
- If a missing engine feature blocks the task, stop your work and report it to the user. But do not modify the `civ-engine` repo directly.

## Debugging

- Read `docs/guides/debugging.md` in the `civ-engine` package if the bug seems engine related.
- When debugging, use `docs/debugging/template.md` to record your process. Create a new file per debugging session and use it to iterate until you solve the problem.
- Clean up the dump files created during debugging after you are done, but keep the `.md` files.
- Write learnings into `docs/learning/lessons.md`.