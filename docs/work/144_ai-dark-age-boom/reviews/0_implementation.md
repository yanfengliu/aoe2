# Review 0: implementation

## Target

aoe2 commit b59fb08b on branch `ai-dark-age-1105` (work 144 M1), reviewed as `git diff 41732763 b59fb08b`: the multi-seed A/B instrument (`scripts/selfplayAuditMatch.mjs`, `scripts/selfplay-ab.mjs`, `scripts/selfplayAbReport.mjs`), the audit on the shared module, `tests/scripts/selfplayAb.test.ts` and the records.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/` (`aoe2-144-m1-r1`), with the worktree as `--cd` and the diff appended to the prompt. The runbook's Codex check printed `keep` (no failed command); the lane ran 28 commands and cited `src/game/simulation/createSimulationBridge.ts:307`, outside the diff, which says what it says (a halted step returns without advancing).
- One lane, Codex preferred by the brief. The worktree's status was the same before and after; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

- **High — Reused records are not tied to the measured revision.** [selfplay-ab.mjs:170](scripts/selfplay-ab.mjs:170) validates only seed, configuration, horizon and schema. After changing either checkout, `--reuse` silently accepts its previous results while the report names the current commit. This can produce a false zero-difference A/B. Persist and validate game and measurement fingerprints.

- **High — Halted simulations become successful measurements.** [selfplayAuditMatch.mjs:243](scripts/selfplayAuditMatch.mjs:243) ignores the step result and advances its own clock. Outside the diff, [createSimulationBridge.ts:307](src/game/simulation/createSimulationBridge.ts:307) confirms halted steps return without advancing. A probe refusing every step nevertheless returned a 3,000-tick record with a five-minute villager sample. An arm that crashes can therefore appear merely slower or economically weaker. Require successful step and world-tick advancement.

- **Medium — The report omits measured columns.** [selfplayAbReport.mjs:19](scripts/selfplayAbReport.mjs:19) excludes Monastery and Monk timings and every alternate 5,000-tick army sample. Changing those fields produced an identical report. This violates “every column”; the coverage assertion at [selfplayAb.test.ts:176](tests/scripts/selfplayAb.test.ts:176) derives its expectation from the same incomplete `COLUMNS` list.

- **Medium — Even-count medians bias censored differences toward improvement.** [selfplayAbReport.mjs:72](scripts/selfplayAbReport.mjs:72) selects the lower middle value whenever infinity occurs. One gained age and one lost age yield median `-never`; swapping A and B **still yields `-never`**. Likewise, `[0, +never]` yields zero. Use an explicit indeterminate/interval result or a symmetric censoring policy, and test arm reversal.

Reviewed `b59fb08b`; read-only probes reproduced these findings. No files changed. Full tests were not run; CI status returned “UNKNOWN.”
## Findings and disposition

- **R0-1 (high), accepted and repaired.** A record now carries the fingerprints of the game it was played on (the arm's committed tree, its uncommitted diff, its untracked files and the civ-engine build it loads, `gameFingerprint`) and of the measurement (the two files a worker runs, `measurementFingerprint`), and `readRecord` refuses a reused record whose fingerprints are not the run's.
- **R0-2 (high), accepted and repaired.** `stepOneTick` throws when a step is refused for any reason but `match-over`, or runs other than one tick, or the world's tick does not move by one; the match loop steps through it. The audit inherited the defect from its own loop of 2026-09-02.
- **R0-3 (medium), accepted and repaired.** The report has a row for the Monastery, the Monk and every 5,000-tick army sample to 60,000; each column names the record field it reads, and the test checks every field of a played record against them rather than the list against itself.
- **R0-4 (medium), accepted and repaired.** The median of an even count is the mean of its middle two in IEEE arithmetic: a time and "never" give "never", a gain and a loss give "?", and swapping the arms negates every median.

## Verification

Repairs on the commit after b59fb08b. `tests/scripts/selfplayAb.test.ts` has 15 tests, all passing; each repair is red with its defect put back (`tmp/m1/mutate.mjs`, 29 mutants in all, 11 of them round 0's: the fingerprint check and the job's fingerprints, the step's refusal, its advance and the loop's use of it, the Monastery column and the army samples, the lower-middle median, the old median and "?" shown as a number). The repairs change no successful match: `aoe2-prototype` and `fortress` played again on both arms give records identical to the first run's but for the fingerprints and the wall time.

## Round outcome

Four findings, all accepted and repaired. Round 1 checks the repairs.
