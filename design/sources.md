# Sources

This file records the sources used to maintain `design/spec-codex.md`.

## Source policy

The spec now targets `Age of Empires II: Definitive Edition`.

Use sources in this order:

1. Local structured data under `design/stats/`
2. Official Age of Empires DE pages
3. Community references for cross-checking or gap-finding only

Important rule:

- The local stats bundle is the source of truth for concrete content in this repo.
- Official and community sources are used to define DE-era expectations and to identify where the local data bundle is incomplete relative to current DE.

## Canonical local sources

These files are the primary content authority for this repo:

- `design/stats/structures.csv`
  - building names
  - building ages
  - core building costs and stats
  - defensive structure lines

- `design/stats/technologies.csv`
  - technology names
  - research buildings
  - age requirements
  - upgrade chains
  - effect descriptions

- `design/stats/units.csv`
  - unit names
  - producer buildings
  - upgrade chains
  - combat stats
  - movement, range, and other combat parameters

- `design/stats/civilizations.csv`
  - civilization names
  - expansion group
  - army archetype
  - unique units
  - unique technologies
  - team bonuses
  - civilization bonuses

## Official DE references used in the current revision

- <https://www.ageofempires.com/learn-to-play/civilizations-game-modes-aoe2/>
  - Used for:
    - official DE mode framing
    - official explanation of civilization-specific tech trees
    - official explanation that DE civilizations have unique units and unique technologies
    - official explanation that DE uses Castle Age and Imperial Age unique-tech slots
  - Why it mattered:
    - the new spec is DE-targeted, so the model for civilization identity and tech-tree semantics needed to come from an official DE source rather than the older AoC-only assumptions

- <https://www.ageofempires.com/games/aoeiide/>
  - Used for:
    - official DE product framing
    - official mention of `Empire Wars`
    - official confirmation that DE extends beyond the original classic content set
  - Why it mattered:
    - the spec now treats DE as the product target and should therefore acknowledge DE-era game modes and expansion-driven extensibility

- <https://www.ageofempires.com/news/new-dlc-available-now-the-last-chieftains/>
  - Used for:
    - confirming that AoE2 DE is still receiving new civilizations and technologies as of `February 17, 2026`
    - confirming that current live DE continues beyond the content represented in the local stats bundle
  - Why it mattered:
    - the spec now explicitly distinguishes between `DE as the target product` and `design/stats as the current repo-local content bundle`

## Existing community references retained for validation

These links already existed in the repo and remain useful as secondary cross-checks:

- <https://www.aoe2database.com/>
- <https://airef.github.io/>
- <https://ageofempires.fandom.com/wiki/Age_of_Empires_II:_Definitive_Edition>
- <https://steamcommunity.com/sharedfiles/filedetails/?id=548698803>

Use them for:

- quick civ or unit lookups
- sanity-checking names and terminology
- spotting likely omissions in the local stats bundle

Do not use them to override the local CSVs.

## Historical references kept for context only

These were used in the prior AoC-focused revision. They are no longer normative for the current DE-targeted spec, but they remain useful historical references:

- <https://ageofempires.fandom.com/wiki/Age_of_Empires_II:_The_Conquerors>
- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Conquerors/New_features>
- <https://strategywiki.org/wiki/Age_of_Empires_II%3A_The_Conquerors/Pre-existing_civilizations>
- <https://ageofempires.fandom.com/wiki/Technology_tree_(Age_of_Empires_II)>
- <https://ageofempires.fandom.com/wiki/Town_Center_(Age_of_Empires_II)>
- <https://ageofempires.fandom.com/wiki/Unique_technology_(Age_of_Empires_II)>

## Practical findings from the current revision

These facts came directly from inspecting `design/stats`:

- `civilizations.csv` currently resolves to `30` unique civilization names.
- `civilizations.csv` currently contains duplicate rows for at least:
  - `Goths`
  - `Japanese`
- `civilizations.csv` currently includes expansion labels up through:
  - `Age of Kings`
  - `The Conquerors`
  - `Forgotten Empires`
  - `African Kingdoms`
  - `Rise of Rajas`
- `units.csv` and `technologies.csv` are still dominated by the classic generic and AoC-era roster.
- The local bundle therefore does not yet represent the full current live-DE roster.

## Guidance for future edits

- Treat `design/stats` as canonical content unless the repo owner explicitly says otherwise.
- If the spec mentions DE features or content patterns not fully present in the local CSVs, mark them as framework requirements or data gaps, not as already-shipped local content.
- Do not hand-copy all civ bonuses, unit rosters, or tech trees into prose when they already live in `design/stats`.
- If full current-DE parity becomes a goal, extend the local stats bundle first, then update the spec.
