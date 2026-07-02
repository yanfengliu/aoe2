# Husbandry + movement-speed seam (per-unit carry accumulator) — DESIGN

**Objective:** ship the game's first movement-speed technology — Husbandry (Stable, Castle Age, 250 food, 500 ticks, +10% speed for cavalry + cavalry archers, per `design/stats/technologies.csv:79`) — by building the minimal per-unit movement-speed seam the roadmap (M1) defers: "the sim has no per-unit movement-rate model today (all units move at a uniform subgrid cadence via `moveUnitOneSubgridStep`)".

## Grounding

- **Data:** `technologies.csv:79` — `Husbandry, Age of Kings, Castle, Stable, {"Food": 250}, 50, Cavalry;Cavalry Archer;Conquistador, Movement rate * 1.1`. The 250f/50s values are the original Age of Kings numbers (a later DE patch rebalanced to 150f/40s); this repo's CSVs are AoK-sourced throughout, so the CSV stands. Sources: [Fandom — Husbandry](https://ageofempires.fandom.com/wiki/Husbandry_(Age_of_Empires_II)), [Liquipedia — Husbandry](https://liquipedia.net/ageofempires/Husbandry).
- **Spec:** §12.5 Movement Rates and Modifiers mandates "cavalry speed bonuses / infantry speed bonuses / villager speed bonuses" but had no mechanism.
- **Mechanics today:** units live on a 4×4-per-cell subgrid (`UNIT_SUBGRID_RESOLUTION = 4`); every commanded mover advances `UNIT_SUBGRID_STEP_PER_TICK = 2` fine units per tick (0.5 cells/tick) through the single executor `transformOps.moveUnitOneSubgridStep` (10 call sites: villagerEconomySystem ×2, playerCommandsSystem ×6, monkBehaviorSystem ×1, herdableMovementSystem ×1 — the sheep site passes an explicit `stepUnits = 1` and is the proof the override parameter works). `stepUnitTransformToward` moves one axis at a time toward the target transform. The AI scout-WANDER path (scoutMovementSystem, `velocity.dx × UNIT_SUBGRID_STEP_PER_TICK`) is a separate velocity-bounce mechanism and is out of scope for this slice. **Review-corrected scope note:** the original justification here ("the AI only researches age-ups") was FALSE — the AI's generic research loop (aiSystem.ts:644-676) queues any affordable option at an idle Stable, which now includes Husbandry, so the AI does research it in normal games and its COMMANDED mounted units (knights, cavalry archers) get the +10%. The residual gap is only the AI's own scout: `isAiMilitaryUnit` excludes scouts from AI commands, wander is its sole movement mode, and wander bypasses the executor — a LOW-impact known limitation, deferred to the per-unit-type base-speed slice (roadmap M1).
- **Engine:** civ-engine has no per-unit speed concept; movement is entirely bridge-owned. No engine change needed or made.

## The core design: a per-unit carry accumulator (revised during TDD — see the discovery below)

The naive wiring — `Math.round(UNIT_SUBGRID_STEP_PER_TICK × 1.1) = 2` — is a silent NO-OP, the exact failure v0.1.26 hit with gather-rate rounding (lessons.md). A +10% speed on a 2-step base can only manifest as *an extra step on some ticks*.

**First attempt (disproven):** a stateless tick-derived schedule `steps(tick) = floor((tick+1)·base·pct/100) − floor(tick·base·pct/100)` (2,2,2,2,3 repeating at 110%) — attractive because it needs zero stored state. The RED→GREEN cycle measured it at **exactly 40 = 40 ticks over 20 cells: zero effect.** A probe confirmed the executor derived 110% correctly; the +10% was being eaten structurally: every call site passes `plan.nextStep` — the next path CELL, a 4-fine-unit waypoint leg — and `stepUnitTransformToward` clamps the tick's step to the remaining leg. A 3-step surge landing on a 2-remaining leg is cut to 2, and a fresh-leg 3 leaves a 1-remainder consumed next tick, so **every 4-unit leg costs 2 ticks whether granted 2+2 or 3+1 — per-cell quantization swallows any stateless surge schedule** (larger surges just shift phase and get absorbed the same way).

