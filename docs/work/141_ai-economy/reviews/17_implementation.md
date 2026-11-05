# Review 17: implementation

## Target

aoe2 commit a8f23b5d on branch `ai-economy-m2a2b-1105` (work 141 M2a-2b), on main 12c87c8d, reviewed as `git diff 12c87c8d a8f23b5d`: DE's ram goal (`aiSiege.ts`), the phase that gathers its inputs (`bridge/systems/aiSiegePhase.ts`), the ram's place in the escrow's first-claim list (`aiEscrow.ts`, `bridge/systems/aiEscrowPhase.ts`, `bridge/systems/aiSystemProductionPhase.ts`), two fixtures in `fixtures/aiEscrow.ts`, `tests/simulation/aiSiege.test.ts`, and spec §13.2 and §13.3.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It read the installed Promisory scripts and cited files outside the diff: `aiSystemGating.ts:180` (spot-checked: `if (queueLength >= 2) continue;`, so a producer with one item queued is still idle) and `aiVillagerDemand.ts:34-56`. It ran 53 focused tests and `tsc --noEmit`, both passing.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run; afterwards the only changes were the worker's own record edits made during the run (`docs/changelog.md`, `docs/learning/defect-register.md`, the plans of works 106 and 141), which the report itself noticed. The lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Found **three medium issues and one low citation issue** in `12c87c8d..a8f23b5d`.

1. **Medium — the ram can be purchased twice in one decision.** `src/game/simulation/bridge/systems/aiSystemProductionPhase.ts:182` buys the priority ram, then the unchanged mix buys another. The outside-diff helper `src/game/simulation/bridge/systems/aiSystemGating.ts:180` accepts queues shorter than **two**, so incrementing pending trains does not consume the workshop completely. Reproduced by changing only the fixture's gold from 100 to 300 in memory: after five ticks its workshop contains `['battering-ram', 'battering-ram']`. Both purchases are budgeted, but the duplicate spends another 160 wood/75 gold and displaces the Mangonel. The existing 100-gold test cannot expose this. Skip the mix's ram entry after the priority purchase succeeds.

2. **Medium — queued rams are incorrectly treated as existing siege.** `src/game/simulation/bridge/systems/aiSiegePhase.ts:71` combines owned and queued rams into one input. DE uses `unit-type-count-total` for the ram goal's limits, but **`unit-type-count`** for `siegereq` (`init.per:4158–4177`) and the defence-subtraction exemption (`threats.per:1279`). Consequently, four existing rams plus two queued, population 190 and Siege Ram researched incorrectly return no priority ram; DE's rule permits another. Conversely, one merely queued ram incorrectly removes the defence penalty. Keep separate existing and total counts. The "8 never binds" explanation in `tests/simulation/aiSiege.test.ts:132` and spec §13.3 is therefore incorrect; the tests need owned-versus-queued cases.

3. **Medium — the Imperial army-tech exemption is incomplete.** `src/game/simulation/bridge/systems/aiSiegePhase.ts:35` copies only `init.per:3843–3852`. The immediately following rules, **3853–3872**, also set `armytech imperial` for Cavalier, Two-Handed Swordsman, Heavy Scorpion, Onager, Hussar, Halberdier and other upgrades. Reproduced with eight Imperial military units versus one enemy unit and a Castle: Cavalier researched returns `null`, while Bracer returns a ram. DE exempts both from the defence subtraction, giving superiority 1. Include the remaining applicable upgrades and test the adapter; supplying `imperialArmyTech: true` directly cannot detect this omission.

4. **Low — the train-order citation overstates its scope.** `src/game/simulation/aiSiege.ts:10` says the ram precedes every army line. DE trains Trebuchets at `units.per:12871` and Bombard Cannons at `12904`, before the ram. Narrow the statement to the listed later lines. Also, the workshop-under-attack filter cited at line 30 is **12913**, not 12911.

The top-level ram boolean structure, superiority buckets and listed population constants match the scripts. I found no new purchase-point bypass or deliberate difficulty handicap. Moving the villager-reserve calculation is neutral given its actual dependencies in `aiVillagerDemand.ts:34–56`.

Validation: **53 focused tests passed**, `tsc --noEmit` passed, and diff whitespace checks passed. Full verification was not run; remote CI was inaccessible. I modified no files. Concurrent documentation edits appeared during review; the reviewed code and spec still matched `a8f23b5d`.

## Findings and disposition

- **R17-1 (medium), accepted and repaired.** DE's ram rule fires once a pass (units.per 12905-12925). The escrow phase now reports a ram it asked for (`EscrowResult.ramBought`), and the army loop asks for no ram-line unit in that decision, at any Siege Workshop. Case: `ai-siege-ram-rich-fixture` (300 gold) queues `['battering-ram', 'mangonel']`; with the skip removed it queues two Battering Rams.
- **R17-2 (medium), accepted and repaired.** `RamGoalInputs` now carries `rams` (owned or queued, DE's `unit-type-count-total`) for the goal's caps and `ramsStanding` (DE's `unit-type-count`) for `siegeNeeded` and superiority's exemption. The test and spec §13.3 no longer say the 8 never binds: it binds while some rams are queued (4 standing and 2 queued at population 190 with the Siege Ram pending still wants one). Cases for both counts, and for a queued ram that does not exempt.
- **R17-3 (medium), accepted and repaired.** DE's full list (init.per 3843-3872: seventeen upgrades and the owner's elite unique unit) moved to `aiSiege.ts` as `IMPERIAL_ARMY_TECHNOLOGIES`, typed as technologies so a misspelt name fails the typecheck, and `imperialArmyTech` tests it. The phase's wiring is tested on two Imperial fixtures, Codex's reproduction: eight Men-at-Arms against a Militia and a Castle train the ram with the Cavalier researched and want none without it.
- **R17-4 (low), accepted and repaired.** The comments and spec §13.3 now place the ram after the villager, the Trebuchet (12871) and the Bombard Cannon (12904), and before the Monk (13210) and the army lines; the under-attack filter is 12913.

## Verification

Repairs on 3d64ca64 (`git diff a8f23b5d 3d64ca64`). `tests/simulation/aiSiege.test.ts` has 19 tests, all passing, and `tsc --noEmit` passes. Each repair is red with its defect put back (`tmp/m2a2b/mutate.mjs`, the file restored byte for byte): the skip removed (the 300-gold case), the siege requirement on owned-or-queued rams (two tests), superiority's exemption on them (one), the Cavalier dropped from the list (the list's test and the wiring case), and the phase passing `false` (the wiring case). The first round's eight mutations stay red. The self-play arms were re-run on the repaired code (plan 141's Outcome).

## Round outcome

Four findings, all accepted and repaired; a focused re-review of the repairs is round 18.
