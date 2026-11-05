# Review 3: implementation

## Target

aoe2 commit 87a54304 on branch `ai-economy-1104` (work 141 M1), reviewed as `git diff f92bf5c0..87a54304`: the repair of [round 2](2_implementation.md)'s findings, including the coordinator's option A for `aiGarrisonedDefender.test.ts`. The prompt (sha256 75825ae46784…) gave option A's terms and asked both lanes to read and run nothing, because a full gate was running on the machine. The raw logs stayed in fleet's ignored `tmp/review-runs/aoe2-141-m1-r3/`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0). The runbook's command check printed `keep`, with 0 failed commands. As asked, it ran nothing.
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308. Its `system/init` shows the tools Task, Bash, Glob, Grep and Read, `permissionMode` `dontAsk` and no MCP servers; `modelUsage` had one key, the pin, and the report command printed `keep`. Its calls were 44 Read, 50 Grep, 4 Glob and 1 Bash, which was refused, so it read HEAD and the commit message from files instead of git.
- The tree's `git status --porcelain` and `git diff HEAD` were empty before both lanes and after them.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths (and the DE install's to `Promisory/`), with the link syntax removed; nothing else was changed.

Reviewed `f92bf5c0..87a54304`. Two non-material record findings:

- **R3-1 — Low: the recorded gold balance disagrees with retained evidence.** The fixture header:41 (`src/game/simulation/fixtures/aiGarrisonedDefender.ts:41`), plan and review-2 verification say **6 gold**. The combined-run log:33 (`tmp/m141/garrison-combined.txt:33`) ends with `f5 w10 g69`. Correct the records to 69, or identify the newer measurement supporting 6. This does not change the demonstrated spending failure.
- **R3-2 — Low: the M2 sourcing item drops a necessary qualification.** Plan:107 (`docs/work/141_ai-economy/plan.md:107`) says gatherers.per’s percentage blocks “do not run there” throughout the interval from 12 villagers to the Feudal click. Preserve the strategy/count qualification already present at line 37: the installed gatherers.per:21 (`Promisory/gatherers.per:21`) and line 88 (`Promisory/gatherers.per:88`) permit strategy-specific percentage rules at sufficient villager/food counts without requiring pending Feudal research. M1’s cap keeps this outside its current behavior.

The code repairs withstand inspection:

- The Ram joins the ordinary attack group. Siege attack handling rejects a positionless target; it does not redirect the order to a building. Idle aggression exists, but its local search cannot reach the enemy base from the Ram’s starting position. I found no alternate resolution path bypassing the attack phase in this fixture.
- One Ram is the minimum seated count supported by the recorded zero/one/two-Ram comparisons. The retained mutation restores the correct garrisoned-target defect. The assertion, window and `-few` arm remain unchanged.
- The projection and target-index tests retain their independent comparisons and non-vacuity assertions.
- R2-1 now requires actual soldier spending. The Spearman is the fixture’s intended first purchase; its queue assertion closes the suppression gap without adding an unrelated dependency.
- C2-3’s corrected premises match the costs and fixture resources. C2-4 correctly identifies dawn.per’s incremental assignment, subject to R3-2 above.

I read files outside the diff, including attack handling, auto-aggression, conquest resolution and the installed DE scripts. No files changed; no tests, scripts, simulations, builds or browsers ran. Timing and mutation results remain recorded evidence, not independently rerun verification. HEAD and the clean worktree remained unchanged.

**Verdict: no material findings.**

### Claude (claude-opus-5-5[1m])

Kept as written; its headings are three levels lower here.

##### Review round 3 (Claude lane): `f92bf5c0..87a54304`

I changed no file and ran nothing. Bash was denied in this session, so I couldn't run even read-only git. HEAD is 87a54304, read from `.git/refs/heads/ai-economy-1104`. I read the commit message from the worktree's `COMMIT_EDITMSG` and reviewed the diff given in the prompt.

Outside the diff I read:
- **The army's orders:** the attack phase, auto-aggression, unit stances, target finding, the military-unit list and the attack validator.
- **Combat and the end of a match:** the conquest rule, building destruction, building armor and attacks, and unit stats.
- **Spending:** the unit mix, the research loop, `technologies.csv` and the planner fixture.
- **Tests and records:** the three tests that play the fixture, and `gate-proofs.md`.
- **DE's scripts:** `gatherers.per`, `dawn.per`, `init.per` and `interaction.per`.

###### 1. The fixture against option A's terms: holds

