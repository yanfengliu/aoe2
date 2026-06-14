# Changelog

This changelog lists user-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins are recorded in `docs/devlog/`.

## 0.1.26 - 2026-06-14

### Economy gather-rate technologies now actually speed up gathering

A playtest showed the agent only ever researched the age-up — the economy upgrades existed in the data but did nothing, so there was no reason to research them. The Lumber Camp and Mining Camp gather-rate techs are now live and effective: Double-Bit Axe (Feudal, +20% wood), Bow Saw (Castle, +20% wood), Two-Man Saw (Imperial, +10% wood), Gold Mining and Stone Mining (Feudal, +15%), and Gold/Stone Shaft Mining (Castle, +15%, require their base tech). Effects stack and make villagers fill their carry sooner, raising throughput — meaningful research beyond age-up now exists, which matters most for reaching Castle/Imperial Age before food and wood sources run dry. The in-game AI is unaffected (it still focuses on age-up research), so its tuned economy and timings are unchanged. Farm-food techs (Horse Collar, Heavy Plow) and the carry/movement techs (Wheelbarrow, Hand Cart) are not included yet — they depend on farms and on carry/speed modifiers, which come later.

### Validation

- TDD: `tests/simulation/economyGatherRateTechs.test.ts` (multiplier math + cadence) and `tests/simulation/economyResearchOptions.test.ts` (the techs surface at the right building/age and drop out once researched); full suite green. End-to-end (agent researching and gathering faster in a live match) is validated by the next LLM-playtest re-run.
- Multi-CLI review: see `docs/threads/done/economy-gather-techs/`.

## 0.1.25 - 2026-06-14

### Villagers spread across the forest (no more re-piling on one tree)

Loop 1 (v0.1.24) stopped villagers jamming permanently, but a replay of the next playtest showed they still re-piled onto the single nearest tree — 15 of 16 woodcutters on one tree — gathering at a fraction of their potential, because once a villager finished a trip it was re-assigned to the nearest tree again. Now idle villagers fan out: assignment prefers resources with fewer than a generous cap of gatherers, so crowds spread across the forest. The cap is deliberately generous so the in-game AI's normal play is unchanged (a tight cap over-spread the AI and stalled its age-up). Result: a stronger food/wood economy, so the player can reach Castle Age.

### Validation

- TDD: `tests/simulation/villagerGatherSpread.test.ts` (villagers fan out) and the AI age-progression test both pass — the latter is the guard that the spread cap doesn't perturb the AI's economy (it fails at a tight cap, passes at the generous one).
- Multi-CLI review: see `docs/threads/done/gather-idle-spread/`.

## 0.1.24 - 2026-06-13

### Villagers no longer gridlock when many gather the same forest

**Wood (and any resource) keeps flowing when villagers crowd one spot.** Found by replaying an LLM-playtest bundle with the engine's `SessionReplayer`: villagers ordered to gather wood piled onto the single nearest tree — 14 of 18 woodcutters targeted ONE tree — and jammed permanently walking toward it (0 gathering), so wood stayed flat the whole game and the player was frozen in Feudal. The simulation always sent a villager to the globally-nearest matching resource and a villager walking toward an over-crowded resource had no way to give up. Now, a villager that spends too long unable to reach an over-subscribed resource is reassigned to the nearest un-crowded one, so crowds fan out across the forest and actually gather. Normal (un-crowded) gathering is unchanged, so AI economies are unaffected.

### Validation

- TDD: new `tests/simulation/villagerGatherSpread.test.ts` piles every villager onto one tree and asserts they fan out to multiple trees and the wood drops (fails without the fix). The AI age-progression test still passes (the fix is surgical — only crowded villagers redistribute).
- Found and root-caused with the engine's replay debugging (`npm run replay:inspect`), not a synthetic repro — both the LLM's own "gather is broken" finding and a first synthetic-repro hypothesis ("enemy raids killed the villagers") were wrong.
- Multi-CLI review: see `docs/threads/done/gather-stall/`.

## 0.1.23 - 2026-06-13

### Town Centers and Castles now provide population (toward AoE2)

**Town Centers and Castles now contribute population headroom.** Spec §6.10 has always called for Houses, Town Centers, and Castles to supply population, but the simulation gave Town Centers and Castles 0 — only Houses raised the cap. Now, at AoE2 values: **Town Center +5, House +5, Castle +20**. The cap is fully building-derived: the player's starting Town Center provides the initial 5 (so the opening cap is unchanged at 5), and additional Town Centers, Houses, and Castles add from there. This is the first fix from the new AoE2 coverage roadmap (`design/roadmap.md`) — population is the single biggest throttle on army size and sustained late-game play, and the Castle is now a real population building, not just defense. (The standard 200 population limit is a tracked follow-up; it needs raw-supply accounting to handle over-housing and destruction correctly, so it is not enforced yet — the pre-existing unbounded-by-housing behavior is retained for now and is not reachable at current game scale.)

### Validation

- TDD: new `tests/simulation/populationModel.test.ts` pins the per-building population values; existing bootstrap/darkAge tests confirm the opening cap stays 5 and a completed House still raises it to 10.
- Multi-CLI review: see `docs/threads/done/population-model/`.

## 0.1.22 - 2026-06-12

### Replay fog-owner toggle (spectate any player) + civ-engine 1.0 absorb

**Fog perspective toggle in replay mode.** The timeline panel gains a **Fog: P\<n\>** button (hotkey `Alt+F`) that cycles which player's fog of war the replay renders — the missing piece for spectating LLM playtest campaigns, where the agent plays as player 2 and its base previously sat under player 1's fog. Scope rules: rendered visibility and entity filtering follow the selected owner; simulation state, playback position, selection, and the HUD's resource/age panels stay exactly as before (fog toggle, not a POV switch); "last seen" ghost entities render only for player 1 (the engine records fog memory for the human player alone); the toggle is disabled for single-player bundles, resets to player 1 on every replay entry, and does not exist in live mode (cheat surface).

