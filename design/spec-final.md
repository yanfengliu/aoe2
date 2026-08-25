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

**Behavioural parity is the standard (owner directive, 2026-08-23).** The game must FUNCTION IDENTICALLY to the real Age of Empires II — the same costs, gather and creation rates, counters and bonus damage, tech-tree gating, controls, and consequences. Where this repo has no assertion about a value, the real game's value is still the correct one, and a divergence is a defect rather than an open choice. Rules resolve in the §1 source-of-truth order, and **Definitive Edition is the authoritative edition**: the owner's "HD" is shorthand for the real game, `design/stats/` is DE-derived, and where an HD-era rule differs from DE, DE wins and the choice is recorded where it was made. A remembered rule is a hypothesis until an authoritative reference confirms it.

Exactly two deliberate divergences exist, both about LOOK rather than behaviour, and both owner-set: the HUD chrome is modern rather than AoE2-era (§14.1), and all art is original/procedural rather than reproduced Age of Empires assets (§2.3). Neither licenses a behavioural difference.

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

Implemented v0.3.74 as `?resources=standard|medium|high` and the setup screen's row: the preset seeds every seat the scenario does not pin its own resources for. Ignored on the save-load path — a loaded match keeps the stockpiles it saved.

### 4.2 Match Participants and Teams

- supported participants per match: 2 to 8 (all eight seatable since v0.3.66; the map grows with the count — §5.1's size ladder)
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

Default setup is the AoE2 **Standard** victory set — Conquest, Wonder, and Relic all active — which is what the real game's Standard mode means; a **Conquest Only** option (v0.3.74, `?victory=conquest-only` and the setup screen's Victory row) disables the Wonder and Relic clocks for the whole match, and the choice persists through saves.

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

Implemented v0.3.74 as `?speed=slow|normal|fast` and the setup screen's row. The multiplier is presentation-side — each frame's simulation delta is scaled before stepping, so a fast match is the same deterministic match stepped more per frame; saves, replays, and every tick-counted datum are untouched. The default is Slow (1.0x), the rate the data is defined at.

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

**Setup screen (implemented v0.3.73).** A bare visit — a URL with no query parameters at all — lands on the match setup screen instead of a running game: map (Standard / Arena / Black Forest), players (2–8, seating §12's ladder), the human's civilization (all 30), teams (free-for-all, or two sides split evenly with the odd seat on the human's side), and AI difficulty (Easy / Standard / Hard — §12's decision interval at 60 / 30 / 15 ticks, surfaced as `?difficulty=`). Start writes the choices into the URL the app already reads and reloads, so the parameters stay the single source of configuration, a settings link stays shareable, and every visit WITH parameters — every test, harness, and shared link — boots straight into the match untouched. Resource presets, game speed, and the Conquest Only victory option gained rows in v0.3.74, and the **population cap** in v0.3.75 (`?popcap=25..500` and the setup row's 75–250 ladder): the cap persists in the match settings, every cap-derivation site reads it, and a load re-derives each owner's cap against it — so a 100-cap save reloads as a 100-cap match. Every §4.6 option is now configurable.

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

**Implemented (v0.3.66):** the ladder is chosen by player count rather than named separately — the seven rungs and their tile dimensions are tabulated in §12's player-count section, from 60x36 for a 1v1 up to 116x72 for eight. Named sizes independent of the count (a "Giant" 1v1) are not offered yet; the count picks the map.

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

**Implemented (v0.3.95): all eight.** Arabia (the standard generator under its AoE2 name — open land, woodlines, hills, scattered water), Arena (walled starts, since v0.1.x), Black Forest, **Coastal** (one sea along the southern edge, dry interior, shore fish and Docks worth building, every start land-connected), **Fortress** (each player opens behind an 11-cell stone-wall square with a gated face toward the middle and a Castle already standing; trees on the wall line are felled, the map edge serves as the wall where a corner start's square is clipped), and **Gold Rush** (a nine-node neutral goldfield at double richness in the map's centre). All are on the setup screen's map row. **Nomad (v0.3.94):** every player opens as three villagers on open ground — no Town Center, no scout, no sheep (with no TC they would stand unclaimed) — with the standard resource patches and forest laid around the start point. The scenario carries `nomadStart`, persisted in matchSettings (absent in older saves = off), and the build menu offers the FIRST Town Center in any age — the offer vanishing the moment one stands or scaffolds and returning if the last one falls. The AI opens lumber-camp-first (a wood dropsite is the only road to the TC's 275 wood), then places its TC the moment it is affordable; the branch is gated on the TC being PLACEABLE (nomad, or Castle Age on any map — which also makes a TC-less Castle-Age AI rebuild), so ordinary Dark-Age TC-less fixtures keep their old behavior. Population reads 3/0 until the first TC stands, as in AoE2. **Islands (v0.3.95):** two land masses split by open sea, each carrying the full standard opening plus its forest, shore fish lining the channel. The AI plays it because it learned to FERRY (`aiFerryPhase`): when its attack group is mustered but the target Town Center is not land-reachable (one BFS from the enemy TC over land answers reachability, shore selection, and arrival), it stands down the ordinary march AND discretionary building (the macro list would spend the Transport Ship's wood — observed), trains a Transport Ship at its Dock if it lacks one (building the Dock first if need be), boards up to a hold of soldiers, sails to the target island's nearest shore, unloads, and lets the ordinary march resume on the far side. Every step drives the recorded channels a human uses. Supporting rule (v0.3.95): `unloadTransport` gained a DISTANCE GUARD — the ship must be within 3 cells of the shore it unloads onto; before this, pointing a loaded transport at a distant coast teleported the cargo across the map. A far shore click now SAILS the ship toward that shore's water side instead, and the unload is a second click on arrival.

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

### 5.6 Neutral World Entities

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

- Player-facing UI calls unowned wildlife and fish `Neutral`; it never exposes the internal `gaia` owner identifier.
- Stationary natural objects such as berry bushes, trees, gold mines, stone mines, and relics do not display a faction because they are world resources rather than a side.
- The internal `gaia` identifier may remain in fixtures, data, and simulation ownership for compatibility; discovered herdables display the faction of their current owner.
- herdables change ownership when discovered
- boar retaliate when lured or attacked
- multiple selected villagers may attack one living boar concurrently; every villager retains independent approach, attack, and cooldown state, while the boar's retaliation target is non-exclusive and never reserves the boar against other attackers
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
- automatic post-construction mining (user directive 2026-07-14; shipped v0.2.6): when a Mining Camp finishes construction, every villager still holding the build command for that camp automatically receives a gather order on the nearest HARVESTABLE (amount > 0) gold or stone mine — nearest by straight-line distance from the completed camp anchor among mines within a 7-cell radius, exact ties broken by lowest mine entity id. If no mine is in radius, the builder goes idle exactly as before. Delivery is one queued `unit.autoGather` intention per builder through the normal recorded command channel (drained, validated, recorded, replayed like any player order; the handler is the plain gather handler, so drop-off resolution and explicit-gather semantics are identical), and it applies to human and AI villagers identically. Never-preempt is layered: every explicit human path — move, context, AND an accepted chain-build placement — evicts the unit's pending system intentions at issue time; agent/AI pushes land after the auto-order in the drain FIFO so their handlers write last; and the `unit.autoGather` validator refuses any unit that is not still idle-from-build (no unit command, or only the stale build command for the same completed camp) at submit time. A save taken in the completion→drain window persists the queued order via the serialized pending-command queue and fires it on the first restored step; in REPLAY the live-queued intentions are authority-discarded every tick and the recorded `unit.autoGather` stream is the sole delivery path. The auto-order is not drivenness evidence for playtest oracles (no actor keys, like auto-aggression attacks).

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

Home gather range (implemented v0.3.30): auto-assignment is bounded to resources within a home range of the villager's reference drop-off. Ranking alone only ORDERS candidates, so once the nodes beside a base are crowded the fan-out otherwise runs on to the far side of the map — a villager assigned work forty to sixty cells away walks through an opponent's base and is killed there, which drains a player's economy far faster than the extra income replaces it. The range applies only when at least one candidate of the desired kind falls inside it; a player whose own resources of that kind are exhausted still ranges as far as needed rather than stopping. Unreachable-target recovery (below) probes inside the home range first and widens to the full map only when nothing at home can be reached, so a villager standing beside a reachable tree is never starved by a walled pocket next to its drop-off. This bound governs AUTOMATIC assignment only — an explicit player gather order is honoured at any distance.

Resource-kind fallback (implemented v0.3.30): a gatherer that can find no workable resource of the kind it wants takes work of another kind instead of standing idle, trying wood, food, gold, then stone in that order and settling on the first that yields a target. Wood comes first because it gates houses and farms, and a player short of wood is short of everything else soon after. Without this a player whose own food is eaten, whose opponent's food is not gatherable, and who cannot afford farms leaves its whole villager force idle while the resource it actually needs goes ungathered.

Unreachable-target recovery: if a villager's assigned resource cannot be reached (every cell adjacent to it is blocked — for example a resource boxed in by buildings, other resources, or terrain), the villager must re-target the nearest REACHABLE resource of the same kind rather than latching on the unreachable one. If it is carrying resources it deposits them first; if no resource of that kind is reachable at all (a genuinely fully-boxed villager) it does not gather. The reachability search is bounded — it pathfinds against at most a fixed number of the nearest candidates — so even a fully-boxed villager never triggers a per-tick pathfinding storm that scales with the map's resource count. It is also bounded in TIME: a villager with no reachable target re-probes on a fixed interval rather than every tick, staggered by entity id so the cost spreads across ticks instead of spiking on one. Retrying within about a second of game time is below noticing, and running the probe every tick for every stuck villager dominated the whole simulation once economies actually moved. This prevents a permanent deadlock in which a villager (or a pile of villagers) keeps re-selecting an unreachable resource every tick and never gathers — which would otherwise starve the economy and stall age progression. The preference for the player's own resources still applies first, so an unreachable owned resource (a boxed-in sheep) is skipped in favour of a reachable resource rather than re-selected forever.

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

Because the capacity is derived at create + reseed (not mutated on research), a farm built BEFORE a tech keeps its current stored amount until it next reseeds, at which point it refills to the then-current capacity — AoE2-faithful (an existing field grows as it is re-sown, not retroactively). A farm owned by a player without the techs holds the base 175. The values are the AoE2 capacities the spec pins (250/375/550); the Heavy Plow "Farmers carry +1 food" clause landed v0.3.101 in the carry-tech layer: +1 on the BASE carry, farms only, composing with Wheelbarrow/Hand Cart's multipliers exactly like the civilization carry bonuses (add to base first).

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

**Land trade (implemented v0.3.68).** The **Trade Cart** trains at the Market from Feudal Age (100 wood 50 gold, 50 s; HP 70, speed 1.0, no attack, 1 population). Right-clicking **another player's completed Market** with a cart opens a route — any other player's, ally or enemy, exactly as in AoE2, which is also what makes trade usable in a free-for-all. The cart then cycles unattended: walk to the far Market, load, walk back to the sender's **nearest own completed Market**, deposit gold, repeat. The route is the cart's unit command, so it survives a save mid-leg, ends when the cart dies or is given any other order, and needs no separate bookkeeping.

**Profit** is `max(2, round(0.46 × d))` gold per round trip, where `d` is the straight-line distance between the two Markets' anchors — 0.46/tile is the community's measured AoE2 figure, and §5.1's size ladder makes long routes on big maps pay accordingly. The profit is fixed **at load time** from the two Markets as they stand: once loaded, the gold is on the cart, so a far Market razed during the walk home still pays out (AoE2's behaviour), and the route simply ends after that deposit. **Caravan** (Market, Castle Age, 200 food 200 gold, 40 s) makes Trade Carts move 50% faster through the movement-technology seam, which raises a route's income rate by the same half.

Orders at unseen entities are refused by the fog contract, so a route needs the far Market scouted first — the selection panel shows **"Trading with Market"** once the order takes.

**Naval trade (implemented v0.3.69).** The **Trade Cog** trains at the Dock from Feudal Age (100 wood 50 gold, 36 s; HP 80, pierce armour 6, speed 1.32 — 2.0 with Caravan, exactly as its `units.csv` row says). It runs the same cycle as the cart with **Docks** in place of Markets: right-click another player's completed Dock, sail out, load, sail home to the nearest own Dock, deposit, repeat. The pairing is strict — a cart trades only at Markets, a cog only at Docks — and profit, load-time pricing, save persistence and cancellation are all the same machinery (`tradeCommandStep.ts` is parametric over the anchor building). Caravan speeds both trade units.

**AI trading (implemented v0.3.72).** Every AI player runs its own trade line: once it has a completed Market and any OTHER player's completed Market stands, it trains Trade Carts up to a small cap (2 — presence over optimum, the monk cap's own scale) whenever it can afford them, and routes every idle cart at the nearest other-player Market through the same recorded right-click channel a human uses. Trade units default to the **No Attack** stance, as in AoE2 — the first AI cart shipped on Aggressive, walked up to the enemy Market it was supposed to trade with, and stood there "attacking" for zero damage forever. Deliberately still open: attack-move safety conventions for allied routes, and AI Trade Cogs (the AI does not yet build Docks).

### 6.8 Market Exchange and Tribute

The Market must support:

- buying food, wood, and stone for gold
- selling food, wood, and stone for gold
- dynamic exchange-rate movement by repeated trades
- tribute to AI allies
- tribute fee reduction through technologies
- civ-specific market-fee modifiers

**Tribute (implemented v0.3.67).** A player with a **completed Market** — AoE2's own precondition — can send any of the four resources to any other player in the match, ally or not. The sender pays the amount plus a fee: **30%** base, **20%** once **Coinage** (Feudal, 150 food 50 gold) is researched, **0%** once **Banking** (Castle, 200 food 100 gold, requires Coinage) is — `technologies.csv`'s "Tribute inefficiency" rows, derived from the sender's researched set at execution time. The fee rounds up, so it can never be underpaid; the recipient always receives exactly the amount sent. The transfer is atomic and instantaneous, rides the recorded `tribute.send` command for replay fidelity, and moves nothing on any failed check (no Market, unknown recipient, self-tribute, non-positive or fractional amount, or a stockpile short of amount plus fee).

In the HUD, tribute lives on the selected Market's command card: one button per other player per resource, each sending **100** (AoE2's per-click chunk), with the true cost — amount plus the sender's current fee — in the tooltip. The buttons exist only while a completed own Market is selected, which makes the no-Market rule visible rather than merely enforced.

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

Implemented model (buildings): right-clicking a friendly, COMPLETE, damaged building with a villager repairs it. The villager walks adjacent (like construction) and restores HP over time at the building's build rate (`maxHp / buildTimeTicks` per tick) until full. The cost is a fraction of the build cost proportional to the missing HP — `ceil(0.5 × buildCost × missingHp / maxHp)` per resource — so a full repair from ~0 costs about half the build cost. It is charged UP FRONT when the repair is issued (slice-1 simplification; AoE2 charges continuously), so each assigned villager is billed separately and an interrupted repair is not refunded. A repair the owner cannot afford is not started. Mechanical-unit repair shipped v0.3.107: a villager right-clicking a friendly DAMAGED siege engine or ship (anything carrying the siege or ship armor class — the taxonomy is the source) repairs it under exactly the building model — half the unit's TRAINING cost pro-rata the missing HP charged up front, pursuit to melee range (the target may move; the villager follows), then restoration at the unit's own training rate (`maxHp / trainingTimeTicks`). A full-HP or organic target falls through to the ordinary move — Monks heal flesh, villagers mend machines. The command reuses the 'repair' word with a unit target ref, so saves and replays carry it unchanged. Continuous (per-tick) charging and repair-speed modifiers remain deferred.

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
- Palisade Gate (Dark Age, 30 wood, 250 hit points) and Gate (Castle Age, 30 stone, 2750 hit points) — implemented v0.3.31

**Gates (implemented v0.3.31).** A gate is a wall with a door. It occupies one cell and stands in a wall line exactly as a wall segment does, is placed and built the same way, and is offered wherever its own wall is — Palisade Gate with Palisade Wall in the Dark Age, Gate with Stone Wall in the Castle Age. What makes it a gate is the passability rule: **the cell is passable for units of the gate's OWNER and impassable for everyone else**, so a walled base can be left and entered by the player who walled it while an attacker must still break through. Three cases are deliberately closed: a gate under construction admits nobody, including its builder — an unfinished gate is a hole in the wall that has not been closed yet, not a door, and admitting units through a construction site would make a half-built wall line meaningless; the wall segments beside a gate stay impassable to their owner like any wall; and a gate never admits an unowned mover (wildlife). A gate costs far more than the wall segment it replaces (30 versus 2 or 5), which is what stops a player gating a whole perimeter, and it carries more hit points than its own wall because it is the obvious place to attack. Allied passage shipped v0.3.106 (the DE rule): with teams in play, a finished gate admits the whole team — `gateAdmits` takes the owner-team map and any ally of the gate's owner walks through, while enemies and wildlife stay shut out and a free-for-all (no recorded teams) keeps the exact-owner rule unchanged. An unfinished gate still admits nobody, allies included.

Wonder:

- alternate victory building

**Fish Trap (implemented 2026-08-23).** Dark Age, 100 wood, 1x1, 50 hit points, 53-second build — and the only building a villager cannot put up. A **Fishing Ship** builds it, on open water, because that is where it goes; on completion it becomes a gatherable FISH resource holding 715 food (structures.csv "Gives 715 Food"), which is the same building-plus-resource hybrid the Farm uses, on the other domain. It does not reseed: an emptied trap is gone and the player builds another. Two rules generalised to make it work, and both are the better rule anyway: **what a unit may build is the build menu's answer rather than a unit-type test** (the villager-only checks in the placement validator, the placement ops, and the construction start are gone, and a unit that can build nothing gets a message that says so), and **only builders that can build THIS building are enlisted onto it**, so a villager in a mixed selection is never sent to help with a trap out at sea. Placement is refused unless every footprint cell is open water and nothing but the water itself claims it; a finished trap blocks ships like any other building. Its silhouette is a ring of stakes with netting slung between them and a marker float in the owner's colour.

**Outpost (implemented 2026-08-23).** Dark Age, 25 wood + 10 stone, 1x1, 500 hit points, 15-second build, line of sight 6 — and no attack of any kind. It is the cheapest way to see ground you do not hold, and it is deliberately not a Watch Tower: a player must be able to tell the two apart at a glance, so its silhouette is an open timber platform on legs with a ladder and a railed lookout rather than a stone shaft. structures.csv's "+2 Line of sight per age" is implemented on the same two-sided seam as the line-of-sight technologies (§11): advancing an age bumps every Outpost already standing, and one built afterwards derives the same total at construction-complete, so 6 / 8 / 10 / 12 across the four ages. Town Watch and Town Patrol stack on top of that. It provides no population, garrisons nobody, and trains and researches nothing.

### 8.5 Building Prerequisites

The building graph must preserve AoE2 dependency logic:

- Barracks unlocks Archery Range and Stable
- Blacksmith is part of Castle Age prerequisite flow
- Castle Age buildings unlock Imperial Age
- University gates certain advanced defensive and projectile techs
- Castle is not mandatory for every strategy but can satisfy part of the Imperial Age path

Building availability by age (implemented; one source, `getBuildOptions`, which also gates placement validation): Dark Age — House, Mill, Lumber Camp, Mining Camp, Barracks, Palisade Wall, Palisade Gate, and Farm (the Palisade Wall has no prerequisite, matching AoE2: it is the only Dark-Age wall and the early defensive option against a Dark-Age military rush; the Farm is the Dark-Age renewable food source, buildable from the start). Feudal Age (with a completed Barracks) adds Stable, Archery Range, Blacksmith, Market, and Watch Tower. Castle/Imperial Age adds Town Center, Siege Workshop, Monastery, Castle, Stone Wall, Gate (and the Wonder in Imperial). (Note: Watch Tower currently also requires a Barracks, a minor divergence from AoE2 where it needs only Feudal Age.)

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

**Three line tiers the roster was missing (implemented 2026-08-23).** Comparing the `UnitType` union against `units.csv` found twenty names the code did not carry; most are wildlife modelled as resources, out of scope (King is Regicide only, §2.3), renames (`Scout Cavalry` is `scout`), or a state rather than a unit (`Trebuchet (packed)`). Three were real gaps, each completing a line that already existed:

- **Capped Ram** (Imperial, Siege Workshop, 200 HP, attack 3, +1 ram armour) — the ram line's middle tier. It was **Battering Ram → Siege Ram in one step**; `units.csv` says "Siege Ram: Upgraded Capped Ram", so the Siege upgrade now takes the Capped Ram as its input and the Siege Workshop offers it only once the Capped upgrade is in — a menu that offers an upgrade whose input unit the player cannot have is a menu that lies.
- **Siege Onager** (Imperial, 70 HP, attack 75, blast 1.5) — the mangonel line's last tier, and the most expensive unit upgrade in the game at 1450 food + 1000 gold.
- **Elite Skirmisher** (35 HP, attack 3, range 1-5, pierce armour 4) — without it the Skirmisher never improved, which makes the whole line a Feudal-only answer to archers.

**A CSV-vs-CSV conflict, resolved and recorded:** `units.csv` puts the Elite Skirmisher in the **Castle** Age while `technologies.csv` puts its upgrade in **Imperial**. §1 ranks the CSVs above this document but says nothing about the two disagreeing with each other; the unit row wins on an internal-consistency argument — a technology that unlocks a unit cannot be later than the unit's own age, or the unit row's age is meaningless. The costs come from `technologies.csv` either way.

### 9.2.1 Unique Units

Every civilization has one signature unit trained at its **Castle**, and a handful have a second one trained at the **Dock**. A unique unit is an ordinary roster member in every mechanical respect — the same stat tables, the same armor classes, the same projectile rules — that happens to be gated on the owner's civilization. Nothing about the gate is special-cased per civilization: one table (`src/game/simulation/uniqueUnits.ts`) maps civilization to unit and to the building that trains it, and both the Castle and the Dock train menus read it. A civilization therefore cannot be offered another's unit, and a unit cannot be added and then offered to nobody.

