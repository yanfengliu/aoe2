# Phase 3B ReplayController Review - impl-40

## Scope

Re-reviewed the Phase 3B follow-up diff after the impl-39 fixes.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C40-1 - playback bypassed the no-command-payload guard (major).** `play()` consumed `bundle.commandsByTick` directly and would execute commands even when `bundle.metadata.commandPayloads` was false, while `SessionReplayer.openAt` rejects those bundles. Fixed by rejecting `play()` with a replay error for bundles without command payloads.
- **Codex C40-2 - controller methods depended on dynamic `this` (major).** Some exported controller methods delegated through `controller.pause()` / `controller.scrubTo()`, which broke if callers destructured methods. Fixed by using closure-local functions for replay control.

## Disposition

Both findings were accepted and fixed with focused regressions for no-payload playback and destructured method calls.
