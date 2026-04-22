# Lessons learned

Append durable engineering lessons here. Each entry should teach a future agent
something that is not obvious from the current code — a trap, a non-obvious
invariant, or a rule that keeps biting if ignored. One entry per lesson, newest
at the top. Keep entries short; link to code or devlog rather than restating.

Format:

```
## <short title> — YYYY-MM-DD
Context: when this came up.
Lesson: the durable rule or trap, phrased so it transfers to future work.
Pointer: devlog entry, file, or test that illustrates it.
```

---

## Owned sheep need a real `visionSource` to peel fog — 2026-04-22
Context: adding "claimed sheep reveal terrain as they move" looked like an ownership/tint tweak at first, but the fog system never consults resource ownership directly.
Lesson: in this sim, visibility only updates from ECS entities that have both `position` and `visionSource`. If a movable resource is supposed to scout for its owner, syncing `resource.owner` alone is insufficient — you must add or remove a `visionSource` alongside that ownership state.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) `updateSheepOwnership`, `syncSheepVisionSource`; [tests/simulation/sheepVision.test.ts](../../tests/simulation/sheepVision.test.ts).

## Move-order caches belong outside serialized commands — 2026-04-22
Context: fixing laggy selected-unit movement exposed two easy traps: caching the planned route directly on `UnitCommand` blurred the save/load boundary, and reusing a stale move route across a new right-click order made units keep following the old path.
Lesson: treat `unitCommands` as durable player intent only. Keep per-tick pathing state in a separate side map keyed by unit id, clear it whenever a command is replaced or deleted, and only reuse a cached route while the immediate next cell is still passable. That preserves save/load correctness and avoids stale-route bugs while still removing the per-tick A* churn.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) `movePathCache`, `clearUnitCommand`, `setUnitCommand`, `resolveMovePlanFromCache`; [tests/simulation/movementPathCaching.test.ts](../../tests/simulation/movementPathCaching.test.ts).

## Phaser `activePointer` stays at (0,0) when the HUD captures events — 2026-04-17
Context: Edge-pan was silently scrolling the camera NW in browser tests. Playwright drove the mouse only over the HUD minimap (which has `pointer-events: auto`), so Phaser's game-canvas input plugin never saw a `mousemove`. `activePointer.x/y` stayed at their default `(0, 0)`, which is inside the 20 px top-left edge zone — after the 500 ms hover delay, edge-pan kicked in and drifted the camera by ~16 px between the user action and the snapshot.
Lesson: Any input handler that reads `this.input.activePointer.x/y` as if it were a real cursor position must guard against the pointer never having been updated. Use `pointer.moveTime === 0` as the "no real events yet" signal — `(0, 0)` is a valid coordinate and cannot distinguish "at top-left" from "unset". Also remember: `pointer-events: auto` on any HUD element over the game canvas will hide mouse events from Phaser.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts) `getEdgePanDelta`; devlog entry 2026-04-17 on canvas aspect fix.

## Phaser `camera.worldView` is integer-rounded each frame — 2026-04-17
Context: The browser test API exposed `camera.worldView.x/y/width/height` as the visible world rectangle. With `pixelArt: true` (→ `roundPixels: true`), Phaser's `preRender` rounds `scrollX/Y` via `Math.floor` and then recomputes `worldView` using rounded math, so the reported rectangle can disagree with the non-rounded `scrollX + (width - width/zoom)/2` by up to one pixel. That was enough to fail a strict "click here, center there" minimap assertion.
Lesson: When reporting camera viewport state to code that does math on it (tests, minimap viewport overlay), compute it from the raw `scrollX/Y`, `width/height`, and `zoom` rather than reading `camera.worldView` — the latter is intended for rendering, not for precise world-space queries.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts) `getCameraState`.
