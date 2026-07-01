# Drop-off reroute — reachability-aware drop-off selection

## Origin

Found by an AI-vs-AI re-grounding run on 2026-07-01 (the meta-goal: is the playtest→find→improve loop actually reaching the mid-game?). Grounding the premise "the built-in AI reaches the mid-game" against a real 8000-tick deterministic run OVERTURNED it:

- The deterministic playtest is AI(owner 2) vs an INERT owner 1 (the human slot gets no AI in a headless run) — not a competitive AI-vs-AI match.
- The lone AI (owner 2) never left the Dark Age: food frozen at exactly 121 from tick 1000 to 8000, villagers pinned at 6, gold climbing unused to 1270.
- No oracle flagged this — a match frozen in the Dark Age for 8000 ticks passed the corpus with 0 HIGH violations. (Separate harness gap, tracked below.)

## Root cause (verified by replay ground truth)

Replaying the bundle (`SessionReplayer.openAt` + `getEconomyState`) showed abundant reachable food near owner 2's Town Center (full berry-bushes, boars, sheep at distance 3-6) and two valid food drop-off sites: the Town Center @(48,24) AND a Mill @(45,23). A per-100-tick trace of the food villagers showed them gathering to a full carry (10 food), switching to `to-dropoff`, and then latching there FOREVER — carrying 10 each, never depositing, food never rising.

The deadlock is at `villagerEconomySystem`'s `to-dropoff` branch. `findNearestDropOffBuilding` ([targetFindingOps.ts](../../../src/game/simulation/bridge/targetFindingOps.ts)) returns the nearest drop-off by Manhattan distance with **no reachability check**. When the nearest drop-off's approach cells are all blocked (the AI packed buildings around its own TC), `findBuildingApproachPlan` returns null, the loop calls `setStuck`, and every retry re-picks the SAME unreachable nearest — it never falls through to a farther REACHABLE drop-off. Deposited resources freeze; the economy can't fund villagers or the 500-food Feudal age-up, so the AI is hard-stuck in the Dark Age.

This is the exact symmetric twin of the campaign-11 gather deadlock fixed in v0.1.47 (`gather-unreachable-reroute`): that fix made the *to-resource* leg reachability-aware but left the *to-dropoff* leg with the same latch.

## Fix

Mirror the v0.1.47 pattern on the drop-off leg:

1. `findNearestDropOffBuilding` gains an optional `excludeIds?: ReadonlySet<number>` param (omitted on the hot path → byte-identical behaviour) so a caller can advance past a drop-off it found unreachable.
2. New pure module `villagerDropOffAssignment.ts` — `findReachableDropOff` probes drop-off candidates nearest-first, skipping any with a null approach plan, and returns the first REACHABLE one plus its plan. Bounded by `MAX_DROPOFF_PROBES` (8): the common case (nearest reachable) short-circuits at one probe — same cost as the pre-fix code; the cap only bites for a genuinely boxed-in villager.
3. `villagerEconomySystem`'s `to-dropoff` branch tries the nearest by distance first (unchanged hot path), and invokes `findReachableDropOff` as a RECOVERY path only — when the nearest is unreachable AND the villager has already been stuck a full `GATHER_DROPOFF_RETRY_INTERVAL` on it (`!dropOffPlan && stuckSince !== undefined`). This keeps the hot path and transient-blocking behaviour byte-identical (an earlier version that rerouted on every tick changed transient-block behaviour and broke 28 deterministic tests); the reroute fires only for persistent boxing, the case no existing test exercised. Trade-off: a persistently-boxed villager waits one retry interval (~30 ticks) per deposit cycle before rerouting.

No civ-engine change (pure aoe2 economy-logic fix). No save-format change (no new persisted fields; `dropOffBuildingId` semantics unchanged). Reachability pathfinding runs only on the drop-off retry path, never on the hot deposit path.

## Tests (TDD)

`tests/simulation/villagerDropOffReroute.test.ts` + fixture `dropoff-unreachable-reroute-fixture`: a 2×2 Mill (nearest food drop-off) sealed by a 12-tree ring so its approach is unreachable, a reachable Town Center farther away, and a reachable berry cluster the villagers gather. Pre-fix: food frozen at the start value (villagers fill their carry but never deposit). Post-fix: they reroute to the reachable Town Center and food rises by at least one full carry load.

## Validation

- Unit test red→green (deadlock reproduced, then resolved).
- End-to-end: re-run the 8000-tick AI-vs-AI grounding and confirm the AI's food now rises past the freeze and it progresses out of the Dark Age. (Numbers folded into the devlog entry.)

## Related follow-ups (separate objectives, not this change)

- **Progression oracle** (`oracles.ts:209` explicitly deferred `economy-progression`): a match that never leaves the Dark Age must fail LOUD in the corpus. The replay infrastructure to build it now exists.
- **True AI-vs-AI grounding**: enable an AI controller for owner 1 (the human slot) so the deterministic corpus runs a competitive match instead of AI-vs-inert.
- **AI self-boxing**: the AI packs buildings around its own TC, which is what triggered the unreachable drop-off. The reroute makes the economy robust to it, but tidier placement is a separate AI-quality improvement.
