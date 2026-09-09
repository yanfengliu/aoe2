# Annotation UI — Design Iteration 3 Review (2026-04-29)

**Disposition:** Iterate (tight scope). Both reviewers verified all 11 iter-2 findings (N1-N11) are ADDRESSED. Codex found one new BLOCKER (ADR 9 internal inconsistency — example would not actually work) plus 4 majors and 3 minors. Claude found 1 major (haltState shape) plus 3 minors. Reviewers converge on N12 (haltState) and N13 (bridge-swap rebind) and N14 (selectByRefs nonexistent) and N15 (exportPriorSession algorithm). v3 architecture is sound; the failures are paragraph-level corrections.

Reviewers: Codex (`gpt-5.5` xhigh), Claude (`claude-opus-4-7[1m]` max).

## Iter-2 verification (convergent ADDRESSED)

| ID | Finding | Codex | Claude | Reference |
|---|---|---|---|---|
| N1 | Agent marker emission impossible | ADDRESSED | ADDRESSED | ADR 9 + §1 — `AgentDriverContext` gains `addMarker` + `attach` |
| N2 | Hydration produces mixed-session bundle | ADDRESSED | ADDRESSED | ADR 1 (rewritten); fresh session always |
| N3 | MemorySink defaults drop screenshots | ADDRESSED (live path) | ADDRESSED | §5 explicit `new MemorySink({ allowSidecar: true })` for the LIVE recorder |
| N4 | exportBundle re-embedding unspecified | ADDRESSED | ADDRESSED | §5 "Re-embedding procedure" |
| N5 | Stale-ref click corrupts selection | ADDRESSED | ADDRESSED | §7 `onRowClick` filters via `world.isCurrent` |
| N6 | Existing-aoe2-surface assumptions unverified | ADDRESSED | ADDRESSED | ADR 10 lists each surface |
| N7 | `lastPersistenceError` no UI path | ADDRESSED | ADDRESSED | ADR 11 + §8 |
| N8 | Async startup story missing | ADDRESSED | ADDRESSED | ADR 11 + §8 |
| N9 | ADR 6 understates bridge change | ADDRESSED | ADDRESSED | ADR 6 (revised) |
| N10 | JSON shape vs FileSink | ADDRESSED | ADDRESSED | §5 names `BundleViewer.openBundle` |
| N11 | 8 IDB stores migration surface | ADDRESSED (acknowledged) | ACKNOWLEDGED | §16 Q5 |

ADR 9 c-bump rationale verified by Claude: grep over `civ-engine/src/` confirms `AgentDriverContext` is referenced only by `ai-playtester.ts` (the runner) and `index.ts` (re-export). No test stubs construct the ctx directly.

ADR 6 / §1 / ADR 10 surface-existence claims verified: `selection.refs: EntityRef[]` at `selectionInputOps.ts:25-28,237`; `world` instance held inside bridge at `createSimulationBridge.ts:128,161`; `haltState` exists at `createSimulationBridge.ts:210` (BUT see N12 — its shape is misstated).

## Convergent BLOCKER

### N12-bis — ADR 9 internal inconsistency: agent-marker example wouldn't actually run (Codex BLOCKER)

The ADR 9 example calls `ctx.addMarker({ tick: ctx.tick, ... })` and `ctx.attach({ mime, data })`. Two real bugs:

1. **`ctx.tick` semantics break `addMarker` validation.** `AgentDriverContext.tick = world.tick + 1` (the upcoming-tick decision-time value, per `ai-playtester.ts:159`). `SessionRecorder.addMarker` rejects `tick > world.tick` (`session-recorder.ts:276-280`, `MarkerValidationError code: '6.1.tick_future'`). An agent calling `ctx.addMarker({ tick: ctx.tick, ... })` would throw on every emit.

2. **Default agent sink rejects screenshots.** `runAgentPlaytest` constructs `const sink = config.sink ?? new MemorySink()` (`ai-playtester.ts:132`) — no `allowSidecar`. Agent screenshots > 64 KiB throw `oversize_attachment` and terminate the recorder, identical to N3 but on the agent path.

3. **Example uses non-existent API.** `ctx.world.currentRef(id)` is not a `World` method; the actual API is `world.getEntityRef(id)` and `world.isCurrent(ref)`. `NewMarker` is also not generic in current civ-engine — `NewMarker<TEvent, TCommand>` doesn't compile.

**What needs to change:** ADR 9 must (a) document that callers should omit `input.tick` so the recorder defaults to `world.tick` (or use `ctx.tick - 1`); (b) extend `runAgentPlaytest` so its default sink is `new MemorySink({ allowSidecar: true })`, OR add a `sinkOptions: MemorySinkOptions` config field; (c) fix the example code to use real APIs (`world.getEntityRef`, non-generic `NewMarker`).

## Convergent MAJORS

### N12 — ADR 10 misstates `haltState.halted` (both reviewers)

ADR 10's `bridge.setPaused(boolean)` row says it "flips the existing internal `haltState.halted` flag (currently driven only by match outcome)." Both claims are wrong:

