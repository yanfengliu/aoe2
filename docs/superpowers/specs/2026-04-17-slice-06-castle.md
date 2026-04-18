# Slice 6 — Castle (defensive structure + civ unique units)

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 6).

## Goal

Add the **Castle** — a large defensive structure that:

1. Is placeable by villagers in Castle Age (large footprint, stone cost).
2. Auto-fires on visible enemy entities within range (reuses the existing
   Watch Tower / garrisoned-TC defensive-fire loop at scaled damage).
3. Has a larger garrison capacity than the Town Center.
4. Is the production seat for civilization-specific **unique units**. For v1,
   ship **one** fully-backed civ's unique unit so the plumbing is
   validated: **Britons → Longbowman**.

## Stats (AoE2 DE canonical)

- **Castle:** HP 4800, 4×4 footprint, cost 650 stone, requires Castle Age.
  Vision 11. Fires an arrow every 2 seconds; base damage 11 pierce (scaled
  like a strong ranged tower). Attack range 8. Garrison capacity 20
  (vs. Town Center's ~10). Units inside gain the same garrison protection
  as Town Center garrison. Garrisoned archers fire extra arrows
  (canonical AoE2 behavior) — out of scope for v1; flag as follow-up.
- **Longbowman (Britons unique):** HP 35, attack 6 pierce, range 6 (Castle
  Age), reload 2s, vision 7. Cost: 35 food, 40 gold. Trains at Castle
  when the owner's civ is Britons. Elite Longbowman comes in Slice 7
  (Imperial).

## Where in the code

- `src/game/simulation/types.ts` — add `'castle'` to building unions,
  `'longbowman'` to `UnitType`.
- `src/game/content/buildingFootprints.ts` (or wherever footprints live)
  — add the 4×4 Castle entry.
- `src/game/simulation/createSimulationBridge.ts`
  - Stat switches: HP, attack, range, reload, vision, cost for Castle +
    Longbowman. `isArcherLineUnit` should include Longbowman so Fletching
    extends to it.
  - `getBuildOptions(owner, 'villager')`: include `'castle'` at Castle
    Age.
  - `getTrainOptions(owner, 'castle')`: include `'longbowman'` only when
    the owner's civilization is Britons. (There is a civ lookup already
    for age progression; reuse or extend.)
  - Castle defensive fire: mirror `prototypeTowerCombat` / garrisoned-TC
    attack logic. Either extend that system or add a new
    `prototypeCastleCombat` that scans owned Castles and picks a target
    per the existing priority scheme.
  - Garrison capacity: if `garrisonCapacity(buildingType)` is an exhaustive
    helper, bump Castle to 20. Otherwise introduce it.
  - `targetPriority`: Castle itself (as a target) should be a LOW priority
    target for enemies — it's huge and hard to take down. Siege and
    villager targeting may differ; follow existing logic.
- `src/ui/hud/createHudController.ts` — labels and icons:
  `'castle' → 'Castle' / 'Ct'` (avoid collision), `'longbowman' → 'Longbowman' / 'LB'`.
- `design/stats/units.csv` and `design/stats/buildings.csv` — ensure rows
  exist.

## Civilization gating for Longbowman

Current civ state lives in `playerCivilizations: Map<owner, civId>`. For
v1, have the default prototype scenario assign Britons to player 1 — OR
introduce a new `castle-unique-fixture` that sets both players to
Britons for the test. Do not break the default `aoe2-prototype` seed's
civ assignment if it already exists; the cleanest path is a new fixture.

## Tests

New `tests/simulation/castle.test.ts`:

1. **Castle placeable in Castle Age** — `getBuildOptions(owner, 'villager')`
   includes `'castle'` at Castle Age; not at Feudal.
2. **Castle train options gated by civ** — Castle under Britons owner
   returns `['longbowman']`; Castle under non-Britons owner returns `[]`.
3. **Castle defensive fire** — place an enemy unit next to a completed
   Castle; advance ticks; assert the enemy's HP decreases.
4. **Longbowman ranged combat** — trained Longbowman attacks a target
   at range 6; damage lands.
5. **Fletching extends to Longbowman** — research Fletching, train a
   Longbowman, assert +1/+1 buff.
6. **Castle garrison capacity** — garrison 15 units into a Castle;
   `getGarrisonCount` reports 15 (should succeed; TC caps at ~10).

Browser test: Castle-Age fixture, place a Castle, train a Longbowman
(Britons civ), assert HUD label reads "Longbowman".

## Plan (TDD tasks)

### Task A: Content + types

1. `'castle'` in building unions, `'longbowman'` in `UnitType`. Footprint
   4×4. Stat switches filled in.
2. HUD labels / icons added.
3. Commit: `Add Castle building and Longbowman unit types + stats`.

### Task B: Villager placement and train gating

1. Castle placeable at Castle Age by villagers.
2. Castle train-options returns `'longbowman'` iff owner's civ is Britons.
3. Vitest for both.
4. Commit: `Gate Castle placement to Castle Age and Longbowman to Britons`.

### Task C: Castle defensive fire

1. Failing vitest: enemy unit next to completed Castle loses HP over time.
2. Implement by extending / mirroring existing tower combat logic.
3. Commit: `Add Castle defensive auto-fire against visible enemies`.

### Task D: Longbowman combat + Fletching

1. Failing vitest: Longbowman damages target at range 6; Fletching adds
   +1/+1.
2. Implementation: `isArcherLineUnit` extended; stat tables used.
3. Commit: `Cover Longbowman ranged combat and Fletching application`.

### Task E: Garrison capacity

1. Failing vitest: 15 units can garrison a Castle; exceeds the TC's
   normal capacity. (If current garrison state keys off a hard-coded
   cap on all buildings, introduce `garrisonCapacity(buildingType)`.)
2. Commit: `Set Castle garrison capacity to 20`.

### Task F: Browser coverage

1. Playwright: Britons fixture, build a Castle, train a Longbowman,
   assert HUD.
2. Commit: `Cover Castle construction and Longbowman training in browser tests`.

### Task G: Slice gate

1. Full four-step gate.
2. Devlog entry + summary update.
3. Commit: `Close Slice 6 with passing gate`.

## Out of scope for this slice

- Elite Longbowman upgrade (Imperial tier — Slice 7).
- Other civs' unique units (Franks / Throwing Axeman, Celts / Woad Raider,
  etc.) — pattern is identical, just add data + civ gate later.
- Garrisoned-archer-extra-arrows from Castle (canonical AoE2 "defending
  archer in Castle fires two arrows" behavior). Flag as follow-up.
- Wonder (Slice 8).
- Blacksmith Castle-Age attack/armor upgrades — belong in Slice 7 with
  the Imperial Blacksmith tier.
