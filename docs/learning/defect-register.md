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

**A second instance of the class, found by the review of this fix — FIXED in v0.3.164, see its own entry below.**

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


## 2026-08-29 — On the map the game boots, one AI never banks food (RESOLVED v0.3.163)

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

**Narrowed, then partly RETRACTED (2026-08-29, after the v0.3.162 carry fix).** Owner 2's phase budget is 48% walking to a resource, 36% idle, 8% hauling, **8% gathering** — against owner 1, which ages up normally on the same map.

I first reported that "all six villagers sit idle with `targetResourceId=null` amid abundant resources". That was a SINGLE-TICK sample and it does not hold up. Measured across 1,000 ticks: **owner 2 holds a target 77% of the time, owner 1 100%**. The gap is real and worth explaining, but it is a 23% orphan rate, not a total failure — and the dramatic reading was exactly the one-tick trap this entry warns about two paragraphs down. I made it anyway, one iteration after writing the warning.

**What is solidly established.** Assignment is not failing: instrumented over 200 ticks it runs for owner 2, its candidates pass the harvestability and kind filters, and it never takes a no-target branch. Nothing is abnormally clearing targets either: every `targetResourceId = null` site was tagged and only THREE fired in 200 ticks, all from `dropOffStep` after a normal deposit. So targets are set and mostly kept — yet gathering is 8%. The time is going into transit against targets the villager is far from (the not-moving histogram put most of it at 9+ tiles), while near nodes sit unused: 6 berry bushes, 2 sheep, 4 gold mines, 4 stone mines and 30+ trees within 8 tiles, all `baseOwner=2` or unowned, with `MAX_GATHERERS_PER_RESOURCE = 2` giving ample capacity for six villagers.

**ROOT CAUSE, found by that exact measurement.** Instrumenting the distance at the moment of assignment: owner 2's food targets sit a **median 7 tiles** away against owner 1's **3**, and owner 2 reassigns **59 times in 1,000 ticks against owner 1's 16**. A 7-tile walk at §12.4.2 speed takes ~87 ticks — and `GATHER_APPROACH_TIMEOUT_TICKS` was a flat **80**. The villager abandoned its target JUST before arriving, was reassigned to another far target, and repeated forever.

That constant is a v0.3.160 casualty. It was written when a unit moved 0.5 tiles/tick, so 80 ticks bought ~40 tiles of walking and only a genuinely queued villager reached it; the honest movement clock walks 0.08 tiles/tick, turning the same 80 ticks into 6.4 tiles. Owner 1's 3-tile food (~37 ticks) never crossed it, which is exactly why the freeze looked map-specific.

**Fix (v0.3.163).** `gatherApproachBudgetTicks(distance)` makes the fan-out budget a TRAVEL allowance — the walk the villager was actually handed, plus margin, with a floor — so it tracks any future change to the movement clock, which a bare tick count cannot. Pinned by `tests/simulation/gatherApproachBudget.test.ts`: the budget must always outlast its own walk, must stay bounded so fan-out still fires, and must grow with distance.

**And a gate that can SEE it (v0.3.164).** The reason this hid for a whole session is structural: `checkAgeProgression` passes when ANY living owner reaches the age, so a match where one side never plays reads green. `checkEveryOwnerAgeProgression` is the strict companion — every LIVING owner must have reached it, with eliminated players still exempt because losing is not a stall — opt-in per corpus row via `requireAgeForEveryOwner`. It is enabled on a new `boot-map-both-owners` row running `aoe2-prototype`, the map this defect lived on, where both owners now age up at 9,300 and 11,900, inside the 13,000 budget.

One hard constraint bounds this, and it is worth recording precisely: **the replay bundle has a length ceiling between 13,000 and 14,000 ticks.** `JSON.stringify(result.bundle)` in `scripts/playtest.mjs` throws `RangeError: Invalid string length` at 14,000, 16,000 and 18,000; 13,000 succeeds. So no corpus row can run longer than ~13,000 ticks at all, which caps every long-horizon gate this repo can have until the bundle is streamed or trimmed. That leaves the boot-map gate ~700 ticks of margin over its slower owner (12,300) — enough to catch a FROZEN player, which is dark-age at any budget, but thin against a merely slow one. (The v0.3.163 default-seed regression that first blocked this is gone in v0.3.165, so that row now reaches Feudal on both owners inside 13,000 as well.) And the gate was RED-CHECKED end to end rather than trusted for printing "ok": temporarily requiring `castle-age` made the corpus exit 1 with "a living owner never reached castle-age (behind: 2:feudal-age, 1:feudal-age)". A gate that has only ever passed is not known to work.

**Measured across three seeds — and CORRECTED after review (v0.3.165).** The first fix (v0.3.163) made the budget a function of the villager's CURRENT distance, recomputed every tick. Review showed that inverts the rule: the budget shrinks as the villager closes while its timer keeps running, so it fires at ~56% of any walk and, below 11.5 tiles, gives LESS reach than the flat 80 it replaced — 3.9 tiles into a 7-tile walk against the old 6.4. It also measured the walk with Euclidean `hypot` while movement steps ONE AXIS per tick (so travel is MANHATTAN, and the budget was short for anything more than ~18° off-axis), collapsed to its floor for a villager standing on the destination cell, and could exceed the 600-tick unreachable backstop past 38 tiles, inverting that documented ordering. Its test asserted the Euclidean model and so certified a property the game did not have.

The budget is now **flat, expressed in tiles** (32 tiles → 400 ticks at §12.4.2), which has none of those failure modes and still tracks the movement clock. Measured on all three seeds, it is strictly better than both predecessors:

| seed | flat 80 (pre-fix) | distance-based (v0.3.163) | flat 400 (shipped) |
|---|---|---|---|
| `aoe2-prototype` | 12,500 / **never** | 11,900 / 9,200 | 12,300 / **11,000** |
| `default-seed` | 12,200 / 10,100 | **15,800** / 10,300 | **12,100** / 10,400 |
| `corpus-seed-b` | 9,300 / 20,300 | 9,600 / 15,500 | 8,500 / **17,200** |

No frozen player on any seed, and the `default-seed` regression the first fix caused is gone. Two corrections to what this entry previously claimed: `corpus-seed-b` owner 2 was **20,300 with the old constant, not "never"** — one freeze plus one slowdown, not two freezes. And the honest description is that a constant was retuned and re-measured across three seeds, not that a single root cause explains every outcome: disabling the fan-out branch entirely also cures the `aoe2-prototype` freeze, and the metric is non-monotone in the budget on `corpus-seed-b`, so this is a tuned constant standing on measurement, not a proof.

**Measurement caution for whoever takes this.** Two traps already caught here. Comparing integer CELL positions to detect movement reports ~93% "not moving" for a perfectly healthy walker, because at §12.4.2 speed a villager changes cell only every ~12.5 ticks — compare fine positions or measure over a window. And sampling one tick proves nothing about a staggered system; the first version of this probe saw zero assignment calls and would have concluded assignment never runs. The untested candidates are traffic — villagers queueing or yielding at a contested patch, which `movementTrafficOps` arbitrates — and assignment sending villagers past the near resource to a farther one. Instrument the per-villager trip: for one food villager, log its target, its distance to that target, and its tick-by-tick position for a few complete cycles. A single traced round trip will show whether the time goes to distance, to blocking, or to re-targeting.

**What this predicts.** A gate written as "did anyone progress" cannot see the player who did not, and every such `some()` deserves re-reading as a blind spot. And a snapshot assembled from a component query silently omits whatever loses that component — `position` for garrisoned units here; the same shape will recur wherever a view is built from `query(...)` rather than from ownership.


## 2026-08-29 — Ships sailed through Fish Traps (RESOLVED v0.3.164)

**Symptom.** A Fish Trap is a BUILDING that stands on water — `shorePlacement`'s only water building — and every ship sailed straight through one. Found by the independent review of the v0.3.161 gate fix, not from play, and it is exactly the same defect class: a passability predicate whose justifying comment quietly stopped being true when a later feature shipped.

**Root cause.** `cellPassability.isCellPassableForUnit` short-circuited every water-domain unit to `return true` on any terrain-passable water cell, justified by "Water cells hold no buildings or land resources, so open water is clear". True when written; false since the Fish Trap landed. The predicate never consulted building occupancy for ships at all.

**A SECOND instance in the same file, found by auditing the class.** `isCellPassableForSpawnInDomain` carried the same claim in its own words — "Water carries no buildings or land resources, so a passable water cell is spawnable" — and returned `true` for water unconditionally, so a ship could also be placed on a Fish Trap's cell. The audit that found it is mechanical and worth repeating: grep the simulation for comments asserting a category is EMPTY (`hold no`, `carries no`, `cannot hold`, `contains no`) and check each against what has shipped since. Those two were the only live instances.

**Fix.** Both sites now ask `worldOccupancy.isCellBlockedByBuilding(x, y)`: open water stays clear — the shared spawn check would otherwise reject it merely for being water — but a building on water blocks a ship exactly as a wall blocks a knight. Deliberately buildings only, not resources: fish ARE water resources and a fishing ship must still reach them.

**How it is checked from now on.** `tests/simulation/fishTrapBlocks.test.ts` on a new `fish-trap-blocks-fixture`: a one-cell-tall channel with a trap mid-way, so a ship ordered from one end to the other must pass THROUGH the trap cell or not arrive. The test watches for occupation of the trap cell directly rather than inferring it from arrival. Its control — a second ship in an identical open lane that must cross freely — is what stops a fix that simply makes ships refuse water; the control passed before the fix and the blocked case failed, so the pair discriminates on exactly this defect.

**What this predicts.** Docks sit on the shore and their footprints may include water cells, so this fix could have blocked ships from spawning at their own dock; it does not (the naval and shore-fishing suites pass), but any future water building — a harbour, a sea gate — inherits that question. And the wider class stands: a comment that asserts what a category CANNOT contain is a dated claim, not an invariant, and every one of them should be re-read whenever the game gains a new kind of thing.


## 2026-08-30 — Gather over-subscription counts EVERY owner's villagers (LATENT, not fixed)

**What it is.** `villagerEconomySystem` builds `gatherTargetCounts` by walking `activeWorld.query('gatherer')` with no owner filter, so every gatherer in the match counts toward every resource's occupancy. That map is what `MAX_GATHERERS_PER_RESOURCE` (2) is checked against, and its stated purpose is to stop ONE player piling villagers on one node. Counting the opponent's villagers is wrong for that purpose: an enemy working a neutral resource can make it read over-subscribed for you, and your villagers fan out away from a resource that has room.

**Why it is not fixed.** Measured before touching it, which is the point of this entry: across `aoe2-prototype`, `default-seed` and `corpus-seed-b`, sampling every 100 ticks for 12,000 ticks each, **not one tick had a resource targeted by two different owners** — 0 of 360 samples, max owners on any single resource 1. Every current map keeps the players' resource rings apart, so the defect cannot fire. Fixing it means threading a per-owner count through five call sites in two files for no measurable behaviour change today.

**The trigger to watch for.** It becomes live the moment two players' gatherers can reach the same node: a map with a contested middle (gold or stone between bases), overlapping resource rings on a small map, or allied players sharing a base. Any of those should come with the fix — key the counts by owner — and this entry is the note that the machinery is already wrong when they arrive.

