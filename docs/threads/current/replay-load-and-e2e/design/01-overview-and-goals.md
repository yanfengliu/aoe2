# Overview and Goals

## What this thread ships

Six versioned slices on `main`, each landing as a single coherent commit with multi-CLI review per AGENTS.md:

| Slice | Version | Scope |
|---|---|---|
| 1 | 0.1.8 | Replay-mode annotation affordances: Alt+M disabled while replaying; MarkerListPanel binds to the replay bundle's markers in replay mode and hides Export/Discard. Marker row click scrubs to the marker's tick. |
| 2 | 0.1.9 | Load current live session as replay: HUD entry point that grabs the in-progress `RecordingService.bundle()` and enters replay via `replayController.enterReplay`. |
| 3 | 0.1.10 | Prior Sessions Row "Replay" button: alongside Export/Discard, a Replay action that reconstructs the bundle from `IndexedDBMirror` and enters replay. |
| 4 | 0.1.11 | File import: a file-picker that parses an exported bundle JSON and enters replay. Validates structurally and toasts a clear error on bad input. |
| 5 | 0.1.12 | `ReplayLoadDialog` modal: HUD-mounted dialog that unifies the three sources under one entry point, with a clear default source per state (live recording present? prior session selected? file dropped?). |
| 6 | 0.1.13 | Phase 3E browser e2e + vitest+jsdom integration: end-to-end Playwright spec for the dialog flow plus integration test that covers the controller↔bundle↔panel handoff. |

## Inherited from v0.1.7 (do NOT rebuild)

- `ReplayController` — full surface in `src/game/replay/ReplayController.ts`. `enterReplay(bundle, atTick?)` is the single entry point every slice converges on.
- `TimelinePanel` — bottom-strip UI is wired and visible whenever replay mode is active.
- `ReplayHotkeys` — Space, ArrowLeft/Right, Home/End, Escape, Alt+T are bound only in replay mode.
- `createReplayWorldOnly`, `makeReplayBridge`, `replayWorldContext` — replay-world construction is solid.
- `RecordingService.bundle()`, `listPriorSessions()`, `exportPriorSession()` — live-recording surface is feature-complete for slice 2 and reusable for slice 3.
- `IndexedDBMirror.reconstructBundle(sessionId)` — the IDB→bundle materialization slice 3 calls into.

## Out of scope for this thread

- Replay-mode reverse-step LRU cache (deferred per `09-adrs.md` ADR §11).
- Counterfactual replay (Spec 5 `forkAt`) — engine-side surface; revisited only when a follow-up thread requests it.
- Reconnecting the live recorder to its own world while replay holds the bridge — see Open Question in the parent DESIGN.md.
- Annotation creation in replay (Alt+M is disabled, not redirected); the "annotate the replay" affordance is a separate UX problem.
- Mobile-specific replay-load UX. The dialog is desktop-first; mobile is a follow-up only if user feedback requests it.

## Closure criterion

A slice is "done" when:

1. Implementation lands on `main` with green gates (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`).
2. Multi-CLI review iteration converges to nits (Codex + Claude when reachable; Gemini fallback only if both are quota-blocked).
3. `docs/devlog/detailed/<latest>.md` and `docs/devlog/summary.md` are updated; for user-visible slices `docs/changelog.md` records the new version and `package.json` is bumped.
4. The slice's iteration directory under `docs/threads/current/replay-load-and-e2e/<date>/<iteration>/REVIEW.md` carries the synthesized reviewer findings.

The thread itself is "done" after slice 6 closes; at that point `git mv` it to `docs/threads/done/replay-load-and-e2e/`.