1. `haltState.halted` is `EngineHaltDetails | null` (a structured failure descriptor with `tick / phase / code / systemName / message`), NOT a boolean. Setting it to a truthy value on manual pause requires synthesizing a fake `EngineHaltDetails`, which then surfaces through `getHudState().engineHalted` — every Alt+M would look like a tick failure.
2. `haltState` is set inside `tryTick` on `WorldTickFailureError`, NOT by match outcome. Match outcome is a separate gate at `createSimulationBridge.ts:227`.

**What needs to change:** ADR 10 must specify a parallel `pausedManually: boolean` flag on bridge state (or tagged-union `haltState`). `step()` gains a third early-return: `if (pausedManually) return;`. HUD's `engineHalted` continues to reflect failure-halt only.

### N13 — Bridge-swap re-binding is hand-waved across four components (both reviewers)

§8's "Bridge swap on load (FU5)" hand-waves the rebind across `RecordingService` (rebuilt), `AnnotationController`, `MarkerListPanel`, and the `onPersistenceError` subscription. The "mutable cells like the existing bridge cell" pattern doesn't actually work for `recording` because:
- `AnnotationControllerConfig.recording` is a direct reference, not a `() => RecordingService` getter — re-binding requires reconstructing the controller.
- `recording.onPersistenceError(handler)` returns an unsubscribe; old subscription must be unsubscribed before the new RecordingService is wired or every IDB error fires twice.
- `MarkerListPanelConfig.recording` is captured similarly.

**What needs to change:** v4 picks one — recommend extracting `rebuildAnnotationStack(newBridge): { recording, annotation, panel, unsubscribePersistenceError }` helper called from both initial wireup and `handleLoadGame`. Each rebuild calls `dispose()` on the prior controllers + unsubscribe before constructing the new ones.

### N14 (Codex) — Stale civ-engine version target

Codex flagged: civ-engine `package.json` is already at `0.8.10` (as of v0.8.9 → 0.8.10 process-only AGENTS bump). v3's "civ-engine v0.8.10 ships ADR 9" is stale; the next c-bump is `0.8.11`.

**What needs to change:** v4 updates §1 / §13 / §14 / ADR 9 to say `0.8.10 → 0.8.11`.

### N15 — `exportPriorSession()` reconstruction algorithm (both reviewers)

§5 says "for a prior session, reconstruct from the IDB stores (session_meta + session_ticks + ...)." Adequate for design phase but the assembly must produce a `SessionBundle` shape-identical to `MemorySink.toBundle()`'s output. Need either a paragraph-level algorithm or an explicit defer-to-PLAN with the constraint "must produce a `SessionBundle` byte-shape-equivalent to `MemorySink.toBundle()`."

## Minors

### N16 (Codex) — Discard scope contradiction

§2 says v0.1.5 leaves "automatic prior-session deletion / TTL" to v0.1.6 — but §5 contract and §7 panel both ship `discardPriorSession` + `[Discard]` buttons. Self-contradictory.

**What needs to change:** v4 picks. Recommend keep Discard in v0.1.5 (small surface, prevents IDB bloat from accumulated dev-time sessions) — update §2 to clarify "no automatic discard / TTL" while manual discard ships.

### N17 — `bridge.select(refs)` return shape inconsistent (both reviewers)

§7 types `bridge.select(refs: EntityRef[]): void`. ADR 10 says `(refs: readonly EntityRef[]): boolean`. The row handler ignores any return. Pick one.

**What needs to change:** v4 makes them consistent. Recommend `void` to mirror the existing internal helpers and the MarkerListPanel pre-filter pattern; the boolean-on-failure case can't happen because callers pre-filter.

### N18 (Claude) — `selectByRefs` doesn't exist

ADR 10 says `bridge.select(refs)` "delegates to existing internal `selectByRefs`." There is no such helper. Editorial fix: change wording to "calls a small new helper that maps refs → ids via `getCurrentEntityId(ref)` and calls `selectUnitIds(ids)`."

## Items considered, not flagged

- **`bridge.world` exposure** — both reviewers OK with it; the alternative (wrap every internal method) is verbose for three internal consumers.
- **Polling vs observer in `MarkerListPanel`** — 1-second polling on bounded marker list is cheap; observer is v0.1.6+.
- **Schema-mismatch disposition** (list + disabled Export, not auto-discard) — both reviewers agree this is correct; auto-discard would lose user data.
- **`AgentDriverContext` adding required methods as c-bump** — both reviewers verified no shipping consumer constructs the ctx; c-bump is correct.

## Disposition

**ITERATE → design-4 (tight).** v3 architecture is sound and addresses every iter-2 finding. The failures are paragraph-level:

1. ADR 9: fix example tick semantics + default agent sink + use real APIs (BLOCKER).
2. ADR 10: replace `setPaused → haltState.halted` with separate `pausedManually` flag (MAJOR).
3. §8: extract `rebuildAnnotationStack` helper for load-game (MAJOR).
4. §1 / §13 / §14 / ADR 9: bump civ-engine target from 0.8.10 → 0.8.11 (MAJOR).
5. §5: spell out or explicitly defer `exportPriorSession` reconstruction algorithm (MAJOR).
6. §2 vs §5/§7: pick on Discard scope; recommend keep in v0.1.5 (MINOR).
7. ADR 10 / §7: make `bridge.select(refs)` return shape consistent (MINOR).
8. ADR 10: editorial fix on `selectByRefs` wording (MINOR).

If design-4 lands these, expect convergent ACCEPT and move to PLAN.
