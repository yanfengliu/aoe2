# Age of Empires II-Compatible Game Specification

## Document Status

- Purpose: define an implementation-oriented, clean-room specification for an `Age of Empires II` style RTS.
- Version target: `Age of Empires II: The Conquerors`, patch `1.0c`, used as the baseline ruleset for v1.
- Scope target: skirmish and random-map play first; campaign scripting and scenario editing are explicitly out of scope.
- Structured companion data:
  - `design/stats/units.csv`
  - `design/stats/structures.csv`
  - `design/stats/technologies.csv`
  - `design/stats/civilizations.csv`
- Success criterion: another agent should be able to build a faithful AoC-style game from this document plus the structured data tables above.

## Version Guardrails

These rules exist to keep the design pinned to the classic baseline instead of drifting into later AoE2 expansions:

- Use the original `18`-civilization roster:
  - Britons, Byzantines, Celts, Chinese, Franks, Goths, Japanese, Mongols, Persians, Saracens, Teutons, Turks, Vikings, Aztecs, Huns, Koreans, Mayans, Spanish
- Use classic AoC-era unit lines, buildings, and technologies only.
- Do not include later expansion civs, regional units, or DE-only mechanics in v1.
- Mesoamerican civilizations start with an `Eagle Warrior`, not an `Eagle Scout`.
- Classic unique-tech model:
  - every civilization has `1` unique technology researched at the `Castle` in the `Imperial Age`
  - the `Goths` are the exception and have `Anarchy` in Castle Age plus `Perfusion` in Imperial Age
- Unique-unit exceptions that must be supported:
  - `Vikings` also have `Longboat` at the `Dock`
  - `Koreans` also have `Turtle Ship` at the `Dock`
  - `Spanish` also have `Missionary` at the `Monastery`

## 1. Product Definition

The game is a real-time strategy game about building an economy, advancing through ages, unlocking a civilization-specific tech tree, and winning through army control, raids, map control, and siege pressure.

The core loop is:

1. Scout the map and secure food, wood, gold, and stone.
2. Keep villager production running while placing houses and early economic buildings.
3. Build Feudal infrastructure and choose an opening:
  - scouts
  - archers
  - men-at-arms
  - towers
  - fast Castle
4. Reach Castle Age, add Town Centers, Castles, monks, siege, and unique units.
5. Reach Imperial Age, finish military upgrades, add trebuchets and trade, and close the game.

## 2. Design Pillars

- Economy first: villager time is the core resource.
- Age timing matters: each age fundamentally expands what is possible.
- Scouting matters: fog of war must create real information asymmetry.
- Terrain matters: forests, shorelines, walls, hills, and chokepoints change outcomes.
- Counterplay matters: army composition beats raw mass when gold units trade correctly.
- Civilization identity matters: bonuses and tech-tree omissions create distinct playstyles while preserving shared core rules.
- Determinism matters: the same simulation should support single-player, replays, and multiplayer lockstep.

## 3. Match Structure

### 3.1 Players

- Supported players: `2-8`
- Controller types: human and AI
- Required per-player state:
  - civilization
  - color
  - team
  - diplomacy state
  - resources
  - researched technologies
  - explored and visible tiles
  - score
  - defeat flag

### 3.2 Standard Start

- Mode: Random Map, Standard Conquest
- Starting age: `Dark Age`
- Starting resources:
  - `200 food`
  - `200 wood`
  - `100 stone`
  - `0 gold`
- Starting entities for most civilizations:
  - `1 Town Center`
  - `3 Villagers`
  - `1 Scout Cavalry`
- Starting entities for Aztecs and Mayans:
  - `1 Town Center`
  - `3 Villagers`
  - `1 Eagle Warrior`
- Population cap default: `200`

### 3.3 Age Advancement

- `Feudal Age`
  - researched at Town Center
  - cost: `500 food`
  - prerequisite: `2` Dark Age buildings
- `Castle Age`
  - researched at Town Center
  - cost: `800 food`, `200 gold`
  - prerequisite: `2` Feudal Age buildings
- `Imperial Age`
  - researched at Town Center
  - cost: `1000 food`, `800 gold`
  - prerequisite: `2` Castle Age buildings

### 3.4 Victory Modes

Required v1 victory support:

- Conquest
- Team Conquest
- Last Man Standing
- Wonder Victory
- Regicide
- King of the Hill
- Score Victory with timer

## 4. World Model

