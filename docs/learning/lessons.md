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

## Architecture-wide gates don't fire under affected-tests-only iteration — 2026-06-09

| Field | Value |
|---|---|
| Surfaced by | Full-suite run for the 2026-06-09 doc-housekeeping commit (`docs/devlog/detailed/2026-06-09_2026-06-09.md`) — `fileSizeBudget.test.ts` red at HEAD 860557e |
| Reviewer findings | n/a — process lesson (surfaced by running gates, not a reviewer) |
| Fix commit | `5a14832` — legacy pin `'tests/playtest/llmRunner.test.ts': 692` |
| Test added | n/a — the detector already existed (`tests/architecture/fileSizeBudget.test.ts`); the gap was process, not coverage |
| Behavior delta | `npm test` was red at HEAD for a month: f2df6ce (Phase-6.C.1, 2026-05-09) grew `llmRunner.test.ts` to 692 LOC > 500 hard limit with no exemption, and that commit plus 860557e shipped while devlog entries recorded "full gates pass." Post-fix the suite is green with the violation pinned and ratcheting downward. |

Context: Phase-6.C.1 grew `tests/playtest/llmRunner.test.ts` past the 500-LOC hard limit. The session iterated with affected-tests-only runs (per the AGENTS.md iteration rule), and the architecture suite never re-fired — `fileSizeBudget.test.ts` responds to the size of every file under `src/` + `tests/`, so it is "affected" by any commit that adds lines anywhere, a dependency no import- or path-based test-selection heuristic catches.

Lesson: cross-cutting architecture gates (file-size budgets, dependency rules, naming audits) are affected by EVERY change, so an iteration shortcut that runs only behavior-adjacent tests must still include `tests/architecture/`. And a "full gates pass" claim is only valid for the tree state at the moment the suite ran — any edit after that run, including test-only line growth, invalidates the claim. Run the full suite once more after the LAST edit, not just after the last interesting one.

Pointer: [tests/architecture/fileSizeBudget.test.ts](../../tests/architecture/fileSizeBudget.test.ts) legacy-pin comment; devlog [2026-06-09](../devlog/detailed/2026-06-09_2026-06-09.md).

## Codex review extraction must skip the prompt-echo — 2026-05-02

| Field | Value |
|---|---|
| Surfaced by | User-driven post-mortem after I claimed "Codex unreachable" across 8 multi-CLI reviews (impls 16–24 of `docs/threads/done/replay-scrubber/`). User: "Did all your code and docs get reviewed?" → "Then you can't claim that upgrading codex was the fix" |
| Reviewer findings | n/a — process lesson |
| Fix commit | (this commit) — AGENTS.md extraction snippet |
| Test added | n/a — process lesson |
| Behavior delta | Pre-fix: across impls 16–24, 8 multi-CLI reviews recorded "Codex unreachable" in the synthesis. In reality, Codex emitted real HIGH/MAJOR findings (same-tick over-push bypass of queue cap; alias-mutation in shallow codecs; visibility staleness post-bootstrap) that I missed because the awk extraction matched the FIRST `===BEGIN-REVIEW===` marker in the file — which sits inside the prompt-echo, not the actual review. The shipped commits carry these unaddressed bugs. |

Context: `codex exec --ephemeral` echoes its full stdin (prompt + diff + source-file reads) into the output before printing the actual review. When the prompt itself contains the literal string `===BEGIN-REVIEW===` (because we instruct Codex to bracket its review with that marker), `awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'` matches the prompt's restatement of the marker as instructions, captures the prompt's body as if it were the review, and stops at the prompt's restatement of `===END-REVIEW===`. The actual review — Codex's real findings — sits at the END of the file, after a `^codex$` header line that delimits the prompt-echo from the response.

Lesson: when extracting structured output from a tool that echoes its input (Codex `exec`, any tool with `--ephemeral`-style stdin transcription), anchor the extraction on a tool-emitted marker that does NOT appear in the prompt. For Codex specifically, slice from `^codex$` first, then awk the BEGIN/END pair from that suffix:

