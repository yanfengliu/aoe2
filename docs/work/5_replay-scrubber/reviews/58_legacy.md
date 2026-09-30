# Phase 3B ReplayController Review - impl-41

## Scope

Re-reviewed the Phase 3B follow-up diff after the impl-40 fixes.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C41-1 - replay exit always resumed live play (major).** `exitReplay()` restored the live bridge and always called `setPaused(false)`, so a live game that was manually paused before entering replay would resume unexpectedly on exit. Fixed by adding `ReplayControllerConfig.isLivePaused`, capturing the prior live pause state before replay entry, and restoring that exact state on exit.

## Disposition

The finding was accepted and fixed with a regression that enters replay from an already-paused live bridge, exits replay, and verifies the live world remains paused.