### 4.1 Map Representation

- Terrain is tile-based.
- Unit movement is continuous on top of the tile grid.
- The simulation needs:
  - terrain type
  - elevation
  - passability
  - placed resources
  - placed entities
  - exploration and visibility per player

### 4.2 Terrain Classes

Minimum terrain classes:

- open land
- forest
- shoreline
- shallow water
- deep water
- cliff or impassable edge
- hill levels

Terrain affects:

- building placement
- unit movement
- ship movement
- line of sight and combat advantage on elevation
- random-map generation

### 4.3 Fog of War

Each player sees tiles in three states:

- unexplored
- explored but not currently visible
- visible

Rules:

- units and buildings continuously reveal nearby tiles
- enemy units disappear when not visible
- terrain and discovered buildings remain in memory

### 4.4 Neutral Resources and Animals

Required resource and neutral objects:

- sheep or turkeys
- deer
- boar
- forage bushes
- straggler trees
- forest trees
- fish
- gold mines
- stone mines
- relics
- wolves or jaguars

Rules:

- herdables convert to the first player that discovers them
- deer flee
- boar retaliate and can be lured
- fish are harvested only by fishing ships
- relics are carried by monks and generate gold in monasteries

## 5. Economy Rules

### 5.1 Resources

The game uses four stockpile resources:

- `Food`
- `Wood`
- `Gold`
- `Stone`

### 5.2 Villagers

Villagers can:

- gather all land resources
- build
- repair
- garrison
- fight weakly in melee

Rules:

- gathered resources are banked on drop-off
- walking distance matters as much as gather rate
- carry capacity, gather rate, and build rate must be data-driven

### 5.3 Drop-Off Logic

- `Food`
  - Town Center
  - Mill
  - Dock for fish
- `Wood`
  - Town Center
  - Lumber Camp
- `Gold`
  - Town Center
  - Mining Camp
- `Stone`
  - Town Center
  - Mining Camp

### 5.4 Farms

- Farms are paid for when placed.
- They are finite food sources.
- Upgrades increase farm capacity.
- Auto-reseed queueing should be supported because it is part of AoC.

### 5.5 Trade

- Trade Carts run between allied Markets.
- Trade Cogs run between allied Docks.
- Income scales with route distance.
- Traders auto-repeat their route once configured.

### 5.6 Relics

- Only monks can pick up relics.
- Relics generate passive gold only while garrisoned in a Monastery.
- Relic control is a real strategic win vector on closed maps.

## 6. Combat, Control, and Simulation Rules

### 6.1 Core Orders

Required orders:

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
- train
- research
- convert
- heal
- pack and unpack where applicable

### 6.2 Selection Model

- click-select
- drag-select
- double-click similar on-screen units
- control groups `0-9`
- shift-queued commands

### 6.3 Damage Model

The combat system must support:

- base damage
- melee and pierce armor
- bonus damage by class
- minimum damage floor
- projectile accuracy
- blast damage
- friendly fire on siege splash where appropriate

Recommended formula:

`final_damage = max(1, base_attack + sum(class_bonuses) - relevant_armor)`

### 6.4 Counter System

The classic counter web must exist:

- spears beat cavalry
- skirmishers beat archers
- cavalry beats siege and exposed ranged units
- camels counter cavalry
- monks punish expensive gold units through conversion
- siege kills buildings and packed formations
- trash units remain relevant in low-gold games

### 6.5 Garrison Rules

- Villagers can garrison in Town Centers, Towers, and Castles.
- Infantry and archers can garrison in Rams in AoC.
- Transports carry land units across water.
- Garrisoned infantry increase ram speed and damage.
- Garrisoned units can increase arrow count for some defensive buildings.

### 6.6 Elevation

- Attacking downhill is better than attacking uphill.
- Ranged hit chance and combat efficiency should reflect elevation advantage.

### 6.7 Monks

Monks must support:

- healing biological units
- converting enemy units and selected buildings
- carrying relics

Key monk tech interactions:

- `Redemption` expands valid conversion targets
- `Atonement` enables monk-vs-monk conversion
- `Faith` and civ bonuses affect conversion resistance

## 7. Concrete Building Tech Tree

This section is the practical roster definition for implementation.

### 7.1 Dark Age Buildings

#### Town Center

- Roles:
  - primary economic hub
  - resource drop-off
  - villager producer
  - age-up building
  - defensive garrison structure
