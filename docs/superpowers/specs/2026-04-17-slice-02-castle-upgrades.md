# Slice 2 — Castle Age production-line upgrades (spec + plan)

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 2).

## Goal

Three one-shot Castle-Age upgrades that replace existing Feudal-tier units:

- **Crossbowman** — Archery Range research, upgrades Archer line.
- **Pikeman** — Barracks research, upgrades Spearman line.
- **Light Cavalry** — Stable research, upgrades Scout Cavalry line.

Each upgrade:

1. Requires the owner to be in Castle Age.
2. Is researched at the appropriate production building (research-queue item next to training options).
3. On completion, every existing owned unit of the predecessor type mutates
   into the upgraded type (HP/damage/armor/attack range updated to the new
   table values; current HP clamped to new max proportionally).
4. After completion, the predecessor unit type is no longer trainable from
   that building; the upgraded type takes its slot (new units spawn with
   upgraded stats).

Follows the established `Fletching` pattern: research shows in the building's
command panel, applies to both existing and future units, stored in
`researchedTechnologies` per owner.

## Where in the code

- `src/game/simulation/createSimulationBridge.ts`
  - `ResearchableTechnologyType` enum extension: add `crossbowman-upgrade`,
    `pikeman-upgrade`, `light-cavalry-upgrade`.
  - Research-time registration per building type: extend the function that
    exposes research options for Archery Range / Barracks / Stable. Find the
    `getResearchOptions` helper (currently returns things like
    `['fletching']`).
  - Research completion handler: mirror the existing `Fletching` completion
    that applies to all existing archers and seeds future trained archers
    with the boost. The new path replaces `unit.unitType` from
    `'archer' → 'crossbowman'`, `'spearman' → 'pikeman'`,
    `'scout' → 'light-cavalry'`.
  - Train-menu eligibility: when the upgrade is researched, `getTrainOptions`
    for that producer returns the upgraded unit type instead of the
    predecessor. Existing code already reads `hasTechnology(owner, tech)`.
  - Combat bonus rows: retained — anti-cavalry for Pikeman (same as Spearman
    scaled up), nothing new for Crossbow (just stats).
- `src/game/simulation/types.ts` — add the new unit types to `UnitType` and
  the new techs to `ResearchableTechnologyType`.
- `design/stats/units.csv` / `design/stats/technologies.csv` — confirm rows
  exist; if any are missing, add them with values derived from the AoE2
  canonical stats (HP, attack, armor, reload, move-speed). The content
  pipeline normalizes these into `generated/content/content.json`.
- `src/ui/hud/createHudController.ts` — the selection HUD already renders
  arbitrary `UnitType`; extend the `unitLabel` / `unitIcon` switch cases for
  the three new types.

## Tests

New `tests/simulation/castleUpgrades.test.ts`:

1. **Crossbowman upgrade** — train an Archer, research crossbowman-upgrade,
   assert the Archer unit's `unitType` becomes `crossbowman` and its stats
   match the new table.
2. **Pikeman upgrade** — train a Spearman, research, assert transform +
   anti-cavalry bonus still applies.
3. **Light Cavalry upgrade** — train a Scout, research, assert transform +
   larger sight radius (Light Cavalry has a canonical vision boost).
4. **Train menu swap** — after research, the Archery Range's train options
   no longer include `'archer'` and include `'crossbowman'`.
5. **Stats-derived content** — `trainableUnitType(...)` and combat-stat
   helpers return the upgraded stats after research.
6. **Does not retro-apply to enemy units** — enemy-owned archers are
   unaffected when the human researches the upgrade.

Browser test in `tests/browser/game.spec.ts`:

- Boot default seed, queue an Archer, reach Castle Age via the existing
  progression path, research Crossbowman-upgrade, advance, assert the HUD
  unit icon / selection name reads "Crossbowman".

## Plan (TDD tasks)

### Task A: Content and types

1. Extend `design/stats/technologies.csv` with rows for the three upgrades
   (name, producer, cost, research time) if not already present.
