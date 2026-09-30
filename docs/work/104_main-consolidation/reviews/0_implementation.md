# Review 0: implementation

## Target

Initial recovered product changes against aoe2 commit `3bc906af51af5f29a48d11400d21aab79d714449`, before review repairs. The exact uncommitted source, script, stats and test changes are retained in ignored `tmp/main-consolidation-20260929/product-review.patch` in the primary checkout, SHA-256 `343949d9b9a2c61687aaac0367bc6684ac617156f78e1cf1e46090218160e5be`. Canonical documentation and the later migration were outside this round.

## Reviewers and coverage

Independent Codex subagent, GPT-6 Astra at xhigh, read-only. It read changed code and adjacent unchanged implementations, including the installed engine's visibility and rendering implementations. No reviewer gates, writes, browsers or temporary artifacts ran. A pure call to the A/B summary function reproduced an empty-run false-success claim. This is an interim authored report, not final acceptance.

## Reports

### GPT-6 Astra, independent code review

IR-1 — P2: Profilers count refused steps as completed ticks. `scripts/aiTickAb.mjs:190-193` and `scripts/profile-selfplay.mjs:87-110` increment counters after calling `bridge.step(100)` without reading its result. A simulation failure leaves the match outcome running, while subsequent steps refuse halted. These tools can therefore report thousands of simulated ticks and misleadingly low costs after simulation stopped. Read `StepReport.ticks` and `refusedBecause`; fail or explicitly report refusal. The unchanged `src/game/simulation/bridge/tickHaltGuard.ts:24-52` and `stepReport.ts:17-27` confirm this trigger.

IR-2 — P2: Measurements mislabel loaded worlds and claim success without measured work. `scripts/profile-selfplay.mjs:163` labels every sample WARMUP..WARMUP+sampled, including the newly supported load path. Loading tick 30000 with default arguments reports tick 12000 instead. Use actual sample boundary ticks and explicitly handle zero sampled ticks. Separately, `scripts/aiTickAb.mjs:117` returns identical at every chunk with no chunks. A read-only call to `summarize({rows: [], divergedAt: null})` reproduced ticks 0, that success claim, and null ratios. Distinguish no comparison or no steady measurement from successful comparison.

IR-3 — P2: Imported building sight can stall loading. `src/game/simulation/buildingVisionSources.ts:50-55` enumerates approximately pi R squared over four offsets without bounding work to the map. A finite saved radius of 100000 costs about 7.85 billion iterations; 1e200 overflows the squared limit and cannot terminate. The paste path in unchanged `src/ui/hud/saveLoadPanel.ts:233-252` accepts JSON and forwards it; engine JSON validation allows finite numbers, and existing radii are retained during load. Previously the engine clipped visibility loops to map bounds. Bound calculation work or reject oversized inputs before enumeration, preserving ordinary sight geometry. I did not execute a hanging input.

No other confirmed product finding in the initial patch. Reviewed target-index lifetime and ordering, preserved v239 minimum ranges, lazy projection and error cleanup, layered visibility methods and persistence, construction/load/destruction sight lifecycle, saved art preference precedence, and replay-mode audio reset ordering. Older replay re-simulation under current rules is an explicit spec limitation, not an additional finding.

Outside-diff grounding also included `renderStateOps.ts:88-139`, `humanSight.ts:24-28`, the replay controller, save serializer, and installed engine visibility/render implementations. No gates, writes, browser processes or temporary artifacts were created. Documentation migration, repaired instruments, final evidence, and exact final revision remain unreviewed.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 / IR-1 | Refused steps counted as work | Accepted; reported simulation work must have run | Measurement worker; require successful step report and matching actual tick advance |
| F1 / IR-2 | Incorrect loaded tick bounds and empty-run success | Accepted; labels and verdict must describe observed work | Measurement worker; actual bounds, explicit no-measurement handling and contract tests |
| F2 / IR-3 | Unbounded sight work on imported radius | Accepted; finite saved data must not create an unbounded load | Building worker; map-bounded derivation and malformed/high-radius regression tests |

## Verification

The integration owner ran nine affected product files: 147 tests passed on the initial combined product changes. Workers separately passed focused tests, current-main 10000-tick A/B comparisons, and six headless UI/audio browser contracts. These checks did not cover the three findings. The complete gate and repaired integrated review remain required. The historical 45000-tick comparisons are older evidence, not proof of this combined revision.

## Round outcome

Three material findings were assigned for repair. No final verification or merge acceptance is claimed. The next round must reread the repairs, complete documentation migration and final integrated bytes.