**What this predicts.** A shared counter with no owner dimension is a latent cross-player coupling wherever it appears. `gatherTargetCounts` is one; the same shape is worth looking for in any per-tick map keyed only by entity id.


## 2026-08-30 — The AI built its drop-offs next to its Town Center, not next to the resources (RESOLVED v0.3.166)

**Symptom.** Villagers spent 45% of their time walking, against an ideal nearer 24% for the geometry involved, and the AI reached Feudal in 18-20 minutes of game time against DE's 11-13. Found by measuring the villager time budget after the earlier freezes were fixed: with idling gone (36% to 1%), what remained was carry distance.

**Root cause.** `aiSystemBuildingPhase` anchored EVERY building at the Town Center (`findBuildPlacementNear(ownerTownCenterPosition, nextBuild)`), except the bootstrap Lumber Camp, which anchored at the builder's own feet. A Lumber Camp, Mining Camp and Mill exist precisely to shorten a carry, and AoE2 puts them ON the woodline and the ore. Measured across three seeds, camps landed a median 5 tiles from what they serve, with a Mining Camp at 16 and a Mill 52 tiles from the nearest berry.

**Fix.** `dropOffAnchorFor` returns the nearest harvestable resource of the kind a drop-off serves, bounded to the owner's neighbourhood; non-drop-offs and out-of-range resources return null so callers keep their old anchor. Camp-to-resource distance dropped to a median 2 (lumber) and 3 (mining).

**Two things measurement corrected mid-fix.** Anchoring a Mill on sheep and boar as well as berries is wrong — both are brought TO the Town Center in AoE2, and a wandering sheep won the nearest-resource contest. And the "mill is 8 tiles from the nearest berry" metric is confounded by DEPLETION: a mill built beside berries that are later eaten reads as badly placed. Haul distance and gather share are the honest measures.

**Outcome, including the cost.** On the worst-owner-across-seeds ranking this repo adopted after an earlier review, **17,200 → 14,100 ticks**. `aoe2-prototype` owner 2: 11,000 → 9,200. `corpus-seed-b` owner 2: 17,200 → 12,100. Owner 2's gather share on the boot map: 51% → 59%. The cost, recorded not buried: `default-seed` owner 1 slows 12,100 → 14,100. Three slots improve, one regresses, two are unchanged.

**What this predicts.** The anchor radius (12) is not currently load-bearing — every camp on every tested map already falls inside it, and 22 gave identical results. It becomes real on a map whose resources sit far from the start position, and that is the case to measure before trusting it.

## 2026-08-30 — A wolf could kill anything and take no damage doing it

**Symptom.** On `wolf-aggro-fixture`, one villager and one wolf, 1,200 ticks: the villager was gone and the wolf was at 25/25 — untouched. The villager never fought back, never moved, and nothing reported anything. Any unit a wolf met died for free, and the only counterplay was a human noticing and issuing an attack command by hand.

**Investigation.** Auto-aggression finds targets through `world.query('position', 'unit')`. Wildlife are `resource` entities — a wolf has a `resource` component and a wildlife state, and no `unit` component at all — so it is structurally invisible to every auto-target path in the game. This is the same shape as the retracted claim in the 2026-08-29 boar investigation, where "wildlife not in the `unit` query" explained a different empty result: the query was answering a question nobody had asked.

The attack path itself was fine. `attackCommandStep` has handled `targetEntityKind === 'resource'` since the boar hunt shipped, and `setUnitAttackCommandDirect` accepts a resource target. Nothing was missing except an issuer.

**Root cause.** No call site. `registerAllSystemsTypes.ts` said so in a comment — "No deterministic-resolution system calls attack today, so no direct helper threaded through this layer" — which was true when written and had quietly become a description of the defect. Wildlife combat landed bites and never told the victim anything had happened.

**How it is checked from now on.** `tests/simulation/wildlifeRetaliation.test.ts` asserts the MECHANISM — the wolf takes damage — rather than who wins, because a 25 HP villager against a 25 HP wolf is close enough that an outcome assertion would pin an arithmetic coincidence. It carries a control — a wolf on `wolf-idle-fixture` with nothing inside its aggro range, stepped for the same 1,200 ticks — so the assertion cannot be satisfied by ambient damage. The first version of that control never stepped the simulation at all: it asserted a wolf was at full health at tick 0, which no implementation could fail. Review caught it, and this entry had claimed it was doing work it was not.

**A second defect was shipped inside the first fix and caught in review.** The retaliation originally fired for any unit that was not already attacking. `setUnitAttackCommandDirect` REPLACES the victim's whole command — shift-queued waypoints and build refs, trade-route refs and carried gold — and calls `clearGathererOrder`, which also zeroes gather progress and the explicit assignment. Measured: a house foundation frozen at 0/120 that otherwise reached 43/120, a move order replaced at tick 3, a garrison-escape order destroyed by the very thing it was escaping. Worst of all it made the boar LURE unplayable — the retreat order that defines that spec-mandated mechanic was overwritten by the boar's next bite — so one commit had put two spec rules in direct conflict. Retaliation now fires only for a unit with NO order, and `wolf-at-shoulder-fixture` (wolf adjacent, so the bite lands on tick one) pins it: with the wide guard the villager never reaches the `building` state at all. `wildlifeCombatSystem` now issues the retaliation itself, and only when the victim is not already attacking — re-issuing on every bite would reset the approach each tick and two wolves sharing a victim would leave it oscillating between them.

**What this predicts.** Every remaining behaviour that reaches for units through `query(..., 'unit')` is blind to wildlife in the same way, and each is worth checking on its own terms rather than assumed: fleeing, stance response, formation, and the AI's threat assessment. More generally, a comment asserting that no caller exists is an absence claim with a shelf life — the same class as the 2026-08-26 roster entry, and it expired the same way.

## 2026-08-30 — A scout that reached the edge of its patrol box stopped scouting

**Symptom.** An AI scout parked at a corner of its own wander box visited three distinct cells in 1,200 ticks and stayed there for the rest of the match. Its owner is blind from that moment: the scout is the only thing exploring. Found while a wolf chase happened to leave a scout at that corner, but the wolf is incidental — parking a scout there by hand, on a map with no wildlife at all, reproduces it exactly.

**Investigation.** The wander box is declared in GRID cells (`wanderBounds`) and enforced in FINE units (four per cell). The far edge converted as `maxY * UNIT_SUBGRID_RESOLUTION`. That is the FIRST fine slot of the last legal cell, not the last: cell 32 spans fine 128..131, and the ceiling was 128. So on that edge every outward step was flipped by the bounds reflection and then snapped back by the clamp to the single value 128 — the scout could not even move within its own last cell. Traced directly: fineY held at 65–67 and 128–129 while the velocity flipped every few ticks.

**Root cause.** An off-by-one that only exists on one side. `min * RESOLUTION` genuinely is the first fine slot of the first legal cell, so half of every bound was correct — which is why this survived from the introduction of the fine grid, and why the near corner behaves perfectly while the far one does not.

**How it is checked from now on.** `tests/simulation/scoutWanderCorner.test.ts` parks the scout at the FAR corner and requires 40 distinct cells in 1,200 ticks — 19 on the unfixed conversion, 57 on the fixed one, so the bar sits between them and the test red-checks by reverting the two ceiling expressions.

**The first version of this gate did not gate, and this entry said it did.** It asserted a flat `>= 8` across three corners and claimed a red-check. Review measured it: all three cleared 8 against the unfixed code (19, 13, 29), because the bar had been calibrated from a "three cells" figure that no gated corner actually produces. Two of the three corners are unmoved by the fix entirely — they are kept as regression floors and are now labelled as floors rather than as detection. The lesson is the general one: a bar copied from the symptom you happened to observe is not the same as a bar measured against the two builds.

**Still OPEN: the (maxX, minY) corner.** That corner still pins — two cells in 1,200 ticks, on a map with no wildlife — after this fix, so it is a second and independent defect in the same system rather than a case the fix missed. It is deliberately not in the test, with a comment saying why, so that nobody lowers the bar for the three corners that now work in order to accommodate it. Repro: `createSimulationBridge('aoe2-canary')`, take the owner-2 scout with the largest `maxX`, set its position and `unitTransform` to `(bounds.maxX, bounds.minY)`, step 1,200 ticks, count distinct cells.

**What this predicts.** Every other place a cell-space bound is enforced in fine space has the same trap, and the asymmetry is what makes it invisible: the min side is always right, so a symmetric-looking expression is half wrong. `worldOccupancy`'s spawn guard was audited for this in the same session and is correct because it compares in cell space throughout.

## 2026-08-30 — A red Windows CI on a suite that was green everywhere else

**Symptom.** `main`'s remote gate failed on the push of commit e6c73556. Ubuntu passed; Windows failed with one test timing out — `selectionActivity.unit.test.ts > villager returning with wood reports Dropping off wood`, `Test timed out in 30000ms`. Every local gate had been green, including the full suite, the browser suite and the corpus.

**Investigation.** The test takes 8.0 seconds on the author's machine against a 30-second budget. The Windows job took 34 minutes against the previous run's 24. Two candidates were measured rather than argued:

- *Did the change make the simulation slower?* An A/B on the scout wander fix — the only behaviour change that makes units do MORE work — over the two heaviest AI suites: 70.46s with it, 69.11s without. About 2%. Not the cause.
- *Did the new tests cost that much?* They total roughly 21 seconds of the suite's 967 seconds of test time, about 2%. Not on their own either.

What is left is contention. The suite runs in parallel workers on a CI runner with few cores, and a test with an 8-second cost and a 30-second budget has no headroom once anything else is competing for the machine. The new tests were enough to tip it; on a faster runner they would not have been. Windows runner variance covers the rest of the 24-to-34-minute gap.

**Root cause.** A budget calibrated on the author's machine with nothing else running. It is the same shape as the 2026-08-29 two-month CI outage entry: the local gate and the remote gate run on different machines, and every machine that runs this suite in CI is slower than the author's.

**How it is checked from now on.** The marginal test's budget is now 90 seconds with the measurement written beside it, so a slow runner has room. The new tests were re-measured and shortened wherever the signal allowed — the scout corner floors dropped from 1,200 ticks to 400, the retaliation horizon from 1,200 to 300 (the wolf is at 1/25 by tick 200) — which took the suite from 110.7s to 104.7s locally. The one test that kept its full horizon kept it for a measured reason: its signal does not exist below 1,200 ticks (17 cells against the broken build's 19 at 600).

**What this predicts.** Every remaining test whose runtime is a large fraction of its timeout is the same defect waiting for a busy runner. `gatherDomain` at 107s, `aiPlayer` at 44s and `aiFeudalStone` at 37s are the ones to look at first, and the general rule is that a per-test budget should be a multiple of the measured cost rather than a round number that happened to pass once.

## 2026-08-30 — The behind-building silhouette reads as a unit standing ON the building (OPEN)

**Symptom.** A unit hidden behind a building is cued by a flat-coloured mirror of its body drawn over the building. It is fully opaque, and at a Town Center that reads as a villager standing on the roof rather than as an x-ray of one behind the wall — noticed hands-on on 2026-08-29 ("three of them across the TC's upper tier read as villagers standing on the roof") and confirmed in the `occlusion-showcase-fixture` capture, where the blue figure sits on the roof with nothing to say it is a cue.

