# LLM-Agent Playtest Loop — Implementation Plan

Companion to `DESIGN.md`. Five phases, each TDD + multi-CLI review per AGENTS.md. Each phase ends with a green-gates commit on `main`.

## Prerequisites

- Decision: design-1 review converged at iter-2 (this plan reflects iter-2 of the design). HIGH findings (H1 dispatch semantics, H2 closure-local disable, H3 canonical command shapes) folded into the design + plan inline.
- Add `@anthropic-ai/sdk` to `devDependencies` (NOT `dependencies` — production bundle must not import it; Codex iter-1 MED4 + Claude iter-1 confirmation). AGENTS.md dependency-change protocol applies: re-resolve lockfile, run `npm audit --audit-level=high --omit=dev` and `npm audit --audit-level=high`. Mention audit results in commit.
- Add `pixelmatch` to `devDependencies` (in addition to `pngjs` which is already a devDep — Claude iter-1 M4). Same audit protocol.
- Document `ANTHROPIC_API_KEY` env var requirement in README.md (Public Surface section) — explicit "this is for `npm run playtest:llm` only; the production game does NOT depend on it."

## Phase 1 — Browser test API extensions + AI gating

**Goal.** Land the new `__AOE2_TEST__` methods + the `?disableAi=` URL param. Existing tests stay green; new methods have unit + integration coverage. No LLM code yet.

**Phase 1 splits into two coherent commits** to keep diff sizes reviewable:

- **1.A — AI gating plumbing.** `?disableAi=` URL parsing → `CreateSimulationBridgeOptions.disableAiForOwners` → `createWorld` mutates scenario `PlayerStartSpec.disableAi`. Existing `aiStates.has(owner)` gate handles the rest. Unit tests for the parser; touch-affected simulation tests stay green.
- **1.B — Browser test API extensions.** `snapshotForAgent`, `getCanvasBboxForScreenshot`, `dispatchAgentCommand`, `getRecorderBundle`, `exportRecorderBundleToFile` on `__AOE2_TEST__`. Playwright spec drives a `?disableAi=2` session, dispatches a canonical command, advances ticks, asserts the bundle reflects it.

**Files to touch.**
- `src/app/bootstrap/browserTestApi.ts` — extend `BrowserTestApi` interface + `installBrowserTestApi` with `snapshotForAgent`, `getCanvasBboxForScreenshot`, `dispatchAgentCommand` (returns `Promise<CommandDispatchResult>`), `getRecorderBundle`, `exportRecorderBundleToFile`.
- `src/app/bootstrap/createApp.ts` — wire `?disableAi=` URL param parsing (comma-separated positive integers; reject 1; ignore unparseable) into `createPrototypeScenario` so matching `PlayerStartSpec.disableAi: true` is set. Disable directive lives only in scenario-seed-time closure; never written to `world.state.aoe2.*` (Claude iter-1 H2).
- `src/game/playtest/agentSnapshot.ts` (new) — pure function `snapshotForAgent(world, accessor, scene): AgentStateSnapshot`. Bounded view: per-player resources, age, villager-count-by-task, building-count-by-type, military-count-by-type, current selection (≤16 entries), queued production, visible enemies (deduped, ≤200 entries), camera bbox in **both world coords and screen-pixel coords plus a `worldToScreen` reference table for visible cells** (Claude iter-1 L2), current tick, time elapsed in mm:ss.
- `src/game/playtest/types.ts` — `AgentStateSnapshot`, `CommandDispatchResult` types.
- `tests/playtest/agentSnapshot.test.ts` — pin shape + bounding behavior against deterministic fixtures.
- `tests/browser/agent-test-api.spec.ts` — Playwright spec asserts (a) `?disableAi=2` makes owner 2's `aiStates` absent and the AI never issues commands; (b) `?disableAi=1` is rejected; (c) `dispatchAgentCommand({type: 'unit.move', data: ...})` returns `accepted: true` for canonical-shape; (d) malformed shape returns `accepted: false, reason: 'malformed-payload'`; (e) `exportRecorderBundleToFile()` round-trips via `fetch(blobUrl)`.

