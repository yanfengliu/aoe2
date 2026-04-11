# Age of Empires II-Compatible Game Specification

## Document Status

- Purpose: define a clean-room, implementation-oriented specification for an `Age of Empires II` style real-time strategy game.
- Compatibility target: the classic `Age of Kings + The Conquerors` era ruleset, frozen as the baseline for v1.
- Out of scope for this document: proprietary art, audio, voice lines, campaign scripts, cutscenes, and exact retail balance patches after the classic baseline.
- Success criterion: another agent should be able to build a faithful skirmish-focused RTS from this document plus data tables that follow the schemas defined here.

## 1. Product Definition

The game is a real-time strategy game about building an economy, advancing through four ages, fielding armies, and defeating opponents on a shared map. The player controls a medieval civilization with a distinct tech tree, bonuses, and unique units. A match is won through territorial control, economic growth, scouting, and combined-arms combat.

The defining gameplay loop is:

1. Scout the map and secure food, wood, gold, and stone.
2. Train villagers and expand the economy.
3. Construct military and economic buildings.
4. Advance from Dark Age to Feudal, Castle, and Imperial Age.
5. Research technologies and produce armies.
6. Pressure the opponent, defend raids, secure relics and trade.
7. Win by destroying opponents, controlling the map, or satisfying the configured victory mode.

## 2. Core Design Pillars

- Economy before army. Early decisions revolve around villager production, resource access, and build order efficiency.
- Continuous progression. Power increases through ages, technologies, and additional production buildings.
- Imperfect information. Scouting and fog of war are essential.
- Terrain matters. Chokepoints, shorelines, elevation, forests, and resource placement shape strategy.
- Civilization asymmetry. All civilizations share the same core systems but differ through bonuses, unique units, and tech availability.
- Combined arms. Counter relationships and army composition matter more than raw unit count.
- Deterministic simulation. The game should be buildable for single-player and lockstep multiplayer from the same fixed-step rules.

## 3. Match Structure

### 3.1 Players

- Supported player count: `2-8`.
- Supported controllers: human and AI.
- Each player has:
  - civilization
  - color
  - team
  - diplomacy state with every other player
  - resource stockpile
  - researched tech set
  - explored and visible map state
  - score

### 3.2 Standard Match Defaults

- Mode: Random Map, Standard conquest.
- Starting age: Dark Age.
- Starting resources: `200 food`, `200 wood`, `100 stone`, `0 gold`.
- Starting entities:
  - `1 Town Center`
  - `3 Villagers`
  - `1 Scout Cavalry` for most civilizations
  - `1 Eagle Scout` for Mesoamerican civilizations
- Population cap: configurable, default `200`.
- Game speed: configurable multiplier on render pacing, not on deterministic rules.

### 3.3 Match Phases

- Opening: first scouting, first houses, first food income, villager production.
- Expansion: additional resource camps, farms, military production, age-up.
- Midgame: Feudal and Castle Age combat, map control, extra Town Centers, relic fights.
- Endgame: Imperial Age power units, treb wars, fortified fronts, trade economy, attrition.

## 4. World Model

### 4.1 Map Representation

- The world is a 2D top-down map.
- The map is tile-based for terrain and placement, with continuous sub-tile movement for units.
- Simulation requires:
  - terrain layer
  - elevation layer
  - passability layer
  - resource object layer
  - placed entity layer

### 4.2 Terrain Types

Required terrain categories:

- Grass or open land
- Forest
- Shoreline
- Deep water
- Shallow water
- Cliff or impassable edge
- Elevation steps

Terrain affects:

- building placement
- unit passability
- ship passability
- projectile and vision interactions where relevant
- random map generation

### 4.3 Elevation

- Elevation is discrete.
- Units on higher ground gain an attack advantage against lower targets.
- Units attacking uphill suffer a penalty.
- Miss chance and damage modifiers may be driven by data, but elevation must materially affect combat outcomes.

### 4.4 Resources on the Map

Required resource objects:

