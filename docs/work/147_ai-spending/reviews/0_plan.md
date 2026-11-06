# Review 0: plan (the M1 study and proposal)

## Target

aoe2 commit 92d26c67 on branch `ai-spending-1106` (work 147 M1), reviewed as `git diff 17e4068b 92d26c67`: the M1 commit c73bce15 (plan 147's study and proposal, spec §13.1's two added handicaps, dated lines on plan 106's four cards) merged with main 17e4068b. Docs only.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the worktree's ignored `tmp/m1/review/r0/`, with the worktree as `--cd`. The prompt asked for at least twelve of the plan's DE citations checked against the installed scripts, the handicap classification, the plan's description of this AI against the code, whether the conclusions follow from the tables, and each proposed rule's source and expected effect.
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra)

Reviewed `92d26c67` read-only; no tests, builds, npm or game runs. **The study needs corrections before its proposal is approved.**

Below, **P** means [docs/work/147_ai-spending/plan.md](C:/Users/38909/Documents/github/aoe2-worktrees/ai-spending-1106/docs/work/147_ai-spending/plan.md). DE abbreviations follow the plan.

1. **R0-1 — High — P:46,119–125,146–165: the spending probe misses purchases when entity IDs are reused.**  
   `tmp/probes/spendTrace2.mts:51–55,70–76,104–110` permanently remembers raw unit/building IDs, then skips anything subsequently bearing them. The engine recycles IDs; this exact trap is documented in `tests/simulation/contentPipelineTraining.test.ts:153–157`. New lifetimes need generation-aware identities. Consequently, army/building spending is undercounted; reconstructed income (`tmp/probes/spendReport.mts:82–83`) inherits that error. The farm-versus-army shares and “9 of 16” spending classification need remeasurement. Determinism does not make this accounting exact.

2. **R0-2 — High — P:170: P1 omits an explicit prerequisite for retrying this rule.**  
   `design/spec-final.md:1897` requires a **safe gather route**, after a bounded Lumber Camp trial sent villagers through enemy fire. P1 requires reachability only and omits that prerequisite. It also drops DE’s `buildlumber` gate and camp-distance restriction (`B:2174,2181`; initialization at `I:141`). Increased walking supports investigating camps, but does not establish that unrestricted expansion helps. Carry the prerequisite and placement bounds into P1 before scheduling implementation.

3. **R0-3 — Medium — P:38,171: P2 is substantially stricter than its DE source.**  
   DE’s farm buffer requires additional military, age, farmer-count or idle-farm conditions (`U:9208–9219,9375–9386`). P2 suppresses every wood-costing soldier whenever farms are below target, including situations where DE would keep training. The age comparison is also reversed in item 7: `own age <= enemyState` means **not ahead**, rather than “not out-aged.” DE’s camp buffer starts beyond **4** tiles, whereas linking it to P1 substitutes **5**. Finally, `U:9150–9157` skips two goal-setting rules at fixed wood thresholds; it does not reserve a workshop’s price on top of every siege unit’s cost. These differences can recreate the army starvation the study seeks to avoid.

4. **R0-4 — Medium — P:172: P3 changes civilian thresholds into population/boom triggers.**  
   `E:2531–2573` tests `custom-civ-pop`, sourced from civilian population with adjustments (`I:810–817,1220–1230`), not simply total population. Its second variant requires at least 60 adjusted civilians plus specific farmer/strategy or Town Center conditions; “booming” alone is insufficient. The third requires 50 adjusted civilians. This AI’s normal Castle Age villager cap is 40 (`src/game/simulation/aiEconomyPlan.ts:144–145`). The proposal therefore needs an explicit mapping and a count of eligible measured states before claiming an earlier Imperial click.

5. **R0-5 — Medium — P:146–166: sampled associations are promoted to established causes.**  
   A median of sampled maximum wood holdings does not prove the seat “never holds the price,” and expenditure during a wait does not prove the building would otherwise have been placed. Sampling can miss intervening balances; other purchases, builder availability and placement remain alternatives. Likewise, the probe labels a disappearing farm “expired unpaid” solely from its previous food being ≤10 (`tmp/probes/spendTrace2.mts:88–92`), without observing the failed reseed or destruction cause. Separate observed estimates from causal hypotheses. These limitations remain even after R0-1 is fixed.

6. **R0-6 — Medium — P:41,174: the claimed universal training shutdown is unsupported.**  
   `U:11934–11985` does not clear ram, trebuchet or mangonel goals, and permits up to three enemy units in town. Independent siege goals exist at `U:977–999`. The boom switch at `T:1237–1243` also needs additional population/resource conditions beyond 90 civilians. These are conditional strategic pauses, not evidence that the AI “trains nothing,” nor by themselves proof of deliberate weakening. Deferring an owner decision is reasonable; the stated rationale needs correction.

7. **R0-7 — Low — P:44: the current-AI summary misstates training and escrow.**  
   `src/game/simulation/bridge/systems/aiSystemProductionPhase.ts:282–334` selects one idle producer per mix entry, rather than exhausting every idle producer; its Castle trains separately at 342–360. Imperial research runs before ordinary army training at 246. The ram is a priority purchase with `holds: false`, not an escrow hold (`src/game/simulation/aiEscrow.ts:82–87`). Building order, age reserves and the Britons/Franks’ 60-wood reseeding description otherwise match the inspected code.

8. **R0-8 — Low — P:37,39–40: several source summaries remove consequential exceptions.**  
   The Monastery is not unconditional across strategies (`B:5603–5609`, with earlier skips at 5461–5510). The 1,225-food rule clears **skirmishers**, not Castle-produced units (`U:11205–11216`). During Castle research, farms below eight can bypass the claimed 610–785-wood requirement (`B:4774–4779`). These inaccuracies would misdirect later implementation.