- **It still asks whether owner 1 attacks.** The Ram counts as AI military (`aiDecisionOps.ts:111`), so it joins the attack group (`aiSystemAttackPhase.ts:77-84`) and gets the same orders as the Men-at-Arms. Only two systems order AI military: the attack phase (`aiSystemAttackPhase.ts:141-182`) and auto-aggression (`autoAggressionSystem.ts:169,185`). The defense and hunt phases move villagers only (`aiSystemDefensePhase.ts:58,77`, `aiSystemHuntPhase.ts:151`).
- **The Ram can't raze anything on its own.** It starts on Aggressive (`unitStance.ts:28-36`), so an idle Ram does attack buildings by itself (`unitStance.ts:78-80`). But it only looks as far as its own sight, 4 in this fixture (`autoAggressionSystem.ts:154-159`), measured to a building's anchor (`targetFindingOps.ts:461-464`). From (14,14), the nearest owner-2 anchor, the House at (26,18), is 16 cells away.
- **With the defect back, nothing marches.** The villager branch (`aiSystemAttackPhase.ts:138-143`) catches every unit and skips the building and Town Center branches. That matches the measured 25 of 25 idle.
- **Nothing else can raze the Town Center.** Owner 2 is inert (`aiGarrisonedDefender.ts:83`, `autoAggressionSystem.ts:128-130`). Its garrisoned villagers keep it alive (`conquestOutcomeSystem.ts:54-60`) and die with the Town Center (`entityDestroyOps.ts:253-255`). After that, the House and Barracks fall to the visible-building branch (`aiSystemAttackPhase.ts:151-155`) or to the army's own sight at the base. Both happen only after the order.
- **One Ram is the least that is enough.** Zero fails on the combined tree, and one resolves before any purchase. The header's numbers check out:
  - A Castle Age Town Center is 5/7, with 0 in both its classes (`buildingArmor.ts:78,84`).
  - A Man-at-Arms does 6 melee plus 2 against Standard Buildings (`statTables.ts:163`, `buildingAttack.ts:51`), so 3 a hit.
  - A Crossbowman does 5 pierce (`statTables.ts:135`), so 1 a hit.
  - A Ram does 150 a hit (`buildingAttack.ts:77`).
  - Siege is last in the Castle unit mix (`ai.ts:125-136`).
- **The `-few` arm is unchanged** (`aiGarrisonedDefender.ts:57`).
- **The two other tests still assert what they say.** Both compare two modes, or two candidate lists, of the same world (`renderProjectionOnRead.test.ts:63-77`, `targetScanIndex.test.ts:101-110`). The Ram changes the fight they sample, not what they check. See Info below.

###### 2. R2-1: closes the gap and adds no incidental dependency

- The Spearman is the fixture's own premise (`aiSoldierBudget.ts:9`). The Feudal mix asks the Barracks before the Stable, and the fixture has no Archery Range (`ai.ts:119-124`).
- Exactly one Spearman follows from the budget: 45 food is left after the first decision.
- A Spearman trains for 220 ticks (`prototypeEconomyRules.ts:127`), so it is still queued at tick 62. The villager assertion already relies on the same timing (250 ticks).
- The `soldiersAsked` mutant still queues one Spearman, so it still goes red, on the Town Center line.

###### 3. C2-3 and C2-4

- **C2-3 is accurate.** Every technology at those four buildings costs more than 90 food or more than 30 wood (`technologies.csv:11-24, 59-62, 80-84`; Elite Skirmisher costs 230 wood, `:14`). The research loop never looks at the Market or the Town Center (`aiSystemProductionPhase.ts:52-59`), so Loom's 50 gold (`technologies.csv:93`) is not a gap. `plannerAndMonk.ts:15` matches the new `aiHousedAtLimit.test.ts` header.
- **C2-4:** see C3-1.

###### Findings

**C3-1 (Low; records): C2-4's repaired sentence reaches the right conclusion for Standard, for a wrong reason.**
- `spec-final.md:1829`, `aiEconomyPlan.ts:54-57` and `plan.md:37` say gatherers.per "jumps over its percentage blocks under the usual strategy", citing 11-20 and 79-87. Those two rules guard only the s-flush and r-flush blocks.
- gatherers.per's own usual-strategy block is not jumped over from 16 civilians on. Line 572-578 skips it only below 16 civilians, and 579-588 only for the other strategies.
- Under the usual strategy, its Dark Age rules (589-662) set no split before the Feudal click only because each one needs `sn-current-age > dark` and the Feudal research pending.
- `plan.md:107` goes further: "gatherers.per's percentage blocks do not run there". That is wrong for s-flush and r-flush from 16 civilians on:
  - 21-29 sets 55 food / 45 wood in the Dark Age at 19 villagers, once the Feudal food is banked.
  - 88-97 sets 33 food / 58 wood / 9 gold at 20 villagers, on the same condition.
  - DE's Hard keeps those strategies (`plan.md:44`), and M2 models Hard (`plan.md:60`).
- Two more facts for M2:
  - dawn.per writes the split at 402-409 and loops back at 436-441. The loop is 80-441; lines 80-385 are only the step that picks each villager's resource.
  - Whether dawn.per's split overrides gatherers.per's in the same pass depends on the order the files load in. I couldn't find that in the install.
