# Review 1: implementation

## Target

Repository aoe2, commit `ff9cfa40` ("Repair the conversion exception after review round 0 (work 116)") on branch `fog-memory-own-buildings`, against its parent `8be8f306`, which round 0 reviewed. Scope: the repair of round 0's findings in `src/game/simulation/bridge/systems/fogMemorySystem.ts`; the split gate (`tests/simulation/fogMemoryOwnBuildings.test.ts`, the new `fogMemoryOwnBuildingConversion.test.ts` and `fogMemoryOwnBuildings.helpers.ts`); `design/spec-final.md` (the §12.1 bullet and a new paragraph after §10.9's); `docs/changelog.md`; `docs/learning/defect-register.md`; this work's `plan.md` and `reviews/0_implementation.md`; and the devlog. Each reviewer received `git diff 8be8f306..ff9cfa40` (1,046 lines, sha256 `41382850b14ecfd25119f0be23a6ea91fe66f753f0ae5fbae59a67834a5e435a`) on stdin, with round 0's record in the tree to read first. The worktree did not change while they ran. Phase 2 rebases the branch, so the landed commits carry new hashes; the diff digest identifies the reviewed change.

## Reviewers and coverage

- **Codex**, `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.158.0, `--sandbox read-only --ephemeral`, `-o` capture; exit 0, 7,304-byte report. Its stdout has two matches for `STATUS_DLL_INIT_FAILED` and `-1073741502`. Both are the echoed text of round 0's record (diff line 213, and the same text where it later read the file), not a sandbox failure. It cites files and lines outside the diff; the author spot-checked `unitCommandOps.ts:230` (a move order deletes the Monk's task and leaves `aoe2.conversionState`, as cited).
- **Claude**, `claude-opus-5-5[1m]` at `--effort max`, Claude Code 2.1.281, the same `--allowedTools` as round 0, stream-json; exit 0, `result/success` after 64 turns and 38 minutes. The result event's `modelUsage` holds exactly one key, `claude-opus-5-5[1m]`. It dispatched no subagent. It ran 63 shell commands (grep 29, `sed -n` 15, cat 7, git 2 and a few others); a scan found none that writes, and `git status` afterwards showed a clean tree.
- The brief asked each to say whether round 0's F0, F1 and F2 are fixed, to test rules (a)-(d) of the repaired rule for correctness and determinism, and to judge the tests. Neither ran anything.

## Reports

Both reports are reproduced as written. The Claude report's headings were lowered two levels to sit inside this record; no other change.

### Codex (gpt-6-astra, xhigh)

1. MED — Resuming an almost-finished conversion can make the building disappear.
   
   `src/game/simulation/bridge/systems/fogMemorySystem.ts:126` drops memory when the Monk is recalled. However, the move path deletes only the task (`src/game/simulation/bridge/unitCommandOps.ts:230`), leaving conversion progress intact. `src/game/simulation/bridge/monkBuildingConversion.ts:108` reuses that progress.

   Reach progress 49, recall the Monk for one tick, then order conversion again while still in range. The next Monk pass flips ownership and clears the task before fog memory runs. The building has neither an owned-memory entry nor human sight, so line 145 cannot rescue it. Round 0’s implementation retained the entry during the interruption and therefore handled this particular sequence.

   Suggested fix: capture the required memory at the ownership transition, rather than requiring an earlier fog pass. Add a near-complete conversion → recall → resume case. The recall test at `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:114` stops before resuming.

2. MED — Projectile deaths still leave an owned-building ghost, permanently if the death ends the match.
   
   The new cleanup at `src/game/simulation/bridge/systems/fogMemorySystem.ts:216` runs before projectile resolution. Registration places fog memory at `src/game/simulation/bridge/registerAllSystems.ts:428` and projectiles at line 460. Projectile deaths then refresh visibility (`src/game/simulation/bridge/systems/projectileSystem.ts:94`) without rerunning memory cleanup.

   Consequently, a projectile that destroys an owned building during conversion leaves its remembered entry after its sight disappears. Normally the next tick clears it. If that was the human’s last entity, conquest ends the match (`src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:91`) and further bridge steps are refused (`src/game/simulation/createSimulationBridge.ts:304`), leaving the ghost indefinitely.

   Suggested fix: clear matching owned memory at destruction, or perform appropriate cleanup after all damage systems and before output. Test the render state on the actual death tick, including a match-ending death. The new deletion test at `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:99` exercises command-time deletion and waits three ticks.

3. MED — Legacy owner-1 memories reveal hidden changes or erase legitimate converted-building ghosts.
   
   `src/game/simulation/bridge/systems/fogMemorySystem.ts:145` assumes an owner-1 entry identifies a conversion that just happened. Older builds also leave owner-1 entries indefinitely after conversion out of sight; the reviewed parent does exactly that.

   Load an older save where such a building was subsequently repaired, upgraded, or converted again without human sight. Line 149 copies its current hidden appearance and ownership into memory. If it was instead destroyed before saving, line 216 deletes its ghost immediately, revealing its unseen disappearance.

   These branches implement the literal predicates (c)/(d), but the predicates do not establish the claimed “saw it change hands” history. `src/game/simulation/bridge/memoryTypes.ts:9` contains no transition provenance capable of distinguishing these cases.

   Suggested fix: record actual ownership transitions for new play and define conservative handling for ambiguous legacy entries. Add old-save cases for a converted-away building that remains alive with changed appearance, and one destroyed unseen. The synthetic lost House at `tests/simulation/fogMemoryOwnBuildings.test.ts:160` represents only “destroyed while ours.”

4. LOW — The new tests do not establish the claimed save/replay repair.
   
   `tests/simulation/fogMemoryOwnBuildings.helpers.ts:107` loads the staged world before issuing any conversion task. The recycled-ID test at `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:126` checks one live world; it never reloads or replays it. Neither verifies restored active tasks or compares continued live play against a replay checkpoint.

   Suggested fix: compare the persisted memory slot across uninterrupted play, save/load, and replay through active conversion, cancellation/resumption, and target destruction/reuse. Require actual checked replay segments.

Round 0 disposition:

- F0: Fixed for an ordinary uninterrupted unseen-foundation conversion. The bypass at `fogMemorySystem.ts:118` and the foundation test at `fogMemoryOwnBuildingConversion.test.ts:80` address the original failure. Finding 1 is an additional conversion path.
- F1: Partially fixed. Command-time deletion and old owned ghosts are handled, including first-tick deletion of a restored owned entry. Projectile timing remains broken; combat death during conversion and deletion immediately after loading are not directly tested.
- F2: The direct stale-key exemption is fixed. Target generations are checked, human-owned converters are excluded, and `conversionState` no longer controls the exemption. Recall and stale-ID tests cover those narrow claims. Overall closure remains incomplete because of finding 1 and absent save/replay coverage.

Other inspection results:

- Multiple valid enemy tasks combine correctly through the set. Normal Monk destruction removes its task (`src/game/simulation/bridge/entityDestroyOps.ts:221`); the Monk system also removes tasks for missing, non-monastic, or positionless units before fog memory (`src/game/simulation/bridge/systems/monkBehaviorSystem.ts:143`). No additional exemption defect found for ordinary death or garrisoning.
- Shared sight still uses the normal visibility refresh. Vietnamese reveal records other owners (`src/game/simulation/bridge/vietnameseReveal.ts:48`), so its entries do not independently trigger the owner-1 shortcut. Generation checks prevent that shortcut from matching a recycled target.
- In the ordinary completed conversion, memory changes to the new owner before projectile resolution, so subsequent unseen destruction preserves the ghost.
- Added work is linear in Monk tasks, plus constant-time checks per building. Dirty marking and output flushing remain coherent.
- Save editing establishes useful ownership, sight, and technology premises, but leaves population bookkeeping inconsistent. The bare entities created inside `runMaintenance` exercise memory-map behavior, not full building lifecycle or live render deduplication. Those bounds are mostly documented.
- The generationless-save arm removes the generation from a visible Town Center (`tests/simulation/fogMemoryOwnBuildings.test.ts:184`); the pre-existing visibility cleanup could also remove it. An unseen generationless foundation would better gate the repaired behavior.

Questions not settled:

- Which migration policy should apply when an old owner-1 ghost cannot distinguish “destroyed while ours” from “converted away, then destroyed unseen”? The existing saved fields cannot satisfy both guarantees.
- Does Definitive Edition show the new owner’s appearance after an unseen conversion?
- Do restored conversion tasks and conversion-boundary replay checkpoints remain equivalent dynamically?

Outside-diff files cited above were read directly. No files were changed, and no tests or builds were run.

### Claude (claude-opus-5-5[1m], max)

#### Findings

##### 1. LOW: an interrupted conversion's saved progress can flip the building before any fog pass sees the new order, so the building vanishes

- **Where:**
  - `src/game/simulation/bridge/systems/fogMemorySystem.ts:93-103`: the exception comes only from Monk orders. The comment says it "follows the conversion and nothing older".
  - `fogMemorySystem.ts:133-148`: rule (c) needs a held entry.
- **Outside the diff:**
  - `unitCommandOps.ts:230-233`: a move order deletes the Monk's order but leaves `aoe2.conversionState`.
  - `monkBuildingConversion.ts:108,114-117`: a new attempt by the same owner resumes the saved progress. Only a change of owner resets it.
  - `monkBuildingConversion.ts:130-134,197`: the flip and its `clearMonkTask` happen in the same call.
  - `civ-engine/src/world-tick.ts:133-144`: order handlers run before systems.
- **Sequence:**
  1. An enemy Monk reaches progress 49 of 50 (`bridgeConstants.ts:56-57`) on a House of the player's.
  2. A `unit.move` deletes the Monk's order and keeps the progress. That tick's fog pass drops the House's entry under rule (a).
  3. On a later tick the Monk is still within range 9, and its faith is full, because faith is spent only at a flip (`monkBuildingConversion.ts:97-99,132`). A `monk.contextAtEntity` convert sets the order during command processing.
  4. In the same tick the Monk system adds 1, flips the House and clears the order.
  5. The fog pass finds no order, an owner-2 House, no held entry and unseen ground, so it skips the House. Nothing is drawn.
- **Why it matters:**
  - The repair rests on "the flip finds an entry". The premise at `plan.md:40` ("A conversion takes at least 50 ticks … so the entry exists before the flip") holds only for a fresh attempt.
  - `design/spec-final.md:1514` and `docs/changelog.md:7` promise the building stays on the map.
  - For this case it is a regression against both main and `8be8f306`. Both kept the finished House's entry through the interruption, because the `conversionState` key survived it, and drew it in the player's colours. It is F0's outcome by another route.
  - It is dormant against the AI, which never converts. An agent seat, or this file's staging, can reach it.
  - F10's stale entries give a second route: a building that takes a razed target's id inherits that target's progress.
- **Fix:**
  - The cheapest honest step is to state the gap in the code comment, `plan.md` Decisions, spec §12.1 and the changelog. Then add one question to the F10 card: should a cleared order keep its progress?
  - Code option one: `flipConvertedBuilding` notes "flipped away from the player this tick" in state that lives only within the tick, as `monkConvertProcessedThisTick` does, and the fog pass writes the entry. This is replay-safe because the state is filled and read in one tick, but it touches a file outside this card.
  - Code option two: after F10 deletes stale entries, also exempt the player's buildings whose `conversionState` entry names an enemy. Remembering a standing building of the player's too often is never drawn, and (c) and (d) already handle the flip and the loss. Doing this before F10 brings back F2's live-against-replay hazard.
- **Test:** stage as in "forgets the building once the enemy Monk is called away". Step until the saved progress is 49, call the Monk away, order it back, and step once. Expect `[{ isMemory: true, owner: 2 }]`; the code returns `[]` today.

##### 2. LOW (test coverage): several things the repair relies on are not pinned

- **Two filters no test needs.** Deleting either the target-identity check or the Monk-owner check at `fogMemorySystem.ts:100-102` leaves all eleven cases green.
  - The razed-target case (`fogMemoryOwnBuildingConversion.test.ts:126-157`) uses the player's own Monk. Its order also names a dead generation, so either filter alone rejects it.
  - The Monk system also deletes orders whose target is gone before the fog pass runs (`monkBehaviorSystem.ts:148-152`).
  - Both filters are defence in depth. Say so, or add an enemy Monk whose target's id is recycled.
- **Rule (c)'s purpose is untested.** No case converts a building away and then destroys it out of the player's sight. That is the case (c) exists to protect from (d) (`plan.md:50`); M8 shows only the colours.
- **Only the Delete key is driven.** No raze, projectile or tower kill of an exempted building is driven (`:99-112` uses Delete only), so finding 3's window is untested.
- **No save/load or replay run.** No save/load or recorded replay (`selfCheck`) runs through an active exception.
- **The recycled-id case's new half overstates what it shows.**
  - `fogMemoryOwnBuildings.test.ts:239-244` cannot show what its comment says ("Once the player's House is gone too").
  - Its own header (`:208-211`) says the render store never knew the bare House, so the ghost was drawable before the second destroy too.
  - What it does pin is that (d) spares an owner-2 entry. Reword the comment, and round 0's F4 disposition, which repeats it.
- **"Razed" is a raw destroy.** `fogMemoryOwnBuildingConversion.test.ts:141-151` calls a raw `destroyEntity` "razed".
  - A real raze clears every side map except `aoe2.conversionState`, so the premise holds.
  - The bare House, though, inherits the dead House's construction, health and queue entries. That is harmless to what the test asserts; say "destroyed raw".

##### 3. NIT: a ghost still shows for one tick, and an older save's ghosts show until the first tick

- **One tick after a kill:**
  - Rule (d) runs in the fog pass, which comes before tower combat and projectiles (`registerAllSystems.ts:428,436,460`).
  - An exempted building killed by an arrow or a tower at tick T keeps its owner-1 entry through T's render. `refreshVisibilityAfterCombat` has already removed its sight.
  - So it is drawn dimmed for one tick, and on the minimap, until T+1 forgets it.
- **Older saves:**
  - An older save's ghost of a lost building is drawn until the first tick runs.
  - In a loaded match that has already ended it is drawn forever, because such a match never steps.
  - Round 0's F9 disposition ("those buildings are live") covers only standing buildings, not the ghosts this repair now promises to drop.
- **Fix:** in `getFogMemoryEntities` (`fogMemoryOps.ts:83-86`), skip building entries recorded as the player's whose entity is not current. That file is not this card's. Otherwise reword "the moment it goes" to "on the next tick".

##### 4. NIT: rule (c)'s stated reason is false for an unstarted foundation

- **The contradiction:** `fogMemorySystem.ts:142-145` and `plan.md:50` justify the refresh with "its own sight, up to the flip". The same `plan.md:50` bullet says "an unstarted foundation sees nothing".
- **What the player is shown that it never saw:**
  - For the F0 foundation, the refresh draws the converter's colour, its architecture and its look at the flip.
  - With three or more players, that also tells the player which enemy took it.
  - The same is true for a finished House whose sight does not reach a Monk standing at range 9.
- **Fix:** the spec already marks Definitive Edition's behaviour as unverified. The comment and the spec's "as the player saw it change hands" should call this a chosen rule.

##### 5. NIT: older saves that hold a conversion from before vNEXT

- **Where:** `design/spec-final.md:1514` and `docs/changelog.md:7` say these saves' entries for the player's buildings are dropped.
- **What actually happens:**
  - Main kept an entry naming player 1 for a building an enemy converted out of the player's sight.
  - On load, rule (c) refreshes that entry once, to the building's look at load time, not at the flip.
  - If the building was destroyed before the save, rule (d) erases a ghost the new rule would keep. The player saw it change hands, not die.
- **Reach:** this needs an enemy that converts buildings (shipped in 0.3.100 on 2026-08-25; the AI never does). Entries without a generation cannot be involved, because building conversion shipped after those saves.
- **Fix:** correct the spec and changelog wording; no code change.

##### 6. NIT: documentation

- `design/spec-final.md:1514` says an entry held under a recycled id "for a different, destroyed building" is kept. That is false when the destroyed building was the player's, because (d) drops it (`fogMemorySystem.ts:216-219`). Say "another player's".
- The new devlog Evidence paragraph (`docs/devlog/detailed/2026-09-29_2026-09-30.md:358`) and `docs/devlog/summary.md:2` present the interleaved A/B as this change's.
  - It was measured on `8be8f306`.
  - The repair adds per-tick work: a pass over the Monk orders, plus a generation read and a map lookup for every building.
  - `plan.md` says the A/B was not re-run; the devlog should say so too.
- `docs/devlog/summary.md` now holds 51 entries; AGENTS.md says to compact past 50.

##### 7. NIT: the exception's entry now comes and goes with the order

- **Where:** `fogMemorySystem.ts:98-103`.
- **What happens:**
  - An order that flickers writes and drops the entry each time. An example is an order deleted for lack of a path (`monkBehaviorSystem.ts:185-192`) and then issued again.
  - Each change re-serialises the whole slot into that tick's replay diff, which is the cost `:54-59` warns about.
  - `8be8f306`'s key stayed steady through that.
- **Reach:** dormant, because nothing converts buildings today.

#### Outside the diff (existed before this change; for the coordinator)

- **Converting a foundation miscounts population.**
  - `monkBuildingConversion.ts:155-174` moves population supply on a flip without checking `construction.isComplete`.
  - `finalizeBuildingConstruction.ts:97-105` adds the supply again when the building finishes.
  - So converting a foundation takes 5 supply from a player that never had it, and the converter gets it twice.
  - The new foundation test exercises this path but asserts only fog memory.
- **F10 is wider than one slot.**
  - `conversionState` is keyed by the bare id (`monkBuildingConversion.ts:108`). It survives a Monk being called away (`unitCommandOps.ts:230-233`) and a razed target (`entityDestroyOps.ts:232-379`).
  - So a later attempt resumes the saved progress, even on a different building that took the id.
  - Live play does this. A replay loaded in between does not, because `hydrateFromWorldState.ts:169-170` prunes the entry.
  - The two can therefore disagree on who owns a building, and finding 1 depends on the same behaviour.

#### Round 0

- **F0: fixed.** `fogMemorySystem.ts:118-132` remembers an exempted building without asking whether it is seen. The proof is `fogMemoryOwnBuildingConversion.test.ts:80-97` under M6. Running main's code (M1) does not prove it, because that case passes on main by coincidence.
- **F1: fixed.**
  - The fix is `fogMemorySystem.ts:212-220`, held under M7 by `:99-112` and `fogMemoryOwnBuildings.test.ts:160-201`.
  - A delete on the first tick after a load takes the same branch.
  - What remains: finding 3, and no raze or projectile kill is tested in this context.
- **F2: fixed for what it named.**
  - `aoe2.conversionState` is no longer read, and the target is matched by its EntityRef.
  - Pruning orders on load (`hydrateFromSavedGame.ts:76-80,165-171`, `hydrateFromWorldState.ts:169`) agrees with live play at the fog pass. The Monk system deletes orders of dead, garrisoned (`transformOps.ts:253`) or non-Monk units, and orders whose target is gone, earlier in the same tick (`monkBehaviorSystem.ts:140-158`).
  - Every unit death goes through `destroyUnitEntity` (`entityDestroyOps.ts:221-222`). No other `destroyEntity` caller exists in `src`.
  - What remains: finding 1.

#### Checked and sound

- **(a)** It checks generations and is deterministic.
- **(b)**
  - Two Monks share one entry in the set, and the player's own Monk is filtered out.
  - A converted Monk's order is cleared (`monkTaskAppliers.ts:374`).
  - Allies cannot hold an order to convert a building: routing calls `isEnemyOwner` (`monkContextOps.ts:125-134`), and teams are set only at seed (`scenarioSeedOps.ts:159`).
  - Saves and snapshots behave as described under F2, and the per-tick cost is negligible.
- **(c)** It fires only after a flip or on an older save's entry, because owners change only at `monkBuildingConversion.ts:148`.
  - Vietnamese-reveal entries carry the Town Centre's owner, never the player (`vietnameseReveal.ts:48,68`).
  - A building converted while seen from elsewhere, or under ally or Spies sight, gets the normal refresh.
  - A recycled id fails the generation check.
- **(d)** It cannot erase a converted building's ghost.
  - The flip and the refresh happen in the same tick.
  - No system between them destroys a building (`registerAllSystems.ts:329-428`), and the engine keeps that order (`civ-engine/src/world-systems.ts:214-268`).
  - Entries with no generation are dropped, because `isCurrent` compares generations strictly (`world-entities.ts:77-82`).
- **The save-editing staging** (`fogMemoryOwnBuildings.helpers.ts:69-110`)
  - It changes the fields a flip changes.
  - It leaves population and the foundation's health inconsistent. Neither feeds fog memory.
  - The test premises are asserted.

#### Questions I could not settle

- **Recalled Monk's progress:** does Definitive Edition keep a Monk's conversion progress when it is called away and ordered back? That decides where finding 1 should be fixed.
- **Converted building under fog:** does Definitive Edition draw a building converted out of your sight in the converter's colours and architecture?
- **The bare House:** is the bare House made inside `runMaintenance` really never drawn? This affects only the last bullet of finding 2.
- **Nothing was run:** I ran nothing; every finding comes from reading the code.

#### Read outside the diff

`monkBuildingConversion.ts:68-199`, `monkBehaviorSystem.ts:123-217`, `unitCommandOps.ts:213-240,404-419`, `monkTaskOps.ts:156-275`, `monkContextOps.ts:60-137`, `entityDestroyOps.ts:182-379`, `hydrateFromSavedGame.ts:76-80,165-176,239-262`, `hydrateFromWorldState.ts:146-180`, `vietnameseReveal.ts:26-92`, `fogMemoryOps.ts:73-138`, `renderStateOps.ts:38-128`, `registerAllSystems.ts:200-480`, `finalizeBuildingConstruction.ts:96-105`, `garrisonOps.ts:160-212`, and in civ-engine `world-tick.ts:120-148`, `world-entities.ts:77-82` and `world-systems.ts:214-268`.

## Findings and disposition

Round 0's findings keep their IDs; this round's new ones continue from F11. On round 0's three MED findings both reviewers say F0 is fixed. Claude says F1 and F2 are fixed for what they named; Codex calls F1 partly fixed (F12) and F2 incomplete (F11).

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F11 | A conversion called off keeps its progress; a Monk sent back while in range adds the last tick and flips the building before any fog pass sees the new order, so with no entry the building vanishes. A regression against main and `8be8f306`, which both kept the entry through the pause (Codex 1, MED; Claude 1, LOW). | Accepted. Fixed in this card's file without writing anything from `aoe2.conversionState`: while an enemy's progress stands there on the player's building, the entry the order wrote is kept rather than dropped. Reading that slot only to keep an entry for a standing building cannot differ between live play and a load, except through F10's stale entries, which already make the two disagree on the progress itself. Claude's tick-local flip marker would sit in `monkBuildingConversion.ts`, not this card's file. | Test "keeps the building on the map when a Monk called off one tick short is sent back and flips it at once"; mutation M10 turns it red (`drawn after the flip: expected [] to deeply equal [ { isMemory: true, owner: 2 } ]`). |
| F12 | The fog pass runs before projectiles and tower arrows, so an exempt building they kill keeps its entry and is drawn for one tick; if that kill ends the match, nothing steps again and the entry stays. A loaded match that has already ended never steps, so an older save's ghosts stay drawn (Codex 2, MED; Claude 3, NIT). | Accepted as a bound. It needs a building under an enemy's conversion, which no AI attempts, or an older save of an ended match. Both reviewers' fixes are outside this card: clearing at destruction (`entityDestroyOps.ts`) or skipping such entries when drawing (`fogMemoryOps.ts`). | Wording changed from "the moment it goes" to "on the first pass after it goes" in the code, spec §12.1, register and plan; the bound is stated there. |
| F13 | An older save can hold an entry naming the player for a building converted away out of sight. Rule (c) refreshes it to the building's look at load, or rule (d) forgets it if the building is gone, though the player never saw that (Codex 3, MED; Claude 5, NIT). | Accepted as a bound. The entry carries no history that could tell the cases apart, and adding one changes the save format, which belongs to work 114. Only an enemy that converts buildings can make such an entry, and no AI does. | Spec §12.1 and the plan say so. |
| F14 | No save/load or replay runs through an active exception (Codex 4, LOW; Claude 2). | Accepted. | Test "plays a save made mid-conversion to the same fog memory as the match it came from": the live and loaded matches are compared at every one of 120 steps through a recall, a resumption and the flip. A recorded-replay `selfCheck` is not run. |
| F15 | No test needs the target-identity check or the Monk-owner check; removing either leaves the gate green (Claude 2). | Accepted as stated. Both are belt and braces: the Monk system deletes a task whose target is gone earlier in the same tick, and the player's own Monk cannot be sent at the player's building (outside the one-tick case of two Monks on one target). | The code comment says so. |
| F16 | Rule (c)'s purpose, keeping the ghost of a building converted away and later lost out of sight, was untested (Claude 2). | Accepted. | The conversion case now has the new owner delete the building out of the player's sight and expects its ghost to stay; mutation M8 turns it red. |
| F17 | Only the Delete path is driven for an exempt building's loss (Claude 2). | Accepted as a bound; the kills that land later are F12. | The test file's header names the paths not driven. |
| F18 | The recycled-id case's second half cannot show what its comment said, and round 0's F4 disposition repeats it: the render store never knew the bare House, so the ghost was drawable before the second destroy too (Claude 2). | Accepted. **Correction to round 0's F4 disposition:** it said the case "now also checks that the destroyed House is drawn from memory once the player's House is gone". What that half pins is that rule (d) spares an entry recorded as another player's. | Comment reworded. |
| F19 | The "razed" target in the conversion-record case is a raw `destroyEntity` (Claude 2). | Accepted. | The case says "destroyed raw". |
| F20 | Rule (c)'s stated reason ("the player's own sight, up to the flip") is false for an unstarted foundation, and the refresh shows the player which enemy took the building (Claude 4). | Accepted. | The code comment, spec §12.1 and the plan now call the new-owner look a rule chosen here, not verified against DE, and say what it reveals. |
| F21 | The spec said a recycled id's entry is kept "for a different, destroyed building", which (d) contradicts when that building was the player's. The devlog presented the A/B as the repaired code's. `docs/devlog/summary.md` holds 51 entries (Claude 6). | Accepted. | The spec says "another player's destroyed building"; the devlog says the A/B was of `8be8f306` and that the repaired code writes the same slot. The summary is left at 51 for the integrator: six workers are adding lines, so compaction belongs on the rebased tree. |
| F22 | The exception's entry comes and goes with a flickering order, and each change re-serialises the whole slot into that tick's replay diff (Claude 7). | Accepted as a bound; dormant while nothing converts buildings, and F11's repair keeps the entry through any pause that leaves progress. | None. |
| F10 | (round 0) Claude adds that the stale `aoe2.conversionState` entries go wider: a later attempt resumes saved progress, even on a different building that took the id, and live play and a replay loaded in between can disagree on who owns a building. | Still outside this card; it now also bounds F11's repair. | Recommended to the coordinator as a separate card, with both points. |
| F23 | Outside this card: converting a foundation moves 5 population supply on the flip, and finishing it adds the supply again (`monkBuildingConversion.ts:155-174`, `finalizeBuildingConstruction.ts:97-105`) (Claude). | Outside this card. | Reported to the coordinator. |

## Verification

Run by the author on the working tree after both reports (none of it on `ff9cfa40` itself):

- `npx vitest run` on the two gate files: 13 of 13 pass. Ten mutations (M1-M10, in the plan) each turn at least one case red, with the source's sha256 checked after each run. M1, main's file, reds eleven of thirteen.
- `npx tsc --noEmit` exit 0; `npx eslint` on the changed source and test files exit 0.
- Not run: `npm run verify` (phase 2); the interleaved A/B on the repaired code; a recorded-replay `selfCheck` through a conversion.

## Round outcome

One new MED finding was shared by both reviewers (F11). It was a real hole in the repair and is closed. F12 and F13 are recorded as bounds, because their fixes lie in files outside this card. The rest are repaired, answered, or passed to the coordinator (F10, F23). The F11 repair adds logic, so a focused round 2 on it follows.
