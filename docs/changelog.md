# Changelog

User-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins with no observable effect are recorded in `docs/devlog/` instead.

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
