# Review 0: implementation

## Target

Repository aoe2, branch `projectile-target-generation`, commit `2d78480e` ("Check a shot's target and shooter by generation (work 114)") against its parent `f906a255`, main when the work was dispatched. The scope is all 23 changed paths: `git diff f906a255 2d78480e`, 1,291 lines, SHA-256 `30f5b657d2035342ae9b53323208f89f709f976060d17fd9ec8a26482ad719b1` over the bytes piped to both reviewers. Both could read the whole worktree at that commit and the engine at civ-engine `707380a`.

## Reviewers and coverage

- **Codex** CLI 0.158.0, `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, approvals off. It got the diff on stdin and the shared prompt, which named five lenses: the completeness of the class, persistence and compatibility, determinism, the tests, and the documents. It was the only Codex review this task ran, and its log holds no `STATUS_DLL_INIT_FAILED` or `-1073741502`. It cited two files outside the diff's hunks, civ-engine `src/world.ts:269` and `src/game/simulation/bridge/garrisonOps.ts:198`; the owner read both, and they say what the report says. It reported no subagent.
- **Claude** CLI 2.1.281, `claude-opus-5-5[1m]`, `--effort max`, with the tools Read, Glob, Grep, Task and `git diff`, `git log` and `git show`; the same diff and prompt. The final `result` event's `modelUsage` names only `claude-opus-5-5[1m]`, so nothing ran on another model. It took 89 turns.
- Both ran at once, with one Codex lane, as the runbook allows. Before the round each pin answered a one-word smoke test. Neither ran a test or a command that writes; the prompt forbade both. After both had finished, `git status --short` and `git diff --stat` were empty, so neither wrote to the tree.

## Reports

Both reports are kept whole. Two edits were made, and neither changes a finding or a reason. The Codex report's links to absolute paths on this machine became the repository-relative path in a code span, which removes the local user directory. The Claude report's `##` headings became `####`, so they sit under its own heading here.

### Codex (gpt-6-astra, xhigh)

Reviewed **2d78480e against f906a255**. **No material correctness, persistence, or determinism findings.**

The generation checks cover direct building/unit/animal hits, shooter splash immunity, and animal retaliation. Ground shots still blast; building shooters remain valid; conversion preserves identity; garrisoned targets lack the position required for a hit. Same-tick ID reuse is rejected at impact. Legacy shots retain the documented behavior.

Serialization preserves the fields and their absence. Outside the diff, I checked World.deserialize at line 269 (`../civ-engine/src/world.ts:269`), which clones state unchanged, and garrisonOps.ts:198 (`src/game/simulation/bridge/garrisonOps.ts:198`), which removes position without destroying identity. Replay factory guards remain active despite the registration-check exemption.

Two **nits**:

- **Missing conversion regression case:** projectileNamedEntities.test.ts:245 (`tests/simulation/projectileNamedEntities.test.ts:245`) tests unchanged and replaced shooters, but never a converted shooter. Reintroducing an owner check alongside the generation check would pass these cases while violating the new spec. Add a case changing ownership without destroying the shooter: a modern shot should still provoke retaliation against it; a legacy shot should retain its owner check.
- **Inaccurate test description:** defect-register.md:20 (`docs/learning/defect-register.md:20`) says every replacement “must take nothing,” including the shooter replacement. That replacement should **take blast damage**. Separate the target-replacement and shooter-replacement expectations.

The new tests use real engine ID reuse and meaningful controls; existing test edits preserve their assertions. Historical replay coverage is explicitly synthetic and bounded.

No files changed or tests run. Reported green runs, mutation results, and test-first chronology were not independently reproduced.

### Claude (claude-opus-5-5[1m], max)

**Review of 2d78480e against f906a255: no blocker.** The fix is correct and covers the whole class inside `resolveOne`. Saves and recordings keep the new fields intact. There are two should-fix items (a test gap and a docs gap) and five nits. As the brief says, I ran no tests. Everything below comes from reading the code at 2d78480e and civ-engine at 707380a. I also checked that the installed civ-engine dist has the same `create` and `isCurrent`.

