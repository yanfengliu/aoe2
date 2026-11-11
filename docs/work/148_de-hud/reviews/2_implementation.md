# Review 2: implementation (M2, the tooltips)

## Target

aoe2, work 148 M2: commit `cb557020` on branch `de-hud-m2-1106`, its diff against `origin/main` (`eb59353d`), 21 files: the tooltip factories (`src/ui/hud/tooltipCopy.ts`), the four copy tables and their index (`src/ui/hud/helpText/`), the controller's title (`tooltips.ts`), the buttons' and the build palette's markup, the stylesheet, the tests, spec §14.2's paragraph, the changelog and the devlog.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt gave the criteria (DE's help text as the source, every claim true of this game's rules, every price the simulation's, the HUD's shape, a test with text longer than any real one, every behaviour change named, files under 500 lines) and asked for five things: the factories, the controller, the escaping and the stylesheet, with every other reader of a tooltip's text; the say-it-once rule against every refusal the simulation gives an age; at least fifteen copy lines checked against the simulation; whether each test fails with the defect put back, and whether the price census's changed reader is weaker than the one it replaced; and anything the spec or the changelog says that the code does not do. The sandbox check passed (no failed command in its log), and the tree was unchanged across the run. It checked twenty copy lines, and outside the diff it cites `towerCombatSystem.ts:111`, `contextRouter.ts:102-111`, `researchAvailability.ts:184-202`, `playerQueries.ts:224-257` and `tests/browser/helpers/playOpening.ts:97-134`, among others. It ran no test, build or browser session. No Claude lane ran: the brief prefers Codex's read-only sandbox, and one lane was judged enough for a change of copy and presentation.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

1. **R2-1 — P1: Garrison-arrow help overstates which archers contribute.** `src/ui/hud/helpText/buildingHelp.ts:35` says “archers inside add arrows”; line 24 makes the same claim for Watch Towers. This includes units the help table itself calls foot archers, such as Chu Ko Nu and Plumed Archers, but those units contribute no arrows. `src/game/simulation/bridge/systems/towerCombatSystem.ts:111` counts only `isArcherLineUnit`; its set in `src/game/simulation/prototypeUnitRules/unitClassSets.ts:31–39` contains the Archer, Cavalry Archer and Longbowman lines. Other foot archers can garrison (`prototypeBuildingRules.ts:344–351`) without increasing firepower. Narrow these descriptions to the actual contributing lines.

2. **R2-2 — P1: Transport instructions omit the second click needed to unload.** `src/ui/hud/helpText/unitHelp.ts:67` instructs the player to board, then right-click the shore “to put them ashore.” From a distant shore, that click only sails the transport there; arrival does not unload it. `src/game/simulation/bridge/contextRouter.ts:102–111` explicitly implements a second click after arrival, and `bridge/garrisonOps.ts:157–162` refuses unloading beyond three cells. Say to sail beside the shore, then right-click it to unload.

3. **R2-3 — P2: The price reader can substitute Spies’ pricing rule for a missing quote.** shownPrice.helpers.ts:68–71 (`tests/ui/shownPrice.helpers.ts:68`) falls back to searching the entire tooltip for `Costs`. Consequently, a broken tooltip beginning `Research Spies (1s)` still yields `{ gold: 200 }` from its body’s “Costs 200 gold per enemy villager.” That body is generated at `src/ui/hud/tooltipCopy.ts:167–168`. For a non-Atheism purchase with zero or one enemy villager, the charge is also 200 (`src/game/simulation/spiesRules.ts:12`), so the census’s missing-price guard and charge comparison can both pass (`tests/ui/shownPriceCensus.test.ts:139–147,189–192`). This is a specific weakening, not a claim that all missing prices pass: the three-villager Spies tests would detect an unconditional omission. Parse command prices exclusively from their title; keep legacy label parsing separate.

