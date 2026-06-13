# Age of Empires II: Definitive Edition Official Game Specification

## Document Status

- Status: official gameplay and implementation spec for this repo.
- Supersedes: `design/spec-codex.md` and `design/spec-claude.md` as the primary design document.
- Product target: an `Age of Empires II: Definitive Edition` style RTS focused on standard Random Map single-player skirmish against AI.
- Content authority: the structured data under `design/stats/`.
- Purpose: define the rules, systems, UI expectations, simulation constraints, and data-handling rules needed for an implementer to build the game.

Important distinction:

- This document defines gameplay rules, system behavior, implementation boundaries, and normalization policy.
- The CSVs define concrete content such as unit names, technology names, costs, stats, building stats, civilization bonuses, unique content, and roster availability.

Success criterion:

- Another agent should be able to build a playable AoE2 DE style single-player skirmish game against AI from this document plus the local stats bundle without needing to infer hidden assumptions.

## 1. Source-of-Truth Hierarchy

Use sources in this order:

1. `design/stats/structures.csv`
2. `design/stats/technologies.csv`
3. `design/stats/units.csv`
4. `design/stats/civilizations.csv`
5. `design/spec-final.md`
6. Official DE references listed in `design/sources/03-official-de.md`
7. Community and historical references listed in `design/sources/04-community-and-history.md`

Interpretation rules:

- If this document disagrees with the CSVs about concrete content, the CSVs win.
- If the CSVs are silent about system behavior, this document wins.
- External sources are for resolving ambiguity and identifying gaps between the local dataset and live DE, not for overriding local content.
- The final implementation should never hard-code hand-maintained unit rosters, tech trees, or civilization bonuses that already exist in `design/stats`.

## 2. Product Scope and Dataset Status

### 2.1 Target Experience

The game should feel like AoE2 DE in these ways:

- four-resource macro economy
- four-age progression
- civilization-specific tech trees
- civilization bonuses, team bonuses, unique units, and unique technologies
- procedural Random Map play
- data-driven content rather than a hard-coded classic roster

The engine should be built as a DE-capable framework even if the local dataset does not yet encode the full live DE roster.

### 2.2 In Scope

- standard Random Map mode only
- single-player skirmish
- exactly one human player
- AI opponents
- optional AI allies
- configurable map, civ, team, population, speed, and victory settings within standard Random Map rules

### 2.3 Out of Scope

- multiplayer
- ranked or quick-play flows
- replay system requirements
- campaign story mode
- scenario scripting
- custom non-standard game modes such as Regicide, Death Match, Empire Wars, King of the Hill, Wonder Race, or Capture the Relic
- Full Tech Tree mode

### 2.4 Current Local Dataset Coverage

The local data bundle is authoritative, but it is not a complete mirror of current live DE.

Civilizations currently present in `design/stats/civilizations.csv`:

- Age of Kings: Britons, Byzantines, Celts, Chinese, Franks, Goths, Japanese, Mongols, Persians, Saracens, Teutons, Turks, Vikings
- The Conquerors: Aztecs, Huns, Koreans, Mayans, Spanish
- Forgotten Empires: Incas, Indians, Italians, Magyars, Slavs
- African Kingdoms: Berbers, Ethiopians, Malians, Portuguese
- Rise of the Rajas: Burmese, Khmer, Vietnamese

Practical data notes:

- several later-expansion civ rows encode multiple unique units or multiple unique techs in a single semicolon-delimited cell
- `units.csv` and `technologies.csv` still skew heavily toward the generic and classic roster
- later-expansion civ metadata is not yet fully backed by matching unit and technology rows

Implications:

- build the engine as a DE-style rules framework
- ship only the content that the local CSVs can represent consistently
- surface unsupported civ content as missing data instead of inventing or silently omitting it

## 3. Game Overview

### 3.1 Core Loop

1. Scout the map.
2. Gather food, wood, gold, and stone.
3. Maintain villager production.
4. Build economy and military structures.
5. Advance through the ages.
6. Research upgrades.
7. Train and control armies.
8. Pressure, defend, and expand.
9. Win under standard Random Map victory rules.

### 3.2 Design Pillars

- Asymmetric civilizations: civs share a broad rules framework but differ in availability, bonuses, unique content, and pacing.
- Macro plus micro: the game rewards both economy planning and tactical control.
- Counter-based combat: unit classes and armor classes create strong matchup relationships.
- Map variety: different map scripts shift priorities between scouting, booming, walling, trade, relic control, and naval play.
- Data-driven implementation: as much of the playable roster as possible should be generated from normalized content data.

## 4. Match Structure

### 4.1 Standard Mode Only

The only supported mode is standard Random Map.

Standard start:

- age: Dark Age
- starting buildings: 1 Town Center
- starting villagers: 3
- starting scout: 1 Scout Cavalry for most civs, or Eagle Scout equivalent for Meso civs if represented in content
- standard starting resources: 200 Wood, 200 Food, 100 Gold, 200 Stone

Optional resource presets inside standard mode:

- Standard: 200W / 200F / 100G / 200S
- Medium: 500W / 500F / 300G / 400S
- High: 1000W / 1000F / 700G / 800S

### 4.2 Match Participants and Teams

- supported participants per match: 2 to 8
- exactly 1 participant is human-controlled
- all other participants are AI-controlled
- team assignments can be free-for-all or team-based
- AI allies may share team bonuses and support trade or tribute

### 4.3 Victory Conditions

Supported victory logic is limited to the standard Random Map ruleset:

- Conquest
- Wonder victory
- Relic victory
- Score timer

Default setup should be Conquest only unless the player enables additional victory conditions.

Definitions:

- Conquest: the player wins when all enemy players are eliminated under standard AoE2 defeat rules.
- Wonder: a player wins by building a Wonder and defending it through the countdown.
- Relic: a player wins by controlling all relics in Monasteries through the countdown.
- Score timer: highest score wins when the configured timer expires.

### 4.4 Score Model

Use an AoE2-style score breakdown:

- Military: enemy value destroyed or converted
- Economy: resource stockpile plus value of surviving economy
- Technology: researched technology value plus exploration contribution
- Society: major structures such as Castles and Wonders

The exact UI presentation can vary, but the scoring model must remain legible and comparable to AoE2 expectations.

### 4.5 Game Speed

Support these speed presets:

- Slow: 1.0x
- Normal: 1.5x
- Fast: 2.0x

All times in the spec and data should be interpreted relative to 1.0x unless explicitly stated otherwise.