2. Verify `design/stats/units.csv` has rows for `crossbowman`, `pikeman`,
   `light-cavalry`; if any missing, add using canonical AoE2 DE values.
3. Regenerate `generated/content/content.json` via the existing
   `npm run content:build` — or ensure the `prebuild` hook is what runs it;
   do not commit the generated file (gitignored).
4. Extend `UnitType` and `ResearchableTechnologyType` in `types.ts`. Extend
   any stat-lookup switches in `createSimulationBridge.ts` that are
   exhaustive (`unitMaxHp`, `unitAttackDamage`, `unitAttackRange`,
   `unitReloadTicks`, etc.) to cover the three new types. Pull values from
   the normalized content; do not hard-code.
5. Run `npx tsc --noEmit` — expect green. Run `npx vitest run` — expect
   unchanged green.
6. Commit: `Add Castle-Age unit-type and upgrade-tech enum entries`.

### Task B: Research registration per producer

1. Find the helper that lists `getResearchOptions(producer, owner)`.
   Add the three new upgrades: Archery Range → `crossbowman-upgrade`,
   Barracks → `pikeman-upgrade`, Stable → `light-cavalry-upgrade`.
   Gate each on `getPlayerAge(owner) === 'castle'`.
2. Add the research-cost and research-time lookups mirroring Fletching.
3. Write a failing vitest case that researches the upgrade at the correct
   building in Castle Age and asserts `hasTechnology(owner, tech)` flips.
4. Implement the completion hook: for every existing unit of the
   predecessor type owned by the researcher, swap `unit.unitType` to the
   upgraded type and recompute `combatStates[id]` with the new stats
   (preserving the currentHp / maxHp ratio).
5. Run the vitest — expect green. Run full sheep + economy suites —
   expect green.
6. Commit: `Add Crossbowman / Pikeman / Light Cavalry research completion`.

### Task C: Train menu swap

1. Failing vitest: after research, `getTrainOptions(owner, producer)`
   returns the upgraded unit type and omits the predecessor.
2. Extend the train-options helper to return the upgraded type when the
   tech is researched. Mirror the existing pattern used for age-gated
   units (e.g., Skirmisher).
3. Training a new upgraded unit must spawn with the upgraded stats.
4. Run the vitest — expect green. Full vitest — expect green.
5. Commit: `Swap train menu to upgraded units once research completes`.

### Task D: HUD labels / icons

1. Extend the `unitLabel` and `unitIcon` switch cases in
   `src/ui/hud/createHudController.ts` for `crossbowman`, `pikeman`,
   `light-cavalry`. Use simple two-letter icons (CB, PK, LC) and
   human-readable names.
2. No new vitest needed (pure UI mapping; the browser test below covers
   it).
3. Commit: `Render Castle-Age upgraded unit labels in the HUD`.

### Task E: Browser test

1. Add a Playwright case that reaches Castle Age in a short fixture seed
   (mirror the existing `age-up` browser path), researches the
   Crossbowman upgrade at the Archery Range, and asserts the trained
   unit is labeled "Crossbowman" in the HUD.
2. Run `npm run test:browser` — expect green.
3. Commit: `Cover Castle-Age unit upgrade in browser tests`.

### Task F: Slice gate

1. Run the full four-step gate (`npx vitest run`, `npx tsc --noEmit`,
   `npx vite build`, `npm run test:browser`).
2. Run `codex review --base <slice-start-sha>` and
   `gemini -p "review …"` in parallel. Triage findings; fix High/Medium
   as a followup commit.
3. Append a devlog entry under
   `docs/devlog/detailed/2026-04-17_2026-04-17.md` and update
   `docs/devlog/summary.md`.

## Out of scope for this slice

- Civ-specific unique-unit tech gating (Slice 6 Castle).
- Imperial tier final upgrades (Slice 7 — Arbalest, Halberdier, Hussar).
- Elite Skirmisher upgrade (Castle tier for Skirmisher line — we're only
  doing the three main lines in this slice; Elite Skirm can ride with
  Slice 7 Imperial).
- Combat bonus adjustments beyond what predecessor units already have.
