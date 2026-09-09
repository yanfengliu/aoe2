# Annotation UI — Design Iteration 2 Review (2026-04-29)

**Disposition:** Iterate. Codex 3 BLOCKERS + 2 majors + 2 minors. Claude 3 BLOCKERS + 3 majors + 2 minors. Both reviewers verified all iter-1 findings (B1-B5, M1-M7, K/E/G/H/L/Q/P/O) are now ADDRESSED, but the v2 redesign introduces new BLOCKERS that prevent the §1 RSI-loop premise and the basic recover-after-refresh use case.

Reviewers: Codex (`gpt-5.5` xhigh), Claude (`claude-opus-4-7[1m]` max).

## Iter-1 verification (convergent)

All iter-1 BLOCKERS (B1-B5) and majors (M1-M7) ADDRESSED in v2. Minors K/E/G/L/Q/P all ADDRESSED. Minor H (writeAttachment return) PARTIALLY ADDRESSED — sidecar default direction is right, but export re-embedding and MemorySink construction are underspecified (folded into N3/N4 below). Minor O Q4 (bridge selection refs) should be closed at design time, not deferred — both reviewers verified `selection.refs: EntityRef[]` already exists internally in `selectionInputOps.ts:237`; only the public getter needs adding.

## Convergent BLOCKERS (introduced by v2)

### N1 — Agent marker emission path is structurally impossible

Both reviewers BLOCKER. `AgentDriverContext` (civ-engine `ai-playtester.ts:22-35`) exposes only `{ world, tick, startTick, tickIndex }` — no recorder. `runAgentPlaytest` constructs its own recorder internally (`ai-playtester.ts:133`), and `world.__payloadCapturingRecorder` is exclusive (`session-recorder.ts:126-131`), so the agent cannot construct a side-recorder either. `recorder.addMarker` requires a connected recorder (`session-recorder.ts:270` `_assertOperational`), so a disconnected externally-held recorder won't work.

The v2 §3 claim "the agent injects its own marker emissions through the recorder it was constructed with" is not realizable with the current civ-engine surface. Without resolution, agents cannot annotate their own runs — the entire RSI loop premise of §1 breaks.