#### Findings

**1. Should-fix (tests): nothing guards against the opposite failure, a shot that should land but doesn't.**
- **Where:**
  - In `tests/simulation/projectileNamedEntities.test.ts:43-64,157-260`, every control uses a fresh `World` with nothing destroyed before the launch. So every real target and shooter is generation 0.
  - The fixture scenes are almost certainly generation 0 too: `buildingShotLanding.ts` creates its entities and destroys none before the stone flies.
  - `projectileGenerationSave.test.ts:60-70` and `tests/replay/projectileGenerationReplay.test.ts:68-82` only check the negative case (the foundation is spared).
- **Why it matters:**
  - `generationAtLaunch` (`projectileOps.ts:108-110`) could return a constant 0, and every new test would stay green.
  - In a real match, most entities sit on recycled ids once the first units die or trees fall. They would never be hit by a shot.
  - A Mangonel on a recycled id would also stop being spared its own blast.
  - No test shows a loaded stone that carries generations still landing on a House that survives. Only the stripped legacy save checks that (`:73-83`).
- **Fix:**
  - In `projectileNamedEntities`, add controls where the target (unit, building, animal) and the shooter sit on a recycled id. Destroy a throwaway entity, create the real one into its id, assert generation 1, shoot, then assert the hit lands or the Mangonel is spared.
  - In the save test, add the modern twin of `:73-83`: load the save unmodified, land the stone, and assert the House loses hit points.
  - Show both go red with `generationAtLaunch` hard-wired to 0.

**2. Should-fix (docs): recordings made before this change now fail `selfCheck` by design, and nothing says so plainly.**
- **Where:** `design/spec-final.md:1104` ("gives the shots loosed during the replay generations that its later snapshots lack"), `docs/learning/defect-register.md:25` (Bounds), and `docs/changelog.md:7`.
- **Why it matters:**
  - civ-engine's `selfCheck` compares key counts (`civ-engine/src/session-deep-equal.ts:31-35`, called from `session-replayer.ts:417-425`).
  - In an old recording, any shot loosed during a segment and still in the air at its end snapshot has two extra keys. That segment reports a state divergence in `aoe2.projectiles.inFlight[n]`.
  - AGENTS.md says to run `selfCheck` before trusting a bundle, so this will look like nondeterminism.
  - The spec sentence reads as if "the replay generations" were a noun, and never names `selfCheck`. The register's Bounds covers saves only.
  - The changelog says nothing about old replays, although its own 0.3.243 entry (line 11) does for the same kind of change.
- **Fix:**
  - Spec and register: "Re-simulating a recording made before vNEXT gives every shot loosed during the replay both generations, which its later snapshots lack, so `SessionReplayer.selfCheck` reports a state divergence in `aoe2.projectiles` at the first such snapshot. That is this bound, not nondeterminism."
  - Changelog: "A replay recorded before this version can resolve such a shot differently from the original game."

**3. Nit: "own side" should say "owner".**
- **Where:** `spec-final.md:1104` (the bound: "a unit of the shooter's own side") and `projectileOps.ts:227`.
- **Why:** the legacy check is `unit.owner === shot.attackerOwner` (`:234`), which is one player. Elsewhere "own side" means the owner plus allies (`blastDamage.ts:103-105,133`).
- **Fix:** write "of the shooter's owner".

**4. Nit: the rule "whoever owns it by then" has no test.**
- **Where:** `spec-final.md:1104`, `projectileOps.ts:236-237`.
- **Why:** an animal hurt by a shooter that a Monk converted mid-flight now turns on that shooter. Before this change the owner check said no. Adding `&& unit.owner === shot.attackerOwner` to the new branch would pass every test.
- **Fix:** add one case to the animal-turn tests: flip the archer's owner mid-flight and expect the boar to turn on it. Optionally mention the change in the changelog.

