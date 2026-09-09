# Implementation plan — conformance-capture

TDD; affected tests while iterating, full gates before commit.

1. **Types** (`types.ts`): add `ConformanceFinding`, `ConformanceResult`, `RunMetrics`, `RunMetricsCommandStat`. Remove `ObservationVerdict`. (StopReason/RunnerEnvelope keep their shape minus `observation`.)
2. **conformanceProbe.ts** (new, pure orchestration): `computeRunMetrics`, `buildConformanceDigest`, `runConformanceProbe`, `formatFindingsMarkdown`, `SYSTEM_PROMPT_CONFORMANCE`. <300 LOC.
3. **Tests** (`tests/playtest/conformanceProbe.test.ts`): metrics from a synthetic trace (command-type tallies, rejection-reason histogram, stall count, distinct types); digest includes thoughts + rejection reasons; probe parses `record_findings` + falls back to empty-findings on malformed/missing tool call (advisory, no throw); cost passthrough; markdown groups by severity. Replace `observationOracle.test.ts`.
4. **Script** (`scripts/playtest-findings.mjs`): read `<prefix>.envelope.json` + `.llm-trace.jsonl` (+ last screenshot), compute metrics, optional LLM probe (RetryingProvider + claude-opus-4-8), write `<prefix>.findings.md` + merge `metrics`/`findings` into envelope. `--no-llm` for metrics-only.
5. **Remove fun oracle**: delete `observationOracle.ts` + test; strip `--observation` flag + in-run block + import from `playtest-llm.mjs`; drop `observation?` / `ObservationVerdict` from `llmRunner.ts` + `types.ts`; drop corpus `observation?` config (`corpusLlmSchema.ts` + 3 schema tests) + the `--observation` forward in `playtest-corpus-llm.mjs`; swap the dashboard `observation` column for a `findings` count.
6. Spec §15.7 — replace observation-oracle/fun language with the conformance-capture description; note the fun verdict is removed per the 2026-06-13 directive. Devlog. Full gates → multi-CLI review (Codex + Gemini; Claude `-p` still dropped as a reviewer per provider-error-retry incident) → commit.
7. Run `playtest-findings.mjs` on campaign-4 once the run completes → first objective backlog (feeds task #11).
