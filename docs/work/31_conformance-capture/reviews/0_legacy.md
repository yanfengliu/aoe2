# conformance-capture — impl iteration 1

Reviewers: Codex (`gpt-5.5` xhigh, `--sandbox read-only`) + Gemini (`gemini-3.1-pro-preview` plan-mode). Claude `-p` remains dropped as a reviewer (provider-error-retry incident: it bypassed `--allowedTools` read-only). Gemini contamination check (`git status`/`git diff`) ran clean — no working-tree edits by the reviewer.

## What was reviewed
Removal of the "looked-fun" observation oracle and its plumbing (observationOracle.ts + test, ObservationVerdict, envelope.observation, --observation, corpus observation config, dashboard column) and the new objective conformance capture: `conformanceProbe.ts` (computeRunMetrics / buildConformanceDigest / runConformanceProbe / formatFindingsMarkdown) + the decoupled `scripts/playtest-findings.mjs`.

## Findings + dispositions
| ID | Sev | Finding | Disposition |
|---|---|---|---|
| Codex-1 / Gemini-1 | **HIGH** (both, independently) | Host-level **pre-queue rejections** (`unknown-kind` / `not-owned` / `malformed-payload`) were dropped from the slim trace — the runner built `preQueueRejections` for the agent feedback loop but the `TraceEntry` stored only the engine drain, and the script writes only `entry.dispatchEvents`. So `computeRunMetrics` undercounted rejections and **completely lost the `unknown-kind` signal** — the single most important "this feature is unimplemented" signal the capture exists to surface. | **FIXED** — `llmRunner.ts` now builds `allDispatchEvents = [...preQueueRejections, ...dispatchEvents]` and uses it for BOTH `agent.reportDispatchOutcome` (unchanged behavior) AND `TraceEntry.dispatchEvents`. No double-count (a command either reaches the engine drain OR is rejected pre-queue, never both). New test `tests/playtest/llmRunner.traceRejections.test.ts` pins it. |
| Codex-2 | MEDIUM | `cost-budget-exceeded` zero-command rows were counted as gameplay **stalls** — corrupting an objective signal (a cost gate looked like the agent getting stuck). | **FIXED** — `computeRunMetrics` only counts a stall when `row.stopReason !== 'cost-budget-exceeded'`. Test added. |
| Codex-3 | MEDIUM | An all-invalid `record_findings` array silently became a clean `{findings:[]}` with no `note`, so the script rendered "_No findings recorded._" with no operator warning — hiding a malformed model turn. | **FIXED** — `parseFindings` returns a note when `findings.length === 0 && raw.length > 0`; a legitimately-empty array (model found nothing) still gets no note. Test added. |
| Codex-4 / Gemini-3 | LOW (both) | Stale "observation oracle" reference left in the `design/spec-final.md` winner-oracle bullet (the conformance bullet correctly says it was removed, but the winner bullet's asymmetry comment still named it). | **FIXED** — rewritten to drop the observation-oracle mention. |

Gemini also positively validated: `parseFindings` null/enum defensiveness, provider selection + RetryingProvider wrapping mirror the harness patterns, the slim-trace/envelope typings match, and no file exceeds 500 LOC.

## Outcome
Strong convergence: both reviewers independently flagged the same HIGH (the dropped `unknown-kind` signal), which goes to the heart of the capture's purpose. All four findings fixed with tests at iter-1; iter-2 verifies the fixes landed.
