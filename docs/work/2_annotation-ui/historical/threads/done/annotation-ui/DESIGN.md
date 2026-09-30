# Annotation UI — Design Spec

**Status:** Accepted v5 (2026-04-29). Convergent ACCEPT across Codex + Claude per `2026-04-29/design-5/REVIEW.md`. Two inline corrections applied in v5 (cell-scoped `_pendingRebuild`, ADR 10 editorial fix). Ready for PLAN.

v5 deltas from v4 are paragraph-level fixes (N19-N23) on bridge-swap robustness and reconstruction byte-shape:

- **`HudBridge.loadGame` widened to `Promise<void>`** so async rejections from `prior.dispose()` and `rebuildAnnotationStack` reach the existing `saveLoadPanel` toast path. Per N19. Listed in ADR 10 as additive HUD work.
- **`rebuildAnnotationStack` is single-flight** via a `_pendingRebuild: Promise<AnnotationStack> | null` chain so concurrent `handleLoadGame` calls serialize. Each rebuild observes the prior fully-disposed stack. Per N20.
- **Best-effort `dispose()`** on `recording.stop()` rejection: log + toast, continue construction. Per N21.
- **Reconstruction byte-shape claim softened** — "shape-equivalent except for relative ordering of multiple markers within the same tick (id-keyed in IDB, not call-ordered)." Clarified that `session_snapshots` stores ONLY ongoing snapshots; the initial snapshot lives in `session_meta.initialSnapshot`. Per N22.
- **`pausedManually` placement** clarified — added AFTER `flushOutOfBandRenderChange()` in `step()` so render projections continue to flow while paused. Per N23.

v4 deltas from v3 (preserved for context):

v4 deltas from v3 (paragraph-level corrections; architecture unchanged):