### 4.6 Game Setup Options

The standard setup flow should allow configuration of:

- map type
- map size
- civilization selection or random civ
- AI count
- AI difficulty
- team assignments
- population cap
- game speed
- enabled victory conditions
- starting resource preset

No generic game-mode selector is required.

## 5. World and Map Generation

### 5.1 Map Representation

The world is a 2D tile grid with continuous unit movement over the grid.

Each tile has:

- terrain type
- elevation level
- passability flags
- buildability flags
- visibility state per player

### 5.2 Terrain Classes

Required terrain classes:

- open land
- forest
- shoreline
- shallow water
- deep water
- cliffs or impassable edge
- hills and elevation steps
- farm tiles

Terrain affects:

- building placement
- movement
- line of sight
- water passability
- combat elevation advantage

### 5.3 Map Sizes

Use AoE2-style sizes:

- Tiny
- Small
- Medium
- Normal
- Large
- Giant
- Ludicrous

The implementation may map these to concrete tile dimensions, but the size ladder should preserve the expected relationship between player count, walking distance, and trade-route scale.

### 5.4 Supported Standard Map Types

At minimum, the map system should support these standard Random Map types:

- Arabia
- Arena
- Black Forest
- Islands
- Nomad
- Coastal
- Fortress
- Gold Rush

Each map script should define:

- terrain palette
- openness vs wallability
- water coverage
- starting resource layout
- neutral resource clustering
- elevation distribution
- chokepoint behavior

### 5.5 Standard Resource Placement

Per player on a standard land map, generate the expected AoE2-style starting layout:

- herdables near the player
- 2 boar or equivalent huntable lures
- deer or equivalent nearby huntables
- one berry patch
- nearby and farther gold piles
- nearby and farther stone piles
- at least a few accessible woodlines
- neutral relic distribution away from immediate starting control

Placement rules:

- starting resources should be reachable without expansion
- secondary resources should require map control
- map scripts should bias toward fairness, not perfect symmetry
- closed maps may cluster neutral resources differently from open maps

### 5.6 Gaia Entities

Required neutral entities:

- sheep or turkeys
- boar
- deer
- wolves or equivalent predators
- berry bushes
- trees
- fish
- relics
- gold mines
- stone mines

Rules:

- herdables change ownership when discovered
- boar retaliate when lured or attacked
- deer flee
- animal carcasses decay after death
- relics can only be carried by monks
- fish require fishing ships unless explicitly modeled as shore fish for villagers

## 6. Resources and Economy

### 6.1 Resource Types

The game uses four stockpile resources:

- Food
- Wood
- Gold
- Stone

### 6.2 Villager Roles

Villagers must support:

- gathering
- building
- repairing
- garrisoning
- weak melee combat
- scouting by movement and line of sight

### 6.3 Base Gather Rates

Representative base gather rates should follow AoE2-style expectations:

| Source | Approximate Base Rate |
|---|---|
| Sheep | 0.33 food/sec |
| Berries | 0.31 food/sec |
| Boar or deer | 0.41 food/sec |
| Farm | about 0.32 to 0.34 food/sec |
| Deep fish | about 0.49 food/sec |
| Wood | 0.39 wood/sec |
| Gold | 0.38 gold/sec |
| Stone | 0.36 stone/sec |

These rates define the intended pacing of early and mid game economy.

### 6.4 Carry Capacity and Drop-Off

Villagers must return resources to drop-off buildings.

Drop-off rules:

- Food: Town Center, Mill, Dock for fish from ships
- Wood: Town Center, Lumber Camp
- Gold: Town Center, Mining Camp
- Stone: Town Center, Mining Camp

Carry capacity should follow AoE2-style values and improve with Wheelbarrow and Hand Cart.

### 6.5 Economy Upgrades

Required economy upgrade families:

- Lumber Camp: Double-Bit Axe, Bow Saw, Two-Man Saw
- Mining Camp: Gold Mining, Gold Shaft Mining, Stone Mining, Stone Shaft Mining
- Mill: Horse Collar, Heavy Plow, Crop Rotation
- Town Center: Wheelbarrow, Hand Cart

The implementation must support:

- gather-rate multipliers
- carry-capacity modifiers
- villager movement-speed modifiers
- farm-capacity increases
- civ-specific free or discounted economy techs

### 6.6 Farm Mechanics

Farm rules:

- farms cost wood on placement
- farms deplete over time
- farm upgrades increase total stored food
- auto-reseed should be supported
- Mill farm queues should support AoE2-style batch reseed behavior

### 6.7 Trade

Support both land and naval trade where the map allows it.

Land trade:

- Trade Carts move between allied Markets
- gold income scales with route length

Naval trade:

- Trade Cogs move between allied Docks
- trade remains route-based and distance-scaled

Required related systems:

- Caravan movement-speed bonus
- AI ally trading
- route persistence
- team-safe behavior for allied trade

### 6.8 Market Exchange and Tribute

The Market must support:

- buying food, wood, and stone for gold
- selling food, wood, and stone for gold
- dynamic exchange-rate movement by repeated trades
- tribute to AI allies
- tribute fee reduction through technologies
- civ-specific market-fee modifiers

### 6.9 Relics

Relic rules:

- only monks can pick up relics
- relics generate passive gold when garrisoned in a Monastery
- a Monk carrying a relic cannot behave like a normal free Monk
- relic victory depends on control and countdown, not instant pickup

### 6.10 Population

Population behavior:

- Houses, Town Centers, and Castles contribute population capacity
- military, villagers, trade units, monks, and most ships consume population
- production must fail when population cap is reached
- civ-specific population-cap modifiers must be supported

## 7. Age Progression

### 7.1 Age Ladder

The game uses four ages:

- Dark Age
- Feudal Age
- Castle Age
- Imperial Age

Age progression is researched at the Town Center.

### 7.2 Age Costs and Prerequisites

Use the standard AoE2-style progression model:

| Transition | Cost | Building Requirement |
|---|---|---|
| Dark -> Feudal | 500 Food | 2 qualifying Dark Age buildings |
| Feudal -> Castle | 800 Food, 200 Gold | 2 qualifying Feudal Age buildings |
| Castle -> Imperial | 1000 Food, 800 Gold | 2 qualifying Castle Age buildings or 1 Castle |

Qualifying building logic must follow AoE2 conventions, not count every structure equally.

### 7.3 Age Unlock Summary

Dark Age:

- basic eco buildings
- Barracks
- Dock
- Villagers
- Militia

Feudal Age:

