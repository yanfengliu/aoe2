# Review 1: implementation

## Target

Repository aoe2, branch `projectile-target-generation`, commit `0614439d` ("Take review round 0 of work 114: controls on recycled ids, converted shooters, plainer bounds") against its parent `3dfac0a8`: the repair of round 0's findings, `git diff 3dfac0a8 0614439d`, 731 lines, SHA-256 `cf446e53c987a8eb4345a8b6ae4cb3300e13b8b694ddaa74495241cd59eca43b` over the bytes piped to the reviewer, with round 0's record at `reviews/0_implementation.md` in that commit.

Both commits were rebased onto main `b92b03fa` before this round: round 0's target `2d78480e` became `3dfac0a8`, and the repair `03456534` became `0614439d`. Under `src/` and `tests/`, each rebased commit's diff is byte-identical to the one it replaces (SHA-256 `7e5999d487ebad9f8544cce60cc38e300e93a8dcd5d320123f62b8dc6c552f40` and `5c3c1053a59b5e10439afb597df19f69e3fbbd6cf04b0e7e514cc90fe94a05d8`; stable patch-ids `1a1d3f616da526e91b6e4e9dbc79cb3556c690d3` and `40aa66161421560e9081ead73dac87c6fca276f5`), so the code round 0 reviewed is recoverable as `3dfac0a8`. The rebase changed only documents, where main's work 115 had written beside this work: the changelog, the devlog, the defect register and its archive. Work 115 had already rolled over the building-sight entry this work had moved, so the rebased commit keeps main's move and rolls over the next entry the gate named.

## Reviewers and coverage

- **Claude** CLI 2.1.281, `claude-opus-5-5[1m]`, `--effort max`, with the tools Read, Glob, Grep, Task and `git diff`, `git log` and `git show`. It got the repair diff on stdin, round 0's record, and a focused prompt: does the repair resolve F0 to F8 as their dispositions say, and is anything new wrong. The final `result` event's `modelUsage` names only `claude-opus-5-5[1m]`; it spawned no subagent and took 33 turns. It ran no test, as the prompt required. After it finished, `git status --short` and `git diff --stat` were empty.
- **First attempt, an abstention.** A run of the same prompt on the repair before the rebase stopped at the account's session limit (HTTP 429) after 17 turns and produced no report. It carries no weight here. This round is the rerun.
- **Codex** was not run again. Its round 0 findings were two nits, both repaired here, and the runbook does not add a reviewer to keep a count. Claude raised both should-fix findings, so Claude checked their repair.

## Reports

The report is kept whole. Its `##` headings became `####`, so they sit under its own heading here; nothing else changed.

### Claude (claude-opus-5-5[1m], max)

**Re-review of 0614439d against 3dfac0a8: no blocker and no should-fix.** F0 to F7 are resolved. F8 is fixed in the spec but only partly in the register. The repair changes only comments under `src/`, so the code's behaviour as reviewed in round 0 stands. I ran no tests, as the brief requires, so every mutation count below comes from reading the code. The tree was clean when I finished.

#### F0 to F8

