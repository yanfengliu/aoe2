# Review 18: implementation

## Target

aoe2 commit 78362a38 on branch `ai-economy-m2a2b-1105` (work 141 M2a-2b), reviewed as `git diff a8f23b5d 78362a38 -- src tests design`: the repairs of review round 17's four findings (3d64ca64) and spec §13.3 corrected by them.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff: `aiSystemGating.ts:180` and `aiPurchases.ts:204`. It ran 60 focused tests and `tsc --noEmit`, both passing, and tried mutations in memory.
- One lane. Before the run the tree's only changes were the worker's own record edits; afterwards no file under `src/`, `tests/` or `design/` had changed. The lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed `a8f23b5d..78362a38`. **No runtime regression found; two low issues remain.**

1. **Low — R17-2's phase wiring lacks regression coverage.** `tests/simulation/aiSiege.test.ts:159` supplies counts directly; the bridge fixtures begin without queued rams. I changed `aiSiegePhase.ts:103` **in memory only** to `ramsStanding: ramsStanding + ramsQueued`, restoring the original counting defect. All **19 tests still passed**. Add a phase-level case with queued rams that must not exempt the army from defence subtraction.

2. **Low — §13.3 still omits the population exemption.** `design/spec-final.md:1917` describes defence subtraction without requiring population below `maxCivilianPopulation`. Both `aiSiege.ts:130` and DE's `threats.per:1277` require that condition. At population 186, eight military versus one enemy and a Castle yield superiority **1**, despite having neither standing siege nor Imperial technology. This is a surviving omission in the amended paragraph.

The four runtime/citation repairs otherwise address R17:

- **R17-1:** The decision-wide flag prevents the second ram while preserving Mangonel production and ordinary production when no priority ram was bought. Removing the guard failed the rich-fixture test.
- **R17-2:** The current code correctly separates standing and total counts. Reverting the helper calculations failed three tests; the phase coverage gap is above.
- **R17-3:** All seventeen upgrades match DE's scripts. Removing Cavalier failed both the list and bridge tests; disconnecting the phase's technology check also failed.
- **R17-4:** The Trebuchet/Bombard Cannon ordering and under-attack citation are corrected.

Outside the diff, I read `aiSystemGating.ts:180`, confirming the two-slot producer gate, and `aiPurchases.ts:204`, confirming purchases succeed before the escrow budget opens. I found no escrow-budget, no-goal-path, or type regression.

**Validation:** 60 focused tests passed; `tsc --noEmit` and diff whitespace checks passed. Full verification was not run; remote CI was inaccessible. No files were modified.

## Findings and disposition

- **R18-1 (low), accepted and repaired.** `ai-siege-ram-queued-fixture` (the Imperial no-army-technology case with 175 gold): the test queues a Battering Ram by owner 2's own order, checks it is queued before the first decision, and then that no second ram is queued, since a queued ram is not standing siege and the Castle still counts against the lead. With Codex's mutation (the phase passing the queued ram as standing) it queues a second ram and the test fails, alone.
- **R18-2 (low), accepted and repaired.** Spec §13.3 names the population condition: the defence subtraction applies only while the population is under DE's max-civ-pop (186 at 200, 194 for the Goths).

## Verification

Repairs on b55678c5 (`git diff 78362a38 b55678c5`): one fixture entry, one test, one spec sentence. `tests/simulation/aiSiege.test.ts` has 20 tests, all passing; R18-1's case is red with its defect back (`tmp/m2a2b/mutations/r18.json`). The repairs change no code under `src/` but the fixture registry, so the self-play arms of round 17's repairs stand.

## Round outcome

Two low findings, both accepted and repaired. The repairs are one test and one spec sentence; round 19 checks them.
