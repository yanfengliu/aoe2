# Review 0: plan (the M1 study and proposal)

## Target

aoe2 commit c4ec8036 on branch `de-map-size-1106` (work 150 M1), reviewed as `git show c4ec8036`: plan 150's sourcing, measurements, proposal and tests table, and two devlog lines. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the worktree's ignored `tmp/review-runs/150-m1-r0/`, with the worktree as `--cd`. No sandbox failure in its log. It read the installed DE scripts, the ignored raw results under `tmp/w150/` and the probes under `tmp/probes/`, and cited files outside the diff (`src/ui/hud/saveLoadPanel.ts` 208, `vitest.config.ts` 24-36, `gatherDomain.test.ts` 30-123, `I/relics.inc` 115-116).
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra), condensed

Verdict: request changes before accepting M1.

1. Major: the gate projections are extrapolations from other matches (different armies, eliminations, victory settings, event-dependent stops), and the 44-minute shard estimate treats one test's growth as sequential although Vitest runs files in parallel. Describe possible crossings with their bound, not "four gates would".
2. Major: the frame rate was measured with the camera where the load leaves it, the map's top-left corner, which holds today's base but open ground on the scratch DE map (its human Town Center is at (24,38)), so "the opening is unaffected" compares different views; DE Medium can be measured through the Load panel's paste source (`saveLoadPanel.ts` 208); matrix writes per frame are not load-invariant (9,483 and 12,251 for one state).
3. Major: freezing every listed test onto today's map would stop checking the new generator: `defaultMapNarrowPath` (21-28) guards the generator trapping the villagers; `dropOffAnchorReach` (74-86) takes the nearest tree, which DE's stragglers satisfy whatever the woodline does.
4. Major: the scratch woodlines grow inward to 11 tiles (79 of seat 1's trees at 10-15 on DE Tiny) and clumps can stop short; DE Medium got 9 relics where DE's rule gives 7 (`I/relics.inc` 115-116, 193-207).
5. Minor: the profile groups count every render-adapter frame and every JSON check; `refreshRenderProjection` itself is 68.5% of the late DE Tiny tick (not 75.6%) and 59.6% of DE Medium's (not 67.9%), with the JSON checks under it 31.9%.
6. Minor: two gate rows used the 21,000-tick ratio; `aiEconomyKeepsMoving`'s first test runs 12,000 ticks (2.32) and 20,000 interpolates to 2.50.
7. Minor: the 144x144 save cutoff was estimated, not measured, and the quota probe's output was not retained.

Checked and correct: twelve DE citations (sizes, labels, Tiny's ring, berries, gold, stone, sheep, boar, relics, the Fortress and Islands enlargement); every whole-match total, the opening counts, the save sizes and the frame-rate rows reproduced from the raw files; the live and on-read arms matched window for window; six test-table rows sampled; the proposal's boundaries (owner's call on the save format, the AI lane's rules, no limit raised) respected.

## Findings and disposition

- 1: fixed. The gate table is headed as projections with their bound, the relic and hit-census gates' different victories and `gatherDomain`'s event stops are named, the CI run IDs retained, the shard estimate removed, and point 5 and step 0 say "could" with the excess per gate; a step that changes the boot map measures the real gates before it lands.
- 2: fixed by measurement. The frame rate was measured again over each map's own human base and the map's centre, two rounds interleaved, on a machine that had gone quiet (2-5 CPUs busy), and DE Medium through the paste source (its first two paste loads timed out because the probe waited for the exact saved tick after the match had resumed; it now waits for that tick or later). Late DE Tiny reads 40 fps at tick 24,000 and 22-23 at 36,000 over the base, DE Medium 17.6 at 24,000, against 59-60 on today's maps: lower than work 133's 55-fps line, though far less than the loaded first set's 4-11. The load-invariance claim for matrix writes is withdrawn.
- 3: fixed. The tests table separates generator contracts (`defaultMapNarrowPath`, `villagerGatherSpread`, `placementReachability`, ported to the new map) from mechanic tests (frozen with today's map as a fixture), and says `dropOffAnchorReach` cannot speak for the woodline, so step 2 adds a forest-tree check beside it.
- 4: disclosed, not re-measured: a few entities' difference does not move the cost measurement, and the scratch map's woodlines are no longer used for the radius question, which the sourced table answers; DE's size-dependent relic rule is added to the sourced table.
- 5: fixed with a once-per-sample count of the rebuild (`tmp/probes/profileRefresh.mjs`) in point 3.
- 6: fixed (2.32 and 2.50; 116 s and 145 s; `gatherDomain` as an upper bound).
- 7: fixed by measurement: a 144x144 two-seat save is 5.03 MB at tick 0 and about 5.4 MB late by DE Tiny's growth; the quota output is retained in `tmp/w150/storage-quota.txt`.

## Verification

The fixes were checked by measurement where a number moved: the frame-rate set run again over each base on a quiet machine (`tmp/w150/fps2.jsonl`), DE Medium through the paste source, the rebuild recounted once per sample in all six profiles (`tmp/probes/profileRefresh.mjs`), a 144x144 two-seat save generated and sized, and the quota probe's output kept. `npx vitest run tests/architecture` and `npm run content:validate` pass on the staged documents.

## Round outcome

Changes requested; all seven findings are addressed in the next revision of the branch, and review 1 checks those fixes.