4. **R2-4 — P2: The prerequisite test accepts an incomplete “Required for” sentence.** helpTextRequirements.test.ts:125–126 (`tests/ui/helpTextRequirements.test.ts:125`) checks missing prerequisites against the *whole description*, but checks excessive claims against only the parsed requirement sentence. Delete “and Bombard Cannons” from Chemistry’s requirement sentence at `src/ui/hud/helpText/technologyHelp.ts:46`: the test still finds “Bombard Cannon” in the preceding attack-effect sentence, and the remaining Hand Cannoneer requirement is valid. Thus it accepts exactly the “says less” defect that spec §14.2 claims it rejects. Check the requirement relationship itself, separately from mentions in effect descriptions.

5. **R2-5 — P3: Removal of construction instructions is not named.** tooltipCopy.ts:183–184 (`src/ui/hud/tooltipCopy.ts:183`) removes the previous explanation that the command places a foundation and the selected villager walks there to build it. Neither the new spec paragraph nor `docs/changelog.md:9–12` identifies that removal; the changelog instead says the old tooltip supplied price and time “and nothing else.” The old implementation at `eb59353d`, `src/ui/hud/tooltipCopy.ts:117–124`, contains the construction explanation. Name its removal to satisfy the explicit behavior-accounting constraint.

The following are **20 copy-line spot-checks across all four tables**. Evidence paths beginning with `simulation/` are under `src/game/`; copy paths are under `src/ui/hud/helpText/`.

| Copy line | Claim checked and evidence |
|---|---|
| `buildingHelp.ts:13` — Town Center | Villager production and age research: `simulation/buildingProductionTables.ts:14,59`; all-resource drop-off: `simulation/prototypeEconomyRules.ts:283–298`; five population and capped arrows: `simulation/prototypeBuildingRules.ts:31,361–366`. Matches. |
| `buildingHelp.ts:14` — House | Five population: `simulation/prototypeBuildingRules.ts:32`. Matches. |
| `buildingHelp.ts:21` — Barracks | All five named construction prerequisites appear together in `simulation/bridge/buildOptions.ts:57–62`. Matches. |
| `buildingHelp.ts:24` — Watch Tower | Garrison-arrow scope is narrower than stated: `simulation/bridge/systems/towerCombatSystem.ts:106–124`. R2-1. |
| `buildingHelp.ts:35` — Castle | Twenty population and archer-count-based extra arrows: `simulation/prototypeBuildingRules.ts:46,376–377`; production: `simulation/bridge/trainOptions.ts:211–228`. Arrow scope has R2-1. |
| `unitHelp.ts:18` — Scout | Fast movement: `simulation/prototypeUnitRules/unitBaseSpeed.ts:29`; monk bonus and cavalry vulnerability: `simulation/prototypeUnitRules/armorClasses.ts:69,179,183,204`. Supported. |
| `unitHelp.ts:36` — Skirmisher | Minimum range one: `simulation/prototypeUnitRules/unitClassSets.ts:18`; archer and spearman bonuses: `simulation/prototypeUnitRules/armorClasses.ts:186`. Matches. |
| `unitHelp.ts:64` — Trade Cart | Returns to nearest owned Market: `simulation/bridge/tradeCommandStep.ts:87–108`; distance-based profit: `simulation/tradeRules.ts:14–16`. Matches. |
| `unitHelp.ts:67` — Transport Ship | Land-unit boarding: `simulation/transportShip.ts:37–38`; unloading sequence: `simulation/bridge/contextRouter.ts:102–111`. R2-2. |
| `technologyHelp.ts:21` — Bloodlines | Named membership: `simulation/prototypeUnitRules/unitClassSets.ts:48–57,79–89`; +20 HP: `simulation/bridge/combatStateFactory.ts:146–148`. Matches this game’s narrower scope. |
| `technologyHelp.ts:47` — Double-Bit Axe | Wood multiplier 1.2: `simulation/economyTechEffects.ts:38,58–61`. Matches. |
| `technologyHelp.ts:59` — Heavy Plow | +125 farm food and farmer carry bonus: `simulation/economyTechEffects.ts:138–142,167`; reseeding reads current capacity: `simulation/bridge/farmReseed.ts:58–73`. Matches. |
| `technologyHelp.ts:61` — Loom | +15 HP: `simulation/bridge/combatStateFactory.ts:128–131`; +1 melee/+2 pierce: `simulation/armorTechBonuses.ts:19–26,39–42,49–50`. Matches. |
| `technologyHelp.ts:62` — Block Printing | Conversion range +3: `simulation/monasteryTechEffects.ts:19–20,26–33`. Matches. |
| `technologyHelp.ts:88` — Shipwright | Wood ×0.8 and training time ×0.65, scoped to water units: `simulation/dockTechEffects.ts:20–21,41–57`. Matches. |
| `upgradeHelp.ts:11` — Crossbowman | Upgrade mapping: `simulation/bridge/unitLineUpgrades.ts:26`; HP 30→35, attack 4→5, range 4→5: `simulation/prototypeUnitRules/statTables.ts:32,39,128,135,326,333`; accuracy .80→.85: `simulation/projectileRules.ts:45–46`. Matches. |
| `upgradeHelp.ts:42` — Elite Chu Ko Nu | HP 45→50 and range 4→6: `simulation/prototypeUnitRules/statTables.ts:86,105,380,399`; mapping: `simulation/bridge/unitLineUpgrades.ts:54`. Matches. |
| `upgradeHelp.ts:62` — Keep | Additional +2 attack/+1 range: `simulation/towerTechEffects.ts:19,41`; increased HP and armor: `simulation/buildingTechEffects.ts:36`, `simulation/buildingArmor.ts:124–125`. Matches. |
| `upgradeHelp.ts:79` — Kasbah | Castle training rate ×1.25: `simulation/uniqueTechnologies.ts:220–230`, applied reciprocally to training time at `simulation/productionTechEffects.ts:47–56`. “25% faster” matches. |
| `upgradeHelp.ts:80` — Kataparuto | Reload time ×0.75: `simulation/uniqueTechnologies.ts:308–313`, applied at `simulation/bridge/combatStateFactory.ts:79–80`. “25% less time” matches. |

