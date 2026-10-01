# Single-player DE parity: first milestone and remaining queue

Status: active
Owner: Codex orchestrator (/root)
Created: 2026-09-30
Updated: 2026-09-30

## Problem and outcome

The owner appointed an orchestrator to build full Age of Empires II: Definitive Edition parity within the agreed scope and supervise parallel workers. The target is standard Random Map single-player play against the computer that feels and behaves like DE from setup to match completion. Passing existing tests does not establish that target.

Work 106 is the first bounded milestone: correct damage families, projectile accuracy/wind-up and resource workforce counters. Its completion will close those gaps, not the complete parity goal. This plan owns current status. [design/spec-final.md](../../../design/spec-final.md) remains the gameplay contract; [design/roadmap.md](../../../design/roadmap.md) holds the existing backlog.

## Scope

Included in the overall goal: economy, technology, combat/counters, full standard-skirmish civilization content, maps/settings, player control, AI, rendering, one DE-like HUD, original procedural art/audio, save/replay compatibility and realistic-scale performance.

Excluded by the owner: multiplayer and campaigns. Existing spec exclusions also cover ranked/quick-play, scenario scripting, Full Tech Tree mode and non-standard modes such as Regicide, Death Match, Empire Wars, King of the Hill, Wonder Race and Capture the Relic. Save/load and replay are included by spec §15.3; this milestone removes the superseded replay exclusion from §2.3 to make scope consistent.

First-milestone non-goals: flight speeds, projectile looks, blast width/falloff, miss semantics, engine/voxel changes, dependencies, deployment, publication and history rewriting. Missing engine features are recorded after checking current feedback freshness; no sibling product edits are allowed.

Base revision: `99749eb12004cabf7d049abeddc2f84a0177d3db`, version `0.3.241`. Integration owner freshly observed main GREEN: CI `36703284063`, corpus `36703284496`. Content worktree's first `ci:status` returned UNKNOWN because sandbox Git could not resolve the commit; it is not a remote-red result. Node `24.12` matches `.nvmrc` major `24`; civ-engine `2.4.1` matches the current sibling changelog.

## Approach

Source task choices by maintained self-play and real game controls. Reconcile known recorded defects with fresh observations and independent DE data. Keep each milestone within one session, commit/merge verified work to main, and preserve open scope through compaction.

Use three disjoint lanes and one integration owner, all from the stated base in controller-created worktrees. Worker implementation stays in its own tree. Content owns shared canonical docs in the integration tree by assignment. Workers provide changed paths, direct check results, exact evidence, bounds and remaining findings. No worker commits or runs the full gate before acceptance.

| Owner | Scope | Workspace and reserved paths/resources |
|---|---|---|
| `/root` | Scope, integration, acceptance and shipping | `aoe2-worktrees/parity-integration-0930`; Git integration and one serialized full gate |
| `/root/gameplay` | Contact role versus armor damage family and scoped cue hydration | `parity-gameplay-0930`; `prototypeUnitRules.ts`, `prototypeUnitRules/unitClassSets.ts`, `fixtures/attackDamageTypes.ts`, `prototypeScenario/scenarioRegistry.ts`, `bridge/unitAttackAnimationFeed.ts`, dedicated content/simulation and cue-persistence tests |
| `/root/content_tracker` | Accuracy/wind-up source parity and canonical progress/docs | `parity-content-0930`; `units.csv`, only accuracy/wind-up branches in `projectileRules.ts`, dedicated tests; canonical docs in integration tree |
| `/root/presentation` | Resource workforce counters and real-control verification | `parity-presentation-0930`; `types.ts`, bridge/replay `getHudState`, `resourceWorkerCounts.ts`, HUD template/controller/chrome, dedicated tests; browser, unique port and `dist/` |

Gameplay does not edit `units.csv` or `projectileRules.ts`. Content does not edit damage calculation, contact-role tables or presentation paths. Workforce counters follow the official staff's last-gathering-occupation rule for walkers, with additive nullable `UnitComponent.resourceOccupation` for Villagers/Fishing Ships and a version marker; old recordings retain absent keys, and old saved walkers with no recoverable occupation remain uncounted until assigned again. Assignment/clear events publish cloned unit metadata; existing gatherer mutation remains intact for same-tick traffic intent, with no per-tick economy draft. Presentation owns the required gather/order/create/save compatibility paths as well as the HUD. This lane includes high-risk persistence and requires independent integrated review. Captures/builds target stable revisions; full gate starts only when competing heavy work is idle.