- **civ-engine target bumped 0.8.10 → 0.8.11** because civ-engine `package.json` is already at 0.8.10 (a process-only AGENTS bump). The ADR 9 surface extension is the next c-bump.
- **ADR 9 example fixed.** Agent-marker emit calls `ctx.addMarker` WITHOUT `tick` (recorder defaults to `world.tick`); the v3 example used `ctx.tick` (= `world.tick + 1`) which `recorder.addMarker` rejects with `MarkerValidationError code: '6.1.tick_future'`. Real APIs used: `world.getEntityRef(id)` (not `currentRef`); non-generic `NewMarker`. ADR 9 also extends `runAgentPlaytest`'s default sink to `new MemorySink({ allowSidecar: true })` so agent screenshots don't terminate the recorder (parity with the live path).
- **ADR 10 `setPaused` re-spec'd.** v3 said `setPaused` flips `haltState.halted` — wrong, that field is `EngineHaltDetails | null` (a structured failure descriptor) and is set on `WorldTickFailureError`, not match outcome. v4 introduces a separate `pausedManually: boolean` flag on bridge state; `step()` gains a third early-return; `getHudState().engineHalted` continues to reflect failure-halt only.
- **§8 `rebuildAnnotationStack(newBridge)` helper.** v3 hand-waved the bridge-swap rebind. v4 extracts a single helper called from both initial wireup and `handleLoadGame` that constructs `{ recording, annotation, panel, unsubscribePersistenceError }` and disposes the prior set.
- **§5 `exportPriorSession()` reconstruction algorithm spelled out** (deterministic stream-iteration order keyed by tick / sequence; required-row error semantics; no-op for partial prior sessions).
- **Discard scope clarified.** v3 §2 said TTL/auto-deletion is v0.1.6, but §5/§7 included `discardPriorSession` + `[Discard]` button. v4 keeps manual Discard in v0.1.5 (small useful surface for IDB hygiene); §2 clarifies "no automatic TTL" while manual discard ships.
- **`bridge.select(refs)` shape consistent.** v3 typed it `void` in §7 and `boolean` in ADR 10. v4 settles on `void` (matches MarkerListPanel's pre-filter pattern; never called with stale refs).
- **ADR 10 `select` editorial fix** — drops nonexistent "delegates to `selectByRefs`" claim; says "calls a small new helper that maps refs → ids via `getCurrentEntityId(ref)` and calls `selectUnitIds(ids)`."

v3 deltas from v2 (preserved for context):

- **Coordinated two-repo change.** civ-engine extends `AgentDriverContext` with `addMarker(input)` + `attach(blob, opts?)` and changes the default agent sink to `MemorySink({ allowSidecar: true })` (purely additive, ships as civ-engine v0.8.11). aoe2 v0.1.5 consumes the extended context. The earlier v2 claim "civ-engine unchanged" is replaced with this scoped extension. Per ADR 9.
- **IDB persistence is write-only (no hydration into the live recorder).** The mixed-session corruption bug from v2 §5 is removed: `start()` always begins a fresh session. Prior sessions stay queryable for inspection + export via a new `RecordingService.listPriorSessions()` / `exportPriorSession(id)` surface and a "Prior Sessions" section in `MarkerListPanel`. Per ADR 1 (rewritten) + ADR 2.
- **Explicit `MemorySink({ allowSidecar: true })` + sidecar persistence path.** Screenshots over the threshold route to sidecar; `IndexedDBMirror` persists sidecar bytes; `exportBundle()` re-embeds them as base64 dataUrls before producing the JSON Blob. Per ADR 1.
- **Stale-ref filter in `MarkerListPanel` row click.** Click handler validates each ref via `world.isCurrent` before passing to `bridge.select`; if all refs stale, falls back to first cell, then no-op + toast. Per §7.
- **Additive aoe2 surfaces named with shape and owner.** `PauseControl`, `HotkeyRegistry`, `panCameraTo`, `bridge.select(refs)`, `bridge.getSelectedEntityRefs()`, `AnnotationFormUiHost`, and the toast handle are all listed as in-scope additive aoe2 work in ADR 10.
- **`onPersistenceError(handler)` observable on `RecordingService`** wired to the HUD's existing toast handle. Per ADR 11.
- **Async `createApp(): Promise<Phaser.Game>`.** `main.ts` awaits it before mounting. Recording is started before any tick runs. Per ADR 11.
- **Bridge gains `getSelectedEntityRefs(): readonly EntityRef[]`** as a parallel surface to the existing `getSelectedEntityIds()`. Per ADR 6 (revised; no longer deferred to "confirm during implementation").

Multi-CLI design review complete: `docs/threads/current/annotation-ui/2026-04-29/design-5/REVIEW.md` (ACCEPT). Implementation plan draft will land under `docs/threads/current/annotation-ui/PLAN.md`.

**Scope:** civ-engine roadmap Spec 2 (Game-Side Annotation UI), implemented for aoe2. v0.1.5 is capture-only: humans + agents emit markers; bundle persists to IndexedDB; manual export. A `MarkerListPanel` shows the current session's markers with click-to-pan-and-pause-at-tick (no replay scrubbing yet) plus a Prior Sessions list for crash recovery. Replay surface deferred to v0.1.6 (Spec 2.1 — needs bridge-snapshot work first).

**Author:** aoe2 team.

**Coordinated drop:**
- civ-engine v0.8.11 — additive extension to `AgentDriverContext` (`addMarker` + `attach` methods) + default sink change to `new MemorySink({ allowSidecar: true })` (~10 lines of change in `src/ai-playtester.ts`; corresponding test). Ships first.
- aoe2 v0.1.5 — consumes the extended context; bumps the `civ-engine` `file:` dependency to the v0.8.11 build.

**Related primitives:**
- civ-engine: `Marker`, `MarkerKind`, `MarkerProvenance`, `MarkerRefs`, `EntityRef`, `SessionRecorder`, `SessionBundle`, `SessionSink + SessionSource`, `MemorySink`, `AgentDriver` (Spec 9), `runAgentPlaytest` (Spec 9), `AgentDriverContext.addMarker / attach` (NEW, v0.8.11).
- aoe2: existing selection state and bridge layer (`src/game/simulation/`), Phaser renderer, `createWorld.ts`, HTML overlay UI (`src/ui/`), bootstrap (`src/app/bootstrap/createApp.ts`), HUD toast handle (`src/ui/hud/toast.ts`).

## 1. Goals (v0.1.5 capture-only)

The recursive-self-improvement loop runs as: **agent plays AOE → agent emits markers when it notices something interesting → human inspects markers (in-game list panel + manual bundle export → external `BundleViewer`) → human fixes / re-prompts / iterates → next agent run**. v0.1.5 ships the capture half + a minimal in-game inspect surface. v0.1.6 will add replay scrubbing once bridge-snapshot work makes it possible.

Concretely for v0.1.5:

- A `RecordingService` lifecycle in aoe2 that auto-starts a `SessionRecorder` at game launch, persists the bundle to IndexedDB asynchronously (browser-native mirror over a sync `MemorySink`), exposes a one-call manual export, and surfaces prior sessions for inspection + export after a refresh/crash.
- A human annotation flow: hotkey `Alt+M` → resolves current selection to `MarkerRefs` (with proper `EntityRef.generation` from the bridge) → pauses the game → modal form with text + severity + category + optional screenshot → save calls `RecordingService.addMarker(...)` → game resumes.
- An agent annotation path: agents that drive aoe2 use civ-engine Spec 9's `runAgentPlaytest` (v0.8.11). The agent's `decide(ctx)` callback receives an extended `AgentDriverContext` exposing `addMarker(input): string` and `attach(blob, opts?): string`, both delegating to the runner's internal recorder. The runner's default sink is `new MemorySink({ allowSidecar: true })` so agent screenshots don't terminate the recorder. aoe2's `RecordingService` does NOT participate in agent-driven runs; bundles share the same shape and are consumable by Spec 4's `BundleViewer`.
- A minimal in-game `MarkerListPanel` (toggle `Alt+L`): bottom-right side panel listing the current session's markers (tick-desc) AND a collapsible "Prior Sessions" section listing prior `sessionId`s with timestamps + per-row export button. Current-session row click → pause game + pan camera to first valid ref + select valid entity refs (stale refs filtered).
- A shared `aoe2/src/game/annotations/` primitives module: `markerSchema` types, `selectionToRefs` resolver, `captureScreenshot` helper. Used by the human path; agent path uses civ-engine's extended `AgentDriverContext` directly.

The deliverable is one coherent commit on aoe2 main (services, UI, tests, docs, version bump, Vite alias for `node:crypto`) plus a one-commit civ-engine v0.8.11 drop. Both repos' standard gates pass before merge.

## 2. Non-Goals (v0.1.5)

- **No replay scrubber, no timeline UI, no `ReplayController`** in v0.1.5. Deferred to v0.1.6 because aoe2's bridge state + visibility state are not in `WorldSnapshot`. v0.1.6 plans called out as Future Spec §15.
- **No region lasso, suggested-path arrow, freehand scribble.** v1 minimal gestures only.
- **No cross-session bundle browser, no remote sync, no multi-tab arbitration** (each tab gets a unique `sessionId` so concurrent writes don't collide; no UX for browsing other tabs' sessions).
- **No marker editing / deletion.** Markers are append-only — matches civ-engine's immutable `Marker`.
- **No automatic prior-session deletion or TTL.** Prior sessions accumulate in IDB and require manual discard via the `[Discard]` button per row (which ships in v0.1.5 — see §5 `discardPriorSession` and §7). Automatic cleanup, LRU caps, and quota-driven eviction are deferred (v0.1.6+).
- **No agent SDK / LLM client.** civ-engine Spec 9's `AgentDriver` contract is what aoe2-targeted agents implement; aoe2 hosts the live game.

## 3. Architecture (v0.1.5)

```
civ-engine/src/ai-playtester.ts        ← (extend) AgentDriverContext gains addMarker / attach
                                         (v0.8.11 additive; existing AgentDriver implementations unaffected)

aoe2/src/game/annotations/             ← shared primitives module
  markerSchema.ts                      AOE-side marker shape, severity/category enums, type guard
  selectionToRefs.ts                   bridge selection state → MarkerRefs (with generations)
  captureScreenshot.ts                 Phaser canvas → Uint8Array PNG
  index.ts

aoe2/src/game/recording/               ← write-side services
  IndexedDBMirror.ts                   Async mirror: writes MemorySink contents to IDB; reads prior sessions
  RecordingService.ts                  recorder lifecycle, MemorySink + IndexedDBMirror, export, prior-sessions API
  AnnotationController.ts              human gesture flow (hotkey, pause, form, save)

aoe2/src/game/control/                 ← additive control surfaces (in scope, see ADR 10)
  PauseControl.ts                      pause()/resume()/isPaused() + speed remembering
  HotkeyRegistry.ts                    key+mod registration with text-input-focus suppression

aoe2/src/ui/annotation/                ← UI components (HTML overlay)
  AnnotationForm.ts                    modal form (text, severity, category, screenshot, save/cancel)
  MarkerListPanel.ts                   bottom-right panel: current-session markers + prior-sessions list

aoe2/src/app/bootstrap/createApp.ts    ← (modify) async; awaits RecordingService.start()
aoe2/src/main.ts                       ← (modify) awaits createApp(); mounts on resolve

aoe2/vite.config.ts                    ← (modify) alias 'node:crypto' → browser shim
```

**Data flow — write (human):**

```
Player hits Alt+M
  → hotkeyRegistry suppresses if a text input has focus (early return)
  → AnnotationController.onHotkey()
  → reads bridge.getSelectedEntityRefs() — additive parallel getter alongside existing getSelectedEntityIds
  → selectionToRefs(refs) → MarkerRefs { entities }
  → if entity refs empty: refs = { tickRange: { from: world.tick, to: world.tick } }
  → pauseControl.pause() (halts bridge ticking; remembers prior state for resume)
  → AnnotationForm.open(refs) modal
  → on save:
      → if checkbox set: captureScreenshot() → Uint8Array
                       → recording.attachScreenshot(bytes) → attachmentId
      → recording.addMarker({
            kind: 'annotation',
            text,
            refs,
            data: { author: 'human', severity, category },
            attachments: attachmentId ? [attachmentId] : undefined,
          })
      → pauseControl.resume()
      → form closes
  → on cancel:
      → pauseControl.resume()
      → form closes
```

**Data flow — write (agent, OUT of aoe2's runtime scope):**

Agent runs use civ-engine Spec 9's `runAgentPlaytest({ world, agent, maxTicks, sink? })`. v0.8.11 extends `AgentDriverContext` so the agent can emit markers + attach blobs through the runner's recorder:

```ts
import type { AgentDriver, NewMarker, EntityRef } from 'civ-engine';

const agent: AgentDriver = {
  async decide(ctx) {
    if (interestingThingDetected(ctx.world)) {
      const screenshotId = ctx.attach({ mime: 'image/png', data: somePng });
      // Resolve entity refs through the engine's getEntityRef API; null
      // returned for entities that no longer exist (race vs respawn).
      const ref: EntityRef | null = ctx.world.getEntityRef(stuckUnitId);
      // Omit `tick` — recorder defaults to `world.tick` which is the latest
      // completed tick. Setting tick = ctx.tick would be `world.tick + 1`,
      // which `recorder.addMarker` rejects with `MarkerValidationError
      // code: '6.1.tick_future'`.
      const input: NewMarker = {
        kind: 'annotation',
        text: 'Pathfinding got stuck',
        refs: ref ? { entities: [ref] } : { tickRange: { from: ctx.world.tick, to: ctx.world.tick } },
        data: { author: 'agent', agentId: 'gpt-5.5', severity: 'bug', category: 'pathfinding' },
        attachments: [screenshotId],
      };
      ctx.addMarker(input);
    }
    return [];
  },
};
```

aoe2's `RecordingService` does NOT participate. Both bundles share `provenance: 'game'` and the `AoeMarkerData` schema; both consumable by `BundleViewer` and `runMetrics`.

**Data flow — read (in-game inspection, v0.1.5):**

```
Player hits Alt+L
  → MarkerListPanel.toggle()
  → renders current-session markers (sorted tick desc) + Prior Sessions section
  → on current-session row click:
      → pauseControl.pause()
      → first ref = first marker.refs.entities filtered through world.isCurrent
      → if found: bridge.panCameraTo(entityRef) + bridge.select([entityRef])
      → else if marker.refs.cells?.[0]: bridge.panCameraTo(cellPos)
      → else: no-op + toast 'marker target no longer exists'
      → (NO tick-jumping — that is v0.1.6 replay)
  → on prior-session expand:
      → reads recording.listPriorSessions() (cached after first read)
      → renders sessionId / recordedAt / startTick-endTick / markerCount / [Export] [Discard]
      → Export: recording.exportPriorSession(sessionId) → Blob → triggers download
      → Discard: confirms, then recording.discardPriorSession(sessionId)
```

## 4. Marker schema

civ-engine's `Marker` is unchanged. AOE extends via `marker.data` (JSON-typed):

```ts
// aoe2/src/game/annotations/markerSchema.ts

// civ-engine doesn't re-export JsonValue from index.ts; define a local equivalent
// to avoid a phantom import. Same shape.
export type AoeJsonValue =
  | string | number | boolean | null
  | AoeJsonValue[]
  | { [key: string]: AoeJsonValue };

