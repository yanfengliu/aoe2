# Implementation plan — replay-fog-owner

TDD; affected tests while iterating, full gates before commit.

1. **makeReplayBridge fogOwner option**: failing test in new `tests/replay/makeReplayBridge.fogOwner.test.ts` using `recordCommandReplayFixture()` (real recorded bundle): open a replay world, find an owner-2 unit standing on a cell invisible to owner 1 (probe `getReplayWorldContext(world).visibility`), assert it is absent from `getRenderState().entities` under the default bridge and present under `makeReplayBridge(world, {fogOwner: 2})`; assert fog-memory ghosts excluded for fogOwner 2 (entities all `memory !== true` / no memory merge). Implement: thread `fogOwner` through projector + renderStateOps + zeroed memory getters.
2. **ReplayController fog API**: extend `tests/replay/ReplayController.test.ts` — after `enterReplay`, `fogOwner === 1` and `fogOwnerCandidates()` sorted; `setFogOwner(2)` replaces the cell bridge with a NEW bridge (stub factory spy receives `{fogOwner: 2}`), keeps tick/mode, re-selects still-current refs; `cycleFogOwner()` wraps; invalid owner throws or no-ops (decide: throw `Error` — programmer error); `enterReplay` resets to 1. Implement in ReplayController.
3. **TimelinePanel button**: extend `tests/replay/TimelinePanel.test.ts` — renders `Fog: P1`, click calls `cycleFogOwner` and re-renders label, disabled when `fogOwnerCandidates().length < 2`. Implement (controls row, testid `timeline-fog-owner`).
4. **ReplayHotkeys Alt+F**: extend `tests/replay/ReplayHotkeys.test.ts` — Alt+F cycles in replay mode, unregistered in live. Implement.
5. Spec §15.3 replay paragraph (replaces stale "No replay system is in scope."), README fog-caveat rewrite, changelog 0.1.22 + version bump, devlog entry + summary line.
6. Full gates → multi-CLI review (Claude + Codex + Gemini) → fixes → converge → move thread to done → commit + push.
