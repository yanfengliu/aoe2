# Changelog

This changelog lists user-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins are recorded in `docs/devlog/`.

## 0.1.106 - 2026-07-05

### Trees and mines render in 3D isometric

Forests and mines used to draw as flat top-down squares scattered over the isometric terrain. Trees now render as a brown trunk under a raised leafy canopy sitting on a ground shadow, so a forest reads as real 3D woodland; gold and stone mines render as a small mound of tinted rock lumps on a shadow. Berry bushes, sheep, boar, wolves, fish, relics, and farms are unchanged. Purely visual — resource amounts, gathering, and selection are unchanged.

## 0.1.105 - 2026-07-05

### Foot units read as upright figures

Villagers, infantry, and archers now draw with a small head above the body, so they read as little standing figures on the isometric ground instead of flat top-down blobs. Monks already stand (their robe silhouette) and mounted units keep their rider, so no change there. Purely visual — unit size, facing, selection rings, and health bars are unchanged.

## 0.1.104 - 2026-07-05

### Buildings render as 3D isometric structures

Completed buildings now draw as proper 3/4-view isometric volumes instead of flat shapes: each building's footprint projects to a ground diamond that is extruded upward by a per-role height into a solid box with a lit wall face, a shadowed wall face, and an owner-tinted roof — so it reads as sitting *on* the terrain with real depth. A per-role roof accent keeps every type distinct at a glance: a dome on the Wonder, a cross on the Monastery, crenellations on the Castle / Watch Tower / walls, a banner on military buildings, sail-blades on the Mill, and a central turret on the Town Center. Buildings under construction show a low stub of the eventual volume; a last-seen (fogged) building shows its flat footprint diamond. Purely visual — footprints, selection, and gameplay are unchanged. Detailed per-building facades and animation follow in later increments.

## 0.1.103 - 2026-07-05

### Isometric 2.5D world

The game world now renders in an isometric (2.5D diamond) projection instead of the flat top-down grid — the first structural step of the isometric overhaul toward an AoE2-HD-quality look (original/procedural art only). Terrain tiles are drawn as 2:1 diamonds, and every entity (units, buildings, resources) is placed on the iso plane and depth-sorted back-to-front so nearer objects correctly occlude farther ones. The camera now lives in iso-pixel space: it frames the player's Town Center on the first frame, pans/zooms/edge-scrolls within the diamond world bounds, and the minimap (still a top-down cell grid) maps clicks and its viewport rectangle through the projection. Selection rings, the drag-select marquee, the placement preview, and all click / right-click targeting were converted to the iso projection so they land exactly on-screen. No gameplay, economy, or combat rules changed — this is purely how the world is drawn and interacted with. Detailed per-tile art, unit sprites, and elevation/cliffs follow in later increments.

## 0.1.102 - 2026-07-05

### Units cast a ground shadow

Every unit now draws a subtle translucent ground shadow beneath it, so units read as standing *on* the terrain instead of as flat silhouettes painted over it. First step of a graphics-polish pass. Purely visual — no effect on gameplay, selection, or health bars.

## 0.1.101 - 2026-07-05

### Civilization roster capped to five

Scope decision: the game supports a curated roster of five civilizations with distinct bonuses — **Britons, Franks, Goths, Aztecs, Mongols**. Every other civilization is still selectable (`?civ=`) but plays with default stats. To honor this cap, the Slavs "Farmers work 15% faster" bonus added in 0.1.100 was removed. This keeps civ variety focused so effort goes toward an otherwise complete, polished game.

## 0.1.100 - 2026-07-05

### Slavs civilization bonus: farmers work 15% faster

Added the Slavs civilization — its villagers gather from **farms 15% faster**, matching Age of Empires II. It joins the roster of civilizations with an active bonus (Britons, Franks, Goths, Aztecs, Mongols). Pick Slavs with `?civ=Slavs`. Every other civilization is unchanged.

## 0.1.99 - 2026-07-05

### Mongols civilization bonus: Light Cavalry and Hussars have +30% HP

Added a second Mongols bonus — **Light Cavalry and Hussars have +30% HP** (the base Scout Cavalry is unaffected), matching Age of Empires II. Combined with the hunting bonus (0.1.98), Mongols now field a tougher, faster-fed scouting cavalry. Every other civilization is unchanged.

## 0.1.98 - 2026-07-05

### Mongols civilization bonus: hunters work 50% faster

Added the Mongols civilization bonus — villagers gathering **boar** (the game's huntable) do so **50% faster**, matching Age of Empires II. It joins the existing per-civ bonuses (Britons shepherds, Franks knights, Goths infantry, Aztecs military). Pick Mongols with `?civ=Mongols`. Every other civilization is unchanged.

## 0.1.97 - 2026-07-05

### The game menu (Esc / ☰) now pauses the game

Opening the game menu with **Esc** or the **☰** button now pauses the simulation, and closing it (Resume, the backdrop, or Esc again) resumes — so you can step away or think without the match running on. If you had already paused the game yourself before opening the menu, closing it leaves the game paused rather than resuming it. This completes the menu shipped in 0.1.95, where auto-pause was deferred.

## 0.1.96 - 2026-07-04

### AI no longer freezes one age short when it qualifies while villager-poor

Fixed an AI economy deadlock. When the AI qualified for the next age (its prerequisite buildings were done) but still had few villagers, it could freeze — a replay showed it stuck at 7 Feudal villagers with food pinned at 339 while it "reserved" 800 food for a Castle it could never gather. The cause: the AI was withholding food from *villager* production to bank it for the age-up, which starved the very villagers that gather that food. Villager training is no longer throttled by the age-up reserve (only military is, since military is discretionary). The AI now grows its economy to its per-age villager cap and banks the age-up cost from the surplus — a replay after the fix showed it reach 22 Feudal villagers and bank 817 food, past the 800 a Castle costs. Age-up timing is still protected by the existing 60%-of-cost "saving" latch, which pauses all production near the top to bank the final stretch.

## 0.1.95 - 2026-07-04

### Game menu (Esc / ☰), and a top bar that never shifts

Press **Esc** or click the new **☰** button (top-right of the resource bar) to open a game menu: **Resume, Save game, Load game, Watch a replay…, Restart match, Quit to title**, and a **Settings** section (a debug-overlay toggle). Save / Load / Replay moved here off the top bar.

The top bar is now rock-solid. Its resource chips sit in their own scrolling region and the ☰ button is pinned to the right, so **nothing on the bar ever changes position** — not when resource numbers grow more digits, not when the Age label gets longer, and not when a victory countdown appears (its slot is now permanently reserved). Previously the Save/Load/Replay buttons could slide around as the bar's contents changed width.

The menu overlays the game; auto-pausing the match while it's open is a planned follow-up. No save-format change.

## 0.1.94 - 2026-07-04

### AI can place large buildings (Market, Castle, Wonder) in a built-up base

The AI's building-placement search only looked a short distance out from its Town Center, and a large 4×4 building (Market, Castle, Wonder) needs a bigger clear gap than the 3×3 military buildings (Barracks, Blacksmith, Stable, Archery Range). So in an established base with a packed core, the AI could never find a spot for one and would silently stall trying to build it. The search now reaches far enough out to place them. This is what lets the AI build a Market (to trade for age-up shortfalls) and — once it advances — a Castle and a Wonder in a real match.

In the short AI-vs-AI smoke test the AI stays in Feudal Age and is wood-limited before it reaches the Market in its build order, so the effect isn't visible there yet — but the placement bug made those buildings impossible for the AI in any built-up base, so this is necessary for its mid- and late-game. No save-format change. (0.1.93 was an experiment that was reverted before release.)

## 0.1.92 - 2026-07-04

### AI paces its military so it can build its way toward Castle Age

The computer opponent used to over-produce military in Feudal Age until it hit its population cap, then build Houses on a treadmill that drained the wood it needed for a second Feudal-Age building (Stable / Archery Range / Market). Because Castle Age requires two Feudal-Age buildings, this left the AI stuck one prerequisite short — unable to advance no matter how long the game ran. Now, once the AI has a full attack group (5+ units) and still can't advance, it pauses military growth until it builds that prerequisite. That frees the population room (fewer emergency Houses) for wood to accumulate. The AI stays defended — it keeps its 5+ army — and resumes training the instant it becomes able to advance.

In the default AI-vs-AI matchup this takes the AI from **permanently stuck at 1 of the 2 required prerequisites** to reaching **both**, after which it begins banking food toward Castle Age (it holds ~510 food and climbing by the score-timer, up from being pinned near ~90 before). It doesn't quite complete the jump within the standard match length yet — banking the full 800 food takes a bit longer — but the structural wall that kept it in Feudal forever is gone. No save-format change.

## 0.1.91 - 2026-07-04

### AI trades at the Market to cover an age-up shortfall

The computer opponent can now use a Market to cover an age-up shortfall. When it qualifies for the next Age but is short on one resource while sitting on a surplus of another, it sells the surplus for gold — or buys the shortfall with spare gold — one trade at a time until it can advance. This is the recurring problem behind 0.1.89–0.1.90 (the AI banks one resource but stalls one age-up short on the other): rather than pre-tuning how the AI gathers, which turned out too chaotic to get right, a Market trade self-corrects whichever resource its economy over- or under-gathered. An AI that banks 1000 food but only 75 gold, if it owns a Market, now sells food for the gold it needs and advances.

The AI only trades once it is genuinely eligible to advance and cannot otherwise afford it, and only from a comfortable surplus, so its normal economy is unchanged (and Markets trade from Feudal Age onward, matching the ages this applies to). Note: this only helps once the AI has actually built a Market — in the current default matchup the AI is often wood-constrained and doesn't build one, so it does not yet always advance; getting the AI to build a Market when that is the missing age-up piece is the next step. No save-format change.

## 0.1.90 - 2026-07-04

### AI banks food for its age-up instead of spending it on more villagers

Once the AI qualifies for the next age, its villager training now respects the food it has reserved for that age-up — exactly as its military training already did. Before, even after the AI gathered food-first (0.1.89), it spent every spare 50 food on another villager, so its food stayed pinned near zero and never climbed toward the 800 a Castle costs. Now that food accumulates: in an AI-vs-AI replay the leading AI's food banked past 1000 instead of hovering near 70. The hold only kicks in once the AI is actually eligible to advance, so early-game economy build-up is unchanged.

This fixes the food half of the AI's age-up. The same replay showed the remaining blocker is now gold — with food no longer over-gathered at gold's expense, the AI runs short of the Castle's 200 gold — so a follow-up rebalances its gold gathering to complete the advance. No save-format change.

## 0.1.89 - 2026-07-04

### AI gathers food-first in Feudal Age (no longer hoards unused gold)

The computer opponent now weights its Feudal-Age villagers heavily toward food (a 7:4:1 food:wood:gold split, up from 5:4:2) instead of over-mining gold it barely spends. Grounded by replaying an AI-vs-AI match: the AI was stalling in Feudal Age with its food pinned near zero while it hoarded ~1500 gold — because too many villagers sat on gold deposits, it never gathered the food it needs to advance (a Castle age-up costs 800 food but only 200 gold). After the change the same match shows the AI's gold hoard cut by more than half and its food finally accumulating once its economy fills out.

This is the food-gathering half of getting the AI to reliably reach Castle Age; a follow-up (0.1.90) stops it from spending that banked food on extra villagers so the age-up actually completes. No save-format change.

## 0.1.88 - 2026-07-04

### Command-button tooltips now show the actual cost

Hovering a Train, Research, or Build button now tells you exactly what it costs — e.g. "Queue a Militia at this building. Cost: 60 food, 20 gold." Research tooltips also show the research time. Previously the tooltip only said "requires the unit's cost" without any numbers, so you had to click and hope you could afford it.

(The tooltip shows the base cost; a civilization discount such as Goths' −35% infantry cost is applied when you actually train, and reflecting that live in the tooltip is a follow-up.)

## 0.1.87 - 2026-07-04

### Choose your civilization with ?civ=

You can now pick the civilization you play as with a `?civ=<name>` URL parameter — for example `?civ=Goths` (cheaper infantry), `?civ=Franks` (tougher knights), `?civ=Aztecs` (faster military), or `?civ=Britons` (faster shepherds). The name is case-insensitive and validated against the 30 AoE2 civilizations; an unknown or missing value falls back to the default (Britons).

This makes the civilization bonuses shipped in 0.1.81–0.1.86 actually reachable in a normal game, instead of only appearing in the default matchup. A full in-game civilization picker is planned; this URL parameter is the first step. Saved games keep the civilization they were started with. No save-format change.

## 0.1.86 - 2026-07-04

### Goths infantry cost 35% less

A **Goths** player now trains infantry (the Militia and Spearman lines) for 35% less, from the Feudal Age onward — so a Goths Militia costs 39 food / 13 gold instead of 60 / 20. Dark-Age costs are unchanged, and only infantry are discounted. This is the iconic Goths infantry-flood bonus.

This completes the fourth kind of civilization bonus effect — a cost discount — after gather rate, unit stats, and creation speed. Every other civilization is unchanged, and there is no save-format change.

## 0.1.85 - 2026-07-04

### Conscription — train military units faster

New technology: **Conscription** (researched at the Castle in the Imperial Age, 150 food + 150 gold). While researched, units trained at the **Barracks, Archery Range, Stable, and Castle** are created 25% faster. It stacks with the Aztecs creation-speed bonus. Any civilization can research it.

Also fixed a rare crash: completing a research while you had no units on the field (e.g. all your villagers had just died) could throw a tick error. Researching any technology from a unit-less state is now safe.

No save-format change.

## 0.1.84 - 2026-07-04

### Aztecs create military units 15% faster

The fourth civilization bonus: an **Aztecs** player trains every military unit (all non-villager units — infantry, archers, cavalry, siege, and monks) in 15% less time. Villagers are unaffected. Both your own production and the AI's benefit consistently.

This extends the civilization-bonus layer (0.1.81–0.1.83) to a fourth kind of effect (unit creation speed), after economy gather rate, unit HP, and attack-vs-buildings. Every other civilization is unchanged, and there is no save-format change.

## 0.1.83 - 2026-07-04

### Goths infantry deal +1 damage against buildings

The third civilization bonus: a **Goths** player's infantry (Militia and Spearman lines) deal +1 extra damage when attacking buildings, from the start of the game with no research. It stacks with the Sappers technology (+15). Only infantry get it — Goths archers, cavalry, rams, and villagers are unaffected — and only Goths.

This extends the civilization-bonus layer (0.1.81/0.1.82) to a third kind of effect (attack-vs-buildings), after economy gather rate and unit HP. Every other civilization is unchanged, and there is no save-format change. Goths' larger identity (cheaper infantry, population bonus) is planned for later updates.

## 0.1.82 - 2026-07-03

### Franks Knights have +20% HP

The second civilization bonus: a **Franks** player's Knight line (Knight → Cavalier → Paladin) has +20% maximum HP, from the start of the game with no research. It stacks with Bloodlines (base 100 → 120 as Franks → 140 with Bloodlines). The bonus is knight-line-only — Scouts, Camels, and Cavalry Archers are unaffected. Because the default AI opponent is Franks, its knights are now noticeably tougher in a standard game.

Every other civilization is unchanged, and there is no save-format change. This extends the civilization-bonus layer (added in 0.1.81) from economy rates to combat stats.

## 0.1.81 - 2026-07-03

### Civilizations start to matter: Britons shepherds gather sheep 25% faster

The first passive civilization bonus is now live. A Britons player's villagers gather from **sheep** 25% faster ("Shepherds work 25% faster") — active from the start of the game, no research needed. It is sheep-specific: berries, farms, boar, and wood are unaffected. Because the default human player is Britons, this is felt immediately in a standard game; the AI benefits too when it plays Britons.

This ships on a new civilization-bonus layer that future per-civ bonuses will extend (the counterpart to the existing technology-effect system). Non-Britons civilizations are completely unchanged, and there is no save-format change.

## 0.1.80 - 2026-07-03

### Line-of-sight technologies: Town Watch, Town Patrol, Tracking

Three AoE2 line-of-sight upgrades now exist and take effect immediately when researched:

- **Town Watch** (Town Center, Feudal Age, 75 food) — +4 line of sight to all your buildings.
- **Town Patrol** (Town Center, Castle Age, 300 food + 200 gold, needs Town Watch first) — another +4 building line of sight, stacking with Town Watch (+8 total).
- **Tracking** (Barracks, Feudal Age, 75 food) — +2 line of sight to all your infantry.

The bonus is applied the moment the research completes — your existing buildings and infantry reveal more of the map on the next tick — and buildings finished or units trained afterward already have it. Town Patrol only becomes available once Town Watch is done. The built-in AI researches Tracking when it has a spare Barracks and isn't saving to advance an age; the Town Center building-LoS techs are player-driven for now.

No save-format change. This is additive gameplay content.

## 0.1.79 - 2026-07-02

### AI economy: better wood gathering + the AI no longer stalls an age it can afford

Two grounded fixes to the built-in AI's economy, from a fresh all-AI playtest replayed for ground truth:

- **Wood gathering is much less wasteful.** The AI (and any auto-gathering villagers) now pick trees near their drop-off (lumber camp / Town Center) instead of whichever tree is nearest the villager's current spot. Previously a villager that finished a far tree would wander to another far tree, doing huge round-trips while full trees near the base sat unused; wood income was throttled to a trickle. Wood income in AI-vs-AI runs is now roughly 3-15× higher.
- **The AI advances to the next age when it can afford it.** Previously a resource-rich AI could get stuck a whole age despite ample resources: its Town Center production queue stayed full of villagers, and worse, a queued villager it couldn't yet house would sit blocked at the front of the queue and stall the age-up research behind it forever. The age-up research can now claim a queue slot even when the queue is full, and — a general fix that also helps the human player — **a population-blocked unit no longer stalls a research queued behind it** (research doesn't cost population, so it proceeds). On a rich fixture the AI now reaches Castle Age (was: stuck in Feudal) while still building its Feudal army.

No save-format change. These are AI/gather-assignment and production-queue behavior changes.

## 0.1.78 - 2026-07-02

### UI: Wildlife and relics now show an icon — the selection panel is fully iconned

Selecting **wildlife** (sheep, boar, wolf, fish) or a **relic** now shows an icon instead of a two-letter code: land animals share a paw-print icon (the label still names the species), fish gets a fish icon, and a relic gets a radiant-reliquary icon. Together with the resource-node icons (0.1.77), **every selectable entity — units, buildings, resource nodes, wildlife, relics — now shows an icon in the selection panel.** Visual polish only.

## 0.1.77 - 2026-07-02

### UI: Selecting a resource node now shows its resource icon

When you select a **tree, gold mine, stone mine, or berry bush**, the selection panel now shows the matching resource icon (wood / gold / stone / food — the same icons as the top-bar counters and the market buttons) beside the entity label, instead of just a two-letter code. This matches how selected units and buildings already show an icon. Wildlife (sheep, boar, wolf, fish) and relics keep their text badge for now; a selected Farm still shows its building icon. Visual polish only.

## 0.1.76 - 2026-07-02

### UI: Action buttons now show an icon — the command card is fully iconned

The **Ungarrison** command button (the "action" group) now shows an icon — an arrow rising out of a container, for units leaving a building — before its label. With this, **every command-card button is now iconned**: Build, Train, Research, Market, and Action all show a small original procedural icon beside the label, so the whole card reads consistently instead of mixing icons and bare text. Visual polish only — the Ungarrison order behaves exactly as before.

## 0.1.75 - 2026-07-02

### UI: Market buy/sell buttons now show a commodity icon

The command-card **market** buttons ("Buy Food", "Sell Wood", "Buy Stone", etc.) now show the traded **commodity icon** (the same wheat / wood / stone icons as the top-bar resource counters) before the label, matching the Build, Train, and Research buttons. With this the whole command card is iconned — no more mix of iconned and text-only buttons. Buy and sell of the same resource share the commodity icon; the label still says which direction. Visual polish only — trading behaves exactly as before.

## 0.1.74 - 2026-07-02

### UI: Research buttons now show an icon

The command-card **Research** buttons (e.g. "Research Fletching", "Research Loom") now show a small original procedural **research icon** (an open book with an upgrade chevron) before the label, matching the Build and Train buttons — so the command card reads consistently instead of mixing iconned and text-only buttons. The icon appears on both available and locked (greyed) research buttons. One generic icon is used for every technology for now; the button label still names the specific tech. Visual polish only — the buttons behave exactly as before. (The action and market command buttons remain text-only for now.)

## 0.1.73 - 2026-07-02

### UI fix: Train-button icons now match the Build-button icon size

Fixes a regression from 0.1.72: the new **Train**-button unit icons rendered at roughly **twice** the size of the neighbouring **Build**-button icons (and in a slightly different tint), because they reused the larger selection-panel glyph styling instead of the command-button styling. The Train icons now render at the same 17px size and warm gold tone as every other command-card icon, so the command card looks uniform. Behaviour is unchanged — icons remain decorative and the buttons work exactly as before.

## 0.1.72 - 2026-07-02

### UI: Train buttons now show a unit icon

The command-card **Train** buttons (e.g. "Train Villager", "Train Knight") now show a small original procedural **unit icon** before the label, matching the icons already on the Build buttons and the selection panel. It's a visual polish only — the buttons behave exactly as before. (Research, market, and other action buttons remain text-only for now.)

## 0.1.71 - 2026-07-02

### Monastery tech: Heresy (converted units die)

The Monastery can now research **Heresy** (Castle Age, 1000 gold). While researched, any of that player's units that an enemy monk would convert **dies instead of switching sides** — denying the unit to the converter. It's the classic AoE2 counter to enemy monk play: your converted units are lost rather than turned against you. Heresy doesn't stop or slow conversion (that's Faith) — it only changes the outcome. It affects only that player's units and only while researched; without it, conversions flip ownership exactly as before. No save-format change.