**civ-engine 1.0.x absorbed** (1.0.0 strict-by-default; 1.0.1 replayer factory contract; 1.0.2 and the additive 1.1.0 landed in the sibling tree during the session — both no-impact for aoe2): `saveGame()`'s pre-serialize state flush now runs inside the engine's `runMaintenance` window (same semantics, sanctioned phase); replay test stubs honor the new `factory_snapshot_not_applied` contract. Zero gameplay behavior change. Operator note: civ-engine 1.0's bundle version policy makes replay same-engine-major tooling — bundles recorded under 0.x (campaign-1/-2) replay only with 0.x checkouts; new recordings replay normally.

### Validation

- All four gates green (1215 tests); 17 new tests (fog rendering + adapter-dispose mechanism at the replay bridge incl. the HUD-stays-P1 pin, controller fog API incl. transactional-enterReplay/setFogOwner pins, dispose wiring, cached candidates, timeline button, Alt+F hotkey).
- Multi-CLI review: see `docs/threads/done/replay-fog-owner/`.

## 0.1.21 - 2026-06-11

### Actionable command rejections + agent affordances (campaign-1 backlog #1-#3)

Campaign-1 (the first full-length LLM playtest) showed the agent burning ~7 decisions (~$4) reverse-engineering the feudal-age prerequisite rule from bare `cannot_research` rejections, and losing 19/27 placement commands to blind house placements answered with a bare "Placement blocked.". This release makes every relevant rejection state its actual reason and gives the agent the affordances to act correctly the first time.

**Rejection messages now state the unmet rule (all command submitters; the human HUD toast passes the richer message through for `placement_blocked` and for research rejections sharing the `cannot_research` toast slot — e.g. re-clicking an in-flight tech now toasts "feudal-age is already being researched." — while train/build insufficient-resource toasts keep their terse pre-existing strings):**

- `cannot_research` — names WHY: "Advancing to feudal-age requires 2 completed Dark Age buildings (mill, lumber-camp, mining-camp, or barracks) — you have 1.", "fletching is already researched.", wrong-building rejections name where the tech IS researched, and the fallback lists what is currently researchable at that building. The HUD toast passes this message through (was a fixed "Cannot research that here.").
- `cannot_train` — names the rejected unit + building and lists what is currently trainable there.
- `insufficient_resources` (research/train/build) — need-vs-have detail per missing resource: "need 500 food (have 320)".
- `placement_blocked` — names the blocking cause + cell ("blocked by water at (43,18)"), the blocked-cell count, the footprint size, and the nearest open anchor fully visible to the acting owner when one exists within the scan radius. The HUD toast passes this through (was a fixed "Placement blocked.").
- `in_flight_tech` — names the tech already being researched.
- Rejection CODES and accept/reject decisions are byte-identical to 0.1.20 — only message text changed.

**New public `SimulationBridge` surfaces (consumed by the LLM-agent snapshot):**

- `getAgentBuildingOptions(ownerId)` — per completed owned building type: research available now (with costs), research visible-but-locked with the actionable reason (shared engine with the validator, so the two surfaces never disagree; in-flight techs marked "already being researched"), trainable units, and the villager build menu with footprints + costs.
- `findOpenPlacementAnchorsNear(ownerId, x, y, w, h, max)` — deterministic ring scan for open building anchors near a point; every footprint cell must be unblocked AND currently visible to the owner (fog reveals nothing).

**LLM-agent snapshot/prompt:** new `buildingOptions` + `placementHints` blocks (up to 6 open 2x2 + 4 open 3x3 anchors near the town center); the `building.placeConfirm` tool description now explains anchor semantics and points at the hints.

### Validation

- All four gates green: 1198 passed + 2 skipped (36 new tests across the reason engine, placement describer/anchor scan, validators, buildingOptionsOps incl. a live-bridge campaign-1-case integration test, snapshot pass-throughs, and prompt rendering).
- Multi-CLI review: see `docs/threads/done/agent-affordances/`.
- Two technology tests' caps bumped 30s→90s (contention-flake class, vitest-timeout-headroom precedent; both pass isolated).

## 0.1.20 - 2026-05-08

### Bug fix: Visual non-overlap snap on move arrival + wider BFS

Two §12.6/§12.7 follow-ups landed together:

**Snap-on-stop renderer fix (§12.6 visual non-overlap).** When a unit's move command arrives at its destination, the move-arrival handler now snaps the unit's `fineX, fineY` transform to the engine-allocated 16-slot offset (via `worldOccupancy.getUnitSlotOffset`). Previously, `transform.fineX/fineY` used a 4-slot fallback derived from `entityId % 4`, so two units with the same `entityId % 4` standing in the same cell would render at the exact same screen pixel even when they had distinct OccupancyBinding-allocated slots. The snap fires once at arrival; in-flight movement still uses the entity-id fallback for target computation so sub-tile motion stays smooth (no per-tick teleport on cell crossings). Maximum visible jump on arrival is 0.75 of a cell.

The snap is intentionally NOT applied at fresh-spawn (scenario seed) — an earlier draft that snapped in `addUnitEntity` after `syncSpawnedEntityOccupancy` broke `fogMemory` and `selectionActivity.other` tests in ways I haven't yet diagnosed (the snap shouldn't affect visibility, which uses integer `position.x/y`, but something downstream appears to depend on the entity-id-derived initial transform). Unit-id-collision visual overlap at the very first rendered frame remains a known gap until that path is investigated.

**Wider BFS for `findNearestFreeUnitCell` (§12.7 lazy redirect).** The lazy-redirect helper now walks up to a 16-cell Chebyshev radius via the same spiral algorithm that `allocateGroupMoveTargets` uses, instead of only checking the 8 immediate neighbors. A unit arriving at a fully-packed cell whose 8 neighbors are also full now finds capacity in cells 2-16 away. Spec §12.7's default radius is 16, so this matches the spec. Both the lazy-redirect helper and the group-allocation spiral now share `generateSpiralCells` and `findNearestFreeUnitCellInSpiral` in `worldOccupancyAllocators.ts` for consistency.

### What's still not handled

