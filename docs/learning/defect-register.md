# Defect register

The standing list of what the gates could not see. One entry per defect that reached a build: the symptom as it presented, what the investigation found, the root cause, and the check that covers the defect's whole CLASS from now on.

Unlike a lesson, an entry stays after it becomes a gate. The register is not a to-do list — it is the record of where defects came from, which is the best available guide to where the next one is.

## 2026-08-23 — Two buttons that did nothing: the Transport Ship, and the Goths' Huskarl at the Barracks

**Symptom.** Clicking `Train Transport Ship` at a Dock did nothing at all: no unit, no queue entry, no resources spent, no error, no toast. The button rendered as enabled. In a browser probe on `naval-imperial-fixture`, wood stayed at 2000 across the click while the same click on `Train Fishing Ship` charged 75. The Transport Ship is the only way a land army crosses water, so the effect was that a documented, menu-visible mechanic could not be used at all in a real game. The same defect was live for the Goths' Huskarl: their Anarchy unique technology is supposed to move the Huskarl into the Barracks, and the button appeared there and did nothing.

**Investigation.** The train MENU and the train VALIDATOR read two different tables. `trainOptions.ts` builds the card — and it offers `transport-ship` at the Dock from the Feudal Age, and the Anarchy unlock through `unlockedTrainingFor`. `TRAINABLE_UNITS_BY_BUILDING` in `buildingProductionTables.ts` is what `canTrainAt` consults when the command is validated, and it listed neither. So the UI accepted the click, the validator refused the command, and nothing reported the refusal — the worst possible failure shape, because there is no error to notice.

**Root cause.** Two tables that must agree, with nothing making them agree. Every unit added to a menu had to be remembered in a second place, and twice it was not. The Transport Ship shipped this way in the naval slice; the only transports that ever existed were spawned by fixtures, which is exactly why every naval test passed.

**How it is checked from now on.** `tests/simulation/menuMatchesValidator.test.ts` enumerates what the train menu can offer across every building, all four ages, all 30 civilization names and both extremes of the researched set, and asserts the validator accepts every one of them. It caught both instances on its first run. A companion assertion checks the mirror direction for technologies — every technology with a cost is hosted by some building — and the Transport Ship is pinned by name as well, so a regression names the unit rather than only the class.

**What this predicts.** Any pair of tables that must agree and are not derived from each other is the same defect waiting to happen. The menu/validator pair is now gated; the remaining pairs of this shape (armor-class tables vs stat tables, render recipes vs the roster) are where to look next.