Other reviewed areas:

- **Factories, escaping and controller:** No additional defect found in `tooltipCopy.ts:111–191`, `selectionPanel/buttons.ts:66–68,84–98,130–149,170–183`, or `buildPalette.ts:126–139`. Quoted HTML attributes preserve these generated LF characters; `src/ui/utils/escapeHtml.ts:8–19` escapes attribute delimiters without removing newlines. `tooltips.ts:203–212` preserves the complete `textContent`, so the comparison at line 359 remains valid. Command identity still comes from `data-command` before tooltip text at lines 71–82.

- **Other readers:** Searches under `src/` and `tests/` found no remaining production parser dependent on the old `Cost:` command wording. The panel reader in the unchanged `tests/browser/helpers/playOpening.ts:97–113` reads command-button text, while its build reader at lines 122–134 reads cost chips; neither parses tooltip prose. The changed price reader has R2-3.

- **Age deduplication:** No current refusal causes an incorrect omission or duplicate. `simulation/bridge/researchAvailability.ts:184–202` produces either a wrong/past-age sentence without the building list, or the complete list with Imperial’s Castle alternative. `tooltipCopy.ts:174` distinguishes those current outputs correctly. Khmer’s exemption is implemented at `simulation/bridge/playerQueries.ts:224–227,239–242,254–257`; retaining generic requirements for Khmer is explicitly required by the new spec. This remains string-based matching, with no focused tests for these additional cases.

- **Verbs:** `helpText/index.ts:30–59` matches the specified categories, including Create Petard/War Wagon and Research for the two unlocks. I also checked the installed English strings for representative unit verbs, age verbs, Crossbowman, Guard Tower, Keep, Fortified Wall, Cannon Galleon and Bombard Tower; those agree.