- Produces:
  - `Villager`
- Researches:
  - `Loom`
  - `Town Watch`
  - `Town Patrol`
  - `Wheelbarrow`
  - `Hand Cart`
  - `Feudal Age`
  - `Castle Age`
  - `Imperial Age`
- Special rules:
  - starts the game on standard maps
  - supports `5` population
  - additional Town Centers unlock in Castle Age
  - can fire arrows when garrisoned

#### House

- Role: population support
- Cost role: cheapest mandatory early building
- Effect:
  - adds `5` population space

#### Farm

- Role: renewable food source
- Built by: Villagers
- Upgraded by:
  - `Horse Collar`
  - `Heavy Plow`
  - `Crop Rotation`

#### Mill

- Role:
  - food drop-off
  - farm placement hub
- Researches:
  - `Horse Collar`
  - `Heavy Plow`
  - `Crop Rotation`
- Notes:
  - should support farm reseed queueing

#### Lumber Camp

- Role: wood drop-off
- Researches:
  - `Double Bit Axe`
  - `Bow Saw`
  - `Two Man Saw`

#### Mining Camp

- Role: gold and stone drop-off
- Researches:
  - `Gold Mining`
  - `Gold Shaft Mining`
  - `Stone Mining`
  - `Stone Shaft Mining`

#### Dock

- Roles:
  - ship production
  - fish drop-off
  - naval trade origin
- Produces:
  - `Fishing Ship`
  - `Transport Ship`
  - `Trade Cog`
  - `Galley`
  - `Fire Ship`
  - `Demolition Ship`
  - `Cannon Galleon`
  - civilization-specific `Longboat`
  - civilization-specific `Turtle Ship`
- Researches:
  - `War Galley`
  - `Galleon`
  - `Fast Fire Ship`
  - `Heavy Demolition Ship`
  - `Elite Cannon Galleon`
  - `Elite Longboat`
  - `Elite Turtle Ship`
  - `Careening`
  - `Dry Dock`
  - `Shipwright`
- Notes:
  - naval maps are not optional; Dock content is part of the baseline game

#### Barracks

- Roles:
  - first military building
  - prerequisite for Range and Stable
- Produces:
  - `Militia`
  - `Spearman`
  - `Eagle Warrior` for Aztecs and Mayans
- Researches:
  - `Man-at-Arms`
  - `Long Swordsman`
  - `Two-Handed Swordsman`
  - `Champion`
  - `Pikeman`
  - `Halberdier`
  - `Squires`
  - `Tracking`
  - `Elite Eagle Warrior`
- Notes:
  - in classic AoC, the Mesoamerican infantry-scout line is `Eagle Warrior -> Elite Eagle Warrior`

#### Outpost

- Role: cheap vision control
- Notes:
  - no attack
  - line-of-sight utility only

### 7.2 Feudal Age Buildings

#### Archery Range

- Prerequisite: `Barracks`
- Produces:
  - `Archer`
  - `Skirmisher`
  - `Cavalry Archer`
  - `Hand Cannoneer` after `Chemistry`
- Researches:
  - `Crossbowman`
  - `Arbalest`
  - `Elite Skirmisher`
  - `Heavy Cavalry Archer`
  - `Thumb Ring`
  - `Parthian Tactics`

#### Stable

- Prerequisite: `Barracks`
- Produces:
  - `Scout Cavalry`
  - `Knight`
  - `Camel`
- Researches:
  - `Light Cavalry`
  - `Hussar`
  - `Cavalier`
  - `Paladin`
  - `Heavy Camel`
  - `Bloodlines`
  - `Husbandry`

#### Blacksmith

- Roles:
  - universal combat-upgrade hub
  - prerequisite for several Castle Age buildings
- Researches:
  - `Fletching`
  - `Bodkin Arrow`
  - `Bracer`
  - `Padded Archer Armor`
  - `Leather Archer Armor`
  - `Ring Archer Armor`
  - `Forging`
  - `Iron Casting`
  - `Blast Furnace`
  - `Scale Mail Armor`
  - `Chain Mail Armor`
  - `Plate Mail Armor`
  - `Scale Barding Armor`
  - `Chain Barding Armor`
  - `Plate Barding Armor`

#### Market

- Roles:
  - resource exchange
  - tribute techs
  - land trade
- Produces:
  - `Trade Cart`
- Researches:
  - `Cartography`
  - `Coinage`
  - `Banking`
  - `Caravan`
  - `Guilds`

