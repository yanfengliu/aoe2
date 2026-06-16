# DESIGN — Standard AoE2 200 population cap (roadmap M1, target v0.1.37)

Status: IMPLEMENTED + SHIPPED as v0.1.37 (2026-06-16). Design approved by the team lead (raw-supply tracking, floor removal, bespoke-codec migration all accepted as designed; AI-stop-housing-at-200 deferred). Multi-CLI review converged APPROVE — see `2026-06-16/1/REVIEW.md`.

## 1. Problem and current model (verified against the live code)

AoE2's standard Random Map population limit is 200: a player's effective cap is `min(200, sum of building-supplied housing)`. Over-housing past 200 is allowed but wasteful (no extra cap); losing housing while raw supply stays ≥ 200 keeps the cap at 200; only when raw supply drops below 200 does the cap follow it down. Today there is NO 200 ceiling — the cap is the unbounded running sum of building supply.

`PopulationState` is `{ current: number; cap: number }` (`src/game/simulation/types.ts:302-305`), one per owner, persisted by `populationCodec` (a `flatMapCodec<number, PopulationState>('aoe2.population')`, `src/game/simulation/bridge/bridgeStateSerialize.ts:98`). `cap` is a STORED, incrementally adjusted value:

- Seed: `current: 0, cap: standardPopulationCap` (`scenarioSeedOps.ts:152-156`); `standardPopulationCap = STANDARD_POPULATION_CAP = 0` (`bridgeConstants.ts:26`, threaded through `wireBridgeOps.ts:242`). Base headroom is 0 — the cap is fully building-derived. The player's starting Town Center is created complete and contributes +5 → AoE2's start-at-5.
- Build complete, direct-create path: `entityCreateOps.ts:324-329` — `if (isComplete && populationState && populationProvided > 0) { populationState.cap += populationProvided; }`.
- Build complete, construction-flow path: `playerCommandsSystem.ts:478-482` — `populationState.cap += construction.populationProvided;` (unconditional; `populationProvided` is 0 for non-housing so the add is a no-op there). `construction.populationProvided` is captured at foundation time from `buildingPopulationProvided(buildingType)` (`entityCreateOps.ts:337`).
- Destroy, building path: `entityDestroyOps.ts:157-165` — `populationState.cap = Math.max(populationState.current, populationState.cap - populationProvided)` (only `if isComplete && populationProvided > 0`). The `max(current, …)` is the deliberate don't-evict floor.
- Destroy, farm-hybrid path: `entityDestroyOps.ts:291-306` — same `Math.max(current, cap - populationProvided)` formula (dead code for cap purposes today because farms provide 0 pop, but it is a real cap-mutation site and MUST stay consistent with the new model).

`BUILDING_POPULATION_PROVIDED` (`prototypeBuildingRules.ts:29-48`): House +5, Town Center +5, Castle +20, everything else 0. Accessor `buildingPopulationProvided(buildingType)` (`prototypeBuildingRules.ts:290-292`).

`current` mutation sites (for completeness — these do NOT change in this slice): unit create `+1` (`entityCreateOps.ts:159`), unit destroy `max(0, current-1)` (`entityDestroyOps.ts:113`), monk conversion transfers `current` between owners with NO clamp against `cap` (`monkTaskAppliers.ts:186-191`).

### Why the naive fix is wrong (the crux)

Because `cap` is stored and incrementally adjusted, you cannot clamp it with `min(200, cap)` at the `+=` site. Counter-example: build houses to raw supply 250 → clamp cap to 200; lose one house → `max(current, 200 - 5) = 195` — WRONG, raw supply is still 245 so the cap should remain 200. The stored, clamped value has lost the information needed to recover. This is the documented "Codex population-model iter-1 HIGH" deferral (`bridgeConstants.ts:15-25`, spec §6.10 line 466, roadmap M1).

The fix is to track RAW (unclamped, honest) building supply and DERIVE the cap: `effectiveCap = min(POP_HARD_CAP, rawSupply)`.

## 2. Decisions

### Decision 1 — Raw-supply tracking + cap formula

Add a third field to `PopulationState`:

```ts
export interface PopulationState {
  current: number;
  cap: number;       // DERIVED: min(POP_HARD_CAP, rawSupply). Kept as a stored field.
  rawSupply: number; // honest unclamped running sum of building-supplied housing.
}
```