- Suggested wording: "Under the usual strategy no gatherers.per rule sets a split before the Feudal click: 11-20 and 79-87 skip the s-flush and r-flush blocks, and the usual block's Dark Age rules (589-662) wait for the Feudal research."

**C3-2 (Low; records): the devlog and the plan's status stop at round 1.**
- The devlog's "Reviewer findings" (`docs/devlog/detailed/2026-11-04_2026-11-04.md:62-64`) lists rounds 0 and 1 only. Round 2's findings and repairs (Codex R2-1, Claude C2-1 to C2-5) are missing, though `AGENTS.md:78` asks for reviewer findings by provider.
- `plan.md:116` still reads "Review rounds 0 and 1 repaired".
- `plan.md:118` still lists review round 2 as pending.
- `plan.md:96` names only the red proofs of rounds 0 and 1. R2-1's red proof (Barracks empty with Feudal soldiers suppressed) is not there.

**C3-3 (Low; records): `gate-proofs.md`, the standing record for this gate, still describes the army without the Ram.**
- `docs/learning/gate-proofs.md:251` gives "23 of 23 attackers idle".
- `:255` gives "the full arm resolves by about tick 4,000".
- The re-taken proof (25 of 25 idle, and a resolution at tick 1,197 with the Ram) is only in the commit, the fixture header, the plan and review 2. Option A's terms did not ask for this file, so this stays Low.

**Nit.** Each of the two repaired comments leaves one long line in a block wrapped at about 80 characters: `aiSoldierBudget.ts:48` and `aiHousedAtLimit.test.ts:16`. `eslint.config.js` has no `max-len` rule, so the gate is unaffected.

**Info.**
- Two test headers carry claims measured on the army without the Ram, and no record says they were re-checked:
  - `renderProjectionOnRead.test.ts:19-21` describes a mutant that makes the worlds "differ at tick 1,000 and agree again by tick 4,500". `gate-proofs.md:475` already calls that description historical.
  - `targetScanIndex.test.ts:97` labels the tick-1,500 state "armies on the move". With the Ram, and no garrison in that test, the match may be over before tick 1,500. I can't confirm that without running it.
- The Feudal budget case stays sensitive only while the Scout is in the Feudal mix. Round 2 already noted this.

**Verdict: no material findings.** C3-1 to C3-3 are Low, plus one nit.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R3-1 | The records give the combined run's purse as 6 gold; its log ends at 69. | Accepted. The "6" was a display cut at 260 characters, and it also reached the coordinator in the worker's message. | 69 in the fixture's header, the plan and review 2's verification; the handoff corrects the message. |
| Codex R3-2, Claude C3-1 | The sentence on the split from 12 villagers gives the wrong reason (11-20 and 79-87 guard only the flush blocks), and the M2 item drops the flush strategies' own rules. | Accepted, read in the install: gatherers.per 21-29 (s-flush, 55/45 from 19 villagers) and 88-97 (r-flush, 33/58/9 from 20), 572-588 (the usual block's jumps) and 589 on (its Dark Age rules wait for the Feudal research); dawn.per writes its split at 402-409. | The spec, `aiEconomyPlan.ts` and the plan say so; the M2 item adds Hard's flush strategies and the open load-order question. |
| Claude C3-2 | The devlog and the plan's status stop at round 1. | Accepted. | The devlog lists rounds 2 and 3; the plan's red proofs and steps run to round 3. |
| Claude C3-3 | `gate-proofs.md` still describes the army without the Ram. | Accepted. | Its entry gains the re-taken proof (25 of 25 idle) and the resolution at tick 1,197. |
| Claude nit | Two re-written comments each keep one long line. | Accepted. | Re-wrapped. |
| Claude Info | `targetScanIndex.test.ts` labels its tick-1,500 state "armies on the move", and `renderProjectionOnRead.test.ts` describes a mutant measured on the old army. | Checked. At tick 1,500 of the ungarrisoned fixture the match is still running, with 9 Men-at-Arms and the Ram attacking, so the label holds. `gate-proofs.md` already marks the mutant's description historical. | No change. |

## Verification

- The full gate on 87a54304 (`PREVIEW_PORT=4322 npm run verify`, under the gate lock) passed: vitest 5,201 passed and 3 skipped, Playwright 273 passed and 2 skipped. `node scripts/verify-receipt.mjs check` accepted the receipt on tree b0e5bcbf758b.
- After this round's repairs: the affected tests, typecheck and lint pass.
- The full gate on 7ca58fbb, these repairs rebased onto main ec250733 (`PREVIEW_PORT=4322 npm run verify`, under the gate lock), passed: vitest 5,201 passed and 3 skipped, Playwright 273 passed and 2 skipped. `node scripts/verify-receipt.mjs check` accepted the receipt on tree 7504474d4d49.

## Round outcome

Neither lane found anything material. Every low finding and the nit are repaired, and the Info item was checked. No further round: this round's repairs are wording, one recorded number and the proof record, each checked against its source.