#### Watch Tower and Palisade Structures

- Watch Tower line:
  - `Watch Tower`
  - `Guard Tower`
  - `Keep`
  - `Bombard Tower`
- Wall line:
  - `Palisade Wall`
  - `Palisade Gate`
  - `Stone Wall`
  - `Gate`
  - `Fortified Wall`

### 7.3 Castle Age Buildings

#### Monastery

- Produces:
  - `Monk`
  - `Missionary` for Spanish
- Researches:
  - `Atonement`
  - `Fervor`
  - `Herbal Medicine`
  - `Heresy`
  - `Redemption`
  - `Sanctity`
  - `Block Printing`
  - `Faith`
  - `Illumination`
  - `Theocracy`

#### Siege Workshop

- Produces:
  - `Battering Ram`
  - `Mangonel`
  - `Scorpion`
  - `Bombard Cannon` after `Chemistry`
- Researches:
  - `Capped Ram`
  - `Siege Ram`
  - `Onager`
  - `Siege Onager`
  - `Heavy Scorpion`
- Notes:
  - Siege Tower support can be added later, but the classic ram, mangonel, scorpion, and bombard lines are mandatory

#### University

- Researches:
  - `Ballistics`
  - `Fortified Wall`
  - `Guard Tower`
  - `Heated Shot`
  - `Masonry`
  - `Murder Holes`
  - `Treadmill Crane`
  - `Architecture`
  - `Bombard Tower`
  - `Chemistry`
  - `Keep`
  - `Siege Engineers`
- Notes:
  - `Chemistry` is a key Imperial transition tech because it unlocks gunpowder units and Bombard Cannon access

#### Castle

- Roles:
  - heavy defensive structure
  - unique-unit building
  - unique-tech building
  - trebuchet producer
- Produces:
  - each civilization's main Castle unique unit
  - `Petard`
  - `Trebuchet`
- Researches:
  - elite unique-unit upgrade
  - `Conscription`
  - `Hoardings`
  - `Sappers`
  - `Spies`
  - `Treason`
  - civilization unique technology
  - `Anarchy` and `Perfusion` for Goths
- Notes:
  - several civs also unlock a second unique unit elsewhere, but the Castle remains the civ-identity anchor

#### Additional Town Centers

- Unlock condition: Castle Age
- Purpose:
  - economy boom
  - villager scaling
  - map control anchors

### 7.4 Imperial-Only Structural Content

#### Wonder

- Role: alternate victory condition
- Used in:
  - Wonder Victory
  - Defend the Wonder style scenarios and modes

## 8. Unit Roster and Upgrade Chains

This section is the line-oriented view of the same roster.

### 8.1 Economy and Support

- `Villager`
- `Monk`
- `Missionary` for Spanish
- `Trade Cart`
- `Fishing Ship`
- `Trade Cog`
- `Transport Ship`

### 8.2 Infantry

- `Militia -> Man-at-Arms -> Long Swordsman -> Two-Handed Swordsman -> Champion`
- `Spearman -> Pikeman -> Halberdier`
- `Eagle Warrior -> Elite Eagle Warrior` for Aztecs and Mayans

### 8.3 Archer Units

- `Archer -> Crossbowman -> Arbalest`
- `Skirmisher -> Elite Skirmisher`
- `Cavalry Archer -> Heavy Cavalry Archer`
- `Hand Cannoneer`

### 8.4 Cavalry

- `Scout Cavalry -> Light Cavalry -> Hussar`
- `Knight -> Cavalier -> Paladin`
- `Camel -> Heavy Camel`

### 8.5 Siege

- `Battering Ram -> Capped Ram -> Siege Ram`
- `Mangonel -> Onager -> Siege Onager`
- `Scorpion -> Heavy Scorpion`
- `Bombard Cannon`
- `Trebuchet`
- `Petard`

### 8.6 Naval

- `Galley -> War Galley -> Galleon`
- `Fire Ship -> Fast Fire Ship`
- `Demolition Ship -> Heavy Demolition Ship`
- `Cannon Galleon -> Elite Cannon Galleon`
- `Longboat -> Elite Longboat`
- `Turtle Ship -> Elite Turtle Ship`

### 8.7 Unique Units by Civilization

