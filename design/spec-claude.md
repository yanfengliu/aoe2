# Age of Empires II — Complete Game Specification

> **Target product:** Age of Empires II: Definitive Edition
> **Scope:** Single-player only. One human player vs AI opponents (with optional AI allies). Multiplayer, campaign story mode, and replay systems are out of scope.
> **Purpose:** Implementation-ready spec. An agent should be able to build the game from this document plus the CSV data in `design/stats/`.
> **Data authority:** Concrete stats (costs, HP, damage values) live in `design/stats/*.csv`. This document defines rules, formulas, and systems. When this doc and a CSV disagree on a number, the CSV wins.

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Match Structure](#2-match-structure)
3. [World and Map Generation](#3-world-and-map-generation)
4. [Resources and Economy](#4-resources-and-economy)
5. [Age Progression](#5-age-progression)
6. [Buildings](#6-buildings)
7. [Units](#7-units)
8. [Combat System](#8-combat-system)
9. [Technology System](#9-technology-system)
10. [Civilizations](#10-civilizations)
11. [Fog of War and Line of Sight](#11-fog-of-war-and-line-of-sight)
12. [Pathfinding and Movement](#12-pathfinding-and-movement)
13. [AI Opponent Behavior](#13-ai-opponent-behavior)
14. [User Interface](#14-user-interface)
15. [Simulation Model](#15-simulation-model)
16. [Audio and Visual](#16-audio-and-visual)

---

## 1. Game Overview

Age of Empires II is a real-time strategy (RTS) game set across medieval history (~500–1600 AD). Players gather resources, build towns, research technologies, raise armies, and wage war. Each player chooses a civilization with unique bonuses, units, and technologies.

### 1.1 Core Loop

```
Gather resources → Build economy → Advance through ages →
Train military → Research technologies → Engage enemies → Win
```

### 1.2 Key Design Pillars

- **Asymmetric civilizations:** All civs share a common tech tree framework but each has disabled items, passive bonuses, unique units, and unique technologies.
- **Age progression:** Four ages (Dark → Feudal → Castle → Imperial) gate buildings, units, and technologies.
- **Rock-paper-scissors combat:** Unit types counter each other. No single composition dominates.
- **Macro and micro:** Victory requires both long-term economic planning and short-term tactical control.
- **Map variety:** Procedurally generated maps with different terrain, resource placement, and strategic constraints.

---

## 2. Match Structure

### 2.1 Game Modes

#### 2.1.1 Random Map (Standard)
- Start: Dark Age, 1 Town Center, 3 Villagers, 1 Scout Cavalry (or Eagle Scout for Meso-American civs).
- Starting resources: 200 Wood, 200 Food, 100 Gold, 200 Stone (Standard). Configurable: Medium (500W/500F/300G/400S), High (1000W/1000F/700G/800S).
- Win by conquest, wonder, or relic victory.

#### 2.1.2 Death Match
- Start: Post-Imperial Age with all technologies researched.
- Starting resources: 20,000 Wood, 20,000 Food, 10,000 Gold, 5,000 Stone (Standard).
- Map starts as fully explored (fog, not black).
- Default game speed: Fast (2.0x).

#### 2.1.3 Regicide
- Each player receives a King unit. Losing your King means defeat.
- Extra starting units: 1 Castle, extra Villagers.
- Starting resources: 500W, 500F, 0G, 150S.
- King has 75 HP, 0 attack, 1.32 movement speed, 6 LoS.

#### 2.1.4 Empire Wars
- Start: Feudal Age with 27 pre-placed Villagers assigned to tasks (5 gold, 11 wood across 3 lumber camps, 11 food on farms/berries), 1 Scout.
- Pre-built: TC, Barracks, Blacksmith, Lumber Camps, Farms, Houses. Loom pre-researched.
- Starting resources: 200W, 200F, 100G, 200S. Fewer herdables, no boars.

#### 2.1.5 King of the Hill
- Neutral Monument at map center.
- Capture by moving units near it; hold for ~550 in-game years (~9 real minutes at 1.0x speed).
- Holding generates a trickle: 50 Food, 50 Wood, 50 Gold, 50 Stone per minute.

#### 2.1.6 Wonder Race
- All players are permanent allies.
- First player to complete a Wonder wins.
- Military splash-damage units disabled.

#### 2.1.7 Capture the Relic
- Single relic at map center, each player has a pre-built indestructible Monastery.
- First monk to garrison the relic wins instantly.
- Cannot build additional Monasteries.

### 2.2 Victory Conditions

| Condition | Trigger |
|-----------|---------|
| **Conquest** | Destroy all enemy units and buildings that can produce military units. |
| **Wonder** | Build a Wonder and defend it for 200 in-game years (~16:40 at 1.0x speed). |
| **Relic** | Collect all 5 relics and hold them in Monasteries for 200 in-game years. |
| **Time Limit** | When the configurable timer expires, highest score wins. |

Victory conditions are configurable per game setup. Default: Conquest only.

### 2.3 Score Calculation

- **Military (20%):** Total resource cost of all enemy units/buildings destroyed or converted.
- **Economy (10%):** Current stockpiled resources + tributes paid + 20% cost of surviving units and standard buildings.
- **Technology (20%):** Cost of all researched technologies (excluding free/auto ones) + 10 points per 1% of map explored.
- **Society (20%):** Cost of all Castles and Wonders built.

### 2.4 Game Speed

| Setting | Multiplier | 1 in-game minute |
|---------|------------|-------------------|
| Slow | 1.0x | 60 real seconds |
| Normal | 1.5x | 40 real seconds |
| Fast | 2.0x | 30 real seconds |

All times in this spec and the CSV data use 1.0x (slow) speed unless stated otherwise.

### 2.5 Player Count and Teams

- 1 human player + 1–7 AI opponents/allies per match.
- Configurable team assignments: FFA or teams (e.g., 1v1, 1v3, 2v2 with AI allies).
- AI allies: shared vision (after Cartography), can tribute resources, cannot attack each other.
- Team bonuses apply to all members of the team (human + AI allies).

---

## 3. World and Map Generation

### 3.1 Terrain System

The map is a 2D tile grid. Each tile has:
- **Terrain type:** Grass, dirt, sand, snow, water (shallow, medium, deep), forest, rock, farm.
- **Elevation level:** Integer height. Higher ground grants combat bonuses (see §8.5).
- **Passability:** Land units cannot cross water (except shallows). Naval units cannot cross land. Siege and infantry cannot cross cliffs.

### 3.2 Map Sizes

| Size | Tiles | Recommended Players |
|------|-------|---------------------|
| Tiny | 120×120 | 2 |
| Small | 144×144 | 3 |
| Medium | 168×168 | 4 |
| Normal | 200×200 | 6 |
| Large | 220×220 | 8 |
| Giant | 240×240 | 8 |
| Ludicrous | 480×480 | 8 |

### 3.3 Standard Map Types

#### Arabia
Open land map, no significant water. Two terrain variants: grass (temperate trees, larger woodlines) or desert (palms, ponds, sparse wood). No starting walls. Per player: 8 sheep (4+2+2), 2 boar, 4 deer, 6 berry bushes, 2 gold piles (close ~7 tiles ~800g, far ~20 tiles), 2 stone piles (close, far). Strategic hills. The most balanced competitive map.

#### Arena
Closed map. Each player starts fully enclosed by Stone Walls. Large forests outside walls. Open center. Standard resource distribution inside walls. Favors booming and Castle Age timing.

#### Black Forest
Extremely closed. Nearly the entire map covered in dense forest. Players start in clearings connected by narrow choke passages. Favors late-game compositions and Onager cuts. Walling trivial.

#### Islands
Full water map. Each player/team on a separate island. Naval control critical. Must transport armies by ship. Fishing economy dominant early.

#### Nomad
No starting Town Center. Players begin with 3 Villagers only and must build their TC. Large landmass with possible central water. No guaranteed resource placement relative to starting position.

#### Coastal
Hybrid land/water. Fishing available but not required. Land connections between all players.

#### Fortress
Each player starts with stone walls, towers, and a Castle. Rich starting resources inside.

#### Gold Rush
Little starting gold. Massive gold concentration at map center. Forces early aggression for map control.

### 3.4 Resource Placement (Standard)

Per player on a standard Random Map:
- **Herdables:** 8 sheep (or turkeys on Meso maps) in groups of 4, 2, 2.
- **Huntables:** 2 boar (~340 food each), 4 deer (~140 food each).
- **Berries:** 1 bush cluster of 6 bushes (~125 food each, 750 total).
- **Gold:** 2 piles. Close pile: ~800 gold, 7 tiles from TC. Far pile: larger, ~20 tiles from TC.
- **Stone:** 2 piles. Similar close/far pattern to gold.
- **Woodlines:** 2–3 treelines within 5–15 tiles.
- **Relics:** 5 total on the map, placed in neutral territory.

### 3.5 Gaia (Neutral) Entities

| Entity | Food | Decay Rate | HP | Notes |
|--------|------|------------|-----|-------|
| Sheep / Turkey | 100 | 0.25/s | 7 | Herdable. Scoutable. Can be stolen by enemy units. |
| Boar | 340 | 0.25/s | 75 | Aggressive. Attacks villagers. 7 melee attack. |
| Deer | 140 | 0.25/s | 5 | Runs from villagers. Must be pushed or shot. |
| Wolf / Jaguar | — | — | 25 | Hostile predator. 3 attack. No food. |
| Berry Bush | 125 | — | — | Stationary. Gather rate 0.31 f/s. |
| Tree | ~150 wood | — | — | Standard tree. Stump remains when cut. |

**Resource decay:** When an animal is killed, its carcass decays. The decay rate (0.25 food/second) begins immediately. Uncollected food is lost over time. Multiple villagers should be assigned to minimize decay loss.

---

## 4. Resources and Economy

### 4.1 Resource Types

| Resource | Primary Sources | Color |
|----------|----------------|-------|
| **Food** | Farms, berries, fish, herdables, huntables | Red |
| **Wood** | Trees | Brown |
| **Gold** | Gold mines, trade, relics | Yellow |
| **Stone** | Stone mines, market purchase | Grey |

### 4.2 Gathering Rates (base, no upgrades, 1.0x speed)

| Source | Rate | Unit |
|--------|------|------|
| Shepherd (sheep) | 0.33 f/s | Villager |
| Forager (berries) | 0.31 f/s | Villager |
| Hunter (boar/deer) | 0.41 f/s | Villager |
| Farmer (farm) | ~0.32–0.34 f/s | Villager |
| Shore fish (hand) | 0.43 f/s | Villager |
| Deep sea fish | 0.49 f/s | Fishing Ship |
| Shore fish (ship) | 0.28 f/s | Fishing Ship |
| Fish trap | 0.35 f/s | Fishing Ship |
| Lumberjack | 0.39 w/s | Villager |
| Gold miner | 0.38 g/s | Villager |
| Stone miner | 0.36 s/s | Villager |

### 4.3 Villager Carry Capacity

| Resource | Base Carry | With Wheelbarrow | With Hand Cart |
|----------|-----------|------------------|----------------|
| Food (standard) | 10 | ~13 | ~15 |
| Food (hunting) | 35 | ~44 | ~53 |
| Wood | 10 | ~13 | ~15 |
| Gold | 10 | ~13 | ~15 |
| Stone | 10 | ~13 | ~15 |

- **Wheelbarrow** (Feudal, 175F/50W, 75s): +25% carry capacity, +10% movement speed.
- **Hand Cart** (Castle, 305F/200W, 55s): +50% carry capacity, +10% movement speed (stacks with Wheelbarrow).
- **Heavy Plow:** +1 food carry for farmers specifically.

### 4.4 Drop-off Buildings

Villagers must return gathered resources to a drop-off building:
- **Town Center:** Accepts all four resources.
- **Lumber Camp:** Wood only.
- **Mining Camp:** Gold and Stone.
- **Mill:** Food only (berries, hunted food, farm food).
- **Dock:** Fish (for Fishing Ships).

Minimizing walk distance between resource and drop-off is critical for efficiency.

### 4.5 Gathering Upgrades

**Wood (at Lumber Camp):**

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Double-Bit Axe | Feudal | 100F/50W | +20% gather rate |
| Bow Saw | Castle | 150F/100W | +20% (stacks) |
| Two-Man Saw | Imperial | 300F/200W | +10% (stacks) |

Cumulative wood multiplier: 1.0 → 1.2 → 1.44 → 1.584.

**Gold (at Mining Camp):**

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Gold Mining | Feudal | 100F/75W | +15% gather rate |
| Gold Shaft Mining | Castle | 200F/150W | +15% (stacks) |

**Stone (at Mining Camp):**

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Stone Mining | Feudal | 100F/75W | +15% gather rate |
| Stone Shaft Mining | Castle | 200F/150W | +15% (stacks) |

**Food / Farms (at Mill):**

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Horse Collar | Feudal | 75F/75W | Farm food +75 (250 total) |
| Heavy Plow | Castle | 125F/125W | Farm food +125 (375 total), +1 carry |
| Crop Rotation | Imperial | 250F/250W | Farm food +175 (550 total) |

### 4.6 Farm Mechanics

- **Cost:** 60 Wood. **Build time:** 15s. **HP:** 480.
- Must be placed adjacent to a Mill or Town Center.
- Base food: 175. Upgraded by Horse Collar / Heavy Plow / Crop Rotation.
- Hard-cap gather rate: 0.4 f/s (24 f/min) per farm.
- **Auto-reseed:** When enabled, depleted farms automatically replant if the player has ≥60 Wood. Up to 40 farms can be queued per Mill.
- Farms built before an upgrade completes do not retroactively gain extra food (unless still under construction when the upgrade finishes).

### 4.7 Trade

#### Trade Carts (land)
- Speed: 1.0 tiles/s. Cost: 100W/50G. Trained at Market.
- Travel between the player's Market and an AI ally's Market; bring back Gold.
- **Gold formula:** `gold = 0.46 × d × (d / mapSize + 0.3)` where `d` is distance between Markets and `mapSize` is map dimension in tiles. Gold scales roughly quadratically with distance — longer routes yield proportionally more gold.
- Minimum useful distance: ~5 tiles.

#### Trade Cogs (naval)
- Speed: 1.32 tiles/s. Cost: 100W/50G. Trained at Dock.
- Travel between the player's Dock and an AI ally's Dock. Same gold formula with a slightly lower work rate (~25% less gold per trip than equivalent land distance, offset by faster speed).

#### Caravan Tech
- Castle Age, Market, 200F/200G: +50% Trade Cart/Cog movement speed.

### 4.8 Market Buy/Sell

- The Market allows buying and selling Food, Wood, and Stone for Gold.
- **Starting exchange rates (gold per 100 units):** Wood 100, Food 115, Stone 130.
- **Commodity trading fee:** 30% base. Guilds (Imperial, 300F/200G) reduces to 15%. Saracens: 5%.
- Selling gives `base_rate × (1 − fee)` gold. Buying costs `base_rate × (1 + fee)` gold.
- Each 100-unit transaction shifts the global exchange rate by ±2 for that commodity. Buying inflates price; selling deflates. Rates are shared across all players (human and AI).

### 4.9 Tribute

- Requires a Market. Send any amount of any resource to any AI ally.
- **Fee:** 30% base. Coinage (Feudal, 150F/50G): 20%. Banking (Castle, 200F/100G, requires Coinage): 0%.

### 4.10 Relic Income

- Each relic garrisoned in a Monastery generates **0.5 gold/second** (30 gold/min).
- Standard maps have 5 relics. Each Monastery holds up to 10 relics.
- Only Monks can pick up relics. A Monk carrying a relic loses 2 LoS and cannot heal or convert.
- If the Monastery is destroyed, the relic drops and can be picked up again. Relics cannot be destroyed.

### 4.11 Population System

| Provider | Population Supported |
|----------|---------------------|
| House | 5 |
| Town Center | 5 |
| Castle | 20 |

- **Population cap:** Configurable, default 200.
- Every unit (Villager, military, Monk, trade, fishing ship, transport) costs 1 population.
- Cannot train units if population = cap. Must build more Houses/TCs/Castles first.
- **Goths bonus:** +10 population limit in Imperial Age (210 max).

---

## 5. Age Progression

### 5.1 Age Costs and Times

| Transition | Cost | Research Time | Building Prerequisite |
|-----------|------|---------------|----------------------|
| Dark → Feudal | 500 Food | 130s | 2 Dark Age buildings* |
| Feudal → Castle | 800 Food, 200 Gold | 160s | 2 Feudal Age buildings** |
| Castle → Imperial | 1000 Food, 800 Gold | 190s | 2 Castle Age buildings*** or 1 Castle |

\* Qualifying Dark Age buildings: Barracks, Dock, Lumber Camp, Mill, Mining Camp. Houses, Farms, Walls, and Outposts do not count.

\** Qualifying Feudal buildings: Archery Range, Blacksmith, Market, Stable. Walls and Towers do not count.

\*** Qualifying Castle buildings: Monastery, Siege Workshop, University, Castle.

### 5.2 What Each Age Unlocks

#### Dark Age (start)
- **Buildings:** Town Center, House, Mill, Lumber Camp, Mining Camp, Barracks, Dock, Farm, Fish Trap, Outpost, Palisade Wall.
- **Units:** Villager, Militia, Fishing Ship, Scout Cavalry (free at start).
- **Key techs:** Loom (TC), Feudal Age (TC).

#### Feudal Age
- **New buildings:** Archery Range (requires Barracks), Stable (requires Barracks), Blacksmith, Market, Stone Wall, Gate, Watch Tower.
- **New units:** Archer, Skirmisher, Spearman, Man-at-Arms (Militia upgrade), Scout Cavalry (trainable), Galley, Trade Cog, Transport Ship, Trade Cart.
- **Key techs:** Fletching, Forging, Scale armors, Double-Bit Axe, Horse Collar, Gold/Stone Mining, Wheelbarrow, Bloodlines, Town Watch, Cartography.

#### Castle Age
- **New buildings:** Castle, Monastery, Siege Workshop (requires Blacksmith), University, Fortified Wall.
- **New units:** Knight, Camel, Cavalry Archer, Long Swordsman, Pikeman, Crossbowman, Elite Skirmisher, Light Cavalry, Monk, Battering Ram, Mangonel, Scorpion, Fire Ship, Demolition Ship, War Galley, Petard, unique units (at Castle).
- **Key techs:** Bodkin Arrow, Iron Casting, Chain armors, Bow Saw, Heavy Plow, Wheelbarrow/Hand Cart, Ballistics, Murder Holes, all Monastery techs.

#### Imperial Age
- **New buildings:** Wonder, Bombard Tower (requires Chemistry).
- **New units:** Champion, Two-Handed Swordsman, Halberdier, Arbalester, Heavy Cavalry Archer, Hand Cannoneer, Cavalier, Paladin, Hussar, Heavy Camel, Elite unique units, Trebuchet (at Castle), Bombard Cannon, Onager, Siege Ram, Galleon, Fast Fire Ship, Heavy Demo Ship, Cannon Galleon, Elite unique units.
- **Key techs:** Bracer, Blast Furnace, Plate armors, Chemistry, Siege Engineers, Conscription, all Imperial unique techs.

### 5.3 Age Bonuses to Buildings

Building armor increases with each age (see `structures.csv` for per-building values). Example Town Center armor: Dark 3/5, Feudal 4/6, Castle 5/7, Imperial 6/8. Building HP also scales for certain structures.

---

## 6. Buildings

### 6.1 General Mechanics

#### Construction
- Villagers place a foundation and build over time.
- **Multi-villager formula:** If base build time is `t` and `n` villagers work, actual time = `3t / (n + 2)`.
  - 1 villager: `t`
  - 2 villagers: `0.75t`
  - 3 villagers: `0.6t`
  - 10 villagers: `0.25t`
- **Treadmill Crane** (University, Castle Age, 300F/200W): Builders work 20% faster (buildings go up ~17% faster).
- Spanish bonus: Villagers construct buildings 30% faster.

#### Repair
- Any Villager can repair buildings and siege weapons.
- Repair restores HP at a rate proportional to the building's build time and costs resources (roughly 50% of original cost to fully repair from 0 HP).

#### Destruction
- Buildings reduced to 0 HP are destroyed and removed. Resources are not refunded.
- Some buildings leave rubble graphics that fade over time.

### 6.2 Economy Buildings

| Building | Age | Cost | Build Time | HP (Dark→Imp) | Notes |
|----------|-----|------|-----------|----------------|-------|
| Town Center | Dark | 275W/100S | 150s | 2400 | Trains Villagers, researches ages, drop-off for all resources. Attack: 5 pierce, range 6. Supports 5 pop. Max 10 arrows with garrison. Cannot build additional TCs until Castle Age. |
| House | Dark | 30W | 25s | 900 | Supports 5 population. No attack. |
| Mill | Dark | 100W | 35s | 1000 | Food drop-off. Researches farm upgrades. Queues up to 40 auto-reseed farms. |
| Lumber Camp | Dark | 100W | 35s | 1000 | Wood drop-off. Researches wood-gathering upgrades. |
| Mining Camp | Dark | 100W | 35s | 1000 | Gold/Stone drop-off. Researches mining upgrades. |
| Farm | Dark | 60W | 15s | 480 | Produces food. Must be adjacent to Mill or TC. See §4.6. |
| Fish Trap | Dark | 100W | 53s | 50 | 715 food. Renewable fishing for Fishing Ships. |
| Market | Feudal | 175W | 60s | 2100 | Trains Trade Carts. Buy/sell resources. Tribute. |
| Dock | Dark | 150W | 35s | 1800 | Trains naval units. Fish drop-off. |

### 6.3 Military Buildings

| Building | Age | Cost | Build Time | HP (at age) | Trains |
|----------|-----|------|-----------|-------------|--------|
| Barracks | Dark | 175W | 50s | 1200–2100 | Militia line, Spearman line, Eagle line |
| Archery Range | Feudal | 175W | 50s | 1500–2100 | Archer line, Skirmisher line, Cavalry Archer line, Hand Cannoneer |
| Stable | Feudal | 175W | 50s | 1500–2100 | Scout line, Knight line, Camel line |
| Siege Workshop | Castle | 200W | 40s | 2100 | Ram line, Mangonel line, Scorpion line, Bombard Cannon |
| Castle | Castle | 650S | 200s | 4800 | Unique units, Trebuchet, Petard. 20 pop support. Attack: 11 pierce, range 8, max 21 arrows. |
| Monastery | Castle | 175W | 40s | 2100 | Monks. Researches Monastery techs. Garrisons relics. |

All military production buildings can garrison 10 of their created units. Garrisoned ranged units add arrows (see §8.8).

### 6.4 Defensive Buildings

| Building | Age | Cost | Build Time | HP | Armor | Attack | Range |
|----------|-----|------|-----------|-----|-------|--------|-------|
| Palisade Wall | Dark | 2W | 5s | 250 | 2/5 | — | — |
| Outpost | Dark | 25W/10S | 15s | 500 | 0/0 | — | — |
| Stone Wall | Feudal | 5S | 8s | 1800 | 8/10 | — | — |
| Gate (Stone) | Feudal | 30S | 70s | 2750 | 6/6 | — | — |
| Fortified Wall | Castle* | 5S | 8s | 3000 | 12/12 | — | — |
| Watch Tower | Feudal | 25W/125S | 80s | 1020 | 1/7 | 5 | 8 |
| Guard Tower | Castle* | 25W/125S | 80s | 1500 | 2/8 | 6 | 8 |
| Keep | Imperial* | 25W/125S | 80s | 2250 | 3/9 | 7 | 8 |
| Bombard Tower | Imperial* | 25W/125S | 80s | 2220 | 3/9 | 120 | 8 |

\* Requires University tech to upgrade.

- **Gate mechanics:** Opens automatically for friendly units. Can be locked/unlocked. While open, enemies can pass through.
- **Tower garrison:** 5 units. Garrisoned ranged units add arrows (max 5 total).
- **Bombard Tower:** Pierce attack (120 damage), range 8, reload 6.0s. Bonus: +40 vs ships/camels.

### 6.5 Special Buildings

| Building | Age | Cost | Build Time | HP | Notes |
|----------|-----|------|-----------|-----|-------|
| University | Castle | 200W | 60s | 2100 | Researches building/siege upgrades, wall/tower upgrades. |
| Blacksmith | Feudal | 150W | 40s | 2100 | Researches attack and armor upgrades for all military units. |
| Wonder | Imperial | 1000W/1000S/1000G | 3503s | 4800 | Triggers wonder victory countdown (200 in-game years). Cannot be converted. |

### 6.6 Building Prerequisites Summary

```
Dark Age:
  TC, House, Mill, Lumber Camp, Mining Camp, Barracks, Dock,
  Farm, Fish Trap, Outpost, Palisade Wall

Feudal Age (requires 2 Dark Age buildings + 500F):
  Archery Range ← requires Barracks
  Stable ← requires Barracks
  Blacksmith
  Market
  Stone Wall, Gate, Watch Tower

Castle Age (requires 2 Feudal buildings + 800F/200G):
  Castle
  Monastery
  Siege Workshop ← requires Blacksmith
  University
  Fortified Wall ← University tech
  Guard Tower ← University tech

Imperial Age (requires 2 Castle buildings or 1 Castle + 1000F/800G):
  Wonder
  Bombard Tower ← requires Chemistry (University)
  Keep ← University tech
```

---

## 7. Units

### 7.1 Unit Attributes

Every unit has the following attributes (see `units.csv` for values):

| Attribute | Description |
|-----------|-------------|
| Hit Points (HP) | Total health. Unit dies at 0. |
| Attack | Base damage dealt per hit. |
| Armor (melee/pierce) | Reduces incoming damage of each type. |
| Range | Attack range in tiles. 0 = melee. Values like "3-7" mean minimum range 3, max range 7. |
| Reload Time | Seconds between attacks. |
| Attack Delay | Seconds between attack animation start and projectile launch. |
| Movement Rate | Tiles per second. |
| Line of Sight | Radius in tiles that the unit reveals. |
| Search Radius | Maximum distance at which the unit auto-acquires targets. |
| Accuracy | Percentage chance a ranged projectile is aimed correctly. |
| Blast Radius | Area-of-effect damage radius (0 = single target). |
| Attack Bonuses | Extra damage vs specific armor classes. |
| Armor Bonuses | Extra armor in specific armor classes. |

### 7.2 Unit Categories

#### 7.2.1 Villagers
- Cost: 50 Food. Train time: 25s (at TC).
- HP: 25 (40 with Loom). Melee attack: 3. Armor: 0/0 (1/2 with Loom).
- Speed: 0.8 tiles/s.
- Gathers all resources, builds and repairs buildings/siege/ships.
- **Attack bonuses:** +3 vs buildings, +6 vs stone defense.
- Loom (Dark Age, 50G, 25s): +15 HP, +1/+2 armor.

#### 7.2.2 Infantry

| Line | Dark | Feudal | Castle | Imperial |
|------|------|--------|--------|----------|
| Militia line | Militia | Man-at-Arms | Long Swordsman | Two-Handed Swordsman → Champion |
| Spearman line | — | Spearman | Pikeman | Halberdier |
| Eagle line* | Eagle Scout | — | Eagle Warrior | Elite Eagle Warrior |

\* Meso-American civilizations only (Aztecs, Mayans, Incas). Replaces Scout Cavalry.

**Militia line role:** General-purpose melee. Strong vs buildings, trash units. Weak vs archers.
**Spearman line role:** Anti-cavalry. Massive bonus damage vs cavalry and elephants. Weak vs everything else.
**Eagle line role:** Fast infantry scout and raider. Strong vs monks and siege. Resistant to conversion.

#### 7.2.3 Archers

| Line | Feudal | Castle | Imperial |
|------|--------|--------|----------|
| Archer line | Archer | Crossbowman | Arbalester |
| Skirmisher line | Skirmisher | Elite Skirmisher | — |
| Cavalry Archer line | — | Cavalry Archer | Heavy Cavalry Archer |
| Hand Cannoneer | — | — | Hand Cannoneer |

**Archer line role:** Primary ranged DPS. Cost: 25W/45G. Strong vs infantry. Weak vs Skirmishers, cavalry, siege.
**Skirmisher line role:** Anti-archer. Cost: 25F/35W (no gold — "trash" unit). Strong vs archers. Weak vs everything else.
**Cavalry Archer role:** Mobile ranged. Cost: 40W/70G. Hit-and-run tactics. Strong vs slow units. Weak vs Skirmishers, Spearmen.
**Hand Cannoneer role:** High damage, low accuracy. Cost: 45F/50G. Strong vs infantry. Weak vs archers, cavalry.

#### 7.2.4 Cavalry

| Line | Dark | Feudal | Castle | Imperial |
|------|------|--------|--------|----------|
| Scout line | Scout Cavalry (free) | Scout Cavalry | Light Cavalry | Hussar |
| Knight line | — | — | Knight | Cavalier → Paladin |
| Camel line | — | — | Camel | Heavy Camel |

**Scout line role:** Fast scouting, raiding, monk-hunting. Cost: 80F (no gold — "trash" unit). Resistant to conversion.
**Knight line role:** Heavy cavalry. Cost: 60F/75G. Strong vs archers, siege, villagers. Weak vs Spearmen, Camels.
**Camel line role:** Anti-cavalry. Cost: 55F/60G. Not classified as cavalry for some bonus purposes. Strong vs cavalry. Weak vs infantry, archers.

#### 7.2.5 Siege

| Unit | Age | Created at | Cost | Role |
|------|-----|-----------|------|------|
| Battering Ram → Capped → Siege Ram | Castle+ | Siege Workshop | 160W/75G | Anti-building. High pierce armor. Garrisons 4 infantry. |
| Mangonel → Onager → Siege Onager | Castle+ | Siege Workshop | 160W/135G | Area damage vs massed units. Friendly fire. |
| Scorpion → Heavy Scorpion | Castle+ | Siege Workshop | 75W/75G | Line-damage bolt. Hits all units in path. |
| Bombard Cannon | Imperial | Siege Workshop | 225W/225G | Anti-building ranged. Minimum range. |
| Trebuchet | Imperial | Castle | 200W/200G | Long-range anti-building. Must pack/unpack. |
| Petard | Castle | Castle | 80F/20G | Suicide unit. Massive building damage. |

#### 7.2.6 Naval

| Unit | Age | Cost | Role |
|------|-----|------|------|
| Fishing Ship | Dark | 75W | Gathers fish. |
| Transport Ship | Feudal | 125W | Carries land units. Capacity: 5 (10 Careening, 20 Dry Dock). |
| Galley → War Galley → Galleon | Feudal+ | 90W/30G | Ranged warship. Main naval combat unit. |
| Fire Ship → Fast Fire Ship | Castle+ | 75W/45G | Anti-ship. Short range, high DPS. |
| Demolition Ship → Heavy Demo Ship | Castle+ | 70W/50G | Suicide ship. Area damage. |
| Cannon Galleon → Elite | Imperial | 200W/150G | Long-range shore bombardment. |
| Trade Cog | Feudal | 100W/50G | Gold generation via trade. |

#### 7.2.7 Monks
- Cost: 100 Gold. Train time: 51s (at Monastery).
- HP: 30 (45 with Sanctity). Speed: 0.7 tiles/s.
- **Convert:** Target an enemy unit or building to switch its ownership. See §8.9.
- **Heal:** Auto-heal nearby damaged friendly biological units at 2.5 HP/s. Cannot heal siege or ships.
- **Relic pickup:** Can carry relics to Monasteries for gold income or relic victory.

#### 7.2.8 Unique Units
Each civilization has 1–2 unique units trained at the Castle (or other buildings via unique techs). Each has a base and Elite version (upgraded at the Castle in Imperial Age). See `civilizations.csv` for the mapping and `units.csv` for stats.

### 7.3 Unit Stances

| Stance | Behavior |
|--------|----------|
| **Aggressive** | Actively chase and attack any enemy within search radius. Pursue far from starting position. |
| **Defensive** (default) | Attack enemies within LoS but return to position after combat. |
| **Stand Ground** | Do not move. Attack enemies that enter attack range only. Melee units only attack adjacent foes. |
| **No Attack** (Passive) | Ignore enemies entirely, even if attacked. Used for monks, scouts, trade units. |

### 7.4 Formations

| Formation | Description |
|-----------|-------------|
| **Line** | Horizontal spread perpendicular to movement. Maximizes ranged frontage. |
| **Staggered** | Wide gaps between units. Minimizes splash damage. |
| **Box** | Melee perimeter around ranged center. Protects support units. |
| **Flank** | Splits into two groups that surround the enemy. |
| **Split** | Divides into two laterally separated groups. Good for dodging Mangonels. |

### 7.5 Patrol

- Units walk between current position and target waypoint, auto-engaging enemies en route.
- Interaction with stances: Aggressive patrol chases far. Defensive patrol returns to path. Stand Ground patrol fires while moving. No Attack patrol ignores enemies.
- Patrol significantly improves melee engagement — patrolling melee units spread out and find attack positions better than move-commanded units.

---

## 8. Combat System

### 8.1 Damage Calculation

```
For each armor class i where the attacker has an attack value:
  class_damage_i = max(attacker_attack_i − defender_armor_i, 0)

total_damage = max(sum(all class_damage_i), 1)
```

- Every unit has attack values and armor values across multiple **damage classes** (see §8.2).
- The engine iterates all attack classes the attacker has, finds the matching armor class on the defender, subtracts armor from attack (floored at 0 per class), then sums all positive remainders.
- The grand total is floored at **1** (minimum damage rule — every attack deals at least 1 damage).
- If the defender lacks a given armor class entirely, the engine treats the bonus in that class as 0 (internally the game assigns ~1000 armor to absent classes, nullifying the bonus).

**Example:** Halberdier (6 melee attack, +32 vs Cavalry) attacking a Paladin (2 melee armor, 0 Cavalry armor):
`max(6−2, 0) + max(32−0, 0) = 4 + 32 = 36 damage`.

### 8.2 Armor Class System

There are 35+ damage classes. Each unit has a list of attack classes (bonus damage it deals) and armor classes (bonus damage it resists). Key classes:

| ID | Name | ID | Name |
|----|------|----|------|
| 1 | Infantry | 19 | Unique Unit |
| 3 | Base Pierce | 20 | Siege Weapon |
| 4 | Base Melee | 21 | Standard Building |
| 5 | War Elephant | 22 | Wall and Gate |
| 8 | Cavalry | 23 | Gunpowder Unit |
| 11 | Building | 25 | Monk |
| 13 | Stone Defense | 27 | Spearman |
| 15 | Archer | 28 | Cavalry Archer |
| 16 | Ship | 29 | Eagle Warrior |
| 17 | Ram | 30 | Camel |
| 18 | Tree | 35 | Mameluke |

- **Base Melee (4):** All melee attacks use this. All units have melee armor.
- **Base Pierce (3):** All ranged attacks use this. All units have pierce armor.
- Bonus classes are data-driven. Example: Halberdier has +32 attack in class 8 (Cavalry). A Cataphract has +16 armor in class 8, reducing the Halberdier's bonus from 32 to 16.

### 8.3 Melee vs Pierce

- Every combat unit deals exactly one primary type: **melee** or **pierce**.
- Melee units (infantry, cavalry, siege rams) deal Base Melee damage.
- Ranged units (archers, towers, ships, gunpowder) deal Base Pierce damage.
- Every unit has both a melee armor value and a pierce armor value.

### 8.4 Ranged Accuracy and Projectiles

#### Accuracy Roll
- Each ranged unit has an accuracy percentage (e.g., Archer = 80%, Trebuchet = 15%).
- On each shot, the engine rolls against this percentage. On success, the projectile is aimed to hit. On failure, the projectile is displaced randomly within a cone around the target.

#### Missed Projectiles
- Missed projectiles still physically travel and can collide with other units in their path, dealing full damage.
- At short range, misses still often hit because the target's collision hitbox is large relative to the displacement.

#### Ballistics (University, Castle Age, 300W/175G)
- **Without Ballistics:** Projectiles are aimed at the target's current position at the moment of firing. Moving targets are almost always missed.
- **With Ballistics:** The engine predicts where the target will be when the projectile arrives (based on target speed and projectile speed) and aims there. If the target changes direction, the projectile misses.
- Ballistics affects: foot archers, mounted archers, buildings (towers, TCs, Castles), ships.
- Does NOT affect: melee-ranged units (Mamelukes, Throwing Axemen), gunpowder hand units, Trebuchets, Cannon Galleons.

#### Thumb Ring (Archery Range, Castle Age, 300F/250W)
- Sets accuracy to 100% for affected archer units.
- Reduces attack delay (frame delay) for faster firing.

### 8.5 Elevation Bonus

- Attacking from higher ground: **1.25× damage multiplier**.
- Attacking from lower ground: **0.75× damage multiplier**.
- Binary — any height difference gives the same flat multiplier; no scaling with elevation difference.
- Combined effect: unit on high ground deals 25% more AND receives 25% less. Net effective advantage: ~66.7%.
- **Hills:** Give both offensive (+25%) and defensive (−25% incoming) bonuses.
- **Cliffs:** Give only the offensive bonus. Defender on a cliff takes normal (unreduced) damage from below.
- Elevation status is checked when the projectile hits, not when fired.
- Minimum damage (1) cannot be reduced by elevation.

### 8.6 Attack Speed

- Units attack at intervals defined by their **reload time** attribute (in seconds).
- Actual DPS = `attack / reload_time`.
- Some civilizations grant attack speed bonuses (e.g., Japanese infantry attack 25% faster = reload time × 0.8).

### 8.7 Blast / Splash Damage

Units with `blast_radius > 0` deal area damage:

| Unit | Blast Radius | Notes |
|------|-------------|-------|
| Mangonel | 1.0 tiles | Friendly fire. |
| Onager | 1.25 tiles | Friendly fire. Can cut trees. |
| Siege Onager | 1.5 tiles | Friendly fire. Can cut trees. |
| Bombard Cannon | 0.5 tiles | No friendly fire. |
| Demolition Ship | 2.5 tiles | Self-destructs. |
| Heavy Demo Ship | 3.5 tiles | Self-destructs. |
| Petard | 0.5 tiles | Self-destructs. |

- **Friendly fire:** Mangonel/Onager/Siege Onager and Scorpion projectiles damage the player's own and allied units within the blast radius.
- **Scorpion pass-through:** Scorpion bolts travel in a line and damage all units along their path.
- **Attack Ground:** Trebuchets and Bombard Cannons can target a tile directly. Trebuchets deal 50% damage with Attack Ground; Bombard Cannons deal full damage.

### 8.8 Garrison and Building Arrows

Buildings that fire arrows gain extra projectiles from garrisoned units:

```
extra_arrows = floor(sum(garrisoned_unit_DPS) / building_DPS)
```

Where `unit_DPS = attack / reload_time` and `building_DPS = building_attack / building_reload_time`.

| Building | Base Arrows | Max Arrows | Garrison Slots |
|----------|-------------|------------|----------------|
| Town Center | 1* | 10 | 15 |
| Castle | 1* | 21 | 20 |
| Watch/Guard/Keep | 1 | 5 | 5 |
| Bombard Tower | 1 | — | 5 |

\* TCs and Castles have inherent "virtual garrison" that provides their base arrow count when units are garrisoned.

- **Villagers** always contribute a fixed 2.5 DPS regardless of actual stats.
- **Archers, cavalry archers, gunpowder units** generate arrows based on their actual DPS.
- **Infantry and melee cavalry** do NOT contribute additional arrows (exception: Teutons with Crenellations — garrisoned infantry fire arrows as if they were villagers).
- Extra arrows use the building's attack value and benefit from building upgrades (Fletching, Bodkin, Bracer, Chemistry).

### 8.9 Conversion (Monks)

#### Timing
- Conversion ticks occur every ~1.2 game seconds.
- **Unit conversion:**
  - Ticks 1–4: Warm-up, no conversion possible (~5 seconds minimum).
  - Ticks 5–8: ~28% chance per tick to convert.
  - Tick 9: Guaranteed conversion (~11 seconds maximum).

- **Building conversion** (requires Redemption):
  - Ticks 1–14: Warm-up.
  - Ticks 15–24: ~9% chance per tick.
  - Tick 25: Guaranteed.

#### Faith Recharge
- After a successful conversion, the Monk needs **62 seconds** before converting again.
- **Illumination** (Imperial, 120G): Faith recharges 50% faster (~41 seconds).
- **Theocracy** (Imperial, 200G): In a group conversion, only one Monk needs to recharge.

#### Conversion Resistance
- Scout line and Eagle line: Inherent resistance (+3 min ticks, +1 max ticks).
- Ships and buildings: +3 resistance level.
- **Faith** tech (Imperial, 750F/1000G): All units harder to convert (+~2.5s to min, +~5s to max).
- **Heresy** (Castle, 1000G): Converted units die instead of switching sides.
- **Teutons team bonus:** Units are more resistant to conversion.

#### Other Monk Rules
- Switching targets does NOT reset accumulated conversion progress.
- Multiple Monks run independent timers — more Monks = faster expected conversion.
- **Redemption** (Castle, 475G): Allows converting siege weapons and buildings.
- **Atonement** (Castle, 325G): Allows converting enemy Monks.

### 8.10 Healing (Monks)

- Rate: **2.5 HP/second** (150 HP/min) per Monk.
- Valid targets: Own and allied biological units. Cannot heal siege, ships, or buildings.
- Auto-healing: Idle Monks automatically heal nearby damaged units. Only one Monk auto-heals a given unit; multiple require manual targeting.
- Range: 4 tiles base.
- **Byzantines:** Monks heal 100% faster (5 HP/s).
- **Garrisoned healing:** Units heal while garrisoned. Herbal Medicine: 4× healing speed.

---

## 9. Technology System

### 9.1 Overview

Technologies are researched at buildings, cost resources and time, and provide permanent upgrades. See `technologies.csv` for the full list.

Technologies form linear chains:
- Each tech may have a prerequisite tech.
- Techs are gated by Age — you cannot research a Castle Age tech in Feudal Age.
- Each civilization has access to a subset of the full tech tree (see §10).

### 9.2 Blacksmith Technologies

#### Melee Attack (Infantry + Cavalry)

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Forging | Feudal | 150F | +1 attack |
| Iron Casting | Castle | 220F/120G | +1 attack |
| Blast Furnace | Imperial | 275F/225G | +2 attack |

#### Infantry Armor

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Scale Mail Armor | Feudal | 100F | +1/+1 armor |
| Chain Mail Armor | Castle | 300F/100G | +1/+1 armor |
| Plate Mail Armor | Imperial | 300F/150G | +1/+2 armor |

#### Cavalry Armor

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Scale Barding Armor | Feudal | 150F | +1/+1 armor |
| Chain Barding Armor | Castle | 250F/150G | +1/+1 armor |
| Plate Barding Armor | Imperial | 350F/200G | +1/+2 armor |

#### Ranged Attack + Range (also affects towers, TCs, castles)

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Fletching | Feudal | 100F/50G | +1 attack, +1 range, +1 LoS |
| Bodkin Arrow | Castle | 200F/100G | +1 attack, +1 range, +1 LoS |
| Bracer | Imperial | 300F/200G | +1 attack, +1 range, +1 LoS |

#### Archer Armor

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Padded Archer Armor | Feudal | 100F | +1/+1 armor |
| Leather Archer Armor | Castle | 150F/150G | +1/+1 armor |
| Ring Archer Armor | Imperial | 250F/250G | +1/+2 armor |

### 9.3 University Technologies

**Castle Age:**

| Tech | Cost | Effect |
|------|------|--------|
| Ballistics | 300W/175G | Projectiles lead moving targets |
| Masonry | 150F/175W | Buildings +10% HP, +1/+1 armor, +3 building armor |
| Fortified Wall | 200F/100W | Stone Wall → 3000 HP, 12/12 armor |
| Guard Tower | 100F/250W | Watch Tower → 1500 HP, +1 attack |
| Heated Shot | 350F/100G | Towers 2.25× vs ships; Castles +4 vs ships |
| Murder Holes | 200F/200S | Removes minimum range from towers and castles |
| Treadmill Crane | 300F/200W | Builders work 20% faster |

**Imperial Age:**

| Tech | Cost | Effect |
|------|------|--------|
| Architecture | 300F/200W | Buildings +10% HP, +1/+1 armor, +3 building armor (stacks with Masonry) |
| Chemistry | 300F/200G | +1 pierce damage to all missile units; enables gunpowder |
| Keep | 500F/350W | Guard Tower → 2250 HP, +1 attack |
| Bombard Tower | 800F/400W | Enables Bombard Tower construction |
| Siege Engineers | 500F/600W | Siege 1.2× vs buildings, +1 range for ranged siege |

### 9.4 Monastery Technologies

**Castle Age:**

| Tech | Cost | Effect |
|------|------|--------|
| Redemption | 475G | Convert siege and buildings |
| Atonement | 325G | Convert enemy Monks |
| Sanctity | 120G | Monks +15 HP |
| Fervor | 140G | Monks +15% speed |
| Herbal Medicine | 350G | Garrisoned units heal 4× faster |
| Heresy | 1000G | Converted units die instead of switching |

**Imperial Age:**

| Tech | Cost | Effect |
|------|------|--------|
| Block Printing | 200G | Monks +3 conversion range |
| Faith | 750F/1000G | All units harder to convert |
| Illumination | 120G | Monks regain faith 50% faster |
| Theocracy | 200G | Only one Monk in a group rests after conversion |

### 9.5 Dock Technologies

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Careening | Castle | 250F/150G | Ships +0/+1 armor, transports +5 capacity |
| Dry Dock | Imperial | 600F/400G | Ships +15% speed, transports +10 capacity |
| Shipwright | Imperial | 1000F/200W | Ships −20% wood cost, −35% build time |

### 9.6 Town Center Technologies

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Loom | Dark | 50G | Villagers +15 HP, +1/+2 armor |
| Town Watch | Feudal | 75F | Buildings +4 LoS |
| Wheelbarrow | Feudal | 175F/50W | Villagers +10% speed, +25% carry |
| Town Patrol | Castle | 300F/200G | Buildings +4 LoS (stacks with Town Watch) |
| Hand Cart | Castle | 305F/200W | Villagers +10% speed, +50% carry |

### 9.7 Castle Technologies

| Tech | Age | Cost | Effect |
|------|-----|------|--------|
| Conscription | Imperial | 150F/150G | Military buildings work 33% faster |
| Hoardings | Imperial | 400F/400G | Castles +21% HP |
| Sappers | Imperial | 400F/200G | Villagers +15 attack vs buildings |
| Spies/Treason | Imperial | 200G×enemy vils / 400G | Reveals enemy LoS / King location |

Plus civilization-specific unique technologies (one Castle Age, one Imperial Age per civ). See `civilizations.csv` and `technologies.csv`.

### 9.8 Unique Technologies

Each civilization has two unique technologies researched at the Castle:
- **Castle Age unique tech:** Available upon reaching Castle Age and building a Castle.
- **Imperial Age unique tech:** Available upon reaching Imperial Age.

Examples:
| Civ | Castle Age Tech | Imperial Age Tech |
|-----|----------------|-------------------|
| Britons | — | Yeomen (foot archers +1 range, towers +2 attack) |
| Byzantines | — | Logistica (Cataphract +0.5 blast radius, +6 vs infantry) |
| Celts | — | Furor Celtica (Siege Workshop units +50% HP) |
| Franks | — | Bearded Axe (Throwing Axeman +1 range) |
| Mongols | — | Drill (Siege Workshop units +50% speed) |
| Goths | Anarchy (Huskarls in Barracks) | Perfusion (Barracks work 2× faster) |

Full list: see `technologies.csv` rows with civilization-specific `applies_to`.

---

## 10. Civilizations

### 10.1 System Design

All civilizations share the same base tech tree of ~120 technologies, ~30 building types, and ~40 generic unit lines. Each civ is defined by:

1. **Disabled items:** A list of units, techs, and upgrades the civ cannot access (e.g., no Paladin, no Arbalester, no Siege Onager).
2. **Civilization bonuses:** 3–5 passive effects that apply automatically (e.g., "Infantry cost −35% starting in Feudal Age").
3. **Team bonus:** A passive bonus shared with all AI allies on the same team (e.g., "Archery Ranges work 20% faster").
4. **Unique unit(s):** 1–2 units trained at the Castle (some at other buildings via unique tech). Each has a base and Elite version.
5. **Unique technologies:** One Castle Age tech and one Imperial Age tech.

### 10.2 Civilization Roster

The canonical data source is `design/stats/civilizations.csv`. Below is a reference summary of the civilizations included in the local data bundle (30 unique civs across 5 expansions):

#### Age of Kings (13 civs)
| Civ | Archetype | Unique Unit | Key Bonuses |
|-----|-----------|-------------|-------------|
| Britons | Foot Archer | Longbowman | Foot archers +1/+2 range; TC cost −50% wood (Castle Age); Shepherds +25% faster |
| Byzantines | Defensive | Cataphract | Buildings +10/20/30/40% HP per age; Spearman/Skirm/Camel lines −25% cost; Imperial Age −33% cost |
| Celts | Infantry | Woad Raider | Infantry +15% speed; Lumberjacks +15% faster; Siege reload +20% faster |
| Chinese | Archer | Chu Ko Nu | Start +3 villagers (−50W, −200F); Techs −10/15/20% cost per age; TC supports 10 pop |
| Franks | Cavalry | Throwing Axeman | Knights +20% HP; Castles −25% cost; Farm upgrades free |
| Goths | Infantry | Huskarl | Infantry −35% cost (Feudal+); Infantry +1 vs buildings; +10 pop cap (Imperial) |
| Japanese | Infantry | Samurai | Infantry attack +25% faster (Feudal+); Fishing Ships 2× HP; Mill/LC/MC −50% cost |
| Mongols | Cavalry Archer | Mangudai | Cavalry Archers reload +20% faster; Light Cav/Hussar +30% HP; Hunters +50% faster |
| Persians | Cavalry | War Elephant | Start +50 W/F; TC/Dock 2× HP; TC/Dock +10/15/20% faster per age |
| Saracens | Camel/Naval | Mameluke | Market fee only 5%; Transport Ships 2× HP/capacity; Galleys +20% faster |
| Spanish | Gunpowder/Monk | Conquistador, Missionary | Villagers build 30% faster; Blacksmith upgrades free gold; Hand Cannoneers/BBC reload +15% faster |
| Teutons | Infantry | Teutonic Knight | Monks 2× healing range; Murder Holes free; Farms −33% cost; TC +1 attack, +5 LoS |
| Turks | Gunpowder | Janissary | Gunpowder units +25% HP; Gunpowder techs −50% cost; Chemistry free; Gold miners +15% faster |
| Vikings | Infantry/Naval | Berserk, Longboat | Warships −20% cost; Infantry +10/15/20% HP per age; Wheelbarrow/Hand Cart free |

#### The Conquerors (5 civs)
| Civ | Archetype | Unique Unit | Key Bonuses |
|-----|-----------|-------------|-------------|
| Aztecs | Infantry/Monk | Jaguar Warrior | Military created 15% faster; +5 Monk HP per Monastery tech; Loom free |
| Huns | Cavalry | Tarkan | No Houses needed; Cavalry Archers −25/30% cost; Trebuchets +35% accuracy |
| Koreans | Tower/Naval | War Wagon, Turtle Ship | Villagers +3 LoS; Stone miners +20% faster; Tower upgrades free; Towers +1/+2 range per age |
| Mayans | Archer | Plumed Archer | Start +1 villager (−50F); Resources last +20% longer; Archers −10/20/30% cost per age |
| Spanish | (listed above) | | |

#### Forgotten Empires (5 civs)
| Civ | Archetype | Unique Unit | Key Bonuses |
|-----|-----------|-------------|-------------|
| Incas | Infantry | Kamayuk, Slinger | Free llama; Villagers affected by Blacksmith upgrades; Houses support 10 pop; Buildings −15% stone |
| Indians | Gunpowder/Cavalry | Elephant Archer, Imperial Camel | Villagers −10/15/20/25% cost per age; Fishermen +15% faster; Camels +1/+1 armor |
| Italians | Archer/Naval | Genoese Crossbowman, Condottiero | Advance ages −15% cost; Dock techs −50% cost; Gunpowder units −25% cost |
| Magyars | Cavalry/Infantry | Magyar Huszar | Forging/Iron Casting/Blast Furnace free; Scout line −15% cost |
| Slavs | Cavalry | Boyar | Farmers +15% faster; Siege −15% cheaper; Tracking free |

#### African Kingdoms (4 civs)
| Civ | Archetype | Unique Unit | Key Bonuses |
|-----|-----------|-------------|-------------|
| Berbers | Cavalry/Naval | Camel Archer, Genitour | Villagers +10% speed; Stable units −20% cost (Castle+); Ships +10% speed |
| Ethiopians | Archer | Shotel Warrior | Archers +15% speed; +100G/+100F when advancing ages; Pikeman/Halberdier upgrades free |
| Malians | Infantry | Gbeto | Buildings −15% wood; Barracks units +1 pierce armor per age; Gold mining upgrades free |
| Portuguese | Naval/Gunpowder | Caravel, Organ Gun | All units −15% gold cost; Ships +10% HP; Can build Feitoria (Imperial) |

#### Rise of the Rajas (3 civs)
| Civ | Archetype | Unique Unit | Key Bonuses |
|-----|-----------|-------------|-------------|
| Burmese | Monk/Elephant | Arambai | Free lumber camp upgrades; Infantry +1 attack per age; Monastery techs −50% cost |
| Khmer | Siege/Elephant | Ballista Elephant | No building prerequisites for ages/buildings; Battle Elephants +15% speed; Villagers can garrison in Houses |
| Vietnamese | Archer | Rattan Archer | Reveals enemy positions at game start; Archery Range units +10/15/20% HP per age |

### 10.3 Per-Civilization Tech Tree

Each civ's tech tree is a subset of the full generic tree. The engine must support:
- **Disabled unit IDs:** Certain unit upgrades unavailable (e.g., Britons cannot research Paladin).
- **Disabled tech IDs:** Certain techs unavailable (e.g., Goths lack Stone Wall and Plate Mail Armor).
- **Free techs:** Techs granted automatically at no cost when the required age is reached (e.g., Franks get free farm upgrades, Turks get free Chemistry).
- **Cost modifiers:** Percentage or flat adjustments to unit/tech costs (e.g., Mayans' archer discount).
- **Stat modifiers:** Conditional bonuses to HP, attack, armor, speed, LoS, or work rate for specific unit/building types.
- **Creation speed modifiers:** Adjustments to training time at specific buildings (e.g., Aztecs' military created 15% faster).
- **Replacement units:** Some civs replace a generic unit with a different one (e.g., Meso civs replace Scout Cavalry with Eagle Scout).

### 10.4 Full Tech Tree Mode

A game setup option that removes all civ restrictions, granting every player access to the complete tech tree. Civilization bonuses and unique content are disabled.

---

## 11. Fog of War and Line of Sight

### 11.1 Three Visibility States

| State | Visual | Information |
|-------|--------|-------------|
| **Unexplored** (black) | Completely dark | Nothing visible. |
| **Explored** (fog) | Terrain visible, dimmed | Last-known building positions shown. No unit updates. Buildings destroyed after leaving LoS still appear until re-scouted. |
| **Visible** (clear) | Full brightness | Real-time unit and building positions. |

### 11.2 Line of Sight

- Each unit and building has a **Line of Sight (LoS)** value in tiles, defining the circular radius it reveals.
- Maximum LoS cap: **20 tiles**.
- Representative values: Villager 4, Scout 4 (Dark) → 10 (Imperial, +2/age), Outpost 6 (+2/age), TC 8, most military 4–6.

### 11.3 LoS Technologies
- **Town Watch** (Feudal, 75F): Buildings +4 LoS.
- **Town Patrol** (Castle, 300F/200G): Buildings +4 LoS (stacks with Town Watch, +8 total).
- **Tracking** (Feudal, Barracks, 75F): Infantry +2 LoS.

### 11.4 Elevation and LoS
Units on higher ground see farther. Buildings and scouts have a high "inner height" value that reduces the penalty from natural elevation — they see through hills more effectively than ground units.

---

## 12. Pathfinding and Movement

### 12.1 Tile-Based Pathfinding

- The map is a tile grid. Each tile has passability flags (land, water, shallow, cliff, building, forest).
- Pathfinding uses a variant of A* with hierarchical decomposition for performance on large maps.
- Units have collision sizes. Multiple units cannot occupy the same tile — they push each other.

### 12.2 Movement Speeds

Movement rates are in tiles per second at 1.0× game speed. Representative values:
- Villager: 0.8
- Militia: 0.9 (infantry +15% for Celts = 1.035)
- Knight: 1.35
- Scout Cavalry: 1.2 (Dark), 1.55 (Feudal+)
- Cavalry Archer: 1.4
- Battering Ram: 0.5
- War Elephant: 0.6

### 12.3 Terrain Effects on Movement

- **Roads/flat terrain:** Normal speed.
- **Hills:** Units move at normal speed up and down hills.
- **Shallows:** Land units can cross at reduced speed. Naval units cannot use shallows.
- **Forest:** Impassable except to Onagers/Siege Onagers which can cut trees.
- **Water:** Impassable to land units. Naval units only.

### 12.4 Movement Modifiers

- **Squires** (Castle Age, Barracks, 200F): Infantry speed × 1.1.
- **Husbandry** (Castle Age, Stable, 250F): Cavalry speed × 1.1.
- **Wheelbarrow/Hand Cart:** Villager speed × 1.1 each (stacks).
- Civilization-specific speed bonuses (e.g., Celts infantry +15%, Mongols scouts inherent bonus).

---

## 13. AI Opponent Behavior

### 13.1 Difficulty Levels

8 difficulty levels from Easiest to Hardest (Extreme). Higher difficulties give the AI:
- Faster reaction times.
- Better economy management.
- Bonus resources (on Hardest/Extreme).
- More aggressive military timing.
- Better unit micro (dodging, targeting priority).

### 13.2 AI Decision Making

The AI follows a decision tree:
1. **Economy phase:** Build villagers, assign to resources, construct economy buildings.
2. **Military ramp:** Build military buildings once reaching target age. Train counter-units based on scouted enemy composition.
3. **Attack timing:** Launch attacks at intervals based on difficulty. Higher difficulty = earlier, more frequent attacks.
4. **Defense:** React to incoming attacks by garrisoning, walling, and producing counter-units.
5. **Tech progression:** Research upgrades in a priority order based on current unit composition.

### 13.3 AI Personality

Different AI personalities (offensive, defensive, turtle, rush) affect:
- Preferred age to attack.
- Preferred unit composition.
- Willingness to wall.
- Trading behavior.
- Monk usage.

---

## 14. User Interface

### 14.1 HUD Layout

```
┌─────────────────────────────────────────────────────┐
│ [Resource Bar: Wood | Food | Gold | Stone | Pop]    │
│                                                     │
│                                                     │
│                  GAME VIEWPORT                      │
│                  (isometric 2D)                     │
│                                                     │
│                                                     │
├─────────────────────┬───────────────────────────────┤
│    MINIMAP          │   COMMAND PANEL               │
│    (bottom-left)    │   (bottom-center/right)       │
│                     │   [Unit info | Actions |      │
│                     │    Queue | Tech tree]         │
└─────────────────────┴───────────────────────────────┘
```

### 14.2 Resource Bar (top)

Displays current stockpile for Wood, Food, Gold, Stone, and current/max Population. Updated in real-time.

### 14.3 Minimap (bottom-left)

- Shows entire map at a reduced scale.
- Terrain colors match terrain types.
- Player units shown as colored dots (player color).
- Enemy units shown only in visible areas.
- Camera viewport shown as a white rectangle.
- Click to jump camera.

### 14.4 Command Panel (bottom-center/right)

When a unit or building is selected:
- **Unit portrait:** Icon, HP bar, name.
- **Stats panel:** Attack, armor, range, speed.
- **Action buttons:** Context-dependent grid of commands:
  - Villager: Build menu (buildings), repair, garrison.
  - Military: Attack, patrol, stance, formation, garrison.
  - Building: Train queue, technology buttons, rally point, garrison/ungarrison.
- **Queue display:** Shows current training/research queue with progress bars.

### 14.5 Selection

- **Click:** Select single unit.
- **Drag box:** Select multiple units in area.
- **Double-click:** Select all units of that type on screen.
- **Ctrl+click:** Add/remove from selection.
- **Control groups (Ctrl+1–9):** Assign group. Press number to select. Double-press to center camera.
- **Select all military:** Hotkey to select all idle military units.
- **Select idle villager:** Hotkey to cycle through idle villagers.

### 14.6 Camera

- Isometric 2D view with 45° rotation.
- Scroll by moving mouse to screen edges or using arrow keys.
- Zoom in/out (DE feature).
- Rotate view (DE feature, optional).

### 14.7 Tech Tree Viewer

- Accessible from the command panel or hotkey.
- Shows the full tech tree for the current civilization.
- Available items shown in color; unavailable (civ-disabled) items shown greyed out.
- Organized by building: each building shows its trainable units and researchable techs.
- Items connected by lines showing prerequisites.

### 14.8 Alerts and Notifications

- **Attack alert:** Flashing minimap indicator + audio cue when units/buildings are attacked.
- **Research complete:** Audio + visual notification.
- **Age advance:** Full-screen visual + audio fanfare.
- **Idle villager indicator:** Counter on resource bar.

---

## 15. Simulation Model

### 15.1 Tick-Based Simulation

- The engine advances in discrete **simulation ticks**.
- Tick rate: depends on game speed. At 1.0× speed, the simulation runs at approximately 20 ticks/second (50ms per tick).
- All game logic (movement, combat, gathering, research timers) advances per tick.
- Game logic is decoupled from rendering frame rate.

### 15.2 Determinism

The simulation should be deterministic for reproducibility:
- Random number generation uses a seeded PRNG. Same seed + same inputs = same results.
- No dependency on frame rate or OS-level timing for game logic.

### 15.3 Command System

- Player inputs are timestamped and queued.
- Commands are executed at the simulation tick matching their timestamp.
- Types of commands: Move, Attack, Build, Train, Research, Garrison, Ungarrison, Patrol, Set Rally Point, Set Stance, Delete, Tribute, Market Buy/Sell, Ring Town Bell, Flare.

### 15.4 Game Setup

- Player configures: map type, map size, game mode, victory conditions, population cap, game speed, number of AI opponents/allies, AI difficulty, team assignments, civilization selections.
- Random civilization is revealed at game start.

---

## 16. Audio and Visual

### 16.1 Visual Style

- **Perspective:** Isometric 2D (tiles rendered at 45° rotation).
- **Art style:** Detailed pixel art / hand-painted sprites (DE uses high-resolution remasters).
- **Terrain rendering:** Each tile is rendered with terrain-appropriate textures. Elevation shown via layered tile heights.
- **Unit sprites:** Multi-directional (8 or 16 angles). Animation frames for idle, walk, attack, die, decay.
- **Building sprites:** Multi-state (construction animation, complete, damaged, destroyed/rubble).
- **Civilization-specific architecture:** Buildings use different art sets per civ's regional style (Western European, Middle Eastern, East Asian, Meso-American, etc.).

### 16.2 Architecture Sets

Each civilization is assigned an architecture set that determines building appearance:
- **Western European:** Britons, Celts, Franks, Spanish, Portuguese, Italians, Vikings
- **Central European:** Teutons, Goths, Slavs, Magyars
- **Middle Eastern:** Saracens, Turks, Persians, Berbers
- **East Asian:** Chinese, Japanese, Koreans, Mongols, Vietnamese
- **Southeast Asian:** Burmese, Khmer, Malians
- **Meso-American:** Aztecs, Mayans, Incas
- **South Asian:** Indians

### 16.3 Audio Design

- **Unit acknowledgements:** Each unit type has voiced responses to selection and commands (language varies by civ).
- **Combat sounds:** Weapon clashes, arrow impacts, siege fire, explosions.
- **Economy sounds:** Chopping, mining, farming, construction hammering.
- **Music:** Orchestral background tracks that shift based on game state (peaceful during economy, intense during combat).
- **Alert sounds:** Attack warning horn, research complete chime, age-up fanfare.
- **Civ-specific voice lines:** Villagers and military speak in the civilization's historical language (or an approximation).

### 16.4 Particle Effects

- Projectile trails for arrows and bolts.
- Fire effects for burning buildings, fire ships.
- Smoke for gunpowder units and bombard towers.
- Dust clouds for cavalry charges and building collapses.
- Blood/impact effects on unit hits (configurable).

---

## Appendix A: Data File Reference

All concrete values (unit stats, building costs, technology effects, civilization bonuses) are stored in CSV files under `design/stats/`:

| File | Contents |
|------|----------|
| `civilizations.csv` | Civ names, expansion, army type, unique units/techs, bonuses |
| `units.csv` | Unit names, stats (HP, attack, armor, speed, range, cost, etc.) |
| `structures.csv` | Building names, stats, costs, special properties |
| `technologies.csv` | Tech names, costs, research times, effects, prerequisites |

When implementing, parse these CSVs as the authoritative data source. This spec document defines the rules and formulas that operate on that data.

## Appendix B: Key Formulas Summary

| Formula | Expression |
|---------|------------|
| Damage | `max(Σ max(attack_i − armor_i, 0), 1)` |
| Multi-builder time | `3t / (n + 2)` |
| Garrison arrows | `floor(Σ garrisoned_DPS / building_DPS)` |
| Trade gold | `0.46 × d × (d / mapSize + 0.3)` |
| Elevation bonus | `×1.25 uphill, ×0.75 downhill` |
| Market fee | `30% base → 15% Guilds → 5% Saracens` |
| Tribute fee | `30% base → 20% Coinage → 0% Banking` |
| Relic income | `0.5 gold/sec per garrisoned relic` |
| Farm food | `175 base → 250 (HC) → 375 (HP) → 550 (CR)` |
| Wood gather multiplier | `1.0 → 1.2 → 1.44 → 1.584` |
| Conversion timing | `5–11 sec (units), 18–29 sec (buildings)` |
| Age costs | `500F → 800F/200G → 1000F/800G` |