**What needs to change:** v3 must commit to either (a) a coordinated civ-engine extension (`AgentDriverContext.addMarker(input)` and `attach(blob, opts?)` delegating to the runner's internal recorder) shipped in the same drop, OR (b) a different agent path (e.g., `agent.report` returns marker payloads that a post-step merges in). Pick one and acknowledge the scope expansion explicitly.

### N2 — Hydration semantics produce a corrupt mixed-session bundle

Both reviewers BLOCKER. v2 §5: "On `start()`, `IndexedDBMirror.hydrate()` reads any prior session's records into a fresh `MemorySink` BEFORE the recorder connects to it." But `SessionRecorder` generates a new `randomUUID()` sessionId per construction (`session-recorder.ts:98`) and passes it to `_sink.open(initialMetadata)`. If hydrate pre-loads session-A records into MemorySink, then the recorder connects with session-B's metadata, the bundle's metadata.sessionId is session-B but tick/marker arrays mix session-A historical writes with session-B new writes. `toBundle()` then yields a bundle that fails any sane invariant (`startTick` from B, A's ticks below it, etc.).

v2 mixes "load prior for the panel" with "continue from where it left off" without picking one.

**What needs to change:** pick one of (a) prior bundle is read-only historical, displayed by panel but not extended; new launches always start a fresh recorder bundle; (b) hydration only runs when aoe2's saved-game `World` is restored AND sessionId matches; (c) IDB is purely a write-mirror for crash safety + export, never extended. Each has different IDB layout consequences. Recommend (c) — simplest, no mixed-session risk, prior bundles still recoverable via export.

### N3 — MemorySink default config drops every screenshot

Both reviewers BLOCKER. v2 §5 doesn't show explicit `new MemorySink({ allowSidecar: true })` construction. With defaults, every PNG screenshot above 64 KiB throws `SinkWriteError(code: 'oversize_attachment')` (verified at `session-sink.ts:177-183`), which trips `_handleSinkError` → `_terminated = true` → next `addMarker` throws `recorder_terminated`. The first screenshot kills the recorder for the rest of the session.

**What needs to change:** v3 must commit to `new MemorySink({ allowSidecar: true })` and either lift `sidecarThresholdBytes` (so under-cap PNGs embed as dataUrl) or accept that all screenshots route to sidecar. `IndexedDBMirror` must persist sidecar bytes via `session_attachments.bytes` so `readSidecar` round-trips after refresh.

## Convergent majors

### N4 — exportBundle re-embedding procedure unspecified

Both reviewers MAJOR. v2 §5 contract says "Blob (application/json) with the full bundle including base64-embedded attachments." `MemorySink.toBundle()` returns sidecar descriptors as `{ ref: { sidecar: true } }` without bytes. To produce a self-contained JSON, `exportBundle()` must walk attachments, call `sink.readSidecar(id)`, base64-encode, rewrite refs to `{ dataUrl: ... }`. Procedure isn't in the spec; downstream `BundleViewer` / `FileSink` consumers may not handle the rewritten shape.

**What needs to change:** v3 spells out the re-embedding loop in `exportBundle()` and confirms `BundleViewer` accepts the rewritten descriptor (Spec 4 explicitly handles dataUrl refs).

### N5 — MarkerListPanel click on stale ref silently corrupts selection

Both reviewers MAJOR (Claude lifts to BLOCKER-adjacent). v2 §7 click handler: "select first ref (entity if any, otherwise first cell)." For a marker with `refs.entities=[{id: X, generation: 0}]` where entity X has been replaced (current generation 1), `bridge.select([staleRef])` writes the stale ref into `selection.refs` (`selectionInputOps.ts:371`). Renderer reads stale state. v2 §10 covers this for the WRITE path (form save → addMarker validation throws); the READ path (panel click) is unhandled.

**What needs to change:** panel click must filter refs through `world.isCurrent` before passing to `bridge.select()`; if all refs are stale, fall back to first cell, then to no-op + toast "marker target no longer exists".

### N6 — Existing-aoe2-surface assumptions in §8 not verified

Both reviewers MAJOR. v2 §8 names `existingPauseControl`, `registerHotkey`, `panCameraTo`, `select`, `annotationFormUiHost` as pre-existing aoe2 surfaces. Grep returns no `pauseControl|setSpeed\(|registerHotkey|panCameraTo` matches under `src/`. ADR 6 calls out the bridge selection surface as additive; the same disclosure must apply to these. Either they exist elsewhere (HUD controller has private surfaces) or they're additional in-scope work.

**What needs to change:** v3 lists pause control, hotkey registry, camera-pan-to, select-from-refs, and form host as additive aoe2 surfaces in scope for v0.1.5, with shape/owner specified.

### N7 — `lastPersistenceError` has no UI path

Both reviewers MAJOR. v2 §10 says toast on IDB quota error, but `RecordingService` has no callback/status surface and the toast handle (`src/ui/hud/toast.ts` `ToastHandle.showToast`) is private to `createHudController`.

**What needs to change:** v3 specifies `RecordingService.onPersistenceError(handler): unsubscribe` (or equivalent observable surface) and the createApp wireup connects it to the HUD's toast handle. The toast handle is exposed by `createHudController` as part of its return value.

### N8 — Async startup is under-specified

Codex MAJOR. `RecordingService.start()` is async, but current `createApp(): Phaser.Game` and `main.ts` are synchronous. v2 doesn't pick a story.

**What needs to change:** v3 picks one — either (a) `createApp` returns `Promise<Phaser.Game>` and `main.ts` awaits it before mounting; or (b) `createApp` returns synchronously, the recording service starts in the background, and `AnnotationController.onHotkey()` early-returns until ready. Recommend (a) — simpler, single ready gate, matches the pattern used elsewhere.

## Minors

### N9 — ADR 6 understates bridge selection-surface change

Claude MINOR. 10+ files consume `getSelectedEntityIds(): number[]`. Adding `getSelectedEntityRefs(): EntityRef[]` as a parallel surface is mechanically straightforward; v3 should commit to "add parallel getter, do not replace" rather than defer to "confirm during implementation" (§16 Q4).

### N10 — JSON export shape ≠ FileSink/BundleCorpus directory

Codex MINOR. JSON-with-dataUrl-attachments is valid for `BundleViewer` after `JSON.parse`, but it is not a `FileSink`/`BundleCorpus` directory. v3 should state the intended downstream consumer (BundleViewer.openBundle accepts an in-memory `SessionBundle` object).

### N11 — 8 IDB stores adds future-migration surface

Claude MINOR. Per-stream stores fix write amplification but every schema bump touches 8 stores. Defensible; could simplify to `session_meta` + append-only `session_events` log keyed by `[sessionId, kind, sequence]`. Worth noting in the plan stage; not a blocker.

## Disposition

**ITERATE → design-3.** v3 must:

1. Commit to a concrete agent-marker emission mechanism that exists (or coordinate a small civ-engine extension as in-scope).
2. Pick one hydration semantic (recommend: IDB is crash-recovery + export only; no mid-session continuation).
3. Spell out `MemorySink({ allowSidecar: true })` + sidecar persistence path.
4. Spell out `exportBundle()` re-embedding loop.
5. Filter stale refs in `MarkerListPanel` click handler.
6. List pauseControl / hotkey registry / camera-pan / select-from-refs / form host as additive aoe2 surfaces in scope, with shape and owner.
7. Wire `lastPersistenceError` to HUD toast through an explicit callback surface.
8. Pick async `createApp` vs synchronous-with-deferred-ready and wire the choice.

If design-3 introduces no new BLOCKERS and addresses all of the above, move to PLAN. If consensus stalls, escalate to Tie-Breaker per AGENTS.md.
