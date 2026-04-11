# Age of Empires II: Definitive Edition Game Specification

## Document Status

- Purpose: define the implementation contract for an `Age of Empires II: Definitive Edition` style RTS.
- Product target: `Age of Empires II: Definitive Edition` style rules, UX expectations, and technology-tree semantics.
- Content source of truth: the structured data under `design/stats/`.
- Important distinction:
  - this document defines systems, data interpretation rules, and implementation boundaries
  - the CSVs define concrete content such as civ bonuses, exact unit lines, and exact research availability
- Success criterion: another agent should be able to build a playable DE-style single-player skirmish game against AI from this document plus the local stats bundle without needing to reverse-engineer hidden assumptions from prose.

## 1. Source-of-Truth Hierarchy

Use sources in this order:

1. `design/stats/structures.csv`
2. `design/stats/technologies.csv`
3. `design/stats/units.csv`
4. `design/stats/civilizations.csv`
5. `design/spec-codex.md`
6. Official Age of Empires DE references listed in `design/sources/03-official-de.md`
7. Community and historical references listed in `design/sources/04-community-and-history.md`

Interpretation rules:

- If prose in this file disagrees with the CSVs about concrete content, the CSVs win.
- If the CSVs are silent about a system-level behavior, this document wins.
- External sources are for resolving ambiguity or for identifying gaps between the local dataset and live DE, not for overriding local content data.

## 2. Scope and Product Target

### 2.1 What “DE” Means Here

The game should feel like AoE2 DE in these ways:

- single-player skirmish RTS with the familiar four-resource economy
- civilization-specific tech trees
- unique units and unique technologies as core civ identity
- DE-era expectations around content extensibility
- modern data-driven content rather than a single hard-coded classic roster

The implementation does not need to reproduce every current live-DE DLC immediately. It does need to support the systems that make DE possible.

### 2.2 Modes the Engine Should Support

For this repo, the core implementation target is:

- single-player Random Map skirmish
- one human-controlled player
- AI opponents
- optional AI allies

Explicitly out of scope for now:

- multiplayer
- ranked or quick-play flows
- replay system requirements
- campaign story mode
- scenario scripting

### 2.3 Match Presets

The engine should support data-driven match presets, not just one start condition.

Required preset support:

- Standard Random Map start
- AI team games
- Regicide-capable starts
- Wonder-capable starts

## 3. Current Local Dataset Coverage

The local data bundle is authoritative, but it is not a complete mirror of current live DE.

### 3.1 Civilizations Currently Present in `design/stats/civilizations.csv`

The file currently resolves to `30` unique civilization names:

- Age of Kings:
  - Britons
  - Byzantines
  - Celts
  - Chinese
  - Franks
  - Goths
  - Japanese
  - Mongols
  - Persians
  - Saracens
  - Teutons
  - Turks
  - Vikings
- The Conquerors:
  - Aztecs
  - Huns
  - Koreans
  - Mayans
  - Spanish
- Forgotten Empires:
  - Incas
  - Indians
  - Italians
  - Magyars
  - Slavs
- African Kingdoms:
  - Berbers
  - Ethiopians
  - Malians
  - Portuguese
- Rise of Rajas:
  - Burmese
  - Khmer
  - Vietnamese

Known issues in the current civ table:

- `Goths` appears twice.
- `Japanese` appears twice.
- Some text fields contain typos such as `Calvary`, `availible`, and `Civilzation`.

### 3.2 What the Other Local Tables Currently Cover

`structures.csv`:

- contains the core AoE2 building set
- is mostly age-layered building data for the classic building roster

`technologies.csv`:

- contains the generic economy, military, monastery, university, dock, and age-up tech trees
- contains many classic unique techs and elite unique-unit upgrades
- does not yet represent a complete current-DE unique-tech set for all civilizations in `civilizations.csv`

`units.csv`:

- contains the generic economy, infantry, archer, cavalry, siege, monk, trader, and ship lines
- contains classic unique units and a small number of Conquerors additions
- does not currently encode most post-2016 civilization-specific units

### 3.3 Practical Conclusion

There is currently a mismatch between:

- the product target: DE
- the local roster metadata: post-AoC and partially post-HD
- the unit and technology tables: still largely classic

Therefore:

- the engine should be built as a DE-capable framework
- the shipped content should be whatever the local CSVs can represent consistently today
- the spec must not pretend the local data already equals full live DE

## 4. Core Gameplay Definition

### 4.1 Match Loop

The core match loop remains the same as AoE2 across editions:

1. scout the map
2. gather food, wood, gold, and stone
3. maintain villager production
4. build economy and military structures
5. advance through the ages
6. research upgrades
7. train and control armies
8. pressure or defend
9. win by conquest or configured alternate victory condition

### 4.2 Match Participants

- supported participants per match: `2-8`
- current control model:
  - exactly `1` human player
  - all other participants are AI-controlled

### 4.3 Standard Resource Model

