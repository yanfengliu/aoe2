# DESIGN — AI findings → annotation bridge (v0.1.36)

## Objective

Bridge the conformance-findings pass (`src/game/playtest/conformanceProbe.ts`) into the already-built marker/annotation system (`annotation-ui` thread, 2026-04-29) so that each LLM conformance finding becomes an `agent`-authored `Marker` persisted into the run's session bundle. When that bundle is replayed, the AI's findings appear in the existing replay marker UI (the `MarkerListPanel` list AND the `TimelinePanel` pins) anchored at a tick, with no new rendering code.

This is the first and only consumer of the `author: 'agent'` marker path, which has been fully defined in `src/game/annotations/markerSchema.ts:18-39` since the annotation-ui thread but is **completely unused** — `grep` for `'agent'` across `src/` returns only the schema definition + its `VALID_AUTHORS` set (`markerSchema.ts:18,32-33,44`). Nothing in the codebase creates an agent marker today. This thread closes that gap.

## What I traced (ground truth, with file:line)

### The findings pass (where findings are produced and where they go today)

- `runConformanceProbe(...)` in `conformanceProbe.ts:252-308` calls an LLM with a `record_findings` tool and returns `ConformanceResult { findings: ConformanceFinding[]; tokensIn; tokensOut; costUsd; note? }`.
- `ConformanceFinding` (`conformanceProbe.ts:89-96`) = `{ category, area, observed, expected, severity, suggestion }`. **There is NO per-finding tick and no entity/cell reference field.** `category` ∈ `FINDING_CATEGORIES` (`missing-feature | spec-divergence | functional-bug | balance-divergence | ux-gap`, `conformanceProbe.ts:80-86`); `severity` ∈ `low | medium | high` (`conformanceProbe.ts:87`). `area` is a free-form subsystem string the model picks (e.g. `castle-age`, `market`, `monk`, `archer-line`).
- Tick context lives only in the **trace rows**, not the findings: `ConformanceTraceRow` (`conformanceProbe.ts:30-44`) carries `tickBefore`/`tickAfter` per decision. `buildConformanceDigest` (`conformanceProbe.ts:196-238`) flattens the per-decision timeline (`#<i> @tick <tickAfter>: <thought>`) into the prompt text, so the model *sees* ticks but the structured finding it returns does not carry one back. A finding's only link to a moment is prose inside `observed`.
- Orchestration: `scripts/playtest-findings.mjs` runs **post-hoc** on a finished run. It reads `${prefix}.envelope.json` + `${prefix}.llm-trace.jsonl` (+ last checkpoint screenshot), computes deterministic metrics, runs the probe, then writes the report and merges results back:
  - `${prefix}.findings.md` (`playtest-findings.mjs:170-171`, via `formatFindingsMarkdown`, `conformanceProbe.ts:355-403`).
  - merges `envelope.metrics` + `envelope.findings` into `${prefix}.envelope.json` (`playtest-findings.mjs:172-182`).
- **Crucially**: at the point findings are computed there is NO live `World` and NO live `SessionRecorder`. There is only the saved bundle file `${prefix}.json` (the `SessionBundle`, written by the runner at `scripts/playtest-llm.mjs:533`). The findings flow today never touches that bundle.

### The marker primitive (engine contract — what a Marker can carry)

Read from `node_modules/civ-engine/dist/session-bundle.d.ts:44-69`:

- `Marker { id: string; tick: number; kind: MarkerKind; provenance: MarkerProvenance; text?: string; refs?: MarkerRefs; data?: JsonValue; attachments?: string[]; createdAt?: string; validated?: false }`.
- `tick` is **required** on `Marker`. `MarkerKind = 'annotation' | 'assertion' | 'checkpoint'` (`session-bundle.d.ts:44`). `MarkerProvenance = 'engine' | 'game'` (`:45`).
- `MarkerRefs { entities?: EntityRef[]; cells?: Position[]; tickRange?: {from,to} }` (`session-bundle.d.ts:50-57`) — **every member is optional, and `refs` itself is optional.** So **position can be omitted entirely.** Position does NOT have to be a cell; cells are one of three optional anchor kinds.
- `data?: JsonValue` is where `AoeMarkerData` rides (per the comment in `markerSchema.ts:1-6`).

