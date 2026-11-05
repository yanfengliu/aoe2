# Review 4: implementation

## Target

aoe2 commit ab7f8f15 on branch `ai-economy-m2-1104` (work 141 M2a-1), reviewed as `git diff 30264cba ab7f8f15`: DE's escrow for the first Monk and Conscription, the first-claim Monk, the Town Center phase split out of `aiSystemProductionPhase.ts`, the self-play audit's new columns, the census re-recorded, and the records.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree. Its log holds no `STATUS_DLL_INIT_FAILED`; it ran both git commands it was asked for and reproduced its findings with in-memory fixtures. It read files outside the diff, among them `bridge/castleTechOptions.ts` and `aiResourceReserve.ts`.
- One lane. The runbook prefers Codex with `--sandbox read-only`; no Claude lane ran this round.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — Conscription remains escrowed after it is queued.** `aiEscrowPhase.ts:64` assumes `getResearchOptions` excludes queued research. It does not: `castleTechOptions.ts:35` checks only completed technologies. Subsequent decisions therefore reserve another 150 food/150 gold and can request research that the handler rejects as already in flight. This also consumes pending Castle capacity, obstructing its unique unit. **Fix:** exclude `inFlightTechByOwnerCodec` entries as well as pending and completed research.
2. **Major — Independent affordability checks let research consume an unpaid hold.** `aiSystemProductionPhase.ts:207` checks each technology against the same stockpile without accounting for previous research requests. Reproduced with Conscription waiting behind a full Castle queue: starting with 300 gold, Fletching and Elite Skirmisher both passed their checks and left 120 gold, below the 150 held. Military checks also omit previously requested research, and accumulate soldier costs only while a villager is due. **Fix:** maintain one running decision budget shared by research, ordinary soldiers and Castle units.
3. **Major — An underfunded hold blocks units that do not spend that resource.** `aiSystemProductionPhase.ts:290` uses `canAffordWithReserve` (`aiResourceReserve.ts:144`), which requires the entire reserve to exist even for resources absent from the purchase's cost. With 200 food, 1,000 wood and 50 gold, holding a Monk's 100 gold blocks a gold-free Spearman. **Fix:** spendable balances as `max(0, stockpile − held)` per resource.
4. **Major — The later Monk loop bypasses the first-claim budget.** `aiSystemProductionPhase.ts:381` still checks the full stockpile: with an unpaid Conscription hold and an enemy Monastery, the escrow declined the first-claim Monk, and the legacy loop bought it anyway. **Fix:** route later Monk purchases through the same budget.
5. **Major — The early Monk purchase breaks age-up priority.** The escrow runs without `ageUpReserve` or `savingForAgeUp`: with exactly 1,000 food and 800 gold and two relics, the Monk spends first and the Imperial Age fails, against spec §13.2's age-up priority. **Fix:** preserve the age-up budget and latch when buying Monks.
6. **Minor — The Market receives bare prices instead of the budget that made them unaffordable** (`aiEscrowPhase.ts:84`). **Fix:** pass cumulative budgets.
7. **Minor — Queued and pending Monks are counted at only one Monastery** (`aiEscrowPhase.ts:44`), and the same lookup can miss a completed one when another is unfinished. **Fix:** aggregate over every owned Monastery.
8. **Minor — "An enemy" is implemented as the current attack target only** (`aiEscrowPhase.ts:61`). **Fix:** check all hostile owners.
9. **Minor — The DE equivalence claim omits conditions**: the Monk escrow also needs housing headroom and no attack (`escrow.per` 3061-3065), and Conscription population thresholds and no attack (3208-3211). **Fix:** implement them or document the departures.
10. **Info — "No army freezes" exceeds what the measurements establish**: armies are sampled every 5,000 ticks. **Fix:** qualify the claim by sampling resolution.

