# Debugging session — Narrow-choke lateral wrapping

## Symptom

The user reported that units in a narrow space try to wrap around the unit in front instead of waiting behind it, and asked that temporary unit traffic be distinguished from permanent roadblocks.

## Expected vs actual

- Expected: same-direction friendly movers retain their route and form a deterministic centered queue through a one-cell passage.
- Actual: three villagers could occupy one coarse corridor cell simultaneously with lateral fine roots, visually moving abreast around the leader.

## Reproduction

The existing `narrow-corridor-fixture` was driven through the real bridge with four selected villagers ordered east. `getDebugSnapshot().coarseVsFine` showed three villagers together at coarse `(12, 8)` with fine roots `(12.5, 8.25)`, `(12.0, 8.25)`, and `(12.75, 8.75)`. The RED regression reported two entrants on tick 2: ids 2196 and 2199.

## Hypotheses

- [x] Global A* treats friendly units as hard blockers and finds a long route around them. Disproved: `isCellPassableForUnit` intentionally ignores unit crowding.
- [x] The occupancy/subcell layer creates the visible wrap after A* chooses the correct terrain route. Confirmed: movement entered the occupied coarse cell unconditionally, then `syncUnit` allocated a different lateral slot.
- [x] A local wait decision can preserve the cached route and remove the wrap without changing general subcell sharing. Confirmed by the focused bridge trace.

## Investigation log

- 2026-07-19 10:20 — Audited `movementPlanOps`, `cellPassability`, `transformOps`, and `worldOccupancy`; permanent-only A* was confirmed as intentional.
- 2026-07-19 10:32 — Captured the live coarse/fine corridor trace and identified the three-abreast subcell result.
- 2026-07-19 10:43 — Added the queue regression first; one test failed on simultaneous tick-2 entry while eventual progress, repeated traces, and save/load were already characterized.
- 2026-07-19 10:53 — Added tick-start traffic arbitration and centered choke movement; all 13 focused corridor/cache tests passed.
- 2026-07-19 11:18 — Adversarial review rejected the straight-move-only slice: task movers were excluded, unsaved path-cache direction could diverge after restore, and a bend's open corner flank disabled choke detection. Three focused REDs reproduced all three gaps.
- 2026-07-19 11:31 — Removed route-cache direction from arbitration, included serialized player/monk/gather intent, treated either endpoint's blocked flanks as a narrow leg, and made an active friendly occupant of the next cell wait-worthy through turns.
- 2026-07-19 11:42 — Second adversarial review found symmetric head-on waiting and same-tick gather-task activation bypasses. Two REDs reproduced stable-id deadlock and a follower missing a frozen intent snapshot.
- 2026-07-19 11:50 — Added per-tick attempted-leg reservations and serialized intent directions. Same/turning traffic queues, pure head-on and cross-flow conflicts yield by stable entity id, and late task activation becomes visible before any later movement attempt.
- 2026-07-19 12:02 — Third adversarial review found that misleading final-target headings could still deadlock by call order, four-unit occupied loops had no winner, and late co-located workers could both proceed. Three REDs reproduced the second-tick pair deadlock, directed cycle, and double admission.
- 2026-07-19 12:14 — Persisted the last actual cardinal traffic leg additively on the unit transform, detected directed occupied-cell cycles, admitted only the cycle's lowest id, and added a per-tick origin reservation. All 12 focused traffic contracts passed.
- 2026-07-19 12:31 — Fourth adversarial review found stale remembered legs surviving new intent, existential cycle acceptance in a multi-occupied cell, noncalling occupants participating in winner election, and owner-blind origin reservations. Four focused edge tests made three defects RED and pinned the already-conservative noncaller behavior.
- 2026-07-19 12:46 — Added intent/tick provenance, required every occupied dependency branch to close through a current or previous-tick caller, and scoped origin reservations by owner. All 16 traffic contracts passed; fifth adversarial review found no remaining code blocker.
- 2026-07-19 13:04 — The full unit suite exposed only the 500-LOC architecture gate after four persistence fields pushed `types.ts` to 508 lines. Extracted the additive authority shape to `movementPersistenceTypes.ts`; the component contract remains unchanged and the file-size regression is green at 497 lines.

## Root cause

The global route correctly classified units as soft traffic, but the movement executor had no narrow-choke traffic rule, so subcell allocation turned soft sharing into visible lateral passing.

## Fix

`movementTrafficOps.ts` now derives a static straight or turning choke from permanent flank blockers, snapshots serialized task traffic once per tick, augments it with actual attempted legs and one owner-scoped origin reservation, elects a deterministic leader from the caller's immediate step, and tells followers to wait while retaining their task and cached path. It deliberately does not read the transient path cache. Each attempt persists its cardinal leg plus intent/tick provenance, and a directed occupied-cell cycle admits only its lowest id when every occupied branch closes through a recent caller; stale, extra, and noncalling occupants remain conservative blockers. `transformOps.ts` centers the lateral axis inside the choke before advancing longitudinally.

## Verification

- `npx vitest run tests/architecture/fileSizeBudget.test.ts tests/simulation/narrowCorridorQueueing.test.ts tests/simulation/movementTrafficArbitrationEdgeCases.test.ts` — 18/18 passed.
- `npx tsc --noEmit` — passed.
- `npm test` — 2,165 passed and 2 skipped across 287 passed and 1 skipped test files.
- `npm run typecheck`, `npm run lint`, and `npm run build` — passed; the production build transformed 565 modules.
- `npm audit --omit=dev` and `npm audit` — zero vulnerabilities in both trees.

## Follow-ups

Opposing-flow fairness, formation collapse/reform, and bounded yielding for a deliberately idle unit are separate mechanics. The existing civ-engine equal-cost A* suffix weakness remains independent and is not changed by this local traffic layer.
