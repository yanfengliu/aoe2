# Review 5: implementation

## Target

aoe2 commit 6d667613 on branch `ai-dark-age-1105` (work 144 M2), reviewed as `git diff 18bcd8cc 6d667613 -- src tests docs/learning`: three HUD and input browser specs that waited for the computer's own Dark Age raid on the idle human, repointed at a scripted raid on the boot map (`boot-map-raid-fixture`), with its contract test, its registration and the defect register's entry and rollover. A focused review, by the coordinator's widened scope of 2026-11-06.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-144-m2-r5`, with the worktree as `--cd`. The runbook's Codex check printed `keep` (no failed command). The lane cited `src/game/simulation/bridge/assembleBridgeApi.ts:136` and `src/game/simulation/bridge/playerHitFeed.ts:72`, both outside the diff, and both say what it says. It ran read-only probes, including one sampling the hit feed every tick of the fixture to tick 1,000, and an independent serial reviewer it delegated to corroborated its finding.
- One lane. The worktree's `git status --porcelain` was empty before and after the run; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

One **medium** finding in `6d667613` against `18bcd8cc`.

- **Medium — The quiet-period test misses earlier damage.** [bootMapRaidFixture.test.ts:69](tests/simulation/bootMapRaidFixture.test.ts:69) advances 1,000 ticks before checking `getRecentPlayerHits()`. Outside the diff, [assembleBridgeApi.ts:136](src/game/simulation/bridge/assembleBridgeApi.ts:136) prunes that feed on read, and [playerHitFeed.ts:72](src/game/simulation/bridge/playerHitFeed.ts:72) retains only the last ten ticks. Damage before tick 990 therefore disappears, allowing the promised "nothing was hit before any order" check to pass incorrectly. The later trials use fresh bridges and do not cover that history. Check the feed after each step. An independent serial reviewer corroborated this finding.

No additional findings in the requested scope:

- The browser assertions and 100-pixel floor remain intact. Ordering twice preserves the save/load regression: my read-only probe produced identical hits at tick 296 after orders at tick 100, still inside the stale cross-world throttle.
- Terrain, starts and original spawns match the boot map. Sampling **every tick** found no unsolicited hits through tick 1,000. Save/load preserved the seed, economy and render state. The awaited command queueing introduces no stepping race.
- The registry retains both fixtures at 500 lines. The rollover moves the correct entry verbatim, retains 12 classifier-counted closed entries and introduces no duplicates or improperly archived entries.

No files changed or test suites run. Browser mutation proofs were inspected, not rerun; CI status remained unavailable.

## Findings and disposition

- **R5-1 (medium), accepted and repaired: the quiet check read the hit feed once, at the end.** The feed keeps ten ticks, so a blow before tick 990 went unseen. The check now reads the feed after every step of its 1,000 ticks and fails on any blow, naming it. Red: with the Militia moved beside a villager at (7, 10), the per-step check fails on the blows from tick 2 ("#2207 hit #2474"); with the same mutation the old end-only check's own assertion passed, since the Town Center had killed the Militia long before tick 990, and the case failed only later, finding no Militia to order. The reviewer's every-tick probe agrees with the repaired check: no unsolicited blow through tick 1,000 on the fixture as shipped.
- A formatting slip the review did not name: the rollover left two blank lines after the moved entry in `defect-register-past.md`; one was removed. The entry's text is unchanged.

## Verification

`tests/simulation/bootMapRaidFixture.test.ts` passes (2 tests), and so does `tests/architecture/defectRegisterRollover.test.ts`. The full gate ran again after the repair (plan 144, "M2: the landing").

## Round outcome

One medium finding on a test, repaired with its red proof. No further round: the repair tightens one assertion and changes no game code.
