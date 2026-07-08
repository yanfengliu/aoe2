# Recursive Loop Closure Design (Track A)

## Decision

Close the recursive self-improvement loop that `docs/threads/done/recursive-self-improvement-loop/` deliberately deferred: one bounded `playtest:recursive` pass that chains run -> ledger -> select -> propose -> (opt-in) apply+gate -> rerun -> prove-fixed -> pass manifest, plus episodic memory so the next run starts from the previous ledger instead of rediscovering known findings. This is the reference vertical slice for the cross-game loop contract in civ-engine's `docs/threads/current/agent-recursive-improvement-loop/DESIGN.md`.

## Context

The prior thread shipped the pieces as four manually-invoked commands (`playtest:llm` -> `playtest:findings` -> `playtest:self-improve` -> `propose-fix --ledger`) and explicitly deferred auto-apply and rerun-proves-fixed. `applyAndGate` (apply/gate/revert primitive) exists but is reachable only through the legacy `playtest:llm-auto-fix`, which triggers on `engineHalt` regressions, not ledger classifications. Nothing feeds prior findings into the next run's agent context.

civ-engine v1.5.0/v1.6.0 shipped the hardened contracts this slice consumes — and broke three aoe2 spots under the symlink: the `IMPROVEMENT_FINDING_SCHEMA_VERSION` constant is now 2 (two tests pin marker payloads at 1), and the widened `ImprovementNextAction` union breaks the exhaustiveness guard in `classifyFinding` (typecheck/build red). Fixing that alignment is step 0 and part of this thread's scope.

## Goals

1. aoe2 gates green against civ-engine 1.6.0 with minimal-stamping adoption (v1-vocabulary findings keep stamping schema version 1; the existing test pins stay meaningful and unchanged).
2. Ledger-classified `fix` findings become the primary auto-fix input, reusing `selectLedgerFixCandidate` + `buildFixPrompt` + `applyAndGate`; the legacy `engineHalt` trigger in `playtest:llm-auto-fix` remains as the crash fast-path.
3. One `playtest:recursive` command that runs a bounded pass end to end with hard budgets (a single fix attempt per pass; the pass cost budget split between run and rerun; ticks bounded by `--max-ticks`) and writes a machine-readable pass manifest built with the engine's `createImprovementRunManifest` (artifacts + gates + cost + stop reason).
4. Prove-fixed discipline at ORACLE granularity: a fix is only reported fixed when the rerun shows no violation of the candidate's oracle at all (and no finding with the candidate's exact identity), judged against the union of the rerun ledger's findings and a fresh oracle sweep over the rerun bundle. Identity keys embed run-specific ticks/messages, so identity-only matching would let a nondeterministic rerun "resolve" the same bug class under a fresh key — false-proven, the unsafe direction. The pass manifest records the outcome; a proven fix leaves the branch push-ready with HEAD on it (never merged automatically); an unproven fix is reverted.
5. Episodic memory: the next run receives the previous ledger's open findings as a "known open issues" prompt section (`--known-findings`), so the agent verifies instead of rediscovers.
6. Honest verification statuses: oracle-sourced ledger findings become `verificationStatus: 'verified'` + `verificationMethod: 'metric'` only when the run's replay self-check is strong (`ok` after the vacuous-check normalization); validated with the engine's strict `requireVerificationEvidence` mode.

## Non-Goals

- No merge-to-main automation: `--apply` produces a gated, counterproven branch; pushing/merging stays human.
- No replacement of `playtest:llm-auto-fix`; it stays as the engineHalt crash path.
- No committed `output/` artifacts; the command + tests + thread/devlog evidence summary are the durable record.
- No multi-fix batching in one pass: exactly one fix attempt per pass (hard-coded); the loop converges over passes, not within one.

## Shape

### Classification mapping for the widened vocabulary

`classifyFinding` maps the four v2 `nextAction` values to `{ kind: 'proposal', autoFixEligible: false }`: `improveHarness`, `fileEngineFeedback`, `addRegression`, and `updateDesign` all route to workflows outside gameplay auto-fix (harness code, engine-feedback docs, test authoring, design docs). If a later slice wants auto-authored regressions, it earns its own safety envelope.

### Minimal stamping

`conformanceFindingToImprovementFinding` and `oracleViolationsToImprovementFindings` stamp `minimalImprovementFindingSchemaVersion(nextAction)` instead of the raw constant. Their vocabulary is v1, so payloads stamp 1 and the existing marker pins stay unchanged; any future v2-vocabulary emission stamps 2 automatically.

### `playtest:recursive` pass state machine (scripts/playtest-recursive.mjs + src/game/playtest/recursivePass.ts)

The script is a thin spawner; the decisions live in a pure, unit-tested module:

1. run current playtest (`playtest:llm`, forwarding seed/max-ticks/cost-budget/known-findings) -> current prefix
2. build ledger (`playtest:self-improve --oracles --current ... [--baseline ...]`) -> ledger path
3. select candidate (`selectLedgerFixCandidate`) -> none? finish pass as `no-fix-candidate`
4. propose (`propose-fix --ledger ...`) -> proposal.diff; `--apply` absent? finish as `proposal-only` with the proposal path in the manifest
5. apply+gate (`applyAndGate` on branch `recursive/<seed>-<stamp>`; gates: typecheck, lint, build, test) -> failure? finish as `apply-failed`/`gate-failed` (worktree reverted by the primitive)
6. rerun (`playtest:llm` same seed) + rerun ledger (baseline = current run) + a fresh oracle sweep over the rerun bundle (endTick-repaired) -> `proveFixOutcome` at oracle granularity over the union -> PROVEN: finish as `fixed-proven`, branch left push-ready (HEAD stays on it); not proven? revert branch, finish as `fix-unproven`
7. write pass manifest (`createImprovementRunManifest`): id, seed, git commit, engine version, model/provider, cost, duration, stop reason = pass outcome, artifacts (bundle/envelope/trace/ledger/proposal/rerun-ledger paths), gates.

### Episodic memory

`playtest-llm.mjs --known-findings <ledger.json>` loads the ledger (validated before any server/browser startup), selects open findings (top N=8 by severity, skipping `rejected`/`wontFix` dispositions, whitespace-collapsed), and threads one formatted section into the agent context via a new `LlmAgentConfig.knownIssues` -> `buildTacticalPrompt`/`buildStrategyPrompt` section: "Known open issues from prior runs (verify whether still present; do not rediscover them): ...". The recursive pass forwards `--known-findings` explicitly; chaining the previous pass ledger automatically is a follow-up once multi-pass operation is routine.

## Risks

- Cost: a full `--apply` pass runs the LLM at least twice (run + rerun) plus one proposal call; budgets forward to every run and the pass records total cost in the manifest.
- Flaky prove-fixed: LLM-driven reruns drift run-to-run even at temperature 0, and oracle identity keys embed run-specific ticks/messages — which is exactly why proving happens at oracle granularity over the union of ledger findings and a fresh oracle sweep. Residual nondeterminism then surfaces as `fix-unproven` (safe direction — reverts); a same-class violation can never fake resolution under a fresh identity.
- Concurrent auto-fix + recursive runs share `output/playtests-llm` fixed prefixes; the recursive pass uses its own `recursive-*` prefixes to avoid collision.