**Investigation.** The obvious fix — draw the mirror on a transparent material so the building reads through it — was implemented, measured, and REVERTED. It failed on three independent axes, each measured rather than argued:

1. *It is close to a no-op under the art style the game actually ships.* The default is `moebius`, whose tone-band quantiser snaps **24.1% of the cue's pixels byte-identical to the fully opaque render**; mean change against opaque is 46.6 there against 125.6 under `painted`. One opacity value cannot serve a banding and a non-banding pipeline.
2. *It introduces self-blending seams.* The mirror copies a unit's own overlapping parts, and a translucent instanced part that overlaps itself blends twice — solved per-pixel as 452 px at the declared 0.55, 68 at 0.7975 (1−0.45²) and 6 at 0.9089 (1−0.45³). About 14% of the body draws at the wrong opacity, as streaks down the arm and torso. The engine has the cure and does not export it (see `docs/engine-feedback/current.md`).
3. *It degrades the half of the cue that matters most.* The enemy colour is a coral in the same hue family as every roof in the palette, so blending erases it: mean RGB distance from the background over a bright roof fell from 204.2 opaque to **82.0**, while the friendly blue — orange's complement — held at 196.9. The cue exists to answer "are those mine?", and it was the *not mine* answer that went.

Raising opacity to 0.78 fixed the measured colour bar but none of the three causes.

**Root cause of the DEFECT (still open).** Uniform alpha is the wrong technique for this cue in this renderer. What would work is a treatment that does not depend on blending: a contour, a hatch, or a colour chosen for contrast against the building palette rather than for ownership alone. The enemy coral in particular should be re-picked against the roof palette, which is a change that needs no engine feature and no transparency.

**How it is checked from now on.** It is not, and that is the honest state — no gate covers "does this cue read as behind rather than on top", because it is a judgement about a rendered image. What the attempt DID leave behind is the measurement method: capture background / opaque / candidate under both art styles, solve the per-pixel alpha, and measure mean RGB distance from the local background for BOTH ownership colours over both a bright and a dark building. Any future attempt that does not do that is guessing, and the first attempt's 0.55 was a guess that looked right in one capture of one art style with one owner.

**What this predicts.** Every other overlay that might reach for transparency has the same two traps waiting — the moebius quantiser and self-blending — and every two-colour ownership cue should be checked in BOTH colours against the palette it will sit on, not just the one the showcase fixture happens to spawn.

## 2026-08-30 — The AI cannot leave the Feudal Age: wood-starved while banking everything else (RESOLVED v0.3.169)

**Symptom.** In a 40-minute all-AI match neither player ever reaches the Castle Age, on any of three seeds. The whole match exercises four unit types (villager, scout, militia, spearman) and eight or nine building types. Against a content audit that puts 137 of 138 technologies live with real effects and 93 units trainable, AI self-play exercises a small fraction of the game — which matters because self-play is the standing acceptance test for feature completeness.

**Investigation.** Measured on `default-seed`, the winning AI at tick 24,000:

    food=1571  gold=1140  stone=750  wood=38   feudal buildings: NONE

It is sitting on nearly twice the food and five times the gold the Castle advance costs (800 food, 200 gold) and cannot take it, because the advance also needs two qualifying Feudal buildings and those cost 150–175 WOOD each. Wood never rises above about 50 at any sample on any seed, on either side, for the whole match.

Two hypotheses were tested and BOTH failed, which is the useful part:

- *More wood villagers.* Feudal weights `{food:7, wood:4, gold:1, stone:1}` → `{food:7, wood:6, …}`, which moves the split from ~7 wood villagers to ~9. Castle still never reached on any of the three seeds; building and unit variety unchanged.
- *The farm gate.* `pickNextBuildTarget` returns `farm` on essentially every decision tick, so the theory was that farms block the Feudal buildings. Holding farms to the floor while the age-up prerequisites are missing made it slightly WORSE on `aoe2-prototype` (eight building types down to seven) and changed nothing elsewhere — because a farm is CONSUMED, so the count falls back below even a floor of two and the branch re-fires anyway.

So wood income is not the constraint and the farm ordering is not the constraint: wood SPEND is. Every point of wood goes to houses for a growing population and to replacing farms as they are eaten, and the AI never accumulates the 150 for its first Blacksmith.

**Why the reserve makes this self-sustaining.** `ageUpReserveCost` returns an empty reserve unless the owner ALREADY qualifies for the next age. Not qualifying, the AI has nothing protecting a stockpile it also has nothing to spend on — so food and gold pile up, unspendable, while the one resource that would unblock it stays at zero. The state is stable, which is why 40 minutes changes nothing.

**A fourth hypothesis, also tested and reverted: reserve the wood.** `ageUpReserveCost` protects the age-up RESEARCH but only once the owner qualifies, so nothing protects the cost of BECOMING qualified — the AI defends a purchase it cannot yet make and spends the money for the one it can. Making the farm wait unless the wood also covered the next qualifying building was implemented, unit-tested with six cases (including a red-check), and wired through the caller. Measured over the three seeds: `aoe2-prototype` gained a Blacksmith (8 building types to 9), `default-seed` LOST one, and `corpus-seed-b` lost its farms entirely. Reserving for all still-needed prerequisites rather than the next one moved `default-seed` to 10 types but cost `aoe2-prototype` and `corpus-seed-b` their farms. No seed reached Castle under either variant. Starving the food economy to fund a hall is not a trade worth making, so both were reverted.

**An instrument flaw caught before it became a conclusion.** The exercise metric counts DISTINCT building types across the whole match, which unions BOTH owners. A run showing a Blacksmith and an Archery Range therefore does not show that any single owner had two qualifying buildings, and the tempting reading — "it qualifies and still will not advance, so the blocker is elsewhere" — is not supported by it. Anything measuring qualification has to be per-owner. The union metric is still correct for what it claims (what the match exercises) and, if anything, understates the problem, since per owner the variety is lower still.

**ROOT CAUSE, found by instrumenting the decision rather than guessing at it.** Tracing the AI's building phase directly on `aoe2-prototype`, owner 2, over 20,000 ticks:

    next=farm  ongoing=0  max=21  wonder=false  vills=22  builder=2162     x164
    WHY farm   builder=2162  anchor=SOME  afford=FALSE  wood=0..24  cost={wood:60}

The AI decides to build, has a builder, has capacity and a valid anchor, and simply cannot pay. Tallying every spend it did manage over those ticks:

    buildings   4 house(25) + 4 farm(60) + mining-camp(100) + mill(100)
                + lumber-camp(100) + barracks(175)            =  715 wood
    military    21 spearmen at 25 wood each                   =  525 wood
                                                                -----------
    total                                                       1,240 wood

1,240 wood in 2,000 seconds is 0.62/s against a nominal 2.73/s for seven wood gatherers — **23% efficiency**, the rest of their time spent walking under the §12.4.2 clock. And **military takes 42% of what does arrive**.

That is the whole defect, and it was designed in by a comment that stopped being true: `aiSystemProductionPhase` reads *"Military is the only pre-age-up food/gold spend (builds spend wood/stone)"*, and the age-up reserve is built on it. A **spearman costs 25 wood**. So military and construction compete for the one scarce resource, nothing arbitrates, and the 150 wood for a first Blacksmith is never accumulated — the AI cannot qualify, so `ageUpReserveCost` stays empty, so it also banks food and gold it has no way to spend. 980 to 1,922 food at the end of a match, and a stockpile that never clears 24 wood.

**The intervention that works, measured.** Adding the next qualifying building's wood to the production-phase reserve — the exact pattern the file already uses for the age-up — produced `default-seed` owner 2 **qualifying at tick 20,000 and reaching the CASTLE AGE at 21,500**, the only time any player has reached it in this investigation, with unit variety up from four types to five. It is NOT adopted: it costs a unit type on `aoe2-prototype` and `corpus-seed-b` (four down to three), which is a regression on the boot map and fails this repo's own adoption rule. Gating it behind an established economy (15+ villagers) restores the military everywhere and loses the Castle everywhere — the reserve has to bite early to work at all. What remains is a tuning problem with a known mechanism, rather than an unknown.

**A seventh experiment, testing the obvious pairing, and it is worse.** If the reserve costs military because the spearman is the AI's only Feudal unit and it costs wood, then give it a wood-free alternative: militia, at 60 food and 20 gold, both of which this AI has banked in the hundreds. Measured: peak military HALVED (8 to 4 on two seeds) and the Castle was lost. Militia's 60 food buys fewer units than the spearman's 35, so trading the wood cost for a food cost bought a smaller army and spent the food the age-up needs. The pairing that looks obvious from the cost table is wrong once the food side is measured.

**RESOLVED, and the two halves only work as a pair.** The sweep the previous entry called for — reserve SIZE against the Feudal wood weight, across three seeds — found that neither lever works alone and together they clear it. Wood 4/5/6/7/8 against reserve sizes 0/60/75/150/175 and two stop conditions:

    reserve 150, wood 4   boot map: no castle          default-seed: castle 21,500, peak military halved
    reserve 0,   wood 6   boot map: no castle          (income alone: the spearman ate each 25 as it landed)
    reserve 150, wood 6   BOOT MAP: eligible at 23,500   default-seed: castle 24,000
    military floor 3      bldg types 8 -> 9              bldg types 7 -> 12
                          unit types 4 -> 5              peak military unchanged
                          peak military unchanged (8)    totals: 1 castle where baseline
                                                         had 0, 50 bldg types vs 44,
                                                         26 unit types vs 24, and peak
                                                         military 37 vs 37 — no army cost

Both halves red-check independently against the end-to-end test: reverting either one alone returns "no player reached the Castle Age". 150 and 175 are identical because the reserve clamps to the next building's cost and the Blacksmith is 150; wood 6 gives the earliest boot-map Castle of the family.

**The reserve needed a floor, and review found that the hard way.** The first version had none. Across eleven seeds it cost 21% of all peak military, and on every seed whose peak wood never reached the reserve it blocked 100% of military training for the whole age while still never affording the building — pure loss, with the army pinned at 3 units against a baseline of 6-7. The obvious floor, `attackGroupSize` (5), makes the reserve a no-op: `militaryGrowthPausedForAgeUp` already stops GROWTH at 5, so the drain this reserve exists to stop happens entirely below it, in replacing losses. Swept 0/2/3/4/5 across three seeds; **3** costs nothing at all — peak military identical to baseline's 37, six more building types, two more unit types.

**The cost, stated rather than buried.** `corpus-seed-b` still regresses, though far less than the floorless version: each owner loses one building type and one unit of peak military, and neither reaches Castle. The boot map does NOT regress on anything, which is what the older no-regression rule asks for. Recorded so it can be reversed on evidence rather than re-litigated from memory.

**How it is checked from now on.** `tests/simulation/aiReachesCastleAge.test.ts` plays 24,000 ticks of all-AI self-play on the boot map and requires Castle-Age ELIGIBILITY (baseline never qualified there at all), peak military of at least 8, five unit types and nine building types. It red-checks against each half of the pair separately. A second seed is deliberately not gated — each match is ~2 minutes and heavy tests in this suite tipped an unrelated test into a CI timeout the same day — so `default-seed`'s numbers are recorded in the test header as evidence instead.

