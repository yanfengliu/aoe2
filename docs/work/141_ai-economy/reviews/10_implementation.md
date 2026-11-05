# Review 10: implementation

## Target

aoe2 commit d3d9ee67 on branch `ai-economy-m2-1104` (work 141 M2a-1), reviewed as `git diff 52d60aff d3d9ee67` alone: the repair of [round 9](9_implementation.md)'s R9-1, which the coordinator authorized on 2026-11-05 as the first repair of a new defect that round 8's change introduced. A focused check of that one fix, as the coordinator set it, not a full round.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree. It was told not to run the full suites. Its log's two `STATUS_DLL_INIT_FAILED` matches are lines of earlier rounds' records that it read, not results of its commands. It ran the case's two variants in memory.
- One lane.
- The tree's `git status --porcelain` showed only the plan edit made outside the lane, before it ended; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

No material findings. **R9-1 is closed by this fix.**

- `aiSystemProductionPhase.ts:394`: Every Imperial-trade branch now requires a non-null cost and budget affordability while the budget is active. Accepted trades remain counted. With no budget, behavior is exactly unchanged.
- `aiEscrow.test.ts:283`: The save boundary faithfully preserves pending commands. Isolated in-memory execution confirmed an active budget and null trade cost in both variants: **360 gold with the fix; 7 gold with round 8's condition restored**, failing the assertion. The case is not vacuous.
- `fixtures/aiEscrow.ts:162`: Remaining changes only support the regression fixture and test; existing fixture options retain their defaults.

No files modified; no full suites run. Diff checks passed. Remote CI status was unavailable because network access is restricted.

## Findings and disposition

No findings.

## Verification

- The case, `asks for no Market trade it cannot pay for while a hold stands, so income before its handler cannot spend the hold` on `ai-escrow-income-fixture`: red on 52d60aff (7 gold of Conscription's 150 left), green on d3d9ee67 (360). Three mutants of the trade's gating, one at a time against the 30 escrow tests: round 8's condition put back (fails this case), the trade not counted (fails one) and the budget check dropped (fails two).
- Re-measured on d3d9ee67: the coverage lab's census and spending probe and the castle configuration's seven matches are byte for byte round 9's, so no recorded number moves.

## Round outcome

No findings: R9-1 is closed.
