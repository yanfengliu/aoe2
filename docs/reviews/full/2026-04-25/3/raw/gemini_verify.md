Warning: True color (24-bit) support not detected. Using a terminal with true color enabled will result in a better visual experience.
This iteration-3 batch comprehensively addresses the remaining findings from the 2026-04-25 review, focusing on consistency, performance, and build hardening.

### `[V3-1 + V3-2]` Footprint Visibility (Fog Memory & Selection)
*   **Verification:** The fix correctly replaces anchor-only visibility checks with full-footprint checks in `FogMemoryOps`, `updateFogMemory`, and `getSelectableEntitiesAtCell`. This ensures large buildings (Castles, TCs) are selectable and persisted to memory even if only an edge cell is in LOS.
*   **Test Strength:** High. Added `createFogMemoryCastleEdgeFixture` and a dedicated test file `footprintVisibilityConsistency.test.ts` covering render, memory persistence, and click selection.
*   **Verdict:** `OK`.

### `[V3-3 + V3-9]` Metadata & Exhaustiveness (Unit Types + Wonder)
*   **Verification:** `isUnitType` in `GameScene.ts` now uses an `ALL_UNIT_TYPES` map constrained by `satisfies Record<UnitType, true>`. This effectively makes the whitelist exhaustive and will trigger a TS error if new units are added without updating the lookup. Wonder display names were correctly added to `displayNames.ts`.
*   **Verdict:** `OK`.

### `[V3-12]` Mutual Annihilation (Draw Outcome)
*   **Verification:** `updateWinConditions` now checks both human and enemy presence before returning. If both are wiped in the same tick, it calls `finalizeMatchEnd` with the new `'draw'` outcome. Bridge types and save schema were updated accordingly.
*   **Verdict:** `OK`.

### `[V3-13]` Default Map (Reserved Cells)
*   **Verification:** `applyStandardPlayerOpeningProcedural` now accepts `reservedCells`. `createDefaultMap` passes landmark positions (forward house, scout, relics) to this list, preventing forest clusters from spawning on top of critical buildings.
*   **Test Strength:** Strong. Added a corpus-based test in `prototypeScenario.test.ts` verifying multiple seeds never place trees on the forward house.
*   **Verdict:** `OK`.

### `[V3-14 + V3-15 + V3-16 + V3-22]` Map & Seed Polish
*   **Verification:**
    *   `seedToNumber` now uses `codePointAt(0)`, correctly hashing surrogate pairs (e.g., emoji seeds).
    *   Watch Tower Feudal-Age gate removed (matching DE).
    *   Shore fish dedupe achieved via function aliasing in `applyStandardPlayerOpening.ts`.
    *   Empty seed URL parameters (`?seed=`) now trigger a warning and fallback rather than silent default.
*   **Verdict:** `OK`.

### `[V3-7]` Monk Conversion (Vision Gate)
*   **Verification:** Added a LOS check in `updateMonkConversion`. A Monk can no longer continue a conversion if the target moves into fog/darkness for the Monk's owner.
*   **Verdict:** `OK`.

### `[V3-20 + V3-21 + V3-23]` Build & UI Hardening
*   **Verification:**
    *   `parseRange` and `parseCsv` now throw on malformed data (min > max or unclosed quotes), preventing silent build-time corruption.
    *   F2 debug toggle now ignores events originating from input/text areas.
*   **Verdict:** `OK`.

### `[V3-11 + V3-17]` HUD & API Parity
*   **Verification:** `HudController` gained a `destroy()` hook with LIFO teardown. `browserTestApi` gained `scene.syncFromBridge` in the placement preview path for parity with other getters.
*   **Verdict:** `OK`.

### `[V3-5 + V3-6]` Performance & Logic (Villager/Tech)
*   **Verification:**
    *   Stuck gatherers now throttle their re-plan attempts to every 30 ticks, reducing A* pressure.
    *   `inFlightTechByOwner` Set provides O(1) dedupe for research, replacing the O(N*M) queue scan. Correctly rebuilt during save-load.
*   **Verdict:** `OK`.

### `[V3-24]` AI Load-Balancing
*   **Verification:** `findIdleProducer` now selects the producer with the shortest queue (least loaded) rather than the first one found. Tie-breaking via ID ensures determinism.
*   **Verdict:** `OK`.

### `[V3-8]` Save-Load Integrity
*   **Verification:** Added `pruneOrphanEntityKeys` post-load. This ensures any side-map entries keyed by entities that no longer exist (ghost state) are purged immediately upon loading a blob.
*   **Verdict:** `OK`.

### `[V3-25]` BrowserTestApi (Dynamic Bridge)
*   **Verification:** The API is now installed once. It uses a thunk `() => bridge` to resolve the current bridge. `createApp` updates the local `bridge` variable on load, and the API automatically reflects the swap without re-installation.
*   **Verdict:** `OK`.

### `[V3-18 + V3-19]` Rendering Optimization
*   **Verification:**
    *   `renderFog` now memoizes on the `ProjectedFrameView` reference.
    *   `getRenderState` uses a per-tick cache keyed by `tick`, `renderStoreVersion` (for out-of-band changes), and `fogMemorySize`.
    *   Together, these eliminate the project's most significant RAF hot path (unconditional fog clearing/filling).
*   **Verdict:** `OK`.

---
**Final Verdict: ALL OK.**
The iteration-3 batch is high quality, well-tested, and addresses all remaining architectural and logic concerns from the review. No regressions found in logic or types.