**Where this leaves the tuning.** Reserve-alone remains the only configuration that has produced a Castle Age. Its scorecard against baseline, per owner, over three seeds: `default-seed` clearly better (owner 2 qualifies at 20,000, reaches Castle at 21,500, building types 7 to 9, unit types 4 to 5); `aoe2-prototype` mixed (owner 1 gains two building types and loses a unit type, owner 2 loses one building type); `corpus-seed-b` slightly worse (a unit type and a building type). One large win, two small losses, and a loss on the boot map is exactly what this repo's adoption rule refuses. Not adopted, and the remaining work is a proper sweep of the reserve's size and duration rather than another single-shot experiment.

**Also measured: the match never resolves (OPEN, and a fix was attempted and REVERTED).** At 60,000 ticks — 100 minutes of game time — every number was byte-identical to 24,000. `default-seed` owner 1 ended with zero units, five buildings including a Town Center, and 43 food against a villager's 50, so it could never act again; `getMatchState().outcome` was still `running`.

Conquest is not the gap — its rule is AoE2's own, every unit AND building destroyed, and a Town Center was standing. The missing piece is resignation.

**The attempt, and why it was reverted.** A resignation arm was built: an owner with no units that cannot afford the cheapest unit any completed production building it owns can train is treated as eliminated, behind a grace period. It passed a forcing fixture, its control, and all six gates. Review then broke it three ways:

- *It declares a living player dead, reproduced.* `enqueueTraining` DEBITS the stockpile when a unit is queued and creates the entity only when the counter reaches zero, 250 ticks later for a villager. So a player who has just correctly spent its food on eight villagers has zero food and zero units, and the rule resigns it — with eight paid-for villagers in the queue. The reviewer produced a match ending "All enemy forces have been eliminated" against a standing Town Center. The same shape hits a human as a FALSE DEFEAT one tick before a villager pops, and the pop-blocked branch makes the window unbounded.
- *Three unit-free income routes make "can never act again" false.* A Market converts wood to gold to food with no unit anywhere; relic gold pays a per-tick trickle into a Monastery; and ally tribute needs nothing of the recipient but a resource bank. Each is a live player judged dead.
- *The grace period was chosen on a false premise — mine.* I wrote that the longest fixture horizon was 8,000 ticks and set the grace to 12,000. It is not: `aiReachesCastleAge` runs 24,000 (a test I wrote the same day, whose own comment says "half a real 24,000-tick match"), `aiFeudalStone` and `gatherDomain` 14,000, a farm test 21,600, the CI corpus 13,100, and `npm run playtest` defaults to 30,000. Because `step()` no-ops once an outcome is set, a future break is SILENT: the world freezes and assertions read frozen state instead of failing. Two dev scripts — including `ai:tickrate`, the tool used for this session's tick-cost work — loop on `world.tick` with no outcome check and hang forever, which the reviewer reproduced.

**Why it is not simply repaired.** Each hole is individually fixable, but the shape is the problem: proving a position TERMINAL means enumerating every route by which resources can still arrive, and that enumeration silently rots as the game gains features. The rule was correct on the day it was written and would have been wrong the next time someone added a trickle.

**And the symptom no longer arises.** Re-measured after v0.3.169, at 30,000 ticks: `default-seed` owner 1 holds 24 units and 17 buildings where it used to end with zero, and `aoe2-prototype` owner 1 holds 26 and 11. The economy fix stopped the loser being wiped out at all, so this was a downstream symptom of the economy collapse rather than an independent defect. That is the reason it stays open rather than being pursued: the cost of a false elimination is a stolen game, and the benefit is currently theoretical.

**`corpus-seed-b`, the seed where neither owner qualifies, measured (2026-08-30).** Owner 1 finishes with **food 1,895, gold 790, stone 440 and wood 20** — the same shape as the original defect, one seed further on. Cumulative income over 20,000 ticks: food 3,189, wood **1,300**, gold 760, stone 380. So 1,300 wood arrives across the match and every point of it is spent; the balance never approaches the 150 a Blacksmith needs. Of seven villagers assigned to wood, only **two are gathering at any moment** — three walking out, two walking back. That is ~25% of nominal gather rate, and it is the whole constraint.

**Two build-order hypotheses tested and both negative.** The AI builds **exactly one lumber camp and one mining camp for the entire game**: `missing(type)` means "owns none", and the camp branch sits inside the Dark-Age arm of `pickNextBuildTarget`, so past that age it is never reached at all. In AoE2 a player builds a camp per woodline as the near trees deplete, so this is a real divergence — and closing it does not help. Allowing a second camp changed nothing (the AI cannot afford the 100 wood); allowing camps past the Dark Age as well moved one seed by a single building type and no seed reached the Castle Age. Both reverted.

**Where the 25% actually goes, measured (459 samples over 20,000 ticks on `corpus-seed-b`).** The two halves of a gather trip, in tiles:

    villager -> target    median 6    p90 20    max 61
    target   -> dropoff   median 6    p90 9     max 50

The HAUL is healthy. Carry capacity is 10 and wood gathers at 0.385/s, so a full load is ~26 seconds of chopping against a median 6-tile haul — about 7.5 seconds each way at the §12.4.2 clock of 0.8 tiles/s. That alone predicts roughly 68% efficiency, not 25%.

What destroys it is the APPROACH, and specifically its tail: at the 90th percentile a villager walks **20 tiles to reach its tree** — 25 seconds, as long as chopping the load it came for — and the worst case is 61 tiles, 76 seconds. The median approach is fine; one trip in ten costs more in walking than it returns in wood.

**And this is why the one-camp limitation matters.** A villager is assigned the nearest AVAILABLE tree, so once the near woodline is worked out the nearest one is far — and the AI cannot answer the way a DE player does, by planting a camp at the new woodline, because it owns one lumber camp for the whole game and cannot afford a second. The two findings are one finding: the approach tail is the cost, and the camp is the instrument for cutting it. The failed camp experiments above did not disprove the fix; they showed it is gated behind affording 100 wood, which is the same wall.

**The tenth attempt LOOKED like the answer and was an artifact of its own bugs (2026-08-30).** Diagnosis said: cut the approach tail by planting a camp at the receding woodline. Allowing a second Lumber Camp, with `dropOffAnchorFor` skipping resources an existing camp already serves, took three seeds from 1 Castle-Age owner-slot to 3, with building types 50 to 55 and unit types 26 to 31. It reproduced exactly, passed all six gates, and did not regress the boot map.

Review found two defects in it, both real:

- *A null anchor fell back to the Town Center.* Null used to mean only "nothing in range"; with the filter it also means "everything is already served". The caller planted the camp on the Town Center — where `canDropOffAt` already accepts wood, so it shortens NO carry. 100 wood of the scarcest resource for nothing.
- *The second Lumber Camp displaced the Mining Camp.* Both cost 100 wood and lumber is asked first inside the Dark-Age arm, which is the only place either is reachable. Over 12 seeds, mining camps fell 17 to 15 and owner-slots ending with no gold/stone drop-off at all rose 7 to 9 — permanently, since a slot that misses it in the Dark Age never gets one.

**Fixing both destroyed the benefit, which is the finding.** With the null case refusing to build and the opening order putting the FIRST of each drop-off ahead of any second, a ten-seed sweep over 20 owner-slots says:

    camps   Castle   building types   unit types   peak army
    1           4         156              89          110
    2           4         160              85           99
    3           2         159              83           98

No Castle-Age benefit at all, and it costs unit variety and 10% of peak army. So the three-seed win was not the mechanism working; it was the two defects. Reverted in full.

**And the accident points somewhere real.** Displacing the Mining Camp helped because it spends 100 wood on wood rather than on gold and stone — and this AI banks gold and stone unspent all game (measured repeatedly: 790 gold and 440 stone against 20 wood at the end of a match). The next hypothesis is therefore not another camp: it is that the Mining Camp is itself a poor buy on these maps, and the AI should not build one while the resources it serves are accumulating unused. That is testable, cheap, and was found only because fixing a bug made a result worse.

**The twelfth attempt was the never-build variant in disguise, and its win was a horizon artifact (2026-08-30).** The eleventh accident said the Mining Camp is a poor buy while gold and stone bank unspent, so the twelfth moved it out of the Dark Age into the Feudal arm, placed AFTER the age-up qualifying halls. Ten seeds gave Castle-Age slots 4 to 6 and the boot map reached the age at tick 22,250 where HEAD reached it never. Six gates green, reproducible.

Review found three things, each fatal alone.

- The insertion sits after a loop demanding blacksmith AND archery-range AND stable AND market, and the AI qualifies with two and rarely completes four. Camps built: 25 of 34 owner-slots at baseline, 4 of 34 under the change, all four in the last 17% of the match. A separately-built never-build arm is byte-identical on 10 of 12 slots. The rule that shipped is the one its own comment rejected.
- The win is an artifact of the 24,000-tick horizon and REVERSES at 34,000: Castle slots 7 to 9 at the cut-off, 18 to 16 at the longer one, with five slots losing an age they otherwise reach.
- The insertion is not age-gated, so in the Castle Age a missing camp outranks Siege Workshop, Monastery and Castle, and an unplaceable one blocks the whole order. That stall class did not exist at HEAD.

Two of my own claims were wrong. The 790-gold-440-stone figure quoted in two tracked files is ONE cherry-picked slot; across 34 the gold range is 11 to 1,670, and the change RAISES the median hoard it was written to stop paying for (gold 575 to 614). And my prose and my test file stated building types moving in opposite directions.

Review names the position nobody tried: keep the camp in the Dark Age and gate it on a gold or stone mine actually being within DROP_OFF_ANCHOR_RADIUS.

**The wall is HALF a measurement artifact (2026-08-30, and this supersedes the framing above).** Every figure in this entry was taken at a 24,000-tick horizon. Measured at 34,000 on the same ten seeds, with no code change at all:

    horizon    owner-slots reaching Castle Age    building types   unit types   peak army
    24,000              4 of 20                        156             89          110
    34,000             10 of 20                        176            115          168

Half of all owner-slots reach the Castle Age. They arrive after minute 40, which is slow against DE, but "the AI cannot leave the Feudal Age" was never true as stated — it was true of the window being looked through. The honest claim is that the AI reaches the Castle Age late, and that self-play run to forty minutes cannot see it.

**The thirteenth attempt was a no-op, and it falsified the hypothesis that suggested it (2026-08-30).** Review of the twelfth proposed the position nobody had tried: keep the Mining Camp in the Dark Age but only want one when a gold or stone mine is actually within `DROP_OFF_ANCHOR_RADIUS`, so the camp is never bought when it shortens nothing. Implemented, and measured in both arms at both horizons in a single job — after nearly corrupting the comparison by stashing the working tree while the first arm was still reading it.

    arm        24,000                          34,000
    gated      4 / 156 / 89 / 110              10 / 176 / 115 / 168
    baseline   4 / 156 / 89 / 110              10 / 176 / 115 / 168

Byte-identical. The gate never fires: on all ten seeds a mine is always within range when the camp is wanted, so the camp is never planted away from ore in the first place. The Town-Center-fallback hazard that motivated the idea is LATENT on these maps, not live — which is worth knowing, because it was carried forward from the second-lumber-camp revert as though it were an active cost.