Implemented (stats from `design/stats/units.csv`, availability from `design/stats/civilizations.csv`):

| Civilization | Unique unit | Trained at |
| --- | --- | --- |
| Aztecs | Jaguar Warrior | Castle |
| Britons | Longbowman -> Elite Longbowman | Castle |
| Byzantines | Cataphract | Castle |
| Celts | Woad Raider | Castle |
| Chinese | Chu Ko Nu | Castle |
| Franks | Throwing Axeman | Castle |
| Goths | Huskarl | Castle |
| Huns | Tarkan | Castle |
| Japanese | Samurai | Castle |
| Koreans | War Wagon | Castle |
| Koreans | Turtle Ship | Dock |
| Mayans | Plumed Archer | Castle |
| Mongols | Mangudai | Castle |
| Persians | War Elephant | Castle |
| Saracens | Mameluke | Castle |
| Spanish | Conquistador | Castle |
| Teutons | Teutonic Knight | Castle |
| Turks | Janissary | Castle |
| Vikings | Berserk | Castle |
| Vikings | Longboat | Dock |

Every unique unit belongs to the `unique-unit` armor class in addition to the class of the line it replaces, which is what gives the Samurai's +12 vs unique units something to bite on (§10.3).

Every one of them also has an **elite** version, unlocked by an Imperial-age technology and researched at the building that TRAINS the unit — the Castle for seventeen of them and the **Dock** for the Turtle Ship and the Longboat. Researching it replaces the base unit in the train menu and converts the ones already standing, exactly like the stock upgrade lines. The elite chain is an optional field on the same table row, so a unique unit without one is representable and nothing has to special-case its absence.

An elite is never worse than its base on any of HP, attack, melee armour, or pierce armour, and is better on at least one — but not on all: the Elite Mangudai keeps 60 HP and buys attack and pierce armour instead, which is faithful to AoE2 and is why the invariant is stated that way rather than as "strictly tougher".

Still to come: the multi-unit civilizations whose `units.csv` rows have no individual stats (Berbers, Burmese, Ethiopians, Incas, Indians, Italians, Khmer, Magyars, Malians, Portuguese, Slavs, Vietnamese) — with their rows absent from the dataset, every unit the dataset can express is now in the game.

**The Missionary (implemented v0.3.71).** The Spanish second unique unit and the roster's one Monastery-trained one: a monk on horseback (100 gold, 51 s; HP 30, speed 1.1 — the monk at a canter — LOS 9, no attack, no elite tier, exactly as `units.csv` says). It heals, converts, and rests its faith like a Monk — the monastic behaviours key on the LINE (`isMonasticUnit`), not the one unit — and being mounted, Bloodlines and Husbandry reach it while anti-cavalry bonus damage finds it. The horse's price is the relic: **a Missionary cannot pick up or deposit relics** (`canCarryRelics` is the Monk alone); right-clicking one just rides it over. Monastery technologies (Sanctity, Fervor, Atonement targeting, Block Printing, Illumination, faith rest) apply to both monastics. Both convert at this build's 4-cell monastic action range — AoE2's 9-for-Monk / 7-for-Missionary split lands together with the monk-range fidelity work (§12's deviation note), where a 2-cell split on a 4-cell base would caricature it.

### 9.2.2 Unique Technologies

Each civilization has one or two signature technologies, researched at its **Castle**. Nineteen of the nineteen in `design/stats/technologies.csv` are implemented — the deferred list emptied in v0.3.70, when Atheism landed on the victory countdowns Spies made meaningful. The table below and `UNIQUE_TECHNOLOGIES` are checked against each other by `tests/architecture/specUniqueTechnologyTable.test.ts` — El Dorado shipped in v0.3.57 and this table did not learn about it for eight versions.

They are DECLARED rather than coded (`src/game/simulation/uniqueTechnologies.ts`). Each names which units or buildings it touches and what it adds, and one loop applies them all — the alternative was sixteen more branches on a combat-state factory that was already a forty-line ladder, each harder to read than the CSV line it came from. The same declarations drive both halves: the units already on the field are bumped when the research completes, and everything trained afterwards derives it at creation.

| Civilization | Technology | Age | Effect |
| --- | --- | --- | --- |
| Aztecs | Garland Wars | Imperial | Infantry +4 attack |
| Britons | Yeomen | Imperial | Foot archers +1 range; Watch Towers +2 attack |
| Byzantines | Logistica | Imperial | Cataphracts +6 attack |
| Celts | Furor Celtica | Imperial | Siege Workshop units +50% hit points |
| Chinese | Rocketry | Imperial | Chu Ko Nu +2 attack, Scorpion line +4 |
| Franks | Bearded Axe | Imperial | Throwing Axemen +1 range |
| Goths | Anarchy | Castle | Huskarls trainable at the Barracks |
| Huns | Atheism | Imperial | Wonder/Relic countdowns +100 years; Spies costs half |
| Goths | Perfusion | Imperial | Barracks train twice as fast |
| Japanese | Kataparuto | Imperial | Trebuchets reload 25% faster |
| Koreans | Shinkichon | Imperial | Mangonel line +1 range |
| Mayans | El Dorado | Imperial | Eagle Warriors +40 hit points |
| Mongols | Drill | Imperial | Siege Workshop units move 50% faster |
| Persians | Mahouts | Imperial | War Elephants move 30% faster |
| Saracens | Zealotry | Imperial | Mamelukes and camels +30 hit points |
| Spanish | Supremacy | Imperial | Villagers +6 attack, +40 hit points, +2/+2 armour |
| Teutons | Crenellations | Imperial | Castles +3 range |
| Turks | Artillery | Imperial | Bombard units +2 range |
| Vikings | Berserkergang | Imperial | Berserks regenerate twice as fast |

The Castle research menu opens in CASTLE age rather than Imperial, because Anarchy is a Castle-age technology; every other entry still carries its own age, so nothing else moved earlier.

A flat hit-point grant fills a unit that was already at full health and leaves a damaged one damaged, the same rule Loom follows. A multiplier applies to the value as it stands, so a technology stacks on top of blacksmith upgrades rather than replacing them.

Not implemented, and why: nothing — the list is empty. (Its history: **El Dorado** sat here until v0.3.57, deferred against an Eagle line that had already shipped; **Berserkergang** until v0.3.65, waiting on regeneration; **Atheism** until v0.3.70, waiting on Spies and on countdowns worth delaying. A deferral is a claim about the build, so it goes stale on its own — this paragraph stays as the place any future dataset row will be explained.) Partial where noted: Logistica's trample blast, and Crenellations' garrisoned infantry firing their own arrows, are both absent — the range and attack halves are live.

**Spies (v0.3.70)** is the Castle's any-civilization Imperial technology and the game's only dynamically priced one: **200 gold per living enemy villager** (floor 200 — never free), halved by Atheism, counted at the moment of purchase. Its effect is the rest of the map's eyes: the buyer permanently sees every other player's line of sight, ally and enemy alike — Cartography's rule with the team filter removed. The research itself takes one second; the price is the cost. The command-card tooltip quotes the per-villager rule rather than the table floor, so the button never costs more than it says.

**Atheism (v0.3.70, Huns)** adds **+100 years (1000 ticks)** to every Wonder and Relic victory countdown in the match — the ones already running when it completes, and every one that starts while any owner has it. The delay belongs to the match, not the researcher: it buys everyone time against a Wonder rush, which is what the technology is for. It also halves the price of Spies for its owner.

**Team bonuses (v0.3.81).** The `team_bonus` column is live for every line the seams can express — active for an owner when the owner **or any ally** plays the civilization (a side of one still enjoys its own, AoE2's rule). Economy and production: Aztec relics pay a third more (one extra gold per relic every third tick — deterministic), Spanish trade returns +33% gold at the route's load-time pricing, Chinese-team farms hold +45 food (reseeds included), Slavic-team military buildings each shelter +5, and Britons/Goths/Huns speed their Archery Ranges/Barracks/Stables 20% while Turks speed gunpowder units anywhere and Malians speed University research 80%. Costs: Mayan-team walls at half stone, Viking-team Docks a quarter off — through the same `ownerConstructionCost` seam every charge and display reads. Support: Byzantine-team monks heal 50% faster, Teuton-team units resist conversion at half rate (stacking with Faith to a quarter, AoE2's composition), and a Portuguese ally turns Cartography's shared sight ON from the Dark Age with no Market. The combat-stat lines followed in v0.3.82: Frankish-team knights, Mongol-team scouts and Magyar-team foot archers see farther (+2 each), Japanese-team galleys half again as far, and Korean VILLAGERS (+3, the civilization's own line); Korean-team mangonels and Khmer-team scorpions reach one cell farther at the combat-state factory; Saracen-team foot archers (+2) and Indian-team camels (+5) punish buildings, and Persian-team knights strike archer-class targets for +2 — the last three computed by the command loop and threaded into the delivery paths. The Ethiopian-team tower/outpost sight followed in v0.3.84 through the building-vision seam (below). Listed as the open remainder: the lines needing absent content (Berbers' Genitour, Italians' Condottiero, the Vietnamese Imperial Skirmisher, Burmese minimap relics).

**Building civilization/team bonuses + DE garrison eligibility (v0.3.84).** A building-scoped bonus module (`civBuildingBonuses.ts`) carries: the Ethiopian team bonus "Towers and Outposts +3 LOS" (owner or ally; watch/bombard towers and Outposts, composing with Town Watch/Patrol and the Outpost per-age sweep, which are deltas) and the Teuton civilization lines "Town Centers have +1 attack and +5 line of sight", "Towers can garrison 2x units", and "Monks have 2x healing range" (heal tasks only — convert, relic pickup, and deposit keep base reach). The vision bonus applies on BOTH building-creation branches — the default-table branch and the explicit-radius branch — because the real map's starting Town Center arrives with an explicit radius 7; a default-only seam would miss the one TC that matters. The garrison capacity multiplier is read at the entry check and the HUD count, so the displayed capacity is the enforced one. Landing the Teuton tower line forced garrison ELIGIBILITY to the AoE2 DE rules (it had been villagers-anywhere plus archers-in-castles): villagers fit anything that garrisons; foot soldiers — infantry, foot ranged units, monks — also fit Town Centers, towers, and Castles; a Castle additionally takes mounted units; siege, ships, and trade carts never garrison. The Teuton "(more arrows)" half of the tower line came alive in v0.3.96: watch towers fire structures.csv's garrison-scaled volley — base 1 arrow plus one per sheltered ARCHER or VILLAGER (infantry add none), capped at "Max 5 arrows" — so the doubled Teuton garrison genuinely feeds a fuller volley. The Bombard Tower keeps its single cannon whatever shelters inside.

The twelve expansion civilizations have no technology rows in the dataset at all, the same gap as their unique units (§9.2.1).

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

**Right-click never garrisons (user directive 2026-07-15; deliberate deviation from AoE2).** A plain right-click on ANY building — including an owned garrisonable one — issues a MOVE to the click's ground-plane position, never a garrison. The move target is the exact point the click inverts to through the flat ground plane, NOT the building's footprint: because the iso projection maps higher screen positions to deeper ground cells, clicking the base of a building walks the unit up against it ("towards"), while clicking its roof walks the unit to the cell BEHIND it. The building's drawn silhouette therefore stops capturing right-clicks for garrison, and the exact click point is what selects the destination.

**Garrison is Alt+right-click** on an owned garrisonable building, using the same eligibility rules as before. **Ctrl+right-click is the explicit ATTACK order (v0.3.102)** — the deliberate command that can target an ALLY's unit or building; a PLAIN right-click on an ally is always a walk to them, never friendly fire (before v0.3.102, teams made a plain click on an ally's unit an attack — a misclick war). Enemies are attacked by plain click as always; trade routes to any Market and the never-attack rules are unchanged. Seam note: the pointer→view wrapper used to silently drop the iso pick and the Alt flag, so LIVE Alt+garrison had never actually worked — every modifier now flows through, and the seam carries tests. **The idle villager bell (v0.3.103).** AoE2's answer to "who is standing around?": a bottom-left HUD button (always in the DOM per the countdown-chip no-reflow rule; dimmed at zero) shows the count of the human's villagers with no command, an idle gather task, and no shelter; clicking it — or pressing `.` — selects the next one ROUND-ROBIN (next-greater id, wrapping, stable as the set changes) and centres the camera on them. Bridge surface: `countIdleVillagers()` / `selectNextIdleVillager()` (`idleVillagerOps.ts`); the browser spec clicks the REAL DOM button, per the unwatched-seam lesson. **Control groups (v0.3.104).** Ctrl+digit binds the current selection to that digit; the digit recalls whoever still stands (selectByRefs prunes the dead — an all-dead group is forgotten, as in AoE2); a quick second tap centres the camera on the group. Groups PERSIST through save/load (v0.3.112, the DE behaviour): they live in the `aoe2.controlGroups` codec, so the save carries every digit's refs and the loaded game recalls the same groups — the generation-aware recall prune also drops members who died before the save. Saves from before v0.3.112 simply carry no groups. Bridge surface `assignControlGroup`/`recallControlGroup` (`controlGroupOps.ts`); the browser spec presses the REAL keys. **The Delete key (v0.3.114).** Pressing Delete removes the PRIMARY selected entity if it is the player's own unit or building — one entity per press (never the whole group, so a misclick cannot erase an army), no refund, enemies/resources/empty selections refused. It flows through the recorded `entity.delete` command (validator enforces ownership), so replays reproduce deletions and the same destroy ops as combat settle population, refs, and rally points. AoE2's own affordance for freeing population space or clearing a misplaced building. **The town bell (v0.3.115).** The Town Center's command card carries "Ring Town Bell": every villager runs for the NEAREST owned shelter with free room (any complete villager-admitting garrisonable — TC, towers, castle; assignment fills capacity greedily so an overflowing house sends the rest next door), walking in through the ordinary garrison-walk order. "Back to Work" (offered once anyone shelters anywhere) releases VILLAGERS ONLY from every owned building — a deliberately-garrisoned soldier stays on the wall. Both are `building.action` commands, so replays reproduce the alarm; the bell acts on the rung building's OWNER, not just that one building. The modifier is read from the pointer event, so there is no armed mode to enter or cancel and the target building is still chosen by pointing at it. Alt+right-click on anything that is not an owned garrisonable building falls back to the ordinary right-click behavior for that target.

Right-click's other routings are unchanged: enemy units/buildings/wildlife are attacked, resources are gathered by villagers, and a damaged owned building is still repaired by a villager (repair is a distinct AoE2-faithful action the directive did not touch).

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

**Town Center shelter (corrected 2026-08-23).** A Town Center holds **15 units** and fires **one arrow per sheltered unit to a ceiling of 10** — `structures.csv`'s "15 units (supports 5 population)" and "max 10 arrows". It had held 5 and fired at most 5, which let a base under raid shelter about a quarter of its villagers. The empty Town Center's single base arrow (§10.8) is this game's deliberate departure from AoE2, where an empty Town Center does not shoot at all, and it stays: it is what gives a Dark-Age economy any passive defence.

**Garrisoning is an ORDER, not an instant effect (corrected 2026-08-23).** A unit told to garrison WALKS to the building and goes inside when it arrives — AoE2's behaviour, and the reason garrison is a `garrison` unit command with the building's `EntityRef`, advanced by the same player-commands loop that walks a builder to its site. A unit already standing against the footprint (Manhattan distance ≤ 1 from any of its cells) enters immediately, so a point-blank order still feels instant. Entering from ANY distance, which is what the game did before, made garrison a free escape from anything chasing the unit — and it is exactly the mechanism a raid response leans on, so the distance has to be paid. The order survives a save: the command type is additive in the save schema, and an older save simply never carries one.

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

A ranged attack does not subtract HP where it is ordered. It launches a projectile that travels, and resolves where and when that projectile lands.

Who fires one: every non-melee attacker whose attack range exceeds 1 — the archer line, skirmishers, cavalry archers, the mangonel line, scorpions, bombard cannons, trebuchets, and arrow-firing buildings. Melee attacks (infantry, cavalry, rams) resolve instantly as before, and a Monk's range is conversion, not an attack.

A shot carries these, all fixed at launch:

- **wind-up** — `attack_delay` seconds x TPS, rounded to whole ticks. The projectile exists in the simulation immediately but does not leave the attacker (and is not drawn) until the wind-up elapses. A Cavalry Archer's full second of wind-up is why it feels sluggish despite a short reload.
- **travel time** — Euclidean distance divided by the weapon's speed in tiles per tick, at least 1 tick, so a shot is always observable in the air. Arrows fly at roughly AoE2's 7 tiles/second; siege stones are slower, a trebuchet boulder slower still, and a cannonball is the fastest thing on the field.
- **to-hit** — one roll against the attacker's `accuracy` from `units.csv` (Archer 80%, Crossbowman 85%, Arbalest/Skirmisher 90%, Cavalry Archer 50%, Longbowman 70%, Bombard Cannon 92%, Scorpion 100%, Trebuchet 15%). Buildings do not dodge, so a shot at a building always connects; the mangonel line never rolls at all, because its damage comes from the blast at the impact point.
- **aim point** — where the shot is going. A truly-aimed shot without ballistic leading aims at the cell the target occupies at launch; a shot that fails its roll aims at a scattered point past hit tolerance but still in the target's neighbourhood, so misses land elsewhere rather than vanishing.
- **damage** — the attacker's attack stat. A building-targeted shot additionally carries its anti-building total; that total must never reach units, or a siege weapon's anti-building bonus would leak into its own blast.

The shot resolves on its impact tick, whatever has become of the attacker in the meantime — a loosed projectile is a committed event, and an attacker that dies mid-flight still lands its shot. A direct hit requires a live target still standing at the aim point; the target's armor and class bonuses are applied then, against the target as it is at impact. **This is what makes a moving target evade fire: the shot went where the target was, and the target is no longer there.** Blast weapons splash at the impact point regardless of whether anything was hit, so a stray siege stone is still dangerous — to both sides.

Determinism: the to-hit roll is a pure hash of the shot's identity (launch tick, attacker id, target id, and the projectile's own id), not a draw from a stored random stream. Nothing extra is serialized, a match saved with shots in the air reloads with those same shots and the same outcomes, and replays match by construction. A stateful stream would instead desynchronise the moment the number or order of rolls changed.

A shot is always aimed INSIDE the map. The miss scatter is an offset in any direction from the target, so a target standing on an edge could otherwise be missed off the board; the aim point is clamped to the map at launch, which keeps every interpolated position between origin and aim on the map as well. Clamping cannot turn a miss into a hit — whether a shot connects is decided by its `willHit` roll before the aim point is chosen. The drawing pass additionally SKIPS any shot whose current position is off the map rather than asking whether that cell is visible, because the engine's visibility map treats an out-of-range coordinate as an error rather than answering false: a projectile restored from an older save must not be able to end a match.

In-flight projectiles are simulation state and persist in saves. They are fog-gated for display on their current position: a shot crossing into your vision becomes visible and leaves again if it exits, and a projectile has no memory state — you either watch it fly or never knew it was fired.

**Ballistics** (University, Castle Age, 300 wood + 175 gold, 60s):

- every shot the owner fires — units AND building arrows alike — aims at the spot its target is moving towards instead of where it stands. The lead runs along the target's current move order at unit movement speed, and is capped at that destination: leading past a unit that is about to stop is how a "smart" shot would miss a stationary target. A target with no move order is not led. This is a per-OWNER property derived at the launch site, matching technologies.csv's "Arrow/Bolt-firing units; Buildings; Bombard Towers" scope.

**Thumb Ring** (Archery Range, Castle Age, 300 food + 250 wood, 45s):

- 100% accuracy for the archer line (Archer/Crossbowman/Arbalest, plus Longbowman) and the cavalry-archer line. Skirmishers, siege, and gunpowder are deliberately outside its scope, matching technologies.csv's "Archer;Cavalry Archer".

**Parthian Tactics** (Archery Range, Imperial Age, 200 food + 250 gold, 65s):

- the cavalry-archer class gains +1 melee / +2 pierce armour, and its attack against the spearman armour class rises — +4 for the Cavalry Archer line, +2 for the Mangudai line, matching technologies.csv's "+1/+2 AR and Cavalry Archer +4 and Mangudai +2 against pikemen". The class is the MOUNTED archers (Cavalry Archer, Heavy Cavalry Archer, Mangudai, War Wagon and their elites), which is deliberately not the foot-archer set the Blacksmith's archer armour line covers: a cavalry archer takes its armour from this technology instead.
- the two halves ride different seams for a reason. The armour is per-unit state, applied to the units already standing when the research completes and to every one created afterwards, exactly like the Blacksmith armour line. The attack bonus is DERIVED at the damage site from the owner's researched set, because it depends on the TARGET's armour class — which is known only when the arrow lands, not when it is loosed. The War Wagon takes the armour and no attack bonus: its own units.csv row carries no anti-spearman value.

The **University** (Castle Age, 200 wood, 60s build, 2100 HP, 2x2) trains no units and counts toward the Castle-Age building requirement for advancing to Imperial. It hosts Ballistics plus the building-defence technologies:

| Technology | Age | Cost | Effect |
| --- | --- | --- | --- |
| Masonry | Castle | 150 food, 175 wood | Building hit points x1.1 |
| Architecture | Imperial | 300 food, 200 wood | Another x1.1, so x1.21 with Masonry (requires Masonry) |
| Treadmill Crane | Castle | 300 food, 200 wood | Builders work 20% faster |
| Heated Shot | Castle | 350 food, 100 gold | Defensive-building fire x2.25 against ships and camels |

Masonry and Architecture apply BOTH ways, like Loom: the buildings already standing are raised when the research completes, and everything built afterwards is created at the higher figure. A damaged building keeps its damage — the upgrade raises the ceiling, it does not repair. Their AoE2 armour halves (+1/+1 unit armour, +3 building armour) are pending because buildings carry no armour value at all today; adding one is a combat-model change rather than a technology.

Treadmill Crane advances the build counter by a FRACTIONAL amount rather than rounding the multiplier to a whole tick, which would be a silent no-op. Heated Shot is applied at the moment a shot is launched, so the multiplier is fixed by what the tower aimed at rather than by whatever the arrow lands on.

**The Transport Ship (implemented v0.3.37).** A Dock-trained water unit from the Feudal Age (`units.csv`: 125 wood, 45 s, 100 hit points, 4/8 armour, speed 1.45, line of sight 5), and the only way a land army crosses water. It carries **five** units; it has no attack of its own.

**Who may board.** Land units only. A ship may not board a transport — it can already cross water under its own power, and a transport carrying a transport would undo the point of the thing.

**Loading and unloading both ride the ordinary right-click**, as they do in AoE2. Sending a land unit at a friendly transport puts it aboard. Sending a loaded transport at a LAND cell puts its cargo ashore there: each unit takes the first legal cell near the target, and any that cannot be placed stays aboard rather than vanishing, so a transport ordered onto a crowded beach unloads what fits and keeps the rest. A transport ordered at land does not move there itself — it cannot — so without this the order would be one it could never complete, and unloading is the only reason to point a transport at land in the first place.

**The cargo rides the same side maps a building's garrison does.** Both store plain entity ids on either side, so a loaded transport survives save, load and replay exactly as a garrisoned Tower does, with no save-format change. Careening and Dry Dock (the Dock technologies that raise capacity to 10 and 20) are not implemented, so five is the whole story for now.

**Minimum range on defensive buildings, and Murder Holes (implemented v0.3.35).** A Watch Tower, Bombard Tower, or Castle shoots down from arrow slits, so it CANNOT hit a unit standing against its own footprint: targets one cell out from the footprint are out of reach, and everything from two cells to the building's normal range is fair game. That is what makes walking infantry right up to a tower a real tactic rather than a mistake. **Murder Holes** (University, Castle Age, 200 food + 200 stone, 600 ticks — `technologies.csv`, "Towers and Castles minimum range removed") removes it for every one of the owner's defensive buildings. Both are DERIVED from the owner's researched set at the fire site (`buildingMinimumRange`), so there is no per-building state and no save-format change, and an un-teched owner behaves identically to before for anything two cells or further out. **The Town Center is deliberately excluded** and has no minimum range with or without the technology: under a Town Center is exactly where villagers gather and where they garrison from when raided, so a Town Center that could not defend them would be a trap rather than a tactic. Existing combat fixtures that placed a target inside or against a defensive footprint had to move out by a cell — a witness under the arrow slits is never shot at all.

**Fortified Wall** (Castle, 100 wood + 200 food) takes a Stone Wall from 1800 hit points to 3000, and **Bombard Tower** (Imperial, 800 food + 400 wood) unlocks the building of the same name. Both ride the same per-building hit-point seam as Masonry, which also finally carries the hit-point half of the tower upgrades: Guard Tower takes a Watch Tower from 1020 to 1500 and Keep on to 2250, alongside the attack and range they already gave.

The **Bombard Tower** (Imperial, 25 wood + 125 stone, 1x1, 2220 HP) is the heaviest defensive building short of a Castle: 120 damage on a six-second reload at range 8, against a Watch Tower's 5 on two seconds. It is not offered by age alone — a villager sees it only once the University technology is researched, which is the only entry in the build menu that asks about a technology rather than an age or a prerequisite building.

Still pending at the University: Murder Holes, which removes a MINIMUM range that buildings do not have yet.

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

**Block Printing (implemented v0.1.58; AoE2-faithful stats v0.3.91).** A Monastery monk-upgrade tech, per technologies.csv:69: IMPERIAL Age, no prerequisite, 200 gold, 550 ticks. It grants the owner's monks +3 conversion range. The base monk CONVERSION range is 9 (AoE2's value, distinct from the hands-on action range of 4 that heal/pickup/deposit use — v0.3.91 split the two after shipping with a uniform 4), so Block Printing stretches conversion to 12. Until v0.3.91 this tech was Castle Age at 100 food / 130 gold granting +2 on the uniform base 4 — superseded for DE fidelity. The bonus is DERIVED (pure) from the owner's researched-tech set at the monk's action site (`monasteryTechEffects.monkConvertRangeBonus`, read in `monkBehaviorSystem`) — no per-monk state, no save-format change, and it applies to existing and future monks alike. It affects only convert tasks (heal/pickup/deposit keep the base range). Implementation note on determinism: this build models conversion as a DETERMINISTIC progress ramp (fixed progress-per-tick to a flip threshold), NOT the probabilistic window above, because the simulation must be replay-deterministic — so Block Printing is modeled as a flat integer range bonus, never a probability change. **Sanctity (implemented v0.1.59).** The second Monastery monk-upgrade tech: Castle Age, no prerequisite, 120 gold, 600 ticks. It grants every one of the owner's monks +15 max HP (a 30-HP monk becomes 45), applied FLAT to current + max exactly like Loom for villagers — imperatively bumped on research for existing monks (`sanctityEffect.applySanctityToOwnedMonks` in `technologyOps`) and via `createCombatState` for future monks. No save-format change. **Faith (implemented v0.1.61).** The third Monastery monk-upgrade tech, and a defensive one: Imperial Age, no prerequisite, 750 food / 1000 gold. A unit whose OWNER has Faith accumulates incoming enemy-monk conversion progress at HALF the normal rate (a fixed ×0.5 multiplier applied at the convert-progress site, keyed on the target's owner — `monasteryTechEffects.monkConvertProgressMultiplier`), so it takes about twice as long to convert. Faith SLOWS conversion, it does not grant immunity. Deterministic (a fixed multiplier, not a probability roll — consistent with the deterministic-ramp conversion model). No per-unit state, no save-format change. **Herbal Medicine (implemented v0.1.70).** A Monastery tech (Castle Age, no prerequisite, 350 gold, 350 ticks — `technologies.csv:65`, "Garrisoned Units 4x healing speed") that makes every GARRISONED unit belonging to the owner heal 4× as fast. It is a flat DERIVED multiplier (`monasteryTechEffects.garrisonHealRateMultiplier` = 4 with the tech, 1 without) on the passive garrison-heal rate (§9.6), read from the owner's persisted researched-tech set in `garrisonHealSystem` and keyed on each garrisoned unit's owner — so the base rate stays byte-identical without the tech, no per-unit state is added, and there is no save-format change. Unlike the monk techs above it targets garrisoned units of any type, not monks. **Heresy (implemented v0.1.71).** A Monastery tech (Castle Age, no prerequisite, 1000 gold, 600 ticks — `technologies.csv:66`, "Converted units die") that denies your units to the enemy: when an enemy monk's conversion of one of YOUR units completes, the unit DIES instead of switching sides. DERIVED at the conversion flip site (`applyMonkConvert`): the target owner's researched set — already read there for Faith — is checked via `monasteryTechEffects.convertedUnitDies`; if it has Heresy, `destroyUnitEntity(target)` runs instead of `flipConvertedUnit` (full cleanup — population, combat/monk state, conversion state, occupancy). Heresy does NOT prevent or slow conversion (that is Faith); it changes only the OUTCOME. Keyed on the target's owner, deterministic, no per-unit state, no save-format change; no fixture grants it, so all pre-Heresy conversions flip exactly as before. **Atonement, Redemption, and Fervor (implemented v0.3.32).** The rest of the Castle-Age Monastery tier, all three at the Monastery with no prerequisite (`technologies.csv` rows 63/64/67 — Atonement 325 gold / 400 ticks, Fervor 140 gold / 500 ticks, Redemption 475 gold / 500 ticks).