| ID | Verdict | Rests on |
|---|---|---|
| F0 | Resolved | `onRecycledId` (`tests/simulation/projectileNamedEntities.test.ts:106-111`) destroys a throwaway entity, then builds the real one on the freed id, and checks generation > 0 at `:109`. In civ-engine, `destroyEntity` raises the generation and frees the id, and `createEntity` reuses the id freed last (`src/world-entities.ts:28-56`, `src/entity-manager.ts:12-18`). If every stored generation were 0, these go red: the three recycled target controls, the recycled Mangonel control and the recycled animal-turn control. A Mangonel's blast does catch its own owner's units (`projectileRules.ts:176-177`, `blastDamage.ts:126-133`), so the Mangonel control can fail. The generation record (`:178-179`) and the two save cases also go red, which gives the claimed 8. Any other constant fails the fresh controls, which stand at generation 0. The save test puts the target at a generation above 0 and checks it (`projectileGenerationSave.test.ts:56-62`). The new twin checks both the hit points lost and the blow recorded (`:79-86`). Only the target is recycled there; nothing claims the shooter is. **`holdFire` is sound.** With `recycledTarget`, `replaceHouse` runs two steps before `stoneAtHouse` would set the stance. A fight could kill a Villager whose id the foundation would then take, and `stoneAtDeletedHouse.helpers.ts:93` would fail on that rather than let it pass. The second call is harmless. |
| F1 | Resolved (wording nits 2 and 3 below) | `design/spec-final.md:1106` names `SessionReplayer.selfCheck` and `aoe2.projectiles`, which is the real slot key (`bridgeStateSerialize.ts:314`). It calls the divergence the bound and not nondeterminism. `defect-register.md:25` and `changelog.md:7` say it too. Only state can diverge, never events, because `GameEvents` is `Record<string, never>` (`pureHelpers.ts:35`). |
| F2 | Resolved | The spec at `:1106`, `projectileOps.ts:227` and the test label at `projectileNamedEntities.test.ts:281` all say "the shooter's owner". That matches `unit.owner === shot.attackerOwner` at `projectileOps.ts:234`. The uses of "own side" left at `:200` and `:280` describe the blast's teams, which is correct. |
| F3 | Resolved for the animal turn (see nit 4 for the blast) | `projectileNamedEntities.test.ts:295-317` changes the owner in place, as `flipConvertedUnit` does (`monkTaskAppliers.ts:321-322`). For a shot now, the animal turns on the converted shooter, as the spec says. For an old shot, the owner check at `projectileOps.ts:233-234` keeps it from turning. The two cases check each other: if the owner change had no effect, the old-shot case would fail. Mutations M6 and M7 each turn exactly one case red. |
| F4 | Resolved | `projectileTypes.ts:35-36`. The only place in `src/` that reads `shot.targetId` is `projectileOps.ts:276`, through `namedEntity`. That function falls back to the bare id only when the generation is missing (`:217`). |
| F5 | Resolved | `stoneAtDeletedHouse.helpers.ts:94-96` checks that the stone is still in the air after the foundation stands. All four replacements made under a shot pass the shot: `projectileTargetIdentity.test.ts:58`, `projectileGenerationSave.test.ts:92` and `:116`, and `projectileGenerationReplay.test.ts:51`. The fifth call (`projectileGenerationSave.test.ts:58`) runs before the Mangonel's order, when no shot is in the air, so leaving the shot out there is correct. |
| F6 | Resolved | `parthianTactics.test.ts:164-177` and `projectileDestroysBuilding.test.ts:20-32` now go through the `isCurrent` branch (`projectileOps.ts:218`). Their assertions are unchanged, and they would go red if that branch broke. One small error: the devlog (`2026-09-29_2026-09-30.md:384`) says "four stub worlds"; with these two it is six. |
| F7 | Resolved (wording nit 5) | `defect-register.md:20` now states the two expectations separately. It matches the tests at `:268-271` (the blast catches the replacement) and `:291` (the animal never turns on it). |
| F8 | Partly resolved | The spec at `:1106` is right: `damageBuilding` finds building health by id and has no position check (`registerAllSystems.ts:463-466`). The register's symptom paragraph (`defect-register.md:11`) still leaves out the condition (nit 1). |

#### New findings (all nits)

1. **The register's symptom sentence leaves out that the target's kind must match.** `docs/learning/defect-register.md:11`: "a unit or an animal that does is hit if it also stands where the shot lands". Before the fix, a unit that took a dead building's id took nothing from an arrow. `damageBuilding` finds no building health for that id, and the blow is recorded only on a building (`projectileOps.ts:322`). Likewise, a building that took a dead unit's id took nothing. This is the misreading F8 set out to remove.
   - Fix: "A building that takes a dead building's id takes the shot's building damage wherever it stands; a unit that takes a dead unit's id, or an animal a dead animal's, is hit only if it also stands where the shot lands."
2. **"At the first such snapshot" undersells the divergence, and "fails `selfCheck` by design" is unconditional.**
   - Where: `spec-final.md:1106` and `defect-register.md:25`.
   - Why: `selfCheck` replays each segment from its own recorded start snapshot. It keeps going unless `stopOnFirstDivergence` is set (civ-engine `src/session-replayer.ts:314-333`). So it reports a divergence at every snapshot that holds a shot loosed since the snapshot before it. Someone could take the later divergences for real nondeterminism. A recording in which no snapshot catches such a shot passes.
   - Fix: "reports a state divergence in `aoe2.projectiles` at every snapshot that holds a shot loosed since the snapshot before it."
   - The same sentence in `tests/replay/projectileGenerationReplay.test.ts:13-16` (outside the hunks) still has the confusing "the replay generations" wording that F1 removed from the spec.
3. **"Where the original hit an entity that took its target's id" names only one of four ways an old replay can differ.**
   - Where: `spec-final.md:1106`, and the same in `changelog.md:7`.
   - The other three: the original's blast spared a unit that took its shooter's id; an animal turned on such a unit; an animal did not turn on a shooter converted in flight.
   - Fix: "wherever an entity the shot named was replaced, or its shooter converted, during its flight."
4. **The blast half of "whoever owns it by then" has no converted-shooter case.** The spec at `:1106` says the blast spares a converted shooter, but `projectileNamedEntities.test.ts:250-277` has no such case. An owner check added to `projectileOps.ts:288` would pass every test. The behaviour itself is unchanged from before the fix.
   - Fix: add a case in which the Mangonel's owner changes in flight and it stands in its own blast, expecting 100 hit points.
