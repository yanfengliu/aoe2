You are a senior code reviewer auditing the aoe2 prototype repository. Today is 2026-04-26. This is iteration 1 of today's full-codebase review.

# Context

This is an Age of Empires II prototype (~35 kLOC TypeScript, 218 source files) built on top of `civ-engine` (an in-house ECS deterministic game engine). Stack: TypeScript + Vite + Phaser 3 + civ-engine.

## Yesterday's three reviews already addressed these clusters

Read `docs/reviews/full/2026-04-25/1/REVIEW.md`, `2/REVIEW.md`, and `3/REVIEW.md` before flagging anything to avoid re-flagging fixed items. Yesterday's iter-3 had 26 findings across V3-1..V3-26 — most are now fixed and verified.

Items deliberately deferred from yesterday (do NOT re-flag unless you find a new angle):
- `C-2` save-load enum validation framework
- `H-2` wider save/load round-trip coverage
- `H-4` `getRenderState` cache (partial fix landed; full sweep deferred)
- `N-1` `createSimulationBridge.ts` size (mostly resolved today — see below)

## Today's primary scope: 42 commits of bridge refactoring

`createSimulationBridge.ts` was a 7,606-line god-file at start of today; it is now **332 lines** (96% reduction). The shrink happened in two phases:

- **Phase 4** (28 commits): extracted 18 ECS systems to `src/game/simulation/bridge/systems/*` (`aiSystem.ts`, `autoAggressionSystem.ts`, `conquestOutcomeSystem.ts`, `fogMemorySystem.ts`, `herdableMovementSystem.ts`, `herdableOwnershipSystem.ts`, `monkBehaviorSystem.ts`, `playerCommandsSystem.ts`, `productionQueueSystem.ts`, `relicCountdownSystem.ts`, `relicGoldSystem.ts`, `scoutMovementSystem.ts`, `towerCombatSystem.ts`, `villagerEconomySystem.ts`, `visibilitySystem.ts`, `wildlifeCombatSystem.ts`, `winConditionResolverSystem.ts`, `wonderCountdownSystem.ts`) plus 9 helper-ops modules under `src/game/simulation/bridge/`: `optionsRules.ts`, `selectionStateOps.ts`, `movementPlanOps.ts`, `entityCreateOps.ts`, `entityDestroyOps.ts`, `playerQueries.ts`, training/market/construction/garrison ops, `combatStateFactory.ts`, plus 4 shared-shape modules.
- **Phase 5** (14 commits): extracted 9 more ops modules (`humanInputOps.ts` ~190 LOC, `selectionInputOps.ts` ~430 LOC, `unitCommandOps.ts` ~250 LOC, `cellPassability.ts` ~110 LOC, `visibilityQueries.ts` ~70 LOC, `transformOps.ts` ~190 LOC, `debugSnapshotOps.ts` ~60 LOC, `economyStateOps.ts` ~120 LOC) plus restructuring: `createWorld` moved to `bridge/createWorld.ts`, side-map state hoisted to `bridge/bridgeState.ts`, `wireBridgeOps` + `assembleBridgeApi` extracted, render-state assembly extracted to `bridge/renderStateOps.ts`, scenario seed + save-load hydration extracted to `bridge/scenarioSeedOps.ts` + `bridge/hydrateFromSavedGame.ts`, all 18 ECS system registrations bundled into `registerAllSystems`, `registerBridgeSystems` extracted, `wirePostSeedOps` extracted, AI-side monk task search split from appliers (`bridge/monkAiSearchHelpers.ts` + `bridge/monkTaskAppliers.ts`), spatial finders extracted to `bridge/selectionFinders.ts`.

There was one **revert + restore** sequence at the end (commits `c73649b` reverted `9818df8`, then `4cbc1bf` restored it after determining the revert was a false positive) — verify the current `wirePostSeedOps` extraction is correct.

Other notable today changes:
- `src/phaser/scenes/GameScene.ts`: extracted `buildingRenderer.ts` (5 private building methods, ~160 LOC moved). Scene shrank 1176 → 1034 lines.
- `vitest.config.ts`: switched `pool: 'forks'` from singleFork to `maxForks: 4` (3.3x speedup).
- `AGENTS.md`: refined clean code guidelines (file size limit added).

## Architecture invariants to enforce

