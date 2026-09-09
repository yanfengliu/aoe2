# Slice 2 — Load current live session as replay — Iter 1

**Diff base:** `81c0c1d` (slice 1).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → all four substantive findings addressed; ready for iter-2.

## Codex iter-1

### HIGH — `createApp` ReferenceError on app boot due to TDZ access (FIXED)

`createApp` constructs the HUD bridge with `isReplayCurrentSessionAvailable: () => stack.recording.bundle()` BEFORE the `let stack = await chainRebuild(...)` declaration. The HUD's `createReplayCurrentSessionButton` calls `refresh()` synchronously during construction, which reads `stack.recording.bundle()` and hits the temporal dead zone — the page never mounts.

**Fix applied:** forward-declared `let stack: AnnotationStack | undefined` near the top of `createApp`. The bridge thunks now guard with truthiness (`if (!stack) return false`) and the existing hotkey/dispose call sites use optional chaining (`stack?.X`). Reviewers (both Codex and Claude) flagged this independently.

### MEDIUM — "no payloads" predicate too permissive (FIXED)

The check `commands.length > 0 || endTick > startTick` allowed entry when there were elapsed ticks but zero recorded commands. `SessionReplayer.openAt` throws `no_replay_payloads` for any `targetTick > startTick && commands.length === 0`. The button enabled but replay was dead.

**Fix applied:** narrowed to `commands.length === 0` as the no-payloads condition. Updated the corresponding test (`returns no-payloads when bundle has elapsed ticks but no commands`) and added the `commands` field to the `error` paths' bundle so they reach `enterReplay`. Updated `design/03-load-source-current-session.md` to cite the actual replayer contract.

### LOW — Stale changelog count (FIXED before review wrote up)

Codex flagged the original `803` claim while the file had already been corrected to `810`. After the iter-1 button-helper changes added one new test, the count is now `811`.

## Claude iter-1

### BLOCKER — Same TDZ access (FIXED)

Claude independently traced the same TDZ defect with a literal node REPL repro confirming `Cannot access 'stack' before initialization`. Same fix applied.

### MEDIUM — Polling-only refresh creates 0–500ms button-state lag (FIXED)

The button only refreshed on the 500ms poll, so entering or exiting replay left the button in a stale state for up to half a second. `replayController.onModeChange` exists; using it as an immediate refresh trigger closes the gap.

**Fix applied:** `createReplayCurrentSessionButton` now accepts an optional `subscribeToModeChange(listener): unsubscribe` config field. Subscribed listener calls `refresh()` whenever fired. Created a wired `subscribeReplayModeChange` thunk on `HudBridge` that delegates to `replayController.onModeChange`. Added a regression test (`subscribeToModeChange fires refresh immediately on listener invocation`).

### MEDIUM — "Defense in depth" disabled-click guard was unreachable (FIXED)

Browsers don't dispatch native click events on disabled buttons, so the previous `if (button.disabled) return;` was dead code. Claude's better suggestion: re-evaluate disabled state at click time so a stale-but-just-flipped-disabled state is rechecked at the moment of the click.

**Fix applied:** `handleClick` now calls `refresh()` before checking `button.disabled`. Updated the corresponding test from "click does NOT invoke onClick when disabled" (synthetic disabled) to "click re-evaluates disabled state (closes the staleness window between polls)" — flips `available` to false between renders and confirms the click suppresses `onClick`.

### LOW — Test fixtures cast through partial `SessionMetadata`/`SessionBundle`

Acceptable test scaffolding. No fix needed; helper only reads `commands.length`, `metadata.startTick`, `metadata.endTick` — the cast acknowledges the partial stub.

### LOW — Toast wording, structural compatibility, template fidelity

All verified clean by Claude. No fix needed.

## Disposition

All four substantive findings (BLOCKER + 3 MEDIUM) addressed. Reviewers explicitly recommended a `createApp`-level smoke test to catch future TDZ regressions; deferred to a follow-up slice (the existing `tests/integration/annotation-ui.integration.test.ts` notes this gap and the slice-2 fix is independently regression-tested by `tests/ui/replayCurrentSessionButton.test.ts` exercising the listener subscription pattern).

## Files changed by iter-1 fixes

- `src/app/bootstrap/createApp.ts`: forward-declared `let stack: AnnotationStack | undefined`; bridge thunks guard with truthiness; hotkey closures use optional chaining; `subscribeReplayModeChange` thunk added to the bridge.
- `src/game/replay/loadCurrentSession.ts`: narrowed no-payloads predicate to `commands.length === 0`.
- `src/ui/hud/replayCurrentSessionButton.ts`: added `subscribeToModeChange` config field; click handler now re-evaluates disabled state via `refresh()` before invoking `onClick`.
- `src/ui/hud/createHudController.ts`: `HudBridge.subscribeReplayModeChange?` plus wiring through `createReplayCurrentSessionButton`.
- `tests/replay/loadCurrentSession.test.ts`: updated for new predicate; the elapsed-ticks-no-commands case is now a `no-payloads` regression.
- `tests/ui/replayCurrentSessionButton.test.ts`: new test for `subscribeToModeChange` integration; replaced the unreachable defense-in-depth case with a stale-state re-check regression.
- `docs/threads/current/replay-load-and-e2e/design/03-load-source-current-session.md`: surface section updated.
- `docs/changelog.md`: validation footer 810 → 811 (one extra test from `subscribeToModeChange`).