**WHERE THE TIME ACTUALLY GOES, measured at the corrected horizon (2026-08-30).** With the wall reframed, the arrival times can finally be decomposed. Ten seeds, 34,000 ticks, for the ten owner-slots that reach the Castle Age:

    Feudal -> qualified (two buildings)      mean 10,225 ticks   17.0 min   median 10,500
    qualified -> Castle (800 food, 200 gold) mean  3,800 ticks    6.3 min   median  2,250

**73% of the post-Feudal delay is spent QUALIFYING, not accumulating.** Banking the age-up's own price takes about six minutes; putting up the two buildings that make the AI eligible takes seventeen. Of the other ten slots, two qualified and could not afford the advance inside the horizon, and eight never qualified at all.

The two cheapest qualifying buildings are a Blacksmith at 150 wood and any of Archery Range / Stable / Market at 175 — 325 wood. Seventeen minutes for 325 wood is a NET rate near 0.32 wood per second, against a nominal 2.73 for the seven villagers assigned to it. That is the same wood starvation the first instrument found, now attached to the outcome it causes and priced.

So the target is wood INCOME in the Feudal Age, and specifically the gathering efficiency rather than the allocation: the weights were already moved from 4 to 6 in v0.3.169, and the approach walk is where the rate goes. It is NOT the build order, which is what twelve of the thirteen attempts changed.

**The Feudal economy is not MISALLOCATED, it is short — which retires a whole class of attempts (2026-08-30).** Measuring gross wood separately from spend during the Feudal Age, over three seeds:

    gross income   ~0.77 wood/s   (~1,100 wood across the age)
    spend          ~0.90 wood/s   (drawing down the opening stock)

The two qualifying buildings cost 325 of that 1,100, yet take seventeen minutes to appear — so they are losing the competition for wood. The obvious inference is to protect them, and v0.3.169 already does that against MILITARY. Extending the same reserve to FARMS was measured at both horizons:

    arm             24,000                        34,000
    farm reserve    0 Castle / 140 / 79 / 111     5 Castle / 163 / 98 / 146
    baseline        4 Castle / 156 / 89 / 110    10 Castle / 176 / 115 / 168

Catastrophically worse, and both horizons agree on the direction. The reason is the correction: starving farms starves FOOD, and the Castle advance costs 800 food against the 325 wood the reserve was protecting. The qualifying buildings lose the competition to something that is ALSO required for the same goal, so the premise — that this is a misallocation to be corrected — is false. The allocation is roughly right and the economy is simply short.

**What this retires.** Every attempt on this wall that moved wood from one claimant to another is now ruled out as a class: military-to-buildings was the only one that helped, farms-to-buildings actively harms, and the villager weights were already swept. What is left is raising the wood a villager-second produces — the approach walk — which is the one thing measured repeatedly here and never attacked.

**The approach walk is not pathological, which closes the last cheap hypothesis (2026-08-30).** With reallocation retired as a class, the remaining lever was the wood a villager-second produces. Two measurements on `corpus-seed-b`, owner 2, ticks 12,000-20,000:

- *Task shares for wood villagers:* to-resource 42.3%, to-dropoff 37.7%, **gathering 20.0%**. Four fifths of a wood villager's life is walking.
- *Effective movement while walking:* **0.259 fine units per tick against a nominal 0.320 — 81% of the movement clock.** Congestion and re-pathing cost about a fifth, and no more.

So the walking is real but the walk itself is close to as fast as the clock allows. There is no 5x defect hiding in movement; the shape is simply that this map's trees are far enough from a drop-off that a round trip costs four times the gathering it enables. That is a map-and-clock property, not a bug, and it is what §12.4.2's honest movement speeds bought — the same trade that made the AI look broken in the first place.

**One instrument error, and it is the recorded one again.** The first speed probe reported zero walking ticks. `EconomyState.villagers[]` carries owner, task and resource but NO `id`, so `getComponent(v.id, ...)` was asking about `undefined` for every villager — a query structurally incapable of finding anything, reported as a finding. The fix was to read `units[]`, which does carry ids, and cross-reference the `gatherer` component. Printing the shape of the object being filtered is what caught it, which is exactly what the lesson prescribes.

