# Review 0: implementation

## Target

Repository aoe2, branch `building-armor-1104`, commit `dc7e6d6f` against main `6b5e9871`: the whole of work 140's first implementation (`git diff 6b5e9871...dc7e6d6f`). The prompt carried that diff without `tests/content/fixtures/deBuildingCombat.json`, which both lanes could read in the tree. After the rebase onto main `a37deeee` the same change is commit `04c75c13`, whose tree differs from `dc7e6d6f`'s only in `docs/work/106_de-parity-orchestration/plan.md`, where main's line was kept. Run folder: fleet's ignored `tmp/review-runs/aoe2-work140-r0/` (prompt, logs and raw reports).

## Reviewers and coverage

- Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from the run folder with `--cd` on the worktree. The log check printed `keep` (no command failed to start). It cited `tests/content/deAttackDamageReference.ts:5`, outside the diff's hunks, and the citation holds. It ran 163 focused tests itself and loaded a synthetic legacy shot; it had no network for remote CI.
- Claude, model `claude-opus-5-5[1m]` at `--effort max`, Claude Code 2.1.308, tools Read, Glob, Grep, Task and Bash with only `git diff`, `git log` and `git show` allowed, `--permission-mode dontAsk`, `--setting-sources=`, `--strict-mcp-config`. The report check printed `keep` (one result event, `success`, one model). Its `system/init` event showed those five tools, `permissionMode` `dontAsk` and no MCP servers. Of its 12 Bash calls, nine read (`git log`, `git diff`, `git show`, `ls`, `sed -n`, `wc`, `date`) and three were refused by `dontAsk` (a `node` call, an `awk` pipe and a `git check-ignore` chain); it ran no tests. The tree's `git status --porcelain` and `git diff HEAD` were empty before the run and unchanged after it.

## Reports

Both are kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text; in the Codex report the link "oracle at line 120" pointed at `tests/simulation/buildingCombatOracle.ts:120`.

### Codex (gpt-6-astra, xhigh)

> 1. **Major — Zero-valued melee attacks are lost.** `buildingAttack.ts:179` evaluates only one base attack family. The hash-verified `3bb43b14` data gives both Scorpion tiers and both Chu Ko Nu tiers a **0 melee attack alongside pierce**. Against negative melee armor, that component contributes damage: `max(0, 0 − armor)`. I reproduced a real Saracen Chu Ko Nu projectile dealing **2 instead of 3** against a Feudal House: `max(0,8−8) + max(0,0−(-1)) + 2 = 3`. Against a Dark Age House, an ordinary Chu Ko Nu deals **1 instead of 3**. This violates criterion 1 without requiring any change to the excluded base attack values. Preserve both attack components, including zero-valued ones. The oracle at `tests/simulation/buildingCombatOracle.ts:120` repeats this omission; its unchanged reference explicitly covers **primary armor family only** at `deAttackDamageReference.ts:5`, which I read outside the diff.
>
> No other material findings. I checked both building damage paths, AI targeting, armor display, technology/team scopes, fixture provenance, and changed assertions. **163 focused tests passed.** A synthetic legacy shot carrying `buildingDamage` loaded and resolved correctly. Retained census results match the respective baseline and branch expectations, supporting the re-recording; screenshot differences match the documented bounds. No existing timeout or budget was raised.
>
> Reviewed `6b5e9871…dc7e6d6f`. Full verification and browser tests were not rerun; remote CI was unavailable because network access was blocked. No files were modified.

### Claude (claude-opus-5-5[1m], max)