**5. Nit: a comment overclaims.**
- **Where:** `projectileTypes.ts:35-36`.
- **Why:** "Never acted on alone" is false for a shot with no generations; `namedEntity` returns the bare id (`projectileOps.ts:217`).
- **Fix:** say it is acted on alone only on a shot from before generations.

**6. Nit: two new tests could pass without testing anything.**
- **Where:** `projectileGenerationSave.test.ts:60-70` and the replay test at `:68-82`.
- **Why:** neither asserts the stone is still in the air when the foundation appears, as `projectileTargetIdentity.test.ts:60` does. The devlog's mutation runs show they are meaningful today, but a shorter flight time would make them pass by default.
- **Fix:** add that premise line to both.

**7. Nit: two older suites now exercise only the legacy branch.**
- **Where:** `tests/simulation/parthianTactics.test.ts:163-170` and `projectileDestroysBuilding.test.ts:20-27`.
- **Why:** they push hand-built shots with no generation fields into stub worlds that have no `isCurrent`. The damage code they guard is shared, so nothing is lost today.
- **Fix:** give their shots generation 0 and the stubs an `isCurrent`, so they follow the path live shots take.
- **Devlog count:** the devlog says six test call sites and stub worlds changed. I count eight: four launch calls and four stub-world members.

#### Checked and sound
These rest on files outside the diff hunks.
- **The whole class is covered.**
  - The only other readers of a shot's ids are rendering (`projectileProjection.ts:72-106`, no target id) and the attack-warning feed.
  - The feed's `attackerId` is read by nothing in `src/` except the bridge accessors, so it is display only.
  - Attack orders already name their target with a generation-checked reference (`sharedTypes.ts:33`), so the Mangonel does not re-target the foundation.
  - `damageBuilding` (`registerAllSystems.ts:463-476`) has no position check, so the old defect could reach a building anywhere on the map. It is now fixed.
- **Edge cases:**
  - A ground shot's id -1 is never current (`entity-manager.ts:54-56`).
  - A building shooter gets null from `shooterRef` and never fires an area shot.
  - Conversion (`monkTaskAppliers.ts:314-322`), garrisoning (`transformOps.ts:247-254`), upgrades (`technologyUnitSweeps.ts:53`) and finishing construction (`entityCreateOps.ts:249-321`) all keep the same entity, so the new check never misses a real target.
  - Reuse within the same tick, or within one resolve pass, is covered. For example, relics dropped by a destroyed Monastery (`entityDestroyOps.ts:377-380`) take freed ids during the projectile pass.
  - Area shots at a building, a unit, the ground or an animal behave as the spec says.
  - The refactor of `resolveOne` behaves exactly as the old code did when the target is still the same entity.
- **Persistence:**
  - Save loads and replay worlds both go through `World.deserialize` (`createWorld.ts:99-100`, `createReplayWorldOnly.ts:14-27`), which restores entity generations and the free list (`world.ts:142,204`).
  - The codec and the accessor's `structuredClone` keep the new fields. No hydrate file, validator or migration touches the projectile slot.
  - The replayer guard only counts top-level state keys (`session-replayer-guards.ts:96-98`).
- **Determinism:** generations are read from restored entity state, so live play, a loaded save and a replay all agree. Old shots stay bare-id through any number of save and load cycles.
- **Tests:** each new case fails with the defect present, for the stated reason. The edits to existing tests only add the new launch and resolve parameters and weaken nothing.
- **Docs:**
  - "75 of its 90 hit points" checks out: a foundation starts at 10% of the House's 900 (`constructionHealth.ts:21-23`), and a Mangonel does 40 plus 35 against buildings.
  - The moved register entry matches the original byte for byte, blank lines aside.
  - The cited commits e25e1454 and 7e3d206f exist with the dates given.