- Archery Range
- Stable
- Blacksmith
- Market
- walls, gates, towers
- early archer, skirmisher, spearman, scout, and galley play

Castle Age:

- Castle
- Monastery
- Siege Workshop
- University
- second and third Town Centers
- Knight, Camel, Cavalry Archer, Monk, and siege play
- unique units

Imperial Age:

- top-tier blacksmith and university upgrades
- elite unique-unit upgrades
- trebuchets, bombard units, top naval upgrades
- final eco and military techs

### 7.4 Building Age Scaling

Buildings should scale in age-appropriate ways, especially:

- armor
- line of sight where relevant
- available upgrade chains
- new building unlocks

The implementation should derive exact values from `structures.csv` where present.

## 8. Buildings

### 8.1 Construction, Repair, and Destruction

Construction rules:

- Villagers place a foundation and build over time.
- Multiple Villagers accelerate construction with diminishing returns.
- Construction-speed modifiers such as Treadmill Crane and civ bonuses must be supported.

Use the standard AoE2 multi-builder formula:

- actual_time = 3 * base_time / (builders + 2)

Repair rules:

- Villagers can repair buildings and repairable units such as siege
- repair consumes resources
- repair restores hit points without recreating the entity

Destruction rules:

- buildings are removed at 0 HP
- rubble or destruction states may persist visually
- no refund is granted on destruction

### 8.2 Core Economy Buildings

Town Center:

- trains Villagers
- researches ages and core eco techs
- acts as universal drop-off
- provides garrison and defensive arrows
- additional Town Centers unlock in Castle Age

House:

- provides population capacity

Mill:

- food drop-off
- farm anchor
- farm-upgrade building

Lumber Camp:

- wood drop-off
- wood-upgrade building

Mining Camp:

- gold and stone drop-off
- mining-upgrade building

Farm:

- renewable food source

Market:

- commodity exchange
- tribute
- land trade production where the content says so

Dock:

- fish drop-off for ships
- fishing production
- naval production
- naval trade

### 8.3 Military Buildings

Barracks:

- infantry production
- unlock dependency for downstream military buildings

Archery Range:

- foot archer production
- skirmishers
- cavalry archers
- gunpowder archers where available

Stable:

- scout, knight, camel, and other mounted lines

Siege Workshop:

- ram, mangonel, scorpion, and bombard siege lines

Castle:

- primary unique-unit building
- elite unique-unit upgrade location
- unique-tech location
- trebuchet and Petard production where available

Monastery:

- Monk production
- relic garrison
- monk technology location

### 8.4 Defensive and Support Buildings

Blacksmith:

- generic unit-stat upgrades

University:

- defensive, projectile, and building-wide technologies

Tower line:

- Watch Tower -> Guard Tower -> Keep
- garrison-capable static defense

Wall and Gate lines:

- Palisade
- Stone Wall
- Fortified Wall
- gates

Wonder:

- alternate victory building

### 8.5 Building Prerequisites

The building graph must preserve AoE2 dependency logic:

- Barracks unlocks Archery Range and Stable
- Blacksmith is part of Castle Age prerequisite flow
- Castle Age buildings unlock Imperial Age
- University gates certain advanced defensive and projectile techs
- Castle is not mandatory for every strategy but can satisfy part of the Imperial Age path

### 8.6 Exact Lists

Exact train and research lists should be derived from normalized data, not duplicated in code or prose.

The implementation should automatically build:

- producer -> trainable units
- building -> researchable techs
- age -> newly available buildings
- building prerequisite graph

## 9. Units and Player Control

### 9.1 Unit Attributes

Every unit definition should be able to express:

- hit points
- cost
- build time
- movement rate
- line of sight
- attack values
- melee armor
- pierce armor
- attack bonuses by class
- armor classes
- range or minimum range
- reload time
- attack delay or wind-up
- accuracy
- blast radius where applicable
- search radius where applicable
- producer building
- age availability
- upgrade lineage

### 9.2 Unit Categories and Major Lines

The rules framework must support these broad categories:

- Villagers
- infantry
- foot archers and skirmishers
- cavalry archers
- cavalry
- monks
- siege
- naval units
- trade units
- unique units

Representative generic lines include:

- Militia -> Man-at-Arms -> Long Swordsman -> Two-Handed Swordsman -> Champion
- Spearman -> Pikeman -> Halberdier
- Archer -> Crossbowman -> Arbalest
- Skirmisher -> Elite Skirmisher
- Scout Cavalry -> Light Cavalry -> Hussar
- Knight -> Cavalier -> Paladin
- Camel -> Heavy Camel
- Cavalry Archer -> Heavy Cavalry Archer
- ram, mangonel, scorpion, galley, fire ship, demolition ship, and cannon-galleon lines

Exact availability comes from the data.

### 9.3 Required Orders

The input system must support:

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
- pack and unpack where applicable

### 9.4 Selection and Group Control

Required interaction model:

- click-select
- drag-select
- double-click same-type on-screen select
- control groups
- shift-queued orders
- idle villager selection
- select all military or select all idle military conveniences

### 9.5 Stances, Formations, and Patrol

Support AoE2-style stance and formation behavior:

- aggressive
- defensive
- stand ground
- no attack

Representative formations:

- line
- box
- staggered
- flank

Patrol must support movement plus opportunistic target acquisition along the route.

### 9.6 Garrison and Transport

The rules framework must support:

- Villager garrison in defensive structures
- transport across water
- ram or building garrison mechanics where present
- packed and unpacked simulation states for trebuchets and similar units

## 10. Combat System

### 10.1 Damage Calculation

Use AoE2-style class-based damage resolution:

- each attack may include base damage plus one or more class bonuses
- each target has melee armor, pierce armor, and armor-class modifiers
- damage per class contribution is floored at zero
- total damage dealt is at least 1 unless the attack is invalid

Canonical formula:

- damage = max(sum(max(attack_component - matching_armor_component, 0)), 1)

### 10.2 Melee and Pierce

The simulation must distinguish:

- melee damage
- pierce damage
- melee armor
- pierce armor

Buildings, ships, cavalry, siege, monks, and unique units rely heavily on this distinction.

### 10.3 Armor Classes and Bonus Damage

Support armor and bonus classes for at least:

- infantry
- cavalry
- camels
- archers
- skirmishers
- cavalry archers
- monks
- siege
- rams
- ships
- buildings
- stone defenses
- walls and gates

### 10.4 Accuracy and Projectiles

Projectile combat must support:

