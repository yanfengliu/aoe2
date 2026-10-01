# Review 0: integration — combat and combined milestone

## Target

Repository aoe2; base `99749eb12004cabf7d049abeddc2f84a0177d3db`. Combat review covered the exact 17-path staged tree `f55e0d8437cb01c82aa3c45e2790f47cc8a21459`; ignored retained patch `tmp/review-runs/parity-0930/combat-target.patch`, SHA-256 `1eac61cb3f30d8a288820e08c538434b8f7d6e1e6470a632b150a0096528ce50`, with path inventory in the sibling target JSON. The original authored test is retained byte-for-byte in [00_attackDamageTypes.reviewed.txt](../snapshots/00_attackDamageTypes.reviewed.txt), SHA-256 `7882fc0f802465f7c07c21081e825649043d857bb4de98f382003c125280ae76`.

Integrated review covered all 52 frozen file hashes and staged tree `fcfa79a05a2fd1233ee46d601e01be7660941316`; retained patch `tmp/review-runs/parity-0930/integrated-target.patch`, SHA-256 `7c3312c6e097b2bd8501488d18bfbbfb1c3c49aab7761d39974bc683e6fa1791`, with exact paths/hashes in its sibling target JSON. A temporary tree object is not assumed recoverable after cleanup. The exact authored reviewed Git source patches are now promoted as [00_combat-target.patch.txt](../snapshots/00_combat-target.patch.txt), 85,114 bytes, SHA-256 `1eac61cb3f30d8a288820e08c538434b8f7d6e1e6470a632b150a0096528ce50`, and [01_integrated-target.patch.txt](../snapshots/01_integrated-target.patch.txt), 270,941 bytes, SHA-256 `7c3312c6e097b2bd8501488d18bfbbfb1c3c49aab7761d39974bc683e6fa1791`. Applying each to immutable base `99749eb12004cabf7d049abeddc2f84a0177d3db` recovers its complete exact reviewed staged source/document input, including the original defects and layout. These are authored repository inputs, not raw CLI reports. Ignored target JSON remains available while acceptance needs it.

The 270,941-byte integrated source patch exceeds 256 KiB and stays below 1 MiB. Retention preserves the complete exact reviewed staged source/document input, including original defects/layout, reconstructible against the immutable base after later code/comment/provenance corrections. No further large copies are needed; subsequent small deltas should bind the final committed version and minimal authored recovery input.

All 15 uncommitted authored Markdown documents in that integrated target were preserved before the current repairs. The following snapshots are immutable historical review inputs, including their original relative links and old layout. They are not current contracts or shipping claims; current contracts retain canonical paths and live handoffs moved one directory into snapshots.

Two reviewed authored inputs exceed 256 KiB: `snapshots/01_integrated/design/spec-final.md` is 457,107 bytes and `snapshots/01_integrated/docs/changelog.md` is 352,913 bytes. Both are below 1 MiB. Retention is necessary because these exact uncommitted reviewer inputs must remain recoverable after correction; the full documents retain the surrounding contract/history and original bytes. No raw run material is promoted. Later tiny edits should bind a committed final document plus a minimal recoverable authored delta, rather than duplicate these large snapshots again.

