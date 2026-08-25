## 2026-08-25 (combat team bonuses + the attack-step extraction, v0.3.82)

- 2026-08-25 v0.3.117 attack-ground (unit.attackGround command; dead-target isArea projectile = pure blast at the cell; G arming; order never self-clears); first bombard test was a FALSE POSITIVE off auto-aggression until the empty-cell test caught the missing executor branch; 500-cap compactions (formation-order helper, view wrappers).
- 2026-08-25 v0.3.116 bell peal (live-facade ring tally as the audio observable — cosmetics never become sim state).
- 2026-08-25 v0.3.115 town bell (ring/back-to-work as building.action; greedy nearest-shelter fill; ungarrisonBuilding gains a villager-only filter so soldiers hold the wall); v0.3.114 Delete key devlog folded here.
- 2026-08-25 v0.3.114 Delete key (entity.delete command; ownership validator; one-per-press; routed through the combat destroy ops); two exhaustiveness guards (pinned-units oracle, pendingCommandQuery) fired on the new variant exactly as designed.
- 2026-08-25 v0.3.113 gathering work animation: activeVerb widened to gathering (gatherer.task source); the stationary-start transition needed an explicit setComponent diff or the projector never re-read the verb; selectionStateOps split (entityReadProbes) for the 500 cap.
- 2026-08-25 v0.3.112 control groups persist (controlGroupsCodec joins Tier-1, inventory pins 42→43); recall's generation prune covers pre-save deaths free.
- 2026-08-25 v0.3.111 per-set roof silhouettes (RoofGeometry heightScale/insetScale/layerDelta in steppedRoof; insets only shrink so footprint invariants hold; accents ride the returned top); four-set capture sweep confirms distinct shapes.
- 2026-08-25 v0.3.110 audio slice 2: research ding (monotonic count diff, pre-seed snapshot) + countdown bell (edge-trigger).
- 2026-08-25 v0.3.109 procedural audio slice 1 (horn/age-up/match stings, WebAudio synth, lazy context on first gesture, mute persists); exposed getRecentUnitAttacks on both bridge facades; extracted selectionRecallHotkeys and caught the stale-bridge capture (pass bridgeRef, not bridge — createApp swaps bridges on load).
- 2026-08-25 v0.3.108 architecture walls: plaster/plasterLight re-key per set centrally in the building part adder (roofs keep their site-level consult); default map 0.33% diff = shimmer only.
- 2026-08-25 v0.3.107 mechanical-unit repair: villagers mend siege+ships (armor-class-derived predicate, building-repair economics, pursuit via findUnitRangePlan, 'repair' command with unit ref); test's 360-HP magic number was the wrong table — parameterize on getEntityHealth.
- 2026-08-25 v0.3.106 allied gate passage (gateAdmits + teams map through cellPassability); gates fixture gained a third idle party after the allied 2-player variant ended by conquest on tick 1 and froze the walk test.
- 2026-08-25 v0.3.105 per-civ architecture pass 1: six roof-material sets keyed off civ (sim projects `architecture`, fog memory + saves carry it, replay resolves real civs), renderer re-keys thatch/tile/ridge before owner blend; diff-proved delta confined to roofs.
- 2026-08-25 v0.3.104: control groups (Ctrl+digit bind / digit recall survivors / double-tap centre; refs-based, selectByRefs prunes the dead; session-transient scope spec-noted; real-key browser spec).
- 2026-08-25 v0.3.103: idle villager bell (count + round-robin '.'-key/button select-and-centre; idleVillagerOps extraction at the 500 gate; pointer-events:auto opt-in — #hud-root is none; browser spec clicks the REAL DOM button per the unwatched-seam lesson).
- 2026-08-25 v0.3.102: browser suite caught the day's one regression — garrisonUnit's unconditional clearSelection wiped the HUMAN selection whenever an AI garrisoned (visible only after v0.3.89's eligibility widening; setter-trap forensics) — fixed as removeSelectedEntity(unit); plus ally right-click=walk / Ctrl=explicit attack, and the pointer->view seam that had silently dropped iso+garrison args; two stale specs re-pinned (fragile house 40/900, Viking imperial berserk 66).
- 2026-08-25 v0.3.101: Heavy Plow farmer-carry clause (+1 base carry on farms, composing with Wheelbarrow like the civ carry bonuses) — the last deferred CSV clause in the farm family.
- 2026-08-25 v0.3.100: Redemption's building half — context routing asks eligibility AT THE CLICK; building lane shares faith/resistance/guards in monkBuildingConversion.ts (extracted at 550); flip moves population supply with civ-bonus fidelity both ways, clears the queue, stalls while garrisoned; red-check.
- 2026-08-25 v0.3.99: construction progress fill (scaffold stages off currentHp/maxHp — the construction HP ramp IS the fraction, no new projection field; construction() moved to details module for the 500 budget); BUILD env + beginBuildingPlacement test-api for staged captures; three-stage visuals inspected.
- 2026-08-25 v0.3.98: per-age military-building HP (Barracks 1200..2100 ladder via buildingMaxHpForAge at creation + generic sweep ratio composing with the Byzantine ladder — 1320 -> exactly 1800 proof); red-check 3.
- 2026-08-25 v0.3.97: building damage states (variant sweep <40% + deterministic recipe flames; repair restores) + building HP table to CSV debut rows (house 75->900 etc. — placeholders the damage fixture exposed); 14 test updates (fragile-startHp fixtures for destruction contracts, budgets, exact-HP); prototype diff 0.75% = water floor.
- 2026-08-25 v0.3.96: garrison-scaled watch-tower arrows (base+archers+villagers, cap 5; infantry none; bombard single) — activates the Teuton more-arrows half; windowed-damage tests after exact-tick asserts hit the knight's charge + the field crew brawling; islands LLM playtest smoke: 3 decisions, 0 command failures.
- 2026-08-25 v0.3.95: Islands map (8 of 8 — roster COMPLETE) + AI ferry (BFS-from-target island model; board/sail/unload via recorded channels; ferry pre-empts building phase after macro spending ate the boat's wood; hold counts toward army size after full boarding zeroed it) + unloadTransport distance guard closing a cargo-teleport hole (far click now sails).
- 2026-08-25 v0.3.94: Nomad map (7 of 8) — nomadStart flag through matchSettings; first-TC-any-age build rule (injected predicate); AI lumber-camp-first opening gated on TC placeability (also enables castle-age TC rebuild); forest patches were the missing piece (villagers idled — no trees near start); visuals inspected; red-check 2+3.
- 2026-08-25 v0.3.93: class predicates derive from armor-class taxonomy (unique infantry join infantry techs/bonuses; unique melee cavalry join barding; mounted archers/missionary excluded by second class); Forging scope = takesMeleeAttackTechs (infantry+cavalry+villagers) — rams' wrong melee-tech gain FIXED; Garland Wars hand list folded in.
- 2026-08-25 v0.3.92: AI tribute phase (ally <150, sender >=1000, 100 chunk via recorded tribute.send intention; executor re-validates); enemy-never-topped-up differential; red-check.
- 2026-08-25 v0.3.91: monk conversion range 4->9 (heal/pickup/deposit stay 4); Block Printing to CSV truth (Imperial, 200g, +3 -> reach 12); boxed-monk fixtures re-tuned to 9/10 with a TRADE CART target (the villager auto-gathered the box trees and wandered — a flaky baseline).
- 2026-08-25 v0.3.90: Incas villager armor (infantry armor line reaches villagers at sweep + factory; attack line already universal — villagers are melee); armor-field assertions with the owned-militia research-done signal; technologyOps compacted back under 500.
- 2026-08-25 v0.3.89: Khmer pair — prereq-free age advance (three canAdvance bypasses) + prereq-free build menu (hasCompletedBuilding => true) + villagers-in-houses (canGarrisonAt gains civ param; house capacity 0+5 via civHouseGarrisonCapacity at entry/HUD/ungarrison sites); red-check 3/3.
- 2026-08-25 v0.3.88: Vietnamese reveal (enemy TCs explored + human fog-memory ghosts at post-seed, via temporary vision source — explored is monotonic, no engine change); CIV env added to captureMapScreenshot; visual differential (ghost vs black) inspected.
- 2026-08-25 v0.3.87: three 9.2 one-offs — Goth Imperial +10 pop (ownerHardPopCap read by all six deriveCap sites + imperial recompute + unconditional load re-derive), Korean tower range by age (fire-site), Japanese fishing-ship rate ladder (gather loop); two new fixtures; deposit-race test measures the 5%; red-check 6.
- 2026-08-25 v0.3.86: age-scaled HP family (Viking infantry+berserks, Vietnamese archery units, Byzantine buildings) — age-aware combatStateFactory + building seam + ratio sweep in the three age cases; berserk not in INFANTRY_UNITS (armor-scope set) so named explicitly; red-check 5/6.
- 2026-08-25 v0.3.85: Ethiopian age-advance grant (+100f/+100g on each advance) as a new civBonusTable family applied in technologyOps' three age cases; red-checked; Ethiopians civ column now fully live.
- 2026-08-25 v0.3.84: Ethiopian team tower/outpost +3 LOS + all four remaining Teuton lines (TC +1 atk/+5 LOS, towers 2x garrison, monks 2x heal range) via new civBuildingBonuses seam on BOTH vision-creation branches; garrison eligibility widened to DE rules (foot soldiers in TCs/towers, mounted in castles); red-check 9/9; entityCreateOps re-split under 500.
- 2026-08-25 v0.3.83: building roofs carry owner colour (mixTint 55% toward owner tint in steppedRoof + TC-tower/dock-house roofs); before/after pixel diff confined to roofs, enemy/owner-3 discrimination frames captured; spec art-direction paragraph superseded (accents-only -> roof blend).
- **Ten combat-stat lines, and the 500-line gate forced the right surgery.** LOS bonuses land at BOTH unit-vision sites (trained-unit creation and the upgrade sweep — one site alone would give upgraded knights the wrong eyes); ranges at the combat-state factory (a Korean mangonel is BORN outranging, proved in-match against a plain one); the class-attack extras (Saracen/Indian vs buildings, Persian knights vs archers) are computed by the command loop and threaded into the delivery params. Wiring them pushed `playerCommandsSystem` to 513, and the honest fix was the one that has been due for days: the 230-line ATTACK branch moved verbatim to `attackCommandStep.ts` (one role — advance an attack one tick), taking the system to 281 and the step to 311. Full suite + combat browser specs green on the extraction. Gates: 2798 tests, typecheck, lint, build.

## 2026-08-25 (team bonuses — the column comes alive, v0.3.81)

- **Thirteen team-bonus lines, one membership predicate.** `teamHasCivilization` is true for the owner and its allies, so a side of one still enjoys its own (AoE2's rule — every bonus 1v1-testable). Seams: relic ticks (Aztec +1 per relic every 3rd tick — fractional rates in an integer economy become deterministic cadences), trade payout (Spanish, at load-time pricing), farm capacity incl. reseeds (Chinese), populationProvided (Slavs, at the ONE derivation both raw-supply sites read), production speed at enqueue (Britons/Goths/Huns by building, Turks by gunpowder unit, Malians university research), construction cost (Mayan walls, Viking docks — `ownerConstructionCost` now also feeds the HUD, so the card quotes the true team price), heal cadence (Byzantines, interval 10→7), conversion resistance (Teutons ×0.5 STACKING with Faith to ×0.25, AoE2's composition), shared sight (Portuguese = Cartography on from Dark Age, as the flag it actually is). **The blob-swap trap resurfaced in my own test:** a civ swapped into a SAVE cannot exercise a creation-time bonus — raw supply is persisted history; the test boots fresh with `civilizationsByOwner` and says why. Gates: 2796 tests, typecheck, lint, build.

## 2026-08-24 (building bonuses + houseless Huns, v0.3.80)

- **One seam, nine call sites, and the HUD shows the owner's price.** `effectiveConstructionCost` is the training-cost rule applied to construction — charge, validator, rejection detail, AI afford (3 sites), farm reseed (a Teuton farm reseeds at its build discount), the agent option list, and the build card + tooltip all agree, because the canon says a button never costs more than it says. Persians' 2x TC/Dock HP multiplies the base BEFORE Masonry's ladder (the unit-HP order). The Huns' houseless population is a rawSupply floor at the match cap seeded at boot — deriveCap still clamps, so custom pop caps bind (tested at 75). `getPlayerCivilization` joined the public bridge for the HUD's sake. Gates: 2791 tests, typecheck, lint, build.

## 2026-08-24 (opening bonuses — deltas, carry, housing, v0.3.79)

- **Three more §9.2 families, each guarded against fixture damage.** Starting deltas apply ONLY where `start.startingResources` is unset, so every fixture stays byte-identical (a fixture that pins 500 food keeps 500 food whatever civ it names); extra units (Chinese +3, Mayans +1, the Inca llama-as-sheep) spawn through the same safe-spawn search as the scenario roster; carry bonuses add BEFORE Wheelbarrow's multiplier (AoE2's order); housing bonuses land at BOTH raw-supply sites so the cap never disagrees with itself. The 500-line gate forced `scenarioSeedOps` (510) to shed the whole civ-opening concern into `civOpeningSeed.ts` — the split IS the feature's shape. Gates: 2788 tests, typecheck, lint, build.

## 2026-08-24 (free civilization technologies, v0.3.78)

- **The grant asks the MENU, so the free path can never outrun a player.** `freeTechnologySystem` (every 25 ticks, cheap early-outs) checks each waiting free tech against `getResearchOptions` for the owner's standing completed buildings — the same function the HUD's buttons and the queue validator read — then applies through the same idempotent `applyTechnology` a paid research uses. Age gates, prerequisite chains (Bow Saw needs Double-Bit Axe), and building requirements (Franks farm upgrades wait for a Mill; Slavs Tracking waits for a Barracks — tested) all live ONCE. Twelve civs, 24 grants, zero new rules. Red-check: void the apply → Aztec Loom never lands. Gates: 2784 tests, typecheck, lint, build.

## 2026-08-24 (civ-bonus breadth — the five-civ cap superseded, v0.3.77)

- **The if-chains became a table, and seventeen civs got their identity.** `civBonusTable.ts` (the uniqueTechnologies pattern: entries as data, one loop per seam) now carries every CSV bonus line the six seams express — gather rate, unit HP, anti-building, train time, cost, and a NEW movement-speed seam composing with Squires/Husbandry where a technology would. **This superseded a standing decision:** the 2026-07-05 five-civ cap, recorded properly in decisions.md — the cap was already false in spirit (16 civs of unique units, 19 unique techs) and the concentration it protected has happened. The remainder (free techs, starting deltas, age-scaled HP, carry, building stats) is LISTED in the spec per family, not silently dropped. Two of my own test expectations were wrong before the code ever ran (70×0.75 and a 31.4999 float-round) — the pure-seam tests caught my arithmetic, which is their job too. Gates: 2780 tests, typecheck, lint, build.

## 2026-08-24 (Coastal, Fortress, Gold Rush — the map roster grows, v0.3.76)

- **Six of §5.4's eight, each with a checkable identity.** Coastal: one sea on the southern edge, dry interior (the test walks the whole bottom row and the whole interior). Fortress: an 11-cell wall square per start with a gated centre-facing face and a standing Castle — the FIXTURE VALIDATOR caught the first version's Castle anchored on a boar and its walls eating berry patches; walls now fell trees on their line (`removeSpawnAt`), skip rarer collisions, and let the map edge serve as the wall where a corner start's square is clipped. Gold Rush: nine neutral double-rich gold nodes dead centre. Arabia is the standard generator under its AoE2 name — and the first test claiming byte-identical terrain was wrong on purpose to learn: same generator, own seed, so the SHAPE is the claim, not the noise. Islands and Nomad stay deferred with written reasons (AI can't ferry, AI can't open TC-less). Gates: 2771 tests, typecheck, lint, build, three map captures.

## Older work (compacted 2026-08-25 — details in docs/devlog/detailed/)

- 2026-08-24 (population cap — §4.6 closes, v0.3.75)
- 2026-08-24 (resources, victory set, and speed become match options, v0.3.74)
- 2026-08-24 (the setup screen — a game, not a URL, v0.3.73)
- 2026-08-24 (AI trading — §6.7 closes, v0.3.72)
- 2026-08-24 (the Missionary — the unit roster closes too, v0.3.71)
- 2026-08-24 (Spies + Atheism — the technology roster closes, v0.3.70)
- 2026-08-24 (naval trade — the Trade Cog, v0.3.69)
- 2026-08-24 (land trade — Trade Cart + Caravan, v0.3.68)
- 2026-08-24 (tribute + Coinage + Banking, v0.3.67)
- 2026-08-24 (§4's map size ladder — eight-player skirmishes, v0.3.66)
- 2026-08-24 (self-healing Berserks + Berserkergang, v0.3.65)
- 2026-08-24 (Guilds, v0.3.64)
- 2026-08-24 (Cartography, and the Market's first technology, v0.3.63)
- 2026-08-24 (teams, v0.3.62)
- 2026-08-24 (three- and four-player skirmishes, v0.3.61)
- 2026-08-24 (player colours, and what a three-player probe found, v0.3.60)
- 2026-08-24 (the Petard, v0.3.59)
- 2026-08-24 (a bomb that survived its own blast, v0.3.58)
- 2026-08-24 (Hoardings and El Dorado, v0.3.57)
- 2026-08-24 (villagers fish the shore, and the AI hunts, v0.3.56)
- 2026-08-24 (why the late game freezes — measured, not fixed)
- 2026-08-24 (auditing the class the arrow belonged to)
- 2026-08-24 (a stray arrow could end the match, v0.3.55)
- 2026-08-24 (the AI had nobody to attack, v0.3.54)
- 2026-08-23 (the upgrade nobody could research, v0.3.53)
- 2026-08-23 (the research side of the same defect, v0.3.52)
- 2026-08-23 (the Dock's three technologies, v0.3.51)
- 2026-08-23 (monk faith and rest, v0.3.50)
- 2026-08-23 (Parthian Tactics, v0.3.49)
- 2026-08-23 (the six new units, proved reachable with a mouse)
- 2026-08-23 (Eagle Warrior line and Hand Cannoneer, v0.3.48)
- 2026-08-23 (the Feudal AI had no stone income at all, v0.3.47)
- 2026-08-23 (thirteen upgrade lines that rendered identically, v0.3.46)
- 2026-08-23 (three unit tiers, and a CSV that disagrees with itself, v0.3.45)
- 2026-08-23 (the AI's build order gets past farms, v0.3.44)
- 2026-08-23 (the AI rings the town bell, v0.3.43)
- 2026-08-23 (garrisoning walks there, v0.3.42)
- 2026-08-23 (the Town Center shelters fifteen, v0.3.41)
- 2026-08-23 (the Fish Trap closes the building roster, v0.3.40)
- 2026-08-23 (the Outpost, and the building roster closes to two, v0.3.39)
- 2026-08-23 (the forest had no wood in it, and the AI reached Castle Age for the first time, v0.3.38)
- 2026-08-23 (three standing rules, and the sweep instrument that makes one of them runnable)
- 2026-08-20 (Transport Ships, on the garrison mechanism that already existed, v0.3.37)
- 2026-08-20 (the tan blotches were hills, v0.3.36)
- 2026-08-20 (Murder Holes, and the blind spot it removes, v0.3.35)
- 2026-08-20 (the camera opens on the world, not on the whole map, v0.3.34)
- 2026-08-20 (the selection panel becomes a command bar, v0.3.33)
- 2026-08-20 (the Castle-Age Monastery tier, and the conformance bug it exposed, v0.3.32)
- 2026-08-20 (gates, so a walled base can be left through the wall, v0.3.31)
- 2026-08-20 (the AI was never stuck on gathering — it was stuck in traffic, v0.3.30)
- 2026-08-20 (the AI's economy was dead, and it took playing the game to see it, v0.3.29)
- 2026-08-19 (the Bombard Tower, Fortified Wall, and tower hit points, v0.3.28)
- 2026-08-19 (sixteen unique technologies, declared rather than coded, v0.3.27)
- 2026-08-19 (four University technologies, and a fixture that could not be tested as written, v0.3.26)
- 2026-08-19 (formations complete unit control, v0.3.25)
- 2026-08-19 (patrol, and why it is not a command, v0.3.24)
- 2026-08-19 (the elite tier, and an upgrade researched in the wrong building, v0.3.23)
- 2026-08-19 (the ghost in front of the Town Center, v0.3.22)
- 2026-08-19 (speed is part of a unit's identity now, v0.3.21)
- 2026-08-19 (nineteen unique units, and the warships nobody could build, v0.3.20)
- 2026-08-18 (attack-move, and a defect only the browser could show, v0.3.19)
- 2026-08-18 (unit stances: the player owns unprompted behaviour now, v0.3.18)
- 2026-08-18 (the war fleet: nine ships on the naval foundation, v0.3.17)
- 2026-08-18 (naval: domains, the Dock, and a working fishing economy, v0.3.16)
- 2026-08-18 (University + Ballistics + Thumb Ring; tower arrows fly, v0.3.15)
- 2026-08-18 (modern HUD: dark glass on a token palette, v0.3.14)
- 2026-08-18 (projectiles: real flight, accuracy, and misses, v0.3.13)
- 2026-08-17 (connected surf curve, terrain colour fields, berry forms, v0.3.12)
- 2026-08-17 (animated shoreline surf + decoration variant library, v0.3.11)
- 2026-08-17 (dependency audit gate back to green)
- 2026-08-17 (Moebius art style, v0.3.10)
- 2026-07-20 (neutral world labels, v0.3.9)
- 2026-07-20 (dedicated game-menu action icons, v0.3.8)
- 2026-07-19 (concrete unit identity, v0.3.6)
- 2026-07-19 (unit recipe and attack-rig extraction, no bump)
- 2026-07-19 (concrete building detail, v0.3.5)
- 2026-07-19 (terrain materials and moving water, v0.3.4)
- 2026-07-19 (convincing tree forms, v0.3.3)
- 2026-07-19 (narrow-choke queueing, v0.3.2)
- 2026-07-17 (code simplification batch, no bump)
- 2026-07-17 (fixture spawn helpers, no bump)
- 2026-07-17 (entityHitShape descriptor, no bump)
- 2026-07-15 (melee strikes reach for the target, v0.3.1 — partial + root cause)
- 2026-07-15 (right-click moves; garrison is Alt+right-click, v0.3.0 BREAKING)
- 2026-07-15 (sticky boar facing v0.2.12 + code simplification, no bump)
- 2026-07-15 (building relief + resource variation + builder hammer, v0.2.9–0.2.11)
- 2026-07-15 (boar gore + wildlife carcass, v0.2.8)
- 2026-07-15 (violent attack poses, v0.2.7)
- 2026-07-15 (automatic post-construction mining, v0.2.6)
- 2026-07-14 (visible, collision-free ungarrison, v0.2.4)
- 2026-07-14 (successful-hit unit attack animation, v0.2.3)
- 2026-07-14 (concurrent villager boar hunting, v0.2.2)
- 2026-07-19 (readable HUD command deck and build palette, v0.3.7)