- accuracy rolls
- missed shots that land elsewhere
- projectile travel time
- attack wind-up delay
- ballistic leading where the relevant tech applies

Ballistics:

- causes many projectile units and towers to lead moving targets

Thumb Ring:

- improves effective projectile reliability for the intended unit classes

### 10.5 Elevation

Combat on higher ground should grant an AoE2-style advantage.

Representative expectation:

- uphill attacker advantage around 1.25x
- downhill penalty around 0.75x

The game should also treat elevation as relevant for line of sight and projectile behavior.

### 10.6 Attack Speed

Different units attack at different cadence through:

- reload time
- attack animation delay
- projectile release timing

The system must let civ bonuses and technologies modify reload or production independently.

### 10.7 Splash and Friendly Fire

Support splash or blast damage for:

- mangonel line
- demolition ships
- Petards
- certain unique or special attacks if content requires it

Where appropriate, siege must support friendly fire.

### 10.8 Garrison Arrows and Defensive Fire

Town Centers, Towers, and Castles must support:

- base attack
- additional garrisoned arrows where applicable
- technology modifiers
- civ-specific modifiers

The building-arrow system should be an explicit rules subsystem, not hard-coded special cases.

### 10.9 Conversion

Monk conversion must support:

- conversion channel time
- random completion window
- faith or cooldown-related resistance behavior
- target validation rules
- civ and technology modifiers
- building conversion restrictions if introduced later

Representative timing expectations:

- units convert faster than buildings
- conversion is probabilistic within a bounded window, not fixed-time

### 10.10 Healing

Monks must support:

- healing damaged friendly units
- healing range modifiers
- heal-rate modifiers
- relic carrying constraints

## 11. Technology and Civilization System

### 11.1 Technology System Overview

The game uses a civilization-specific technology tree.

Each civ differs in:

- available units
- available upgrades
- available technologies
- passive civilization bonuses
- team bonus
- unique units
- unique technologies

### 11.2 Technology Families

At minimum, support these research families:

- Blacksmith attack and armor upgrades
- University defensive and projectile upgrades
- Monastery conversion, relic, and healing upgrades
- Dock ship upgrades
- Town Center eco and age-up technologies
- Castle unique-tech and elite-upgrade technologies
- Market trade and tribute technologies
- eco-building gather and farm upgrades

### 11.3 Technology Tree UI Semantics

If a technology-tree UI is implemented, preserve the official mental model:

- buildings are separate from units and technologies
- available content is shown as available
- unavailable civ-specific content is shown as unavailable rather than hidden
- building sections reveal trainable units and researchable technologies

### 11.4 Civilization Data Ownership

`design/stats/civilizations.csv` owns:

- civ names
- expansion labels
- army archetype
- unique unit names
- unique technology names
- team bonus text
- civilization bonus text

The final spec should not duplicate every civ row in prose because that creates drift.

### 11.5 Required Civilization Capabilities

The engine must express:

- civ-specific disabled units
- civ-specific disabled technologies
- civ-specific free technologies
- civ-specific cost discounts
- civ-specific stat modifiers
- civ-specific creation-speed modifiers
- civ-specific replacement units
- civ-specific unique units outside the Castle if the data later requires it
- multiple unique units per civilization
- multiple unique technologies per civilization

### 11.6 Current Local-Coverage Policy

Use these rules until the dataset is completed:

- all civ names present in `civilizations.csv` remain selectable in tooling and validation
- only content backed by `units.csv`, `technologies.csv`, and `structures.csv` is considered shippable without placeholders
- if a civ references unique content that is missing elsewhere, treat it as a content gap, not an engine limitation

### 11.7 Team Bonuses and Allies

Team bonuses must apply to:

- the human player
- all AI allies on the same team

The simulation must allow:

- tribute to allies
- ally trade routes
- shared diplomacy state
- visibility-sharing technologies such as Cartography-style behavior where modeled

## 12. Fog of War, Line of Sight, Pathfinding, and Movement

### 12.1 Visibility States

Use the standard three-state model:

- unexplored
- explored but not currently visible
- currently visible

Expected behavior:

- terrain remains known after exploration
- last-known buildings may persist in fog until re-scouted
- enemy units update only while visible

### 12.2 Line of Sight

Each unit and building has line of sight.

The rules framework must support:

- per-entity line of sight
- line-of-sight technologies
- civ-specific line-of-sight bonuses
- age-scaling line of sight where content requires it

### 12.3 Pathfinding

Use tile-based pathfinding with continuous movement.

Requirements:

- large-group navigation
- collision-aware movement
- terrain passability rules
- obstruction by buildings, trees, cliffs, and water
- deterministic outcomes where practical

### 12.4 Terrain and Movement Interactions

Movement rules must distinguish:

- land-only movement
- naval-only movement
- shallow-water exceptions if supported by the map system
- forest as impassable except to tree-cutting siege where appropriate
- no special movement speed gain simply for roads unless explicitly added later

### 12.5 Movement Rates and Modifiers

Movement values come from unit data, but the rules system must support:

- cavalry speed bonuses
- infantry speed bonuses
- villager speed bonuses
- formation drag or cohesion effects
- stance-driven chase limits

### 12.6 Unit Spacing and Sub-Tile Occupancy

Multiple units may share a tile, but no two unit sprites may visually occupy the same on-screen position at any rendered frame. Visual non-overlap is the contract — players see sprites, not slots, and a stack of unit sprites drawn at the same screen point is a defect regardless of what the simulation believes about cell ownership.

Rules:

- Sub-tile occupancy is supported via deterministic slot packing. The default pattern is a 4x4 grid of 16 slots per tile; an implementation may choose a different pattern provided slots are distinct, stable across ticks, reproducible from inputs, and spaced widely enough that the rendered sprites at adjacent slots do not overlap on screen.
- Each slot has a fixed visual offset within its tile. The renderer must apply the slot offset (or interpolate between previous and current slot offsets across ticks for smoothness); it must not draw two units at the same screen point even when their integer tile positions match.
- Any placement, spawn, move, ungarrison, train completion, transport unload, conversion drop, or replay-rehydration must resolve to a free slot. If the target tile is fully packed, the simulation must fall back to a free slot in the nearest available neighbor tile rather than stacking two units at the same visual location.
- Buildings, resources, impassable terrain, and out-of-bounds claims block whole tiles; units cannot share a whole-cell-blocked tile.
- Garrisoned, transported, or otherwise-contained units have no independent world position and are exempt from the rule until released.
- Dying units retain their slot through death cleanup; spawns at the same point must wait or be offset to a free slot or neighbor tile.
- Renderers may interpolate between consecutive slot offsets for movement smoothness, but the per-unit visual position at every frame must remain distinct from every other unit's.

