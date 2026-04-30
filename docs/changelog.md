# Changelog

User-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins with no observable effect are recorded in `docs/devlog/` instead.

## 0.1.5 — 2026-04-29

### Added

- **In-game annotation UI (Spec 2 v0.1.5 capture-only).** Press **Alt+M** to open an annotation form: enter a note, pick severity (info/warning/bug/blocker), pick category (pathfinding/combat/economy/ai/ui/perf/general), optionally tick "Capture screenshot" — save fires a marker into the live `SessionRecorder` bundle. Selection at the moment of Alt+M becomes the marker's `MarkerRefs.entities` (with engine `EntityRef.generation` preserved); empty selection falls back to a `tickRange` covering the current tick. Press **Alt+L** to toggle the bottom-right `MarkerListPanel` listing the current session's markers (tick desc) plus a collapsible "Prior Sessions" section for crash recovery — Export downloads a self-contained JSON bundle (sidecar attachments re-embedded as base64 dataUrls), Discard removes the IDB record. Hotkeys are suppressed while a text input has focus.
- **Persistent recording mirror in IndexedDB.** Every session is mirrored into IDB through `RecordingService` over `MemorySink({ allowSidecar: true })` — refresh / crash leaves the partial bundle accessible from the next launch's "Prior Sessions" list. `start()` always begins a fresh session; prior sessions are read-only inspectable but never extended (per ADR 1, mid-session continuation would corrupt bundle invariants). Schema-mismatched sessions are listed but not exportable (forward-compat policy). On Safari private mode / quota exhaustion, the mirror is permanently disabled and the live `MemorySink` continues — `RecordingService.exportBundle()` still works for the current session.
- **Bridge additive surfaces** (`src/game/simulation/createSimulationBridge.ts`):
  - `bridge.world: World` — read-only getter for the engine instance (used by `RecordingService` and the annotation surface).
  - `bridge.setPaused(paused: boolean): void` — manual pause toggle (gated AFTER `flushOutOfBandRenderChange` so render projections continue while paused; the existing `haltState` carrier is unchanged so `getHudState().engineHalted` continues to reflect failure-halt only).
  - `bridge.getSelectedEntityRefs(): readonly EntityRef[]` — selection refs with generation, prune-on-read for stale refs.
  - `bridge.select(refs): void` — public select-from-refs entry; filters stale refs through `getCurrentEntityId`.
- **HUD `loadGame` is async.** `HudBridge.loadGame: (blob: SaveBlob) => Promise<void>` (was `void`) so the load path can await the new `RecordingService.start()` for the rebuilt simulation. The Load button is disabled while the rebuild is in flight; success / failure surface as toasts.

### Engine dependency

- Bumps `civ-engine` from v0.8.10 to **v0.8.11** for the new `AgentDriverContext.addMarker / attach` methods (Spec 9.1) — agents that drive aoe2 via `runAgentPlaytest` can now emit markers in flight from `decide(ctx)`. Default agent sink also flips to `MemorySink({ allowSidecar: true })` so agent screenshots > 64 KiB don't terminate the recorder. `AgentPlaytestResult.source` is exposed so default-sink callers can `result.source.readSidecar(id)` to recover sidecar bytes.

### Validation

- New tests: `tests/recording/IndexedDBMirror.test.ts` (20), `tests/recording/RecordingService.test.ts` (17), `tests/recording/AnnotationController.test.ts` (9), `tests/control/PauseControl.test.ts` (4), `tests/control/HotkeyRegistry.test.ts` (10), `tests/annotations/markerSchema.test.ts` (10), `tests/annotations/selectionToRefs.test.ts` (4), `tests/annotations/captureScreenshot.test.ts` (3), `tests/annotation-ui/AnnotationForm.test.ts` (11), `tests/annotation-ui/MarkerListPanel.test.ts` (13), `tests/simulation/bridge-additive-surfaces.test.ts` (10), `tests/vite-alias-smoke.test.ts` (2). 113 new tests; targeted suites run clean. Multi-CLI code review iter-1 (Codex `gpt-5.5` xhigh + Claude `opus-4-7[1m]` max — Gemini removed from the toolchain mid-iter, see `b93cf2b`) found 3 MAJORs (mirror open-failure handling, IDB metadata finalization, listSessions endTick from row count) + minors; all addressed inline before the implementation review's iter-2 / final review. Final FR-1 review covers the full diff.