### Live validation vs replay-load validation (the persistence-path decision hinges on this)

- The engine's `validateNewMarker` (`node_modules/civ-engine/src/session-marker-validation.ts:23-93`) runs **only on the live `recorder.addMarker()` path**. It enforces `tick <= world.tick` (rule `6.1.tick_future`, `:40-44`), integer/non-negative tick (`:29-39`), entity-liveness for live-tick markers (`:46-56`), ordered tickRange (`:57-65`), and in-bounds integer cells (`:66-79`). **This means you cannot retro-stamp markers via a live recorder against a finished run** — there is no live world, and even if there were, a finding's tick is in the past so it would be a retroactive marker (allowed, `validated:false`, entity-liveness skipped) but you'd still need a live recorder instance, which the findings pass does not have.
- The **replay-load path does NOT re-validate markers.** `parseSessionBundleFile` (`src/game/replay/parseSessionBundleFile.ts:46-102`) is explicitly structural-only — its own docstring says *"it does NOT validate command payloads, marker schemas, or snapshot integrity"* (`:50-51`); it only requires `markers` to be an array (`:36-44,77-81`). `ReplayController.enterReplay` (`ReplayController.ts:385-450`) builds `SessionReplayer.fromBundle` + `openAt`, neither of which marker-validates; the controller just stores `bundle` and later reads `bundle.markers` for lookup (`findMarker`, `:313-319`). `MarkerListPanel` in replay mode reads `bundle.markers` directly and sorts by `tick` (`MarkerListPanel.ts:132-139`).
- **Conclusion (no blocker): the correct persistence mechanism is to append fully-formed `Marker` objects directly into `bundle.markers[]` of the already-written `${prefix}.json`, then rewrite the file.** This sidesteps `validateNewMarker` entirely (which is correct — that validator guards live recording, not post-hoc bundle authoring) and is exactly how the replay surfaces consume markers. We must build well-formed markers ourselves (valid `id`, integer `tick`, `kind`, `provenance`).

### How a HUMAN marker reaches a bundle (the path to mirror — and why we deliberately diverge)

- Live human path (`AnnotationController.ts:87-141`): Alt+M → `selectionToRefs` → `recording.addMarker({ kind:'annotation', text, refs, data:{author:'human',...}, attachments? })` → `RecordingService.addMarker` (`RecordingService.ts:312-315`) → `recorder.addMarker` (engine, runs `validateNewMarker`) → `TeeSink.writeMarker` (`RecordingService.ts:128-133`) puts it in the `MemorySink` and IDB mirror → it lands in `recorder.toBundle().markers` (`RecordingService.ts:322-325`).
- This entire path requires a **live recorder + live world**, which the findings pass does not have. `RecordingService` even documents (`RecordingService.ts:13-16`) that it is for the LIVE human world ONLY and that "Headless playtest agents go through `scripts/playtest.mjs`, which runs its own SessionRecorder externally." The playtest bundle is produced in-page (`getRecorderBundle()`, pulled out at `scripts/playtest-llm.mjs:338-369`) and is already serialized to `${prefix}.json` by the time findings run.
- Therefore the agent path **cannot and should not** reuse `RecordingService.addMarker`. It mirrors the human path at the **data-shape level** (same `Marker`/`AoeMarkerData` shape, `kind:'annotation'`, `data.author`, `text`, `refs`) but persists by **direct bundle-array append + file rewrite**, not via a live recorder. This is the load-bearing architectural decision of this thread.

### Rendering — does the replay UI display agent markers for free?

YES, both surfaces, no new code:

