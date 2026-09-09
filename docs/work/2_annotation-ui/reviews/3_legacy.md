# Annotation UI — Design Iteration 4 Review (2026-04-29)

**Disposition:** Iterate (final tight pass). Both reviewers verified all iter-3 findings (N12-bis BLOCKER + N12-N18 majors/minors) are ADDRESSED. Claude says ACCEPT and recommends folding remaining items into PLAN; Codex says ITERATE. Convergent on the 4 substantive items, all paragraph-level — apply v5 corrections (small) to converge to ACCEPT and avoid having PLAN inherit unresolved spec ambiguity.

Reviewers: Codex (`gpt-5.5` xhigh — ITERATE, 4 majors), Claude (`claude-opus-4-7[1m]` max — ACCEPT, 2 PLAN-level majors + 4 minors).

## Iter-3 verification (convergent ADDRESSED)

| ID | Finding | Codex | Claude | Reference |
|---|---|---|---|---|
| N12-bis | ADR 9 example wouldn't run | ADDRESSED | ADDRESSED | §3 + ADR 9 — `world.getEntityRef`, non-generic `NewMarker`, `tick` omitted, `MemorySink({ allowSidecar: true })` default |
| N12 | `setPaused` haltState shape | ADDRESSED | ADDRESSED | ADR 10 — separate `pausedManually` flag |
| N13 | Bridge-swap rebind | ADDRESSED | ADDRESSED | §8 `rebuildAnnotationStack` extracted |
| N14 | civ-engine version | ADDRESSED | ADDRESSED | 0.8.10 → 0.8.11 across §1/§13/§14/ADR 9 |
| N15 | exportPriorSession algorithm | ADDRESSED | ADDRESSED | §5 reconstruction procedure — but see N20 below |
| N16 | Discard scope | ADDRESSED | ADDRESSED | §2 confirms manual Discard ships v0.1.5 |
| N17 | bridge.select shape | ADDRESSED | ADDRESSED | `void` everywhere |
| N18 | selectByRefs editorial | ADDRESSED | ADDRESSED | ADR 10 wording corrected |

Verified against code: `world.getEntityRef` at `civ-engine/src/world.ts:436`; `NewMarker` non-generic at `session-recorder.ts:33`; `'6.1.tick_future'` rejection at `session-recorder.ts:276-279`; civ-engine `package.json` at `0.8.10`; HUD `loadGame(blob: SaveBlob): void` at `createHudController.ts:69`; `saveLoadPanel.ts:218` toast fires synchronously after `loadGame`.

## Convergent MAJORS (v5 fix scope)

### N19 — `handleLoadGame` Promise<void> not propagated through HUD contract (both reviewers)

`createHudController.ts:69` declares `loadGame(blob: SaveBlob): void`; `saveLoadPanel.ts:207-218` calls it inside a sync `try/catch` and toasts "Game loaded." immediately. v4's `handleLoadGame: (blob) => Promise<void>` will:
- Surface async rejections from `prior.dispose()` and `rebuildAnnotationStack` as unhandled promise rejections.
- Toast "Game loaded." regardless of rebuild success.
- Provide no signal that load is in flight (Load button stays enabled).

**v5 fix:** widen the `HudBridge.loadGame` contract to `(blob: SaveBlob) => Promise<void>`. `saveLoadPanel` awaits + toasts on resolve / catches on reject. Listed as additive HUD work in ADR 10.

### N20 — `rebuildAnnotationStack` is not single-flight (both reviewers)

§8 wireup uses `let stack` reassigned inside `handleLoadGame`. With an `await` boundary between read of the cell and reassignment, two concurrent loads can both capture the same `prior` stack and race each other's disposal/construction. Loser's `recording`/`annotation`/`markerList` are orphaned (no dispose ever runs); `IndexedDBMirror` keeps writing for the loser.

**v5 fix:** add a `_pendingRebuild: Promise<AnnotationStack> | null` chain so concurrent `handleLoadGame` calls serialize. Each rebuild observes the prior fully-disposed stack. Combined with N19's button-disable, removes the hotkey window during async rebuild.

### N21 — `recording.stop()` rejection during dispose aborts rebuild (Codex MAJOR / Claude MINOR)

§8 `dispose()` order: `unsubscribePersistenceError(); annotation.dispose(); markerList.dispose(); await recording.stop();`. If `stop()` rejects (e.g., IDB write error during final flush), the rejection propagates → `rebuildAnnotationStack` rejects → `handleLoadGame` rejects. Annotation/markerList already disposed; no new stack constructed; user has working bridge but no annotation surface.

**v5 fix:** specify best-effort disposal — log + toast the stop failure, continue construction. One sentence in §8.

### N22 — `exportPriorSession` not byte-shape-equivalent for same-tick markers + initial-snapshot split (Codex MAJOR / Claude MINOR)

§5 step 8 sorts markers by tick. `MemorySink.toBundle()` returns `_markers.slice()` push-ordered by `writeMarker`. Reconstruction reads `session_markers` keyed by `[sessionId, markerId]` (UUID lex order); stable tick-sort preserves UUID order within tick, not call order. Two Alt+M in the same tick yield byte-different bundles.

Also: `MemorySink.toBundle()` puts the first snapshot in `initialSnapshot` and ongoing snapshots in `snapshots`; v4's reconstruction reads all from `session_snapshots`. Need to specify whether `session_snapshots` excludes the initial snapshot (the initial is in `session_meta.initialSnapshot`).

**v5 fix:** soften §5's "byte-shape-equivalent" claim — "shape-equivalent except for relative ordering of markers within the same tick (id-keyed in IDB)." Clarify: `session_snapshots` stores ONLY ongoing snapshots; initial snapshot lives in `session_meta.initialSnapshot` (matches the `MemorySink.toBundle()` shape).

## Plan-stage MINORs

### N23 — `pausedManually` step() ordering (Claude MINOR)

ADR 10 row says step() "gains a third gate `if (pausedManually) return;`" without specifying placement relative to `flushOutOfBandRenderChange()`. Render updates while paused must continue. v5 fix: ADR 10 row clarifies "added after `flushOutOfBandRenderChange()`."

### Hotkey closure window during rebuild (Claude MINOR; subsumed by N20 single-flight)

Naturally closed by N20's single-flight guard + N19's button-disable. No separate fix needed.

## Items considered, not flagged

- `bridge.world` exposure (carryover from iter-3) — both reviewers OK; aoe2 already permits world mutation via bridge.submit*; the read-only getter doesn't widen actual write surface.
- async `createApp()` carryover — verified the only consumer is `main.ts:8`.
- Default agent sink change is non-breaking in practice — no shipping consumer relies on the default throwing `oversize_attachment`.
- ADR 9 type-parameter shorthand (`<TEvent, TCommand>` vs actual `<TEventMap, TCommandMap>`) — editorial elision; acceptable.

## Disposition

**ITERATE → design-5 (paragraph-level).** v4 architecture is sound and addresses every iter-3 finding. v5 applies 5 paragraph-level fixes (N19-N23). Convergence trajectory is good: iter-2 had 6 BLOCKERS, iter-3 had 1 BLOCKER + 4 majors, iter-4 has 0 BLOCKERS + 4 majors (plan-stage). v5 should land a convergent ACCEPT and move to PLAN immediately.