- **Tests:** The formatter and mounted-DOM tests would reject the original price-only output. The browser tests check actual title weight, line placement, viewport bounds, command-bar separation and minimap overlap. Their oversized copy is meaningful for the current content, although line 142 only compares two constructed constants—it does not establish a maintained maximum across all real tooltips. `helpTextRequirements.test.ts` would **not** detect reverting only the tooltip factories: it checks tables, not rendered commands. Beyond R2-4, its derivation misses technology-to-technology prerequisites, technology-to-building unlocks, and location-specific unlocks such as Anarchy because line 88 unions all training buildings. It deliberately excludes upgrade tiers and non-Imperial training states.

- **Scope and size:** The simulation diff is empty. Every changed TypeScript file is below 500 lines; the largest is `tooltips.ts` at 449. The stylesheet is outside the existing size test’s extension list (`tests/architecture/fileSizeBudget.test.ts:33`).

I reviewed the clean `cb557020` tree against `eb59353d` serially. I did not run tests, builds, installations, CI checks, browser sessions, mutations, or visual comparisons, and did not assess the excluded junction blocker. The counterexamples above are source-derived; the remaining help-copy rows and actual rendered layout are not exhaustively verified.

## Findings and disposition

1. R2-1 (P1): repaired. The Watch Tower's line names "Villagers, the Archer and Cavalry Archer lines and Longbowmen" and the Castle's the same three lines, the units of `ARCHER_LINE_UNITS`, where both said "archers". A case in `tests/ui/helpTextRequirements.test.ts` holds the rule's set to those three lines, the two copy lines to that phrase, and `buildingArrowCount` to a Villager adding an arrow in a tower and none in a Castle; red with the old line put back.
2. R2-2 (P1): repaired. The Transport Ship's line gives the unload its two steps ("sail it beside the shore, then right-click the shore"); a unit case pins it, red with the old line.
3. R2-3 (P2): repaired. `shownCost` reads a command tooltip's price from its title's bracket alone, and a new `shownLabelCost` reads the build card's accessible name, the one caller that reads a "Cost:" phrase. `tests/ui/shownPriceReader.test.ts` (3 cases) tests both readers; a Spies tooltip with no price in its title reads null, and the case is red with the fallback put back.
4. R2-4 (P2): repaired. The requirements test reads the relation only where a line states it ("Required for ..." or "... can build/train ...") and requires it to equal the derived set exactly; the derivation runs building by building, so Anarchy's Huskarl at the Barracks is seen, and adds the buildings a technology opens (the Bombard Tower). The reviewer's counterexample, Chemistry's "Required for" without the Bombard Cannon, is now red (2 cases).
5. R2-5 (P3): repaired. Spec §14.2's paragraph and the changelog's entry name the three sentences the old tooltips carried and the new ones do not.

Taken from the report's remarks: the browser spec's "longer than any real one" copy is now built from the longest of every unit's, building's and technology's tooltip with the longest refusal, so a longer line added later lengthens it; and the say-it-once rule has two more unit cases (the wrong age's refusal, the Imperial Age's with its Castle) and one more DOM case over a real bridge (the Imperial Age's refusal as the simulation words it).

Noted and not changed: `helpTextRequirements.test.ts` checks the copy tables and would not see the factories reverted, which the other three files hold; a technology that waits on another technology is not stated as "Required for", since DE's tooltips do not and the simulation's refusal does ("Needs Double Bit Axe researched here first."); the stylesheet is outside the size test's extension list, as it was (it grew by seven lines).

## Verification

Each repair has a test that is red with its defect put back (`tmp/mutate-m2.mjs`: the old arrows line 1 case, Chemistry's shortened sentence 2, the reader's fallback 1, the Transport Ship's one click 1). On the repaired tree (`30f59e8d`): `npx tsc --noEmit` exit 0; eslint on the changed files exit 0; `npx vitest run tests/ui tests/architecture` 66 files and 584 tests, exit 0; eight browser specs, 63 cases, exit 0. The full gate did not run: `engine:check`, a pre-hook of `test`, `typecheck`, `lint` and `build`, refuses a `controlWorktree` junction `node_modules` since work 153 (plan 148, M2's outcome).

## Round outcome

Two P1, two P2 and one P3, all repaired, each with a test red before its repair. Round 3 checks the repairs ([record](3_implementation.md)).
