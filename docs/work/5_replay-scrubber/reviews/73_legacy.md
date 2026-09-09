# Phase 3C implementation review - impl-56

## Reviewers

- Codex `gpt-5.5`, xhigh, read-only sandbox: completed with one medium documentation finding and no remaining code findings.
- Claude `claude-opus-4-7[1m]`: unreachable due to account limit (`You've hit your limit - resets 7pm America/Los_Angeles`).

## Findings

- [MEDIUM] Thread-level `PLAN.md` and `DESIGN.md` still had authoritative-sounding full-`v0.1.6` replay-scrubber scope, including Phase 3E scrubber e2e and `ReplayLoadDialog` decisions, even though Phase 3C ships as `0.1.7` and replay-load/e2e remain future work.

## Disposition

Fixed by updating the top-level thread docs to spell out the shipped split: `0.1.6` owns schema-2/foundation, `0.1.7` owns Phase 3C TimelinePanel, and replay-load sources/browser scrubber e2e remain future Phase 3D/3E work. Historical full-`v0.1.6` sections are now labeled as historical planning context rather than the current release boundary.
