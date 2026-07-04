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

Implemented model (score timer): a scenario opts in by setting `gameLength` (a tick count; the map runs indefinitely on the standard conquest/wonder/relic rules when it is unset). The match resolves on score on the first simulation tick at or after `gameLength` (the system's guard is `world.tick >= gameLength`), evaluated after all other win conditions for that tick — so an earlier conquest/wonder/relic resolution takes precedence. Every player's score is compared: the sole highest scorer wins. From the human's perspective the outcome is a victory when the human is the sole top scorer, a draw when the human ties for the top score, and a defeat otherwise. Known slice-1 limitation: `gameLength` is a live-scenario field only — it is not persisted in saved games, so loading a save always resumes with the timer disabled.

### 4.4 Score Model

Use an AoE2-style score breakdown:

- Military: enemy value destroyed or converted
- Economy: resource stockpile plus value of surviving economy
- Technology: researched technology value plus exploration contribution
- Society: major structures such as Castles and Wonders

The exact UI presentation can vary, but the scoring model must remain legible and comparable to AoE2 expectations.

Implemented model (score formula): the current single-number score used by the score timer and match summary is `floor(unitsProduced × 10 + buildingsProduced × 50 + resourcesGathered × 0.02 + relicsHeld × 50 + unitsKilled × 20 + (wonderCompleted ? 500 : 0))`, evaluated per owner from that owner's cumulative counters. This is a legible proxy for the four categories above (military = kills, economy = resources gathered, society = buildings/wonder, relics as their own term); it is intentionally simpler than full AoE2 scoring and will be refined as the category surfaces mature.

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

Gather-target assignment: a villager with a gather order is routed to a matching, gatherable resource — preferring the player's own resources first, then neutral resources on the player's home base, then others — and villagers piled onto a single over-subscribed resource fan out across nearby alternatives instead of jamming. Within a preference tier, candidates are ranked by proximity to the villager's nearest DROP-OFF for that resource (the steady-state round-trip cost a shuttling villager pays repeatedly), with the villager's own distance as a tiebreak; when the player has no standing drop-off for the resource the ranking falls back to plain villager distance. This round-trip locality keeps auto-assigned villagers cycling on base-proximate resources instead of spiraling outward: a villager that goes idle deep in a far forest re-targets a tree near its lumber camp (one walk back) rather than the tree nearest its current position (a huge round-trip every load, which throttles wood income to a trickle while full trees near the base sit unused).

Unreachable-target recovery: if a villager's assigned resource cannot be reached (every cell adjacent to it is blocked — for example a resource boxed in by buildings, other resources, or terrain), the villager must re-target the nearest REACHABLE resource of the same kind rather than latching on the unreachable one. If it is carrying resources it deposits them first; if no resource of that kind is reachable at all (a genuinely fully-boxed villager) it does not gather. The reachability search is bounded — it pathfinds against at most a fixed number of the nearest candidates — so even a fully-boxed villager never triggers a per-tick pathfinding storm that scales with the map's resource count. This prevents a permanent deadlock in which a villager (or a pile of villagers) keeps re-selecting an unreachable resource every tick and never gathers — which would otherwise starve the economy and stall age progression. The preference for the player's own resources still applies first, so an unreachable owned resource (a boxed-in sheep) is skipped in favour of a reachable resource rather than re-selected forever.

Unreachable-DROP-OFF recovery (the symmetric rule for the return leg): when a villager carrying a full load goes to deposit, it must return to the nearest REACHABLE drop-off building for that resource, not merely the nearest by distance. If the nearest drop-off's approach cells are all blocked (for example a Town Center packed in by the owner's own buildings), the villager skips it and deposits at the next-nearest reachable drop-off (e.g. a Mill farther out) instead of latching in the carrying state forever. As with resource recovery, the reachability search is bounded to a fixed number of the nearest drop-off candidates; only when NO nearby drop-off is reachable does the villager wait/retry. Without this, a villager whose only nearby drop-off is boxed in would carry its load indefinitely, deposited resources would freeze, and the owner would never fund the food needed to advance an age — the exact deadlock that keeps an economy pinned in the Dark Age.

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

**Gather-rate techs (implemented).** The Lumber Camp (wood) and Mining Camp (gold/stone) "Work Rate ×N" techs apply a gather-rate multiplier to the matching resource. The multiplier is derived from the owner's researched-tech set (no separate stored state — the researched-tech record is the source of truth) and applied as a per-tick rate accumulation: each tick adds the multiplier to a gather-progress accumulator and one unit is gathered whenever it crosses the base per-cycle ticks, carrying the remainder into the next cycle. Carrying the remainder (rather than rounding each cycle to a whole-tick cadence) is required so stacked techs raise throughput faithfully at AoE2's tiny base cadences — per-cycle integer rounding would collapse the second-tier techs (Two-Man Saw, Shaft Mining) to no marginal effect. (Multiplying the per-cycle amount instead would be swallowed by the carry cap.) Net gathering throughput tracks the multiplier — filling a full carry takes about base-ticks × cycles ÷ multiplier ticks of gathering — and is then diluted by villager travel time. Factors stack multiplicatively.

| Tech | Building | Earliest age | Resource | Factor |
|---|---|---|---|---|
| Double-Bit Axe | Lumber Camp | Feudal | wood | ×1.2 |
| Bow Saw | Lumber Camp | Castle | wood | ×1.2 |
| Two-Man Saw | Lumber Camp | Imperial | wood | ×1.1 |
| Gold Mining | Mining Camp | Feudal | gold | ×1.15 |
| Gold Shaft Mining | Mining Camp | Castle | gold | ×1.15 |
| Stone Mining | Mining Camp | Feudal | stone | ×1.15 |
| Stone Shaft Mining | Mining Camp | Castle | stone | ×1.15 |

Each tech is offered once at its building from its earliest age and drops out of the research list once researched.

**Carry-capacity techs (implemented).** Wheelbarrow (Feudal, Town Center, ×1.25) and Hand Cart (Castle, Town Center, ×1.5) raise a villager's effective carry capacity — effective carry = round(base carry × multiplier), the multiplier derived from the owner's researched-tech set with factors stacking multiplicatively (×1.875 with both). Carry is resource-agnostic, so this speeds gathering of every resource including food: a larger carry means fewer drop-off trips. The AoE2 movement-speed component of both techs (×1.1 each, implemented v0.1.69) rides the movement-speed seam (§12.5): a villager whose owner researched Wheelbarrow moves at 110%, and with both it moves at 121% (the two halves stack multiplicatively, matching the carry halves), derived at the executor with no bespoke path.

**Farm-food techs (implemented).** The Mill farm-upgrade techs raise how much food a Farm holds (and auto-reseeds to). Like the gather-rate and carry-capacity techs they are DERIVED from the owner's researched-tech set (no separate stored state, no per-farm field): a farm's food capacity = base 175 plus the additive bonus of each researched farm-food tech, applied at farm CREATE (construction-complete) and farm RESEED. The bonuses STACK additively to the AoE2 capacities 250 / 375 / 550. They form a linear prereq chain at the Mill: each is offered from its earliest age, requires the previous tech, and drops out of the research list once researched.

| Tech | Building | Earliest age | Prereq | Cost | Research time | Food bonus | Cumulative capacity |
|---|---|---|---|---|---|---|---|
| Horse Collar | Mill | Feudal | — | 75 food, 75 wood | 200 ticks (20 s) | +75 | 250 |
| Heavy Plow | Mill | Castle | Horse Collar | 125 food, 125 wood | 400 ticks (40 s) | +125 | 375 |
| Crop Rotation | Mill | Imperial | Heavy Plow | 250 food, 250 wood | 700 ticks (70 s) | +175 | 550 |

Because the capacity is derived at create + reseed (not mutated on research), a farm built BEFORE a tech keeps its current stored amount until it next reseeds, at which point it refills to the then-current capacity — AoE2-faithful (an existing field grows as it is re-sown, not retroactively). A farm owned by a player without the techs holds the base 175. The values are the AoE2 capacities the spec pins (250/375/550); the Heavy Plow "Farmers carry +1 food" clause is a carry-capacity effect (not a farm-food effect) and is deferred — it belongs to the carry-tech layer alongside Wheelbarrow/Hand Cart.

### 6.6 Farm Mechanics

Farm rules:

