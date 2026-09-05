# Automatic post-construction mining — DESIGN

Closed 2026-09-05: shipped as v0.2.6 on 2026-07-15 (`design/spec-final.md` §6.2 carries the rule as shipped). The folder was created by the release commit, whose title already said "close", and was never moved.

Status: implemented + gates green in worktree (2026-07-15); adversarial review in flight; merges to main after the occlusion slice ships.

## Rule (spec §6.2, user directive 2026-07-14)

When a Mining Camp finishes construction, every villager that was actively building it automatically receives a gather order on the nearest gold or stone mine — straight-line distance from the completed camp anchor among harvestable mines within a 7-cell radius, exact ties broken by lowest entity id, none in radius ⇒ idle as before. The auto-order is a normal recorded gather command, never preempts an explicit queued player order, and applies to human and AI villagers identically.

## Mechanism

- Completion hook: the `onBuildingConstructionComplete` wrapper in `registerAllSystems.ts` calls `queuePostConstructionAutoGather` (new `bridge/postConstructionAutoGather.ts`) INSIDE the finalize event, while every builder still holds its build command — the current builder's command clears right after finalize, others clear on their next loop pass, so enumeration via `unitCommandsCodec` (`command.type === 'build' && buildingRef.id === campId`) catches exactly the active builders.
- Mine selection: `world.query('resource', 'position')`, filtered to `gold-mine`/`stone-mine` with `amount > 0`, Euclidean anchor-to-anchor ≤ 7 (camp anchor = the building's `position` component — BuildingComponent itself carries no coordinates, discovered by probe), min by `(distance, id)`. Integer coordinates make the 4.0-vs-4.0 tie binary-exact.
- Delivery: one `unit.autoGather` intention per builder pushed onto `state.pendingCommands` — the same AI-intention channel, drained/validated/recorded next step, so replay and persistence come from existing machinery (`aoe2.pendingCommands` codec serializes the mid-window queue).
- Never-preempt, twice over: (1) the human issue path already EVICTS pending intentions for a unit (`removePendingUnitCommands`, full-review M3) — the exhaustive `commandTargetsUnit` switch forces the new command type into that predicate; (2) the `unit.autoGather` validator re-checks at execution time (baseline `unitGatherValidator` + amount > 0 + `gatherer.task === 'idle'` + unit command absent-or-same-camp-build), so an explicit order that landed earlier in the drain window has already applied and wins. Handler delegates to the SAME `setUnitGatherCommandDirect` as an explicit gather (drop-off resolution, `hasExplicitGatherOrder`, task transitions identical).
- Replay: `aoe2ReplayPendingCommandDrain` DISCARDS live-queued intentions every tick in replay mode — the recorded `unit.autoGather` stream is the sole authority; no double-apply is possible.
- Playtest oracle: `COMMAND_ACTOR_KEYS['unit.autoGather'] = []` — system-issued on behalf of any owner, like auto-aggression's `unit.attack`, so it is not drivenness evidence.

## Tests (9, all green in worktree)

`postConstructionAutoGather.test.ts` (5): nearest-harvestable skips a nearer depleted mine + real deposit cycle; exact-distance tie → lowest id; no-mine-in-radius → idle with no explicit-order flag; explicit move issued in the completion window is never preempted across the whole walk while the other builders auto-mine; AI-owned (owner 2) builders via raw `building.placeConfirm` get the identical order. `postConstructionAutoGatherPersistence.test.ts` (4): applied order survives save/load and keeps depositing; QUEUED mid-window order survives save/load via the serialized queue and fires on the first restored step; a replay world never self-fires the queued order (discard system); a recorded `unit.autoGather` executes through the replay world's handler set. Fixture: `auto-mine-camp-fixture` (`fixtures/construction.ts`) with anchor-steered nearest/tie/no-mine/owner-2 geometry (authored by the original background agent before its session-limit death; taken over and completed by the lead).

## Provenance

Started by a background worktree agent (fixture + kit + 5 behavioral tests, died mid-task on a session limit); lead verified every assumed API symbol against live code, completed the implementation TDD-style (one probe-diagnosed fix: camp anchor from the position component), added the persistence/replay suite, and ran the gates. Worktree: `.claude/worktrees/agent-a266c4614271ce0d8`, to be merged and removed at ship.
