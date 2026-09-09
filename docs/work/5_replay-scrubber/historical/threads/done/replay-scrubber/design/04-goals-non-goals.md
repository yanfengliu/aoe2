## 1. Goals and Version Split

1. **v0.1.6 shipped foundation:** bridge state lives in `world.state` (JSON-compatible array form per H3), schema-2 saves use complete world snapshots, replay worlds reconstruct from snapshots, and `ReplayController` owns live-vs-replay mode.
2. **v0.1.7 ships Phase 3C UI:** `TimelinePanel` bottom strip with marker pins, hotspot pins (from `bundleHotspots`), draggable coalesced scrubber, replay controls, tick/source readout, inert no-payload/out-of-range targets, and replay-only keyboard shortcuts.
3. **Future Phase 3D/3E:** three replay sources (current live session, IDB Prior Sessions, imported `.json` bundle file), replay-mode annotation affordances, and browser scrubber e2e.

## 2. Non-Goals (v0.1.7 Phase 3C)

- **No replay-driven authorship.** Read-only navigation; no editing or substituting commands during replay (Spec 5's `forkAt` is the engine surface for that, exposed in a future aoe2 release).
- **No multi-player replay sync.** Single-player only.
- **No reverse-step LRU cache.** "Step back 1 tick" is `replayer.openAt(currentTick - 1)`. Optimization deferred.
- **No `.aoebundle` file format.** Imported files are existing `SessionBundle` JSON.
- **No agent-driven scrubber automation.** Scrubber is the surface; future agent integrations consume it via dispatched browser actions.
- **No replay-load dialog in Phase 3C.** The timeline is wired for replay mode; user-facing bundle source selection remains Phase 3D.