### Open follow-ups (deferred from v0.1.5 per scope)

- Replay scrubber + TimelinePanel (deferred to v0.1.6 per ADR 4 — needs aoe2 bridge-snapshot support first).
- Vitest integration suite (AO-12.5) consolidating cross-component flows that today rely on per-component unit tests.
- Playwright e2e + visual diff baselines (AO-13) — deferred until the headless browser test environment is set up to capture canvas snapshots.

## 0.1.4 — 2026-04-26

### Fixed

- **Building HP now ramps from low at placement toward full as construction progresses (canonical AoE2).** Previously a freshly placed foundation spawned at full max HP, then completion was a no-op on the health bar. The foundation now starts at ~10% of max HP and gains `(maxHp − startHp) / totalBuildTicks` per construction tick, finishing at full HP if no damage was taken. Damage taken during construction is preserved as an offset rather than healed at completion: if combat chips a House foundation down to 5/75 at 95% built (where the undamaged ramp would put it at ~71/75), the remaining 5% of construction ticks still add HP additively, so it finishes at ~9/75 (5 plus the ~4 HP earned from those last 6 ticks of construction) — damaged, but not at the formula's full curve. A partially built building you don't defend stays visibly damaged after completion until repaired. Affects every constructable building (House, Mill, Barracks, Castle, Wonder, …); doesn't apply to scenario-seeded `isComplete: true` buildings.
- **Idle-military auto-aggression now pursues enemy foundations (canonical AoE2).** Foundations under construction now have damageable HP, so the auto-aggression target-finder no longer skips incomplete buildings. An idle Knight standing next to an enemy Barracks foundation will engage it instead of ignoring it. (Companion to the HP-ramp fix above; flagged by the multi-CLI review iter-1.)
- **Selection-panel HP display floors fractional foundation HP.** The per-tick HP increment is fractional (e.g. `+0.567` for a House), which would surface as `41.857142857 / 75` in the selection panel. The panel now floors `currentHp` for display while leaving the bridge value raw so the health-bar fill ratio stays smooth.

## 0.1.3 — 2026-04-26

### Fixed

- **Engine tick failures no longer crash the RAF loop.** `civ-engine` has been fail-fast since v0.4.0: any tick failure throws `WorldTickFailureError` from `world.step()`. The bridge previously called `world.step()` raw, so the exception bubbled uncaught into the requestAnimationFrame callback, leaving the page in an undefined state. The bridge now catches `WorldTickFailureError`, logs the failure (`tick`, `phase`, `code`, `systemName`, `message`), halts further ticks for the session, and surfaces a new `HudState.engineHalted: EngineHaltDetails | null` field so the HUD / debug overlay can show that the simulation has stopped instead of silently freezing. We do **not** call `world.recover()` — fail-fast is intentional, and recovery would mask the underlying logic bug. (Closes the deferred gap from the 0.5.3 engine-migration devlog entry.)

## 0.1.2 — 2026-04-26

### Fixed

- **Save no longer disappears when browser storage is unavailable.** Clicking Save while in private browsing, with `localStorage` quota exhausted, or in a security context that blocks storage now falls back to triggering a JSON file download instead of toasting "Save failed (storage unavailable)" and silently dropping the blob. The toast text changed to "Storage unavailable; save downloaded." so the user knows where the save went. (Iter-2 V5-4.)

## 0.1.1 — 2026-04-26

### Fixed

- **Destroyed multi-cell buildings no longer leave permanent fog-memory ghosts.** When a Castle (4×4) or other multi-cell building is destroyed and only a non-anchor cell of its old footprint is in player vision, the memory entry is now correctly cleared. Previously the cleanup pass checked the anchor cell only, so any anchor in fog produced a permanent ghost. (Iter-4 V4-3.)
- **Stuck villagers preserve their drop-off retry throttle across save/load.** The 30-tick throttle (added in iter-3 V3-5 to prevent spam-replanning) is now persisted in the save blob, so a save+load mid-stuck no longer resets every previously-throttled villager to "retry every tick" until they unstuck again. (Iter-4 V4-7.)

### Performance

- **Save-load skips procedural map generation it never uses.** Loading a save no longer runs `createPrototypeScenario` for the seed (the hydration path discards it). Saves several ms per load on Black Forest seeds. (Iter-4 V4-8.)
