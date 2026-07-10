# Debugging session — 16 `no-pinned-or-oscillating-units` violations (canary drill baseline)

## Symptom

The 2026-07-09 oracle canary drill (`npm run playtest:canary`) reported `canary-invalid` for the pinned-units canary: the UNPATCHED baseline (`npm run playtest -- --seed aoe2-canary --max-ticks 3000` + oracle sweep) fires `no-pinned-or-oscillating-units` 16 times. loop-ops DIRECTIVES made these 16 violations priority 1. Ledger: `output/self-improvement/recursive/canary-pinned-units-20260709161951/baseline/ledger.json` (bundle `run.json`, replay self-check strong: 3 segments, 0 skipped, 0 divergences).

## Expected vs actual

- Expected: a healthy run stays quiet on the pinned oracle; violations mean units that should be moving are stuck.
- Actual: 16 medium violations on units 2205-2208, 2210, 2211, 2216, 2221, 2254-2257, 2259, 2277, 2278, 2280.

## Reproduction

- `npm run playtest -- --seed aoe2-canary --max-ticks 3000 --out <prefix>` then `npm run playtest:self-improve -- --current <prefix> --oracles --out <ledger>`. Deterministic, LLM-free.
- Ground truth read via `SessionReplayer.fromBundle` + `createReplayWorldOnly` (temporary scripts under `tmp/debug-pinned/`, removed at session close) — per the "engine debug tools FIRST" rule, no synthetic repros were used for diagnosis.

## Hypotheses

- [x] Some violations are real stuck units — CONFIRMED for exactly 2: both AI scouts (2257, 2259).
- [x] Some violations are oracle false positives — CONFIRMED for the other 14 (three sub-classes, one root cause: position-only pinning).

## Investigation log

- 2026-07-09 — Replayed the actual canary baseline bundle (owner 1 = inert human, owner 2 = AI). Owner-level economy is healthy for owner 2 (3→10 villagers, dark age, 7 buildings by t2999).
- Per-entity ground truth at ticks 0/60/300/900/2999:
  - 2210, 2211, 2216, 2221 at tick 0 are **berry bushes/resources**, not units. Their ids were reused for villagers trained later. The oracle's `reconstructPositions` timeline spans the whole bundle per id, so the resource phase (stationary, obviously) was evaluated as unit movement. **Entity-id reuse conflation.**
  - 2205, 2206, 2207, 2208 are the **inert human's** villagers + scout. No driver ever commands owner 1 in this run; idle units standing still is correct behavior. (2205's id was also reused for an owner-2 villager after the original died ~t900.)
  - 2254, 2255, 2256 are owner-2 villagers in the normal opening: idle a few ticks at spawn, walk <3 cells to the berry cluster, then stand gathering — trips the 50-tick/<3-cells sliding window.
  - 2277 is a **zero-walk gold miner**: TC 2209 anchor (48,24) footprint 4x4 spans y=24..27; miner at (48,28) is adjacent to both the TC and mine 2223 at (48,29). Fill → instant adjacent deposit → reassign, never needs to move. Mine drains 800→345, stockpile grows — optimal, not stuck.
  - 2278, 2280 move constantly (1632 position events between them); their windows were transient gather stalls.
  - 2257 (AI base scout): has `velocity`+`wanderBounds`, moved 1 cell then **wedged at (47,25) for 2985 ticks**: its next step (48,25) is inside its own TC footprint; `scoutMovementSystem` resets the transform on an impassable next cell but never changes velocity → it re-steps into the TC forever. Velocity only reflects at wander-bounds edges, not at obstacles.
  - 2259 (forward enemy scout, `defaultMap.ts`): spawned with **no `velocity`/`wanderBounds` at all** — the wander system's query `('position','velocity','wanderBounds')` never matches it. Stationary for the full 3000 ticks.

## Root cause

Two real gameplay defects — (a) `scoutMovementSystem` has no obstacle deflection so a scout wedges permanently against any impassable cell inside its bounds, (b) the forward enemy scout spawn omits the wander components — plus one oracle defect: position-only pinning that ignores unit-component lifetimes (id reuse), owner drivenness (inert human), and legitimate stationary gathering.

## Fix