## 0.1.70 - 2026-07-02

### Monastery tech: Herbal Medicine (garrisoned units heal 4× faster)

The Monastery can now research **Herbal Medicine** (Castle Age, 350 gold). While researched, every unit **garrisoned inside one of that player's buildings heals 4× faster** (the passive garrison-heal introduced earlier). Pull a wounded villager or soldier into a Town Center or tower and it recovers in a quarter of the time — a meaningful defensive/economic option. It affects only that player's garrisoned units and only while the tech is researched; without it, garrison healing is unchanged. No save-format change.

## 0.1.69 - 2026-07-02

### Wheelbarrow & Hand Cart now also make villagers move faster

The economy techs **Wheelbarrow** (Feudal) and **Hand Cart** (Castle) — which until now only raised villager carry capacity — now also grant their AoE2 **+10% villager movement speed**. The two stack: with Wheelbarrow your villagers move 10% faster, and with both they move ~21% faster, so they walk to and from resources and drop-off points more quickly on top of carrying more per trip. This completes those two techs (both effects, matching the game). It applies only to villagers and is derived from the techs you have researched, so there is no save-format change and no effect on players who haven't researched them.

## 0.1.68 - 2026-07-02

### Barracks tech: Squires (+10% infantry speed)

The Barracks can now research **Squires** (Castle Age, 200 food). It makes every one of that player's **infantry units** — the Militia line (Militia, Man-at-Arms, Long Swordsman, Two-Handed Swordsman, Champion) and the Spear line (Spearman, Pikeman, Halberdier) — **move 10% faster**, taking effect immediately for units already moving as well as everything trained later. It is the infantry counterpart to Husbandry (mounted units) and rides the same movement-speed system, so the +10% is real rather than lost to rounding. Non-infantry units are unaffected, and the two techs never stack (no unit is both infantry and mounted). No save-format change.

## 0.1.67 - 2026-07-02

### Bloodlines fixed to match AoE2: Feudal Age + cavalry archers included

Two conformance fixes to the Bloodlines tech shipped in 0.1.65, per the game data (`technologies.csv:78`) and AoE2 canon: (1) it is now researchable from the **Feudal Age** (it was wrongly Castle-gated — in AoE2 Bloodlines is the classic Feudal Stable research), and (2) its +20 max-HP buff now also applies to **Cavalry Archers and Heavy Cavalry Archers** (it previously covered only the Scout/Knight/Camel cavalry lines; the CSV lists "Cavalry; Cavalry Archer"). Existing saves are unaffected structurally — an owner who already researched Bloodlines before this fix keeps cavalry-only bonuses already applied; mounted archers trained after loading under that researched flag now receive +20. The barding armor techs intentionally remain cavalry-only (mounted archers use the archer armor line, as in AoE2). No save-format change.

## 0.1.66 - 2026-07-02

### Stable tech: Husbandry (+10% mounted speed) — the game's first movement-speed tech

The Stable can now research **Husbandry** (Castle Age, 250 food). It makes every one of that player's **mounted units** — the Scout line, Knight line, Camel line, **and** Cavalry Archer line — **move 10% faster**, taking effect immediately for units already on the move as well as everything trained later. Non-mounted units (villagers, infantry, archers, siege, monks) and herded sheep are unaffected, and an opponent without the tech keeps the normal cadence. Under the hood this ships the movement-speed subsystem the roadmap deferred: units bank fractional movement per tick (a knight now takes an extra sub-grid step roughly every 5th tick) so the +10% is real rather than lost to rounding. Save-format note: units moving at boosted speed persist a small `moveCarryHundredths` counter on their transform — **additive and backward-compatible** (older saves load fine; no schema bump).

## 0.1.65 - 2026-07-02

### Stable tech: Bloodlines (+20 cavalry HP)

The Stable can now research **Bloodlines** (Castle Age, 150 food / 100 gold). It gives every one of that player's **cavalry units** — Scout, Light Cavalry, Hussar, Camel, Heavy Camel, Knight, Cavalier, and Paladin — **+20 max HP**, applied to cavalry you already own the moment the research completes and to any trained afterward. Non-cavalry units are unaffected. This is the same imperative HP-bump mechanic as Loom (villagers) and Sanctity (monks). Unlike the tower / Siege Engineers / Sappers techs, Bloodlines is hosted at the Stable exactly as in AoE2 — no building divergence. No save-format change.

## 0.1.64 - 2026-07-02

### Blacksmith tech: Sappers (+15 infantry attack vs buildings)

The Blacksmith can now research **Sappers** (Imperial Age, 400 food / 200 gold). It gives every one of that player's **infantry units** — the Militia line (Militia, Man-at-Arms, Long Swordsman, Two-Handed Swordsman, Champion) and the Spear line (Spearman, Pikeman, Halberdier) — **+15 attack against buildings**, so infantry can meaningfully help raze structures (previously only siege units had an anti-building bonus). Non-infantry (archers, cavalry, villagers, siege, monks) are unaffected. AoE2 hosts Sappers at the University, which does not exist in this build yet, so it lives at the Blacksmith for now — the same divergence as the Guard Tower / Keep and Siege Engineers techs. No save-format change.

## 0.1.63 - 2026-07-01

### Garrisoned units heal over time

Any unit garrisoned inside a building now **passively regenerates HP**, at a fixed **4 HP per second** (0.4 HP per tick), capped at the unit's maximum HP. This rewards pulling a wounded villager or soldier into a Town Center or tower to recover — the heal never overheals, never revives a unit at 0 HP, costs no resources, and needs no research (it is separate from Monastery monk-healing, which heals units on the field). The rate is deterministic, so replays reproduce exactly. No save-format change.

## 0.1.62 - 2026-07-01

### Siege Workshop tech: Siege Engineers (+1 siege range)

The Siege Workshop can now research **Siege Engineers** (Imperial Age, 500 food / 600 wood). It gives every one of that player's **siege units** — Mangonel/Onager, Scorpion/Heavy Scorpion, Battering Ram/Siege Ram, Bombard Cannon, and Trebuchet — **+1 attack range**, applied to siege units you already own the moment the research completes and to any built afterward. Non-siege units (archers, cavalry, infantry, monks) are unaffected. AoE2 hosts this tech at the University, which does not exist in this build yet, so it lives at the Siege Workshop for now (same divergence as the Guard Tower / Keep tower techs). No save-format change.

## 0.1.61 - 2026-07-01

### Monastery tech: Faith (conversion resistance)

Your units are now harder for enemy monks to convert once you research **Faith** (Imperial Age, Monastery, 750 food / 1000 gold — the third monk upgrade). A unit whose owner has Faith accumulates enemy conversion progress at **half rate**, so it takes about twice as long to be converted (Faith slows conversion, it does not make units immune). Deterministic — no random rolls. No save-format change.

## 0.1.60 - 2026-07-01

### Blacksmith arrow upgrades now strengthen your buildings' fire

Fletching, Bodkin Arrow, and Bracer — the Blacksmith archer upgrades — now also boost the arrows fired by your **Town Centers, Watch Tower line, and Castles** (each adds +1 attack and +1 range, up to +3/+3 with all three), matching AoE2 where these techs improve building fire as well as archers. This stacks with the Guard Tower / Keep tower upgrades. Un-upgraded buildings are unchanged, and the bonus applies to buildings you already own the moment the tech completes (no save-format change).

## 0.1.59 - 2026-07-01

### Monastery tech: Sanctity (tougher monks)

The Monastery can now research **Sanctity** (Castle Age, 120 gold) — the second monk upgrade. It gives every one of that player's monks **+15 max HP** (applied to monks you already have and any trained afterward), making monks meaningfully harder to kill while they convert or heal. No save-format change.

## 0.1.58 - 2026-07-01

### Monastery tech: Block Printing (monks convert from farther)

The Monastery can now research **Block Printing** (Castle Age, 100 food / 130 gold) — the first monk upgrade in the game. It gives all of that player's monks **+2 conversion range**, so they can start converting an enemy unit from two tiles farther away (base range 4 → 6). The bonus is derived from your researched techs at the moment a monk acts, so it applies to monks you already have and any you train later, with no save-format change. The effect is fully deterministic (a flat range bonus — no probability change), keeping replays reproducible.

## 0.1.57 - 2026-07-01

### Defensive tower upgrades: Guard Tower and Keep

Watch Towers can now be upgraded so they hit harder and, at the top tier, farther — mirroring AoE2's Watch Tower → Guard Tower → Keep ladder. Two new techs are researched at the Watch Tower: **Guard Tower** (Castle Age, 100 food / 50 gold) gives all of that player's Watch Towers **+2 attack**, and **Keep** (Imperial Age, requires Guard Tower first, 200 food / 100 gold) adds **+2 more attack and +1 range** (so towers hit for +4 total and reach one tile farther once Keep is done). Only Watch Towers benefit — Town Center and Castle fire are unchanged. The bonus is derived from your researched techs at the moment a tower fires, so it applies to towers you already own AND any you build later, with no save-format change. Note the divergence from AoE2: these are hosted at the Watch Tower here (there is no University yet), and the AoE2 per-upgrade tower-HP boost is deferred.

## 0.1.56 - 2026-07-01

### The AI grows a bigger economy across the ages

The AI's villager count was hard-capped at tiny numbers — 6 in the Dark Age, 14 through Feudal and Castle, 50 in Imperial — so it plateaued with a starved economy that could not fund a real army or age up efficiently. The cap now scales toward AoE2-realistic counts (10 / 22 / 40 / 60 by age), so the AI keeps training villagers into a growing economy and reaches Feudal noticeably faster with more villagers. (Its natural food supply still bounds this until a follow-up teaches the AI to build farms.) No change to the human player.

## 0.1.55 - 2026-07-01

### Villagers reroute to a reachable drop-off instead of freezing the economy

