# Sources

This file records the external and local references used while expanding `design/spec-codex.md`.

## Source policy

- Target ruleset: `Age of Empires II: The Conquerors` patch `1.0c`.
- Priority order:
  1. AoC-era references describing the original expansion and its final patch behavior.
  2. Technology-tree references that make building, unit, and upgrade relationships explicit.
  3. Community databases and wikis for cross-checking civ identity, unit rosters, and tech availability.
- Reliability note: most public AoE2 references now center on `Definitive Edition`. When a page mixes DE and classic content, use it only for generic structure unless the AoC-era behavior is explicitly called out.

## Existing repo research pointers

These links were already present in this file before this edit:

- <https://www.aoe2database.com/>
- <https://airef.github.io/>
- <https://ageofempires.fandom.com/wiki/Age_of_Empires_II:_Definitive_Edition>
- <https://steamcommunity.com/sharedfiles/filedetails/?id=548698803>

## Codex research used for the current spec revision

### Primary classic-baseline framing

- <https://ageofempires.fandom.com/wiki/Age_of_Empires_II:_The_Conquerors>
  - Used for: confirming the expansion scope, release patch, final classic patch `1.0c`, and AoC-specific feature additions such as ram garrisoning, automatic farm reseeding, and new technologies introduced by the expansion.
  - Why it mattered: it lets the spec pin itself to a concrete classic baseline instead of drifting into DE-only content.

- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Conquerors/New_features>
  - Used for: AoC-specific additions including new civs, new techs, new unit lines, and gameplay changes introduced by the expansion.
  - Why it mattered: useful cross-check for which features belong to classic AoC versus later rereleases.

- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Conquerors/Pre-existing_civilizations>
  - Used for: balance and roster changes applied to original `Age of Kings` civilizations when moving into `The Conquerors`.
  - Why it mattered: several pre-existing civs changed in AoC, so relying on AoK-era descriptions alone would be wrong.

### Technology tree and building content

- <https://ageofempires.fandom.com/wiki/Technology_tree_(Age_of_Empires_II)>
  - Used for: building-by-building production and research relationships such as what the `Barracks`, `Archery Range`, `Stable`, `Dock`, `Market`, `Mill`, `Lumber Camp`, `Mining Camp`, `Monastery`, `University`, and `Siege Workshop` provide.
  - Why it mattered: the spec revision needs explicit "this building trains these units and researches these upgrades" sections.
  - Caveat: the page reflects modern AoE2 overall, so DE-only entries must be filtered out when they do not belong to AoC.

- <https://ageofempires.fandom.com/wiki/Town_Center_(Age_of_Empires_II)>
  - Used for: Town Center role confirmation, especially villager creation, age advancement, garrison behavior, and drop-off behavior.
  - Why it mattered: the Town Center is the central economic and progression building, so its rule set needs to be explicit in the design doc.

- <https://ageofempires.fandom.com/wiki/Unique_technology_(Age_of_Empires_II)>
  - Used for: cross-checking unique-technology naming and for catching a key inconsistency in the older draft.
  - Why it mattered: the old draft modeled two unique techs per civilization, but classic AoC uses one unique tech per civilization except for Goths.

### Civilization identity references

- <https://ageofempires.fandom.com/wiki/Britons/Tree>
  - Used for: a civ tree page example showing how bonuses, unique units, and unique techs are presented in current public references.
  - Why it mattered: useful as a formatting and validation check while rewriting the civilization section.
  - Caveat: this page is DE-oriented and cannot be copied blindly for a classic AoC spec.

- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Age_of_Kings/Turks>
  - Used for: checking pre-AoC civilization identity and understanding which military themes were already present before Conquerors changes.
  - Why it mattered: helped separate "core civ fantasy" from later patch-layer details.

- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Age_of_Kings/Franks>
  - Used for: another AoK civ profile cross-check while building the civilization-differences section.
  - Why it mattered: provided a second pre-AoC reference point for old civ identity.

## Local supporting artifacts

These are not original sources, but they are useful working materials in this repo:

- `design/spec-codex.md`
  - Current living game specification being revised.

- `design/stats/civilizations.csv`
  - Structured civ data that can be used to validate the civ catalogue once the prose spec is updated.

- `design/stats/structures.csv`
  - Structured building data that can be used to validate the building-by-building production and research sections.

- `design/stats/technologies.csv`
  - Structured technology data that can be used to validate upgrade locations, prerequisites, and grouping.

- `design/stats/units.csv`
  - Structured unit data that can be used to validate unit-line naming, production buildings, and upgrade chains.

## Practical guidance for future edits

- Treat `The Conquerors 1.0c` as the baseline unless the spec explicitly says otherwise.
- If an external page mixes classic and DE information, prefer using it for naming and structure, then confirm classic-era behavior with AoC-specific references.
- Before adding new civ, unit, or tech claims to the spec, cross-check them against the local CSVs in `design/stats` and at least one AoC-era reference.