(As shipped after the adversarial-review round — the review's empirical probes forced several semantics past the first design; see Round 3 below.)

- `src/game/playtest/pinnedUnitsOracle.ts` (new; extracted from `oracles.ts`): evaluates per unit-lifetime interval (id reuse safe, including same-tick kill+reuse — a unit.set changing owner/unitType on an open interval is a lifetime boundary because the engine nets remove+set into a pure set); skips units of undriven owners (no AI state in any snapshot, no market.action, no recorded command whose whitelisted ACTOR key resolves to the owner's entities at the command tick); splits confinement spans at garrison position gaps; scans TWO confinement boxes per segment — tight `pinnedNetProgressCells` (3) → `pinned`, wide `pinnedOscillationBoxCells` (6) → `oscillating`, tight verdict wins — each firing at span ≥ `pinnedStuckTicks` (default 1200); a confined span is exempt only while the LATEST interior snapshot `gathering` sample is younger than `pinnedStuckTicks` (bounding snapshots consulted only when the span has zero interior samples) — keeps the zero-walk miner quiet while a frozen `to-resource` villager (canary patch class) and a once-gathering-then-frozen villager both fire.
- `scoutMovementSystem.ts`: on an impassable next grid cell, `pickEscapeHeading` emulates each candidate heading's stepped path and 90° rotation survives only as the boxed-in fallback (see Round 2); a scout stranded outside its box walks home via a current-cell-widened effective box instead of clamp-teleporting (see Round 3).
- `startingOffsets.ts` / `defaultMap.ts`: AI base scout gets 2-D wander velocity and a wider asymmetric wander box; forward enemy scout gets velocity + wander bounds so it patrols mid-map.

## Round 2 — prove rerun residue (reflection-cancelled rotation livelock)

The first prove rerun dropped 16 → 1: scout 2257 now roams ~500 ticks, then freezes at (38,18) from t498 to match end (2502 ticks, `movesInSpan: 0`). Replay showed no pending commands and a velocity that KEEPS rotating — the system runs but every step is rejected. An env-guarded trace in `scoutMovementSystem` (removed after use) caught the exact two-state livelock:

- (38,18) is the wander box's west edge (minX=38, fine 152); the AI's own forward house occupies (39..40, 18..19) directly east.
- Heading (1,1) steps to fine (157,76) → cell (39,19) = house → rejected → transform reset + rotate 90° CW to (-1,1).
- Next tick the BOUNDS REFLECTION sees fineX 153−2 < 152 and flips dx straight back to (1,1) — the heading that just failed. States alternate forever; the escape heading (1,-1) is never tried.
- The escape is phase-dependent: from slot fine (153,72), (1,-1) crosses y before x — a legal "staircase" through grass (38,17) → (39,17) that never touches the house. A naive no-corner-cutting rule would wrongly reject it; only step emulation sees it.

Fix (round 2): on rejection, `pickEscapeHeading` emulates up to `UNIT_SUBGRID_RESOLUTION` fine steps per candidate heading (CW rotations first, current heading last) with bounds reflection + clamp identical to the live loop, and assigns the first heading that reaches a different passable cell; reflection-cancelled candidates are rejected naturally by the emulation. If none is viable (genuinely boxed), keep the old 90° rotation so the scout re-probes as the world changes. The no-transform fallback path gets the grid-level analogue (`pickGridEscapeHeading`).

## Round 3 — adversarial-review probes (17 confirmed findings pre-commit)

The in-process review (4 finder dimensions, 19 findings, 17 confirmed by independent refuters who REPRODUCED the code claims with probe bundles) caught four real oracle/sim defects in the round-1/2 design before commit:

- **HIGH — stale gathering sample swallowed real freezes:** ANY-sample exemption + always-consulted bounding snapshots meant one old `gathering` sample (or a pre-span bounding one) exempted an arbitrarily long later freeze — the exact false-prove direction. Fixed with the gathering-SUFFIX rule + interior-samples-first (probes P1/P2 are now tests).
- **MEDIUM — amplitude ≥3 oscillation invisible:** every leg re-anchored the tight box, so a shuttle livelock could never accumulate a span; the deleted sliding-window oracle had caught it. Fixed with the second, wide confinement box (`pinnedOscillationBoxCells` 6) sharing the same exemptions.
- **MEDIUM — same-tick kill+reuse merged lifetimes:** civ-engine `ComponentStore.set()` clears the removed mark, so a same-tick destroy+train emits a pure `unit.set` and the id's two units merged into one interval (false pin attributed to the newborn). Fixed: owner/unitType change on an open interval is a boundary.
- **MEDIUM — garrison round-trip counted as confinement:** `activeUntil` forgets a removal once position is re-set; a 1400-tick garrison stay read as a 1650-tick pin. Fixed: `positionReplay` records gaps; the scan splits segments at them.
- **MEDIUM — wander-resume clamp teleport:** a scout stranded outside its box by an auto-aggression chase was clamp-snapped to the box edge in one tick (multi-cell teleport, newly reachable at scale via the forward scout). Fixed: the effective box widens to the current cell, so the edge reflection ratchets it home step by step; walled-off scouts patrol in place and the oracle reports them honestly.
- **MEDIUM — streak test aliasing:** the 25-tick-sampled stationary-streak regression test could not see a period-2 cell alternation; rewritten to per-tick reads with a ≥3-distinct-cells-per-600-tick-block bound.
- Also: drivenness suffix heuristic replaced with an explicit per-command actor-key whitelist typed over the full command surface (`unit.gather.resourceId` and `market.action.playerId` mis-resolved); `netManhattanProgress` deleted (dead since the rework); the no-transform escape path unified onto the emulator; doc/spec/changelog wording corrected against shipped semantics (five accuracy findings).

Two findings were refuted by the verifiers and intentionally not acted on beyond hygiene: the 200-tick wander test timeout (5.9× headroom measured) and the grid-fallback livelock (unreachable in production — every wander unit gets `unitTransform` unconditionally; the path was unified onto the emulator anyway).

## Round 4 — the hardened sensor immediately earned its keep (pocket orbit)

The post-review prove rerun was clean of every ORIGINAL class but the new wide-box verdict fired once: forward scout 2259 "oscillated within 5 cells of (46,17) for 2963 ticks (1185 moves)". Replay showed the pocket (water NE, forest W, berries S) is NOT closed — the whole y=19 row south of it is open grass. Root cause: pure diagonal bounce + a FIXED escape-candidate order is a deterministic billiard, and inside a blocker pocket it settled into a closed limit cycle; no randomness exists to break it. The class was invisible to the old oracle (every leg re-anchored the tight box) — this finding exists only because round 3 added the wide box.

Fix: `applyWanderKick` — every 400 ticks (staggered by unit id, kick angle cycling 90°/180°/270°) the wandering scout's heading rotates deterministically. A closed orbit would need to be invariant under all three interleaved rotations. Pure, stateless, tick-derived: replays and saves stay byte-identical. Prove rerun 4: `no-pinned-or-oscillating-units` ABSENT (0 findings) under the hardened oracle, replay self-check strong (3 segments, 0 skipped, 0 divergences).

## Verification

- New unit tests: `tests/playtest/pinnedUnitsOracle.test.ts` (id reuse both shapes, undriven-owner gate + actor whitelist, driven-stationary fires) and `tests/playtest/pinnedUnitsOracle.confinement.test.ts` (gathering-suffix exemption incl. review probes P1/P2, frozen to-resource fires, garrison round-trips, churn, wide-box oscillation), scout wander deflection + spawn spec tests.
- Round 2: pure-helper tests replicate the recorded trap exactly (fine (153,72), west edge, house east): reflection-cancelled heading rejected, staircase accepted, deterministic pick `(-1,-1)`, boxed-in returns null.
- Round 3: per-tick livelock regression (≥3 distinct cells per 600-tick block over 2000 live ticks, catches freeze AND two-cell ping-pong) and the stranded-scout walk-home test (≤1 cell/tick, re-enters the box).
- Full gates: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Prove at bug-class granularity: rerun the canary baseline (same seed/ticks) + oracle sweep → `no-pinned-or-oscillating-units` absent; then `npm run playtest:canary` → pinned canary flips `canary-invalid` → `canary-ok` (quiet baseline, patched run fires).

## Follow-ups

- Real auto-scout AI (waypoint exploration toward unexplored fog) would be the AoE2-authentic upgrade over bounded wander — candidate for a future design directive.
- Lesson for `docs/learning/lessons.md`: a verified-by-metric oracle finding is still a claim about the METRIC, not the game — 14/16 "pinned units" were the sensor flagging bushes, undriven owners, and healthy gatherers.