| Original reviewed path | Retained exact document | SHA-256 |
|---|---|---|
| `design/roadmap.md` | [snapshot](../snapshots/01_integrated/design/roadmap.md) | `299ddae55e910a7547cbcc8c4e293acf96a96089d1581a23ce0214ea6d8544ac` |
| `design/spec-final.md` | [snapshot](../snapshots/01_integrated/design/spec-final.md) | `2742afff272b9d0f347ffe72fd41d569bc48d60fa34d8bd3b5674dbc9a0fac5f` |
| `docs/architecture/ARCHITECTURE.md` | [snapshot](../snapshots/01_integrated/docs/architecture/ARCHITECTURE.md) | `cc406c18305f31bc76ef4d97ea2807dab77e71203ff599c33d99b8e9ad7b3018` |
| `docs/architecture/drift-log.md` | [snapshot](../snapshots/01_integrated/docs/architecture/drift-log.md) | `b0c4753a0e2c50b279da3f8a32845d7ca94f6aefa1f1bc732e36bcad1f368f8c` |
| `docs/changelog.md` | [snapshot](../snapshots/01_integrated/docs/changelog.md) | `7650aa3b46a5b526c169b1d65f4bbfd5d5e150c807f62b63507f48c3337cfd3e` |
| `docs/debugging/2026-09-30-de-parity-orchestration.md` | [snapshot](../snapshots/01_integrated/docs/debugging/2026-09-30-de-parity-orchestration.md) | `4ddf2950fdbe1992aee790d4826257b0d2ebd8d8b5bd25ae598412a0963d743e` |
| `docs/devlog/detailed/2026-09-29_2026-09-30.md` | [snapshot](../snapshots/01_integrated/docs/devlog/detailed/2026-09-29_2026-09-30.md) | `df16ce77916dc06782ba7d82c3bdbf55c54ddd3a52b6580aba28f523e4762d3f` |
| `docs/devlog/summary.md` | [snapshot](../snapshots/01_integrated/docs/devlog/summary.md) | `d1976210126104329d3dbbce1f720e0c29b18766c8d625f36a7dbfc5997cba86` |
| `docs/learning/defect-register.md` | [snapshot](../snapshots/01_integrated/docs/learning/defect-register.md) | `eccc9b1f3997c33c919dbaaf79d2bac610316fb085e8bee27b2513b181947ae9` |
| `docs/learning/gate-proofs.md` | [snapshot](../snapshots/01_integrated/docs/learning/gate-proofs.md) | `1fce6042b7449d19f1c2578e7ce64d811f65d0b250a8e5dea2273f0e80d3c956` |
| `docs/threads/current/de-look/PLAN.md` | [snapshot](../snapshots/01_integrated/docs/threads/current/de-look/PLAN.md) | `10a1f0122f6e919c6954bace0139501cb6470a01bb951e6b2fa40d983e4fec44` |
| `docs/work/106_de-parity-orchestration/content-handoff.md` | [snapshot](../snapshots/01_integrated/docs/work/106_de-parity-orchestration/content-handoff.md) | `f63a96fa6231185cc20bfc3b3b6f6035f70871e583f951757a75f56f2d8d8b3a` |
| `docs/work/106_de-parity-orchestration/hud-handoff.md` | [snapshot](../snapshots/01_integrated/docs/work/106_de-parity-orchestration/hud-handoff.md) | `a33853388aa599082a506744c884dc76ef092fe1bf309ccaf37317bc16dafc85` |
| `docs/work/106_de-parity-orchestration/plan.md` | [snapshot](../snapshots/01_integrated/docs/work/106_de-parity-orchestration/plan.md) | `5f1980b66772fedd0adb228b08db62f5523215e045730191c21a0583e788136d` |
| `docs/work/106_de-parity-orchestration/roster-audit.md` | [snapshot](../snapshots/01_integrated/docs/work/106_de-parity-orchestration/roster-audit.md) | `b10784a5585f9e7280322f5f208b2a44e0db55c2867fda3c99d2166fb1900a78` |

## Reviewers and coverage

Codex Astra/xhigh completed two source-grounded read-only reports under the fleet pin. Combat reviewed all 17 scoped paths, retained DE source bytes and relevant outside-diff delivery/formation/garrison/hydration callers. Its attempted subagent failed initialization and contributed no evidence; the parent performed the reported inspection. No DLL-failure attribution is made: the coordinator found no such actual tool error in the captured evidence. Integrated review checked all 52 source/document hashes, 27 H4 artifacts, creation/save/replay/spawn and occupation callers, comparison/cost instruments, primary forum source and native captures. It carried forward grounded unchanged combat coverage and re-read COMBAT-R1's repair. Neither review ran tests, browsers, gates or edits. Their ci:status checks returned UNKNOWN from the worktree ownership check.

Claude Opus 5.5/max used the configured pin and exited 0, but its final result only waited for a test-sweep subagent. The coordinator's parsed capture records one background subagent spawned, zero completed and one terminated by the system. No substantive completed verdict was produced: abstention, not agreement or independent acceptance. Transport/progress output stays ignored; no fictional report is added. This round does not claim two completed provider reviews.

## Reports

### Codex: grounded combat review

The following authored report is retained verbatim (5,031 bytes, SHA-256 `c4c02a50e10353ab96b543a2e8d0cb98669e00a3a34a48b8067c1573435094bc`); dispositions below belong to the integration owner.

**Verdict: request one replay-test correction before accepting its determinism claim.** I found no confirmed production defect in the scoped combat changes.

Reviewed all 17 files in `combat-target.patch` against `99749eb12004cabf7d049abeddc2f84a0177d3db`. Patch SHA-256: `1eac61cb3f30d8a288820e08c538434b8f7d6e1e6470a632b150a0096528ce50`. The reviewed paths had no unstaged differences.