- `Britons`: `Longbowman`
- `Byzantines`: `Cataphract`
- `Celts`: `Woad Raider`
- `Chinese`: `Chu Ko Nu`
- `Franks`: `Throwing Axeman`
- `Goths`: `Huskarl`
- `Japanese`: `Samurai`
- `Mongols`: `Mangudai`
- `Persians`: `War Elephant`
- `Saracens`: `Mameluke`
- `Teutons`: `Teutonic Knight`
- `Turks`: `Janissary`
- `Vikings`: `Berserk`, `Longboat`
- `Aztecs`: `Jaguar Warrior`
- `Huns`: `Tarkan`
- `Koreans`: `War Wagon`, `Turtle Ship`
- `Mayans`: `Plumed Archer`
- `Spanish`: `Conquistador`, `Missionary`

## 9. Civilization Catalogue

For implementation, use the local CSVs as the exact data layer. The prose below defines intended gameplay identity and the required signature differences between civilizations.

### 9.1 Global Civilization Rules

- All civilizations share the same base economy, age structure, and generic building set.
- Civilizations differ through:
  - bonuses
  - team bonuses
  - missing units or upgrades
  - unique units
  - unique technologies
- Aztecs and Mayans replace cavalry scouting with the Eagle Warrior line and do not use the normal Stable-based cavalry game.

### 9.2 Civilization Profiles

#### Aztecs

- Focus: infantry and monks
- Signature bonuses:
  - villagers carry more resources
  - military units create faster
  - monks scale well with Monastery techs
  - free `Loom`
- Team bonus:
  - relics generate more gold
- Unique content:
  - `Jaguar Warrior`
  - `Garland Wars`
- Identity:
  - fast tempo infantry-monk civ with very strong relic play and no normal Stable game

#### Britons

- Focus: foot archers and booming
- Signature bonuses:
  - Town Centers cost less wood from Castle Age onward
  - foot archers gain range in Castle and Imperial
  - shepherds work faster
- Team bonus:
  - Archery Ranges work faster
- Unique content:
  - `Longbowman`
  - `Yeomen`
- Identity:
  - long-range archer civilization that snowballs with safe multi-TC expansion

#### Byzantines

- Focus: defense and cheap counter units
- Signature bonuses:
  - buildings gain extra HP by age
  - spear, skirmisher, and camel lines are cheaper
  - fire ships attack faster
  - Imperial Age is cheaper
- Team bonus:
  - monks heal faster
- Unique content:
  - `Cataphract`
  - `Logistica`
- Identity:
  - defensive civ with broad tech access and unusually efficient counter-unit play

#### Celts

- Focus: infantry and siege
- Signature bonuses:
  - infantry move faster
  - lumberjacks work faster
  - siege units reload faster
- Team bonus:
  - Siege Workshops work faster
- Unique content:
  - `Woad Raider`
  - `Furor Celtica`
- Identity:
  - momentum civ that converts strong economy into oppressive midgame siege pressure

#### Chinese

- Focus: flexible archer and tech civilization
- Signature bonuses:
  - start with extra villagers but reduced starting food and wood
  - technologies become cheaper as ages advance
- Team bonus:
  - farms start with more food
- Unique content:
  - `Chu Ko Nu`
  - `Rocketry`
- Identity:
  - difficult but rewarding civ with a strong economy ceiling and one of the broadest classic tech trees

#### Franks

- Focus: cavalry and castle pressure
- Signature bonuses:
  - castles are cheaper
  - knights gain extra HP
  - farm upgrades are free
- Team bonus:
  - knights gain extra line of sight
- Unique content:
  - `Throwing Axeman`
  - `Bearded Axe`
- Identity:
  - straightforward cavalry power civ with strong map control and easy food economy

#### Goths

- Focus: infantry flood
- Signature bonuses:
  - infantry cost less starting in Feudal
  - Huskarls give a hard anti-archer answer
  - the civ is built around late-game Barracks spam
- Team bonus:
  - Barracks work faster
- Unique content:
  - `Huskarl`
  - `Anarchy`
  - `Perfusion`
- Identity:
  - weak in some tech-tree areas but terrifying once mass infantry production comes online

#### Huns

- Focus: cavalry and cavalry archers
- Signature bonuses:
  - no Houses required
  - cheaper Cavalry Archers in Castle and Imperial
  - more accurate Trebuchets
- Team bonus:
  - Stables work faster
- Unique content:
  - `Tarkan`
  - `Atheism`
- Identity:
  - fast, mobile civ with strong macro freedom because it skips house building entirely

