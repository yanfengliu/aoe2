Iteration-3 review written to `docs/reviews/full/2026-04-25/3/REVIEW.md`. Key findings:

**Verification of iter-2 fixes:** All 5 land correctly. V2-1 OK (codex misread parameter shadowing again), H2-1 OK, H2-2 OK with caveats (test too loose, retry path wasteful), H2-3 OK, M2-1 OK with caveats (two sibling sites still anchor-only).

**Top 5 issues:**
1. **V3-1 + V3-2 (high)** — M2-1 fix didn't sweep `prototypeFogMemory` (`createSimulationBridge.ts:5919-5926`) and the building click-selection hit-test (`:2660-2670`). Both still use anchor-only visibility for buildings while the projector uses `isFootprintVisible`. Player-visible: a partially-visible enemy Castle is rendered, can be auto-aggro'd, but cannot be clicked or written to fog memory.
2. **V3-3 (medium)** — H2-2 retry runs `findNearestDropOffBuilding` + A* every tick for every stuck villager.
3. **V3-4 (medium)** — H2-2 regression test doesn't directly assert carry survived; both its assertions would pass under a regression that zeroed the carry.
4. **V3-7 + V3-10 (medium)** — Save load: most side-map loaders don't validate that entity-id keys resolve via `world.getEntityRef`. Iter-1 H-3 closed this gap for garrisons only; the same defensive check is needed for `monkTasks`, `wildlifeStates`, `combatStates`, `productionQueues`, etc.
5. **V3-6 (medium, game design)** — Monk conversion has no LOS / vision interrupt; gated only on Manhattan distance ≤ 4. Canonical AoE2 uses true LOS and a vision-loss interrupt.

**Process notes:** External CLI runs degraded — codex re-emitted iter-2 verification context (same `getSeed` parameter-shadowing misread twice in a row), Gemini crashed with SSL error, Claude CLI produced 0 bytes. Iter-3 effectively had only one independent reviewer. Renaming the `createWorld` parameter from `seed` to `effectiveSeed` would eliminate the recurring codex confusion.
