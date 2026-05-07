## Implementation phases (preview; full plan in PLAN.md)

1. **Phase A — Bridge-state migration** (~3 weeks per L1): refactor 35 Tier-1 + Tier-3 slots to read/write through `BridgeStateAccessor`. Add `bridgeSnapshotSystem` (output, last). Update `saveGame()` to flush before serialize. Update `hydrateFromSavedGame` for schema-1 → world.state migration. Round-trip equivalence test + perf benchmark.
2. **Phase B — `createReplayWorldOnly` + `makeReplayBridge`** (~3 days): factory + bridge-construction helper. Tests against live World.
3. **Phase C — `ReplayController`** (~3 days): mode toggling, bridge swapping, scrub/step/play logic with frame-coalescing. Unit tests.
4. **Phase D — `TimelinePanel`** (~3 days): bottom-strip UI, marker/hotspot pins, drag scrubber, keyboard shortcuts. Browser tests.
5. **Future Phase 3D — `ReplayLoadDialog`** (~2 days): three-source modal, IDB integration, file import.
6. **Future Phase 3E — Integration + docs** (~3 days): full workflow tests, schema-1 back-compat tests, changelog, devlog, guide updates.

Total: ~4 weeks of focused work. Detailed step-by-step in PLAN.md.
