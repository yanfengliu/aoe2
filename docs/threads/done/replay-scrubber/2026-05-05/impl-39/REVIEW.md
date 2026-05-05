# Phase 3B ReplayController Review - impl-39

## Scope

Reviewed the committed Phase 3B controller foundation after `af269b7`.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C39-1 - replay entry rollback could leave live play paused (major).** `enterReplay()` paused the live bridge before swapping the bridge cell, but if `bridgeCell.replace(replayBridge)` threw, the live bridge stayed paused even though the controller remained in live mode. Fixed by wrapping the swap and restoring the live pause state on failure.
- **Codex C39-2 - playback could advance beyond failed ticks (major).** `play()` advanced with direct `world.step()` calls and did not stop at `metadata.failedTicks`, unlike `SessionReplayer.openAt`. Fixed by stopping playback and emitting the replay error before stepping into a failed tick.
- **Codex C39-3 - devlog entry missing (process).** The Phase 3B commit had architecture/thread docs but no detailed devlog entry yet. Fixed in the final documentation pass for this follow-up unit.
- **Codex C39-4 - architecture nesting issue (docs).** The Phase 3B KAD was accidentally nested inside the previous KAD's consequences list. Fixed by restoring proper heading/list structure.

## Disposition

All Codex findings were accepted and fixed. The fixes added rollback and failed-tick coverage in `tests/replay/ReplayController.test.ts`, corrected `docs/architecture/decisions.md`, and queued the final devlog update for the follow-up commit.