- **Snap-on-spawn** for the first rendered frame after seed creation (described above; investigation pending).
- **Reservation lifecycle registry** (§12.7's TTL guardrail). Today's implicit "reservation = the unit's move command target" handles reserved-cell-taken-before-arrival via lazy redirect on its own arrival, which satisfies the user-visible behavior. An explicit registry would unlock TTL guardrails and richer AI reasoning but is deferred until a real game scenario surfaces a need.
- **Movement target uses entity-id slot during transit** (snap happens only on stop). Could be extended to use the allocated slot if mid-flight visual fidelity becomes important.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 899 passed + 1 skipped.
- 1 new test in `tests/simulation/worldOccupancyVisualSlots.test.ts` (wider-BFS coverage) plus an updated saturated-world test that pins the new "BFS exhausted" semantics.
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.19 - 2026-05-08

### Feature: Group-move pre-reservation (§12.7 eager allocation)

Selecting N units and right-clicking a single tile no longer issues N identical move commands all targeting the same cell. The HUD's `issueMoveCommand` now spiral-allocates one cell per unit starting from the clicked tile and walking outward in BFS order; each unit's move command targets its individually allocated cell. This is the second half of spec §12.7's dual-strategy rule (lazy redirect for single units shipped in 0.1.18; eager pre-reservation for groups in 0.1.19).

Behavior:

- **N=1 (single unit):** unchanged — direct `issueUnitMoveCommand` to the clicked cell. Pathfinding handles blocked targets ("walk to closest reachable cell"); the move-arrival lazy redirect handles overflow.
- **N>1 (group):** `worldOccupancy.allocateGroupMoveTargets(unitIds, targetCenter)` walks outward from the target and allocates one cell per unit. Each cell can absorb up to its remaining sub-cell capacity (default 16 - currently-occupied) before the spiral moves to the next cell. Whole-cell-blocked cells (buildings, resources, terrain, out-of-bounds) are skipped — they cannot host any unit slot. The result is that a 20-villager group commanded to a single tile spreads across the target cell and its neighbors instead of all stacking on one tile and detouring through lazy redirect.
- **Spiral exhaustion:** if every cell within a 16-cell radius is full or blocked, the unit's target falls back to `targetCenter`. Pathfinding still picks the closest reachable cell; visual stacking is the last-resort behavior.
- **Determinism:** the spiral uses a fixed neighbor-offset order (E, W, S, N, then diagonals) so save / load and replay produce byte-identical allocations from the same world state and inputs.

Whole-cell-blocked tiles are intentionally redirected away from in the group case (e.g., commanding 5 villagers to a tree spreads them around the tree rather than telling all 5 to stand on the tree). Right-click on a resource still routes through `issueContextCommand` (gather / attack), which is a separate path and unaffected.

### What's still not handled (intentional gaps, carried from 0.1.18)

- **Visual-overlap-from-entity-id collisions.** The renderer still derives a 4-slot offset from `entityId % 4` rather than the engine-allocated 16-slot offset. Two units with the same `entityId % 4` in the same cell can still draw at the same screen pixel. Independent of §12.7; remains a separate task.
- **Wider BFS radius for `findNearestFreeUnitCell`.** Lazy redirect still checks only the immediate 8-cell window. The group-allocation spiral correctly walks up to 16 cells out, but the lazy-redirect path doesn't yet match.
- **Reservation lifecycle.** Spec §12.7 calls for soft reservations with a 30s TTL and lifecycle release on death / new command. The current implementation uses simple "allocate at issuance, no per-tick refresh" — if a third party takes a reserved slot before arrival, the displaced unit falls back to lazy redirect on its own arrival (which works correctly).

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 898 passed + 1 skipped.
- 6 new tests in `tests/simulation/worldOccupancyVisualSlots.test.ts` pin the `allocateGroupMoveTargets` contract: target cell with capacity hosts every unit; 17+ overflow to neighbor cells; existing occupancy reduces remaining capacity; whole-cell-blocked neighbors are skipped; spiral exhaustion falls back to `targetCenter`; single-unit groups return a single target.
- File-size budget split: extracted `allocateGroupMoveTargets` body and `NEIGHBOR_OFFSETS` to a new `src/game/simulation/worldOccupancyAllocators.ts` to keep `worldOccupancy.ts` under the 500-LOC hard limit (498 / 118 LOC).
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.18 - 2026-05-08

### Bug fix: Move-arrival redirect for fully-packed cells (§12.7 lazy redirect)

Spec §12.7 first-pass implementation. When a unit's move command arrives at a target cell that already hosts 16 units (the engine's sub-cell slot capacity), the move handler now redirects the command target to the nearest free neighbor cell instead of leaving the unit overflowing at the destination. The unit then moves to the redirected cell and stops there with a real slot. Previously the 17th unit would land in overflow — its `OccupancyBinding`-allocated slot offset was null and (depending on rendering specifics) it could draw on top of an existing unit at the same cell.

