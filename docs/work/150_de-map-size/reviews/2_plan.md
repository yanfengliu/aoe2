# Review 2: plan (the check of review 1's fixes)

## Target

aoe2 commit 2b97690c on branch `de-map-size-1106` (work 150 M1), reviewed as `git diff 4ad9a8ce 2b97690c`: review 1's fixes to plan 150 and the devlog. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from `tmp/review-runs/150-m1-r2/`, the worktree as `--cd`; no sandbox failure in its log. It recomputed the view centres from `tmp/w150/fps2.jsonl`, the requested and placed trees from the scratch generator and both `rows.json` files, the 144 save's growth and the gate windows, and cited `src/app/AoeVoxelGameView.ts` 192 and `tests/simulation/gatherDomain.test.ts` 103 outside the diff.

## Reports

### Codex (gpt-6-astra), condensed

Review 1's findings 2-6 fixed: the tree shortfall (1,670 and 3,272 asked, 1,489 and 3,065 placed, 10.8% and 6.3%), the relics (five and nine), the `gatherDomain` multipliers named, both devlog lines (68.5%, projections), the 144 projection (5,041,031 bytes at tick 300, 8.12% growth to about 5.44 MB) and the heap ranges (81-254 against 77-116 MB; 269 against 139). Finding 1 not fixed completely: the Method still promised a map-centre view, and the frame-rate heading and point 4 still put DE Medium over its base on a quiet machine, against the camera paragraph. New, minor: `gatherDomain`'s 2.5-3.5 is not the whole range (2.16 at 18,000, and a case may stop at 14,000); DE Medium's 17 tiles is 17.6.

## Findings and disposition

- Finding 1: fixed in the three places named: the Method says the camera was asked for the Town Center and where it stood is given below the table, the heading says "asked for" and "quiet except where said", and point 4 says DE Medium was measured near its first base, 18 tiles from it.
- `gatherDomain`: 2.2-3.5 with the named examples, 22-88 s.
- 17 tiles: 18.

## Verification

The wording now matches the recorded camera centres; `npx vitest run tests/architecture` and `npm run content:validate` pass on the staged documents. No further review round was run on these wording fixes: each applies the reviewer's own named line and value.

## Round outcome

Approved with the three wording fixes applied above; the review loop for M1 ends here.