#### Acceptance status at this revision
- **Met:** the reproduction test (by reading the code and the devlog's mutation runs); old saves and recordings loading within the stated bound; the data round trip of a new save; the register entry, the spec rule and the changelog line.
- **Partly met:** a loaded new shot actually landing on a target that still exists is not tested (finding 1).
- **Still open:**
  - The version bump (`plan.md:31`; a player could see the foundation take the hit).
  - Replacing "vNEXT" and "Unreleased — work 114" (spec line 1104 three times, register line 9, devlog summary line 2, the detailed devlog, changelog line 5). Nothing checks this, so search for them at landing.
  - The full `npm run verify` under the gate lock, and the merge.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Claude 1, should-fix: every control stood at generation 0, so a shot that stored a constant generation would pass every test, and no test showed a loaded stone that carries generations still landing on a target that survives. | Accepted. Most entities in a match under way stand on recycled ids, so this is the direction a broken launch would fail in play. | `projectileNamedEntities.test.ts` gains a control on recycled ids for every case (`onRecycledId`). The save test puts the stone's target on a recycled id for the round trip, and adds the twin in which the loaded stone lands on it. Mutation M5, `generationAtLaunch` storing 0 for every live entity: 8 red (the five recycled controls, the generation record and both recycled save cases). |
| F1 | Claude 2, should-fix: a recording made before the change now fails `selfCheck` by design, and nothing said so. | Accepted. A divergence nobody explains reads as nondeterminism. | The bound in spec §10.4, the register entry's Bounds and the changelog say it plainly; the changelog also says an old replay can resolve a shot differently from the original game. |
| F2 | Claude 3, nit: "own side" described an owner check, where "own side" means the owner and its allies elsewhere. | Accepted. | The spec's bound and the `shooterRef` comment say "the shooter's owner". |
| F3 | Claude 4 and Codex's first nit: no test held that an animal still turns on a shooter a Monk converted in flight, so an owner check added to the generation path would pass. | Accepted. | Two cases: a shot now still turns the animal on its converted shooter, and an old shot keeps its owner check. Mutation M6 (an owner check on the generation path) and M7 (the old path without its owner check): 1 red each. |
| F4 | Claude 5, nit: the `targetId` comment said it is never acted on alone, which is false for an old shot. | Accepted. | The comment names the old-shot exception. |
| F5 | Claude 6, nit: the save and replay tests did not hold that the stone is still in the air when the foundation stands, so a shorter flight could let them pass by default. | Accepted. | `replaceHouse` takes the shot and holds that premise for every replacement under a shot: the live scene, both save cases and the recording. |
| F6 | Claude 7, nit: `parthianTactics.test.ts` and `projectileDestroysBuilding.test.ts` built shots without generations, so they took only the old path; and the devlog miscounted the edited call sites. | Accepted. | Their shots carry generation 0 and their stub worlds answer `isCurrent`; the devlog gives the counts. |
| F7 | Codex's second nit: the register said every replacement must take nothing, but the unit that replaced the shooter must be caught by the blast. | Accepted. | The register entry states the two expectations apart. |
| F8 | The owner, while the round ran: the register's symptom sentence said a new unit at a Town Centre's door could take a shot meant for a building. A shot at a building hits only a building, but one anywhere on the map. | Accepted. | The symptom sentence and the spec say it that way. |

## Verification

On the repair, with the source restored byte for byte after every mutation: the four new test files (28 tests) and the two older suites F6 touched pass; mutations M1 (the target by bare id: 6 red), M2 (the blast sparing the shooter's bare id: 1), M3 (the shooter by owner: 2), M4 (a codec that drops the fields on load: 3), M5 (8), M6 (1) and M7 (1) each turn red the cases named above. On the repaired tree, 98 affected test files pass, 923 tests: the combat, save and command files, the whole `tests/replay` and `tests/architecture` directories and the new files. `tsc --noEmit` exits 0, and eslint exits 0 on the 18 changed source and test files. Neither reviewer ran a check. The full `npm run verify` has not run yet; it runs under the gate lock before landing.

## Round outcome

No blocker. Both should-fix findings and all seven nits, one of them the owner's, were accepted and repaired. The repair adds tests and corrects comments and documents, and changes no product behaviour, so the reviewed behaviour of the code stands; round 1 is a focused re-review of the repair against F0 to F8.
