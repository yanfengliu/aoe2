# Sappers tech (v0.1.64) — PLAN

## Objective
Add **Sappers**, a researchable tech granting the owner's **infantry** units **+15 attack vs buildings**. AoE2 hosts it at the University (not in this build); hosted at the **Blacksmith** (the combat-upgrade home, which already carries Imperial techs like Blast Furnace / Chemistry), **Imperial-gated**, same documented divergence as Siege Engineers at the Siege Workshop.

## Why this shape
The single unit→building damage site is `playerCommandsSystem.ts:327` (`attackerCombat.attackDamage + attackBonusAgainstBuilding(unit.unitType)`), which applies **no armor reduction** (raw). So the bonus is a pure DERIVED read at that site — no per-unit combat-state mutation, no `applyTechnology` loop, no `combatStateFactory` branch. Cleaner than Siege Engineers (which mutated attackRange). Mirrors `buildingArrowTechEffects` (read at the tower fire site).

## Seam (files)
1. `technologyTypes.ts` — add `'sappers'` to `ResearchableTechnologyType`.
2. `prototypeEconomyRules.ts` — `RESEARCH_COSTS['sappers'] = { food: 400, gold: 200 }` (AoE2), `RESEARCH_TIME_TICKS['sappers'] = 200` (AoE2 Sappers is a fast ~10 s research → keep it the quick/cheap outlier). Both are exhaustive `Record<ResearchableTechnologyType,…>`, so typecheck forces the entries. File is at the 500-LOC cap → condense 2 comment lines to hold ≤500.
3. `prototypeUnitRules.ts` — add `isInfantryUnit(unitType)` (mirrors `isSiegeUnit`, backed by `UNIT_ARMOR_CLASSES[unitType].has('infantry')` — single-sources the classification).
4. NEW `sappersTechEffects.ts` (pure) — `SAPPERS_BUILDING_ATTACK_BONUS = 15`; `sappersBuildingAttackBonus(researchedTechnologies, unitType)` → 15 if `has('sappers') && isInfantryUnit`, else 0.
5. `prototypeBuildingRules.ts` — add `'sappers'` to `RESEARCHES_BY_BUILDING['blacksmith']`.
6. `playerCommandsSystem.ts` — at the building-damage site add `+ sappersBuildingAttackBonus(ownerTechs, unit.unitType)`, reading `ownerTechs = accessor.get(researchedTechnologiesCodec).get(unit.owner) ?? EMPTY_TECH_SET` (mirror towerCombatSystem).
7. `optionsRules.ts` — offer `'sappers'` in the Blacksmith Imperial block (`!hasTechnology(owner,'sappers')`).
8. NEW `fixtures/sappers.ts` — baseline + researched variants: player-1 militia adjacent to an enemy (owner-2) house, AI disabled.
9. `fixtures/index.ts` + `prototypeScenario/dispatch.ts` — register `sappers-baseline-fixture` / `sappers-researched-fixture`.

## Tests (TDD) — `tests/simulation/sappers.test.ts`
- `isInfantryUnit` classifies militia/spearman/pikeman/champion true; archer/villager/knight/mangonel false.
- `sappersBuildingAttackBonus`: 0 for all without the tech; 15 for infantry with the tech; 0 for non-infantry (archer/villager/knight/mangonel) with the tech.
- Cost/time table: `{ food: 400, gold: 200 }`, 200.
- Gating: `canResearchAt('blacksmith','sappers')` true; false for town-center/siege-workshop/monastery. Offered at an Imperial Blacksmith, drops once researched; NOT offered at a Castle-Age Blacksmith.
- DERIVED integration (time-to-destroy): a militia adjacent to an enemy house destroys it in **fewer ticks** with Sappers than without; baseline also eventually destroys it (base militia damage > 0).

## Docs
changelog 0.1.64; spec §10.7.x (new Sappers subsection, University divergence); devlog summary + detailed; version bump. No ARCHITECTURE change (no new subsystem — one pure module + a damage-site read). No save-format change (derived from `researchedTechnologiesCodec`).

## Gates
typecheck, lint, build, fileSizeBudget (prototypeEconomyRules held ≤500), sappers + affected combat/siege/blacksmith suites. Adversarial review before commit.