- forage bushes
- herdables such as sheep
- huntables such as boar and deer
- fish
- straggler trees
- forest trees
- gold mines
- stone mines
- relics

Rules:

- Most resource nodes are finite.
- Farms are player-owned renewable food sources that are paid for up front and deplete over time.
- Relics are neutral objects captured by monks and converted into passive gold income when garrisoned in a monastery.

### 4.5 Neutral Actors

Required neutral behaviors:

- Sheep and equivalent herdables transfer ownership to the nearest player unit that discovers them.
- Deer flee when approached or attacked.
- Boar retaliate and can be lured.
- Wolves and hostile animals attack nearby vulnerable units.
- Fish are harvested by fishing ships only.

### 4.6 Fog of War

Each tile has one of three states per player:

- unexplored: never seen, rendered black
- explored but not visible: previously seen, rendered in memory fog
- visible: currently within line of sight

Rules:

- Units and buildings reveal line of sight continuously.
- Enemy units disappear when not visible unless they are currently detected by allied vision.
- Buildings and terrain remain in memory after exploration.

## 5. Player State

Each player maintains the following authoritative state:

- `food`
- `wood`
- `gold`
- `stone`
- `population_used`
- `population_capacity`
- `current_age`
- `researched_techs`
- `queued_research`
- `diplomacy`
- `explored_tiles`
- `visible_tiles`
- `score_breakdown`
- `defeated` flag

### 5.1 Score

Score is informational, not a win condition. It should include at minimum:

- military score
- economy score
- technology score
- society score

## 6. Entity Model

### 6.1 Common Entity Fields

Every unit and building should be data-driven with at least:

- stable `id`
- display name
- owner
- position
- footprint or radius
- hit points
- max hit points
- line of sight
- armor values
- class tags
- commands available
- current order
- order queue
- garrison state if supported
- build or train origin
- cost
- creation time
- destruction state

### 6.2 Unit Categories

Required categories:

- economic units
- infantry
- archers
- cavalry
- siege
- monks
- ships
- trade units
- unique units

### 6.3 Building Categories

Required categories:

- economic buildings
- houses and population support
- military production
- military tech buildings
- drop-off buildings
- defensive buildings
- wonders
- docks and naval infrastructure

### 6.4 Projectiles

Projectiles are separate simulation objects when applicable. They need:

- source entity
- target entity or target point
- travel speed
- accuracy or scatter data
- splash rules
- damage payload
- expiration rules

## 7. Unit Control and Orders

### 7.1 Selection

Required interaction model:

- click to select a single unit or building
- drag box for multi-select
- double-click to select nearby units of same type on screen
- control groups `0-9`
- shift-queue orders

### 7.2 Order Types

Required unit and building orders:

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
- set gather point
- train unit
- research technology
- pack or unpack if unit supports it
- convert if monk
- heal if monk

### 7.3 Stances and Formations

Required combat stances:

- aggressive
- defensive
- stand ground
- no attack or passive

Required formations:

- line
- box
- staggered
- flank

Units in formation should preserve relative shape where possible, but pathfinding success is more important than perfect cohesion.

## 8. Economy Rules

### 8.1 Villagers

Villagers are the primary economic unit.

Capabilities:

- gather all land resources
- build buildings
- repair buildings and ships
- fight weakly in melee
- garrison in defensive structures

Rules:

- Each villager gathers one resource type at a time.
- Gathered resources are only credited after drop-off at a valid drop site unless the source is designed otherwise.
- Carry capacity, work rate, and walking distance are major economic variables and must be data-driven.

### 8.2 Resource Drop Sites

Required drop-off structure relationships:

- food: Town Center, Mill, Dock for fish
- wood: Town Center, Lumber Camp
- gold: Town Center, Mining Camp
- stone: Town Center, Mining Camp

### 8.3 Food Sources

Required food pipeline:

- sheep or herdables
- berries
- hunt
- farms
- fish

Rules:

- Farms are placed by villagers.
- Farms have finite food content and must be reseeded manually or through auto-reseed logic if implemented.
- Fishing ships cannot harvest land food.

