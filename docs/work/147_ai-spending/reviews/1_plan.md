# Review 1: plan (the repaired M1 study)

## Target

aoe2 commit b4d42cf9 on branch `ai-spending-1106` (work 147 M1), the repairs of round 0 reviewed as `git diff 92d26c67 b4d42cf9` with the whole of plan 147, the repaired spend probe (`tmp/probes/spendTrace3.mts`), its summaries and its records. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree's ignored `tmp/m1/review/r1/`, the worktree as `--cd`. The prompt asked whether each of round 0's findings was repaired, whether the repaired probe counts recycled ids and its tables follow from the records, whether the proposal states DE's conditions as the scripts do, and what the repairs broke.
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra)

Reviewed **b4d42cf9** read-only. **Corrections remain.** No files changed; no builds, tests, npm, or game runs.

Here **P** means [docs/work/147_ai-spending/plan.md](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md); DE abbreviations follow its line 24.

1. **R1-1 — Medium — [sharesTable.mts:55](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/tmp/probes/sharesTable.mts:55), P:139–142. The “most wood sampled in a wait” excludes its starting sample.**  
   The filter uses `tick > t0`, although `t0` is the first sampled Castle Age state and the building is still awaited. In `tmp/m1/spend3-lab/coastal%232.json:1`, owner 1 starts its Monastery wait at tick 11,250 with **336 wood**; excluding that sample reports a maximum of **101**. Including the starting samples changes castle/Monastery to **156 [33–249]**, lab/workshop to **165 [107–209]**, and lab/Monastery to **145 [83–336]**. This suppresses evidence that affordability alone does not explain some waits. **The 83/93 count is unaffected.**

2. **R1-2 — Medium — [P:190](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md:190), also P:186. R0-5’s causal overstatement survives the repair.**  
   Lines 178–179 correctly identify hypotheses, but line 190 concludes “Its causes hold,” says the army takes the waiting building’s wood, and attributes low income to walking. Neither expenditure during a wait nor sampled walking establishes those causes. Line 186 additionally claims reason-gated training is the **only** DE rule leaving Monastery wood, without establishing exclusivity. Keep these as hypotheses throughout, including plan 106’s “running out unpaid” summaries at lines 134 and 171; the probe observes disappearance after low food, not failed payment. Checked `spendTrace3.mts:80–93`, `sharesTable.mts:46–56`, and P:176–192.

3. **R1-3 — Medium — [P:185](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md:185), reviews/0_plan.md:73. The escrow withdrawal has an incomplete rationale.**  
   DE does not require 50 or 60 adjusted civilians in every variant. **E:2531–2544** also allows `custom-civ-pop >= up-max-civ`, **or total population >= up-max-civ with `milunits no`**. Moreover, adjusted civilian population includes additions in **I:810–817,1220–1230**. A 40-villager cap alone therefore does not prove every DE branch unreachable. Withdrawing the proposal is safe; correct the source description and qualify the unreachability claim. Checked all three E:2531–2573 variants and `aiEconomyPlan.ts:135–147`.

4. **R1-4 — Low — [P:41](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md:41). R0-6’s trigger description remains inaccurate.**  
   The Feudal peace rule permits **up to three enemy units in town**, not “no enemy”: **U:11945–11946**. The cited boom block also has an **80-adjusted-civilian alternative**, subject to its own conditions, at **T:1249–1259**. These distinctions matter if this study becomes the implementation reference. The corrected rejection of a universal training shutdown is otherwise sound.

5. **R1-5 — Low — [P:10](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md:10). R0-7’s old production description remains in the opening.**  
   It still says “every idle producer”; plan 106:170 repeats it. P:44 now correctly describes one producer per mix entry, separate Castle production, Imperial research first, and the unheld ram. Make the opening consistent. Checked `aiSystemProductionPhase.ts:246–360` and `aiEscrow.ts:78–87`.

Round-0 disposition and remaining citations checked:

| Finding | Round-1 result |
|---|---|
| R0-1 | **Identity repair correct.** `spendTrace3.mts:54–56,71–77,105–110` distinguishes recycled lifetimes. Engine `entity-manager.ts:28–44` increments generation; `world-entities.ts:72–75` returns it. New summary issue: R1-1. |
| R0-2 | **Repaired.** P:42,184 preserves the safe-route prerequisite and camp bounds; checked spec:1897 and B:2173–2189,2232–2244. |
| R0-3 | **Named repairs correct.** Checked U:9145–9219,9336–9386,9434–9476 and CC:6126–6131. Farm predicates, age direction and fixed thresholds match. DE’s separate 235-wood skirmisher workshop buffer is omitted, but the current Castle mix has no skirmisher (`ai.ts:125–136`). |
| R0-4 | Proposal withdrawn; rationale incomplete: R1-3. |
| R0-5 | Partially repaired: R1-2. |
| R0-6 | Partially repaired: R1-4. Also checked I:8432–8446. |
| R0-7 | Detailed paragraph repaired; opening remains: R1-5. |
| R0-8 | **Repaired; no finding.** Checked B:5454–5510,5602–5614,4772–4782 and U:11205–11216. |

Both read-only summary scripts reproduce the printed tables. Raw spot-checks confirm castle/prototype owner 2’s **13 built, 17 reseeded, 5 expired** farms and lab/prototype owner 1’s **58, 11, 51**. The wait arithmetic is **23+28+15+17 = 83**, over **26+35+15+17 = 93**.

Under spec §13.1, no deliberate handicap is proposed for adoption. Camp expansion and potentially more passive training appropriately remain deferred. P1’s strength effect remains unmeasured; P:181’s assurance that none weakens the computer should be treated as an acceptance requirement, not an established result.
## Findings and disposition

- R0-1, R0-2, R0-3 and R0-8: confirmed repaired by the reviewer (the probe's generation-aware identity checked against the engine's entity manager; the tables reproduced from the records; 83 of 93 recomputed).
- R1-1 (medium), accepted and repaired. A wait's most-wood sample now includes the sample the wait starts on (`sharesTable.mts`); the castle Monastery, lab Siege Workshop and lab Monastery figures moved to 156 [33-249], 165 [107-209] and 145 [83-336], as the reviewer computed, and plan 147 now says a few seats held the price during their wait, so the price alone does not explain every wait.
- R1-2 (medium), accepted. The corrections to the brief and the Monastery sentence are stated as measurements beside hypotheses, and the expired farms in plan 106's lines are farms that left play with their food run out, not farms seen failing a payment.
- R1-3 (medium), accepted. The escrow's branches are named whole (50 or 60 adjusted civilians, the civilian maximum, the population cap while booming), and its withdrawal says the measured seats would seldom meet them, not that none can.
- R1-4 (low), accepted. The Feudal peace allows at most 3 enemy units in town and no enemy building, and the boom block's 80-civilian alternative is cited.
- R1-5 (low), accepted for plan 147's opening, which now describes one producer per mix entry. Plan 106's line 170 is the original card's text by work 141 and is left as written; plan 147 carries the exact description.
- The reviewer's closing note (that "none makes the computer weaker" is an acceptance requirement for M2, not a result) is kept: M2 drops any rule that loses a building, an Age or a seat's economy.

## Verification

- The lane read the scripts, the code and the records: its sandbox check printed `keep`, and the worktree's status and diff were the same before and after the run.
- R1-1's repair reproduces the reviewer's three figures exactly. The other repairs are wording, checked against the cited lines by the author; no further round was run for them, as the runbook allows for minor findings.
- `npx vitest run tests/architecture` on the repaired docs (plan 147).

## Round outcome

Five findings, all accepted and repaired; round 0's high findings confirmed repaired. No further round.
