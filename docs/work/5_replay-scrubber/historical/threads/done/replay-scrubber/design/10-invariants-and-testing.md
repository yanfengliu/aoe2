## 8. Determinism / Equivalence Invariants

Core invariant: after the bridge-state refactor, **`world.serialize()` followed by `world.applySnapshot()` round-trips perfectly for all Tier-1 + Tier-3 state**. Verified by `tests/replay/replay-equivalence.test.ts`:

```
recordSession (N ticks)
  → bundle has snapshots[] at intervals
  → for each snapshot tick T:
    → live = createWorld + run to T
    → replay = createReplayWorldOnly(bundle.snapshots[i].snapshot)
    → assert: live.serialize() === replay.serialize() (modulo per-recorder fields)
```

Plus a stronger frame-by-frame invariant:
```
recordSession (N ticks)
  → for each tick T in [0, N]:
    → live = createWorld + run to T
    → replay = SessionReplayer.fromBundle(bundle).openAt(T)
    → assert: live.serialize() ≡ replay.serialize()
```

If this passes, the bridge layer reproduces deterministically from `world.state` evolution.

## 9. Testing Strategy

**Unit tests** (vitest):
- `BridgeStateAccessor` cache materialize / dirty-track / flush / reset.
- Output-phase tail order: test fixture instruments each output-phase system's `execute` (during test setup) to push its `name` onto a per-tick trace array; after running one `world.step()`, asserts the LAST TWO entries in the trace whose `phase === 'output'` are `['tier3Sync', 'bridgeSnapshot']` in that order (v9 — was single `'bridgeSnapshot'` assertion in v7-v8). CI-protected: any future output system registered after either flips the trace order and fails the test.
- `bridgeSnapshotPerf.test.ts` — benchmark per M6: assert combined flush cost (`tier3SyncSystem` + `bridgeSnapshotSystem`) stays bounded under representative load. **Two scenarios** (v9 — was Tier-1-only in v7-v8): (1) full-game-end state with all 35 Tier-1 slots populated, < 5 ms/tick; (2) 8-player late-game with full exploration (~30k explored cells/player) for `tier3SyncSystem`'s `visibility.getState()` cost — combined Tier-1 + Tier-3 + recorder sink writes < 5 ms/tick. Also verify the `VisibilityCell` dirty-bit gate skips visibility writes when the cell is not dirty (no setSource since last tick) — establishes the no-mutation idle cost is bounded.
- `bootstrapFlush.test.ts` — verify `initialSnapshot.state['aoe2.visibility']`, `aoe2.matchState`, `aoe2.bridgeMeta`, plus a sample Tier-1 slot are all populated immediately after `freshGameFlow`/`schema2Flow`/`schema1Flow` returns (i.e., BEFORE any `world.step()`). Equivalence: `replayer.openAt(startTick)` from the resulting bundle reconstructs an equivalent bridge state.
- `makeReplayBridge` rebuilds bridge from `world.state.aoe2.*` slots correctly (matches a freshly-built live bridge structurally).
- `ReplayController` mode toggling preserves live bridge / world. `play()` reuses cached `replayContext.world` across scheduled frames — calls `submitWithResult` + `world.step()` directly per simulation-tick advance, NOT `replayer.openAt(tick+1)` per frame (per ADR 10). Regression test: spy on `replayer.openAt` and assert it is not called during playback frames after initial entry.
- `TimelinePanel` renders pins for markers + hotspots; click jumps to tick.
- `ReplayHotkeys` Space toggles play/pause; arrow keys step ±1; Home/End jump to bounds; Escape exits replay; Alt+T toggles panel only while replay mode is active.
- Coalesced scrubbing mid-drag doesn't fire `openAt`; change/pointerup commits the pending tick.

**Integration tests** (vitest + jsdom):
- `replay-equivalence.test.ts` — the determinism invariant above. Runs across multiple game-run shapes (small skirmish, mid-game, late-game with monk conversions and tower combat — to exercise `conversionState` + `buildingCombatStates`).
- `replay-scrubber.integration.test.ts` — open a recorded bundle, scrub to several ticks, verify selection / HUD / canvas-state reads match expected values.
- `schema1-back-compat.test.ts` — legacy SaveBlob (schema 1) loads correctly; bridge state migrated to world.state.

**Browser tests** (Playwright):
- Press Alt+T → TimelinePanel appears
- Click a marker pin → scrubs to that tick
- Drag scrubber → placeholder shown mid-drag; commits on mouseup
- Press Space → play resumes; press again → pauses
- Press Esc → exits replay, live game resumes

