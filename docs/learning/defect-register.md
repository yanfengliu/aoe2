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