The stockpile resources are:

- `Food`
- `Wood`
- `Gold`
- `Stone`

### 4.4 Ages

The core age ladder is:

- `Dark Age`
- `Feudal Age`
- `Castle Age`
- `Imperial Age`

Age progression is researched at the Town Center.

### 4.5 Victory Modes

Required support:

- Conquest
- Team Conquest
- Last Man Standing
- Wonder Victory
- Regicide
- King of the Hill
- Score Victory with timer

## 5. World and Simulation Model

### 5.1 Map Representation

- terrain is tile-based
- unit movement is continuous over the terrain grid
- line of sight is per player
- fog of war tracks:
  - unexplored
  - explored
  - currently visible

### 5.2 Terrain and Elevation

Required terrain classes:

- open land
- forest
- shoreline
- shallow water
- deep water
- impassable edge or cliff
- hill levels

Terrain affects:

- building placement
- movement
- ship passability
- line of sight
- combat advantage on elevation

### 5.3 Neutral Objects and Resources

Required neutral objects:

- herdables
- huntables
- berries
- trees
- fish
- relics
- gold mines
- stone mines
- hostile predators

Rules:

- herdables change ownership when discovered
- huntables can flee or retaliate
- relics are portable by monks only
- fish require fishing ships

## 6. Economy Rules

### 6.1 Villagers

Villagers must support:

- gathering
- building
- repairing
- garrisoning
- weak melee combat

### 6.2 Drop-Off Logic

Resource drop-off must work through the expected building classes:

- food:
  - Town Center
  - Mill
  - Dock for fish
- wood:
  - Town Center
  - Lumber Camp
- gold:
  - Town Center
  - Mining Camp
- stone:
  - Town Center
  - Mining Camp

### 6.3 Farms, Trade, and Relics

- farms are paid for on placement and deplete over time
- trade units run repeatable routes and scale income with route length
- relics generate passive gold inside monasteries

## 7. Control and Combat Rules

### 7.1 Core Input Model

Required interaction model:

- click-select
- drag-select
- double-click same-type on-screen select
- control groups
- shift-queued orders

### 7.2 Required Orders

- move
- stop
- patrol
- attack-move
- attack-target
- gather
- return resources
- build
- repair
- garrison
- ungarrison
- unload
- set rally point
- train
- research
- heal
- convert
- pack or unpack where applicable

### 7.3 Combat System Requirements

The combat system must support:

- melee and pierce armor
- bonus damage by class
- projectile accuracy
- splash damage
- minimum damage floor
- elevation modifiers
- friendly fire for the applicable siege classes

### 7.4 Garrison and Siege Rules

- Villagers can garrison in defensive structures.
- Transport ships carry land units across water.
- Rams and other garrison-capable units or structures must be supported by the simulation model.
- Packed and unpacked states must be treated as explicit simulation states for units such as trebuchets.

### 7.5 Monks

Monks must support:

- healing
- conversion
- relic pickup and delivery

The system must be able to express techs and civ bonuses that affect:

- monk range
- conversion resistance
- valid conversion targets
- monk movement
- group conversion behavior

## 8. Technology Tree Semantics

AoE2 DE uses a civilization-specific technology tree. The implementation must preserve that model.

### 8.1 Core Principle

Each civilization shares the same broad building and unit classes, but differs in:

- available units
- available upgrades
- available technologies
- civilization bonuses
- team bonuses
- unique units
- unique technologies

### 8.2 UI Semantics

If a technology-tree UI is implemented, it should preserve the official mental model:

- buildings are a separate category from units and technologies
- trainable units and researchable technologies are shown as civ-filtered nodes
- unavailable content is still visible as unavailable, not silently omitted

### 8.3 Unique Content Model

Because the target is DE, the engine must support:

- one or more unique units per civilization
- one or more unique technologies per civilization
- distinct Castle Age and Imperial Age unique-tech slots
- non-Castle unique units where the data says so

Important note:

- the current local data bundle does not fully encode current-DE unique content for every civilization already named in `civilizations.csv`
- this is a data gap, not a reason to hard-code an older one-tech model into the engine

## 9. Building Responsibilities

This section defines building responsibilities, not the full exact train and research lists. Exact lists must be derived from `units.csv` and `technologies.csv`.

### 9.1 Economic and Core Structures

#### Town Center

- trains villagers
- researches age progression and core economy technologies
- acts as a drop-off site
- supports garrison and defensive arrows

#### House

- provides population capacity

#### Mill

- acts as food drop-off
- anchors farms
- researches farm upgrades

#### Lumber Camp

- acts as wood drop-off
- researches wood upgrades

#### Mining Camp

- acts as gold and stone drop-off
- researches mining upgrades

#### Farm

- renewable placed food source

#### Market

- handles commodity exchange
- handles tribute-related technologies
- trains land traders where present in the data

### 9.2 Military Production

#### Barracks

- infantry production
- prerequisite for several downstream military buildings

#### Archery Range