### 8.4 Construction

Rules:

- Buildings start as foundations.
- Builders convert foundation progress into completion.
- Multiple builders accelerate construction with diminishing efficiency.
- An incomplete foundation can be attacked and destroyed.
- Building cost is paid at foundation placement.

### 8.5 Repair

Rules:

- Damaged buildings and ships can be repaired by eligible units.
- Repair consumes a fraction of the original resource cost.
- Repair speed scales with worker count with diminishing returns.

### 8.6 Trade

Required trade model:

- Trade carts move between allied markets on land.
- Trade cogs move between allied docks on water maps.
- Gold income increases with route distance.
- Traders automatically repeat a configured route.

### 8.7 Relics

Rules:

- Only monks can pick up relics.
- A monk carrying a relic moves normally but cannot perform other tasks while carrying it.
- A relic inside a monastery generates passive gold at fixed intervals for its owner.

## 9. Age Progression

The game has four ages:

- Dark Age
- Feudal Age
- Castle Age
- Imperial Age

Rules:

- Age advancement is researched at the Town Center.
- Each age-up has a cost and research time.
- Each age has prerequisite buildings.
- Advancing an age unlocks new buildings, units, upgrades, and tech tiers.

### 9.1 Required Baseline Prerequisites

- Feudal Age: two Dark Age buildings in addition to required starting infrastructure.
- Castle Age: Feudal Age plus two Feudal Age buildings.
- Imperial Age: Castle Age plus two Castle Age buildings.

Exact prerequisite lists should be data-driven per civilization if needed, but the baseline should follow classic AoE II behavior.

## 10. Technology System

### 10.1 Research Rules

- Technologies are researched at a specific building.
- Only one technology can be researched at a building at a time unless the building is explicitly multi-queue.
- Research cost is paid on start.
- Completed technologies apply permanent effects to the player or a subset of entities.
- Tech effects must be data-driven, not hardcoded into UI flows.

### 10.2 Tech Categories

Required categories:

- economic techs
- blacksmith combat upgrades
- unit line upgrades
- naval upgrades
- monk techs
- university techs
- civilization unique techs

### 10.3 Upgrade Behavior

- A line upgrade replaces the trainable definition of the lower-tier unit.
- Existing units in that line convert to the new stats when the upgrade completes.
- Some upgrades are civilization-locked.

## 11. Combat Rules

### 11.1 Damage Model

Damage resolution must support:

- base attack
- damage type such as melee or pierce
- attack bonuses versus class tags
- target armor values
- minimum damage floor

Recommended formula:

`final_damage = max(1, base_attack + sum(applicable_bonus_damage) - relevant_armor)`

### 11.2 Combat Cycle

Units need these combat timings:

- attack wind-up or animation point
- reload time
- projectile launch time for ranged units
- turn rate or retarget constraints where relevant

### 11.3 Range and Line of Sight

- A unit may only acquire targets it can see unless attack-ground style behavior is supported.
- Ranged attacks require target range checks.
- Minimum range exists for select siege units.

### 11.4 Accuracy and Ballistics

- Ranged units may miss based on accuracy and target movement.
- Some technologies improve projectile tracking.
- Siege attacks can deviate or land with splash.

### 11.5 Splash and Friendly Fire

Rules:

- Mangonel-style siege deals area damage.
- Friendly fire is enabled for siege splash where intended.
- Demolition ships deal burst splash damage on detonation.

### 11.6 Counter System

The counter web must include:

- spears counter cavalry
- skirmishers counter archers
- cavalry counters siege and many ranged units
- monks counter expensive single targets through conversion
- siege counters buildings and dense formations
- trash units cost no gold and remain valuable in long games

### 11.7 Garrison

Required garrison rules:

- Villagers can garrison in Town Centers, Towers, and Castles.
- Infantry may garrison in rams if the implementation supports classic behavior.
- Transport ships carry land units.
- Some structures gain additional arrows or protection from garrisoned units.

### 11.8 Healing and Conversion

Monks must support:

