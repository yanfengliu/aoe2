## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Live game                                 │
│  ┌──────────┐  ┌─────────┐  ┌───────────────────────────┐        │
│  │ World    │←─│ Bridge  │  │ RecordingService          │        │
│  │ (engine) │→ │ (aoe2)  │  │  → IndexedDBMirror        │        │
│  └────┬─────┘  └────┬────┘  └───────────────────────────┘        │
│       │             │                                            │
│       │      ┌──────┴──────┐                                     │
│       │      │ BridgeState │ (per-tick cache; lazy materialize   │
│       │      │  Accessor   │  on read; dirty-tracked; flush at   │
│       │      └──────┬──────┘  tick-end via bridgeSnapshotSystem) │
│       │             │                                            │
│       └─bridgeSync──┘  (output-phase system, registered LAST     │
│                         in output, registered LAST in createWorld;│
│                         registration-order tiebreaker enforces it │
│                         every other system that mutates bridge)  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼ recorder snapshot at world.tick % snapshotInterval === 0
                ┌──────────────────────────┐
                │ WorldSnapshot.state.aoe2 │
                │  carries 35 Tier-1 +     │
                │  visibility + matchState │
                └─────────┬────────────────┘
                          ▼
                  SessionBundle
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Replay mode                                │
│  ┌──────────────────┐                                            │
│  │ ReplayController │← user opens replay (live bundle / IDB /    │
│  └────┬─────────────┘   file)                                    │
│       │                                                          │
│       ▼                                                          │
│  SessionReplayer.fromBundle(bundle, {                            │
│    worldFactory: (snap) => createReplayWorldOnly(snap)           │
│  })                                                              │
│       │                                                          │
│       ▼ openAt(targetTick)  → returns World only                 │
│  ┌─────────────┐                                                 │
│  │ World @ T   │                                                 │
│  └────┬────────┘                                                 │
│       │                                                          │
│       ▼ makeReplayBridge(world)                                  │
│  ┌─────────────────┐    Reads world.state.aoe2.* slots and       │
│  │ Replay Bridge   │    rebuilds Maps. Bridge structure          │
│  └────────┬────────┘    identical to live; ops same.             │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────┐   (renderer's bridge cell reassigned)              │
│  │ Renderer │                                                    │
│  └──────────┘                                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ TimelinePanel (full-width strip below canvas)              │  │
│  │  ◀ ⏸ ▶  [════●═════════]  marker pins  hotspot pins        │  │
│  │ T:N/Total                                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**File layout** (new files marked NEW; modified files marked MOD):

```
src/game/simulation/
  bridge/
    bridgeState.ts                 MOD — Tier-1 slots removed; Tier-2 stay; getter delegates to BridgeStateAccessor
    bridgeStateAccessor.ts         NEW — per-tick cache: materialize on read, dirty-track on write, flush to world.state
    bridgeStateSerialize.ts        NEW — Map ↔ Array<[K,V]> conversion + per-slot JSON shape
    bridgeSnapshotSystem.ts        NEW — output-phase, registered LAST in createWorld; ordering test enforces this
    visibilityStateSync.ts         NEW — visibility ↔ world.state.aoe2.visibility
    matchStateSync.ts              NEW — matchState ↔ world.state.aoe2.matchState
  createWorld.ts                   MOD — registers bridgeSnapshotSystem in output phase
  makeReplayBridge.ts              NEW — given a hydrated World, build a Bridge by reading world.state.aoe2.*
  hydrateFromSavedGame.ts          MOD — back-compat for schema-1 (copies legacy SaveBlob.sideMaps into world.state)
  saveSchema.ts                    MOD — bumps SAVE_SCHEMA_VERSION to 2; SaveBlob.sideMaps becomes optional
  saveGameOps.ts                   MOD — flushBridgeStateToWorld() before world.serialize() per H4-extended

src/game/replay/                   NEW directory
  ReplayController.ts              NEW — owns live ↔ replay mode toggle, scrub/step/play
  TimelinePanel.ts                 NEW — bottom-strip timeline UI
  ReplayHotkeys.ts                 NEW — Space, ←/→, Home/End, Esc, Alt+T
  drag coalescing                  IMPLEMENTED inside ReplayController + TimelinePanel; no separate module

src/ui/
  ReplayLoadDialog.ts              FUTURE Phase 3D — three-source modal
  PriorSessionsRow.ts              FUTURE Phase 3D — adds "Replay" button alongside Export/Discard

src/app/bootstrap/
  createApp.ts                     MOD — wires ReplayController + TimelinePanel into bridge cell

tests/
  replay/
    bridgeStateAccessor.test.ts    NEW — cache materialize/dirty/flush
    bridgeSnapshotSystem.test.ts   NEW — order, perf
    bridgeSnapshotPerf.test.ts     NEW — benchmark per M6
    makeReplayBridge.test.ts       NEW — hydrate from world.state
    ReplayController.test.ts       NEW
    TimelinePanel.test.ts          NEW
    replay-equivalence.test.ts     NEW — load(saveAtTickN) ≡ openAt(N)
    ReplayHotkeys.test.ts          NEW
    coalesced scrub coverage       in ReplayController.test.ts + TimelinePanel.test.ts
  integration/
    replay-scrubber.integration.test.ts  NEW
  saveLoad/
    schema1-back-compat.test.ts    NEW — legacy SaveBlob.sideMaps → world.state migration
```

## 5. API contract