`rawSupply` is the honest running sum, maintained incrementally with NO min/max games:
- Seed: `rawSupply = standardPopulationCap` (= 0).
- Build complete (both paths): `rawSupply += populationProvided`.
- Destroy (both paths): `rawSupply -= populationProvided` (plain subtract; no `max` floor — see Decision 2 for why the floor moves off rawSupply).

`cap` stays a STORED field, recomputed from `rawSupply` on every change via a single shared helper:

```ts
export const POP_HARD_CAP = 200;
export function deriveCap(rawSupply: number): number {
  return Math.min(POP_HARD_CAP, Math.max(0, rawSupply));
}
```

Rationale for keeping `cap` stored (recomputed) rather than derived-on-read:
- The four mutation sites already write `cap`; switching to `rawSupply += …; cap = deriveCap(rawSupply)` is the minimal, local edit and keeps the existing read surface (`getPopulationState`, `getEconomyState.population`, `getHudState.population`, `agentSnapshot.populationCap`, the training gate, the AI `populationBlocked`) byte-identical in shape — none of them learn about `rawSupply`. Derived-on-read would force `cap` to disappear from the stored shape and every reader to call a deriver, a much larger and riskier diff for no behavioral gain.
- `cap` and `rawSupply` are always in sync by construction (every writer recomputes), so there is no staleness risk; the invariant `cap === deriveCap(rawSupply)` is testable.

`POP_HARD_CAP = 200` lives in `bridgeConstants.ts` next to `STANDARD_POPULATION_CAP` (the comment block there is rewritten from "deferred" to "implemented"). Export it so tests and (future) a configurable-cap option can reference one constant. `deriveCap` lives wherever the cap math is shared by all four sites — proposal: a tiny pure helper exported from `bridgeConstants.ts` (no imports beyond the constant) so `entityCreateOps`, `entityDestroyOps`, and `playerCommandsSystem` all import the same function and cannot drift. (`prototypeBuildingRules.ts` is an acceptable alternative home, but `bridgeConstants.ts` keeps the cap value and its deriver co-located.)

### Decision 2 — The don't-evict interaction

The current don't-evict floor lives on the destroy `cap` write: `cap = Math.max(current, cap - populationProvided)`. With raw-supply tracking, the floor must move OFF the honest `rawSupply` (which must stay the true sum) and the don't-evict guarantee is reframed:

- `rawSupply -= populationProvided` always (honest).
- `cap = deriveCap(rawSupply)`.
- If `rawSupply` (and thus `cap`) drops below `current` because you lost housing while at high pop, you are simply OVER CAP: `current > cap`. Existing units are NOT removed. Training is blocked (the gate is `current >= cap`, Decision 4) until enough units die/are lost that `current < cap` again. This is exactly AoE2 behavior.

Confirm units are never force-removed: there is no code path anywhere that deletes units in response to a cap change — the cap is read-only with respect to the unit set. The only unit-removal paths are combat death, monk conversion, and explicit destroy, none of which consult `cap`. **The over-cap state is already reachable and tolerated today** via monk conversion (`monkTaskAppliers.ts:191` increments `current` past `cap` with no clamp and no eviction), so the HUD, the training gate, and the agent snapshot already handle `current > cap` gracefully. This de-risks the semantic considerably — we are formalizing an existing tolerated state, not inventing one.

What `getEconomyState` / `getHudState` / `getPopulationState` report when over cap: the literal `{ current, cap }`, e.g. `60/55`. The HUD already renders `${current}/${cap}` verbatim (`createHudController.ts:328`), so it will show `60/55` with no change. This matches AoE2's HUD, which shows e.g. `200/195` (or higher current) when you bulk-lose housing. We deliberately do NOT clamp `current` to `cap` for display.