1. **COMBAT-R1 — P2: the replay check does not guarantee it covers the corrected hit.**  
   [tests/simulation/attackDamageTypes.test.ts:120](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/simulation/attackDamageTypes.test.ts:120) disables terminal snapshots, and line 124 stops recording immediately after the first hit. The engine’s [session-replayer.js:198](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/node_modules/civ-engine/dist/session-replayer.js:198) checks only adjacent snapshot intervals; it does not check the remaining recorded ticks after the last snapshot.

   **Trigger:** the first hit occurs between five-tick snapshot boundaries. Its final one to four ticks—including damage resolution—then fall outside `selfCheck()`. `checkedSegments > 0` and no skipped segments still pass because earlier intervals were checked. The participant-retention mutation demonstrates useful checkpoint coverage, but does not establish coverage through impact.

   **Impact:** a replay divergence confined to that impact can escape the new test despite its “deterministically replays a corrected commanded hit” claim. This is a coverage defect, not evidence that production replay currently diverges; I did not execute the fixture to establish its present first-hit tick.

   **Required correction:** retain a terminal snapshot or explicitly take a snapshot after impact. Assert that the last checked snapshot reaches the captured first-hit tick.

   **Missing check:** compare replayed target health after that hit with live health, with the hit deliberately occurring off the periodic snapshot boundary.

Coverage and conclusions:

- **Damage and delivery:** inspected the 93-name reference, its retained source rows, runtime classifications and contact/direct/blast callers. The denominator is 87 damaging local unit identities plus six non-damaging identities. The 23 added contact classifications and 12 melee-damage projectile classifications match those source rows. Trebuchets, Turtle Ships and Scorpions correctly remain pierce under this reference.
- **Projectile sourcing:** read all 44 fixture rows against retained JSON whose data and localization hashes match the recorded fixture hashes. Scoped values agree, including CA/HCA rounding to nine ticks, unpacked Trebuchet 42 versus packed 331, and the explicitly bounded Fire Ship exception. The web fetch failed; provenance inspection used those retained bytes.
- **Neighboring roles:** read outside-diff [unitFormation.ts:36](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/unitFormation.ts:36), [formationPlanning.ts:84](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/formationPlanning.ts:84), [prototypeBuildingRules.ts:344](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/prototypeBuildingRules.ts:344) and the actual garrison admission path. I found no introduced formation or garrison regression.
- **Saved shots:** outside-diff [projectileOps.ts:291](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/projectileOps.ts:291) consumes serialized direct-shot `attackType`; [blastDamage.ts:60](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/blastDamage.ts:60) derives blast family from unit type. Both match the declared historical-save boundary.
- **Participant hydration:** the validator matches the actual producer at [unitAttackAnimationFeed.ts:325](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/unitAttackAnimationFeed.ts:325). It preserves both economy booleans, copies only known fields, rejects malformed optional metadata without discarding the cue, and preserves legacy absence. Actual player membership comes from population state; wildlife participation remains absent. I found no additional introduced replay regression through code reading.
- **Architecture and bounds:** every targeted source/test file remains below 500 lines; the feed is 478. Flight speed, damage amounts/bonuses, blast geometry, miss behavior, bursts and broader DE content remain outside this review’s parity conclusion.

No tests, browser sessions, product edits or Git writes were performed. The required `ci:status` command returned UNKNOWN because it could not resolve the commit. Full combined verification and integrated acceptance remain pending. The attempted subagent failed initialization and contributed no review evidence.

### Codex: grounded integrated review

The following authored report is retained verbatim (7,559 bytes, SHA-256 `be99e28df5f06caa61fa09ff177a994a009717629205ae6ad662cd1cc2b41041`). Its findings describe the frozen target before the current docs/layout repairs.

**Verdict: request changes for INTEGRATED-R1.** COMBAT-R1 is repaired. I found no additional material combat, occupation-state, or persistence defect through this review. Two lower-severity documentation/policy findings also remain.

Reviewed base `99749eb12004cabf7d049abeddc2f84a0177d3db`, frozen tree `fcfa79a05a2fd1233ee46d601e01be7660941316`, patch SHA-256 `7c3312c6e097b2bd8501488d18bfbbfb1c3c49aab7761d39974bc683e6fa1791`. All 52 file hashes matched; the index matched the frozen tree. All 27 retained H4 artifacts were present and matched their manifest.

