# Defect register

The standing list of what the gates could not see. One entry per defect that reached a build: the symptom as it presented, what the investigation found, the root cause, and the check that covers the defect's whole CLASS from now on.

Unlike a lesson, an entry stays after it becomes a gate. The register is not a to-do list — it is the record of where defects came from, which is the best available guide to where the next one is.

## 2026-08-23 — Two buttons that did nothing: the Transport Ship, and the Goths' Huskarl at the Barracks

**Symptom.** Clicking `Train Transport Ship` at a Dock did nothing at all: no unit, no queue entry, no resources spent, no error, no toast. The button rendered as enabled. In a browser probe on `naval-imperial-fixture`, wood stayed at 2000 across the click while the same click on `Train Fishing Ship` charged 75. The Transport Ship is the only way a land army crosses water, so the effect was that a documented, menu-visible mechanic could not be used at all in a real game. The same defect was live for the Goths' Huskarl: their Anarchy unique technology is supposed to move the Huskarl into the Barracks, and the button appeared there and did nothing.

**Investigation.** The train MENU and the train VALIDATOR read two different tables. `trainOptions.ts` builds the card — and it offers `transport-ship` at the Dock from the Feudal Age, and the Anarchy unlock through `unlockedTrainingFor`. `TRAINABLE_UNITS_BY_BUILDING` in `buildingProductionTables.ts` is what `canTrainAt` consults when the command is validated, and it listed neither. So the UI accepted the click, the validator refused the command, and nothing reported the refusal — the worst possible failure shape, because there is no error to notice.

**Root cause.** Two tables that must agree, with nothing making them agree. Every unit added to a menu had to be remembered in a second place, and twice it was not. The Transport Ship shipped this way in the naval slice; the only transports that ever existed were spawned by fixtures, which is exactly why every naval test passed.

**How it is checked from now on.** `tests/simulation/menuMatchesValidator.test.ts` enumerates what the train menu can offer across every building, all four ages, all 30 civilization names and both extremes of the researched set, and asserts the validator accepts every one of them. It caught both instances on its first run. A companion assertion checks the mirror direction for technologies — every technology with a cost is hosted by some building — and the Transport Ship is pinned by name as well, so a regression names the unit rather than only the class.

**What this predicts.** Any pair of tables that must agree and are not derived from each other is the same defect waiting to happen. The menu/validator pair is now gated; the remaining pairs of this shape (armor-class tables vs stat tables, render recipes vs the roster) are where to look next.

## 2026-08-23 — The research half of the same pair: two elite naval upgrades

**Symptom.** A Viking Dock showed `Research Elite Longboat` and a Korean Dock showed `Research Elite Turtle Ship`. Both clicks were silently refused — no charge, no queue entry, no error. Each civilization's unique ship could be trained and could never be upgraded, so half of two civilizations' naval identity was unreachable.

**Investigation.** Found by WIDENING the gate written for the Transport Ship defect above, not by a report. That gate checked the train pair tightly (per building) and the research pair loosely (a technology must be hosted by SOME building). Tightening the research side to per-building — every technology a building's card offers must satisfy `canResearchAt(thatBuilding, tech)` — failed immediately with both names.

**Root cause.** The same missing derivation as the entry above: `optionsRules` computes the Dock's card, `RESEARCHES_BY_BUILDING` decides what the Dock accepts, and nothing tied them together. The loose check passed because the CASTLE's research list contains every elite upgrade, including the two naval ones, so "hosted somewhere" was satisfied by the wrong building.

**How it is checked from now on.** The per-building assertion in `tests/simulation/menuMatchesValidator.test.ts`, over every building x 4 ages x 30 civilizations x both tech extremes, for the researchable list AND the visible (locked-but-drawn) list. The two upgrades are additionally proved end to end in `dockTechs.test.ts`: a Viking and a Korean Dock complete the research in a real match.

**What this predicts.** An aggregate assertion ("hosted somewhere", "exists in some table", "appears in the union") is not coverage of a MAPPING. Where two tables are keyed by the same thing, the check has to be keyed by that thing too.

## 2026-08-23 — The mirror direction: an upgrade the tables hosted and no card offered

**Symptom.** The Skirmisher line never improved in a real game, six versions after the tier was added to fix exactly that. An Archery Range never offered `Research Elite Skirmisher`, so no player could start it; the unit existed, cost what units.csv says, and was unreachable.