#### Japanese

- Focus: infantry and navy
- Signature bonuses:
  - Mills, Lumber Camps, and Mining Camps are cheaper
  - infantry attack faster
  - fishing ships are tougher and work faster
- Team bonus:
  - galleys gain extra line of sight
- Unique content:
  - `Samurai`
  - `Yasama`
- Identity:
  - flexible hybrid civ with efficient eco buildings and strong anti-unique-unit infantry

#### Koreans

- Focus: towers, ranged defense, and navy
- Signature bonuses:
  - villagers have better line of sight
  - stone miners work faster
  - Guard Tower and Keep are free
  - towers gain range in later ages
- Team bonus:
  - mangonel line gains extra range
- Unique content:
  - `War Wagon`
  - `Turtle Ship`
  - `Shinkichon`
- Identity:
  - positional civ that converts map control and defensive emplacements into ranged superiority

#### Mayans

- Focus: archers and efficient economy
- Signature bonuses:
  - start with one extra villager but less food
  - natural resources last longer
  - archers get cheaper with each age
- Team bonus:
  - walls cost less
- Unique content:
  - `Plumed Archer`
  - `El Dorado`
- Identity:
  - macro-efficient archer civ with durable economy and strong mobile ranged armies

#### Mongols

- Focus: cavalry archers and mobility
- Signature bonuses:
  - hunters work much faster
  - cavalry archers reload faster
  - light cavalry and hussars gain extra HP
- Team bonus:
  - scout line gains extra line of sight
- Unique content:
  - `Mangudai`
  - `Drill`
- Identity:
  - tempo civ with explosive hunt openings and some of the best mobile gold units in the game

#### Persians

- Focus: cavalry and booming
- Signature bonuses:
  - start with extra food and wood
  - Town Centers and Docks have extra HP
  - Town Centers and Docks work faster from Feudal onward
- Team bonus:
  - knights gain bonus damage versus archers
- Unique content:
  - `War Elephant`
  - `Mahouts`
- Identity:
  - eco and cavalry civ with powerful large-unit late game and strong water-map infrastructure

#### Saracens

- Focus: camels, market abuse, and naval utility
- Signature bonuses:
  - better market exchange rate
  - stronger transport use
  - faster attacking galleys
- Team bonus:
  - foot archers gain bonus damage against buildings
- Unique content:
  - `Mameluke`
  - `Zealotry`
- Identity:
  - flexible civ that converts gold economy and camels into strong answers to cavalry-heavy armies

#### Spanish

- Focus: gunpowder, trade, and monks
- Signature bonuses:
  - villagers build faster
  - blacksmith upgrades cost no gold
  - gunpowder units reload faster
  - cannon galleons get better projectile behavior
- Team bonus:
  - trade units generate more gold
- Unique content:
  - `Conquistador`
  - `Missionary`
  - `Supremacy`
- Identity:
  - snowball civ with powerful Castle Age Conquistador timing and excellent late-game trade

#### Teutons

- Focus: infantry, towers, and durable map control
- Signature bonuses:
  - farms are cheaper
  - monks heal farther
  - towers and defensive structures are improved
  - Town Centers are stronger
- Team bonus:
  - units are more resistant to conversion
- Unique content:
  - `Teutonic Knight`
  - `Crenellations`
- Identity:
  - slow, sturdy civ built for pushing space with strong buildings and durable infantry

#### Turks

- Focus: gunpowder and cavalry
- Signature bonuses:
  - gunpowder technologies cost less
  - `Chemistry` is free
  - gold miners work faster
  - Light Cavalry and Hussar upgrades are free
- Team bonus:
  - gunpowder units are created faster
- Unique content:
  - `Janissary`
  - `Artillery`
- Identity:
  - gold-dependent civ with dangerous ranged gunpowder spikes and strong late mobility

#### Vikings

- Focus: infantry, navy, and economy
- Signature bonuses:
  - warships are cheaper
  - infantry gain HP by age
  - `Wheelbarrow` and `Hand Cart` are free
- Team bonus:
  - Docks are cheaper
- Unique content:
  - `Berserk`
  - `Longboat`
  - `Berserkergang`
- Identity:
  - strong eco civ that converts free villager upgrades into infantry and naval pressure

## 10. Data and Content Model

The prose spec defines behavior. Exact stats, costs, and availability should live in structured data.

### 10.1 Canonical Local Tables