1. **INTEGRATED-R1 — P2: larger resource values overflow the fixed resource chips.**  
   Location: [src/hudChrome.css:113](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/hudChrome.css:113).

   **Trigger:** a stockpile such as `100000` alongside `100` workers. The new nonwrapping readout needs approximately 87px with the shipped font metrics, icon and gaps. Outside the diff, [src/styles.css:191](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/styles.css:191) fixes resource chips at 72px, and [src/hudCommandPanel.css:12](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/hudCommandPanel.css:12) leaves only 52px inside padding and borders. Adjacent chip content starts are 82px apart.

   **Impact:** the expanded grid/flex contents can enter the next resource’s readout. The opening-value screenshots do not cover this state.

   **Correction:** accommodate larger totals and workforce counts within a bounded layout while retaining the bar/menu stability contract.

   **Missing check:** [tests/browser/resource-workers.spec.ts:40](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/browser/resource-workers.spec.ts:40) compares children with their own readout box, which can itself overflow. Check larger values against the containing chip, neighboring chips and actual clipping boundaries. This is a static CSS/font-metric finding; I did not launch a browser to reproduce that state.

2. **INTEGRATED-R2 — P3: replay ownership documentation contradicts the implemented contract.**  
   Location: [docs/changelog.md:9](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/changelog.md:9), also [design/spec-final.md:1842](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/design/spec-final.md:1842).

   **Trigger:** select another replay fog perspective. The changelog promises that perspective player’s counts; the spec paragraph initially says the same, then explicitly says player 1.

   **Impact:** the release description and authoritative paragraph give conflicting expectations. [makeReplayBridge.ts:215](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/replay/makeReplayBridge.ts:215) correctly implements the requested player-1 binding.

   **Correction:** describe player-1 ownership consistently.

   **Missing check:** reconcile these statements with the existing `fogOwner: 2` regression at [resourceWorkerOccupation.test.ts:89](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/replay/resourceWorkerOccupation.test.ts:89). No additional product behavior is needed.

3. **INTEGRATED-R3 — P3: the stylesheet crosses the stated file-size limit.**  
   Location: [src/hudChrome.css:113](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/hudChrome.css:113).

   **Trigger:** the 19 added lines increase this file from 487 to 506 lines.

   **Impact:** the frozen target exceeds the supplied 500-line policy. This does **not** imply that the existing size test fails: [fileSizeBudget.test.ts:33](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/architecture/fileSizeBudget.test.ts:33) scans only TypeScript/TSX/MJS.

   **Correction:** bring the stylesheet within its budget through a coherent organization change.

   **Missing check:** stylesheet coverage in the size-budget mechanism. Its current green result cannot establish compliance for CSS.

**COMBAT-R1 disposition: resolved in the reviewed source.** At [attackDamageTypes.test.ts:119](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/tests/simulation/attackDamageTypes.test.ts:119), the test retains terminal snapshots, requires an off-periodic impact, nonzero checked segments, zero skips, every snapshot interval checked, and an endpoint reaching impact. Removing the terminal endpoint before `openAt(firstHitTick)` forces execution of the final tail and compares target health with live health. Reading the engine’s actual `openAt` and `selfCheck` implementations supports that conclusion. Sixteen combat patch sections remain identical; only this test changed. I carried forward the prior grounded combat coverage rather than repeating its entire census.

**Additional substantive coverage:**