### 12.7 Movement Targets and Slot Reservation

A move command's logical destination is a cell plus a slot, not a bare cell. The simulation resolves slot assignment in two complementary ways depending on how the command was issued.

**Lazy redirect on arrival (single-unit moves).**

- When one unit is commanded to a cell, the move command targets that cell. The unit moves toward it without reserving a slot in advance; on arrival the simulation occupies any free slot the engine returns.
- If the target cell is fully packed when the unit arrives, the simulation searches the neighborhood (BFS from the target, default radius 16 cells, stopping at the first cell with a free slot) and redirects the unit to that cell. The move command's target is rewritten to the redirected cell so movement does not re-aim at the original full target — this is what prevents the oscillation that would occur if the unit kept trying to enter a permanently-full cell.
- If the search exhausts the radius without finding a free slot, the unit overflows at the original target as the last-resort fallback. Visual stacking is accepted in that pathological case; a debug-overlay flag should surface it.

**Eager pre-reservation (group moves).**

- When N units are commanded simultaneously to the same destination (drag-select then right-click, attack-move group, stance-driven group regroup), the simulation pre-allocates N distinct slots starting from the target cell and spiraling outward in a deterministic order. Each unit's move command targets its individual reserved slot, not the bare destination.
- Pre-allocated slots are reservations, not occupations: a third party that arrives at a reserved cell first may legitimately take the slot. A displaced unit whose reservation is invalidated falls back to the lazy redirect path above.
- The pre-reservation pass runs once at command issuance. Subsequent ticks do not re-allocate; if reservations are stolen they are not refreshed.

**Reservation lifecycle.**

A unit's slot reservation is released when:

- the unit arrives at the reserved cell and the reservation transitions to an occupation;
- the unit receives a new move / attack / gather / garrison / build / patrol / stop command (the new command replaces the prior reservation, allocating fresh if it is also a move);
- the unit dies, is destroyed, is converted to another player, or is garrisoned;
- the reservation has been outstanding longer than a bounded TTL (default: 30 simulation seconds) without progress toward the target — this guards against runaway reservations from unreachable destinations.

**Determinism, save / load, and replay.**

- Reservations are part of authoritative simulation state. They must be serialized in saves so a load restores the same per-unit reservations, and they must replay byte-identically from the recorded command stream.
- The pre-reservation algorithm is deterministic: same set of unit IDs + same target cell + same world state produces the same per-unit slot assignment.
- Reservations do not survive across schema-incompatible save / load cycles; a bumped save schema may reset reservations and force the next tick of movement to re-allocate via the lazy path.

**Edge cases.**

- **Mid-flight target becomes fully blocked** (a building was placed on the destination, terrain changed, the cell flipped to water): pathfinding rejects the route. The simulation cancels the move and the reservation; the unit picks a new target via the standard "approach as close as possible" rule used by any other unreachable destination.
- **Reserved cell is taken before arrival**: as above — the displaced unit falls back to lazy redirect.
- **Spawned unit lands on a full cell** (train completion, ungarrison, conversion drop, transport unload, scenario seed): treat as a single-unit move arriving "instantly" — apply the lazy redirect rule, find the nearest free slot.
- **Wandering / patrolling units** crossing through a populated cell: each unit's slot is allocated on entry and released on exit. No reservation is needed for transit because the unit is not stopping.
- **Combat engage**: when N units are commanded to attack one target, treat as a group move whose destination is the cell range around the target. Pre-allocate slots in a ring around the attack target. Same algorithm as group move with a different center selection.
- **Resource gather clusters** (villagers around a tree, a herd of sheep): each gatherer's stationing slot is allocated by lazy redirect on arrival at the resource cell. The slot is held while the unit is gathering and freed when the unit moves on (deposit run, switch resource, etc.).
- **Building construction**: each builder villager occupies a slot in a cell adjacent to the foundation. The construction system selects construction-side slots via the same lazy-on-arrival rule.
- **Mass formations** (50+ units): the pre-reservation algorithm must scale linearly with group size and tolerate map-edge truncation (the spiral hitting bounds returns fewer slots than requested; the remaining units fall through to lazy redirect on arrival).
- **Map edge / out-of-bounds**: the BFS / spiral skip out-of-bounds cells; reservation may run short.
- **Naval vs land**: only same-domain neighbor cells count as candidates (a land unit's redirect cannot land on water; a fishing ship's cannot land on grass).
- **Performance**: occupancy queries are O(slots_per_cell) per cell visited; both algorithms are bounded so worst-case cost is small even for dense moves.

The renderer is unaffected by the reservation system — it reads the unit's transform position only, exactly as it does today. All reservation bookkeeping lives in simulation state.

## 13. AI Opponent Behavior

### 13.1 Difficulty Levels

Provide a ladder of AI difficulties from beginner to strong play.

Difficulty should affect:

- economy efficiency
- build-order coherence
- reaction time
- scouting quality
- military timing
- target prioritization
- willingness to expand, wall, trade, or contest relics

### 13.2 Economic Behavior

Minimum AI economy capabilities:

- constant villager production when appropriate
- population-house management
- adaptive gatherer distribution
- farm transition
- age-up timing
- Castle Age expansion to extra Town Centers
- late-game trade when allied

### 13.3 Military Behavior

Minimum AI military capabilities:

- scouting-informed unit composition
- use of siege against static defenses
- basic raiding and defense
- regrouping before attacks
- simple counter-unit behavior
- relic contest on maps where relics matter
- navy production and transport behavior on water maps

### 13.4 Team Behavior

AI allies should:

- respect alliances
- trade when sensible
- tribute in long games when useful
- contribute armies against shared enemies

### 13.5 Minimum Competence Requirement

The AI must be able to finish a full skirmish under the same rules as the player.

## 14. User Interface and Presentation

### 14.1 HUD

The HUD should include:

- top resource bar
- population readout
- minimap
- selected-unit or selected-building panel
- action and command panel
- queue and progress display

### 14.2 Command Panel

The command panel must be context-sensitive:

- Villager: build menu, repair, garrison, gather actions
- military unit: attack, patrol, stance, formation, garrison actions
- production building: train queue, technologies, rally point
- Monastery: monk production and monastery technologies

### 14.3 Minimap, Alerts, and Camera

Required behavior:

