# Asymmetric armor techs — Review iteration 1 (2026-07-01)

Change under review: split the single armor-tech scalar so AoE2's four asymmetric armor techs (Plate Mail Armor, Plate Barding, Ring Archer Armor, Loom) apply +1 melee / +2 pierce (spec §11.8). `armor` stays the symmetric bonus; new `pierceArmorBonus` carries the extra pierce-only +1; a shared `applyArmorTech` helper drives the factory + technologyOps + Loom.

Reviewers: **Codex** (gpt-5.5 xhigh) and **Claude** (opus[1m]). Gemini not run (headless OAuth). Both verified against the live codebase.

## Findings

### Codex + Claude — HIGH (both found it independently; fixed): schema-2 legacy save → NaN pierce armor
The `?? 0` migration was added to `hydrateFromSavedGame.ts` — but that is the **schema-1** path. Since this change did NOT bump `SAVE_SCHEMA_VERSION` (still 2), an actual pre-split save is **schema 2**, which loads via `World.deserialize` → the generic `flatMapCodec` (`new Map(j ?? [])`, no field defaulting) → `hydrateRuntimeFromWorldState` (prunes only). So loaded combat states have `pierceArmorBonus === undefined`. Reads survive (all pierce sites use `pierceArmorTechBonus(... ?? 0)`), which masks it in a round-trip test — but `applyArmorTech`'s `state.pierceArmorBonus += 1` does `undefined + 1 = NaN` the moment an asymmetric tech (very commonly **Loom**) is researched on those units, and NaN then flows into `currentHp -= NaN` (unit never dies, breaks combat/scoring). Data-corruption on the high-risk persistence surface.
- **Fix (belt + suspenders, both reviewers' recommendation):** (1) `hydrateFromWorldState.ts` now normalizes `pierceArmorBonus ??= 0` over `combatStatesCodec` + `wildlifeStatesCodec` after prune (the direct schema-2 analog of the schema-1 default, with dirty-mark); (2) `applyArmorTech` is defensive — `state.pierceArmorBonus = (state.pierceArmorBonus ?? 0) + 1` (ArmorTechState's field is now optional at that boundary). Regression tests: a unit-level test (applyArmorTech on a state with no pierceArmorBonus → pierce 2, not NaN) + a load-path test (deep-strip `pierceArmorBonus` from a schema-2 save, load, research Loom, re-save, and assert every persisted pierce bonus is a finite number — a NaN would serialize to `null` — with the Loom'd villager's = 1). Both fail on the unfixed code.

## Confirmed correct by both reviewers (no action)
- **Split correctness** — every `effectivePierceArmor` caller (blastDamage primary + splash, towerCombat arrows) now routes through `pierceArmorTechBonus`; no pierce site reads `combat.armor` alone; melee sites correctly keep `armor`; wildlife bites are melee-only.
- **`EXTRA_PIERCE_ARMOR_TECHS`** — exactly the four asymmetric techs, matching AoE2 + technologies.csv.
- **Factory ↔ technologyOps drift** — both route all ten armor techs through `applyArmorTech`; no leftover `combat.armor += 1` in either path; the shared helper genuinely prevents drift.
- **Wildlife** — WildlifeProfile + createWildlifeState both set `pierceArmorBonus: 0`; wildlife carry no armor techs.
- **Dead code** — `LOOM_BONUS_ARMOR` removed with no dangling refs; the optional-serialized / required-runtime asymmetry is correct.
- **Test coverage** — the new asymmetry tests (loomTech pierce-5 → 3, asymmetricArmor +2 / +3-4 stack) would fail on the old +1/+1 model.
- **Docs** — spec §11.8, roadmap M2, changelog all match the implementation.

## Extra (self-caught): file-size budget
The added import pushed `technologyOps.ts` to 501 LOC (500 hard limit — it was already maxed). Fixed by extracting the nine repetitive armor cases' per-unit iteration into a shared `applyArmorTechToOwnedUnits` helper (501 → 447), which also removes intra-file duplication.

## Disposition — CONVERGED
The single HIGH (found independently by both reviewers) is fixed with the recommended belt-and-suspenders + two regression tests that fail on the unfixed code; the LOC regression is fixed by a clean extraction. Everything else confirmed correct by both. Proceeding.
