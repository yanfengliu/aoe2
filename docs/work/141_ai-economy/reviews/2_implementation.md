# Review 2: implementation

## Target

aoe2 commit f92bf5c0 on branch `ai-economy-1104` (work 141 M1), reviewed as `git diff cc2d80fb..f92bf5c0`: the repair of [round 1](1_implementation.md)'s findings, after the branch was rebased onto main e9369088 (work 140, v0.3.259), and the coverage lab's census re-recorded on top of work 140's. The prompt (sha256 706feda3ead3…) gave round 1's dispositions and the coordinator's decisions, and asked for the rebase's conflict resolutions in cb1ce0c6 to be checked too. Because a full gate was running on the machine, it asked both lanes to read and run nothing. The raw logs stayed in fleet's ignored `tmp/review-runs/aoe2-141-m1-r2/`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0). The runbook's command check printed `keep`, with 0 failed commands. As asked, it ran nothing.
- Claude `claude-opus-5-5[1m]`, `--effort max`, Claude Code 2.1.308. Its `system/init` shows the tools Task, Bash, Glob, Grep and Read, `permissionMode` `dontAsk` and no MCP servers; `modelUsage` had one key, the pin, and the report command printed `keep`. Its calls were 33 Read, 31 Grep, 22 Bash and 3 Glob. As asked, it ran nothing.
- The tree's `git status --porcelain` and `git diff HEAD` were empty before both lanes. While the Claude lane read, the worker made four edits in the tree (the coordinator's option A in `aiGarrisonedDefender.ts`, R2-1 in `aiSoldierBudget.test.ts`, the plan and the devlog), which that lane noticed and set aside: its findings are about f92bf5c0 as committed. After both lanes, the status showed those four files and nothing else.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths, with the link syntax removed; nothing else was changed.

Reviewed `cc2d80fb..f92bf5c0`. One non-material finding:

- **R2-1 — Low: the Feudal budget test can pass without exercising soldier spending.** At `tests/simulation/aiSoldierBudget.test.ts:71`, the assertions require a queued Villager and an empty Stable, but never require the Spearman. Suppressing Feudal military production satisfies both. Assert that the Barracks queued the Spearman too. The recorded `soldiersAsked` mutation does detect the original defect; this is a remaining vacuity gap.

The other repairs are consistent with their findings:

- The Market compares the combined budget against the **unspent** purse; subsequent handler charging does not double-count the Villager.
- The hard-limit test distinguishes both named wiring reversions. The retained mutation scripts restore the behaviors their records describe.
- The plan removes the rejected split and carries the agreed M2 deferrals.
- Work 140’s conflict-resolved records and armor changes survive the rebase. The census moves match the commit message, including four lost producers against the pre-141 baseline. Retained final metrics reproduce the plan’s M1 figures.

Outside the diff, I read the Market planner, charging handlers, producer gating, planner fixture, and DE’s cited House rules. No files changed; no tests, scripts, simulations, builds, or browsers ran. The ongoing verification result is outside this review.

**Verdict: no material findings.**

### Claude (claude-opus-5-5[1m])

Kept as written; its headings are three levels lower here.

##### Review round 2 (Claude lane): `cc2d80fb..f92bf5c0`

The round-1 repairs are correct, and I found no code defect in the diff. But f92bf5c0 as committed has a red gate, which another participant already knows about and is repairing.

I changed no file and ran no test, script or build: only Read, Grep, Glob and read-only git. Outside the diff I read `aiMarketPlanning.ts`, `aiVillagerDemand.ts`, `aiResourceReserve.ts`, `aiSystemGating.ts`, `aiSystem.ts`, `aiTradePhase.ts`, `createSimulationBridge.ts`, `plannerAndMonk.ts`, `technologies.csv`, `aiGarrisonedDefender.test.ts`, DE's `buildings.per`, `dawn.per` and `gatherers.per`, and the bundle reports in the primary checkout's `tmp/work141-m1/`.