- `MarkerListPanel` replay mode: `collectMarkersForCurrentMode` reads `replay.bundle().markers`, sorts tick-desc, renders one row per marker with `[tick][severity icon][text snippet][author badge]` (`MarkerListPanel.ts:132-172`). It reads `m.data.author` for the badge (`:151-154`) and `m.data.severity` for the icon (`:155-159`, allowed set `info|warning|bug|blocker`, `:40-50`). Row click in replay routes to `replay.jumpToMarker(markerId)` (`:239-242`). So an agent marker with `data:{author:'agent',severity:...}` renders a row showing `agent` and the severity icon, and clicking it scrubs to its tick. **For free.**
- `TimelinePanel` pins: `renderPins` iterates `bundle.markers` and draws a clickable pin per marker at `tickPercent(marker.tick,...)`, colored by `markerCategory(marker)` (`TimelinePanel.ts:266-308`). `markerCategory` reads `marker.data.category`, normalizes it, falls back to `'general'` (`:338-345`). Pin click → `controller.jumpToMarker(marker.id)` (`:304-306`). So agent markers also appear as timeline pins at their tick. **For free.**
- Caveat (cosmetic, documented, not a blocker): `CATEGORY_COLORS` (`TimelinePanel.ts:37-43`) only has colors for `general|combat|economy|pathfinding|ui`. Categories `ai` and `perf` are valid `AoeCategory` values but have no color entry, so they fall back to `CATEGORY_COLORS.general` for the pin color (`:301`) while still tagging `dataset.markerCategory="ai"`. Functionally fine; the pin is just blue. Not in scope to fix here.

## Decisions

### 1. Anchor (tick + position)

**Tick = the finding's decision tick, with a robust fallback chain.** Findings carry no tick, so the bridge derives one. Slice-1 rule (deliberately simple):

- The bridge receives the parsed **trace rows** (it already reads them — `playtest-findings.mjs:137`) and the **bundle** (for its tick bounds). For each finding, anchor tick =
  1. **the LAST decision's `tickAfter`** present in the trace (`rows.at(-1)?.tickAfter`). Rationale: a conformance finding is a judgment over the *whole* run; the model has no per-finding decision pointer, so attributing it to the final observed decision tick is the simplest honest anchor and guarantees a tick the replay can actually reach. This is the documented fallback for "findings not tied to a specific decision" — which, given the finding shape, is ALL findings in slice 1.
  2. Fallback if the trace is empty / `tickAfter` missing: `bundle.metadata.endTick` (always present, always reachable; `clampTick` in the controller guards anyway, `ReplayController.ts:410`).
  3. Final clamp: `Math.max(0, Math.min(tick, bundle.metadata.endTick))`, coerced to an integer (`Math.trunc`). Engine `Marker.tick` requires an integer; clamping to `endTick` keeps the timeline pin reachable (`TimelinePanel.ts:290-292` disables pins past `endTick`).

  Rich per-finding tick attribution (parsing `observed` for a `@tick N` reference, or having the probe emit a `decisionIndex`/`tick` per finding) is a **follow-up** (see Deferred). Slice 1 does not change the probe's tool schema.

