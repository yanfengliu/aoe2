# Phase 1B unit.contextAtEntity Implementation Review (impl-6)

**Date:** 2026-05-01
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ACCEPT (Claude — all 6 points verified; Codex worked around PowerShell sandbox via direct file reads)

## Both reviewers ACCEPT

**Claude verified all 6 points:**
1. `routeUnitContextAtEntityCommandDirect` non-monk routing matches pre-1B body verbatim modulo facade→helper substitution. `garrisonUnit` retained.
2. Validator's `monk_should_route_via_facade` rejection makes the bridge facade the sole monk path.
3. Bridge facade still calls `issueMonkContextCommandAtEntity` unchanged for monk routing.
4. Submission shape `{ unitId, targetEntityId }` matches `GameCommands['unit.contextAtEntity']`.
5. No mid-tick `submitWithResult` from `execute` — handler delegates only to direct helpers + `garrisonUnit`.
6. Test timing: castle.test.ts loop step(100) per iteration; fu3DefensiveFire.test.ts captures `beforeHp` BEFORE garrison + 15× step(100) tail tracks the pre-1B reload window correctly.

**Codex** worked around the Windows PowerShell sandbox `git diff` block by reading files directly. Reviewed routing, validator gates, registration, submission shape, and test timing — same verdict.

## Test fix discovered: TPS ≠ 60

Mid-implementation found that aoe2's prototype scenario uses TPS=10, NOT 60. tickMs = 1000/10 = 100, so `bridge.step(100)` triggers exactly 1 tick. Previous test fix attempts using `step(17)` advanced ZERO ticks, leaving the queue undrained. All Phase 1B tests now consistently use `step(100)` for single-tick advancement.

Also discovered: when the same step's processCommands drains a garrison command, the same step's combat phase fires the Castle's first reload with the freshly-garrisoned archers. The fu3DefensiveFire tests had to be reordered to capture `beforeHp` BEFORE the garrison loop, so the per-reload damage assertion still holds.

## Test count + gates

- 6 new tests in `tests/commands/unitContextAtEntity.test.ts`.
- 3 existing tests updated for handler timing (castle 20-villager, fu3 3-archer, fu3 5-archer).
- 574 tests pass + 1 skipped (was 568 + 6 new).
- typecheck, lint, build all green.

## Phase 1B → next steps

5 of 15 commands complete. Next per PLAN: `sheep.move` (simplest of remaining — only sheep entities, no AI/deterministic-system path).
