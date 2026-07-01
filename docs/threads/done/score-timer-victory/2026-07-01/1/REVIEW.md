# Score-timer victory — Review iteration 1 (2026-07-01)

Change under review: add score-timer victory (spec §4.3). A scenario opts in via `gameLength`; when `world.tick` reaches it the match resolves on score (sole top ⇒ victory, tied top ⇒ draw, else defeat), evaluated after conquest/wonder/relic that tick. New `scoreTimerSystem.ts`; `WinCondition` union widened with `'score'` (threaded through save schema); fixture + integration test.

Reviewers: **Codex** (gpt-5.5, xhigh) and **Claude** (opus[1m]). Gemini not run (headless OAuth unavailable this session). Both reviewers verified claims against the live codebase.

## Findings

### Claude — MEDIUM (real, fixed): missing HUD label case
`formatWinConditionLabel` in `src/ui/hud/postGameSummary.ts` had no `'score'` case, so a score-timer outcome fell through the switch `default` and rendered a **blank** win-condition row — inconsistent with the other three conditions. This is the classic non-exhaustive-switch-with-default trap (no `never` assertion, so typecheck stayed silent).
- **Fix:** added `case 'score': return 'Score Victory';` + a new focused unit test `tests/ui/postGameSummary.test.ts` covering all four labels + the null (no-row) case.

### Codex — MEDIUM (real, fixed): weak test coverage
The original test only asserted "still running after 25 ticks" then accepted any outcome within 20 more, so a timer firing early at tick 26–29 would still pass; only the victory branch was covered (draw/defeat untested, including the requested >2-player "human not top" case).
- **Fix:** tightened the boundary to "still running after **29** ticks" (< gameLength 30, so an early fire is caught); refactored the fixture into a `buildScenario` builder and added `score-timer-draw-fixture` (P1==P2==180 ⇒ draw) and a 3-player `score-timer-defeat-fixture` (P1 50 < P3 100 < P2 180 ⇒ defeat). The test now asserts exact scores (180/50, 180/180, 50/180/100) and the specific outcome per branch.

### Codex — LOW/MEDIUM (real, fixed): stale roadmap
`design/roadmap.md` M6 still described score-timer as future work and score as "display-only."
- **Fix:** marked the mechanism as landed (v0.1.52) with the corpus-oracle re-enable + `gameLength`-in-scenarios wiring called out as the remaining follow-up.

## Confirmed correct by both reviewers (no action)
- **Tie/victory/draw/defeat logic** — single-pass max/count is order-independent and correct for the 2-player draw, the >2-player "human not top" (defeat) and "human tied top" (draw) cases.
- **Same-tick precedence** — `after: ['prototypeConquestOutcome']` holds transitively (relicCountdown → winConditionResolver → conquestOutcome → scoreTimer), so wonder/relic/conquest all win the tie on the gameLength tick; the `!isMatchRunning()` guard prevents double-finalize.
- **Floating-point equality** — non-issue: `computePlayerScore` wraps the whole expression in `Math.floor`, so `score === maxScore` is exact.
- **Disabled path** — `gameLength === undefined` ⇒ `registerScoreTimerSystem` returns before `registerSystem`, so the system never exists; no stale value can fire it.
- **Save/load** — widening `winCondition` to include `'score'` is backward/forward-safe: it is a plain passthrough with no runtime whitelist/validator; old saves only carry `conquest|wonder|relic|null`. The slice-1 limitation (gameLength not persisted; load disables the timer) is real and correctly implemented.
- **Test proves the mechanic** — spawns route through `addBuildingEntity`/`addUnitEntity`, which increment the exact counters `computePlayerScore` reads; both players keep a TC + AI disabled, so the score timer is the only possible resolution.
- **Doc accuracy** — spec §4.3/§4.4 additions are character-for-character consistent with the implementation.

## Disposition
All three actionable findings fixed. Core mechanic, ordering, and persistence confirmed correct by both reviewers. Proceeding to iteration 2 to verify the fixes landed.