**Position = OMIT it (no `refs`).** The `Marker` type permits omitting position entirely (`MarkerRefs` all-optional, `refs` optional — `session-bundle.d.ts:50-64`), and the replay surfaces handle position-less markers gracefully: `MarkerListPanel` shows the row and, on click in replay mode, just scrubs to tick (it does NOT need `refs` — the entity/cell pan logic at `MarkerListPanel.ts:253-271` is the LIVE path; replay click is the tick-jump path at `:239-242`). `TimelinePanel` pins never read `refs` at all (`:282-308`). Omitting `refs` is therefore the simplest correct choice and avoids fabricating a misleading spatial anchor (a finding like "Castle Age is unreachable" has no meaningful cell).

  Rejected alternatives for slice 1, with reasons:
  - *Agent-owner Town Center position*: requires reading the bundle snapshot to find the TC entity/cell at the anchor tick — non-trivial extraction, and the position would be a half-truth (most findings aren't about the TC). Deferred.
  - *Map center*: a fabricated, meaningless anchor; adds a wrong cell pin nowhere near the issue. Rejected.
  - *Entity a finding references*: findings carry no entity ref; would require parsing `observed`. Deferred (same follow-up as rich tick).

  **Net slice-1 anchor: every finding-marker gets a derived tick and no `refs`.**

### 2. Category mapping (FINDING_CATEGORIES gap-type → AoeCategory subsystem)

`FINDING_CATEGORIES` describe a *kind of gap*; `AoeCategory` describes a *subsystem*. They are orthogonal — a `missing-feature` could be in combat, economy, or UI. **Decision: set `AoeMarkerData.category = 'ai'`** for every agent finding-marker (these are AI-conformance-audit annotations; `'ai'` is the honest subsystem tag and visually groups them), **and carry the real finding-category (`missing-feature` etc.) + `area` in the marker note/label text** (decision 4). Do NOT attempt to fuzzy-map `area` strings (e.g. "market", "monk") onto `AoeCategory` — `area` is unbounded free-form and any mapping would be lossy and brittle. `'ai'` is a valid `AoeCategory` (`markerSchema.ts:22-29`); its only consequence is the timeline pin uses the fallback (blue) color (decision 6 caveat). This keeps the mapping total, lossless (the gap-type survives in text), and trivial.

### 3. Severity mapping (finding low/medium/high → marker info/warning/bug/blocker)

`AoeSeverity` has four levels; findings have three. Proposed mapping (no finding maps to `blocker` — `blocker` is reserved for the human author's "this stops me cold" signal, and an advisory audit finding shouldn't claim that):

| Finding severity | Marker severity (`AoeSeverity`) | Rationale |
|---|---|---|
| `high` | `bug` | High = "blocks a normal game progressing toward a full match" (`conformanceProbe.ts:116`); `bug` (icon `B`) is the strongest non-blocker signal and reads correctly as "broken/missing-and-serious". |
| `medium` | `warning` | Mid-tier; `warning` icon `!`. |
| `low` | `info` | Lowest; `info` icon `i`, the schema default (`markerSchema.ts:41`). |

This drives the `MarkerListPanel` severity icon directly (`MarkerListPanel.ts:155-159`, allowed `info|warning|bug|blocker`).

### 4. Marker content (label vs note, agentId)

- `kind: 'annotation'` (matches the human path; `'annotation'` is the only authored kind — `'assertion'`/`'checkpoint'` are engine-internal).
- `provenance: 'game'` (aoe2 is the game layer; engine-emitted markers use `'engine'`).
- `text` (the single human-readable field the list shows, truncated to 60 chars in the panel — `MarkerListPanel.ts:125-130`): a compact one-liner so the snippet is legible. Proposed format:
  `"[<finding.category>] <area>: <observed>"` — e.g. `"[missing-feature] castle-age: no path to advance past Feudal"`. The list truncates; the FULL detail goes in `data` for any future detail view, and the timeline pin `title` shows `text` in full on hover (`TimelinePanel.ts:302`).
- `data: AoeMarkerData & finding detail`. `AoeMarkerData` is `{ author, agentId?, severity?, category? }` but `data` is typed `JsonValue`, so we MAY carry extra fields for a future detail panel WITHOUT breaking `isAoeMarkerData` (it only rejects bad `author`/`agentId`/`severity`/`category` types, and tolerates unknown keys — `markerSchema.ts:61-77`). Shape:
  ```
  {
    author: 'agent',
    agentId: '<run label or model id>',   // present iff author==='agent' (schema invariant, markerSchema.ts:33,75)
    severity: <mapped, decision 3>,
    category: 'ai',                        // decision 2
    // extra finding detail (ignored by isAoeMarkerData, available for future UI):
    findingCategory: finding.category,
    area: finding.area,
    observed: finding.observed,
    expected: finding.expected,
    suggestion: finding.suggestion,
  }
  ```
  Note: this richer `data` must still satisfy `isAoeMarkerData` for the human-path tests' invariants; it does, because that guard ignores unknown keys. We will add a focused unit assertion that the produced `data` passes `isAoeMarkerData`.
- `agentId`: the run identifier. Slice 1 uses the run **prefix label** (e.g. `campaign-4`, derived exactly like `playtest-findings.mjs:168` does: `prefix.split(/[\\/]/).pop()`) optionally combined with the probe model (`args.model`). A stable, human-recognizable id is enough; we are not modeling multiple agents per bundle yet.
- `id`: a deterministic, collision-free string the bridge generates, e.g. `agent-finding-<index>` (index within the findings array). Markers need unique `id`s for `findMarker`/`jumpToMarker` (`ReplayController.ts:313-318`) and for the panel's `data-marker-id`. Deterministic ids keep the bridge pure/testable and make re-runs idempotent-ish (see persistence note on re-runs below).
- `createdAt`: ISO timestamp (optional field; set to now for provenance).
- No `attachments` in slice 1 (the final screenshot is already consumed by the probe; per-finding screenshots are not available).

### 5. Where the bridge runs + persistence (exact insertion point)

**Module to create:** `src/game/playtest/findingsToMarkers.ts` — a PURE function, no I/O:
```
findingsToMarkers(
  findings: ConformanceFinding[],
  ctx: { anchorTick: number; agentId: string; createdAt?: string }
): Marker[]
```
It maps each finding → a well-formed `Marker` per decisions 1-4. Pure + deterministic so it is trivially unit-testable (mirrors how `computeRunMetrics`/`formatFindingsMarkdown` are pure functions in `conformanceProbe.ts`). It imports the `Marker` type from `civ-engine` and `AoeMarkerData`/`isAoeMarkerData` from `../annotations/markerSchema`. Keeping the gap→category, severity, and text formatting here (not in markerSchema) respects the boundary: `markerSchema.ts` defines the schema; the *bridge* owns the findings-specific mapping.

**Persistence — direct bundle append + file rewrite, in `scripts/playtest-findings.mjs`:**

The insertion point is in `playtest-findings.mjs` `main()` immediately after findings are computed and before/alongside the existing envelope write (around `playtest-findings.mjs:166-182`). New behavior, gated so it is safe and re-runnable:

1. Compute `anchorTick` from `rows` (decision 1): `rows.at(-1)?.tickAfter ?? <fallback>`.
2. Read the bundle file `${prefix}.json` (it is written by the runner; this script currently does NOT touch it). If it is missing, **skip marker injection with a warning** (metrics/findings-md still write) — do not fail the whole findings pass, because `playtest-findings.mjs` is explicitly runnable on runs that may predate this feature.
3. Parse it, clamp `anchorTick` to `[0, metadata.endTick]`.
4. `const markers = findingsToMarkers(findings, { anchorTick, agentId, createdAt })`.
5. **Replace prior agent markers, then append** (idempotent re-runs): `bundle.markers = bundle.markers.filter(m => !isAgentMarker(m)).concat(markers)`. Without this, re-running the findings pass (a documented workflow — `playtest-findings.mjs:6-9`) would duplicate agent markers every time. `isAgentMarker` = `m.data?.author === 'agent'`. Human markers (none exist in a playtest bundle, but be safe) are preserved.
6. Write the bundle back to `${prefix}.json` (pretty or compact — the runner writes compact at `playtest-llm.mjs:533`; keep compact to match).
7. Log the count, mirroring the existing log style.

Because the marker is appended directly to `bundle.markers[]` and the replay-load path is structural-only (no marker re-validation — established above), the marker is present and rendered the next time anyone does "Replay" on that bundle (drag-drop a `${prefix}.json`, or the corpus dashboard's replay path).

**Why not inside `conformanceProbe.ts`?** The probe is pure orchestration over an `LlmProvider` with "no Playwright, no filesystem" (`conformanceProbe.ts:17-19`). File I/O belongs in the script. The script is also where the bundle path (`${prefix}.json`) and the trace rows (for `anchorTick`) are both in scope. So: mapping logic → pure module; file mutation → the `.mjs` script. This matches the existing split (probe pure, script does I/O).

### 6. Rendering

**No new render code in slice 1.** As established above, BOTH replay surfaces already iterate `bundle.markers` and handle agent-authored, position-less markers:
- `MarkerListPanel` (replay mode) → row with `agent` badge + mapped severity icon, click scrubs to tick (`MarkerListPanel.ts:132-172,239-242`).
- `TimelinePanel` → clickable pin at the finding tick, click scrubs (`TimelinePanel.ts:266-308`).

The only cosmetic gap is the missing `ai`/`perf` pin color (decision 2 caveat) — out of scope. **Slice 1 ships the list + timeline integration for free.** Canvas-world pins at the finding's cell are NOT needed (we omit position) and are deferred along with rich anchoring.

### 7. Slice-1 scope vs deferred

**Slice 1 (this thread, v0.1.36):**
- New pure module `src/game/playtest/findingsToMarkers.ts` (findings → `Marker[]`, decisions 1-4).
- `scripts/playtest-findings.mjs` injects the produced agent markers into `${prefix}.json`'s `bundle.markers[]` (idempotent re-run, decision 5), gated/skipped-with-warning if the bundle file is absent.
- Findings become `agent`-authored markers, anchored at a derived tick, no position, visible for free in the existing replay `MarkerListPanel` list and `TimelinePanel` pins.
- Tests per decision 8.
- Docs: devlog (summary + detailed), changelog (user-visible: replaying a playtested bundle now shows AI findings as markers), `package.json` bump to 0.1.36. Architecture drift-log row (a new data flow: findings → bundle markers). No ARCHITECTURE.md component change unless review says the bridge is a "subsystem" (it is one small pure module + a script edit; likely a drift-log row + devlog suffice — flag to lead).

**Deferred (explicitly out of scope, named so the lead can prioritize later):**
- **Rich per-finding anchoring**: probe emits a per-finding `decisionIndex`/`tick` (tool-schema change) and/or the bridge parses `observed` for `@tick N` / entity ids, so each marker lands at the moment it actually occurred rather than all at the final tick. (Biggest follow-up; the slice-1 anchor is intentionally coarse.)
- **Per-finding spatial position** (TC cell, referenced-entity cell, map region) and canvas-world pins.
- **`ai`/`perf` timeline pin colors** in `TimelinePanel.CATEGORY_COLORS`.
- **A marker detail panel** that surfaces the full `expected`/`suggestion` (we stash them in `data` now so a future panel needs no re-plumbing).
- **Live in-game agent markers** (an in-page agent dropping markers as it plays via `RecordingService`/its in-page recorder) — different mechanism, not findings-driven.
- **Figma-style freehand drawing tool** — explicitly out (per task).

### 8. Test plan (TDD — write tests first)

Patterns to mirror: `tests/playtest/conformanceProbe.test.ts` (pure-function probe tests), `tests/recording/AnnotationController.test.ts` (marker-shape assertions via a stubbed recorder), `tests/annotation-ui/MarkerListPanel.replay.test.ts` (replay bundle.markers rendering), `tests/annotations/markerSchema.test.ts` (`isAoeMarkerData` invariants).

New test file `tests/playtest/findingsToMarkers.test.ts` (pure mapping — the contract):
1. **Shape**: each produced `Marker` has a unique `id`, integer `tick === anchorTick`, `kind:'annotation'`, `provenance:'game'`, no `refs`, and `data.author === 'agent'` with `agentId` present.
2. **Category mapping** (decision 2): every marker has `data.category === 'ai'` regardless of `finding.category`; `data.findingCategory` preserves the original gap type.
3. **Severity mapping** (decision 3): `high→bug`, `medium→warning`, `low→info` (table-driven over all three).
4. **`isAoeMarkerData(marker.data) === true`** for the produced data (guards that the richer `data` still satisfies the schema invariants — `markerSchema.ts:61-77`).
5. **Text format** (decision 4): `text` starts with `"[<findingCategory>]"` and includes `area`.
6. **Empty findings → `[]`**; **fallback tick** when `anchorTick` not derivable (caller passes the fallback; the function just consumes `ctx.anchorTick`, so the fallback-derivation test lives at the integration boundary — see below).
7. **Determinism**: calling twice with the same args yields structurally identical markers (same ids).

Persistence-injection coverage (the script edit). Two options; PICK the unit-testable one:
- **Preferred**: extract the bundle-mutation step into a small pure helper `injectAgentMarkers(bundle, markers): SessionBundle` (e.g. co-located in `findingsToMarkers.ts` or a sibling) and unit-test it: (a) appends markers to `bundle.markers`; (b) **idempotent** — running it twice (or after a prior agent-marker set) does not duplicate (filters `author==='agent'` first, decision 5); (c) preserves any non-agent markers. This keeps `playtest-findings.mjs` a thin I/O wrapper (consistent with how the script delegates to pure `conformanceProbe.ts` functions). The `anchorTick` derivation (`rows.at(-1)?.tickAfter ?? endTick`, clamped) also becomes a tiny pure helper with its own test.
- The `.mjs` file-read/write itself stays untested (it is glue), matching the project's existing posture (the runner scripts are not unit-tested; their logic lives in tested `src/` modules).

Optional integration assertion (cheap, high-value): a test that feeds a produced agent-marker bundle through `MarkerListPanel` in replay mode (reusing the `MarkerListPanel.replay.test.ts` harness) and asserts a row renders with the `agent` author badge and the mapped severity icon — proving the "for free" rendering claim end-to-end. Include if it is low-friction with the existing harness; otherwise rely on the existing replay-panel tests that already prove `bundle.markers` rendering.

### 9. Risks / open questions for the team lead

1. **Coarse anchor (all findings at one tick).** Slice 1 stamps every finding at the final decision tick, so N findings stack as N pins/rows at the same timeline position (and N overlapping timeline pins at the same `left%`). This is honest (the finding shape carries no per-finding tick) but visually clusters. Options the lead may want: (a) accept clustering for slice 1 (my recommendation — simplest, correct); (b) spread findings across the last N decision ticks as a cheap heuristic (arbitrary, slightly misleading); (c) pull rich anchoring forward into slice 1 by adding a `tick`/`decisionIndex` to the probe's `record_findings` tool schema (bigger change, touches the LLM contract + `parseFindings`). **Recommendation: (a).** Flagging because it is a UX judgment.

2. **Mutating the run's `${prefix}.json` in place.** The findings pass currently only writes `.findings.md` + `.envelope.json`; this thread makes it also rewrite the bundle. Re-runs must be idempotent (decision 5 handles it by replacing prior agent markers). Risk: if some downstream tool hashes or snapshots `${prefix}.json` expecting it to equal the runner's output, the added markers change it. Mitigation/alternative the lead may prefer: write a **sibling** `${prefix}.annotated.json` instead of mutating `${prefix}.json`, leaving the raw bundle pristine. Trade-off: a sibling file means the replay/dashboard "open this run" path must know to prefer the annotated copy. **Recommendation: mutate `${prefix}.json` in place with idempotent replace** (simplest for the replay UX — "open the run, see the findings"), but this is the one decision most worth the lead's explicit sign-off.

3. **`agentId` content + multi-probe runs.** Using the run-prefix label as `agentId` is recognizable but coarse; if the lead wants to distinguish probe model / probe run, include `args.model` (and maybe a timestamp) in `agentId`. Minor; default proposed is `<prefix-label>` (+ model). Worth a one-line confirm.

(Lower-risk, already handled: position-less markers render fine; replay-load does not re-validate markers; the `ai` pin color falls back to blue.)

## Files the implementation will create / modify

- **Create** `src/game/playtest/findingsToMarkers.ts` — pure `findingsToMarkers(findings, ctx): Marker[]` + small helpers `injectAgentMarkers(bundle, markers)` and `deriveAnchorTick(rows, bundle)` (all pure, < 150 LOC, well under the 500 cap).
- **Create** `tests/playtest/findingsToMarkers.test.ts` — mapping + injection + anchor tests (decision 8).
- **Modify** `scripts/playtest-findings.mjs` — after computing findings, derive anchor tick, read `${prefix}.json`, inject agent markers (idempotent), rewrite the file; gated/skipped-with-warning if the bundle is absent (~25 lines around `:166-183`).
- **Docs**: `docs/devlog/summary.md` (+1 line), `docs/devlog/detailed/2026-06-12_2026-06-15.md` (full entry), `docs/changelog.md` (v0.1.36 user-visible: AI findings now appear as replay markers), `package.json` (0.1.35 → 0.1.36), `docs/architecture/drift-log.md` (row: new data flow findings → bundle markers). Possibly `design/spec-final.md` if the lead deems "findings surface as replay annotations" a spec-level rule (§15 playtest area) — I will flag during implementation.

No `civ-engine` changes (the engine `Marker` type already carries everything needed; no engine-feedback entry warranted). No new dependencies.