**Citations checked**, covering every numbered Approach item and P1–P4:

| Item | Citation | Result |
|---|---|---|
| 1 / P4 | U:8–71 | Holds: train-goal resets. |
| 1 | U:13298–13305 | Holds: ordinary knight action requires its goal and `siegereq`. |
| 2 / P4 | U:5856–5921 | Numeric counter thresholds hold; additional composition restrictions apply. |
| 2 | U:5776–5792 | 125 wood/145 gold and superiority thresholds hold, conditionally. |
| 3 | I:4154–4179; C:5480 | Thresholds hold; the eight-unit sum specifically counts trebuchets, rams, bombard cannons and petards. |
| 4 | C:5108,5133,5158,5180,5201,5223; I:1231–1249 | Difficulty percentages and conditional cap calculation hold. |
| 5 | E:1–18,731–737,3369–3375 | Release/reset/recalculate escrow cycle holds. |
| 5 / §13.1 | E:743–744,817 | Lower-level age-escrow exclusions hold. |
| 6 | B:11918–11939; CC:4314–4321 | Queue cancellation and stated ordinary building thresholds hold. |
| 6 | B:5454–5460,5602–5614 | Does not support unconditional Monastery demand; R0-8. |
| 7 / P2 | U:9191–9219,9336–9386; CC:6126–6131 | Constants hold; proposed translation does not; R0-3. |
| 8 | U:10331–10347,11132–11146,11205–11216 | 880/835/1,225 hold conditionally; final unit classification is wrong. |
| 9 | CC:6438–6463; B:4772–4782 | Constants hold; blanket farm requirement does not. |
| 10 | U:11934–11985; T:1227–1259; I:8432–8446 | Conditional suppression/switches exist; claimed scope does not. |
| 11 / P1 | B:2173–2189,2232–2244 | >5 and ≥10 thresholds hold; omitted gates matter. |
| P3 | E:2531–2573 | Escrow purpose holds; proposed eligibility does not. |
| §13.1 | B:10237–10243; C:5112,5137,5162 | Castle limits 1/2/3 hold. |

Both new §13.1 additions are correct. No proposal explicitly adopts those lower-level handicaps. M1 claims no implemented treatment effect, so I found no current difference falsely declared a signal against its noise table; that single split remains descriptive variation, not a validated significance threshold.

## Findings and disposition

- R0-1 (high), accepted and repaired. The engine recycles entity ids, and the spend probe remembered raw ids, so a unit or building born on a dead one's id was never charged. The probe now names an entity by its id and generation (`world.getEntityRef`, `tmp/probes/spendTrace3.mts`), and both configurations were played again: the first ten castle seat-seeds held 1.1-3.3 times the army wood and up to 1.6 times the farm wood the old probe counted. Every spending table and statement in plan 147 is the new probe's; the conclusions moved with it (below).
- R0-2 (high), accepted. DE's Lumber Camp rule was measured on this game by work 141 M2a and dropped, and spec §13.2 makes a safe gather route the precondition of any retry. The camp rule is no longer proposed for M2: it waits on that route, which belongs to the gathering rules (§6.4), and the plan says what this lane needs (a gather target whose route, not only its end, keeps out of enemy defences). Approach item 11 now names DE's `buildlumber` gate and `sn-camp-max-distance`, and the work 141 history.
- R0-3 (medium), accepted. The flush's buffers are restated with DE's conditions (the army level or ahead with 5 soldiers and not ahead of the enemy's age; food villagers and farms both under 7; no idle farm at superiority 2), the age comparison corrected ("not ahead"), the camp buffer at more than 4 tiles and tied to the camp rule, and the Castle Age Siege Workshop thresholds as the goal skips they are, not a price held on top of each unit.
- R0-4 (medium), accepted. DE escrows the Siege Workshop with 50 or 60 adjusted civilians, and this AI keeps at most 40 villagers in the Castle Age (`aiEconomyPlan.ts` 144-145), so DE's own conditions would not fire here: the Imperial-prerequisite escrow is no longer proposed.
- R0-5 (medium), accepted. The outcome separates what was measured from what is a hypothesis, says the samples are 250 ticks apart, and names the expired-farm classification for the heuristic it is (food at most 10 at the sample before the farm left the list; the failed reseed itself is not observed).
- R0-6 (medium), accepted. Approach item 10 now says the Feudal peace sets the land army's goals to no while siege and Monks keep theirs, and the boom switch has further conditions; both are called pauses, put to the owner as more passive behaviour, not called handicaps.
- R0-7 (low), accepted. The description of this AI now says each mix entry asks the first idle producer of its building once a decision, the Castle's unique unit separately and Imperial research first, and the ram is bought first but holds nothing.
- R0-8 (low), accepted. The Monastery's conditions, the skirmisher's 1,225-food rule and the Castle research farm exception are corrected.

## Verification

- The lane read the scripts and the code: its sandbox check printed `keep` (no failed command), and the worktree's `git status --porcelain` and `git diff HEAD` were byte for byte the same before and after the run; it changed nothing.
- R0-1's repair was checked against the old probe on the same seeds before the full rerun: the first ten castle seat-seeds counted 1.1-3.3 times the army wood and up to 1.6 times the farm wood (`tmp/m1/spend2-castle/` against `tmp/m1/spend3-castle/`). The repaired probe played all 50 matches again with no failure.
- The repairs are docs; `npx vitest run tests/architecture` passed on them (below in plan 147).
- Round 1 reviews the repaired revision.

## Round outcome

Eight findings, all accepted; R0-1 repaired by measuring again, the others by correcting the plan. The repairs go to round 1 on the repaired revision.