**Step 1.1.** Add the new types in `types.ts` (TDD: write the type, then a placeholder test that imports them).
**Step 1.2.** Implement `agentSnapshot.ts` against a synthetic-bundle fixture. TDD: snapshot contains exactly the documented fields, capped at the documented limits.
**Step 1.3.** Extend `browserTestApi.ts` to expose `snapshotForAgent()` calling `agentSnapshot.ts`. Ground against real bridge — call from `createApp`'s test seam.
**Step 1.4.** Add `?disableAi=` parsing to `createApp.ts` + scenario seed wiring. TDD: Playwright spec.
**Step 1.5.** Expose `dispatchAgentCommand`, `getRecorderBundle`, and `exportRecorderBundleToFile` on the test API. TDD: dispatch returns `accepted: true` (with `commandKind` + normalized `data`) for shape-valid `building.placeConfirm`/`queue.train` examples; returns `accepted: false` (with `reason: 'malformed-payload' | 'unknown-kind' | 'wrong-owner-range'`) for invalid; `getRecorderBundle()` returns a `SessionBundle` with at least one queued command after a dispatch + advanceTicks(1); `exportRecorderBundleToFile` round-trips via `fetch(blobUrl)`. (Claude iter-2 NIT 6 + NIT 7 — wording matches DESIGN's structured result, examples use real discriminators.)
**Step 1.6.** Run gates. Multi-CLI review (impl-1). Address findings.

**Commit boundary.** `feat(llm-agent): phase 1 — browser test API extensions for agent harness`.

## Phase 2 — LLM agent core

**Goal.** Land `LlmAgent` class with two-tier prompting against `@anthropic-ai/sdk`. Mocked-provider tests pin prompt structure + decision parsing. No browser involvement yet.

**Files to touch.**
- `src/game/playtest/llmAgent.ts` (new) — class with `decide(state, screenshot)` method.
- `src/game/playtest/llmProviders.ts` (new) — provider abstraction: `interface LlmProvider { call(messages, schema): Promise<{ content, tokensIn, tokensOut, costUsd }> }`. Concrete impls: `anthropicProvider` (real, behind `@anthropic-ai/sdk`), `mockProvider` (test fixture).
- `src/game/playtest/llmPromptBuilder.ts` (new) — pure functions building the strategy + tactical prompts. Easy to unit-test.
- `tests/playtest/llmAgent.test.ts` — TDD against `mockProvider`. Pin prompt structure, decision parsing, strategy-tier cadence, command-validation flow.
- `tests/playtest/llmPromptBuilder.test.ts` — pin prompt token budget, screenshot inclusion logic, history truncation.

**Step 2.1.** Define `LlmProvider` interface + `mockProvider` test double.
**Step 2.2.** Implement `llmPromptBuilder.ts` (pure functions). TDD on bounded outputs.
**Step 2.3.** Implement `LlmAgent.decide()` calling `mockProvider`. TDD: returns parsed `AgentDecision` from a canned response; rejects malformed JSON; tracks token usage + cost.
**Step 2.4.** Implement `anthropicProvider.ts` against `@anthropic-ai/sdk`. Tested against mock SDK; not against the real API in CI (cost). Smoke-test locally before commit.
**Step 2.5.** Run gates. Multi-CLI review (impl-2). Address findings.

**Commit boundary.** `feat(llm-agent): phase 2 — agent core with two-tier prompting`.

## Phase 3 — Runner

**Goal.** `scripts/playtest-llm.mjs` orchestrates the loop: builds + serves via `vite preview` (not `vite dev` — Codex iter-1 MED2), boots Playwright, runs the agent, writes the bundle + trace + screenshots. Smoke-tested with a 500-tick mock-provider run.

**Cost guards** (Codex iter-1 MED3): `--cost-budget` default $5.00 with 80% warn / 100% abort, `--max-output-tokens` 1024 tactical / 2048 strategy, `--max-image-bytes` 1MB after PNG encoding (downscale to 1024px width if larger), `--max-retries` 2 per decision. The agent module enforces these; the runner surfaces them in the trace summary.

**Files to touch.**
- `scripts/playtest-llm.mjs` (new) — orchestration. Spawn `vite preview` (built bundle) by default; `--use-dev-server` flag flips to `vite dev` for local debugging. Spawn-shell-true on Windows per CVE-2024-27980 mitigation (same pattern as `playtest-corpus.mjs`).
- `src/game/playtest/llmRunner.ts` (new) — pure run loop function `runLlmPlaytest({ page, agent, config }): Promise<{ bundle, envelope, trace }>`. Imported from `playtest-llm.mjs`. Pure-function-shaped so it's testable without spawning a real Playwright. Drains `consumeCommandRejection` after each `advanceTicks` and folds rejections into the trace.
- `tests/playtest/llmRunner.test.ts` — TDD against a mocked Playwright page object + mock agent. Assert: loop terminates on `maxTicks` / `engineHalt` / `cost-budget-exceeded`; dispatches commands per agent decision; captures screenshots at the documented cadence; writes trace entries with cost data; redacts `x-api-key` and SDK error.response from trace entries (Claude iter-1 L5).
- `package.json` — `scripts.playtest:llm`. Add `playwright` to `devDependencies` if not already present (it should be — there's a Playwright spec suite). Verify.
- `.gitignore` — `output/playtests-llm/` (Claude iter-1 L4).

**Step 3.1.** Verify Playwright is already a devDep; if so, no audit needed for it.
**Step 3.2.** Implement `llmRunner.ts` against mock page + mock agent. TDD covers happy path + max-ticks + engineHalt + agent-rejected-command surfacing.
**Step 3.3.** Implement `playtest-llm.mjs`. Local smoke: 500 ticks, mock agent, real Playwright. Verify bundle is replayable via existing `npm run run-oracles`.
**Step 3.4.** Run gates. Multi-CLI review (impl-3). Address findings.

**Commit boundary.** `feat(llm-agent): phase 3 — Playwright-driven runner`.

## Phase 4 — Visual-regression oracle

**Goal.** New `no-visual-regression` oracle that compares screenshots against committed baselines. Baselines for the existing default-seed corpus row. Includes the LLM-run advisory delta surfacing — frames where LLM screenshot pixel-diff vs the deterministic-AI baseline at the same tick is large get flagged in the trace summary for human spot-check (Claude iter-1 M1).

**Independence note** (Claude iter-1 M3): Phase 4 has no runtime dependency on Phases 1-3. It uses the existing deterministic-AI playtest output (`scripts/playtest.mjs`). Could ship before Phase 1 if a visual regression is suspected; default ordering is 4-after-3 because the LLM-run advisory delta surfacing depends on Phase 3's screenshot capture path.

**Files to touch.**
- `src/game/playtest/visualOracle.ts` (new) — pure function `(bundleScreenshots, baselineDir) => violations[]`. Uses `pixelmatch`.
- `src/game/playtest/oracles.ts` — register the new oracle.
- `src/game/playtest/types.ts` — extend `OracleThresholds` with `visualDiffFraction`, `visualHighThreshold`.
- `scripts/playtest.mjs` — extend the deterministic-AI runner to capture baseline screenshots at fixed checkpoint ticks (every `pinnedWindowTicks` or every 1000 ticks, configurable). Saves to `<out>-screenshots/<tick>.png`.
- `scripts/capture-baselines.mjs` (new) — one-shot tool: run a deterministic-AI playtest and copy the resulting screenshots into `tests/playtest/baselines/<seed>/`. Manual trigger; commits the result so future runs gate against it.
- `tests/playtest/visualOracle.test.ts` — TDD with synthetic 8×8 PNG fixtures: identical → no violation; trivial-tick-counter-only diff → no violation (mask works); >threshold diff → violation with correct severity.
- `tests/playtest/baselines/default-seed/<tick>.png` — committed baselines for the default corpus row.

**Step 4.1.** Add `pixelmatch` + `pngjs` deps. Audit.
**Step 4.2.** Implement `visualOracle.ts` against synthetic PNGs. TDD.
**Step 4.3.** Wire screenshot capture into the deterministic runner.
**Step 4.4.** Capture baselines for the default-seed corpus row, commit them.
**Step 4.5.** Run gates. Multi-CLI review (impl-4). Address findings.

**Commit boundary.** `feat(llm-agent): phase 4 — visual-regression oracle + default-seed baselines`.

## Phase 5 — CI integration

**Goal.** Nightly cron + workflow_dispatch run the LLM corpus. PR-label-driven opt-in. Cost reporting in PR comment. **Anthropic absence is a clean skip, not a failure** (Codex iter-1 MED4).

**Files to touch.**
- `.github/workflows/playtest-llm.yml` (new) — **separate** workflow from `playtest.yml` so the deterministic loop never depends on Anthropic availability. Trigger: schedule (cron 17 4 * * *), workflow_dispatch, pull_request opened/labeled/synchronize gated on `if: contains(github.event.pull_request.labels.*.name, 'llm-playtest') && secrets.ANTHROPIC_API_KEY != ''`. Job-level secret guard via `if: secrets.ANTHROPIC_API_KEY != ''` skips cleanly when absent. Runtime guard inside `playtest-corpus-llm.mjs` re-checks and exits 0 with "skipped: ANTHROPIC_API_KEY absent" if missing.
- `playtest-corpus.json` — extend schema to support `llm: true` + `provider: claude|...` + `decisionInterval`. Or add a sibling `playtest-corpus-llm.json`. Pick the cheaper option (sibling file) to avoid coupling.
- `playtest-corpus-llm.json` (new) — initial corpus: one row, default-seed, 5000 maxTicks (cost-limited).
- `scripts/playtest-corpus-llm.mjs` (new) — sibling runner. Same shape as `playtest-corpus.mjs`. Reads `playtest-corpus-llm.json`. Aggregates `output/corpus-llm/<date>/SUMMARY.md`. Includes cost rollup.
- `package.json` — `scripts.playtest:corpus-llm`.
- `docs/architecture/ARCHITECTURE.md` — document the LLM-agent runtime mode (a fourth runtime alongside live, replay, deterministic-playtest).
- `docs/architecture/drift-log.md` — row appended.

**Step 5.1.** Wire `playtest-corpus-llm.mjs`. TDD coverage of the cost-rollup logic AND the retention pruning step (Claude iter-2 LOW 1): before each new run, prune `output/playtests-llm/` so only the 5 most recent runs remain (sort by mtime, delete older directories). Test pins: 7 existing dirs → 5 remain after prune; 3 existing → 3 remain (no-op); 0 existing → 0 (no-op).
**Step 5.2.** Add the workflow. Test via `act` locally if possible; otherwise iterate via PR-against-test-branch.
**Step 5.3.** Run gates. Multi-CLI review (impl-5). Address findings.

**Commit boundary.** `feat(llm-agent): phase 5 — CI integration with cost-budgeted nightly runs`.

## Phase 6 — Deferred follow-ups

Documented in DESIGN.md "Phase-6 follow-ups" section. Not in scope for this thread:

- AI-vs-LLM head-to-head (requires `aiSystem` owner-target generalization).
- Post-hoc LLM observation pass on screenshots (advisory oracle).
- Auto-apply propose-fix patches for LLM-caught regressions.
- Counterfactual fix-validation on LLM playtests.
- HTML dashboard for cross-corpus baseline drift.

## Per-phase review process

Each phase ends with a multi-CLI review per AGENTS.md (Codex + Claude in parallel via `run_in_background: true` + `until [ -s … ]; do sleep 12; done` poller). Convergence to nits closes the iter; HIGH findings spawn iter-2.

Devlog entry per phase (per AGENTS.md). `docs/devlog/summary.md` line per phase.

## Thread close

After Phase 5 lands and reviewers converge:

1. `git mv docs/threads/current/llm-agent-playtest docs/threads/done/llm-agent-playtest`.
2. Final devlog summary entry.
3. Push.