The redirect only fires for the bare `unit.move` command path (the move-arrival site in `playerCommandsSystem`). Group-move pre-reservation (§12.7's b-path) and arrival redirects from other command kinds (build, gather, drop-off) are deferred to follow-up commits.

### What's still not handled (intentional gaps)

- **Group-move oscillation prevention.** Selecting N units and right-clicking a single cell still issues N independent move commands all targeting that cell. Each unit individually follows the lazy-redirect rule on arrival, but the order in which they arrive is non-deterministic with respect to the spiral layout the spec calls for. The next commit on §12.7 adds the eager pre-reservation path that the spec describes.
- **Visual-overlap-from-entity-id collisions.** The renderer still derives a 4-slot offset from `entityId % 4` rather than the engine-allocated 16-slot offset. Two units with the same `entityId % 4` in the same cell can still draw at the same screen pixel even when neither cell is full. That's a separate problem from §12.7 and remains open.
- **Wider BFS radius.** `findNearestFreeUnitCell` currently checks only the immediate 8-cell window. Spec allows up to a 16-cell BFS radius; we'll widen if a gameplay scenario surfaces the need.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 892 passed + 1 skipped.
- 4 new tests in `tests/simulation/worldOccupancyVisualSlots.test.ts` pin the `findNearestFreeUnitCell` contract: requested cell with space returns the cell; requested cell full returns a neighbor; everything full returns null; entity-itself-in-overflow at the requested cell still sees the cell as free for itself.
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.17 - 2026-05-07

### Feature: Multi-villager construction with smooth HP-bar

Three intertwined construction defects fixed in one feature:

- **Selecting N villagers and placing a building now assigns the build command to all N.** Construction speed scales linearly with builder count. Previously only the first selected villager got the command; the rest stood idle.
- **Right-clicking an own in-progress building site routes selected villagers to join the build.** Previously the right-click fell through to the move fallback and additional villagers walked toward the foundation but never built.
- **The construction HP bar now updates every tick during construction.** Previously the bar appeared frozen because side-map mutations (`buildingHealthStates`) do not mark the building entity dirty for civ-engine's renderAdapter — the projector never re-ran for the foundation, so the projected `currentHp` value stayed constant until something else marked the entity dirty (selection, damage, completion). A no-op `world.patchComponent('renderable', r => r)` per builder-at-site per tick is enough to flag the entity dirty, after which the projector fills the bar smoothly. Multi-builder ticks dedupe at civ-engine's dirty-set level so the cost stays one re-projection per construction site per tick.

`building.placeConfirm`'s payload extends with optional `additionalBuilderIds: number[]` (backward compatible — old replays with just `builderId` continue to work). The validator only enforces array shape + integer entries; per-id alive / villager / same-owner checks are best-effort at handler time, mirroring the AI tolerance pattern already in use elsewhere.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green.
- New scenario tests in `tests/simulation/multiVillagerConstruction.test.ts` (4 tests) cover linear-scaling speedup, mid-build right-click join, complete-building fall-through (gating-order pin), and per-tick projected-HP updates (verifies the regression is actually caught — the test reads via the projector, so commenting out the `patchComponent` call makes it fail).
- New fixtures `multi-villager-construction-fixture` / `single-villager-construction-fixture` for deterministic tick-count comparisons.
- Multi-CLI review iter-1 (Codex + Claude) caught 3 real bugs (HP-bar test bypassed projector, mid-build budget too loose, in-progress branch ate fall-through on helper failure) plus 3 LOW/NIT findings; all closed in iter-2. Iter-2 Codex unreachable (budget); iter-2 Claude verified clean.

## 0.1.16 - 2026-05-07

### Feature: Scrub-workflow Playwright e2e

The fourth deferred follow-up from the v0.1.12 thread close lands. New `tests/browser/replay-scrub.spec.ts` (3 tests) drives the timeline scrubber + step buttons against a real replay session and asserts on `__AOE2_TEST__.replay.getReplayCurrentTick()`:

- **Timeline range scrub commits to the requested tick.** Sets the `<input type=range>` value via DOM event dispatch (input + change), waits for the controller to apply the scrub, then asserts `getReplayCurrentTick()` matches.
- **Step-back/forward buttons advance one tick at a time.** Seeds a mid-replay tick, then exercises both buttons.
- **Exit button leaves replay mode.** Asserts the timeline's exit handler returns the controller to live mode.

The "Playwright drag synthesis" referenced in the v0.1.12 thread close turned out unnecessary — the timeline thumb is a native `<input type=range>`, so a value-set + change-event dispatch covers the same ground without `page.mouse.down/move/up` choreography.

### Internal: tightened race condition on prior-row click in test API

The replay-load dialog's prior-row click triggers an async IDB fetch before `enterReplay` fires. Reading `getReplayMode()` immediately after the click can race the resolve. The new spec uses `expect.poll` to wait for the mode flip, mirroring the pattern Playwright recommends for async state changes.

### Validation

- `npm test`: 863 unit tests + 1 skip pass; same 5 pre-existing full-suite contention flakes ride through unchanged.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npx playwright test tests/browser/replay-scrub.spec.ts`: **3 / 3 pass** on chromium.
- Full Playwright suite: 89 pass, 2 skip, 5 failed in unrelated specs (`game-progression-and-production`, `game-rendering-and-world`, `game-simulation-and-exploration-core`) — these are pre-existing rendering/behavior assertion mismatches (e.g., market resources expected 800 got 700; garrison villager count expected 2 got 3; building visual flags off) not introduced by this commit. The 8 replay-related Playwright tests (5 dialog + 3 scrub) all pass.

## 0.1.15 - 2026-05-07

### Bug fix: ReplayLoadDialog non-interactive in real browsers

Two CSS rules left over from the v0.1.12 dialog slice made the dialog appear broken in chromium (the bug never surfaced under jsdom, so the unit suite missed it). Wiring the prior-session Playwright spec exposed both:

- `.replay-load-dialog__panel { display: flex }` is in the author stylesheet and outranks the user-agent stylesheet's `[hidden] { display: none }` rule on cascade origin (author > UA at normal priority — class vs. attribute have equal specificity). Result: all three tab panels rendered simultaneously regardless of the active tab. Fix: a compound selector `.replay-load-dialog__panel[hidden] { display: none }` wins on specificity within the author stylesheet (0,2,0 > 0,1,0).
- `#hud-root { pointer-events: none }` cascaded into the dialog. Native `<dialog>.showModal()` puts the element in the top layer for stacking purposes, but pointer-events still inherits from the DOM parent — so every click inside the dialog (Cancel, Start replay, tab switching, file picker) fell through to the html element. Now `.replay-load-dialog__root { pointer-events: auto }` re-enables interactivity. Independent of the panel-hide bug above.

### Feature: Prior-session Playwright e2e

The deferred prior-session e2e from the v0.1.12 thread close lands. New `__AOE2_TEST__.replay.seedPriorSession()` rolls a save+load round-trip so the live recorder closes its current session (becoming a prior session in IDB) and starts a fresh one. The new spec at `tests/browser/replay-load-dialog.spec.ts` drives the Prior tab end-to-end: drive 120 ticks → seed → open dialog → switch to prior tab → click row → assert replay mode → Escape → assert live mode.

### Validation

- `npm test`: 863 unit tests + 1 skip pass; 5 pre-existing full-suite contention flakes (`castleUpgrades`, `imperialUpgrades.castleBlacksmith`, `aiPlayer` end-to-end) that pass in isolation. These are not introduced or affected by this change — same flakes ride v0.1.13 / v0.1.14. AGENTS.md does not yet codify a contention-flake exception, so flagging here for transparency.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm install` re-resolved `package-lock.json` to 0.1.15.
- `npm audit --audit-level=high`: 0 production vulnerabilities; 1 dev-only moderate (sub-blocker per AGENTS.md threshold).
- Playwright e2e: **5 / 5 pass** on chromium (verified locally; the four pre-existing tests now actually pass against a real browser, not just the jsdom stand-ins).
- Visual gate: before/after screenshots + pixel diff at `docs/devlog/artifacts/2026-05-07-replay-load-dialog-{before,after,diff}.png`. Diff highlights the 14.45% pixel delta covering the now-hidden Prior + From-file panel content.

## 0.1.14 - 2026-05-07

### Bug fix: cancel-during-load races in ReplayLoadDialog

Closes four async lifecycle races in `ReplayLoadDialog` that could leave the user in replay mode (or the dialog with stale state) despite cancelling. A `generation` counter is captured at handler entry and bumped on every dialog `close` event and on `dispose()`; resumed handlers compare and bail before any controller mutation or DOM write.

- **Prior-session row click**: previously, clicking a prior session and then Cancel before the IndexedDB fetch resolved still landed the user in replay mode when the bundle finally arrived. `loadPriorSessionAsReplay(deps, sessionId, signal?)` now accepts an optional `LoadPriorSessionSignal` and returns `{ status: 'cancelled' }` when the signal trips before `enterReplay`. The dialog passes a signal whose `isCancelled()` watches the generation token.
- **File-import**: clicking a file then Cancel before `File.text()` resolved still parsed and entered replay. The handler now checks generation immediately after the file read and bails before parse + `enterReplay` (both of which are synchronous after the await).
- **Tab-switch stale write**: a slow `recording.listPriorSessions()` started by the prior-tab click could resolve after a close+reopen and overwrite the cache with stale descriptors. The handler now checks generation before writing the cache or rendering.
- **Dispose during in-flight handler**: if `dispose()` ran while any of the above were pending, the resumed handler would call `enterReplay` on a torn-down dialog. `dispose()` now bumps generation so all in-flight handlers see a stale capture.

The `LoadPriorSessionStatus` union grows a `'cancelled'` variant. Existing callers that don't pass a signal can never observe `'cancelled'` so behavior is unchanged.

### Validation

- `npm test`: pass.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- New tests: `tests/replay/loadPriorSession.test.ts` cancellation case + 4 new race tests in `tests/ui/replayLoadDialog.test.ts` (cancel-during-prior-row, cancel-during-file-read, dispose-during-prior-row, tab-switch stale-resolve).

## 0.1.13 - 2026-05-07

### Phase 3E: replay-flow integration + browser e2e

A new vitest+jsdom integration suite (`tests/integration/replay-flow.integration.test.ts`, 6 tests) drives the replay-load flow end-to-end against a real `recordCommandReplayFixture`-produced bundle: live-session helper enters replay; file-import parses + enters replay; the `ReplayLoadDialog` modal confirms via the live tab and the file tab; the slice-4 transactional `enterReplay` guarantee survives a malformed second bundle while a first replay is active; and the parser's "invalid JSON" path surfaces the expected toast through the dialog.

A new Playwright e2e spec (`tests/browser/replay-load-dialog.spec.ts`, 4 tests) drives the actual built app: clicking the unified "Replay…" button opens the dialog; Cancel closes without entering replay; the live tab confirm enters replay after 120 ticks (deterministic — no graceful-skip fallback) and Escape exits; the file tab rejects malformed JSON with the dialog staying open and replay mode unchanged; the test API can open the dialog programmatically. The spec asserts on `__AOE2_TEST__.replay.getReplayMode()` instead of canvas pixels so it does NOT need visual baselines. Prior-session and scrub-workflow e2e flows are deferred to a follow-up because they require IDB seeding and Playwright drag synthesis respectively; the integration suite covers their deterministic equivalents.

The browser test API (`window.__AOE2_TEST__`) gains a required `replay` sub-object exposing `getReplayMode()`, `getReplayCurrentTick()`, and `openReplayLoadDialog()`. Required (not optional) so Playwright specs read `api.replay.getReplayMode()` without optional chaining at every call site.

This concludes Phase 3D + Phase 3E of the replay-load-and-e2e thread. The thread folder moves from `docs/threads/current/replay-load-and-e2e/` to `docs/threads/done/replay-load-and-e2e/` in this same commit.

### Validation

- `npm test`: pass with 115 files, 857 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Playwright e2e: written against `__AOE2_TEST__.replay`. Runs via `npm run test:browser` (which builds the preview app first via `pretest:browser`). The host needs to run the suite locally to verify; specs do not require visual baselines.

## 0.1.12 - 2026-05-06

### Phase 3D Slice 5: ReplayLoadDialog modal

The two slice-2/4 standalone HUD buttons ("Replay" and "Replay file") are replaced by a single "Replay…" button that opens a unified `ReplayLoadDialog`. The dialog uses a native `<dialog>` element (`showModal()`) so the browser provides focus trap, Escape dismissal, and backdrop for free.

The modal has three tabs:
- **Live session** — replay the in-progress live recording. Disabled when the recorder has no commands yet (matches the slice-2 contract).
- **Prior session** — list IDB-persisted sessions; click a row to enter replay. Schema-mismatch and SchemaMismatchError surface as toasts.
- **From file** — file picker that parses an exported bundle JSON and enters replay. Same structural validator as slice 4.

Default tab on open: "Live session" if the live recorder has payloads, else "Prior session". The HUD button is disabled while replay mode is already active (re-entry guard) and re-enables immediately on `replayController.onModeChange`. The Prior Sessions row "Replay" button in `MarkerListPanel` (slice 3) stays — it's an in-context affordance that complements the dialog.

The previous slice-2 `createReplayCurrentSessionButton` and slice-4 `createReplayFileImport` DOM helpers are deleted as dead code; the underlying `loadCurrentSessionAsReplay`, `loadPriorSessionAsReplay`, and `parseSessionBundleFile` helpers stay because the dialog uses them directly.

### Validation

- `npm test`: pass with 114 files, 851 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Visual verification deferred to a follow-up: the dialog's CSS uses HUD-consistent dark-teal palette + blue-accent active state and renders inside a native `<dialog>` (centered modal + browser-default backdrop). Capture before/after screenshots + pixel diff in a follow-up before the next user-visible polish slice.

## 0.1.11 - 2026-05-06

### Phase 3D Slice 4: Replay file import

A new "Replay file" HUD button (next to "Replay") opens a recorded `SessionBundle` JSON file in replay mode. Click triggers a native file picker; on file selection the bundle is parsed structurally (validates top-level `schemaVersion` typed as number, top-level fields `metadata`/`initialSnapshot`/`ticks`/`commands`/`executions`/`failures`/`snapshots`/`markers`/`attachments` typed as arrays where applicable, plus `metadata.sessionId/startTick/endTick`) and handed to `replayController.enterReplay(bundle)`. Invalid input never partially applies on two layers: the structural parser runs before the controller is touched, AND `ReplayController.enterReplay` now constructs the new `SessionReplayer` and replay world BEFORE exiting any existing replay or swapping the bridge — so any engine-level rejection (`schemaVersion` mismatch, missing `metadata.engineVersion`, range violations) leaves the controller in its pre-call state.

Toast messages cover the failure modes: `"Invalid bundle file: <reason>"` for parse failures (bad JSON, missing required field, wrong type), `"Could not read file: <reason>"` for file-system errors, and `"Replay failed: <reason>"` for controller rejections. The same JSON schema produced by the existing Export Prior Sessions button round-trips through this entry point.

The slice adds:
- `src/game/replay/parseSessionBundleFile.ts` — pure structural validator returning a discriminated `{ ok, bundle } | { ok, reason }`.
- `src/ui/replay/replayFileImport.ts` — DOM helper wrapping a hidden `<input type="file">` and the parse → enterReplay flow.
- `HudBridge.replayFromFile?()` — optional callback wired to the new button.

### Validation

- `npm test`: pass with 115 files, 855 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.10 - 2026-05-06

### Phase 3D Slice 3: Prior Sessions Replay button

The `MarkerListPanel` Prior Sessions section now renders a "Replay" button per row alongside Export and Discard. Click reconstructs the session bundle via `IndexedDBMirror.reconstructBundle(sessionId)` and hands it to `replayController.enterReplay(bundle)`. The button is disabled when the row's persisted schema version differs from the running engine (same gate Export uses) OR when the session ended abnormally with zero elapsed ticks (no payloads to replay forward); abnormal sessions with at least one elapsed tick stay enabled because the controller can replay up to the last good tick. The row's three buttons are all disabled during the async load to prevent double-click / interleaved races.

`RecordingService` gains a new public method `loadPriorSessionBundle(sessionId)` that returns the reconstructed `SessionBundle` directly. It throws `SessionNotFoundError` for unknown ids and when the mirror is disabled (`inMemoryOnly: true`) and propagates `SchemaMismatchError` from the underlying mirror. The panel surfaces both error types via toasts (`schema mismatch: stored=X, current=Y` / `replay failed: <reason>`).

The `MarkerListPanel` config gains an optional `onReplayPriorSession?(sessionId): Promise<void>` callback. Pre-Slice-3 callers (e.g., the existing tests that don't wire a controller) leave the button hidden entirely.

### Validation

- `npm test`: pass with 113 files, 828 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.9 - 2026-05-06

### Phase 3D Slice 2: load current live session as replay

A new "Replay" HUD button (next to Save/Load) opens the in-progress live session in replay mode. Click takes the live `RecordingService.bundle()` and hands it to `replayController.enterReplay(bundle)`; the timeline panel auto-mounts and the replay-mode annotation affordances from v0.1.8 take effect (Alt+M silent, marker list reads the bundle, etc.). The button is disabled when the live recorder has no bundle yet, when the bundle has no recorded commands (matching the civ-engine `SessionReplayer.openAt` contract — forward replay needs at least one command), or while replay mode is already active. On error the button surfaces a toast ("No live recording yet" / "Live session has no replay payloads yet" / "Replay failed: <reason>") and stays in live mode.

The slice extracts the HUD HTML template into `src/ui/hud/hudTemplate.ts` so `createHudController.ts` stays under the 500-LOC budget after the new button + dep wiring landed.

### Validation

- `npm test`: pass with 111 files, 811 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.8 - 2026-05-06

### Phase 3D Slice 1: replay-mode annotation affordances

While the replay timeline is open, Alt+M (open annotation form) is silent — annotation creation is gated to live mode because the live recorder is paused under the replay bridge swap. The Alt+L marker list now shows the *replay bundle's* markers in tick-desc order (no more live-recording markers that don't apply to the replayed scene), the Prior Sessions section is hidden, and clicking a row scrubs the timeline to that marker's tick instead of pausing+panning+selecting. The panel flips behavior automatically on enter/exit replay; no extra keystroke is required. Live-mode behavior (current-session markers, Prior Sessions Export/Discard, row-click pause+pan+select) is unchanged.

Severity, tick, and class-attribute interpolation in marker rows are now defensively HTML-escaped/coerced so a malformed bundle field cannot break out of the row markup. This is preventative hardening for the upcoming file-import slice.

### Validation

- `npm test`: pass with 109 files, 797 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.7 - 2026-05-05

### Phase 3C: replay timeline panel

Replay mode now has a HUD-mounted timeline panel with marker pins, hotspot pins, a draggable scrubber, play/pause, +/-1 step, tick/source readout, exit, and replay keyboard controls. Space toggles playback, ArrowLeft/ArrowRight step, Home/End jump to bounds, Escape exits replay, and Alt+T toggles the panel while replay mode is active.

The timeline reserves bottom viewport space while visible so it does not cover the playfield or bottom HUD. Bundles without command payloads keep forward/play/end controls and unreachable pins disabled instead of throwing from the UI. The host save-load path exits replay before replacing the live bridge, preventing replay exit from restoring stale pre-load state. User-facing replay-load sources and the browser end-to-end scrubber workflow remain later Phase 3 work.

### Validation

- `npm test`: pass with 107 files, 786 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Visual verification captured desktop, mobile portrait, mobile landscape, and 320px narrow mobile timeline layouts plus a desktop pixel diff; all measured layouts keep the timeline below the playfield and bottom HUD.

## 0.1.6 - 2026-05-05

### Phase 2F: schema-2 save format

New saves now use schema 2 and contain only `seed` plus `worldSnapshot`; the duplicated top-level `sideMaps`, `visibility`, and `matchState` fields are no longer emitted. The world snapshot carries the migrated `world.state.aoe2.*` state directly, including active unit commands, Monk tasks, visibility, match state, and the save-critical pending AI intention queue.

Compatibility: schema-1 saves still load. The legacy loader treats `sideMaps.*` as authoritative over stale duplicate `worldSnapshot.state` slots, then re-saves as schema 2. A save taken between an AI decision tick and the dispatcher drain preserves queued AI Monk intentions through `aoe2.pendingCommands`.

### Validation

- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm test`: pass with 99 files, 743 passed, 1 skipped.

## 0.1.6-rc1 — 2026-05-02

### Phase 2D: bridge-state migration onto `world.state.aoe2.*`

No user-visible behavior change. The simulation bridge moved Tier-1 side-map slots from runtime-only `BridgeState` Maps onto the engine's serializable `world.state.aoe2.*` namespace via `BridgeStateAccessor` + per-slot `SlotCodec` registry. Migrated slots include `villagerOrdinals`, `gathererDropOffStuckSinceTick`, `monkHealCounters`, `playerAges`, `playerCivilizations`, `wonderCountdownOverrides`, `relicCountdownOverrides`, `marketExchangeRates`, `trackedVisibilitySources`, `playerScoreCounters`, `rallyPoints`, `unitCommands`, `wonderCountdowns`, `relicCountdowns`, `townCenterRefs`, `relicsInMonastery`, `sheepMoveOrders`, `conversionState`, `monkCarriedRelic`, `monkTasks`, `trebuchetPackStates`, `lastSeenStatic`, `garrisonedByBuilding`, `garrisonedUnitToBuilding`, `garrisonedUnitVisionSources`, `productionQueues`, `constructionStates`, `combatStates`, `buildingHealthStates`, `buildingCombatStates`, `wildlifeStates`, `aiStates`, `playerResources`, `population`, and `researchedTechnologies`. `inFlightTechByOwner` remains a Tier-2 runtime cache; `BridgeState` now owns bridge-only runtime caches and derived maps rather than Tier-1 codec state.

Behavior callouts: `world.serialize()` snapshot now captures every migrated Tier-1 slot; `World.deserialize` reconstructs them. `tests/replay/snapshotEquivalence.test.ts` round-trips the migrated codecs on a `feudal-age-fixture` and proves active Monk tasks flush to `world.state.aoe2.monkTasks` and active unit commands flush to `world.state.aoe2.unitCommands`. Save format compatibility: legacy `sideMaps.*` fields are still emitted/consumed, with `sideMaps.monkTasks` and `sideMaps.unitCommands` treated as the schema-1 source of truth on load. Hot-loop `markDirty` discipline: per-tick mutations in `playerCommandsSystem`, `towerCombatSystem`, `wildlifeCombatSystem`, `productionQueueSystem`, `villagerEconomySystem`, `monkBehaviorSystem`, and `monkTaskAppliers` mark the relevant codec dirty exactly when they mutate. Multi-CLI review on slot 18–21 caught the HIGH "hydrate must clear codec maps before populating from sideMaps blob" lesson, applied to every slot that participates in load-time invariants.

### Validation

- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm test`: pass with 99 files, 737 passed, 1 skipped.
- `npm audit --audit-level=high --omit=dev`: 0 vulnerabilities; full high-threshold audit has no high/critical findings and one moderate dev-tree `postcss` advisory.

## 0.1.5 — 2026-04-29

### Added

- **In-game annotation UI (Spec 2 v0.1.5 capture-only).** Press **Alt+M** to open an annotation form: enter a note, pick severity (info/warning/bug/blocker), pick category (pathfinding/combat/economy/ai/ui/perf/general), optionally tick "Capture screenshot" — save fires a marker into the live `SessionRecorder` bundle. Selection at the moment of Alt+M becomes the marker's `MarkerRefs.entities` (with engine `EntityRef.generation` preserved); empty selection falls back to a `tickRange` covering the current tick. Press **Alt+L** to toggle the bottom-right `MarkerListPanel` listing the current session's markers (tick desc) plus a collapsible "Prior Sessions" section for crash recovery — Export downloads a self-contained JSON bundle (sidecar attachments re-embedded as base64 dataUrls), Discard removes the IDB record. Hotkeys are suppressed while a text input has focus.
- **Persistent recording mirror in IndexedDB.** Every session is mirrored into IDB through `RecordingService` over `MemorySink({ allowSidecar: true })` — refresh / crash leaves the partial bundle accessible from the next launch's "Prior Sessions" list. `start()` always begins a fresh session; prior sessions are read-only inspectable but never extended (per ADR 1, mid-session continuation would corrupt bundle invariants). Schema-mismatched sessions are listed but not exportable (forward-compat policy). On Safari private mode / quota exhaustion, the mirror is permanently disabled and the live `MemorySink` continues — `RecordingService.exportBundle()` still works for the current session.
- **Bridge additive surfaces** (`src/game/simulation/createSimulationBridge.ts`):
  - `bridge.world: World` — read-only getter for the engine instance (used by `RecordingService` and the annotation surface).
  - `bridge.setPaused(paused: boolean): void` — manual pause toggle (gated AFTER `flushOutOfBandRenderChange` so render projections continue while paused; the existing `haltState` carrier is unchanged so `getHudState().engineHalted` continues to reflect failure-halt only).
  - `bridge.getSelectedEntityRefs(): readonly EntityRef[]` — selection refs with generation, prune-on-read for stale refs.
  - `bridge.select(refs): void` — public select-from-refs entry; filters stale refs through `getCurrentEntityId`.
- **HUD `loadGame` is async.** `HudBridge.loadGame: (blob: SaveBlob) => Promise<void>` (was `void`) so the load path can await the new `RecordingService.start()` for the rebuilt simulation. The Load button is disabled while the rebuild is in flight; success / failure surface as toasts.

### Engine dependency

- Bumps `civ-engine` from v0.8.10 to **v0.8.11** for the new `AgentDriverContext.addMarker / attach` methods (Spec 9.1) — agents that drive aoe2 via `runAgentPlaytest` can now emit markers in flight from `decide(ctx)`. Default agent sink also flips to `MemorySink({ allowSidecar: true })` so agent screenshots > 64 KiB don't terminate the recorder. `AgentPlaytestResult.source` is exposed so default-sink callers can `result.source.readSidecar(id)` to recover sidecar bytes.

### Validation

- New tests: `tests/recording/IndexedDBMirror.test.ts` (20), `tests/recording/RecordingService.test.ts` (17), `tests/recording/AnnotationController.test.ts` (9), `tests/control/PauseControl.test.ts` (4), `tests/control/HotkeyRegistry.test.ts` (10), `tests/annotations/markerSchema.test.ts` (10), `tests/annotations/selectionToRefs.test.ts` (4), `tests/annotations/captureScreenshot.test.ts` (3), `tests/annotation-ui/AnnotationForm.test.ts` (11), `tests/annotation-ui/MarkerListPanel.test.ts` (13), `tests/simulation/bridge-additive-surfaces.test.ts` (10), `tests/vite-alias-smoke.test.ts` (2). 113 new tests; targeted suites run clean. Multi-CLI code review iter-1 (Codex `gpt-5.5` xhigh + Claude `opus-4-7[1m]` max — Gemini removed from the toolchain mid-iter, see `b93cf2b`) found 3 MAJORs (mirror open-failure handling, IDB metadata finalization, listSessions endTick from row count) + minors; all addressed inline before the implementation review's iter-2 / final review. Final FR-1 review covers the full diff.

### Open follow-ups (deferred from v0.1.5 per scope)

- Replay scrubber + TimelinePanel (deferred to v0.1.6 per ADR 4 — needs aoe2 bridge-snapshot support first).
- ~~Vitest integration suite (AO-12.5)~~ — landed in follow-up: `tests/integration/annotation-ui.integration.test.ts` (6 cross-component scenarios using fake-indexeddb + jsdom).
- Playwright e2e (AO-13) — behavior specs landed in follow-up at `tests/browser/annotation-ui.spec.ts` (3 specs: hotkey flow, cancel discards, hotkey-suppressed-while-text-input-focused). Visual diff baselines are present but `test.fixme`'d pending the user running `npm run test:browser -- --update-snapshots` locally to capture + commit the PNG baselines (must also stabilize tick rendering first since `marker.tick` varies per machine).

## 0.1.4 — 2026-04-26

### Fixed

- **Building HP now ramps from low at placement toward full as construction progresses (canonical AoE2).** Previously a freshly placed foundation spawned at full max HP, then completion was a no-op on the health bar. The foundation now starts at ~10% of max HP and gains `(maxHp − startHp) / totalBuildTicks` per construction tick, finishing at full HP if no damage was taken. Damage taken during construction is preserved as an offset rather than healed at completion: if combat chips a House foundation down to 5/75 at 95% built (where the undamaged ramp would put it at ~71/75), the remaining 5% of construction ticks still add HP additively, so it finishes at ~9/75 (5 plus the ~4 HP earned from those last 6 ticks of construction) — damaged, but not at the formula's full curve. A partially built building you don't defend stays visibly damaged after completion until repaired. Affects every constructable building (House, Mill, Barracks, Castle, Wonder, …); doesn't apply to scenario-seeded `isComplete: true` buildings.
- **Idle-military auto-aggression now pursues enemy foundations (canonical AoE2).** Foundations under construction now have damageable HP, so the auto-aggression target-finder no longer skips incomplete buildings. An idle Knight standing next to an enemy Barracks foundation will engage it instead of ignoring it. (Companion to the HP-ramp fix above; flagged by the multi-CLI review iter-1.)
- **Selection-panel HP display floors fractional foundation HP.** The per-tick HP increment is fractional (e.g. `+0.567` for a House), which would surface as `41.857142857 / 75` in the selection panel. The panel now floors `currentHp` for display while leaving the bridge value raw so the health-bar fill ratio stays smooth.

## 0.1.3 — 2026-04-26

### Fixed

- **Engine tick failures no longer crash the RAF loop.** `civ-engine` has been fail-fast since v0.4.0: any tick failure throws `WorldTickFailureError` from `world.step()`. The bridge previously called `world.step()` raw, so the exception bubbled uncaught into the requestAnimationFrame callback, leaving the page in an undefined state. The bridge now catches `WorldTickFailureError`, logs the failure (`tick`, `phase`, `code`, `systemName`, `message`), halts further ticks for the session, and surfaces a new `HudState.engineHalted: EngineHaltDetails | null` field so the HUD / debug overlay can show that the simulation has stopped instead of silently freezing. We do **not** call `world.recover()` — fail-fast is intentional, and recovery would mask the underlying logic bug. (Closes the deferred gap from the 0.5.3 engine-migration devlog entry.)

## 0.1.2 — 2026-04-26

### Fixed

- **Save no longer disappears when browser storage is unavailable.** Clicking Save while in private browsing, with `localStorage` quota exhausted, or in a security context that blocks storage now falls back to triggering a JSON file download instead of toasting "Save failed (storage unavailable)" and silently dropping the blob. The toast text changed to "Storage unavailable; save downloaded." so the user knows where the save went. (Iter-2 V5-4.)

## 0.1.1 — 2026-04-26

### Fixed

- **Destroyed multi-cell buildings no longer leave permanent fog-memory ghosts.** When a Castle (4×4) or other multi-cell building is destroyed and only a non-anchor cell of its old footprint is in player vision, the memory entry is now correctly cleared. Previously the cleanup pass checked the anchor cell only, so any anchor in fog produced a permanent ghost. (Iter-4 V4-3.)
- **Stuck villagers preserve their drop-off retry throttle across save/load.** The 30-tick throttle (added in iter-3 V3-5 to prevent spam-replanning) is now persisted in the save blob, so a save+load mid-stuck no longer resets every previously-throttled villager to "retry every tick" until they unstuck again. (Iter-4 V4-7.)

### Performance

- **Save-load skips procedural map generation it never uses.** Loading a save no longer runs `createPrototypeScenario` for the seed (the hydration path discards it). Saves several ms per load on Black Forest seeds. (Iter-4 V4-8.)