**The tree changed while I reviewed.** `git status` was clean when I started. It now shows four uncommitted edits I did not make: `aiGarrisonedDefender.ts`, `aiSoldierBudget.test.ts`, `plan.md` and the detailed devlog. If the verify was still running when they were made, its receipt cannot certify f92bf5c0, because a receipt needs the checkout to match one commit's tree at both ends. Everything below is about f92bf5c0 as committed.

###### Findings

**C2-1 (material for f92bf5c0; already decided, repair not yet committed).** `aiGarrisonedDefender.test.ts:111-118` fails on the combined tree (work 141 rebased onto work 140). I didn't run it. The evidence is the other participant's own uncommitted records ("One existing gate went red only on the combined tree"):
- No Mangonel is bought, and the Ram dies at about tick 4,250.
- The purse ends at 5 food, 10 wood and 6 gold, and the Crossbowmen take 1 a hit off the Town Center.
- Nothing resolves within the 8,000-tick window.

So `plan.md:117` ("the gates that read hits on buildings were re-run") missed a red gate, and f92bf5c0 can't land as it is. The coordinator's option A (start the fixture's army with one Battering Ram) is in the working tree. I read it but did not review it. It keeps the assertion and the window, and its comment says it still fails with 800ee967's defect put back. Two other tests use the same fixture and will now play the extra Ram: `renderProjectionOnRead.test.ts:47` and `targetScanIndex.test.ts:86`.

**C2-2 (low; the uncommitted edit calls it R2-1 and fixes it).** The Feudal case can pass with no soldier trained at all. It asserts only that a villager is queued and the Stable is empty (`aiSoldierBudget.test.ts:71-72`). The uncommitted assertion that the Barracks queue is `['spearman']` closes that. The Market case already checks both the Spearman and the `buy-wood` directly, so it can't pass that way.

**C2-3 (low; header wording).**
- `aiSoldierBudget.ts:47-48` says "90 food is under every technology those buildings offer". The Elite Skirmisher upgrade costs 230 wood and 130 gold and no food (`technologies.csv:14`). It is still out of reach on 30 wood, and the case's no-research assertion holds the premise, so only the stated reason is wrong.
- `aiHousedAtLimit.test.ts:14-15` says "2,000 of each resource". The fixture holds 2,000 food and wood but 1,500 gold and 500 stone (`plannerAndMonk.ts:15`). The Dark Age build order costs only wood, so the conclusion holds.

**C2-4 (low; records).** The spec and the plan now name different DE sources for the split from 12 villagers to the Feudal click:
- `spec-final.md:1829` and `aiEconomyPlan.ts:54-56` say "gatherers.per's villager-count table".
- `plan.md:37` and `:107` say dawn.per's per-villager counts (80-385) and gatherers.per's table.

The DE scripts support dawn.per. Below 16 civilians, gatherers.per skips its percentage blocks whatever the strategy (rules at 11-20 and 79-87). dawn.per assigns villagers one at a time from line 80 on. The spec and the code comment should say what the plan says.

**C2-5 (low; process).** The two rebased commits under f92bf5c0 fail gates. cb1ce0c6 and cc2d80fb carry M1's code over work 140's census unchanged (`git diff --stat e9369088..cc2d80fb` on the census file is empty), and the C2-1 case fails at both too. Work 140's commits sit on main one by one. Landing 141 the same way would put two red commits on main, so squash it or note it in the landing record.

**Info.**
- `aiSystemProductionPhase.ts` is at 499 lines against the 500-line limit (`fileSizeBudget.test.ts:22`). M2 must split it before adding anything.
- Outside this diff: `canAffordWithReserve` (`aiResourceReserve.ts:144-155`) demands the villager's 50 food from every soldier, including an Archer or a ram that costs no food. While a villager is due and food is under 50, every soldier is refused. DE's rule order gives the villager its food first, but would still buy an Archer from wood and gold. This is worth an M2 spending lead.

###### The round-1 repairs against their findings
- **Codex R1.** `:294` pushes the soldier's cost plus the villager due plus the soldiers asked before it. That is the check at `:290` minus the age-up reserve, which the Market adds back itself (`aiMarketPlanning.ts:221-222`) and which is empty in the Imperial Age. Correct.
- **R1-1.** `aiHousedAtLimit.test.ts` checks both that nothing is a House and that something was placed. Its two red proofs revert the two halves of the F1 repair. The rename reaches every caller; the building phase (`:233`, `:241`) is the only production one.
- **R1-2, Feudal case.** Tracing it by hand, it tells the two versions apart:
  - Repaired: the Spearman fits (35 + 50 ≤ 130), the Scout is refused (80 + 50 + 35 = 165), and the villager is charged.
  - With `soldiersAsked` removed: the Spearman and Scout both pass and leave 15 food, so the villager is refused.
  - It relies on the Feudal mix putting the Barracks before the Stable (`ai.ts:119-124`).
- **R1-2, Market case.**
  - Repaired: the Archer's want comes to 85 food, 50 wood and 45 gold, 20 wood short. It is the want closest to affordable, so the Market buys wood.
  - At the bare price: the Archer's want is 0 short, so it is still the one aimed at, and no trade follows.
  - The two siege wants are 155 wood short and never win. Each mutation reverts the repair it claims to.
- **Codex R2 and R1-3.** Fixed at `plan.md:37` and `:107`; the spec side is C2-4.
- **Low findings.** All repaired and accurate: the comments (`aiSystemBuildingPhase.ts:158`, `aiSystemProductionPhase.ts:252-256` and `:427`), the not-modelled list (`aiHousing.ts:27-35`), spec §13.2 (`:1831`), the changelog (`:12`), the register (`:29`) and the finding IDs. The corrected citations match buildings.per line for line:
  - 1584-1596 (the Dark Age rule)
  - 1598-1609 (the Dock and drush rule)
  - 1623-1634 (the usual Feudal rule)
  - 1636-1645 (the jump, with `up-jump-rule 7` at 1645)
  - 1646-1659 (the Feudal-war rule)

###### Can the Market change trade where it should not?
I found no such case.
- **It is dormant in practice.** The Market aims at the plan first (`aiMarketPlanning.ts:185-187`), and the plan is never empty in any measured match.
- **When it does run, the want is real spending.** Everything in it is charged before the trade's handler runs: the soldiers, then the villager (`:425`), then the trade (`:461`). The Market reads the purse before those charges. So a want shows a shortfall only when the purse can't pay this decision's own spending. If the purse covers the villager, the earlier soldiers and this soldier, there is no shortfall and no trade.
- **A villager that won't be bought appears only below 50 food.** The demand ignores price (`aiVillagerDemand.ts:56`), but the push checks it (`:423`). Otherwise they agree in the Imperial Age, with no age-up or Town Center research pushed between them. Any food the Market buys then goes to that villager on the next decision.
- **Sales are safer, not looser.** The larger want shrinks what a sale may take (`aiMarketPlanning.ts:252`), so the Market can't sell food the villager and earlier soldiers need.
- **One oddity.** A food-free soldier refused for the villager's food (the Info item) carries that 50 food in its want. The Market then works toward food for it, selling then buying when gold is under its line (`:243-258`). The food still goes to the villager, so this is harmless.

###### The rebase
Nine files were changed by both works. Nothing of work 140's was lost:
- **Changelog, register, devlog:** work 141 only adds text. The 0.3.259 section, work 140's register and devlog entries, and the summary's v0.3.228 row (moved verbatim) are intact.
- **Plan 106:** only the "AI prices" line changed. Work 140's "AI defence" line, with the tick-9,827 raid, is intact.
- **Spec:** the only removals are two §13.2 paragraphs that M1 rewrote and work 140 never touched.
- **`scenarioRegistry.ts`** only gains lines, and **`siegeWorkshop.test.ts`** only gets the House-by-id check, on work 140's version.
- **Census:** every move the commit message lists matches the diff against work 140's recording. Against variant A (49c0b997), the only producer move is owner 1's Castle research. Against 6b5e9871 (the same file as a37deeee), exactly the four producers M2's first criterion names are lost.

###### Records
- **The plan's villager table holds.** The final bundle reports match `idle-m1` and `allai-m1` row for row, gold included.
- **The Castle probe's premise holds.** Every Castle technology the Britons can research is Imperial, and Conscription (150 food, 150 gold) is the cheapest (`technologies.csv:40-44, 129, 138`).
- **The siege item is accurate.** M2's siege item matches work 140's measurement (`defect-register.md:450`).
- **No register rollover is due.** The rollover test reads work 141's register heading as OPEN.

I ran nothing, so the red proofs and C2-1's measurement come from the records.

**Verdict: material finding C2-1.** The `aiGarrisonedDefender.test.ts` case fails at f92bf5c0. The coordinator has chosen the repair, but it is not yet committed or gated. C2-2 to C2-5 are low.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Claude C2-1 | `aiGarrisonedDefender.test.ts` fails at f92bf5c0, on the combined tree only. | Accepted; the gate run had found it, and the coordinator chose option A. | The fixture's ten-strong arm seats one Battering Ram; the assertion, the window and the `-few` arm are unchanged (verification below). `renderProjectionOnRead.test.ts` and `targetScanIndex.test.ts`, which play the same fixture, pass with the Ram. |
| Codex R2-1, Claude C2-2 | The Feudal budget case can pass with no soldier trained. | Accepted. | It also requires the Barracks to have queued exactly the Spearman. With Feudal soldiers suppressed it goes red: Barracks empty, two villagers queued, 30 food. |
| Claude C2-3 | Two headers state a premise wrongly: "90 food is under every technology" (the Elite Skirmisher upgrade costs 230 wood and 130 gold) and "2,000 of each resource" (the planner fixture holds 1,500 gold and 500 stone). | Accepted; the conclusions held. | Both headers corrected. |
| Claude C2-4 | The spec and `aiEconomyPlan.ts` name gatherers.per for the split from 12 villagers, the plan names dawn.per. | Accepted, checked against the install: gatherers.per jumps over its percentage blocks under the usual strategy, and under the others below 16 civilians (11-20, 79-87); dawn.per assigns villagers one at a time from line 80. | The spec, the code comment and the plan all say dawn.per 80-385. |
| Claude C2-5 | The two rebased commits under f92bf5c0 fail the gate as committed (the garrison case), so landing them one by one puts red commits on main. | Goes to the coordinator, whose landing it is. | Named in the handoff: squash the branch at landing, or land as it is and say so in the landing record. |
| Claude Info | `canAffordWithReserve` holds the villager's 50 food back from a soldier that costs no food; `aiSystemProductionPhase.ts` is at 499 of 500 lines. | M2 leads. | On the plan's M2 list. |

## Verification

- The full gate on f92bf5c0 (`PREVIEW_PORT=4322 npm run verify`, under the gate lock) failed in its unit stage: vitest 5,200 passed, 1 failed, 3 skipped. The chain stopped there, so the browser suite, lint and build did not run, and no receipt was written. The failure was `aiGarrisonedDefender.test.ts`, red only on the combined tree: it passed on main e9369088 alone (resolved at tick 4,915) and on M1 before the rebase. Its ten Men-at-Arms die to the garrisoned Town Center by tick 500, and under DE's building armor razing then hung on what owner 1's finite purse bought. The combined tree bought no Mangonel, its Ram died at about tick 4,250, its purse ended at 5 food, 10 wood and 69 gold (review 3, R3-1: the "6" first recorded was a cut-off display), and its two Crossbowmen take 1 a hit off a Castle Age Town Center. The "3 of 5 attackers idle" in the message were Monks.
- The coordinator chose option A: the fixture's ten-strong arm seats one Battering Ram, with the assertion, the window and the `-few` arm unchanged. The case then resolves at tick 1,197, before owner 1 buys any soldier (two Rams: 780). With 800ee967's defect put back (the attack order aimed at a garrisoned villager), both cases go red, the whole army, the Ram included, idle to tick 8,000: no siege-specific path razes the Town Center without the order.
- The full gate on these repairs is recorded in review 3's verification.

## Round outcome

Material finding C2-1 is repaired by the coordinator's option A, with its red proof. R2-1 (C2-2), C2-3 and C2-4 are repaired, C2-5 goes to the coordinator with the landing, and the Info leads are on the M2 list. Review 3 covers the round-2 repair diff.