- `design/stats/units.csv`
  - unit names
  - creation buildings
  - costs
  - attack, armor, HP, range, movement
  - upgrade relationships
- `design/stats/structures.csv`
  - building ages
  - costs
  - hit points
  - armor
  - garrison and attack notes
- `design/stats/technologies.csv`
  - technology location
  - age
  - cost
  - build time
  - effect summary
- `design/stats/civilizations.csv`
  - civilization focus
  - unique content
  - team bonus
  - civilization bonuses

### 10.2 Recommended Engine-Normalized Fields

Every unit entry should normalize to at least:

- `id`
- `name`
- `age`
- `created_in`
- `cost`
- `train_time`
- `movement_rate`
- `line_of_sight`
- `hit_points`
- `range_min`
- `range_max`
- `attack`
- `armor_melee`
- `armor_pierce`
- `attack_bonus`
- `accuracy`
- `blast_radius`
- `class_tags`
- `upgrade_from`
- `upgrade_to`
- `civilization_restrictions`

Every building entry should normalize to at least:

- `id`
- `name`
- `age`
- `cost`
- `build_time`
- `hit_points`
- `line_of_sight`
- `armor_melee`
- `armor_pierce`
- `attack`
- `range`
- `population_support`
- `garrison_capacity`
- `trainable_units`
- `researchable_techs`
- `required_age`
- `required_buildings`

Every technology entry should normalize to at least:

- `id`
- `name`
- `age`
- `develops_in`
- `cost`
- `research_time`
- `applies_to`
- `effect_description`
- `civilization_restrictions`

Every civilization entry should normalize to at least:

- `id`
- `name`
- `army_type`
- `team_bonus`
- `civilization_bonuses[]`
- `unique_units[]`
- `unique_techs[]`
- `start_unit_override`
- `disabled_units[]`
- `disabled_techs[]`
- `building_overrides[]`
- `unit_overrides[]`
- `tech_overrides[]`

### 10.3 Data Normalization Notes

- The local CSVs are useful but not perfectly normalized.
- During import, standardize:
  - spelling
  - duplicate names
  - age labels
  - multi-value separators
  - unique-unit arrays
- Ignore post-AoC civilizations for v1 even if they exist in the local CSVs.

## 11. AI Requirements

The AI must be able to play full matches under the same rules as the player.

Minimum AI behavior:

- maintain Town Center uptime
- place houses before population cap
- assign gatherers by current bottleneck
- perform age-up decisions
- open with at least one coherent Feudal plan
- expand to extra Town Centers in Castle Age when safe
- contest relics on closed maps
- build siege for buildings and walls
- switch unit composition in response to scouting
- build trade in long team games

Difficulty should preferably scale by decision quality and pacing, not by hidden cheats.

## 12. Multiplayer, Replays, and Determinism

- Fixed-step deterministic simulation is required.
- Multiplayer should exchange commands, not raw world state.
- Replay files should contain:
  - map seed
  - settings
  - player metadata
  - input log
- Desync detection should use periodic checksums.

## 13. Acceptance Checklist

The implementation satisfies this spec when:

- a standard `1v1 Arabia` game is playable start to finish
- villagers gather, drop off, and build correctly
- age advancement obeys classic costs and prerequisites
- all major production buildings train the correct generic units
- each building researches the correct classic upgrade set
- the generic unit lines upgrade correctly
- the `18` classic civilizations can be selected
- civilization bonuses, team bonuses, unique units, and unique techs differentiate play
- monks, relics, castles, siege, and trebuchets work
- Dock-based naval combat and trade work
- the same replay input produces the same result

## 14. Non-Goals for v1

- campaign scripting
- scenario editor
- later AoE2 expansion civilizations
- DE-only regional mechanics
- retail-perfect pathfinding quirks
- exact audiovisual imitation

## 15. Recommended Implementation Order

1. World grid, units, selection, and deterministic movement.
2. Resources, drop-off, villagers, farms, and construction.
3. Town Center techs, age progression, and basic economy loop.
4. Barracks, Archery Range, Stable, Blacksmith, and Feudal combat.
5. Market, walls, towers, and Dock gameplay.
6. Castle Age infrastructure:
   - Monastery
   - Siege Workshop
   - University
   - Castle
7. Unique units, unique techs, and civilization overrides.
8. Imperial upgrades, trebuchets, trade, and victory modes.
9. AI, multiplayer, and replay hardening.