- archer-class production

#### Stable

- cavalry-class production

#### Siege Workshop

- siege production

#### Dock

- naval economy
- naval military production
- naval trade

#### Castle

- primary unique-unit production building
- elite unique-unit upgrade location
- unique-tech location
- trebuchet and Petard production where enabled by data

### 9.3 Support and Defense

#### Blacksmith

- generic unit-attribute upgrades

#### University

- defensive, projectile, and building-wide technologies

#### Monastery

- monk production
- monk and relic technologies

#### Towers and Walls

- defensive line
- must support upgrade chains and garrison rules where applicable

#### Wonder

- alternate victory building

## 10. Civilization Data Model

The civilization system should be generated from data, not maintained as hard-coded prose or switch statements.

### 10.1 Normative Data Ownership

`design/stats/civilizations.csv` is the content owner for:

- civ names
- expansion origin
- army archetype
- unique unit names
- unique technology names
- team bonus text
- civilization bonus text

The spec should not duplicate those rows in full because that creates drift.

### 10.2 Required Engine Capabilities

The engine must be able to express:

- civ-specific disabled units
- civ-specific disabled technologies
- civ-specific free technologies
- civ-specific discounts
- civ-specific stat modifiers
- civ-specific creation-speed modifiers
- civ-specific replacement units
- civ-specific unique units outside the Castle if present
- civ-specific unique technologies in more than one slot

### 10.3 Current Local-Coverage Policy

Use these rules until the dataset is completed:

- all civ names present in `civilizations.csv` should remain selectable in tooling and content validation
- only content that is actually backed by `units.csv`, `technologies.csv`, and `structures.csv` should be considered shippable without placeholder work
- if a civilization row references unique units or techs that do not exist in the supporting tables, that is a data-completeness issue and should be surfaced explicitly

## 11. Data Normalization Requirements

Before using `design/stats` directly in-engine, normalize it into a clean internal representation.

### 11.1 Required Cleanup

- deduplicate civilization rows by name
  - currently at least `Goths` and `Japanese`
- normalize typos
  - `Ligth Cavalry -> Light Cavalry`
  - `Calvary -> Cavalry`
  - `availible -> available`
  - `Civilzation -> Civilization`
- split semicolon-delimited multi-value fields into arrays
- normalize inconsistent spacing in CSV text
- normalize building names across `created_in` and `develops_in`
- split range fields like `1-4` into `range_min` and `range_max`
- parse embedded JSON-like cost blobs into structured resource records

### 11.2 Required Derived Fields

The importer should derive:

- canonical unit IDs
- canonical technology IDs
- canonical building IDs
- upgrade chains
- civilization-to-unique-unit links
- civilization-to-unique-tech links
- age availability
- producer-to-output mappings
- researcher-to-technology mappings

### 11.3 Data Integrity Checks

The content pipeline should fail validation when:

- a civ row names a unique unit missing from `units.csv`
- a civ row names a unique tech missing from `technologies.csv`
- an upgrade target is missing
- a producer building is missing
- a tech references an unknown target
- duplicate canonical IDs are produced after normalization

## 12. Single-Player Simulation and Saveability

- simulation should remain fixed-step and deterministic where practical because that simplifies AI debugging and future extensibility
- no networking requirements are in scope
- no replay feature is in scope
- if save and load is implemented, it must serialize enough state to resume an in-progress AI skirmish accurately

## 13. AI Requirements

The AI must be able to play complete matches under the same rules as the player.

Minimum AI capabilities:

- maintain Town Center production
- manage population capacity
- assign gatherers by need
- age up
- execute an opening plan
- switch composition from scouting information
- expand economy in Castle Age
- use siege against defenses
- use trade in long team games
- understand relic value on closed maps

## 14. Acceptance Criteria

The implementation satisfies this spec when:

- a standard Random Map skirmish can be played start to finish
- the technology tree and command panels are generated from local stats rather than hand-authored tables in code
- all generic units, buildings, and technologies in the local data load successfully
- civilization selection is driven from the normalized civ table
- unsupported civ content is reported as missing data rather than silently omitted
- a saved single-player skirmish can be resumed without corrupting match state if save/load is implemented
- the rules framework can represent DE-style multiple unique units and multiple unique-tech slots even if the current local data does not yet fill every slot

## 15. Non-Goals for This Revision

- claiming complete parity with the current live-DE DLC roster
- hand-copying every civ bonus, unit, and technology into markdown when it already exists in CSV
- preserving the older AoC-only assumptions from the previous draft
- silently filling data gaps with guessed civ content
- multiplayer
- campaign story mode

## 16. Immediate Next Steps

1. Normalize the `design/stats` bundle into canonical internal JSON or equivalent data files.
2. Generate producer-to-unit and producer-to-tech mappings automatically from the normalized data.
3. Add content validation that reports the current DE-versus-dataset gaps explicitly.
4. Extend the stats bundle if full live-DE content parity is required later.