It found the Town Center extraction behaviour-preserving, no new persistent state needed (a save/load continuation matched after 40 ticks), and the census changes matching the commit's list. Of the tests, it noted that buying the only affordable Monk first makes the handler reject the Archer even without a correct hold, and that the Conscription case's food hold alone rejects the Archer; it asked for later-decision, competing-producer, single-resource, Market and multiple-Monastery cases.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R4-1 | Conscription held again while in flight. | Accepted. | `conscriptionOffered` also asks the owner's in-flight set (`inFlightTechByOwnerCodec`); red with the in-flight test removed. |
| Codex R4-2 | Purchases after the escrow were checked one by one. | Accepted. | `DecisionBudget`: while anything is held, research, soldiers, the Castle's unit and the Monk queue are counted together against the stockpile less the holds. Outside a hold every check is as before, so M1's measured behaviour stands. Red with `ask` a no-op. |
| Codex R4-3 | A hold blocked purchases that do not spend the held resource. | Accepted: DE's `can-train` reads each resource's own escrow. | The budget checks resource by resource; the existing reserves (the age-up's, the next villager's) keep their own check unchanged. Red three ways, the Spearman fixture among them. |
| Codex R4-4 | The Monk queue after the army ignored the hold. | Accepted. | It is checked against the budget; red with the check removed (`ai-escrow-held-monk-fixture`). |
| Codex R4-5 | The escrow bought ahead of the age-up. | Accepted: DE buys its age-ups first (escrow.per 24 on). | `settleEscrow` prices its purchases on top of the age-up reserve, and the age-up latch skips the escrow, as it skips soldiers and research. Red with the reserve dropped. |
| Codex R4-6 | The Market saw bare prices. | Accepted. | An unpaid hold reaches the plan as the holds before it plus its price; red with the bare price. |
| Codex R4-7 | Monks counted at one Monastery only. | Accepted. | Every owned Monastery's queued and pending Monks count, and any complete one stands. Not tested: a fixture cannot start with a Monk queued. |
| Codex R4-8 | Only the attack target counted as the enemy. | Accepted. | Any enemy's Monastery or Monks, through the owners' teams (`isEnemyOwner`). Not tested: the fixtures are one-on-one. |
| Codex R4-9 | DE's other conditions left out unstated. | Accepted. | Housing headroom is modelled for the Monk (`populationBlocked`), red-tested. "Under attack" is not tracked by this AI and is stated as left out; Conscription's population test always passes at Hard, whose rules these are, and is stated so (`aiEscrow.ts`, spec §13.2). |
| Codex R4-10 | "No army freezes" overstated. | Accepted. | The records give the sampling: the audit's 5,000-tick samples and the lab's 2,000-tick ones. |

## Verification

- Each repair red with its defect back, one mutant at a time against `tests/simulation/aiEscrow.test.ts` (19 tests): R4-1, the in-flight test removed, 1 fails; R4-2, `ask` a no-op, 1 fails; R4-3, every resource checked against the hold, 3 fail (the Spearman fixture among them); R4-4, the later Monk queue unchecked, 1 fails (`ai-escrow-held-monk-fixture`); R4-5, the age-up reserve dropped, 1 fails; R4-6, the bare price to the Market, 1 fails; R4-9, the housing condition removed, 1 fails.
- After the repairs: typecheck and lint pass on the changed files; the 19 escrow tests, the other AI tests and the coverage lab pass, the census re-recorded from the repaired code.
- Re-measured on the repaired code (plan 141's Outcome): the 7-match table holds at 1 of 7, Castles unchanged, deaths 382 (10 under enemy defences) against 365 (5); the lab's census loses no producer, and owner 1 trains a Trade Cart again.

- Round 5 found these proofs held the helpers, not all of their wiring: the 19 tests still passed with the in-flight set ignored, production's counting off, the age-up reserve dropped at the settlement call, or the latch check removed. Its repairs add decision cases that hold each of those ([round 5](5_implementation.md)).

## Round outcome

Five major and four minor findings, all accepted and repaired, and the Info finding reworded. The repairs changed the escrow's arithmetic, so a focused round 5 reviews them.