- farms cost wood on placement
- farms deplete over time
- farm upgrades increase total stored food (implemented; the Mill Horse Collar / Heavy Plow / Crop Rotation techs raise capacity to 250 / 375 / 550 — see §6.5 "Farm-food techs")
- a depleted farm auto-reseeds while its owner can afford the wood (implemented; see "Farm reseed" below)
- Mill farm queues should support AoE2-style batch reseed behavior

**Farm slice 1 (implemented).** A Farm is a building+resource HYBRID. A villager BUILDS it through the normal placement + construction flow as a 1×1 building (cost 60 wood, available in the Dark Age with no prerequisite, 480 HP, build time 15 seconds → 150 ticks). On construction-complete the farm gains a `resource` component (`resourceType: 'farm'`, 175 food — structures.csv "Standard = 175 Food") so the existing villager economy gathers food from it: a food-role villager is routed to the farm, stands on an adjacent cell (1×1 approach footprint, exactly like a berry bush), and harvests food at a berry-bush cadence (4 ticks/unit, 1 unit/cycle ≈ spec §6.3's ~0.32–0.34 food/sec target before carry/travel). The hybrid occupies its cell as a building blocker (occupancy dispatches on the building component first, so the resource component adds gather semantics without a second occupancy claim) and selects as a building. When the stored food reaches 0 the farm either auto-reseeds (if its owner can afford the wood — see "Farm reseed" below) or, when the owner cannot pay, is removed from the map entirely — both the resource and the building shell vanish (an un-reseeded, unaffordable farm disappears in AoE2; there is no leftover shell and no refund).

**Farm reseed (implemented).** A farm is a wood→food converter that maintains itself as long as its owner can pay. When a farm's stored food reaches 0, instead of being removed it auto-reseeds IF the farm's owner currently has at least 60 wood (the farm's build cost — the same cost the build charges, read from the one cost table so the two never drift): 60 wood is deducted from the owner and the farm's stored food is reset to its max (its current capacity — base 175, raised by the Mill farm-food techs; see below). The reseed is instant — the SAME farm entity persists (stable entity id), there is no rebuild-construction delay and no HP change (the farm was never damaged), and the assigned villager(s) resume on the same farm with no stall: on the depletion tick the villager runs its ordinary drop-off-and-return cycle (it deposits its current carry, briefly goes idle, and is immediately re-assigned to the same now-full farm as its nearest owned food), so it is never stranded and never stops working — it is not, however, held continuously assigned across the depletion (it does a normal carry round-trip like any gatherer). A maintained farm therefore yields continuous food cycle after cycle, draining 60 wood from the owner each time it empties. The instant the owner can no longer afford the 60 wood at a depletion, the farm is removed exactly as the un-reseeded case. The owner who pays is the farm's owner (its `baseOwner`), not necessarily the gathering villager's player — though farms are gather-restricted to their owner, so today these coincide. Reseed refills to the farm's current capacity, DERIVED from the owner's researched farm-food techs (base 175, raised to 250/375/550 by Horse Collar / Heavy Plow / Crop Rotation — see §6.5 "Farm-food techs"), so a maintained farm grows to its upgraded cap as the owner researches the Mill techs. A modeled walk-over reseed animation/delay, the AoE2 Mill batch-reseed QUEUE, and a per-farm manual reseed toggle remain deferred.

Deferred follow-ups (NOT yet implemented): the Mill batch-reseed queue and a per-farm manual reseed toggle (the auto-reseed-if-affordable rule above IS implemented), requiring a Mill anchor near the farm, a dedicated farm sprite with tiled crop rendering, and the AI building farms (the AI's villager targets are food-keyed and already work, it just does not place farms yet). The farm-upgrade techs (Horse Collar / Heavy Plow / Crop Rotation → 250 / 375 / 550 food) are now implemented (see §6.5 "Farm-food techs").

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

- Houses, Town Centers, and Castles contribute population capacity: House +5, Town Center +5, Castle +20
- headroom accumulates from those buildings; the cap is fully building-derived, with the player's starting Town Center providing the initial 5. The cap is the honest building supply clamped to the standard 200 limit: effective cap = min(200, raw building-supplied housing). The raw supply is tracked as an honest, unclamped running sum so the clamp is recoverable — over-housing past 200 is allowed but wasteful (it adds raw supply but no extra cap); losing housing while raw supply stays at or above 200 keeps the cap at 200; only when raw supply drops below 200 does the cap follow it down. (Clamping the stored cap directly is lossy — build to 250, lose a house, and a stored-clamped cap would wrongly drop to 195 even though raw supply is still 245.)
- losing housing can leave a player over the cap (current > cap): existing units are NEVER evicted — the player is simply over cap and cannot train until current falls below the cap again (a unit dies or is lost). The HUD shows the literal current/cap (e.g. 60/55) in this state.
- military, villagers, trade units, monks, and most ships consume population
- production must fail when population cap is reached (the production queue head is blocked while current >= cap)
- a population-blocked UNIT at the head of a production queue must NOT stall a pop-NEUTRAL research (an age-up or technology) queued behind it: research consumes no population, so the first queued research behind the blocked unit keeps progressing and completes normally while the unit waits for housing. Without this, a player (or the AI) that queues a unit it cannot yet house permanently blocks its own age-up/upgrade research in the same building's queue — the exact stall that kept a resource-rich AI stuck an entire age.
- civ-specific population-cap modifiers must be supported (none wired yet); a configurable cap / "no population limit" lobby option is a planned follow-up (the cap deriver already takes the hard cap as a parameter)

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

Qualifying building logic must follow AoE2 conventions, not count every structure equally. Advancing Dark -> Feudal requires two of {Barracks, Dock, Lumber Camp, Mill, Mining Camp} — Houses, Farms, and Walls do NOT count, and the Town Center never counts. This land-only slice has no Dock, so the implemented qualifying set is {Barracks, Lumber Camp, Mill, Mining Camp} (`DARK_AGE_PREREQUISITE_BUILDINGS`). The Feudal -> Castle and Castle -> Imperial qualifying sets are likewise the non-Town-Center buildings introduced in the prior age.

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

Implemented model (buildings): right-clicking a friendly, COMPLETE, damaged building with a villager repairs it. The villager walks adjacent (like construction) and restores HP over time at the building's build rate (`maxHp / buildTimeTicks` per tick) until full. The cost is a fraction of the build cost proportional to the missing HP — `ceil(0.5 × buildCost × missingHp / maxHp)` per resource — so a full repair from ~0 costs about half the build cost. It is charged UP FRONT when the repair is issued (slice-1 simplification; AoE2 charges continuously), so each assigned villager is billed separately and an interrupted repair is not refunded. A repair the owner cannot afford is not started. Siege-unit repair, continuous (per-tick) charging, and repair-speed modifiers are deferred.

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
- built by a villager (Dark Age, 60 wood, 1×1, 480 HP, 15-second build); becomes a gatherable 175-food resource on completion; when depleted it auto-reseeds for 60 wood while its owner can afford it, otherwise it is removed (see §6.6). The Mill farm-upgrade techs (Horse Collar / Heavy Plow / Crop Rotation → 250/375/550 food) are implemented (see §6.5); the Mill batch-reseed queue is deferred.

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

- Palisade (Dark Age; no prerequisite)
- Stone Wall (Castle Age)
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

Building availability by age (implemented; one source, `getBuildOptions`, which also gates placement validation): Dark Age — House, Mill, Lumber Camp, Mining Camp, Barracks, Palisade Wall, and Farm (the Palisade Wall has no prerequisite, matching AoE2: it is the only Dark-Age wall and the early defensive option against a Dark-Age military rush; the Farm is the Dark-Age renewable food source, buildable from the start). Feudal Age (with a completed Barracks) adds Stable, Archery Range, Blacksmith, Market, and Watch Tower. Castle/Imperial Age adds Town Center, Siege Workshop, Monastery, Castle, Stone Wall (and the Wonder in Imperial). (Note: Watch Tower currently also requires a Barracks, a minor divergence from AoE2 where it needs only Feudal Age.)

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

Rally points carry AoE2 semantics: a building's rally point set ON a harvestable resource makes newly-trained villagers auto-gather that resource (they acquire the rally resource's kind and are routed to the nearest matching node), rather than merely walking to the rally cell and standing idle. A rally point on empty ground — or on a not-yet-harvestable target such as a live huntable animal, which must be killed before its meat can be gathered — is a plain move target. This is the standard anti-idle mechanism — a freshly-trained villager has no gather order of its own, so without a resource rally it stands idle until the player tasks it.

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

Garrison healing: a unit garrisoned inside a building passively regenerates HP each tick toward its maximum. Healing is a fixed, deterministic rate — 0.4 HP per tick (4 HP per second at 10 ticks per second) — applied to every garrisoned unit whose current HP is between 1 and its maximum. The heal never exceeds the unit's maximum HP (no overheal) and never revives a unit already at 0 HP. It draws no resources and requires no research (distinct from the Monastery monk-heal, which heals units on the field). A unit released from garrison keeps whatever HP it healed to. There is no random component, so the heal is fully reproducible across replays.

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

Implemented model (Slice 2b-ii): a unit BELONGS to a set of armor classes (`UNIT_ARMOR_CLASSES`), and an attacker's class bonuses (`UNIT_ATTACK_BONUSES`, transcribed from `design/stats/units.csv` `attack_bonus`) are SUMMED over every class the target is in (§10.1). Bonus VALUES are AoE2-accurate. Key rules faithful to AoE2:

- The spear line (spearman/pikeman/halberdier) hits ALL cavalry at one flat value (+15/+22/+32) — there is no light/heavy-cavalry split. Camels are a SEPARATE `camel` armor class (NOT `cavalry`), so the spear line's smaller anti-camel bonus (+7/+11/+16) applies to camels instead of the cavalry value.
- Camels counter cavalry (camel +10 / heavy-camel +18) and each other (`camel` class).
- Skirmishers are +3 vs the `archer` class and +3 vs the `spearman` class; the archer line (crossbow/arbalest +3, cavalry-archer/HCA/longbow +2) is +vs the `spearman` class.
- The mangonel line has NO anti-infantry attack bonus — its effectiveness vs massed infantry is BLAST/splash (§10.7), deferred to the projectiles/splash milestone. Mangonels keep +12 vs the `siege` class.

Deferred (documented, not yet wired): the scout line's +vs-monk bonus (and the `monk` armor class); off-roster target classes (eagle, war elephant, ship, unique-unit, stone defense, wall/gate); and the small +1-3 vs-building bonuses of non-siege units (spearman/villager/infantry).

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

Implemented model (mangonel line): a blast unit's attack lands full damage on its primary target, then deals area damage to EVERY OTHER unit (enemy AND friendly — friendly fire) within the unit's `blast_radius` (design/stats/units.csv) of the impact cell. Each splashed unit's damage is computed the same way as the primary — attack type (melee/pierce) + class bonus, reduced by that unit's own armor, floored at 1 — so a splashed spearman takes the mangonel's base pierce damage (the mangonel line has no per-target anti-infantry bonus; its power against massed infantry IS this area effect, restoring the AoE2 counter). The attacker itself is never splashed. Blast is DERIVED from the attacker's unit type at the damage site (no persisted state, no save-format change) and applies in a deterministic order (by entity id). The mangonel-line `blast_radius` is small (roughly one cell in this grid model); the wider onager area and distance-attenuated blast for non-siege attacks are refinements deferred with elevation (§10.5).

#### 10.7.1 Siege Engineers (siege-range tech)

Siege Engineers (implemented v0.1.62) is a researchable tech that gives the owner's SIEGE units +1 attack range. A "siege unit" is any unit in the `siege` armor class (§10.3) — the mangonel line, the scorpion line, the ram line, the Bombard Cannon, and the Trebuchet; non-siege units (archers, cavalry, infantry, monks, villagers) are unaffected. Cost 500 food / 600 wood, 700 ticks, Imperial Age. The +1 is applied in TWO places, mirroring the Blacksmith Fletching pattern: DERIVED at unit creation (`createCombatState` adds +1 when the owner has the tech) for new siege units, and imperatively in `applyTechnology` (a per-unit loop over the owner's existing siege units) the moment the research completes. The already-researched guard keeps it single-applied (no double stacking). No per-entity state, no save-format change. AoE2 DIVERGENCE: Siege Engineers is hosted at the Siege Workshop here, not at the University (which does not exist in this build yet) — the same divergence as the Guard Tower / Keep tower techs (§10.8); when a University is added it can move there. The tech is offered as an Imperial-Age Siege Workshop research option and drops from the list once researched.

#### 10.7.2 Sappers (infantry anti-building tech)

Sappers (implemented v0.1.64) is a researchable tech that gives the owner's INFANTRY units +15 attack against buildings. An "infantry unit" is the Militia line (Militia, Man-at-Arms, Long Swordsman, Two-Handed Swordsman, Champion) and the Spear line (Spearman, Pikeman, Halberdier) — the `infantry` armor class (§10.3); non-infantry (archers, cavalry, siege, monks, villagers) are unaffected. Cost 400 food / 200 gold, 200 ticks, Imperial Age. Unlike Siege Engineers, Sappers is applied purely DERIVED at the single unit-to-building damage site: the per-hit building damage becomes `attackDamage + siege-anti-building-bonus + sappersBonus`, where `sappersBonus` is 15 when the attacker's owner has researched Sappers AND the attacker is infantry, else 0. The building-damage site applies no armor reduction, so the +15 lands raw. There is no per-entity state and no `applyTechnology` mutation — the bonus is read fresh from the owner's researched-tech set on every hit (the buildingArrowTechEffects pattern), so it applies uniformly to existing and future infantry with no double-application risk. Before Sappers, only siege units had an anti-building bonus, so infantry razing was limited to base attack; Sappers gives infantry a meaningful demolition role. No save-format change. AoE2 DIVERGENCE: Sappers is hosted at the Blacksmith here (the combat-upgrade building, which already carries Imperial techs such as Blast Furnace and Chemistry), not at the University (which does not exist in this build yet) — the same divergence as Siege Engineers (§10.7.1). It is offered as an Imperial-Age Blacksmith research option and drops from the list once researched.

### 10.8 Garrison Arrows and Defensive Fire

Town Centers, Towers, and Castles must support:

- base attack — fired whenever the building is completed, independent of garrison. A completed but empty Town Center, Tower, or Castle still fires its base arrow (this is the building's passive defense during the economy phase; it is not gated on a garrisoned unit).
- additional garrisoned arrows where applicable (added on top of the base attack, up to the building's cap)
- technology modifiers
- civ-specific modifiers

The building-arrow system should be an explicit rules subsystem, not hard-coded special cases.

Defensive tower-upgrade techs (Guard Tower → Keep, implemented v0.1.57). The Watch Tower ladder mirrors AoE2's Watch Tower → Guard Tower → Keep progression, but SCOPED to attack + range: Guard Tower (Castle Age, no tech prereq, 100 food / 50 gold, 300 ticks) gives the owner's Watch Towers +2 attack; Keep (Imperial Age, requires Guard Tower first, 200 food / 100 gold, 400 ticks) gives +2 more attack (so 0 / +2 / +4 across none / Guard Tower / Keep) AND +1 range (base 7 → 8). AoE2 DIVERGENCE: these techs are hosted at the Watch Tower here (linear chain like the Mill farm techs), not at the University, which does not exist in this build yet; when a University is added they can move there. The bonus is DERIVED (pure) from the owner's researched-tech set at the tower's fire site (towerTechEffects, no per-building state, no save-format change) — a Watch Tower whose owner has the tech fires harder/farther with no per-entity mutation, exactly like the derived economy techs. The bonus applies ONLY to Watch Towers; Town Center and Castle defensive fire are unchanged. AoE2's per-upgrade +25% tower HP is DEFERRED (it needs building-HP mutation with no prior art in this build).

Blacksmith arrow techs boost building fire (implemented v0.1.60). In AoE2 the Blacksmith archer-attack techs improve arrow-firing BUILDINGS as well as archers. Fletching, Bodkin Arrow, and Bracer each add +1 attack and +1 range (0 / +1 / +2 / +3 across none / Fletching / +Bodkin / +Bracer) to the owner's arrow-firing buildings — Town Center, the Watch Tower line, and Castle — recomputed DERIVED from the owner's researched-tech set at the building fire site (buildingArrowTechEffects, no per-building state, no save-format change). This applies to ALL arrow buildings (unlike the Watch-Tower-only Guard Tower / Keep techs) and STACKS additively with them, so a Keep owned by a player with all three Blacksmith arrow techs fires at base + 4 (Keep) + 3 (Blacksmith) attack. Un-teched owners' buildings are unchanged.

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

**Block Printing (implemented v0.1.58).** The first Monastery monk-upgrade tech: researched at the Monastery (Castle Age, no prerequisite, 100 food / 130 gold, 550 ticks). It grants the owner's monks +2 conversion range (base monk action range 4 → 6), so a monk can begin converting an enemy unit from two tiles farther. The bonus is DERIVED (pure) from the owner's researched-tech set at the monk's action site (`monasteryTechEffects.monkConvertRangeBonus`, read in `monkBehaviorSystem`) — no per-monk state, no save-format change, and it applies to existing and future monks alike. It affects only convert tasks (heal/pickup/deposit keep the base range). Implementation note on determinism: this build models conversion as a DETERMINISTIC progress ramp (fixed progress-per-tick to a flip threshold), NOT the probabilistic window above, because the simulation must be replay-deterministic — so Block Printing is modeled as a flat integer range bonus, never a probability change. **Sanctity (implemented v0.1.59).** The second Monastery monk-upgrade tech: Castle Age, no prerequisite, 120 gold, 600 ticks. It grants every one of the owner's monks +15 max HP (a 30-HP monk becomes 45), applied FLAT to current + max exactly like Loom for villagers — imperatively bumped on research for existing monks (`sanctityEffect.applySanctityToOwnedMonks` in `technologyOps`) and via `createCombatState` for future monks. No save-format change. **Faith (implemented v0.1.61).** The third Monastery monk-upgrade tech, and a defensive one: Imperial Age, no prerequisite, 750 food / 1000 gold. A unit whose OWNER has Faith accumulates incoming enemy-monk conversion progress at HALF the normal rate (a fixed ×0.5 multiplier applied at the convert-progress site, keyed on the target's owner — `monasteryTechEffects.monkConvertProgressMultiplier`), so it takes about twice as long to convert. Faith SLOWS conversion, it does not grant immunity. Deterministic (a fixed multiplier, not a probability roll — consistent with the deterministic-ramp conversion model). No per-unit state, no save-format change. **Herbal Medicine (implemented v0.1.70).** A Monastery tech (Castle Age, no prerequisite, 350 gold, 350 ticks — `technologies.csv:65`, "Garrisoned Units 4x healing speed") that makes every GARRISONED unit belonging to the owner heal 4× as fast. It is a flat DERIVED multiplier (`monasteryTechEffects.garrisonHealRateMultiplier` = 4 with the tech, 1 without) on the passive garrison-heal rate (§9.6), read from the owner's persisted researched-tech set in `garrisonHealSystem` and keyed on each garrisoned unit's owner — so the base rate stays byte-identical without the tech, no per-unit state is added, and there is no save-format change. Unlike the monk techs above it targets garrisoned units of any type, not monks. **Heresy (implemented v0.1.71).** A Monastery tech (Castle Age, no prerequisite, 1000 gold, 600 ticks — `technologies.csv:66`, "Converted units die") that denies your units to the enemy: when an enemy monk's conversion of one of YOUR units completes, the unit DIES instead of switching sides. DERIVED at the conversion flip site (`applyMonkConvert`): the target owner's researched set — already read there for Faith — is checked via `monasteryTechEffects.convertedUnitDies`; if it has Heresy, `destroyUnitEntity(target)` runs instead of `flipConvertedUnit` (full cleanup — population, combat/monk state, conversion state, occupancy). Heresy does NOT prevent or slow conversion (that is Faith); it changes only the OUTCOME. Keyed on the target's owner, deterministic, no per-unit state, no save-format change; no fixture grants it, so all pre-Heresy conversions flip exactly as before. Other Monastery techs (Redemption, Illumination, Fervor, Atonement, Theocracy) remain deferred.

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

### 11.8 Town Center villager techs (Loom)

**Loom (implemented).** Loom is researched at the Town Center, available from the Dark Age with no prerequisite beyond a standing Town Center, costing 50 gold and taking 25 seconds (250 ticks) — the values in `technologies.csv`. It is a one-time, owner-wide, permanent buff to every villager: +15 maximum HP (villager base 25 → 40) and +1 melee / +2 pierce armor. Unlike the gather-rate and carry-capacity economy techs (whose effect is DERIVED from the researched-tech set at gather time), Loom's effect is applied IMPERATIVELY to the per-villager combat state, exactly like the Blacksmith attack/armor upgrades: existing villagers are bumped the moment research completes, and villagers trained afterward receive the buff at creation. The HP bump is FLAT on both current and max HP — a damaged villager at 10/25 becomes 25/40 (the +15 buffer is added to current HP too, matching AoE2), NOT a ratio-preserving rescale. The owner-wide application is guarded against double-application when two Town Centers race-queue the tech (the research-completion path is idempotent per owner). Loom persists across save/load through the existing researched-tech record and per-unit combat-state serialization, with no save-format change.

### 11.9 Stable cavalry techs (Bloodlines, Husbandry)

**Bloodlines (implemented v0.1.65; gate + scope conformance-fixed v0.1.67).** Bloodlines is researched at the Stable, available from the FEUDAL Age with no prerequisite beyond a standing Stable (per `technologies.csv:78` and AoE2 — v0.1.65 first shipped it Castle-gated; corrected in v0.1.67), costing 150 food / 100 gold and taking 50 seconds (500 ticks). It is a one-time, owner-wide, permanent buff to every MOUNTED unit — the Scout line (Scout, Light Cavalry, Hussar), the Knight line (Knight, Cavalier, Paladin), the Camel line (Camel, Heavy Camel), AND the mounted-archer line (Cavalry Archer, Heavy Cavalry Archer; the cavalry-only scope was the second v0.1.65 divergence corrected in v0.1.67, per the CSV applies-to "Cavalry; Cavalry Archer") — granting +20 maximum HP. Like Loom (villagers) and Sanctity (monks), the effect is applied IMPERATIVELY to the per-unit combat state: existing mounted units are bumped the moment research completes (`bloodlinesEffect.applyBloodlinesToOwnedCavalry` in `technologyOps`), and mounted units trained afterward receive the buff at creation (`createCombatState`); both paths share the single `isMountedUnit` predicate so they cannot drift. The barding ARMOR techs intentionally stay cavalry-only (mounted archers take the archer armor line, as in AoE2). The HP bump is FLAT on both current and max HP (matching AoE2), and the research-completion path is idempotent per owner (guarded against double-application). Bloodlines persists across save/load through the existing researched-tech record and per-unit combat-state serialization, with no save-format change. Unlike the tower, Siege Engineers, and Sappers techs (which are hosted away from their AoE2 University/other homes because those buildings don't exist yet), Bloodlines is hosted at the Stable exactly as in AoE2 — no divergence.

**Husbandry (implemented v0.1.66).** Husbandry is researched at the Stable, available from the Castle Age with no prerequisite beyond a standing Stable, costing 250 food and taking 50 seconds (500 ticks) — the original Age of Kings values in `technologies.csv:79` (a later DE patch rebalanced to 150 food / 40 seconds; this spec follows the CSV). It is a one-time, owner-wide, permanent +10% movement-speed multiplier for every MOUNTED unit — the Scout line, the Knight line, the Camel line, AND the mounted-archer line (Cavalry Archer, Heavy Cavalry Archer) — per the CSV applies-to "Cavalry; Cavalry Archer" (`isMountedUnit` — the same scope Bloodlines uses since its v0.1.67 conformance fix). Unlike the imperative HP techs (Loom, Sanctity, Bloodlines), the effect is fully DERIVED: the step executor recomputes the unit's speed percent from the persisted researched-tech set every tick (§12.5), so existing units accelerate from the tick research completes, and units trained, saved/loaded, or monk-converted afterward need no bespoke application path. The only persisted addition is the per-unit fractional movement carry described in §12.5 (additive optional field, no schema bump). Hosted at the Stable exactly as in AoE2 — no divergence.

**Asymmetric armor techs (implemented).** AoE2 armor techs add +1 MELEE armor each, but four add +2 PIERCE (the rest are symmetric +1/+1): the three top-tier Blacksmith armor techs — Plate Mail Armor (infantry), Plate Barding (cavalry), Ring Archer Armor (archers) — and Loom. The per-unit combat state carries two armor-tech accumulators: `armor` (the symmetric bonus, added to both melee and pierce) and `pierceArmorBonus` (the extra pierce-only bonus). A single shared helper applies each tech's bonus in BOTH the new-unit factory and the on-research existing-unit path, so the two can't drift, and effective pierce armor at the damage site = base pierce (units.csv) + `armor` + `pierceArmorBonus`, while effective melee armor = base melee + `armor`. So Loom is now +1 melee / +2 pierce, and a fully-upgraded infantry armor line reaches +3 melee / +4 pierce. Save compatibility: `pierceArmorBonus` is an additive optional field — pre-split saves have no value and load as fully symmetric (`?? 0`), so the symmetric `armor` they stored still yields the same mitigation; no save-format-version bump. The selection panel surfaces the split as two rows, **Melee armor** and **Pierce armor** (the armor-upgrade bonus, matching the melee row's value semantics), so the asymmetry is visible to the player.

### 11.10 Barracks infantry techs (Squires)

**Squires (implemented v0.1.68).** Squires is researched at the Barracks, available from the Castle Age with no prerequisite beyond a standing Barracks, costing 200 food and taking 40 seconds (400 ticks) — the values in `technologies.csv:12`. It is a one-time, owner-wide, permanent +10% movement-speed multiplier for every INFANTRY unit (the Militia line — Militia, Man-at-Arms, Long Swordsman, Two-Handed Swordsman, Champion — and the Spear line — Spearman, Pikeman, Halberdier; `isInfantryUnit`). It rides the same DERIVED movement-speed seam as Husbandry (§12.5): `movementSpeedPercent` recomputes the unit's speed percent from the persisted researched-tech set every tick, and the per-unit fractional carry delivers the +10% under the per-cell waypoint clamp. Husbandry (mounted) and Squires (infantry) target disjoint unit classes, so at most one applies to any unit and there is no stacking. No bespoke application path and no save-format change beyond the shared carry field.

### 11.11 Civilization bonuses (passive, per-civ)

Beyond the researched-tech effects above, a civilization grants passive bonuses from game start, described in `civilizations.csv` (the `civilization_bonus` column). These are applied through a DERIVED civilization-bonus layer (`civBonusEffects`) that parallels the tech-effect modules: pure functions read the owner's civilization (from the persisted `playerCivilizations` map) plus the relevant context and return a multiplier/bonus consumed at the use-site. An unknown or un-bonused civilization returns the identity (multiplier 1 / bonus 0), so every other civ stays byte-identical. There is no per-entity state and no save-format change; replay re-seeds the civilization deterministically from tick 0.

**Britons — Shepherds work 25% faster (implemented v0.1.81).** A Britons player's villagers gather from SHEEP 25% faster. This is the layer's first consumer: `civGatherRateMultiplier(civilization, resourceKind)` returns 1.25 only for `civilization === 'Britons'` and `resourceKind === 'sheep'`, and it multiplies with the tech gather-rate multiplier at the villager gather-tick site (§6.5). It is sheep-specific by design — foraging berries, farming, hunting boar, and chopping wood are unaffected — matching the AoE2 "Shepherds" wording rather than an all-food bonus. Active from the Dark Age with no prerequisite. The built-in AI benefits automatically (it uses the same gather path); no fixture or save change is required for non-Britons owners.

**Franks — Knights have +20% HP (implemented v0.1.82).** A Franks player's Knight line (Knight → Cavalier → Paladin) has +20% maximum HP, from the start of the game with no research. `civUnitHpMultiplier(civilization, unitType)` returns 1.2 only for `civilization === 'Franks'` and a knight-line unit, applied to the BASE HP at combat-state creation (`createCombatState`) BEFORE flat tech bonuses add — so a knight reads 100 → 120 (Franks) → 140 with Bloodlines, matching AoE2's order of operations. The bonus is knight-line-only: the Scout line, Camels, and Cavalry Archers (also mounted) are unaffected. Because every unit's combat state is built through this one factory, both scenario-seeded and trained knights get it; existing units need no imperative bump (a knight is created with the bonus baked in). A non-Franks civilization multiplies by 1, so all other civs are byte-identical. No save-format change.

**Goths — Infantry have +1 attack against buildings (implemented v0.1.83).** A Goths player's infantry (the Militia and Spearman lines; `isInfantryUnit`) deal +1 additional damage when attacking buildings, from the start of the game with no research. `civBuildingAttackBonus(civilization, attackerType)` returns 1 only for `civilization === 'Goths'` and an infantry attacker, added at the single unit→building damage site (`playerCommandsSystem`) alongside the Sappers tech bonus (which uses the same shape) — the two stack additively. Non-infantry Goths units (archers, cavalry, rams, villagers) get nothing, and a non-Goths civilization gets nothing. DERIVED from the persisted civilization at the damage site with no per-unit state and no save-format change. (Goths' larger identity — infantry cost −35% from the Feudal Age, +10 population in Imperial, faster Barracks — is deferred to later slices; the cost bonus needs an effective-training-cost helper across the charge and affordability sites.)

**Aztecs — Military units are created 15% faster (implemented v0.1.84).** An Aztecs player trains every MILITARY unit (all non-villager trainables — the infantry/archer/cavalry/siege lines and Monks) in 15% less time; villagers are unaffected. `civTrainTimeMultiplier(civilization, unitType)` returns 0.85 only for `civilization === 'Aztecs'` and `unitType !== 'villager'`, applied to the unit's total train ticks at the single production enqueue site (`trainingMarketOps`): `totalTicks = max(1, round(baseTicks × multiplier))`. Because both the human command path and the AI's `queue.train` intention flow through this one enqueue, both benefit consistently. The discounted tick count is stored in the already-persisted production queue, so a save/load or replay reproduces it deterministically with no save-format change. A non-Aztecs civilization multiplies by 1.

### 11.12 Production technology: Conscription

**Conscription (implemented v0.1.85).** Conscription is researched at the Castle, available from the Imperial Age, costing 150 food + 150 gold and taking 60 seconds (600 ticks). While researched, units trained at the Barracks, Archery Range, Stable, or Castle are created 25% faster (×0.75 train time); units from other buildings (Siege Workshop, Monastery, Town Center, Dock) are unaffected. Any civilization may research it. It rides the same production-enqueue train-time seam as the Aztecs creation-speed bonus (§11.11): a pure DERIVED multiplier — `conscriptionTrainTimeMultiplier(researchedSet, buildingType)` — read once at the single enqueue site (`trainingMarketOps`) and multiplied with the civ multiplier, so the two stack. Conscription has no imperative application step: the train-time is computed fresh at each enqueue from the owner's persisted researched-tech set, so no per-unit state and no save-format change. The built-in AI reaches Conscription through its generic research loop at an idle Castle.

Note: because the training-time seam applies its multipliers at the moment a unit is enqueued, a technology or civilization bonus affects only units queued after it is in effect — a unit already training keeps the tick count it was enqueued with.

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

Vision is a per-entity radius (Euclidean: a cell is revealed when dx² + dy² ≤ radius²). Line-of-sight technologies adjust that radius. The implemented set:

- **Town Watch** — Town Center research, Feudal Age, 75 food. Grants +4 line of sight to every building the owner controls.
- **Town Patrol** — Town Center research, Castle Age, 300 food + 200 gold, requires Town Watch. Grants a further +4 building line of sight (stacks with Town Watch for +8 total).
- **Tracking** — Barracks research, Feudal Age, 75 food. Grants +2 line of sight to every infantry unit the owner controls.

Each tech applies its bonus imperatively to the owner's existing entities the instant it completes (the vision radius is bumped in place and the fog re-reveals on the next tick) and is derived at creation for entities produced afterward, so a building finished or a unit trained after the research sees the same distance. The built-in AI researches Tracking from an idle Barracks when it is not saving for an age-up; the Town Center building-LoS techs are player-driven (mirroring the AI's hands-off stance on the other Town Center economy techs, which keeps its age-up timing protected).

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

Every commanded mover advances on the fine subgrid through the single step executor (`moveUnitOneSubgridStep`), which by default grants `UNIT_SUBGRID_STEP_PER_TICK = 2` fine units per tick; herdables are the explicit exception (sheep pass a slower step that bypasses the speed model). Movement paths are issued as per-CELL waypoint legs (4 fine units), and each tick's step is clamped to the remaining leg.

**Movement-speed modifiers (implemented v0.1.66).** A unit's effective speed is `base × movementSpeedPercent(owner's researched techs, unit type) / 100`, derived fresh at the executor every tick — never stored as a per-unit stat. Because a fractional multiplier cannot round into the 2-step base (`round(2 × 1.1) = 2` is a no-op) and a stateless per-tick surge schedule is absorbed by the per-cell waypoint clamp (every 4-unit leg costs 2 ticks whether granted 2+2 or 3-clamped+2), the fractional entitlement is BANKED per unit in `UnitTransformComponent.moveCarryHundredths` (hundredths of a fine unit, capped at 300): each tick the unit earns `base × percent` hundredths, moves the whole fine units the current leg allows, and banks the shortfall; when the bank crosses 100 the unit is granted an extra step. Rules:

- A speed percent of exactly 100 must leave movement byte-identical to the unmodified cadence and must not materialize the carry field.
- The carry persists with the entity across save/load (additive optional field; absent reads as 0 — no schema bump) and reproduces identically in replay.
- Research takes effect from the next tick, including for units already mid-walk; a converted unit follows its NEW owner's researched set from the next tick.
- Husbandry (§11.9): mounted units (cavalry lines + cavalry archers) move at 110%.
- Squires (§11.10): infantry (militia line + spear line) move at 110%. Husbandry and Squires target disjoint unit classes, so no unit stacks both.
- Wheelbarrow / Hand Cart (§6.5): villagers move at 110% / 121% (the two halves STACK multiplicatively, the one same-class stacking case — `movementSpeedPercent` multiplies rather than flat-returns for villagers).

Still unimplemented and expected by the full game: per-unit-TYPE base rates from the `units.csv` `movement_rate` column (Knight 1.35 vs Villager 0.8 vs Battering Ram 0.5 — today all units share the uniform base), formation drag or cohesion effects, and stance-driven chase limits.

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

**Age-up priority (implemented).** When the AI both qualifies for the next age (its building prerequisites are met) and can afford the age-up research cost, it reserves that cost so a freshly-trained unit cannot starve the age-up within a single decision cycle. Within a cycle the AI pushes building placements, then military, then (at the Town Center) the age-up research, then villager training. The constrained resource for the Dark -> Feudal stall is FOOD, which only Militia and the age-up research consume — building placements (sequenced before the age-up) spend wood/stone, and villager / building-tech production is sequenced after the age-up — so reserving the age-up's cost from MILITARY training is the targeted fix. Without it the AI massed cheap Dark-Age Militia on roughly the Feudal food cost and never advanced: each cycle a Militia's food cost, spent before the research, dropped the stockpile just under the threshold so the age-up silently failed (campaign-11). The age-up research may also be pushed onto a FULL Town-Center villager queue (landing at queue depth 3, one past the AI's normal 2-deep cap): a rich AI keeps its TC queue continuously full of villagers, so gating the age-up on a free slot starved it forever — the AI sat a whole age with several times the age-up cost banked. Together with the queue rule that a population-blocked unit does not stall a research behind it (§6.10), this guarantees an eligible, affordable age-up always enqueues and always completes.

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

**HUD chrome (2026-06-16).** The major HUD container panels — the top resource bar, the command/selection panel, and the minimap frame — present as framed wood-and-stone surfaces (a wood-plank grain on the resource bar / command panel / footer, a chiselled-stone fleck on the minimap frame), each with a beveled raised edge (light top-left highlight, dark bottom-right shade) and a soft inner recess, so the panels read as physical carved frames rather than flat rectangles, and the minimap canvas sits sunken inside its stone frame. This look is achieved entirely with ORIGINAL/procedural CSS (layered gradients + box-shadows) over the existing warm gold-on-dark-teal palette — no image assets, no external fonts, and no copyrighted Age of Empires UI art; the palette and panel layout are unchanged.

**Resource + build icons (2026-06-16).** Each top-bar resource chip carries a small recognizable glyph before its label (a wheat sheaf for food, a stack of logs for wood, a coin for gold, a faceted rock for stone; and, since they share the bar, a banner for age, a house for population, a clock for time), and each "Build X" command button carries a glyph matching the building (house, windmill, felling axe, pickaxe, crossed swords over a shield, tower, anvil, market stall, catapult, cross-topped chapel, battlemented keep, domed monument, stone-wall segment, sharpened palisade stakes, tilled field, plus Town Center / Stable / Archery Range — an exhaustive per-building table covers every buildable type). The icons AUGMENT the text labels — the labels are kept (the resource value text and the "Build X" button text are unchanged) — so the icons speed scanning without removing the textual meaning. Every glyph is ORIGINAL artwork drawn as a small hand-authored inline SVG using the existing warm gold palette via `currentColor`; no image assets, no icon font, and no copyrighted Age of Empires icon art. This is the resource+build slice of the UI-icon work; the unit-roster / selection-grid icons (currently short text badges) and the non-build command-card icons are a later slice. Glyph icons must never be the sole carrier of a value or command label — a textual label always accompanies them (accessibility + clarity), and decorative glyphs are hidden from assistive technology.

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

The north star is the look and polish of an Age of Empires II HD clone, reached entirely through ORIGINAL/procedural art that evokes that look — no copyrighted Age of Empires assets (sprites, textures, UI art, audio) are reproduced. Presentation targets:

- isometric RTS readability
- clear faction-color ownership
- directional unit animation
- construction, damage, and rubble states for buildings
- readable per-type building silhouettes rather than one generic shape for every building: each COMPLETED building renders as an original procedural shape grouped by RENDER ROLE — town-center (a wide hall with a gabled roof and flanking corner posts), fortress/castle (a crenellated keep with battlement merlons, no roof), wonder (a domed monument with a spire), house (a small home with a pitched roof and door), mill (a windmill with a four-blade cross), farm (a tilled field of furrow rows, no roof), drop-site/lumber-camp+mining-camp (an open camp with a lean-to roof and a stockpile mound), military/barracks+stable+archery-range+siege-workshop (a hall with a flat roof band and a banner flag), blacksmith (a forge with a chimney and an anvil), market (an open stall with a striped awning), monastery (a chapel with a cross finial), tower/watch-tower (a tall narrow tower with a battlement cap), and wall/stone-wall+palisade-wall (a low battlement segment) — so a glance distinguishes the role, while the owner-color tint is kept as the body fill. Every primitive stays within the building's footprint rect so the existing selection-ring, footprint-outline, and health-bar geometry is unchanged. The construction (scaffold) and last-seen-ghost looks are role-agnostic and unchanged; only the completed look varies by role. Shipped v0.1.42 (the prior look was one generic body+roof for every building type). A per-building (vs per-role) silhouette, a construction→complete progress animation/fill, rubble/damage states, and per-civilization architecture are deferred to later M7 slices.
- architecture-set variation by civilization region
- textured terrain surfaces rather than flat per-kind color fills: terrain cells carry subtle, deterministic per-cell brightness variation (a hue-preserving ±7% jitter; shipped v0.1.30) so same-kind cells do not read as one flat block, AND adjacent cells of DIFFERENT kinds blend at their shared edge instead of meeting at a hard rectangular seam — for each cell edge whose von-Neumann neighbour is a different kind, the renderer stipples a deterministic feather band of small specks on the inner side of the edge, tinted with the per-channel average (blend) of the two kinds' base colors; the neighbour cell feathers back symmetrically so the two bands interlock into a soft, dithered transition (a grass/water shore feathers green into blue, a grass/hill edge green into tan). Shipped v0.1.43. The transition is a pure function of the cell kind, its neighbour kinds, and the cell coordinates (deterministic — no per-frame random or time, so the ground never shimmers), every speck stays strictly inside its own cell square (so unit/building/health-bar/selection geometry is unaffected), and the blend renders under all entity/fog/selection/grid overlays. Elevation-based light/shadow is deferred (the render data does not currently project per-cell elevation; shading by height would require a render-contract change); diagonal (corner) blends and bespoke per-pair transition textures (e.g. a dedicated beach gradient for grass↔water) are also deferred to later M7 slices.
- readable per-type unit silhouettes rather than flat tinted circles: each unit renders as an original procedural shape grouped by RENDER ROLE — villager, infantry (foot melee), archer (foot ranged), cavalry (mounted), cavalry-archer (mounted ranged), siege (machine), monk — so a glance distinguishes the role, while the owner-color tint is kept as the body fill. The shape orients toward the unit's movement FACING (derived render-side from the per-tick projected-position delta; idle units use a consistent resting orientation — no fabricated heading), and every shape stays within the unit's cell-centred bounding circle so the existing health-bar and selection-ring geometry is unchanged. Shipped v0.1.41 (the prior look was one tinted circle per unit). A per-unit (vs per-role) silhouette and a walk/idle ANIMATION cycle are deferred to later M7 slices.
- HUD icons authored as ORIGINAL procedural inline SVG (no copyrighted icons, sprites, image files, or icon fonts; every glyph is self-contained hand-drawn `<path>`/`<rect>`/`<circle>` markup stroked with `currentColor` so the existing gold-on-dark-teal palette controls the tone). Coverage shipped so far: the top-bar resource chips (wheat sheaf / logs / coin / rock + population / age / time) and the "Build X" command buttons (one glyph per buildable building type), shipped v0.1.39; and the SELECTION-panel badge, shipped v0.1.44 — when a unit or building is selected, the bare two-letter text code ("V" Villager, "TC" Town Center, "H" House, "CB" Crossbowman, …) now sits beside a glyph: a UNIT gets a per-render-ROLE glyph (villager / infantry / archer / cavalry / cavalry-archer / siege / monk, matching the on-map unit silhouettes — the role map is kept in lockstep with the renderer so the badge glyph and the map silhouette never diverge), and a BUILDING reuses the same per-type building glyph the build buttons use. Icons AUGMENT the labels rather than replacing them: each glyph is a sibling of the element that still carries the meaning (the resource value still holds only its number; the selection badge still holds only its two-letter code, which remains the accessible label), so the existing selection/data hooks and the screen-reader text are preserved. The glyph is decorative (`aria-hidden`). Still text-only (deferred to later M7 UI-icon slices): the non-build command-card buttons (train / action / market / research), and the resource/wildlife/relic selection badges (these are not player units or buildings). A minimap terrain layer and a fog gradient fade are separate open M7 UI items.
- dynamic, time-based feedback for selection and combat (the first animated render layer; purely visual — it never affects the simulation, saved games, or replay determinism): (1) a SELECTION PULSE — the selection ring around a selected unit or building breathes over a ~1.1-second cycle, modulating its stroke brightness, width, and a small outward radius swell, while the ring's center and base radius (and thus the entity's hitbox/health-bar/footprint geometry) stay fixed; derived from the existing `selected`/selection-set state. (2) a HIT FLASH — when a unit's HP drops between frames, a brief (~0.26 s) bright impact flash (a white-hot core fading to a warm orange rim) is drawn over it, confined to the unit's bounding circle and decaying on its own; derived render-side from a per-frame HP delta tracked the same way unit facing is (no new projected/recorded data). Shipped v0.1.45. Both are deterministic-sim-safe: the pulse phase and flash decay read the render clock only, and no randomness enters the simulation. Deferred to later M7 slices: gather sparks on actively-gathering villagers (the villager gather state is not on the render-projection today; adding it is a render-contract change), death/destruction particles, and projectiles in flight (paired with the M2 projectile simulation).
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

The repo ships an LLM-agent playtest harness that drives the simulation through a Claude-based agent, checks for gameplay regressions, and converts each run into an OBJECTIVE conformance backlog — concrete ways the implementation is missing, broken, or divergent from real Age of Empires II — that feeds the iterative build loop. The harness is internal tooling — it does not affect game rules — but its operator-visible mechanics are documented here so future autonomous handoffs know the surface.

- **Provider selection.** The playtest runner (`scripts/playtest-llm.mjs`) auto-selects between two LLM providers: `claude-code` (subscription auth via the `claude` CLI; default when `claude` resolves to a `.exe` on PATH) and `api` (Anthropic SDK with `ANTHROPIC_API_KEY`). Explicit override via `--provider claude-code|api`.
- **Opponent: the LLM plays player 1 (the human slot) against the in-game AI on player 2.** Earlier campaigns (1–5) ran `--owners 2`, which put the LLM in the only AI slot and left player 1 (the human, which is never given an AI) inert — so the agent boomed against no opponent and no match ever resolved. From campaign-6 the default is `--owners 1`: the LLM drives the human player, player 2 keeps its AI, and the match is a real LLM-vs-AI game. (`disableAi=1` is rejected by the harness — the human has no AI to disable — so player 2's AI stays active.)
- **Model policy: all playtest LLM calls use ONE model** — tactical, strategy, the conformance probe, the auto-fix `submit_fix_diff` call, and the deterministic-loop propose-fix CLI. Do not split tiers across models. **Current model: `claude-opus-4-8` (2026-06-12 user directive — Fable 5 is banned for now; revert to `claude-fable-5` when the ban lifts).** The prior 2026-06-09 directive pinned `claude-fable-5`; that remains the intended model once available. When swapping wholesale (ban lift, flagship bump), smoke-test the new id via `echo ok | claude -p --model <id>` first (per the AGENTS.md model-currency rule) and update all call sites (`scripts/playtest-llm.mjs` ×2, `scripts/playtest-findings.mjs` ×1, `scripts/playtest-llm-auto-fix.mjs`, `scripts/propose-fix.mjs`) plus the `DEFAULT_LLM_COST_TABLE` row in `src/game/playtest/types.ts`.
- **Paused-sim decisions (playtest-fixes C).** The runner pauses the simulation (`__AOE2_TEST__.setPaused(true)`, a pass-through to `bridge.setPaused`) once after boot and keeps it paused while the agent thinks; the host's `advanceTicks` atomically unpauses → steps N ticks → repauses inside one synchronous page task. The bridge tick therefore moves ONLY via `advanceTicks`: `--max-ticks` is exact, and screenshot checkpoints land precisely when they are multiples of `--decision-interval`. Without this, real-time drift during 10-100s LLM calls advanced the game ~600-1000 ticks per decision and made checkpoint capture impossible.
- **Agent context (playtest-fixes A/B).** The per-decision snapshot includes the agent's OWN units (id/kind/position/task, cap 150), own buildings (id/kind/position/isComplete, cap 64), and nearby gatherable resources (id/kind/position/amount, visibility-filtered, sorted by distance to the first own building, cap 64) — these are the only legitimate sources for the command tools' entity ids and are never fog-filtered (own forces) so the model cannot be id-blind. After each decision, the engine's dispatch verdicts (accepted/rejected + reasons) are reported back to the agent and rendered into the next tactical prompt, with an explicit warning block when the previous decision had rejections. The dispatch boundary also enforces ownership: commands whose acting entity (unitId/sheepId/buildingId/builderId/playerId) does not belong to the agent's owner are rejected pre-queue with reason `not-owned` — the engine's semantic validators carry no actor identity, so without this gate the agent could command enemy entities. Pre-queue rejections (not-owned, malformed payloads) are merged into the same feedback loop as engine verdicts. **Agent affordances (2026-06-11, campaign-1 backlog #1-#3):** the snapshot additionally carries `buildingOptions` — per completed owned building type, the research options available now (with costs), the locked research with the actionable WHY (shared reason engine with the `cannot_research` validator; in-flight techs are marked "already being researched" so the agent doesn't double-queue), trainable units, and the villager build menu with footprints + costs — and `placementHints` — up to 6 open 2x2 anchors and 4 open 3x3 anchors near the agent's town center, found by a deterministic ring scan in which every footprint cell must be unblocked AND currently visible to the agent (fog reveals nothing, even under `--omniscient`). Rejection messages themselves are actionable per §15.2, and the `building.placeConfirm` tool description points the model at `placementHints`.
- **Snapshot visibility (Phase-6.B).** The agent's per-decision state snapshot filters enemy units/buildings through per-owner visibility by default. Buildings use the engine's any-cell-visible rule (consistent with the renderer + target selection); units use single-cell. `--omniscient` (or per-row `omniscient: true`) opts into cheat-mode global view. As of 2026-06-10 the corpus smoke row runs fog-filtered (the agent has own-entity context, so cheat-mode is no longer needed).
- **Conformance capture (post-hoc; replaces the removed observation oracle).** The "looked-fun" verdict was removed 2026-06-13 on user directive: *"Looked-fun is not nearly enough. That is actually garbage. I don't need your judgement of fun. People play games and they decide what is fun."* In its place, `npm run playtest:findings -- <run-prefix>` runs a DECOUPLED pass over the saved envelope + slim trace (+ the last checkpoint screenshot) and writes `<prefix>.findings.md`, merging `metrics` + `findings` into the envelope. Two layers: (1) **deterministic metrics**, no LLM — command-type usage, accept/reject tallied by reason (a command rejected `unknown-kind` literally means that action is unimplemented), stall decisions, distinct command types, and the winner outcome; (2) an **advisory LLM critique** grounded in publicly-known AoE2 rules that records `findings: [{category, area, observed, expected, severity, suggestion}]` with `category ∈ {missing-feature, spec-divergence, functional-bug, balance-divergence, ux-gap}`. The probe is instructed to be objective and checkable and to NOT judge fun. **Advisory only** — does NOT affect CI exit codes; engineHalt remains the regression signal. Decoupled so it re-runs for free on ANY past or future run, including runs captured without an in-run oracle (e.g. campaign-4); `--no-llm` produces metrics only. This is the measurement half of the build loop: run → findings → implement → re-run.
- **Findings persist as agent markers on the run bundle (2026-06-15, v0.1.36).** When `playtest:findings` runs the advisory probe, it also overlays each finding onto the run's SessionBundle (`<prefix>.json`) as an `author: 'agent'` annotation marker, so replaying that bundle surfaces the AI's findings in the existing replay marker UI — the `MarkerListPanel` list (with an `agent` author badge + a severity icon) and the `TimelinePanel` pins — with no new rendering. Each finding becomes one marker anchored at the run's LAST decision tick (findings carry no per-finding tick; this coarse anchor is intentional — rich per-finding anchoring is deferred), with NO spatial position (findings have no cell). Mapping: marker `category` is always `ai` (the finding's gap-type `missing-feature|spec-divergence|functional-bug|balance-divergence|ux-gap` is preserved as `data.findingCategory`, not fuzzy-mapped onto a subsystem); severity `high→bug`, `medium→warning`, `low→info` (`blocker` is reserved for human authors); marker text is `[<gap-type>] <area>: <observed>`, with the full `expected`/`suggestion` carried in `data` for a future detail panel. The injection is IN-PLACE and IDEMPOTENT — re-running the findings pass replaces any prior agent markers (preserving human markers) instead of duplicating — and is non-fatal if the bundle file is absent (older runs / a typoed prefix warn-and-skip while the findings markdown + envelope still write). Persistence is direct `bundle.markers[]` injection, NOT `recorder.addMarker`: findings are computed post-hoc with no live world/recorder (and `recorder.addMarker` requires one). The engine's marker validator actually permits retroactive past-tick markers and rejects only future ticks, so the tick is not the blocker — the absence of a live recorder is. The replay-load path is structural-only so well-formed injected markers load and render directly. This is the first consumer of the `author: 'agent'` marker path defined in the 2026-04-29 annotation-ui thread.
- **Provider-error classification + retry (2026-06-13).** A transient LLM-call failure (the `claude -p` subprocess exiting non-zero, timing out, failing to spawn, an `is_error` envelope, or an SDK call error) is a `ProviderCallError`, distinct from an engine/host crash. A `RetryingProvider` wrapper retries the failing provider CALL in place with exponential backoff (`backoffMs * 2^attempt`; the campaign script uses 2 retries / 3s base → 3 attempts) before giving up; a succeeding retry continues the run. Retrying the call (not the whole decision) keeps each decision idempotent — no double strategy-refresh charge. When retries are exhausted the run stops with the distinct stop reason **`providerError`** — NOT `engineHalt`. The difference is load-bearing: on a provider failure the simulation and page are healthy (only the model call died), so the winner oracle still scores the game, the final screenshot still captures, and the bundle still exports; `engineHalt` (a genuine sim/page crash) suppresses all three. Any non-provider throw (host calls, agent bugs, deterministic config errors like a missing cost-table row) keeps `engineHalt`. Rationale: campaign-2/-3 each reached Feudal with a healthy economy but were cut short and mis-scored when a one-off `claude exit 1` was treated as a fatal engine halt; this makes a subprocess blip recoverable and, when not, honestly labelled. For corpus CI, `providerError` does NOT trip the HIGH-regression gate — it is exempted alongside `cost-budget-exceeded` (shared predicate `isLlmCorpusRegression` in `corpusRegression.ts`), so `engineHalt` plus genuinely-unexpected error messages stay the only corpus regression signals; the row stays visible (amber, distinct from clean-green and halt-red) in `SUMMARY-LLM.md` and the dashboard.
- **Winner oracle (Phase-6.D).** Always populated on clean exits as `envelope.winner`: `{kind: 'winner', ownerId}` when exactly one owner has living units or buildings; `{kind: 'in-progress', aliveOwners: number[]}` when multiple owners are alive (game didn't play out); `{kind: 'tie'}` when no owner has any entities (mutual destruction or scenario reset). Read of `economy.units` + `economy.buildings`; excludes `economy.resources` (sheep/wildlife/gather sites), so neutral entities don't perturb scoring. Includes under-construction buildings — owner is "alive" if they have any worldly footprint. Field is OMITTED (not set to undefined) when `stopReason === 'engineHalt'`; consumers should use `'winner' in envelope` to distinguish "scored" from "not scored". Cost-budget exits (`stopReason='stopWhen'` + `errorMessage='cost-budget-exceeded'`) DO get scored — the result will typically be `kind: 'in-progress'`, capturing partial-play state honestly. Winner extraction always runs on a clean exit because it has zero marginal cost (engine state read, no LLM call).
- **Checkpoint screenshots (option C, 2026-06-10 — replaces the Phase-6.C.1 visual-regression oracle).** The runner captures a screenshot whenever an advance lands exactly on a checkpoint tick (`--screenshot-every <ticks>`, default 1000, 0 disables; align to multiples of `--decision-interval`) and persists them to `<out>-screenshots/<tick>.png` for the corpus dashboard. There is NO baseline comparison and NO visual CI gate for LLM runs: a non-deterministic player has no "correct" reference image, so pixel diffs against a fixed PNG measured expected divergence rather than regressions (campaign-1 evidence: 9.86% diffs from a competently different base layout). Simulation determinism remains covered by the replay/snapshot-equivalence suites and render correctness by the deterministic Playwright browser tests; `engineHalt` plus the gameplay oracles are the LLM-row regression signals, and the conformance findings are the advisory build-backlog signal. The pure `visualOracle.ts` module is retained, unwired, for a future deterministic corpus row where baselines are meaningful.
- **HTML dashboard.** `npm run playtest:corpus-dashboard -- <corpus-dir>` (or auto-pick newest by mtime when no arg) emits `dashboard.html` next to `SUMMARY-LLM.md`: a per-run summary table (cost / ticks / decisions / winner / conformance-findings count / checkpoint-screenshot count) and per-run thumbnail grids of the checkpoint screenshots. Pure script — no runtime dependencies; thumbnails are referenced via relative `<img src=>` paths so the file works directly in the browser when opened from the corpus-llm dir.
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

### 16.2 Goal and Non-Goals

**Goal (2026-06-13 user directive):** full Age of Empires II (DE/HD) coverage is the target — *"Feudal age is not the end goal. We should have the whole game."* This SUPERSEDES the earlier "no complete parity" non-goal. Parity is pursued INCREMENTALLY, gap by gap, driven by the coverage roadmap (`design/roadmap.md`) and the LLM-playtest conformance loop (§15.7) — not in a single pass, and content is shipped only when the data + simulation can represent it consistently (missing content is surfaced, never faked).

Still out of scope (not requested):

- multiplayer
- campaign story mode
- non-standard game modes (Regicide, Death Match, Empire Wars, King of the Hill, Wonder Race, Capture the Relic)

Process non-goals (how, not what):

- hand-copying the full civ roster and every bonus into prose when the CSVs already own that data
- silently filling data gaps with guessed civ content — surface missing data as missing
- preserving older AoC-only assumptions from earlier drafts

### 16.3 Build Process — playtest-driven coverage

The path to the goal is the coverage roadmap (`design/roadmap.md`), worked top-down via the loop in §15.7: pick the highest-leverage gap, record its rule in this spec, implement it (TDD + multi-CLI review), then re-run the LLM playtest. `playtest:findings` then either confirms the gap closed (the unimplemented-command rejection disappears and the agent uses the new capability) or surfaces the next gap. Build the three structural enablers first, because they unlock the most content at once:

1. the stat-multiplier subsystem (powers economy upgrades, civ bonuses, and many techs);
2. the AoE2-correct population model + farms (a sustained mid/late-game economy and army);
3. data-driven combat — armor classes + bonus damage, then projectiles.

The earlier groundwork (normalized `design/stats`, producer→unit/tech mappings, and the data-vs-dataset gap validation) is in place; the work now is simulation depth and content breadth per the roadmap.

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