- minimap with terrain and visibility representation
- attack alerts
- research-complete notifications
- age-up notifications
- idle-villager indicator
- edge-scroll when the game is fullscreen or the browser window fully fills the monitor, plus keyboard camera movement
- zoom support

### 14.4 Tech Tree Viewer

The UI should support a technology-tree view that:

- groups content by building
- shows available and unavailable items
- reveals prerequisite logic
- matches the normalized civ-filtered roster

### 14.5 Audio and Visual Direction

Presentation targets:

- isometric RTS readability
- clear faction-color ownership
- directional unit animation
- construction, damage, and rubble states for buildings
- architecture-set variation by civilization region
- distinct alert, economy, combat, and age-up audio cues

## 15. Simulation, Saves, and Content Pipeline

### 15.1 Tick Model and Determinism

The simulation should be fixed-step and deterministic where practical.

Requirements:

- game logic decoupled from render frame rate
- seeded random number generation for reproducible logic
- per-tick updates for movement, combat, gathering, training, research, and AI

### 15.2 Command Model

The simulation must support timestamped commands such as:

- move
- attack
- build
- train
- research
- garrison
- ungarrison
- patrol
- set rally point
- tribute
- market buy or sell
- ring town bell

**Rejection messages state the actionable reason (2026-06-11).** When a command validator rejects, the rejection `message` must name the actual unmet rule, not just a category: `cannot_research` states WHY the tech is unavailable (e.g. "Advancing to feudal-age requires 2 completed Dark Age buildings (mill, lumber-camp, mining-camp, or barracks) — you have 1.", already-researched, wrong building with the right one named, or the currently-researchable list as fallback); `cannot_train` names the rejected unit + what is currently trainable there; `insufficient_resources` carries need-vs-have detail per missing resource; `placement_blocked` names the blocking cause (water/forest/building type/resource/unit/map edge) at the first blocked cell, the blocked-cell count, the footprint size, and — when one exists within the scan radius — the nearest open anchor fully visible to the acting owner. Rejection codes are unchanged; only message text is enriched. The reason logic for research lives in one shared engine (`bridge/researchAvailability.ts`) consumed by both the validator and the agent snapshot, so the two surfaces can never disagree. The HUD toast for `cannot_research` / `placement_blocked` passes the validator message through (other codes keep their terse toast strings). Fog rule: a rejection may name the cause for the exact footprint the player targeted (the engine already adjudicated it), but suggestions only reference cells currently visible to that owner.

### 15.3 Save and Load