export type AoeAuthor = 'human' | 'agent';
export type AoeSeverity = 'info' | 'warning' | 'bug' | 'blocker';
export type AoeCategory =
  | 'pathfinding' | 'combat' | 'economy' | 'ai' | 'ui' | 'perf' | 'general';

export interface AoeMarkerData {
  readonly [key: string]: AoeJsonValue;
  readonly author: AoeAuthor;
  /** Present iff author === 'agent'. */
  readonly agentId?: string;
  /** Default 'info'. */
  readonly severity?: AoeSeverity;
  /** Default 'general'. */
  readonly category?: AoeCategory;
}

export const DEFAULT_SEVERITY: AoeSeverity = 'info';
export const DEFAULT_CATEGORY: AoeCategory = 'general';

export function isAoeMarkerData(v: unknown): v is AoeMarkerData;
```

`MarkerKind`:
- `'annotation'` — default for both human and agent.
- `'assertion'` — agent flagging an invariant violation.
- `'checkpoint'` — known-good state for replay (used by v0.1.6 once replay lands).

`MarkerProvenance: 'engine' | 'game'` — always `'game'` from aoe2 / agent paths. `data.author` distinguishes within game-side.

**Screenshot attachments:** the marker references the screenshot by id via civ-engine's existing `Marker.attachments: string[]` (id list), NOT via `data.screenshotAttachmentId`. The bytes live in `bundle.attachments` (an `AttachmentDescriptor` with `ref: { sidecar: true }` for over-threshold PNGs, `{ dataUrl }` otherwise — see ADR 1). Including the screenshot id in `Marker.attachments` keeps it discoverable by generic bundle consumers (e.g., `BundleViewer`) without them having to know about AOE's data shape.

## 5. RecordingService contract

```ts
// aoe2/src/game/recording/RecordingService.ts
import type { World, SessionBundle, NewMarker, Marker } from 'civ-engine';
import type { AoeMarkerData } from '../annotations/markerSchema.js';

export interface RecordingServiceConfig {
  world: World;
  /** Session label written into bundle metadata. Default: 'aoe2-session-<ISO date>'. */
  sourceLabel?: string;
  /** Forwarded to SessionRecorder. Default: 1000. Null disables periodic snapshots. */
  snapshotInterval?: number | null;
  /** Skip IndexedDB mirror entirely (e.g., in tests). Default false. */
  inMemoryOnly?: boolean;
  /** Override the IDB database name (default: 'aoe2-sessions'). Tests use this for isolation. */
  databaseName?: string;
}

export interface PriorSessionDescriptor {
  readonly sessionId: string;
  readonly recordedAt: string;     // ISO 8601 from session_meta
  readonly startTick: number;
  readonly endTick: number;        // best-known endTick from the latest persisted tick row
  readonly markerCount: number;
  readonly schemaVersion: number;
  readonly closedNormally: boolean; // true iff session_meta.closed === true
}

export type PersistenceErrorListener = (err: Error) => void;

export class RecordingService {
  constructor(config: RecordingServiceConfig);

  /**
   * Always starts a FRESH recording session — never extends a prior session
   * (per ADR 1, mid-session continuation is out of scope; mixing prior records
   * with a new sessionId would corrupt the bundle). The IDB mirror begins
   * writing for the new sessionId. Async because IDB connection is async.
   * Throws on connect-time recorder failure (matching runSynthPlaytest /
   * runAgentPlaytest connect-time semantics).
   */
  start(): Promise<void>;

  isRecording(): boolean;

  /** Disconnect the recorder, mark session_meta.closed = true. The bundle
   *  remains queryable via bundle()/markers(); IDB mirror is drained first. */
  stop(): Promise<void>;

  /** Emit a marker for the live (human) session. Returns marker id. Agents
   *  use the extended AgentDriverContext from civ-engine v0.8.11 — they do NOT
   *  call this method. */
  addMarker(input: Omit<NewMarker, 'data'> & { data?: AoeMarkerData }): string;

  /** Returns the new attachment id. Used to populate Marker.attachments. */
  attachScreenshot(pngBytes: Uint8Array): string;

  /** Current bundle snapshot. Null before start() resolves. */
  bundle(): SessionBundle | null;

  /** Convenience: bundle.markers sorted by tick desc, for the panel. */
  markers(): readonly Marker[];

  /** Manual export of the CURRENT session. Re-embeds sidecar attachments as
   *  base64 dataUrls so the resulting JSON is self-contained (see §5
   *  Re-embedding procedure). Returns a Blob (application/json). */
  exportBundle(): Promise<Blob>;

  /** List prior sessions found in IDB (excluding the current session). Sorted
   *  recordedAt desc. Empty array if `inMemoryOnly` or IDB unavailable. */
  listPriorSessions(): Promise<readonly PriorSessionDescriptor[]>;

  /** Build a self-contained bundle Blob for a prior session (re-embeds sidecars).
   *  Throws if sessionId not found. */
  exportPriorSession(sessionId: string): Promise<Blob>;

  /** Delete a prior session's records from IDB. Throws if sessionId not found
   *  or if it matches the current sessionId (use stop() instead). */
  discardPriorSession(sessionId: string): Promise<void>;

