# Annotation UI — Design Iteration 1 Review (2026-04-29)

**Disposition:** Iterate (substantial). Codex 5 BLOCKERS + 4 majors + 4 minors. Claude 4 BLOCKERS + 5 majors + 6 minors. Both reviewers converged on scope cut and 4 contract-level gaps; v2 redesign rather than incremental fixes.

Reviewers: Codex (gpt-5.5 xhigh), Claude (`claude-opus-4-7[1m]` max).

## Convergent BLOCKERS

### B1 — Scope too large for one commit; split capture/replay

Both reviewers: v1 lands replay scrubber + IndexedDBSink + capture UI in one commit; the replay half has structural integration gaps that make it not just longer but not feasible without prior aoe2 bridge work. Codex: split. Claude: v0.1.5 capture-only, v0.1.6 replay.

**v2:** Cut replay/timeline from v0.1.5. v0.1.5 ships capture + minimal MarkerListPanel (click-to-pan-and-pause, no tick-jumping). v0.1.6 (Spec 2.1) is a separate future spec covering the bridge-snapshot prerequisites + ReplayController + TimelinePanel.

### B2 — Replay integration structurally broken

Codex BLOCKER: aoe2 renderer binds to `SimulationBridge`, replayer returns bare `World`. Codex BLOCKER: aoe2 stores deterministic state in bridge side-maps + visibility outside `WorldSnapshot`. Claude BLOCKER-D: `worldFactory: createWorld` mismatches signature (`createWorld` returns `CreateWorldResult`, replayer wants `(snapshot) => World`).

**v2:** ADR 4 documents replay deferral; future spec §15 lists prerequisites.

### B3 — IndexedDBSink can't satisfy sync `SessionSink + SessionSource`

Codex BLOCKER: sink methods are sync; IDB is async-only; debounced writes can't populate `recorder.lastError` synchronously. Claude BLOCKER-C: `SessionSource` is sync (`readSnapshot`, `toBundle()`); IDB read API is async-only — needs in-memory mirror with async hydration.

**v2:** ADR 1 + ADR 2 — `RecordingService` constructs `SessionRecorder` with sync `MemorySink`; `IndexedDBMirror` writes asynchronously, separate `lastPersistenceError` field. Mirror is write-only at runtime; hydration is one async pass at `start()` before recorder connects.

### B4 — `recorder.attach()` call shape wrong

Claude BLOCKER-A: design used `recorder.attach({ id, mime, sizeBytes, ref }, bytes)` (the SessionSink signature). Actual `SessionRecorder.attach(blob: { mime, data }, options?)` returns the id; recorder picks ref-policy via `{ auto: true }`.

**v2:** §3 + §5 + §6 use `recorder.attach({ mime: 'image/png', data: bytes })`; attachment id goes in `Marker.attachments` (the generic field), not `data.screenshotAttachmentId`.

### B5 — `JsonValue` not exported from civ-engine

Claude BLOCKER-B: `import type { JsonValue } from 'civ-engine'` fails — `index.ts` doesn't re-export from `./json.js`.

**v2:** `markerSchema.ts` defines local `AoeJsonValue` with the same shape.

## Convergent MAJORS

### M1 — Selection refs need generations

Codex MAJOR: `SelectionState` exposes IDs not generations; `addMarker` validates with `world.isCurrent(ref)`; passing `generation: 0` for respawned entities throws.

**v2:** ADR 6 — bridge MUST surface `currentEntityRefs(): EntityRef[]` with generations; this is an in-scope additive change.

### M2 — Agent-recorder ownership contradiction

Claude MAJOR-F: design said "agent's `RecordingService` is the same instance as the UI's." But Spec 9's `runAgentPlaytest` constructs its own recorder.

**v2:** ADR 3 — aoe2's `RecordingService` is for the LIVE world only; agents use Spec 9's `runAgentPlaytest` with its own recorder. Bundles share shape; both consumable by `BundleViewer`.

### M3 — IndexedDB single-record write amplification

Codex MAJOR + Claude MAJOR-J: one record per session with arrays inside; each debounced flush rewrites the whole record.

**v2:** §5 — per-stream object stores (`session_meta`, `session_ticks`, `session_commands`, ..., 8 stores), each tick appends a small record.

### M4 — `node:crypto` browser bundling

Codex MAJOR: `SessionRecorder` imports `node:crypto`; aoe2 is Vite + browser; will fail without shim.

**v2:** ADR 7 + §5 — Vite alias `'node:crypto'` → `src/shims/node-crypto.ts` (1-line `crypto.randomUUID` re-export).

### M5 — Schema migration policy missing

Claude MAJOR-I: when civ-engine bumps `SESSION_BUNDLE_SCHEMA_VERSION`, every persisted bundle becomes unreadable.

**v2:** ADR 1 + §5 — on hydrate, schema mismatch drops prior records, console warning, fresh session. Documented in §10 error table.

### M6 — Versioning bump axis wrong

Both reviewers: aoe2 follows `a.b.c` semver; non-breaking feature is c-bump, not b-bump.

**v2:** §13 — explicitly `0.1.4 → 0.1.5`.

### M7 — Visual gate misses AnnotationForm

Claude MINOR-M (treating as MAJOR for AGENTS.md compliance): visual rule applies to all visual changes; design listed only TimelinePanel pixel diff.

**v2:** §11 + §14 — AnnotationForm + MarkerListPanel both have pixel-diff gates.

## Other minors

- **K — Hotkey M collides with Mill construction.** Both reviewers. v2 ADR 8 — `Alt+M` for annotate, `Alt+L` for marker list.
- **E — `addMarker` typing redundant.** Claude MINOR-E. v2 §5 uses `Omit<NewMarker, 'data'> & { data?: AoeMarkerData }`.
- **G — Hardcoded `generation: 0` in agent example.** Claude MINOR-G. v2 §3 / ADR 6 — agent example uses bridge-resolved refs.
- **H — `writeAttachment` return contract.** Claude MAJOR-H. v2 §5 — picks sidecar for screenshots; `exportBundle()` re-embeds at export time.
- **L — Versioning text wrong.** Claude MAJOR-L. Folded into M6 above.
- **Q — `stepForward` underspecified.** Claude MINOR-Q. Moot — replay deferred to v0.1.6.
- **P — Path fix.** Claude MINOR-P. v2 §8 uses `aoe2/src/app/bootstrap/createApp.ts`.
- **O — Open Questions resolution.** Claude MINOR-O. v2 §16 keeps Q1 (size cap), Q2 (multi-tab), Q3 (worker thread), Q4 (bridge selection) as open during implementation; closes Q1 (hotkey) via ADR 8.

## Disposition

Re-review as design-2. Expect substantial-but-not-substantive findings (the v1 → v2 delta is large; reviewers should verify the new shape but unlikely to catch new BLOCKERS unless we missed an integration gap). If iter-2 surfaces no new BLOCKERS, move to PLAN.
