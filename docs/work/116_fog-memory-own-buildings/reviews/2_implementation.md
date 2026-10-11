# Review 2: implementation

## Target

Repository aoe2, commit `0cee8e54` ("Keep a paused conversion's entry, and answer review round 1 (work 116)") on branch `fog-memory-own-buildings`, against its parent `ff9cfa40`, which round 1 reviewed. Scope, focused on round 1's repair: the keep-rule in `src/game/simulation/bridge/systems/fogMemorySystem.ts` (an entry for a building of the player's is kept while another player's progress stands on it in `aoe2.conversionState`), its reworded comments, three added or extended cases in `tests/simulation/fogMemoryOwnBuildingConversion.test.ts`, and the matching docs and round-1 record. Each reviewer received `git diff ff9cfa40..0cee8e54` (693 lines, sha256 `c55b5f016ef4c2c0f9132f0a5a9e26709658e0a59659066675c2b552893aa2a3`) on stdin, with rounds 0 and 1's records and the plan in the tree. The worktree did not change while they ran. Phase 2 rebases the branch, so the landed commits carry new hashes; the diff digest identifies the reviewed change.

## Reviewers and coverage

- **Codex**, `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.158.0, `--sandbox read-only --ephemeral`, `-o` capture; exit 0, 4,812-byte report. Its stdout's matches for `STATUS_DLL_INIT_FAILED` and `-1073741502` are all echoed text of earlier records (the diff and the files it read), not a sandbox failure. It cites files and lines outside the diff (`monkBuildingConversion.ts:108,194`, `wildlifeCombatSystem.ts:184`, `registerAllSystems.ts:329,400,428`).
- **Claude**, `claude-opus-5-5[1m]` at `--effort max`, Claude Code 2.1.281, the same `--allowedTools` as before, stream-json; exit 0, `result/success` after 58 turns and 32 minutes. The result event's `modelUsage` holds exactly one key, `claude-opus-5-5[1m]`. It dispatched no subagent. It ran 57 shell commands, all reads; the one a write-scan flagged was a `>` inside a quoted grep pattern. `git status` afterwards showed a clean tree.
- The brief asked whether F11 is closed in every sequence, whether the keep-rule opens anything new, whether its determinism claim holds, whether the three tests prove their names, and whether the docs match the code. Neither ran anything.

## Reports

Both reports are reproduced as written. The Claude report's headings were lowered two levels to sit inside this record; no other change.

### Codex (gpt-6-astra, xhigh)

1. MED — The keep-rule can preserve an enemy-colour entry for a building the player acquires, recreating an own-building ghost.

   `src/game/simulation/bridge/systems/fogMemorySystem.ts:138` checks the progress owner but not `held.owner`. A reachable three-player sequence is:

   - Player 1 and player 3 have Monks converting player 2’s House, with player 1’s task processed first.
   - Player 1 completes the conversion. The flip deletes the conversion record (`src/game/simulation/bridge/monkBuildingConversion.ts:194`).
   - Player 3’s Monk then processes the same target. The per-tick guard stores a fresh `{ byOwner: 3, progress: 0 }` (`monkBuildingConversion.ts:108`).
   - Wildlife kills that Monk before fog memory runs. Wildlife runs between Monks and fog memory (`src/game/simulation/bridge/registerAllSystems.ts:329`, `:400`, `:428`); its kill removes the Monk’s task, leaving the House’s progress record (`src/game/simulation/bridge/systems/wildlifeCombatSystem.ts:184`; `src/game/simulation/bridge/entityDestroyOps.ts:221`).
   - The new guard retains the House’s previous owner-2 memory indefinitely, without refreshing it to owner 1.

   After the player moves other sight away and deletes the House, the forgetting rule at `fogMemorySystem.ts:230` spares that owner-2 entry. The player gets a ghost of their own deleted building. The parent commit dropped this entry.

   Suggested fix: retain paused-conversion memory only when it records the current human ownership; drop an older enemy-owned entry. Add the contested-acquisition → converter death → own deletion regression. This sequence uses no recycled IDs or F10 stale records.

2. NIT — The extended ghost test does not prove its new “until the player sees it gone” name.

   `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:82` promises that boundary, but the test ends at `:108` with the ghost still present. It proves persistence after unseen deletion, never removal after re-observation. A defect that kept the ghost after scouting would pass.

   Suggested fix: bring player sight onto the deleted footprint and assert removal, or narrow the name to the behavior actually checked.

3. NIT — Some revised documentation still misstates timing and coverage.

   `design/spec-final.md:1514` and `docs/work/116_fog-memory-own-buildings/plan.md:51` say legacy converted-building entries refresh “at load.” The refresh occurs in the subsequent fog-system execution (`src/game/simulation/bridge/systems/fogMemorySystem.ts:153`), not hydration. An ended loaded match never executes it (`src/game/simulation/createSimulationBridge.ts:304`). Likewise, `docs/devlog/summary.md:2` still says “the moment it goes,” despite the accepted F12 bound.

   `plan.md:93` also reports three added cases and nine conversion tests. There are eight tests: two new tests plus an extension to an existing one, giving thirteen across both files.

   Suggested fix: state “on the first subsequent simulation tick, if one runs,” correct the summary’s timing, and distinguish added tests from extended coverage.

F11: The reported recall-at-49 → resume hole is closed. For an existing own-owner entry, the guard also survives converter death, garrisoning, replacement Monks and faith rest. Different enemy owners remain covered; their progress resets when they actually advance (`src/game/simulation/bridge/monkBuildingConversion.ts:114`). Finding 1 is a new interaction introduced by the repair.

A paused entry can remain for the standing building’s entire lifetime. Normally it is hidden by the live owned entity (`src/game/simulation/bridge/renderStateOps.ts:64`; `src/game/simulation/bridge/fogMemoryOps.ts:84`). It adds persistent-state and fingerprint cost, but keeping it alone does not dirty and reserialize memory each tick.

I found no additional keep-rule determinism counterexample independent of F10. Hydration preserves conversion records for live IDs (`src/game/simulation/bridge/hydrateFromWorldState.ts:148`, `:170`). The new save test meaningfully exercises restored orders and progress: it saves positive progress, advances before replacing the order, and compares memory every tick through the ownership transition. Losing either restoration would shift that transition. It does not establish recorded-replay equivalence, and its recall phase is not independently asserted.

Open questions:

- Does Definitive Edition preserve interrupted conversion progress and show the chosen new-owner appearance under fog?
- Does a recorded replay checkpoint through these interruptions pass `selfCheck`? That remains unverified.

All findings are from code inspection, including the cited outside-diff conversion, destruction and hydration files. No files were changed and no tests or builds were run.

### Claude (claude-opus-5-5[1m], max)

#### Findings

##### 1. LOW: F11 can still happen through F10's stale record on a reused id, but the docs call it closed

- **Where:** `src/game/simulation/bridge/systems/fogMemorySystem.ts:136-142` keeps only an entry already held for the building's current generation.
  - Outside the diff, `entityDestroyOps.ts:224` deletes only a dying unit's own record. Nothing deletes a destroyed building's record.
  - `civ-engine/src/entity-manager.ts:14` (`freeList.pop()`) gives out the most recently freed id first.
  - `monkBuildingConversion.ts:108,114-117` resumes whatever record sits under the id, as long as the record's owner matches the Monk's owner.
- **Sequence:**
  1. An enemy Monk reaches progress 49 on a House of the player's.
  2. The player deletes the House. The entry is forgotten on that tick's pass, but the record stays under id X.
  3. If the player's next building is the next entity created, it takes X with a new generation. No pass has seen an order on it, so no entry is held for it.
  4. The same enemy's Monk is in range with full faith. It is ordered at the new building, resumes 49 and flips it in the same tick. Orders run first, then the Monk system, then the fog pass.
  5. The fog pass finds no order, a building that is not the player's, no held entry and unseen ground, so it skips the building and it disappears from the map.
- **Regression or not:** a foundation disappears on main too. A finished building is a regression: main kept the entry its own sight wrote. This is F11 by a second route.
- **Why it matters:** these docs present the exception as closed:
  - spec §12.1 (`design/spec-final.md:1514`);
  - the register (`docs/learning/defect-register.md:17`: "all repaired before landing");
  - the devlog summary;
  - round 1's outcome (`reviews/1_implementation.md:261`: "is closed").
  - Only the F10 row (`1_implementation.md:248`) says F10 bounds the repair. `plan.md:50` mentions F10 only for determinism.
  - Reach is narrow: an enemy that converts buildings (no AI does), a delete one tick short, and the id going to the player's next building.
- **Fix options:**
  - The root cause is F10. Deleting the target's record in `destroyBuildingEntity` closes this route and F10's own bugs.
  - Inside this file: write an entry for a building of the player's whenever another player's record stands on it. That costs the same F10-only live/load difference the keep already accepts. Here the reused building really can flip in one tick, so remembering it is correct, not F2's false exemption.
  - Round 1's tick-local flip marker in `monkBuildingConversion.ts` closes every one-tick route without reading the record.
  - At minimum, name this route as a bound in spec §12.1, the register and the plan's Decisions, and add it to the F10 card.

##### 2. LOW: the save/load case never saves the paused state the keep exists for, and it checks less than saves and replays carry

- **Where:** `tests/simulation/fogMemoryOwnBuildingConversion.test.ts:219-236`.
- **The kept entry is never tested across a load:**
  - The save is made while the order stands (`:219-224`), and the first comparison comes after one step.
  - So the restored order rewrites the entry before anything checks the restored copy.
  - The state that needs a save to carry both the kept entry and the record (paused at 49, no order) is never saved.
- **The comparison ignores order:**
  - It sorts entries by id (`:235`).
  - The slot is saved and replayed in insertion order, and `SessionReplayer.selfCheck` compares arrays element by element (`civ-engine/src/session-deep-equal.ts:17-27`).
  - So a difference only in entry order passes this test and fails selfCheck.
- **Orders and progress are checked only through the flip's timing:**
  - That does work: a lost order or lost progress makes the loaded match flip later, and the per-step comparison fails at the live match's flip step. The `ownerOf(live)` premise confirms that a flip happened.
  - But while progress stands, the keep makes fog memory blind to a missing order.
- **Fix:**
  - Add a save made during the pause at 49, load it, re-order the Monk in both matches, and compare from before the first step.
  - Compare the raw slot unsorted.
  - Assert `progressOn(loaded) === progressOn(live)` at every step.

##### 3. NIT: the Monk-owner check carries weight; it is not just belt and braces

- **Where:**
  - `fogMemorySystem.ts:98-100`;
  - `plan.md:50`;
  - `reviews/1_implementation.md:240` (F15, "outside the one-tick case of two Monks on one target").
- **What happens:**
  - A convert order is not re-checked while its Monk walks: `monkBehaviorSystem.ts:185-193` moves the Monk and continues.
  - The enemy-owner check (`monkBuildingConversion.ts:81-83`) runs only once the Monk is in range.
  - Say the player's first Monk converts an enemy building while a second Monk of the player's is still walking to it. The second Monk then holds a convert order on the player's own building for its whole walk, not one tick.
  - During that walk, the owner check is what keeps the building out of `beingConverted`.
- **Why it matters:** the behaviour is correct, and without the check the only effect would be an entry that is never drawn. But the comment, the plan and the record state a false invariant, and no test covers the path.
- **Fix:** reword all three. Optionally add a test with two of the player's Monks.

##### 4. NIT: the keep checks "not the player's", but the docs say "an enemy's"

- **Where:** `fogMemorySystem.ts:137-138`, against the comment at `:107-111`, spec §12.1 and `plan.md:50`.
- **What:** an ally's record can stand on the player's building only through F10:
  - an ally's Monk worked on an enemy building that was destroyed before the flip;
  - the player's building then reused that id.
  - An ally's Monk can never be ordered at the player's building (`monkContextOps.ts:125-134`), so keeping the entry for an ally's record guards nothing.
- **Naming:** the local `progress` holds a `{ byOwner, progress }` record, so `progress.byOwner` reads wrongly.
- **Fix:** test `isEnemyOwner(teams, record.byOwner, humanPlayerId)`, or say "another player's" in the docs. Rename the local.

##### 5. NIT: the determinism claim is true, but its reason does not limit how long a difference lasts

- **Where:** `plan.md:50` and `reviews/1_implementation.md:236`.
- **Why the claim holds:**
  - **Entity state:** the free list is saved, so reused ids match.
  - **Fog slot:** restored as saved.
  - **Monk orders:** a load drops only orders that live play also drops before the fog pass: a dead Monk's at `entityDestroyOps.ts:221-222`, a gone target's at `monkBehaviorSystem.ts:148-151`.
  - **Records:** a load prunes only dead ids (`hydrateFromWorldState.ts:151`, `hydrateFromSavedGame.ts:436`). A unit's record is deleted at its death (`entityDestroyOps.ts:224`), so only a destroyed building's record can differ.
  - **Per-tick guard:** it is tagged with the tick and cleared each tick (`monkBehaviorSystem.ts:132`).
  - **Order:** map order survives the codec (`bridgeStateSerialize.ts:67-68`), and engine queries come back sorted by id.
- **Where the reason falls short:** "which already make the two disagree on conversion progress" does not cover this sequence:
  1. Enemy 2's record stands on a House of the player's at id X. The House is deleted, and the game is saved while X is free, so the load prunes the record.
  2. The player's next building takes X in both matches.
  3. Enemy 2's Monk is ordered at it from out of range and called off before it arrives. Live keeps the entry; the loaded match drops it.
  4. Enemy 3's Monk is ordered at it. The loaded match adds a fresh entry at the end of the map; live's entry keeps its old place.
  5. Enemy 3's first step resets the record to its own in both matches, and its flip deletes the record in both.
  - After that, `aoe2.conversionState` matches, but `aoe2.lastSeenStatic` differs in entry order (if anything was remembered between steps 3 and 4) until that ghost is forgotten.
  - selfCheck reports that difference; the sorted test would not.
- **Fix:** reword to something like "cannot differ except through F10; a difference that starts there can outlast it in the fog slot".

##### 6. NIT: wording that no longer matches the code or the gate

- **Plan:**
  - `plan.md:93` says "Three cases were added … (now nine)". The file has eight cases: two new ones plus an extension of the existing conversion case (6 cases at `ff9cfa40`, 8 now). The devlog's 13 (5 + 8) is right.
  - `plan.md:40` still says "A conversion takes at least 50 ticks … so the entry exists before the flip". F11 showed that premise is false for a resumed conversion.
- **Spec `design/spec-final.md:1514`:**
  - "An entry … one a build before vNEXT wrote into a save … is dropped on the next tick" now has an exception: another player's standing record keeps it.
  - "refreshed … at load" actually happens on the first tick after load.
  - "forgotten a tick later" is false when that kill ends the match, because nothing steps again.
    - `plan.md:49` says so; the spec and `defect-register.md:17` don't.
    - Yet `1_implementation.md:237` says "the bound is stated there".
  - "Tower arrows" never land on buildings: towers aim at units only (`towerCombatSystem.ts:43,153`). "Projectiles" alone is the whole set. The same applies to "(projectiles, towers)" in the register.
- **Missing statement:**
  - A record on a standing building never decays. It goes only at a flip or when another owner's Monk resets it.
  - So "kept while progress stands" in practice means kept until the building changes hands or is lost. Say so in the spec and the plan.
  - This also widens F12's match-ending ghost (`1_implementation.md:237`: "needs a building under an enemy's conversion") to any building of the player's that ever carried enemy progress.
- **Code comment:** `fogMemorySystem.ts:132` lists "a finished attempt's" entry as dropped. An attempt that made any progress leaves its record behind, so its entry is kept. Only an attempt that ended before making progress is dropped.
- **Devlog:**
  - `docs/devlog/summary.md:2` still says "forgets one the moment it goes".
  - Its "the repaired code writes the same slot" was measured on the round-0 repair (`plan.md:65`). It holds for this commit by construction, because no AI converts and the castle world has no records. Say which revision was measured.
- **Changelog:** `docs/changelog.md:7` says "on their first tick they drop the entries for your own buildings". It has the same exception as the spec.
- **Test name:** `fogMemoryOwnBuildingConversion.test.ts:82` ends "until the player sees it gone". The case never shows the player that ground after the delete; it only shows the ghost outlives the loss.
- **Round-1 F16:** `1_implementation.md:241` says "mutation M8 turns it red". M8 fails this test at the owner/tint check (`:98-100`), before the new half runs. No listed mutation fails the new half alone; a forgetting rule that dropped every owner's building entries would.

#### Is F11 closed?

**Closed for the same building (same id and generation)** in every sequence I could build:

- **A recall at any progress:**
  - Progress grows only on ticks when the Monk system runs an order, and that tick's fog pass sees the order.
  - The only exception is a wildlife kill between the two, which can happen once per Monk.
  - From the first pass that sees an order, the standing record keeps the entry.
  - A fresh conversion needs at least 50 ticks (`bridgeConstants.ts:56-57`); Faith and the Teuton bonus only slow it.
- **A Monk killed mid-conversion:** `entityDestroyOps.ts:221-224` removes the Monk's order and the Monk's own record, not the target's. The entry is kept, and the next Monk of that owner finds it there for the after-flip refresh.
- **A Monk garrisoned mid-conversion:** the Monk system drops the order of a Monk with no position (`monkBehaviorSystem.ts:143`). The outcome is the same as a kill.
- **Progress left by a different enemy:** the entry is kept. A Monk of another owner restarts from 0 (`monkBuildingConversion.ts:114-117`), so only the record's own owner can flip the building in one tick, and the entry is there when it does.
- **Faith rest, an occupied building, or a target the Monk's side cannot see:** the order still stands, so the exception itself covers them.

**Not closed** through F10 (finding 1). Separately, a pre-vNEXT save of an unseen foundation at 49 with the order standing loses the building on the first tick, exactly as main did.

**What the keep opens (cost and side effects):**
- Nothing is drawn while the building stands. Every building of the player's is in the live set (`renderStateOps.ts:64`), and live ids are skipped (`fogMemoryOps.ts:84`).
- The entry is forgotten one pass after a loss.
- After a flip, the refresh replaces any stale look.
- The entry lasts as long as the building stays the player's: one entry of a few hundred bytes per such building.
- The accessor caches the slot (`bridgeStateAccessor.ts:65-76`), so the extra read is one map lookup per building.
- It widens F12's reach, as noted in finding 6.

#### Open questions

1. Does Definitive Edition keep conversion progress after a Monk stops? Round 1 asked this, and it is still unverified. If it does not, the F10 card could reset the record when the order ends. That would remove F11, the keep and its F10 caveat together.
2. Should F10 land before this card? It closes finding 1 and the keep's only live/load difference.
3. A note for the F10 card, outside this card: a unit that takes a destroyed building's id inherits that building's record too (`monkTaskAppliers.ts:264,276`).
   - Example: the player's Monk works on an enemy building, and the player's army razes it before the flip.
   - If the AI's next created entity is a unit, the stack-shaped free list gives it the id.
   - The player's Monk then converts that unit from the old progress.
   - This is reachable against the AI.
4. I ran nothing. I have not run a selfCheck through a conversion or a save made during the pause. I can't confirm by running whether the sorted comparison hides an order difference in today's case. By reading, both matches should keep the same order.

**Read outside the diff:**
- `monkBuildingConversion.ts:68-199`
- `monkBehaviorSystem.ts:123-205`
- `monkTaskAppliers.ts:196-311,365-402`
- `monkContextOps.ts:60-137`
- `unitCommandOps.ts:222-236`
- `entityDestroyOps.ts:200-240,440-470`
- `hydrateFromWorldState.ts:148-185`
- `hydrateFromSavedGame.ts:60-95,155-185,430-460`
- `bootScenarioOrLoad.ts:84-102`
- `bridgeStateAccessor.ts:60-180`
- `bridgeStateSerialize.ts:64-70,240-256`
- `fogMemoryOps.ts:73-138`
- `renderStateOps.ts:55-125`
- `registerAllSystems.ts:420-500`
- `towerCombatSystem.ts:40-70`
- `entityDeleteHandler.ts:20-60`
- `monasteryTechEffects.ts:44-55,118-142`
- civ-engine: `entity-manager.ts:7-51`, `session-deep-equal.ts:1-60`, `world-queries.ts:1-60`

## Findings and disposition

Earlier findings keep their IDs; this round's new ones continue from F24. Both reviewers say F11 is closed for the same building; Claude adds that it is not closed for a building that takes a destroyed building's id (F27).

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F24 | The keep-rule checked the progress owner but not the held entry's owner, so after a contested acquisition — the player's Monk flips a building, a third player's Monk starts on it the same tick and is killed before the fog pass — the building keeps its previous owner's entry for good, and deleting it out of other sight leaves a ghost in an enemy's look (Codex 1, MED). | Accepted. Superseded by a new rule: the exception now WRITES the building's current, the player's, look whenever an enemy's progress record stands on it, and drops the held entry when none does, so no entry for a building of the player's survives a pass in an older look. The keep-rule is gone. | Not staged as a test (it needs three players and a kill between two systems); the rule leaves no path that keeps an entry without rewriting it. |
| F25 | The extended conversion case's name ("until the player sees it gone") promised a re-observation it never makes (Codex 2, NIT; Claude 6). | Accepted. | Renamed: "... and keeps its ghost when it is lost out of the player's sight". |
| F26 | Docs said older saves' converted entries refresh "at load" (it is the first tick after, if one runs); the summary still said "the moment it goes"; the plan miscounted the conversion cases (Codex 3, NIT; Claude 6). | Accepted. | Spec, plan, register, changelog and devlog reworded; the plan counts five and nine cases. |
| F27 | The engine leaves a destroyed building's progress record under its id, and a Monk of that owner resumes it on whatever takes the id. A building of the player's that takes the id can therefore flip in one tick with no entry, and it vanishes: F11 by a second route (Claude 1, LOW). | Accepted. Fixed by the new rule: the exception follows the progress record, so the building that takes the id is remembered from its first pass and stays drawn after the flip. Claude's tick-local flip marker would sit in `monkBuildingConversion.ts`, outside this card. | Test "keeps on the map a building of the player's that takes the id of one destroyed one tick short, when the enemy's Monk resumes on it"; mutation M9 (the exception read from convert orders) turns it red. |
| F28 | The save/load case never saved the paused state, compared the slot sorted (a recorded replay's `selfCheck` compares in order), and checked progress only through the flip's timing (Claude 2, LOW). | Accepted. | The case now also saves during the pause at progress 49, compares the raw slot unsorted and the progress at every step, across the live match and two loads. |
| F29 | The Monk-owner check carried weight: a second Monk of the player's can hold a convert order on the player's own building for a whole walk, not one tick (Claude 3, NIT). | Superseded: the order-based rule, and the check, are gone. The new rule's owner test is `isEnemyOwner` on the record's owner. | None. |
| F30 | The keep tested "not the player's", the docs said "an enemy's"; an ally's record can stand on the player's building only through F10. The local `progress` held a record (Claude 4, NIT). | Accepted. | The rule tests `isEnemyOwner(teams, player, record.byOwner)`, and the local is `record`; mutation M12 (any owner's record exempts) turns "remembers no building of the player's that takes the id of an enemy building its own Monk was converting" red. |
| F31 | The plan's determinism reason did not bound how long a difference lasts: a difference that starts with a pruned record can outlive it in the fog slot's entry order (Claude 5, NIT). | Accepted. | The plan's Decisions state the live-against-load difference, its lifetime and its reach. |
| F32 | Wording: the plan's 50-tick premise, the spec's "dropped on the next tick" without the exception, "forgotten a tick later" though a match-ending kill never is, towers (which aim at units only), progress that never decays, the code comment's "a finished attempt's", the devlog's revision for the slot check, the changelog's exception, and round 1's F16 claim that M8 shows the new half of its case (Claude 6, NIT). | Accepted. | All reworded. **Correction to round 1's F16 disposition:** M8 fails that case at its owner check, before the new half runs. Mutation M11 (forgetting every owner's lost building) fails the new half alone: `drawn after it was lost out of the player's sight: expected [] …`. |
| F10 | (round 0) Under the new rule this is the exception's one live-against-load difference: a load prunes the record a destroyed building left, a match opened then does not remember the player's building that later takes the id, and the difference, entry order included, can outlast the record (Claude 1 and 5). | Outside this card; dormant against the AI, which never converts. | The F10 card (delete the record in `destroyBuildingEntity`) removes it; recommended to the coordinator. |
| F33 | Outside this card: a unit that takes a destroyed building's id inherits its record too, so the player's Monk can convert that unit from the old progress, and this is reachable against the AI (Claude, open question 3). | Outside this card. | Added to the F10 card's notes. |

## Verification

Run by the author on the working tree after both reports (none of it on `0cee8e54` itself):

- `npx vitest run` on the two gate files: 14 of 14 pass. Eleven mutations (M1-M9, M11, M12 in the plan) each turn at least one case red, with the source's sha256 checked after each run; M1, main's file, reds twelve.
- `npx tsc --noEmit` exit 0; `npx eslint` on the changed source and test files exit 0.
- The final code, loaded from the saved 30,000-tick castle world, writes a slot byte-identical to `8be8f306`'s at tick 30,001 (18,372 bytes).
- Not run: `npm run verify` (phase 2); the interleaved A/B on the final code; a recorded-replay `selfCheck`.

## Round outcome

F11 was closed for the same building but not for a building on a reused id (F27). The keep-rule also opened F24. Both are answered by moving the exception from the Monk's order to the enemy's progress record, which the engine keeps exactly as long as a one-tick flip stays possible. The price is F10's dormant live-against-load difference, now recorded as the rule's bound and passed to the coordinator with F33. The rule changed again, so a focused round 3 follows.
