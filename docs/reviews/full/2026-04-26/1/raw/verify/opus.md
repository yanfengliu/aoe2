```
# Iter-4 verification

## Per-finding verdict

| ID | Verdict | Notes (only if NEEDS-CHANGE) |
|----|---------|-----|
| V4-1 | OK | |
| V4-2 | OK | |
| V4-3 | OK | |
| V4-4 | OK | |
| V4-5 | OK | |
| V4-6 | OK | |
| V4-7 | OK | Test weak (orphan-key prune drops the injected fakeId so populated round-trip not end-to-end verified) but schema/save/load/prune all wired. Acceptable. |
| V4-8 | OK | Single `scenario` use site in `wireBridgeOps.ts:196` correctly guarded. |
| V4-9 | OK | |
| V4-10 | OK | |
| V4-12 | OK | |
| V4-13 | OK | |
| V4-14 | OK | All 4 consumers (`bridgeState.ts`, `monkTaskAppliers.ts`, `monkBehaviorSystem.ts`, `registerAllSystems.ts`) consistent on `Map<number, number>`. |
| V4-15 | OK | |
| V4-16 | OK | `enqueueRejection` removed from `WirePostSeedDeps` interface (line 59 area), `isAiMilitaryUnit` removed from `RegisterAllSystemsDeps`. `cellPassability` markers explicitly out of scope per claim. |
| V4-17 | OK | |
| V4-18 | OK | |
| V4-19 | NEEDS-CHANGE (minor) | `src/game/simulation/bridge/wirePostSeedOps.ts:59` — `setUnitCommand: (id, command: import('../createSimulationBridge').UnitCommand)` still pulls `UnitCommand` from the facade. Functionally fine (facade re-exports), but defeats V4-19's stated goal of "six bridge children no longer reach back to facade for shared types." One-line fix: replace with `import('./sharedTypes').UnitCommand`. |
| V4-21 | OK | |
| V4-23 | OK | |

## New defects found in this diff

- **V4-19 partial miss** — see verdict above. Single straggler import. Land as a follow-up nit.
- **V4-7 test scope** — `tests/simulation/saveLoad.test.ts:259-261` injects `fakeId = 999_999`, then asserts post-load `gathererDropOffStuckSinceTick === []` because the V3-8 orphan prune deletes unknown ids. Schema presence is proven; semantic preservation of a *real* throttled gatherer across save+load isn't. Not a regression vs the rest of the file, just a weak assertion.
- **V4-3 fixture vision math is generous but fine** — Castle anchor (15,13), 4×4. Scout (20,16) r=4 covers footprint cells (16,16), (17,16), (18,16), (18,15), (18,14) but not (15,13). Ram (16,17) r=1 covers (16,16). Both confirm the contract: anchor in fog, footprint partly visible. Pre-fix anchor-only check returns false; post-fix footprint check returns true. Sound.

## Anti-regression spot-checks

- **V3-1 fog-memory write/select footprint** — OK. `fogMemorySystem.ts:44` still calls `isFootprintVisible` on the write side; line 113 now extends it to the delete side (V4-3).
- **V3-7 monk LOS gate** — OK. `monkTaskAppliers.ts:127-132` retains the `isVisibleToOwner` interrupt that preserves in-flight progress without incrementing.
- **V3-12 conquest draw outcome** — OK. `conquestOutcomeSystem.ts:45-51` still computes both predicates first, then routes mutual annihilation → `'draw'`.

Other spot checks: `wireBridgeOps.ts` has only one `scenario` consumer (line 196) and it's guarded; all 10 ops factory return interfaces (`PlayerQueries`, `AiDecisionOps`, etc.) exist as named exports so the V4-1 type tightening compiles cleanly.

## Overall verdict

**LAND**. 17 of 18 fixes clean. V4-19 partial miss is a one-line import path that doesn't affect runtime — defer to next batch or roll into a cleanup commit. Anti-regression intact across V3-1/V3-7/V3-12.
