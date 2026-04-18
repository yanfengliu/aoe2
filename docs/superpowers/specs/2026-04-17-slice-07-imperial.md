# Slice 7 — Imperial Age progression and final-tier units

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 7).

## Goal

Unlock Imperial Age and ship the final tier of upgrades and siege units
for the existing production lines. Extends the Feudal → Castle progression
pattern with a third age plus its unit-line upgrades and Imperial-tier
siege units.

## Scope

### Imperial Age progression

- `'imperial-age'` research at the Town Center, requires two Castle-Age
  buildings completed (mirrors Feudal → Castle gate).
- On completion: `playerAges.set(owner, 'imperial-age')` and unlocks every
  Imperial-only tech and unit below.

### Unit-line upgrades (one-shot, like Slice 2)

- **Arbalest** — Archery Range, upgrades Crossbowman line. +1 attack,
  same range. Fletching continues to apply.
- **Halberdier** — Barracks, upgrades Pikeman line. +anti-cavalry bonus
  scaling, +HP.
- **Hussar** — Stable, upgrades Light Cavalry line. +HP, +vision.
- **Heavy Cavalry Archer** — Archery Range, upgrades Cavalry Archer.
- **Cavalier** — Stable, upgrades Knight. +HP, +attack. Further upgrade
  to Paladin deferred to a later slice if we decide to ship it.
- **Champion** — Barracks, upgrades existing Militia line
  (Man-at-Arms → Long Swordsman → Two-Handed → Champion). For v1,
  simplify to "Champion upgrade transforms Militia directly into
  Champion" unless the intermediate upgrades are easy adds.
- **Elite Longbowman** — Castle (Britons), upgrades Longbowman. Applies
  only when owner civ is Britons.

### New Imperial-tier siege

- **Onager** — Siege Workshop, upgrades Mangonel. Keeps simplified
  single-target + infantry-bonus damage model for now. +damage, +range.
- **Siege Ram / Capped Ram** — Siege Workshop, upgrades Battering Ram
  (pick whichever is data-backed first).
- **Heavy Scorpion** — Siege Workshop, upgrades Scorpion.
- **Bombard Cannon** — new Siege Workshop unit (Imperial only, no
  upgrade predecessor). Long range, slow reload, heavy bonus vs
  buildings.
- **Trebuchet** — new Castle unit (Imperial only). Very long range siege,
  packing/unpacking behavior simplified to "fires in place; no pack
  behavior in v1". Flag as follow-up.

### Imperial Blacksmith upgrades (Castle-tier + Imperial-tier)

Only if the existing Blacksmith code has Feudal Fletching. Add one per
category, mirroring Fletching:

- **Bodkin Arrow** (Castle) — archer-line +1 attack / +1 range (Bodkin
  stacks on Fletching or supersedes depending on AoE2 rules; use
  stacks for simpler implementation).
- **Bracer** (Imperial) — archer-line +1 attack / +1 range.
- **Forging** / **Iron Casting** / **Blast Furnace** — melee +1/+1/+2
  attack per tier. Apply to Knight / Militia / Pikeman / etc.
  (Infantry + Cavalry share attack upgrade arcs in AoE2; apply to
  both for v1.)
- **Scale Mail Armor / Chain Mail Armor / Plate Mail Armor** — infantry
  armor.
- **Scale Barding / Chain Barding / Plate Barding** — cavalry armor.

If existing Blacksmith research registration is elaborate, prioritize
shipping Bracer + Blast Furnace + Plate Mail + Plate Barding (the
Imperial-only tier) and flag the Feudal/Castle additions as follow-ups.

### Out of scope

- Scout → Light Cav → Hussar via intermediate upgrade only; we already
  ship Light Cav in Slice 2, Hussar in this slice. No extra intermediate.
