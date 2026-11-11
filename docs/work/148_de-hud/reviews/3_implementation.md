# Review 3: implementation (M2, the round 2 repairs)

## Target

aoe2, work 148 M2: the repairs of review round 2 ([record](2_implementation.md)). Commit `30f59e8d` on branch `de-hud-m2-1106`, its diff against the round-2 revision `cb557020`: three copy lines (`src/ui/hud/helpText/buildingHelp.ts`, `unitHelp.ts`), the price census's readers (`tests/ui/shownPrice.helpers.ts`, `tests/ui/shownPriceReader.test.ts`), the requirements test, two more cases beside it, the browser spec's longest copy, and the spec's and the changelog's wording.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt named each of round 2's five findings with what its repair claims, and asked whether each repaired copy line is now true of the rules, whether either price reader can still read a price from text that is not a quote or miss a real one, whether the exact-relation check is sound and what the derivation still misses, and for anything the spec or the changelog says that the code does not do. The sandbox check passed (no failed command in its log), and the tree was unchanged across the run. Outside the diff it cites `prototypeBuildingRules.ts:344`, `unitClassSets.ts:79`, `uniqueTechnologyUnlocks.ts:23`, `projectileTechOptions.ts:41`, `tributeOps.ts:67` and `selectionPanel.ts:249`. It ran no test, build or browser session.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

1. **R3-1 — P1: Watch Towers now advertise a garrison they cannot accept.** `src/ui/hud/helpText/buildingHelp.ts:25` says the Cavalry Archer line adds arrows inside a tower. However, canGarrisonAt:344 (`src/game/simulation/prototypeBuildingRules.ts:344`) excludes mounted units from towers, and both Cavalry Archer tiers are mounted:79 (`src/game/simulation/prototypeUnitRules/unitClassSets.ts:79`). Players cannot perform the advertised action. The new test checks classification and arrow arithmetic without checking admission. Derive the advertised set from both rules; the revised spec repeats this mistake.

2. **R3-2 — P2: The “exact relation” check still accepts false unlock claims.** `tests/ui/helpTextRequirements.test.ts:71` discards the producer and stops reading at the first comma; line 111 (`tests/ui/helpTextRequirements.test.ts:111`) likewise reduces each derived relation to its unit name. By inspection, changing Anarchy to “The Stable can train Huskarls, as the Castle does.” still compares equal. Likewise, “The Dock can build Cannon Galleons, Hand Cannoneers and Bombard Cannons.” reads only `Cannon Galleon` and passes. The actual Anarchy rule retains the building restriction (`src/game/simulation/uniqueTechnologyUnlocks.ts:23`). Preserve producer–product pairs and check the complete claimed list. The spec’s promise that extra names fail is currently stronger than this test.

Other coverage limits: the derivation excludes technology prerequisites such as Masonry → Architecture (`src/game/simulation/bridge/projectileTechOptions.ts:41`). It also misses the Market’s “Needed to send tribute” (`src/ui/hud/helpText/buildingHelp.ts:31`), enforced by `src/game/simulation/bridge/tributeOps.ts:67`. Upgrade wording such as “the Archery Range trains Crossbowmen” (`src/ui/hud/helpText/upgradeHelp.ts:11`) bypasses both parsers; upgrades are explicitly excluded from the derivation.

- **R2-1 — partly repaired.** Castle copy is accurate: it permits other land-unit garrisons and fires one arrow plus qualifying additions (`src/game/simulation/prototypeBuildingRules.ts:377`). Removing the general shelter sentence makes that capability less explicit. Watch Tower remains incorrect under R3-1.
- **R2-2 — repaired.** The two-step wording matches `src/game/simulation/bridge/contextRouter.ts:108` and the three-cell unloading guard (`src/game/simulation/bridge/garrisonOps.ts:157`).
- **R2-3 — repaired.** shownCost:78 (`tests/ui/shownPrice.helpers.ts:78`) cannot fall through to Spies’ rule. Build labels use the separate reader at line 183. All inspected callers use the appropriate reader; no mismatch with current quote formats found.
- **R2-4 — partly repaired.** Chemistry’s omission is caught, and Anarchy plus both explicit unlocks are derived. R3-2 prevents calling the relation check complete.
- **R2-5 — repaired.** Spec §14.2 (`design/spec-final.md:2035`) and changelog:12 (`docs/changelog.md:12`) name the removals. The placement hint remains at `src/ui/hud/selectionPanel.ts:249`.

Reviewed `30f59e8d`; tracked files matched it. The browser maximum now includes all four tables, and the added refusal cases match the formatter and simulation by inspection. I did not run tests, builds, CI checks, mutations, or browser/render verification, and did not independently revalidate the DE source strings. No files were changed.

## Findings and disposition

1. R3-1 (P1): repaired. No tower admits a Cavalry Archer (`canGarrisonAt`), so the Watch Tower's line names "Villagers, the Archer line and Longbowmen". The test no longer checks the counting rule alone: `addsAnArrowInside` takes every unit a building admits (`canGarrisonAt`) and asks `buildingArrowCount`, fed as `towerCombatSystem.ts` feeds it, whether one of it adds an arrow, for the Watch Tower (six units), the Castle (the seven of `ARCHER_LINE_UNITS`, no Villager), the Town Center (every unit it admits, as its line says) and the Bombard Tower (none); red with round 2's tower line put back (1 case) and with "Archers and Villagers" (2).
2. R3-2 (P2): repaired. `statedAsMade` reads every "<Producer> can build|train <list>." of a line as producer and product pairs over the whole list, and each must be a pair the rules hold (`heldBehind`, building by building); what the rules hold and no such sentence states must equal the "Required for" list. Anarchy's line is "The Barracks can train Huskarls.", the relation in the form that is read whole. Both of the reviewer's counterexamples are red: "The Stable can train Huskarls." (1 case) and a Dock said to build Hand Cannoneers and Bombard Cannons (1), and a case in the file reads both strings to pairs.
3. R2-1 and R2-4, "partly repaired": completed by the two repairs above.

Noted and not changed, each named in the test's bound: a technology that waits on another technology (Architecture on Masonry) is not stated as "Required for", since DE's tooltips do not and the simulation's refusal does; the Market's "Needed to send tribute" is an action, not something built or trained, and is true (`tributeOps.ts:67`); an upgrade's "the Archery Range trains Crossbowmen" is a tier change, which the derivation holds at the line's first tier. The Castle's line no longer says in so many words that units can garrison inside: the 200-character cap leaves no room beside whose garrison adds arrows, and "garrisoned inside" says it.

## Verification

Each repair has a test that is red with its defect put back (`tmp/mutate-m2.mjs`). On the repaired tree (`8e6e6e25`): `npx tsc --noEmit` exit 0; eslint on the changed files exit 0; `npx vitest run tests/ui tests/architecture` 66 files and 587 tests, exit 0; eight browser specs, 63 cases, exit 0.

## Round outcome

One P1 and one P2, both repaired, each with a test red before its repair. Round 2 found three of twenty checked copy lines wrong and round 3 a fourth, so round 4 audits the copy tables against the rules beside checking these repairs ([record](4_implementation.md)).