**Careening, Dry Dock and Shipwright (implemented v0.3.51).** The Dock's three technologies, all of which act on every SHIP rather than on one line, and all scoped by the water DOMAIN so a ship added later is covered the day it exists.

- **Careening** (Dock, Castle Age, 250 food + 150 gold, 50s): +1 PIERCE armour and no melee armour — technologies.csv says "+0/+1", making it the only armour technology in the game with no melee half, so it bumps the pierce-only accumulator directly instead of going through the shared armour path. It also raises a Transport Ship's capacity by 5.
- **Dry Dock** (Dock, Imperial Age, 600 food + 400 gold, 60s): every ship moves 15% faster, and a Transport Ship carries 10 more.
- **Shipwright** (Dock, Imperial Age, 200 wood + 1000 food, 60s): a ship's WOOD cost falls 20% (a Galley's 30 gold is untouched) and its build time falls 35%. The cost discount is applied at `effectiveTrainingCost`, the single seam every charge and every affordability check already shares, so the price a player is quoted, gated on and charged cannot disagree.

The three are CHAINED as AoE2 DE chains them — Dry Dock requires Careening, Shipwright requires Dry Dock — which technologies.csv does not state. Transport capacity is 5 + 5 + 10 = 20 with both, matching units.csv's "Garrison inside 5 (10 with careening and 20 with dry dock)", and the two bonuses are keyed on the technologies alone rather than on the menu chain, so the number is right however the researched set was reached. A selected Transport Ship reports its cargo against that capacity (`3 / 20 aboard`) in the selection panel's inventory line — without it the capacity a player bought would be invisible.

**Hoardings (implemented v0.3.57).** Castle, Imperial Age, 400 food + 400 gold, 75s: this owner's CASTLES gain 21% hit points, 4800 to 5808, which is technologies.csv's "+21% HP (HP*1.21 - 5808 HP)" read literally. It rides the per-building hit-point seam beside Fortified Wall and the tower upgrades, so castles already standing are raised on completion and later ones are created at the higher figure; Masonry and Architecture, which apply to every building, multiply on top.

**El Dorado (implemented v0.3.57).** The Mayans' Imperial unique technology, Castle, 750 food + 450 gold, 50s: +40 hit points to the Eagle line. It was deferred with the note "Eagle Warriors are not on the roster" — true when written and false from v0.3.48, which is the argument for re-reading a deferral list whenever the roster grows rather than trusting it.

**Guilds (implemented v0.3.64).** Market, Imperial Age, 300 food + 200 gold, 50s — technologies.csv's "Commodity trading fee - 15% (from 30%)". The Market's fee is the spread between what a buy costs (`rate x (1 + fee)`) and what a sell returns (`rate x (1 - fee)`), so halving it improves both directions at once, and it is worth more the more a player trades. Derived per owner at the transaction site from the researched set, so it applies to every Market that owner has and to none of anybody else's.

**Cartography (implemented v0.3.63).** Market, Feudal Age, 100 food + 100 gold, 60s — technologies.csv's "See ally line of sight", and the first technology the Market has ever hosted here. The researcher's projected frame unions its allies' visible AND explored cells with its own, and a projectile over an ally's ground is drawn for the same reason. It is ONE-WAY: researching it tells you what your allies see and tells them nothing of yours, which is how AoE2 plays it.

The owners whose vision is shared come from `sharedVisionOwners` — empty without the technology, empty without allies, so a match with neither projects exactly the cells it always did, in the same order. It is read per FRAME rather than cached, because researching it mid-match has to take effect on the next frame rather than the next reload.

Coinage and Banking arrived with tribute in v0.3.67 (§6.8), Guilds with commodity-fee reduction in v0.3.64, and Caravan with land trade in v0.3.68 (§6.7) — the Market's technology list is complete.

**Teams (implemented v0.3.62).** §2.2 puts "optional AI allies" in scope, and until this there was no notion of a side anywhere in the simulation: every owner that was not you was an enemy. A team is a NUMBER PER OWNER (`playerTeams`), and an owner with no entry is its own team — so a free-for-all stores nothing at all, an existing save loads as one, and every match played before teams existed behaves identically.

`areAllied` / `isEnemyOwner` (alliances.ts) are the single answer to "is this somebody I should be shooting at", and every enemy test in `targetFindingOps` goes through them — which is what makes an ally safe from auto-aggression, from tower fire, from the AI's chosen target and from a monk's conversion in one change rather than five. Conquest follows the same rule: the match is decided when every other SIDE is eliminated, not every other player, which is what makes an ally worth having rather than one more player to outlive. Defeat is still personal: your own units and buildings gone is a defeat whether or not your ally fights on.

Teams are chosen with `?teams=1,1,2` — one number per player, in owner order, from 1. Anything unusable warns and leaves a free-for-all, including putting every player on one team, which would be a match nobody can win.

Deliberately listed rather than assumed as still-open team work: ordering your own units to attack an ally.

**Player count (implemented v0.3.61, all eight seats v0.3.66).** A standard map opens with 2 to 8 players — §4.2's full range — chosen with `?players=n` and defaulting to 2. Each seat has a fixed start position and civilization for its count, so a match is reproducible from its seed and its count alone, and the two-player row is the established 1v1 cell for cell. A count outside the range warns and opens the ordinary 1v1 rather than refusing to start: a bad URL should not stop a game.

**The map grows with the count — §4's size ladder (implemented v0.3.66).** Land per seat is held at roughly the two-player map's own figure (about 1050 tiles), and the 5:3 shape is kept at every rung, so a six-player game is the same game with more of it:

| Players | Map | Tiles per seat |
| --- | --- | --- |
| 2 | 60 x 36 | 1080 |
| 3 | 72 x 44 | 1056 |
| 4 | 84 x 50 | 1050 |
| 5 | 92 x 56 | 1030 |
| 6 | 100 x 62 | 1033 |
| 7 | 110 x 66 | 1037 |
| 8 | 116 x 72 | 1044 |

Three and four seats keep the shapes they had — a triangle and the four corners. Five and up walk the inset rectangle's perimeter at equal arc length, so eight players stand as far from each other as four do, nobody opens in the middle, and every seat is the same distance from the edge.

