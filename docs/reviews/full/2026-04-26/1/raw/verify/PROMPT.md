You are a senior code reviewer verifying a batch of fixes against the iter-1 review report at `docs/reviews/full/2026-04-26/1/REVIEW.md`. The fixes landed on branch `agent/review-findings-2026-04-26-iter1-batch1`. Today is 2026-04-26.

# What you're verifying

The diff (piped via stdin) addresses 18 of the 25 findings from `docs/reviews/full/2026-04-26/1/REVIEW.md`. Your job: for each addressed finding, decide OK / NEEDS-CHANGE / DOC-ONLY, and flag any new defects the fixes introduced.

Findings claimed to be addressed:
- **V4-1** drop type-erasing `as RegisterAllSystemsArg` casts; type each ops factory to its actual return interface (`PlayerQueries` / `AiDecisionOps` / etc.).
- **V4-2** fix `beginTrebuchetUnpack` / `beginTrebuchetPack` return type from boolean → void in `RegisterAllSystemsDeps`.
- **V4-3** fog-memory delete path uses `isFootprintVisible`. New fixture `fog-memory-castle-destroy-edge-fixture` + regression test in `footprintVisibilityConsistency.test.ts`. Test verified to fail pre-fix, pass post-fix.
- **V4-4 / V4-5** `ARCHITECTURE.md` `bridge/` paragraph rewritten; `drift-log.md` Phase-5 follow-up + iter-4 rows appended; `devlog/summary.md` head entry replaced.
- **V4-6** `git mv docs/devlog/detailed/2026-04-24_2026-04-25.md → 2026-04-24_2026-04-26.md` and start new `2026-04-26_2026-04-26.md` per the AGENTS.md devlog rollover convention.
- **V4-7** `gathererDropOffStuckSinceTick` added to `SaveBlob` (saveSchema field + saveGameOps write + hydrateFromSavedGame read + V3-8 orphan-key prune extension). Test in `saveLoad.test.ts`.
- **V4-8** lazy scenario gen on save-load (`createWorld.ts` skips `createPrototypeScenario` when `savedGame` is set; `wireBridgeOpsTypes.ts` accepts `PrototypeScenario | null`).
- **V4-9** `assignNearestResource` filters inline before allocating wrappers.
- **V4-10** `getHumanUnitIdsInRect` / `getHumanOwnedSheepIdsInRect` apply bbox + ownership/type checks before allocating wrappers.
- **V4-12** `aiSystem` skips `assignAiMonkTasks(owner)` when `countOwnedUnits(owner, 'monk') === 0`.
- **V4-13** `humanInputOps.issueAction` adds `default: return false;`.
- **V4-14** Monk convert per-tick guard switched from `Set<number>` to `Map<number, number>` keyed by target id, valued by tick. Consumer checks `=== activeWorld.tick`. The `.clear()` in `monkBehaviorSystem` becomes a stale-tick-prune for memory hygiene only.
- **V4-15** `transformOps.syncSpawnedEntityOccupancy` now logs unexpected occupancy errors via `console.warn`.
- **V4-16** drop `enqueueRejection` from `WirePostSeedDeps` and `isAiMilitaryUnit` from `RegisterAllSystemsDeps`. The `void` markers existed only to suppress unused-destructure lint.
- **V4-17** drop `[...unitCommands.entries()]` snapshot spread in `playerCommandsSystem`.
- **V4-18** drop dead `BuildingComponent` / `UnitComponent` re-exports + their imports from `wirePostSeedOps`.
- **V4-19** extract `bridge/sharedTypes.ts` for `UnitCommand` / `MonkTask` / `ConstructionState` / `TrebuchetPackState`. Six bridge children + `bridgeState` no longer reach back to facade for shared types. Facade re-exports them.
- **V4-21** comment update on `fogMemorySystem` resource-loop noting anchor-only is correct because every memorable resource is 1×1.
- **V4-23** `AGENTS.md` Code-review CLI examples refreshed (Gemini gains `--approval-mode plan`, Codex notes Windows PowerShell-tool block, Claude clarifies the no-diff full-codebase pattern).

Findings explicitly **deferred** (do NOT flag as missing):
- V4-11 `playerHasConquestPresence` side map (worst-case concern; current 2-player cost is acceptable).
- V4-22 versioning + `docs/changelog.md` (needs user input).
- V4-24 V3-24 carry-forward (AI behavior gap, not a refactor leak).

# Your task

For each addressed finding, give a short verdict (`OK` / `NEEDS-CHANGE` / `DOC-ONLY`). For NEEDS-CHANGE, name the specific defect (file:line if possible).

Also do a fresh sweep of the diff for new defects:
- New regressions introduced by the fixes (e.g., did the V4-1 type-tightening break a different consumer? Did V4-19 leave a circular type import?)
- Anything the iter-1 review missed that this diff makes visible.
- Anti-regression: are existing iter-1/2/3 fixes still in place? (Spot-check: V3-1 fog-memory write/select footprint, V3-7 monk LOS gate, V3-12 conquest draw outcome.)

# Constraints

- Do NOT modify files. Read-only verdicts only.
- Do NOT propose patches; just findings + explanations.
- Cite specific files + line numbers.
- Be concise — under 600 words total.

# Output format

```
# Iter-4 verification

## Per-finding verdict

| ID | Verdict | Notes (only if NEEDS-CHANGE) |
|----|---------|-----|
| V4-1 | OK | |
| V4-2 | OK | |
...

## New defects found in this diff

(or "None" — be honest)

## Anti-regression spot-checks

(per the listed iter-1/2/3 anchors, are they still in place?)

## Overall verdict

(LAND / NEEDS-CHANGE / NEEDS-DEEP-REVIEW)
```
