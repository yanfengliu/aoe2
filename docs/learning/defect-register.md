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