**Investigation.** Found by running the menu/validator gate in the direction it did not cover. That gate asserted menu ⊆ table: every button a card draws must be one the validator accepts. The mirror, table ⊆ menu — every technology a building HOSTS must be offerable by some card, for some age, civilization and researched set — reported one entry: `archery-range: elite-skirmisher-upgrade`. `optionsRules`' archery-range block offered the Crossbowman, Arbalest, Heavy Cavalry Archer and Thumb Ring, and had never gained a line for the Skirmisher line's only upgrade.

**Root cause.** Same missing derivation as the two entries above, in the other direction. v0.3.45 added the unit to `UnitType`, the stats to every table, the upgrade to `UNIT_LINE_UPGRADES`, the cost to `RESEARCH_COSTS` and the entry to `RESEARCHES_BY_BUILDING` — every table the typechecker enumerates — and the option list is not a table the typechecker enumerates.

**Why the tests said otherwise.** The browser test asserting the Elite Skirmisher was reachable booted `new-unit-reach-fixture`, whose owner starts with `elite-skirmisher-upgrade` ALREADY RESEARCHED so the train menu would resolve to the new tier. It proved the unit could be trained once you had the upgrade, and said nothing about getting the upgrade. **A fixture that grants the thing under test cannot test how the thing is obtained.**

**How it is checked from now on.** The mirror assertion in `tests/simulation/menuMatchesValidator.test.ts` (table ⊆ menu, over every building x 4 ages x 30 civilizations x two tech states per candidate, including the all-but-this-one state that satisfies prerequisites), plus an end-to-end test in `unitLineTiers.test.ts` that researches the upgrade through the menu in a real match and asserts the train entry resolves from `skirmisher` to `elite-skirmisher`.

**What this predicts.** Look at what each fixture PRE-GRANTS before trusting what a test proves. A `startingResearchedTechnologies` list is a list of things that test cannot check.

## 2026-08-24 — Two AIs that never fought each other

**Symptom.** A deterministic 12000-tick all-AI match on the default map ended with `enemyMilNearBase = 0` for both owners at every sample. Twenty minutes of game time, one owner holding 15 military units in Castle Age, and not one engagement. In a skirmish with more than one AI player, the AIs would build side by side until the clock ran out.

**Investigation.** Found by PLAYTESTING, not by a test — the whole simulation suite was green, and stayed green after the fix. `aiSystemAttackPhase` chose its target with `findOwnedUnit(humanPlayerId, 'villager')` and `ctx.humanTownCenterId`: the human player, by id, and nobody else. An AI in the human slot therefore had itself as its target and never marched. A discriminator fixture (two AI armies 32 cells apart, vision 4, so neither can see the other and auto-aggression cannot fire) measured it exactly: owner 1's closest approach to the enemy base was 31 cells — it never left home — while owner 2 marched to within 4.

**Root cause.** A rule written for the only case anyone tested. Human-versus-AI is the shipping configuration, the human IS the AI's nearest enemy there, and every AI test in the suite is that configuration — so the identifier and the intent agreed everywhere the tests looked.

**How it is checked from now on.** `tests/simulation/aiAttacksAnyEnemy.test.ts`: the two-AI march discriminator, plus direct tests of the target choice (two players picks the other; several picks the nearest; ties break on the lower owner id; a base-less AI still picks somebody; no enemy Town Centers means no target). The march test fails without the fix, at 900 ticks.

**What this predicts.** Any rule keyed on `humanPlayerId` is a rule that only works in the configuration the tests use. The remaining ones are worth reading with this in mind — the villager auto-gather gate was already found to be one of these (2026-07-02), which makes this the second.

