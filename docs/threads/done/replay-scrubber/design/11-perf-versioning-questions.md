## 10. Performance considerations (v2 — corrected)

Realistic costs (per Claude H4 + M6):

- **`bridgeSnapshotSystem` per-tick cost**: O(sum of dirty Tier-1 slot sizes for `Array.from(map)`) plus O(sum of dirty slot total JSON size for `assertJsonCompatible` traversal + `jsonFingerprint`). For a representative game-end state with 35 Tier-1 slots × 50-200 entries each × deep object structure, estimated 5-20 ms per snapshot tick at 60 TPS. **Mandatory pre-Phase B benchmark** (`bridgeSnapshotPerf.test.ts`) to confirm; if cost is prohibitive, fallbacks (in order):
  1. Batch the snapshot to every-Nth-tick instead of every tick (introduces a small replay-from-snapshot inaccuracy bound by N).
  2. Reduce `snapshotInterval` for the recorder so misses cost less to recover.
  3. Pursue engine-side `Map`/`Set` support in `setState` (would require a serializer extension; deferred).

- **`createReplayWorldOnly` cost**: full registration sequence (~10ms) plus `applySnapshot` (~5-50ms depending on game size). Acceptable for once-per-load.

- **`scrubTo(tick)` cost**: `replayer.openAt(tick)` from closest snapshot. Worst case (between snapshots, snapshotInterval=1000): up to 1000 `world.step()` calls. At ~0.5ms/step in a sim with no UI, that's ~500ms. **Mitigated for drag** by frame-coalescing (ADR 9). Click and keyboard scrubbing still pay the cost, but the user expects a brief load on those.

## 11. Optimizations deferred to future replay polish

- **Reverse-step LRU cache**: `stepBackward` is O(replay-from-snapshot); could cache state at each visited tick.
- **Adaptive snapshot interval**: dynamically increase recorder snapshot frequency for replay-friendly bundles.
- **Engine-side Map/Set in setState**: would let aoe2 skip the Array<[K,V]> dance — defer until engine team has bandwidth.

## 12. Versioning

aoe2: `0.1.5 → 0.1.6` for schema-2 save format (c-bump per H6 resolution), then `0.1.6 → 0.1.7` for the user-visible Phase 3C TimelinePanel. Rationale: with back-compat for schema-1 SaveBlobs (ADR 4), schema-2 is non-breaking from a user-visible perspective; the timeline panel is also a non-breaking additive feature. Per AGENTS.md, c-bump applies to non-breaking additive changes.

civ-engine: unchanged. No engine bump required for v0.1.6.

## 13. Open Questions

1. **Hotkey for replay toggle**: **Alt+T** (matches Alt+M / Alt+L pattern; verified unused by HotkeyRegistry).
2. **TimelinePanel placement**: full-width strip below canvas (does not overlap game).
3. **`engineHalted` state during replay**: replay world is isolated; allow replay regardless of live engineHalted.
4. **Mid-tick replay entry**: not allowed; replay only starts at tick boundaries (live bridge enforces this via `setPaused`).
5. **Annotation hotkeys disabled in replay**: Alt+M disabled; Alt+L visible but read-only (clicking a marker scrubs to its tick).
6. **Default snapshot interval for recordings that anticipate replay**: keep current default (1000); tune in a future replay-polish release if user feedback suggests.

---