Damage save boundary: direct in-flight shots retain their serialized `attackType`; area blasts derive the corrected type from their stored `attackerUnitType`, including already-saved stones. New same-version saves/recordings remain deterministic. Re-executing historical recordings can change combat under the corrected rules; no claim of old combat-result preservation is made.

Both fleet-pinned CLIs were smoke-tested reading `unitDomain.ts`: Codex Astra/xhigh and Claude Opus 5.5/max reported the configured pins. Independent combat reviews are running against staged tree `f55e0d8437cb01c82aa3c45e2790f47cc8a21459`; no review verdict or final integrated acceptance is claimed yet.

## Acceptance criteria

- Each changed rule is sourced and consistent across spec/data/runtime, with tests independent of the table being tested.
- Contact attackers and ranged melee-damage attackers use the correct armor family; projectile launch and visual/contact role remain separate.
- Accuracy/wind-up match pinned DE values for every supported scoped row; tests name whole-tick precision and cover actual launched-shot timing.
- Workforce counters follow verified DE assignment semantics, update through real commands and remain truthful in live play and replay.
- Relevant skirmish/self-play and controls execute without concealed refusal, halt, determinism or save regressions.
- Visual changes have maintained before/after captures and confined pixel diffs, inspected in required styles/viewports/framing states.
- One final combined-tree `npm run verify` passes by direct exit code; independent exact-revision review has no open material findings.
- Canonical spec, provenance, relevant register/gate proofs, devlog, version/changelog and advanced active threads are current.
- Verified work is committed, merged to main and pushed; hosted CI/corpus is followed to completion and task-owned resources/worktrees are safely retired.
- Full parity is claimed only when the remaining in-scope queue is evidenced closed and play satisfies: "can we play this and feel like we're playing DE?"

## Implementation steps

| Todo / milestone | Current state | Owner / dependency and check |
|---|---|---|
| M0: Baseline, isolation and active-task inventory | Remote GREEN observed; audit active | Integration; surviving work and resource audit |
| M1a: Damage families | Locally GREEN; frozen product copied, COMBAT-R1 test repair copied | Gameplay; 148 affected checks, then 44 checks after review required terminal-impact coverage; actual off-boundary hit tick 59 is checked through its terminal endpoint and replayed health |
| M1b: Accuracy/wind-up | Locally GREEN; product frozen and six digests verified in integration | Content; 61 affected checks passed; independently sourced 44-row census corrected 47 CSV fields and 19 runtime rows; source/runtime mutations reproduced RED |
| M1c: Workforce counters | Locally GREEN, frozen and 16 product digests checked in integration | Presentation; 18 final focused checks plus neighboring queued/carry/domain checks, exact 600-tick state equality, 1,500-tick equal-world check, corrected mutation RED and 3 real-control browser checks passed; maintained native before/after/diffs confined to resource chips |
| M1d: Integrate, review, verify, ship | All three lanes copied; combat review and final acceptance active | Integration; 107 earlier combined affected checks passed; COMBAT-R1 coverage correction copied; Claude combat review, final combined review, one full gate and main/push/remote gates remain |
| M2: Remaining combat depth | OPEN; reprioritize after M1 play | Unassigned; blast width/falloff, flight/look, automatic minimum-range targets and AI Trebuchet orders |
| M3: Full DE content normalization | Source audit complete; implementation OPEN | [Roster audit](roster-audit.md) reconciles 56 mainline civilizations, local 30 after Indians→Hindustanis and 26 absent identities; source variants, renamed identities and distinct Chronicles/RoR sets retain explicit bounds |
| M4: Civilization and technology semantics | OPEN / incomplete denominator | Unassigned; all bonus seams, team effects, tech trees and both unique-tech slots |
| M5: Economy/pathing/AI match quality | OPEN; fresh 45k-tick self-play observed | Gameplay; owner 1 stayed Feudal with 23 villager deaths and no static defenses while owner 2 reached Imperial with zero villager deaths; prioritize mobile-raid defense/economy investigation |
| M6: DE world/HUD/control depth | OPEN; de-look plan retained | Presentation investigation; original art, Moebius choice and real-input visual acceptance |
| M7: Maps/settings/performance/save acceptance | OPEN; inherited long-walk replay mismatch reproduced | Both baseline/H4 self-check fail segment 70→140 at `components.position[2205][1].x`, five checked/zero skipped; representative configuration, AI completion, save/replay and cost matrix remain |
| M8: Final whole-game acceptance | Not dispatched | Independent audit after preceding gaps; source census plus start-to-finish play |

