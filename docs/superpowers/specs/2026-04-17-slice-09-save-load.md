# Slice 9 — Save / Load round-trip

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 9).

## Goal

Serialize a complete in-flight game to JSON, and reload it such that
subsequent simulation ticks produce identical state to a run that had
never been saved. Core engine proof point from
`docs/engine-feedback/current.md`: "save and load round-tripping".

## Approach

A versioned JSON blob containing:

1. **World state** — every live ECS entity's components (position, unit,
   building, resource, unitTransform, renderable, combatState-like
   side-map content, visionSource).
2. **Bridge side-maps** — the repo owns state outside `civ-engine`
   components: `unitCommands`, `sheepMoveOrders`, `wildlifeStates`,
   `combatStates`, `constructionStates`, `productionQueues`,
   `rallyPoints`, `researchedTechnologies`, `playerAges`,
   `playerCivilizations`, `playerResources`, `population`, `wonderState`,
   `relicCountdownState`, `playerScores`, `townCenterRefs`,
   `buildingCombatStates`, `monkTasks`, `conversionState`,
   `relicsInMonastery`, `buildingHealthStates`, `garrisonedByBuilding`,
   `lastSeenStatic` (per-player fog memory). Anything else held in the
   `createWorld` closure.
3. **Visibility** — the per-player visible / explored cell bitmap.
4. **Tick counter** — current world tick.
5. **Match state** — outcome, countdown values, score.
6. **Schema version** — integer. Bumping breaks old saves; the loader
   accepts only the matching version.

## API

- `bridge.saveGame(): SaveBlob` — returns a JSON-serializable object.
- `createSimulationBridge(seed: string, options?: { savedGame?: SaveBlob })`
  — optional second arg re-hydrates from a save.
- `const blob = bridge.saveGame(); const bridge2 =
  createSimulationBridge(seed, { savedGame: blob });` produces a
  functionally identical simulation.

## Non-goals

- Cross-version loading. Mismatched `schema` → throw.
- Client-managed file I/O — HUD button writes to `localStorage` and a
  downloaded `.json` file; game loading prompts the user to paste or
  upload.
- Partial saves / checkpoints. Whole-world only.

## Tests

New `tests/simulation/saveLoad.test.ts`:

1. **Round-trip preserves state** — run a deterministic fixture
   (`conquest-victory-fixture`) for 500 ticks, save, load into a new
   bridge, advance both by 100 more ticks, assert `getEconomyState()`,
   `getRenderState()`, and `matchState` match byte-for-byte.
2. **Countdown values preserved** — mid-Wonder-countdown save, load,
   verify countdown continues from exactly the saved tick.
3. **Relic flow preserved** — save mid-conversion, mid-gather,
   mid-movement. Reload. Advance. Confirm each mid-state resumes.
4. **Schema mismatch throws** — load blob with wrong schema → throw.
5. **Pop cap / armor / techs preserved** — every tech researched
   continues to buff units after reload.

Browser: two HUD cases:
1. Save mid-game → match still running in the same tab.
2. Save blob pasted into Load → match continues from saved point.

## Plan

### Task A: Define the blob shape

1. Create `src/game/simulation/saveSchema.ts` with the versioned
   interface(s). Only type definitions and a schema constant.
2. Commit: `Define Slice 9 save-game schema`.

### Task B: Serialization

1. Add `bridge.saveGame()` that walks every ECS entity via
   `world.query(...)` and every repo-owned side map, producing the
   blob.
2. A minimal vitest round-trip on the default seed.
3. Commit: `Serialize world and bridge state into a save blob`.

### Task C: Deserialization

1. Extend `createSimulationBridge(seed, options)` to accept
   `savedGame`. When present, after the normal scenario bootstrap,
   OVERWRITE the world by destroying every entity and rehydrating
   from the blob. Restore every side map.
2. Vitest: full round-trip with `conquest-victory-fixture`.
3. Commit: `Rehydrate world from save blob on bridge construction`.

### Task D: Mid-state coverage

1. Add vitest cases for countdown, conversion, gather, movement.
2. Commit: `Cover mid-state save/load round-trip scenarios`.

### Task E: HUD save / load buttons

1. Add Save + Load to the HUD. Save writes to `localStorage`
   (`aoe2-save-v1`) and triggers a download. Load reads from
   `localStorage` or accepts a pasted blob.
2. Commit: `Add HUD save / load controls`.

### Task F: Browser coverage

1. Playwright: save mid-match, refresh the page, load the blob,
   assert match resumes.
2. Commit: `Cover save / load browser flow`.

### Task G: Slice gate

1. Full four-step gate.
2. Devlog + summary.
3. Commit: `Close Slice 9 with passing gate`.
