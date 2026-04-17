## Prior work
2026-04-10 - Initialized project: created baseline AoE2 spec (`design/aoe2-game-spec.md`), devlog files, research sources. Iterated spec through AoC baseline → DE target → single-player AI skirmish scope. Split sources into `design/sources/` folder. `design/stats/*.csv` established as content source of truth.

## Current
2026-04-17 - Player can now command claimed sheep. Drag-box selects herds alongside units; one right-click moves the whole group at half villager speed; ownership is sticky once claimed (sheep can't be stolen by enemy units in range). Sheep also render with subgrid interpolation now (the projector previously required `unit && unitTransform`; sheep have only the latter). Full gate: `84` Vitest, `58` Playwright, `tsc`, `vite build`.
2026-04-17 - Preserved the game canvas aspect ratio with 5:3 letterboxing and made minimap clicks center the camera exactly on the clicked world position. Fixed a pre-existing edge-pan drift where `activePointer` defaulting to `(0, 0)` triggered NW scrolling before the cursor had entered the canvas. Full gate: `76` Vitest, `57` Playwright, `tsc`, `vite build`.
2026-04-17 - Reorganized `docs/` to match the current AGENTS.md. Moved the devlog summary to `docs/devlog/summary.md`, split the detailed devlog at the 2026-04-11/2026-04-12 boundary into date-ranged files under `docs/devlog/detailed/`, and created the previously missing `docs/architecture/`, `docs/debugging/`, and `docs/learning/` scaffolding. Doc-only change; no tests were affected.
2026-04-13 - Aligned the minimap viewport rectangle with Phaser's rendered camera `worldView`, so the rectangle now matches the actually visible area in narrower windows. Browser minimap helpers were tightened to use the same draw-area math as the HUD, and the full gate passes with `76` Vitest tests plus `56` Playwright browser tests.

## 2026-04-12 (consolidated)
- World/AI: expanded default map to `60x36` with enemies farther out for minimap travel range; baseline AI rush refined; civ-engine `0.3.0` upgrade with explicit system ordering; trapped-spawn prevention.
- Combat & wildlife: full wildlife combat for boars and wolves (health, attack, auto-aggro for wolves, retaliation for boars); exact-entity right-click combat against rendered targets.
- Movement & rendering: sub-grid unit movement with smooth interpolation; units can share coarse cells via sub-cell slots; building footprints centralized; construction vs completion visuals; entity health bars.
- Resources & buildings: sheep herdable ownership claimed by nearby player units; depleted resource nodes removed from world; shoreline fish as water food; blocker-aware placement and movement; minimap navigation with viewport rectangle.
- HUD: trimmed top status bar to player-facing chips (`food/wood/gold/stone/age/pop/time`); selection panel finalized with name/icon/health/attack/armor/faction/civ/inventory; Town Center age-up commands stay visible before prerequisites; RTS-style middle-mouse + edge panning.
- Docs: AGENTS.md and CLAUDE.md rewritten as a single shorter instruction set.

## 2026-04-11 (consolidated)
- Player-commanded Dark Age loop: TC and villager selection, villager queueing, House placement, population cap from completed construction, explicit gather context orders, Mill/Lumber/Mining drop-off routing.
- Combat ramp: Barracks + Militia production, melee combat, conquest victory/defeat outcomes with deterministic seeds, baseline AI Barracks rush.
- Feudal Age slice: progression research, Archery Range + Archers, Blacksmith + Fletching, Stable + Scouts, Spearman + Skirmisher counters, Watch Tower static defense, Market with dynamic exchange rates, generic rally points, defensive garrison + arrow fire.
- Castle Age slice: progression research, Knights from Stable, additional Town Centers.
- UX: drag-box multi-selection with marquee, double-click same-type selection, stacked-tile cycling, building placement preview feedback, percent-complete queues, hidden running-state footer.
- Engine integration: `EntityRef` semantics for long-lived selection/command targets, generalized building-target combat, Playwright browser tests + repo-wide `verify` command.

## 2026-04-10 (consolidated)
- Bootstrap: TypeScript + Vite + Phaser 3 + civ-engine prototype, normalized content pipeline writing `generated/content/content.json`, content validation eliminates warning budget (`18` supported civs, `12` unsupported flagged explicitly).
- Content & docs: spec finalized; `design/implementation-plan.md` sequencing playable milestones; root `AGENTS.md` mirroring `CLAUDE.md`; expanded README with run/verify commands.
- First gameplay loop: Phase 2 map slice with deterministic starts (sheep/boar/berries/gold/stone), fog of war via `VisibilityMap`, minimap from render frame; Dark Age economy loop with villager gather + return + stockpile updates.
