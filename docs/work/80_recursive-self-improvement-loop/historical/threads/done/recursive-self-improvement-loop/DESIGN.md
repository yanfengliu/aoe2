# Recursive Self-Improvement Loop Design

## Goal

Make the existing playtest harness produce a durable self-improvement ledger for this repo. The ledger should prove that a run can be inspected by the repo itself, that findings are represented as `civ-engine` shared `ImprovementFinding` payloads, that replay/self-check evidence is attached, that findings are classified into proposal/fix/observe paths, and that a rerun can be compared against a previous run.

## Current State

The repo already has the pieces of the loop:

- `scripts/playtest-llm.mjs` runs the LLM player and records bundle, envelope, trace, and screenshots.
- `scripts/playtest-findings.mjs` computes conformance metrics, records conformance findings, and injects `author: "agent"` markers into the bundle.
- `src/game/playtest/visualPlaytestAdapter.ts` maps conformance findings to `civ-engine` `ImprovementFinding` marker payloads.
- `scripts/replay-inspect.mjs` uses `SessionReplayer` plus the aoe2 replay bridge to inspect real recorded state.
- `scripts/playtest-llm-auto-fix.mjs` and `applyAndGate.ts` can apply a proposed patch and rerun gates, but they are focused on engine halt regressions.
- `scripts/propose-fix.mjs` can generate focused fix prompts. It now accepts a self-improvement ledger directly before falling back to the legacy oracle `REPORT.md` table.

The gap is orchestration and evidence shape: there is no single command that reads the run artifacts, extracts standardized improvement findings, records replay/self-check evidence, classifies the findings, and compares before/after reruns.

## Design

Add a small self-improvement ledger layer:

- `src/game/playtest/selfImprovementLoop.ts` is the pure contract layer. It reads run artifact objects, extracts shared `ImprovementFinding`s from markers or from saved envelope findings, computes conformance metrics from the trace, classifies findings, compares baseline/current metrics with `civ-engine.compareMetricsResults`, and formats JSON/Markdown ledger output.
- `src/game/playtest/selfImprovementFindingComparison.ts` compares baseline/current standardized finding identities and reports which findings were resolved, persisted, or introduced by the rerun. Generic findings use their ids; deterministic oracle findings use oracle/tick/message as the stable evidence identity because their generated ids include an order-dependent suffix.
- `scripts/playtest-self-improve.mjs` is the command-line glue. It reads `<prefix>.json`, `<prefix>.envelope.json`, and optional `<prefix>.llm-trace.jsonl`, repairs historical `metadata.endTick: 0` bundles in memory, optionally runs deterministic oracles with `--oracles`, runs `SessionReplayer.selfCheck({ stopOnFirstDivergence: true })` through `createReplayWorldOnly`, and writes the ledger.
- `package.json` exposes the command as `npm run playtest:self-improve -- --current <prefix> [--baseline <prefix>] [--out <path>] [--oracles]`.
- `src/game/playtest/fixProposalInput.ts` is the proposal-intake adapter. It selects eligible `classification.kind: "fix"` ledger findings, converts their shared `ImprovementFinding` payload back into the existing fix-prompt violation shape, and keeps the bundle prefix attached.
- `scripts/propose-fix.mjs --ledger <ledger.json> [--finding-id <id>] [--dry-run]` is the standard proposal entrypoint for recursive-loop findings. Dry run writes `TARGET.json` and `PROMPT.md` without invoking Codex or Claude, which makes the intake path dogfoodable even when reviewer CLIs are unavailable.

## Classification

The ledger preserves the engine finding exactly and records a derived classification beside it:

- `proposal`: `nextAction: "proposalOnly"`.
- `fix`: `nextAction: "autoFix"` or `"manualFix"`.
- `observe`: `nextAction: "observeMore"`.
- `none`: `nextAction: "none"`.

The ledger also carries `disposition`, defaulting to `candidate` when the finding has none. This keeps proposal/fix state explicit without pretending an unreviewed conformance finding is already a committed fix.

Deterministic oracle violations map into shared improvement findings too:

- `match-completes` -> `category: "regression"`, `nextAction: "manualFix"` for high/medium severities.
- `no-tick-failures` and `no-pinned-or-oscillating-units` -> `category: "bug"`.
- `no-perf-regression` -> `category: "performance"`, with low-severity entries routed to `observeMore`.

`scripts/run-oracles.mjs` remains useful as a gate/report command, but recursive-loop evidence should flow through `playtest:self-improve --oracles` so violations are preserved as standardized `ImprovementFinding`s.

`scripts/propose-fix.mjs` may still read `REPORT.md` for older artifacts, but ledger input is preferred for recursive-loop work because it uses the classified shared finding contract instead of reparsing the legacy markdown table.

## Verification

Each run receives a `replaySelfCheck` evidence record:

- `ok`, checked segment count, divergence counts, skipped segment count.
- `error` when construction or self-check throws.
- `kind: "replay-self-check"` so future tools can distinguish strong replay evidence from weaker text-only evidence.

The ledger can still be written when self-check fails; that failure is itself loop evidence and blocks claiming the whole loop complete. A successful engine return is not sufficient by itself: strong replay evidence requires at least one checked segment and zero skipped segments, because no-op and failure-skipped self-checks otherwise overclaim evidence.

## Rerun Comparison

When both `--baseline` and `--current` are supplied, the ledger compares objective metrics:

- `ticksRun`
- `decisionsRun`
- `commandsAttempted`
- `commandsAccepted`
- `commandsRejected`
- `stallDecisions`
- `findingsCount`
- `stopReason`

The comparison uses `civ-engine.compareMetricsResults` so aoe2 does not fork a custom delta contract.

For deterministic runs without an LLM trace, decision/command/stall metrics are recorded as zero and the comparison still includes `ticksRun`, `stopReason`, and `findingsCount`. This avoids NaN placeholders while preserving the fact that no LLM decision loop ran.

The comparison also includes standardized finding deltas:

- `resolved`: finding identities present in the baseline run and absent from the current run, reported by baseline finding id.
- `persisted`: finding identities present in both runs, reported by current finding id.
- `introduced`: finding identities absent from the baseline and present in the current run, reported by current finding id.

This makes rerun evidence explicit enough to tell whether a proposed fix closed its target, carried it forward, or introduced new loop work.

## Non-Goals

- Do not replace the existing LLM runner.
- Do not auto-apply gameplay fixes in this slice.
- Do not mark findings as fixed unless a later patch and rerun proves it.
- Do not commit generated `output/` ledgers; commit the command, tests, and a concise thread/devlog evidence summary instead.