**Shipped design:** the same fix v0.1.26 shipped for gather cadence — a per-unit fractional accumulator that BANKS unconsumed entitlement across ticks and clamps. `movementTechEffects` exposes two pure phases: `movementEntitlement(carry, base, pct)` (carry += base×pct hundredths; grant = floor(carry/100)) and `settleMovementCarry(entitled, movedSteps)` (subtract what the move ACTUALLY consumed — a waypoint/map clamp's shortfall stays banked — then cap at `MOVE_CARRY_CAP_HUNDREDTHS = 300` so a long-clamped unit cannot burst). The executor measures actual movement from the pre/post transform deltas. Conservation makes the walk math exact: 80 fine units at 110% complete in 37 ticks vs 40 baseline (pinned by a pure waypoint-walk simulation test that reproduces the clamp semantics).

- **Carry storage:** a new OPTIONAL `moveCarryHundredths?: number` on `UnitTransformComponent` — persisted with the entity exactly like `gatherProgressTicks` (v0.1.26) and additive like `pierceArmorBonus` (v0.1.53): pre-speed-model saves read `?? 0`, no schema bump.
- **Byte-identical baseline:** the carry is read/written ONLY when the derived percent ≠ 100 — un-teched units never materialize the field and step exactly as before. (The built-in AI CAN research Husbandry through its generic stable-research loop, so AI mounted units legitimately speed up after it lands — deterministic per seed; the full suite including the AI corpus is green.)
- **Save/load + replay:** the field serializes with the component, so a mid-walk save resumes the exact fraction; replays re-derive it by re-stepping from the initial snapshot. Mid-game research flips the percent on the next tick; a monk-converted unit follows its new owner's techs automatically (a stale ≤3-fine-unit bank from a former owner is bounded and deterministic).

## Seam placement

Inside `moveUnitOneSubgridStep` itself (transformOps.ts) — the one executor every commanded mover already funnels through:

- `stepUnits` **explicitly passed** (the sheep site) → honored verbatim, speed model bypassed. Sheep stay slow.
- `stepUnits` omitted → read the mover's `unit` component (owner + unitType), derive `pct = movementSpeedPercent(researchedSet(owner), unitType)`; `pct === 100` → the constant base step (fast path — no carry read/write); else grant via `movementEntitlement(transform.moveCarryHundredths ?? 0, base, pct)` and, after the clamped move, bank the shortfall via `settleMovementCarry` measured on the actual pre/post transform deltas.
- `createTransformOps` already receives the `accessor` (Phase 2D) — `accessor.get(researchedTechnologiesCodec)` is the same per-tick-cached read villagerEconomySystem does per villager for gather rates, so the added cost is one Map.get + Set.has per moving unit per tick.
- Non-unit callers are unaffected (the function returns early without a `unitTransform`); entities without a `unit` component keep the base step.

New pure module `src/game/simulation/movementTechEffects.ts` (sappersTechEffects' sibling): `HUSBANDRY_SPEED_PERCENT = 110`, `MOVE_CARRY_CAP_HUNDREDTHS = 300`, `movementSpeedPercent(researched, unitType)`, `movementEntitlement(carry, base, pct)`, `settleMovementCarry(entitled, movedSteps)`.

## Husbandry scope: mounted units

CSV applies-to is `Cavalry;Cavalry Archer;Conquistador` (conquistador not in the roster). `CAVALRY_UNITS` excludes the mounted archers, so this adds `MOUNTED_UNITS = CAVALRY_UNITS ∪ {cavalry-archer, heavy-cavalry-archer}` (statTables) + `isMountedUnit` (prototypeUnitRules), single-sourced from CAVALRY_UNITS.

**Pre-existing divergence found during grounding (NOT changed here):** shipped Bloodlines (v0.1.65) is Castle-gated and cavalry-only, but its own CSV row (`technologies.csv:78`) says **Feudal** age and **Cavalry;Cavalry Archer** — matching AoE2 (Bloodlines is a Feudal Stable tech that also boosts cavalry archers). Fixing shipped behavior is a separate user-visible increment; queued as the immediate follow-up thread, not silently folded in here.

## Alternatives rejected

- **Stateless tick-derived surge schedule:** implemented first for its zero-stored-state appeal and DISPROVEN by measurement — the per-cell waypoint clamp absorbs every surge (see the discovery narrative above). Kept here as the load-bearing lesson: any movement-rate change must carry fractional entitlement across waypoint legs.
- **Round/ceil the step at call sites:** either a no-op (round) or +50% (ceil) — cannot express ×1.1.
- **Per-call-site multiplier reads:** scatters the tech read over 10 sites and each system would need the researched set threaded in; the single-executor placement covers all of them.
- **Transient (non-persisted) carry map in bridgeState:** avoids the component field but silently loses the fraction on save/load, breaking resume-exactness for no real saving — the additive optional field costs nothing (`?? 0`).
- **civ-engine speed component:** engine change for something the bridge fully owns; violates the engine boundary for no benefit.

## What this unlocks (deferred, documented in roadmap M1)

Squires (infantry ×1.1, Barracks), the Wheelbarrow/Hand Cart villager speed halves (×1.1 each, stacking 121), ram garrison speed, and — the larger follow-on — per-unit-TYPE base speeds from the units.csv `movement_rate` column (knight 1.35 vs villager 0.8 vs ram 0.5), which replaces the uniform base and is its own fixture-churning iteration.

## Validation

TDD per PLAN.md: pure percent/entitle/settle tests (the 2,2,2,2,3 grant pattern, the pct=100 identity that never materializes carry, the clamped-shortfall bank, the cap, and a waypoint-walk simulation pinning 80 fine units at 37 ticks boosted vs 40 baseline), cost/time/gating tests mirroring bloodlines.test.ts, and live-bridge movement races on hermetic twin fixtures (a Husbandry knight arrives ≥2 ticks earlier over a straight 20-cell run; a militia's arrival tick is identical across twins; a knight commanded after a LIVE research cycle outraces an unresearched control). The RED phase of this suite is what exposed the waypoint-quantization trap. No LLM playtest needed — deterministic fixtures are the validation per the loop-strategy note.
