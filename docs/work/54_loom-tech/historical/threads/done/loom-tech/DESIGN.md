# DESIGN — Loom technology (v0.1.40)

## Summary / headline

Loom is a clean grounded single-tech slice. It is **data-only today** (in `design/stats/technologies.csv:86`, slugified to `loom` by the content build, but the string `loom` appears NOWHERE in `src/` — not in the `ResearchableTechnologyType` union, not in any table). Nothing is partly wired, so there is no migration of half-built state.

> **SHIPPED (v0.1.40): Decision 3 → Option B, not the recommended Option A.** The team lead chose the thinner variant: armor stays the single `CombatState.armor` scalar and Loom adds **+1 (symmetric +1/+1)**, with AoE2's extra +1 pierce DEFERRED to a future asymmetric-armor-tech slice (M2 Slice 2b) — ZERO save change. "Option A (recommended) — split `CombatState.armor`" in Decision 3 below records the design analysis and the path 2b will take; it is NOT what shipped. Everything else (the Wheelbarrow-pattern research wiring, the FLAT +15/+15 HP, the `applyLoomToOwnedVillagers` extraction into `loomEffect.ts` to hold the file-size budget) shipped as designed.

Wiring it touches the two layers the brief predicted, with one real wrinkle:

- **Researchable at the TC (Dark Age, 50 gold, no prereq):** follows the established Wheelbarrow/Hand-Cart pattern exactly — add `loom` to the `ResearchableTechnologyType` union, the two compile-enforced cost/time tables, the `town-center` row of `RESEARCHES_BY_BUILDING`, and the TC branches of `getResearchOptions` / `getVisibleResearchOptions`. The `cannot_research` affordance and the validator come along for free because they read those same tables.
- **Armor (+1 melee / +2 pierce):** rides the existing `effectiveMeleeArmor` / `effectivePierceArmor` derivation **only after** we resolve an asymmetry. Today both effective-armor helpers add the SAME single `CombatState.armor` scalar (every existing blacksmith tech is symmetric `+1/+1`, so one field sufficed). Loom is the first **asymmetric** armor tech (`+1 melee / +2 pierce`), so one scalar cannot represent it. The chosen design splits the stored field into `meleeArmor` / `pierceArmor` (see Decision 3). This is contained but is the one piece beyond a copy-paste of the carry-tech pattern.
- **+15 max HP (the load-bearing choice):** applied **imperatively** to each owned villager's `CombatState` (current AND max both +15, flat) and to newly-trained villagers via `createCombatState` — mirroring how the blacksmith armor/attack techs already work. This is **derived-at-creation + bumped-on-research**, NOT a save-format change: `combatStates` (with `currentHp`/`maxHp`/`armor`) is ALREADY serialized, and `loom` itself persists in the already-serialized `researchedTechnologies` set.

**No save-format change. No schema-version bump. No new side map. No new engine primitive.** Scope is Loom only.

The only non-trivial decisions are (a) the armor-field split and (b) the HP-bump model (flat +15 to current & max, not the HP-ratio rebuild that `upgradeOwnedUnits` uses). Both are detailed below; the team lead may prefer a thinner armor variant (Decision 3, Option B) — flagged.

## Investigation findings (cited)

### 1. How techs become researchable at a building

Two cooperating surfaces, which the validator REQUIRES to agree:

- **`RESEARCHES_BY_BUILDING`** in `src/game/simulation/prototypeBuildingRules.ts:258-268` — the static building→techs registry. `canResearchAt(buildingType, tech)` (`:368-373`) and `buildingsThatResearch(tech)` (`:406-414`) read it. The `town-center` row (`:259`) is `['feudal-age', 'castle-age', 'imperial-age', 'wheelbarrow', 'hand-cart']`.
- **`getResearchOptions` / `getVisibleResearchOptions`** in `src/game/simulation/bridge/optionsRules.ts:173-434` — the per-owner, age/civ/researched-aware list. The TC branch (`:177-200`) pushes the age-up + carry techs; `getVisibleResearchOptions` (`:408-434`) is the agent/HUD-facing variant.