- Traced fresh creation, user-save initialization, replay factories and later spawning. Writers/spawns require marker `=== 1`; replay initialization preserves absence. Counting validates resource kinds before indexing the four-key result.
- Traced explicit/automatic gathering, ordinary movement, queued waypoints/context orders, build/repair/attack, garrison/transport, conversion and death. Outside-diff [monkTaskAppliers.ts:373](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/monkTaskAppliers.ts:373) clears converted workers’ prior orders; [entityDestroyOps.ts:228](C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/src/game/simulation/bridge/entityDestroyOps.ts:228) removes their components.
- Inspected component publication and the engine dirty-tracking path. Unit metadata is cloned; Gatherer alias behavior remains unchanged. No simulation decision reads occupation.
- Inspected the 600-comparison test: it removes only occupation and its marker, compares complete serialized states, and contains no sampling skip. Reviewed the retained cost instrument/results within their declared workload and measurement limits.
- Confirmed the firsthand walking/idle/walking reproduction and staff response, plus active fishing/trade reports, in the [official forum thread](https://forums.ageofempires.com/t/incorrect-villager-counts-in-the-upper-left-if-villagers-are-walking-to-a-location/195310). Unobserved nongather transitions remain explicitly project rules.
- Inspected retained native-resolution after images at all three widths and the 800px before/diff. Opening values are readable; that evidence does not resolve R1. Read the browser flow and its real mouse/lobby helpers.
- Read the roster audit and canonical progress/proof documents. The 56-mainline identity audit and local 93-name coverage remain bounded; neither establishes full DE content parity.

The inherited long-walk replay mismatch remains **OPEN M7**, supported by retained baseline/H4 results, and is not attributed to this patch. Historical combat replay changes and the named projectile fidelity exclusions remain explicit bounds.

No tests, full gates, browsers, edits or Git writes were performed. Initial `ci:status` returned **UNKNOWN** because Git could not resolve the worktree under its ownership check. Full-gate, hosted CI and shipping acceptance remain integration-owned and unverified here. No subagents were launched. The retained Claude final event contained only a waiting/progress message, so it supplies no completed substantive review verdict.

## Findings and disposition

| ID / report ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 / COMBAT-R1 | Periodic recording check could end before impact | Accepted; no new production defect established. Integrated Codex confirms the repaired endpoint/tail health control. | Tests-first endpoint check RED at hit59 versus final55; terminal snapshot and forced55→59 replay health checks passed44 cases. |
| F1 / INTEGRATED-R1 | Large totals/worker counts can escape fixed chips | Accepted, OPEN. Initial native captures have only opening values; source/font-metric review is not an actual browser reproduction. | Presentation prepares bounded large-number layout and chip/neighbor/clipping controls; fresh native diff and integrated review required. |
| F2 / INTEGRATED-R2 | Replay ownership prose initially promised fog perspective | Accepted. Current spec/changelog consistently describe player1 after preserving reviewed bytes. | Existing fogOwner2 regression is the product contract; current docs repair still needs final review/content check. |
| F3 / INTEGRATED-R3 | CSS506 exceeds500 while size test ignores CSS | Accepted, OPEN. A green TS/TSX/MJS size gate cannot prove CSS compliance. | Presentation prepares coherent CSS organization/coverage repair; current source not accepted yet. |
| F4 / gate-attempt1 | Work106 review targets/root handoffs violate strict schema | Accepted docs repair. Authoring omitted the strict layout check before freeze. | Direct contiguous reviews/0_integration.md; authored handoffs/old test under snapshots; immutable reviewed docs preserved before edits and live pointers repaired. |

The legacy long-walk replay position mismatch remains OPEN M7 and is reproduced in both baseline/H4; it is not attributed to this patch. Standard-mainline56 identity coverage, FireShip accuracy exception and historical combat result changes remain bounded as reported.

## Verification

Worker mutation/affected-test and real-control results in the reports/handoffs retain their original targets. The coordinator's earlier combined eight-file affected run passed107 tests after sandbox startup refusal ran no tests. COMBAT-R1 repair passed44 focused tests and one-file lint; integrated Codex confirms its source mechanism. No new review run or product/runtime check was executed by the docs-layout worker.

Full game gate attempt1 ran under the Job Object helper and exited1 after241.217seconds with cleanupProof true and zero leftovers. Content validation passed; Vitest reported five failed files/17 failed tests,557 passed files/4,318 passed tests, one skipped file/three skipped tests. Failures were workDocsIntegration, resourceWorkerOccupation600-state timeout and enemyDefenceRange/gatherHomeRange/villagerGatherAssignment cases. Typecheck, browser, lint and build after the failed test command did not run because verify uses&&. The original WMI/event-trace wrapper launched no workload/rootPIDnull; that did-not-run is not this actual gate failure. Attempt1 logs/results are retained under ignored tmp/parity-106/gate-attempt-1/. A static doc structure/version/reference check of this repair will be recorded in the plan, separately from runtime/full-gate acceptance.

## Round outcome

The docs-only repair check passed the existing static structure/live-pointer/status/Git-attribute validators across 724 documents/577 work files, all 15 immutable reviewed-document digests and coherent package/lock version 0.3.242. That check does not rerun Vitest or establish gameplay/layout acceptance. Reviewed snapshot bytes were not edited to satisfy references; only current authored handoff links and canonical docs were repaired.

Request changes. F0 is resolved by the reviewed repair; F1/F3 and final acceptance remain OPEN. F2/F4 are repaired as authored docs/layout in the current tree, invalidating their former document review coverage and requiring the final integrated review. Claude abstained; no dual-provider acceptance is claimed. This record is the historical first round, not a current status duplicate. The canonical plan owns subsequent repair/gate/review/main/remote outcomes; the whole DE parity goal remains OPEN.
