# Recursive Loop Closure Plan (Track A)

**Goal:** Ship the DESIGN.md shape: engine-1.6 alignment (step 0), ledger-primary fix intake, one bounded `playtest:recursive` pass with prove-fixed discipline and a manifest, and episodic memory. TDD throughout; aoe2 gates (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) green before commit.

## Task 0: Engine 1.6.0 alignment (gates back to green)

- [x] Failing state today (fixed): `tests/playtest/findingsToMarkers.test.ts` (2 pins at schemaVersion 1) and `tests/playtest/playtestFindingsScript.test.ts` fail; `npm run typecheck` fails at `selfImprovementLoop.ts:316` (widened `nextAction` breaks the exhaustiveness guard).
- [x] New failing test first: `classifyFinding` maps `improveHarness`/`fileEngineFeedback`/`addRegression`/`updateDesign` to `{ kind: 'proposal', autoFixEligible: false }` (tests/playtest/selfImprovementLoop.test.ts).
- [x] Implement: add the four cases before the `never` guard; switch `visualPlaytestAdapter.ts` and `oracleImprovementFindings.ts` stamping to `minimalImprovementFindingSchemaVersion(nextAction)` (existing pins go green without edits).
- [x] Verified-by-metric upgrade: when replay self-check evidence is strong (`verification.ok`), oracle-payload ledger findings gain `verificationStatus: 'verified'` + `verificationMethod: 'metric'`, validated with `assertImprovementFinding(f, { requireVerificationEvidence: true })`; non-oracle or weak-verification findings unchanged. Failing test first.
- [x] Focused suites green: selfImprovementLoop, findingsToMarkers, playtestFindingsScript, oracleImprovementFindings (if present), fixProposalInput.

## Task 1: Episodic memory (`--known-findings`)

- [x] Failing tests first: `selectKnownIssues(ledger, { limit })` returns top-severity open findings (skips `disposition: 'rejected'`), formatted lines stable; `buildTacticalPrompt`/`buildStrategyPrompt` render a "Known open issues" section when `knownIssues` present and omit it otherwise.
- [x] Implement: new `src/game/playtest/knownIssues.ts`; `LlmAgentConfig.knownIssues?: readonly string[]` threaded through `LlmAgent` into both prompt builders; `playtest-llm.mjs --known-findings <ledger.json>` flag loads + selects.

## Task 2: Recursive pass module + command

- [x] Failing tests first (`tests/playtest/recursivePass.test.ts`): oracle-granularity proving (`proveFixOutcome` over the ledger∪fresh-oracle union — fresh-identity same-oracle violations stay unproven; marker-shadowed ledgers cannot fake resolution), `findingOracleName` extraction, pass-manifest building via engine `createImprovementRunManifest` (artifacts/gates, outcome as stopReason, reviewer under `data`, empty git commit dropped).
- [x] Implement `src/game/playtest/recursivePass.ts` (pure decisions) + `scripts/playtest-recursive.mjs` (spawner: playtest:llm -> playtest:self-improve --oracles -> propose-fix -> applyAndGate -> rerun -> rerun ledger + fresh oracle sweep -> proveFixOutcome -> manifest; flags `--seed`, `--max-ticks`, `--cost-budget` (split run/rerun), `--baseline`, `--known-findings`, `--apply`, `--out-root`, `--reviewer`; one fix attempt per pass).
- [x] `package.json`: `"playtest:recursive": "tsx scripts/playtest-recursive.mjs"`.
- [x] Light script test (`tests/playtest/playtestRecursiveScript.test.ts`): `--help`, unknown-flag, and `--max-ticks` validation.

## Task 3: Ledger-primary intake note in the legacy path

- [x] `playtest-llm-auto-fix.mjs` header comment + docs: legacy engineHalt fast-path; ledger-classified findings flow through `playtest:recursive`. No behavior change.

## Task 4: Docs, review, ship

- [ ] Devlog detailed entry + summary line (harness-only; no gameplay version bump per loop-work precedent). Update `docs/engine-feedback/current.md` if any engine ask surfaced (v1.6 adoption notes belong there).
- [ ] Adversarial review: in-process reviewers + multi-CLI (agent-loop + apply-to-worktree machinery = high-risk), synthesis under `docs/threads/current/recursive-loop-closure/<date>/<n>/REVIEW.md`.
- [ ] Full gates; commit; push; move thread to done when the devlog folds the final review.
