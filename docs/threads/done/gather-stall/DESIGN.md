# Villager gather gridlock (campaign-4 wood-stall, roadmap "make a sustained match possible")

Objective: villagers ordered/assigned to gather a resource must not jam permanently when many of them crowd one spot. Found by REPLAYING campaign-4's actual bundle (`replay-inspect`: `SessionReplayer.openAt` + `getEconomyState`): at tick 6000 the agent had 19 villagers all wanting wood, task histogram `{to-resource:18, moving:1}` — 0 gathering, wood flat the whole game, agent frozen in Feudal. The gatherer probe showed 14 of 18 stuck villagers targeted ONE tree, 4 a second, with 21 full trees 8 cells away. (Both the LLM's "gather is broken" finding and a subagent's synthetic "enemy attrition" hypothesis were wrong — only the replay showed the truth.)

## Root cause
`assignNearestResource` always picks the globally-nearest matching resource (no spread), and the `to-resource` state — unlike `to-dropoff` — has no give-up path. So extras that can't get an approach cell on an over-crowded tree walk toward it forever.

## Fix (surgical)
`villagerEconomySystem.ts`: a per-tick `gatherTargetCounts` (gatherers per target). In the `to-resource` handler, a villager that has spent >= `GATHER_APPROACH_TIMEOUT_TICKS` (80) walking to an OVER-SUBSCRIBED target (count > `MAX_GATHERERS_PER_RESOURCE` = 2) releases its slot (reservation MOVE — decrement the old target) and is reassigned via `assignNearestResource(preferUnsaturated=true)` to the nearest UNsaturated resource within its own owner tier. The approach timer reuses `gatherProgressTicks` (otherwise 0 in to-resource → no new save state).

## Why surgical (the load-bearing design point)
A first version made ALL assignment saturation-aware (a global cap). It broke the AI age-up: the AI over-gathered food → over-trained villagers → the TC stayed full → it never researched Castle (hoarded 4625 food, stuck in Feudal). So `preferUnsaturated` defaults to FALSE on the normal idle→assign path (unchanged nearest-first), and is TRUE only when redistributing a genuinely-stuck over-subscribed villager. The AI's tuned economy is untouched; only piled-up extras fan out.

## Review-driven refinements
- Owner-preference is compared BEFORE the saturation tiebreak, so fan-out never jumps to an enemy/neutral tree just because it's unsaturated (Codex HIGH).
- Reassignment decrements the old target's count (reservation move) so once the excess leaves, the target is no longer over-subscribed and the within-cap gatherers stay put (Codex MEDIUM).

## Determinism / fog
Deterministic — `query()` order + stable sort, no randomness. No save-format change (reuses `gatherProgressTicks`; `gatherTargetCounts` is rebuilt each tick).