**THE AI BUILDS A LUMBER CAMP AND THEN DOES NOT USE IT (2026-08-30, OPEN — and this is the wall's structural cause).** Measured at tick 16,000 across five seeds, ten owner-slots, counting which drop-off is nearest to each wood villager's actual target:

    seed/owner        camps  woodVils  servedByCamp  byTownCentre  medianHaul
    aoe2-prototype 1    1       5            0            5            8
    aoe2-prototype 2    1      12           12            0            7
    default-seed   1    1       1            1            0            4
    default-seed   2    1      10            0           10           10
    corpus-seed-b  1    1       7            0            7           11
    corpus-seed-b  2    1       4            0            4           10
    seed-1         1    1       7            0            7            9
    seed-2         1    1       7            0            7            8
    seed-2         2    1       8            8            0            7

**Six of the nine slots that own a Lumber Camp have ZERO villagers served by it.** On `corpus-seed-b` owner 2 the camp sits at (57,25) with **6 live trees within 3 tiles and 17 within 6**, and all four wood villagers are working trees a median of 10 tiles from the Town Center instead. Where the camp IS used the haul falls to 4-7.

**Why.** `assignNearestResource` ranks candidates by proximity to a reference drop-off, and that reference is *the drop-off nearest the VILLAGER* — its own comment calls this "an accepted one-lookup approximation". A villager standing near the Town Center therefore ranks trees by Town-Centre proximity and picks one there, so it never migrates to the camp; the camp only ever serves villagers that happen to already be beside it. The deposit building is re-resolved correctly at haul time, which is why this never showed up as a wrong-destination bug — the villagers walk to the right drop-off, they were just sent to the wrong TREE.

**Why it matters more than everything above it.** This is the structural cause the fifteen tuning attempts were working around. It explains the 20% gathering share, the 0.77 wood/s gross, the seventeen minutes to afford 325 wood of qualifying buildings — and it explains why a SECOND Lumber Camp changed nothing (attempt ten): a second camp cannot help when the first serves nobody.

**The shape of the fix.** Rank candidates by the round trip they actually imply — distance from the candidate to the candidate's OWN nearest drop-off — rather than to whichever drop-off the villager is standing near. Trees beside the camp then rank best, because their nearest drop-off is one to three tiles away.

**The camp fix improves the aggregate and regresses the boot map, so it does not ship (2026-08-30).** Ranking gathering candidates by the haul each one actually implies — its distance to the drop-off nearest IT, rather than to whichever drop-off the villager happens to stand near — was measured in both arms at both horizons:

    arm         24,000                          34,000
    haul-rank   6 Castle / 162 / 88 / 105       11 Castle / 182 / 107 / 182
    baseline    4 Castle / 156 / 89 / 110       10 Castle / 176 / 115 / 168

The first candidate in sixteen attempts whose primary metric improves at BOTH horizons. But per seed, `aoe2-prototype` owner 2 takes the Castle Age at 28,250 against a baseline 25,250 — three thousand ticks LATER — with unit types 8 down to 5. The aggregate gain is real and the boot map pays for it, which is the exact shape of the Dark-Age tuning this repo already adopted and withdrew. Reverted.

**And the mechanism is still not understood, which matters more than the result.** Camp usage barely moved: 21 of 67 wood villagers served by a Lumber Camp before, 20 of 73 after. Two separate theories of the gate — the ranking comparator, then the home-range filter — were each implemented and each changed nothing, so whatever routes villagers away from a camp that sits on live trees is still unidentified. The Castle-Age gain therefore came from somewhere other than the mechanism it was aimed at, which is reason enough not to ship it even without the boot-map regression.

**THE ROUTING GATE, identified by tracing the decision rather than theorising about it (2026-08-30).** Instrumenting `assignNearestResource` on `corpus-seed-b` owner 2 at tick 16,000:

    TRACE vil=2481 at=50,23 refDropOff=2209@48,24 candidatesAfterHomeRange=101 of 232
          nearest4= 2398(53,23)d6  2230(47,30)d7  2384(51,20)d7  2388(52,21)d7
    CAMP  2211@57,25          TC 2209@48,24

The villagers stand at (50,23). `findNearestDropOffBuilding` is asked from the VILLAGER's position, so it returns the Town Center at (48,24) — 3 tiles — and not the Lumber Camp at (57,25), 9 tiles. Every candidate is then ranked by distance to that Town Center, and the best available is 6 tiles away, while the camp sits on trees within 3 of itself.

So the gate is: **the reference drop-off is chosen by proximity to the VILLAGER, and villagers cluster around the Town Center, so the Town Center is permanently the reference and no tree near a camp is ever preferred.** A camp can only ever serve a villager that already happens to stand beside it — which is why building a second one changed nothing.

**And a flaw in my own measurement of it.** The "servedByCamp" probe attributed each target to whichever drop-off was nearest, breaking ties by array order. A tree at (53,23) is 6 from the Town Center and 6 from the camp — a tie — so the probe's verdict on such trees was arbitrary, and "camp usage barely moved" is not trustworthy as stated. The boot-map regression that actually caused the revert is an outcome metric and is unaffected by this.

**Why the obvious gate was NOT adopted, measured rather than assumed.** `@typescript-eslint/no-use-before-define` with `functions: false` was configured and run: **24 violations repo-wide, 11 in `src/game/simulation`** — and every one inspected is the SAFE idiom, a function body referencing a `const` declared lower in the file, which runs after module initialisation. `PERSIAN_WORK_RATE_BY_AGE`, `EMBEDDED_TABLE`, `findNearestOwnedMonasteryToDeposit`, the UI controllers' `api` and `rafHandle` — all safe by construction.

The rule cannot separate those from the case that actually crashed, where the helper was called in code executing immediately in the same synchronous flow. So adopting it means 24 refactors of correct code for a signal that is mostly noise, and it would NOT have specifically gated the hazard. Recorded as a rejected gate with its cost, so a future session does not re-derive the same answer: the config is one line, the price is 24 sites, and the discrimination is poor.

**A latent crash class found en route, and it is a gate gap.** Moving the haul-cost helper introduced a use-before-define: `haulCostOf` is a `const` arrow, and the filter that now called it ran above its own definition, so every gather assignment threw a TDZ `ReferenceError` and the AI stopped gathering entirely. `npm run typecheck` and `npm run lint` were both GREEN through it — `no-use-before-define` is not configured in `eslint.config.js` — and the only reason it surfaced is that a probe reported zero gathering villagers. A reviewer had flagged exactly this hazard earlier the same day on a different file.

**Weighting the round trip does not recover the boot map, it just loses the gain (2026-08-31).** With the routing gate identified, the direct fix is to rank candidates by the haul each implies rather than by distance to whichever drop-off the villager stands near. Pure haul does that and improves the aggregate at both horizons, but costs `aoe2-prototype` three thousand ticks to the Castle Age — it sends villagers on migration walks without weighing the one-time approach. The obvious refinement is to price both legs, `approach + w * haul`, since the approach is paid once and the haul on every trip. Swept at both horizons over ten seeds:

    arm                24,000                        34,000
    baseline           4 Castle / 156 / 89 / 110     10 Castle / 176 / 115 / 168
    w = 1              4 Castle / 162 / 86 /  96     10 Castle / 182 / 110 / 158
    w = 2              3 Castle / 162 / 83 /  93      9 Castle / 179 / 101 / 123
    pure haul          6 Castle / 162 / 88 / 105     11 Castle / 182 / 107 / 182

There is no interior optimum. Weight 1 returns Castle slots exactly to baseline and weight 2 falls below it, while peak army drops in every weighted arm — so the approach term does not buy back the boot map, it only cancels the benefit. Only the unweighted extreme moves the primary metric, and that is the arm with the boot-map regression.

**What that says about the fix.** The gate is real and correctly identified, but ranking is the wrong lever for it: any ranking that makes camp-adjacent trees attractive enough to use also makes distant trees attractive enough to walk to, and the two effects are not separable by a scalar weight. A fix has to distinguish the villager MIGRATING to a camp's neighbourhood from the villager choosing a node within its current one — which is a home-range or assignment-time question, not a comparator question. Two of the seventeen attempts already guessed at a home-range filter and changed nothing, so that needs the same tracing treatment that found the gate rather than a third guess.

That is eight measured negatives on this wall now. Every lever tried moves wood between things that all need it; none creates any. The remaining candidates are on the GATHER side rather than the spend side — walk distance, camp siting, and how many gatherers share one drop-off — and the measurement to beat is the 25% figure above, not the age timings.

**What a future attempt needs.** Not a resource test at all — a POSITIVE signal that the player is doing something, rather than a proof that it can do nothing. The queue, the market, the trickle and tribute are all things this rule had to know about only because it was arguing from absence.

**Superseded hypothesis (kept for the record).** The villager allocation is a fixed per-age split that does not respond to which resource is actually binding. A player who has banked 1571 food and 1140 gold and cannot build a 150-wood building moves people onto wood; this AI cannot, because its split is a constant.

**How it is checked from now on.** Not yet, and that is the honest state — this is registered rather than fixed. What a fix needs is stated here so the next attempt does not repeat these two: the acceptance metric is what a match EXERCISES (ages reached, distinct building and unit types), measured across at least the three seeds above, and not Feudal timing, which both failed hypotheses left untouched while changing nothing that matters. The repo has already withdrawn one economy tuning that won on one seed and lost on the boot map; rank on the worst owner across seeds.

**What this predicts.** Any other fixed proportional allocation in the AI has the same failure mode available to it — the split is right for an assumed spend pattern and silently wrong when the actual bottleneck moves. The Castle and Imperial splits are untested against real play for exactly the reason this entry exists: no match has ever got there.

## 2026-08-30 — `fog-memory-fixture`'s first assertion fails in isolation, passes in the full suite (RESOLVED)

**Symptom.** `tests/browser/game-simulation-and-exploration-resources.spec.ts > remembers an enemy house with reduced-opacity memory rendering after the scout walks away` fails on its FIRST assertion: three ticks after boot the enemy house already reports `isMemory === true`, where the test expects `false` (it is meant to start in live vision and only become a memory after the scout leaves).

**Investigation, and what it rules out.** It is not the change that was in flight when it surfaced. With all four AI source files reverted to HEAD and `dist/` rebuilt, it still fails — three runs out of three. It is not the stale `vite preview` server that had been squatting on port 4173 since early in the session (`reuseExistingServer: true` means every run had been reusing it): killed, re-run, still fails. It is not the wildlife system registration ORDER, which the v0.3.167 extraction changed by inserting the deer-flee system second — moving it back to last and rebuilding does not help.

**ROOT CAUSE.** The fixture's scout carries no wander bounds, but it does not stand still: it auto-engages the enemy house four tiles away and steps off (10,10), taking that house out of its own radius-4 vision. The test warmed up three ticks and then asserted the house was in LIVE vision — a moment it had already left.

Measured in the browser: `isMemory` is false at boot and already true after one extra tick, with the scout at (10,9). Measured in the node simulation: false at ticks 0-3, true at 4-6, false again at 12 as the scout drifts back. The two disagree because boot advances further in the browser, which is exactly why a fixed warm-up count could not be right in both — and why the same assertion passed inside a warm suite and failed in a cold single-spec run.

**Fix, after the first attempt failed in the other direction.** Removing the warm-up made it pass in isolation and fail in the SUITE — the exact reverse of the original symptom, which is the proof that no fixed tick count can be right: boot advances a variable number of ticks under load. So the premise moved out of the browser entirely. `tests/simulation/fogMemoryFixturePremise.test.ts` pins "the house starts in live vision" where the tick count IS deterministic, and the browser spec keeps only what a browser can answer — that a house which has left vision renders as a reduced-opacity memory. That file also pins the scout's departure, so if it ever stops wandering off the browser spec can pin the premise directly again.

**What it was NOT, each ruled out by measurement rather than argument.** Not the AI change in flight when it surfaced — reverting all four source files to HEAD and rebuilding still failed 3/3. Not the stale `vite preview` server that had squatted on port 4173 since early in the session, which `reuseExistingServer: true` meant every run had been reusing — killed, re-run, still failed. Not the v0.3.167 wildlife registration order, nor the v0.3.167 scout wander-ceiling fix: reverting each and rebuilding leaves the scout stepping off at exactly the same tick.

**How it is checked from now on.** The test itself, with the warm-up removed and the measurement written beside it so the next person does not re-add one.

**What this predicts.** Any assertion pinned to a small tick count after boot is measuring warm-up rather than behaviour, and the browser and the node simulation do not agree on how far boot has already advanced. Every remaining `advanceTicks(n)`-then-assert in the browser suite is the same defect waiting for a different scheduler; the robust shape is to poll for the state, which this very test already does further down for the scout's arrival.

**The prediction came true the same day, and named the mechanism.** `game-combat-and-meta-combat > can right-click just beyond the rendered body of a moving enemy unit` failed twice inside the full suite and passed 4/4 in isolation. It aims at a MOVING target, and the simulation was not paused — so the view's own frame loop advances the world in real time, and extra ticks pass between reading the scout's position and clicking beside it, however many the machine's load allows. The test's 4-attempt retry loop was compensating for a wall-clock dependency rather than removing it. `setPaused(true)` makes `bridge.step` a no-op so only `advanceTicks` moves the world, and the scout is then exactly where the snapshot said.

So the sharper form of the rule is: a browser assertion is load-dependent whenever the thing it measures can move without the test asking. Measured population: **only 4 of 34 browser specs pause**. That is not thirty defects — most assert nothing that moves — but it is where the next one comes from, and it is now a counted population rather than a surprise.

## 2026-08-31 — A TDZ crash that both gates passed clean (RESOLVED)

**Symptom.** During the sixteenth attempt at the AI economy, moving a haul-cost helper put a `const` arrow below the filter that called it. Every gather assignment threw a `ReferenceError` in the temporal dead zone, and the AI stopped gathering entirely. `npm run typecheck` and `npm run lint` were BOTH green through it. The only reason it surfaced is that a probe reported zero gathering villagers; a reviewer had flagged the identical hazard on a different file hours earlier the same day.

**Root cause.** `@typescript-eslint/no-use-before-define` was not configured in `eslint.config.js`. TypeScript does not reject a use-before-define on a `const` — it is legal to write and fails only at runtime — so nothing in the gate set could see it.

**Fix, and what it found.** The rule is on, with `functions: false` so the hoisting the codebase deliberately relies on for mutually-recursive helpers still works. Enabling it immediately reported **24 existing violations across 13 files**, so the class is live rather than theoretical. Seven were genuinely restructured — module constants hoisted above their uses in `teamProductionBonuses`, `civTechTree`, `voxelSelectionController`, `worldOccupancy`, and the two closure `let`s in `createHudController` plus the formation planner in `humanInputOps`. The remaining seventeen are marked at the site with an explicit disable naming this entry: all are deferred-execution uses that cannot fire today, and none has been individually audited, which is precisely why they are marked rather than quietly excluded.

Three of the touched files crossed the 500-line cap once the markers went in, and that is worth recording as a design consequence: a per-site suppression costs a line, so a file at the budget cannot absorb one. Two were brought back by doing the real restructure instead of suppressing, which is the outcome the constraint should produce.

**How it is checked from now on.** The rule itself, verified to bite: a fresh two-line use-before-define is rejected by `npm run lint`. New code cannot reintroduce the class.

**What this predicts.** Any rule that TypeScript accepts and ESLint is not configured for is invisible to this repo's whole gate set, and the 24 hits say the assumption that "typecheck plus lint covers it" was already false. The seventeen marked sites are a standing list of where this class still lives.

## 2026-09-01 — The expansion-civ tech gap is a DATA gap, not a code gap (OPEN)

**What was believed.** An earlier audit called the remaining expansion-civilization content "~41 unwritten CSV rows"; a later correction called that wrong in kind and said the CSV is complete for all 30 civilizations with the gap entirely in code. The second claim is also wrong, and the distinction matters for how the work is scoped.

**Measured.** `design/stats/civilizations.csv` does list the unique unit and unique technology NAMES for all 30 civilizations — that is the column the correction was reading. But `design/stats/technologies.csv`, which holds the age, host building, cost, build time and effect, contains **none of the 20 remaining expansion unique technologies**, and none of the four already shipped either. A grep appearing to find one was a false positive: "Double Bit Axe" matching a `^Double` pattern intended for "Double Crossbow".

**Consequence.** Closing this gap is not writing 20 code entries against existing rows. Every one needs its age, host, cost and effect sourced from outside the repo and verified — which is what the four shipped ones did, and why two of them corrected values that memory had wrong (Shatagni is +2 range, not +1; the Incas' Couriers now grants armour rather than speed). It is per-technology research, not mechanical translation.

**Current state, from an instrument validated against known-present and known-absent names:** 20 unique technologies and 17 unique units remain across 12 expansion civilizations. Several are additionally blocked on effect vocabulary the engine does not yet express — regeneration for Maghrabi Camels, splash for Druzhina, trade-cost and tribute seams for Silk Road and Paper Money — and five depend on unique units that do not exist yet.

**Instrument note, the fifth of this class in two days.** The first run of that probe reported ZERO missing, because it searched the header for `unique unit` while the file uses `unique_unit`; both column indices resolved to -1, every cell read empty, and the answer was a claim about the query. It was caught only by printing the header and the column indices. The probe now asserts two known-present names resolve true and a fabricated one resolves false before it reports anything.

## 2026-09-01 — The behind-building cue's ENEMY colour was the half nobody looked at (RESOLVED)

**Symptom.** The cue that shows a unit hidden behind a building draws it in one of two ownership colours. The enemy one was a warm coral, and it very nearly vanishes against the building it is drawn on — measured mean RGB distance from a bright roof of 82 against the friendly blue's 197.

**Why it survived three iterations of the feature.** `occlusion-showcase-fixture` spawned only owner-1 villagers. Every capture ever taken of this cue — through the white-to-coloured change, the transparency attempt, and its revert — was the FRIENDLY blue. The colour carrying the answer to the question the cue exists for ("are those mine?") had never been rendered in a screenshot anyone looked at.

**Root cause.** Coral shares a hue family with every roof in the palette. Scored as the SMALLEST RGB distance to any building material — which is what a cue's legibility is bounded by, since it is only as readable as its worst background — coral manages 76 against thatch, where the friendly blue manages 105 against steel. Magenta reaches 137: more legible than either, while staying 192 from the blue so the two can never be confused, and far from the yellow selection outline and cyan drag rectangle the spec requires it to differ from.

**How it is checked from now on.** Two things, because either alone would have missed it. The fixture now seats an ENEMY-owned occluded unit beside the friendly one behind the same Town Center, so both colours appear against the same roof in a single capture. And `tests/rendering/occlusionSilhouetteContrast.test.ts` pins the PROPERTY rather than the hex — worst-case distance to any building material, plus a minimum separation between the two ownership colours — and red-checks: restoring the coral fails it at 76 against a bar of 90.

**An instrument correction inside the fix.** My first scoring probe used a hand-picked subset of the palette and reported the friendly blue at 97. Against the real `VOXEL_COLORS` the blue sits 67 from `waterGlint` — but a silhouette is only ever painted over a BUILDING, never water or foliage, so the correct population is building materials and the true figure is 105. The test names that subset explicitly rather than inferring it, because getting this scoping wrong in the other direction is exactly what let coral through.

**A third instance of the load-dependent browser class, found while shipping this.** `game-progression-production > can train a Monk ... and earn gold income` measured 28 ticks elapsed against a 20-25 tolerance band. Its own comment named the cause — "the game view's own update loop running between evaluate() calls" — so the band existed to absorb real-time drift rather than to assert anything. Pausing makes the count EXACTLY the 20 requested, which is both stronger and load-independent, and the band is gone. That is now three specs fixed by the same move (fog memory, the moving-enemy click, this one), against the register's own prediction that only 4 of 34 browser specs pause.

**What this predicts.** Any two-state visual cue whose fixture exercises one state is untested in the state that matters, and the untested one will be the one carrying the information. The pixel diff also showed a deterministic ±1-5 per channel shift across the minimap from the tint change alone — sub-perceptual, and worth knowing that a colour change in one lane moves rounding in another.

## 2026-09-01 — Three recorded conclusions were all the same horizon artifact (CORRECTION)

The AI self-play verification ran to 34,000 ticks and reported: no owner-slot reaches the Imperial Age, and decided matches sit unresolved. Both went into the record. Both are wrong, and so was a third conclusion built on the second.

Run to 60,000 on five of the same seeds:

    default-seed  o2   feudal 9,750   castle 24,000   IMPERIAL 40,250
    seed-3        o2   feudal 9,500   castle 21,500   IMPERIAL 41,250
    delta              match ended early: VICTORY
    eta                match ended early: DEFEAT
    seed-1        o1   qualified 53,250, castle 54,750

**The Imperial Age is reached**, at ticks 40,250 and 41,250 — 6,000 past where the audit stopped looking. Castle arrives between 20,500 and 30,000, so a 34,000 horizon left as little as 4,000 ticks to bank 1,000 food and 800 gold AND put up two Castle-Age buildings. The game reaches all four ages.

**Matches DO resolve by conquest**, given time: one victory and one defeat in five seeds. The 2026-08-30 register entry describing a decided match running forever, and the resignation feature built and reverted for it — which review proved would have declared living players dead — were both responses to a 60,000-tick behaviour observed through a 34,000-tick window.

**And late arrivals are real, not noise.** `seed-1` owner 1 qualifies at 53,250 and takes the Castle Age at 54,750. Any horizon under that scores it as walled.

**What this costs and what it buys.** The costs are recorded above: a feature designed, implemented, reviewed and reverted for a symptom that partly was not there. What it buys is a sharper rule than "use a longer horizon" — a horizon is an instrument that must be re-justified every time the measured thing changes. 34,000 was chosen to see the Castle Age and is the wrong instrument for the Imperial one. The self-play audit's headline numbers are now qualified by the window they were taken through, wherever they appear.

## 2026-09-01 — Two technology cost rows claimed a source that was never consulted (RESOLVED)

**Symptom.** `researchTables.ts` carried `sultans: { gold: 400 }, // ... (wiki: 400 gold)` and `carrack: { wood: 200, gold: 200 }, // ... (wiki: 200w 200g)`, and the commits that added them said the values were wiki-verified. No wiki was consulted for either. The numbers came from model knowledge of AoE2 DE.

**Why it matters more than the numbers themselves.** The four technologies before them — Shatagni, Recurve Bow, Farimba, Kasbah — WERE checked against the wiki, and two changed as a result: Shatagni is +2 range rather than the +1 memory offered, and the Incas' Couriers turned out to grant armour where memory had speed. That is the entire reason this repo has a standing lesson that a remembered game rule is a hypothesis. Writing "(wiki: ...)" beside an unchecked value does not just risk a wrong number; it disarms the check for whoever reads it next, because the row looks already settled.

**Fix.** Both rows now read `UNVERIFIED`, with a sourcing note above `RESEARCH_COSTS` that states plainly what was and was not checked and why the repo cannot settle it internally: `design/stats/technologies.csv` has no row for ANY expansion-civilization unique technology, which is the data gap recorded separately today.

**How it is checked from now on.** Not by a test — a value's provenance is not something the suite can see, which is the point. What changes is the standard: a sourcing annotation is a claim about work performed, and if the work was not performed the annotation says UNVERIFIED. The effects of both technologies are right in kind and their tests pass on the mechanism, so nothing is broken; what was wrong was the confidence attached to two numbers.

**What this predicts.** Any comment of the form "(source: ...)" written in the same motion as the code it annotates is worth doubting, because the natural time to write it is when the value feels obvious — which is exactly when it was not looked up.

## 2026-09-01 — The Feudal wood ledger was wrong by an order of magnitude, and farms are the sink (CORRECTION)

**What was published.** Repeatedly, in the register and the devlog: "715 wood reached buildings and 525 went to 21 spearmen out of 1,240 total" over 20,000 ticks. That figure has been the basis for calling military-versus-construction the contention that walls the AI in Feudal.

**What is actually true.** Measured observationally — sum of stockpile DECREASES as ground truth, attributed by entity-id diffs and farm-refill jumps — over the Feudal window only, nine seeds and eighteen owner-slots:

    7,500  41.4%  farm construction        1,650   9.1%  blacksmith
    4,020  22.2%  farm reseeding           1,400   7.7%  archery range
    1,775   9.8%  spearmen                 1,175   6.5%  houses
                                             525   2.9%  stable
                                             175   1.0%  market

**Farms take 63.6% of all Feudal wood — three times what the qualifying halls get (20.7%).** The old figure did not count reseeds at all, and reseeds alone are 22%. Military is under 10%, not the co-equal claimant it was described as.

**And the AI farms while free food stands next to it.** `default-seed` owner 1 held 2,125 food of gatherable natural food within gather range of its own Town Center, FLAT from tick 18,000 to the horizon, while its wood never passed 58 and it built up to seven farms. Every seed carries roughly 1,820 of sheep, boar and berries inside that radius. A farm gathers 0.333 food/s — level with sheep, better than berries at 0.3125, WORSE than boar and deer at 0.408 — so the soil is not even faster.

**Why capping farm COUNT does not fix it, proved rather than assumed.** A branch built exactly that cap: it improved the headline at both horizons (Castle-Age slots 4→7 and 10→13) and was correctly rejected, because the wood ledger moved only 5.6%. Soil costs 60 wood per 175 food whether it is built or reseeded, so cutting plots does not cut wood — the same labour simply cycles fewer plots faster, and new-farm wood down 23% came straight back as reseeds up 25%. The headline gain was a build-order SEQUENCING effect (the picker stops returning `farm` and reaches `blacksmith`), not a demand reduction, and it failed on held-out seeds at 24,000 (Castle 1→0).

**The two levers this points at, neither yet tested.** The reseed is ungated: it fires whenever affordable, even with 1,600 food banked, and is 22% of Feudal wood. And the assignment comparator prefers a 60-wood farm to free sheep ten tiles away, because farms are tier-1 and Town-Center-adjacent. The second is what would make the first pay.

## 2026-09-01 — The gather comparator measures a distance the units cannot walk (OPEN, and it relocates the root cause)

**What was believed.** Commit `5c31d4e8` identified the routing gate as the ANCHOR: `findNearestDropOffBuilding` is resolved from the VILLAGER's position, so villagers clustered near the Town Center always make the TC their reference, and a tree beside a Lumber Camp is never preferred. That is true, and it is the smaller half.

**What is actually true.** The comparator ranks candidate resources by MANHATTAN distance, and movement is strictly 4-connected — `findGridPath` is called from `movementPlanOps.ts:236` with no `allowDiagonal`, and `civ-engine/src/path-service.ts:202` defaults it to `false`. Both verified directly.

On open ground those agree exactly, so the metric is correct there. Around obstacles it is arbitrarily wrong — and a forest is a dense block of impassable resource cells, which is why the error concentrates almost entirely in wood.

Measured on the AI's live targets: wood villagers work trees at Manhattan 3.6-10.1 whose true walk is **2.6 to 45.1 tiles**. On `aoe2-prototype` at tick 24,000, three villagers were on trees at walk 37 and 35 while trees at walk 0 and 3, holding 100 wood each, sat unused — every one reads as Manhattan 8-9 to the comparator, and two more at the same distance are UNREACHABLE.

**The size of the prize, measured rather than assumed.** A near-optimal assignment is worth **1.49x** the AI's measured total gather throughput over 16 owner-snapshots on four seeds, three of them held out. By resource: wood **2.61x**, stone 1.22x, food 1.05x, gold **1.00x**. Gold sits in the open and has nothing to gain, which is the cleanest confirmation available that obstacles are the mechanism. A replica of the current policy scores 1.01x measured, which is what makes the model credible.

**Which half to fix, ablated.** Ranking from the resource's own nearest drop-off (the anchor fix) recovers 1.16-7.63x on wood; ranking by TRUE WALK recovers 1.62-7.63x; both together equal the metric fix alone. **The metric dominates and is never worse.** This is why seventeen attempts at re-weighting the comparator all failed — every one re-weighted a broken measurement.

**Corroborated by two shipped games, verified verbatim rather than summarised.** AoE2's own AI scripting language measures resource-to-dropsite and never villager-to-dropsite, and `sn-wood-dropsite-distance` targets a 3-tile wood haul against our 2.6-45.1. 0 A.D.'s Petra builds a new dropsite when the fraction of gatherers walking rather than gathering exceeds 0.15; our wood figure is 0.66-0.67, over four times that, against 0.10 for food and 0.00 for gold.

**What this retires.** Camp PLACEMENT is the small family — an extra optimally-placed drop-off on top of good assignment is worth only 8-20%. And this search's own done-condition "camp usage rises" is WRONG: under a true-path optimum the camp's haul share FALLS on several bases, because the best trees sit beside whichever drop-off is nearest in walking terms, often the Town Center. The DESIGN file records that revision.

**What it does not say.** 1.49x is a resource RATE. Nobody has shown that rate is what gates the Castle Age, and the disqualifiers about aggregate-versus-boot-map and improving-by-doing-less apply to any candidate unchanged. There is also a second, unmodelled loss: one base has a 2.6-tile walk, 17% gathering and 3.28 retargets per load, so churn costs something the distance model treats as neutral.

**A near-miss worth recording.** The branch's first pass priced hauls at Manhattan and concluded the family was capped at 1.03-1.27x and should be abandoned. It caught itself because the modelled gathering fraction (70%) did not match the measured one (19%). The same wrong assumption that causes the defect nearly buried the evidence for it.

## 2026-09-01 — seed-7 is TWO defects, not one (OPEN)

The remainder left by the villager-latch fix (v0.3.175) is not one defect and neither half is the one that was fixed.

```
o1  age=DARK-AGE  vil=10  f=210  w=5   bld: town-center, house, barracks, house, mill
o2  age=feudal    vil=22  f=365  w=10  bld: ..., lumber-camp, mining-camp, ...
```

**The villagers counted as frozen belong to owner 2, the HEALTHY slot.** Four of them sit in `to-dropoff` holding full 10-loads while their `trafficProgressTick` is fresh — 16,462 to 16,499 at t=16,500 — so they are changing cells constantly and still not delivering. That is oscillation near a drop-off, not the starvation fixed in v0.3.175, and the 250-tick cell sampler that found them reports oscillation as a freeze. The metric and the mechanism disagree, and the metric is the one to distrust.

**Owner 1's Dark Age stall is the economy wall in miniature and is unrelated to movement.** Ten villagers is exactly `DARK_AGE_TUNING.villagerCap`. It holds 5 wood and has a Mill but NO FARM; a farm costs 60 wood. No wood, so no farms; no farms, so food stalls at 210 against the 500 the Feudal advance needs; still Dark Age, so still capped at ten villagers. A closed loop whose only entry point is wood — the same wall the whole lumber-camp thread is about, in its clearest single-slot form.

**Instrument gap, recorded so the next reader does not repeat it.** The probe printed `targetResourceId` for units in `to-dropoff`, where the field that matters is `dropOffBuildingId`. Which drop-off those four carriers were walking to is therefore UNKNOWN, and any claim about why they fail to deliver needs that field first.

---

## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (FIXED)

**The fix.** The narrow-passage election keeps stable lowest-id as its ordinary rule, and yields to a unit that has not CHANGED CELL for `TRAFFIC_STARVATION_TICKS` (750). Gated by `tests/simulation/movementTrafficFairness.test.ts`.

Measured across six seeds at 20,000 ticks, villagers frozen >= 1,000 ticks while in a walking task:

```
seed              before            after
aoe2-prototype     500 / 0     ->    500 / 0     preserved field-for-field
seed-2            2750 / 6     ->    500 / 0
default-seed      1750 / 3     ->    500 / 0     (o1 buildings 17 -> 19)
corpus-seed-b     1250 / 5     ->   1000 / 2
seed-7            5250 / 12    ->   3500 / 5     improved, NOT cured
seed-11            500 / 0     ->    500 / 0
  stuck villagers     26                7
```

`seed-7` is the honest remainder: five villagers still freeze there and its owner 1 is still walled in the Dark Age, so that seed holds a second cause this fix does not reach.

**Two rejected attempts, which is where most of the information is.**

*Attempt 1 — replace the election with a fair epoch-rotated rank.* Cured four seeds (26 stuck villagers down to 5) and regressed the boot map from ZERO stuck villagers to five, with owner 1 losing four villagers. Rejected on the adoption rule, the same bar that rejected branch A and round 2. A fix that perturbs a map with no pathology is trading a real regression for an aggregate.

*Attempt 2 — yield only to a unit that has not been ADMITTED for 750 ticks.* Preserved the boot map and changed nothing else at all: `seed-2` stayed at 2750/6. The null result diagnosed the error precisely. `resolveMovementTraffic` is consulted about 44 times per unit per tick, so a villager frozen for 2,750 ticks still collected sporadic admissions — 12 in 40 ticks, measured — and every one reset the clock. **Permission is not progress:** crossing one cell needs ~3.2 CONSECUTIVE admissions at 0.32 tiles/tick, so an occasional yes buys no movement. Attempt 3 gates on the unit actually changing cell, and that is the only difference between them.

**Why lowest-id was there.** The file's header: decisions must be derived so that "ECS iteration order cannot decide who gets to enter first." Any replacement must stay a pure function of tick, ids and per-unit state, and every member of one closure must elect the SAME winner or two units drive into one cell. The shipped fix keeps both properties.

**Residual risks, named rather than discovered later.** 750 is a tuned constant standing on measurement — above every healthy figure (500) and below every pathological one (1,250+) across these six seeds; a map whose healthy waits exceed it would be perturbed, and no such map is proven absent. And two movers whose closures differ could still elect different winners; this degrades no worse than lowest-id did, which is an argument, not a proof. AGENTS.md routes concurrency-class work to multi-cli-review; that skill runs through subagents, which this session's instructions prohibit, so this was self-reviewed and the risks are recorded here instead.

---

## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (root-cause record)

**The cause is measured, and it is neither of the two things this entry previously proposed.** It is not containment and it is not an unreachable-target latch. The narrow-passage traffic arbiter elects `Math.min(...cycle)` — the single LOWEST unit id in the jam — and admits only that one. In a jam that is continuously replenished, high-id units are never admitted. Admission rate over 40 ticks in the frozen window on `seed-2`, every unit in the choke:

```
id     proceed   wait    admitted
2432     2032     264      88%
2434     2232    1091      67%
2436     2255    1565      59%
2443     1121    1658      40%
2448      827    1668      33%
2451      769    2126      27%
2452      647    2335      22%
2455      349    2673      12%
2456      243    2543       9%
2458       68    2080       3%
2460       12    2092     0.6%
```

Monotonic in id, with no exceptions. The newest villager wins 12 of 2,104 attempts. Every unit moves sometimes, so this is STARVATION, not deadlock — which matters because a deadlock-breaker is the wrong fix.

**The geometry.** A one-tile choke at (48,30): trees at (48,29) above, the 2x2 lumber camp at (48,31)-(49,32) below. Eleven villagers meet there head-on — five westbound to trees (2434 2443 2451 2456 2460) against five eastbound to drop-off 2186 (2432 2436 2448 2455 2458) — three deep in each of (45,30), (46,30), (47,30). All carry a CURRENT learned direction, so the wait-for closure is valid and the election runs normally; the election itself is the defect.

**The target churn is a symptom, not the cause.** A frozen villager's `targetResourceId` cycles (2247 -> 2251 -> 2245 -> 2252 -> 2253) because the unreachable branch in `toResourceStep` keeps reassigning it. That branch is working as designed; it re-picks a DESTINATION, and this unit's problem is that it cannot take a STEP. Destination-side recovery can never fix an origin-side block.

**A carrier is included.** 2458 holds a full 10 wood it cannot deliver, so a BUILDING is unreachable too, not only trees — which is why "every direction is blocked" earlier read as containment.

**Reproduces on unmodified HEAD**, no camp patch: five villagers frozen simultaneously on `seed-2`, longest 2,750 ticks, ids 2460/2451/2458/2452/2455.

**My own instrument error, caught before it was published.** The first map I drew used `b.width ?? 1`; the field is `footprintWidth`, so every building rendered 1x1 and a 4x4 Town Centre appeared as one cell. I had a complete chain ready to write from that map — not sealed, therefore the pathfinder is wrong, therefore the bug is in A* — and every step of it followed from a grid built on a guessed field name. Verified afterwards by drawing both anchor conventions and counting units standing inside buildings: TOP-LEFT gives 0, CENTER gives 3, so TOP-LEFT is correct. A probe that reconstructs game state from guessed field names is a hypothesis about the schema, not a measurement of the game.

**Two prior characterisations in this entry were wrong and are corrected above:** "(51,28) is not a sealed pocket... this is a movement or assignment latch" was RIGHT about it not being containment and imprecise about the rest; the blocker is other UNITS, which never appear in a passability check, so open neighbours are entirely consistent with the freeze. The `isFree` placement guard has no hole — it was never the mechanism.

**What the fix must preserve.** The current rule is stable-lowest-id specifically so that "ECS iteration order cannot decide who gets to enter first" (the file's own header). Any replacement must stay a pure function of tick and unit id, and must keep every member of one closure electing the SAME winner, or two units enter one cell. A fair rotation keyed on the tick satisfies both. This file already carries one scar from this family — "two wood carriers and two villagers sat one step from their lumber camp for ten thousand ticks" — whose fix added this very election, so the class needs a liveness property, not another special case.

---

## 2026-09-01 — Villagers latch on an OPEN cell when buildings move (superseded framing, kept for provenance)

**Symptom, at its worst.** During branch A of the lumber-camp search, a candidate that relocated the Lumber Camp pushed the Mining Camp onto the Town Center's shoulder at (52,24). On `aoe2-prototype`, owner 2's economy then stopped dead at tick ~7,500 and never restarted: all ten villagers stood on a single cell, (51,28), every one in `to-resource`, none moving, from tick 9,000 to tick 20,000 — with the berry bushes REGROWING because nobody was eating them. Food 320, wood 157, gold 300, stone 200, byte-identical across twelve thousand ticks. No engine halt and no tick failure. Owner 2 never left the Dark Age.

**(51,28) is not a sealed pocket.** (50,28) and (52,28) are open grass in both arms, and there is a gold mine three tiles away the villagers never reach. The `isFree` guard in `findPlacementAnchorNear` exists to stop the AI walling itself in and does not prevent this. So this is not a containment bug; it is a movement or assignment latch that a building rearrangement can trigger.

**Isolated rather than theorised.** Flipping the Dark-Age build order so the Mining Camp is requested first returns it to (46,31) and the deadlock disappears entirely — owner 2 has eleven villagers spread across farms and trees, all gathering. The trigger is the DISPLACEMENT, not the camp's own position.

**How common is it on unmodified HEAD? Smaller than first reported, and the first measurement was mine and wrong.** Counting villagers whose CELL does not change over 250-tick samples gave 1-3 stuck villagers on every seed and freezes of 20,750 ticks. That probe was invalid: a villager with `task: 'gathering'` stands still BY DESIGN — it is chopping — so the query counted normal work as a freeze.

Restricted to `to-resource` and `to-dropoff`, the states where a villager should be moving, over 34,000 ticks:

    seed-2           4.2% of walking samples frozen >= 2000 ticks   longest 5,750
    default-seed     0.3%                                          longest 2,500
    aoe2-prototype   0.2%                                          longest 2,250
    seed-1           0.0%                                          longest 1,500
    corpus-seed-b    0.0%                                          longest 1,500

So on HEAD this is largely one seed's problem and marginal elsewhere — NOT the widespread standing defect the first probe implied. What branch A found is a far more severe manifestation that a building rearrangement can provoke.

**Why it is registered rather than fixed.** It is the gate in front of the largest prize measured on this wall: branch A's candidate moves camp usage from 39.7% to 51.9% and Castle-Age owner-slots from 4 to 7 and 10 to 14, and this latch is the only thing disqualifying it. A fix needs the latch understood first — a villager in `to-resource`, on open ground, with a reachable target, that never moves again.

**What this predicts.** Any AI change that rearranges building placement can trip it, which makes it a hazard for a whole class of future work rather than for one candidate. It also means the placement guard's contract — "do not wall yourself in" — is weaker than it reads: a unit can be immobilised on ground that is not enclosed at all.