**Replay (supersedes this section's original "no replay system is in scope" — the replay stack shipped v0.1.7-0.1.16 and is in scope).** Every session records to a civ-engine session bundle (initial snapshot + every command + diffs) that replays bit-exact. Replay mode is entered through the HUD's Replay… dialog (three sources: current live session, prior sessions persisted in IndexedDB, file import) and is driven by the bottom timeline panel (scrub bar, step/play controls, marker + hotspot pins) and hotkeys (Space play/pause, ←/→ step, Home/End jump, Alt+T panel toggle, Esc exit). Replay never accepts new gameplay commands. **Fog perspective (2026-06-12):** the replay renders player 1's fog of war by default; the timeline panel's fog toggle (and Alt+F) cycles the rendered fog perspective through the players recorded in the bundle (toggle disabled for single-player bundles; perspective resets to player 1 on every replay entry). Switching perspective changes only the rendered visibility and entity filtering — simulation state, playback position, play/pause state, and selection are untouched, and the HUD's resource/age panels stay bound to player 1 (fog toggle, not a POV switch). "Last seen" ghost fog-memory entities render only for player 1's perspective: the engine records fog memory for the human player alone, so other perspectives show live visibility without ghosts. Live mode has no fog toggle (cheat surface). Cross-version bundles: bundle replay is same-engine-major tooling by civ-engine policy — bundles recorded under engine 0.x replay only with 0.x tooling.

If save and load is implemented, it must serialize enough state to resume an in-progress skirmish accurately, including:

- map state
- entity state
- queues and timers
- AI state
- visibility state
- diplomacy and trade state
- random seed and simulation clock

### 15.4 Data Normalization Requirements

Before using `design/stats` directly in-engine, normalize it into a clean internal representation.

Required normalization:

- validate uniqueness of primary keys such as civilization names
- split semicolon-delimited multi-value fields into arrays
- trim and normalize spacing in CSV text
- validate canonical names across producer, developer, and target references
- split range fields like `1-4` into machine-friendly range representations
- parse embedded cost blobs into structured resources

### 15.5 Required Derived Fields

The importer should derive:

- canonical unit IDs
- canonical technology IDs
- canonical building IDs
- upgrade chains
- civ-to-unique-unit links
- civ-to-unique-tech links
- age availability
- producer-to-output mappings
- researcher-to-technology mappings

### 15.6 Data Integrity Checks

The content pipeline should fail validation when:

- a civ row names a unique unit missing from `units.csv`
- a civ row names a unique tech missing from `technologies.csv`
- an upgrade target is missing
- a producer building is missing
- a tech references an unknown target
- duplicate canonical IDs are produced after normalization

### 15.7 LLM-Agent Playtest Harness (Internal Tooling)

The repo ships an LLM-agent playtest harness that drives the simulation through a Claude-based agent and checks for gameplay regressions (with advisory visual observation — no pixel-level gating). The harness is internal tooling — it does not affect game rules — but its operator-visible mechanics are documented here so future autonomous handoffs know the surface.

- **Provider selection.** The playtest runner (`scripts/playtest-llm.mjs`) auto-selects between two LLM providers: `claude-code` (subscription auth via the `claude` CLI; default when `claude` resolves to a `.exe` on PATH) and `api` (Anthropic SDK with `ANTHROPIC_API_KEY`). Explicit override via `--provider claude-code|api`.
- **Model policy: all playtest LLM calls use ONE model** — tactical, strategy, observation oracle, the auto-fix `submit_fix_diff` call, and the deterministic-loop propose-fix CLI. Do not split tiers across models. **Current model: `claude-opus-4-8` (2026-06-12 user directive — Fable 5 is banned for now; revert to `claude-fable-5` when the ban lifts).** The prior 2026-06-09 directive pinned `claude-fable-5`; that remains the intended model once available. When swapping wholesale (ban lift, flagship bump), smoke-test the new id via `echo ok | claude -p --model <id>` first (per the AGENTS.md model-currency rule) and update all five call sites (`scripts/playtest-llm.mjs` ×3, `scripts/playtest-llm-auto-fix.mjs`, `scripts/propose-fix.mjs`) plus the `DEFAULT_LLM_COST_TABLE` row in `src/game/playtest/types.ts`.
- **Paused-sim decisions (playtest-fixes C).** The runner pauses the simulation (`__AOE2_TEST__.setPaused(true)`, a pass-through to `bridge.setPaused`) once after boot and keeps it paused while the agent thinks; the host's `advanceTicks` atomically unpauses → steps N ticks → repauses inside one synchronous page task. The bridge tick therefore moves ONLY via `advanceTicks`: `--max-ticks` is exact, and screenshot checkpoints land precisely when they are multiples of `--decision-interval`. Without this, real-time drift during 10-100s LLM calls advanced the game ~600-1000 ticks per decision and made checkpoint capture impossible.
- **Agent context (playtest-fixes A/B).** The per-decision snapshot includes the agent's OWN units (id/kind/position/task, cap 150), own buildings (id/kind/position/isComplete, cap 64), and nearby gatherable resources (id/kind/position/amount, visibility-filtered, sorted by distance to the first own building, cap 64) — these are the only legitimate sources for the command tools' entity ids and are never fog-filtered (own forces) so the model cannot be id-blind. After each decision, the engine's dispatch verdicts (accepted/rejected + reasons) are reported back to the agent and rendered into the next tactical prompt, with an explicit warning block when the previous decision had rejections. The dispatch boundary also enforces ownership: commands whose acting entity (unitId/sheepId/buildingId/builderId/playerId) does not belong to the agent's owner are rejected pre-queue with reason `not-owned` — the engine's semantic validators carry no actor identity, so without this gate the agent could command enemy entities. Pre-queue rejections (not-owned, malformed payloads) are merged into the same feedback loop as engine verdicts. **Agent affordances (2026-06-11, campaign-1 backlog #1-#3):** the snapshot additionally carries `buildingOptions` — per completed owned building type, the research options available now (with costs), the locked research with the actionable WHY (shared reason engine with the `cannot_research` validator; in-flight techs are marked "already being researched" so the agent doesn't double-queue), trainable units, and the villager build menu with footprints + costs — and `placementHints` — up to 6 open 2x2 anchors and 4 open 3x3 anchors near the agent's town center, found by a deterministic ring scan in which every footprint cell must be unblocked AND currently visible to the agent (fog reveals nothing, even under `--omniscient`). Rejection messages themselves are actionable per §15.2, and the `building.placeConfirm` tool description points the model at `placementHints`.
- **Snapshot visibility (Phase-6.B).** The agent's per-decision state snapshot filters enemy units/buildings through per-owner visibility by default. Buildings use the engine's any-cell-visible rule (consistent with the renderer + target selection); units use single-cell. `--omniscient` (or per-row `omniscient: true`) opts into cheat-mode global view. As of 2026-06-10 the corpus smoke row runs fog-filtered (the agent has own-entity context, so cheat-mode is no longer needed).
- **Post-hoc observation oracle (Phase-6.C.2).** `--observation` (or per-row `observation: true`) enables a single advisory LLM call after the run completes. The oracle examines the final-tick screenshot + a textual summary (decisions, ticks, cost, stop reason, rejection count, error, and — since 2026-06-10 — the AGENT's final per-player state: age, resources, population, villager tasks, buildings, military). The oracle prompt explicitly instructs that the screenshot HUD belongs to the passive human observer, so economic judgment must come from the agent-state block (finding G: without it, a competent run was graded looked-broken off the wrong player's HUD) and emits `{verdict: 'looked-fun' | 'looked-broken' | 'inconclusive', notes: string}`. The verdict is appended to the run envelope as `observation`. **Advisory only** — does NOT affect CI exit codes; engineHalt remains the regression signal. The oracle's cost is rolled into `envelope.totalCostUsd` for accurate corpus rollups; the `observation.costUsd` field preserves the per-component breakdown. The oracle is skipped when the agent's rolling cost-budget gate already tripped (`stopReason='stopWhen'` + `errorMessage='cost-budget-exceeded'`).
- **Provider-error classification + retry (2026-06-13).** A transient LLM-call failure (the `claude -p` subprocess exiting non-zero, timing out, failing to spawn, an `is_error` envelope, or an SDK call error) is a `ProviderCallError`, distinct from an engine/host crash. A `RetryingProvider` wrapper retries the failing provider CALL in place with exponential backoff (`backoffMs * 2^attempt`; the campaign script uses 2 retries / 3s base → 3 attempts) before giving up; a succeeding retry continues the run. Retrying the call (not the whole decision) keeps each decision idempotent — no double strategy-refresh charge. When retries are exhausted the run stops with the distinct stop reason **`providerError`** — NOT `engineHalt`. The difference is load-bearing: on a provider failure the simulation and page are healthy (only the model call died), so the winner oracle still scores the game, the final screenshot still captures, and the bundle still exports; `engineHalt` (a genuine sim/page crash) suppresses all three. Any non-provider throw (host calls, agent bugs, deterministic config errors like a missing cost-table row) keeps `engineHalt`. Rationale: campaign-2/-3 each reached Feudal with a healthy economy but were cut short and mis-scored when a one-off `claude exit 1` was treated as a fatal engine halt; this makes a subprocess blip recoverable and, when not, honestly labelled. For corpus CI, `providerError` does NOT trip the HIGH-regression gate — it is exempted alongside `cost-budget-exceeded` (shared predicate `isLlmCorpusRegression` in `corpusRegression.ts`), so `engineHalt` plus genuinely-unexpected error messages stay the only corpus regression signals; the row stays visible (amber, distinct from clean-green and halt-red) in `SUMMARY-LLM.md` and the dashboard.
- **Winner oracle (Phase-6.D).** Always populated on clean exits as `envelope.winner`: `{kind: 'winner', ownerId}` when exactly one owner has living units or buildings; `{kind: 'in-progress', aliveOwners: number[]}` when multiple owners are alive (game didn't play out); `{kind: 'tie'}` when no owner has any entities (mutual destruction or scenario reset). Read of `economy.units` + `economy.buildings`; excludes `economy.resources` (sheep/wildlife/gather sites), so neutral entities don't perturb scoring. Includes under-construction buildings — owner is "alive" if they have any worldly footprint. Field is OMITTED (not set to undefined) when `stopReason === 'engineHalt'`; consumers should use `'winner' in envelope` to distinguish "scored" from "not scored". Cost-budget exits (`stopReason='stopWhen'` + `errorMessage='cost-budget-exceeded'`) DO get scored — the result will typically be `kind: 'in-progress'`, capturing partial-play state honestly. Asymmetric with the observation oracle's cost-budget skip because winner extraction has zero marginal cost (engine state read, no LLM call).
- **Checkpoint screenshots (option C, 2026-06-10 — replaces the Phase-6.C.1 visual-regression oracle).** The runner captures a screenshot whenever an advance lands exactly on a checkpoint tick (`--screenshot-every <ticks>`, default 1000, 0 disables; align to multiples of `--decision-interval`) and persists them to `<out>-screenshots/<tick>.png` for the corpus dashboard. There is NO baseline comparison and NO visual CI gate for LLM runs: a non-deterministic player has no "correct" reference image, so pixel diffs against a fixed PNG measured expected divergence rather than regressions (campaign-1 evidence: 9.86% diffs from a competently different base layout). Simulation determinism remains covered by the replay/snapshot-equivalence suites and render correctness by the deterministic Playwright browser tests; `engineHalt` plus the gameplay oracles and the grounded observation verdict are the LLM-row regression signals. The pure `visualOracle.ts` module is retained, unwired, for a future deterministic corpus row where baselines are meaningful.
- **HTML dashboard.** `npm run playtest:corpus-dashboard -- <corpus-dir>` (or auto-pick newest by mtime when no arg) emits `dashboard.html` next to `SUMMARY-LLM.md`: a per-run summary table (cost / ticks / decisions / winner / observation verdict / checkpoint-screenshot count) and per-run thumbnail grids of the checkpoint screenshots. Pure script — no runtime dependencies; thumbnails are referenced via relative `<img src=>` paths so the file works directly in the browser when opened from the corpus-llm dir.
- **Auto-apply propose-fix + counterfactual fix-validation (Phase-6.E).** Off by default — enabled via `npm run playtest:llm-auto-fix`. The orchestrator wraps `playtest:llm` with an auto-fix loop: (1) baseline run; (2) on regression (engineHalt), prompts the configured LlmProvider for a unified-diff fix using the envelope as context (the model emits the diff via a `submit_fix_diff` tool so subscription/API providers behave identically); (3) shared `applyAndGate` helper validates via `git apply --check`, branches off `main` to `auto-fix/<seed>-<YYYYMMDDHHMMSS>`, applies the diff, runs all 4 gates (`typecheck`, `lint`, `build`, `test`), and on success commits the patch so the branch is push-ready; on any gate failure hard-reverts via `git reset --hard HEAD` + `git clean -fd` (the reset covers both staged and unstaged changes; the clean sweeps any untracked files the patch added); (4) on all-green gates, runs an N=3-sample counterfactual (re-runs the LLM on the same seed against the committed patched build) — any single counterfactual halt rejects the fix; all-N-clean leaves the branch ready for manual `git push origin auto-fix/<...>` + PR. Pass `--skip-counterfactual` for the propose-only sub-flow that skips step 4. Pre-conditions: clean working tree AND `git rev-parse --abbrev-ref HEAD` returns `main`. The auto-fix loop never pushes or opens PRs automatically — operator confirmation is the gate before code lands on `main`. On any error path (apply-failed, gate-failed, counterfactual-failed, commit-failed) the auto-fix branch is fully reverted and deleted (or, if the branch was never created, left untouched) so the operator's working tree returns to the pre-invocation state. Each `playtest:llm` invocation deletes any pre-existing envelope at its `--out` path before running so a child crash before envelope-write cannot drive false validation against stale data.
- **Cost-budget gate.** The agent's rolling cost-budget (`--cost-budget`, default $5) trips when notional API-equivalent cost crosses the cap. With Claude Code subscription, each call carries a ~15K-token cache_creation prelude (~$0.55/call observed on `claude-fable-5` at $10/$50 per MTok — the own-entity context grew prompts; blended ≈ $0.61/decision with the default strategy cadence). Default $5 budget allows ~8 decisions; bump (`--cost-budget 20` ≈ a full 5000-tick run) for longer campaigns.
- **Determinism caveat.** Bundles replay bit-exact, but re-querying the LLM on the same seed is non-deterministic even at temperature 0. Counterfactual fix-validation (Phase-6.E, shipped) acknowledges this: it samples N=3 runs and rejects a fix if any fails the regression check.

## 16. Acceptance Criteria, Non-Goals, and Next Steps

### 16.1 Acceptance Criteria

The implementation satisfies this spec when:

- a standard Random Map skirmish can be played start to finish
- the technology tree and command panels are generated from normalized content data, not hand-authored code tables
- generic units, buildings, and technologies present in local data load successfully
- civilization selection is driven from normalized civ data
- missing later-expansion civ content is reported as missing data instead of silently ignored or fabricated
- the rules framework can represent DE-style multiple unique units and multiple unique-tech slots even if the current dataset does not yet fill every slot
- AI can complete a match under the same rules as the player

### 16.2 Non-Goals for This Revision

- claiming complete parity with the current live-DE DLC roster
- hand-copying the full civ roster and every bonus into prose when the CSVs already own that data
- preserving older AoC-only assumptions from earlier drafts
- silently filling data gaps with guessed civ content
- multiplayer
- campaign story mode
- non-standard game modes

### 16.3 Immediate Next Steps

1. Normalize `design/stats` into canonical internal data.
2. Auto-generate producer-to-unit and producer-to-tech mappings from normalized content.
3. Add validation that reports all current DE-versus-dataset gaps explicitly.
4. Extend the stats bundle if fuller DE parity is required later.

## Appendix A: Key Formulas and Constants

Use these as the default gameplay formulas unless local data or a later focused rules revision overrides them.

Damage:

- damage = max(sum(max(attack_component - matching_armor_component, 0)), 1)

Construction with multiple builders:

- actual_time = 3 * base_time / (builders + 2)

Trade income:

- land and naval trade should scale primarily with route length
- default target formula: gold = 0.46 * distance * (distance / map_size + 0.3)

Elevation modifier:

- uphill advantage about 1.25x
- downhill penalty about 0.75x

Market fee:

- base commodity fee: 30 percent
- Guilds-style reduction target: 15 percent
- civ-specific extreme discount floor target: 5 percent

Tribute fee:

- base tribute fee: 30 percent
- Coinage-style reduction target: 20 percent
- Banking-style reduction target: 0 percent

Relic income:

- target baseline: 0.5 gold per second per garrisoned relic

Victory countdown target:

- Wonder and relic countdowns should use the standard Random Map expectation of 200 in-game years