```bash
sed -n '/^codex$/,$p' codex.txt | awk '/===BEGIN-REVIEW===/{p=1; next} /===END-REVIEW===/{exit} p'
```

A successful smoke test (e.g. `codex exec` returning `ok`) does NOT validate the extraction logic — it only validates the tool. Always sanity-check by counting reviewer findings against expectations: if Gemini found 4 issues and Claude found 6, "Codex no findings" three commits in a row should raise a flag, not be assumed to mean Codex is unreachable. Convergence is signal; persistent divergence between reviewers is also signal.

Pointer: [AGENTS.md](../../AGENTS.md) — Code review section's Codex extraction snippet; affected reviews under `docs/threads/done/replay-scrubber/2026-05-01/impl-{16..24}/REVIEW.md` (post-mortem note added).

## Reorder AI decisions when handler-FIFO order matters — 2026-05-01

| Field | Value |
|---|---|
| Surfaced by | `docs/threads/done/replay-scrubber/2026-05-01/impl-16/REVIEW.md`; debug trace at `docs/debugging/2026-05-01-phase-1c-ai-intention-refactor.md` |
| Reviewer findings | n/a — surfaced during Phase 1C self-debug before review |
| Fix commit | (Phase 1C commit on `main`) |
| Test added | `tests/simulation/aiPlayer.test.ts > "preserves baseline barracks-rush behavior: AI builds a Barracks and trains Militia on ai-rush-fixture"` (existing test that broke under the naive refactor) |
| Behavior delta | Pre-fix: post-1C AI never trained militia within 3000-tick budget on `ai-rush-fixture` because the +1-tick handler delay shifted barracks-completion out of alignment with the corner-case tick where pre-1B's villager gate accidentally blocked food spend. Post-fix: militia trains at tick ~480 (210 ticks training time after the militia push at tick 270 — same training pacing as pre-1B). |

Context: when synchronous AI helpers (`enqueueTraining` / `enqueueResearch` / `startConstruction`) are replaced by intention pushes that handlers apply at next tick, the AI's decision logic loses the natural same-tick stockpile feedback. Pre-1B's barracks-rush relied on a single corner-case tick (barracks-complete + tcQueue full + food preserved) that the +1-tick handler delay erased.

Lesson: when over-acceptance is intentional (B1/B2 contract: validator best-effort, handler authoritative re-check), priority must be encoded in the **push order** because the FIFO-ordered handler resolves contention in submission order. Don't try to recover synchronous semantics with reserved-resource gating — that fights the contract and creates new failure modes (the second push fails canAfford against the local reserve while the validator would have approved it). Instead, decide push priority once at design time: high-priority intentions (military for a barracks-rush AI) push first; subsequent intentions over-spend on paper but the handler picks the affordable subset and the surplus silently no-ops. If a second AI strategy ever exists (e.g., booming), condition the push order on plan kind rather than reverting to reservations.

Pointer: [src/game/simulation/bridge/systems/aiSystem.ts](../../src/game/simulation/bridge/systems/aiSystem.ts) — `pickUnitMix` block ordered before villager training; KAD-0005 in [docs/architecture/decisions.md](../architecture/decisions.md).

## Test-timeout margin under full-suite parallelism — 2026-05-01

| Field | Value |
|---|---|
| Surfaced by | Phase 1C full-suite run; one timeout in `tests/simulation/createSimulationBridge.ageUp.test.ts > "can research Feudal Age, build an Archery Range, and train an Archer"` |
| Reviewer findings | n/a — surfaced during validation gate, not review |
| Fix commit | (Phase 1C commit on `main`) — bumped 3 ageUp test timeouts 40_000 → 60_000 |
| Test added | n/a — process lesson; the existing test was the symptom |
| Behavior delta | Pre-fix: the test passed in isolation (33 s) and pre-1C in the full suite (just barely fit under 40 s with parallel-worker contention). Post-1C: still 32 s in isolation, but full-suite parallelism on Windows pushed past the 40 s ceiling. Post-fix: 60 s ceiling absorbs the FU8 RPC-flake variance. |