5. **"The shooter and the target on recycled ids" is not true of the two shooter cases.** In those cases only the shooter is recycled: the Mangonel's target is the ground, and the boar is fresh. The test labels already say "a recycled id". Keep the test as it is, because the fresh boar is what lets it catch a mix-up between the two generations.
   - Where: `defect-register.md:20` and the test header at `projectileNamedEntities.test.ts:15-17`.
   - Fix: "with the shooter, and in the target cases the target too, on recycled ids."

**Read outside the diff's hunks:** civ-engine `src/world-entities.ts:28-82`, `src/entity-manager.ts:12-52` and `src/session-replayer.ts:289-426`. In this repo: `src/game/simulation/bridge/blastDamage.ts:108-160`, `src/game/simulation/projectileRules.ts:176-177`, `monkTaskAppliers.ts:314-322`, `registerAllSystems.ts:463-476`, `bridgeStateSerialize.ts:314`, `pureHelpers.ts:35`, `scripts/playtest-self-improve.mjs:129` and `tests/replay/projectileGenerationReplay.test.ts:1-107`.

## Findings and disposition

F0 to F7 are resolved, as the report finds. F8 keeps its round 0 ID for the part still open; the five new nits get new IDs.

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F8 | Claude's verdict on F8, and its nit 1: the register's symptom sentence still left out that the replacement must be of the target's kind; a unit that took a dead building's id took nothing, and a building that took a dead unit's id took nothing. | Accepted. | The register says: a building that takes a dead building's id takes the shot's building damage wherever it stands; a unit that takes a dead unit's id, or an animal a dead animal's, is hit only if it also stands where the shot lands. |
| F9 | Nit 2: `selfCheck` replays every segment and reports a divergence at every snapshot that holds a shot loosed since the one before, not only the first; "fails by design" read as unconditional; the replay test's header kept the old wording. | Accepted. | The spec and the register name every such snapshot and say a recording none of whose snapshots holds such a shot passes; the replay test's header is reworded. |
| F10 | Nit 3: an old replay can differ from the original game in four ways, not only where the original hit an entity that took its target's id. | Accepted. | The spec says wherever an entity the shot named was replaced, or its shooter converted, during its flight; the changelog says wherever something the shot named was replaced in the air. |
| F11 | Nit 4: no test held that a Mangonel converted in flight is still spared its own blast, so an owner check on the blast's exemption would pass. | Accepted. | A case in `projectileNamedEntities.test.ts` converts the Mangonel in its stone's flight and stands it in the blast: it keeps 100 hit points. Mutation M8, an owner check on the exemption: that case red ("expected 78 to be 100"). |
| F12 | Nit 5: in the two shooter cases only the shooter stands on a recycled id, not the target. | Accepted; the test stays as it is, since a fresh target beside a recycled shooter is what catches a mix-up between the two generations. | The register and the test header say "the shooter, and in the target cases the target too, on recycled ids". |
| F13 | Under F6: the devlog said four stub worlds; with the two older suites it is six. | Accepted. | The devlog says six. |

## Verification

On the round 1 repair: `projectileNamedEntities.test.ts` (19 tests) and `tests/replay/projectileGenerationReplay.test.ts` (2) pass, and M8 turns its case red with the source restored byte for byte after. The rebased tree before this repair passed 100 affected test files (928 tests), `tsc --noEmit` and eslint on every changed file; the architecture suite, which holds the register rollover and the work-document checks, passes on the repaired tree. The reviewer ran no check. The full `npm run verify` runs under the gate lock before landing.

## Round outcome

No blocker and no should-fix. F0 to F7 are resolved; the rest of F8 and the five new nits, F9 to F13, are accepted and repaired. The repair adds one test and corrects documents and changes no product code, so neither round's review of the code's behaviour is invalidated and no further round was run.

## Addendum: landed revisions

Added on 2026-10-11 after this round closed, to name where the reviewed code landed; nothing above is changed. For landing, the branch was rebased under the gate lock onto main `04bdd87b` (v0.3.246) and, after one refused push, onto `20f1f4ab`, a docs-only commit. The commits this record names landed as follows: `3dfac0a8` (round 0's target, first `2d78480e`) as `c4775faa`; `0614439d` (this round's target) as `9649746f`; `9bb08b8c` (this round's repair) as `3c060331`; then the release `47cdcf1b`, v0.3.247. Each landed commit's diff under `src/` and `tests/` is byte-identical to the reviewed one: SHA-256 `7e5999d487ebad9f8544cce60cc38e300e93a8dcd5d320123f62b8dc6c552f40`, `5c3c1053a59b5e10439afb597df19f69e3fbbd6cf04b0e7e514cc90fe94a05d8` and `e3609008c97bed0072d933d527f178068890b2e03c2ad108e97597845863166c`. The rebases changed only documents, where works 115, 117 and 119 had written beside this one.
