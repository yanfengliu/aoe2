# Project Instructions

Primary directories: `src/`, `assets/`, `docs/`, `design/`.

## Session Start

- Read `docs/devlog-summary.md` at the start of every session.
- `docs/ARCHITECTURE.md` is the intended architecture source, but it is currently missing in this repo. If structural guidance matters, call out that gap instead of guessing new boundaries.
- Use the local `civ-engine` repo docs when engine guidance is relevant.

## Coding

- Use test-driven development for behavior changes: write failing tests first, then implement until they pass cleanly.
- Do not change game mechanics or behavior unless asked.
- Keep functions small, remove dead code, extract reusable helpers, avoid duplication, and prefer composition over inheritance.
- Before any commit, `npx vitest run`, `npx tsc --noEmit`, and `npx vite build` must all pass without errors or warnings.

## Command Execution

- Never use compound shell commands such as `&&`, `|`, or `;`.
- Never use command substitution like `$(...)`.
- Run commands as separate tool calls.
- Final verification must use the full test suite, not a narrowed subset.

## Git

- Work directly on `main`; do not use branches or worktrees.
- Always use `git -C <path> <command>`.
- Never use `cd ... && git ...`.
- Commit any docs you produce if they are meant to remain in the repo.

## Architecture

- If `docs/ARCHITECTURE.md` exists during a future task, read it before any structural change.
- Respect documented boundaries. If a boundary seems wrong, flag it instead of silently bypassing it.
- Update `docs/ARCHITECTURE.md` only for structural changes such as module/service additions or removals, data-flow changes, new external dependencies, or boundary changes.
- When updating it, change the relevant sections, add a Drift Log row, and mention the architecture update in the devlog.
- Do not update it for non-structural fixes, UI tweaks, tests, or internal refactors.
- Never delete a Key Architectural Decision; supersede it with a newer one.

## Devlog

- `docs/devlog-detailed.md` is the source of truth. Append only; never rewrite history.
- After every completed task, append an entry with timestamp, action, result, files changed, reasoning, and notes, using the existing format.
- Update `docs/devlog-summary.md` every 5 detailed entries or at the end of the session.
- Keep summary entries factual and compact: one line per action, no reasoning, under 80 lines. When needed, compress older items into a `Prior work` section.
- When compacting, keep the devlog file paths and the instruction to read the summary at session start.

## Subagents

- If you dispatch a subagent that cannot read repository instructions on its own, include the relevant instructions from this file and any nested instruction files in its prompt.

## Engine Feedback

- Record `civ-engine` strengths, weaknesses, and missing ergonomics in `docs/engine-feedback.md` as you work.
- If a missing engine feature blocks the task, stop your work and report it to the user. But do not modify the `civ-engine` repo directly.