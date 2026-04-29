# Annotation UI — Plan Iteration 1 Review (2026-04-29)

**Disposition:** Iterate → plan-2. Convergent across reviewers. Codex 2 BLOCKERS + 9 majors + 1 minor. Claude 0 BLOCKERS + 8 majors + 8 minors. Both reviewers agree no architectural redesign is needed; all findings are paragraph-level plan-v2 fixes plus one task split.

Reviewers: Codex (`gpt-5.5` xhigh — ITERATE, 2 BLOCKERS + 9 MAJORS), Claude (`claude-opus-4-7[1m]` max — ITERATE, 0 BLOCKERS + 8 MAJORS).

Note: this thread's design iterations 1–5 used Codex + Claude only. aoe2's AGENTS.md requires Codex + Gemini + Claude. Plan-2 review onward uses all three; the design-iteration omission is logged in `docs/learning/lessons.md` as a process regression to avoid in future threads.

## Convergent BLOCKERS

### B1 — TDD order inverted in PHASE 1 (CE-1 before CE-2)

Codex BLOCKER (Claude m1 MINOR; severity differs but both flag). PLAN §1 lands the interface change in CE-1 with no failing test, then CE-2 writes the tests. Per AGENTS.md "Use test-driven development for behavior changes: write or update tests first, then make them pass."

**v2 fix:** merge CE-1 + CE-2 into a single TDD task (write failing tests → implement → tests pass), or reorder so CE-2 lands first (tests exist + intentionally fail) and CE-1 makes them pass. Recommend the merge — fewer commits, no in-tree red-test commit.

### B2 — Multi-CLI review missing Gemini; bad git diff command

Codex BLOCKER. PHASE 1 review checkpoint and PHASE 3 FR-1 both list "Codex + Claude" — aoe2's AGENTS.md `Code review` section lists Codex + Gemini + Claude. Also `git diff main..HEAD` returns empty when on `main` before commit.

**v2 fix:** PHASE 1 + PHASE 3 reviewer lists include Gemini (`git diff [base] | gemini --prompt <prompt> --model gemini-3.1-pro-preview --approval-mode plan --output-format text`). Diff command is `git diff` (uncommitted) or `git diff main` (against base). Also add the doc-accuracy verification clause to the review prompt per AGENTS.md.

## Convergent MAJORS

### M1 — Test environment dev deps + jsdom missing

Both reviewers MAJOR. PLAN AO-7 tests rely on `fake-indexeddb`; AO-9 form tests rely on `jsdom`. Neither is in aoe2 `devDependencies` today; AO-1 doesn't list them.

**v2 fix:** AO-1 adds `fake-indexeddb` and `jsdom` (or `happy-dom`) to devDependencies, and updates `vitest.config.ts` to set `environment: 'jsdom'` for files that need DOM, or per-test env declarations. Verify vitest picks up Vite's `node:crypto` alias via a quick smoke test (one vitest test that imports civ-engine's `SessionRecorder`).

### M2 — AO-7 IndexedDBMirror task too large

Both reviewers MAJOR. ~250 LOC + 8-store round-trip tests + sidecar/quota/schema-mismatch/discard/reopen tests is far beyond a 30-minute task and approaches the 500-LOC ceiling.

**v2 fix:** split AO-7 into:
- AO-7a — open / close / connection lifecycle / `recordMeta` + tests
- AO-7b — per-stream record* methods (tick/command/execution/failure/snapshot/marker/attachment) + tee mechanism + 100ms-debounced flush queue + fake-timer-based deterministic flush testing
- AO-7c — `listSessions` + `reconstructBundle` + typed errors (SessionNotFound, SchemaMismatch, IncompleteSession)
- AO-7d — `discard` + `readAttachmentBytes` + quota error path → `onPersistenceError`

Codex additionally calls out "test-visible flush/drain path or fake-timer plan for the 100ms debounced queue" — AO-7b adds a `flushAll(): Promise<void>` test hook + uses `vi.useFakeTimers()` for deterministic batching tests.

### M3 — AO-12 seed URL handling preservation

Both reviewers MAJOR. Current `createApp.ts:25-30` distinguishes "param absent" / "param explicitly empty/whitespace" with a load-bearing warn (iter-3 V3-22). PLAN AO-12 says only "rebuildAnnotationStack helper, handleLoadGame async, hotkey closures."

**v2 fix:** AO-12 explicit sub-bullet "preserve all existing seed parsing + V3-22 empty-seed warn" + a regression test asserting both the DEFAULT_SEED fallback AND the warn fire correctly across (absent / empty / whitespace / non-empty) cases.

### M4 — `pausedManually` carrier ambiguity

Both reviewers MAJOR. PLAN AO-2 says "add `pausedManually: boolean` to bridge state shape (NOT haltState)" but doesn't name the carrier; also lists `tickHaltGuard.ts` in the file list, which is the wrong bag.

**v2 fix:** AO-2 specifies a new `pauseState: { pausedManually: boolean }` field on the bridge's internal state object (NOT on `tickHaltGuard.ts`'s `haltState`). The new step() gate reads `pauseState.pausedManually`; `getHudState()` does NOT read `pauseState`.

### M5 — PLAN §6 Open Questions are already resolved by DESIGN v5

Both reviewers MAJOR. Q1-Q4 are all answered:
- Q1 getter vs field: ADR 10 row says "sourced from the existing `world` field in `assembleBridgeApi`" — read-only getter
- Q2 tee at MemorySink vs SessionRecorder: DESIGN §5 explicitly says tee at MemorySink
- Q3 `markClosed` rejection: DESIGN ADR 1 + §10 imply `onPersistenceError` + `closedNormally:false`
- Q4 phase boundary serial: implied by ADR 9 backward-compat + PHASE 1/PHASE 2 split

