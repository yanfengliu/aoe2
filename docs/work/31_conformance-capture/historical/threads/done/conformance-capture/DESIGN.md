# Conformance capture — objective playtest gap-finding (replaces the fun oracle)

Objective: turn an LLM playtest run into an OBJECTIVE, actionable backlog of ways the implementation is missing / broken / divergent from real Age of Empires II — not a subjective "looked-fun" verdict. The fun oracle is removed (user 2026-06-13: "Looked-fun is garbage. I don't need your judgement of fun"). The capture is the measurement half of the self-improving build loop: run → findings → implement → re-run.

## Why decoupled (post-hoc), not in-run

The old observation oracle ran INSIDE `playtest-llm.mjs` at end-of-run, gated by `--observation`. That couples capture to the run, can't be re-run on past bundles, and — decisively — campaign-4 was launched WITHOUT it, so the only way to analyze campaign-4 is a post-hoc pass over its saved artifacts. A decoupled `scripts/playtest-findings.mjs <prefix>` reads `<prefix>.envelope.json` + `<prefix>.llm-trace.jsonl` (+ the last `<prefix>-screenshots/*.png`), so it works on ANY past or future run and can be re-run for free with an improved probe.

## What is objective signal

The slim trace (`.llm-trace.jsonl`) already records, per decision: the agent's thought (≤500 chars), the command TYPES it attempted, and every dispatch event with `accepted` + `rejectionReason` + `rejectionMessage`. That yields hard, computable signal WITHOUT any LLM judgement:

- **command-type distribution** — what the agent could actually do.
- **rejections by reason** — a command rejected `unknown-kind` is literally "that action is not implemented"; `not-owned` / `malformed-payload` are friction.
- **stall decisions** — decisions that issued zero commands.
- **outcome counts** — `envelope.winner` per-owner entity counts.

The LLM critique layer then adds what hard metrics can't see: what real AoE2 has that the agent never even attempted because the game doesn't offer it (missing ages/units/techs/buildings/mechanics), grounded in publicly-known AoE2 rules. The model is told to be objective and checkable, NOT to judge fun.

## Surface

`src/game/playtest/conformanceProbe.ts` (pure orchestration over `LlmProvider`, no I/O):
- `computeRunMetrics(envelope, traceRows): RunMetrics` — pure; the hard metrics above.
- `buildConformanceDigest(metrics, traceRows): string` — pure; metrics + chronological thoughts + rejection reasons, for the LLM.
- `runConformanceProbe({ provider, model, digest, finalScreenshotPng?, maxOutputTokens? }): Promise<ConformanceResult>` — one LLM call emitting `findings[]` via a `record_findings` tool. Fallback to empty findings + note on malformed output (advisory; never throws on a bad model turn).
- `formatFindingsMarkdown(metrics, findings, meta): string` — the `<prefix>.findings.md` report.

`scripts/playtest-findings.mjs <prefix> [--no-llm] [--model <m>]` — reads artifacts, computes metrics, optionally runs the probe (RetryingProvider-wrapped, claude-opus-4-8 while Fable banned), writes `<prefix>.findings.md` and merges `findings` + `metrics` into the envelope JSON.

Finding shape: `{ category: 'missing-feature'|'spec-divergence'|'functional-bug'|'balance-divergence'|'ux-gap', area, observed, expected, severity: 'low'|'medium'|'high', suggestion }`.

## Removed

The fun oracle and its plumbing: `observationOracle.ts` (+test), `ObservationVerdict`, `envelope.observation`, the `--observation` flag + in-run block in `playtest-llm.mjs`, the corpus `observation?` config flag (+ schema tests), and the dashboard's `observation` column (→ a `findings` count column). `buildTraceSummary`'s useful agent-state formatting is preserved inside `computeRunMetrics`/digest where applicable.

## Non-goals

- No CI gating. Findings are advisory backlog input; `engineHalt` stays the regression signal. (Distinct from the corpus regression gate.)
- finalAgentState (live snapshot) is NOT required — the decoupled script has no live page. Metrics derive from the saved envelope + trace. A later runner enrichment can stamp `envelope.finalAgentState` + per-decision age to deepen metrics; out of scope here (campaign-4 is already running without it).
- No version bump (internal tooling).

## Determinism / fog

None — analysis tooling only; no simulation, snapshot, or render change.