The `queue.research` validator (`src/game/simulation/handlers/queue/queueResearchValidator.ts:63-75`) rejects unless **both** `canResearchAt(...)` AND `getResearchOptions(owner, building).includes(tech)` pass — then charges `researchCost(tech)` after an affordability check (`:86-95`). The handler (`queueResearchHandler.ts`) delegates to `enqueueResearchDirect`, which re-checks authoritatively and calls `spendResources`. So cost-charging and the in-flight guard are entirely table-driven; adding `loom` to the tables + options is sufficient, no validator/handler edit.

The `cannot_research` affordance is produced by `src/game/simulation/bridge/researchAvailability.ts`. For a non-age-up, not-yet-researched tech that is gated by age, the fallback message (`:131-134`) is generic-but-actionable (it lists what IS researchable). Loom has **no prereq beyond a standing TC and being alive in any age**, so it is offered the moment a TC exists — it will essentially never hit a "not available yet" message. The only reasons it can be unavailable are "already researched" (`:124-126`) and "wrong building" (`:114-120`), both already handled. **No researchAvailability edit needed.**

### 2. Cost / research-time tables (compile-enforced)

`src/game/simulation/prototypeEconomyRules.ts` holds two `Record<ResearchableTechnologyType, ...>` tables (NON-partial, so a missing key is a TS error):

