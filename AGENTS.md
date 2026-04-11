## Coding

- Adopt test driven development. Write tests first, then make them pass without errors or warnings by implementing the feature.
- Make sure `npx vitest run`, `npx tsc --noEmit`, and `npx vite build` all pass on every commit.
- Remove dead code and extract reusable util functions when you see fit.
- Prefer small functions.
- Avoid duplication.
- Prefer composition over inheritance.
- Do not change game mechanism and behavior unless asked.

## Subagent

- When you dispatch a subagent, add instructions from `AGENTS.md` (or `CLAUDE.md` if the tool only loads that) to your prompt if it cannot read project instructions on its own.

## Command Execution Rules

- **NEVER use compound shell commands.** Do not use `&&`, `|`, or `;` to chain commands together in a single Bash execution.
- If you need to run multiple commands (e.g., compiling then testing), execute them as separate, sequential tool calls.

## Git

- Do not use worktrees or branches. Directly commit to `main`.
- CRITICAL: You are strictly forbidden from using compound commands with `cd` and `git` (e.g., `cd path && git commit`). This triggers a hardcoded CLI security block that halts automation.
- You MUST ALWAYS use the `git -C <path> <command>` syntax for all git operations. Make sure to follow this both when you and your subagents are working.
- Commit the docs you produce if you are not planning to remove them.

## Architecture

Full architecture documentation lives in `docs/ARCHITECTURE.md`. Read it at session start alongside the devlog summary.

Key directories:

- `/src`: Application source code.
- `/assets`: Static assets such as images.
- `/docs`: Project documentation, architecture, devlogs.
- `design`: Game mechanisms and stats.

### Architecture Maintenance Rules

- **Read `docs/ARCHITECTURE.md` before any structural change** — adding a module, creating a new service, changing data flow, or introducing a dependency.
- **Respect the boundaries.** If ARCHITECTURE.md says only `PaymentService` calls Stripe, do not add Stripe calls elsewhere. If a boundary feels wrong, flag it — do not silently violate it.
- **Update ARCHITECTURE.md when you change the architecture.** If your work adds a component, removes one, changes data flow, introduces a new external dependency, or alters a boundary rule:
  1. Make the code change.
  2. Update the relevant section in `docs/ARCHITECTURE.md` (Component Map, Data Flow, Boundaries, Technology Map, or Diagram).
  3. Add a row to the Drift Log at the bottom with the date, what changed, and why.
  4. Note the `ARCHITECTURE.md` update in your devlog entry.
- **Do not update ARCHITECTURE.md for non-structural changes.** Bug fixes, UI tweaks, test additions, and refactors that stay within existing boundaries do not require an architecture update.
- **When in doubt, check the Drift Log.** If a component or boundary seems stale, check the Drift Log for recent changes before proceeding.
- **Never remove a Key Architectural Decision.** If a decision is reversed, add a new row that supersedes it rather than deleting the old one. The history matters.

## Devlog System

This project uses a two-tier devlog for change tracking and agent context.

### Detailed Devlog (`docs/devlog-detailed.md`)

- Append-only log of every significant action, decision, and outcome. New entries should be added at the end of the file, not the beginning.
- Each entry must include: timestamp, action taken, result, files modified, and reasoning.
- Format:

  ```
  ## [YYYY-MM-DD HH:MM, timezone] — [Short title]
  **Action:** What was done
  **Result:** What happened (success/failure/partial)
  **Files changed:** List of files touched
  **Reasoning:** Why this approach was chosen
  **Notes:** Edge cases, gotchas, or follow-ups
  ```

- This log is the source of truth. Never delete entries — only append corrections.

### Summary Devlog (`docs/devlog-summary.md`)

- Condensed view of project progress for agent context injection.
- Updated after every 5 detailed entries or at the end of a session.
- Each summary entry: one line per action, outcome only, no reasoning.
- Keep the summary under 80 lines. When it exceeds this, compress older entries into a "Prior work" section at the top.

### Devlog Rules

- **Always read `docs/devlog-summary.md` at session start** to understand current project state.
- **Always append to `docs/devlog-detailed.md`** after completing any task.
- After every 5 detailed entries, update `docs/devlog-summary.md`.
- If a subagent is available, delegate summarization to it. The summarizer should extract facts only — no interpretation, no editorializing.
- When compacting, always preserve the devlog file paths and the instruction to read the summary at session start.

## Game Engine

- This game is built using `civ-engine`. As you use the engine, constantly reflect on its strengths and weaknesses as an AI-native game engine for real-time 2D civilization simulation games. What works well and what don't? Document it in `docs/engine-feedback.md` so that it can be implemented. If a feature is missing and blocking you, stop and let me know.
- It should be in a local github repo `civ-engine`. Check its `docs` for guidance on how to use it.