> I found nothing critical or major. The seam is correct, complete and matches its fixture. There are eight minor findings: one user-visible tooltip, three spec inconsistencies, a missing test for old-save shots, stale comments, a wrong census count in the docs, and an incomplete re-record note.
>
> **Findings**
>
> 1. **minor (user-visible): the armor rows' tooltips still describe the old meaning.** At `src/ui/hud/tooltips.ts:44-45` (outside the diff), hovering either row still says "Melee damage reduction (armor-upgrade bonus)." and "Pierce damage reduction (armor-upgrade bonus)…". After this change the rows show total armor, and buildings show it too. A player hovering the Town Center's "3" is told it is an upgrade bonus. No test checks this text (`tests/ui/selectionPanelArmor.test.ts` checks only values).
>
> 2. **minor: the spec contradicts itself on an old saved shot's damage family.**
>    - The new §10.4 text (`design/spec-final.md:1150`) says an old shot "lands by the current rule, as an older saved shot adopts the current damage family (§10.2)".
>    - §10.2 (`:1105`) says a direct in-flight hit keeps its saved `attackType`; only blast damage switches to the current family.
>    - The code passes `family: shot.attackType`, i.e. keeps the saved family (`projectileOps.ts:331-336`), and `decisions.md:967` says the same.
>    
>    The new sentence is the one that is wrong.
>
> 3. **minor: two older spec passages now conflict with work 140.** AGENTS.md requires conflicting spec text to be edited.
>    - `design/spec-final.md:1305` (the Hoardings paragraph) still says "Masonry and Architecture, which apply to every building".
>    - `:1307` (the v0.3.135 history) still says Siege Engineers is "now applied to a siege attacker's whole per-hit building damage", with ram bases of 125/150/200.
>    
>    Both conflict with the new §10.3 and §10.7.1.
>
> 4. **minor: criterion 6 (an old-save shot carrying `buildingDamage`) has no test.**
>    - The code is sound on inspection: the projectile codec passes saved objects through unchanged (`bridgeStateSerialize.ts:313-319`), there is no save schema for projectiles, and nothing reads the field.
>    - But no test resolves a shot carrying `buildingDamage`. `projectileDestroysBuilding.test.ts:25` deleted the old field from its literal instead of keeping a case with the old shape.
>
> 5. **minor: stale premises and comments outside the diff.**
>    - `tests/simulation/footprintVisibilityConsistency.test.ts:105-107,129-130` and `fixtures/economyBasics/fogAndMovement.ts:76-77` say one Siege Ram hit destroys the 200-HP Castle. It now deals 192 (4−8 → 0, then 200−8), so it takes two hits. The test still passes only because it waits up to 200 steps.
>    - `prototypeUnitRules/armorClasses.ts:24-26, 218-219, 222-223` still call the building-class bonuses "deferred" and point to the deleted `BUILDING_ATTACK_BONUS`.
>    - `fixtures/sappers.ts:9-14, 61-67` still describes the attacker as a Militia.
>    - `entityCreateOps.ts:339-341` still says Masonry raises "everything this owner builds".
>
> 6. **minor: the docs' census size doesn't match the test.**
>    - The plan (`plan.md:30`), the devlog entry and the new register entry all claim 146,160 hits.
>    - `buildingDamageCensus.test.ts` (the `buildingTechStates` function and its nested loops) actually runs 87 attackers × 87 building/technology states × 4 ages × 5 owners = 151,380. I counted 87 units and 25 buildings in the fixture.
>    - 146,160 = 87 × 84 × 20, so the number (and probably the "red under 11 mutations" evidence) was measured on an earlier version of the test, likely before the Gate got its Fortified Wall states.
>
> 7. **minor: the self-play census re-record is justified, but its commit note is incomplete.**
>    - Re-recording after a deliberate rule change is what the gate allows (`selfPlayContentCoverage.test.ts:54-62`).
>    - But the gate asks the commit to state the two-way diff (`:289-290`), and the commit message leaves out:
>      - owner 2's technology changes: gained capped-ram-upgrade, cavalier-upgrade, heavy-scorpion-upgrade, hoardings and sappers; lost conscription and halberdier-upgrade;
>      - what the match as a whole stopped exercising: mangonel, halberdier, halberdier-upgrade, ring-archer-armor.
>    - Why owner 1 stopped building a Siege Workshop and a Monastery is stated, not traced.
>
> 8. **minor (process): no version bump yet.** `docs/changelog.md:5` is headed "Unreleased — work 140" and `package.json` is still 0.3.258. That's fine if the bump happens at landing (phase 2), as the plan implies.
>
> **What I checked and found sound**
>
> - **Criterion 4 (one seam):** only two places reduce a building's hit points:
>   - the melee step, `attackCommandStep.ts:345-348`;
>   - a landing shot, `projectileOps.ts:318-336` → `registerAllSystems.ts:466-480`.
>   
>   Both go through `buildingHitDamage`. A search for every `currentHp -=` in `src` found no other building path, and blasts reach only units and animals. A search of all AI files found no damage estimate at all.
> - **Criteria 1–3 and 8 (formula and DE values):**
>   - `buildingArmor.ts` matches the fixture for all 25 buildings in every age and for the 3 upgrades.
>   - `UNIT_BUILDING_ATTACKS` matches all 87 fixture units: 47 non-empty rows, and the content test checks both directions.
>   - The CSVs and the spec tables agree with both.
>   - The bonus scopes equal the fixture's DE classes: the Goths infantry set (`isInfantryUnit` minus the Petard) is class 6, the Saracen archer set is class 0, and the Hindustani units and Siege Engineers' ×1.2 and ×1.4 sets match the listed classes and IDs.
>   - I recomputed the spec's worked examples and all match: Petard 1401/1389/609, Trebuchet with Siege Engineers 481, Sappers 20/41, Ram 150, Archer 1, Militia 1, Villager 4.
> - **Criterion 5 (panel):** the unit rows use the same `effectiveMeleeArmor`/`effectivePierceArmor` calls as the damage paths, and civilization armor lives in combat state (`combatStateFactory.ts:118-120`). The building rows call the same `currentBuildingArmor` the damage path uses. `tmp/captures/armor-tc-after.png` shows the Town Center at 3 and 5.
> - **Criterion 6 (saves):** nothing new is saved. Building creation passes the building type into the hit-point multiplier (`entityCreateOps.ts:346-361`), so Masonry's narrower reach is consistent.
> - **Criterion 7 (tests):**
>   - Two assertions got stronger: the Petard check went from "≥500" to exactly 1401, and the projectile-flight test now checks the Outpost takes 75.
>   - The panel tests changed to DE's base armor (Knight 2, Cavalier 2→3, Town Center 3/5).
>   - The Goths oracle now reads the fixture instead of the runtime.
>   - The removed building check in the attack-bonus test is replaced by stricter two-way checks.
>   - No timeout was raised or budget moved; `registerAllSystems.ts` sits exactly at the 500-line cap, which passes.
>
> **Not verified**
>
> - I could not check DE's values against the upstream dataset (no network); I checked only internal consistency.
> - I did not run any tests. Node commands were denied here, and a `npm run verify` on dc7e6d6f started at 20:12:35Z. Only `tmp/verify-receipt.start.json` exists, with no certified receipt, so the full gate's result is still unknown.
> - Context, not a defect: the measured drop from 3 to 1 of 7 conquest-only self-play matches ending inside their horizon lands before work 141's AI fixes.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Codex 1: a unit with a base attack in both families loses the zero-valued one. DE gives the Scorpion and Chu Ko Nu lines a melee 0 beside their pierce attack, and against a building with negative melee armor (a Dark Age or Feudal House) that adds `max(0, 0 - armor)`: a Chu Ko Nu takes 3 off a Dark Age House, not 1. The oracle repeats the omission. | Accepted, major. The pinned dataset gives exactly four roster units an attack in both families, the Scorpion, Heavy Scorpion, Chu Ko Nu and Elite Chu Ko Nu, all with melee 0. | `UNIT_SECOND_FAMILY_ATTACK` in `buildingAttack.ts`, met by `damageOnBuilding`; the fixture records `otherFamilyAttack` and the generator cuts it from the dataset; the oracle and the content test read it; `units.csv` records `+0 melee` on the Chu Ko Nu rows and drops the Fire Ships' stale `+1 melee`; hand checks Chu Ko Nu on a Dark Age House 3 and Scorpion on a Feudal House 8; the path case `chu-ko-nu-on-dark-house`. Red: dropping the term from `damageOnBuilding` turned 3 of the 124 census and path tests red; dropping the Chu Ko Nu's row turned the content test red (1 of 9). |
| F1 | Claude 1: the armor rows' hover text still says "armor-upgrade bonus". | Accepted, user-visible. | `src/ui/hud/tooltips.ts` says total armor, base plus upgrades; `tests/ui/selectionPanelArmor.test.ts` checks the text. Red: the old text turned it red (1 of 3). |
| F2 | Claude 2: spec §10.4 says an old saved shot adopts the current damage family, against §10.2 and the code. | Accepted; the new sentence was the wrong one. | §10.4 now says the shot lands with its saved damage family, as any direct hit does. |
| F3 | Claude 3: the Hoardings paragraph and the v0.3.135 history line contradict §10.3 and §10.7.1. | Accepted. | The Hoardings paragraph names Masonry's DE reach (every building but the walls, gates, Farm and Fish Trap). The v0.3.135 history keeps its figures as then and says work 140 superseded them: DE's bases are 150/160/200, and the multiplier lands on the Building attack alone. |
| F4 | Claude 4: no test lands a saved shot that still carries `buildingDamage`. | Accepted. | `buildingDamagePaths.test.ts` puts `buildingDamage: 999` on a saved shot and expects DE's 1 on a House. Its first version carried 4, which a reader of the old field would also have landed as 1 (4 against the House's 7 pierce armor), so the test could not fail; with 999 it went red (1 of 112) when `projectileOps.ts` read the field again. |
| F5 | Claude 5: stale premises and comments outside the diff. | Accepted, and searched as a class: every comment and test title that quoted the old anti-building figures or the old rule. | Corrected in 16 files: the five named and `fu3Walls.ts`, `fu3DefensiveFire.test.ts`, `civGothsInfantry.ts`, `siege/ram.ts`, `siege/trebuchet.ts`, `trebuchetPackUnpack.test.ts`, `siege/bombardCannon.ts`, `imperialSiege.test.ts`, `siegeWorkshop.test.ts`, `sappers.test.ts` and `technologyTypes.ts`. Each new figure was read back from the runtime's own formula. |
| F6 | Claude 6: the records say 146,160 census hits; the test runs 151,380. | Accepted. 146,160 is 84 x 87 x 20, from an earlier fixture. | The plan, the devlog and the register say 151,380, and that 102 of the paths file's 112 tests are red on the pre-change tree (re-measured on the control tree with the current file). |
| F7 | Claude 7: the self-play census re-record is justified, but its commit note leaves out part of the two-way diff, and why owner 1 stopped building a Siege Workshop and a Monastery is stated, not traced. | Accepted for the note. The divergence is traced to its first differing event, an AI Scout's blow on an unfinished Market at tick 9,827; what the AI chose after it is the AI's, work 141's lane. | The repair commit's message carries the full two-way diff. The census was re-run after the repairs and is byte-identical to the implementation commit's recording. |
| F8 | Claude 8: no version bump yet. | Not a defect: the brief bumps the version at landing (phase 2). | None. |

