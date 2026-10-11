# Review 0: implementation

## Target

Repository aoe2, commit `8be8f3061e36539b1b9f8695d23f0c7fdb2144b9` ("Fog memory keeps none of the player's own buildings (work 116)") on branch `fog-memory-own-buildings`, against its parent `f906a25534e8` (main at dispatch). Scope: `src/game/simulation/bridge/systems/fogMemorySystem.ts`, the new `tests/simulation/fogMemoryOwnBuildings.test.ts`, one new bullet in `design/spec-final.md` §12.1, `docs/changelog.md`, `docs/learning/defect-register.md` and this work's `plan.md`. Each reviewer received `git diff f906a255..8be8f306` (501 lines, sha256 `9376c4d3981317ee18d09ad9c010f59b9724290ab7431426638f2a74e2eefe15`) on stdin and read the worktree at that commit for context. Phase 2 rebases the branch, so the landed commit will carry a new hash; the diff digest identifies the reviewed change.

The worktree was not quiet for the whole review: the author edited `plan.md` and `docs/devlog/summary.md` while it ran (no code). Codex noticed the plan edit and kept to the commit. A `git diff --stat` after both runs showed only those two author edits; neither reviewer wrote a file.

## Reviewers and coverage

- **Codex**, `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.158.0, `--sandbox read-only --ephemeral`, `-o` capture; exit 0, 6,909-byte report. Its stdout holds no `STATUS_DLL_INIT_FAILED` or `-1073741502`. It cites files and lines outside the diff; the author spot-checked `src/game/playtest/agentSnapshot.ts:128` (`ownBuildingsFor` reads economy data, as cited) and `entityDestroyOps.ts:377` (the building destroy). No subagents were reported.
- **Claude**, `claude-opus-5-5[1m]` at `--effort max`, Claude Code 2.1.281, `--allowedTools "Read,Glob,Grep,Task,Bash(git diff *),Bash(git log *),Bash(git show *)"`, stream-json; exit 0, `result/success` after 82 turns and 31 minutes. The result event's `modelUsage` holds exactly one key, `claude-opus-5-5[1m]`. It dispatched no subagent. The allowed-tools list did not confine its shell to the three git patterns: it ran 81 shell commands, all of which ran (grep 33, `sed -n` 28, cat 7, git 7, wc 4, ls 2). A scan of every command found none that writes, and the tree audit above agrees.
- Both were given the same brief: the consumer claim, determinism and persisted state, conversion and other edge cases, the tests, and the docs' accuracy. Neither ran tests, builds or probes, as the brief required.

## Reports

Both reports are reproduced as written. The Claude report's headings were lowered two levels to sit inside this record; no other change.

### Codex (gpt-6-astra, xhigh)

1. MED — The conversion exception loses foundations outside the player’s sight. `src/game/simulation/bridge/systems/fogMemorySystem.ts:108` removes their existing entries, but the exception still passes through the visibility check at line 117. Foundations receive no automatic vision (`src/game/simulation/bridge/buildingSeedVision.ts:48`), and building conversion does not require completion (`src/game/simulation/bridge/monkBuildingConversion.ts:85`). Therefore, build a House foundation, move its builders away, then have an enemy Monk convert it: no entry is written during conversion, and the foundation disappears from the player’s map after the flip. Before this change, its earlier memory survived. The 50-tick window does not help when all 50 visibility checks fail. Fix: record an owned conversion target regardless of footprint visibility, or capture its appearance immediately before ownership changes. Add an out-of-sight foundation conversion test.

2. MED — Deleting or destroying an own building during conversion still leaves the reported ghost. `src/game/simulation/bridge/systems/fogMemorySystem.ts:108` deliberately retains that building’s entry, but removal only handles buildings still present in the query. Once the building dies, the remaining cleanup at line 191 still requires visible ground. `src/game/simulation/bridge/entityDestroyOps.ts:377` destroys the building without clearing its fog entry. Start the tested enemy conversion, wait until memory exists, then Delete the isolated House before the flip: its sight disappears and its ghost remains. This contradicts the deletion guarantee in `docs/changelog.md:7` and `design/spec-final.md:1512`. Fix: remove matching own-building memory at the destruction boundary, using the actual owner and generation before destruction; preserve memory on ownership transfer. Add deletion and combat-death cases during conversion. This also covers deleting a remembered building immediately after loading an older save, before its first cleanup tick.

3. MED — Presence in `conversionState` does not establish an active enemy conversion. The new condition at `src/game/simulation/bridge/systems/fogMemorySystem.ts:108` treats any entry as an indefinite exemption. However, `src/game/simulation/bridge/monkTaskOps.ts:270` clears only the Monk’s task, and Monk destruction at `src/game/simulation/bridge/entityDestroyOps.ts:221` removes conversion state keyed by the Monk’s own ID, not its target’s ID. A stopped, reassigned or killed converter can therefore leave the House remembered indefinitely. Loading does not repair this while the target exists (`src/game/simulation/bridge/hydrateFromWorldState.ts:148`). The conversion map also lacks target generations (`src/game/simulation/bridge/bridgeStateSerialize.ts:250`), so stale entries can exempt recycled IDs. Fix: derive the exemption from valid enemy conversion tasks targeting the current entity identity, or establish complete conversion-state lifecycle cleanup. Test interruption, converter death, save/load and ID reuse.

4. LOW — The committed benchmark identifies the wrong engine artifact. `docs/work/116_fog-memory-own-buildings/plan.md:51` attributes measurements to engine 2.6.1, while the installed executable module declares 2.5.0 at `node_modules/civ-engine/dist/version.js:7`; package metadata alone does not identify executed code. This weakens reproducibility of the performance evidence. Fix: identify the measured compiled artifact and its version/digest. A concurrent, uncommitted edit already corrects this distinction, but it is absent from the reviewed commit.

Consumer audit: No additional functional consumer requiring a standing own building’s memory was found. Outside the diff, `src/game/simulation/bridge/visibility.ts:125` projects positioned, renderable entities without fog filtering; `renderStateOps.ts:64` admits owned entities; and `fogMemoryOps.ts:84` suppresses their memory views. Minimap, HUD and browser observations consume that projection. Hit-testing excludes memories (`src/input/entityHitTest.ts:314`), agent own-building observations use economy data (`src/game/playtest/agentSnapshot.ts:128`), and audio uses separate feeds. Vietnamese reveal skips the revealing owner’s Town Centers (`src/game/simulation/bridge/vietnameseReveal.ts:48`). Non-player-1 replay perspectives explicitly disable ghosts (`src/game/simulation/replay/makeReplayBridge.ts:121`).

Determinism and persistence: No new accessor-coherence, dirty-marking or render-cache defect found. Accessor reads share the cached map (`bridgeStateAccessor.ts:65`), both deletion paths set `changed`, and the output system flushes it (`bridgeSnapshotSystem.ts:23`). Tick/version invalidation covers equal-size memory changes (`renderStateOps.ts:79`). The new rule is deterministic given identical state; this inspection does not establish whole-game replay equivalence. Older recordings intentionally differ in fog memory when re-simulated. Exact recorded checkpoints are restored before stepping, so normalization is not immediate at every seek.

Other edge cases: No additional issue found for ordinary incoming conversion, farms, walls/gates, garrisoned buildings, forced AI control of player 1, teams or Spies. Farms cannot re-enter through the static-resource loop. Generation-aware deletion correctly preserves a different entity’s stored entry. Already-destroyed own-building ghosts in older saves remain, as the register acknowledges. A loaded finished match cannot perform “first-tick” cleanup because stepping is refused (`createSimulationBridge.ts:304`).

Tests: The seven cases have meaningful premises; none appears wholly vacuous. The edited-save conversion setup is adequate for its narrow ownership/vision/conversion assertion, although population bookkeeping is not made fully consistent. The recycled-ID setup adequately tests stored-entry preservation, not visible ghost rendering: rendering still deduplicates by ID alone. Important missing cases are the three findings above and recording/replay across conversion checkpoints. The “every building” deletion case excludes the Town Center, and the opening samples every 100 ticks rather than proving every tick.

Documentation: No additional conflict with §10.9’s shared-sight rule found. The ally/Spies and pre-existing-save ghost limitations are acknowledged. The own-building and conversion guarantees need correction through the fixes above.

Questions not settled:

- What colors does Definitive Edition display after an unseen building conversion?
- Which compiled engine bytes produced the recorded benchmark?
- Do conversion checkpoint replay and genuine historical-save cases pass dynamically? No tests, builds or probes were run, as requested.

Review scope remained `8be8f306` against `f906a255`; concurrent documentation edits were excluded. No files were changed.

### Claude (claude-opus-5-5[1m], max)

#### Findings

**1. MED: deleting or losing a building while an enemy Monk converts it still leaves the ghost**
- **Where:** the exception at `src/game/simulation/bridge/systems/fogMemorySystem.ts:108`; the forgetting pass at `:181-204`, which clears an entry only once its ground is seen; `src/game/simulation/bridge/entityDestroyOps.ts:232`, where `destroyBuildingEntity` touches neither fog memory nor conversion state; the Delete key path at `src/game/simulation/handlers/entityDeleteHandler.ts:46`.
- **What is wrong:** while `aoe2.conversionState` holds the player's building, the exception writes an entry for it (a finished building sees itself). Deleting the building before the flip, the usual answer to a conversion in AoE2, or losing it to enemy troops, takes its sight away with it. Nothing then clears the entry, so it is drawn as a ghost. That is the 2026-10-11 defect again.
- **Why it matters:** the new spec bullet (`design/spec-final.md:1512`) and the changelog (`docs/changelog.md:7`) both say, without exception, that a deleted or destroyed building of the player's leaves no ghost. The plan's audit only considered the flip.
  - It is dormant against the AI: AI Monks never get a convert task (`monkTaskOps.ts:156-199`), and Monks skip auto-aggression (`autoAggressionSystem.ts:124`).
  - It is reachable with this test file's own staged save, with a seat driven by an agent, and with any later AI that converts.
  - I confirmed this by reading the code, not by running it.
- **Suggested fix:** in `destroyBuildingEntity`, when `building.owner === HUMAN_PLAYER_ID`, delete the player's memory entry for that id if the generation matches, and mark `lastSeenStatic` dirty.
  - That covers the Delete key, melee kills and projectile kills (`damageBuilding` goes through the same function).
  - A building already converted away has owner 2 when it is destroyed, so it keeps its "as last seen" entry.
  - Add a test that stages the enemy conversion as the last case does, deletes the House mid-conversion, and asserts nothing is drawn. Otherwise, narrow the spec bullet and the changelog line.

**2. LOW: the exception accepts any `aoe2.conversionState` entry, and those entries go stale**
- **Where:**
  - `fogMemorySystem.ts:94,108`.
  - A target that is gone or a Monk with no path deletes only the Monk's task (`monkBehaviorSystem.ts:148-152,185-192`). A new order does the same through `clearMonkTask` (`monkTaskOps.ts:270-275`).
  - A unit target's entry is deleted when it dies (`entityDestroyOps.ts:224`); a building target's never is (`:232-377`).
  - The engine reuses ids last-in, first-out (`civ-engine/src/entity-manager.ts:12-18`).
  - Every world-state load prunes entries for dead ids (`hydrateFromWorldState.ts:150-170`).
- **What is wrong, and why it matters:**
  - **(a) Abandoned enemy attempt.** If the enemy Monk dies or gets a new order, the entry stays forever. That building is then remembered for the rest of its life and leaves the ghost if lost unseen. Dormant, since the AI never converts.
  - **(b) Reachable today.** The player's Monk (with Redemption) starts on an enemy building, and the player's army razes it before the flip. `{byOwner: 1}` stays under the dead id. The next entity created takes that id. If it is a building of the player's, `conversions.has(id)` is true and the building is remembered. The comment at `:102-107` ("a finished conversion attempt's … is dropped") assumes attempts clear their entry; they do not.
  - **(c) Determinism.** Live play keeps the stale key. Every load, and every replay world built from a snapshot (`createReplayWorldOnly.ts:25` → `bootScenarioOrLoad.ts:95` → `validateAndPruneHydratedState`), prunes it. If a replay is opened between the razing and the id's reuse, live play and the replay disagree on whether the recycled building is remembered, and `selfCheck` would flag `aoe2.lastSeenStatic`. The underlying `aoe2.conversionState` mismatch already exists on main; this commit makes fog memory depend on it.
- **Suggested fix:**
  - Only honour a converter that is an enemy: `const conv = conversions.get(id); const converting = conv !== undefined && isEnemyOwner(teams, conv.byOwner, humanPlayerId)`. At minimum, check `conv.byOwner !== humanPlayerId`.
  - Separately, as its own card because it changes saved state: delete `conversionState[id]` in `destroyBuildingEntity`, as `destroyUnitEntity` does, and record the existing replay mismatch in the register.

**3. LOW: the recycled-id test proves the entry is kept, not that the ghost is shown**
- **Where:** `tests/simulation/fogMemoryOwnBuildings.test.ts:220`; `fogMemoryOps.ts:84`; `renderStateOps.ts:64`.
- **What is wrong:** `getFogMemoryEntities` skips any entry whose id is live, and every entity the player owns is live. So while the player's House holds the recycled id, the destroyed enemy House's ghost is hidden. It reappears only when the player's House is gone.
  - The test checks only the slot.
  - Its name ("keeps a destroyed building's ghost") and register line 19 read as if the player can still see the ghost.
- **Why it matters:** on main the entry was overwritten, so that ghost was lost. Now it is kept, hidden, and comes back later. That is defensible, but nothing states or tests it. The id-only check was already there; this commit makes it matter for the player's buildings.
- **Suggested fix:** either rename the test to say the entry is kept, and assert it is not drawn while the id is live; or check id and generation together in `getFogMemoryEntities` (`ProjectedEntityView` carries `generation`), so the ghost stays drawn where it was, and test that.

**4. NIT: "in the player's colours" is claimed but not tested**
- **Where:** `fogMemoryOwnBuildings.test.ts:313-314`; spec `:1512`.
- **What is wrong:** the claim is true today, but nothing tests it. The test compares only `isMemory`, `x` and `y`.
  - `flipConvertedBuilding` (`monkBuildingConversion.ts:148-187`) changes owner, sight and tint inside the Monk system.
  - The visibility system moves the sight on the same tick, because `playerId` is part of the source fingerprint (`visibilitySourceSync.ts:116-125`).
  - Fog memory then sees owner 2 on ground the player no longer sees, so it keeps the owner-1 entry.
- **Suggested fix:** also assert `owner: 1` and the player's House tint.

**5. NIT: spec §10.9 now overstates what fog memory records**
- **Where:** `design/spec-final.md:1259` says "fog memory records what the sight saw".
- **What is wrong:** it no longer records the player's own buildings. AGENTS.md says to edit conflicting text rather than let two rules stand.
- **Suggested fix:** add "(the player's own buildings excepted, §12.1)".

**6. NIT: the changelog leaves out the old-save ghost**
- **Where:** `docs/changelog.md:7`, "Saves load as before and drop those entries on their first tick".
- **What is wrong:** if an older save already holds a ghost of a building of the player's that was destroyed, that ghost stays until its ground is seen. Register line 19 and the plan's Decisions say so. The changelog, which is written for outside readers moving their saves over, does not.
- **Suggested fix:** add one clause saying so.

**7. NIT: an OPEN register entry rests on a probe that is not in git**
- **Where:** `docs/learning/defect-register.md:15` cites `tmp/probes/allyGhostProbe.mjs`. `.gitignore:151` ignores `tmp/`, and the fleet rules delete task evidence once the task ends.
- **Why it matters:** the only reproduction of the ally ghost, which is still open, will disappear.
- **Suggested fix:** turn it into a test (for example an `it.fails` next to `sharedVisionEntities.test.ts:158`), or write its steps into the entry.
- **Smaller still:** `plan.md:35` says `vietnameseReveal.ts` writes "enemy Town Centres". It writes every other player's, allies included (`vietnameseReveal.ts:48`).

#### Areas with no issue

- **1. Who reads the entries: the claim holds.**
  - The engine's `RenderAdapter` projects every live entity when it connects and every changed entity on each tick (`civ-engine/src/render-adapter.ts:160-176,216-225`). The projector has no `shouldProjectChange` and returns null only when position or renderable is missing (`visibility.ts:125-131`).
  - The `on-read` mode and the out-of-band refresh both project on read (`createSimulationBridge.ts:182-209`). The owner pass (`renderStateOps.ts:64`) puts every owned id into `liveIds`.
  - The replay bridge zeroes both memory getters for any perspective other than player 1 (`makeReplayBridge.ts:121-124`). For player 1 it uses the same owner pass.
  - `vietnameseReveal.ts:48` writes only other players' Town Centres.
  - Of the other readers, the minimap (`minimap.ts:327`) draws memory markers; hit-testing (`entityHitTest.ts:314`, `aoeVoxelHitProxy.ts:47`) and drag-selection (`isoViewHelpers.ts:21`) skip memory views.
  - The HUD and the agent API (`browserTestAgentApi.ts:120`, which reads the tick only) do not use memory entries.
  - Searching the tracked tree for the slot, the codec and both getters finds no AI, audio or game-rule reader.
- **2. Determinism and persisted state.**
  - The accessor caches one live Map per slot for the life of the bridge (`bridgeStateAccessor.ts:65-76`), so the fog system sees the Monk system's writes from the same tick. Reading never marks a slot dirty.
  - The drop sets `changed`, so `noteMemoryChanged` marks the slot dirty (`fogMemoryOps.ts:69-71`).
  - The render cache key includes the tick (`renderStateOps.ts:77-86`), so a drop is never served stale.
  - The replay viewer does not run `selfCheck` on open (`ReplayController.ts:392-402`), and the engine's `openAt` does not compare state, so older recordings still open.
  - The playtest corpus records fresh bundles, so it is not affected.
  - The only divergence I found is 2(c).
- **3. Other edge cases.**
  - When the player converts an enemy building, the flip and the drop happen on the same tick, because the Monk system (`registerAllSystems.ts:329`) runs before fog memory (`:428`).
  - A flip needs at least 50 ticks (`bridgeConstants.ts:56-57`), so the exception's entry exists long before an enemy flip.
  - The skip is by owner, so foundations, walls, gates, allies and Spies all behave as intended.
  - Farms are skipped in the building loop, and `farm` is not a remembered resource type (`prototypeUnitRules.ts:124`).
  - A garrisoned building cannot be converted while occupied (`monkBuildingConversion.ts:94`).
  - Defeat transfers no ownership.
  - `forceAiForOwners` leaves the player id at 1.
  - The schema-1 test arm really goes through `hydrateFromSavedGame.ts:239`, because `bootstrapFlush.ts:106` writes it to world state before the premise is read.
- **4. Tests.** The other five cases have real premises and, by the plan's mutation results, go red on main.
  - The edited save in the last case leaves population supply wrong: the flip subtracts the House's 5 from a player that never had it.
  - The recycled-id case uses a raw `world.destroyEntity`, which leaves the old House's health entries on the new id.
  - Neither of those touches fog memory.
  - Untested: finding 1's case, an abandoned conversion, the colours, and a record-then-`selfCheck` run through a conversion.
- **5. Docs.** Otherwise accurate. The register heading keeps the entry OPEN, as the rollover rule requires.

#### Not settled

- I ran nothing; findings 1 and 2 come from reading the code. The full gate (`npm run verify`) has not run on this commit, since the plan's Phase 2 is still open. Typecheck and lint of the new test are therefore unverified; the command literals match `commands.ts:40,74`.
- Whether Definitive Edition redraws a converted building in its new owner's colours. The spec already says this is not verified.
- Whether the bare House the recycled-id test creates inside `runMaintenance` is ever drawn. The test result does not change either way.
- Schema-2 saves from 2026-05-04 to 2026-07-11 hold entries with no `generation`, so the new drop's `===` never matches them. The forgetting pass removes them on the first tick their ground is seen, because `isCurrent` with an undefined generation is false. A foundation nobody sees would keep its entry. I did not trace this further.
- Whether stale conversion entries already make recordings of human play fail `selfCheck` on main.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | The conversion exception still went through the visibility test, so a foundation of the player's that nobody sees, converted by an enemy Monk, lost its entry and vanished after the flip (Codex 1, MED). | Accepted. A foundation gives no sight, so the exception must not depend on it. | The exempt building is remembered whatever the fog. Test "keeps a foundation of the player's that nobody sees on the map when an enemy Monk converts it"; mutation M6 turns it red. |
| F1 | A building deleted or destroyed while the exception kept its entry left the ghost, and so did one deleted on the first tick after loading an older save (Codex 2, MED; Claude 1, MED). | Accepted. Both reviewers suggested clearing the entry in `destroyBuildingEntity`; that file is not this card's, so the same rule went into the fog-memory pass instead: an entry recorded as the player's is forgotten the moment its building goes, seen or not. It also clears the ghosts that older saves already hold, which Claude's F7 asked the changelog to admit. | Test "leaves no ghost of a building the player deletes while an enemy Monk converts it" and the old-save case's lost House; mutation M7 turns both red. |
| F2 | `aoe2.conversionState` is not an active conversion: its entries outlive an abandoned attempt, a converter's death and a razed target, carry no generation, and are pruned on load, so a recycled id could be exempted and live play and a replay could disagree (Codex 3, MED; Claude 2, LOW, with a case reachable today through the player's own Monk). | Accepted. | The exception now reads other players' convert orders from `aoe2.monkTasks`, by the target's identity. Tests "forgets the building once the enemy Monk is called away" and "remembers no building of the player's that takes the id of an enemy building razed mid-conversion"; mutation M9 (the exception read from `aoe2.conversionState` again) turns both red. The stale `aoe2.conversionState` entries themselves are F10. |
| F3 | The plan named engine 2.6.1 for the measurements; the module the game loads declares 2.5.0 (Codex 4, LOW). | Accepted. | The plan names the sibling's `dist/` and its `ENGINE_VERSION` 2.5.0. |
| F4 | The recycled-id test showed the entry is kept, not that the ghost is drawn; while the player's building holds the id the ghost is hidden, because the render state matches memory to live entities by id alone (Claude 3, LOW; Codex noted the same). | Accepted in part. The id-only match is in `fogMemoryOps.ts`, not this card's file, and predates it. The staging cannot show the hiding: the render store never hears of an entity made inside `runMaintenance`. | Test renamed to say the entry is kept, and it now also checks that the destroyed House is drawn from memory once the player's House is gone. The plan's Decisions record the hiding. |
| F5 | "In the player's colours" was claimed but not tested (Claude 4, NIT). | Superseded. Repairing F1 needed the converted building's entry to stop naming the player, or the new forgetting rule would erase the ghost of a building converted away and later lost out of sight; so the entry is now refreshed once at the flip and drawn in the new owner's look. | The conversion tests assert owner 2 and owner 2's tint; mutation M8 turns them red. The spec says DE's drawing of this case is not verified. |
| F6 | Spec §10.9 says "fog memory records what the sight saw", which the change makes false for the player's own buildings (Claude 5, NIT). Codex reported no conflict with §10.9. | Accepted. That paragraph is not this card's line to edit, so a new paragraph after it names the exception and points to §12.1. | `design/spec-final.md`, after "Shared sight shows everything in it". |
| F7 | The changelog said nothing of the ghost an older save already holds (Claude 6, NIT). | Superseded by F1's repair: those ghosts are now dropped on the first tick. | The changelog line says so. |
| F8 | The OPEN register entry cited a probe under the ignored `tmp/`, and the plan said the Vietnamese reveal writes only enemy Town Centres (Claude 7, NIT). | Accepted. | The register entry carries the probe's steps; the plan says every other player's Town Centres, allies' included. |
| F9 | A loaded match that has already ended never steps, so its first-tick drop never runs (Codex, edge cases, no severity). | No change. Its entries for the player's buildings are never drawn: those buildings are live, and nothing steps. | None. |
| F10 | `destroyBuildingEntity` never deletes a building target's `aoe2.conversionState` entry, while every load prunes it, so main already has a live-against-replay mismatch in that slot (Claude 2, offered as its own card). | Outside this card: `entityDestroyOps.ts` is not its file, and this change no longer reads the slot. | Recommended to the coordinator as a separate card. |

## Verification

Run by the author on the repaired working tree, after both reports (none of it on `8be8f306` itself, which round 0 reviewed):

- `npx vitest run` on the two gate files: 11 of 11 pass. Each of the nine mutations M1-M9 in the plan turns at least one case red, and the source file's sha256 matched before and after the run.
- The affected suites and `tests/architecture`: 51 files, 372 tests, exit 0.
- `npx tsc --noEmit` exit 0; `npx eslint` on the changed source and test files exit 0.
- The repaired tree, loaded from the saved 30,000-tick world, writes a slot byte-identical to `8be8f306`'s at tick 30,001.
- Not run: `npm run verify` (phase 2), and the interleaved A/B on the repaired code.

## Round outcome

The consumer claim held under both reviewers; nobody found a reader of an entry for a standing building of the player's. The three MED findings (F0, F1, F2) were real defects in the conversion exception and are repaired; F3-F8 are repaired or answered, F9 needs nothing, and F10 is recommended as a separate card. The repair changes the reviewed logic, so a focused round 1 on the repair diff is required before landing.