- heal friendly biological units
- convert enemy units and some buildings
- pick up and carry relics

Conversion rules:

- Conversion has a channel time with randomness inside a bounded window.
- Converted entities immediately change ownership.
- Some units and technologies modify resistance or range.
- Siege conversion can be enabled or disabled per unit class according to the baseline ruleset.

## 12. Naval Rules

Naval gameplay must be first-class on water maps.

Required naval roles:

- fishing ship for economy
- transport ship for unit movement
- galley line for ranged naval combat
- fire ship line for close anti-ship combat
- demolition ship line for burst splash
- cannon galleon line for siege
- trade cog for naval trade

Rules:

- Ships move only on water passability.
- Docks train ships and receive fish.
- Shoreline building placement and ship pathfinding must work reliably.

## 13. Buildings and Content Roster

This section defines the minimum content required for the baseline classic ruleset. Exact numeric stats belong in data tables, but these units and buildings must exist.

### 13.1 Economic and Core Buildings

- Town Center
- House
- Mill
- Farm
- Lumber Camp
- Mining Camp
- Dock
- Market
- Blacksmith

### 13.2 Military Buildings

- Barracks
- Archery Range
- Stable
- Siege Workshop
- Monastery
- University
- Castle

### 13.3 Defensive and Utility Buildings

- Outpost
- Palisade Wall
- Stone Wall
- Gates matching wall types
- Watch Tower line
- Castle
- Wonder

### 13.4 Core Land Unit Lines

- Villager
- Militia line through Champion
- Spearman line through Halberdier
- Eagle Scout line through Elite Eagle Warrior for Mesoamerican civilizations
- Archer line through Arbalester
- Skirmisher line through Elite Skirmisher
- Cavalry Archer line through Heavy Cavalry Archer
- Hand Cannoneer
- Scout Cavalry line through Hussar
- Knight line through Paladin
- Camel line through Heavy Camel
- Monk
- Trade Cart
- Battering Ram line through Siege Ram
- Mangonel line through Siege Onager
- Scorpion line through Heavy Scorpion
- Bombard Cannon
- Trebuchet and Packed Trebuchet states

### 13.5 Core Naval Unit Lines

- Fishing Ship
- Transport Ship
- Trade Cog
- Galley line through Galleon
- Fire Ship line through Fast Fire Ship
- Demolition Ship line through Heavy Demolition Ship
- Cannon Galleon line through Elite Cannon Galleon

### 13.6 Civilization Unique Units

Each civilization must have at least:

- `1` castle-trained unique unit
- `1` elite upgrade for that unique unit
- optional secondary unique unit if the chosen baseline includes one

## 14. Civilization System

### 14.1 Civilization Data Contract

Every civilization record must define:

- `id`
- `display_name`
- `architecture_set`
- `language_set`
- `team_bonus`
- `civilization_bonuses[]`
- `unique_unit_id`
- `unique_tech_castle_age`
- `unique_tech_imperial_age`
- `disabled_units[]`
- `disabled_techs[]`
- `modifiers[]`
- `start_unit_override` if not scout cavalry

### 14.2 Baseline Roster

The v1 classic roster is:

- Britons
- Byzantines
- Celts
- Chinese
- Franks
- Goths
- Japanese
- Koreans
- Mongols
- Persians
- Saracens
- Teutons
- Turks
- Vikings
- Aztecs
- Huns
- Mayans
- Spanish

### 14.3 Civilization Identity Rules

- Civilizations share the same base economy and age structure.
- Differences come from available units, missing upgrades, bonuses, and unique techs.
- No civilization should bypass core game systems such as population, resource gathering, or age progression.
- Civilization effects must be additive and data-driven.

## 15. Random Maps and Scenarios

### 15.1 Random Map Requirements

The random map system must support:

- deterministic generation from a seed
- mirrored fairness for team positions where applicable
- biome themes
- terrain painting
- resource distribution rules
- player spawn spacing
- neutral object placement

### 15.2 Required Baseline Random Map Types

- Arabia
- Black Forest
- Arena
- Islands
- Team Islands
- Nomad
- Migration