Subtle point the team lead should confirm: dropping the `max(current, …)` floor from the destroy `cap` write is the intended semantic change. Old behavior: lose a house at current=8/cap=10 → cap floored to `max(8, 5) = 8` (cap never dips below current). New behavior: lose a house at current=8/cap=10 → rawSupply 10→5, cap = deriveCap(5) = 5, so you are 8/5 and over-cap until pop drops. The new behavior is the AoE2-correct one (you lose housing, you go over cap, you can't train); the old floor was a pre-200 simplification that prevented the over-cap state. This is a user-visible behavior change for the lose-housing-while-near-cap case and is the reason this ships as a versioned change, not a pure refactor.

### Decision 3 — Save-format migration

`PopulationState` gains `rawSupply`, so both the in-memory type and the serialized forms change. Two save schemas exist (`saveSchema.ts:21-22`): schema 1 (legacy, top-level `sideMaps`) and schema 2 (current, `world.state.aoe2.*`). Both must round-trip a save written before `rawSupply` existed, defaulting `rawSupply = cap`. This default is EXACT for old saves: pre-200-cap, the stored `cap` WAS the unclamped raw sum (no clamping ever happened, and the destroy floor only ever raised cap toward current, never above the true sum in normal play), so `rawSupply = cap` reconstructs the honest sum precisely. After load, `cap` is recomputed as `deriveCap(rawSupply) = min(200, cap)` — for any legacy save with cap ≤ 200 (every reachable save today, since 200 was never reachable) this equals the old cap, so legacy saves are behavior-preserving.

Migration mechanics per schema:

- **Schema 2 (the codec path).** `flatMapCodec.deserialize` is `new Map<K,V>(j ?? [])` (`bridgeStateSerialize.ts:56-62`) — it does NOT transform values, it stores the JSON object verbatim as the `PopulationState`. So an old schema-2 blob yields entries `{ current, cap }` with `rawSupply === undefined`. We need a value-level migration. The cleanest place is the codec itself: give `populationCodec` a bespoke (non-`flatMapCodec`) definition whose `deserialize` maps each entry to `{ current, cap, rawSupply: entry.rawSupply ?? entry.cap }` and whose `serialize` writes all three fields. This is self-contained, applies to every schema-2 load AND replay-world hydration (which also reads through the codec), and needs no change in `hydrateFromWorldState.ts`. `serialize` writing `rawSupply` is additive JSON (a new object key), which `assertJsonCompatible` tolerates.
- **Schema 1 (the explicit hydrate path).** `hydrateFromSavedGame.ts:113-118` does `m.set(owner, { ...pop })` from `blob.population`. Change to `m.set(owner, { current: pop.current, cap: pop.cap, rawSupply: pop.rawSupply ?? pop.cap })`. Update the `SerializedSideMaps.population` type (`saveSchema.ts:111`) to `SerializedMap<number, { current: number; cap: number; rawSupply?: number }>` (rawSupply optional so older blobs typecheck).
- **Round-trip + clamp note.** On load we should also recompute `cap = deriveCap(rawSupply)` so a (hypothetical) legacy save with cap > 200 is clamped on load. In practice no such save exists (200 was unreachable), but doing the recompute makes the load path self-consistent with the live invariant and costs one line. Decide: do this in the codec `deserialize` / the schema-1 hydrate set (preferred — single source of truth) rather than a separate post-load sweep.

Schema-version bump: NOT required. The new field is additive and tolerated-when-absent on both paths (the `?? cap` default), exactly the case `saveSchema.ts:99-103` calls out ("A schema-version bump unless the new field tolerates being absent in older blobs"). Keep `SAVE_SCHEMA_VERSION = 2`. The `saveLoad.test.ts:140` `expect(afterLoad.population).toEqual(before.population)` round-trip assertion will now include `rawSupply` on both sides and continue to pass.

### Decision 4 — Training gate

The production gate is `productionQueueSystem.ts:113-124`: when the head queue entry is a unit and `populationState.current >= populationState.cap`, the entry is marked `isBlocked` and does not progress. With the clamped `cap`, at the 200 ceiling `current >= 200` blocks training — correct. The over-cap case (`current > cap` after losing housing) also blocks via the same `>=`, correct. No change to this file is strictly required; the gate already reads the (now-clamped) stored `cap`.

Rejection message at the ceiling: training rejection is surfaced via the `isBlocked` flag on the queue entry (consumed by the HUD/agent), not a separate string at this site. The blocked-at-cap presentation is identical whether cap is 200 or 55 — the entry simply shows blocked. The actionable cannot_train message engine (`researchAvailability.ts` / the `queue.train` validator) should be spot-checked to confirm it reads sensibly at 200 (e.g., "population cap reached"); if it hard-codes nothing cap-specific, no change is needed. Flag for the implementer: confirm there is no separate pre-queue cap check that would need the same clamped value (a grep for the cannot_train reason path during implementation).

### Decision 5 — Scope

In-slice: enforce the 200 ceiling correctly via `rawSupply` tracking + `deriveCap`, preserving don't-evict (no unit eviction; over-cap is a tolerated, training-blocking state). Four cap-mutation sites + the seed + the two save paths + the type. Spec §6.10 updated to state the limit is now enforced and describe the over-housing/over-cap semantics.

Deferred (call out to team lead, do NOT build now):
- Configurable population cap / "no pop cap" lobby option (spec §6.1 line 61 lists it aspirationally; nothing is wired). `POP_HARD_CAP` as a single constant + `deriveCap(rawSupply, hardCap = POP_HARD_CAP)` leaves a clean seam for this later.
- Civ-specific cap modifiers (spec §6.10 line 469 — "none wired yet").
- AI behavior at the ceiling. The AI builds a house whenever `populationBlocked` (`aiSystem.ts:310-313, 439-446`). At raw supply ≥ 200, `current >= cap(200)` keeps `populationBlocked` true, so the AI will keep proposing houses that no longer raise the (clamped) cap — wasting wood, rate-limited by `maxConcurrentBuilds` and affordability. This is bounded (no infinite loop; one house attempt per decision tick, gated on a free villager + wood) and the brief's pattern is "AI untouched." Recommend deferring an AI "stop housing at 200" tweak to a follow-up; note it as a known cosmetic inefficiency. (It is also not reachable at current game scale — campaigns top out well under 200.)
- HUD polish for the 200 indicator (e.g., turning the readout a distinct color at the cap). Render-only, separate track.

### Decision 6 — Test plan (TDD; write first)

Mirror existing patterns: `tests/simulation/populationModel.test.ts` (pure building-supply values), `createSimulationBridge.darkAge.test.ts:38-72` (build-a-house-raises-cap on the live bridge via `placeBuildingNearTownCenter` + `stepBridgeUntil`), `saveLoad.test.ts:140` (round-trip `expect(afterLoad.population).toEqual(before.population)`).

Pure-unit tests (fast, on `deriveCap` + the formula):
1. `deriveCap(250) === 200`; `deriveCap(200) === 200`; `deriveCap(55) === 55`; `deriveCap(0) === 0`; `deriveCap(-5) === 0` (defensive).
2. Invariant after any build/destroy: `cap === deriveCap(rawSupply)`.

Bridge / behavior tests (the regressions that matter):
3. Over-house past 200: drive `rawSupply` to 250 (build enough houses; or a focused fixture that seeds a high-supply start) → `cap === 200`, `rawSupply === 250`.
4. Build one more house at rawSupply 250 → `cap` STAYS 200, `rawSupply === 255`.
5. **The Codex-HIGH regression:** at rawSupply 245 (cap 200), destroy one house → rawSupply 240, `cap` STAYS 200 (NOT 195). This is the exact bug the naive `min`-clamp would introduce.
6. rawSupply drops below 200: from rawSupply 205 (cap 200), destroy two houses (−10) → rawSupply 195, `cap === 195` (cap follows raw down once below the ceiling).
7. rawSupply drops below `current` (don't-evict): get to e.g. current 60 / rawSupply 75 (cap 75), bulk-destroy housing so rawSupply 50 → `cap === 50`, `current` still 60 (NO eviction — assert unit count unchanged), and `queueTrainUnit` is blocked (`isBlocked` true / training does not progress) until current < 50.
8. Save round-trip with the new field: save at a known `{current, cap, rawSupply}` (with rawSupply ≠ cap, e.g. over-housed 60/200/250), load, assert all three fields equal.
9. Legacy-blob migration: construct a schema-2 (and a schema-1) blob whose population entries lack `rawSupply`, load → `rawSupply === cap` and `cap === min(200, cap)`. (Mirror however `saveLoad.test.ts` fabricates/loads blobs.)
10. The 200 cap is actually reachable: build enough houses (40 houses from a TC, or seed a fixture) so `cap` reaches exactly 200 and a unit can be trained up to 200 then blocked at 200. (Reachability is the spec's litmus that the feature is real, per the brief.)

Anti-regression: existing `darkAge` cap tests (5→10 on first house) must stay green — verify the first-house path still yields `cap 10, rawSupply 10`. Existing `saveLoad` population round-trip stays green.

### Decision 7 — Risks / open questions

1. **Semantic confirmation (highest):** dropping the `Math.max(current, …)` don't-evict FLOOR from the two destroy `cap` writes is the intended change — the floor moves to "no eviction + over-cap tolerated," NOT "cap never dips below current." Old saves and the `darkAge` tests are behavior-preserving (cap ≤ 200, current ≤ cap in normal play), but the lose-housing-while-near-cap case now produces `current > cap` where before cap was floored to current. Team lead: confirm this AoE2-correct over-cap behavior is wanted (it is per AoE2; flagging because it is the one user-visible behavior delta beyond the ceiling itself).
2. **Migration site choice:** bespoke `populationCodec` with a value-transforming `deserialize` (preferred — covers schema-2 + replay in one place) vs. a post-load sweep. The bespoke codec is the lowest-surface option but means `populationCodec` stops being a plain `flatMapCodec`; confirm that is acceptable (it parallels `marketExchangeRatesCodec`, which is already a bespoke non-factory codec at `bridgeStateSerialize.ts:117-124`, so there is precedent).
3. **AI wood waste at 200** (deferred, Decision 5): the AI will keep trying to house past 200. Bounded and unreachable at current scale, but recorded so it is not a surprise in a future long campaign. Confirm deferral is acceptable rather than folding a one-line AI guard (`populationBlocked && cap < POP_HARD_CAP`) into this slice.
4. **No configurable-cap seam built** (deferred): if the team wants the lobby "200/no-limit" option soon, say so now so `deriveCap`'s signature takes a `hardCap` param from the start rather than a later refactor.

## 3. Files the implementation will touch

Source:
- `src/game/simulation/types.ts` — add `rawSupply: number` to `PopulationState` (line 302-305).
- `src/game/simulation/bridge/bridgeConstants.ts` — add `POP_HARD_CAP = 200` + `deriveCap()`; rewrite the deferral comment (lines 15-26).
- `src/game/simulation/bridge/scenarioSeedOps.ts` — seed `rawSupply: standardPopulationCap` (lines 152-156).
- `src/game/simulation/bridge/entityCreateOps.ts` — direct-create complete path: `rawSupply += populationProvided; cap = deriveCap(rawSupply)` (lines 324-329).
- `src/game/simulation/bridge/systems/playerCommandsSystem.ts` — construction-flow complete path: same (lines 478-482).
- `src/game/simulation/bridge/entityDestroyOps.ts` — both destroy paths: `rawSupply -= populationProvided; cap = deriveCap(rawSupply)` (lines 157-165 and 291-306).
- `src/game/simulation/bridge/bridgeStateSerialize.ts` — replace `populationCodec` flatMap with a bespoke codec that serializes all three fields and defaults `rawSupply ?? cap` + clamps `cap` on deserialize (line 98).
- `src/game/simulation/saveSchema.ts` — `SerializedSideMaps.population` value type gains optional `rawSupply` (line 111).
- `src/game/simulation/bridge/hydrateFromSavedGame.ts` — schema-1 set defaults `rawSupply ?? cap` + clamps cap (lines 113-118).

Docs (mandatory per AGENTS.md):
- `design/spec-final.md` §6.10 (lines 465-466) — limit is now enforced; describe over-housing (no extra cap past 200) + over-cap-after-housing-loss (no eviction, training blocked).
- `docs/devlog/summary.md` + `docs/devlog/detailed/<latest>.md`.
- `docs/changelog.md` (user-visible: 200 cap enforced) + `package.json` bump to 0.1.37.
- `docs/roadmap.md` M1 — tick the pop-cap-200 item.
- No `ARCHITECTURE.md` change (no new subsystem/boundary; same `PopulationState` flowing through the same accessor).

Tests:
- `tests/simulation/populationModel.test.ts` — add `deriveCap` + formula units, or a new `tests/simulation/populationCap.test.ts` for the bridge/behavior + migration cases (keep `populationModel.test.ts` focused on per-building values).
- Extend `tests/simulation/saveLoad.test.ts` (or the new file) for the round-trip + legacy-migration cases.

## 4. Summary of the migration approach

Add `rawSupply` to `PopulationState` as the honest unclamped sum; derive `cap = deriveCap(rawSupply) = min(200, max(0, rawSupply))` at all four mutation sites + on load. `rawSupply` uses plain `+= / -=` (no min/max); the don't-evict guarantee becomes "never evict; over-cap (`current > cap`) is tolerated and blocks training" (already reachable today via monk conversion). Migration is additive and tolerated-when-absent — a bespoke `populationCodec` (schema-2 + replay) and the schema-1 hydrate set both default `rawSupply = cap` (exact for legacy saves) and re-clamp `cap`; no schema-version bump.