  /** Subscribe to IDB persistence errors (quota, version mismatch on mid-session
   *  schema change, transaction abort). The HUD toast handle subscribes here.
   *  Returns an unsubscribe function. */
  onPersistenceError(listener: PersistenceErrorListener): () => void;
}
```

**Internal structure:**

- The `SessionRecorder` is constructed with a sync `MemorySink({ allowSidecar: true })`. The `allowSidecar: true` option is explicit and required: PNG screenshots commonly exceed the 64 KiB default threshold; without sidecar enabled, `MemorySink.writeAttachment` would throw `oversize_attachment` and terminate the recorder on the first screenshot (per civ-engine `session-sink.ts:177-183`). With sidecar enabled, oversize blobs are stored in `MemorySink._sidecars` and `AttachmentDescriptor.ref` is set to `{ sidecar: true }`. Under-threshold blobs still embed as `{ dataUrl }`.
- An `IndexedDBMirror` instance subscribes to `MemorySink` writes (via a thin "tee" wrapper that forwards each `writeTick` / `writeMarker` / `writeAttachment` call to both the in-memory sink and the IDB queue) and writes them to IndexedDB asynchronously, batched ~100ms. Sidecar bytes are persisted into `session_attachments.bytes` so they survive a refresh.
- Persistence errors are delivered to subscribers via `onPersistenceError(listener)`. The HUD wires its toast handle as a listener (see ADR 11).
- `start()` does NOT hydrate prior records into the live MemorySink. It only opens the IDB connection and registers the new sessionId; existing prior sessions are listable via `listPriorSessions()` but never touched by the live recorder.
- `exportBundle()` and `exportPriorSession(id)` follow the **Re-embedding procedure** below to produce a self-contained JSON Blob.

**Reconstruction procedure (`exportPriorSession`):**

For prior sessions (where `MemorySink.toBundle()` is unavailable), reconstruct a `SessionBundle` from the per-stream IDB stores. The output is **shape-equivalent** to `MemorySink.toBundle()` — same field set, same per-tick grouping — **except for relative ordering of multiple markers emitted in the same tick** (live `MemorySink` preserves call order via an array push; the IDB store keys markers by `[sessionId, markerId]` (UUID), so reconstruction yields markerId order within a tick). Functionally harmless: same set of markers, same per-tick grouping, just ordering of duplicates within a tick differs.

`session_snapshots` stores ONLY ongoing snapshots (those written by `SessionRecorder` at periodic intervals after the initial). The initial snapshot lives in `session_meta.initialSnapshot`, matching `MemorySink.toBundle()`'s split between `bundle.initialSnapshot` and `bundle.snapshots`.

1. Read `session_meta` for the requested `sessionId`. If missing → `throw new SessionNotFoundError(sessionId)`. If `schemaVersion !== SESSION_BUNDLE_SCHEMA_VERSION` → `throw new SchemaMismatchError(sessionId, schemaVersion, SESSION_BUNDLE_SCHEMA_VERSION)`.
2. `bundle.metadata = session_meta.metadata`; `bundle.initialSnapshot = session_meta.initialSnapshot`. If `initialSnapshot` is absent → `throw new IncompleteSessionError(sessionId, 'initial_snapshot_missing')`.
3. `bundle.ticks = await session_ticks.getAll([sessionId, _])` (key range scoped to sessionId), sorted ascending by `tick`.
4. `bundle.commands = await session_commands.getAll(...)` sorted ascending by `sequence`.
5. `bundle.executions = await session_executions.getAll(...)` sorted ascending by `sequence`.
6. `bundle.failures = await session_failures.getAll(...)` sorted ascending by `tick`.
7. `bundle.snapshots = await session_snapshots.getAll(...)` sorted ascending by `tick` (ongoing snapshots only — see split note above).
8. `bundle.markers = await session_markers.getAll(...)` sorted by `(tick asc, markerId asc)` — same-tick markers may be in different order than the live bundle (see byte-shape note above).
9. `bundle.attachments = await session_attachments.getAll(...).map(row => row.descriptor)` (without bytes; bytes accessed via the row's `bytes` field during re-embedding).
10. Skip duplicates: each store's primary key is `[sessionId, secondary]` so duplicates are impossible by construction; if encountered (corrupted store), prefer the row written most recently.

**Re-embedding procedure (`exportBundle` and `exportPriorSession`):**

1. Read the bundle: for the current session, `MemorySink.toBundle()` (sync); for a prior session, run the reconstruction procedure above.
2. For each `AttachmentDescriptor` in `bundle.attachments`:
   - If `descriptor.ref` has `dataUrl`: leave unchanged.
   - If `descriptor.ref.sidecar === true`: read bytes (current: `MemorySink.readSidecar(id)`; prior: read the `bytes` field of the `session_attachments` row keyed by `[sessionId, descriptor.id]`). If bytes missing → `throw new IncompleteSessionError(sessionId, 'sidecar_missing', { attachmentId: descriptor.id })`. Otherwise base64-encode and replace descriptor with `{ id, mime, sizeBytes, ref: { dataUrl: 'data:<mime>;base64,<b64>' } }`.
3. `JSON.stringify(rewrittenBundle)` → `new Blob([json], { type: 'application/json' })`.

The resulting Blob is consumable by `BundleViewer.openBundle(JSON.parse(text))` (Spec 4 viewer accepts dataUrl-shaped attachments). It is NOT a `FileSink` directory layout; v0.1.5's exported artifact is a single self-contained JSON file (downstream consumer is `BundleViewer`).

**IndexedDB layout:**

- Database: `aoe2-sessions` (version 1).
- Object stores:
  - `session_meta` keyed by `sessionId`: `{ sessionId, schemaVersion, metadata, initialSnapshot, createdAt, sessionStartTick, closed: boolean }`.
  - `session_ticks` keyed by `[sessionId, tick]`: per-tick `SessionTickEntry`.
  - `session_commands` keyed by `[sessionId, sequence]`: per-command `RecordedCommand`.
  - `session_executions` keyed by `[sessionId, sequence]`.
  - `session_failures` keyed by `[sessionId, tick]`.
  - `session_snapshots` keyed by `[sessionId, tick]`.
  - `session_markers` keyed by `[sessionId, markerId]`.
  - `session_attachments` keyed by `[sessionId, attachmentId]`: `{ descriptor, bytes: Uint8Array | null }` — `bytes` populated for sidecar attachments, `null` for dataUrl-embedded ones (the descriptor already carries the bytes).

Per-stream stores avoid write amplification (each tick appends a small record). Tradeoff: 8 stores ↔ migration surface (acknowledged in §16; for v0.1.5 the schema is fresh and no migrations exist yet).

**Schema migration policy on read:** when `listPriorSessions()` encounters a `session_meta.schemaVersion !== SESSION_BUNDLE_SCHEMA_VERSION` row, it returns it with the version on the descriptor. `exportPriorSession(id)` throws a typed error (`SchemaMismatchError`) if the prior schema differs — v0.1.5 does not migrate. The current session always writes the engine's current schema; mid-session schema changes (i.e., civ-engine version bump while IDB has older records) cannot corrupt the live recorder because hydration is gone (per ADR 1).

**`node:crypto` browser shim:** unchanged from v2. `aoe2/vite.config.ts` adds `resolve.alias: { 'node:crypto': '<repo>/src/shims/node-crypto.ts' }` (see ADR 7 and §3 wireup snippet). The shim is a 1-liner: `export const randomUUID = () => crypto.randomUUID();`. The Vite alias intercepts imports inside `node_modules/civ-engine/dist/` because `resolve.alias` matches all importers regardless of location (verified ADR 7).

## 6. AnnotationController + form

```ts
// aoe2/src/game/recording/AnnotationController.ts
import type { World, EntityRef } from 'civ-engine';
import type { Position } from '../simulation/types.js';

export interface AnnotationControllerConfig {
  recording: RecordingService;
  selection: SelectionRefSource;
  pauseControl: PauseControl;
  ui: AnnotationFormUiHost;
  worldRef: () => World;
}

export interface SelectionRefSource {
  /** Returns currently-selected entity refs WITH GENERATIONS. The bridge
   *  exposes this as a parallel getter alongside getSelectedEntityIds (per
   *  ADR 6). */
  getSelectedEntityRefs(): readonly EntityRef[];
}

export class AnnotationController {
  constructor(config: AnnotationControllerConfig);

  onHotkey(): void;          // bound by HotkeyRegistry to Alt+M
  onSubmit(input: AnnotationFormSubmission): Promise<void>;
  onCancel(): void;
  dispose(): void;
}

export interface AnnotationFormSubmission {
  text: string;
  severity: AoeSeverity;
  category: AoeCategory;
  captureScreenshot: boolean;
}
```

**Hotkey behavior (`Alt+M`):**

`HotkeyRegistry` (see ADR 10) handles the text-input-focus suppression; by the time `onHotkey()` is invoked, the registry has already filtered out keypresses on focused text inputs / contenteditables.

1. If recording is not started → toast warning "recording not ready", no-op.
2. Read `selection.getSelectedEntityRefs()`.
3. Build refs: `entities` from refs (skip empty array); if empty, `tickRange = { from: world.tick, to: world.tick }`.
4. `pauseControl.pause()` (halts bridge ticking; remembers prior state for resume).
5. `ui.openForm(refs)` with empty defaults.

**Form fields:**

| Field | Type | Default | Required |
|---|---|---|---|
| text | textarea, multiline | empty | yes (min 1 char) |
| severity | radio: info / warning / bug / blocker | info | yes |
| category | dropdown: pathfinding / combat / economy / ai / ui / perf / general | general | yes |
| captureScreenshot | checkbox | unchecked | no |
| Save / Cancel | buttons | — | — |

**Save flow:**

1. If `captureScreenshot`: `captureScreenshot()` → bytes → `recording.attachScreenshot(bytes)` → `attachmentId`. Capture failure → save marker without attachment, show toast.
2. Build `data: AoeMarkerData = { author: 'human', severity, category }`.
3. `recording.addMarker({ kind: 'annotation', text, refs, data, attachments: attachmentId ? [attachmentId] : undefined })`.
4. `pauseControl.resume()`.
5. `ui.closeForm()`.

If `addMarker` throws (recorder terminated, validation failure on stale ref, etc.) → toast with the error message, leave form open with text preserved, do NOT resume game until the user cancels.

**Cancel flow:** `pauseControl.resume()` + `ui.closeForm()`.

## 7. MarkerListPanel (read surface, v0.1.5)

```ts
// aoe2/src/ui/annotation/MarkerListPanel.ts
export interface MarkerListPanelConfig {
  recording: RecordingService;
  pauseControl: PauseControl;
  toast: ToastHandle;
  bridge: {
    panCameraTo(target: EntityRef | Position): void;
    select(refs: readonly EntityRef[]): void;   // pre-filtered through world.isCurrent by caller
  };
  worldRef: () => World;
}

export class MarkerListPanel {
  constructor(config: MarkerListPanelConfig);
  toggleVisibility(): void;     // bound by HotkeyRegistry to Alt+L
  isVisible(): boolean;
  refresh(): Promise<void>;      // re-read RecordingService + listPriorSessions, re-render
  dispose(): void;
}
```

UI: bottom-right side panel (HTML overlay).

**Current Session section** — each row:

```
[tick]  [severity icon]  [text snippet ≤ 60 chars]  [author badge]
```

Sorted by `tick` desc. Polls `recording.markers()` every second when visible (cheap; markers list is bounded by gameplay duration).

**Row click handler (stale-ref filter):**

```ts
async function onRowClick(marker: Marker) {
  pauseControl.pause();
  const world = worldRef();
  const validEntityRefs = (marker.refs.entities ?? []).filter((ref) =>
    world.isCurrent(ref),
  );
  if (validEntityRefs.length > 0) {
    bridge.panCameraTo(validEntityRefs[0]);
    bridge.select(validEntityRefs);
    return;
  }
  const firstCell = marker.refs.cells?.[0];
  if (firstCell) {
    bridge.panCameraTo(firstCell);
    return;
  }
  toast.showToast('marker target no longer exists in this world');
}
```

The validity check uses `world.isCurrent(ref)` (civ-engine `World.isCurrent` exists). Stale refs are silently dropped from the `bridge.select` argument. If ALL entity refs are stale AND there are no cells, the panel emits a toast and leaves selection unchanged.

**Prior Sessions section** (collapsed by default, expand chevron):

```
[recordedAt]  [sessionId-prefix-8]  [start-end ticks]  [marker-count]  [Export] [Discard]
```

Loaded lazily on first expand via `recording.listPriorSessions()`. Sessions with `closedNormally: false` get a small warning icon and tooltip ("session ended abnormally — likely browser refresh or crash"). Schema-mismatched sessions are listed with the version + a disabled Export button (tooltip explains the version skew). Discard is confirmed via a one-click prompt; Export streams the Blob to a download.

## 8. Wire-up

`aoe2/src/main.ts` (modify):

```ts
import { createApp } from './app/bootstrap/createApp.js';