Context: vitest workers on Windows have a known birpc round-trip flake (FU8, documented in `vitest.config.ts`) that bites only under the cumulative load of a long-running full-suite run. A test that just barely fits its per-test timeout in isolation will flake the moment any change shifts cumulative duration even slightly.

Lesson: a test that passes in isolation but fails under full-suite parallelism is not a flake to ignore — the per-test timeout has insufficient margin against the FU8 RPC-flake variance. Cross-check pre-change duration in isolation against the timeout ceiling; if the margin is less than ~20%, bump the timeout proactively (or optimize the per-tick cost) rather than committing and letting the next change push it over. The `vitest.config.ts` FU8 comment already acknowledges Windows-specific RPC flakes; per-test timeouts should be set assuming that load, not isolation timing.

Pointer: [vitest.config.ts](../../vitest.config.ts) — FU8 explanation; [tests/simulation/createSimulationBridge.ageUp.test.ts](../../tests/simulation/createSimulationBridge.ageUp.test.ts) — bumped per-test timeouts.

## Villager gather state is on GathererComponent, not unitCommands - 2026-04-23
Context: adding an "activity" label ("Gathering wood", "Returning food") to the selection panel, the first draft read `unitCommands.get(id)` expecting a `move` command carrying `targetEntityKind === 'resource'`.
Lesson: `issueUnitGatherCommand` clears `unitCommands` and writes `GathererComponent.task` directly (`'to-resource' | 'gathering' | 'to-dropoff'`). `unitCommands` never holds gather state in normal play, and `UnitCommand.targetEntityKind === 'resource'` is only produced by attack commands against wildlife. Any sim-side feature that wants to know "what is this villager doing right now" must consult `GathererComponent` alongside (and often instead of) `unitCommands`.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) (`computeUnitActivity`), [tests/simulation/selectionActivity.test.ts](../../tests/simulation/selectionActivity.test.ts).

## HUD display names belong on the UI side, not in the bridge - 2026-04-23
Context: the first cut of the activity feature added a local kebab-to-Title-Case helper (`formatEntityNameForActivity`) inside the simulation bridge to avoid a bridge→ui import. Codex review then caught visible label drift: `scout` rendered as `Scout` instead of `Scout Cavalry`, upgrade techs rendered as `Man At Arms Upgrade` instead of `Man-at-Arms`.
Lesson: the bridge should emit identifiers (`'scout'`, `'forging'`, kind/type pairs), not human-readable strings. `src/ui/hud/displayNames.ts` is the single source of truth for human names. When the temptation is to reach across the layer for `formatEntityName`, the right move is instead to surface a structured payload through `SelectionState` and let the renderer format. This keeps the one-way sim→UI boundary and avoids silent label drift.
Pointer: [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts) (`computeUnitActivity`), [src/ui/hud/selectionPanel.ts](../../src/ui/hud/selectionPanel.ts) (`formatActivityLabel`).

## Occupancy bindings should separate blockers from crowding - 2026-04-23
Context: migrating the simulation bridge from hand-rolled placement/path scans onto `civ-engine`'s `OccupancyBinding`.
Lesson: in this game, buildings/resources/terrain are whole-cell blockers for movement, but unit presence is only crowding: it blocks building placement while still allowing unit pathing through the coarse cell. Do not collapse those rules into one flat `isBlocked` check when wiring engine occupancy into the bridge, or units will accidentally become hard path blockers.
Pointer: [src/game/simulation/worldOccupancy.ts](../../src/game/simulation/worldOccupancy.ts), [src/game/simulation/createSimulationBridge.ts](../../src/game/simulation/createSimulationBridge.ts), [tests/simulation/worldOccupancy.test.ts](../../tests/simulation/worldOccupancy.test.ts).