Per `docs/architecture/ARCHITECTURE.md`:
- DOM HUD → Phaser → Simulation bridge → civ-engine World (one-way data flow + commands flow back)
- Side-map ownership stays in `createWorld` (now `bridge/createWorld.ts`) — bridge ops modules are dep-bag factories closing over those side maps
- `civ-engine` owns authoritative state; bridge owns repo-specific systems and scenario setup
- Phaser is view + input only; no gameplay state in scenes
- HUD is a pure consumer
- Determinism: seeds + commands + fixed-step ticks are the only sources of state change

# Your task

Review the entire workspace for:
1. **Correctness bugs** — race conditions, broken contracts, save-load round-trip failures, off-by-ones
2. **Design flaws** — boundary violations, leaky abstractions, broken invariants, god-classes
3. **Refactor leaks from today's 42 commits** — silently-changed behavior, double-imports, dead exports, orphaned helpers, broken closure-capture, missing dep-bag fields
4. **Efficiency** — quadratic loops, per-frame allocations, missing caches, unnecessary work
5. **Memory leaks** — un-disposed listeners, unbounded growth in side maps, RAF loops without cancel
6. **Tests** — missing coverage for the shrink, weak assertions, brittle fixtures
7. **Doc drift** — stale signatures, removed APIs still mentioned, missing coverage of new APIs in canonical guides (`docs/api-reference.md`, `docs/guides/*`, `README.md`, `docs/architecture/ARCHITECTURE.md`)
8. **Cleanliness** — duplicated logic, dead code, magic numbers, file size violations (>500 LOC ideal, >1000 LOC strict)
9. **AoE2 authenticity** — gameplay rules vs canonical AoE2 (where the prototype claims canonical behavior)

Give special attention to the bridge refactor: check that nothing was silently broken across 42 move-only-claimed commits. In particular:
- Does every extracted module receive every dependency it actually uses (no closure-captured-from-outer-scope leaks that survived the move)?
- Are side maps still owned in exactly one place? Are reads/writes still consistent between `createWorld` and the ops modules that close over them?
- Did any helper-ops module diverge from its caller's contract?
- Is the new `bridge/registerAllSystems.ts` registering systems in the same order they were registered before? (Determinism is order-sensitive.)
- Are there any silent `as any` / `// @ts-ignore` / unsafe casts introduced during the move?
- Did the `wirePostSeedOps` revert + restore introduce any subtle breakage?

Also check:
- The current state of `createSimulationBridge.ts` (332 LOC) — is it a clean facade now? Or is there still duplication / dead code that the move missed?
- The new `bridge/createWorld.ts` size (probably 100-200 LOC after the extractions) — is it readable?
- Any of the 18 system files in `bridge/systems/*` that look mis-extracted (e.g., system that should be 2 systems, or system whose dependencies are over-broad)?
- File size: any files now over 500 LOC that should be split? Any over 1000 LOC?
- Architecture doc + drift-log: do they reflect the current `bridge/` topology after Phase 5?

# Constraints

- **Do NOT modify files.** Read-only exploration. (You may run `git diff`, `git log`, `git show` to understand history.)
- **Do NOT propose patches.** Findings + explanations + fix shape (one sentence) only.
- **Severity-tag every finding**: CRITICAL / HIGH / MEDIUM / LOW.
- **Cite files with absolute path + line numbers**, e.g., `src/game/simulation/bridge/createWorld.ts:42-58`.
- **Group findings by severity.** Within each severity, give each finding a unique ID like `V4-1`, `V4-2`, ... .
- For each finding: ID, severity, theme (correctness/efficiency/design/tests/docs/cleanliness/aoe2-authenticity), where (file:line), finding (1-3 sentences), fix shape (one sentence).
- Skip items already documented as deferred or fixed in iter-1/2/3 unless you find a new angle.

# Output format

```
# Review

## Critical

### [V4-1] Title
- **Theme:** correctness
- **Where:** path/to/file.ts:lines
- **Finding:** ...
- **Fix shape:** ...

## High

...

## Medium

...

## Low / Nit

...

## Verified-not-bugs

(things you investigated but determined are not bugs, with brief justification)

## Notes on today's bridge refactor

(your overall assessment of whether the 42-commit shrink looks safe)
```

Begin your review now.
