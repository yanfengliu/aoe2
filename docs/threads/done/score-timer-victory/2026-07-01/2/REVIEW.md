# Score-timer victory — Review iteration 2 (2026-07-01)

Re-review after iteration-1 fixes (HUD `'score'` label + test, draw/defeat fixtures + tightened boundary, roadmap). Reviewers verified the fix set against the live codebase and ran probes. Gemini not run (headless OAuth).

## Findings

### Codex — IMPORTANT (real, fixed): boundary test still false-passed a one-tick-late timer
The iter-1 boundary test asserted only "still running after 29 ticks" then accepted any resolution within 40 steps, so a timer firing one tick late would pass. Codex ran a live `tsx` probe: after 30 steps `world.tick=30` running; after 31 steps `world.tick=31` victory/score `{1:180, 2:50}`. It noted the docs saying the match resolves "when `world.tick` reaches `gameLength`" read ambiguously against the observable render tick (31).
- **Ground-truth verification (per AGENTS "verify reviewer claims"):** reproduced with our own probe — `running` after 30 steps, `victory`/`score` after 31 steps, renderTick 31. Codex's claim is correct; the mechanic itself is right (`scoreTimerSystem` fires on the first tick where `world.tick >= gameLength`), the issue was purely test tightness + doc precision.
- **Fix:** replaced the boundary test with an exact pin — loop 30 steps asserting `running` after each, then assert the 31st step resolves. An early fire trips the in-loop assertion; a late fire trips the post-loop assertion. Reworded spec §4.3 and roadmap M6 to "on the first tick where `world.tick >= gameLength`" (no ambiguous external-tick claim). No production-code change.

### Claude — no issues; fixes confirmed correct
Verified and confirmed: (1) the `'score'` HUD label is consistent, exhaustively covered by the new unit test, and `postGameSummary.ts` is the only display switch over the `WinCondition` union (other `case 'conquest'` hits are unrelated entity/building contexts); (2) all three fixtures are in-bounds on the 60×36 map (P3's house at (24,34) with a 2×2 footprint reaches y35 — the tightest cell, still valid), non-overlapping, registered in both `fixtures/index.ts` and `dispatch.ts`, and the score arithmetic (180/50, 180/180, 50/180/100) matches `computePlayerScore` exactly — confirmed `starts.townCenter` does not spawn a second TC (no double-count); (3) version/spec/roadmap/changelog are mutually consistent and the §4.4 formula reproduces `matchEndOps.ts` character-for-character.

## Disposition — CONVERGED
Both reviewers confirm the core mechanic (settled in iter-1). The single iter-2 finding (test tightness / doc precision) is fixed and independently verified by ground-truth probe. The remaining change set is test + doc only; the production code that passed the full suite (1503 passed) is unchanged. Reviewers are at nitpick level — stopping here. Follow-up (tracked in roadmap M6): wire `gameLength` into corpus/deterministic scenarios and re-enable the `matchCompleteRequired: true` oracle.