- Paladin (Cavalier's Imperial upgrade). Flag as follow-up.
- Imperial Camel / Heavy Camel. Follow-up.
- Elite variants of non-Longbowman civ unique units — out of scope for
  v1 since Longbowman is the only unique we ship right now.
- Chemistry (late Imperial Blacksmith unlock that enables Bombard + Hand
  Cannoneer etc.). Treat as implicit; Bombard Cannon + Trebuchet are
  gated on Imperial Age only.

## Where in the code

- `src/game/simulation/types.ts` — add new age `'imperial-age'` to
  `AgeType`; add `'imperial-age'` to `ResearchableTechnologyType`; add
  new unit types: `'arbalest' | 'halberdier' | 'hussar' | 'heavy-cavalry-archer'
  | 'cavalier' | 'champion' | 'elite-longbowman' | 'onager' | 'heavy-scorpion'
  | 'siege-ram' | 'bombard-cannon' | 'trebuchet'`. Also new tech types
  for each upgrade.
- `createSimulationBridge.ts`:
  - Extend age-up research at TC: Imperial Age option when Castle Age
    researched and two Castle-Age buildings complete.
  - Apply Imperial Age in `applyTechnology`.
  - Extend `getTrainOptions` for each producer with Imperial-tier units.
  - Extend `getResearchOptions` for Archery Range / Barracks / Stable /
    Castle / Siege Workshop with the relevant Imperial upgrades.
  - Reuse `upgradeOwnedUnits` pattern from Slice 2 for each upgrade.
  - Stat switches cover all new unit types.
- `src/ui/hud/createHudController.ts` — labels + icons for every new
  type.
- `design/stats/*.csv` — verify rows; if missing, add canonical values.

## Tests

New `tests/simulation/imperialAge.test.ts`:

1. **Imperial Age research requires Castle + 2 Castle-Age buildings.**
2. **Arbalest upgrades Crossbowman.** Existing Crossbowman mutates;
   new trained unit is Arbalest; Fletching stack preserved.
3. **Halberdier upgrades Pikeman.**
4. **Hussar upgrades Light Cavalry with vision bump.**
5. **Heavy Cavalry Archer upgrades Cavalry Archer.**
6. **Cavalier upgrades Knight.**
7. **Champion upgrades Militia.**
8. **Elite Longbowman** gated on Britons owner.
9. **Onager / Heavy Scorpion / Siege Ram** upgrade siege.
10. **Bombard Cannon + Trebuchet** trainable only in Imperial.
11. **Imperial Blacksmith techs apply** (spot-check at least one per
    archer/melee/cavalry-armor chain).

Browser: age up to Imperial in a short fixture; train an Arbalest; assert
HUD labels.

## Plan (TDD tasks)

### Task A: Age + tech + unit type plumbing

1. Add new types / unions. Extend all exhaustive switches (stat tables,
   HUD, isArcherLineUnit). Extend age-progression to accept Imperial.
2. Commit: `Add Imperial Age, final-tier unit types, and tech registration`.

### Task B: Unit-line upgrades

1. TDD per upgrade (one vitest case each) — reuse `upgradeOwnedUnits`.
2. Commit per upgrade (or bundled if the diffs are trivial): each one a
   small commit in the Arbalest / Halberdier / Hussar / Heavy Cav Archer
   / Cavalier / Champion / Elite Longbowman chain.

### Task C: New Imperial siege

1. Add Onager / Heavy Scorpion / Siege Ram upgrades from Siege Workshop.
2. Add Bombard Cannon and Trebuchet as Imperial-only new units.
3. Commits: `Add Imperial siege upgrades (Onager, Heavy Scorpion, Siege Ram)`;
   `Add Bombard Cannon and Trebuchet Imperial siege units`.

### Task D: Blacksmith Imperial tier

1. Bracer / Blast Furnace / Plate Mail / Plate Barding techs at the
   Blacksmith, apply to owned units plus newly trained ones.
2. Reuse the Fletching pattern for each.
3. Commit per tech or bundled: `Add Imperial Blacksmith upgrade chain`.

### Task E: Imperial Age progression

1. TC research option appears in Castle Age when two Castle-Age buildings
   are completed.
2. Commit: `Make Imperial Age researchable at the Town Center`.

### Task F: Browser coverage

1. Age up through Castle → Imperial in a short fixture; train an
   Arbalest; assert HUD.
2. Commit: `Cover Imperial Age progression and Arbalest training in browser tests`.

### Task G: Slice gate

1. Full four-step gate.
2. Devlog entry + summary update.
3. Commit: `Close Slice 7 with passing gate`.