**v2 fix:** drop §6 entirely or convert to "§6 Decisions confirmed during plan review" with each resolution inline.

### M6 — `aoe2/docs/api-reference.md` is retired

Both reviewers MAJOR. AGENTS.md "Note on retired files (iter-2 V5-5)": aoe2 does NOT maintain `docs/api-reference.md`, `docs/guides/<topic>.md`, or `docs/README.md`. PLAN AO-14 lists "aoe2/docs/api-reference.md (if exists)" — the canonical surfaces are `README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/decisions.md`, `docs/architecture/drift-log.md`, the per-task devlogs, `docs/changelog.md`, and TypeScript types as the source of truth.

**v2 fix:** AO-14 drops `api-reference.md` from the file list. For civ-engine CE-3, leave `civ-engine/docs/api-reference.md` (verified to exist) but remove the conditional "(if exists)" from the aoe2 list.

### M7 — CE-2 test 4 prerequisite (Claude MAJOR)

PLAN CE-2 test 4 says "emission is BEFORE world.step in the runner's per-iteration ordering — confirm this by reading the existing runner ordering." This must be verified before writing the test; if `decide` runs after `world.step`, expected `tick` values are wrong.

**v2 fix:** add a CE-0 prerequisite "verify runner ordering by reading `civ-engine/src/ai-playtester.ts`" that establishes the ordering before any tests are written. (Reading the existing file: `decide` runs at line 166, BEFORE `world.step` at line 187, so emission ordering matches.) Bake the resolved ordering into CE-2 test 4 directly.

### M8 — Vitest integration tests missing layer (Claude MAJOR)

DESIGN §11 calls out four vitest+jsdom+fake-indexeddb integration scenarios (full write flow, persistence/refresh recovery, schema migration, stale-ref click). PLAN covers them only at Playwright e2e level.

**v2 fix:** add new task AO-12.5 — vitest integration suite covering the four DESIGN §11 scenarios. Faster feedback layer than Playwright.

### M9 — AO-4 `panCameraTo` API direction wrong (Codex MAJOR)

PLAN AO-4 says "resolve via `bridge.world.getEntityRef(...)`." `getEntityRef` takes an id and returns a current EntityRef; we need the inverse — given a (possibly stale) EntityRef, get the live position. The right API is via `world.isCurrent(ref)` + `world.getComponent<Position>(ref.id, 'position')` (after liveness check).

**v2 fix:** AO-4 spells: "given EntityRef → check `world.isCurrent(ref)`; if current, read position via `world.getComponent<Position>(ref.id, 'position')`; else no-op + toast." Add `bridge.getEntityPosition(ref): Position | null` as another additive surface in ADR 10 if cleaner; or do the resolution inside `scene.panCameraTo` with `bridge.world` access. Recommend the latter — keeps the additive bridge surface narrow.

### M10 — AO-13/AO-14 visual + doc compliance gaps (Codex MAJOR)

PLAN AO-13 commits visual baseline files but omits the AGENTS.md visual rule's full procedure (before screenshot, after screenshot, pixel diff). AO-14 should add the mandatory doc audit/grep step.

**v2 fix:** AO-13 spells out: capture before screenshot (current state, no annotation UI), apply, capture after, generate pixel diff alongside the four standard gates. Baselines are first-run captures committed after manual review. AO-14 adds: "run `doc-review` skill or grep for removed-API names across `docs/` and `README.md` before declaring task done."

## Other findings (folded into v2 fixes)

- **Codex AO-8/AO-11 markers() surface** — DESIGN §5 lists `RecordingService.markers(): readonly Marker[]`. PLAN AO-8 doesn't explicitly mention it. v2 adds the method to AO-8's task description.
- **Codex AO-6 selectionToRefs cells** — DESIGN v3+ dropped cell-selection from the human path; PLAN matches design correctly. Codex's flag is design-stale; no plan change needed (verify by re-reading DESIGN §3 / §6).
- **Codex AO-12 installBrowserTestApi readiness** — v2 AO-12 adds an assertion that `window.__AOE2_TEST__` is installed after `await createApp()` resolves and that `main.ts` catches startup failure (renders the fatal error message).
- **Claude m2 vitest alias inheritance** — covered by M1 fix (smoke test).
- **Claude m3 `npm install` after PHASE 1** — v2 PHASE 2 entry point explicitly says "first action: `npm install` to pick up civ-engine v0.8.11 from `file:../civ-engine`."
- **Claude m4 CE-2 test 5 specificity** — v2 names the specific Spec 9 tests to assert continue passing (e.g., `runAgentPlaytest.test.ts`'s existing destructure-only-`{world,tick,startTick,tickIndex}` cases).
- **Claude m5 createApp test infrastructure** — v2 AO-12 lists "set up jsdom env + Phaser stubs for createApp.test.ts" as a sub-task or accepts that AO-12 grows; the latter is fine if total stays under 500 LOC.
- **Claude m6 visual baseline first-run** — v2 AO-13 adds: "first run produces the baseline; commit after manual review; subsequent runs diff against it."
- **Claude m7 installBrowserTestApi regression** — v2 AO-2 adds a one-line assertion: existing browserTestApi tests pass after extending the bridge interface.
- **Claude m8 civ-engine HEAD pin during PHASE 2** — v2 PHASE 2 devlog records `git rev-parse HEAD` of civ-engine at PHASE 2 start; gate verifies before each PHASE 2 task.

## Disposition

**ITERATE → plan-2.** Convergent direction: 11 paragraph-level fixes (2 BLOCKERS + 8 majors + 1 minor restructured), no architectural rework. plan-2 should land convergent ACCEPT with all 3 CLIs (Codex + Gemini + Claude) per AGENTS.md.
