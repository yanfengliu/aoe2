# Gather-unreachable reroute — villager gridlock on a boxed-in resource

## Origin

campaign-11 (2026-06-16, v0.1.46, the first $15 / 6000-tick re-grounding). Ground-truth replay (`replay:inspect` + two `tmp/` probes) plus the `playtest:findings` conformance probe INDEPENDENTLY surfaced the same [high] functional bug: the LLM-human's 6 villagers stack-deadlocked on cells (9,7)/(11,7), boxed by the TC/mill/houses, latched in `to-resource` and never reached `gathering` — food frozen at exactly 21 for ~3000 ticks (tick 3000→6000), so it never accumulated the 500 food for Feudal. The whole game stalled in the Dark Age behind this one bug. (Owner 2 / the AI thrived economically but ALSO never aged up despite 510 food — a separate, known AI age-up-prioritization gap, NOT in scope here.)

## Confirmed root cause (replay + consecutive-tick trace, not narration)

The target sheep `res2163` @(6,6) is OWNED (owner=1) and harvestable, but **unreachable**: all 8 of its approach cells are blocked (3 sides by berry bushes res2170/2171/2172, the rest by the player's mill/houses + forest), so `findResourceApproachPlan` returns null. In `villagerEconomySystem`'s `to-resource` block, a null approach plan falls into "branch A" (lines 299-305) which sets the villager to `idle` (no step, no record of the failure). The bottom-of-loop `idle→assign` (line 486) then immediately re-assigns it. Because `assignNearestResource` sorts owner-OWNED resources (tier 0) strictly before reachable neutral home-base resources (tier 1), and there were TWO owned-but-unreachable sheep (res2163 + res2161), the villager **ping-pongs between the two unreachable sheep every tick** (confirmed: a clean 2-tick limit cycle `{2163:6}`↔`{2161:4,2163:2}`, `gatherProgressTicks=0` every tick, positions frozen). Two consequences make it permanent:

1. The reassign resets `gatherProgressTicks=0` each tick, so the existing over-subscription give-up (which needs `prog≥80`) NEVER accumulates.
2. The unreachable OWNED sheep always outrank the REACHABLE neutral berries (6 of them, ~120 food each), so the villagers never fall through to a resource they could actually gather.

Net: food income 0 forever. Confirmed by elimination (prog=0 every tick ⟹ the prog-gated give-up cannot be the active path ⟹ it is branch-A idle→reassign) and by direct probes (food inventory shows 6 reachable berries + a 2nd sheep all unused; `unitCommands` slot empty so the economy system fully owns these villagers; `isHarvestableResource(sheep)=true`).

## Fix (in-repo, surgical, no engine change, no save-format change)

The gather state machine must RECOVER when its target is unreachable instead of latching/oscillating — exactly the probe's suggestion ("repath or re-target an alternate resource"). We keep the owner-tier preference (intentional — Codex gather-stall iter-1 HIGH) but make the recovery path reachability-aware:

1. **Extract** `assignNearestResource` from `villagerEconomySystem.ts` (currently 499 LOC — adding code breaches the 500 hard cap) into a new `bridge/villagerGatherAssignment.ts`, behaviour-preserving. Add two OPTIONAL params: `requireReachable` (default false) and `excludeResourceId` (default null). When `requireReachable` is true, after the existing sort, pick the first candidate that is (a) not the excluded id and (b) has a non-null `findResourceApproachPlan`; if none, leave the villager idle (tgt=null). When false, behaviour is byte-identical to today (the two existing call sites — idle→assign and the over-subscription give-up — pass neither flag, so they are unchanged).
2. **Split branch A** in the `to-resource` block: `!targetResource || !isHarvestableResource` → idle/to-dropoff as today (depleted/gone). The NEW sub-case `!resourceApproachPlan` (resource exists + harvestable but unreachable) → if the villager is carrying, deposit first (`to-dropoff`); else release this villager's slot on the unreachable target and call the reachability-aware reassign with `excludeResourceId` = the unreachable target. The villager falls through from the unreachable resource to a reachable one (or, if NOTHING is reachable — the genuinely-fully-boxed edge — does not gather, with the per-tick scan bounded by `MAX_REACHABILITY_PROBES`).

Cost: `findResourceApproachPlan` (BFS) is only run for villagers that hit the unreachable branch (the two hot existing call sites add zero pathfinding), and that scan is BOUNDED — it probes at most `MAX_REACHABILITY_PROBES` (16) of the nearest candidates. In the realistic boxed scenario the villager finds a reachable resource within the first few probes and leaves the branch; in the pathological fully-boxed case the bounded probe count caps the per-tick cost instead of scanning every resource on the map. No new persistent state; uses `findResourceApproachPlan`, already a system dep.

## Tests (TDD, contract-first)

- **Mechanism** (`villagerGatherAssignment.test.ts`): the extracted `assignNearestResource` with `requireReachable` picks the reachable far resource over an unreachable nearer one, honours `excludeResourceId`, and idles when nothing is reachable. Fails before the reachability logic exists.
- **Integration regression** (the probe's requested test — "N villagers boxed beside buildings must still reach a resource and increase the food count"): a new `gather-unreachable-reroute` fixture — a boxed-in food resource (a farm ringed by tree blockers, the NEAREST food) + reachable berries farther out + 3 player-2 villagers that auto-gather. With fewer food villagers than the over-subscription fan-out cap (4) they stay latched on the unreachable farm pre-fix (food flat, berries untouched); post-fix they reroute and the reachable berries are gathered + food rises. Verified to fail before the fix and pass after.

## Out of scope (recorded for later slices)

- (medium) Houses may not count toward the Feudal 2-building prerequisite (probe finding) — verify `getBuildOptions`/age-advance counting separately.
- (medium) Accepted-vs-executed UX gap — no "cannot reach target / stuck" signal to the controller; the LLM blindly re-sent ~70 no-op orders.
- AI age-up prioritization (the AI sat on 510 food in Dark Age) — a separate AI-behavior change.
- The genuinely-fully-boxed villager (NO reachable resource of its desired type) does not gather and re-evaluates each tick (the bottom idle→assign re-arms the reroute), but the bounded reachability probe (`MAX_REACHABILITY_PROBES`) caps the per-tick pathfinding so it does NOT scale with the map's resource count — this was the 3-CLI review's main finding (Codex/Claude MEDIUM, Gemini HIGH), now bounded.
