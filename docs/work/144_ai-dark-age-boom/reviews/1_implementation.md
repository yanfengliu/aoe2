# Review 1: implementation

## Target

aoe2 commit 1f11ad9b on branch `ai-dark-age-1105` (work 144 M1), reviewed as `git diff b59fb08b 1f11ad9b`: the repairs of review round 0's four findings and the run-directly census naming the new runner. A focused re-review.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-144-m1-r2`, with the worktree as `--cd`. The runbook's Codex check printed `keep`; the lane cited `scripts/controlWorktree.mjs:26` and `src/game/simulation/createSimulationBridge.ts:310`, outside the diff, and both say what it says (the shared dependency junctions; a `match-over` refusal advances nothing).
- One lane. The worktree's status was the same before and after; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Four findings remain on `1f11ad9b`:

- **High — Fingerprints can describe a different revision than the worker measured.** [selfplay-ab.mjs:175](scripts/selfplay-ab.mjs:175) copies the parent’s earlier fingerprint without checking the files actually loaded. Changes during the pool can produce records stamped with the previous revision, later accepted by `--reuse`. This includes shared engine rebuilds: outside the diff, [controlWorktree.mjs:26](scripts/controlWorktree.mjs:26) documents the shared dependency junctions. The tests compare supplied fingerprint strings; they never exercise fingerprint construction or revision changes during execution.

- **Medium — `match-over` still bypasses tick validation.** [selfplayAuditMatch.mjs:303](scripts/selfplayAuditMatch.mjs:303) accepts it regardless of advancement or outcome. The outcome check runs afterward. Read-only probes reproduced a frozen, still-running bridge returning a successful 3,000-tick record with a five-minute sample; an already-finished world at tick zero reported `endedAt: 1`. Outside the diff, [createSimulationBridge.ts:310](src/game/simulation/createSimulationBridge.ts:310) confirms this refusal advances nothing. The new test explicitly accepts the refusal without testing the loop’s accounting.

- **Medium — Custom output directories invalidate their own reusable records.** [selfplay-ab.mjs:121](scripts/selfplay-ab.mjs:121) hashes every nonignored untracked file. Using `--out selfplay-results` inside an arm creates files after fingerprinting; the next identical `--reuse` includes those results in the fingerprint and refuses them. Exclude task outputs or restrict hashing to execution inputs.

- **Medium — Longer supported horizons still lose measured army samples.** [selfplayAbReport.mjs:38](scripts/selfplayAbReport.mjs:38) caps reporting at twelve samples although `--ticks` permits longer matches. Changing only the recorded 65,000-tick army from 1 to 99 produced an identical report. The coverage test checks the default horizon and column metadata, so it misses this omission.

The median repair passed 55,986 symmetry cases; I found no downstream NaN/infinity defect for valid records. The assertions catch the original reported defects, but leave the gaps above.

No files changed. Full tests were not run because they write temporary files; CI status returned `UNKNOWN`.

## Findings and disposition

- **R1-1 (high), accepted and repaired.** The parent fingerprinted each arm once, before the pool, and handed that to every worker. Each worker now fingerprints the arm's game and the measurement itself, before it loads the game and after its match, fails when they differ, and stamps the record with what it loaded; `readRecord` then refuses a fresh or reused record whose fingerprints are not the run's. The engine build is part of the game's fingerprint (its `package.json` and every `dist/*.js`), so a rebuilt shared engine is a different game.
- **R1-2 (medium), accepted and repaired.** A step refused as `match-over` is taken only when it advanced nothing and the match state then says the match is over; otherwise the match fails. A match's end is the ticks the world ran, so a match over before its first step ends at 0, not 1.
- **R1-3 (medium), accepted and repaired.** The game's fingerprint hashes untracked files under `src/` and `design/` only, so an untracked `--out` folder inside an arm no longer changes it.
- **R1-4 (medium), accepted and repaired.** The report has an army row for every sample any record holds (`columnsFor`), so a horizon past 60,000 keeps its last samples.
- The reviewer found the median repair symmetric over 55,986 cases and no downstream NaN or infinity defect.

## Verification

Repairs on the commit after 1f11ad9b. `tests/scripts/selfplayAb.test.ts` has 18 tests, all passing; each repair is red with its defect put back (`tmp/m1/mutate.mjs`, 38 mutants in all, 9 of them round 1's: the worker's change check and its stamp, the `match-over` check and the end read off the loop's count, the untracked files hashed anywhere, and not at all, the uncommitted diff and the engine build not hashed, and the army rows stopped at twelve). The runner played four short matches end to end on both arms with the worker's fingerprints, and a second run of the same command with `--reuse` played none and reported them.

## Round outcome

Four findings, all accepted and repaired. Round 2 checks the repairs.
