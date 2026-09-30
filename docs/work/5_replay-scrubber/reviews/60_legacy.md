# Phase 3B ReplayController Review - impl-43

## Scope

Final-review attempt on the completed Phase 3B follow-up diff after impl-42 fixes and devlog updates.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C43-1 - exit/scrub replacement failures could desynchronize controller state (major).** `exitReplay()` and committed `scrubTo()` updated replay/live controller state before `bridgeCell.replace(...)` succeeded. If replacement threw, the controller could report live mode while the cell still pointed at replay, or advance the displayed replay tick while the renderer kept the previous bridge. Fixed by committing state only after successful replacement and adding exit/scrub replacement-failure regressions.
- **Codex C43-2 - design doc still described stale playback and pause semantics (medium).** DESIGN still described the old per-frame playback loop and said exit "reverses" pause, conflicting with the accumulator-based controller and prior-pause restoration. Fixed by documenting accumulator playback, failed-tick/no-payload boundaries, and prior live pause restoration.
- **Codex C43-3 - cached playback performance contract lacked a regression (medium).** DESIGN required proving `play()` does not call `replayer.openAt(tick + 1)` per frame, but tests only checked parity. Fixed by spying on the controller's replayer and asserting playback reuses the cached replay world across frames.

## Disposition

All findings were accepted and fixed. Focused replay controller, file-size, and typecheck gates passed after the fixes.
