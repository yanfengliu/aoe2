# Phase 2D slot 21 review — `garrisonedByBuilding` migration

Iteration 1, three CLIs converged on **APPROVE on the migration mechanics**, with one HIGH from Codex requiring an immediate follow-up fix.

## Reviewers

- Codex (`gpt-5.5 xhigh`): APPROVE on migration; HIGH on hydrate-clear-before-populate; MEDIUM on missing snapshotEquivalence coverage; LOW on devlog drift; NIT pre-existing 500-LOC.
- Claude (`claude-opus-4-7[1m] max`): APPROVE — every claim verified against the live tree at commit `95a0788`. MINOR finding on the relaxed `toBeInstanceOf(Object)` assertion in the snapshotEquivalence type-instance test.
- Gemini (`gemini-3.1-pro-preview` plan-mode): APPROVE on migration, with MEDIUM on `garrisonedByBuildingCodec` itself missing from `MIGRATED_CODECS`.

## Findings (severity-tagged)

- **HIGH (correctness — Codex)** — `hydrateFromSavedGame` populates the codec-backed `garrisonedByBuilding` and `garrisonedUnitToBuilding` maps via `accessor.mutate(codec, m => m.set(id, ...))` WITHOUT first clearing them. World.deserialize had already restored `world.state.aoe2.*` from the worldSnapshot half of the save; if `sideMaps.garrisonedByBuilding` is partially missing, the worldSnapshot leftover entries silently survive — masking the cross-reference invariant that's supposed to fire on load-time corruption. **Fix shipped in slot-24's commit:** added `m.clear()` before each populate loop. Comment explains the reasoning + scheduled removal in Phase 2F (when sideMaps go away).
- **MEDIUM (test coverage — Codex+Gemini)** — `snapshotEquivalence.test.ts` was missing `garrisonedByBuildingCodec` from `MIGRATED_CODECS`. **Fix shipped in slot-22's commit** (the new codecs added together with `garrisonedUnitToBuildingCodec`, `garrisonedUnitVisionSourcesCodec`, `productionQueuesCodec`).
- **MINOR (test specificity — Claude)** — `tests/replay/snapshotEquivalence.test.ts` third test changed `toBeInstanceOf(Map)` → `toBeInstanceOf(Object)` to accommodate `marketExchangeRatesCodec`'s record-shaped value, but the relaxation made the assertion trivially true (passes for any non-null object). **Fix shipped in slot-24's commit:** split into RECORD_CODECS set vs Map default; assert `value instanceof Map` for Map codecs and structural-not-null for the record codec. Test description updated to match.
- **LOW (doc drift — Codex)** — Detailed devlog (`docs/devlog/detailed/2026-05-02_2026-05-02.md`) lists 15 slots remaining as of slot 20, but `summary.md` shows 21+/35. Disposition: addressed in slot-24's consolidated devlog update covering slots 21–24.
- **NIT (pre-existing) — `wireBridgeOps.ts` is 562 LOC**, over the 500-LOC hard limit; slot 21 added one line to it. Already on the file-split queue. Not a slot-21 blocker.
- **OPTIMIZATION (Claude)** — `entityDestroyOps.destroyBuildingEntity` triggers N+1 `accessor.mutate` calls when destroying a building with N garrisoned units (each per-unit destroy + final explicit delete). O(N²) in filter cost (same shape as pre-migration). Not a regression; Claude flagged a one-line improvement (`accessor.mutate(...).delete(id)` BEFORE the destroyUnitEntity loop, then no per-unit garrison cleanup is needed). Recorded as a follow-up perf note; not addressed in slot 24 to keep the diff focused on the migration + HIGH fix.

## Verified by reviewers (no findings)

1. `entityDestroyOps.destroyUnitEntity` — single `accessor.mutate` wraps filter+set+delete; correct empty-vs-nonempty branching.
2. `entityDestroyOps.destroyBuildingEntity` — iteration uses captured array reference (stable for-of); explicit final delete is defensive (covers corrupted-state edge case where unit lacks reverse mapping).
3. `hydrateFromSavedGame` cross-reference invariant runs BEFORE pruning, so corrupt-cross-ref saves throw loudly (now even MORE strict thanks to the clear-before-populate fix).
4. Value-side prune correctly handles delete vs set branching; iterating a Map while mutating current key is well-defined.
5. `trainingMarketOps.garrisonBuilding` both branches verified — the cached array reference is the same between get and mutate within a tick (per accessor cache semantics).
6. `trainingMarketOps.ungarrisonBuilding` — snapshot read + accessor.mutate wrap of the final set/delete branch.
7. `towerCombatSystem` — read-only `accessor.get(garrisonedByBuildingCodec).get(id)` per tick.
8. Save format compatibility preserved (saveSchema.ts:171 unchanged).
9. Cellpassability + wireBridgeOps wiring clean; bridgeState field + initializer dropped.

## Final disposition

- **Slot 21** (`95a0788`): ships as-is on the original commit.
- **Slot 22** (`9b73978`): bundles MIGRATED_CODECS extension to include `garrisonedByBuildingCodec`.
- **Slot 23** (`ae7d389`): clean migration, no review fixes bundled.
- **Slot 24** (productionQueues, current commit): bundles HIGH hydrate-clear fix + MINOR test-specificity fix + slot 22's MIGRATED_CODECS extension to include `garrisonedUnitToBuildingCodec`, `garrisonedUnitVisionSourcesCodec`, and `productionQueuesCodec`.
