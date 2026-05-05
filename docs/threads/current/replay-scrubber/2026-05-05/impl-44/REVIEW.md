# Phase 3B ReplayController Review - impl-44

## Scope

Re-reviewed the Phase 3B follow-up after impl-43 fixes for transactional exit/scrub replacement, design-doc playback semantics, and cached-playback coverage.

## Reviewer Availability

- Codex: completed and read the live codebase.
- Claude: unreachable due to the account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- **Codex C44-1 - coalesced scrub rollback remained incomplete (medium).** `scrubTo(..., { coalesce: true })` updated `displayedTick` before a later `commitPendingScrub()` bridge replacement. If commit replacement failed, the rendered bridge and replay context stayed on the old world while `currentTick` still reported the pending target. Fixed by rolling `displayedTick` and `pendingScrubTick` back to the committed replay context when pending commit fails, with a coalesced rollback regression.
- **Codex C44-2 - prior-pause restoration docs overstated the optional API (medium).** `isLivePaused` was optional and defaulted to false, so callers could accidentally lose a pre-existing pause despite docs promising restoration. Fixed by making `ReplayControllerConfig.isLivePaused` required and documenting the host callback requirement.
- **Codex C44-3 - DESIGN promised replay error emission the controller does not expose (medium).** The design described failed ticks and `WorldTickFailureError` as emitted replay errors, but the controller exposes only mode/tick listeners. Fixed the design to describe the actual contract: failed ticks reduce the playback upper bound, and step errors propagate through the scheduled frame callback after playback stops.
- **Codex C44-4 - devlog summary overstated full-gate status (low).** Summary said full gates passed while the detailed entry said post-fix final gates were still pending. Fixed the summary to say focused gates pass and final gates are pending after re-review.

## Disposition

All findings were accepted and fixed. Focused rollback/controller/file-size tests and typecheck passed after the fixes.