## Verification

The repairs (commit `7417c47d`, with `fa374d9f` correcting a plan step after the rebase) were checked on the repaired tree:

- The 15 test files they touch, among them the content, census, paths, attack-bonus, panel and hover-text tests and every test whose comment or title changed: 248 tests passed. `npx tsc --noEmit` and `eslint` over the branch's TypeScript files exited 0; the work-document, register and line-ending gates passed (7 files, 121 tests).
- Red proofs, each by putting the defect back: the four in the table above, with the counts given there.
- The current paths file on the control tree at main `6b5e9871`: 102 of its 112 tests red, the 100 measured before, `chu-ko-nu-on-dark-house` (8 where DE gives 3) and the saved shot.
- The coverage lab's census, re-run with the instrument that reproduced main's recording: byte for byte the recording in the implementation commit.
- Every corrected comment's figure read back from the runtime's own formula (a scratch probe over `attackOnBuilding`, `damageOnBuilding` and `buildingArmor`).
- The full gate on `86ba7290`, these repairs and round 1's first two: `PREVIEW_PORT=4321 npm run verify` exited 0 after a fresh build, and `node scripts/verify-receipt.mjs check` exited 0 on that tree: vitest 5,190 passed and 3 skipped (654 files passed, 1 skipped), Playwright 273 passed and 2 skipped, the two repaired browser specs among the passes.

## Round outcome

One major finding (F0) and eight minor ones, all accepted except F8, which needs no change. A focused re-review of the repairs is round 1.