void (async () => {
  try {
    await createApp();
  } catch (e) {
    console.error('[aoe2] createApp failed', e);
    document.body.textContent = `aoe2 failed to start: ${(e as Error).message}`;
  }
})();
```

`aoe2/src/app/bootstrap/createApp.ts` (modify) — becomes async:

```ts
export async function createApp(): Promise<Phaser.Game> {
  // ... existing seed parsing, gameRoot/hudRoot resolution unchanged ...

  let bridge: SimulationBridge = createSimulationBridge(seed);
  const bridgeRef = () => bridge;
  const pauseControl = createPauseControl(bridgeRef);  // re-resolves the live bridge after handleLoadGame swaps it
  const hotkeyRegistry = createHotkeyRegistry();

  // Per-createApp single-flight cell for rebuilds (closure-scoped, NOT module-scoped).
  let _pendingRebuild: Promise<AnnotationStack> | null = null;

  // Initial annotation stack. handleLoadGame replaces this cell on bridge swap.
  let stack: AnnotationStack = await rebuildAnnotationStack(
    bridgeRef, pauseControl, hudController, hudRoot, scene,
  );

  hotkeyRegistry.register({ key: 'm', alt: true }, () => stack.annotation.onHotkey());
  hotkeyRegistry.register({ key: 'l', alt: true }, () => stack.markerList.toggleVisibility());

  async function handleLoadGame(blob: SaveBlob): Promise<void> {
    bridge = createSimulationBridge(seed, { savedGame: blob });
    scene.setBridge(bridge);
    stack = await rebuildAnnotationStack(
      bridgeRef, pauseControl, hudController, hudRoot, scene, _pendingRebuild ?? stack,
    );
  }

  // ... existing Phaser game construction unchanged, plus:
  game.events.on('destroy', () => {
    void stack.dispose();
    hotkeyRegistry.dispose();
  });

  return game;
}
```

The annotation controller, marker panel, hotkey registry, pause control, and persistence-error handler are all wired before the Phaser game starts ticking. `await recording.start()` is the only async dependency; in tests with `inMemoryOnly: true` it resolves synchronously (next microtask).

**Bridge swap on load (FU5) — extracted helper:** `SessionRecorder` is bound to a specific `World` instance (it subscribes to `world.__payloadCapturingRecorder`). On load, `createSimulationBridge` constructs a new `World`, so the old recorder is dangling. The annotation stack (`recording`, `annotation`, `markerList`, `onPersistenceError` subscription) all hold direct references that need to be torn down + re-built together. v4 extracts a single helper called from both initial wireup and `handleLoadGame`. v5 adds **single-flight serialization** (concurrent `handleLoadGame` calls observe the prior fully-disposed stack via a chained promise) and **best-effort dispose** (a `recording.stop()` rejection is logged + toasted but does NOT abort construction of the new stack — the user keeps an annotation surface):

```ts
interface AnnotationStack {
  recording: RecordingService;
  annotation: AnnotationController;
  markerList: MarkerListPanel;
  unsubscribePersistenceError: () => void;
  dispose(): Promise<void>;
}

// Single-flight chain: every concurrent rebuild request observes the prior
// fully-disposed stack and serializes against any in-flight rebuild. The cell
// holds `Promise<AnnotationStack> | null`; concurrent callers chain off it.
// IMPORTANT: this cell is per-`createApp` invocation, declared inside the
// closure (see §8 wireup). Module-scoping it would let two concurrent
// `createApp` instances (HMR / multi-instance test harness) dispose each
// other's stacks. The signature below shows it as a parameter for clarity.