- `RESEARCH_COSTS` (`:121`) — Loom needs `loom: { gold: 50 }`.
- `RESEARCH_TIME_TICKS` (`:231`) — Loom needs `loom: 250` (25 s × 10 TPS, matching the file's `feudal-age: 1300` = 130 s × 10 convention).

`researchCost` (`:430`) / `researchTimeTicks` (`:446`) read them. These are the only two tables the union expansion forces. (Costs/times are HARDCODED here, not read from the CSV at runtime — the CSV is only normalized into a generic content listing; the runtime source of truth is these TS tables.)

### 3. The tech-EFFECT layer

**Armor — where it is resolved (the damage site).** `src/game/simulation/bridge/systems/playerCommandsSystem.ts:228-233`:

```ts
targetCombat.currentHp -= combatDamageAfterArmor(
  rawDamage,
  unitAttackType(unit.unitType),
  effectiveMeleeArmor(targetUnit.unitType, targetCombat.armor),
  effectivePierceArmor(targetUnit.unitType, targetCombat.armor),
);
```

`effectiveMeleeArmor` / `effectivePierceArmor` (`prototypeUnitRules.ts:58-74`) = base armor (`UNIT_MELEE_ARMOR` / `UNIT_PIERCE_ARMOR` in `prototypeUnitRules/statTables.ts:111,153`; villager base `0/0`) PLUS the SAME `targetCombat.armor` scalar. Blacksmith armor is therefore **owner-derived at training + imperatively bumped on research**, stored in `CombatState.armor` — NOT recomputed at the damage site. `combatStateFactory.ts:56-88` adds `+1` per relevant armor tech at creation; `technologyOps.ts:331-441` does `combat.armor += 1` over owned units on research.

The wrinkle: every existing armor tech is symmetric `+1/+1`, so feeding ONE scalar to both helpers is correct today. Loom is `+1 melee / +2 pierce` — **the first asymmetric tech** — so a single scalar is insufficient. (The roadmap already names this: M2 Slice 2b "split which armor techs feed melee vs pierce", `design/roadmap.md:37`.)

**+15 max HP — is there any maxHP-from-tech plumbing?** No. Every blacksmith tech touches `armor` / `attackDamage` only; `maxHp` is set once from `unitMaxHp(unitType)` in `combatStateFactory.ts:32-33` and otherwise only rewritten by `upgradeOwnedUnits` (`technologyOps.ts:112-120`) when a unit's TYPE changes — and that path preserves HP *ratio* (wrong for a flat HP buff). So Loom must introduce the first HP-from-tech effect. It is small and local (villager-only), and it does NOT need new persisted state because the resulting `currentHp`/`maxHp` already live in the serialized `combatStates`.

### 4. Save format

`src/game/simulation/saveSchema.ts:188-196` already serializes `combatStates` with `currentHp`, `maxHp`, `armor`. `researchedTechnologies` is serialized at `:108`. Therefore:

- `loom` in the researched-tech set → persists through the existing `researchedTechnologiesCodec` (round-trips with no schema work).
- The +15 HP and +armor land in `CombatState` fields that ALREADY serialize.
- **Save-format impact = none, IF the armor split (Decision 3) stays within the existing `armor` field OR migrates additively.** Decision 3 Option A renames/splits the field, which DOES touch `saveSchema.ts` + the codec + hydrate — see the save note in Decision 3. This is the one place "no save change" needs care.

### 5. Scope confirmation

`loom` is absent from `src/`; `ResearchableTechnologyType` (`types.ts:75-135`) has 37 entries, none Loom. No partial wiring. The content build slugifies `Loom`→`loom` generically and does not type-check CSV techs against the union, which is why the build is green today with Loom unwired (adding it is purely additive). No `civ-engine` gap (`docs/engine-feedback/current.md`: "engine is not the blocker today").

## Decisions

### Decision 1 — Make Loom researchable (mechanical, low-risk)

- `types.ts`: add `| 'loom'` to `ResearchableTechnologyType` (new comment block "Town Center economy/utility tech" or fold near the carry techs).
- `prototypeBuildingRules.ts:259`: add `'loom'` to the `town-center` `RESEARCHES_BY_BUILDING` row.
- `prototypeEconomyRules.ts`: `RESEARCH_COSTS.loom = { gold: 50 }`; `RESEARCH_TIME_TICKS.loom = 250`.
- `optionsRules.ts` TC branches: offer `loom` whenever the owner does NOT have it (any age — Dark onward), in BOTH `getResearchOptions` (`:177-200`) and `getVisibleResearchOptions` (`:412-431`). Gate: `if (!hasTechnology(owner, 'loom')) options.push('loom');`. **Ordering note:** the existing TC `getResearchOptions` early-returns the moment `options.length > 0`, with age-up + carry pushed first. Loom must be appended to that SAME options array (not in a separate block that the early-return would skip). Place it after carry techs so age-up still comes first in the list. Mirror in `getVisibleResearchOptions`.

The validator + `cannot_research` reason engine require no edits (they read the above).

### Decision 2 — +15 villager HP: imperative, flat, current AND max (LOAD-BEARING)

Apply exactly like the blacksmith bonuses, but for HP and villager-only:

- **Newly-trained villagers** — in `combatStateFactory.ts`, after the base `state` is built, add:
  `if (unitType === 'villager' && hasTechnology(owner, 'loom')) { state.maxHp += 15; state.currentHp += 15; }`
  (a new villager is at full HP, so current and max both go 25→40).
- **Existing villagers** — add a `case 'loom':` to the `applyTechnology` switch in `technologyOps.ts` that walks owned `unit` entities, and for each villager does a **flat** bump of BOTH fields:
  `combat.maxHp += 15; combat.currentHp += 15;`
  Flat (not ratio): a villager at 10/25 becomes 25/40 — AoE2 adds the buffer to current HP too. **Do NOT route this through `upgradeOwnedUnits`**, which rebuilds CombatState preserving HP *ratio* (`technologyOps.ts:116-118`) — that is the unit-TYPE-change model and would scale current HP wrongly for a flat buff.
- The existing idempotency guard at the top of `applyTechnology` (`:161-164`) prevents a double-bump if two TCs race-queue Loom. **This guard is essential for the flat += HP/armor mutations** (same reason it protects the `+= 1` armor techs).
- `accessor.markDirty(combatStatesCodec)` already fires unconditionally at the end of `applyTechnology` (`:492`), and `markOutOfBandRenderChange` is available in the deps for the HP-bar refresh.

HUD: `getEntityHealth` reads `combat.currentHp/maxHp` (`selectionStateOps.ts:111`), so the selection panel shows 40 max automatically — no HUD edit.

**Why imperative over derived:** the armor/HP buff attaches to a per-entity `CombatState`, exactly like every blacksmith tech, and `CombatState` is already the serialized, damage-site-read source of truth. A derived model (recompute HP from the researched set at the damage site, like the econ multipliers) would mean NOT storing HP — but `currentHp` is mutable battle state that MUST be stored, and max HP is read in dozens of places from `CombatState`. Deriving would fork villager HP away from how every other unit's HP works. Imperative is the consistent, lower-risk choice and needs no new state.

### Decision 3 — Asymmetric armor (+1 melee / +2 pierce): split the stored field (LOAD-BEARING; alternative flagged)

Loom cannot be expressed by the single `CombatState.armor` scalar. Two options:

**Option A (recommended) — split `CombatState.armor` → `meleeArmor` + `pierceArmor`.**
- `systemTypes.ts:7-15` `CombatState`: replace `armor: number` with `meleeArmor: number; pierceArmor: number`.
- `combatStateFactory.ts`: initialize both to 0; the existing symmetric blacksmith techs bump BOTH (`+1/+1`); Loom for villagers bumps `meleeArmor += 1; pierceArmor += 2`.
- `technologyOps.ts`: the existing `combat.armor += 1` armor cases become `combat.meleeArmor += 1; combat.pierceArmor += 1;` (still symmetric — behavior-preserving); the new `loom` case adds `+1 / +2` for villagers.
- Damage site `playerCommandsSystem.ts:231-232`: pass `effectiveMeleeArmor(type, targetCombat.meleeArmor)` and `effectivePierceArmor(type, targetCombat.pierceArmor)`.
- `effectiveMeleeArmor` / `effectivePierceArmor` keep their signature `(unitType, techBonus)` — callers just pass the matching field. The slice-1/2 base-armor split (`UNIT_MELEE_ARMOR`/`UNIT_PIERCE_ARMOR`) is untouched.
- Read-side consumers of the single field: `selectionStateOps.ts:169` (`getSelectionArmor`), `economyStateOps.ts:98` (agent snapshot `armor`). These currently expose ONE number. Cleanest is to expose `meleeArmor`/`pierceArmor` (or keep one display number = `meleeArmor`, the AoE2-conventional "armor" shown first). Recommend surfacing both where the type allows; minimally keep a single display = `meleeArmor` to avoid widening the HUD `SelectionState.armor` type in this slice.
- **SAVE IMPACT (the one real save touch):** `saveSchema.ts:188-196` `combatStates` payload `armor` becomes `meleeArmor`/`pierceArmor`. The codec (`bridgeStateSerialize.ts`, the `combatStatesCodec` pair) + the schema-1 hydrate path must map a legacy `armor: N` blob to `meleeArmor: N, pierceArmor: N` (additive, no schema-version bump — old symmetric saves load correctly because every prior armor tech was `+1/+1`). This is a small, well-bounded migration mirroring the v0.1.37 `rawSupply` optional-field precedent. It IS a (backward-compatible) save touch — flag for the team lead; it does not bump the schema version but it is more than "zero save change."

**Option B (thinner; flag as the fallback) — keep one `armor` scalar; model Loom as `+1` (a deliberate, documented simplification).**
- Zero save touch, zero new field, minimal diff: Loom does `combat.armor += 1` for villagers (current armor-tech pattern), and the +pierce specificity is deferred to M2 Slice 2b ("split which armor techs feed melee vs pierce", already on the roadmap).
- Cost: villager pierce armor is `+1` not `+2` — Loom is slightly weaker vs archers than AoE2. Given villagers are non-combatants and the campaign-10 driver was "Loom is unimplemented" (breadth), this is defensible and keeps the slice a true copy-paste of the carry-tech pattern.

**Recommendation:** Option A — it is the correct AoE2 value (`+1/+2`), and it lays the melee/pierce-armor-field split that M2 Slice 2b needs anyway, turning a future "big fragile" task into an incremental one. But it has the bounded save migration above; if the team lead wants this slice to be zero-save-touch, take Option B and let Slice 2b deliver the asymmetric pierce value. **This is the decision the team lead should make before implementation.**

## Files the implementation will touch

Decision 1 (always):
- `src/game/simulation/types.ts` — `+ | 'loom'`.
- `src/game/simulation/prototypeBuildingRules.ts` — `town-center` `RESEARCHES_BY_BUILDING` row.
- `src/game/simulation/prototypeEconomyRules.ts` — `RESEARCH_COSTS.loom`, `RESEARCH_TIME_TICKS.loom`.
- `src/game/simulation/bridge/optionsRules.ts` — TC `getResearchOptions` + `getVisibleResearchOptions`.

Decision 2 (always):
- `src/game/simulation/bridge/combatStateFactory.ts` — villager HP +15 at creation under `hasTechnology(owner,'loom')`.
- `src/game/simulation/bridge/technologyOps.ts` — `case 'loom':` flat current+max HP bump (+armor here too).

Decision 3 Option A (if chosen — armor split):
- `src/game/simulation/bridge/systems/systemTypes.ts` — `CombatState` field split.
- `src/game/simulation/bridge/combatStateFactory.ts` — both fields (already in Decision 2's file).
- `src/game/simulation/bridge/technologyOps.ts` — symmetric techs → both fields; Loom `+1/+2` (already in Decision 2's file).
- `src/game/simulation/bridge/systems/playerCommandsSystem.ts:231-232` — pass the matching field to each effective-armor helper.
- `src/game/simulation/bridge/systems/wildlifeCombatSystem.ts` + `towerCombatSystem.ts` — these also call the effective-armor helpers / read `combat.armor`; audit + update to the split fields (the `WildlifeState extends CombatState`, so the field rename propagates — confirm at impl time).
- `src/game/simulation/saveSchema.ts` + `bridgeStateSerialize.ts` (combatStatesCodec) + `hydrateFromSavedGame.ts` — additive legacy `armor`→`{meleeArmor,pierceArmor}` map.
- `src/game/simulation/bridge/selectionStateOps.ts:169` + `economyStateOps.ts:98` + `types.ts` `EconomyState.units[].armor` / `SelectionState.armor` — read-side display.

Decision 3 Option B (if chosen): only `combatStateFactory.ts` + `technologyOps.ts` (already in Decision 2's files) — `combat.armor += 1` for villagers. No save/HUD/wildlife/tower touch.

Spec + docs (always, per AGENTS.md):
- `design/spec-final.md` — record the Loom rule (likely a new tech/economy subsection or under the existing research/tech section).
- `docs/devlog/summary.md` + `docs/devlog/detailed/<latest>.md`, `docs/changelog.md`, `package.json` → `0.1.40`.
- `design/roadmap.md` Playtest findings log — mark Loom done.

## How the +15 HP is applied (the load-bearing choice, restated for the reviewer)

Imperative + flat, on the per-entity `CombatState`:
- New villagers: `createCombatState` adds +15 to both `maxHp` and `currentHp` when the owner has Loom (full-HP unit → 40/40).
- Existing villagers: `applyTechnology('loom')` walks owned villagers and adds +15 to BOTH `currentHp` and `maxHp` (a 10/25 villager → 25/40). Flat, NOT ratio-preserving (distinct from `upgradeOwnedUnits`).
- Idempotency: the `applyTechnology` already-researched guard prevents a double-bump.
- Persistence: lands in the already-serialized `combatStates`; no new state.

## Save-format impact

- `loom` in `researchedTechnologies`: already serialized, zero change.
- +15 HP and (Option B) +1 armor: land in already-serialized `CombatState` fields, zero change.
- **Option A only:** an additive, backward-compatible `combatStates.armor → {meleeArmor, pierceArmor}` migration (legacy `armor: N → N/N`), NO schema-version bump. This is the single save touch and the reason Option A is "near-zero" rather than "zero" save impact.

## Test plan (TDD; mirrors `economyResearchOptions.test.ts`, `economyCarryTechs.test.ts`, `combatArmor.test.ts`)

1. **Options/availability** (mirror `economyResearchOptions.test.ts`, pure `createOptionsRules`): TC offers `loom` in the Dark Age and every later age until researched; `loom` drops out once `hasTechnology` is true; `loom` is offered alongside (after) the age-up. `getVisibleResearchOptions` surfaces it. `canResearchAt('town-center','loom')` true; `canResearchAt('barracks'|'lumber-camp','loom')` false (guards the validator↔options agreement).
2. **Cost/time tables**: `researchCost('loom')` = `{ gold: 50 }`; `researchTimeTicks('loom')` = 250.
3. **Research charges + records** (live-bridge integration like the carry/age tests): with a TC and ≥50 gold, queue+complete Loom → 50 gold spent, `loom` in the researched set; with <50 gold → `insufficient_resources` rejection.
4. **Existing villagers gain the buff on research** (live bridge): pre-research a villager is 25/40-armor-0; after Loom completes, an existing villager is 40 max HP with current bumped +15 (e.g. seed a damaged villager → assert 25/40 not 40/40 if testing the flat-not-ratio path), melee armor +1, pierce armor +2 (Option A) / +1 (Option B).
5. **Future villagers get the buff** (live bridge): train a villager AFTER Loom → 40/40, armor as above (via `createCombatState`).
6. **Armor reduces incoming damage at the site** (mirror `combatArmor.test.ts`, pure): `effectivePierceArmor('villager', 2)` = 2 and `effectiveMeleeArmor('villager', 1)` = 1 (Option A); `combatDamageAfterArmor` shows a Loom villager takes less melee AND pierce damage than a base villager. (Option B: melee+1, pierce+1.)
7. **No effect pre-research**: base villager 25/40 (i.e. 25 max), armor 0; a non-villager (e.g. militia) is unaffected by Loom even when the owner has it (guards the `unitType === 'villager'` gate in both creation and the apply path).
8. **Save round-trip** (mirror existing save tests): research Loom, save, load → `loom` still in the set, villagers still 40 max HP + the armor buff (re-derived for future villagers via the rebuilt `hasTechnology`); Option A: a legacy blob with `combatStates.armor: 1` hydrates to `meleeArmor:1, pierceArmor:1`.

## Risks / open questions (top 3)

1. **Armor asymmetry → field split is the only non-mechanical risk (Decision 3).** Option A is correct AoE2 (`+1/+2`) and unblocks M2 Slice 2b, but renames `CombatState.armor` across the damage site, wildlife/tower combat systems, the save codec + hydrate, and two read-side consumers (HUD selection, agent snapshot) — a wider blast radius than the carry-tech precedent. The save migration is additive (legacy `N`→`N/N`, no version bump) but it IS a save touch. **Open question for the team lead: Option A (split now, near-zero save touch, correct value) vs Option B (single scalar, Loom=+1 pierce as a documented simplification, zero save touch, defer the +2 to Slice 2b)?** Everything else in the slice is identical between the two.
2. **Bumping existing villagers' current HP must be flat, not ratio.** The natural-looking reuse of `upgradeOwnedUnits` would preserve HP *ratio* (it is the type-change path) and under-heal damaged villagers. The design uses a dedicated flat `+15` to both current and max. Risk is low (explicitly tested in plan item 4) but it is the subtle correctness trap — a reviewer should confirm the apply path does NOT go through `upgradeOwnedUnits`.
3. **Idempotency / race on the flat += bumps.** Two TCs race-queueing Loom would double the +15 HP / +armor without the `applyTechnology` already-researched guard (`technologyOps.ts:161-164`). The guard exists and covers this, but it is load-bearing for the new flat-mutation case exactly as it is for the existing `+= 1` armor techs — the impl must rely on it (do not add a second guard, do not bypass it). Lower-probability secondary: the `loom` HP buff is villager-only, so it interacts with NO unit-type upgrade (villagers never upgrade), avoiding the `createCombatState`-on-upgrade re-application concern that affects combat units.