Villagers no longer deadlock when their nearest resource drop-off building is unreachable. Previously, a villager carrying a full load whose nearest drop-off (e.g. a Town Center packed in by its owner's own buildings) had every approach cell blocked would stay in the carrying state forever and never deposit — freezing that player's resources. This most visibly stalled the AI: in an 8000-tick match its food stayed frozen (villagers gathered but never deposited) and it never left the Dark Age. Now a villager whose nearest drop-off is unreachable returns to the next-nearest REACHABLE drop-off (e.g. a farther Mill) instead. With the fix, the same AI's food flows normally and it advances to the Feudal Age. This mirrors the existing unreachable-resource reroute (0.1.47) on the return leg. No save-format change.

The unit info panel now lists **Melee armor** and **Pierce armor** as two rows instead of a single "Armor" number, so the asymmetric armor split (0.1.53) is visible — e.g. a villager with Loom shows Melee armor 1 / Pierce armor 2, and a fully-upgraded infantry line shows its higher pierce value. The numbers are the armor-upgrade bonus (as before, tech bonus rather than base + bonus). Buildings still show 0/0. No gameplay change — this is a display-only addition.

## 0.1.53 - 2026-07-01

### Armor upgrades are now asymmetric — top-tier armor and Loom give +2 pierce

Armor technologies now match Age of Empires II's asymmetric values. Every armor upgrade still gives +1 melee armor, but the four top-tier upgrades give **+2 pierce** armor instead of +1: Plate Mail Armor (infantry), Plate Barding (cavalry), Ring Archer Armor (archers), and **Loom** (villagers). The other armor upgrades stay symmetric (+1 melee / +1 pierce). Previously the game applied a single armor number to both melee and pierce, so these four upgrades were under-valued by 1 pierce armor.

What this changes in play: units with a fully-upgraded armor line are now noticeably tougher against arrows and other pierce damage — a fully-armored infantry line reaches +3 melee / +4 pierce, and Loom villagers shrug off 2 pierce damage per hit instead of 1, making early villager harassment less effective (as in AoE2).

Saves are unaffected: a game saved before this change loads correctly, with its armored units keeping the same (symmetric) mitigation they had.

## 0.1.52 - 2026-07-01

### Score-timer victory — matches can end on a timer with the highest score winning

A scenario can now set a game-length timer. When the timer expires, the match ends immediately and the player with the highest score wins — so games that would otherwise stalemate forever now have a definite conclusion. From your perspective the result is a **victory** if you are the sole top scorer, a **draw** if you are tied for the lead, and a **defeat** otherwise. The timer is evaluated after conquest/wonder/relic each tick, so if you (or an enemy) win by one of those on the very same tick, that result takes precedence over the score. Score is the same AoE2-style number already shown in the post-game card (units, buildings, resources gathered, kills, relics, wonder), and the card now shows a "Score Victory" label when the timer decides the game.

This first version is opt-in per scenario and is not yet turned on for the standard random-map setup. Known limitation: the game-length timer is not saved — loading a mid-game save resumes with the timer disabled.

## 0.1.51 - 2026-07-01

### Villagers can repair damaged buildings

Right-click a friendly, damaged building with a villager and it will walk over and repair it, restoring the building's hit points over time. Repairing costs resources — a fraction of what the building cost to make, scaled by how much health is missing (fully repairing a building from near-death costs about half its build cost). If you can't afford the repair, the villager won't start it.

Repair is a distinct order (it will not be confused with construction), and it reuses the walk-and-work flow, so multiple villagers repair faster and the building's HP bar fills as it's fixed. Right-clicking a *damaged* garrisonable building (Town Center, Castle, Tower) repairs it rather than garrisoning — matching Age of Empires II. Notes/simplifications in this first version: the cost is charged up front when you issue the repair (before the villager even arrives), rather than continuously as it's fixed — so each villager you assign is billed separately, re-issuing re-charges, and an interrupted or unreachable repair is not refunded; repair currently applies to buildings only (siege-unit repair is not yet wired). Save extension: a save taken mid-repair now records the repair order (additive and backward-compatible — older saves are unaffected).

## 0.1.50 - 2026-06-30

### Mangonels get blast/splash damage — anti-infantry restored

The mangonel line (Mangonel, Onager) now deals AREA damage, restoring its role as the counter to massed infantry. When a mangonel hits its target, every OTHER unit within its blast radius of the impact also takes damage — computed the same way as the direct hit (so a spearman cluster each takes the mangonel's base pierce damage). This replaces the placeholder single-target anti-infantry behavior removed in 0.1.49 (that was never how AoE2 works).

**Friendly fire:** mangonel blast damages your OWN units in the radius too, so keep your infantry out from under your mangonels' targets. Blast-killing your own units does not count toward your score.

The blast radius is small (roughly one cell around the impact in this grid), matching the units' AoE2 `blast_radius`. Other blast sources — demolition ships, Petards, the scorpion's line attack, the onager's wider area at higher grid resolution, and bombard cannon's sub-cell splash — are not yet modeled. No save-format change.

## 0.1.49 - 2026-06-30

### AoE2-accurate combat counters (armor-class bonus damage)

Attack bonuses are now driven by an AoE2-accurate armor-CLASS model with the real values from the unit data, instead of the earlier approximate hard-coded table. This changes several combat matchups so counters behave the way they do in Age of Empires II:

- **Spearmen, Pikemen, and Halberdiers now counter ALL cavalry equally** (+15 / +22 / +32), not just scouts and knights — Cavaliers, Paladins, and Hussars now take the full bonus. Previously the spear line only fully hit knights/scouts.
- **Camels are their own class.** The spear line deals a smaller, separate bonus to camels (+7 / +11 / +16) rather than its anti-cavalry value, and **camels hit cavalry harder** (Camel +9 → +10, Heavy Camel +9 → +18).
- **Skirmishers** deal +3 vs archers (was +4) and now also **+3 vs spearmen**; the **archer line** (Crossbowman/Arbalest +3, Cavalry Archer/Heavy Cavalry Archer/Longbowman +2) now gets its **anti-spearman bonus** (previously none).
- **Siege vs buildings rebalanced to AoE2 values:** Battering Ram +75 → +125, Siege Ram +250 → +200, Bombard Cannon +80 → +200, Trebuchet +200 → +250; Mangonel/Onager/Scorpion now carry their small anti-building bonuses too.
- **Mangonels no longer have a special anti-infantry bonus.** In AoE2 a mangonel's power against massed infantry comes from its area/blast damage (a separate feature, not yet implemented), not a per-target bonus — so for now mangonels deal only their base damage to individual infantry. Their anti-siege bonus is unchanged.

No save-format change. Deferred (unchanged for now): the scout line's small anti-monk bonus, off-roster target classes (eagles, war elephants, ships), and the tiny +1–3 vs-building bonuses of non-siege units.

### Validation

TDD parity + class-model tests plus re-validation of every affected combat/siege fixture (camel, spear-line, skirmisher, heavy-camel, mangonel, ram/trebuchet matchups); the four gates pass and the full suite is green. Multi-CLI reviewed. See `docs/threads/done/data-driven-combat-2b/`.

## 0.1.48 - 2026-06-17

### The AI opponent now reliably advances through the ages instead of stalling

The computer player could get stuck in the Dark Age indefinitely: once it had the two buildings and 500 food needed for the Feudal Age, it kept training cheap Militia every time its food crept over 500, and each Militia's food cost — spent the instant before the age-up research — dropped its food back under 500, so the research silently failed and never committed. A whole game could run its full length with the AI sitting on 500+ food and a growing pile of Militia, never leaving the Dark Age (so it also never reached farms, the population cap, or any later-age units and technologies).

The AI now reserves the cost of its next age-up and trains military only from the resources it has ABOVE that reserve, so a freshly-trained unit can no longer eat into the age-up cost. A resource-rich AI still trains an army and ages up at the same time (it has plenty of surplus); a tighter economy prioritizes the age-up. This applies at every age transition, not just Dark → Feudal. No change to save files or to how you play.

## 0.1.47 - 2026-06-16

### Villagers no longer deadlock on an unreachable resource (gather gridlock fix)

A villager (or a pile of villagers) ordered to gather a resource that has no open approach cell — for example a resource boxed in by your own buildings, surrounding bushes, and forest — used to latch onto it forever: it would walk as far as it could, fail to reach the resource, and re-select the same unreachable resource every tick without ever gathering, ignoring perfectly good resources nearby. With several villagers stuck this way the food (or wood/gold/stone) income could stay at zero indefinitely, starving the economy so the game never advanced past the Dark Age.

Now, when a villager's target resource cannot be reached, it re-targets the nearest reachable resource of the same kind instead — so it falls through from the boxed-in resource to a gatherable one and keeps the economy running (depositing any resources it is already carrying first). A villager only stops gathering when no resource of that kind is reachable at all — a rare, genuinely-fully-boxed villager — and even then the reachability search is bounded so it never becomes a per-tick pathfinding cost that scales with the number of resources on the map. Normal gathering, the nearest-resource preference, and the existing fan-out for over-subscribed resources are unchanged; only the stuck-on-an-unreachable-target case is fixed.

This was found by the campaign-11 automated LLM playtest: the agent's six villagers stack-deadlocked next to their Town Center on a boxed-in sheep, food froze at 21 for ~3000 ticks, and the match never left the Dark Age. Ground-truth replay confirmed the cause.

### Validation

- TDD: a new mechanism test (`tests/simulation/villagerGatherAssignment.test.ts`, 4 tests) covers the reachability-aware assignment in isolation (default picks the nearest match even if unreachable; the reachability-aware reroute skips the unreachable/excluded one and picks a reachable resource, or idles when nothing is reachable, and reserves the chosen target), and a new integration regression (`tests/simulation/villagerGatherReroute.test.ts`) drives a fixture that rings a farm with trees so it is unreachable and is the nearest food: three villagers auto-assigned to it must still reach the reachable berries and net positive food (verified to fail before the fix — food stays flat — and pass after).
- The fix is render/save-neutral: no save-format change (it uses existing pathfinding, no new persisted state) and only the stuck-on-unreachable case changes behaviour.
- The four gates (test/typecheck/lint/build) pass and the full suite is green (1477 passed / 2 skipped).
- Multi-CLI review: 3-CLI (Codex + Claude + Gemini) converged — no HIGH bug in the fix; a unanimous per-tick-BFS finding for the pathological fully-boxed case was fixed with a bounded reachability scan, plus dead-code/carry-parity/doc fixes. See `docs/threads/done/gather-unreachable-reroute/2026-06-16/1/REVIEW.md`.

## 0.1.46 - 2026-06-16

### Farms can be upgraded: the three Mill farm-food techs (Horse Collar, Heavy Plow, Crop Rotation) (M1)

The three AoE2 Mill farm-upgrade economy techs are now researchable and raise how much food a Farm holds (and auto-reseeds to). Before this they were entirely missing — a Farm always held 175 food with no way to improve it.

- Horse Collar: Mill, Feudal Age, no prerequisite, costs 75 food + 75 wood, ~20 s; a Farm holds 250 food (+75).
- Heavy Plow: Mill, Castle Age, requires Horse Collar, costs 125 food + 125 wood, ~40 s; a Farm holds 375 food (+125 more).
- Crop Rotation: Mill, Imperial Age, requires Heavy Plow, costs 250 food + 250 wood, ~70 s; a Farm holds 550 food (+175 more).

The bonuses stack additively, so a fully-upgraded Farm stores 550 food per planting — far fewer reseeds (and far less wood spent maintaining a long-running food economy) than the base 175. Each tech is offered at the Mill from its earliest age and disappears from the research list once researched; the chain is linear (you must research the previous tech first).

A Farm's capacity is derived from the owner's researched techs at the moment the Farm is built (construction-complete) and each time it reseeds. So a Farm you already own when you finish a tech keeps its current stored food until it next empties and reseeds, at which point it refills to the new, higher capacity — your existing fields grow as they are re-sown, not retroactively. A Farm owned by a player who has not researched any of these techs is unchanged (still 175). The Heavy Plow "farmers carry +1 food" bonus is not part of this slice (it is a carry-capacity effect, deferred).

### Validation

- TDD: new `tests/simulation/farmUpgradeTechs.test.ts` (18 tests) covers the pure capacity helper (base 175; +75/+125/+175 stacking to 550; unrelated techs are no-ops), the Mill research options (Horse Collar from Feudal not Dark Age, Heavy Plow gated on Horse Collar + Castle, Crop Rotation gated on Heavy Plow + Imperial, each dropping once researched, surfaced in the agent/HUD visible-options view), the validator↔options agreement (`canResearchAt('mill', …)` true, other buildings false), the cost/research-time tables, and ground-truth checks on the live simulation: a Farm built by an owner with all three techs holds 550 food, a freshly-built Farm with Horse Collar holds 250, a depleted upgraded Farm reseeds to its upgraded capacity (250) not the base 175, a Farm owned by a player without the techs stays at 175 (no regression), and a save/load round-trip preserves both the researched techs and the upgraded capacity.
- The three techs are derived stat techs (like the gather-rate and carry-capacity econ techs): no per-Farm state and no save-format change — the researched-tech set is already persisted, and the capacity is recomputed from it at create + reseed.
- The four gates (test/typecheck/lint/build) pass and the full suite is green (1472 passed / 2 skipped).
- Data note: `design/stats/technologies.csv` had Heavy Plow's food bonus as "+75" (a duplicate of Horse Collar's); it is corrected to "+125", the real AoE2 value that matches the spec's 250/375/550 cumulative capacities.
- Multi-CLI review: see `docs/threads/current/farm-upgrade-techs/` (pending — the team lead runs the review before commit).

## 0.1.45 - 2026-06-16

### The game has dynamic feedback: a pulsing selection ring and a combat hit flash (M7)

The game's first time-based visual feedback. Until now every cue was static — the selection ring was a flat, constant ring, and combat was silent instant HP subtraction with no impact tell, which was the biggest remaining "not alive" feel. Two effects ship, both original procedural Phaser drawing (no assets):

- Selection pulse: the ring around a selected unit or building now gently breathes — its brightness, stroke width, and a small outward radius swell over a ~1.1-second cycle — so a selection reads as live instead of frozen. The ring's position and base size are unchanged; only the stroke animates, so nothing about the unit's hitbox, health bar, or footprint outline moves.
- Hit flash: when a unit takes damage, a brief bright impact flash (a white-hot core fading to a warm orange rim) pops on it for about a quarter second, so you can see blows landing during a fight or a raid. The flash is confined to the unit's own circle and fades out on its own.

Both effects are purely visual — they do not affect the simulation, saved games, or replay determinism in any way (a replay of the same match plays out identically; only the on-screen presentation is richer). The selection pulse is driven from the already-known "this entity is selected" flag; the hit flash is driven from the unit's health dropping between frames, tracked entirely in the renderer — no new game data is recorded.

Deferred to later M7 render slices: gather sparks on working villagers (the villager's gather state is not part of the render data today, and adding it would be a save/contract change — out of scope for a render-only slice), death/destruction particles, and projectiles in flight (those pair with the M2 projectile simulation work).

### Validation

- TDD: new `tests/phaser/feedbackEffects.test.ts` (19 tests) covers the pure effect logic — the selection pulse stays in a visible band, oscillates over its period, and bounds its radius/width; `shouldFlashHit` fires only on a strict HP drop between two finite samples (not a heal, no-change, missing, or non-finite value); the hit-flash tracker arms a decaying flash on a drop, never on the first sample, re-arms on a second drop, expires after its duration (staying briefly active past it so the frame clears), tracks only units (a damaged building never arms a flash), forgets entities that leave the view (so it stays bounded), and reports whether any flash is live (used to keep the frame animating); and the flash drawer scales its alpha with intensity and stays inside the unit's circle. New `tests/phaser/selectionLayers.test.ts` (4 tests) verifies the ring is byte-identical without a pulse and applies the pulse alpha/width/outward-offset (center and base radius preserved) with it. A small render extraction (`drawResourceEntity`, pulled out of the scene to keep it lean) is covered by `tests/phaser/resourceRenderer.test.ts` (2 tests).
- Visual protocol (motion is not capturable in a static image): a dedicated `feedback-showcase-fixture` with a selectable lone villager and an adjacent melee skirmish was captured before/after on otherwise-identical builds at a representative phase (ring lit, a fresh hit flash) with a pixel diff — `tmp/feedback/{before,after,diff}.png`; 0.21% of pixels changed, confined exactly to the selected villager's ring and one combat unit's flash (the HUD, terrain, the other units, health bars, and the minimap are pixel-identical). The diff shows the effect presence, placement, and confinement; the trigger/timing correctness is covered by the unit tests above.
- Render-only — no simulation, bridge, save-format, or projection/contract change (`ProjectedEntityView` is untouched); the time/clock input and all animation state live in the render layer; no `Math.random`/`Date.now` enters the simulation. The four gates (test/typecheck/lint/build) pass and the full suite is green (1454 passed / 2 skipped).
- Multi-CLI review: see `docs/threads/current/combat-gather-feedback/` (pending — the team lead runs the review before commit).

## 0.1.44 - 2026-06-16

### The selection panel shows a procedural icon for the selected unit or building (M7 UI icons, slice 2)

When you select a unit or a building, the selection panel used to show only a small two-letter text badge (a "V" for a Villager, "TC" for a Town Center, "H" for a House, "CB" for a Crossbowman, …). That badge now sits beside an original procedural glyph icon: units get an icon for their render role — villager, infantry (foot melee), archer (foot ranged), cavalry (mounted), cavalry-archer (mounted ranged), siege engine, monk — matching the on-map unit silhouettes shipped in v0.1.41, and buildings reuse the same per-type building glyph the "Build X" buttons already use (v0.1.39). The glyph is the dominant visual; the two-letter code stays as a small label beside it, so nothing is lost and the panel is more glanceable. This works for a single selection and for a multi-selection grid (each unit-type chip gets its role glyph; the count badge like "x3" is preserved).

This is the deferred follow-up to the v0.1.39 UI-icons slice (which iconified the top resource chips and the build-command buttons). The icons are 100% original hand-authored inline SVG — no copyrighted Age of Empires icons, sprites, image files, or icon fonts. Still text-only (deferred to later UI-icon work): the non-build command-card buttons (Train / action / market / research), and the resource/wildlife/relic selection badges (sheep, boar, fish, berry bush, tree, mines, relic — these are not player units or buildings, so they keep their text badge this slice). A minimap terrain layer and a fog gradient fade also remain open M7 UI items.

### Validation

- TDD: new `tests/simulation/selectionGlyphs.test.ts` (13 tests) covers that every unit role glyph + the building glyph is self-contained inline SVG with no external asset/font reference and uses `currentColor` (so the existing palette controls the tone); that the unit role map is exhaustive over every unit type AND agrees with the on-map renderer's `unitRole` (a drift guard so the badge glyph and map silhouette never diverge); that the dispatcher routes a unit to its role glyph, a building to the reused building glyph, and a resource/wildlife/relic/none to no glyph; and the augment-don't-replace contract — `renderSelectionIcons` emits the glyph as a sibling while the badge keeps its exact two-letter code and every `data-*` selection hook (single-unit, single-building, and multi-select paths), so the existing Playwright badge-text assertions still pass.
- Visual protocol: a Villager and the Town Center were selected and captured before/after with a pixel diff — `tmp/ui-icons-2/{villager,tc,multi}-{before,after,diff}.png`; the change (≈4.8% of pixels for the single-selection views, ≈8% for the multi-select grid) is confined entirely to the selection panel; the Phaser game world and the rest of the HUD are pixel-identical.
- DOM/CSS-only — no `src/phaser/`, simulation, save-format, or bridge-contract change; the four gates (test/typecheck/lint/build) pass and the full suite is green (1429 passed / 2 skipped).
- Multi-CLI review: see `docs/threads/current/ui-icons-slice2/` (pending — the team lead runs the review before commit).

## 0.1.43 - 2026-06-16

### Terrain kinds blend at their edges instead of meeting at hard rectangular seams (M7)

Adjacent terrain cells of different kinds — grass, forest, water, hill — used to meet at a sharp, perfectly straight rectangular line, which read as the classic tile-grid tell. Each such boundary now feathers: along every cell edge whose neighbor is a different kind, the renderer stipples a band of small specks tinted with the blend (the average) of the two kinds' colors, on the inner side of the edge. The neighbor cell feathers back the same way, so the two stipple bands interlock across the seam and the boundary reads as a soft, dithered transition rather than a hard line — a grass/water shore feathers green into blue, a grass/hill edge feathers green into tan. Same-kind interiors are untouched (the v0.1.30 per-cell brightness texture is preserved), the stipple stays strictly inside each cell's own square so units, buildings, health bars, selection rings, the grid, and fog are unaffected, and the variation is fully deterministic (it derives only from cell coordinates, so the terrain never shimmers between frames).

This is the transition half of the M7 "terrain texturing + elevation shading" item. Elevation-based light/shadow is deferred: the render data does not currently carry per-cell elevation (only the terrain kind is projected), so shading by height would require a simulation/render-contract change and is left for a later slice. Also deferred: diagonal (corner) blends and bespoke per-pair transition textures (e.g. a dedicated beach gradient for grass/water). The art is 100% original procedural Phaser drawing — no sprites, textures, or copyrighted Age of Empires art.

### Validation

- TDD: `tests/phaser/terrainTexture.test.ts` was extended (6 → 18 tests). New coverage: `blendTint` is the per-channel average, is commutative, stays in gamut for the palette, and is derived from the same per-kind tints the simulation seeds; a cell surrounded by same-kind neighbors draws only the base fill with no transition specks; a cell adjacent to a different kind draws transition specks toward that edge (and only the differing edge when one side differs); the transition color is the blend of the two kinds (not a hardcoded unrelated color); the draws are deterministic (same inputs → identical calls); every drawn point stays inside the cell rect; and a missing neighbor (map edge) draws no transition. The pre-existing per-cell jitter tests (determinism, gamut, subtlety, variation, unbiased mean) are retained as regression guards.
- Visual protocol: a dedicated `terrain-showcase-fixture` (a patchwork of adjacent grass/forest/water/hill in the default camera view) was captured before/after with a pixel diff — `tmp/terrain/{before,after,diff}.png`; 1.89% of pixels changed, confined exactly to the kind-to-kind boundaries (same-kind interiors, the HUD, the minimap, and the selection panel are pixel-identical; the changed-pixel bounding box traces only the patch outlines).
- The render path is purely a function of the existing projected render data — no simulation, save-format, or bridge-contract change; the four gates (test/typecheck/lint/build) pass and the full suite is green (1416 passed / 2 skipped).
- Multi-CLI review: see `docs/threads/current/terrain-blending/` (pending — the team lead runs the review before commit).

## 0.1.42 - 2026-06-16

### Buildings render as distinct per-type shapes instead of one generic shape (M7)

Completed buildings no longer all draw the same generic body-and-roof shape (which made a Town Center, House, Castle, Wonder, Market, and Barracks indistinguishable except by size and color). Each completed building now draws an original procedural silhouette grouped by role, so a glance tells you what a building is: the Town Center (a wide hall with a gabled roof and flanking corner posts), the Castle (a crenellated keep with battlement notches, no roof), the Wonder (a grand domed monument with a spire), Houses (a small home with a pitched roof and door), the Mill (a windmill with a four-blade cross), Farms (a tilled field of furrow rows, no roof), drop-site camps — Lumber Camp / Mining Camp (an open camp with a lean-to roof and a stockpile mound), military production halls — Barracks / Stable / Archery Range / Siege Workshop (a hall with a flat roof band and a banner flag), the Blacksmith (a forge with a chimney and an anvil), the Market (an open stall with a striped awning), the Monastery (a chapel with a cross finial), the Watch Tower (a tall narrow tower with a battlement cap), and Walls — Stone Wall / Palisade Wall (a low battlement segment). The owner color is kept as the body fill so faction ownership reads exactly as before, and every shape stays inside the building's footprint so selection rings, footprint outlines, and health bars are unchanged.

This is the first slice of the M7 "building visuals" item. The construction (scaffold) and last-seen-ghost looks are unchanged — only the completed building look now varies by type. Deferred to later slices: a construction→complete progress animation, a distinct silhouette per individual building type (rather than per role), rubble/damage states, and per-civilization architecture. The art is 100% original procedural Phaser drawing — no sprites and no copyrighted Age of Empires art.

### Validation

- TDD: new `tests/phaser/buildingRenderer.test.ts` (27 tests) covers the building→role mapping for a representative type of every role plus exhaustive coverage of all 18 building types; that every completed building draws at least one fill primitive and uses the entity tint; that distinct roles draw distinct primitive sets (the Mill draws blade lines, the Wonder draws a dome arc, the Wall has no roof triangle while the House does); that every drawn point stays inside the building's footprint rect for every type so the selection/health-bar geometry is preserved; and the unchanged variant contract (a completed building reports the body/roof/completion flags, a building under construction reports the foundation/scaffold flags, a last-seen ghost and a non-building both return no visual record).
- Visual protocol: a dedicated `building-showcase-fixture` (one completed building of every role in a visible grid) was captured before/after with a pixel diff — `tmp/buildings/{before,after,diff}.png`; 10.72% of pixels changed, confined exactly to the building footprints (the HUD, terrain between buildings, health bars, selection rings, minimap, and fog are pixel-identical; the changed-pixel bounding box stops below the top HUD bar and above the minimap panel).
- The render path is purely a function of the projected render data — no simulation, save-format, or bridge-contract change; the four gates (test/typecheck/lint/build) pass and the full suite is green (1404 passed / 2 skipped).
- Multi-CLI review: see `docs/threads/current/building-visuals-slice1/` (pending — the team lead runs the review before commit).

## 0.1.41 - 2026-06-16

### Units render as per-type directional shapes instead of colored circles (M7)

Units no longer render as flat tinted circles. Each unit now draws as an original procedural silhouette grouped by render role, so a glance tells you what kind of unit it is: a villager (small rounded body), infantry / foot melee (a shield-square body with a forward blade), archers / foot ranged (a slim body with a bow arc), cavalry / mounted (an elongated mount body with a rider), cavalry archers (the mount body with a bow arc), siege / machines (a boxy chassis with a wheel pair and a forward arm/barrel), and monks (a hooded robe with a cross). The owner color is kept as the body fill, so faction ownership reads exactly as before, and the shape turns to face the direction the unit is moving (idle units sit in a consistent resting orientation). The shapes are sized to the same footprint the circles used, so health bars and selection rings are unchanged.

This is the first slice of the M7 "units beyond colored circles" item. Deferred to later slices: a walk/idle animation cycle and a distinct silhouette per individual unit type (rather than per role). The art is 100% original procedural Phaser drawing — no sprites and no copyrighted Age of Empires art.

### Validation

- TDD: new `tests/phaser/unitRenderer.test.ts` (35 tests) covers the unit→role mapping for a representative unit of every role plus exhaustive coverage of all 34 unit types (and the specific `skirmisher → archer` case, since the skirmisher is foot-ranged but not in the simulation's archer line); the facing derivation (eastward movement → ~0 rad, southward → ~π/2, no previous position or sub-threshold movement → idle/null); and that the renderer draws a distinct primitive set per role (siege emits rectangles, the monk emits a cross, cavalry emits an elongated body) while keeping every drawn point inside the unit's bounding circle so the health-bar / selection geometry is preserved.
- Visual protocol: a dedicated `unit-showcase-fixture` (one human unit of every role in a visible row) was captured before/after with a pixel diff — `tmp/units/{before,after,diff}.png`; 0.29% of pixels changed, confined exactly to the seven unit positions (the HUD, Town Center, terrain, health bars, minimap, and fog are pixel-identical).
- The render path is purely a function of the projected render data — no simulation, save-format, or bridge-contract change; the four gates (test/typecheck/lint/build) pass and the full suite is green.
- Multi-CLI review: see `docs/threads/current/units-beyond-circles/` (pending — the team lead runs the review before commit).

## 0.1.40 - 2026-06-16

### Loom is now a researchable Town Center technology

Loom can now be researched at the Town Center. It is available from the Dark Age with no prerequisite beyond owning a Town Center, costs 50 gold, and takes 25 seconds — so it joins the Town Center research list (alongside the age-up and the Wheelbarrow/Hand Cart carry techs) the moment you have a Town Center, and drops off the list once researched. When it completes it permanently buffs every villager you own — and every villager you train afterward — with +15 maximum HP (25 → 40) and +1 armor. The HP gain is added to a villager's current HP too, so a damaged villager is healed by the same +15 when the research lands. This was the verified data-only Dark-Age tech surfaced by the campaign-10 playtest; it makes the early economy far more survivable against a Dark-Age raid (villagers take more hits and have more buffer), which is exactly the gap the playtest found.

Known divergence from AoE2 (deferred): real AoE2 Loom is +1 melee / +2 PIERCE armor. This release ships +1/+1 because the combat model still uses a single armor value per unit that reduces both melee and pierce damage (every armor upgrade in the game today is symmetric +1/+1). The extra +1 pierce armor is deferred to a later change that splits melee and pierce armor for all armor techs. The dominant part of Loom — the +15 villager HP — ships exactly as in AoE2.

### Validation

- TDD: new `tests/simulation/loomTech.test.ts` (17 tests) covers the Town Center offering Loom in the Dark Age and every later age until researched, dropping it once researched, and offering it alongside (after) the age-up; the 50-gold / 250-tick cost-table values; research charging exactly 50 gold and recording the tech, and being rejected when the owner has under 50 gold; an EXISTING villager going from 25/25 to 40/40 with armor 0 → 1 on completion (flat current+max bump, not a ratio rescale); a non-villager (Militia) being unaffected; a FUTURE villager (trained/seeded after research) starting at 40/40 + armor 1; armor reducing both incoming melee AND pierce damage by 1 at the damage site; no effect before research; and a save round-trip (a researched-Loom villager still reads 40 HP + armor 1 after load, and loom stays in the researched set — the post-load createCombatState re-derive path is covered by the future-villager test above). Existing Town Center research-option assertions were updated to include Loom (the Town Center genuinely offers it now). Full suite green; typecheck/lint/build all pass.
- Multi-CLI review: see `docs/threads/current/loom-tech/` (pending — the team lead runs the review before commit).

## 0.1.39 - 2026-06-16

### Resource chips and build buttons now have original glyph icons (M7)

The top resource bar and the build-command buttons now carry small original glyph icons alongside their text. Each resource chip shows a recognizable icon before its label — a wheat sheaf for Food, a stack of logs for Wood, a coin for Gold, a faceted rock for Stone, and (since they share the bar) a banner for Age, a house for Pop, and a clock for Time. Each "Build X" button in the selection panel shows an icon matching the building — a pitched-roof house for House, a windmill for Mill, a felling axe for Lumber Camp, a pickaxe for Mining Camp, crossed swords over a shield for Barracks, a tower for Watch Tower, an anvil for Blacksmith, an awning stall for Market, a catapult for Siege Workshop, a cross-topped chapel for Monastery, a battlemented keep for Castle, a domed monument for Wonder, a battlemented segment for Stone Wall, sharpened stakes for Palisade Wall, a tilled field for Farm, and so on — Town Center, Stable, and Archery Range are covered too; every one of the game's buildable types has a matching glyph. The text labels are KEPT — the icons augment them for quicker scanning, they do not replace them.

The icons are 100% ORIGINAL artwork: each is a small hand-authored inline SVG (simple paths/rects/circles on a 24×24 grid) that uses the existing warm gold palette, with no image assets, no icon font, and no copyrighted Age of Empires art. This is the first slice of the M7 "UI icons" item; the unit-roster / selection icons (still the short text badges like "V" / "TC"), the non-build command-card icons, and the minimap terrain + fog polish remain unchanged and are tracked as later M7 items.

### Validation

- This is a presentation change, so it follows the visual-change protocol: a before screenshot (text-only chips/buttons), the change, an after screenshot, and a pixel diff confirming the change is confined to the resource bar and the build buttons while the Phaser game canvas is pixel-identical. New `tests/simulation/hudIcons.test.ts` (9 tests) pins that every glyph is self-contained inline SVG with no external asset/font references and uses `currentColor` (so the palette stays in CSS), that every buildable building type has a glyph, and that the build buttons keep their `data-command` hooks and "Build X" text. The HUD/browser tests are unchanged (the resource value elements still hold only the number, e.g. `200`, and the build buttons are still addressed by `data-command`). Full suite green (1323 passed, 2 skipped); typecheck/lint/build all pass.
- Multi-CLI review: see `docs/threads/done/ui-icons/` (pending — the team lead runs the review before commit).

## 0.1.38 - 2026-06-16

### HUD panels now have a framed wood-and-stone look (M7)

The main HUD container panels are reframed toward Age of Empires II's framed wood-and-stone chrome instead of the previous flat panels. The top resource bar, the command/selection panel, and the match-summary footer now carry a procedural wood-plank surface (a subtle vertical grain striping plus a soft top-down highlight-to-shade so the surface looks lit), and the minimap frame carries a procedural chiselled-stone surface (a fine grey-and-gold fleck). Every framed panel gains a beveled raised edge — a light top-left highlight and a dark bottom-right shade — plus a soft inner recess, so each panel reads as a physical carved frame rather than a flat rectangle, and the minimap canvas sits sunken INSIDE its stone frame. The existing warm gold-on-dark-teal palette is unchanged (the game world, the panel layout and positions, the resource chips, the command buttons, and the unit-detail tiles all look exactly as before) — only the panel surfaces are restyled. The look is achieved entirely with procedural CSS (layered gradients and box-shadows); no image assets, no external fonts, and no copyrighted Age of Empires art are used. Per-button/icon restyling and the minimap terrain/fog polish are tracked as separate M7 UI items and remain unchanged here.

### Validation

- This is a CSS-only change with no behavior change, so it follows the visual-change protocol: a before screenshot, the change, an after screenshot, and a pixel diff (the HUD panel regions change; the Phaser game canvas is pixel-identical). The full test suite is unchanged and green (1314 passed, 2 skipped), and typecheck/lint/build all pass.
- Multi-CLI review: see `docs/threads/done/hud-chrome/`.

## 0.1.37 - 2026-06-16

### Standard 200 population cap (M1)

The standard AoE2 Random Map population limit of 200 is now enforced. Your population cap is the housing your buildings supply (House +5, Town Center +5, Castle +20) clamped to 200: effective cap = min(200, building supply). Over-housing past 200 is allowed but wasteful — extra Houses keep adding to the underlying supply but never raise the cap above 200. The supply is tracked honestly (un-clamped) so the clamp is recoverable: if you build well past 200 and then lose some housing, the cap stays at 200 as long as your remaining supply is still at or above 200; only once your supply drops below 200 does the cap follow it down. This fixes the subtle bug a naive clamp would introduce (build to 250, lose one House, and a clamp-the-stored-cap approach would wrongly drop your cap to 195 even though you still have 245 supply).

Losing housing can now leave you OVER the cap (your current population exceeds your cap). In that case nothing is evicted — your existing units all survive; you simply cannot train new units until your population falls back below the cap (a unit dies or is lost). The population readout shows the literal values in this state, e.g. `60/55`. Previously the cap could never dip below your current population (a House loss would floor the cap at your live pop), which let you re-train back up without rebuilding the housing — that over-permissive behavior is removed in favor of the AoE2-correct over-cap state.

Behavior is unchanged for normal play below 200: a House still raises your cap by 5 on completion, losing it lowers the cap by 5, and you still start at 5 (one Town Center). Save compatibility is preserved — saves written before this version load correctly (their stored cap is treated as the honest supply and re-clamped to 200, which is a no-op for any reachable old save). A configurable cap / "no population limit" lobby option, civ-specific cap modifiers, and an AI tweak to stop building Houses once it is capped at 200 are deferred follow-ups.

### Validation

- TDD: `tests/simulation/populationCap.test.ts` (13 tests) covers the pure 200-clamp deriver; a House raising cap+supply by 5 and losing one lowering them by 5 on the live bridge; over-housing to supply 250 keeping the cap at 200 while supply keeps climbing; THE regression — losing a House at supply 245 keeps the cap at 200 (not 195); supply dropping below 200 making the cap follow down; the over-cap state leaving units in place with no eviction and staying over cap; the production queue staying blocked at the cap; the cap being reachable at exactly 200; and save migration (round-tripping the new raw-supply field, and a legacy save without it loading with raw-supply = cap, re-clamped). Existing population assertions updated for the new field. Full suite green (1314 passed, 2 skipped).
- Multi-CLI review: see `docs/threads/done/pop-cap-200/`.

## 0.1.36 - 2026-06-15

### AI playtest findings now show up as markers when you replay the run

After an LLM playtest, the conformance-findings pass (`npm run playtest:findings -- <run-prefix>`) now writes the AI's findings INTO the run's recording bundle as annotation markers, so they are visible when you replay that bundle. Open the run in replay mode and each finding appears in the marker list (bottom-right) tagged with an `agent` author badge and a severity icon, and as a clickable pin on the replay timeline; clicking either jumps the replay to the moment the finding is anchored. This connects two systems that were previously disconnected — the findings used to live only in a flat `<prefix>.findings.md` report, untethered from where in the game they occurred. Each finding is anchored at the run's last decision tick (findings don't carry a per-finding tick yet, so for now they cluster at that one moment) and carries no map position. The finding's severity maps to the marker icon (high → bug, medium → warning, low → info), the marker text reads `[<finding-category>] <area>: <observed>`, and the full expected/suggestion detail is preserved in the marker for a future detail view. Re-running the findings pass on the same run replaces the previous AI markers rather than piling up duplicates (and a metrics-only `--no-llm` re-run, which produces no findings, therefore clears any previously-injected AI markers — keeping the bundle's markers consistent with the regenerated findings report), and if the run's bundle file is missing the pass still writes the findings report as before. This is the first use of the agent-authored marker path that the annotation system was built for. Rich per-finding tick/position anchoring, per-finding map pins, and AI/perf timeline-pin colors are deferred.

### Validation

- TDD: `tests/playtest/findingsToMarkers.test.ts` (18 tests) covers the pure mapping (shape, `category='ai'` with the gap-type preserved in `data`, severity high→bug/medium→warning/low→info, `isAoeMarkerData(data)` holds, the text format, empty→[], determinism), the idempotent in-place overlay (`injectAgentMarkers` replaces prior agent markers, preserves human markers, no duplication on re-run), and the anchor-tick derivation (last `tickAfter`, fallback to `endTick` on empty trace / missing `tickAfter`, clamp above `endTick`, floor non-integers, clamp below 0). Full suite green.
- Multi-CLI review: see `docs/threads/done/ai-findings-annotation-bridge/`.

## 0.1.35 - 2026-06-15

### Farms now auto-reseed instead of vanishing (M1 slice 2)

A farm no longer disappears the moment its stored food runs out. When a farm empties, if its owner has at least 60 wood in the stockpile the farm automatically reseeds: 60 wood is spent and the farm refills to its full capacity (175 food today), instantly and in place — the same farm, no rebuild delay, and the villager working it keeps producing: it finishes its current drop-off trip and is immediately back on the same now-full farm (no stall, no stranded carry). So a maintained farm is now a steady wood→food converter: as long as you can afford the wood it keeps producing food cycle after cycle, draining 60 wood each time it empties. Only when the owner can't pay the 60 wood at a depletion does the farm get removed from the map as before. The wood is always charged to the farm's owner. This closes the renewable-food backbone started in 0.1.34 — you no longer have to babysit fresh farms to avoid starving in a long game. The AoE2 Mill batch-reseed queue, a per-farm manual reseed toggle, and the farm-capacity upgrade techs remain deferred.

### Validation

- TDD: `tests/simulation/createSimulationBridge.farm.test.ts` adds a reseed test on the live bridge — a player with 140 wood and a near-depleted farm reseeds twice (wood 140 → 80 → 20, the farm keeps the same entity id and refills to 175 each time, food keeps flowing into the stockpile across the reseeds), then on the third depletion the owner is broke (20 < 60) and the farm is removed exactly as before. The existing depletion-removal test still asserts removal (its owner now has 0 wood, so it can't reseed). Full suite green (1283 passed).
- Multi-CLI review: see `docs/threads/done/farm-reseed-m1-slice2/`.

## 0.1.34 - 2026-06-15

### Farms — a buildable renewable food source (M1 slice 1)

Villagers can now build a Farm. It is available in the Dark Age with no prerequisite, costs 60 wood, is a 1×1 plot with 480 HP, and takes 15 seconds to construct — placed and built through the normal building flow, so it shows up in a villager's build menu alongside House / Mill / Lumber Camp / Mining Camp / Barracks / Palisade Wall. Once construction finishes, the farm becomes a gatherable food source holding 175 food: send a villager to it and they harvest food into your stockpile exactly like a berry bush (they stand on an adjacent tile and gather at a comparable rate). When the farm's stored food runs out it is removed from the map entirely. This is the start of the renewable-food backbone — until now a long game would starve once the starting sheep, boar, and berries were gone. Reseeding a depleted farm, the farm-upgrade techs (Horse Collar / Heavy Plow / Crop Rotation), a dedicated farm sprite, and the AI building farms are deferred to later slices, so for now you sustain food by building fresh farms as the old ones deplete.

### Validation

- TDD: `tests/simulation/createSimulationBridge.farm.test.ts` drives the full flow on the live bridge — a villager places a farm (60 wood charged, 480 HP ramping from low), it completes into a 175-food resource, a villager gathers it (food stockpile rises, stored food draws down), and a near-depleted farm is removed (both the resource and the building shell vanish, no orphaned shell). Full suite green.
- Multi-CLI review: see `docs/threads/done/farms-m1-slice1/`.

## 0.1.33 - 2026-06-15

### Cavalry and other units gain their base melee armor

Following the melee/pierce split (0.1.32), units now carry their real base melee armor from `design/stats/units.csv` instead of a flat 0. The cavalry line is the standout — knights, cavaliers, and paladins have 2 melee armor, so they shrug off a couple of points from every sword/spear hit and feel appropriately tanky; champions, trebuchets, and heavy cavalry archers have 1, and bombard cannons 2. As with pierce, a unit's effective melee armor is its base value plus its blacksmith armor-tech bonus, and it applies to both unit-vs-unit melee and wildlife bites. Most units — the militia and spearman lines (bar the champion), archers, camels, and siege — keep 0 base melee armor, so only the armored units change. Splitting which armor techs feed melee vs pierce, and the data-driven class-based bonus damage, remain the next slice.

### Validation

- TDD: `tests/simulation/combatArmor.test.ts` pins the base melee values (knight/cavalier/paladin 2, champion 1, archer/spearman 0), the base-plus-tech rule, and that a knight takes less melee damage than a spearman. Four combat scenarios across three test files were re-validated to AoE2-accurate outcomes (a Camel's +9-vs-cavalry hit leaves a Knight at 88 not 86 — its 2 melee armor cuts the 14 raw to 12; pikeman/halberdier/heavy-camel hits on knights/cavaliers each land 2 less, while the anti-cavalry bonuses still apply). Full suite green (1272 passed).
- Multi-CLI review: see `docs/threads/done/combat-base-melee-armor/`.

## 0.1.32 - 2026-06-15

### Combat splits melee vs pierce armor (archers no longer ignore armor)

Until now every unit had a single armor value, so an arrow and a sword were resisted identically. Combat now distinguishes melee from pierce damage (the first slice of the data-driven combat model in spec §10.2): an attacker's hit is reduced by the matching armor — melee attackers (infantry, cavalry, rams) by the target's melee armor, pierce attackers (archers, skirmishers, scorpions, mangonels, gunpowder, and tower / Town Center / castle arrows) by its pierce armor. A unit's pierce armor is its base value from `design/stats/units.csv` plus its accumulated blacksmith armor-tech bonus, so armor upgrades keep reducing arrow damage as they did before. The AoE2 counters now emerge: skirmishers (3 pierce armor) shrug off archer fire, battering rams (180) are all but immune to arrows, and cavalry/scout-line/militia carry their real pierce armor. Melee combat is unchanged. Splitting which armor techs feed melee vs pierce (the CSV armor classes) and class-based bonus damage — replacing the current hard-coded counter table — are the next slice.

### Validation

- TDD: `tests/simulation/combatArmor.test.ts` pins the split (pierce reduced by pierce armor, melee by melee armor, the floor-of-1 rule) and the counter contract (a skirmisher takes less archer damage than a spearman). Combat fixtures re-validated to the AoE2-accurate outcomes (e.g. a cavalry-archer now leaves a militia at 35 not 34; a mangonel leaves a knight at 62 not 60; a tower barely dents a mangonel). Full suite green.
- Multi-CLI review: see `docs/threads/done/data-driven-combat/`.

## 0.1.31 - 2026-06-15

### Rally points on a resource make new villagers auto-gather it

A campaign-9 replay deep-dive found that newly-trained human villagers stood idle at the Town Center even with abundant food a few tiles away: a fresh villager has no gather order of its own, and human villagers are auto-assigned to work only once they carry an explicit gather order. A Town Center (or any villager-producing building) rally point set ON a harvestable resource now gives each newly-trained villager that resource's gather order, so it walks out and starts working instead of idling — the standard AoE2 anti-idle mechanism. Rally points on empty ground remain plain move targets, and non-villager units are unaffected. The villager is routed to the nearest matching resource node (so several villagers rallied onto one forest fan out), and it keeps re-seeking that resource kind as nodes deplete.

### Validation

- TDD: `tests/simulation/createSimulationBridge.darkAge.test.ts` rallies a Town Center onto a tree, trains a villager, and asserts the new villager takes up wood and actively works it (it would otherwise keep the default food intent and idle). Full suite green.
- Multi-CLI review: see `docs/threads/done/rally-point-gather/`.

## 0.1.30 - 2026-06-15

### Terrain reads as a textured surface instead of flat blocks

The first graphics item toward the AoE2-HD-clone north star. The map seeds one flat tint per terrain kind, so every grass cell was the identical green, every forest cell the identical dark green, and so on — the map read as a grid of solid color squares. The renderer now applies a subtle, deterministic per-cell brightness jitter (about ±7%, hue preserved so it reads as dappled light/shade, not recoloring) on top of each terrain cell's base tint. Adjacent same-kind cells now differ slightly and the terrain reads as a textured surface. The variation is procedural and original — no copyrighted assets — and is purely presentational: it touches only the Phaser terrain renderer, leaving the simulation, the seeded tints, and the minimap untouched.

### Validation

- TDD: `tests/phaser/terrainTexture.test.ts` pins the helper's contract — deterministic per cell (no frame shimmer), in-gamut, subtle (within ~10% of base), genuinely varied (dozens of distinct shades vs. one for a flat fill), and unbiased on average (the field neither darkens nor brightens overall). Full suite green.
- Visual: before/after/diff screenshots under `docs/devlog/artifacts/2026-04-23-default-map-m7-terrain-{before,after,diff}.png`; the pixel diff confirms the change is confined to terrain cells (units, buildings, resources, HUD, and fog are untouched).
- Multi-CLI review: see `docs/threads/done/m7-terrain-texture/`.

## 0.1.29 - 2026-06-14

### Town Centers now defend themselves even when empty

A campaign-8 playtest plus ground-truth code reading found that an empty Town Center fired zero arrows — it only fired if a unit was garrisoned inside. That violated spec §10.8 ("base attack") and was inconsistent with the Castle (which always fires its base arrow), so a Town Center gave the player no passive defense during the economy phase — exactly when a Dark-Age rush hits. A completed Town Center now fires its base arrow (5 damage, range 6, reload 12) whenever it stands, plus one arrow per garrisoned unit up to 4 — matching the Castle and the spec. This gives villagers real cover near the TC against early raids.

### Validation

- TDD: `tests/simulation/prototypeRules.test.ts` asserts an empty Town Center fires 1 (and 4 with 3 garrisoned). Because the now-firing empty TC perturbs combat-isolation tests whose fixtures staged duels within TC range, ~25 fixtures across combat, siege, monastery, auto-aggression, AI, and production suites were restaged so combat happens clear of any Town Center's range (the measurements they assert are unchanged); full suite green (1255 passed).
- Multi-CLI review: see `docs/threads/done/tc-base-fire/`.

## 0.1.28 - 2026-06-14

### Palisade Walls can be built in the Dark Age

A validation playtest (campaign-7) showed the player getting rushed and overrun by the AI's military in the Dark Age with no way to defend — palisade walls were locked behind the Feudal Age and a Barracks. In Age of Empires II the Palisade Wall is a Dark-Age building with no prerequisite — the standard early defense. It is now buildable from the Dark Age (2 wood, 250 HP), so a player under early pressure can wall off villagers and economy and survive to Feudal. Other buildings are unchanged.

### Validation

- TDD: `tests/simulation/buildOptionsDarkAge.test.ts` (palisade-wall offered in the Dark Age with no barracks; listed once; Feudal-gated buildings still gated); full suite green. The early-defense effect in a live match is validated by the next playtest re-run.
- Multi-CLI review: see `docs/threads/done/dark-age-palisade/`.

## 0.1.27 - 2026-06-14

### Wheelbarrow and Hand Cart now boost villager carry capacity

Following the gather-rate techs (0.1.26), the Town Center carry techs are now live: Wheelbarrow (Feudal, +25% carry) and Hand Cart (Castle, +50% carry) raise how much a villager hauls per trip (they stack — +87.5% with both, so ~10 → ~19). Because carry is resource-agnostic, this speeds gathering of every resource including food — fewer drop-off trips — which most helps the food economy on the road to Castle/Imperial Age. They appear at the Town Center alongside the age-up research and drop out once researched. Their AoE2 movement-speed bonus (+10%) is not included yet (that's a separate movement-system change). The in-game AI still focuses on age-up research, so its timings are unchanged.

### Validation

- TDD: `tests/simulation/economyCarryTechs.test.ts` (carry multiplier + effective capacity) and `tests/simulation/economyResearchOptions.test.ts` (Town Center offers age-up + carry techs, drop-once-researched); full suite green. End-to-end (a fuller carry / fewer trips in a live match) is validated by the consolidated playtest re-run.
- Multi-CLI review: see `docs/threads/done/economy-carry-techs/`.

## 0.1.26 - 2026-06-14

### Economy gather-rate technologies now actually speed up gathering

A playtest showed the agent only ever researched the age-up — the economy upgrades existed in the data but did nothing, so there was no reason to research them. The Lumber Camp and Mining Camp gather-rate techs are now live and effective: Double-Bit Axe (Feudal, +20% wood), Bow Saw (Castle, +20% wood), Two-Man Saw (Imperial, +10% wood), Gold Mining and Stone Mining (Feudal, +15%), and Gold/Stone Shaft Mining (Castle, +15%, require their base tech). Effects stack and make villagers fill their carry sooner, raising throughput — meaningful research beyond age-up now exists, which matters most for reaching Castle/Imperial Age before food and wood sources run dry. The in-game AI is unaffected (it still focuses on age-up research), so its tuned economy and timings are unchanged. Farm-food techs (Horse Collar, Heavy Plow) and the carry/movement techs (Wheelbarrow, Hand Cart) are not included yet — they depend on farms and on carry/speed modifiers, which come later.

### Validation

- TDD: `tests/simulation/economyGatherRateTechs.test.ts` (multiplier math + cadence) and `tests/simulation/economyResearchOptions.test.ts` (the techs surface at the right building/age and drop out once researched); full suite green. End-to-end (agent researching and gathering faster in a live match) is validated by the next LLM-playtest re-run.
- Multi-CLI review: see `docs/threads/done/economy-gather-techs/`.

## 0.1.25 - 2026-06-14

### Villagers spread across the forest (no more re-piling on one tree)

Loop 1 (v0.1.24) stopped villagers jamming permanently, but a replay of the next playtest showed they still re-piled onto the single nearest tree — 15 of 16 woodcutters on one tree — gathering at a fraction of their potential, because once a villager finished a trip it was re-assigned to the nearest tree again. Now idle villagers fan out: assignment prefers resources with fewer than a generous cap of gatherers, so crowds spread across the forest. The cap is deliberately generous so the in-game AI's normal play is unchanged (a tight cap over-spread the AI and stalled its age-up). Result: a stronger food/wood economy, so the player can reach Castle Age.

### Validation

- TDD: `tests/simulation/villagerGatherSpread.test.ts` (villagers fan out) and the AI age-progression test both pass — the latter is the guard that the spread cap doesn't perturb the AI's economy (it fails at a tight cap, passes at the generous one).
- Multi-CLI review: see `docs/threads/done/gather-idle-spread/`.

## 0.1.24 - 2026-06-13

### Villagers no longer gridlock when many gather the same forest

**Wood (and any resource) keeps flowing when villagers crowd one spot.** Found by replaying an LLM-playtest bundle with the engine's `SessionReplayer`: villagers ordered to gather wood piled onto the single nearest tree — 14 of 18 woodcutters targeted ONE tree — and jammed permanently walking toward it (0 gathering), so wood stayed flat the whole game and the player was frozen in Feudal. The simulation always sent a villager to the globally-nearest matching resource and a villager walking toward an over-crowded resource had no way to give up. Now, a villager that spends too long unable to reach an over-subscribed resource is reassigned to the nearest un-crowded one, so crowds fan out across the forest and actually gather. Normal (un-crowded) gathering is unchanged, so AI economies are unaffected.

### Validation

- TDD: new `tests/simulation/villagerGatherSpread.test.ts` piles every villager onto one tree and asserts they fan out to multiple trees and the wood drops (fails without the fix). The AI age-progression test still passes (the fix is surgical — only crowded villagers redistribute).
- Found and root-caused with the engine's replay debugging (`npm run replay:inspect`), not a synthetic repro — both the LLM's own "gather is broken" finding and a first synthetic-repro hypothesis ("enemy raids killed the villagers") were wrong.
- Multi-CLI review: see `docs/threads/done/gather-stall/`.

## 0.1.23 - 2026-06-13

### Town Centers and Castles now provide population (toward AoE2)

**Town Centers and Castles now contribute population headroom.** Spec §6.10 has always called for Houses, Town Centers, and Castles to supply population, but the simulation gave Town Centers and Castles 0 — only Houses raised the cap. Now, at AoE2 values: **Town Center +5, House +5, Castle +20**. The cap is fully building-derived: the player's starting Town Center provides the initial 5 (so the opening cap is unchanged at 5), and additional Town Centers, Houses, and Castles add from there. This is the first fix from the new AoE2 coverage roadmap (`design/roadmap.md`) — population is the single biggest throttle on army size and sustained late-game play, and the Castle is now a real population building, not just defense. (The standard 200 population limit is a tracked follow-up; it needs raw-supply accounting to handle over-housing and destruction correctly, so it is not enforced yet — the pre-existing unbounded-by-housing behavior is retained for now and is not reachable at current game scale.)

### Validation

- TDD: new `tests/simulation/populationModel.test.ts` pins the per-building population values; existing bootstrap/darkAge tests confirm the opening cap stays 5 and a completed House still raises it to 10.
- Multi-CLI review: see `docs/threads/done/population-model/`.

## 0.1.22 - 2026-06-12

### Replay fog-owner toggle (spectate any player) + civ-engine 1.0 absorb

**Fog perspective toggle in replay mode.** The timeline panel gains a **Fog: P\<n\>** button (hotkey `Alt+F`) that cycles which player's fog of war the replay renders — the missing piece for spectating LLM playtest campaigns, where the agent plays as player 2 and its base previously sat under player 1's fog. Scope rules: rendered visibility and entity filtering follow the selected owner; simulation state, playback position, selection, and the HUD's resource/age panels stay exactly as before (fog toggle, not a POV switch); "last seen" ghost entities render only for player 1 (the engine records fog memory for the human player alone); the toggle is disabled for single-player bundles, resets to player 1 on every replay entry, and does not exist in live mode (cheat surface).

**civ-engine 1.0.x absorbed** (1.0.0 strict-by-default; 1.0.1 replayer factory contract; 1.0.2 and the additive 1.1.0 landed in the sibling tree during the session — both no-impact for aoe2): `saveGame()`'s pre-serialize state flush now runs inside the engine's `runMaintenance` window (same semantics, sanctioned phase); replay test stubs honor the new `factory_snapshot_not_applied` contract. Zero gameplay behavior change. Operator note: civ-engine 1.0's bundle version policy makes replay same-engine-major tooling — bundles recorded under 0.x (campaign-1/-2) replay only with 0.x checkouts; new recordings replay normally.

### Validation

- All four gates green (1215 tests); 17 new tests (fog rendering + adapter-dispose mechanism at the replay bridge incl. the HUD-stays-P1 pin, controller fog API incl. transactional-enterReplay/setFogOwner pins, dispose wiring, cached candidates, timeline button, Alt+F hotkey).
- Multi-CLI review: see `docs/threads/done/replay-fog-owner/`.

## 0.1.21 - 2026-06-11

### Actionable command rejections + agent affordances (campaign-1 backlog #1-#3)

Campaign-1 (the first full-length LLM playtest) showed the agent burning ~7 decisions (~$4) reverse-engineering the feudal-age prerequisite rule from bare `cannot_research` rejections, and losing 19/27 placement commands to blind house placements answered with a bare "Placement blocked.". This release makes every relevant rejection state its actual reason and gives the agent the affordances to act correctly the first time.

**Rejection messages now state the unmet rule (all command submitters; the human HUD toast passes the richer message through for `placement_blocked` and for research rejections sharing the `cannot_research` toast slot — e.g. re-clicking an in-flight tech now toasts "feudal-age is already being researched." — while train/build insufficient-resource toasts keep their terse pre-existing strings):**

- `cannot_research` — names WHY: "Advancing to feudal-age requires 2 completed Dark Age buildings (mill, lumber-camp, mining-camp, or barracks) — you have 1.", "fletching is already researched.", wrong-building rejections name where the tech IS researched, and the fallback lists what is currently researchable at that building. The HUD toast passes this message through (was a fixed "Cannot research that here.").
- `cannot_train` — names the rejected unit + building and lists what is currently trainable there.
- `insufficient_resources` (research/train/build) — need-vs-have detail per missing resource: "need 500 food (have 320)".
- `placement_blocked` — names the blocking cause + cell ("blocked by water at (43,18)"), the blocked-cell count, the footprint size, and the nearest open anchor fully visible to the acting owner when one exists within the scan radius. The HUD toast passes this through (was a fixed "Placement blocked.").
- `in_flight_tech` — names the tech already being researched.
- Rejection CODES and accept/reject decisions are byte-identical to 0.1.20 — only message text changed.

**New public `SimulationBridge` surfaces (consumed by the LLM-agent snapshot):**

- `getAgentBuildingOptions(ownerId)` — per completed owned building type: research available now (with costs), research visible-but-locked with the actionable reason (shared engine with the validator, so the two surfaces never disagree; in-flight techs marked "already being researched"), trainable units, and the villager build menu with footprints + costs.
- `findOpenPlacementAnchorsNear(ownerId, x, y, w, h, max)` — deterministic ring scan for open building anchors near a point; every footprint cell must be unblocked AND currently visible to the owner (fog reveals nothing).

**LLM-agent snapshot/prompt:** new `buildingOptions` + `placementHints` blocks (up to 6 open 2x2 + 4 open 3x3 anchors near the town center); the `building.placeConfirm` tool description now explains anchor semantics and points at the hints.

### Validation

- All four gates green: 1198 passed + 2 skipped (36 new tests across the reason engine, placement describer/anchor scan, validators, buildingOptionsOps incl. a live-bridge campaign-1-case integration test, snapshot pass-throughs, and prompt rendering).
- Multi-CLI review: see `docs/threads/done/agent-affordances/`.
- Two technology tests' caps bumped 30s→90s (contention-flake class, vitest-timeout-headroom precedent; both pass isolated).

## 0.1.20 - 2026-05-08

### Bug fix: Visual non-overlap snap on move arrival + wider BFS

Two §12.6/§12.7 follow-ups landed together:

**Snap-on-stop renderer fix (§12.6 visual non-overlap).** When a unit's move command arrives at its destination, the move-arrival handler now snaps the unit's `fineX, fineY` transform to the engine-allocated 16-slot offset (via `worldOccupancy.getUnitSlotOffset`). Previously, `transform.fineX/fineY` used a 4-slot fallback derived from `entityId % 4`, so two units with the same `entityId % 4` standing in the same cell would render at the exact same screen pixel even when they had distinct OccupancyBinding-allocated slots. The snap fires once at arrival; in-flight movement still uses the entity-id fallback for target computation so sub-tile motion stays smooth (no per-tick teleport on cell crossings). Maximum visible jump on arrival is 0.75 of a cell.

The snap is intentionally NOT applied at fresh-spawn (scenario seed) — an earlier draft that snapped in `addUnitEntity` after `syncSpawnedEntityOccupancy` broke `fogMemory` and `selectionActivity.other` tests in ways I haven't yet diagnosed (the snap shouldn't affect visibility, which uses integer `position.x/y`, but something downstream appears to depend on the entity-id-derived initial transform). Unit-id-collision visual overlap at the very first rendered frame remains a known gap until that path is investigated.

**Wider BFS for `findNearestFreeUnitCell` (§12.7 lazy redirect).** The lazy-redirect helper now walks up to a 16-cell Chebyshev radius via the same spiral algorithm that `allocateGroupMoveTargets` uses, instead of only checking the 8 immediate neighbors. A unit arriving at a fully-packed cell whose 8 neighbors are also full now finds capacity in cells 2-16 away. Spec §12.7's default radius is 16, so this matches the spec. Both the lazy-redirect helper and the group-allocation spiral now share `generateSpiralCells` and `findNearestFreeUnitCellInSpiral` in `worldOccupancyAllocators.ts` for consistency.

### What's still not handled

- **Snap-on-spawn** for the first rendered frame after seed creation (described above; investigation pending).
- **Reservation lifecycle registry** (§12.7's TTL guardrail). Today's implicit "reservation = the unit's move command target" handles reserved-cell-taken-before-arrival via lazy redirect on its own arrival, which satisfies the user-visible behavior. An explicit registry would unlock TTL guardrails and richer AI reasoning but is deferred until a real game scenario surfaces a need.
- **Movement target uses entity-id slot during transit** (snap happens only on stop). Could be extended to use the allocated slot if mid-flight visual fidelity becomes important.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 899 passed + 1 skipped.
- 1 new test in `tests/simulation/worldOccupancyVisualSlots.test.ts` (wider-BFS coverage) plus an updated saturated-world test that pins the new "BFS exhausted" semantics.
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.19 - 2026-05-08

### Feature: Group-move pre-reservation (§12.7 eager allocation)

Selecting N units and right-clicking a single tile no longer issues N identical move commands all targeting the same cell. The HUD's `issueMoveCommand` now spiral-allocates one cell per unit starting from the clicked tile and walking outward in BFS order; each unit's move command targets its individually allocated cell. This is the second half of spec §12.7's dual-strategy rule (lazy redirect for single units shipped in 0.1.18; eager pre-reservation for groups in 0.1.19).

Behavior:

- **N=1 (single unit):** unchanged — direct `issueUnitMoveCommand` to the clicked cell. Pathfinding handles blocked targets ("walk to closest reachable cell"); the move-arrival lazy redirect handles overflow.
- **N>1 (group):** `worldOccupancy.allocateGroupMoveTargets(unitIds, targetCenter)` walks outward from the target and allocates one cell per unit. Each cell can absorb up to its remaining sub-cell capacity (default 16 - currently-occupied) before the spiral moves to the next cell. Whole-cell-blocked cells (buildings, resources, terrain, out-of-bounds) are skipped — they cannot host any unit slot. The result is that a 20-villager group commanded to a single tile spreads across the target cell and its neighbors instead of all stacking on one tile and detouring through lazy redirect.
- **Spiral exhaustion:** if every cell within a 16-cell radius is full or blocked, the unit's target falls back to `targetCenter`. Pathfinding still picks the closest reachable cell; visual stacking is the last-resort behavior.
- **Determinism:** the spiral uses a fixed neighbor-offset order (E, W, S, N, then diagonals) so save / load and replay produce byte-identical allocations from the same world state and inputs.

Whole-cell-blocked tiles are intentionally redirected away from in the group case (e.g., commanding 5 villagers to a tree spreads them around the tree rather than telling all 5 to stand on the tree). Right-click on a resource still routes through `issueContextCommand` (gather / attack), which is a separate path and unaffected.

### What's still not handled (intentional gaps, carried from 0.1.18)

- **Visual-overlap-from-entity-id collisions.** The renderer still derives a 4-slot offset from `entityId % 4` rather than the engine-allocated 16-slot offset. Two units with the same `entityId % 4` in the same cell can still draw at the same screen pixel. Independent of §12.7; remains a separate task.
- **Wider BFS radius for `findNearestFreeUnitCell`.** Lazy redirect still checks only the immediate 8-cell window. The group-allocation spiral correctly walks up to 16 cells out, but the lazy-redirect path doesn't yet match.
- **Reservation lifecycle.** Spec §12.7 calls for soft reservations with a 30s TTL and lifecycle release on death / new command. The current implementation uses simple "allocate at issuance, no per-tick refresh" — if a third party takes a reserved slot before arrival, the displaced unit falls back to lazy redirect on its own arrival (which works correctly).

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 898 passed + 1 skipped.
- 6 new tests in `tests/simulation/worldOccupancyVisualSlots.test.ts` pin the `allocateGroupMoveTargets` contract: target cell with capacity hosts every unit; 17+ overflow to neighbor cells; existing occupancy reduces remaining capacity; whole-cell-blocked neighbors are skipped; spiral exhaustion falls back to `targetCenter`; single-unit groups return a single target.
- File-size budget split: extracted `allocateGroupMoveTargets` body and `NEIGHBOR_OFFSETS` to a new `src/game/simulation/worldOccupancyAllocators.ts` to keep `worldOccupancy.ts` under the 500-LOC hard limit (498 / 118 LOC).
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.18 - 2026-05-08

### Bug fix: Move-arrival redirect for fully-packed cells (§12.7 lazy redirect)

Spec §12.7 first-pass implementation. When a unit's move command arrives at a target cell that already hosts 16 units (the engine's sub-cell slot capacity), the move handler now redirects the command target to the nearest free neighbor cell instead of leaving the unit overflowing at the destination. The unit then moves to the redirected cell and stops there with a real slot. Previously the 17th unit would land in overflow — its `OccupancyBinding`-allocated slot offset was null and (depending on rendering specifics) it could draw on top of an existing unit at the same cell.

The redirect only fires for the bare `unit.move` command path (the move-arrival site in `playerCommandsSystem`). Group-move pre-reservation (§12.7's b-path) and arrival redirects from other command kinds (build, gather, drop-off) are deferred to follow-up commits.

### What's still not handled (intentional gaps)

- **Group-move oscillation prevention.** Selecting N units and right-clicking a single cell still issues N independent move commands all targeting that cell. Each unit individually follows the lazy-redirect rule on arrival, but the order in which they arrive is non-deterministic with respect to the spiral layout the spec calls for. The next commit on §12.7 adds the eager pre-reservation path that the spec describes.
- **Visual-overlap-from-entity-id collisions.** The renderer still derives a 4-slot offset from `entityId % 4` rather than the engine-allocated 16-slot offset. Two units with the same `entityId % 4` in the same cell can still draw at the same screen pixel even when neither cell is full. That's a separate problem from §12.7 and remains open.
- **Wider BFS radius.** `findNearestFreeUnitCell` currently checks only the immediate 8-cell window. Spec allows up to a 16-cell BFS radius; we'll widen if a gameplay scenario surfaces the need.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green. Full suite 892 passed + 1 skipped.
- 4 new tests in `tests/simulation/worldOccupancyVisualSlots.test.ts` pin the `findNearestFreeUnitCell` contract: requested cell with space returns the cell; requested cell full returns a neighbor; everything full returns null; entity-itself-in-overflow at the requested cell still sees the cell as free for itself.
- Multi-CLI review pending; will land as iter-1 follow-up if reviewers find issues.

## 0.1.17 - 2026-05-07

### Feature: Multi-villager construction with smooth HP-bar

Three intertwined construction defects fixed in one feature:

- **Selecting N villagers and placing a building now assigns the build command to all N.** Construction speed scales linearly with builder count. Previously only the first selected villager got the command; the rest stood idle.
- **Right-clicking an own in-progress building site routes selected villagers to join the build.** Previously the right-click fell through to the move fallback and additional villagers walked toward the foundation but never built.
- **The construction HP bar now updates every tick during construction.** Previously the bar appeared frozen because side-map mutations (`buildingHealthStates`) do not mark the building entity dirty for civ-engine's renderAdapter — the projector never re-ran for the foundation, so the projected `currentHp` value stayed constant until something else marked the entity dirty (selection, damage, completion). A no-op `world.patchComponent('renderable', r => r)` per builder-at-site per tick is enough to flag the entity dirty, after which the projector fills the bar smoothly. Multi-builder ticks dedupe at civ-engine's dirty-set level so the cost stays one re-projection per construction site per tick.

`building.placeConfirm`'s payload extends with optional `additionalBuilderIds: number[]` (backward compatible — old replays with just `builderId` continue to work). The validator only enforces array shape + integer entries; per-id alive / villager / same-owner checks are best-effort at handler time, mirroring the AI tolerance pattern already in use elsewhere.

### Validation

- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`: all four green.
- New scenario tests in `tests/simulation/multiVillagerConstruction.test.ts` (4 tests) cover linear-scaling speedup, mid-build right-click join, complete-building fall-through (gating-order pin), and per-tick projected-HP updates (verifies the regression is actually caught — the test reads via the projector, so commenting out the `patchComponent` call makes it fail).
- New fixtures `multi-villager-construction-fixture` / `single-villager-construction-fixture` for deterministic tick-count comparisons.
- Multi-CLI review iter-1 (Codex + Claude) caught 3 real bugs (HP-bar test bypassed projector, mid-build budget too loose, in-progress branch ate fall-through on helper failure) plus 3 LOW/NIT findings; all closed in iter-2. Iter-2 Codex unreachable (budget); iter-2 Claude verified clean.

## 0.1.16 - 2026-05-07

### Feature: Scrub-workflow Playwright e2e

The fourth deferred follow-up from the v0.1.12 thread close lands. New `tests/browser/replay-scrub.spec.ts` (3 tests) drives the timeline scrubber + step buttons against a real replay session and asserts on `__AOE2_TEST__.replay.getReplayCurrentTick()`:

- **Timeline range scrub commits to the requested tick.** Sets the `<input type=range>` value via DOM event dispatch (input + change), waits for the controller to apply the scrub, then asserts `getReplayCurrentTick()` matches.
- **Step-back/forward buttons advance one tick at a time.** Seeds a mid-replay tick, then exercises both buttons.
- **Exit button leaves replay mode.** Asserts the timeline's exit handler returns the controller to live mode.

The "Playwright drag synthesis" referenced in the v0.1.12 thread close turned out unnecessary — the timeline thumb is a native `<input type=range>`, so a value-set + change-event dispatch covers the same ground without `page.mouse.down/move/up` choreography.

### Internal: tightened race condition on prior-row click in test API

The replay-load dialog's prior-row click triggers an async IDB fetch before `enterReplay` fires. Reading `getReplayMode()` immediately after the click can race the resolve. The new spec uses `expect.poll` to wait for the mode flip, mirroring the pattern Playwright recommends for async state changes.

### Validation

- `npm test`: 863 unit tests + 1 skip pass; same 5 pre-existing full-suite contention flakes ride through unchanged.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npx playwright test tests/browser/replay-scrub.spec.ts`: **3 / 3 pass** on chromium.
- Full Playwright suite: 89 pass, 2 skip, 5 failed in unrelated specs (`game-progression-and-production`, `game-rendering-and-world`, `game-simulation-and-exploration-core`) — these are pre-existing rendering/behavior assertion mismatches (e.g., market resources expected 800 got 700; garrison villager count expected 2 got 3; building visual flags off) not introduced by this commit. The 8 replay-related Playwright tests (5 dialog + 3 scrub) all pass.

## 0.1.15 - 2026-05-07

### Bug fix: ReplayLoadDialog non-interactive in real browsers

Two CSS rules left over from the v0.1.12 dialog slice made the dialog appear broken in chromium (the bug never surfaced under jsdom, so the unit suite missed it). Wiring the prior-session Playwright spec exposed both:

- `.replay-load-dialog__panel { display: flex }` is in the author stylesheet and outranks the user-agent stylesheet's `[hidden] { display: none }` rule on cascade origin (author > UA at normal priority — class vs. attribute have equal specificity). Result: all three tab panels rendered simultaneously regardless of the active tab. Fix: a compound selector `.replay-load-dialog__panel[hidden] { display: none }` wins on specificity within the author stylesheet (0,2,0 > 0,1,0).
- `#hud-root { pointer-events: none }` cascaded into the dialog. Native `<dialog>.showModal()` puts the element in the top layer for stacking purposes, but pointer-events still inherits from the DOM parent — so every click inside the dialog (Cancel, Start replay, tab switching, file picker) fell through to the html element. Now `.replay-load-dialog__root { pointer-events: auto }` re-enables interactivity. Independent of the panel-hide bug above.

### Feature: Prior-session Playwright e2e

The deferred prior-session e2e from the v0.1.12 thread close lands. New `__AOE2_TEST__.replay.seedPriorSession()` rolls a save+load round-trip so the live recorder closes its current session (becoming a prior session in IDB) and starts a fresh one. The new spec at `tests/browser/replay-load-dialog.spec.ts` drives the Prior tab end-to-end: drive 120 ticks → seed → open dialog → switch to prior tab → click row → assert replay mode → Escape → assert live mode.

### Validation

- `npm test`: 863 unit tests + 1 skip pass; 5 pre-existing full-suite contention flakes (`castleUpgrades`, `imperialUpgrades.castleBlacksmith`, `aiPlayer` end-to-end) that pass in isolation. These are not introduced or affected by this change — same flakes ride v0.1.13 / v0.1.14. AGENTS.md does not yet codify a contention-flake exception, so flagging here for transparency.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm install` re-resolved `package-lock.json` to 0.1.15.
- `npm audit --audit-level=high`: 0 production vulnerabilities; 1 dev-only moderate (sub-blocker per AGENTS.md threshold).
- Playwright e2e: **5 / 5 pass** on chromium (verified locally; the four pre-existing tests now actually pass against a real browser, not just the jsdom stand-ins).
- Visual gate: before/after screenshots + pixel diff at `docs/devlog/artifacts/2026-05-07-replay-load-dialog-{before,after,diff}.png`. Diff highlights the 14.45% pixel delta covering the now-hidden Prior + From-file panel content.

## 0.1.14 - 2026-05-07

### Bug fix: cancel-during-load races in ReplayLoadDialog

Closes four async lifecycle races in `ReplayLoadDialog` that could leave the user in replay mode (or the dialog with stale state) despite cancelling. A `generation` counter is captured at handler entry and bumped on every dialog `close` event and on `dispose()`; resumed handlers compare and bail before any controller mutation or DOM write.

- **Prior-session row click**: previously, clicking a prior session and then Cancel before the IndexedDB fetch resolved still landed the user in replay mode when the bundle finally arrived. `loadPriorSessionAsReplay(deps, sessionId, signal?)` now accepts an optional `LoadPriorSessionSignal` and returns `{ status: 'cancelled' }` when the signal trips before `enterReplay`. The dialog passes a signal whose `isCancelled()` watches the generation token.
- **File-import**: clicking a file then Cancel before `File.text()` resolved still parsed and entered replay. The handler now checks generation immediately after the file read and bails before parse + `enterReplay` (both of which are synchronous after the await).
- **Tab-switch stale write**: a slow `recording.listPriorSessions()` started by the prior-tab click could resolve after a close+reopen and overwrite the cache with stale descriptors. The handler now checks generation before writing the cache or rendering.
- **Dispose during in-flight handler**: if `dispose()` ran while any of the above were pending, the resumed handler would call `enterReplay` on a torn-down dialog. `dispose()` now bumps generation so all in-flight handlers see a stale capture.

The `LoadPriorSessionStatus` union grows a `'cancelled'` variant. Existing callers that don't pass a signal can never observe `'cancelled'` so behavior is unchanged.

### Validation

- `npm test`: pass.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- New tests: `tests/replay/loadPriorSession.test.ts` cancellation case + 4 new race tests in `tests/ui/replayLoadDialog.test.ts` (cancel-during-prior-row, cancel-during-file-read, dispose-during-prior-row, tab-switch stale-resolve).

## 0.1.13 - 2026-05-07

### Phase 3E: replay-flow integration + browser e2e

A new vitest+jsdom integration suite (`tests/integration/replay-flow.integration.test.ts`, 6 tests) drives the replay-load flow end-to-end against a real `recordCommandReplayFixture`-produced bundle: live-session helper enters replay; file-import parses + enters replay; the `ReplayLoadDialog` modal confirms via the live tab and the file tab; the slice-4 transactional `enterReplay` guarantee survives a malformed second bundle while a first replay is active; and the parser's "invalid JSON" path surfaces the expected toast through the dialog.

A new Playwright e2e spec (`tests/browser/replay-load-dialog.spec.ts`, 4 tests) drives the actual built app: clicking the unified "Replay…" button opens the dialog; Cancel closes without entering replay; the live tab confirm enters replay after 120 ticks (deterministic — no graceful-skip fallback) and Escape exits; the file tab rejects malformed JSON with the dialog staying open and replay mode unchanged; the test API can open the dialog programmatically. The spec asserts on `__AOE2_TEST__.replay.getReplayMode()` instead of canvas pixels so it does NOT need visual baselines. Prior-session and scrub-workflow e2e flows are deferred to a follow-up because they require IDB seeding and Playwright drag synthesis respectively; the integration suite covers their deterministic equivalents.

The browser test API (`window.__AOE2_TEST__`) gains a required `replay` sub-object exposing `getReplayMode()`, `getReplayCurrentTick()`, and `openReplayLoadDialog()`. Required (not optional) so Playwright specs read `api.replay.getReplayMode()` without optional chaining at every call site.

This concludes Phase 3D + Phase 3E of the replay-load-and-e2e thread. The thread folder moves from `docs/threads/current/replay-load-and-e2e/` to `docs/threads/done/replay-load-and-e2e/` in this same commit.

### Validation

- `npm test`: pass with 115 files, 857 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Playwright e2e: written against `__AOE2_TEST__.replay`. Runs via `npm run test:browser` (which builds the preview app first via `pretest:browser`). The host needs to run the suite locally to verify; specs do not require visual baselines.

## 0.1.12 - 2026-05-06

### Phase 3D Slice 5: ReplayLoadDialog modal

The two slice-2/4 standalone HUD buttons ("Replay" and "Replay file") are replaced by a single "Replay…" button that opens a unified `ReplayLoadDialog`. The dialog uses a native `<dialog>` element (`showModal()`) so the browser provides focus trap, Escape dismissal, and backdrop for free.

The modal has three tabs:
- **Live session** — replay the in-progress live recording. Disabled when the recorder has no commands yet (matches the slice-2 contract).
- **Prior session** — list IDB-persisted sessions; click a row to enter replay. Schema-mismatch and SchemaMismatchError surface as toasts.
- **From file** — file picker that parses an exported bundle JSON and enters replay. Same structural validator as slice 4.

Default tab on open: "Live session" if the live recorder has payloads, else "Prior session". The HUD button is disabled while replay mode is already active (re-entry guard) and re-enables immediately on `replayController.onModeChange`. The Prior Sessions row "Replay" button in `MarkerListPanel` (slice 3) stays — it's an in-context affordance that complements the dialog.

The previous slice-2 `createReplayCurrentSessionButton` and slice-4 `createReplayFileImport` DOM helpers are deleted as dead code; the underlying `loadCurrentSessionAsReplay`, `loadPriorSessionAsReplay`, and `parseSessionBundleFile` helpers stay because the dialog uses them directly.

### Validation

- `npm test`: pass with 114 files, 851 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Visual verification deferred to a follow-up: the dialog's CSS uses HUD-consistent dark-teal palette + blue-accent active state and renders inside a native `<dialog>` (centered modal + browser-default backdrop). Capture before/after screenshots + pixel diff in a follow-up before the next user-visible polish slice.

## 0.1.11 - 2026-05-06

### Phase 3D Slice 4: Replay file import

A new "Replay file" HUD button (next to "Replay") opens a recorded `SessionBundle` JSON file in replay mode. Click triggers a native file picker; on file selection the bundle is parsed structurally (validates top-level `schemaVersion` typed as number, top-level fields `metadata`/`initialSnapshot`/`ticks`/`commands`/`executions`/`failures`/`snapshots`/`markers`/`attachments` typed as arrays where applicable, plus `metadata.sessionId/startTick/endTick`) and handed to `replayController.enterReplay(bundle)`. Invalid input never partially applies on two layers: the structural parser runs before the controller is touched, AND `ReplayController.enterReplay` now constructs the new `SessionReplayer` and replay world BEFORE exiting any existing replay or swapping the bridge — so any engine-level rejection (`schemaVersion` mismatch, missing `metadata.engineVersion`, range violations) leaves the controller in its pre-call state.

Toast messages cover the failure modes: `"Invalid bundle file: <reason>"` for parse failures (bad JSON, missing required field, wrong type), `"Could not read file: <reason>"` for file-system errors, and `"Replay failed: <reason>"` for controller rejections. The same JSON schema produced by the existing Export Prior Sessions button round-trips through this entry point.

The slice adds:
- `src/game/replay/parseSessionBundleFile.ts` — pure structural validator returning a discriminated `{ ok, bundle } | { ok, reason }`.
- `src/ui/replay/replayFileImport.ts` — DOM helper wrapping a hidden `<input type="file">` and the parse → enterReplay flow.
- `HudBridge.replayFromFile?()` — optional callback wired to the new button.

### Validation

- `npm test`: pass with 115 files, 855 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.10 - 2026-05-06

### Phase 3D Slice 3: Prior Sessions Replay button

The `MarkerListPanel` Prior Sessions section now renders a "Replay" button per row alongside Export and Discard. Click reconstructs the session bundle via `IndexedDBMirror.reconstructBundle(sessionId)` and hands it to `replayController.enterReplay(bundle)`. The button is disabled when the row's persisted schema version differs from the running engine (same gate Export uses) OR when the session ended abnormally with zero elapsed ticks (no payloads to replay forward); abnormal sessions with at least one elapsed tick stay enabled because the controller can replay up to the last good tick. The row's three buttons are all disabled during the async load to prevent double-click / interleaved races.

`RecordingService` gains a new public method `loadPriorSessionBundle(sessionId)` that returns the reconstructed `SessionBundle` directly. It throws `SessionNotFoundError` for unknown ids and when the mirror is disabled (`inMemoryOnly: true`) and propagates `SchemaMismatchError` from the underlying mirror. The panel surfaces both error types via toasts (`schema mismatch: stored=X, current=Y` / `replay failed: <reason>`).

The `MarkerListPanel` config gains an optional `onReplayPriorSession?(sessionId): Promise<void>` callback. Pre-Slice-3 callers (e.g., the existing tests that don't wire a controller) leave the button hidden entirely.

### Validation

- `npm test`: pass with 113 files, 828 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.9 - 2026-05-06

### Phase 3D Slice 2: load current live session as replay

A new "Replay" HUD button (next to Save/Load) opens the in-progress live session in replay mode. Click takes the live `RecordingService.bundle()` and hands it to `replayController.enterReplay(bundle)`; the timeline panel auto-mounts and the replay-mode annotation affordances from v0.1.8 take effect (Alt+M silent, marker list reads the bundle, etc.). The button is disabled when the live recorder has no bundle yet, when the bundle has no recorded commands (matching the civ-engine `SessionReplayer.openAt` contract — forward replay needs at least one command), or while replay mode is already active. On error the button surfaces a toast ("No live recording yet" / "Live session has no replay payloads yet" / "Replay failed: <reason>") and stays in live mode.

The slice extracts the HUD HTML template into `src/ui/hud/hudTemplate.ts` so `createHudController.ts` stays under the 500-LOC budget after the new button + dep wiring landed.

### Validation

- `npm test`: pass with 111 files, 811 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.8 - 2026-05-06

### Phase 3D Slice 1: replay-mode annotation affordances

While the replay timeline is open, Alt+M (open annotation form) is silent — annotation creation is gated to live mode because the live recorder is paused under the replay bridge swap. The Alt+L marker list now shows the *replay bundle's* markers in tick-desc order (no more live-recording markers that don't apply to the replayed scene), the Prior Sessions section is hidden, and clicking a row scrubs the timeline to that marker's tick instead of pausing+panning+selecting. The panel flips behavior automatically on enter/exit replay; no extra keystroke is required. Live-mode behavior (current-session markers, Prior Sessions Export/Discard, row-click pause+pan+select) is unchanged.

Severity, tick, and class-attribute interpolation in marker rows are now defensively HTML-escaped/coerced so a malformed bundle field cannot break out of the row markup. This is preventative hardening for the upcoming file-import slice.

### Validation

- `npm test`: pass with 109 files, 797 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.

## 0.1.7 - 2026-05-05

### Phase 3C: replay timeline panel

Replay mode now has a HUD-mounted timeline panel with marker pins, hotspot pins, a draggable scrubber, play/pause, +/-1 step, tick/source readout, exit, and replay keyboard controls. Space toggles playback, ArrowLeft/ArrowRight step, Home/End jump to bounds, Escape exits replay, and Alt+T toggles the panel while replay mode is active.

The timeline reserves bottom viewport space while visible so it does not cover the playfield or bottom HUD. Bundles without command payloads keep forward/play/end controls and unreachable pins disabled instead of throwing from the UI. The host save-load path exits replay before replacing the live bridge, preventing replay exit from restoring stale pre-load state. User-facing replay-load sources and the browser end-to-end scrubber workflow remain later Phase 3 work.

### Validation

- `npm test`: pass with 107 files, 786 passed, 1 skipped.
- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- Visual verification captured desktop, mobile portrait, mobile landscape, and 320px narrow mobile timeline layouts plus a desktop pixel diff; all measured layouts keep the timeline below the playfield and bottom HUD.

## 0.1.6 - 2026-05-05

### Phase 2F: schema-2 save format

New saves now use schema 2 and contain only `seed` plus `worldSnapshot`; the duplicated top-level `sideMaps`, `visibility`, and `matchState` fields are no longer emitted. The world snapshot carries the migrated `world.state.aoe2.*` state directly, including active unit commands, Monk tasks, visibility, match state, and the save-critical pending AI intention queue.

Compatibility: schema-1 saves still load. The legacy loader treats `sideMaps.*` as authoritative over stale duplicate `worldSnapshot.state` slots, then re-saves as schema 2. A save taken between an AI decision tick and the dispatcher drain preserves queued AI Monk intentions through `aoe2.pendingCommands`.

### Validation

- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm test`: pass with 99 files, 743 passed, 1 skipped.

## 0.1.6-rc1 — 2026-05-02

### Phase 2D: bridge-state migration onto `world.state.aoe2.*`

No user-visible behavior change. The simulation bridge moved Tier-1 side-map slots from runtime-only `BridgeState` Maps onto the engine's serializable `world.state.aoe2.*` namespace via `BridgeStateAccessor` + per-slot `SlotCodec` registry. Migrated slots include `villagerOrdinals`, `gathererDropOffStuckSinceTick`, `monkHealCounters`, `playerAges`, `playerCivilizations`, `wonderCountdownOverrides`, `relicCountdownOverrides`, `marketExchangeRates`, `trackedVisibilitySources`, `playerScoreCounters`, `rallyPoints`, `unitCommands`, `wonderCountdowns`, `relicCountdowns`, `townCenterRefs`, `relicsInMonastery`, `sheepMoveOrders`, `conversionState`, `monkCarriedRelic`, `monkTasks`, `trebuchetPackStates`, `lastSeenStatic`, `garrisonedByBuilding`, `garrisonedUnitToBuilding`, `garrisonedUnitVisionSources`, `productionQueues`, `constructionStates`, `combatStates`, `buildingHealthStates`, `buildingCombatStates`, `wildlifeStates`, `aiStates`, `playerResources`, `population`, and `researchedTechnologies`. `inFlightTechByOwner` remains a Tier-2 runtime cache; `BridgeState` now owns bridge-only runtime caches and derived maps rather than Tier-1 codec state.

Behavior callouts: `world.serialize()` snapshot now captures every migrated Tier-1 slot; `World.deserialize` reconstructs them. `tests/replay/snapshotEquivalence.test.ts` round-trips the migrated codecs on a `feudal-age-fixture` and proves active Monk tasks flush to `world.state.aoe2.monkTasks` and active unit commands flush to `world.state.aoe2.unitCommands`. Save format compatibility: legacy `sideMaps.*` fields are still emitted/consumed, with `sideMaps.monkTasks` and `sideMaps.unitCommands` treated as the schema-1 source of truth on load. Hot-loop `markDirty` discipline: per-tick mutations in `playerCommandsSystem`, `towerCombatSystem`, `wildlifeCombatSystem`, `productionQueueSystem`, `villagerEconomySystem`, `monkBehaviorSystem`, and `monkTaskAppliers` mark the relevant codec dirty exactly when they mutate. Multi-CLI review on slot 18–21 caught the HIGH "hydrate must clear codec maps before populating from sideMaps blob" lesson, applied to every slot that participates in load-time invariants.

### Validation

- `npm run typecheck` / `npm run lint` / `npm run build`: pass.
- `npm test`: pass with 99 files, 737 passed, 1 skipped.
- `npm audit --audit-level=high --omit=dev`: 0 vulnerabilities; full high-threshold audit has no high/critical findings and one moderate dev-tree `postcss` advisory.

## 0.1.5 — 2026-04-29

### Added

- **In-game annotation UI (Spec 2 v0.1.5 capture-only).** Press **Alt+M** to open an annotation form: enter a note, pick severity (info/warning/bug/blocker), pick category (pathfinding/combat/economy/ai/ui/perf/general), optionally tick "Capture screenshot" — save fires a marker into the live `SessionRecorder` bundle. Selection at the moment of Alt+M becomes the marker's `MarkerRefs.entities` (with engine `EntityRef.generation` preserved); empty selection falls back to a `tickRange` covering the current tick. Press **Alt+L** to toggle the bottom-right `MarkerListPanel` listing the current session's markers (tick desc) plus a collapsible "Prior Sessions" section for crash recovery — Export downloads a self-contained JSON bundle (sidecar attachments re-embedded as base64 dataUrls), Discard removes the IDB record. Hotkeys are suppressed while a text input has focus.
- **Persistent recording mirror in IndexedDB.** Every session is mirrored into IDB through `RecordingService` over `MemorySink({ allowSidecar: true })` — refresh / crash leaves the partial bundle accessible from the next launch's "Prior Sessions" list. `start()` always begins a fresh session; prior sessions are read-only inspectable but never extended (per ADR 1, mid-session continuation would corrupt bundle invariants). Schema-mismatched sessions are listed but not exportable (forward-compat policy). On Safari private mode / quota exhaustion, the mirror is permanently disabled and the live `MemorySink` continues — `RecordingService.exportBundle()` still works for the current session.
- **Bridge additive surfaces** (`src/game/simulation/createSimulationBridge.ts`):
  - `bridge.world: World` — read-only getter for the engine instance (used by `RecordingService` and the annotation surface).
  - `bridge.setPaused(paused: boolean): void` — manual pause toggle (gated AFTER `flushOutOfBandRenderChange` so render projections continue while paused; the existing `haltState` carrier is unchanged so `getHudState().engineHalted` continues to reflect failure-halt only).
  - `bridge.getSelectedEntityRefs(): readonly EntityRef[]` — selection refs with generation, prune-on-read for stale refs.
  - `bridge.select(refs): void` — public select-from-refs entry; filters stale refs through `getCurrentEntityId`.
- **HUD `loadGame` is async.** `HudBridge.loadGame: (blob: SaveBlob) => Promise<void>` (was `void`) so the load path can await the new `RecordingService.start()` for the rebuilt simulation. The Load button is disabled while the rebuild is in flight; success / failure surface as toasts.

### Engine dependency

- Bumps `civ-engine` from v0.8.10 to **v0.8.11** for the new `AgentDriverContext.addMarker / attach` methods (Spec 9.1) — agents that drive aoe2 via `runAgentPlaytest` can now emit markers in flight from `decide(ctx)`. Default agent sink also flips to `MemorySink({ allowSidecar: true })` so agent screenshots > 64 KiB don't terminate the recorder. `AgentPlaytestResult.source` is exposed so default-sink callers can `result.source.readSidecar(id)` to recover sidecar bytes.

### Validation

- New tests: `tests/recording/IndexedDBMirror.test.ts` (20), `tests/recording/RecordingService.test.ts` (17), `tests/recording/AnnotationController.test.ts` (9), `tests/control/PauseControl.test.ts` (4), `tests/control/HotkeyRegistry.test.ts` (10), `tests/annotations/markerSchema.test.ts` (10), `tests/annotations/selectionToRefs.test.ts` (4), `tests/annotations/captureScreenshot.test.ts` (3), `tests/annotation-ui/AnnotationForm.test.ts` (11), `tests/annotation-ui/MarkerListPanel.test.ts` (13), `tests/simulation/bridge-additive-surfaces.test.ts` (10), `tests/vite-alias-smoke.test.ts` (2). 113 new tests; targeted suites run clean. Multi-CLI code review iter-1 (Codex `gpt-5.5` xhigh + Claude `opus-4-7[1m]` max — Gemini removed from the toolchain mid-iter, see `b93cf2b`) found 3 MAJORs (mirror open-failure handling, IDB metadata finalization, listSessions endTick from row count) + minors; all addressed inline before the implementation review's iter-2 / final review. Final FR-1 review covers the full diff.

### Open follow-ups (deferred from v0.1.5 per scope)

- Replay scrubber + TimelinePanel (deferred to v0.1.6 per ADR 4 — needs aoe2 bridge-snapshot support first).
- ~~Vitest integration suite (AO-12.5)~~ — landed in follow-up: `tests/integration/annotation-ui.integration.test.ts` (6 cross-component scenarios using fake-indexeddb + jsdom).
- Playwright e2e (AO-13) — behavior specs landed in follow-up at `tests/browser/annotation-ui.spec.ts` (3 specs: hotkey flow, cancel discards, hotkey-suppressed-while-text-input-focused). Visual diff baselines are present but `test.fixme`'d pending the user running `npm run test:browser -- --update-snapshots` locally to capture + commit the PNG baselines (must also stabilize tick rendering first since `marker.tick` varies per machine).

## 0.1.4 — 2026-04-26

### Fixed

- **Building HP now ramps from low at placement toward full as construction progresses (canonical AoE2).** Previously a freshly placed foundation spawned at full max HP, then completion was a no-op on the health bar. The foundation now starts at ~10% of max HP and gains `(maxHp − startHp) / totalBuildTicks` per construction tick, finishing at full HP if no damage was taken. Damage taken during construction is preserved as an offset rather than healed at completion: if combat chips a House foundation down to 5/75 at 95% built (where the undamaged ramp would put it at ~71/75), the remaining 5% of construction ticks still add HP additively, so it finishes at ~9/75 (5 plus the ~4 HP earned from those last 6 ticks of construction) — damaged, but not at the formula's full curve. A partially built building you don't defend stays visibly damaged after completion until repaired. Affects every constructable building (House, Mill, Barracks, Castle, Wonder, …); doesn't apply to scenario-seeded `isComplete: true` buildings.
- **Idle-military auto-aggression now pursues enemy foundations (canonical AoE2).** Foundations under construction now have damageable HP, so the auto-aggression target-finder no longer skips incomplete buildings. An idle Knight standing next to an enemy Barracks foundation will engage it instead of ignoring it. (Companion to the HP-ramp fix above; flagged by the multi-CLI review iter-1.)
- **Selection-panel HP display floors fractional foundation HP.** The per-tick HP increment is fractional (e.g. `+0.567` for a House), which would surface as `41.857142857 / 75` in the selection panel. The panel now floors `currentHp` for display while leaving the bridge value raw so the health-bar fill ratio stays smooth.

## 0.1.3 — 2026-04-26

### Fixed

- **Engine tick failures no longer crash the RAF loop.** `civ-engine` has been fail-fast since v0.4.0: any tick failure throws `WorldTickFailureError` from `world.step()`. The bridge previously called `world.step()` raw, so the exception bubbled uncaught into the requestAnimationFrame callback, leaving the page in an undefined state. The bridge now catches `WorldTickFailureError`, logs the failure (`tick`, `phase`, `code`, `systemName`, `message`), halts further ticks for the session, and surfaces a new `HudState.engineHalted: EngineHaltDetails | null` field so the HUD / debug overlay can show that the simulation has stopped instead of silently freezing. We do **not** call `world.recover()` — fail-fast is intentional, and recovery would mask the underlying logic bug. (Closes the deferred gap from the 0.5.3 engine-migration devlog entry.)

## 0.1.2 — 2026-04-26

### Fixed

- **Save no longer disappears when browser storage is unavailable.** Clicking Save while in private browsing, with `localStorage` quota exhausted, or in a security context that blocks storage now falls back to triggering a JSON file download instead of toasting "Save failed (storage unavailable)" and silently dropping the blob. The toast text changed to "Storage unavailable; save downloaded." so the user knows where the save went. (Iter-2 V5-4.)

## 0.1.1 — 2026-04-26

### Fixed

- **Destroyed multi-cell buildings no longer leave permanent fog-memory ghosts.** When a Castle (4×4) or other multi-cell building is destroyed and only a non-anchor cell of its old footprint is in player vision, the memory entry is now correctly cleared. Previously the cleanup pass checked the anchor cell only, so any anchor in fog produced a permanent ghost. (Iter-4 V4-3.)
- **Stuck villagers preserve their drop-off retry throttle across save/load.** The 30-tick throttle (added in iter-3 V3-5 to prevent spam-replanning) is now persisted in the save blob, so a save+load mid-stuck no longer resets every previously-throttled villager to "retry every tick" until they unstuck again. (Iter-4 V4-7.)

### Performance

- **Save-load skips procedural map generation it never uses.** Loading a save no longer runs `createPrototypeScenario` for the seed (the hydration path discards it). Saves several ms per load on Black Forest seeds. (Iter-4 V4-8.)