### 15.3 Baseline Spawn Guarantees

Every standard start must guarantee near the player:

- safe initial wood
- several nearby sheep or equivalent
- nearby berries
- at least one boar or equivalent hunt
- near gold
- near stone

Secondary resources and contested resources should be placed farther away to drive map control.

## 16. Victory and Defeat

### 16.1 Standard Conquest

A player is defeated when they have no meaningful ability to continue. For implementation simplicity, use the standard rule:

- the player has no surviving units, buildings, or production-capable state as defined by the configured mode

Team conquest:

- a team loses when all players on that team are defeated

### 16.2 Additional Victory Modes

The rules framework should support:

- Last Man Standing
- Wonder Victory
- Regicide
- King of the Hill
- Score Victory with timer

These can be implemented after standard conquest, but the game state model should allow them.

## 17. User Interface Requirements

### 17.1 HUD

Required HUD regions:

- top resource bar
- current age indicator
- population display
- selected unit or building panel
- command card
- minimap
- diplomacy and score access

### 17.2 Selected Entity Panel

The panel must show:

- name
- icon
- owner color
- hit points
- armor and attack summary when relevant
- carried resources for workers
- garrison contents if applicable
- train or research queue if building
- available actions and hotkeys

### 17.3 Minimap

The minimap must display:

- terrain colors
- explored versus unexplored state
- player entities by color
- pings and alerts
- camera viewport

### 17.4 Feedback

Required feedback events:

- unit under attack
- building under attack
- population capped
- insufficient resources
- research complete
- unit created
- age advanced

## 18. AI Requirements

The AI must be able to play complete matches under the same rules as a human.

Minimum AI capabilities:

- follow opening economy priorities
- maintain villager production
- assign gatherers by resource need
- wall or defend when pressured
- age up at sensible timings
- produce counter units based on enemy composition
- expand to secondary resources
- build trade in late game on team maps
- attack, retreat, regroup, and target siege or economy deliberately

The AI should not cheat by default. Difficulty scaling may use reaction speed, planning quality, and optional resource bonuses.

## 19. Multiplayer and Determinism

### 19.1 Simulation Model

- Fixed-step deterministic simulation is required.
- Rendering should interpolate between simulation states when needed.
- Random events must use synchronized seeded RNG.

### 19.2 Networking Model

Recommended approach:

- peer lockstep or server-authoritative lockstep-equivalent
- inputs are exchanged, not full world snapshots
- desync detection must compare periodic checksums

### 19.3 Replay Support

Replays should be stored as:

- initial seed and match settings
- civilization and player metadata
- time-ordered input stream

If the simulation is deterministic, replays are effectively recorded command logs.

## 20. Data-Driven Content Format

The prose spec defines the rules. The shippable game should read content from data files.

### 20.1 `units.csv`

Required columns:

- `id`
- `name`
- `category`
- `class_tags`
- `age`
- `training_building`
- `cost_food`
- `cost_wood`
- `cost_gold`
- `cost_stone`
- `train_time`
- `hp`
- `speed`
- `los`
- `attack_base`
- `attack_type`
- `attack_bonuses`
- `armor_melee`
- `armor_pierce`
- `range_min`
- `range_max`
- `accuracy`
- `reload_time`
- `projectile_id`
- `carry_capacity`
- `garrison_capacity`
- `pop_cost`
- `upgrades_from`
- `upgrades_to`
- `required_techs`
- `civilization_restrictions`

### 20.2 `buildings.csv`

Required columns:

- `id`
- `name`
- `category`
- `age`
- `cost_food`
- `cost_wood`
- `cost_gold`
- `cost_stone`
- `build_time`
- `hp`
- `armor_melee`
- `armor_pierce`
- `los`
- `footprint`
- `drop_site_types`
- `garrison_capacity`
- `trainable_units`
- `researchable_techs`
- `required_buildings`
- `required_age`
- `population_bonus`
- `civilization_restrictions`

### 20.3 `techs.csv`

Required columns:

