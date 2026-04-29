# Annotation UI — Implementation Plan

**Status:** Accepted v2 (2026-04-29). 3-CLI plan-2 review converged: Gemini ACCEPT, Claude ACCEPT-with-1-MAJOR-clarification, Codex ITERATE on 1 MAJOR + 3 MINORs. Both MAJORs (FR-1 anti-regression vs AO-4; AO-7b/AO-8 tee scope) resolved inline. See `2026-04-29/plan-2/REVIEW.md`. Ready for PHASE 1 implementation.

Implements DESIGN.md v5 (ACCEPT). Coordinated two-repo drop: civ-engine v0.8.10 → 0.8.11 (additive `AgentDriverContext.addMarker / attach` + default-sink change), aoe2 v0.1.4 → 0.1.5 (annotation UI + recording service + IDB mirror).

v2 deltas from v1:
- **TDD discipline:** PHASE 1 merges CE-1+CE-2 into a single TDD task (write failing tests → implement → tests pass). PHASE 1's review checkpoint and PHASE 3 FR-1 list **Codex + Gemini + Claude** per aoe2 AGENTS.md (v1 omitted Gemini). Diff command corrected to `git diff` / `git diff main`.
- **Test environment:** AO-1 adds `fake-indexeddb` + `jsdom` to devDependencies, updates `vitest.config.ts` for jsdom env, smoke-tests vitest alias inheritance for `node:crypto`.
- **AO-7 split:** IndexedDBMirror split into AO-7a (open/close/recordMeta + lifecycle), AO-7b (per-stream record* + tee + fake-timer flush testing), AO-7c (listSessions + reconstructBundle + typed errors), AO-7d (discard + readAttachmentBytes + quota path).
- **`pausedManually` carrier:** AO-2 specifies a new `pauseState: { pausedManually: boolean }` bag on bridge state, NOT in `tickHaltGuard.ts`'s `haltState`.
- **Seed URL preservation:** AO-12 adds explicit "preserve seed parsing + V3-22 empty-seed warn" sub-bullet + regression test across (absent / empty / whitespace / non-empty).
- **Retired docs:** AO-14 drops `aoe2/docs/api-reference.md` (the project doesn't maintain it per AGENTS.md V5-5); canonical surfaces are README.md, ARCHITECTURE.md, decisions.md, drift-log.md, devlog, changelog.
- **Vitest integration tests:** new task AO-12.5 covers DESIGN §11 integration scenarios (full write flow, persistence/refresh recovery, schema migration, stale-ref click).
- **`panCameraTo` direction:** AO-4 spells the correct API: liveness via `world.isCurrent(ref)` then position via `world.getComponent<Position>(ref.id, 'position')`.
- **CE-0 prerequisite:** verifies `decide` runs BEFORE `world.step` (confirmed: `ai-playtester.ts:166` decide / `:187` step), bakes the resolved tick semantics into the test.
- **`§6 Decisions confirmed`:** v1's Open Questions Q1-Q4 were already resolved by DESIGN v5; renamed and resolutions inline.
- **Visual + doc compliance:** AO-13 spells the full before/after/pixel-diff procedure; AO-14 adds the doc audit grep step.

**Target review path:** multi-CLI plan-2 review under `docs/threads/current/annotation-ui/2026-04-29/plan-2/REVIEW.md`. After ACCEPT, implementation proceeds task-by-task with per-task code review.

**Discipline:** TDD per AGENTS.md. Each task: write test → fail → make pass → run gates → commit-on-green for civ-engine; final all-task commit for aoe2 (one coherent v0.1.5).

**Process note:** Design iterations 1–5 used Codex + Claude only. aoe2's AGENTS.md requires Codex + Gemini + Claude. Plan-2 review onward uses all three; the design-iteration omission is logged in `docs/learning/lessons.md` as a process regression to avoid in future threads.

## 0. Sequencing

```
PHASE 1 — civ-engine v0.8.11 (must merge first)
  CE-0  Verify `decide` runs BEFORE `world.step` in runner ordering (read ai-playtester.ts)
  CE-1  Single TDD task: write failing tests for ctx.addMarker / ctx.attach / default-sink-allowSidecar / future-tick rejection / regression on existing destructure-only consumers; THEN implement AgentDriverContext extension + default sink change to make them pass
  CE-2  Docs: civ-engine api-reference.md (verified to exist), devlog, changelog, README version badge, version bump 0.8.10 → 0.8.11
  CE-3  Multi-CLI review (Codex + Gemini + Claude) on civ-engine diff, iterate, commit

PHASE 2 — aoe2 v0.1.5 (one coherent commit at end; tests pass throughout)
  AO-0  npm install (pick up civ-engine v0.8.11 from file: link); record civ-engine HEAD sha in devlog for drift detection
  AO-1  Vite alias (node:crypto → src/shims/node-crypto.ts) + node-crypto.ts shim + add fake-indexeddb + jsdom devDeps + vitest config update + alias-inheritance smoke test
  AO-2  Bridge additive surfaces: world (getter), setPaused (toggles new pauseState.pausedManually bag, NOT haltState), getSelectedEntityRefs, select(refs); browserTestApi regression assertion
  AO-3  PauseControl + HotkeyRegistry primitives
  AO-4  GameScene.panCameraTo (resolution: world.isCurrent → world.getComponent<Position>; no-op + toast on stale) + step() pausedManually gate placement (AFTER flushOutOfBandRenderChange, BEFORE haltState.halted check)
  AO-5  HUD changes: toastHandle exposed; HudBridge.loadGame widened to Promise<void>; saveLoadPanel awaits + toasts on resolve/reject; Load button disabled while pending
  AO-6  markerSchema + selectionToRefs + captureScreenshot (entity refs only; no cell handling per DESIGN v3+)
  AO-7a IndexedDBMirror — open / close / recordMeta / connection lifecycle + tests
  AO-7b IndexedDBMirror — per-stream record* methods (tick/command/execution/failure/snapshot/marker/attachment) + tee mechanism + 100ms-debounced flush queue with fake-timer-based deterministic tests + flushAll() test hook
  AO-7c IndexedDBMirror — listSessions + reconstructBundle (per DESIGN §5) + typed errors (SessionNotFoundError, SchemaMismatchError, IncompleteSessionError)
  AO-7d IndexedDBMirror — discard + readAttachmentBytes + quota error path → onPersistenceError
  AO-8  RecordingService — full §5 contract: start/stop/addMarker/attachScreenshot/bundle/markers/exportBundle/listPriorSessions/exportPriorSession/discardPriorSession/onPersistenceError
  AO-9  AnnotationFormUiHost + AnnotationForm component (jsdom tests)
  AO-10 AnnotationController
  AO-11 MarkerListPanel (current session + Prior Sessions section; stale-ref filter on row click)
  AO-12 createApp wireup: rebuildAnnotationStack helper (closure-scoped _pendingRebuild) + handleLoadGame async + hotkey closures + preserve seed parsing + V3-22 warn + installBrowserTestApi readiness assertion + main.ts startup-failure catch
  AO-12.5 Vitest integration suite: full write flow, persistence/refresh recovery, schema migration drop, stale-ref click (jsdom + fake-indexeddb)
  AO-13 Playwright e2e tests (launch/select/Alt+M/save/Alt+L/click; refresh recovery via Prior Sessions Export) + visual gates: capture before screenshot (no annotation UI), apply, capture after, pixel-diff alongside the four standard gates; first-run baseline committed after manual review
  AO-14 Docs: aoe2 README.md (feature mention), docs/architecture/ARCHITECTURE.md (component map row + boundary paragraph), docs/architecture/drift-log.md (entry), docs/architecture/decisions.md (ADRs 1/3/9 mirror), docs/devlog/detailed/<latest>.md, docs/devlog/summary.md, docs/changelog.md (v0.1.5 entry), package.json version bump; doc-audit grep for any stale signatures or removed-API names
        NOTE: aoe2 does NOT maintain docs/api-reference.md or docs/guides/ (per AGENTS.md V5-5)

PHASE 3 — Final review + commit
  FR-1  Multi-CLI code review (Codex + Gemini + Claude) of the full aoe2 v0.1.5 diff via `git diff main`; doc-accuracy verification clause in the prompt
  FR-2  Address findings, iterate to nitpick-only (Tie-Breaker if engineer/reviewers diverge after 3 iterations per AGENTS.md)
  FR-3  Land aoe2 v0.1.5 commit on main; thread → docs/threads/done/annotation-ui/
```

PHASE 1's three tasks land as one civ-engine commit (`feat(ai-playtester): Spec 9.1 — agent marker emission via AgentDriverContext (v0.8.11)`). PHASE 2 lands as one aoe2 commit (`feat(annotation-ui): Spec 2 — game-side annotation capture + IDB persistence (v0.1.5)`). The aoe2 commit message references civ-engine v0.8.11 as the dep target.

## 1. PHASE 1 — civ-engine v0.8.11

### CE-0 — Prerequisite: verify runner ordering

**Files (read-only):** `civ-engine/src/ai-playtester.ts`.

**Steps:**

1. Read `runAgentPlaytest`; confirm the per-iteration ordering of `decide` vs `world.step`. Resolved per plan-1 review: `decide` is called at line 166, `world.step` at line 187 — `decide` runs BEFORE `world.step`.
2. Confirmed: at the point an agent calls `ctx.addMarker()` from inside `decide(ctx)`, `world.tick` is the just-completed tick (call it N), and `ctx.tick` is N+1. So a marker emitted with no `tick` field defaults to `world.tick` = N (the just-completed tick); a marker emitted with `tick: ctx.tick` would set `tick = N+1` and trip `'6.1.tick_future'`.
3. This ordering is baked into CE-1 test design.

### CE-1 — Single TDD task: extend `AgentDriverContext` + change default sink

**Files:**
- `civ-engine/src/__tests__/agent-driver-context-marker.test.ts` — NEW test file
- `civ-engine/src/ai-playtester.ts` — extend `AgentDriverContext`; change default sink construction; add ctx delegation closures

**TDD step 1 — write the 5 tests below; the first 4 (behavior tests) are expected to fail until step 2 implements the new API; test 5 (regression) should pass immediately. To make compilation succeed in step 1, add minimal type stubs (e.g., `addMarker(input: NewMarker): string;` declared on the interface with a stub `() => ''` body in the runner; tests will fail at runtime due to the stub returning empty / not actually emitting). Run `npm test --no-coverage` and confirm tests 1-4 fail with the right shape.**

1. **`agent emits a marker via ctx.addMarker (no tick); bundle contains it; markers reference world.tick at emission`**
   - Construct a minimal world (counter component) with `MemorySink` default
   - Agent.decide returns `[]` after `ctx.addMarker({ kind: 'annotation', text: 'hello', refs: { tickRange: { from: ctx.world.tick, to: ctx.world.tick } } })` (no tick field)
   - Run for 5 ticks via `runAgentPlaytest`
   - Assert `result.bundle.markers.length === 5`
   - Assert each marker's `tick === N` where N is the world.tick value at the moment `decide` ran (= 0, 1, 2, 3, 4 given startTick=0 and decide-before-step ordering confirmed by CE-0)

2. **`agent attaches a 100 KiB PNG via ctx.attach; recorder survives (default sink allowSidecar=true)`**
   - Agent.decide attaches a 100 KiB PNG-shaped Uint8Array, then emits a marker referencing it via the returned attachment id
   - Run for 1 tick
   - Assert `result.ok === true`
   - Assert `result.bundle.attachments[0].ref` is `{ sidecar: true }`
   - Assert `result.bundle.markers[0].attachments?.[0]` matches the attachment id

3. **`agent passing input.tick = ctx.tick (= world.tick + 1) throws MarkerValidationError 6.1.tick_future`**
   - Agent.decide calls `ctx.addMarker({ kind: 'annotation', tick: ctx.tick, refs: {...} })`
   - Run for 1 tick
   - Assert `result.ok === false`, `result.stopReason === 'agentError'`, `result.agentError!.error.message` matches `/tick.*\d+.*must not exceed current world tick.*\d+/`

4. **`agent omitting input.tick defaults to world.tick`** — covered by test 1 (per CE-0 ordering); separate explicit assertion: `ctx.addMarker({ kind: 'annotation', text: 'a' })` with no refs/tick yields a marker with `tick === ctx.world.tick`

5. **`existing AgentDriver implementations that destructure only { world, tick, startTick, tickIndex } continue to work unchanged (regression)`**
   - Construct an agent whose `decide` only reads the destructured 4 fields
   - Run for 3 ticks
   - Assert `result.ok === true` and `result.bundle.markers.length === 0` (no markers emitted; the agent didn't emit any)
   - This regression is also implicitly covered by `civ-engine/src/__tests__/ai-playtester.test.ts` continuing to pass

**TDD step 2 — implement to make tests pass:**

```ts
// civ-engine/src/ai-playtester.ts

// Extend AgentDriverContext interface:
+ /** Emit a marker into this playtest's recorder. Returns marker id.
+  *  Callers should typically OMIT input.tick — recorder defaults it to
+  *  world.tick. Passing input.tick = ctx.tick (= world.tick + 1) throws
+  *  MarkerValidationError code '6.1.tick_future'. */
+ addMarker(input: NewMarker): string;
+ /** Attach a blob; returns attachment id for marker.attachments. */
+ attach(blob: { mime: string; data: Uint8Array }, options?: { sidecar?: boolean }): string;

// In runAgentPlaytest() — change default sink:
- const sink: SessionSink & SessionSource = config.sink ?? new MemorySink();
+ const sink: SessionSink & SessionSource = config.sink ?? new MemorySink({ allowSidecar: true });

// In per-tick ctx construction (around line 157):
  const ctx: AgentDriverContext<TEventMap, TCommandMap> = {
    world: world as unknown as World<TEventMap, TCommandMap>,
    tick: world.tick + 1,
    startTick,
    tickIndex,
+   addMarker: (input) => recorder.addMarker(input),
+   attach: (blob, opts) => recorder.attach(blob, opts),
  };

// Post-step ctxAfter (around line 208) — inherits via `...ctx`:
  const ctxAfter: AgentDriverContext<TEventMap, TCommandMap> = {
    ...ctx,
    tick: world.tick,
    tickIndex: tickIndex + 1,
  };
  // Note: ...ctx already carries addMarker / attach (same delegating closures)
```

**TDD step 3 — verify tests pass + gates green:** `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`.

### CE-2 — Docs + version bump

**Files:**
- `civ-engine/package.json` — version 0.8.10 → 0.8.11
- `civ-engine/src/version.ts` (if mirrors package.json)
- `civ-engine/docs/changelog.md` — new v0.8.11 entry calling out: ctx extension (additive); default sink change (more permissive — relevant for downstream callers using the default that previously hit `oversize_attachment`)
- `civ-engine/docs/devlog/detailed/<latest>.md` — Spec 9.1 task entry with reviewer comments by AI provider per AGENTS.md
- `civ-engine/docs/devlog/summary.md` — one-line update
- `civ-engine/docs/api-reference.md` — `AgentDriverContext.addMarker / attach` documented; default-sink change called out (verified to exist in civ-engine; aoe2 does not maintain this file but civ-engine does)
- `civ-engine/README.md` — version badge bump if present; mention new context capability in the Feature Overview / Public Surface if listed

**Acceptance:** all four gates pass.

### CE-3 — Multi-CLI review + commit

After CE-1 + CE-2, run multi-CLI code review per AGENTS.md `Code review` section:

```bash
# 3 CLIs in parallel via run_in_background
git diff | codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh -c approval_policy=never --sandbox read-only --ephemeral <prompt> > codex.txt
git diff | gemini --prompt <prompt> --model gemini-3.1-pro-preview --approval-mode plan --output-format text > gemini.txt
git diff | claude -p --model "claude-opus-4-7[1m]" --effort max --append-system-prompt <prompt> --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)" > claude.txt
# Single until-poller waits for all three
until [ -s codex.txt ] && [ -s gemini.txt ] && [ -s claude.txt ]; do sleep 8; done
```

Prompt includes the AGENTS.md baseline + a doc-accuracy clause: "verify docs in the diff match implementation; flag any stale signatures, removed APIs still mentioned, or missing coverage of new APIs in canonical guides."

Synthesize into `civ-engine/docs/threads/current/<objective>/<date>/<iter>/REVIEW.md` (per civ-engine's own AGENTS.md thread convention — verify the path before committing). Iterate until reviewers nitpick or converge ACCEPT. Commit when done; PHASE 1 is then merged.

**Expected:** PHASE 1 is small (~12 lines + 5 tests); reviewers should reach ACCEPT in 1-2 iterations.

## 2. PHASE 2 — aoe2 v0.1.5

### AO-0 — Sync civ-engine; record HEAD

**Files:** none in source; only `aoe2/docs/devlog/detailed/<latest>.md`.

**Steps:**

1. `cd aoe2 && npm install` to pick up civ-engine v0.8.11 from the `file:../civ-engine` link
2. `cd ../civ-engine && git rev-parse HEAD` — record the commit sha in the aoe2 PHASE 2 devlog entry as `civ-engine-head: <sha>` so any subsequent civ-engine drift during PHASE 2 is detectable
3. `cd aoe2 && npm run typecheck && npm run build` — quick smoke test that the new civ-engine version typechecks and bundles

### AO-1 — Vite alias + node:crypto shim + test environment dev deps

**Files:**
- `aoe2/src/shims/node-crypto.ts` — NEW, 1-line `export const randomUUID = () => crypto.randomUUID();`
- `aoe2/vite.config.ts` — add `resolve.alias['node:crypto']` → shim path (use `fileURLToPath(new URL('./src/shims/node-crypto.ts', import.meta.url))`)
- `aoe2/vitest.config.ts` (or section in vite.config.ts) — add `environment: 'jsdom'` for files that need DOM (form/panel/createApp tests); add the same `resolve.alias` so vitest picks up the node:crypto shim too (most setups inherit, verify in smoke test below)
- `aoe2/package.json` devDependencies: add `fake-indexeddb`, `jsdom`
- `aoe2/src/__tests__/vite-alias-smoke.test.ts` — NEW one-liner: `import { SessionRecorder } from 'civ-engine';` and assert truthy. If the alias doesn't propagate to vitest, this throws on `node:crypto` resolution.

**Remediation if smoke fails:** copy the `node:crypto` alias entry from `vite.config.ts` into `vitest.config.ts` (or the vitest section in vite.config.ts) under `test.resolve.alias`, then rerun. Most vitest setups inherit, but some override `resolve` per-environment.

**Tests:** the smoke test above is the verification. Also `npm run build` passes (verified post-AO-13 too).

**Acceptance:** all four gates green.

### AO-2 — Bridge additive surfaces

**Files:**
- `aoe2/src/game/simulation/createSimulationBridge.ts` — extend `SimulationBridge` interface; introduce a NEW closure-local `pauseState: { pausedManually: boolean }` bag (NOT in `tickHaltGuard.ts`); step() gains the third gate AFTER `flushOutOfBandRenderChange()` and BEFORE the existing `haltState.halted` check
- `aoe2/src/game/simulation/bridge/assembleBridgeApi.ts` — implement new methods (`world` getter from the existing internal world; `setPaused` flips `pauseState.pausedManually`; `getSelectedEntityRefs` returns `selection.refs.slice()`; `select(refs)` filters stale refs and updates selection)
- `aoe2/src/game/simulation/bridge/selectionInputOps.ts` — add an internal `selectByRefs(refs: readonly EntityRef[]): void` helper that filters via `getCurrentEntityId(ref)` (already-internal) then calls `selectUnitIds(ids)`

**New surface:**
- `bridge.world: World` (read-only getter; same instance for THIS bridge's lifetime — but the live bridge cell is reassigned by `handleLoadGame`. **Consumers must call `bridgeRef().world` (or equivalent closure indirection) — never capture `bridge.world` once and reuse across reload.** DESIGN §8 already does this correctly via `bridgeRef = () => bridge`; AO-12 wires it; this note is a defensive reminder for engineers reading just AO-2 in isolation.)
- `bridge.setPaused(paused: boolean): void`
- `bridge.getSelectedEntityRefs(): readonly EntityRef[]`
- `bridge.select(refs: readonly EntityRef[]): void`

**TDD step 1 — failing tests:**
- `getSelectedEntityRefs` returns `selection.refs` shape (with generations); empty selection returns `[]`
- `select(refs)` with one current + one stale ref → `selection.refs` contains only the current ref
- `select(refs)` with all stale refs → `selection.refs === []` (cleared)
- `setPaused(true)` → next `step(deltaMs)` does NOT call `world.step` (assert via spy)
- `setPaused(false)` → next `step(deltaMs)` calls `world.step` again
- `step()` while paused: `flushOutOfBandRenderChange` IS still called BEFORE the early-return (assert via spy / ordering)
- `setPaused(true)` while `haltState.halted !== null` (a real engine halt is active): `getHudState().engineHalted` still reflects the halt details (NOT manual pause); `setPaused(false)` does NOT clear `haltState.halted`
- `bridge.world` returns the same instance across calls; same instance as the one constructed inside `createSimulationBridge`
- **Regression assertion (Claude m7):** existing `installBrowserTestApi` tests still pass after extending the bridge interface (no test here; relies on the existing test suite continuing to pass)

**TDD step 2 — implement to make tests pass.**

**Acceptance:** all four gates green; existing browserTestApi tests untouched.

### AO-3 — PauseControl + HotkeyRegistry

**Files:**
- `aoe2/src/game/control/PauseControl.ts` — NEW
- `aoe2/src/game/control/HotkeyRegistry.ts` — NEW
- `aoe2/src/game/control/__tests__/PauseControl.test.ts`
- `aoe2/src/game/control/__tests__/HotkeyRegistry.test.ts`

**PauseControl shape:**

```ts
export interface PauseControl {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
}
export function createPauseControl(bridgeRef: () => SimulationBridge): PauseControl;
```

Implementation: tracks an internal `_paused` flag; `pause()` calls `bridgeRef().setPaused(true)`, `resume()` calls `setPaused(false)`. Idempotent on repeated pause/resume.

**HotkeyRegistry shape:**

```ts
export interface HotkeySpec {
  key: string;            // single key character or 'Escape', 'Enter', etc.
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}
export interface HotkeyRegistry {
  register(spec: HotkeySpec, handler: () => void): () => void;  // returns unregister
  dispose(): void;
}
export function createHotkeyRegistry(target?: HTMLElement | Document): HotkeyRegistry;
```

Implementation: attaches a single `keydown` listener on `target` (default `document`). For each event, checks if focus is on a text input (`<input>`, `<textarea>`, contenteditable) — if so, ignore. Otherwise iterate registered specs and call matching handlers.

**Tests:**
- `PauseControl`: pause→isPaused()===true; resume→isPaused()===false; double-pause is no-op; double-resume is no-op; bridge.setPaused called with correct boolean
- `HotkeyRegistry`: register Alt+M handler; dispatch matching keydown → handler called; dispatch with focus on `<input>` → handler NOT called; unregister stops calling; multiple specs coexist; dispose unregisters all

### AO-4 — GameScene additive

**Files:**
- `aoe2/src/phaser/scenes/GameScene.ts` — add `panCameraTo(target: EntityRef | Position): void`

Implementation:
- If `target` has `x` + `y` (Position shape), call `centerCameraOnWorldPosition(target.x, target.y)` directly
- If `target` has `id` + `generation` (EntityRef shape):
  - Read `world` via `bridge.world`
  - Liveness: `if (!world.isCurrent(target)) { return; /* caller handles toast separately */ }`
  - Resolve position: `const pos = world.getComponent<Position>(target.id, 'position'); if (!pos) return;`
  - Call `centerCameraOnWorldPosition(pos.x, pos.y)`

(`world.getEntityRef(id)` is the wrong direction — it returns the *current* EntityRef given an id. We have the EntityRef already and need the position from it.)

**Tests (vitest with Phaser stub):**
- `panCameraTo({ x: 5, y: 10 })` calls `centerCameraOnWorldPosition(5, 10)`
- `panCameraTo({ id: X, generation: G })` where X is current and has a Position component → calls centerCameraOn with the entity's coordinates
- `panCameraTo({ id: X, generation: G })` where X has been replaced (stale generation) → no-op (no centerCameraOn call)
- `panCameraTo({ id: X, generation: G })` where X is current but has no Position component (a registered-only entity) → no-op

### AO-5 — HUD changes

**Files:**
- `aoe2/src/ui/hud/createHudController.ts` — expose `toastHandle` in return type; widen `loadGame` to `(blob: SaveBlob) => Promise<void>`
- `aoe2/src/ui/hud/saveLoadPanel.ts` — await `loadGame`; toast "Game loaded." on resolve, error toast on reject; disable Load button while pending

**Tests:**
- Existing HUD tests continue to pass (loadGame is widened; sync callers that don't await still work because Promise<void> can be ignored)
- New: `saveLoadPanel` async-error path — `loadGame` rejects → error toast fired with the rejection message; success-toast does NOT fire

### AO-6 — markerSchema + selectionToRefs + captureScreenshot

**Files:**
- `aoe2/src/game/annotations/markerSchema.ts` — types + `isAoeMarkerData` type guard + DEFAULT_SEVERITY/CATEGORY
- `aoe2/src/game/annotations/selectionToRefs.ts` — function `selectionToRefs(refs: readonly EntityRef[]): MarkerRefs`
- `aoe2/src/game/annotations/captureScreenshot.ts` — function `captureScreenshot(scene: GameScene): Uint8Array`
- `aoe2/src/game/annotations/index.ts` — barrel export
- `aoe2/src/game/annotations/__tests__/markerSchema.test.ts`
- `aoe2/src/game/annotations/__tests__/selectionToRefs.test.ts`
- `aoe2/src/game/annotations/__tests__/captureScreenshot.test.ts`

**Tests:** per DESIGN §11 unit tests bullets.

### AO-7a — IndexedDBMirror: open/close + recordMeta + connection lifecycle

**Files:**
- `aoe2/src/game/recording/IndexedDBMirror.ts` — NEW; class skeleton with `open` / `close` / `recordMeta` / internal connection state
- `aoe2/src/game/recording/__tests__/IndexedDBMirror.connection.test.ts` — NEW

**Internal shape (this task only):**

```ts
export interface IndexedDBMirrorConfig {
  databaseName?: string;          // default 'aoe2-sessions'
  onPersistenceError?(err: Error): void;
}

export class IndexedDBMirror {
  constructor(config?: IndexedDBMirrorConfig);
  open(): Promise<void>;
  close(): Promise<void>;
  recordMeta(sessionId: string, meta: SessionMeta): Promise<void>;
}
```

**TDD step 1 — failing tests:**
- `open()` creates the database with version 1 + the 8 object stores; second call is idempotent
- `close()` closes the connection; subsequent calls to record* throw or no-op (pick one and assert)
- `recordMeta` writes a row keyed by `sessionId`; reads back via `getAllKeys()` (lower-level test, just for this primitive)
- `open()` failure (e.g., IDB not available) propagates to `onPersistenceError`

### AO-7b — Per-stream record* methods + tee + 100ms-debounced flush + flushAll test hook

**Files:**
- `aoe2/src/game/recording/IndexedDBMirror.ts` — extend with per-stream `record*` methods (tick/command/execution/failure/snapshot/marker/attachment) + internal flush queue
- `aoe2/src/game/recording/__tests__/IndexedDBMirror.streams.test.ts` — NEW; uses `vi.useFakeTimers()` for deterministic flush testing

**Internal additions:**

```ts
recordTick(sessionId: string, entry: SessionTickEntry): void;          // queued (sync return)
recordCommand(sessionId: string, cmd: RecordedCommand): void;          // queued
recordExecution(sessionId: string, exec: RecordedExecution): void;     // queued
recordFailure(sessionId: string, fail: RecordedFailure): void;         // queued
recordSnapshot(sessionId: string, snap: RecordedSnapshot): void;       // queued
recordMarker(sessionId: string, marker: Marker): void;                 // queued
recordAttachment(sessionId: string, descriptor: AttachmentDescriptor, bytes: Uint8Array | null): void;
flushAll(): Promise<void>;       // test hook: drains the queue immediately
```

The queue debounces writes for 100ms then issues an IDB `readwrite` transaction per store. Test hook `flushAll()` skips the timer and immediately drains.

**TDD step 1 — failing tests:**
- Round-trip per stream: `recordTick(sid, entry)` → `flushAll()` → reading via `mirror['_db'].transaction(['session_ticks']).objectStore(...).get([sid, entry.tick])` returns the entry
- Same for the other 7 streams
- Debounce: call `recordTick` 5 times within 50ms → no IDB write yet; advance fake timer 100ms → all 5 batched into a single transaction (assert via spying transaction creation)
- `flushAll()` drains pending immediately (no timer advance needed)
- Sidecar bytes: `recordAttachment(sid, descriptor, bytes)` stores the descriptor AND the bytes; reading the row back includes both fields

**Tee scope:** AO-7b tests the mirror's `record*` primitives directly (no tee wrapper). The production tee that fan-outs from `MemorySink` writes to `mirror.record*` lives entirely in AO-8 `RecordingService` (per DESIGN §5). AO-7b's tests construct `mirror` and call `mirror.recordTick(...)` etc. directly.

### AO-7c — listSessions + reconstructBundle + typed errors

**Files:**
- `aoe2/src/game/recording/IndexedDBMirror.ts` — extend with `listSessions` + `reconstructBundle` + error classes
- `aoe2/src/game/recording/IndexedDBMirrorErrors.ts` — NEW: `SessionNotFoundError`, `SchemaMismatchError`, `IncompleteSessionError`
- `aoe2/src/game/recording/__tests__/IndexedDBMirror.read.test.ts` — NEW

**Internal additions:**

```ts
listSessions(): Promise<readonly PriorSessionDescriptor[]>;
reconstructBundle(sessionId: string): Promise<SessionBundle>;
markClosed(sessionId: string): Promise<void>;     // sets session_meta.closed = true
```

Reconstruction follows DESIGN §5 procedure: per-stream sort orders, typed errors, no-duplicate guarantee from primary keys, initial-snapshot from `session_meta.initialSnapshot` (NOT from `session_snapshots`).

**TDD step 1 — failing tests:**
- 3 sessions written, one closed; `listSessions` returns all 3 with `closedNormally: true/false` matching
- `markClosed(sid)` sets `closedNormally: true` for that session; subsequent `listSessions` reflects it
- `reconstructBundle(unknown)` throws `SessionNotFoundError`
- `reconstructBundle` with `session_meta.schemaVersion = 0` (mismatch) throws `SchemaMismatchError(sessionId, expected, found)`
- `reconstructBundle` with no `session_meta.initialSnapshot` throws `IncompleteSessionError(sessionId, 'initial_snapshot_missing')`
- Happy path: write meta + 3 ticks + 2 markers + 1 attachment → `reconstructBundle` returns a `SessionBundle` with all of them in correct shape; ticks tick-asc; markers (tick-asc, markerId-asc per DESIGN §5)
- `bundle.snapshots` does NOT include `initialSnapshot` (split confirmed)

### AO-7d — discard + readAttachmentBytes + quota error path

**Files:**
- `aoe2/src/game/recording/IndexedDBMirror.ts` — extend with `discard` + `readAttachmentBytes` + quota-error wiring
- `aoe2/src/game/recording/__tests__/IndexedDBMirror.errors.test.ts` — NEW

**Internal additions:**

```ts
discard(sessionId: string): Promise<void>;        // cascade-delete across all 8 stores
readAttachmentBytes(sessionId: string, attachmentId: string): Promise<Uint8Array | null>;
```

**TDD step 1 — failing tests:**
- `discard(sid)` removes the session's rows from all 8 stores; subsequent `listSessions` excludes it; `reconstructBundle(sid)` throws `SessionNotFoundError`
- `readAttachmentBytes` returns the bytes when present; null when descriptor exists but bytes are null (dataUrl-embedded); throws `SessionNotFoundError` if the descriptor doesn't exist
- Quota-exceeded simulation: stub the IDB transaction to throw a `QuotaExceededError`-shaped Error during `flushAll` → `onPersistenceError(err)` is called with the error; mirror remains operable for subsequent writes (best-effort)
- Close + reopen: data persists

### AO-8 — RecordingService

**Files:**
- `aoe2/src/game/recording/RecordingService.ts` — NEW (~200 LOC)
- `aoe2/src/game/recording/__tests__/RecordingService.test.ts`

Implements DESIGN §5 contract verbatim. Surface enumeration (per DESIGN §5):
- `start(): Promise<void>`
- `isRecording(): boolean`
- `stop(): Promise<void>`
- `addMarker(input): string`
- `attachScreenshot(pngBytes): string`
- `bundle(): SessionBundle | null`
- `markers(): readonly Marker[]` ← consumed by MarkerListPanel for current-session rendering
- `exportBundle(): Promise<Blob>`
- `listPriorSessions(): Promise<readonly PriorSessionDescriptor[]>`
- `exportPriorSession(sessionId): Promise<Blob>`
- `discardPriorSession(sessionId): Promise<void>`
- `onPersistenceError(listener): () => void`

Internal:
- Constructs `new MemorySink({ allowSidecar: true })` and `IndexedDBMirror`
- Wraps the `MemorySink` in a "tee" that forwards each write to `IndexedDBMirror` after the sync write succeeds (tee at MemorySink level per DESIGN §5)
- `start()` opens IDB, generates new sessionId, writes initial meta to mirror, calls `recorder.connect()`, throws on `recorder.lastError`
- `stop()` calls `recorder.disconnect()`, awaits `mirror.markClosed` (best-effort: rejection logged but not propagated; the live recorder is already disconnected)
- `addMarker / attachScreenshot` delegate to recorder
- `markers()` returns `recorder.toBundle().markers` sorted **tick-desc** (per DESIGN §5: "Convenience: bundle.markers sorted by tick desc, for the panel"). MarkerListPanel consumes this directly without further sorting.
- `exportBundle` runs the re-embedding procedure (DESIGN §5)
- `listPriorSessions` filters out the current sessionId
- `exportPriorSession` calls `mirror.reconstructBundle` + re-embedding
- `discardPriorSession` checks not-current then calls `mirror.discard`
- `onPersistenceError` adds listener; mirror calls them all on error

**Tests:** per DESIGN §11 RecordingService bullets, plus:
- `markers()` returns markers sorted tick-desc (per DESIGN §5)
- Concurrent `addMarker` calls between tick and post-mirror-flush are visible in `markers()` synchronously even before the mirror flushes

### AO-9 — AnnotationFormUiHost + AnnotationForm

**Files:**
- `aoe2/src/ui/annotation/AnnotationForm.ts` — DOM construction + styles
- `aoe2/src/ui/annotation/createAnnotationFormHost.ts` — host factory
- `aoe2/src/ui/annotation/__tests__/AnnotationForm.test.ts` — fake DOM (jsdom)

Form fields per DESIGN §6 table. Host shape per ADR 10: `openForm(refs)`, `closeForm()`, `onSubmit(handler)`, `onCancel(handler)`.

### AO-10 — AnnotationController

**Files:**
- `aoe2/src/game/recording/AnnotationController.ts`
- `aoe2/src/game/recording/__tests__/AnnotationController.test.ts`

Implements DESIGN §6 onHotkey / onSubmit / onCancel. Tests: hotkey ignored when text-input focused (delegated to HotkeyRegistry, just verify the controller doesn't double-handle); hotkey → form opens with refs + game pauses; submit → addMarker called; cancel → resume.

### AO-11 — MarkerListPanel

**Files:**
- `aoe2/src/ui/annotation/MarkerListPanel.ts` — current session + Prior Sessions sections
- `aoe2/src/ui/annotation/__tests__/MarkerListPanel.test.ts`

Implements DESIGN §7. Prior Sessions section is collapsed by default; expand triggers `recording.listPriorSessions()` (cached after first call); per-row Export and Discard buttons.

**Tests:** per DESIGN §11 MarkerListPanel bullets, especially the stale-ref filter on row click.

### AO-12 — createApp wireup

**Files:**
- `aoe2/src/app/bootstrap/createApp.ts` — async; `rebuildAnnotationStack` helper closure-scoped (per design-5 review fix); `handleLoadGame` async (matching widened HudBridge.loadGame)
- `aoe2/src/main.ts` — awaits `createApp()`; catches startup failure → renders fatal error message
- `aoe2/src/app/bootstrap/__tests__/createApp.test.ts` — NEW (jsdom + Phaser stubs)

**Implementation requirements (sub-bullets):**

1. Implementation matches DESIGN §8 wireup snippet verbatim.
2. **Preserve seed URL handling.** Current `createApp.ts:25-30` distinguishes:
   - param absent (`?seed` not in URL) → use `DEFAULT_SEED`
   - param explicitly empty/whitespace (`?seed=`) → emit warn `'[aoe2] ?seed= URL parameter was empty; falling back to DEFAULT_SEED.'` AND fall back to DEFAULT_SEED (this is V3-22; load-bearing)
   - param non-empty → use trimmed value
   All three cases must be preserved in the rewritten createApp. Add a regression test asserting all three cases.
3. `installBrowserTestApi(window, game, () => bridge, scene)` is called AFTER `await createApp()` resolves; assert via `window.__AOE2_TEST__` being defined post-await.
4. Closure-scoped `_pendingRebuild: Promise<AnnotationStack> | null` lives inside `createApp` (per design-5 review).
5. `main.ts` startup failure: `await createApp()` rejection is caught; `document.body.textContent = 'aoe2 failed to start: <message>'` (per DESIGN §8).

**Tests:**
- `createApp()` resolves; returned game is `Phaser.Game`; `recording.start` was awaited (assert via spy on RecordingService.start)
- Seed URL handling: 4 cases (no `?seed`, `?seed=`, `?seed=  `, `?seed=foo`) — all behave as documented
- `handleLoadGame` single-flight: two concurrent calls serialize via `_pendingRebuild`; both observe the prior fully-disposed stack; final stack is bound to the most-recent bridge
- `recording.stop()` rejection during dispose: rebuild still produces a working new stack; toast fired with the error
- `window.__AOE2_TEST__` is defined after `await createApp()` resolves
- Connect-time `RecordingService.start()` rejection: `await createApp()` rejects; `main.ts` catches and renders fatal message in body

### AO-12.5 — Vitest integration suite

**Files:**
- `aoe2/src/__tests__/integration/annotation-ui.integration.test.ts` — NEW (jsdom + fake-indexeddb)

**Test scenarios (per DESIGN §11 integration tests):**

1. **Full write flow.** Start `RecordingService` → simulate Alt+M event → fill form via `AnnotationFormUiHost` → submit → verify marker present in `RecordingService.bundle().markers` with correct shape: `data.author === 'human'`, severity/category populated, `attachments[0]` populated when screenshot captured (sidecar bytes persisted to fake IDB).
2. **Persistence flow / refresh recovery.** Write 50 markers → close + reopen `RecordingService` (simulating refresh) → second instance starts fresh session → `listPriorSessions()` returns the prior session → `exportPriorSession(priorId)` produces a valid Blob whose JSON parses + contains all 50 markers + dataUrl-embedded attachments.
3. **Schema migration drop.** Write a session with simulated `schemaVersion: 0` → second instance starts → `listPriorSessions` returns it with the schema mismatch flagged → `exportPriorSession` throws `SchemaMismatchError`.
4. **Stale-ref click in MarkerListPanel.** Write a marker referencing entity X → destroy + respawn entity X (generation bump) → call `MarkerListPanel.onRowClick(marker)` → `bridge.select` called with empty array (filtered); cell fallback if applicable; toast emitted if both empty.

**Deterministic flush:** AO-12.5 uses `vi.useFakeTimers()` + `vi.advanceTimersByTime(150)` to drain the 100ms-debounced IDB queue. This avoids reaching into `(recording as any)._mirror.flushAll()` (private surface) and avoids exposing `recording.flushAllForTest()` on the public RecordingService API.

**Acceptance:** all four gates green; integration coverage adds the fast-feedback layer DESIGN §11 mandates.

### AO-13 — Playwright e2e + visual diff gates

**Files:**
- `aoe2/tests/playwright/annotation-ui.e2e.ts` — NEW
- `aoe2/tests/playwright/visual-baselines/annotation-form.png` — NEW (committed after manual review of first-run capture)
- `aoe2/tests/playwright/visual-baselines/marker-list-panel.png` — NEW (committed after manual review of first-run capture)
- `aoe2/tests/playwright/visual-baselines/before-annotation-form.png` — NEW (current-state baseline; AGENTS.md visual rule's "before screenshot")

**Visual rule procedure (per AGENTS.md "When the change is visual"):**

1. BEFORE applying the AnnotationForm/MarkerListPanel: launch app on the current main, capture screenshot of the relevant region (HUD area where the form/panel will appear) → `before-annotation-form.png` / `before-marker-list-panel.png` baseline. Commit these in this same task.
2. Apply the change (the form + panel components from earlier tasks AO-9/AO-11).
3. AFTER: launch app on the feature branch (uncommitted), capture screenshot of the same region → `annotation-form.png` / `marker-list-panel.png`.
4. Pixel diff: `before-*.png` vs `*.png` produces a third image showing what the change adds. Manual review: confirm the diff matches the design intent (form / panel appear as expected; nothing else changes). The pixel diff itself is NOT a gate (the change is intentional); the regression gate is described next.
5. **Regression gate (subsequent runs):** future PRs that touch UI run the visual diff against the committed `annotation-form.png` / `marker-list-panel.png` baselines and fail on >0.1% pixel difference unless the baseline is intentionally re-captured.

**Test scenarios:**
- Launch game → select unit → Alt+M → fill form → save → toggle Alt+L → see new row → click row → camera pans + game paused
- Refresh recovery: launch, annotate, refresh → second launch → expand Prior Sessions → see the prior row → click Export → assert downloaded JSON parses + contains the marker

### AO-14 — Docs + version bump

**Files (per aoe2 AGENTS.md canonical surface list — V5-5 retired files are NOT updated):**
- `aoe2/package.json` — version 0.1.4 → 0.1.5
- `aoe2/docs/changelog.md` — new v0.1.5 entry: what shipped, why, validation, behavior callouts (for users)
- `aoe2/docs/devlog/detailed/<latest>.md` — Spec 2 full per-task entry per Devlog convention (timestamp, action, code reviewer comments by AI provider per AGENTS.md, result, reasoning, notes)
- `aoe2/docs/devlog/summary.md` — one-line update; remove outdated; compact if > 50 lines
- `aoe2/README.md` — Feature Overview / Public Surface mention if exists; otherwise unchanged
- `aoe2/docs/architecture/ARCHITECTURE.md` — Component Map row + Boundaries paragraph for the new annotation/recording subsystem; tick lifecycle ASCII updated if changed (recording is post-hoc; should NOT need lifecycle change)
- `aoe2/docs/architecture/drift-log.md` — append a row: date + change + reason
- `aoe2/docs/architecture/decisions.md` — append decisions: (1) IDB is write-only mirror over MemorySink; (2) agent-marker via AgentDriverContext extension (civ-engine v0.8.11)
- `aoe2/docs/learning/lessons.md` — append the multi-CLI design-iteration regression note (design 1-5 used 2 CLIs only; aoe2 mandates 3)

**NOT updated (retired per AGENTS.md V5-5):**
- `aoe2/docs/api-reference.md` (does not exist; canonical "API reference" is the `SimulationBridge` interface in `src/game/simulation/createSimulationBridge.ts`)
- `aoe2/docs/guides/<topic>.md` (does not exist)
- `aoe2/docs/README.md` (does not exist)

**Doc audit (mandatory verification):**

Before declaring task done: invoke the `doc-review` skill (if available) OR run `grep -rn "<old-API-name>" docs/ README.md` for any APIs/method names removed in this v0.1.5 work to confirm no stale references. Stale entries in historical changelog/devlog/drift-log are intentional context and should remain.

## 3. PHASE 3 — Final review

### FR-1 — Multi-CLI code review of the full aoe2 v0.1.5 diff (3 CLIs per AGENTS.md)

Per aoe2 AGENTS.md `Code review` section: dispatch Codex + Gemini + Claude in parallel using `run_in_background: true` and a single `until [ -s codex.txt ] && [ -s gemini.txt ] && [ -s claude.txt ]; do sleep 8; done` poller.

```bash
git diff main | codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh -c approval_policy=never --sandbox read-only --ephemeral <prompt> > codex.txt
git diff main | gemini --prompt <prompt> --model gemini-3.1-pro-preview --approval-mode plan --output-format text > gemini.txt
git diff main | claude -p --model "claude-opus-4-7[1m]" --effort max --append-system-prompt <prompt> --allowedTools "Read,Bash(git diff *),Bash(git log *),Bash(git show *)" > claude.txt
```

Prompt enrichment per AGENTS.md (above the baseline reviewer prompt):
- Anti-regression checklist: every iter-1 through iter-5 BLOCKER and MAJOR remediation must be visible in the diff:
  - `MemorySink({ allowSidecar: true })` literal present in both civ-engine v0.8.11 and aoe2 RecordingService
  - `pausedManually` flag present on bridge state, NOT on `haltState`
  - `_pendingRebuild` cell scoped per-createApp (NOT module-scoped)
  - `world.isCurrent(ref)` then `world.getComponent<Position>(ref.id, 'position')` in `panCameraTo` resolution direction (NOT `world.getEntityRef` / `currentRef`, which take an id and return an EntityRef — wrong direction for ref-to-position)
  - `HudBridge.loadGame: (blob: SaveBlob) => Promise<void>` widened (not the original `void` signature)
  - Seed URL handling preserved (V3-22 warn fires for empty/whitespace `?seed=`)
  - civ-engine version target = `0.8.11`, NOT 0.8.10
- Doc-accuracy verification (AGENTS.md mandate): "verify docs in the diff match implementation; flag any stale signatures, removed APIs still mentioned, missing coverage of new APIs in canonical guides, or thread design/plan docs that are missing from the objective root."

Synthesize all three CLIs' findings into `aoe2/docs/threads/current/annotation-ui/2026-04-29/review-1/REVIEW.md`. If a CLI is unreachable (quota etc.), proceed with the remaining two and note in the devlog (per AGENTS.md).

### FR-2 — Iterate until nitpick-only

Address findings per the iter-N pattern; create `review-N/REVIEW.md` for each iteration. Tie-Breaker if engineer/reviewers diverge after 3 iterations (per AGENTS.md). Convergence target: all three CLIs say ACCEPT or only nitpick.

### FR-3 — Land aoe2 v0.1.5

Single commit on aoe2 main. Move thread to `docs/threads/done/annotation-ui/`. Devlog entry includes the civ-engine HEAD sha pinned in AO-0 + the multi-CLI review iteration count.

## 4. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Bridge swap on save/load is more invasive than expected (handleLoadGame async signature change ripples) | AO-5 lists the exact two file edits; AO-12 verifies via test; if wider impact found, escalate before completing AO-12 |
| Phaser canvas → PNG capture API differs between Phaser versions in aoe2 | AO-6 captureScreenshot test mocks Phaser; live verification deferred to AO-13 visual gate which will catch any Phaser quirk |
| `fake-indexeddb` doesn't precisely match production IndexedDB quota behavior | AO-7 quota test simulates by injecting a write-aborting error; production-quota validation deferred to AO-13 e2e (acceptable risk for v0.1.5) |
| civ-engine v0.8.11 ships with a subtle break in existing AgentDriver tests despite the "additive" claim | CE-2 test 5 explicitly regresses; CE phase merges first, so any aoe2 work blocks until CE is green |
| 8 IDB stores increases bug surface in AO-7 | AO-7 round-trip test exercises all 8; per-store sort order assertions catch ordering bugs early |

## 5. Estimated effort

- PHASE 1 (CE-0..CE-3): 1-2 hours, single sitting
- PHASE 2 AO-0..AO-6 (sync + primitives + small surfaces): 4-6 hours
- PHASE 2 AO-7a..AO-7d + AO-8 (IndexedDBMirror split + RecordingService): 6-8 hours
- PHASE 2 AO-9..AO-12 (UI + wireup): 4-6 hours
- PHASE 2 AO-12.5 (vitest integration): 1-2 hours
- PHASE 2 AO-13..AO-14 (e2e + docs): 3-4 hours
- PHASE 3 FR-1..FR-3 (review + commit): 2-3 hours

Total: ~22-32 hours of focused work. Single-developer cadence; parallelization minimal because the work has linear dependencies (AO-7a blocks AO-7b blocks AO-7c/d blocks AO-8 blocks AO-12).

## 6. Decisions confirmed during plan review

The plan-1 review (`docs/threads/current/annotation-ui/2026-04-29/plan-1/REVIEW.md`) flagged that v1's "Open Questions" Q1-Q4 were already resolved by DESIGN v5. Resolutions baked into v2:

1. **`bridge.world` exposure shape:** read-only getter that returns the existing internal `world` field (per ADR 10 row "sourced from the existing `world` field in `assembleBridgeApi`"). Immutable for the bridge's lifetime; replaced by a fresh bridge instance on load.

2. **IndexedDBMirror tee placement:** at the `MemorySink` level. `RecordingService` wraps the sync `MemorySink` writes; each successful sync write triggers an async `mirror.record*` call. SessionRecorder is unchanged. Per DESIGN §5 + ADR 1.

3. **`recording.stop()` final-flush failure path:** best-effort. If `mirror.markClosed` rejects, the session row in `session_meta` retains `closed: false`; subsequent `listPriorSessions()` lists it with `closedNormally: false` and a tooltip ("session ended abnormally — likely browser refresh or crash"). The error fires `onPersistenceError(err)` so the toast surfaces. The new RecordingService instance is still constructed (per design-5 N21 best-effort dispose).

4. **Phase boundaries:** strict serial. PHASE 1 (civ-engine v0.8.11) lands first. PHASE 2 (aoe2 v0.1.5) starts only after PHASE 1's commit lands on civ-engine main; AO-0 records the civ-engine HEAD sha at PHASE 2 start to guard against drift mid-implementation.

## 7. Process note: design-iteration regression

Design iterations 1–5 used Codex + Claude only. aoe2's AGENTS.md `Code review` section requires Codex + Gemini + Claude. Plan-2 review onward (this iteration's review and PHASE 1 / PHASE 3 reviews) uses all three CLIs. The omission is logged in `docs/learning/lessons.md` under AO-14:

> Multi-CLI design review must use all CLIs listed in AGENTS.md from iteration 1. The annotation-ui design saw 5 iterations with Codex + Claude only because the agent assumed civ-engine's 2-CLI list applied; aoe2's list is 3-CLI (Codex + Gemini + Claude). The full review came in 1 of 3 iterations on plan-1 catching the miss; convergence was unaffected because the design ACCEPT was already convergent across the 2 CLIs that did review, but future threads must use the full list from iteration 1.
