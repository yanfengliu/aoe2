# Recursive Self-Improvement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and dogfood a reusable self-improvement ledger command for recorded playtest runs.

**Architecture:** Keep the ledger contract pure in `src/game/playtest/selfImprovementLoop.ts`; keep filesystem and replay construction in `scripts/playtest-self-improve.mjs`. Reuse `civ-engine` `ImprovementFinding`, `improvementFindingsFromMarkers`, `SessionReplayer.selfCheck`, and `compareMetricsResults`.

**Tech Stack:** TypeScript, Vitest, Node/tsx scripts, civ-engine v1.4.0 shared contracts.

---

### Task 1: Pure Ledger Contract

**Files:**
- Create: `src/game/playtest/selfImprovementLoop.ts`
- Create: `tests/playtest/selfImprovementLoop.test.ts`

- [x] Write tests that recover `ImprovementFinding` payloads from markers.
- [x] Write tests that fall back from `envelope.findings` to shared improvement payloads when marker payloads are absent.
- [x] Write tests that classify proposal/fix/observe/none next actions and default missing disposition to `candidate`.
- [x] Write tests that compare baseline/current objective metrics with `compareMetricsResults`.
- [x] Implement the pure ledger helpers until those tests pass.

### Task 2: CLI Glue

**Files:**
- Create: `scripts/playtest-self-improve.mjs`
- Modify: `package.json`

- [x] Add a CLI that accepts `--current`, optional `--baseline`, and `--out`.
- [x] Read run artifacts by prefix and repair legacy in-memory `endTick` values.
- [x] Run `SessionReplayer.selfCheck({ stopOnFirstDivergence: true })` via `createReplayWorldOnly`.
- [x] Write `<out>.json` and matching Markdown summary.
- [x] Add the package script `playtest:self-improve`.

### Task 3: Dogfood Evidence

**Files:**
- Modify: `docs/threads/current/recursive-self-improvement-loop/2026-07-08/1/REVIEW.md` or add a concise evidence section before moving the thread to done.
- Modify: `docs/devlog/summary.md`
- Modify: latest `docs/devlog/detailed/*.md`
- Modify: `docs/architecture/ARCHITECTURE.md` and `docs/architecture/drift-log.md` only if the final command is treated as a structural harness boundary.

- [x] Run targeted tests and the new CLI on existing recorded artifacts with both `--baseline` and `--current`.
- [x] Confirm the ledger has standardized findings, replay/self-check evidence, classifications, and a before/after comparison.
- [x] Run adversarial review and address real findings.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] Commit on `main` and push.

### Task 4: Deterministic Oracle Bootstrap

**Files:**
- Modify: `src/game/playtest/selfImprovementLoop.ts`
- Create: `src/game/playtest/oracleImprovementFindings.ts`
- Modify: `scripts/playtest-self-improve.mjs`
- Modify: `tests/playtest/selfImprovementLoop.test.ts`
- Modify: `tests/playtest/playtestSelfImproveScript.test.ts`

- [x] Add tests that convert `OracleViolation`s into shared `ImprovementFinding`s.
- [x] Add tests that deterministic runs without `.llm-trace.jsonl` compare without NaN metrics.
- [x] Add `playtest:self-improve --oracles` to run the existing oracle suite and include standardized oracle findings.
- [x] Dogfood fresh current-code deterministic baseline/current runs with strong replay self-check evidence.
- [x] Run adversarial review and address real findings.
- [x] Run full gates.
- [x] Commit on `main` and push.