- `id`
- `name`
- `research_building`
- `required_age`
- `required_buildings`
- `required_techs`
- `cost_food`
- `cost_wood`
- `cost_gold`
- `cost_stone`
- `research_time`
- `effects`
- `civilization_restrictions`

### 20.4 `civilizations.csv`

Required columns:

- `id`
- `name`
- `team_bonus`
- `civilization_bonuses`
- `unique_unit_id`
- `castle_unique_tech`
- `imperial_unique_tech`
- `disabled_units`
- `disabled_techs`
- `modifiers`
- `start_unit_override`

### 20.5 `maps/*.json`

Each map definition should describe:

- biome
- size rules
- placement script
- player spawn logic
- guaranteed resources
- contested resources
- water distribution
- elevation strategy

## 21. Rules That Must Be Preserved

These are non-negotiable if the result should feel like AoE II:

- villagers are always worth protecting and always worth producing
- scouting information creates real strategic leverage
- age timings reshape available strategies
- production is building-based and parallelized by adding more buildings
- gold scarcity matters in long games
- trash units remain relevant because they cost no gold
- terrain and walls can buy time but should not fully replace army control
- castles, monks, siege, and unique units create sharp power spikes in Castle Age
- Imperial Age is defined by upgrades, siege pressure, and trade-backed economies

## 22. Explicit Non-Goals for v1

- campaign scripting
- diplomacy UI beyond practical team and ally settings
- scenario editor
- modern Definitive Edition DLC civilizations
- exact historical voice sets
- retail-perfect pathfinding quirks

## 23. Recommended Implementation Order

1. Deterministic map, units, selection, and movement.
2. Resources, villagers, drop-off, and construction.
3. Town Center, houses, basic economy, age-up.
4. Barracks, militia and spearman lines, combat.
5. Archery range and stable, counter system.
6. Fog of war, minimap, score, alerts.
7. Blacksmith, market, walls, towers.
8. Castle Age buildings, monks, siege, castles, unique units.
9. Naval layer and water maps.
10. Imperial Age upgrades, trebuchets, trade, alternate victory modes.
11. AI and multiplayer hardening.

## 24. Acceptance Checklist

The game satisfies this spec when:

- a standard `1v1 Arabia` match can be played start to finish
- all four resources are gathered correctly
- all four ages are reachable with correct unlock flow
- a civilization-specific tech tree restricts content correctly
- line upgrades replace older trainable units
- monks, siege, castles, relics, and trade work
- fog of war and scouting alter outcomes
- AI can complete a match without cheating by default
- replaying the same input log with the same seed reproduces the same result

## Appendix A: Minimum Building-to-Content Matrix

### Town Center

- trains villagers
- researches loom and core economy progression
- researches age advancement
- acts as food, wood, gold, and stone drop-off
- supports garrison and defensive fire

### Barracks

- trains militia and spear lines
- unlocks downstream military buildings
- supports eagle line for applicable civilizations

### Archery Range

- trains archer, skirmisher, cavalry archer, and hand cannoneer lines as allowed

### Stable

- trains scout, knight, and camel lines as allowed

### Blacksmith

- researches infantry, archer, cavalry, and armor upgrades

### Market

- enables resource exchange
- enables trade carts

### Monastery

- trains monks
- researches monk and relic-related technologies

### Siege Workshop

- trains ram, mangonel, scorpion, and bombard cannon lines as allowed

### University

- researches defensive, vision, and projectile-support technologies

### Castle

- trains unique unit
- researches unique technologies
- trains trebuchets in Imperial Age
- serves as a major defensive structure

### Dock

- trains fishing, transport, military, and trade ships
- acts as fish drop-off

## Appendix B: Required Engineering Behaviors

- pathfinding must handle large unit counts without deadlocking chokepoints
- order execution must survive interrupted tasks such as forced retargets, depleted resources, or destroyed buildings
- queued commands must execute in order unless impossible
- producers must support rally points
- death, decay, and cleanup must not leak state
- defeated players must correctly release map ownership and cease production
