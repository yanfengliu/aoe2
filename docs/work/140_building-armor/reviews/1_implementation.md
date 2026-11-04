# Review 1: implementation

## Target

Repository aoe2, branch `building-armor-1104`, commit `fa374d9f` on main `a37deeee`: a focused re-review of round 0's repairs, the diff `04c75c13..fa374d9f` (commit `7417c47d`, the repairs, and `fa374d9f`, a plan step corrected after the rebase). The prompt named each round-0 finding and its claimed repair, appended both round-0 reports, and asked four questions: whether each finding is resolved, and the F0 repair complete across the roster and both paths; whether a repair introduced a defect or weakened a test, the browser change in `game-rendering-and-world.spec.ts` in particular; whether the corrected comments' numbers are right; and whether any stale premise about hits on buildings is left. Run folder: fleet's ignored `tmp/review-runs/aoe2-work140-r1/`.

## Reviewers and coverage

- Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from the run folder with `--cd` on the worktree. The log check printed `keep` (no command failed to start). It cited `src/game/simulation/prototypeUnitRules.ts:183`, outside the repair's hunks, and the citation holds: that line named Sappers among the techs the infantry predicate reaches. It hash-checked the cached pinned dataset, ran 140 focused tests and simulated the rendering test's House; it did not rerun the browser tests, the mutation proofs or the full gate, and had no network for remote CI.
- Claude, model `claude-opus-5-5[1m]` at `--effort max`, Claude Code 2.1.308, tools Read, Glob, Grep, Task and Bash with only `git diff`, `git log` and `git show` allowed, `--permission-mode dontAsk`, `--setting-sources=`, `--strict-mcp-config`. The report check printed `keep` (one result event, `success`, one model). Its `system/init` event showed those five tools, `permissionMode` `dontAsk` and no MCP servers. Of its 21 Bash calls, 17 read (`git log`, `git diff`, `git show`, `git status`, `git grep`, `ls`, `head`, `sed -n`, `cmp`) and 4 were refused by `dontAsk`; it ran no tests and read the pinned `data.json` copy without hashing it. It ran for 27 minutes, and the worktree moved under it: commit `86ba7290` (this round's F9 and F10, a comment, the spec and the changelog) landed at 13:28, and the full gate ran in the tree from 13:29. The report says which of its findings that commit already fixes. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and clean after it.

## Reports

Both are kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text.

### Codex (gpt-6-astra, xhigh)

> No critical or major findings. Two minor stale-premise findings remain:
>
> 1. **Minor — Sappers is still described as an infantry upgrade.** `prototypeUnitRules.ts:183`, **outside the repair hunks**, and `spec-final.md:1510` say the infantry predicate makes Sappers reach all infantry. The runtime correctly restricts it to villagers. These descriptions contradict §10.7.2 and could guide a future implementation back toward the retired behavior.
>
> 2. **Minor — The spec still calls building-kind bonuses deferred.** The v0.3.134 paragraph at `spec-final.md:1307` retains the present-tense “ENFORCED” claim that `attackBonuses.test.ts` checks the building table and defers building-kind bonuses. Those bonuses now work and are checked separately, as `attackBonuses.test.ts:29` states. Mark this gate description superseded, preserving the historical account.
>
> The named repairs otherwise check out:
>
> - **F0:** I hash-verified the cached pinned dataset and examined all 93 mapped roster units. Exactly the four repaired units carry both base families. Both building-hit paths retain and evaluate the second component.
> - **Browser change:** It preserves the health-bar update test and its 80-step bound. Direct simulation reproduces the first hit at tick **13** and destruction at **73**. Paused boot prevents background simulation from escaping that bound.
> - **Numbers:** Recomputed Ram→Stone Wall **134**, Siege Ram→Castle **192**, Ram→Castle-age House **151**, Bombard→Imperial TC **234**, Trebuchet→Imperial TC **442**, and Villager→Castle-age House **5/20** without/with Sappers.
> - **F1–F4:** Tooltip, saved-family wording, specified historical corrections, and legacy-shot test are correct.
> - **F6–F7:** Census size is **151,380**; retained census artifacts and the repair commit’s two-way change list agree. **F8** remains a landing action.
>
> **140 focused tests passed.** Browser tests, mutation proofs, and the full gate were not rerun; remote CI was inaccessible. Reviewed through `fa374d9f`. I modified no files.

### Claude (claude-opus-5-5[1m], max)

> No critical or major findings. F0–F8 are each fixed at the file and line the repair names, and F0 is complete. Seven minor findings remain, all comments, records or labels; none changes a hit's damage.
>
> The branch moved during the review. `86ba7290` ("Repair work 140 after review round 1", Codex's F9 and F10) was committed on top of fa374d9f at 13:28. It changes only a comment in `prototypeUnitRules.ts`, the spec and the changelog. I reviewed fa374d9f and say below where `86ba7290` already fixes something.
>
> **Findings**
>
> 1. **minor — `src/game/simulation/types.ts:319-320`.** `SelectionState.armor` is still documented as "melee armor-tech bonus" and `pierceArmor` as "pierce armor-tech bonus". Since work 140 both hold total armor (`selectionCombatStats.ts:6-11`). This is a sibling of F1: the repair fixed the hover text but not the type that defines the field. AGENTS.md makes the types the API reference, so a reader of `getSelectionState()` is told a Town Center's 3 is an upgrade bonus, which is the confusion F1 was about.
>
> 2. **minor — `src/game/simulation/researchTables.ts:74`.** The Kasbah row's comment says "Blacksmith (AoE2 University), Imperial: +15 infantry attack vs buildings." That is the old Sappers rule from before v0.3.132 (infantry, +15 with no armor), left on the wrong row. Kasbah is a Castle Age tech (line 233). F5's search missed it because the comment never says "Sappers". It describes hits on buildings by the old rule and also misdescribes Kasbah.
>
> 3. **minor — `tests/simulation/civBonusEffects.test.ts:332-333` and `:347`.** The Goths twin race still says "the Goths militia deals +1 vs the building per hit" and "Goths' +1/hit". This repair corrected its fixture (`civGothsInfantry.ts:11-12`) to say the Imperial Militia takes 6 a hit off the Castle Age House against the control's 3. The test's comments now contradict the fixture it drives.
>
> 4. **minor — `src/game/simulation/prototypeUnitRules/armorClasses.ts:24-26`.** The corrected header says the building attacks include "the non-siege +1 to +3". The table gives +4 to the Two-Handed Swordsman, Champion and both Teutonic Knights (`buildingAttack.ts:53-54`, `:65-66`), and non-siege units carry far more: War Elephants 30, Tarkans 8 to 12. This is the only corrected comment whose number is wrong.
>
> 5. **minor — `docs/work/140_building-armor/plan.md:48-54`.** Spec §10.1 now says unit combat ignores the Scorpion and Chu Ko Nu lines' melee 0, but the plan's "Findings outside this scope" doesn't list it, so nothing queues a card for it. The gap is not small:
>    - With this game's tables a Scorpion takes 1 a bolt off a Battering Ram (12 pierce against 180, plus its +1 against rams).
>    - The missing term, max(0, 0 − (−3)), would make that 4. A Chu Ko Nu's 1 would be 3.
>    - Rams are the only units with negative melee armor (`unitArmorTables.ts:135`, `:148-149`).
>
> 6. **minor — `tests/simulation/buildingDamageCensus.test.ts:94-95` with `:120-121`.** The hand-check block says its values are worked "from the pinned dataset's numbers". The new Scorpion case uses this game's 12 pierce; DE's Scorpion has 11, one of the 26 base-attack differences. So the case's 8 is not DE's figure, which is 7. The older Teutonic Knight case (`:116-117`, 12 here against DE's 14) has the same problem. Either say these cases use the game's attack stat, or use the Heavy Scorpion, whose 14 matches DE (13 off a Feudal House).
>
> 7. **minor (wording) — four comments still say the attack delivery adds the building bonuses.** Since work 140, `attackDelivery.ts` adds none of them; `attackOnBuilding` does. The comments point a reader at the wrong file:
>    - `bridge/systems/attackCommandStep.ts:3`
>    - `civBonusTable.ts:266-267`
>    - `tests/simulation/civBonusDeParity.test.ts:57`
>    - `tests/simulation/indiansScoutBuildingAttack.test.ts:20`
>
> 8. **Fixed after fa374d9f.** The v0.3.134 sentence in `design/spec-final.md:1307` still said `attackBonuses.test.ts` compares against "the building table" and defers "building-KIND bonuses per §10.6" and "'+N melee' notes". All three were false after work 140, and §10.6 is now Attack Speed. `86ba7290` (F10) marks the sentence as superseded.
>
> Two notes outside the question:
> - **Design data.** `technologies.csv:100` still gives the Fortified Gate "6/6 armor". DE's unit 488 is 0/0 with Building 20 (`tmp/probes/de147949-buildings.txt:61`), as the runtime and §10.3 have it. Line 110 limits Siege Engineers to "Siege Weapons", while §10.7.1 also covers the Cannon Galleons, the Petard and the Demolition Ships. The file's header (line 5) says those columns are the earlier transcription, so this is a consistency note, not a defect of this work.
> - **Landing.** Work 106's cards (`docs/work/106_de-parity-orchestration/plan.md:110`, `:116`) still describe the defect in the present tense and should be marked shipped when work 140 lands. The plan's landing step doesn't mention the version bump (F8).
>
> **Your four questions**
>
> **1. Are the findings resolved, and is F0 complete?** Yes to both.
> - **The dataset.** I scanned the pinned `data.json` directly; its SHA-256 matches the fixture's in the copy's manifest, though I couldn't hash it myself. Exactly four units in the whole dataset have attacks in both class 3 and class 4:
>   - Chu Ko Nu (73), at line 14617
>   - Scorpion (279), at line 15588
>   - Heavy Scorpion, at line 17811
>   - Elite Chu Ko Nu (559), at line 18658
>
>   All four have melee 0, which matches `UNIT_SECOND_FAMILY_ATTACK` (`buildingAttack.ts:105-110`) exactly. No building has attacks in both classes.
> - **The paths.** Only two places take hit points off a building: a blow at `attackCommandStep.ts:346` and a landing shot at `registerAllSystems.ts:470`. Both go through `buildingHitDamage`.
>   - A shot's saved family override (`buildingHitDamage.ts:65`) keeps the second attack.
>   - `damageOnBuilding` meets it (`buildingAttack.ts:197`), and nothing else reads an `AttackOnBuilding`.
>   - There is no Chu Ko Nu volley or Scorpion pass-through that could land extra hits.
>
> **2. Did a repair add a defect or weaken a test?** No assertion was loosened.
> - **F4's saved-shot test is real.** `stateSlot` returns a live reference into the save (`saveBlobTestUtils.ts:69-75`), and the projectile codec copies fields through unchanged (`bridgeStateSerialize.ts:313-319`). So code that still read `buildingDamage` would deal 999, destroy the House, and fail the test.
> - **The browser loop still tests what it was for, and the 80-tick bound is honest.**
>   - In the fixture (`conquest.ts:25-26`), a Militia takes 6 a blow off the 40-HP Dark Age House. With a 10-tick reload (`statTables.ts:226`), seven blows land inside 80 ticks.
>   - The first gate confirms it: the House was gone at tick 80 (`tmp/verify-1.log:1004-1008`).
>   - The loop stops at the first drop. If the House vanishes, the loop runs to 80 and the test fails rather than passing. The paused boot adds no ticks of its own.
>   - 80 ticks is the same as the old fixed wait.
>   - One weakness predates the repair: `fillRatio < 1` was already true at 40/900. Comparing against `initialHouseBar.fillRatio` would check that the drawn bar moved.
>
> **3. Are the corrected numbers right?** Yes, except finding 4. Each recomputes from `buildingArmor.ts`, `buildingAttack.ts`, `statTables.ts` and each fixture's starting ages. No fixture gets techs it doesn't list (`scenarioSeedOps.ts:149`, `:183`).
>
> | Comment | Figure |
> | --- | --- |
> | Battering Ram on a Stone Wall | 134 |
> | Battering Ram on a Castle Age House | 151, six hits for 900 HP |
> | Siege Ram on an Imperial Town Center | 200 |
> | Siege Ram on a Castle | 192, two hits for 200 HP |
> | Trebuchet on an Imperial Town Center | 442 |
> | Bombard Cannon on an Imperial Town Center | 234 |
> | Goth Militia on a Castle Age House | 6 against 3 |
> | Villager on a Castle Age House | 5, and 20 with Sappers |
> | Spec, Sappers | 20 and 41 |
> | Spec, Petard | 1401, 1389 and 609 |
> | Spec, Trebuchet with Siege Engineers | 481 |
> | Hand checks | Chu Ko Nu 3, Scorpion 8 |
>
> **4. Are stale premises left?** Yes: findings 1–4 and 7, still present at both fa374d9f and the current tip. Finding 8 is fixed in `86ba7290`.
>
> **Not verified**
>
> - **Tests.** I ran none, to leave the tree untouched.
> - **The full gate.** `tmp/verify-2.log` is a full `npm run verify` on `86ba7290`, which has the same code as fa374d9f. When I read it, it was still running and there is no receipt yet:
>   - content validation had passed;
>   - unit tests had passed (5,190 passed, 3 skipped);
>   - the browser suite was at 188 of 275 with no failures, and that includes both repaired specs (lines 1000 and 1027).
> - **Counts I recomputed.**
>   - 151,380 = 87 × 87 × 4 × 5.
>   - The paths file has 110 cases plus 2 tests = 112, and `tmp/paths-on-base-r1.txt:2162` shows 102 of them failing on the old tree.
>   - `tmp/lab-census-r1.json` matches the recorded census byte for byte, apart from a trailing newline.
> - **Mutation counts.** I did not re-run the recorded mutations.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F9 | Codex 1: `prototypeUnitRules.ts:183` and the class-predicate paragraph in spec §11.11 (`spec-final.md:1510`) still say the infantry predicate makes Sappers reach all infantry. | Accepted: Sappers has been a villager technology since v0.3.132 (§10.7.2), and the line could lead an implementation back to the retired rule. | Both drop Sappers from the list and say where it went. |
| F10 | Codex 2: the v0.3.134 paragraph in spec §10.9's run of audit history (`spec-final.md:1307`) still says, in the present tense, that `attackBonuses.test.ts` checks the building table and defers the building-kind bonuses. | Accepted. | The paragraph keeps its history and says work 140 superseded it: the attacks against buildings are DE's five classes, held by `buildingCombatStats.test.ts`, and `attackBonuses.test.ts` skips those tokens. |
| F11 | Claude 1: `SelectionState.armor` and `pierceArmor` (`src/game/simulation/types.ts:319-320`) are still documented as armor-technology bonuses, though they hold total armor. | Accepted: the types are this repository's API reference, and the sibling of F1. | Both comments say total armor, base plus upgrades. |
| F12 | Claude 2: the Kasbah cost row's comment (`researchTables.ts:74`) gives the old Sappers rule. | Accepted. Round 0's search missed it because it never says "Sappers". | The comment says what Kasbah does here: Castles work 25% faster. |
| F13 | Claude 3: the Goths twin race's comments (`civBonusEffects.test.ts:332-333`, `:347`) still say +1 a hit, against the fixture's corrected 6 and 3. | Accepted. | They say the Imperial Goths Militia takes 6 a hit off the Castle Age House against the control's 3. |
| F14 | Claude 4: the corrected armor-class header says the building attacks include "the non-siege +1 to +3", where the table gives +4 and the War Elephants, Tarkans and ships carry far more. | Accepted: the one corrected comment whose figure was wrong. | It names the infantry's +1 to +4 and the War Elephants', Tarkans' and ships' attacks. |
| F15 | Claude 5: the plan's outside findings leave out that unit combat ignores the Scorpion and Chu Ko Nu lines' melee 0, which against a ram's -3 melee armor is 3 a bolt. | Accepted as a finding outside this work: unit combat is not in its scope. | Listed in the plan with the review's figures (a Scorpion's 1 a bolt off a Battering Ram would be 4, a Chu Ko Nu's 1 would be 3). |
| F16 | Claude 6: the hand checks say they are DE's figures, but the Scorpion's (12 here, DE 11) and the Teutonic Knight's (12, DE 14) attack stats are two of the 26 that differ, so 8 and 9 are not DE's. | Accepted. | The Heavy Scorpion (14, as in DE) takes 13 off a Feudal House, and the Long Swordsman (9) 6 off a Wonder, its 3 against Standard Buildings meeting nothing; the comment says each unit's stat is DE's. Red: the old formula on the current text turns both red (and the whole census file, 14 of 14), dropping the second attack turns the Heavy Scorpion red, and counting a class the building lacks turns the Long Swordsman red. |
| F17 | Claude 7: four comments say the attack delivery adds the building bonuses (`attackCommandStep.ts:3`, `civBonusTable.ts:266-267`, `civBonusDeParity.test.ts:57`, `indiansScoutBuildingAttack.test.ts:20`). | Accepted: they point at the wrong file. | Each names `attackOnBuilding`. |
| F18 | Claude 8: the v0.3.134 gate sentence. | Already fixed as F10 in `86ba7290`. | None. |
| N1 | Claude, outside the question: `technologies.csv` gives the Fortified Gate 6/6 armor, where DE's unit 488 is 0/0 with Building 20, and limits Siege Engineers to siege weapons. | Accepted: the brief has this work fix the CSVs where DE differs on these rules. | The Fortified Wall row gives the Gate 0/0; Siege Engineers names the Cannon Galleons, the Petard and the Demolition Ships and its x1.2 and x1.4; Masonry and Architecture name what they leave out; a header line says these four descriptions follow DE. |
| N2 | Claude, outside the question: work 106's cards for this defect should be marked shipped at landing, and the plan's landing step does not name the version bump. | Accepted for landing. | The plan's landing step names both. |
| N3 | Claude, under question 2: the House bar test's `fillRatio < 1` was already true at the 40 of 900 seed; comparing against the first reading would check that the drawn bar moved. | Not taken: the weakness predates this work, and a stronger assertion needs its own red proof (a bar that does not redraw), outside work 140. | None; recorded here for that test's owner. |

## Verification

The repairs were checked on the repaired tree: `npm run content:validate` passed; the nine test files they touch (the census, the Goths, de-parity and Indian building-attack tests, the three technology-CSV tests, the file-size budget and the content test) passed, 76 tests; `npx tsc --noEmit` and `eslint` over the changed files exited 0; the work-document gates passed (5 files, 109 tests). Red proofs are in the table. The full gate on the repair commit and a focused re-review of it (round 2) follow.

## Round outcome

Codex: two minor findings, both accepted and repaired (F9, F10). Claude: seven minor findings and two notes, all accepted; F15 is recorded as a finding outside this work, F18 was already fixed as F10, and its third remark (N3) was not taken, with the reason given. No finding changes a hit's damage. A focused re-review of the repairs is round 2.