Local coverage bound: `rosterCoverage.test.ts` derives 93/93 local unit names, 137/138 local technologies and 25/25 local buildings. Treason is excluded with Regicide. Those are local CSV denominators, not full DE. The current expansion ledger lists 17 missing unique units and 18 missing unique technologies; six implemented unique technologies still lack technology CSV rows. Older prose saying twenty missing technologies is stale.

The [pinned-source roster audit](roster-audit.md) reconciles 56 mainline civilization keys at `3bb43b14` (DE update `185872`) with official expansion evidence, including Danes/Saxons/Varangians. Local 30 identities map to 30 after Indians→Hindustanis; 26 are absent. This measures identities, not complete bonuses or tech trees. Chronicles supports AI skirmish/custom cross-play but uses a distinct civilization set; Return of Rome is a separate game. Their scope distinction is standard-mainline interpretation, not an inference from campaign exclusion, ranked status or `era: base`. Raw availability unions of 248 unit IDs and 199 technology IDs are not normalized logical-roster denominators.

The roadmap's 26/30 active-bonus figure counts only `CIV_BONUSES`. Spanish Blacksmith gold waiver, Burmese free lumber upgrades, Khmer house garrison and Vietnamese range-unit HP already exist in other runtime seams. Those four are not blank, and the other 26 are not proven complete.

Retained legacy work wrappers 97 (lumber routing) and 98 (concurrency) and their owner threads are not closed by this task. Advance/freshen only what this milestone touches. The later de-look owner plan remains the visual backlog. Aggregate repair attempts across lanes: after two failures for one reason reassess; cap automatic substantive repairs at five absent explicit owner override.

## Outcome

Pending. All three product lanes are locally verified, frozen and digest-checked in integration. The integration owner's earlier combined affected run passed 107 checks across eight files; sandbox esbuild startup refusal executed no tests and the elevated retry exited 0. Codex combat review found COMBAT-R1: nonzero periodic self-check could end at tick 55 before the actual hit at 59. The worker's tests-first coverage repair failed before retaining a terminal snapshot, then 44 checks passed with endpoint and re-executed-hit health assertions. Claude's report and final combined review/gate/main/remote acceptance remain pending. Full single-player DE parity remains OPEN.

Full-gate resource supervision readiness remains under work: a WMI helper smoke was unavailable even elevated, so the integration owner is preparing a Job Object alternative. No successful WMI run or completed full gate is inferred from that probe.

Local content acceptance: the pinned source-to-CSV census first reproduced 47 stale fields, and the actual launch census exposed 16 wrong whole-tick delays; Heavy Cavalry Archer hit 404/800 shots against its sourced 80%. The corrected product passed 61 affected tests, direct ESLint and a restored 27-test final check. Reintroducing Heavy Cavalry Archer 50% alone failed both the independent value check and the launched-shot sample; restoring Longboat CSV delay 9 failed the DE-to-CSV check. All mutant source bytes were restored before the six-file freeze and verified integration copy. This establishes the bounded content increment only; exact integrated review, full gate and shipping remain pending.

Material findings during acceptance: a nonvacuous new combat recording exposed pre-existing attack-cue hydration loss of participant metadata, requiring a scoped repair. COMBAT-R1 later found that this check needed explicit coverage through impact, not only an earlier segment. H4 occupation alias mutation could bypass recorded writes, but replacing whole gatherers every economy tick was rejected after exact noncosmetic comparison went RED: detached gatherer state delayed same-tick traffic intent and published 12,521 gatherer writes versus 33 over 1,500 ticks. The accepted Unit metadata route preserves baseline economy state; corrected mutation sensitivity, complete 600-tick equality, save/replay/spawn and visual proof are recorded in [hud-handoff.md](hud-handoff.md). Its 1,500-tick equal-world bound leaves gatherer publications 33→33 and adds 2,885 recording bytes (0.015%). Both arms separately reproduce the inherited long-walk replay mismatch, retained OPEN in M7. No final integrated acceptance is implied.

Next content candidates are bounded in `roster-audit.md`: Onager source ID 550 attack 50→55/pierce armor 7→8 and Ram IDs 1258/422/548 sight 3→5 avoid replacement-tech dependencies. Throwing Axeman source IDs 281/531 range 3/4→5/6 is now independently proven, but obsolete Bearded Axe and its Ordonnance Companies successor require explicit reconciliation with the missing Mounted Crossbowman line. Longship display naming and Indians/Hindustanis need stable legacy identities; Berserk remains separate from the new Varangian Guard. None of these changes belongs to the frozen M1 product.