The map size is therefore a per-match value, not a constant: the world grid, the fog map, every clamp that pulls a coordinate back onto the board (a click, a drag box, the camera's reach, a unit's position, a missed arrow's aim) and the cell indices in a projected frame all read it from the world being played rather than from a global. A stale constant there does not throw — it silently answers 59 for every cell past the two-player map's right edge, which is most of an eight-player one.

**The forward outpost is a 1v1 landmark.** The default map stands a house and a scout for player 2 near the middle, for the human to find. With more than two seats that is a gift to exactly one opponent, so from three players up nobody gets it and every opening is identical.

Fixtures are unaffected — a fixture's whole purpose is a fixed layout, so the count reaches only the procedural map.

**Player colours (implemented v0.3.60).** §2.2 puts "AI opponents" and "optional AI allies" in scope, so a skirmish is not a 1v1 — and every tint in this build was a PAIR, `human` and `enemy`, which painted owners 2, 3 and 4 the same shade. Each owner up to `MAX_PLAYERS` (8, AoE2's own limit) now has its own colour, and the art is unchanged: each unit and building keeps the pair that carries its material identity, and the OWNER applies a luminance-preserving hue rotation on top of the enemy shade — green, yellow, cyan, purple, grey (a desaturation rather than a rotation) and orange for owners 3 to 8. Owners 1 and 2 rotate by zero, so every colour, screenshot and characterization hash of an existing 1v1 is untouched. A ninth owner wraps onto the first player's colour rather than falling through to the second's, which would recreate the very collapse the rule exists to prevent. Because the minimap draws each entity with the same tint, it inherits this for free.

**The Petard (implemented v0.3.59).** Demolition infantry, Castle Age, trained at the Castle for 80 food + 20 gold in 25s: 50 hit points, 0/2 armour, movement 0.8, line of sight 4, attack 25 with +500 against buildings — and `detonatesOnAttack`, so it is spent by its own explosion. It is CASTLE age rather than Imperial, unlike the Trebuchet, because it is the early answer to a wall rather than a late siege engine.

Two deliberate simplifications, both from units.csv's shape rather than the unit's: the row's per-target-kind bonuses ("+500 buildings;+100 castle;+60 siege;+900 walls & gates") are a single number per attacker in this build, so the base +500 lands and the castle/wall/siege halves do not — which means a petard damages a stone wall heavily rather than felling it, as it does in AoE2 with the full bonus. Its armour class is `infantry` + `siege`, matching AoE2's classification, so anti-siege units answer it; its render ROLE is infantry, because a petard is a man carrying a keg rather than a wheeled engine, and its identifying prop is that keg.

**Detonating units (implemented v0.3.58).** The demolition line is consumed by its own attack, which units.csv states outright for the Demolition Ship: "Filled with explosives. Self-destructs when used." The rule is `detonatesOnAttack`, applied at BOTH damage sites — against a unit and against a building — after the damage and the blast have landed, so the explosion is never lost. No kill is credited for the detonator: nobody killed it, its owner spent it. Without this the line is a repeating area weapon with the widest radius in the game (2.5 and 3.5 cells) and no cost for firing, which is a different unit from the one the data describes. The Petard, when it lands, is the same rule on land.

**Shore fishing (implemented v0.3.56).** Age of Empires II has two kinds of fish and only one needs a boat: SHORE fish sit in the shallow water against the coast and are gathered by VILLAGERS standing on the land beside them, with no Dock and no Fishing Ship; everything further out is fishing-ship work. This build models fish as a single water resource, so the distinction is GEOMETRIC — a fish with a land cell among its eight neighbours is a shore fish (`shoreFishing.isShoreFish`), and the domain rule that otherwise keeps land gatherers off water resources makes exactly this exception (`canGathererHarvest(..., { onShore })`). That geometry is also the honest form of what the domain rule was protecting: a villager sent at open water walks to the coast and stands there forever, while a villager sent at a fish it can stand beside simply works it. A fishing ship may work a shore fish too.

**Hunting parties (implemented v0.3.56).** A live boar is not a gatherable resource — it has to be killed first, and it kills a lone villager. The AI therefore sends a PARTY of four (never fewer than three) at the nearest boar within 20 cells of its Town Center, using the same order a player's right-click issues. It does this only when its villagers have nothing else to gather at all: no tree, no berry, no mine, no farm, no carcass and no shore fish. Ordering idle villagers to hunt on any weaker signal drags newly-trained villagers across the map instead of letting them work — measured as both players stuck in Feudal at tick 40000 hoarding 15k food, on a seed that otherwise reached Imperial.

**Monk FAITH and rest, with Illumination and Theocracy (implemented v0.3.50).** A monk that completes a conversion is SPENT: its faith empties and it cannot convert again until the faith is back — the AoE2 rule that stops massed monks from being an answer to everything, and the mechanic both remaining Monastery technologies act on. Faith runs 0..100, is full at creation, and comes back linearly over 620 ticks (62 s at 10 TPS, AoE2's rest time). `design/stats` does not carry that duration — `technologies.csv` only describes Illumination's "faith regain 50% faster" relative to it — so the figure is stated here and lives in `MONK_FAITH_MAX` / `MONK_FAITH_RECHARGE_TICKS`. The state is `monkFaithCodec`, monkId → current faith, where an ABSENT entry means full: the map holds only the resting monks, so a save written before this mechanic loads as every monk rested and no migration is needed. A resting monk KEEPS its convert task and stands where it is (the same shape as the vision interrupt), resuming the instant its faith returns rather than having the player's order silently dropped — and the selection panel reads **Resting** rather than Converting for it, because a monk that cannot act on the task it holds should not claim to be working. Faith is spent at the completed conversion, whichever way that conversion ends: Heresy denies the converter the unit, not the effort. Faith is spent only by a COMPLETED conversion — an interrupted or abandoned attempt costs nothing, which is a deliberate simplification of AoE2's continuous drain, chosen because the observable rule ("a monk must rest after converting") is what the technologies act on.

- **Illumination** (Monastery, Imperial Age, 120 gold, 65s): faith comes back 1.5× as fast. Applied as a per-tick RATE derived from the owner's researched set, not a duration stamped when the rest begins, so researching it mid-rest speeds up the rest already in progress.
- **Theocracy** (Monastery, Imperial Age, 200 gold, 75s): only ONE monk in a group pays for a conversion. Without it, every monk of that owner whose convert task pointed at the same target is spent when one of them completes it — send five monks at one unit and all five rest. With it, only the monk that completed the conversion rests. The monk that completed it always rests, with or without the technology.

**What a monk may convert is now a rule rather than an assumption.** Before this, a monk could be sent at ANY enemy unit, including an enemy monk — which is exactly what Atonement is supposed to buy, so the un-teched behaviour was wrong. `monasteryTechEffects.monkMayConvert` is the single answer, read at the conversion site: an ordinary enemy unit needs no technology; an enemy MONK needs **Atonement**; a SIEGE engine needs **Redemption**. A monk whose task names a target it may not take abandons that task rather than stalling on it, so it is free for something it can do.

**Redemption is complete (building half v0.3.100).** The rule also states which BUILDINGS a monk could take — everything except a Town Center, Castle, Wonder, farm, or any wall-line building (wall or gate), which AoE2 puts permanently out of reach because losing one to a single monk would decide a game outright. Nothing targets a building for conversion yet, so that branch is not reachable in play: converting a building means transferring its production queue, population supply, garrison, vision, and occupancy to a new owner, and that is implemented v0.3.100: the enemy-building convert task routes through the same context click (eligibility asked at the CLICK so an ineligible target stays an ordinary walk), shares the faith, Faith-resistance, Teuton-team, and per-tick guards with the unit lane in its own module (`monkBuildingConversion.ts`), STALLS while anyone shelters inside (an occupied building holds out), and on the flip carries ownership, tint, vision, clears the loser's production queue without refund, and moves POPULATION SUPPLY — subtracting what the building gave its old owner (their civ bonus included) and adding what it provides the new one, both caps re-derived. Heresy does not apply (converted UNITS die; buildings just change hands).

**Fervor** grants the owner's monks +15% movement speed, on the ordinary movement-speed seam (`movementTechEffects`, a ×115% multiplier applied when the unit is a monk) rather than through any monk-specific path — a monk is neither mounted, infantry, nor a villager, so none of the existing branches would ever have reached it. Derived from the researched set, so it applies to existing and future monks alike with no per-unit state and no save-format change.

**Illumination and Theocracy remain deferred**, both on the same missing mechanic: this build has no monk FAITH (the rest period after a conversion during which a monk cannot convert again). Illumination regenerates faith 50% faster and Theocracy makes only one monk of a converting group spend it; neither means anything until faith exists. They are not shipped as no-ops.

### 10.10 Healing

Monks must support:

- healing damaged friendly units
- healing range modifiers
- heal-rate modifiers
- relic carrying constraints

**Self-healing units.** One unit line heals itself with no monk, no building and no research: the Vikings' **Berserk** and **Elite Berserk**, at **1 HP every 3 seconds** (1/30 HP per tick at 10 ticks per second). **Berserkergang** doubles it to 2 HP every 3 seconds — `technologies.csv`'s figure is the TECHED rate, so the base is half of it. The heal follows the same three rules as the garrison heal it sits beside: it never exceeds the unit's maximum, never revives a unit at 0 HP, and has no random component, so a replay reproduces it exactly. It applies wherever the unit stands, including mid-fight, and no other unit in the game regenerates.

A self-heal moves a health bar with no command, no attack and no death behind it, which is the only kind of change the renderer cannot infer: the regeneration system marks an out-of-band render change on any tick that heals someone, exactly as the damage sites do. Without that the bar sits at the wounded value until the player clicks something — the state is right and the screen is wrong.

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

**Mongols — Hunters work 50% faster (implemented v0.1.98).** A Mongols player's villagers gather from BOAR 50% faster. Same seam as the Britons shepherd bonus: `civGatherRateMultiplier` returns 1.5 only for `civilization === 'Mongols'` and `resourceKind === 'boar'`, multiplied with the tech gather-rate at the same villager gather-tick site. Boar-specific — boar is the game's only huntable food (sheep is a herdable, carried by the Britons bonus; fish is fished), so "Hunters" maps to boar; herded sheep, berries, farms, wood, and gold are unaffected. Active from the Dark Age with no prerequisite; non-Mongols owners are byte-identical. Note: boar is huntable wildlife that fights back (§—wildlife combat), so in practice a player must commit enough villagers to kill it before harvesting the meat; the bonus applies to that harvesting once it begins.

**Mongols — Light Cavalry and Hussars have +30% HP (implemented v0.1.99).** A Mongols player's upgraded scout-line units — Light Cavalry and Hussar — have 30% more HP. Same seam as the Franks knight-HP bonus: `civUnitHpMultiplier(civilization, unitType)` returns 1.3 only for `Mongols` + a unit in `{light-cavalry, hussar}`, applied to the BASE HP at combat-state creation before flat tech bonuses add (so it composes with Bloodlines rather than stacking multiplicatively on it). Scoped to the UPGRADED line per the CSV wording — the base Scout Cavalry is excluded (it instead carries the scout-line +2 line-of-sight). Present from unit creation (no research/imperative path); a save/load or replay reproduces it from the persisted civilization. Non-Mongols owners are byte-identical.

**Civilization-bonus breadth (v0.3.77, superseding the 2026-07-05 five-civ cap).** The July scope decision capped bespoke identities at five civilizations so effort would concentrate on completing the game first. That concentration has happened — the unique-unit roster (16 civs, v0.3.20) and unique-technology roster (19 of 19, v0.3.70) quietly outgrew the cap long ago, and the core game is feature-complete — so the cap is superseded (recorded in `docs/architecture/decisions.md`): bonuses now come from a declared table (`civBonusTable.ts`, the `uniqueTechnologies` pattern) carrying **every `civilizations.csv` line the derived seams can express**, across six seams: gather rate (Britons sheep, Mongols boar, Celts wood, Koreans stone, Turks gold, Slavs farms, Indians fish), unit HP (Franks knights, Mongols light cavalry, Chinese demolition ships, Japanese fishing ships, Saracens transports, Turks gunpowder, Portuguese ships), anti-building attack (Goths infantry, Saracens cavalry archers), train time (Aztecs military), movement speed (Celts infantry, Berbers villagers and ships, Ethiopians foot archers — composing with Squires/Husbandry in the movement seam), and training cost (Goths, Byzantines trash lines, Huns and Mayans and Indians age-scaled, Berbers stables, Magyars scouts, Vikings warships, Italians gunpowder and fishing ships, Portuguese gold component); a seventh family (v0.3.85) pays a stockpile grant when an age advance completes — Ethiopians +100 food +100 gold, the CSV's "Receive +100 gold and +100 food when advancing to the next age", applied in the three age cases of technologyOps the moment the advance lands. An eighth family (v0.3.86) is AGE-SCALED HP: Viking infantry (Berserks included) and Vietnamese Archery Range units at +10/15/20% from the Feudal Age, Byzantine buildings at +10/20/30/40% from the Dark Age. Two halves in the Hoardings shape: creation multiplies by the current age's factor (combatStateFactory / the building HP seam), and the three age cases sweep standing entities by the factor RATIO — new step over old — so the ladder replaces rather than compounds (the CSV's "does not stack"), damage stays absolute, and full stays full. Unit-line upgrades re-derive through the age-aware factory, so an upgraded unit lands on the right rung automatically. Three more one-offs landed in v0.3.87: the Goth "+10 to population limit in Imperial Age" raises the owner's HARD cap through `ownerHardPopCap` — a single derivation every deriveCap site reads (match setting + civ bonus), recomputed the moment Imperial lands and unconditionally on load (the decode-time cap uses the default and is corrected once civs and ages are in hand); Korean watch towers (not bombard towers) reach +1 in Castle / +2 in Imperial, derived at the tower's fire site beside the Guard Tower/Keep ladder; and Japanese Fishing Ships work +5/10/15/20% by age as a multiplier in the ship's gather loop (villagers shore-fishing are unaffected). The Vietnamese "Reveals enemy positions at game start" landed in v0.3.88: at post-seed, each Vietnamese owner stamps every other player's Town Center area EXPLORED by parking a temporary vision source over it and updating the map (explored is monotonic in the engine, so the knowledge survives the source's removal — no engine change), and for the human player the enemy Town Centers are also written into fog memory so the reveal renders as the familiar last-seen ghost on fogged ground rather than bare terrain. The capture script gained a CIV env (`scripts/captureMapScreenshot.mjs`) because a civ-specific visual can only be SEEN booted as that civ. The Khmer pair landed in v0.3.89: "Prereq buildings aren't required to advance to further ages or unlock other buildings" bypasses the two-buildings age gate (age sequence still holds) in the three canAdvance checks AND satisfies every building-standing prerequisite in the villager build menu (age gates inside stay in force); "Villagers can garrison in Houses" gives Khmer houses a garrison of five, villagers only, threaded through the same eligibility (canGarrisonAt now takes the building owner's civilization) and capacity (base + Khmer house 5, then the Teuton multiplier) seams every entry check, HUD count, and ungarrison button reads. The Incas' "Villagers affected by Blacksmith upgrades" landed in v0.3.90: the infantry ARMOR line (Scale/Chain/Plate Mail) reaches Inca villagers at both halves — the research sweep (one shared scope predicate in technologyOps) and the combat-state factory — while the melee ATTACK line (Forging tier) already reaches every civilization's villagers because villagers are melee units, exactly as in AoE2.

**Unit class predicates derive from the armor-class taxonomy (v0.3.93).** `isInfantryUnit` reads the `UNIT_ARMOR_CLASSES` 'infantry' membership — the militia and spear lines, the Eagle line, and every unique infantry (Berserk, Huskarl, Samurai, Jaguar Warrior, Teutonic Knight, Woad Raider, Throwing Axeman) — so the blacksmith infantry armor techs, Squires, Tracking, Sappers, Garland Wars, the Viking HP ladder, and the infantry civ bonuses reach all of them, as in AoE2. `isCavalryUnit` adds every MELEE unit with the cavalry armor class (Cataphract, Tarkan, War Elephant, Conquistador) while mounted archers keep the archer armor line and the Missionary stays a monk. The Forging line's scope is now the explicit `takesMeleeAttackTechs` — infantry + cavalry + villagers — which FIXES a fidelity bug: rams rode the old melee gate and wrongly gained melee attack techs.

**AI tribute (v0.3.92).** An AI with a completed Market keeps its ALLIES solvent: when an ally's stockpile of a resource is under 150 and the AI holds at least 1000 of it, it sends a 100 chunk (paying the standard fee itself) through the same recorded `tribute.send` channel a human uses — the direct executor re-validates the Market, both stockpiles, and the fee at execution time. One chunk per decision tick; enemies are never topped up. Presence-over-optimum constants (`aiTributePhase.ts`), the trade-cart-cap scale.

**Free technologies (v0.3.78).** Twelve civilizations' "X free" lines are live: the technology researches itself, instantly and at no cost, the moment the owner could legally research it — its age reached and a completed building standing whose research MENU offers it (the grant asks `getResearchOptions`, so every prerequisite rule lives once and the free path can never reach something a player could not). Aztecs Loom, Byzantines Town Watch, Franks farm upgrades (Mill required, as in AoE2), Koreans Guard Tower and Keep, Teutons Murder Holes, Turks Chemistry and the light-cavalry upgrades, Vikings Wheelbarrow and Hand Cart, Burmese lumber upgrades, Ethiopians spear-line upgrades, Magyars the forging line, Malians gold mining, Slavs Tracking.

**Opening bonuses, carry, and housing (v0.3.79).** The starting-stockpile deltas (Chinese -50 wood -200 food, Huns -100 wood, Persians +50 wood +50 food, Mayans -50 food) apply wherever the scenario does not pin its own stockpile, so every fixture stays byte-identical; the extra starting units (Chinese +3 villagers, Mayans +1, the Inca llama — this build's sheep, herdable and claimed by proximity) spawn beside the Town Center through the same safe-spawn search as everything else. Carry bonuses (Aztec villagers +5 on everything, Goth hunters +15 on boar) add to the base carry BEFORE Wheelbarrow's multiplier, AoE2's own order. Housing bonuses (Chinese Town Centers and Inca houses support 10) add at both raw-supply sites so the cap math never disagrees with itself.

**Building bonuses and the Huns (v0.3.80).** Building COSTS are civ-priced at every charge, afford, validator, AI, reseed, and HUD site through one seam (`effectiveConstructionCost` — the training-cost rule applied to construction): Franks Castles -25%, Japanese Mills and camps -50%, Teuton Farms -33% (reseeds included), Inca stone -15%, Malian wood -15%, and the build card shows the owner's price, never the base. Persian Town Centers and Docks stand at **double hit points**, multiplied into the base before Masonry's ladder, exactly like the unit-HP seam. And the **Huns need no houses**: their raw population supply opens AT the match's cap (custom pop caps still bind), so housing never limits them and houses stay a buildable irrelevance, as in AoE2.

Still open, listed rather than dropped: age-scaled HP (Vikings and Vietnamese units, Byzantine buildings), the remaining building-stat lines (Teuton Town Center attack and tower garrison, Korean tower range, Japanese fishing-rate ladder), and one-off mechanics (Khmer prerequisites, Incas' Eagle line swap, Vietnamese reveal, Goth +10 Imperial population). Each lands when its seam does.

**Franks — Knights have +20% HP (implemented v0.1.82).** A Franks player's Knight line (Knight → Cavalier → Paladin) has +20% maximum HP, from the start of the game with no research. `civUnitHpMultiplier(civilization, unitType)` returns 1.2 only for `civilization === 'Franks'` and a knight-line unit, applied to the BASE HP at combat-state creation (`createCombatState`) BEFORE flat tech bonuses add — so a knight reads 100 → 120 (Franks) → 140 with Bloodlines, matching AoE2's order of operations. The bonus is knight-line-only: the Scout line, Camels, and Cavalry Archers (also mounted) are unaffected. Because every unit's combat state is built through this one factory, both scenario-seeded and trained knights get it; existing units need no imperative bump (a knight is created with the bonus baked in). A non-Franks civilization multiplies by 1, so all other civs are byte-identical. No save-format change.

**Goths — Infantry have +1 attack against buildings (implemented v0.1.83).** A Goths player's infantry (the Militia and Spearman lines; `isInfantryUnit`) deal +1 additional damage when attacking buildings, from the start of the game with no research. `civBuildingAttackBonus(civilization, attackerType)` returns 1 only for `civilization === 'Goths'` and an infantry attacker, added at the single unit→building damage site (`playerCommandsSystem`) alongside the Sappers tech bonus (which uses the same shape) — the two stack additively. Non-infantry Goths units (archers, cavalry, rams, villagers) get nothing, and a non-Goths civilization gets nothing. DERIVED from the persisted civilization at the damage site with no per-unit state and no save-format change.

**Goths — Infantry cost 35% less from the Feudal Age (implemented v0.1.86).** A Goths player trains infantry (Militia + Spearman lines; `isInfantryUnit`) for 35% less from the Feudal Age onward (Dark-Age costs are unchanged). `effectiveTrainingCost(civilization, age, unitType)` returns each base resource × 0.65 (rounded) for Goths + an infantry unit + a non-Dark age, and the base cost otherwise (the pure `trainingCost` table is never modified). Because a cost delta is inherently multi-site, this ONE helper is used at both consistency-critical sites — the charge (`trainingMarketOps`) and the authoritative affordability gate (`queueTrainValidator`) — so what gates a unit and what it is charged always agree. The AI's intention-emission check and the human "not enough X" toast advisedly keep the base cost (they are not the authoritative gate; both are byte-identical for a non-Goths owner, which every default owner is). No save-format change. (Goths' remaining identity — +10 population in Imperial, faster Barracks production — is deferred.)

**Aztecs — Military units are created 15% faster (implemented v0.1.84).** An Aztecs player trains every MILITARY unit (all non-villager trainables — the infantry/archer/cavalry/siege lines and Monks) in 15% less time; villagers are unaffected. `civTrainTimeMultiplier(civilization, unitType)` returns 0.85 only for `civilization === 'Aztecs'` and `unitType !== 'villager'`, applied to the unit's total train ticks at the single production enqueue site (`trainingMarketOps`): `totalTicks = max(1, round(baseTicks × multiplier))`. Because both the human command path and the AI's `queue.train` intention flow through this one enqueue, both benefit consistently. The discounted tick count is stored in the already-persisted production queue, so a save/load or replay reproduces it deterministically with no save-format change. A non-Aztecs civilization multiplies by 1.

### 11.12 Production technology: Conscription

**Conscription (implemented v0.1.85).** Conscription is researched at the Castle, available from the Imperial Age, costing 150 food + 150 gold and taking 60 seconds (600 ticks). While researched, units trained at the Barracks, Archery Range, Stable, or Castle are created 25% faster (×0.75 train time); units from other buildings (Siege Workshop, Monastery, Town Center, Dock) are unaffected. Any civilization may research it. It rides the same production-enqueue train-time seam as the Aztecs creation-speed bonus (§11.11): a pure DERIVED multiplier — `conscriptionTrainTimeMultiplier(researchedSet, buildingType)` — read once at the single enqueue site (`trainingMarketOps`) and multiplied with the civ multiplier, so the two stack. Conscription has no imperative application step: the train-time is computed fresh at each enqueue from the owner's persisted researched-tech set, so no per-unit state and no save-format change. The built-in AI reaches Conscription through its generic research loop at an idle Castle.

Note: because the training-time seam applies its multipliers at the moment a unit is enqueued, a technology or civilization bonus affects only units queued after it is in effect — a unit already training keeps the tick count it was enqueued with.

### 11.13 Civilization selection

The player must be able to choose which civilization they play as, so the passive bonuses (§11.11) actually take effect in a game. The first implementation (v0.1.87) is a `?civ=<name>` URL parameter that sets the human player's (owner 1) civilization; the name is validated case-insensitively against the canonical 30-civilization list (`civilizationNames.CIVILIZATION_NAMES`), and an unknown or absent value falls back to the default (Britons). The choice overrides the scenario start's civilization at world-build time (closure-local, not a separate save field) and therefore enters the persisted `playerCivilizations` map through the normal seed path — so a game saved after choosing a civilization reloads with that civilization, and a load is never overridden by the parameter. A full in-game civilization-picker UI (at match setup) is the intended follow-up; the URL parameter is the minimal reachable mechanism.

## 12. Fog of War, Line of Sight, Pathfinding, and Movement

### 12.1 Visibility States

Use the standard three-state model:

- unexplored
- explored but not currently visible
- currently visible

Expected behavior:

- terrain remains known after exploration
- last-known buildings may persist in fog until re-scouted
- a last-known ("ghost") building/resource memory is cleared once the player re-observes its footprint AND the remembered entity no longer exists. Existence is matched by entity IDENTITY (id + generation), not id alone: the engine recycles entity ids, so a bare id check would let a destroyed-under-fog building whose id was reused keep its ghost forever (and survive save/load). The stored memory carries the entity generation and is compared with the live entity to detect death or recycle. (full-review M5)
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

Every unit belongs to exactly one **domain**, and the domains are complementary: no cell admits both, and water admits only ships.

- **land** — anything that is not water and not forest. Every non-ship unit.
- **water** — water cells only. Every ship.

This single rule is the whole of naval movement: a land unit cannot chase a ship, a ship cannot beach itself, and a shoreline is a real boundary — none of which is special-cased anywhere. It applies uniformly to pathing, to the spawn search that places a newly trained unit (a ship trained at a Dock appears on the water side of its perimeter), and to scenario spawn validation, whose error names the domain it expected rather than reporting a bare "impassable".

The **Dock** is the one building that straddles the boundary: it stands entirely on land but must TOUCH water, counting diagonals. The rule is checked inside the shared placement predicate, so the placement preview and the confirm can never disagree. Docks are Dark Age, 150 wood, 1800 HP, 3x3, garrison 10; they train every ship and accept fish as a food drop-off.

The Dock's train menu follows the ship UPGRADE LINES rather than listing hulls: Galley -> War Galley -> Galleon, Fire Ship -> Fast Fire Ship, Demolition Ship -> Heavy Demolition Ship, and (once unlocked) Cannon Galleon -> Elite Cannon Galleon. Fishing Ships are available from the Dark Age; the Galley line opens in Feudal; the Fire Ship and Demolition Ship lines and the naval unique units open in Castle Age. Each upgrade mutates the owner's existing ships in place and rewrites anything of the predecessor type still in a production queue, exactly like the land lines.

Dock technologies (`develops_in: Dock` in technologies.csv), all researched at the Dock:

| Technology | Age | Cost | Effect |
| --- | --- | --- | --- |
| War Galley | Castle | 230 food, 100 gold | Galley -> War Galley |
| Galleon | Imperial | 400 food, 315 wood | War Galley -> Galleon (requires War Galley) |
| Fast Fire Ship | Imperial | 280 wood, 250 gold | Fire Ship -> Fast Fire Ship |
| Heavy Demolition Ship | Imperial | 200 wood, 300 gold | Demolition Ship -> Heavy Demolition Ship |
| Cannon Galleon | Imperial | 400 food, 500 wood | Unlocks Cannon Galleon training |
| Elite Cannon Galleon | Imperial | 525 wood, 500 gold | Cannon Galleon -> Elite Cannon Galleon (requires Cannon Galleon) |

Careening, Dry Dock, and Shipwright are the remaining Dock technologies; they are effect techs (armour, movement rate, wood cost) rather than upgrade lines and are pending.

Still to come as the naval roster grows:

- shallow-water exceptions if supported by the map system
- transport ships carrying land units across water (a land unit inside a water-domain hull)
- forest as impassable except to tree-cutting siege where appropriate
- no special movement speed gain simply for roads unless explicitly added later

### 12.4.2 Movement Speed

Every unit has a BASE speed from the `movement_rate` column of `design/stats/units.csv`, expressed as a percent of a **villager** (0.8, the 100% reference). Speed is therefore part of a unit's identity: a Hussar covers 188% of a villager's ground and a Battering Ram 63%, so raiding, kiting, and escorting siege are different problems rather than the same walk.

Two rates the CSV cannot supply: `scout` has no row and takes AoE2's Scout Cavalry 1.2; `trebuchet` reads 0.0, which describes an UNPACKED trebuchet, and takes the packed 0.8 because there is no pack/unpack cycle here.

The movement TECHNOLOGIES multiply that base rather than replacing it — Husbandry makes a knight 10% faster than a knight, not 10% faster than a villager. Villager is the only unit whose base is exactly 100, which is also the executor's byte-identical fast path (a unit at 100% never reads or writes the fractional carry).

A fractional percent is made real by a per-unit carry accumulator (`moveCarryHundredths`) that banks the unconsumed entitlement across ticks and per-cell waypoint clamps; rounding the step instead would silently drop everything under a whole fine unit. The carry is bounded so a long-blocked unit cannot burst-move; in an unobstructed walk it self-regulates well below that bound.

The autonomous scout WANDER path writes the fine transform directly rather than going through the step executor, so it applies the base speed itself, as a whole number of fine units. Two consequences the implementation has to handle and which are easy to get wrong: a wanderer hemmed in by impassable neighbours makes progress by moving within its own cell, so a step that jumps the cell boundary must fall back to a shorter one rather than freeze; and a shortened step must still re-pick the heading, because publishing a sub-cell wiggle as "movement" skips the escape logic and produces an in-cell orbit.

### 12.3.1 Who Can Gather What

A gatherer can only work a resource in its OWN domain (§12.4). A fish sits in water and can only be worked from a boat; everything else can only be worked from land.

This is not the same question as the resource KIND. A fish is FOOD, exactly like a berry bush, so a filter that matches only on kind lets a land villager pick a fish — and it then walks to the shoreline and stands there forever, because it cannot enter a water cell. Measured on the default map: that alone froze the AI's entire stockpile at around tick 6000, with its food villagers pinned at the coast, which looked like a pathing bug and was really a mis-assignment.

The rule is expressed as domains rather than a list of pairs, so a new water resource or a new ship is covered without anyone remembering to add a case — which matters because the failure is silent.

### 12.4.-1 Formations

A **formation** decides where a group stands when it arrives, and in what order it is placed. Four ship, matching AoE2: **Line** (the default — a wide rank across the march), **Staggered** (the same order spread wide and loose, so one blast cannot cover the group), **Box** (a compact square), and **Flank** (two wings with a gap between them).

The ORDERING matters as much as the shape: melee stands in front, shooters behind it, and the units that die instantly and cost the most — siege, monks, villagers — at the back. Without it a group arrives as a blob and the archers are in front as often as behind.

The shape is always a PREFERENCE, never a placement. The formation supplies one candidate cell per unit and the existing group allocator takes it only if the cell is in bounds, unblocked, and has room; otherwise that unit falls through to the ordinary spiral. A formation pressed against a cliff or a map edge therefore degrades into a blob rather than stacking units on rock.

The formation is per-unit, stored only when it differs from Line, and set through the recorded command channel exactly like a stance — it changes where a unit stands on later orders, so a replay that skipped it would put the group in the wrong shape. Because it is a recorded command it lands on the NEXT tick: a caller that sets a formation and orders a move in the same tick gets the previous formation. That is invisible to a player (a click is many ticks later) but matters to scripted callers.

A group whose members disagree uses the formation MOST of them are set to, so a mixed selection still has a single shape rather than fragments of four.

### 12.4.0 Patrol

A **patrol** is a standing ROUTE between two cells, not an order. Press **P**, then click: the unit paces between where it stood and where you clicked, engaging what it meets the way an attack-move does, until you give it something else to do.

The distinction from attack-move is the point of the design. Auto-aggression takes a unit off its walk to fight, which clears its command — so an attack-move is finished the first time it works. Modelling the patrol as its own per-unit state (`aoe2.patrolRoutes`) means the walk is re-issued whenever the unit falls idle, so a patrolling unit fights, wins, and goes back to pacing. It turns around only when it actually reaches the end it was walking toward; a unit that stopped anywhere else resumes toward the SAME end rather than doubling back.

Any order the player gives ends the patrol. The route survives its own legs because the system re-issues them through a path that deliberately does not clear it.

Only patrolling units are stored, so an ordinary match serializes nothing extra. P and A share one armed-order slot, so pressing one after the other replaces rather than stacks.

### 12.4.1 Stances

Every unit carries a **stance**, which decides what it does when nothing has been ordered. It is a per-unit property the player commands, not a fact about the unit's type.

- **Aggressive** — engages anything within its line of sight, and will move to the fight. It is the only stance that starts fights with BUILDINGS unprompted.
- **Defensive** — engages only within its own weapon reach, and does not go looking. For a villager (reach 1) this is "counter-attack whoever is adjacent".
- **Stand Ground** — same reach as Defensive, but never gives up its cell. Looking further than it can shoot would only produce orders it cannot act on.
- **No Attack** — never engages, whatever walks past.

Defaults: anything that fights starts Aggressive; anything that gathers (villagers, Fishing Ships) starts Defensive, so it keeps working instead of chasing a scout across the map. An explicit attack order always overrides the stance — the stance governs UNPROMPTED behaviour only.

A stance change rides the recorded command channel (`unit.stance`), because it changes what the unit does on later ticks and a replay that skipped it would diverge. Only units whose stance DIFFERS from their type's default are stored, so an untouched match serializes nothing extra. The command is rejected as a whole if any addressed unit is missing or not owned by the commanding player — a stance order is a real order, not a hint, so a partially-valid batch is not silently narrowed.

### 12.4.2 Attack-move

**Attack-move** is the order that says "go there and fight what you find". It walks to its destination exactly like a move, but for its duration the unit engages anything it meets **regardless of its stance** — including No Attack, which is what makes it an order rather than a suggestion. It is the one case where a standing order does not silence auto-aggression.

The player arms it with **A** and spends it on the next left click, AoE2's own interaction; a right-click cancels the armed state. Group orders spiral-allocate their destinations exactly like a plain move, so a band of units spreads out rather than stacking.

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

**Narrow-choke traffic (implemented v0.3.2).** Durable topology and transient traffic are separate layers. Terrain, resources, buildings, walls, water, forest, bounds, and any other whole-cell claim are PERMANENT blockers: they belong in the global A* traversability predicate, invalidate a cached next leg immediately, and may justify a different route. Units are TEMPORARY traffic and never enter that global blocked predicate. When active same-owner movers enter a statically one-cell-wide passage, including a one-cell bend whose incoming or outgoing leg has both perpendicular flank cells permanently blocked, a tick-start position/intent snapshot plus same-tick movement-attempt reservations elects the unit furthest along the immediate cardinal step, then lowest entity id, as the deterministic leader. Explicit move, attack, build, and repair orders, active monk tasks, and villager resource/drop-off travel all count as movement intent; newly activated worker travel reserves its origin before later movers decide. Every follower retains its task and cached terrain route, waits behind the occupied next lane cell, and retries on the next tick rather than finding a long lateral detour. Each unit additively persists its last actual traffic-arbitrated cardinal leg in `UnitTransformComponent`; absent legacy fields use the serialized target heading until the first attempt refreshes them, while the unsaved A* cache is never consulted. Directed occupied-cell cycles, from head-on pairs through longer loops, admit only their lowest entity id when every recently moving blocker branch closes back to that caller, so the jam gains an empty slot without treating a stationary task as a winner; long-term bidirectional fairness remains a future formation-level concern. Closing that set treats a blocker already inside the set being closed as part of it rather than as a reason to abandon the search, so a jam in which SEVERAL units share a cell still elects a winner — every member computes the same set and therefore agrees on the same one. **That election is final.** It is the only rule in this layer that weighs the whole jam and it names exactly one unit, so the per-cell priority rules below never re-judge an elected caller: re-judging it locally refuses the winner for standing behind a better-placed neighbour who is itself waiting on that same election, which is a permanent deadlock rather than a safety check. A caller may only yield to a co-located peer that could itself take the turn it is being given — a peer whose own next cell is blocked is not a valid reason to wait, or a unit with clear ground ahead of it stands still behind one that can never move. The passage uses one centered longitudinal lane, so subcell packing cannot make followers wrap around or pass the leader; open terrain keeps normal multi-slot sharing. Four optional provenance fields—direction X/Y, intent key, and attempt tick—reproduce through save/load and replay without a schema bump. A stationary unit without active task intent remains ordinary subcell occupancy rather than becoming a new permanent wall. Autonomous scout wandering and herdable drift are not routed through this commanded/task traffic layer.

### 12.6 Unit Spacing and Sub-Tile Occupancy

**Spawn egress (implemented v0.3.30).** A cell is only a legal spawn — for a newly trained unit, an ungarrisoning unit, or a scenario placement — if it is passable AND belongs to a connected walkable region large enough to leave by; a cell whose sole exit is a dead end is wedged exactly as one with no exit at all. The region test is bounded (it stops counting once the region is known to be big enough), so the cost does not scale with open map. This is what stops a producer stranding the units it makes: a base can close a two-cell pocket between its own buildings, that pocket sits on a Town Center's spawn perimeter, and every unit trained afterwards is placed into it holding a task it has no path to. When no candidate on a building's perimeter qualifies, the unit is not placed and production waits, rather than a unit being created somewhere it can never leave.

Multiple units may share a tile, but no two unit sprites may visually occupy the same on-screen position at any rendered frame. Visual non-overlap is the contract — players see sprites, not slots, and a stack of unit sprites drawn at the same screen point is a defect regardless of what the simulation believes about cell ownership.

Rules:

- Sub-tile occupancy is supported via deterministic slot packing. The default pattern is a 4x4 grid of 16 slots per tile; an implementation may choose a different pattern provided slots are distinct, stable across ticks, reproducible from inputs, and spaced widely enough that the rendered sprites at adjacent slots do not overlap on screen.
- Each slot has a fixed visual offset within its tile. The renderer must apply the slot offset (or interpolate between previous and current slot offsets across ticks for smoothness); it must not draw two units at the same screen point even when their integer tile positions match.
- Any placement, spawn, move, ungarrison, train completion, transport unload, conversion drop, or replay-rehydration must resolve to a free slot. If the target tile is fully packed, the simulation must fall back to a free slot in the nearest available neighbor tile rather than stacking two units at the same visual location.
- Buildings have an authored south/east ungarrison exit toward the foreground. Ungarrison chooses the deepest safe cell on that perimeter first, with deterministic south-before-east tie-breaking, so a released unit reappears in front of rather than fully hidden behind the building. If that cell's sub-tile slots are full, it writes the occupancy allocator's actual nearest-neighbor fallback cell and slot into authoritative position and transform state. If the bounded 16-cell search finds no legal slot at all, the affected unit remains garrisoned and positionless instead of being released into visual overlap.
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

The open-terrain transit rule above does not override narrow-choke traffic: active same-direction move traffic in a statically one-cell-wide passage queues on the centered lane instead of passing laterally through subcell slots.

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

**Gatherer distribution — food-priority for age-ups (implemented).** The AI spreads its villagers across resources by an age-keyed target weight map: Dark {food 4, wood 3}, Feudal {food 7, wood 4, gold 1}, Castle {food 4, wood 4, gold 3, stone 1}, Imperial {food 4, wood 3, gold 5, stone 1}. Feudal is deliberately food-dominant because the Castle age-up costs 800 food to only 200 gold (4:1). Grounded by replaying an AI-vs-AI match: an earlier Feudal split of {food 5, wood 4, gold 2} left the AI mining gold it barely spent (hoarding ~1500) while its food stayed pinned near zero, so it never gathered the 800 food to advance — the gold sink in Feudal is only the archer (45 gold) plus the Castle's own 200 gold, both of which one gold villager funds comfortably. Weighting food far above gold in Feudal is the supply-side half of reliably reaching Castle Age. The demand-side is handled by the age-up reserve, which the AI applies to MILITARY training only: military is discretionary spend, so the AI trains it from the surplus ABOVE the reserved next-age cost (`canAffordWithReserve(stockpile, cost, ageUpReserve)`), which stops a freshly-trained unit from starving the age-up. VILLAGER training is deliberately NOT reserve-gated. Villagers are the economic engine that GATHERS the reserved resource, so reserving food away from villager production is self-defeating: it deadlocks the economy whenever the AI qualifies for the next age while still villager-poor. (v0.1.90 first tried gating villagers on the reserve too; replaying the default-seed corpus 2026-07-04 showed that froze the AI at 7 Feudal villagers with food pinned at 339 under the 800-food Castle reserve — every villager train was blocked, so the gathering economy could never grow to gather the 800 it was reserving; v0.1.96 removed the coupling.) The banking the reserve was reaching for is instead provided by two mechanisms that do not deadlock: the per-age villager CAP (Dark 10 / Feudal 22 / Castle 40 / Imperial 60) stops villager production once the economy is fully built so the surplus banks, and the `savingForAgeUp` latch — once the stockpile crosses 60% of the age-up cost — suppresses ALL production (military and villagers) so the AI banks the final stretch. After the change, replaying the corpus showed the AI grow to its Feudal cap and bank 817 food, past the 800-food Castle cost.

**Who an AI attacks (implemented v0.3.54).** An AI attacks its NEAREST enemy: among the owners that still hold a Town Center, the one whose Town Center is closest to its own, with ties broken on the lower owner id so a replay always picks the same enemy. An AI with no Town Center of its own still picks an enemy that has one, because an army with no base must still have somewhere to go, and an AI whose enemies have all lost their Town Centers has no target and holds. The attack phase then prefers that enemy's villager, then any visible enemy unit or building, then that enemy's Town Center.

Before this the target was the HUMAN player, looked up directly: `findOwnedUnit(humanPlayerId, 'villager')` and the human's Town Center. With two players that is the same answer — the nearest enemy of the AI is the human — so an ordinary match behaves identically. It is every other case that was broken: an AI occupying the human slot (which is how the all-AI corpus runs) had itself as its target and never marched, and a skirmish with several AI players had them build up beside each other forever.

**Military pacing for age-up prerequisites (implemented, v0.1.92).** The gatherer distribution and age-up reserve above are necessary but were inert in the AI-vs-AI corpus until this rule, because the AI never became *eligible* to advance: Castle Age requires two Feudal-Age prerequisite buildings (Stable / Archery Range / Blacksmith / Market), and the AI built only one. A labeled replay showed why — the Feudal AI over-produced military to its population cap, which forced a House-build treadmill (each House 25 wood) that drained the wood before it could ever accumulate the 175 for a second prerequisite building. The rule: once the AI holds a full attack group (`attackGroupSize`, 5 in Feudal) AND cannot yet advance (fewer than the two required prerequisites), it pauses military GROWTH — freeing population room so it stops emergency-building Houses and banks wood for the prerequisite building. It is self-releasing: the instant the second prerequisite completes, the AI is age-eligible and military training resumes. The pause never drops below the attack-group floor, so the AI always keeps a defending army. This pacing is what lets the AI reach both prerequisites and then bank food (via the reserve above) toward the Castle cost, instead of stalling one building short forever. (For a narrow building-prerequisite stall this supersedes the older blanket guidance against suppressing military for an age-up, which concerned a food-only age-up and is preserved as the 5-unit floor.)

**AI placement never seals its own ground (implemented 2026-08-23).** The AI's ring search skips any anchor whose footprint would cut the free ground beside it in two: the free cells orthogonally touching the building must still reach one another without passing through it, checked inside a window three cells wider than the footprint on each side. Walls and gates are exempt, because sealing ground is what they are for. If NO anchor on the whole search survives the guard, the search runs again without it — a sealed pocket beats an AI that stops building. Grounded by replaying an AI-vs-AI match on the default map: by tick 6000 the AI had packed its buildings into a solid mass ten cells wide across its own base, sealing its sheep, its boar and the forest behind it into a pocket its villagers could not enter; six of them then held that one unreachable sheep for the rest of the match, and the whole economy read food 19 / wood 19 / 15 villagers, byte-identical from tick 17000 to tick 30000.

**A gatherer with no reachable resource of its kind takes another kind (implemented 2026-08-23).** When the reachability-aware reroute cannot find any resource of the villager's desired kind that it can actually path to, the villager falls through the kind order (wood, food, gold, stone) with the same reachability requirement rather than going idle. Without this the villager was left idle and the ordinary idle→assign — which does not check reachability — handed the same unreachable resource straight back on the next tick, forever. The AI's periodic villager rebalance (above) still governs the long-run distribution, so a fallback is a stopgap and not a permanent role change.

**Farms stop outranking the rest of the build order once the food is banked (corrected 2026-08-23).** Farms come first in the AI's build order for a real reason — an Archery Range put up while the food income is dead spends wood to get no closer to the next age — but a farm is CONSUMED, and the target is a third of the villager force. With 21 villagers the AI wants seven; two deplete, it drops to five, and the very next decision asks for another farm, forever. Measured on the default map: the AI sat in Castle Age with 3004 food, 866 unspent stone and 1271 gold, and had built no Castle, Stable, Market, Monastery, University or tower. Farms now take priority only while the stockpile is below the Feudal age-up's own food cost (500) — the point at which no hall it could build would get it any closer — or while it is under the two-farm floor, which is what keeps a food income alive at all. Deferred farms are re-checked at the END of the order, so a well-fed AI with everything standing still replaces depleted soil.

**Market trading to cover an age-up shortfall (implemented).** Gather weighting cannot reliably bank BOTH resources a multi-resource age-up needs, because the AI-vs-AI outcome is chaotically sensitive to the weights (one game the AI banks 1000+ food but only ~75 gold; another it hoards ~1700 gold but starves for food). So the AI corrects the imbalance at the Market instead of trying to pre-tune the gather mix. When it qualifies for the next age (its prerequisite buildings are met) but cannot afford the age-up cost, and only from a comfortable surplus, it emits one Market trade per decision cycle: if it is short on gold it sells whichever commodity has the most surplus above that commodity's own age-up need; if gold is covered but a commodity is short it buys that commodity from spare gold (at least two transaction-batches of gold headroom above the age-up's gold need, so the purchase cannot re-create a gold deficit and oscillate). Over a few cycles the stockpile crosses the age-up cost and the AI advances. The trade only fires while the AI is eligible-but-short, so the normal economy is untouched; because the Market can only trade from the Feudal Age up (per §6.8), this naturally applies to the Feudal→Castle stall and beyond. This is a self-correcting closed loop that works regardless of which resource a given game left short — the durable successor to the gather-weight tuning that a single-run replay could not reliably validate.

**Raid response — the town bell (implemented 2026-08-23).** When the AI sights an enemy within 8 cells of its Town Center, its villagers within 10 cells stop working and take shelter inside it, up to its capacity; a villager already walking there is not re-ordered. When no enemy has been sighted near the base for four decision intervals, the AI empties the building and the villagers go back to work through the ordinary idle re-assignment. The orders ride the same recorded channels a player uses — `unit.contextAtEntity` with garrison intent, and `building.action` `ungarrison` — so they are validated and replayed identically, and since garrisoning is a walk (§9.6) the shelter has to be reached rather than teleported into. Grounded by an AI-vs-AI match on the default map, where before this existed both sides lost entire villager forces to raids neither answered — one side fell from 23 villagers to zero by tick 10000 with its stockpile untouched. The radii are deliberately tighter than the sighting scan (`AI_BASE_VISION_RADIUS`, 12): a scout crossing the edge of vision is not a reason to stop gathering.

### 13.3 Military Behavior

Minimum AI military capabilities:

- scouting-informed unit composition
- use of siege against static defenses
- basic raiding and defense
- regrouping before attacks
- simple counter-unit behavior
- relic contest on maps where relics matter
- navy production and transport behavior on water maps

**AI scout wander (implemented v0.1.128).** Every scout spawn carries autonomous wander state: a 2-D diagonal heading plus a wander box (±10 cells horizontally, ±8 vertically, clamped to the map) anchored at the scout's base Town Center for the starting scout and at the spawn point for detached spawns like the default map's forward enemy scout. The scout-movement system activates that state only for AI-driven owners: a scout on a player-controlled slot never self-moves (manual orders keep full control), while a forced-AI human slot (all-AI playtests) wanders like any other AI owner. A wandering scout reflects its heading off the wander-box edges; when the next cell is impassable (a building footprint, a resource, impassable terrain — units share cells via crowding and do not block), it re-picks its heading by emulating each candidate's stepped path (box reflection included, candidates tried 90°/180°/270° clockwise then the current heading) and takes the first that reaches a different passable cell, falling back to a 90° clockwise rotation only when genuinely boxed in — a scout must never pin permanently against an obstacle, including at a wander-box edge where a naive rotation is immediately cancelled by the edge reflection. A scout stranded outside its box (an auto-aggression chase can end anywhere) walks back at normal speed — the effective box temporarily widens to its current cell, so resuming wander never teleports it home; a scout walled off behind impassable terrain patrols in place and is honestly reported by the pinned-units oracle. A deterministic patrol kick rotates each wandering scout's heading every 400 ticks (staggered per unit id, angle cycling 90°/180°/270°) so the deterministic bounce-and-escape dynamics cannot settle into a closed orbit inside a pocket of blockers; runs stay replay-identical. A pending player/agent command on the scout suspends the wander step for that tick. This is bounded patrol, not exploration: pathfinding toward unexplored fog remains future work.

**Auto-aggression and player-command precedence (M3 hardened v0.1.144).** An idle military unit automatically engages the nearest enemy inside its vision radius (idle villagers defend rather than pursue). Auto-aggression is emitted as a bridge-side intention that is drained into the engine command FIFO before the next tick. An EXPLICIT player (or agent) command for a unit — move, attack, gather, or a right-click context command — always takes precedence over that unit's stale auto-aggression intention: issuing an accepted command evicts any pending auto-aggression intention for the same unit, so the drained order is never run-then-clobbered by an attack the guard queued a tick earlier. Concretely, a unit you order to retreat while an enemy is in vision actually retreats instead of losing one tick of control to an auto-attack. This eviction is determinism-safe: only the resulting engine commands are recorded, and replay clears bridge-side intentions each tick, so live and replay see the identical move-only stream.

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
- minimap with readable terrain, fog, viewport, and high-contrast unit/building/resource markers
- selected-unit or selected-building panel
- action and command panel
- queue and progress display

**HUD chrome (2026-06-16; restyled to modern surfaces 2026-08-18 on owner direction).** The major HUD container panels — the top resource bar, the command/selection panel, the minimap frame, the game menu, dialogs, tooltips, and the replay timeline — present as modern dark-glass surfaces: a translucent slate face over a background blur, ONE hairline border, a bright inset rim along the top edge, and a two-part elevation shadow (a tight contact shadow plus a wide soft one). The minimap is the deliberate inverse — a sunken well rather than a raised face — because it is a viewport into the world rather than a panel on top of it. Every colour comes from the token palette declared in `styles.css:root` (`--hud-surface*`, `--hud-hairline*`, `--hud-text*`, `--hud-accent`, one hue per resource, and the radius and elevation scales); no HUD rule may reintroduce a raw colour literal. Resource chips carry no boxes of their own — spacing and the label/value type contrast separate them, and a hover surface marks them as interactive. The single warm accent is reserved for interactive state (focus rings) and for production progress, the one continuously-changing quantity on the panel. Text contrast is held against the worst realistic case, a translucent panel over sunlit grass: primary text at 4.5:1 and labels at 3:1, enforced by `tests/ui/hudPalette.test.ts`. Focus is a real 2px outline (never a box-shadow ring) so it is both visible and assertable. A viewer who prefers reduced transparency gets opaque panels with no blur, which doubles as the low-power path. This SUPERSEDES the earlier framed wood-plank/chiselled-stone treatment with its beveled edges and grain, which read as a plaid moire at the sizes the HUD actually renders. Still 100% procedural CSS: no image assets and no reproduced Age of Empires art.

**Resource + build icons (2026-06-16; accessibility invariant clarified v0.3.8).** Each top-bar resource chip carries a small recognizable glyph before its label (a wheat sheaf for food, a stack of logs for wood, a coin for gold, a faceted rock for stone; and, since they share the bar, a banner for age, a house for population, a clock for time), and each "Build X" command button carries a glyph matching the building (house, windmill, felling axe, pickaxe, crossed swords over a shield, tower, anvil, market stall, catapult, cross-topped chapel, battlemented keep, domed monument, stone-wall segment, sharpened palisade stakes, tilled field, plus Town Center / Stable / Archery Range — an exhaustive per-building table covers every buildable type). The icons AUGMENT the text labels — the labels are kept (the resource value text and the "Build X" button text are unchanged) — so the icons speed scanning without removing the textual meaning. Every glyph is ORIGINAL artwork drawn as a small hand-authored inline SVG using the existing warm gold palette via `currentColor`; no image assets, no icon font, and no copyrighted Age of Empires icon art. This was the first resource+build slice of the UI-icon work; subsequent shipped slices added selected unit/building/resource badges and Train/Research/Market/Action command-card glyphs, as summarized in §14.5. Resource/status chips, command/build cards, and selection badges continue to pair icons with visible text. The game-menu actions are the deliberate icon-only exception: every such control remains a native button with a full textual accessible name, an action-naming tooltip on pointer hover and keyboard focus, visible focus treatment, and a decorative SVG hidden from assistive technology, so the icon is never the sole carrier of meaning for assistive users.

**Top panel stability + game menu (v0.1.95; dedicated action icons v0.3.8).** The top resource bar's button position is FIXED and never shifts for any reason. The resource/status chips (food, wood, gold, stone, age, pop, time, plus a Wonder/Relic countdown slot) live in an independently-scrolling region, and a single ☰ menu button is pinned to the right of the bar OUTSIDE that region — so more digits in a resource value, a longer Age label, an appearing countdown, or a narrow window can never move the button. The countdown chip's slot is permanently reserved (always in the DOM; its content fades via an active/inactive flag) rather than being inserted/removed, so it cannot reflow the bar either. Save / Load / Replay are no longer on the bar: they live in a game menu opened by the ☰ button OR the Esc key. The menu overlays the match and contains Resume, Save game, Load game, Watch a replay…, Restart match (restarts the current scenario), Quit to title (returns to the match setup screen — quitting strips the URL params, and a bare URL is the setup screen's trigger), and a Settings section (currently a debug-overlay cycle). Resume, Save, Load, Replay, Restart, Quit, and Debug overlay each use a distinct ORIGINAL procedural inline-SVG icon as the visible menu-item affordance instead of an action-name label; the Menu and Settings headings plus the live debug mode remain visible text. The native buttons preserve the complete action names, hover/focus tooltips, keyboard order, focus ring, minimum 44-pixel targets, existing hooks, and all behavior, and active menu tooltips must stack above and avoid covering the modal panel. Keyboard focus wraps within the open modal; closing the nested Load surface by Cancel or successful Restore returns focus to the Load action so subsequent navigation remains inside the menu. Esc yields to prior claimants — in replay mode Esc EXITS replay, and while a modal dialog (e.g. the replay-load dialog) is open Esc belongs to that dialog — so it only toggles the menu when neither is active. Opening the menu PAUSES the match and closing it (Resume, the backdrop, or Esc) resumes — but the prior pause state is preserved: if the player had already paused the game before opening the menu, closing it leaves the game paused rather than resuming it (implemented v0.1.97; auto-pause was deferred in v0.1.95). Styling is original/procedural (no image assets or external fonts).

### 14.2 Command Panel

The command panel must be context-sensitive:

- Villager: build menu, repair, garrison, gather actions
- military unit: attack, patrol, stance, formation, garrison actions
- production building: train queue, technologies, rally point
- Monastery: monk production and monastery technologies

**Readable command deck and build palette (v0.3.7).** Populated commands are grouped under visible semantic headings such as Orders, Train, Trade, Research, and Build instead of forming one undifferentiated strip; empty groups are omitted without changing the authoritative option order or availability supplied by the simulation bridge. A villager's build palette uses compact building cards with the original procedural glyph, visible name, deterministic food/wood/gold/stone cost, and live Ready/Short status. Short cards remain actionable: selecting one still enters the existing placement flow, whose authoritative validator owns the eventual affordability and obstruction result and its player-facing rejection feedback. Active placement highlights the matching card and names the building plus the next clear-tile action. Every command remains a textual native button with keyboard focus treatment and the same delegated tooltip on pointer hover or keyboard focus; the active trigger carries the shared tooltip as an accessible description, mixed pointer/focus ownership keeps it open until both release it, and replacing a trigger clears stale tooltip state. Resource-only updates refresh affordability without dropping logical command focus or recreating cards whose cost coverage did not change. At desktop width the Dark Age palette fits all seven choices without scrolling; at narrower viewports it reduces to two columns inside a bounded scrollable panel, creates no document-level horizontal overflow, and must not overlap the minimap. When the replay timeline is visible, its reserved height also constrains the command panel so the panel stays between the top resource bar and timeline at both desktop and narrow breakpoints. This is presentation and interaction hierarchy only: it does not create a second command authority, reorder or hide bridge-provided choices, pre-charge resources, or change simulation validation.

### 14.3 Minimap, Alerts, and Camera

Required behavior:

- minimap with terrain, visibility, viewport, and high-contrast entity marker representation. The minimap is projected as an ISOMETRIC DIAMOND matching the world camera angle (the same 2:1 `cellX-cellY` / `cellX+cellY` transform the game view uses, scaled to fit and centred in the minimap canvas) rather than a top-down rectangle: terrain and fog tile the diamond, entity markers are fixed-size dark-backed dots at their projected cell centres, and the camera viewport draws as a projected quad. Click/drag-to-pan inverts the diamond projection to a cell and ignores clicks that fall outside the map diamond (the canvas corners are off-map). Shipped v0.1.130.
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

- isometric voxel renderer — SOLE WORLD GRAPHICS PATH (2026-07-13, superseding the 2026-07-11 opt-in slice): AoE2 renders one interactive, lit Three.js voxel canvas with no renderer flag, legacy fallback, second world canvas, or Phaser dependency. The AoE-owned adapter maps projected terrain into 16x16 palette-indexed chunks, supplies deterministic block geometry through a shared geometry resource, and instances original procedural units, buildings, resources, selection, drag marquee, placement, health, and transient feedback. Fog shades voxel terrain data. AoE2 remains the owner of simulation, visual roles, player palettes, fog memory, selection priority, placement, health, commands, animation meaning, input rules, HUD, saves, and replays; the sibling `voxel` package exposes only game-neutral voxel-chunk, arbitrary-geometry, and rigid-instance data lanes suitable for City and Townscaper. The standalone `AoeVoxelGameView` owns browser frame/camera/pointer orchestration over renderer-neutral controllers. Terrain remains elevation-zero, while raised entity clicks use a data-only silhouette proxy generated from the same rigid-part recipes; raised terrain and a generic presented-state ray query remain deferred. Fixed-view evidence, one-canvas checks, epoch/reset/replay checks, context recovery, direct capture, bounded metrics, and teardown gates must prove the path. Authoritative design and execution ledger: `docs/threads/done/voxel-renderer-migration/DESIGN.md` and `PLAN.md`.
- dense-terrain ray-query boundary (Voxel 0.1.4): `raycastDensePaletteChunks` may be used only against caller-owned, uniform, aligned `DensePaletteChunk` occupancy. AoE's current flat 16x1x16 terrain drafts satisfy that data contract, but the helper is not bound to the runtime's presented epoch/revision and does not compose geometry-resource or instance-batch hits. Live terrain use therefore waits until the exact occupancy queried is promoted under the same presentation fence as the canvas. Raised and moving entities continue to use AoE's presented recipe-silhouette proxy; the dense query must not replace or outrank it.
- isometric voxel art direction: the sole renderer uses an original procedural Age-of-Empires-style vocabulary rather than generic whole-object blocks. Buildings combine neutral stone/plaster/timber walls, stepped voxel roofs, doors, windows, beams, towers, merlons, banners, awnings, blades, crop rows, and construction scaffolds. Player color appears as readable accents (flags, trim bands) AND as an owner-colour blend carried by the stepped roofs themselves (v0.3.83: each roof layer mixes 55% toward the owner tint before its per-layer shading, so a skyline reads as its owner's colour at a glance — the AoE2 rule that three bases are three colours of rooftop — while walls stay neutral stone/plaster and the material still reads as thatch/tile). Units share seven coherent body families but all 34 concrete types choose an exhaustive armor, headgear, shield, mount, weapon, tier, and signature-detail profile; the matching attack rig transforms the equipment that is actually visible. Resources use clustered trees, faceted mineral piles, forage berries, distinct animals, and relic ornament; sparse deterministic terrain props add surface detail without changing simulation height or picking. Parts are bounded rigid instances grouped into matte, metal, UI-feedback, contact-shadow, and reduced-opacity memory materials. The shared `voxel` package may own configurable target-tracked daylight, but AoE owns every palette, recipe, role, fog cue, and animation meaning. The current path stays elevation-zero; true shadow maps, AO, skeletal animation, deeper per-civilization facade GEOMETRY, and raised-geometry interaction require separate measured gates (the per-civilization roof-material pass shipped v0.3.105 — see the architecture-sets rule below).
- animated voxel units: live non-memory units animate their existing rigid procedural parts without changing authoritative simulation state, damage, reloads, pathing, roots, selection, fog, health bars, or commands. Identity-phased ambient profiles provide subtle breathing/bobbing plus role-readable secondary motion: opposing humanoid limbs, horse legs/tail and rider bob, monk sleeves/staff, and siege mechanisms. Perspective-eligible successful unit hits additionally project one bounded latest impact event per attacker entity reference. Before each successful impact, AoE proves visibility current: the first impact each tick and every later impact after a player-command LOS mutation synchronize sources, while an unchanged same-tick burst reuses that snapshot; fingerprinting avoids unnecessary `VisibilityMap` recomputation. A player, including the attacker's owner, becomes a witness only when at least one cell of the attacker footprint and at least one cell of the target footprint are visible to that perspective at that impact. If no perspective qualifies, no event or coordinates are recorded, so a retained ranged order cannot publish a fog-hidden target coordinate. At the authoritative damage tick attack sampling starts at the authored target-facing impact keyframe and then recovers smoothly; several same-tick attackers animate independently. Coincident presented roots remain a valid strike even though they have no geometric target direction: a warm renderer preserves its last finite displayed facing and a fresh renderer uses the role's authored forward instead of dropping the pose or ambient suppression. The first actual root change records a cancellation tick: movement direction becomes authoritative immediately while attack and ambient suppression weights smoothstep to zero across that one observable tick, so the actor neither snaps nor resurrects the strike after returning to its source. Presented roots and the attack channel (phase, weight, and ambient suppression) remain deterministic and continuous across that boundary; warm and fresh gait history is deliberately not an equivalence contract. Every concrete unit weapon uses an AoE-owned pose style whose controlled rigid pieces share a pivot and remain attached; recipes are deterministic, contain at most 32 parts, keep feet, mounts, wheels, roots, and shadows planted during attack, and reuse the exact prepared parts for rendered matrices and presented silhouette picking. AoE advances one monotonic Voxel animation clock only by positive simulation-display deltas. Equal display time freezes gait, ambient breathing, secondary motion, attack geometry, and matching hit geometry; rewind and bridge replacement rebase without sending time backward to Voxel, while disappearance, memory projection, and entity-generation replacement reset disposable unit history. Raw projection retains live entities so stationary fog reveals remain possible, but the bridge applies the final current-perspective filter and captures interpolation sources only through the prior tick's visible-cell frame. When a witnessed attacker leaves one perspective's current view, the bounded feed persists that perspective in `suppressedFor` before recorder checkpoint publication; tower targeting uses one immutable pass-start visibility snapshot, then a successful tower pass with one or more kills resynchronizes final LOS exactly once before this suppression/output step. That event stays hidden after re-reveal, while `RenderStore` keeps a renderer-local tombstone as defense in depth. Ordinary saves drop in-flight attack presentation, while new recording snapshots retain a bounded, canonical feed so replay scrubs restore the event, per-perspective suppression, exact source/target coordinates, attack phase, weight, and cancellation state without making it authoritative gameplay state; coincident coordinates use the same deterministic displayed-facing fallback; playback's first frame only establishes the wall-clock baseline and does not synthesize a tick. A fresh renderer may reinitialize disposable gait history, so full assembled rig matrices are not a replay contract. Legacy recordings that lack the slot preserve that absence, and historical checkpoints whose feed predates `suppressedFor` cannot retroactively reconstruct a hide/reveal that occurred before that checkpoint. Monks remain non-attacking: validation and the direct issue helper reject new attacks, and the execution boundary clears hydrated or persisted Monk attacks before damage or event emission. Wildlife retaliation animation shipped in v0.2.8; gathering clips, projectiles, skeletal animation, clip assets, and root motion remain deferred. The sibling renderer may own only game-neutral bounded injected-time rigid transforms; AoE owns every role, event, part mapping, pivot, amplitude, period, phase relationship, clock policy, and gameplay-to-presentation transition.
- speed-matched voxel locomotion: AoE samples the already-interpolated displayed `x/y` path per `id:generation`, advances a wrapped gait phase by displayed distance divided by an AoE-owned role stride, and bakes foot lift/travel, opposing limb pose, cavalry stride, monk sway, and siege wheel rotation into ordinary rigid-part base transforms. The injected simulation display clock determines displayed speed and a bounded start/stop/turn blend only, never advances gait phase, and freezes identically during manual or replay pause whether selection forces redraws or not. Direction-aligned pitch and transformed-corner clearance keep feet flexing in the travel plane without penetrating ground. Disappearance, memory projection, generation replacement, bridge replacement, and clock rewind start fresh unit history; the renderer-level monotonic accumulator retains its value and rebases the next simulation sample. Static and animated surface lanes remain separate so large static scenery does not inherit the active-batch slot ceiling. The shared renderer contract does not gain unit roles, velocity inference, stride policy, foot planting, clock policy, or mutable gait history; its harmonic lane consumes AoE's injected monotonic time and therefore freezes with the game.
- unit motion continuity and facing: every fine-grid movement step must publish a new `unitTransform` through the ECS component API so render projection observes each fixed-tick endpoint; mutating a retrieved component object in place is forbidden. A stationary spawn begins at its engine-allocated occupancy slot, and a commanded unit must aim at and test arrival against that same assigned slot, so neither its first cardinal step nor its final stationary sync can recenter or teleport it to a different sub-cell point. The assigned slot or explicit no-slot overflow state must be persisted separately from a still-moving fine root; save/load and replay rebuild numeric assignments before overflow units, while legacy saves without slot data use their serialized fine root as a one-time preference. An explicit overflow is reconstructed without opportunistically claiming a slot that uninterrupted play had not claimed; when gameplay later finds a same-cell slot, the command remains active until the fine root reaches it by ordinary bounded steps. Presentation interpolates only exact adjacent tick endpoints and must keep every ordinary 60 Hz displayed root step bounded, including through a path corner. A blocked autonomous unit may recenter toward its assigned in-cell slot only by one normal fine-grid step per tick before selecting a new heading; obstacle escape must not trade a visible snap for a deterministic patrol livelock. The complete actor, contact shadow, and presented hit silhouette turn together through the shortest arc toward displayed travel; each authored role's semantic front must have a positive dot product with current displayed velocity once moving. Explicit discontinuities such as replay scrubs, bridge replacements, identity-generation changes, and authoritative teleports snap once rather than interpolating unrelated state. A long animation-frame gap during replay consumes at most the shared 250 ms visible-simulation bound in one callback instead of fast-forwarding the whole hidden interval in one rendered frame.

**Voxel feedback supersession.** Any later bullet in this historical section that says a Phaser painter cue is “shipped” describes the former 2-D renderer, not an additional live path. The sole voxel renderer currently provides static selection outlines, a visible four-segment drag marquee, authored-height health bars, bounded hit sparks, static witnessed-death debris, successful-hit unit attack poses, the v0.2.8 wildlife-retaliation pose, and the white behind-building unit silhouette (returned in voxel form in v0.2.5 — see the units-behind-buildings bullet). The former animated selection pulse and collapsing death body/dust rings are not present; gathering feedback and richer death feedback remain explicit future voxel work.

The north star is the look and polish of an Age of Empires II HD clone, reached entirely through ORIGINAL/procedural art that evokes that look — no copyrighted Age of Empires assets (sprites, textures, UI art, audio) are reproduced. Presentation targets:

- isometric RTS readability — ACTIVE (user direction 2026-07-05): all world placement and pointer inversion use the pure 2:1 diamond projection in `src/rendering/isometricProjection.ts`. `VoxelCameraController` pans, zooms, clamps, and projects screen points over that plane; `AoeVoxelGameView` owns its frame and browser lifecycle. Detailed lit 3-D voxel recipes replace painter-order 2-D silhouettes. Original/procedural art only (evokes AoE2 readability, not its assets).
- clear faction-color ownership
- directional travel-facing animation and successful-hit unit attack poses (shipped); gathering clips remain future work
- attack-pose violence directive (user, 2026-07-14; shipped v0.2.7): the successful-hit pose must read as a forceful strike, not a gentle tap — a pronounced windup that loads the weapon arm, a fast impact snap toward the captured target, and a brief follow-through/recovery, with amplitude large enough to read at default zoom. This is a quality bar on the existing v0.2.3 channel and inherits all of its constraints unchanged: no authoritative root lunge, deterministic phase/weight, one-tick movement-cancellation smoothing, pause-freeze, and fog/witness rules. Because combat resolves before projection, sampling honestly starts AT the authored impact keyframe (phase 0.55) and only the 0.55→1.0 window is ever presented: the coil is therefore LOADED through the production-invisible segment and HELD so the first visible sample is fully wound, then snaps to the strike peak within ~52 ms and recovers through one damped overshoot. Arc endpoints stay exact no-ops. The strike is DIRECTIONAL and its sense is authoritative: the weapon loads behind the actor and drives THROUGH the captured target point — positive pitch swings a weapon head forward-and-down about its pivot, so a chop's coil is over the shoulder and its peak is through the target (v0.2.3's inverted sign was invisible while the window was a monotone decay and became a backward strike once the coil→snap window existed). Draw rigs (bows) are the exception: their extreme IS the loaded draw at the impact sample, and they release rather than carrying the limb through.
- melee strikes reach for the target (user, 2026-07-15; partial, shipped v0.3.1): a melee strike must drive its weapon TIP at the captured target rather than swinging a fixed arc through empty air, so the extension is a function of the actual root-to-target distance, bounded by a per-role lean cap and scaled by the strike's own lunge (so it grows into the blow and retracts with the follow-through). The lean translates the upper body while the legs stay planted, so the cap is set by BODY COHERENCE — the torso may never float off the hips — and never by taste. Draw rigs (bows) and siege are excluded: an arrow is not modelled, so stretching a bow toward a distant target would be nonsense. KNOWN LIMIT, measured on the boar hunt: at melee range a villager and a boar stand ~1.12 apart root-to-root while their bodies are only ~0.13 and ~0.21 in half-extent, leaving ~0.78 world units of open ground between them; an arm-plus-axe spans roughly 0.4, so no body-coherent pose can fully close it. The reach correction narrows the tip-to-target gap from 0.366 to 0.246 world units; fully connecting requires melee attackers to APPROACH closer (a simulation spacing change — a unit body occupies only ~25% of its cell), which is deliberately not attempted here.
- construction work animation (user, 2026-07-14; shipped v0.2.9): a villager in the actively-building state plays a repeating hammer work loop — raise the hammer overhead, smash it down toward the build site/ground, brief reset — frozen by pause, deterministic, presentation-only (build progress, repair rates, simulation, saves, and replays unchanged). The projected entity view carries a DERIVED `activeVerb: 'building'` for this: it reads the same `unitCommands` predicate the HUD's selection panel uses, so nothing new is recorded or persisted and replay is identical by construction. The renderer gates the swing on being STATIONARY (a walking builder keeps its gait) and on having no attack pose, so the two channels — which own the same tool/arm parts — can never fight over one part; the loop runs a 900 ms cycle advanced only by the injected display clock and offset by the unit's stable identity phase, so two builders on one site never swing in lockstep. Roots, boots, legs, and the contact shadow stay planted throughout. GATHERING joined the loop in v0.3.113: `activeVerb` widened to `'building' | 'gathering'` — build/repair from the unit-command predicate as before, gathering from the gatherer task, which is 'gathering' only while the villager works AT the resource (walking and hauling legs project nothing, so the swing starts and stops exactly with the work). The task transition into 'gathering' raises an explicit component diff, because the unit is stationary from that moment and the projector would otherwise never re-read the verb — the swing was invisible until that one line. The same raise→smash→reset arc serves chopping, mining, and foraging; a distinct per-resource tool arc is a later refinement.
- wildlife retaliation attack animation (user, 2026-07-14; shipped v0.2.8, activating part of the wildlife-motion deferral above): a boar whose retaliation strike lands plays a target-facing charge/gore pose through the same successful-hit presentation channel as unit attacks — the wildlife damage site records into the SAME feed with the SAME witness rule (at least one attacker cell and one target cell visible to that perspective), so fog gating, suppression, determinism, pause-freeze, replay persistence, and the no-root-lunge rule are inherited rather than duplicated. The recorder's attacker gate accepts a live wildlife entity alongside units, and projection attaches the channel to wildlife resource views. The pose itself is baked into the STATIC resource lane at snapshot-build time (head/tusks/bristles pitch and shove about the body, whole-actor facing toward the captured target, legs and contact shadow planted), so it costs no animated-instance budget and freezes with equal presented time like every other cue. FACING IS STICKY and deliberately independent of the gore's pose weight (fixed v0.2.12): an animal that lunged at something keeps looking at it after the strike ends, and re-aims only on its next landed strike. Weighting facing by the decaying pose weight made a boar rotate home after every bite and snap around on the next one, reading as swiveling back and forth. Retained facing is disposable render history keyed by `id:generation` exactly like unit gait — never persisted, never a replay contract, dropped on bridge swap and rebuilt from the next strike a fresh renderer observes.
- construction, damage, and rubble states for buildings
- readable per-type building silhouettes rather than one generic shape for every building: each COMPLETED building renders as an original procedural shape grouped by RENDER ROLE — town-center (a wide hall with a gabled roof and flanking corner posts), fortress/castle (a crenellated keep with battlement merlons, no roof), wonder (a domed monument with a spire), house (a small home with a pitched roof and door), mill (a windmill with a four-blade cross), farm (a tilled field of furrow rows, no roof), drop-site/lumber-camp+mining-camp (an open camp with a lean-to roof and a stockpile mound), military/barracks+stable+archery-range+siege-workshop (a hall with a pitched roof and a banner flag — the roof was a flat band at v0.1.42 and became pitched in v0.1.132, see the pitched-roof rule below), blacksmith (a forge with a chimney and an anvil), market (an open stall with a striped awning), monastery (a chapel with a cross finial), tower/watch-tower (a tall narrow tower with a battlement cap), and wall/stone-wall+palisade-wall (a low battlement segment) — so a glance distinguishes the role, while the owner-color tint is kept as the body fill. Every primitive stays within the building's footprint rect so the existing selection-ring, footprint-outline, and health-bar geometry is unchanged. The construction (scaffold) and last-seen-ghost looks are role-agnostic and unchanged; only the completed look varies by role. Shipped v0.1.42 (the prior look was one generic body+roof for every building type). This dated Phaser-era deferral of per-building identity was superseded by the voxel-only v0.3.5 concrete facade/working-prop pass described below; per-civilization architecture's first pass shipped v0.3.105 (roof materials per building set — see the architecture-sets rule); the construction PROGRESS FILL shipped v0.3.99 — construction HP ramps with build progress, so `currentHp/maxHp` IS the build fraction and the scaffold stages off it with no new projection field: foundation and corner posts from placement, a wall course that climbs with the work, and the scaffold rails appearing past two-thirds — AoE2's rising build in three reads. The capture script gained a BUILD env (`BUILD="house@10,16"` places via a selected villager through the REAL placement pair before TICKS run) and the browser test api gained `beginBuildingPlacement`, so staged construction captures are reproducible; DAMAGE STATES shipped v0.3.97 — a completed building under 40% HP flips its renderable variant to 'damaged' (a per-tick sweep in `buildingDamageVariantSystem`, restored by repair), and the recipe layer wears two or three deterministic flame tongues (orange base, red tip, drifting smoke cube) hashed off the building's cell, so the same ruin always burns in the same places across saves and replays; fog-memory ghosts snapshot whichever look was last seen. In the same slice the building hit-point table was corrected to structures.csv's debut-age rows (houses 75→900, camps/mills 100→1000, Barracks 175→1200, Stable/Range 175→1500, Blacksmith/Market/Siege Workshop→2100, Watch Tower 175→1020, Stone Wall 2000→1800) — prototype-era placeholders the damage fixture tripped over; the CSV's later-age HP rows landed in v0.3.98: the three land military production buildings gain hit points per age (Barracks 1200/1500/1800/2100; Stable and Archery Range 1500/1800/2100 from their Feudal debut) via `buildingMaxHpForAge` at the creation site and a generic ratio in the age-up sweep that COMPOSES with the Byzantine percentage — each ladder replaces its own step, so a Byzantine Dark-Age Barracks reads 1320 (1200×1.1) and lands at exactly 1800 (1500×1.2) on Feudal. Destruction-oriented fixtures seed FRAGILE buildings (startHp) so outcome contracts stay quick.
- architecture-set variation by civilization region
- isometric building material breakup: tall completed buildings draw subtle base-parallel masonry course lines across both visible wall faces and sparse diagonal roof tile seams inside the roof diamond. This gives large structures like the Town Center material texture at the default zoom, closer to the visual density of Age of Empires II, while keeping the art original/procedural. The lines are render-only; footprints, hit testing, health bars, selection, construction, fog memory, simulation, saves, and replays are unchanged. Shipped v0.1.116.
- roof bevel/eave depth cues: tall completed buildings draw two inset highlight segments along the upper roof edges and two darker shadow/eave segments along the lower roof edges, over the existing roof tile seams. This makes large flat roof caps read as lit 3/4-view volumes while preserving the original/procedural art style. The cues are render-only; footprints, hit testing, health bars, selection, construction, fog memory, simulation, saves, and replays are unchanged. Shipped v0.1.123.
- Town Center roof post detail: the completed Town Center's central roof block includes four short flanking post strokes around the turret, giving the roof silhouette a supported hall/roof-frame read at default zoom while staying inside the existing roof footprint. This is render-only; footprints, hit testing, health bars, selection, construction, fog memory, simulation, saves, and replays are unchanged. Shipped v0.1.125.
- building texture/detail direction (user, 2026-07-14; first pass shipped v0.2.11, concrete-type pass shipped v0.3.5): completed buildings gain a further per-face detail pass toward the AoE2-HD read at default zoom — deeper masonry/timber relief, roof tile coursing, door/window trim, and role-appropriate props — still strictly original/procedural voxel work, within each building's footprint, render-only, and preserving all existing selection/hit/health/fog/replay contracts. v0.2.11 added shared wall-relief coursing (thin proud courses banded up the front and side faces, inset within the wall's own volume) to the mill, drop-site camps, military halls, and castle keep, plus door trim, market plank seams and stall posts; material choice carries the role (military halls coursed plaster, drop-sites stacked timber, castle heavy ashlar). v0.3.5 keeps those readable role masses and adds a deterministic two-to-four-prop signature for every concrete building type: ridges, bells, shutters, stockpiles, tools, weapon racks, hitching rails, hay, chimney iron, market goods, rose windows, buttresses, portcullis bars, reliefs, wall courses or lashings, and a farm scarecrow as appropriate. Each transformed detail corner stays inside the authoritative footprint, completed recipe matrices are the matrices used for presented silhouette picking, and the existing material/batch lanes are reused. The CONSTRUCTION (scaffold) look stays role-agnostic and undetailed so build progress remains legible — detail is a completed-building read. Remaining for later passes: per-civilization facade GEOMETRY beyond the v0.3.105 roof materials, and richer roof/window depth (construction progress shipped v0.3.99, damage states v0.3.97).
- units behind buildings (shipped v0.2.5, superseding the v0.1.133 Phaser cue that v0.2.0 removed): every displayed live unit whose MID-BODY screen anchor is covered by a non-memory building's projected part silhouette shows a solid FLAT-COLOURED mirror of its posed non-shadow parts, in one of two ownership colours: a bright blue for your own units and a warm coral for everyone else's. It was a flat WHITE mirror through v0.3.21, which had two problems visible on the real default map and not in the showcase fixture — a fully opaque white body over a dark roof reads as a GHOST standing in front of the building, and it says nothing about whose unit is hidden, which is most of what the cue is for. Deriving the colour from the unit's own tint does not work: the tints are already pale (a villager is cream for the human owner and pink for an enemy), so any lightening lands back at white and the owners stay indistinguishable. The two colours are deliberately flat, saturated, unlike any material colour in the world, and distinct from the yellow selection outline and the cyan drag rectangle. The anchor sits at the unit's own `visualTop * 0.55` above its recipe root (x+0.5/y+0.5), NOT at the ground pixel: an ankle-high plate that merely paints at a unit's feet — farm soil and team markers (≤0.51 wu), construction foundation slabs and knee-high wall courses — must never white-ghost a body standing in plain sight. Occluder regions project from the same rigid-part recipes picking trusts, EXCEPT that parts without real horizontal mass (min(width, depth) < 0.15 wu — flag poles, banners, scaffold rails, palisade stakes) are excluded: predicate and paint deliberately diverge for slivers, because a 2-px pole otherwise cuts flickering full-body ghost corridors across open ground. The building's MAX footprint-corner iso depth key must be strictly greater than the unit's — max-corner (not origin) depth is required in real 3-D because deeper wall cells paint over units on the building's high-(x+y) flank, while polygon containment geometrically excludes buildings wholly behind the unit. Mirrors ride the existing unlit ui lane with fresh `ui:occlusion:` keys (the pinned 7-batch set is unchanged), displaced along the camera ray by the drag marquee's screen-locked depth offset so they depth-test in front of buildings up to 8 world units tall; the engine-side ambient micro-wave (~1px) is deliberately dropped from mirrors. Inputs are the already fog-filtered presented entities, so a fog-hidden unit can never cue and memory ghosts neither occlude nor cue; only units are eligible (never buildings or resources). Three deliberate no-cue classes follow from the rules above and are intended, not gaps: units behind trees/resources (buildings only); units whose legs alone are hidden behind a low stone wall (0.76 wu base — the body stays readable, matching AoE2); and units behind palisades (every stake is hairline, so palisades contribute no occluder regions at all). The computation is change-gated with the snapshot rebuild (pause-frozen byte-identical, replay-identical) and exposed to tests via `getOccludedUnitStates` plus the `occlusion-showcase-fixture` capture scene.
- entity selection by visible voxel silhouette (v0.2.0): a click or context order tests the iso-pixel against convex hit regions projected from the same AoE rigid-part recipes and displayed transforms used to build units, resources, and buildings, with the established ground target as a fallback. Hit state is promoted only when its epoch/revision matches the renderer's presented state; input is fenced during context loss or an accepted/presented mismatch. This keeps moving bodies, raised walls, tools, and roofs interactive even when their ground-plane inverse falls outside the simulation footprint. Unit layer priority and human-owner exact-selection priority remain AoE rules. Repeated clicks at the same exact point cycle distinct unit/building/resource groups from the current hit set; prior group order is only a hint, so moved or vanished targets cannot be selected, and a different projected subpoint resets the cycle. Same-type equivalent units still use the double-click gesture. For a villager context order, a human-owned unit silhouette with no villager action does not hide the first resource, building, or non-owned unit hit beneath it; this makes a boar remain commandable while hunters surround it without changing raw selection order or Monk healing targets. Memory ghosts are never interactive. The proxy is data-only and Three-free; a reusable presented-state ray query remains a future engine contract.
- per-civilization ARCHITECTURE SETS, first pass (v0.3.105): AoE2 dresses each civilization's buildings in a regional set, and a scouted town names its owner's culture before a flag resolves. Every roster civilization maps to one of six sets — western-european (Britons, Celts, Franks), central-european (Teutons, Goths, Vikings, Huns, Magyars, Slavs), middle-eastern (Saracens, Persians, Turks, Berbers, Malians, Ethiopians, Indians), east-asian (Chinese, Japanese, Koreans, Mongols, Vietnamese, Khmer, Burmese), mediterranean (Byzantines, Italians, Portuguese, Spanish), mesoamerican (Aztecs, Mayans, Incas) — in `architectureStyles.ts` (sim-side, because the projector stamps `architecture` onto building views and fog memory snapshots it; unknown or absent civilizations read western-european, which is also the pre-v0.3.105 look, so legacy saves and replays without civ data render unchanged). The renderer re-keys exactly five canonical colours per set — the civilian thatch, the military tile, the dark ridge/cap tile (all three BEFORE the v0.3.83 owner-colour blend, so an architecture is a material family and the owner tint still sits on top), and from v0.3.108 the two wall-plaster slots (whitewash for a middle-eastern town, honeyed infill for a central-european one, limestone for a mesoamerican one; consulted centrally by the building part adder, so every wall face and plaster-toned prop follows its set); any other colour (stone, timber, pottery, hay bales, rope lashings) passes through untouched, because hay is hay in every civilization and a castle stays a castle. Fog-memory ghosts keep the set they were seen wearing; saves carry it per memory row (absent on older saves). v0.3.111 added per-set roof SILHOUETTES: the set shapes every stepped roof's steepness, taper, and tier count (western-european the identity; central-european steep alpine tiers; middle-eastern low two-tier flat roofs; east-asian an extra tier with a fast taper — the pagoda read; mediterranean low-pitched; mesoamerican tall temple steps). Geometry only ever shrinks within the recipe's own footprint fractions, so selection rings, health bars, and hit regions are untouched, and roof accents anchor on the returned roof top so they ride the new heights. Deeper per-set facade geometry (distinct wall/door forms, domes, minarets) remains a later pass.
- pitched building roofs: house-like completed buildings (town-center, house, mill, drop-site, military/barracks, blacksmith, market, monastery) cap their extruded volume with a PITCHED ridged-hip roof — two sloped side planes meeting at a ridge that runs along the screen-vertical (top↔bottom) axis, lifted above the flat roof by a footprint-scaled apex (clamped so it stays a roof, not a spire), with the left plane lit and the right plane shadowed under the fixed upper-left light. This replaces the flat-diamond roof cap so a building reads as a building rather than a flat-topped box. Roles that should read as flat-topped keep the flat roof: fortress/tower/wall wear their crenellated battlement (merlons), the wonder its dome, and the farm its flat plot. A pitched roof's per-role accent (town-center cupola, monastery cross, military banner, mill blades) is anchored on the ridge; flat-roof accents are unchanged. The roof keeps the owner-color tint for team identification. Render-only; footprints, hit testing, health bars, selection, construction, fog memory, simulation, saves, and replays are unchanged. Shipped v0.1.132.
- wildlife death carcass (user, 2026-07-14; shipped v0.2.8): the projected entity view carries an EXPLICIT `wildlifeAlive` life signal (true live, false for a persisted corpse, absent for non-wildlife) — the carcass look must not key off `currentHp === null`, which is a health-display convention shared with every other resource. A killed huntable animal presents as a fallen carcass at its death position — the body tipped onto its side, readable as dead at default zoom — for as long as the simulation keeps its gatherable corpse (carcass decay per §5.6), instead of vanishing or remaining upright. The carcass look is render-only over the existing corpse resource entity: amounts, gather targeting, hit silhouette, fog memory, saves, and replays are unchanged.
- wildlife species silhouettes: sheep, boar, and wolves share the same isometric ground-shadow/body foundation, but each gets a distinct small silhouette cue at default zoom. Sheep use wool clumps and short legs, boar use a heavier body with tusks, and wolves use pointed ears plus a tail. These details are render-only and preserve existing resource ownership/tint semantics, hit testing, selection, combat, gathering, fog memory, simulation, saves, and replays. Shipped v0.1.117.
- faceted mineral deposits: gold and stone mines draw as small iso mounds over a ground shadow, with tint-derived light/dark triangular facet planes and edge strokes so they read as structured deposits rather than soft blobs at default zoom. The details are render-only and preserve resource amounts, gathering, hit testing, selection, fog memory, simulation, saves, and replays. Shipped v0.1.121.
- resource visual variation (user, 2026-07-14; extended v0.3.3): gold mines, stone mines, and trees draw deterministic per-instance variants so adjacent same-type resources no longer read as copies. Across map-position diversity, trees draw from three recognizable FORM families—broadleaf, tall tiered conifer, and asymmetrical wind-swept—plus three natural canopy palettes and bounded per-part offset, size, yaw, trunk-height, and lean variation; any particular small cluster may contain a subset because each tree is selected independently from its position. Mines vary each rock's offset, size, and yaw plus glint/vein placement. Berry bushes (added v0.3.12 by user request) draw from three FORM families—twin-mound, low sprawl, and upright dome—plus three foliage palettes and 3-5 berry clusters with hashed placement, size, and a ripeness mix between the resource accent tint and deep berry red; every form keeps the shared readable anchor parts. Every variant is seeded by the resource's MAP POSITION—immobile resources never move, so the look is identical every frame, across save/load, and in replay, with no per-frame or per-load randomness. Deviations are bounded so rotated geometry stays inside the resource's one-cell presentation envelope and total height remains within a readable band. For trees and mines the part KEY SET is identical across variants; berry-bush forms differ in part set by design, but each instance's set is a pure function of its position, so the part-derived hit silhouette, selection, and fog memory stay synchronized in every case. Render-only: amounts and gathering are unaffected.
- every tier of an upgrade line is visually distinguishable (v0.3.46): researching an upgrade must change what the unit LOOKS like, not only what it does. Concretely, for each line in the unit-upgrade table no two members may produce the same rendered geometry — the tier must reach the screen as a difference in surface, colour, position, size or rotation. A difference that exists only in a part's NAME does not count, because a name is not a pixel: a part named `iron-roof` that draws the leather roof of the tier below is the defect this rule exists to stop. Warship hulls and armament scale with their tier, siege roofs and frames change material with theirs, and every Elite tier carries a gilded mark, extending the roster's existing language for a top tier rather than adding a rank badge AoE2 does not have. Enforced by `tests/rendering/unitTierVisualDistinction.test.ts`, which derives the lines from the upgrade table itself, so a line added later is covered without touching the test.
- fog-of-war edge fade: visible cells that border a non-visible von-Neumann neighbour draw a low-alpha isometric shroud diamond after the hard fog masks, softening the explored frontier so it reads less like a sawtooth tile cutout while preserving the underlying visibility and exploration data. This is render-only; fog memory, pathing, target visibility, selection, saves, and replays are unchanged. Shipped v0.1.122.
- textured terrain surfaces rather than flat per-kind color fills: terrain cells carry subtle, deterministic per-cell brightness variation (a hue-preserving ±7% jitter; shipped v0.1.30) so same-kind cells do not read as one flat block, AND adjacent cells of DIFFERENT kinds blend at their shared edge instead of meeting at a hard rectangular seam — for each cell edge whose von-Neumann neighbour is a different kind, the renderer stipples a deterministic feather band of small specks on the inner side of the edge, tinted with the per-channel average (blend) of the two kinds' base colors; the neighbour cell feathers back symmetrically so the two bands interlock into a soft, dithered transition (a grass/water shore feathers green into blue, a grass/hill edge green into tan). Shipped v0.1.43. The transition is a pure function of the cell kind, its neighbour kinds, and the cell coordinates (deterministic — no per-frame random or time, so the ground never shimmers), every speck stays strictly inside its own cell square (so unit/building/health-bar/selection geometry is unaffected), and the blend renders under all entity/fog/selection/grid overlays. The standalone voxel material-detail pass shipped v0.3.4 and was rebuilt on a decoration variant library in v0.3.11: ground decoration is pulled per cell from small procedural libraries — scattered pale/dark grass flecks with varied size, angle, and placement; grass tuft clusters drawn from at least four distinct cluster shapes (pair, fan, ring, tall sentinel, low patch) with per-blade height, lean, and colour variation; occasional pebble scatters (one to four squashed grey stones) on grass and hills; hill stone formations drawn from at least three distinct formation shapes (boulder-and-shard, twin boulders, slab cluster, cairn) with hashed anchor, rotation, scale, and grey-tone; and forest leaf litter and fallen logs. Variant selection, placement, and parameter jitter are pure position hashes: the same cell always decorates identically, and no two neighbouring cells read as one repeated stamp. Water adds dark ripples, bright sky-and-sun reflection strips, and spatially phased wave crests. The waterline is NOT a straight static line, and it is CONNECTED (v0.3.12, replacing the v0.3.11 independent dashes after user feedback): each visible water-cell edge that touches land carries one six-box surf chain sampled from a smooth quadratic offset curve, consecutive boxes overlap and follow the local tangent, and the curve's terminal offsets are hashed from the shared CORNER coordinates so adjoining tiles agree — the line continues across tile boundaries, meets its perpendicular neighbour chain at the shared diagonal point on concave (inner) corners, and pinches toward the land point at convex (headland) corners. Every box is animated: it laps perpendicular to the edge toward the land on a shared period with phase derived from the along-coast world coordinate (the wave sweeps down the shoreline instead of blinking in unison), thickness and height collapse toward a hairline at the trough while length barely breathes so the line thins but never breaks, and the lap amplitude tapers to near zero at chain ends so corner joints between chains on different phase axes never tear. Terrain cell colour is a deterministic per-cell pipeline (v0.3.12, by user request): two-octave value-noise PATCH fields give grass (and water) patch-scale colour variation — accents luma-matched to the projected base tint so the fields shift hue while a separate brightness term carries the light/dark patchiness, which keeps fog-darkened cells dark; water cells within one ring of land lighten toward a shallow turquoise band (two rings at half strength, diagonals included so the band wraps corners); land cells bordering a different land kind pull toward that neighbour's colour so kind boundaries meet as a gradient rather than a cut; and land cells bordering water warm toward a wet sandy edge tone. The opaque terrain chunk remains the flat deterministic fallback; water accents (crests and surf) use a separate low-roughness standard-material surface with static and animated lanes, at most one animated crest per water cell, one six-box surf chain per shoreline edge, and static degradation when the shared animation budget is exhausted. Equal displayed simulation time produces identical water geometry, advancing displayed simulation time moves the crests and surf, hidden or explored-only cells emit no detail, and every full-cycle sampled corner remains inside its source cell. This is a stylized light response, not planar scene mirroring, an environment map, transparent water, or a second render pass. Terrain occupancy, ground-plane picking, fog authority, saves, and replays are unchanged. Elevation-based light/shadow is deferred: projected terrain retains per-cell elevation, but the voxel adapter deliberately flattens it until raised-terrain presentation and matching presented-state picking ship together. A first-cut beach treatment shipped v0.3.12 at cell resolution (the wet-sand edge blend plus the shallow-water band); sub-cell curved terrain seams (marching-squares-style coastline meshes) are an engine-level terrain-contract feature and remain deferred, as do bespoke per-pair transition textures beyond the shipped colour blends.
- readable per-type unit silhouettes rather than flat tinted circles: the seven original procedural body families — villager, infantry, archer, cavalry, cavalry-archer, siege, and monk — remain the shared construction grammar, while v0.3.6 gives every one of the 34 `UnitType` values an exhaustive concrete profile for armor, headgear, shield, mount, weapon, tier, and signature detail. Infantry visibly progress through sword, greatsword, polearm, and halberd equipment; ranged units distinguish bow, longbow, crossbow, pavise, and javelin; cavalry distinguish horse/camel bodies, barding, swords, lances, polearms, and mounted bows; and siege distinguish stone thrower, scorpion, ram, cannon, and trebuchet mechanisms. The shape orients toward displayed travel or, during a successful hit, toward the captured target point; every recipe stays deterministic, at most 32 parts, grounded, and inside bounded cell-centred presentation space so health and selection cues remain aligned. Shipped v0.1.41 in the former Phaser renderer, superseded by richer role recipes in v0.1.148 and concrete type profiles in v0.3.6. Static contact shadows, planted foot/wheel treatment, distance-driven gait, and whole-actor travel facing remain. Successful-hit poses select the concrete visible weapon's matching chop, slash, cleave, thrust, draw, throw, recoil, or release rig with connected assemblies and no authoritative root lunge. Per-civilization unit art, skeletal clips, projectile flight, gathering clips, and richer death motion remain deferred.
- HUD icons authored as ORIGINAL procedural inline SVG (no copyrighted icons, sprites, image files, or icon fonts; every glyph is self-contained hand-drawn `<path>`/`<rect>`/`<circle>` markup stroked with `currentColor` so the existing gold-on-dark-teal palette controls the tone). Shipped coverage: top-bar resource chips and Build buttons in v0.1.39; selected unit/building badges in v0.1.44; Train/Research/Market/Action command-card buttons in v0.1.72-v0.1.76; selected resource/wildlife/relic badges in v0.1.77-v0.1.78; and seven dedicated game-menu action icons in v0.3.8. The resource, command, and selection families augment visible labels and preserve their existing selection/data hooks. Game-menu actions intentionally use icons as the sole visible action-name affordance while their native buttons, accessible names, hover/focus tooltips, and visible focus treatment preserve the complete textual meaning; all decorative glyphs remain `aria-hidden`. Remaining UI-icon polish: per-species/per-tech art variants and a clearer market buy/sell arrow distinction.
- Minimap draw order keeps entity markers legible: terrain cells draw first, high-contrast dark-backed entity markers draw above the terrain, and fog plus the viewport quad draw last. This keeps player/enemy/resource/building positions legible inside the explored blob while preserving the camera click/drag mapping. (The minimap PROJECTION is the isometric diamond of §14.3, shipped v0.1.130, which superseded the original top-down rectangle from v0.1.120; only the projection changed — this draw-order layering is unchanged.)
- voxel selection and combat feedback (v0.2.0, attack follow-up v0.2.3): selection and drag preview use static yellow/cyan rigid-part outlines, the drag rectangle uses four cyan voxel segments, HP loss emits a bounded 260 ms voxel spark cluster, and the transient fog-correct witnessed-death feed emits static voxel debris. Perspective-eligible successful unit hits now also drive the attacker's target-facing role pose at impact and through recovery, independently for every attacker; wildlife retaliation animation shipped in v0.2.8. These cues never affect authoritative damage, reloads, paths, roots, selection, or replay determinism. The former Phaser selection pulse and collapse/dust animation are historical behavior, not a live path. Richer selection motion, gathering feedback, animated death collapse, building rubble, and projectiles remain future voxel work.
- art style setting — Moebius by default (user direction 2026-08-17, "migrate aoe2 to moebius art style", then "needs brighter more vibrant colors"): the world canvas is resolved through an ink-and-flat-colour pass instead of being drawn straight to the screen. The frame is quantised into flat tone bands, chroma and gain are lifted so flat colour reads as *drawn* rather than as a lit frame with its gradients removed, and contours are inked where depth breaks. The pass belongs to the sibling `voxel` package (`StylizedResolvePass`, opt-in through `ThreeRenderRuntimeOptions.stylizedResolve`), because it reads only depth, normals, and luminance and so is not AoE-specific; AoE owns the tuning, and its measured values with their provenance live in `src/rendering/artStyles.ts`. Two styles ship: **Moebius** (the default) and **Painted** (the previous look). Painted is the ABSENCE of the pass, not a neutral configuration of it, so choosing it costs nothing — no second scene render, no fullscreen resolve, no offscreen targets. The Settings section of the in-game menu cycles between them, and switching re-resolves the frame rather than the world, so no voxel content is rebuilt and no simulation state is touched. The choice is a DISPLAY PREFERENCE, not world state: it persists per player in `localStorage`, never enters the save format (so loading another player's save cannot impose their look, and a match played in Painted can be watched in Moebius), and a stored id naming a style that no longer exists falls back to the default rather than failing to start. Storage that throws — private browsing, a disabled origin, an exhausted quota — must never stop the game booting or refuse the in-session switch. Contours are SILHOUETTE-ONLY here and this is a property of voxel geometry, not a preference: a normal-crease edge source cannot discriminate when every face junction is exactly 90 degrees, so it inks every cube edge equally and costs a quarter of the frame's brightness without adding structure. Deferred: per-style palettes, tapered line weight, and a second tuning for zoom levels away from the default.
- distinct alert, economy, combat, and age-up audio cues — first slice shipped v0.3.109, all ORIGINAL/procedural (synthesized from oscillators at play time; no samples, no audio assets, the sound analogue of the art rule). Shipped cues: a two-tone brass-like horn when an attack lands on your town (an own building or villager; throttled to one horn per ~20s, AoE2's rule), a rising fanfare on each age transition (never for the starting age), and a victory/defeat sting exactly once at match end. The decision logic (`gameAudioController`) observes projections only — the witnessed attack feed, the HUD age, the match outcome — and never touches the simulation; the synth voices (`proceduralVoices`) are injected, so the controller tests without an AudioContext. The AudioContext is created lazily on the first user gesture (the browser autoplay rule). A speaker toggle sits above the idle-villager bell; mute silences the speaker, not the state machine (unmuting does not replay missed cues), and persists per player in localStorage under the art-style rule that a throwing storage must never break the game. v0.3.110 added a research-complete ding (one per completion, batches collapse to one — information, not noise; pre-seeded techs on an advanced-age start never ding) and a two-strike countdown bell when a wonder/relic countdown activates. v0.3.116 added the town-bell peal — three urgent strikes when the player rings the bell, observed through a live-facade ring tally (`getTownBellRings`; audio-only, never sim state, so replays stay silent and saves carry nothing). Remaining audio: command acks, unit selection voices, ambient loops.

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
- **Model policy: all playtest LLM calls use ONE model** — tactical, strategy, and the conformance probe. Do not split tiers across models. **Current model: `claude-fable-5` (2026-07-10 owner directive: everything uses the most advanced model available — the 2026-06-12 Fable ban is lifted; both `claude-fable-5` and `claude-fable-5[1m]` smoke-verified that day). Fall back to the latest Opus (`claude-opus-5`) only while Fable is unavailable, and swap back when it returns.** Per-call cost on the claude-code provider is prelude-dominated, so the Fable/Opus rate gap is immaterial (~$0.61 vs ~$0.67/decision observed on campaign-3). When swapping wholesale (unavailability, flagship bump), smoke-test the new id via `echo ok | claude -p --model <id>` first (per the AGENTS.md model-currency rule) and update all call sites (`scripts/playtest-llm.mjs` ×2 plus its cost-note strings, `scripts/playtest-findings.mjs` ×1) plus the `DEFAULT_LLM_COST_TABLE` comment in `src/game/playtest/types.ts`.
- **Paused-sim decisions (playtest-fixes C).** The runner pauses the simulation (`__AOE2_TEST__.setPaused(true)`, a pass-through to `bridge.setPaused`) once after boot and keeps it paused while the agent thinks; the host's `advanceTicks` atomically unpauses → steps N ticks → repauses inside one synchronous page task. The bridge tick therefore moves ONLY via `advanceTicks`: `--max-ticks` is exact, and screenshot checkpoints land precisely when they are multiples of `--decision-interval`. Without this, real-time drift during 10-100s LLM calls advanced the game ~600-1000 ticks per decision and made checkpoint capture impossible.
- **Agent context (playtest-fixes A/B).** The per-decision snapshot includes the agent's OWN units (id/kind/position/task, cap 150), own buildings (id/kind/position/isComplete, cap 64), and nearby gatherable resources (id/kind/position/amount, visibility-filtered, sorted by distance to the first own building, cap 64) — these are the only legitimate sources for the command tools' entity ids and are never fog-filtered (own forces) so the model cannot be id-blind. After each decision, the engine's dispatch verdicts (accepted/rejected + reasons) are reported back to the agent and rendered into the next tactical prompt, with an explicit warning block when the previous decision had rejections. The dispatch boundary also enforces ownership: commands whose acting entity (unitId/sheepId/buildingId/builderId/playerId) does not belong to the agent's owner are rejected pre-queue with reason `not-owned` — the engine's semantic validators carry no actor identity, so without this gate the agent could command enemy entities. Pre-queue rejections (not-owned, malformed payloads) are merged into the same feedback loop as engine verdicts. **Agent affordances (2026-06-11, campaign-1 backlog #1-#3):** the snapshot additionally carries `buildingOptions` — per completed owned building type, the research options available now (with costs), the locked research with the actionable WHY (shared reason engine with the `cannot_research` validator; in-flight techs are marked "already being researched" so the agent doesn't double-queue), trainable units, and the villager build menu with footprints + costs — and `placementHints` — up to 6 open 2x2 anchors and 4 open 3x3 anchors near the agent's town center, found by a deterministic ring scan in which every footprint cell must be unblocked AND currently visible to the agent (fog reveals nothing, even under `--omniscient`). Rejection messages themselves are actionable per §15.2, and the `building.placeConfirm` tool description points the model at `placementHints`.
- **Snapshot visibility (Phase-6.B).** The agent's per-decision state snapshot filters enemy units/buildings through per-owner visibility by default. Buildings use the engine's any-cell-visible rule (consistent with the renderer + target selection); units use single-cell. `--omniscient` (or per-row `omniscient: true`) opts into cheat-mode global view. As of 2026-06-10 the corpus smoke row runs fog-filtered (the agent has own-entity context, so cheat-mode is no longer needed).
- **Conformance capture (post-hoc; replaces the removed observation oracle).** The "looked-fun" verdict was removed 2026-06-13 on user directive: *"Looked-fun is not nearly enough. That is actually garbage. I don't need your judgement of fun. People play games and they decide what is fun."* In its place, `npm run playtest:findings -- <run-prefix>` runs a DECOUPLED pass over the saved envelope + slim trace (+ the last checkpoint screenshot) and writes `<prefix>.findings.md`, merging `metrics` + `findings` into the envelope. Two layers: (1) **deterministic metrics**, no LLM — command-type usage, accept/reject tallied by reason (a command rejected `unknown-kind` literally means that action is unimplemented), stall decisions, distinct command types, and the winner outcome; (2) an **advisory LLM critique** grounded in publicly-known AoE2 rules that records `findings: [{category, area, observed, expected, severity, suggestion}]` with `category ∈ {missing-feature, spec-divergence, functional-bug, balance-divergence, ux-gap}`. The probe is instructed to be objective and checkable and to NOT judge fun. **Advisory only** — does NOT affect CI exit codes; engineHalt remains the regression signal. Decoupled so it re-runs for free on ANY past or future run, including runs captured without an in-run oracle (e.g. campaign-4); `--no-llm` produces metrics only. This is the measurement half of the build loop: run → findings → implement → re-run.
- **Findings persist as agent markers on the run bundle (2026-06-15, v0.1.36).** When `playtest:findings` runs the advisory probe, it also overlays each finding onto the run's SessionBundle (`<prefix>.json`) as an `author: 'agent'` annotation marker, so replaying that bundle surfaces the AI's findings in the existing replay marker UI — the `MarkerListPanel` list (with an `agent` author badge + a severity icon) and the `TimelinePanel` pins — with no new rendering. Each finding becomes one marker anchored at the run's LAST decision tick (findings carry no per-finding tick; this coarse anchor is intentional — rich per-finding anchoring is deferred), with NO spatial position (findings have no cell). Mapping: marker `category` is always `ai` (the finding's gap-type `missing-feature|spec-divergence|functional-bug|balance-divergence|ux-gap` is preserved as `data.findingCategory`, not fuzzy-mapped onto a subsystem); severity `high→bug`, `medium→warning`, `low→info` (`blocker` is reserved for human authors); marker text is `[<gap-type>] <area>: <observed>`, with the full `expected`/`suggestion` carried in `data` for a future detail panel. The injection is IN-PLACE and IDEMPOTENT — re-running the findings pass replaces any prior agent markers (preserving human markers) instead of duplicating — and is non-fatal if the bundle file is absent (older runs / a typoed prefix warn-and-skip while the findings markdown + envelope still write). Persistence is direct `bundle.markers[]` injection, NOT `recorder.addMarker`: findings are computed post-hoc with no live world/recorder (and `recorder.addMarker` requires one). The engine's marker validator actually permits retroactive past-tick markers and rejects only future ticks, so the tick is not the blocker — the absence of a live recorder is. The replay-load path is structural-only so well-formed injected markers load and render directly. This is the first consumer of the `author: 'agent'` marker path defined in the 2026-04-29 annotation-ui thread.
- **Provider-error classification + retry (2026-06-13).** A transient LLM-call failure (the `claude -p` subprocess exiting non-zero, timing out, failing to spawn, an `is_error` envelope, or an SDK call error) is a `ProviderCallError`, distinct from an engine/host crash. A `RetryingProvider` wrapper retries the failing provider CALL in place with exponential backoff (`backoffMs * 2^attempt`; the campaign script uses 2 retries / 3s base → 3 attempts) before giving up; a succeeding retry continues the run. Retrying the call (not the whole decision) keeps each decision idempotent — no double strategy-refresh charge. When retries are exhausted the run stops with the distinct stop reason **`providerError`** — NOT `engineHalt`. The difference is load-bearing: on a provider failure the simulation and page are healthy (only the model call died), so the winner oracle still scores the game, the final screenshot still captures, and the bundle still exports; `engineHalt` (a genuine sim/page crash) suppresses all three. Any non-provider throw (host calls, agent bugs, deterministic config errors like a missing cost-table row) keeps `engineHalt`. Rationale: campaign-2/-3 each reached Feudal with a healthy economy but were cut short and mis-scored when a one-off `claude exit 1` was treated as a fatal engine halt; this makes a subprocess blip recoverable and, when not, honestly labelled. For corpus CI, `providerError` does NOT trip the HIGH-regression gate — it is exempted alongside `cost-budget-exceeded` (shared predicate `isLlmCorpusRegression` in `corpusRegression.ts`), so `engineHalt` plus genuinely-unexpected error messages stay the only corpus regression signals; the row stays visible (amber, distinct from clean-green and halt-red) in `SUMMARY-LLM.md` and the dashboard.
- **Winner oracle (Phase-6.D).** Always populated on clean exits as `envelope.winner`: `{kind: 'winner', ownerId}` when exactly one owner has living units or buildings; `{kind: 'in-progress', aliveOwners: number[]}` when multiple owners are alive (game didn't play out); `{kind: 'tie'}` when no owner has any entities (mutual destruction or scenario reset). Read of `economy.units` + `economy.buildings`; excludes `economy.resources` (sheep/wildlife/gather sites), so neutral entities don't perturb scoring. Includes under-construction buildings — owner is "alive" if they have any worldly footprint. Field is OMITTED (not set to undefined) when `stopReason === 'engineHalt'`; consumers should use `'winner' in envelope` to distinguish "scored" from "not scored". Cost-budget exits (`stopReason='stopWhen'` + `errorMessage='cost-budget-exceeded'`) DO get scored — the result will typically be `kind: 'in-progress'`, capturing partial-play state honestly. Winner extraction always runs on a clean exit because it has zero marginal cost (engine state read, no LLM call).
- **Checkpoint screenshots (option C, 2026-06-10 — replaces the Phase-6.C.1 visual-regression oracle).** The runner captures a screenshot whenever an advance lands exactly on a checkpoint tick (`--screenshot-every <ticks>`, default 1000, 0 disables; align to multiples of `--decision-interval`) and persists them to `<out>-screenshots/<tick>.png` for the corpus dashboard. There is NO baseline comparison and NO visual CI gate for LLM runs: a non-deterministic player has no "correct" reference image, so pixel diffs against a fixed PNG measured expected divergence rather than regressions (campaign-1 evidence: 9.86% diffs from a competently different base layout). Simulation determinism remains covered by the replay/snapshot-equivalence suites and render correctness by the deterministic Playwright browser tests; `engineHalt` plus the gameplay oracles are the LLM-row regression signals, and the conformance findings are the advisory build-backlog signal. The pure `visualOracle.ts` module is retained, unwired, for a future deterministic corpus row where baselines are meaningful.
- **HTML dashboard.** `npm run playtest:corpus-dashboard -- <corpus-dir>` (or auto-pick newest by mtime when no arg) emits `dashboard.html` next to `SUMMARY-LLM.md`: a per-run summary table (cost / ticks / decisions / winner / conformance-findings count / checkpoint-screenshot count) and per-run thumbnail grids of the checkpoint screenshots. Pure script — no runtime dependencies; thumbnails are referenced via relative `<img src=>` paths so the file works directly in the browser when opened from the corpus-llm dir.
- **Automated fix arm — removed 2026-08-01.** The harness discovers and reports; it does not write code. `playtest:llm-auto-fix`, `propose-fix`, `playtest:recursive`, and the `applyAndGate` primitive (git apply / branch / gate / commit / revert) are gone, along with the N=3 counterfactual fix-validation that guarded them. Nothing in this repo now proposes a patch, applies one, or touches git on the harness's behalf — a person or an agent session drives every fix through the ordinary TDD/gates/review cycle. What remains is the observation half: `playtest`, `playtest:llm`, `playtest:corpus*`, `playtest:findings`, `run-oracles`, `playtest:canary`, `playtest:self-improve`, and `replay:inspect`. Rationale: across the loop's operating life the automated arm proved one fix; the discovery tooling around it is what actually earned its keep. Each `playtest:llm` invocation still deletes any pre-existing envelope at its `--out` path before running, so a child crash before envelope-write cannot drive false validation against stale data.
- **The harness plays the way a human plays (owner directive, 2026-08-23).** A feature is exercised by a FULL MATCH from the human slot against the in-game AI, long enough to reach the mechanic under test — a Castle-Age technology is not exercised by a 3000-tick run — with the agent reading the rendered screen (§15.7 visual-playtest header) rather than the JSON snapshot alone. Orders ride the command-tool bridge, which is the deliberate boundary: the bridge is the reliable order surface, and the separate obligation is that **everything a human is supposed to be able to do is also reachable with mouse and keyboard**, proved by the Playwright browser suite rather than assumed. A hand-written synthetic probe does not substitute for a run when the harness can answer the question (`playtest:llm`, `playtest:corpus-llm`, `playtest:findings`, `replay:inspect`, `run-oracles`).
- **Cost-budget gate.** The agent's rolling cost-budget (`--cost-budget`, default $5) trips when notional API-equivalent cost crosses the cap. With Claude Code subscription, each call carries a ~15K-token cache_creation prelude (~$0.55/call observed on `claude-fable-5` at $10/$50 per MTok — the own-entity context grew prompts; blended ≈ $0.61/decision with the default strategy cadence). Default $5 budget allows ~8 decisions; bump (`--cost-budget 20` ≈ a full 5000-tick run) for longer campaigns.
- **Determinism caveat.** Bundles replay bit-exact, but re-querying the LLM on the same seed is non-deterministic even at temperature 0. Any claim derived from a fresh LLM run therefore needs repeat sampling before it means anything; a single clean rerun is not evidence that a change worked.
- **Shared visual-playtest prompt context (2026-07-06).** Tactical prompts prepend the civ-engine v1.3 visual-playtest player-surface header (`buildVisualPlaytestPrompt`): screenshot metadata, a short visible-text summary, and a control list for the command tools. This shared header is an adapter boost only; the existing JSON snapshot and command-tool schemas remain the canonical command surface.
- **Shared visual-playtest finding payload (2026-07-06).** Agent finding markers keep the aoe2 marker contract (`author:'agent'`, `category:'ai'`, deterministic ids, severity mapping, text, and anchor tick) and also embed `data.visualPlaytest = {schemaVersion: 1, type: 'finding', finding}` from civ-engine's `visualPlaytestFindingToMarker`, so engine-side visual-playtest consumers can recover the shared finding schema while existing aoe2 marker UI and `isAoeMarkerData` continue to pass.
- **Recursive self-improvement ledger (2026-07-08).** `npm run playtest:self-improve -- --current <prefix> [--baseline <prefix>] [--out <path>] [--oracles]` reads saved playtest artifacts (`.json`, `.envelope.json`, and optional `.llm-trace.jsonl`), recovers standardized `civ-engine` `ImprovementFinding` payloads from markers or envelope findings, converts deterministic oracle violations into the same shared finding contract when `--oracles` is enabled, records replay self-check evidence through the aoe2 replay-world seam, classifies each finding into proposal/fix/observe/none routing, preserves its disposition, and compares baseline/current objective metrics with `compareMetricsResults`. Baseline/current comparisons also include standardized finding deltas: `resolved`, `persisted`, and `introduced` across the rerun. Generic findings are keyed by id; deterministic oracle findings are keyed by oracle/tick/message evidence so generated id suffix churn does not masquerade as a fixed or newly introduced issue. The command may write a ledger when replay self-check fails, but that failure is recorded as blocking evidence rather than treated as success. Strong replay evidence requires at least one checked segment and zero skipped segments; no-op or failure-skipped self-checks are recorded as failed evidence even if the engine result reports no divergences. `scripts/run-oracles.mjs` remains the gate/report path; the standard path for oracle findings is the ledger command with `--oracles`. The ledger is where the loop ends: it reports classified findings for a human or agent session to act on, and since 2026-08-01 there is no proposal-intake or auto-apply path beyond it.

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