function rebuildAnnotationStack(
  bridgeRef: () => SimulationBridge,
  pauseControl: PauseControl,
  hudController: HudController,
  hudRoot: HTMLElement,
  scene: GameScene,
  prior?: AnnotationStack | Promise<AnnotationStack>,
): Promise<AnnotationStack> {
  const next = (async () => {
    if (prior) {
      const resolvedPrior = await prior;       // wait for any in-flight rebuild to finish first
      try {
        await resolvedPrior.dispose();
      } catch (e) {
        // Best-effort: log + toast but continue, so the user keeps an annotation surface.
        console.error('[aoe2] prior annotation-stack dispose failed', e);
        hudController.toastHandle.showToast(`recording cleanup failed: ${(e as Error).message}`);
      }
    }
    const recording = new RecordingService({ world: bridgeRef().world });
    await recording.start();
    const annotation = new AnnotationController({
      recording,
      selection: { getSelectedEntityRefs: () => bridgeRef().getSelectedEntityRefs() },
      pauseControl,
      ui: createAnnotationFormHost(hudRoot),
      worldRef: () => bridgeRef().world,
    });
    const markerList = new MarkerListPanel({
      recording,
      pauseControl,
      toast: hudController.toastHandle,
      bridge: {
        panCameraTo: (target) => scene.panCameraTo(target),
        select: (refs) => bridgeRef().select(refs),
      },
      worldRef: () => bridgeRef().world,
    });
    const unsubscribePersistenceError = recording.onPersistenceError((err) => {
      hudController.toastHandle.showToast(`recording: ${err.message}`);
    });
    return {
      recording, annotation, markerList, unsubscribePersistenceError,
      async dispose() {
        unsubscribePersistenceError();
        annotation.dispose();
        markerList.dispose();
        await recording.stop();
      },
    };
  })();
  _pendingRebuild = next;
  return next;
}
```

`handleLoadGame` is now `async (blob: SaveBlob): Promise<void>` (matching the widened `HudBridge.loadGame` contract from ADR 10):

1. Swap the `bridge` cell to the new one (existing FU5 logic).
2. `stack = await rebuildAnnotationStack(bridgeRef, pauseControl, hudController, hudRoot, scene, _pendingRebuild ?? stack)` — chains off any in-flight rebuild for serialization. The helper disposes the prior stack (best-effort, see above) and constructs a new one bound to the new bridge.
3. Hotkey closures already resolve `() => stack.annotation.onHotkey()` against the cell on every press, so re-registration is unnecessary; the new stack is observed automatically once the assignment completes.
4. The `saveLoadPanel` consumer awaits this Promise and toasts "Game loaded." on resolve / a failure toast on reject.

The `saveLoadPanel`'s Load button is disabled between click and `handleLoadGame` resolution to prevent re-entry; the single-flight chain makes the guard belt-and-braces (correctness doesn't depend on the UI gate).

Outcome: each save/load creates a session boundary in IDB. The user sees the prior session listed in MarkerListPanel's Prior Sessions section after the load completes. v0.1.6 may revisit this if replay needs cross-load continuity.

## 9. ADRs

### ADR 1 (revised): IDB persistence is a write-only mirror over a sync `MemorySink({ allowSidecar: true })`; no mid-session continuation

**Decision:** `RecordingService` constructs `SessionRecorder` with `new MemorySink({ allowSidecar: true })`. `IndexedDBMirror` writes the same data to IndexedDB asynchronously, batched ~100ms, including sidecar bytes for over-threshold attachments. `recorder.lastError` reflects `MemorySink` failures (rare with `allowSidecar`); `RecordingService.onPersistenceError(listener)` delivers IDB failures to subscribers (with a separate lifecycle from `recorder.lastError`). On `start()`, the recorder always begins a fresh session — prior records in IDB are NOT loaded into the live `MemorySink`.

**Rationale:** Two prior issues are resolved together:

1. v2's claim that `MemorySink` writes "essentially never fail" is false for attachments: the default 64 KiB threshold rejects most PNG screenshots unless `allowSidecar: true` is passed (verified `session-sink.ts:177-183`). Without it, the first screenshot would terminate the recorder. Explicit `allowSidecar: true` routes oversize blobs to sidecar storage and `IndexedDBMirror` persists them.
2. v2's "hydrate prior session into MemorySink before recorder connects" produces a corrupt mixed-session bundle: the new recorder mints its own sessionId via `randomUUID()` on construction (`session-recorder.ts:98`), so prior records would carry session-A metadata in the in-memory store while the recorder writes session-B's metadata via `_sink.open()`. `toBundle()` would yield a bundle whose `metadata.sessionId` is B but tick array starts at A's ticks. Dropping hydration eliminates the contradiction.

**Tradeoff:** prior session bundles are not auto-restored into the live game. Recovery is opt-in via `MarkerListPanel`'s Prior Sessions section (export to JSON, optionally re-open in BundleViewer).

### ADR 2: `IndexedDBMirror` exposes `listPriorSessions` / `exportPriorSession` / `discardPriorSession` instead of acting as a `SessionSource`

**Decision:** The mirror is write-only at runtime. It also surfaces a read API for prior-session inspection: `listPriorSessions()`, `exportPriorSession(id)`, `discardPriorSession(id)`. These reads do not flow into a live recorder; they construct a `SessionBundle` for a given prior `sessionId` and return it (or a self-contained Blob) on demand. After the per-session reads, the mirror does not retain the in-memory copy.

**Rationale:** `SessionSource` is fully synchronous (`readSnapshot`, `readSidecar`, iterator getters, `toBundle()`); async IDB cannot satisfy it. ADR 1 removes the mid-session hydration use case. The remaining read use cases (export prior session, list prior sessions) are async-by-nature (UI-triggered) and do not need to satisfy the sync `SessionSource` contract — they each produce a fresh `SessionBundle` value when invoked.

### ADR 3 (unchanged): aoe2's `RecordingService` is for the LIVE world only; agents use Spec 9's `runAgentPlaytest`

**Decision:** Agents that drive aoe2 do so via `runAgentPlaytest({ world, agent, ... })` (civ-engine Spec 9), which constructs its OWN `SessionRecorder`. aoe2's `RecordingService` does NOT participate in agent-driven runs. The two recorders produce identical `SessionBundle` shapes; `BundleViewer` and `runMetrics` consume both transparently.

**Update (v3+):** ADR 9 below extends `AgentDriverContext` with `addMarker` + `attach` methods (civ-engine v0.8.11) so the agent can emit markers + attach blobs through the runner's recorder during `decide(ctx)`. This resolves the v2 review's N1 BLOCKER ("agent marker path structurally impossible") without violating ADR 3 — the agent still uses Spec 9's recorder, just via a richer ctx surface.

### ADR 4 (unchanged): Replay scrubber + timeline UI deferred to v0.1.6 (Spec 2.1)

**Decision:** v0.1.5 has no `ReplayController`, no `TimelinePanel`. Read surface in v0.1.5 is `MarkerListPanel` with click-to-pan-and-pause (no tick-jumping) plus the Prior Sessions list. v0.1.6 will add replay once aoe2 bridge state + visibility are snapshot-able and a `createReplayWorld(snapshot)` factory exists. Future Spec §15.

### ADR 5 (unchanged): Marker `data` carries AOE-specific schema; screenshots use `Marker.attachments`

**Decision:** civ-engine's `MarkerProvenance: 'engine' | 'game'` is unchanged. AOE distinguishes human vs agent and severity / category via `marker.data: AoeMarkerData`. Screenshot attachment ids go in `Marker.attachments: string[]`, NOT in `data`. Generic consumers (`BundleViewer`, `runMetrics`) discover screenshots without knowing AOE's data shape.

### ADR 6 (revised): Bridge surfaces selection as `EntityRef[]` (with generations) via a parallel getter

**Decision:** Add `bridge.getSelectedEntityRefs(): readonly EntityRef[]` as a parallel getter to the existing `bridge.getSelectedEntityIds(): number[]`. The existing surface is unchanged; the new getter exposes the already-tracked `selection.refs` array (`selectionInputOps.ts:237`) directly. `selectionToRefs` consumes the new getter; existing consumers of `getSelectedEntityIds` are untouched.

**Rationale:** v2 §16 Q4 said "confirm during implementation"; the v2 review pointed out 10+ files consume the existing id-only getter. Adding a parallel getter rather than replacing the existing one keeps the change strictly additive and stays out of the type plumbing of those consumers. Verified at design time: `selection.refs: EntityRef[]` already exists internally (`selectionInputOps.ts:237`); only the public exposure is new.

### ADR 7 (unchanged): `node:crypto` resolved via Vite alias

**Decision:** `aoe2/vite.config.ts` aliases `'node:crypto'` to `src/shims/node-crypto.ts` (1-line `crypto.randomUUID` re-export). Vite's `resolve.alias` matches imports in `node_modules/civ-engine/dist/` regardless of importer location, so the shim resolves for civ-engine's bundled code.

### ADR 8 (unchanged): Hotkeys are chord-based (`Alt+M` / `Alt+L`)

**Decision:** `Alt+M` for annotate, `Alt+L` for marker list. Bare `M` reserved (Mill construction). Chord hotkeys leave the alphabet free for game commands. Verified `Alt` unused elsewhere in `src/ui/`.

### ADR 9 (NEW): `AgentDriverContext` extended with `addMarker` + `attach`; default agent sink enables sidecar (civ-engine v0.8.11, additive)

**Decision:** Bump civ-engine c-axis: 0.8.10 → 0.8.11. Two changes in `src/ai-playtester.ts`:

(1) Add two methods to `AgentDriverContext`:

```ts
export interface AgentDriverContext<TEvent, TCommand> {
  readonly world: World<TEvent, TCommand>;
  readonly tick: number;            // == world.tick + 1 (the tick about to be executed)
  readonly startTick: number;
  readonly tickIndex: number;
  // NEW (v0.8.11):
  /** Emit a marker into this playtest's recorder. Returns marker id.
   *  Callers should typically OMIT input.tick — the recorder defaults it to
   *  world.tick (the latest completed tick). Passing input.tick = ctx.tick
   *  (= world.tick + 1) throws MarkerValidationError code '6.1.tick_future'.
   *  Validates with world.isCurrent for any EntityRefs in input.refs.entities. */
  addMarker(input: NewMarker): string;
  /** Attach a blob; returns attachment id for use in marker.attachments.
   *  Default sink (`new MemorySink({ allowSidecar: true })`) routes oversize
   *  PNGs to sidecar storage. */
  attach(blob: { mime: string; data: Uint8Array }, options?: { sidecar?: boolean }): string;
}
```

`runAgentPlaytest` builds the ctx with delegating closures around its internal recorder:

```ts
const ctx: AgentDriverContext<TEvent, TCommand> = {
  world: world as unknown as World<TEvent, TCommand>,
  tick: world.tick + 1,
  startTick,
  tickIndex,
  addMarker: (input) => recorder.addMarker(input),
  attach: (blob, opts) => recorder.attach(blob, opts),
};
```

(2) Change the default sink construction from `new MemorySink()` to `new MemorySink({ allowSidecar: true })` so agent-emitted screenshots over the 64 KiB threshold route to sidecar storage instead of throwing `oversize_attachment` and terminating the recorder. Callers that pass a custom `config.sink` are unaffected. (Without this fix, the agent-marker path has the same N3-class bug as the live path.)

Civ-engine ships an additional unit test asserting agent-emitted markers land in the bundle, plus a regression test asserting that an agent emitting a 100 KiB screenshot via `ctx.attach` survives (no termination). The same ctx is passed to both `decide` and `stopWhen`.

**Rationale:** The v2 review's N1 BLOCKER established that agents cannot emit markers with the current ctx (no recorder reference; `world.__payloadCapturingRecorder` is exclusive). The cleanest fix is a small additive context extension — existing `AgentDriver` implementations don't reference the new fields and continue to work; new implementations gain the marker-emission path. The change is 4 added lines on the interface + ~6 lines in the runner + 1 line for the default-sink change + 2 unit tests. v2's claim "civ-engine unchanged" was a self-imposed constraint that produced an impossible spec; v3+ lifts it.

**Backward compatibility:** TypeScript declares the new methods required (no `?`), so v0.8.11 consumers can call them without null-checks. Existing `AgentDriver.decide` implementations that destructure only `{ world, tick, startTick, tickIndex }` are unaffected — the extra methods on the object don't change the destructure. Direct constructors of `AgentDriverContext` are unusual outside test stubs (the runner builds the ctx itself); grep over `civ-engine/src/` confirms no test stubs construct the ctx directly today, only the runner does. Treated as a non-breaking c-bump on that basis. The default-sink change is also non-breaking because callers that pass `config.sink` are unaffected; callers relying on the default get a strictly more permissive sink (oversize attachments now succeed where they previously threw).

### ADR 10 (NEW): Additive aoe2 control surfaces in scope for v0.1.5

**Decision:** v0.1.5 ships these new aoe2 surfaces; their absence today is genuine — verified by grep over `src/`. They are listed here so they are not mistaken for "pre-existing" infrastructure.

| Surface | Module | Shape | Owner |
|---|---|---|---|
| `PauseControl` | `src/game/control/PauseControl.ts` | `pause(): void; resume(): void; isPaused(): boolean` — drives the bridge via `bridge.setPaused(bool)` | created in `createApp.ts` and passed to AnnotationController + MarkerListPanel |
| `HotkeyRegistry` | `src/game/control/HotkeyRegistry.ts` | `register(spec: { key: string; alt?: boolean; ctrl?: boolean; shift?: boolean }, handler: () => void): () => void; dispose(): void` — handles text-input-focus suppression internally | created in `createApp.ts` |
| `bridge.world` (read-only getter) | additive | `world: World` — exposes the engine `World` instance to consumers that need the live reference (RecordingService, AnnotationController.worldRef, MarkerListPanel) | added on `SimulationBridge` interface; sourced from the existing `world` field in `assembleBridgeApi` (already constructed internally, just not surfaced) |
| `bridge.setPaused(boolean)` | additive | `(paused: boolean): void` — toggles a NEW `pausedManually: boolean` field on bridge state (separate from `haltState`); causes `step()` to early-return at a new third gate placed AFTER `flushOutOfBandRenderChange()` (so render projections continue to flow while paused) and BEFORE the existing `haltState.halted` and match-outcome checks; `getHudState().engineHalted` continues to reflect failure-halt only | added on `SimulationBridge`; PauseControl uses this so it doesn't reach into private state. NOT reuses `haltState.halted`, which is `EngineHaltDetails \| null` set on `WorldTickFailureError` and would surface manual pause as a tick failure |
| `bridge.getSelectedEntityRefs()` | additive parallel getter (ADR 6) | `(): readonly EntityRef[]` | added in `assembleBridgeApi.ts` next to existing `getSelectedEntityIds` |
| `bridge.select(refs)` | additive | `(refs: readonly EntityRef[]): void` — public select-from-refs entry; callers pre-filter through `world.isCurrent` so failure isn't part of the contract | added in `assembleBridgeApi.ts` as a small new helper that maps refs → ids via the already-internal `getCurrentEntityId(ref)` and calls `selectUnitIds(ids)` |
| `scene.panCameraTo(target: EntityRef \| Position)` | additive | resolves an `EntityRef` to its current world position via the bridge, then delegates to existing `centerCameraOnWorldPosition` | added on `GameScene` |
| `AnnotationFormUiHost` | `src/ui/annotation/createAnnotationFormHost.ts` | `openForm(refs: MarkerRefs): void; closeForm(): void; onSubmit(handler): unsub; onCancel(handler): unsub` | mounted into `hudRoot` in `createApp.ts` |
| HUD `toastHandle` exposed | `createHudController` return | already returns `ToastHandle` privately; exposed publicly | `src/ui/hud/createHudController.ts` change to surface `toastHandle` in its return type |
| `HudBridge.loadGame` widened to async | `createHudController` config | `(blob: SaveBlob) => Promise<void>` (was `void`); `saveLoadPanel.ts:208` awaits + toasts on resolve, catches on reject → existing toast handle, disables the Load button while pending | scope: `src/ui/hud/createHudController.ts:69,285` (type) + `src/ui/hud/saveLoadPanel.ts:208` (call site). `installBrowserTestApi` does NOT consume `loadGame`; no other consumer exists |

These surfaces are tested independently (see §11) and wired in `createApp.ts`. The aoe2 v0.1.5 commit lands all of them together.

### ADR 11 (NEW): `RecordingService.onPersistenceError(listener)` + async `createApp()`

**Decision:**

1. `RecordingService` exposes `onPersistenceError(listener: (err: Error) => void): () => void`. Internally maintains a listener set; `IndexedDBMirror` calls `_emit(err)` on every IDB failure (quota, transaction abort, version mismatch). `lastPersistenceError` is also retained for synchronous reads (e.g., test assertions).
2. `createApp()` returns `Promise<Phaser.Game>`. `main.ts` awaits it. `RecordingService.start()` is awaited inside `createApp` before any Phaser game construction so that the recorder is connected before the first tick.
3. The HUD toast handle is exposed from `createHudController`'s return value (prev: private). `createApp` passes the toast handle to `MarkerListPanel` and subscribes it to `recording.onPersistenceError`.

**Rationale:** v2 review's N7 (no UI path for `lastPersistenceError`) and N8 (sync `createApp` vs async `start()`) are resolved together. The toast handle already exists (`src/ui/hud/toast.ts`); only the wiring is new. `createApp` async simplifies the ready-gate story — no "annotation disabled until ready" branching.

## 10. Error handling

| Failure | Surface | Recovery |
|---|---|---|
| IndexedDB unavailable (Safari private mode) | `RecordingService.start()` resolves; `onPersistenceError` fires once | log warning, continue with `MemorySink` only (no persistence); export still works for current session |
| IndexedDB quota exceeded mid-session | `onPersistenceError` fires per failed write | toast warning; recording continues in-memory; export still works |
| Recorder connect failure | `RecordingService.start()` rejects | `main.ts` catches → renders fatal error message; recording disabled |
| `MemorySink` write failure (rare with `allowSidecar: true`) | `recorder.lastError` populated; `addMarker` next call throws `recorder_terminated` | toast, disable annotation hotkey, game playable |
| Screenshot capture failure | inside `onSubmit` | save marker without attachment, toast warning |
| `selection.getSelectedEntityRefs()` returns stale generation | `recorder.addMarker` throws `MarkerValidationError` | toast "selection went stale, please re-select", form stays open with text preserved |
| MarkerListPanel row click on stale entity refs | filtered through `world.isCurrent` | use first cell if any; else toast "marker target no longer exists" |
| Hotkey pressed while text input focused | suppressed by `HotkeyRegistry` | no-op |
| Schema mismatch on prior-session export | `exportPriorSession` throws `SchemaMismatchError` | row in MarkerListPanel shows disabled Export button + tooltip explaining version skew |

## 11. Testing strategy

- **Unit tests** (vitest):
  - `markerSchema`: `isAoeMarkerData` type guard; default values; severity/category enum lock.
  - `selectionToRefs`: empty refs → tickRange-only; single entity → `entities` populated (with generation); multi-entity → array; cell-only → `cells`; mixed → both.
  - `captureScreenshot`: stub Phaser game → assert PNG bytes returned with correct mime.
  - `IndexedDBMirror`: using `fake-indexeddb`, write/read round-trip across all 8 stores; quota-exceeded simulation triggers `onPersistenceError`; sidecar bytes round-trip; `discardPriorSession` cascades across all 8 stores.
  - `RecordingService`: `start()` always begins a fresh session (assert prior records in IDB are NOT loaded into MemorySink); `addMarker` round-trips; `attachScreenshot` returns id and oversize PNGs route to sidecar (assert via descriptor.ref.sidecar === true); `exportBundle()` produces valid JSON Blob with all attachments re-embedded as dataUrls; `listPriorSessions` returns prior session metadata; `exportPriorSession` re-embeds correctly.
  - `AnnotationController`: hotkey ignored when text-input focused (via HotkeyRegistry); hotkey → form opens with refs; submit → `addMarker` called with right shape including `attachments`; cancel → resume game.
  - `PauseControl`: pause / resume round-trip; remembers prior speed; idempotent pause and resume.
  - `HotkeyRegistry`: text-input-focus suppression; chord matching; dispose unregisters all.
  - `MarkerListPanel.onRowClick`: stale-ref filter — refs[0] stale → falls back to refs[1] if current → falls back to first cell → falls back to toast.

- **Integration tests** (vitest, fake DOM + fake-indexeddb):
  - Full write flow: hotkey → form fields → submit → marker in bundle. Verify `data.author === 'human'`, `attachments` populated when screenshot captured, sidecar bytes persisted to IDB.
  - Persistence flow: write 50 markers → simulate refresh → second `RecordingService` instance starts fresh session → `listPriorSessions()` shows the prior session → `exportPriorSession()` produces a Blob with all 50 markers + dataUrl-embedded attachments.
  - Schema migration: write a session at schemaVersion 1 → bump simulated `SESSION_BUNDLE_SCHEMA_VERSION` → `listPriorSessions` returns the prior session with version 1 → `exportPriorSession` throws `SchemaMismatchError`.
  - Stale-ref click: write a marker referencing entity X → destroy + respawn entity X (generation bump) → click marker row → bridge.select called with empty array (filtered out) → cell fallback if applicable.

- **civ-engine-side test** (vitest, in `civ-engine/src/__tests__/`):
  - `agent-driver-context-marker.test.ts`: `runAgentPlaytest` with an agent whose `decide` calls `ctx.addMarker` (with `tick` omitted) and `ctx.attach`. Assert the resulting bundle contains the markers + attachments and that markers reference attachments correctly.
  - Same test asserts an agent emitting a 100 KiB PNG via `ctx.attach` does NOT terminate the recorder (default sink `allowSidecar: true` change).
  - Negative test: agent calling `ctx.addMarker({ tick: ctx.tick, ... })` (= `world.tick + 1`) throws `MarkerValidationError code: '6.1.tick_future'` — establishes the documented constraint.
  - All three ship in civ-engine v0.8.11, NOT in aoe2.

- **Browser tests** (Playwright, existing aoe2 infrastructure):
  - End-to-end: launch game → select a unit → press Alt+M → fill form → save → toggle Alt+L → see new row → click row → camera pans + game pauses + selection updated.
  - Refresh recovery: launch, annotate, refresh → second launch → expand Prior Sessions in MarkerListPanel → see the prior row → click Export → assert downloaded JSON parses + contains the marker.
  - Visual: open AnnotationForm with all severities visible → screenshot → pixel-diff against committed reference.
  - Visual: open MarkerListPanel with current-session markers + an expanded Prior Sessions list → screenshot → pixel-diff.

- **Bundling test**: `npm run build` produces a Vite bundle with no `node:crypto` resolution errors.

Per AGENTS.md visual rule: AnnotationForm + MarkerListPanel are visual changes — capture before screenshot (current state, no annotation UI), apply change, capture after, generate pixel diff alongside the four standard gates.

## 12. Performance

- IndexedDB writes batched ~100ms; per-tick cost on the hot path is a single push to an in-memory queue. Off-main-thread IDB I/O is browser-native.
- Per-stream IDB stores avoid write amplification — each tick adds one small record to `session_ticks` rather than rewriting one large bundle record.
- Screenshot capture: synchronous Phaser canvas → PNG; ~10-30ms per capture on typical hardware. Acceptable while paused.
- MarkerListPanel: O(markers) render; bounded by gameplay × annotation rate. For a 1-hour session at typical rates, low hundreds of markers — trivial DOM cost. Prior Sessions section paginates if > 50 sessions accumulated (defer pagination logic until users hit it; v0.1.5 lists all).
- Sidecar bytes: each PNG ~50-200 KiB. A 1-hour session with 100 screenshots = 5-20 MiB in IDB. Well under typical browser quotas (250 MiB+).
- `exportBundle` re-embedding: O(attachments × bytes) for base64 encoding. For a 5 MiB session, encoding is ~50ms — acceptable for a manually-triggered export.

## 13. Versioning

- aoe2: `0.1.4 → 0.1.5` (c-bump per AGENTS.md; non-breaking additive feature).
- civ-engine: `0.8.10 → 0.8.11` (c-bump per AGENTS.md; non-breaking additive context extension + default-sink change). Note: v0.8.10 was a process-only AGENTS bump; the API extension is the next c-bump.
- Coordinated drop: civ-engine v0.8.11 ships first; aoe2 v0.1.5 bumps the `civ-engine` `file:` dep and consumes. Each repo's standard gates pass before its commit.

## 14. Acceptance Criteria (v0.1.5)

- civ-engine v0.8.11 ships `AgentDriverContext.addMarker` + `attach` and changes the default agent sink to `new MemorySink({ allowSidecar: true })`; new `agent-driver-context-marker.test.ts` covers in-flight marker emission + 100 KiB screenshot survival; existing Spec 9 tests unchanged.
- aoe2 v0.1.5 ships `RecordingService`, `AnnotationController`, `MarkerListPanel`, `IndexedDBMirror`, `markerSchema` types, `selectionToRefs`, `captureScreenshot`, `PauseControl`, `HotkeyRegistry`, `node-crypto` shim, additive bridge getters/methods.
- Game launch awaits `RecordingService.start()` before mounting Phaser; bundle persists to IndexedDB; on refresh, prior session is listed in `MarkerListPanel`'s Prior Sessions section and exportable.
- Hotkey `Alt+M` opens the annotation form; selection → refs resolution works for single-entity, multi-entity, cell-only, and empty-selection cases. Hotkey ignored while a text input has focus.
- Form save → marker present in `bundle.markers`, with `data.author === 'human'`, severity / category populated, attachment id in `Marker.attachments` when screenshot captured. Oversize screenshots route to sidecar; `exportBundle` re-embeds them.
- An agent test (in civ-engine) integrating with `runAgentPlaytest` produces a marker indistinguishable in shape from the human path (same `provenance: 'game'`, same `data` shape with `author: 'agent'`, attachment via `ctx.attach`).
- Hotkey `Alt+L` toggles `MarkerListPanel`; current-session rows render in tick-desc order; click pauses game + pans camera + selects valid refs (stale refs filtered). Prior Sessions section lists prior `sessionId`s; Export downloads valid JSON Blob with all markers + attachments embedded.
- Schema mismatch on prior-session export shows disabled Export button + tooltip; never crashes.
- IDB persistence errors fire `onPersistenceError` → HUD toast.
- All four aoe2 gates pass: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. `npm run build` succeeds without `node:crypto` resolution error.
- All four civ-engine gates pass: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Pixel-diff visual gate passes for AnnotationForm and MarkerListPanel.
- Multi-CLI design, plan, and code reviews converge per aoe2's AGENTS.md.
- Docs land in same commits: this DESIGN.md (aoe2), per-iteration REVIEW.md files, devlog entries (both repos), changelog entries (both repos), version bumps.

## 15. Future Spec — v0.1.6 Replay Surface (out of scope here)

Once v0.1.5 ships, v0.1.6 (Spec 2.1) adds replay. Prerequisites it needs:

1. **Bridge-snapshot capability.** aoe2's bridge stores deterministic state (occupancy, visibility, projected paths) outside `WorldSnapshot`. Replay needs either: extend `World.state` to hold these via the existing `setState` API (engine-side change civ-engine accepts because state is JsonValue-typed), OR ship an aoe2 `BridgeSnapshot` parallel artifact that travels alongside the bundle. The latter doesn't fit civ-engine's `SessionBundle` shape, so the former is preferred.

2. **`createReplayWorld(snapshot) => { world, bridge }` factory.** Replays the registration sequence aoe2's `createWorld` does, in the same order; applies the snapshot; reconstructs the bridge surface from the snapshotted bridge state.

3. **`ReplayController`.** Owns live-vs-replay mode; calls `SessionReplayer.openAt(tick)`; swaps the renderer's bridge surface (not just the world reference).

4. **`TimelinePanel`.** Bottom-bar timeline with marker pins, scrubber, replay controls. Reuses the marker rendering helpers from v0.1.5's MarkerListPanel.

5. **`stepForward` semantics.** `SessionReplayer.openAt(currentTick + 1)` is the right primitive (per design-1 review). civ-engine could expose `replayer.advanceOne()` as a future feature; for now, openAt-with-bumped-tick works.

These deserve their own DESIGN + PLAN cycle.

## 16. Open Questions

1. **Per-session size cap.** No upper bound in v0.1.5. Long live sessions could fill IDB quota; toast on quota error and continue in-memory is the v0.1.5 fallback. Defer measuring → policy until quota errors actually fire.
2. **Multi-tab arbitration.** Two browser tabs running aoe2 share the same IndexedDB. Each tab gets a unique `sessionId`; concurrent writes target distinct keys. No coordination needed for v0.1.5.
3. **Worker-thread IDB writes.** Currently main-thread; `IndexedDBMirror` could move to a Web Worker for hot-path isolation. v0.1.5 stays main-thread; benchmark first.
4. **Prior-session retention policy.** v0.1.5 keeps all prior sessions until manual discard. v0.1.6 may add an automatic TTL or LRU cap once typical usage volume is known.
5. **8 IDB stores vs single events log.** Per-stream stores fix write amplification; tradeoff is migration surface. Acceptable for v0.1.5 (no migrations exist yet); revisit if a future schema bump forces multi-store coordination.
