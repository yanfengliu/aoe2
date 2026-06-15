# Debugging session — campaign-9 "human wood stays ~0" (and idle food villagers)

## Symptom
Campaign-9 playtest finding (c): the LLM-human's wood stockpile hovers near 0 the whole game. Open question from the roadmap findings log: is this a wood-gather bug (like the campaign-4 woodcutter gridlock) or just allocation/spend?

## Expected vs actual
- Expected (if a bug): woodcutters assigned to wood but not actually gathering (stuck), or piled on one tree.
- Actual (ground truth via replay): wood gather is healthy; the real anomaly is FOOD villagers sitting idle next to abundant food.

## Reproduction
Replay the actual recorded run (engine debug tools first — no synthetic repro):
- `npm run replay:inspect -- output/playtests-llm/campaign-9.json --ticks 0,250,500,1000,1500,2000,2500,3000`
- `npm run replay:inspect -- output/playtests-llm/campaign-9.json --ticks 2500 --detail 2500 1`
- Throwaway component dumps (cleaned up): owner-1 villager `gatherer` components + nearby food resources at tick 2500.

Owner 1 = the LLM human; owner 2 = the in-game AI (campaign-6+ uses `--owners 1`).

## Hypotheses
- [x] Wood gather is broken (stuck woodcutters / one-tree pile-up) — RULED OUT. At tick 2500 the 4 wood villagers are all active (3 `to-resource` + 1 `to-dropoff`) across 2 distinct trees (fan-out working), and wood rises at points (75→85→90; 0→10). Gather + the v0.1.24/25 fan-out are healthy.
- [x] Idle villagers are garrisoned (fled the tick-2000 raider) — RULED OUT. `garrisonedUnitToBuilding` is empty; the idle villagers have no `garrisoned` component and DO have map positions (clustered at (9–10,7) by the TC). (`getEconomyState` reported their position as `undefined` — a snapshot quirk; raw components show real positions.)
- [x] Idle villagers have no reachable food (Dark-Age depletion / farms gap) — RULED OUT. At tick 2500 there are 5 FULL berry-bushes (125/125, ~5 cells) and 2 full boars (~2 cells) within 6 of the TC; berry-bushes dropped 12→8 from tick 1500→2500, so food IS gatherable and being gathered by others.
- [x] Human villagers aren't auto-assigned when idle — CONFIRMED root cause.

## Investigation log
- 2026-06-15 — Overview replay: owner-1 wood = 200→175→75→85→90→0→10→10; wood villagers 1→4; food climbs then falls (spent). Wood fluctuates UP and down → gather works.
- 2026-06-15 — Detail at tick 2500: 8 villagers = {to-resource 3, to-dropoff 1, idle 3, moving 1}; desired = {wood 4, food 4}. The 4 wood are active; the idle/moving are the 4 FOOD villagers. Trees full + nearby; to-resource woodcutters across 2 distinct trees (no pile-up).
- 2026-06-15 — Food + component dump: 4 food villagers `task=idle desired=food target=- hasExplicitGatherOrder=false`, abundant full berries/boar adjacent. Wood villagers all `hasExplicitGatherOrder=true`.
- 2026-06-15 — Code read: `villagerEconomySystem` idle→assign is gated by `shouldMaintainGatheringOrder(owner, gatherer)` = `owner !== HUMAN_PLAYER_ID || gatherer.hasExplicitGatherOrder` (`pureHelpers.ts:316`). The AI (owner≠1) always auto-assigns; a HUMAN villager only auto-assigns when it has an explicit gather order. New villagers default to `desiredResource='food'` + `hasExplicitGatherOrder=false` (`entityCreateOps.ts:185`), so a freshly-trained human villager that is never explicitly tasked stands idle forever.
- 2026-06-15 — `productionQueueSystem.ts:110-113`: a trained unit with a building rally point gets `issueUnitMoveCommand(unitId, rallyPoint)` — a MOVE to the rally position only. It does NOT gather even if the rally position is a resource. Rally points are stored as a bare `Position`.

## Root cause
Wood is fine. The economic drag is that newly-trained HUMAN villagers default to `desiredResource='food'` but `hasExplicitGatherOrder=false`, and the deliberate `shouldMaintainGatheringOrder` gate means human villagers are NOT auto-assigned without an explicit order — so untasked new villagers idle at the Town Center despite abundant food. This is AoE2-faithful ("new villagers idle until tasked/rallied"), so it is NOT a sim bug; the missing piece is the AoE2 anti-idle mechanism — a rally point set ON a resource that makes new villagers auto-gather it — which is unimplemented (rally is move-only).

## Fix
Deferred to a focused next iteration (recorded in `design/roadmap.md`): implement rally-point-to-resource auto-gather. When a building's rally point cell holds a harvestable resource, a newly-trained villager should auto-gather it (set `desiredResource` from the resource kind, `hasExplicitGatherOrder=true`, `task='to-resource'`, `targetResourceId`) instead of merely moving there. This is the spec's "set rally point" order (§9.3) in full AoE2 semantics, it advances the game, and it lets the LLM set-and-forget a food/wood rally so new villagers stop idling. Follow-on (harness): surface idle-villager count in the agent snapshot so the LLM rallies/tasks them.

## Verification
- Investigation only this iteration (no code change). The fix iteration will add a TDD test (train a villager with a rally on a berry-bush → it ends up gathering) + the full gate + multi-CLI review.

## Follow-ups
- Not an engine gap — this is our sim/bridge (`productionQueueSystem` + `villagerEconomySystem`). No `docs/engine-feedback` entry.
- Roadmap findings log updated: campaign-9 (c) resolved as not-a-bug; new finding = idle untasked human villagers / rally→gather feature gap (the real lever behind finding (b) "neither ages up").
- Lesson candidate: the "engine debug tools first" rule again paid off — a suspected "wood gather bug" was disproven by replay, and the real cause (idle untasked villagers) was something a synthetic wood-gather repro would never have surfaced.
