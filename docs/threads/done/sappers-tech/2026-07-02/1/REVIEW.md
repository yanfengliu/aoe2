# Sappers tech (v0.1.64) — Review iteration 1

**Scope:** new Blacksmith tech Sappers (+15 infantry attack vs buildings), DERIVED at the single unit→building damage site. Reviewers: one independent adversarial subagent (general-purpose, instructed to refute each risk against the live code). Not high-risk (no persistence/security/concurrency/money surface), so the multi-CLI review was not required; this in-process adversarial pass is the default gate.

**Disposition: APPROVED — no changes required.** Every refutation attempt failed against the live code.

## Findings

| Severity | Area | Finding | Status |
|---|---|---|---|
| — | Determinism | `sappersBuildingAttackBonus` is pure (`Set.has` + `isInfantryUnit`); no Math.random/Date.now/ordering. Damage-site read is a deterministic map lookup. | CLEAN |
| — | Missed damage path | Audited every `currentHp -=` / building-health mutation. `playerCommandsSystem.ts:334` is the ONLY unit→building damage site. `blastDamage` mutates unit combat only (and only for mangonel/onager blast); `towerCombatSystem` is building→unit fire; `autoAggressionSystem` submits an attack *intention* that drains into the same line-334 site (so auto-aggro infantry-vs-building DOES get the bonus). No leak, no miss. | CLEAN |
| — | Classification | `INFANTRY_UNITS` = militia-line + spear-line (8 units), excludes villager/archer/cavalry/siege/monk; identical membership to the `infantry` armor class. `sappersBuildingAttackBonus(WITH_SAPPERS,'villager') === 0` (test-verified). | CLEAN |
| — | Owner correctness | Reads `unit.owner` (attacker), not the building owner. | CLEAN |
| — | Armor / double-apply | Building-damage site applies no armor reduction (raw +15 as documented); bonus in exactly one additive term. | CLEAN |
| — | AI / options regression | `sappers` is Imperial-gated + `!hasTechnology` in the Blacksmith options block; appended LAST in the research list, so the AI's first-affordable-then-break loop cannot break. aiVsAi (2) + aiPlayer/aiAgeUpPriority/aiVillagerCap (28) green. | CLEAN |
| — | Exhaustiveness / 500 LOC | typecheck proves both exhaustive `Record<ResearchableTechnologyType,…>` maps + the formatters switch have `sappers`; prototypeEconomyRules held at exactly 500 (cap is `> 500`). | CLEAN |
| — | Spec/doc accuracy | spec §10.7.2 + changelog 0.1.64 + devlog agree: 400f/200g, 200t, +15, infantry-only, Blacksmith/Imperial, University divergence. | CLEAN |
| LOW | DRY (pre-existing) | `isInfantryUnit` reads `INFANTRY_UNITS` while `isSiegeUnit` reads `UNIT_ARMOR_CLASSES[...].has('siege')` — two identical infantry sources that could drift. Predates this diff; not a correctness issue. | Not blocking; left as-is (out of scope). |

## Gates (driver-verified, independent of the reviewer)
typecheck, lint, build green; fileSizeBudget green (prototypeEconomyRules 500). Tests: sappers (8), siegeWorkshop+imperialSiege+scenarioValidation+prototypeScenario.fixtures (43), castle+combatMatchups+siegeEngineers+villagerRepair (20), aiVsAi (2), aiPlayer+aiAgeUpPriority+aiVillagerCap (28) — all green.
