# Review 1: plan (the check of review 0's fixes)

## Target

aoe2 commit 4ad9a8ce on branch `de-map-size-1106` (work 150 M1), reviewed as `git diff c4ec8036 4ad9a8ce`: review 0's fixes to plan 150 and the devlog. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from `tmp/review-runs/150-m1-r1/`, the worktree as `--cd`; no sandbox failure in its log. It recounted the two late profiles, read `tmp/w150/fps2.jsonl`, the 144 save's rows and the gate windows, and cited files outside the diff (`src/app/AoeVoxelGameView.ts` 89 and 192, `tests/simulation/gatherDomain.test.ts` 68).

## Reports

### Codex (gpt-6-astra), condensed

1. Major: the camera did not always stand where asked. It keeps the boot map's reach after a load (`AoeVoxelGameView.ts` 89, 192): the DE Tiny "centre" view stood at (36.28,36.28), not (60,60), and DE Medium's "base" at (28.05,44.52), not (30,62); the load log ends before the DE Medium runs.
2. Major: the scratch maps' trees fall short of the generator's own requests (1,489 of about 1,670 on Tiny, 3,065 of 3,272 on Medium), so "a few entities" understates it; the Method's "five relics" contradicts Medium's nine.
3. Minor: `gatherDomain`'s 2.50 is not an upper bound (3.48 at 3,000 ticks, 2.70 at 7,000, where one case stops).
4. Minor: the devlog lines still say 75% and "four gates would".
5. Minor: the 144x144 cutoff is a projection; cite the retained tick-300 size (5,041,031).
6. Minor: the page-heap ranges mixed openings with late states (quiet late 1v1: 81-254 MB DE Tiny against 77-116 today).

Per review 0's findings: 3 fixed; 1, 2, 4, 5, 6 and 7 fixed in the plan but not completely (the devlogs, the camera framing, the relic count in the Method, the `gatherDomain` bound, the 144 wording). The recounts held: the rebuild 68.549% (Tiny) and 59.588% (Medium), the JSON checks under it 31.939%; 2.32 and 2.50, 116 s and 145 s. Step 0 stays justified by DE Tiny's late frame rate below 55 fps.

## Findings and disposition

- 1: disclosed with the recorded view centres; the second DE Tiny view is called near the base, not held out, DE Medium is said to be measured near its first base, the unsampled load is stated, and the camera's boot-map reach after a load is recorded as a finding for plan 106 (not reproduced through the real controls).
- 2: disclosed with the shortfall (11% and 6% fewer trees than asked), which makes the measured costs, if anything, low for the layout; the Method says nine relics on Medium.
- 3: fixed: 2.5-3.5 by where a case stops, 25-88 s.
- 4: fixed in both devlog files (68.5%, projected).
- 5: fixed: the 144 figure is a projection, citing 5.04 MB at tick 300.
- 6: fixed: 81-254 MB against 77-116 MB late on the 1v1.

## Verification

Every replaced number was read from the files the review cites (`tmp/w150/fps2.jsonl` view corners and heaps, the scratch generator's requested and placed tree counts, `tmp/w150/de-144-2p-smoke/rows.json`, the gate windows). `npx vitest run tests/architecture` and `npm run content:validate` pass on the staged documents.

## Round outcome

Changes requested; fixed by disclosure and corrected figures in the next revision; review 2 checks them.