**Audited 2026-08-24, same session.** Every remaining `humanPlayerId` reference in `src/game/simulation` was read. They fall into three legitimate groups and none is a third instance: INPUT (a player may only command their own units — `unitCommandOps` gating a context-click on `unit.owner !== humanPlayerId`), VIEW (selection, fog memory, render state, minimap — the screen belongs to one player), and REPORT (`winConditionResolverSystem` and `matchEndOps` label the outcome `victory` or `defeat` from the human's seat, and break a wonder-tick tie in their favour). The simulation RULES that were keyed this way are the two already fixed: the villager auto-gather gate (2026-07-02) and the attack target (this entry). Visibility itself is per-owner (`isVisibleToOwner(owner, …)`, `findPreferredVisibleEnemyUnit(owner, …)`), so an AI does not see through fog.

## 2026-08-24 — A stray arrow ended the match

**Symptom.** A 40000-tick AI-versus-AI run crashed at tick 24173: `EngineRangeError: visibility_out_of_bounds`, `Grid coordinate (33, -1) is out of bounds`, thrown out of the render projection. The match was healthy up to that point — both players in Castle Age, one being raided down from 20 villagers to 2 — and then the process exited.

**Investigation.** The stack is `refreshRenderProjection` → `projectFrame` → `visibleProjectiles` → `visibility.isVisible(playerId, x, y)`. The coordinate has y = -1, so a projectile was above the top edge of the map. `projectileMissAimPoint` offsets the aim from the target by a hash-driven direction and distance with no knowledge of the board, so a shot at a target standing on an edge can be aimed off it — and the interpolated flight position then leaves the map. The engine's `VisibilityMap.isVisible` asserts its argument is in range and throws rather than answering false.

**Root cause.** Two independent gaps that only matter together: the simulation could produce an off-map projectile, and the presentation asked a question about it that the engine treats as an error. It stayed hidden because it needs a target on the very edge of the map AND a miss rolled outward AND a fight near an edge — which is why it only appeared once AIs started actually fighting each other (v0.3.54, the previous entry).

**How it is checked from now on.** `tests/simulation/projectilesStayOnTheMap.test.ts`: 240 shots at targets on every edge and corner assert the aim stays inside the map, a scatter check keeps the clamp from degenerating into a bullseye, and the projection is handed an `isCellVisible` that THROWS out of range — the engine's real contract — and must omit the shot instead. Two of the four fail without the fix, with the production error message.

**What this predicts.** Engine calls that ASSERT rather than answer are a defect class of their own: every coordinate this repo passes into an engine query has to be range-checked on this side. Visibility was one. The others worth reading with this in mind are pathing and occupancy queries fed by anything interpolated or scattered.

**Audited 2026-08-24, same session.** Every `visibility.isVisible` / `isExplored` call site in `src/game/simulation` was read and classified by where its coordinate comes from. Entity positions (unit deaths, AI target checks, fog memory, target finding, selection) are always on the map, because occupancy keeps units there. The two that walk a FOOTPRINT from an anchor — `isFootprintVisible` and `isFootprintExplored` in `pureHelpers` — range-check nothing, and are correct only because a building's cells are all on the map. That guarantee was not pinned anywhere, so it is now: `placementSearch.test.ts` confirms a 4x4 building anchored at each edge and corner is REFUSED rather than placed or thrown on. Empirically the placement path already refused all four (`confirmed=false`), so no second instance existed — but the invariant those helpers depend on is now a test rather than an assumption.


## 2026-08-29 — Every gate a player built stayed shut to them

**Symptom.** Reported out of an independent review of v0.3.160, not from play: a Palisade or Stone Gate raised during a match never admits its owner's units. Walling your own base is a way to lock yourself out of it — the one thing a gate exists to prevent. Every gate test in the repo passed.

**Investigation.** `cellPassability.admitsThroughGate` computed completion as `!constructionStatesCodec.has(entity)` — "there is no construction record, so it must be finished". That is true of a scenario-SEEDED building, which never gets a record at all, and never true of a BUILT one: `finalizeBuildingConstruction` sets `construction.isComplete = true` and deliberately keeps the record (build progress and population supply are read from it afterwards). Every gate in every fixture is seeded, so the whole gate suite — owner passes, enemy blocked, ally passes, unfinished blocks — exercised only the branch where the shape happens to agree with the field.

**Root cause.** A state predicate inferred from a data structure's SHAPE (entry present or absent) instead of the FIELD that records it. Every other completion reader in the simulation uses `construction.isComplete`, including the economy snapshot two files away; this one call site inferred it, and drifted the moment the finalize path stopped deleting entries.

**Second defect underneath it.** A gate finishing changes who may pass a cell without claiming or releasing anything, so it does not move `worldOccupancy.structuralRevision` — the counter v0.3.160's unreachable-plan cache keys on. Fixing the gate alone would therefore arm a stale cache: a unit that gave up while the gate was a foundation keeps refusing the route after it opens. Measured, not theorised — with the fix in place and only the new `notePassabilityChange()` call disabled, the villager never uses the route its own gate opened.

**How it is checked from now on.** `tests/simulation/gateBuiltInMatch.test.ts` walks a gate that is BUILT rather than seeded: the owner crosses it, the enemy does not, a foundation shuts everyone out, and a villager whose route was sealed under it mid-walk resumes once the gate opens. The first and last both fail without their respective fixes. The fixture (`gate-built-in-match-fixture`) is the seeded gate fixture with the gate row left open for the player to close, so the built path can never again be tested only through seeded buildings.

**A second instance of the class, found by the review of this fix and NOT yet fixed.** `cellPassability.isCellPassableForUnit` short-circuits every water-domain unit onto any passable water cell, justified by the comment "water cells hold no buildings or land resources". That stopped being true when the Fish Trap shipped as a water building (`shorePlacement.ts` lists it under water placement), so ships sail straight through fish traps. Same shape as the gate bug exactly: a passability predicate whose justifying comment quietly went stale when a later feature landed. Spawned as its own task rather than folded in here.

**What this predicts.** Two classes worth reading with this in mind. First, shape-inferred state: every other `constructionStatesCodec` reader was audited this session and uses `isComplete` — the class is closed for construction, but any predicate written as "the map has no entry, therefore X" is one refactor away from this. Second, and larger: a fixture family that only ever exercises the seeded path. Gates were tested exclusively through scenario-placed buildings for the whole life of the feature. Anything a player can BUILD deserves at least one test that builds it, because seeded and built entities differ in exactly the state that completion, population, and progress are read from.


## 2026-08-29 — main's CI had been red for two months, and nobody looked

**Symptom.** Found by watching the remote gate after a push, which the fleet canon requires and this session had not been doing. `gh run list --branch main --workflow CI --limit 200` returns **200 runs and zero successes**, back to 2026-07-07. Every push in that window went out behind a green local gate. Five of them were mine, this session.

**Investigation.** Two independent causes, one per platform, both in the "Fetch pinned voxel source" step shared by `ci.yml`, `playtest.yml`, and `playtest-llm.yml`.

*ubuntu-latest* built `voxel@0.1.4` while the working tree builds against `voxel@1.2.0`: `.github/voxel-commit` still pinned `faa00bf2`, so typecheck failed on APIs that exist only in the newer voxel (`MOEBIUS_RESOLVE_PRESET`, `StylizedResolveOptions`, `setStylizedResolve`, the `stylizedResolve` runtime option). The local gate cannot see this: it builds `../voxel` at whatever the sibling checkout happens to be, which is the pushed HEAD.

*windows-latest* never got that far — it died in the fetch with `tar (child): Cannot connect to D: resolve failed`. `$RUNNER_TEMP` on a Windows runner is `D:\_temp`, and GNU tar reads a leading `D:` in an archive path as `host:path`. The sibling civ-engine step was written with a relative archive path and so never hit it.

**Root cause.** A pinned dependency with no mechanism tying the pin to what the code actually requires, plus a platform-specific path bug in the step that fetches it — and, above both, nobody reading the remote gate. The canon already carried this exact lesson from the Voxel repo's five-week outage ("the local gate and the remote gate run on different machines, and only the remote one is what a collaborator sees"); aoe2 then ran the same failure for twice as long.

**A third cause, found while fixing the first two — and the reason they lasted.** CI ran only on pushes touching `package.json`, `package-lock.json`, or `.github/voxel-commit`. A workflow file was not in that list, so **a fix to CI could never trigger the CI that would prove it**: the Windows tar fix went out invisibly, and the only way to learn whether it worked was to push something unrelated and remember to look. `playtest.yml` had the identical gap for `playtest-corpus.json`, the config its own gate reads. Both now include `.github/workflows/**` (and the corpus its config) in the filter, with `workflow_dispatch` alongside.

**Resolved 2026-08-29.** CI green on ubuntu AND windows — the first fully green run since 2026-07-07 — and playtest-corpus green behind it. The Windows fix took two attempts because the first made the symptom MOVE rather than vanish: with the archive path fixed the job died one line later on `-C`, since Git-bash mangles a drive-lettered path wherever it appears, not only after `-f`.

**How it is checked from now on.** The pin is advanced to voxel's pushed HEAD (`08398b57`, 1.2.0) and every path in the fetch step is relative in all three workflows. `npm run ci:status` prints both gates' conclusion AND the length of the current streak, exits non-zero on red, and the session-start ritual in AGENTS.md names it, so "read the remote gate first" is a command rather than a good intention.

**What this predicts.** A gate that cannot be triggered by a change to itself is untestable by construction, and every path filter deserves reading with that question. Any pin whose correctness is only checked on a machine that does not use it will drift: the voxel commit here, and by the same shape the civ-engine `engine-dist` tarball, which the local gate also never fetches. And a red gate nobody reads is indistinguishable from no gate at all — the count is the tell. A run list that is uniformly one colour, in either direction, deserves suspicion before it deserves trust.


## 2026-08-29 — On the map the game boots, one AI never banks food (OPEN)

**Symptom.** `aoe2-prototype` is `DEFAULT_SEED` — the map a player lands on. Run it all-AI and owner 1 reaches Feudal around tick 16,000 while **owner 2 is still in the Dark Age at tick 24,000** (40 minutes of game time). Reproduced on `corpus-seed-b`. The measured anomaly is income, not headcount: across 10,000 ticks owner 2's food **never exceeds ~50 and repeatedly reads 0**, while 7 to 10 of its villagers are alive and working. Its Feudal age-up needs 500.

**Why no gate caught it.** `progressionCheck` passes when ANY living owner reaches the required age (`reached.some(...)`), so a permanently frozen second player is structurally invisible to the corpus gate. The gate is green on a match where one side never plays.

**Ruled out, each by measurement.** Not enemy raids on the base: the Town Centers are 43 tiles apart, the nearest owner-1 unit sits 15-50 tiles from owner 2's Town Center at every sample, never inside the AI's `RAID_RADIUS` of 8, and both players' building counts grow. Not wildlife: the wildlife damage path was instrumented to log every kill it makes, and it logged NONE while the counts moved. Not gather assignment walking villagers onto a live boar: read at component level off `gatherer.targetResourceId`, zero villagers ever target one. Not villager auto-aggression: wildlife are resources, not units, so the stance system's `unit` query cannot see them. Not sheltering: villagers garrison only twice in 10,000 ticks (2 and 4 of them) and are back out by the next sample.

**A correction, because the first version of this entry got it wrong.** It claimed "ten villagers are lost in clusters", read from `getEconomyState().units`. That snapshot is built from `world.query('position', 'unit')`, and garrisoning REMOVES a unit's `position` component — so sheltering villagers silently drop out of it and reappear later. Measured against the authoritative world entities, the snapshot showed 3 villagers while 7 were alive. The oscillation was mostly visibility, not death; the real attrition is mild (10 to 7 over 10,000 ticks). Any future probe counting units must count world entities, or state explicitly that it is counting the POSITIONED ones.

**Measured: the villagers walk instead of gathering.** Sampling owner 2's villager task every 50 ticks for 10,000 ticks, against the same measurement for a seed where the AI DOES age up:

| | `aoe2-prototype` (stuck) | `default-seed` (ages up) |
|---|---|---|
| gathering | **32%** | 62% |
| walking to a resource | 32% | 22% |
| hauling back | 21% | 13% |
| idle | 9% | 0% |

Half the gathering share, and more time in transit than at the resource. With ~8 villagers that is roughly one villager-equivalent actually on food, ~0.33 food/s gross, which villager training at 50 food each consumes entirely — hence a stockpile that never passes 50.

**Four more causes eliminated.** Drop-off placement is not it, and is in fact BETTER than the winning player's: at tick 10,000 owner 2 holds mill at distance 2 and lumber-camp at 4, with berries 3 tiles out and a 1-tile haul, while owner 1 ages up with its nearest sheep **41 tiles** away. Reassignment churn is not it: role flips number 2-4 per player across 10,000 ticks, so the v0.3.159 no-inversion guard is holding. Target switching is only modestly higher for owner 2 (150 vs 105) and is ordinary depletion. And the Dark-Age gold villager (12% of owner 2's villager-time) is DELIBERATE — `aiDecisionOps` documents it as the canonical AoE2 fourth-villager opening and warns that removing it breaks age progression.

