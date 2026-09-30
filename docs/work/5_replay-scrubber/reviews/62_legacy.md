# Phase 3B ReplayController Review - impl-45

## Scope

Re-reviewed the Phase 3B follow-up after impl-44 fixes for coalesced scrub rollback, required pause-state callback, and design-doc error semantics.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C45-1 - unpaused replay-entry rollback lacked direct coverage (medium).** Tests covered construction failure before pause and replacement failure for a pre-paused bridge, but not the original "unpaused live bridge gets paused, replacement throws, restore unpaused" path. Fixed with an unpaused replacement-failure regression.
- **Codex C45-2 - design doc referenced old `_currentReplayContext.world` source of truth (low).** DESIGN still said the post-play aliasing note lived as JSDoc on `_currentReplayContext.world`, which no longer exists. Fixed the note to describe the closure-local `replayContext.world` implementation.

## Disposition

Both findings were accepted and fixed. Focused rollback/controller/file-size tests and typecheck passed after the fixes.