## `fontFamily` alone does not prove a webfont loaded - 2026-04-23
Context: adding a shipped HUD font initially used a browser test that only checked `getComputedStyle(...).fontFamily`.
Lesson: computed `fontFamily` only reflects the declared cascade, not whether the bundled face actually loaded. If a UI contract depends on a shipped webfont, wait for `document.fonts.ready` and assert `document.fonts.check(...)` for the weights you rely on, otherwise a broken font import can silently fall back while the test still passes.
Pointer: [tests/browser/game-hud-and-camera.spec.ts](../../tests/browser/game-hud-and-camera.spec.ts), [docs/devlog/detailed/2026-04-23_2026-04-23.md](../devlog/detailed/2026-04-23_2026-04-23.md).

## Windowed edge-pan tests need explicit monitor metrics - 2026-04-23
Context: changing hover-at-edge panning to require fullscreen exposed a browser-test trap on Playwright's default headless Chromium setup.
Lesson: do not assume a browser test viewport is "windowed." In this repo's headless Playwright environment, `window.outerWidth/outerHeight` and `screen.width/height` default to the same values, so fullscreen-window heuristics will look true unless the test overrides monitor metrics before boot. If a camera/input contract depends on fullscreen-vs-windowed state, lock it with explicit monitor emulation plus a real fullscreen transition.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/browser/helpers/gameTestHelpers.ts](../../tests/browser/helpers/gameTestHelpers.ts), [tests/browser/game-hud-and-camera.spec.ts](../../tests/browser/game-hud-and-camera.spec.ts).

## Topmost hit tests must follow draw order - 2026-04-23
Context: precise unit-click geometry still felt wrong on close overlaps because the final same-layer tiebreak was using array index in the wrong direction.
Lesson: in this Phaser scene, `displayedEntities` are drawn in array order, so later entries are visually on top. Any hit-test fallback that uses array index as a render-order proxy must prefer the highest index, or exact clicks will still select the underneath entity when units overlap tightly.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts).

## Exact-click stack cycling needs its own click-cell memory - 2026-04-22
Context: fixing precise unit selection uncovered a subtle overlap bug where the first exact click on a stacked unit could jump to the next target just because that unit was already selected from a different gesture.
Lesson: if left-click selection can cycle overlapping hits, remember the last exact click cell separately from the current selection. Key the cycle off a repeated click in the same click cell, and let that cycle win over same-cell double-click promotion, or stacked selections become inconsistent after drag-boxes, tile clicks, or prior exact clicks elsewhere on the same unit.
Pointer: [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

## Selection geometry must stay shared end-to-end - 2026-04-22
Context: tightening unit click precision exposed two opposite failure modes at once: padded hit circles made close units impossible to click cleanly, while splitting click and marquee logic across different geometry/filter rules made preview highlights disagree with the final selection.
Lesson: keep one exact rendered-body contract for left-click hit tests, marquee intersection, and live marquee preview, then run the final preview ids back through the same bridge-side selectability filter used on mouse-up. If selection needs an extra tie-breaker like "human-owned first," keep that policy scoped to selection only so generic context-command targeting does not inherit it.
Pointer: [src/phaser/scenes/entityHitTest.ts](../../src/phaser/scenes/entityHitTest.ts), [src/phaser/scenes/GameScene.ts](../../src/phaser/scenes/GameScene.ts), [tests/phaser/entityHitTest.test.ts](../../tests/phaser/entityHitTest.test.ts), [tests/browser/game-selection.spec.ts](../../tests/browser/game-selection.spec.ts).

## Keep rule-table extractions behavior-preserving - 2026-04-22
Context: splitting the simulation bridge's inline economy/building/unit rule tables into dedicated modules made it tempting to also "fix" a few AoE2-stat inconsistencies while the data was in one place.
Lesson: if the user asked for cleanup or refactoring, extract the current mechanics first and lock them with gameplay-facing tests. Treat any balance, tech-propagation, or combat-table correction as a separate explicit gameplay change, even when the underlying data clearly wants improvement.
Pointer: [docs/devlog/detailed/2026-04-22_2026-04-22.md](../devlog/detailed/2026-04-22_2026-04-22.md); [tests/simulation/prototypeRules.test.ts](../../tests/simulation/prototypeRules.test.ts).

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