**One cause found and FIXED (v0.3.162), and it was not the whole story.** Tracing a single owner-2 food villager tick by tick — the instrument this entry asked for — caught it standing IDLE for 211 ticks holding a full carry of 10 food. `assignNearestResource` set `task = 'idle'` at both of its no-target branches, and the idle-to-assign path re-ran assignment, found nothing again, and left the load in the field. Fixed: a villager that cannot find work now hauls what it is carrying (`parkOrDeliver`), pinned by `tests/simulation/loadedVillagerDeposits.test.ts`. Measured effect on this map: owner 1's Feudal moved from ~16,000 to **12,500 ticks**, a 3,500-tick gain — it had been leaking carries the same way, just not enough to freeze. **Owner 2 is still Dark-Age at 20,000**, so the freeze has at least one more cause.

**The sharpened question.** With resources 3-4 tiles away and a 1-4 tile haul, a §6.3 gather cycle should be ~78% gathering; owner 2 measures 32%. Where does the REMAINING transit time go? The untested candidates are traffic — villagers queueing or yielding at a contested patch, which `movementTrafficOps` arbitrates — and assignment sending villagers past the near resource to a farther one. Instrument the per-villager trip: for one food villager, log its target, its distance to that target, and its tick-by-tick position for a few complete cycles. A single traced round trip will show whether the time goes to distance, to blocking, or to re-targeting.

**What this predicts.** A gate written as "did anyone progress" cannot see the player who did not, and every such `some()` deserves re-reading as a blind spot. And a snapshot assembled from a component query silently omits whatever loses that component — `position` for garrisoned units here; the same shape will recur wherever a view is built from `query(...)` rather than from ownership.
