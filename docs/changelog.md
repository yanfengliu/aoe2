# Changelog

This changelog lists user-visible behavior changes only. Pure refactors, doc sweeps, type-safety hardening, and efficiency wins are recorded in `docs/devlog/`.

## 0.3.193

- Buildings, trees, animals and units now cast shadows on the ground. Everything used to sit on the grass with no shadow at all — the only one drawn was a faint slab hidden under each building's own base — so a Town Center or a woodline floated on the map like pieces on a board. Each now throws the shadow its bulk would under the map's sun: toward the bottom of the screen, as long as the thing is tall, a house's from its walls and roof, a tree's from its crown, a villager's a small one at the feet. Where two shadows overlap they do not get darker or break into stripes, including under a crowd packed onto one tile and in a woodline being felled — both of which broke earlier versions of this. A shadow never turns when a unit turns, a dead animal's shadow is the size of the animal lying down, and fogged buildings you only remember cast nothing, as before.

## 0.3.192

- Units now walk smoothly, and deer run. A walking villager used to move for a tenth of a second and then stand still for two or three tenths, over and over — the simulation advances it a quarter tile only every third tick or so, and the screen blended only between one tick and the next, so the picture pulsed. The drawn unit now replays the simulation's own path a few tenths of a second behind, always inside a stretch whose far end is already known, so it advances on every frame at the speed it is actually walking; measured on the boot map, the share of mid-walk frames with the villager standing still fell from 67% to 0%. A unit still starts moving the moment the simulation does — the delay is paid at the end of the walk, where the drawn unit settles a few tenths of a second after the simulation has it stopped. A fleeing deer, which the simulation moves a whole tile every 1.4 seconds, used to stand for thirteen ticks and then jump the tile in one; it is now drawn running across it (during a flight, the deer stood still on 91% of frames before and 0% after). Sheep smooth on their own herd cadence, and so does a charging boar or wolf, which the simulation moves a whole tile every tick. **This holds at every frame rate, not just a fast one**, which is the part worth knowing if the game does not run smoothly on your machine: below about ten frames a second each frame advances the simulation more than one tick, and a unit is still drawn walking through that rather than jumping from tick to tick — measured on a machine drawing 6.7 frames a second, a fleeing deer is drawn standing on 0.0% of the frames of its flight where a naive renderer draws it standing on 98.1% of them and crossing a whole tile in one frame. Teleports still snap: garrisoning, unloading from a transport, a replay scrub, and any move longer than the time it had to happen in.

## 0.3.191

- Villagers no longer walk under an enemy Town Centre, tower or Castle to gather. Automatic gather assignment — the AI's, and the idle-villager auto-gather the human slot gets after a build — used to rank every node of the wanted kind by distance and take the first, whoever's arrows covered it; once an economy grew enough to strip the resources near home, the nearest remaining wood, gold and boar were the enemy's, and its villagers were sent there one after another. On the map the game boots into, over a 75-minute AI-vs-AI match, the side that reaches the Castle Age used to lose fifty villagers, forty-three of them shot inside the other player's Town Centre range; it now loses seven, none of them inside an enemy Town Centre's or tower's range, and reaches every age at exactly the same tick with the same army and the same fourteen kinds of building.
- A node inside an enemy defensive building's reach — its actual range, technologies included, plus one cell — is passed over for a safe one, and a villager whose own kind has nothing safe left takes safe work of another kind before it accepts a dangerous node as the last thing on the map. That now happens at every point the game picks work on its own, including the moment a villager drops off a load and turns round for the next trip, which was the one that kept sending gold miners back to a mine three cells from the enemy Town Centre. The same rule keeps a drop-off out of enemy reach when another exists, keeps the AI's hunting party off a boar beside the enemy Town Centre while another stands clear, and moves a villager off a node a new tower or Castle has just covered.
- A player's explicit gather order on a dangerous node is still obeyed — the player chose it. The drop-off it carries to is still the game's choice, so a villager will walk to a camp outside enemy reach when one exists, which can mean a longer trip home from a node beside a camp an enemy tower has just covered.
- The self-play audit (`npm run ai:selfplay-audit`) now reports each player's villagers lost, and lost under enemy defences, so a loss of this kind shows up as a column instead of needing someone to count deaths by hand.

## 0.3.190

- Every walk to a building now takes the nearest free edge, not just a builder's. Repairing a damaged Castle, running into a Town Centre when the bell rings, carrying wood back to a lumber camp, closing on a building to attack it, a monk walking to a relic — all of them used to head for whatever edge came first in an internal list, which on a large building can be a full lap around it. The nearest-edge rule shipped in 0.3.188 for construction only; it now covers the class. Measured on the boot map in AI-vs-AI: the leading side reaches the Castle Age at tick 26,750 instead of 35,250, and builds 14 kinds of building where it built 9.
- Gathering still uses the old rule deliberately — sending villagers to the nearest cell of a resource is what deadlocked the economy in 0.3.187, and it is left alone until it can be measured on its own.
- The AI no longer puts more than half its villagers on construction at once. The limit was applied to each building separately, so two large buildings could take the whole workforce between them.

## 0.3.189

- The villager build menu now has DE's two pages — **Economic Buildings** and **Military Buildings** — with a toggle at the head of the Build heading. Every building is on exactly one page. Starting a placement shows the page its building is on, and the toggle still works while placing; switching pages never moves the palette or the toggle, and picking a different unit opens its palette on the first page.
- The command card is a grid of square icons. Orders, Stance and Formation were wide labelled boxes and are now compact icon buttons with the meaning in the tooltip, and build cards are icon tiles with the cost in the tooltip rather than printed on the card. Every button keeps a spoken name for screen readers.
- **The command bar no longer hides what it holds.** At an 800x600 window it used to wrap and leave the whole BUILD group below the panel's bottom edge — invisible, with no way to scroll to it — and a unit's last stat rows went the same way. Everything now fits inside the bar at 800x600, 1280x720 and 1920x1080 for a villager (on both build pages), a military unit, a Town Centre, a Blacksmith and a Monastery; nothing ever runs off the side of the bar at any window size; and the few late-game cards still too tall for an 800x600 bar — an Imperial Castle's, a Market's with its tribute rows — can now be scrolled to with the mouse wheel, which was impossible before. The bar is also only as wide as what it holds, instead of stretching most of the way across a wide screen.
- The Bombard Tower has its own icon. It shared the Watch Tower's picture, which did not matter while a card carried its name and does now that the card is an icon.
- A command card's tooltip now leaves with the cursor. Clicking a build card used to leave "Place a House foundation…" sitting over the bar while the mouse was already out on the map picking the tile — and it stayed there through camera keys and through the panel redrawing itself. The card still keeps keyboard focus, and a button reached with Tab still shows its tooltip.

## 0.3.188

- Fixes an AI economy deadlock introduced in 0.3.187. Sending a villager to the NEAREST free edge — the change that stopped builders walking around a House to its far side — was applied to every walk, including walking to a resource and back to a drop-off, and that converged a whole workforce onto one cell: on the boot map all nine of one AI's villagers ended stacked on a single tile, motionless, and its economy stopped completely. The nearest-edge rule now applies only to the walk it was made for, a builder going to a construction site.
- Long games no longer produce a recorded session too large to save. A match's replay grew by about 27 KB every tick with a record of what the player had last seen — re-saved in full each tick even when nothing about it had changed — which put a 22-minute match past the largest file the recorder can write. A 13,000-tick match's recording is 181 MB where it was 537 MB.

## 0.3.187

- Buildings take as long to put up as they do in Age of Empires II. The whole Dark Age had been running at about half the real game's pace — a House went up in 12 seconds against the real 25, a Barracks in 24 against 50, a Town Center in 30 against 150 — because the build-time table was maintained by hand and sixteen of its rows were wrong. Every one now comes from `design/stats/structures.csv`. Three prices were wrong too: a Watch Tower was not charging its 25 wood, a Wonder was charging 1000 food it should not, and the Outpost's 10 stone should have been 5.
- Extra villagers on a building now help the way they do in the real game — a crew of five builds 2.3x as fast as one, not 5x. They used to stack in a straight line, so a building's time simply divided by the number of builders.
- A villager sent to build walks to the nearest free edge of the site. It used to walk to whatever edge came first in an internal list, so a villager standing two tiles west of a House site would walk all the way around to the east edge and take 22 seconds of game time to start a job it should begin in two.
- The AI puts a crew on a big building instead of one villager. It used to assign exactly one builder to everything it built, which meant its Wonder — the win condition — went up at one villager's pace while dozens stood idle.

## 0.3.186

- The idle-villager badge no longer sits on the command bar. With a villager selected the bar is taller than the fixed height the badge was placed above, so the badge's bottom edge covered the bar's SELECTION label at every common window size (800x600, 1280x720 and 1440x900 alike). The badge — and the speaker toggle above it — now stand clear of the bar's top edge and follow it as the bar grows or shrinks, whatever is selected and whatever the window size.


## 0.3.183

- A unit converted by an enemy monk no longer walks into, and jams in, its old side's gate. A route through the gate that the unit had planned before it changed hands was still being followed afterwards, so a converted villager standing beside the gate stepped into a door that no longer opened for it and stood inside the enemy's wall until something else on the map changed. It now re-plans the moment it changes hands: the gate is an enemy gate, there is no route, and it stays put outside.
- A builder just back from a long construction, a unit leaving a garrison, or a soldier that has stood parked no longer jumps a traffic queue on its first step. The crowded-gap rule from 0.3.175, which lets a villager go next once it has genuinely waited a minute and a quarter, was counting any standing still as waiting, so a unit that had stood by choice for longer than that was admitted ahead of villagers that had been trying to move the whole time. Only time spent actually trying to move counts now, and every unit in the gap judges the queue from the same moment, so who goes next no longer depends on which unit happened to ask first.

## 0.3.179

- Choosing a building to place no longer collapses the build palette. With a villager selected, clicking a build card used to squeeze the BUILD group to a sliver at the right edge of the command bar — at a 1280x720 window it went from 261px wide to 36px — because the "Placing: House" status was inserted as its own section of the bar and the palette paid for it. The status is now a pill in the Build heading, so the palette, stance and formation groups stay exactly where they were and the bar does not change height. Command-bar tooltips also float above the bar instead of above the card they describe, and never cover the minimap: hovering a right-hand build card used to put its tooltip over the minimap's frame at every window size, placement mode or not.

## 0.3.178

- Reverts the Lumber Camp siting change from 0.3.177. An independent review ran the match past the point where the previous check stopped, and the change loses the game it used to win: on the map the game boots into, the AI's villagers range out to gather beside the enemy Town Centre once their own woodline thins, and thirty of them are shot from its walls between minutes 60 and 75 — the player that reached the Castle Age sooner ends with a quarter of its workforce and no army, where before it won by conquest at minute 66. Camps go back beside the tree nearest the Town Centre and the Mining Camp is requested after the Lumber Camp again. The underlying flaw the review exposed — villagers will walk into an enemy Town Centre's range to gather — is present in the old behaviour too and is recorded as its own defect.

## 0.3.177

- The AI now builds its Lumber Camp on the woodline its villagers are actually cutting, and requests its Mining Camp before its Lumber Camp in the Dark Age. Camps used to go beside whichever tree was nearest the Town Centre, which was a median fourteen tiles from the trees being felled; they now go on the trees themselves, four and a half tiles out, within twelve of the Town Centre. On the map the game boots into, the AI becomes eligible for the Castle Age seven thousand ticks sooner, reaches it a thousand sooner, and finishes with four more building types and a larger army. Across six maps, two more players reach the Castle Age than before, including three who never did. The build-order change is what makes the placement safe: a camp planted on the woodline could evict the Mining Camp onto the Town Centre's doorstep and freeze every villager, which the reversed order prevents. One map (`seed-2`) becomes a contested match instead of a one-sided one — the previously walled player now reaches the Castle Age and raids the other's economy — so that map's leading player ends with fewer villagers than before.

## 0.3.176

- Villagers carrying a load now pick the drop-off building that is genuinely closest. Distance was measured to a building's corner rather than to the nearest part of it, which for a Town Centre is out by up to three tiles and out by a different amount depending on which side you approach from — so two neighbouring tiles could disagree about which building was nearer. A villager standing on the boundary would walk one way, change its mind, walk back, and pace on the spot holding a full load. On one map that freed five villagers who had been stuck for minutes, and the same player finished with five more buildings.

## 0.3.175

- Villagers no longer stand frozen in a crowded gap. Where a lane is one tile wide — the ground between a Lumber Camp and the trees it serves is the usual place — the queue is resolved in a fixed order, and a villager at the back of it could be passed over indefinitely while its neighbours filed through. On one map five villagers stood motionless for up to four and a half minutes of game time, one of them holding a full load of wood it never delivered. Whoever has genuinely stopped moving now goes next. Across six maps the number of villagers stalling for more than a minute and a half fell from 26 to 7.

## 0.3.174

- Indian Scouts, Light Cavalry and Hussars hit buildings for 2 more damage, the civilization bonus their stats table has always described. In Age of Empires this also covers their Camels and extends to allies; here it is the Scout line and the owning player, which is the same thing in a one-on-one game.

## 0.3.173

- The Portuguese can research Carrack at their Castle: every one of their ships, warship and fishing boat alike, gains a point of melee and a point of pierce armour. The sixth of the twelve expansion civilizations' signature technologies.

## 0.3.172

- The Indians can research Sultans at their Castle: their villagers gather gold 10% faster, and it stacks with the Gold Mining upgrades the way Age of Empires stacks its own gold technologies. The fifth of the twelve expansion civilizations' signature technologies to arrive, and the first of them that changes an economy rather than an army.

## 0.3.171

- Enemy units hidden behind a building are far easier to spot. The cue that shows them was a warm coral, which is close enough to the colour of a roof that it all but disappeared against one — and since the cue exists to tell you whether the shapes behind a wall are yours or someone else's, that was the half that mattered. It is now a saturated magenta, which stands clear of every building colour in the game and cannot be mistaken for the blue used for your own units.

## 0.3.170

- Four more civilizations get their signature technology at the Castle: the Hindustanis' **Shatagni** (Hand Cannoneers +2 range), the Magyars' **Recurve Bow** (Cavalry Archers +1 range and +1 attack), the Malians' **Farimba** (cavalry +5 attack), and the Berbers' **Kasbah** (Castles work 25% faster — in Age of Empires II this helps your whole team, and here it helps the player who researches it). Every civilization from the original game already had its own; these are the first three for the twelve added by the expansions, which had none.

## 0.3.169

- The AI can finally reach the Castle Age. It never did before — on every map we test, both players sat in the Feudal Age for the whole match, so a game against the computer only ever showed you villagers, scouts, militia and spearmen out of a roster of ninety-three units. The cause was that its soldiers and its buildings were bidding for the same wood with nothing deciding between them, and the soldiers always won, so it could never afford the Blacksmith that unlocks the next age. It now sets that wood aside — never at the cost of its last few soldiers — and puts more villagers on wood to pay for it. On the map the game opens with, the AI now gets far enough to unlock the next age, builds nine kinds of building instead of eight and fields five kinds of unit instead of four; on another of our test maps it reaches the Castle Age outright. It gives up no army anywhere to do it.

## 0.3.168

- A Dock counts toward advancing to the Feudal Age, as it does in Age of Empires II. It always should have — a water-map opening of a Dock and a Mill met the requirement everywhere except in this game, where it left you stuck in the Dark Age.
- A single Castle is now enough to advance to the Imperial Age. The rule is "two Castle-Age buildings or one Castle", and only the counting half existed, so a player who had committed to a Castle and nothing else was locked out of the age it unlocks.
- Incas allies build farms 50% faster — the last team bonus that was simply missing rather than waiting on content that does not exist yet.

## 0.3.167

- An idle unit fights back when an animal attacks it. A wolf could maul a villager to death while taking no damage at all, because wildlife are not units and nothing in the retaliation path could see one — the villager simply stood there. A unit that is busy still keeps doing what you told it to; defending yourself without losing your orders is still to come.
- Deer join the game as a third huntable, alongside sheep and boar: 140 food each, and they run from anyone who comes near, so hunting one means committing villagers to the chase. They are not yet placed on generated maps — for now they appear only in scenarios that name them.
- Scouts stop freezing at the far edge of their patrol area. A scout that reached that corner got stuck shuffling between a couple of tiles for the rest of the match, leaving its owner blind. One corner of the patrol box still has a separate problem of its own and is not fixed by this.

## 0.3.166

- The AI builds its Lumber Camps, Mining Camps and Mills next to the resources they serve, the way a player does, instead of next to its Town Center. Its villagers walk less and it reaches the Feudal Age sooner — on one map a player that took nearly 29 minutes now takes 20.

## 0.3.165

- Corrects the give-up rule shipped a moment earlier: it was measured from where a villager currently stands, recomputed every tick, which made it shrink as the villager got closer and abandon ordinary walks even sooner than the rule it replaced. It is a fixed allowance now — thirty-two tiles of walking — so no player's economy stalls on any of the maps we test, and the one map that had slowed down is back to its old pace.

## 0.3.164

- Ships no longer sail through Fish Traps. A Fish Trap is a building standing on water, but the water-passability rule assumed water never holds buildings, so every ship passed straight through one. Ships now route around them, while open water stays as open as it was.

## 0.3.163

- The AI no longer strands itself in the Dark Age. A villager walking to a busy resource gave up after a fixed 80 ticks — a rule written when units moved six times faster, where it meant "forty tiles" and now means "six". Villagers whose food sat further than that abandoned the trip a moment before arriving, over and over, and their player never gathered enough to age up. The give-up point is now measured against the walk itself, so on the map the game opens with, the second player reaches the Feudal Age instead of never leaving the first.

## 0.3.162

- Villagers no longer strand what they are carrying. A villager whose resource runs out and who cannot find another of the same kind used to stand still holding a full load; it now carries that load to the drop-off first, as it should. The AI economies feel this most — on the default map one player now reaches the Feudal Age about six minutes of game time sooner.

## 0.3.161

- A gate you build now opens for you. Every gate raised during a match stayed shut to its own owner — walling your base was a way to lock yourself out of it — because the passability check read "finished" as "has no construction record", which is true of scenario-placed gates and never true of built ones. Units also take the route a finishing gate opens instead of keeping the verdict they reached while it was still a foundation.

## 0.3.160

- Units walk at AoE2's real speeds: the movement clock lands on the villager's 0.8 tiles/second reference, every unit's movement_rate percent on top of it — where everything previously moved at 6.25x and read as teleporting. Honest walking exposed and forced three fixes: the AI no longer walls its own economy in with farm lines (its placement check now floods the whole map), villagers stuck behind an obstacle no longer burn the CPU re-searching hopeless paths every tick, and heavy traffic at a drop-off door no longer collapses the simulation (profiled 12.3 s/tick, now ~2 ms).

## 0.3.159

- The economy now runs at AoE2's real pace: every base gather rate (sheep, berries, boar, farms, fish, wood, gold, stone) lands on the spec §6.3 table that build and research times were already matched to — a Feudal push is once again a plan measured in minutes, not a formality measured in seconds. The AI's villager rebalancer learned not to ping-pong a worker between two resources when the split is already as even as whole villagers allow, which the old hot cadences had been hiding.

## 0.3.158

- The camera now boots at AoE2 DE's default framing: the whole opening base and its resource ring on screen, instead of a Town Center filling half the view with parts of the starting resource ring pushed off-frame.

## 0.3.157

- The Technology Tree viewer arrives: open it from the game menu or F1 to browse your civilization's full tree, building by building — your unique units included, and every hole your civilization has shown dimmed and struck through rather than hidden, exactly as DE presents it.

## 0.3.156

- Press Space after the attack horn sounds and the camera jumps to where your town is being hit; the setup screen now starts on Normal speed like DE.

## 0.3.155

- The DE muscle-memory keys arrive: H selects your Town Center (cycling if you have several), comma cycles idle military the way period cycles idle villagers, F3 pauses, and +/- change game speed mid-match through the 1.0/1.5/2.0 ladder.

## 0.3.154

- Stone walls crest in their civilization's style: pointed caps in middle-eastern towns, tall teeth in central Europe, a layered ridge in east Asia, wide low merlons on the Mediterranean, and a stepped band in mesoamerica. Western walls are untouched, pixel for pixel — and this closes the per-civilization architecture family.

## 0.3.153

- Japanese cavalry archers gain +2 attack against ranged soldiers (skirmishers excepted) — the audit's final combat line.

## 0.3.152

- The per-age combat ladders land: Malian barracks units gain +1/+2/+3 pierce armor through the ages, Teuton barracks and stable units +1/+2 melee armor from the Castle Age, Goth infantry's building damage steps +1/+2/+3, and Berber villagers ramp from +5% to +10% speed at the Feudal Age.

## 0.3.151

- Korean ranged soldiers and infantry cost half wood and their warships a fifth less; Goths research Loom instantly; Vietnamese economic upgrades research twice as fast; Persian Town Centers and Docks work 5-20% faster by age (training and research alike); and Mayan resource nodes last 15% longer under the same harvest.

## 0.3.150

- Frankish castles cost -15/25% in Castle/Imperial (was a flat quarter off), and Briton Town Centers cost half wood from the Castle Age — the construction-price seam is age-aware now, at the charge and on the build card alike.

## 0.3.149

- Spanish builders now work 30% faster and every completed technology pays the Spanish +20 gold; the Inca villager-armor clause starts in the Castle Age, as in DE.

## 0.3.148

- The hit-point ladders match current DE: Viking infantry is a flat +20% from the Feudal Age (was a 10/15/20 ramp), Vietnamese archery-range units +20% at every age, Frankish MOUNTED units (not just knights) +20% from Feudal, the Mongol scout line +20/30% in Castle/Imperial, and Portuguese ships climb +10/15/20% by age. All replace-not-compound on age-up, as before.

## 0.3.147

- Civilization research discounts arrive, priced identically at the charge, the affordability gate, the tooltip, and the AI's own budget: Chinese technologies cost 5/10/15% less by age, Italian dock and university technologies 25% less and age advances 15% less, the Byzantine Imperial Age a third less, Turkish gunpowder technologies half, Spanish blacksmith upgrades cost no gold, and Vietnamese economic upgrades no wood.

## 0.3.146

- Civilization bonuses, round three: Frankish foragers work 15% faster, Slavic monks move 20% faster, the Goth infantry discount becomes DE's full -15/20/25/30% ladder (Dark Age included), and the free-technology lists catch up — Byzantines add Town Patrol, Teutons Herbal Medicine, the Vietnamese Conscription. Combat fixtures that leaned on Byzantines as a "bonus-free" stand-in now use a genuinely neutral pick, since Byzantines rightfully gained free vision.

## 0.3.145

- Civilization bonuses, round two — the signature attack-speed bonuses arrive: Japanese infantry strike 33% faster from the Feudal Age, Ethiopian foot archers 18%, Mongol cavalry archers 25%, Celtic siege 25%, Saracen galleys 25%, Byzantine fire ships 25%, Spanish gunpowder 18%, and Hindustani camels 20%. Britons gain their +1/+2 foot-archer range in Castle/Imperial, and Inca military units cost 15-30% less food by age. Fixed along the way: researching Fletching used to recompute a unit's range from the base table, silently erasing any civilization or team bonus it carried.

## 0.3.144

- Civilization bonuses sourced against current DE, round one — roughly thirty corrections. Highlights: Huns cavalry archers now cost -10/20% (was -25/30%), Teuton farms -40%, Turkish gold miners +25%, Aztecs open with +50 gold and carry +3 (free Loom retired), Chinese Town Centers hold +15 population, Hindustanis lose the fisherman bonus and gain the -8/13/18/23% villagers, Vikings price warships by age, Saracen camels gain +25% HP, and Teuton garrison becomes DE's flat +10 TC / +5 towers. Team bonuses split per civ: Britons +10%, Turks +25%, Celts' siege workshops join, Spanish trade +25%, Byzantine healing +100%, Viking docks -15%, Magyar mounted archers train +25% faster, Korean villager sight is now shared with allies, and Chinese team farms hold +10% food.

## 0.3.143

- Doorways now follow the civilization's architecture: stepped arches with stone jambs in middle-eastern towns, timber frames in central Europe, broad lintels in east Asia, pale stone surrounds on the Mediterranean, and trapezoid doorways in mesoamerica — on Town Centers, houses, mills, military halls, and gates. Western European keeps its classic look, pixel for pixel.

## 0.3.142

- Every seat now has a real civilization: players 3+ default to the classic cast (Byzantines, Chinese, Persians, Saracens, Turks, Vikings) instead of a bonus-less "Player N" with an impossible full tech tree. The LLM playtest harness gained `--civ <name>` to boot the human slot as any civilization.

## 0.3.141

- Shift-queued entity orders, completing AoE2's waypoint chain: Shift+right-click on a resource, enemy, or building while a unit is busy queues the order to run when the current one finishes — gather after gather, kill after kill. A plain order still replaces the whole chain, chains survive saves, and the queue outranks the villager's same-type auto-continue exactly when the clicked resource runs dry.

## 0.3.140

- Tracking and Cartography are retired, as in current DE: allies share sight from the first frame of the match with no research, the Market opens on the tribute technologies, the Barracks hosts no line-of-sight research, and infantry line-of-sight now carries the sourced DE values directly (militia line 4-5, archer line 6-7 — nineteen units corrected against the game data). The Portuguese team bonus becomes current DE's: every technology researches 25% faster for the whole side.

## 0.3.139

- Every tech-tree denial row is now sourced from the real DE game data (SiegeEngineers/aoe2techtree) instead of memory: ~380 corrections across all 30 civilizations — Britons lose Siege Ram and Bombard Tower, Franks lose Thumb Ring and their Halberdier returns, Huns lose Onager and Champion, Vikings regain Fire Ships and lose Hussar, Mongols regain Camels, Goths' full monastery holes land, and every civilization gains its true Parthian-Tactics/eco/monastery/dock gaps. Three roster-judgment exceptions are recorded in the CSV header (Persians keep Paladin standing in for the unmodeled Savar; Incas keep eagles and the militia line standing in for the unmodeled Champi Warrior; Tracking/Cartography stay global).

## 0.3.138

- Per-civilization tech-tree denial: every civilization now has its real AoE2 holes. The Franks have no Bracer or Bloodlines, the Spanish no Crossbowman line, the Turks no Elite Skirmisher or Pikeman line, the Goths no stone walls or Keeps, the mesoamerican three no stables or gunpowder — and only they can train Eagle Warriors. Denied items vanish from the command card, are rejected by the queue, cannot be placed, and the AI respects the same holes. `design/stats/tech-tree.csv` is the new spec-of-record surface (30 civilizations); a content gate keeps the runtime table identical to it. Mesoamerican civilizations start with an Eagle Warrior in place of the Scout, as in DE.

## 0.3.137

- A fourth permanent test locks building hit points and garrison capacities to the stats sheet (already clean — pure insurance).

## 0.3.136

- Base stats squared with the sheet: swordsman HP trimmed to true values, the Elite Longbowman gets its full 8 range, the Siege Ram its 4 attack, Petard and Trade Cog armor un-swapped — and scouts now gain their hidden +2 attack on reaching the Feudal Age, exactly as in AoE2. A third permanent test locks every numeric column to the stats sheet.

## 0.3.135

- The defensive half of the stat sheet: Cataphracts shrug anti-cavalry bonuses, Turtle Ships shrug the galley line, fire ships resist naval bonuses, upgraded rams resist anti-ram — and every ram takes 3 extra from melee swings, so swordsmen are the answer again. Siege Engineers now multiplies siege building damage by 1.2, as written.

## 0.3.134

- Forty-six missing stat-sheet bonuses restored, headlined by naval combat's identity: galleys now tear into ships (+8/+9/+11), fire ships burn hulls and turtle ships, cannon galleons shell shorelines, camels fight boats, and rams hit buildings at full CSV strength — all now locked to the stats sheet by a permanent test.

## 0.3.133

- Chemistry researches at the University, completing the sweep that puts every technology at its AoE2 building — now enforced by a permanent test against the stats sheet.

## 0.3.132

- Sappers corrected to the stats sheet: it now boosts VILLAGERS (+15 vs buildings) and researches at the Castle.

## 0.3.131

- Guard Tower, Keep, and Siege Engineers now research at the University, where AoE2 puts them.

## 0.3.130

- Three more restored stat families: spearmen devastate War Elephants (stacking with their anti-cavalry, as in AoE2), Conquistadors benefit from Bloodlines and Husbandry, and the scout line hunts down Monks with its +6/+10/+12 bonus.

## 0.3.129

- Eagle Warriors now fight like AoE2's: anti-infantry bonuses miss them, the swordsman line's anti-eagle bonuses land, and eagles gained their own anti-cavalry/camel/ship values. Fourteen stat lines that had been silently dropped are live.

## 0.3.128

- Siege Onager now blasts wider than an Onager, reaching diagonal cells — the Imperial upgrade's whole point, which a stale table entry had silently dropped.

## 0.3.127

- Monasteries crown themselves per architecture: a dome in the middle east, a tiered spike in east asia, a stone crest in mesoamerica, a spire in central europe, a lantern dome on the mediterranean.

## 0.3.126

- Shift-stamp foundations: hold Shift while placing and the placement stays armed; your villager finishes each site and walks to the next, exactly as in AoE2.

## 0.3.125

- Shift-click waypoints: hold Shift and right-click to chain movement legs, exactly as in AoE2. A plain click replaces the chain.

## 0.3.124

- The world breathes: a soft wind bed and occasional birdsong under everything, honouring the mute switch.

## 0.3.123

- Units answer when selected: a bright chirp from a villager, a firm note from a soldier, a soft chant from a monk, a wooden knock from siege, a whistle from a ship.

## 0.3.122

- Repairs now charge as they heal, exactly like AoE2: starting is free, you pay for the hit points as they return, stopping early costs only what was mended, and a broke treasury stalls the repair until you can pay.

## 0.3.121

- Villagers work differently per resource: the axe swings overhead at trees, the pick strikes fast at mines, hands reach low at bushes and farms.

## 0.3.120

- Each architecture crowns its Town Center differently: a dome in the middle east, a pagoda finial in east asia, a spire in central europe, a terracotta cap on the mediterranean, a stone crest in mesoamerica.

## 0.3.119

- Units fall when they die: the body topples, drops its weapon, and settles into the ground — replacing the old instant debris puff.

## 0.3.118

- Orders now click softly when accepted — one tick per command, felt more than heard.

## 0.3.117

- Attack-ground: press G and click a cell — your mangonels bombard the spot on their reload, targets or no targets, exactly as in AoE2. The order stands until you say otherwise.

## 0.3.116

- The town bell now sounds: three urgent strikes when you ring it.

## 0.3.115

- The town bell: ring it on the Town Center and every villager runs for the nearest shelter with room; Back to Work sends them out again, leaving garrisoned soldiers in place.

## 0.3.114

- The Delete key: remove your own selected unit or building — one per press, no refund — to free population space or clear a misplaced foundation.

## 0.3.113

- Villagers visibly work: the hammer-swing loop now plays while gathering at trees, mines, and bushes — not only on construction sites. The swing starts exactly when the villager reaches the resource and stops for the hauling walk.

## 0.3.112

- Control groups survive save/load: your digits recall the same groups in a loaded game, as in AoE2 DE.

## 0.3.111

- Roof shapes now follow the architecture set: steep alpine tiers for central Europe, low flat roofs for the middle east, pagoda tiers for east Asia, temple steps for mesoamerica.

## 0.3.110

- More sound: a ding when research completes and a bell when a wonder or relic countdown begins.

## 0.3.109

- First sound: a horn when your town comes under attack, a fanfare when you advance an age, and a victory/defeat sting — all synthesized live (no audio samples), with a speaker toggle above the idle-villager bell that remembers your choice.

## 0.3.108

- Architecture sets now colour the walls too: whitewash for middle-eastern towns, honeyed half-timber infill for central-european, pale grey for east-asian, sun-cream for mediterranean, limestone for mesoamerican. Castles, towers, and timber stay universal.

## 0.3.107

- Villagers repair siege engines and ships: right-click a damaged friendly ram, mangonel, trebuchet, or ship to mend it — half the training cost pro-rata the damage, charged up front, restored at the unit's training rate. Monks heal flesh; villagers mend machines.

## 0.3.106

- Allied gate passage: with teams in play, your gates open for your whole team (AoE2 DE rule). Enemies, wildlife, and unfinished gates stay shut; free-for-all matches are unchanged.

## 0.3.105

- Per-civilization architecture, first pass: every civilization's buildings wear one of six regional roof-material sets (western-european, central-european, middle-eastern, east-asian, mediterranean, mesoamerican). Thatch, tile, and ridge colours re-key per set under the owner-colour blend; fog ghosts remember the set they saw; older saves render unchanged.

## 0.3.104 — 2026-08-25

Control groups have arrived: Ctrl+1 through Ctrl+9 bind your selection, the digit recalls it (survivors only), and a quick double-tap jumps the camera to the group.

## 0.3.103 — 2026-08-25

The idle villager bell is here: a button by the minimap (and the classic `.` key) shows how many villagers are standing around and cycles through them, centring the camera on each.

## 0.3.102 — 2026-08-25

Three input-and-teams fixes found by the browser suite and finished as one slice: an AI unit garrisoning anywhere on the map no longer wipes YOUR selection (and sending part of a selected group into a building keeps the rest selected); a plain right-click on an ally walks to them instead of attacking — Ctrl+right-click is the new deliberate attack order that CAN target an ally; and the Alt+garrison modifier now actually reaches the game from a live mouse click, which it silently never had.

## 0.3.101 — 2026-08-25

Heavy Plow now also does its second job: farmers carry one extra food per trip.

## 0.3.100 — 2026-08-25

Redemption now does everything it does in AoE2: monks with the technology can convert enemy buildings — houses, camps, military buildings, towers — though never Town Centers, Castles, Wonders, farms, or walls, and never a building with defenders sheltering inside.

## 0.3.99 — 2026-08-25

Buildings now visibly rise as villagers work: the construction site starts as a foundation with corner posts, the walls climb with progress, and the scaffold rails appear near completion.

## 0.3.98 — 2026-08-25

Military production buildings now toughen with each age, exactly as in AoE2: a Barracks stands at 1200 hit points in the Dark Age and 2100 by Imperial, with Stables and Archery Ranges on the same climb — buildings already standing included.

## 0.3.97 — 2026-08-25

Wounded buildings now burn: drop under 40% hit points and flames with drifting smoke appear until you repair. And buildings finally have their real AoE2 toughness — houses stand at 900 hit points instead of a prototype-era 75, towers at 1020, military buildings 1200 and up.

## 0.3.96 — 2026-08-25

Watch towers now fire more arrows with a garrison aboard: each sheltered archer or villager adds an arrow up to the classic cap of five. Infantry keep their swords to themselves, and the Bombard Tower still fires its one great cannon.

## 0.3.95 — 2026-08-25

All eight classic maps are now playable — Islands completes the roster. The AI has learned amphibious war: it trains a Transport Ship, loads its army, sails the channel, and lands on your shore. A loaded transport can also no longer teleport its cargo to a distant coast: the ship must actually be at the shore it unloads onto, and a far-off shore click sails it there instead.

## 0.3.94 — 2026-08-25

The Nomad map is here — seven of AoE2's eight famous maps now playable. Every player begins as three villagers in the wilderness: build a lumber camp, bank 275 wood, and raise your Town Center where you choose. The AI does exactly that too.

## 0.3.93 — 2026-08-25

Unique units now train with their class: Berserks, Samurai, Teutonic Knights and the rest benefit from infantry blacksmith upgrades, Squires, and their civilizations' infantry bonuses; Cataphracts, Tarkans and War Elephants take cavalry armor upgrades. Rams no longer wrongly gain melee attack from the Forging line.

## 0.3.92 — 2026-08-25

Allied AI players now send tribute: a rich AI with a Market tops up an ally running dry, paying the fee out of its own stockpile.

## 0.3.91 — 2026-08-25

Monks now convert from nine tiles away, exactly as in AoE2 (healing and relic handling keep their close-up reach), and Block Printing is its real self: an Imperial technology costing 200 gold that stretches conversion to twelve tiles.

## 0.3.90 — 2026-08-25

Inca villagers now benefit from the Blacksmith's infantry armor upgrades — Scale, Chain, and Plate Mail each harden every villager, current and future.

## 0.3.89 — 2026-08-25

The Khmer now play by their own rules: ages and buildings unlock without prerequisite buildings, and their villagers can duck into houses (five per house) when raiders come.

## 0.3.88 — 2026-08-25

The Vietnamese now start every match knowing where their enemies are: each enemy Town Center appears as a fog-memory ghost on explored ground from the first second.

## 0.3.87 — 2026-08-25

Goths now enjoy +10 population limit in the Imperial Age, Korean watch towers outrange everyone by +1 in Castle and +2 in Imperial, and Japanese fishing ships work 5–20% faster as the ages advance.

## 0.3.86 — 2026-08-25

The age-scaled HP bonuses are in: Viking infantry and Vietnamese archery-range units toughen by +10/15/20% as their owner ages up (existing troops included), and Byzantine buildings stand +10% sturdier from the very start, climbing to +40% in Imperial.

## 0.3.85 — 2026-08-25

Ethiopians now receive their +100 food and +100 gold the moment each age advance completes.

## 0.3.84 — 2026-08-25

Ethiopian teams' towers and Outposts now see +3 farther, and Teuton Town Centers gained their +1 attack and +5 line of sight, their towers hold twice the garrison, and their monks heal from twice the distance. Landing the tower line also brought garrisoning up to the real AoE2 rules: infantry, foot archers, and monks can now shelter in Town Centers and towers (and everything but siege, ships, and trade carts in a Castle) — previously only villagers, plus archers in Castles, could garrison at all.

## 0.3.83 — 2026-08-25

Buildings now wear their owner's colour on the roof, not just on flags and trim: every stepped roof blends toward the owner tint (your base keeps its warm thatch look; an enemy base reads as a red-roofed skyline, a third player's as olive, and so on through the palette). Walls stay neutral stone, so the building types remain as recognisable as before.

## 0.3.82 - 2026-08-25

### Added

- **The combat team bonuses.** Frankish-team knights, Mongol-team scouts and Magyar-team foot archers see two tiles farther; Japanese-team galleys half again as far; Korean villagers three. Korean-team mangonels and Khmer-team scorpions outrange their peers by a cell. Saracen-team foot archers and Indian-team camels hit buildings harder, and Persian-team knights cut down archers with +2 attack.

## 0.3.81 - 2026-08-25

### Added

- **Team bonuses.** Your side shares each member civilization's gift, for everything the game can express. Aztec relics pay a third more; Spanish trade routes return +33% gold; Chinese-team farms hold +45 food; Slavic-team military buildings each house five; Britons, Goths and Huns speed their signature production buildings while Turks speed every gunpowder unit and Malians the University; Mayan-team walls cost half and Viking-team Docks a quarter less; Byzantine-team monks heal half again as fast; Teuton-team units shrug off conversion at half rate; and a Portuguese ally gives everyone shared ally sight from the first minute, no Market required.

## 0.3.80 - 2026-08-24

### Added

- **Building bonuses.** Frankish Castles cost a quarter less, Japanese Mills and camps half, Teuton Farms a third less (reseeds too), Inca buildings save stone and Malian buildings wood — at every price you see and every price you pay, including the AI's. Persian Town Centers and Docks stand at double hit points. And the **Huns need no houses**: their population is never housing-limited, exactly as in AoE2.

## 0.3.79 - 2026-08-24

### Added

- **Opening bonuses.** The Chinese start with six villagers and a lean stockpile, the Mayans with four villagers, the Persians richer, the Huns short of wood, and the Incas with a llama beside the Town Center. Aztec villagers carry +5 of everything and Goth hunters +15 boar meat. Chinese Town Centers and Inca houses each shelter ten. Every fixture and test scenario is unaffected — the deltas apply only where a scenario does not pin its own numbers.

## 0.3.78 - 2026-08-24

### Added

- **Free civilization technologies.** Twelve civilizations now receive their "X free" grants the way AoE2 gives them: the technology researches itself at no cost the moment you could legally buy it. Aztec Loom arrives moments into the Dark Age; Viking Wheelbarrow with Feudal; Frankish farm upgrades as soon as a Mill stands; Turkish Chemistry with Imperial — and eight more.

## 0.3.77 - 2026-08-24

### Added

- **Seventeen more civilizations play differently.** Every `civilizations.csv` bonus the game's derived seams can express is now in: Celts infantry march 15% faster and their lumberjacks cut faster; Koreans mine stone faster and Turks gold; Slavs farm faster and Indians fish faster; Turkish gunpowder, Portuguese ships, Chinese demolition ships, Japanese fishing ships and Saracen transports are tougher; Saracen cavalry archers punish buildings; Berbers walk and sail faster with cheaper stables; Ethiopian archers outpace their rivals; and Byzantines, Huns, Mayans, Indians, Magyars, Vikings, Italians and Portuguese all pay their own prices at the recruitment queue. The five original identities are unchanged; the rest of the CSV (free technologies, starting bonuses, age-scaled HP and more) is listed in the spec as the open remainder.

## 0.3.76 - 2026-08-24

### Added

- **Three new maps — Coastal, Fortress, and Gold Rush** — plus Arabia as the standard map's proper name, all on the setup screen. Coastal runs one sea along the southern edge (shore fish, Docks worth building, every start land-connected). Fortress opens every player behind their own stone walls with a Castle already standing and one gate facing the middle. Gold Rush stakes a rich nine-node neutral goldfield in the centre of an open plain: the map is the fight over it. Islands and Nomad wait until the AI can ferry an army and open without a Town Center — a map the AI cannot play is a screenshot, not a map.

## 0.3.75 - 2026-08-24

### Added

- **The population cap is a match option** — the setup screen's row (75 to 250) or `?popcap=25..500`. The cap rides the match settings through saves, so a 100-cap match reloads as one. With it, every setup option §4.6 names is configurable.

## 0.3.74 - 2026-08-24

### Added

- **Starting resources, victory set, and game speed are now match options**, on the setup screen and as URL parameters. Resources: Standard, Medium (500/500/300/400) or High (1000/1000/700/800) for every seat. Victory: the AoE2 Standard set, or **Conquest Only** — the Wonder and Relic clocks never open, and the choice survives a save. Speed: Slow (1.0x), Normal (1.5x) or Fast (2.0x) — the same match, stepped faster; saves and replays are untouched.

## 0.3.73 - 2026-08-24

### Added

- **A match setup screen.** Visit the game with a bare URL and you get a menu, not a running match: map, players (2–8), your civilization (all 30), teams, and AI difficulty, then Start. The choices ride the URL, so a configured match is a shareable link — and any visit that already carries parameters boots straight in, exactly as before.
- **AI difficulty is now selectable** (`?difficulty=easy|standard|hard`, and the setup screen's row): the tiers drive how often every AI thinks — every 6, 3, or 1.5 seconds.

## 0.3.72 - 2026-08-24

### Added

- **The AI trades.** An AI player with a Market now trains Trade Carts (up to two) once anyone else's Market stands, and routes them there on its own — the same recorded command channel your right-click uses. Watch an enemy's carts roll past your walls and you know exactly what their gold curve just did.

### Fixed

- **Trade units now default to the No Attack stance**, as in AoE2. On the old default a weaponless cart could be conscripted by auto-aggression, walk up to an enemy building, and stand there "attacking" for zero damage forever — which is precisely how the first AI cart spent its life instead of trading.

## 0.3.71 - 2026-08-24

### Added

- **The Missionary.** The Spanish second unique unit, trained at the Monastery for 100 gold: a monk on horseback that heals, converts, and rests its faith exactly like a Monk, rides faster than one (and faster still with Husbandry, like any mounted unit), and **cannot carry relics** — right-click a relic and it just rides over. No elite tier, because AoE2 has none. With it, every unit the dataset can express is in the game.

### Fixed

- The Missionary first rendered with a couched lance — the mounted recipe's fallback for a weapon it didn't know. It now holds the monk's staff upright, gold crossbar and all.

## 0.3.70 - 2026-08-24

### Added

- **Spies.** The Castle's Imperial technology for every civilization, and the game's only dynamically priced one: **200 gold per living enemy villager**, counted the moment you click — never free, and never a flat fee. It buys the rest of the map's eyes: you permanently see every other player's line of sight, ally and enemy alike. The tooltip quotes the per-villager rule, so the button never costs more than it says.
- **Atheism**, the Huns' unique technology (500 food, 500 gold): every Wonder and Relic victory countdown in the match — running or future, yours or anyone's — gains **+100 years**, and Spies costs you half. With these two, **all 140 technology rows of the dataset are in the game**; nothing is deferred any more.

## 0.3.69 - 2026-08-24

### Added

- **Naval trade.** The **Trade Cog** trains at the Dock from Feudal Age (100 wood, 50 gold) and runs the sea lane the Trade Cart runs on land: right-click any other player's Dock and it cycles unattended, gold on every return, distance-scaled. Six pierce armour makes it a tougher target than the cart, and Caravan speeds both — 1.32 to 2.0, the exact figure its own stat row names. Carts trade only at Markets and cogs only at Docks.

## 0.3.68 - 2026-08-24

### Added

- **Land trade.** The **Trade Cart** trains at the Market from Feudal Age (100 wood, 50 gold). Right-click any other player's Market — ally or enemy, as in AoE2 — and the cart cycles on its own: out to their Market, back to your nearest one, gold on every return, worth more the farther apart the Markets stand (0.46 gold per tile of distance). The route survives a save mid-leg, ends with the cart or with any other order, and once the goods are loaded they pay out even if the far Market burns down on the way home. The selection panel reads "Trading with Market" while a route runs.
- **Caravan**, the Market's Castle Age technology (200 food, 200 gold): Trade Carts move 50% faster, so the same route pays half again as often. With it, all five of the Market's technologies are in the game.

### Fixed

- The Trade Cart rendered with a trebuchet's throwing arm — its cargo has no weapon branch in the siege recipe, so it fell through to the trebuchet. It now carries what it should: stacked crates under a lashed tarp.

## 0.3.67 - 2026-08-24

### Added

- **Tribute.** Select your Market and send 100 food, wood, gold or stone to any other player — one button per player per resource on the Market's command card, exactly as reachable in an eight-player match as in a 1v1. The sender pays a **30% fee** on top; the recipient receives exactly what was sent. No Market, no tribute — AoE2's own rule, and the buttons only exist while a completed Market is selected.
- **Coinage** (Feudal, 150 food 50 gold) cuts the tribute fee to 20%, and **Banking** (Castle, 200 food 100 gold, needs Coinage) removes it entirely. Both researched at the Market; the tooltips always quote the true current cost.

## 0.3.66 - 2026-08-24

### Added

- **Eight-player skirmishes.** `?players=n` now seats 2 to 8 — spec §4.2's full range, where the ceiling had been 4 — and the map grows with the count instead of crowding: 60x36 for a 1v1, up to 116x72 for eight, holding about 1050 tiles per seat at every rung. Three and four keep the shapes they had (a triangle, the four corners); five and up stand at equal spacing around the map's edge, so eight players are as far apart as four were. An eight-player free-for-all was measured to 12000 ticks with all eight seats alive and four of them in Castle Age.
- Relics scale with the map, staying in the contested middle at every size, and the two-player map's terrain, openings and landmarks are unchanged cell for cell.

### Fixed

- **The forward enemy house is a 1v1 landmark again.** It and its scout were being handed to player 2 in every match, so in a three- or four-player game one opponent started with a free building and a free unit that nobody else got. From three players up, nobody gets it.
- **Clicks, drags and the camera obey the map they are on.** Every clamp that pulls a coordinate back onto the board was written against the two-player map's 60x36 and answered 59 for anything past it. On a bigger map that meant a build preview 31 cells from the pointer, a camera that would not pan to the far corner, a drag-selection box that stopped mid-map, and units and arrows pinned to a right edge that was no longer there. None of it threw; it just quietly disobeyed.

## 0.3.65 - 2026-08-24

### Added

- **Berserks heal themselves.** The Vikings' Berserk and Elite Berserk now regenerate **1 HP every 3 seconds** wherever they stand — no monk, no building, no research — so a Berserk army that wins a fight is worth more the next morning than the one that limped away. Nothing else in the game regenerates.
- **Berserkergang**, the Vikings' Imperial Castle technology, 850 food and 400 gold: it doubles that rate to 2 HP every 3 seconds. It had been listed as deliberately absent since the unique technologies shipped, because the mechanic it multiplies did not exist; the mechanic was the work, and the technology cost two lines after it.

### Fixed

- A health bar now updates while its unit heals. Regeneration is the only change to a unit that happens with no command, no attack and no death behind it, and the renderer rebuilds its picture only when something tells it to — so the first version healed the unit correctly and left the bar sitting at the wounded value until the player clicked something else. Caught by the browser test, not by the simulation tests, which read the numbers rather than the screen.
- §9.2.2 of the spec was missing El Dorado, which has been researchable since 0.3.57, and still claimed sixteen of the nineteen unique technologies were implemented when eighteen are. The table and the code are now checked against each other by a test.

## 0.3.64 - 2026-08-24

### Added

- **Guilds.** The Market's Imperial technology, 300 food and 200 gold: its cut of every buy and sell drops from 30% to 15%, so the same wood fetches more gold and the same gold buys more food. Worth more the more you trade, which is why it costs what it does.

## 0.3.63 - 2026-08-24

### Added

- **Cartography, and the Market's first technology of any kind.** Researched at the Market from the Feudal Age for 100 food and 100 gold, it shows you everything your allies can see — their explored map and whatever is under their units right now, updated as they move. It is one-way, as in Age of Empires II: your allies learn nothing about your map from it. Without allies, or without the technology, nothing changes.

## 0.3.62 - 2026-08-24

### Added

- **Teams.** `?players=3&teams=1,1,2` puts the first two players on a side against the third. An ally is not shot at, not auto-engaged, not marched on and not converted by your monks, and you win when every other SIDE is gone rather than every other player. Leave the parameter off and every player is on their own, exactly as before.

## 0.3.61 - 2026-08-24

### Added

- **Three- and four-player skirmishes.** `?players=3` (or 4) opens a match with that many players on the standard map — each with its own corner, its own civilization and its own colour. Two players remains the default and the two-player map is unchanged cell for cell, so nothing about an existing game moves. Four is the ceiling on this map size: more would start players inside each other's opening, and growing the map is its own piece of work.

## 0.3.60 - 2026-08-24

### Added

- **Player colours for more than two players.** Every tint in the game was a pair — yours and the enemy's — so a third player came out in exactly the same shade as the second, which is worse than having no third player at all. Each owner up to eight now has its own colour, following Age of Empires II's order (blue, red, green, yellow, cyan, purple, grey, orange), on units, buildings and the minimap alike. The first two players look exactly as they did.

## 0.3.59 - 2026-08-24

### Added

- **The Petard.** Demolition infantry, trained at the Castle from the Castle Age for 80 food and 20 gold: 50 hit points, and +500 attack against buildings, which is twice what a Trebuchet does. It walks up to what you point it at and goes off, taking itself with it — the same mechanic the demolition ships got in v0.3.58, which is what made it a day's work rather than a week's. It is the answer to a wall you cannot afford to besiege.

## 0.3.58 - 2026-08-24

### Fixed

- **A Demolition Ship is spent when it detonates.** units.csv describes it in as many words — "Filled with explosives. Self-destructs when used" — and it did not: it blasted, survived, reloaded and blasted again, which made the widest area weapon in the game free to use and a completely different unit from the one its own data describes. It now dies with its explosion, against ships and against buildings alike, and the blast still lands first.

## 0.3.57 - 2026-08-24

### Added

- **Hoardings and El Dorado, at the Castle.** Hoardings (Imperial, 400 food + 400 gold) takes a Castle from 4800 hit points to 5808 — the castles already standing as well as the ones built afterwards. **El Dorado** (Mayans, Imperial, 750 food + 450 gold) gives the Eagle line +40 hit points; it had been recorded as impossible because Eagle Warriors were not in the game, and they arrived in v0.3.48, so the note was simply out of date.

## 0.3.56 - 2026-08-24

### Added

- **Villagers fish the shore, the way they do in Age of Empires II.** Shore fish — the ones in the shallow water against the coast — are gathered by villagers standing on the land beside them, with no Dock and no Fishing Ship; open water stays fishing-ship work. A player could already order this by hand and it worked; what could not happen was the automatic half, so no AI and no un-tasked villager ever took one. Fourteen fish sat untouched beside the shore in the 36000-tick match that froze.
- **The AI hunts boar with a party when there is nothing else left.** A lone villager sent at a boar dies to it, which is why AoE2 sends four to eight. The AI now does the same, and only when the map has genuinely run out of everything else — villagers with something to gather are left alone, so the early economy is untouched.

### Changed

- **AI-versus-AI matches now finish.** Between the two changes above and the nearest-enemy targeting in v0.3.54, a match that used to run 40000 ticks and freeze with two idle economies resolves by conquest instead.

## 0.3.55 - 2026-08-24

### Fixed

- **A stray arrow could end the match.** A shot at a target standing on the map's edge could scatter OFF the map, and the moment the game asked whether that cell was visible the engine refused the coordinate and the match died — a 40000-tick game crashed at tick 24173 on grid (33, -1). Shots are now aimed inside the map, and the drawing pass skips anything outside it instead of asking. Misses still scatter; only the ones that would have left the board changed.

## 0.3.54 - 2026-08-24

### Fixed

- **An AI now attacks its nearest enemy instead of only the human player.** Its target villager and its target Town Center were both looked up on the human player alone, so an AI that occupied the human slot had nobody to attack and no AI ever attacked another AI: two AI players would build up side by side forever and never fight. With two players the nearest enemy IS the human, so an ordinary match is unchanged — but a skirmish with more than one AI is now a war. A 14000-tick AI-versus-AI run goes from two untouched economies to armies trading (one side 19 units down to 5), buildings falling and villagers being run down.

## 0.3.53 - 2026-08-23

### Fixed

- **The Elite Skirmisher upgrade could not be researched, so the Skirmisher line still never improved.** v0.3.53 is the other half of v0.3.45: the unit, its stats, its upgrade entry and its place in the Archery Range's research table all shipped, and no command card ever offered the research — the one thing that made the tier reachable. It is now offered at the Archery Range from the Castle Age, where units.csv puts the unit. The Castle also stopped listing the two unique SHIPS' elite upgrades, which belong to the Dock; they were entries no card could offer.

## 0.3.52 - 2026-08-23

### Fixed

- **The Vikings' Elite Longboat and the Koreans' Elite Turtle Ship could not be researched.** Both buttons rendered at the Dock and both clicks were silently refused, because the Dock's research list did not carry them — the same defect that made the Transport Ship unbuildable, found by widening that fix's own gate to the research side. Two civilizations' naval identity was unreachable: their unique ship existed but never improved. The gate now checks, per BUILDING rather than per game, that every technology a command card offers is one that building accepts.

## 0.3.51 - 2026-08-23

### Added

- **The Dock's three technologies, which finishes its menu.** **Careening** (Castle, 250 food + 150 gold) gives every ship +1 pierce armour — the one armour technology with no melee half — and lets a Transport Ship carry 10 instead of 5. **Dry Dock** (Imperial, 600 food + 400 gold) makes every ship 15% faster and takes the transport to 20. **Shipwright** (Imperial, 200 wood + 1000 food) takes 20% off a ship's wood and 35% off its build time. The three are chained the way Age of Empires II chains them, and a selected Transport Ship now shows its cargo — `3 / 20 aboard` — because otherwise the capacity two of these technologies buy is invisible.

### Fixed

- **The Transport Ship could not be built. At all.** Clicking `Train Transport Ship` at a Dock spent nothing, queued nothing and produced nothing: the command card offered it while the production table the command validator reads did not list it, so every click was silently refused. Since the Transport Ship is the only way a land army crosses water, that removed a whole mechanic from the game — the only transports that ever existed were the ones scenarios spawned. The same defect hid a second button: the Goths' Anarchy is supposed to move the Huskarl into the Barracks, and that button did nothing either. Both are fixed, and a new test enumerates every unit the menu can offer across every building, age, civilization and tech state and fails if the validator would refuse it.

## 0.3.50 - 2026-08-23

### Added

- **A monk that converts somebody now has to rest, and the two technologies about it.** Converting empties a monk's faith; it cannot convert again until the faith comes back over the next 62 seconds, and the selection panel reads **Resting** for it instead of claiming it is still converting. That is the AoE2 rule that stops five monks from walking through an army, and it is what the Monastery's last two technologies act on: **Illumination** (Imperial, 120 gold) brings faith back half again as fast, and **Theocracy** (Imperial, 200 gold) makes a GROUP of monks pay for a conversion once — send five at one unit and only the one that finished it rests. A save written before this loads with every monk rested.

## 0.3.49 - 2026-08-23

### Added

- **Parthian Tactics.** The Archery Range's Imperial technology, and the last one it was missing: 200 food + 250 gold buys the cavalry-archer class +1 melee / +2 pierce armour and a bigger anti-spearman bonus (+4 for the Cavalry Archer line, +2 for the Mangudai line). It armours the mounted archers the Blacksmith's foot-archer line deliberately skips, so a cavalry archer finally has an armour upgrade of its own — and it applies to the riders already on the field, not only to the ones trained afterwards.

## 0.3.48 - 2026-08-23

### Added

- **Eagle Warrior, Elite Eagle Warrior and Hand Cannoneer.** The Eagle line is the Meso-American answer to having no cavalry at all — fast infantry that raids, catches siege, and runs down Monks (+8 against them, +10 Elite) — trained at the Barracks from Castle Age and upgraded at the Barracks in Imperial. The Hand Cannoneer is the Imperial gunpowder answer to massed infantry, at the Archery Range once Chemistry is researched, and the only archer-role unit whose 17 damage goes straight through Skirmisher pierce armour.

### Fixed

- **A headband is no longer drawn as a steel helmet.** Infantry headgear treated everything but a leather cap as metal, so the Jaguar Warrior's headband rendered as a bright steel slab across the crown. It is now cloth and sits low, which is also what let the Eagle line wear its feathered headdress.

## 0.3.47 - 2026-08-23

### Fixed

- **The AI mines stone in Feudal Age, and defends itself with it.** Its villager split allocated zero workers to stone until Castle Age, so through the whole of Feudal it had no stone income at all — the starting 200 was everything it would ever have. It could not replace a Watch Tower it spent that on, could not put down a second Town Center, and arrived in Castle Age with nothing banked toward the 650-stone Castle it wants immediately. On the default map the AI now puts a villager on stone during Feudal and builds the Watch Tower it spots you for.
- **Villagers are no longer pulled off a full load.** When the AI rebalanced its economy it moved whichever villager its entity query happened to list first, discarding that villager's carried resources, gather progress and walk. The waste fell hardest on whichever resource had the smallest share: it now donates the villager with the least work invested, which more than triples the stone a Feudal AI banks while costing about 3% of its food.

## 0.3.46 - 2026-08-23

### Fixed

- **Upgraded units now look upgraded.** Thirteen upgrade lines rendered every tier identically, so researching the upgrade bought nothing you could see on the field. The whole naval roster was one hull with swapped weapons — a Galleon was pixel-for-pixel a Galley — and five Elite unique units (Cataphract, Samurai, Conquistador, Teutonic Knight, Janissary) were their base tier exactly. Warships now grow with their tier and carry more of their armament, the Capped Ram is capped in iron, the Siege Onager rides a braced axle, and every Elite tier wears a gilded plume. Base tiers are unchanged — only the upgrades moved.

## 0.3.45 - 2026-08-23

### Added

- **Capped Ram, Siege Onager and Elite Skirmisher** — three upgrades that finish lines the game already had. The ram line went straight from Battering Ram to Siege Ram, skipping a tier; the mangonel line stopped an upgrade short; and the Skirmisher never improved at all, which made it a Feudal-only answer to archers. The Siege Ram upgrade now needs the Capped Ram first, so it appears at the Siege Workshop only once you have one.

## 0.3.44 - 2026-08-23

### Fixed

- **The computer opponent builds something other than farms.** It was stuck replacing them forever: it wants about one farm per three villagers, farms get eaten, and the moment one ran out it asked for another instead of moving on. In a measured match it reached the Castle Age with 3004 food, 866 stone and 1271 gold banked and had never built a Castle, Stable, Market, Monastery, University or tower. Farms now come first only while it is genuinely short of food.

## 0.3.43 - 2026-08-23

### Added

- **The computer opponent rings the town bell.** When enemies reach its base, its villagers stop working and take cover in the Town Center until the raid passes, then go back to what they were doing. It used to keep gathering while its workers were cut down one by one — in a measured match between two computer players, one side went from 23 villagers to none without ever taking shelter.

## 0.3.42 - 2026-08-23

### Changed

- **Garrisoning means walking there.** A unit told to take shelter now walks to the building and goes in when it arrives, the way it does in Age of Empires II. It used to step inside from anywhere on the map the instant you gave the order, which made garrison a free escape from anything chasing it. A unit already standing against the building still enters immediately.

## 0.3.41 - 2026-08-23

### Changed

- **A Town Center shelters fifteen villagers, not five, and a full one shoots ten arrows.** Those are the numbers in the game's own stat data; the smaller ones meant a base under raid could only take in about a quarter of its workers, and a packed Town Center fought at half strength.

## 0.3.40 - 2026-08-23

### Added

- **The Fish Trap** — and with it, every building in the game's stat data is now in the game. 100 wood from the Dark Age for renewable food out on the water, and the only building a villager cannot put up: a **Fishing Ship** builds it, out where it goes. Once finished it holds 715 food and your ships fish it like any shoal. It does not reseed, so an emptied trap is gone and you build another. A trap blocks ships the way any building blocks movement, so where you put it matters.

### Changed

- **What a unit can build now comes from its own build menu.** Trying to build with something that cannot now tells you what can: "a militia cannot construct buildings; villagers build on land and Fishing Ships build Fish Traps". And when a mixed group is selected, only the units that can actually build the thing are sent to work on it — a villager is never marched at a trap out at sea.

## 0.3.39 - 2026-08-23

### Added

- **The Outpost.** 25 wood and 10 stone from the Dark Age for a small timber lookout that sees a long way and cannot shoot at all — the cheap way to watch a chokepoint, a relic, or the path an attack will come down. Its line of sight grows by 2 with every age you advance, whether it is already standing or you put it up later, and the Town Watch technologies stack on top. It is deliberately unmistakable for a Watch Tower: an open platform on legs with a ladder and a lookout, not a stone shaft.

## 0.3.38 - 2026-08-23

### Changed

- **A forest is now made of trees you can cut through.** Every forest tile on the standard map carries a tree, and felling one leaves open ground behind — so a woodline is consumed from its edge inward until it is gone, the way Age of Empires II works. Before this the map painted stretches of forest that held no wood at all and could never be cleared, so once the trees on a woodline's rim were cut, everything behind them was walled off forever. On the standard map that left 18 of the 27 surviving trees with no tile a villager could stand on.
- **The computer opponent no longer walls itself in.** It had been packing its buildings into a solid block — ten tiles across on the standard map — that shut its own sheep, boar and woodline into a pocket its villagers could not walk into. It now refuses a spot that would cut the ground beside it in two, unless there is nowhere else at all to build. Walls and gates are exempt, since closing ground is what they are for.

### Fixed

- **A villager that cannot reach any of the resource it wants now takes other work** instead of standing still. Six of the computer opponent's villagers had been holding one unreachable sheep for the last thirteen thousand ticks of a match while its stockpile sat unchanged: giving up on the sheep left the villager idle, and the ordinary idle assignment handed the same sheep straight back on the next tick.

## 0.3.37 - 2026-08-20

### Added

- **Transport Ships.** Built at the Dock from the Feudal Age, they carry five land units and are the only way an army crosses water. Right-click a transport with land units to send them aboard; right-click land with the loaded transport to put them ashore — a transport ordered onto a crowded beach lands what fits and keeps the rest. Ships cannot board a transport; they can already swim.

## 0.3.36 - 2026-08-20

### Changed

- **Hills look like high ground instead of bare dirt.** They were painted khaki against green grass — a big jump in colour for terrain the game currently draws at the same height as everything around it, so a hill read as an arbitrary tan blotch with a hard edge rather than as part of the landscape. Hills are now a drier, sun-caught green in the same family, and the ground reads as one continuous field.
- **Open water varies a little more.** Its patch shading was tuned against a lighter blue than the game actually uses, so in practice the sea came out flatter than the grass beside it.

## 0.3.35 - 2026-08-20

### Added

- **Murder Holes**, and the minimum range it removes. A Watch Tower, Bombard Tower, or Castle shoots down from arrow slits and cannot hit a unit standing right against it — so walking infantry up to a tower is now a real tactic rather than a mistake. Murder Holes (University, Castle Age, 200 food and 200 stone) takes that blind spot away for all of your defensive buildings. Town Centers are deliberately exempt with or without it: under a Town Center is exactly where your villagers gather and garrison from, and one that could not defend them would be a trap.

## 0.3.34 - 2026-08-20

### Changed

- **The camera starts closer to the ground.** The game used to open showing the entire map at once — a small diorama in a field of black, with the map's own edges in frame. It now opens on your base at a distance where the world fills the screen, the way an Age of Empires game looks. Zooming out to the old overview still works.

## 0.3.33 - 2026-08-20

### Changed

- **The selection panel is a command bar along the bottom of the screen instead of a column down the middle of it.** It used to stand up to 620 pixels tall over the centre of the map — which on the default map is exactly where your own base is — with the build palette below the fold, reachable only by scrolling inside the panel. Now the world is clear above it: who is selected sits on the left, then stance, formation, and the build palette across to the minimap. Stance and formation each hold four options and now share the same compact 2x2 block. On narrower windows the sections wrap onto a second line and the minimap gives up some size, rather than the palette disappearing behind it.

## 0.3.32 - 2026-08-20

### Added

- **Three Monastery technologies: Atonement, Redemption, and Fervor.** Atonement lets your monks convert enemy monks, Redemption lets them convert siege engines, and Fervor makes monks 15% faster.

### Fixed

- **Monks could convert enemy monks without researching Atonement.** Converting another monk is the specific thing that technology buys; until now any monk could do it from the start. What a monk may convert is now checked properly: an ordinary enemy unit needs nothing, an enemy monk needs Atonement, and a siege engine needs Redemption. A monk ordered at something it cannot take gives up the order instead of standing over it.

### Known limitations

- Redemption's effect on **buildings** is not in yet — only siege engines. Converting a building means handing over its production queue, population, garrison, and vision with it, which is its own piece of work.

## 0.3.31 - 2026-08-20

### Added

- **Gates.** A Palisade Gate (Dark Age, 30 wood) and a Gate (Castle Age, 30 stone) can be built anywhere their own wall can. Your units walk through your gates; everyone else has to break them down. A gate under construction is closed to everyone, including the player building it, and the wall segments beside it stay solid as always. Both stand taller than the wall they interrupt, with pale stone or timber caps, so the way through a long wall line is findable at a glance.

## 0.3.30 - 2026-08-20

### Fixed

- **The AI plays a real economy instead of standing still.** Its villagers had been refused permission to move on every tick by the game's own traffic arbitration: in a one-cell-wide gap between buildings, a group facing each other head-on could elect a unit to go first and then refuse that very unit, and everyone waited indefinitely. Three separate rules each admitted nobody in that situation. On the default map the AI's food at thirty minutes goes from 139 to 1010, and it keeps twenty-one working villagers where it previously had twenty standing still.
- **Units trained in a crowded base are no longer stranded.** A building would place a new unit on a cell whose only neighbour was a dead end — a two-cell pocket closed off by other buildings. Seven of the AI's eleven units ended up in one such pocket, each holding a job it had no way of reaching. A spawn cell must now open onto ground a unit can actually cross.
- **Villagers gather near home.** Auto-assignment would send a villager forty to sixty cells away once the nearby resources were crowded, straight through an opponent's base. It now prefers work near its drop-off, and only ranges further when there is genuinely nothing of that kind left at home.
- **A villager with nothing to gather takes different work.** Previously it would stand idle waiting for a resource that no longer existed anywhere it could reach, while the resource its player actually needed went ungathered.

### Changed

- The simulation runs about twice as fast in long matches. A pathfinding retry for units that cannot reach their target was running every tick for every such unit; it is now spread across ticks.

## 0.3.29 - 2026-08-20

### Fixed

- **The AI's economy no longer dies mid-game.** Its villagers were being assigned to FISH — food, like a berry bush, but out in the water where a villager can never go. They walked to the shoreline and stood there for the rest of the match, and the AI's stockpile stopped moving entirely at around fifteen minutes in. Villagers now only take work they can reach.
- **The AI builds farms.** Berries and sheep run out; without farms its food income fell to zero and it could never afford the next age. It now keeps farms in proportion to its villager count.
- **A villager that cannot reach the resource it was sent to now gives up and takes another.** Previously only a villager queueing behind others would ever re-target.

### Added

- **The AI builds siege and trains its unique unit.** It has been putting up a Siege Workshop and a Castle for a long time and training nothing from either, which meant it could not break a wall, a tower, or a Castle. It now fields rams and mangonels from Castle Age, and whatever unique unit its civilization has.

## 0.3.28 - 2026-08-19

### Added

- **The Bombard Tower.** Research it at the University in Imperial Age and your villagers can build it: 120 damage a shot at range 8, against a Watch Tower's 5. It is the heaviest thing you can put up short of a Castle, and it looks the part — a brass gun muzzle set into the tower face.
- **Fortified Wall** at the University takes your stone walls from 1800 hit points to 3000.
- **Guard Tower and Keep now toughen your towers as well as arming them** — 1020 hit points, then 1500, then 2250. They only ever raised attack and range before.

## 0.3.27 - 2026-08-19

### Added

- **Unique technologies.** Sixteen civilization signature technologies, researched at your Castle and offered only to the civilization they belong to: Aztec **Garland Wars**, Briton **Yeomen**, Byzantine **Logistica**, Celtic **Furor Celtica**, Chinese **Rocketry**, Frankish **Bearded Axe**, Gothic **Anarchy** and **Perfusion**, Japanese **Kataparuto**, Korean **Shinkichon**, Mongol **Drill**, Persian **Mahouts**, Saracen **Zealotry**, Spanish **Supremacy**, Teutonic **Crenellations**, and Turkish **Artillery**.
- They reach what you already have, not just what you build next: research Yeomen and the archers standing in your base get their extra range immediately.
- Your Castle's research list now opens in Castle Age rather than Imperial, because Anarchy is a Castle-Age technology.

## 0.3.26 - 2026-08-19

### Added

- **University defensive technologies.** **Masonry** and **Architecture** each make every one of your buildings 10% tougher — the ones already standing and everything you build afterwards. **Treadmill Crane** makes your villagers build 20% faster. **Heated Shot** more than doubles what your towers and Town Centres do to ships and camels, which is what makes a shoreline tower worth putting up.
- Architecture needs Masonry first, and is Imperial Age.

## 0.3.25 - 2026-08-19

### Added

- **Formations.** Select a group and pick **Line**, **Staggered**, **Box**, or **Flank** in the selection panel. Your units arrive in that shape instead of piling onto the cell you clicked — melee in front, archers behind them, siege and villagers at the back. Staggered spreads the group loose so one mangonel shot cannot catch all of it; Flank parts around what you are walking into.
- Line is the default, so nothing changes until you pick something else.

### Changed

- A group ordered anywhere — move, attack-move, or patrol — now spreads into its formation rather than converging on one cell.

## 0.3.24 - 2026-08-19

### Added

- **Patrol.** Press **P**, then click: your units pace between where they stood and where you clicked, fighting whatever they meet on the way. Unlike attack-move the route stands — a patrolling unit that gets pulled into a fight goes back to its line once the fight is over. Any other order ends the patrol; right-click or Escape cancels before you commit.

## 0.3.23 - 2026-08-19

### Added

- **The elite tier.** Every unique unit now has an Elite version — Elite Jaguar Warrior, Elite Cataphract, Elite Mangudai, Elite War Elephant, and the rest. Research it at Imperial Age and your existing units upgrade in place, the same as any other line. Seventeen are researched at the Castle; the Elite Turtle Ship and Elite Longboat are researched at the Dock, where those ships are built.
- Elites carry their real stats: an Elite War Elephant has 600 HP and 20 attack, an Elite Teutonic Knight has 10 melee armour, and an Elite Janissary hits for 22.

## 0.3.22 - 2026-08-19

### Changed

- **Units hidden behind a building now show in your colour, not white.** The cue was a flat white body, which read as a ghost standing in front of the building and told you nothing about whose unit was back there. Your units silhouette in blue and everyone else's in coral, so a glance at a wall tells you who is behind it.

## 0.3.21 - 2026-08-19

### Changed

- **Units move at their own speeds.** Cavalry is fast, infantry is steady, archers are a little quicker than infantry, and siege crawls — instead of everything on the map travelling at one shared pace. A Hussar now covers nearly twice the ground a villager does in the same time, and a Battering Ram barely half, so raiding, kiting, and escorting siege all play differently.
- Husbandry, Squires, Wheelbarrow, and Hand Cart still give their +10%, but now on top of the unit's own speed rather than replacing it.
- AI scouts patrol at scout speed. They were pacing villagers.

### Fixed

- A patrolling scout hemmed in by buildings or terrain no longer gets stuck against the obstacle: it turns away as soon as it is refused, whether or not it managed a short step first.

## 0.3.20 - 2026-08-19

### Added

- **Unique units for nineteen civilizations.** Your Castle now trains your civilization's signature unit — Jaguar Warrior, Cataphract, Woad Raider, Chu Ko Nu, Throwing Axeman, Huskarl, Tarkan, Samurai, War Wagon, Plumed Archer, Mangudai, War Elephant, Mameluke, Conquistador, Teutonic Knight, Janissary, Berserk, and the Longbowman that was already there. Each has its real stats, its own look, and its own counter-role; you only ever see your own.
- **Naval unique units.** Koreans build the **Turtle Ship** and Vikings the **Longboat** at the Dock from Castle Age. Both are unmistakable on the water: the Turtle Ship is roofed in spiked iron, the Longboat carries a dragon prow and a shield wall.
- **Warships are buildable.** The Galley, Fire Ship, Demolition Ship, and Cannon Galleon lines shipped with the naval roster but never appeared in the Dock's train menu, so there was no way to build one. The Dock now offers each line, gated by age.
- **Dock technologies.** War Galley, Galleon, Fast Fire Ship, Heavy Demolition Ship, Cannon Galleon, and Elite Cannon Galleon are researchable at the Dock. Each upgrades the ships you already have and anything still in the queue.
- The **Samurai** does bonus damage to other civilizations' unique units, as it should.

### Fixed

- Ships in the unit showcase no longer render half-beached on the shoreline.

## 0.3.19 - 2026-08-18

### Added

- **Attack-move.** Press **A**, then click where you want to go: your units walk there and fight whatever they meet on the way, instead of marching past an enemy to reach the spot. It overrides the stance for the duration of the order — even units told to hold fire will fight while executing one. Right-click to cancel before you commit.

## 0.3.18 - 2026-08-18

### Added

- **Unit stances.** Select any of your units and set how they behave when you are not watching: **Aggressive** (chase anything they see), **Defensive** (fight back at arm's length but stay put), **Stand Ground** (hold the spot and shoot what comes in range), or **No Attack** (never start anything). The panel shows which stance is active, so it answers "what is this unit doing" as well as changing it.
- Military units still default to Aggressive and villagers and fishing ships to Defensive, so nothing changes until you say so. Your stance choices are saved with the game.

## 0.3.17 - 2026-08-18

### Added

- **A war fleet.** Nine new ships, all trained at the Dock: the **Galley → War Galley → Galleon** gun line, the **Fire Ship** and **Fast Fire Ship**, the **Demolition Ship** and **Heavy Demolition Ship**, and the **Cannon Galleon** and **Elite Cannon Galleon**. Each class carries visibly different armament on deck — shield racks and a bow stave, a bronze flame siphon, a lashed powder keg, or a gun run out over the rail.
- Warships shoot the way land units do: their shots travel, can miss, and are improved by Ballistics. The demolition ships instead carry the widest blast in the game — 2.5 tiles, or 3.5 for the heavy — and take everything nearby with them, friend included.
- Enemy towers and Town Centers now treat warships as priority targets, and the AI counts them as part of its army.

## 0.3.16 - 2026-08-18

### Added

- **Water is part of the game now.** Ships sail on it, land units cannot enter it, and ships cannot leave it — so a coastline finally means something.
- **The Dock** (Dark Age, 150 wood): the one building that must be placed against water. It trains ships and is where fish come ashore.
- **The Fishing Ship** (75 wood): send it to a fish shoal and it will fish, fill up, carry the catch back to your Dock, unload, and go straight back out — the same way a villager works a berry bush.

## 0.3.15 - 2026-08-18

### Added

- **The University**, a Castle-Age building (200 wood) that researches Ballistics. It trains nothing and counts toward the buildings you need to reach the Imperial Age.
- **Ballistics** (University, Castle Age): your shots aim where an enemy is *going* instead of where it stands — for your units and your towers alike. Against units that keep moving this is the difference between missing and hitting, and it is the answer to the evasion that arrived with projectiles.
- **Thumb Ring** (Archery Range, Castle Age): your Archers, Crossbowmen, Arbalests, Longbowmen and Cavalry Archers stop missing entirely. Cavalry Archers gain the most — they go from 50% accuracy to never missing.

### Changed

- **Tower, Town Center and Castle arrows now fly like every other projectile.** Their volleys travel and land a moment later, so a unit sprinting past a tower can outrun the arrows aimed at where it was — until you research Ballistics.

## 0.3.14 - 2026-08-18

### Changed

- **The interface has been rebuilt with a modern look.** Panels are now translucent dark glass over a background blur, with a single hairline edge and a soft shadow, instead of framed wood planks with carved bevels. At the size the HUD actually renders, that plank grain had turned into a faint plaid; the new surfaces read as clean glass sitting above the world.
- **The resource bar lost its row of boxes.** Food, wood, gold, stone, age, population and time are separated by spacing and type weight rather than seven outlined rectangles, so the bar reads as one surface. Each resource glyph now carries its own colour — green for food, warm brown for wood, amber for gold, cool grey for stone — so the bar can be read at a glance before it is read word by word.
- **One consistent type scale everywhere.** Labels are small, spaced-out and muted; values are large, tight and near-white. The same hierarchy now applies in the top bar, the selection panel's stat cards, and the command deck, which previously each had their own sizes and colours.
- **Buttons, menu items and dialogs share one surface style**, lifting on hover and pressing down on click, with a clear amber focus ring for keyboard users. The game menu, tooltips, and the replay timeline all match the rest of the interface instead of looking like separate applications.
- **The selection panel fades out at its bottom edge** when there is more content below, so a long command list reads as scrollable rather than cut off.
- **Turning down transparency turns off the glass.** If your system asks for reduced transparency, panels render solid with no blur — which is also the cheaper path to draw.

## 0.3.13 - 2026-08-18

### Changed

- **Ranged attacks now fire real projectiles instead of subtracting health instantly.** Archers, skirmishers, cavalry archers, scorpions, mangonels, bombard cannons and trebuchets each loose a shot that winds up, travels, and lands — and you can watch it go. Damage arrives when the projectile arrives, not when the order is given.
- **Shots can miss.** Every ranged unit uses its real accuracy: Cavalry Archers spray at 50%, Archers land 80%, Scorpions never miss, and a Trebuchet is nearly useless against anything that moves. A missed shot scatters to a nearby point rather than silently vanishing.
- **Moving units now evade fire.** A shot flies to where its target stood when it was loosed, so a unit that keeps moving can be out from under it by the time it lands. Standing still to shoot back is now a real decision — and it is exactly the weakness the Ballistics technology exists to fix.
- **Siege stones land where they land.** The mangonel line no longer rolls to hit: its stone always comes down at the aimed point and damages by blast, so a shot that "misses" still catches whatever is standing there — including your own units.
- **Projectiles are visible in flight**, drawn as arrows, bolts, stones, boulders, or cannonballs on an arc scaled to the weapon, pointed along their travel, and only where you can actually see them — a shot fired outside your vision appears as it crosses into it.
- Saving mid-battle keeps shots in the air: a save made while arrows are flying reloads with those same arrows still in flight and landing the same way.

## 0.3.12 - 2026-08-17

### Changed

- **The shoreline is now one connected, curving line.** The broken dashes of 0.3.11 are replaced by a continuous surf curve: each shoreline edge lays six overlapping boxes along a smoothly wandering path, adjoining tiles agree at their shared corners so the line runs unbroken down the coast, inner corners round off where two shores meet inside a tile, and headlands pinch to the land point. The whole curve still laps toward the shore and thins to a hairline as it recedes — but it never breaks apart, because the fade collapses thickness and height while the boxes' lengths hold their overlap, and the lap is pinned at corner joints.
- **The ground has patches now, and so does the water.** Grass drifts between warm yellow-greens and cool deep greens in broad irregular patches; open water drifts between deep and lighter blue. Water near land lightens into a shallow turquoise band that wraps around corners. Colours change only with position — nothing shimmers, and fog-hidden ground stays dark.
- **Terrain kinds stop meeting at a hard line.** Cells at a boundary pull toward their neighbour's colour so grass-to-hill and grass-to-forest transitions read as gradients, and grass at the waterline warms toward a wet sandy edge beneath the surf line.
- **Berry bushes come in three shapes.** Twin-mound, low sprawl, and upright dome forms with three foliage palettes and three-to-five berry clusters of varying position, size, and ripeness — chosen by map position, so every bush keeps its look across saves and replays.

## 0.3.11 - 2026-08-17

### Changed

- **Shorelines now break like water instead of tracing tile edges.** The straight light-blue bar that outlined every water tile touching land is gone. In its place, each shoreline edge carries up to three irregular surf segments — jittered in position, width, distance from the waterline, and angle — and every segment moves: it laps toward the land, swells at the waterline, and dissolves to a sliver before the next lap, with the phase sweeping along the coast so the shore never blinks in unison. Surf freezes with displayed simulation time exactly like wave crests, so saves, replays, and pause behave unchanged.
- **Ground decoration is drawn from a variant library instead of one repeated stamp.** Grass pulls tuft clusters from five distinct shapes with per-blade height, lean, and colour variation; flecks vary in size, angle, and placement; occasional pebble scatters appear on grass and hills; and hill stone comes from four formation shapes (boulder-and-shard, twin boulders, slab cluster, cairn) with hashed position, rotation, and grey-tone. The same cell always decorates identically — nothing shimmers or reshuffles.

## 0.3.10 - 2026-08-17

### Changed

- **The game now draws in a Moebius art style by default: ink contours over flat, vibrant colour.** The world canvas is resolved through an ink-and-flat-colour pass — tone quantised into flat bands, chroma and gain lifted, and contours inked at silhouettes. The previous look ships as **Painted**, and the Settings section of the in-game menu cycles between the two. Switching re-resolves the frame rather than the world: no content is rebuilt and no simulation state is touched.
- **The in-game menu now scrolls instead of running off a short window.** The panel grew by one settings row and crossed the point where, at 390x560, the load form's Cancel button sat below the bottom of the screen — visible to no one and clickable by no one, with Escape the only way out. The panel is capped to the viewport and scrolls past it.
- **The art style is remembered per player and is never part of a save.** Loading someone else's save cannot impose their look, and a match played in one style can be watched back in the other. A stored style that no longer exists falls back to the default rather than failing to start.

## 0.3.9 - 2026-07-20

### Changed

- **Natural resources no longer appear to belong to a faction, and unclaimed wildlife is labeled Neutral.** Trees, berry bushes, gold mines, stone mines, and relics omit the selection-panel faction row; unclaimed boar, wolves, sheep, and fish use the player-facing `Neutral` label, while discovered herdables continue to show their current player or enemy owner. The internal simulation compatibility identifier is unchanged.

## 0.3.8 - 2026-07-20

### Changed

- **The in-match menu now uses dedicated icons instead of visible action labels.** Resume, Save, Load, Replay, Restart, Quit, and Debug overlay each have a distinct original procedural glyph in a compact action grid. Native button names, pointer/keyboard tooltips, focus rings, live debug state, comfortable hit targets, and existing menu behavior remain intact; tooltips now stack above and position outside the modal instead of hiding behind it or covering its title, keyboard focus wraps inside the menu, and closing Load returns focus to its icon.

## 0.3.7 - 2026-07-19

### Changed

- **The HUD command deck and villager build menu are faster to read and operate.** Commands now appear in named groups, while build choices use compact cards with their existing building glyph, visible resource cost, live Ready/Short status, and a clear active-placement highlight. All seven Dark Age choices fit at the normal desktop view; narrow and replay-timeline layouts stay scrollable without colliding with the minimap, resource bar, or timeline. Keyboard focus now receives a strong visible treatment and the same accessibly associated tooltip as pointer hover; mixed pointer/focus ownership prevents premature dismissal, disappearing commands clear stale tooltip state, and resource updates preserve the focused command without rebuilding an unchanged palette. Existing command order, build validation, placement behavior, and simulation authority are unchanged.

## 0.3.6 - 2026-07-19

### Changed

- **All 34 unit types now carry convincing, type-specific equipment.** Infantry lines progress through leather, mail, and plate with swords, greatswords, spears, pikes, or halberds; ranged units carry bows, longbows, crossbows, pavises, or javelins; mounted lines distinguish horses, camels, barding, lances, swords, polearms, and bows; and each siege type has its own working machine silhouette. Matching rigid attack rigs swing, thrust, draw, throw, recoil, or release the weapon that is actually shown, while attached pieces stay joined and feet, mounts, wheels, shadows, and authoritative roots stay planted. The recipes remain deterministic, bounded, memory-safe, and identical between rendered geometry and presented silhouette picking; combat timing, damage, pathing, saves, and replays are unchanged.

## 0.3.5 - 2026-07-19

### Changed

- **Every completed building now carries type-specific architectural or working detail.** Shared role silhouettes remain readable at RTS zoom, while Town Centers gain a ridge and bell, houses shutters, camps stockpiles and tools, military buildings their own racks or yard equipment, monasteries a rose window and buttresses, castles a portcullis, walls material-specific courses or lashings, and farms a scarecrow. The details are deterministic, stay inside each building footprint, and participate in the same presented silhouette picking as the visible geometry; construction scaffolds and gameplay are unchanged.

## 0.3.4 - 2026-07-19

### Changed

- **Terrain has richer material detail, and water now moves and catches the light.** Grass gains pale flecks and tufts, forest ground gains leaf litter and fallen logs, and hills gain strata and stone clusters. Water uses spatially phased wave crests, darker ripples, pale sky-and-sun reflection cues, and foam where it meets land. These procedural details are deterministic, freeze with simulation time, remain hidden under fog, and do not change terrain occupancy or picking. The reflection is a restrained lit-material cue rather than a mirrored second scene.

## 0.3.3 - 2026-07-19

### Changed

- **Forests now mix recognizably different trees.** Trees deterministically vary between broadleaf, tall conifer, and wind-swept forms, with three natural green palettes and smaller per-tree differences inside each family. The arrangement is stable across every frame, save/load, and replay; resource amounts and occupied cells are unchanged, while recipe-driven presented picking remains synchronized with the visible forms.

## 0.3.2 - 2026-07-19

### Fixed

- **Commanded and task-driven units now form a queue through one-cell passages.** Units following move, attack, build, repair, monk, and villager-work travel no longer fan across subcell slots and appear to wrap around the unit in front. The front unit advances while followers keep their terrain route, wait in a centered line through straight passages and bends, and retry on the next tick; a stable tie-break breaks fully occupied opposing-flow deadlocks. Buildings, resources, water, forest, and map bounds remain permanent route blockers that trigger normal path replanning; open terrain still supports multi-unit subcell spacing. Queue order, save/load, and replay remain deterministic.

## 0.3.1 - 2026-07-15

### Changed

- **Melee strikes now reach for what they are hitting.** A swing used to travel a fixed arc regardless of where its target actually was, so an axe or sword often finished its blow in mid-air. The strike now extends toward the captured target in proportion to how far away it is, leaning into the blow and retracting with the follow-through. Archers and siege are untouched.
- **Known limit — they still do not quite touch.** Melee units stand about 1.1 tiles apart while their bodies are only a quarter of a tile wide, leaving roughly three quarters of a tile of open ground between them; an arm and axe simply cannot span that without the torso pulling off the hips. This release closes about a third of the gap (0.366 → 0.246 tiles) without breaking the body. Fully connecting means having melee units walk closer before they strike, which is a change to unit spacing rather than to the animation, and is not attempted here.

## 0.3.0 - 2026-07-15

### Changed (breaking)

- **Right-click no longer garrisons — it moves. Garrison is Alt+right-click.** Right-clicking one of your buildings used to swallow the selected units into it. Now a plain right-click always issues a move to wherever you clicked *on the ground*: click a building's base and your units walk up against it, click its roof and they walk to the cell **behind** it, because the click is resolved through the flat ground plane rather than the building's drawn body. To garrison, hold **Alt** and right-click the building — same eligibility rules as before, and you still pick the exact building by pointing at it. Alt on anything that isn't an owned garrisonable building just does the normal thing for that target.
- Everything else right-click does is unchanged: enemies are attacked, resources gathered, damaged buildings repaired by villagers.
- **Migration — old replays.** Right-click garrison intent is now recorded with the order. Recordings made before this release don't carry it, and are replayed with the OLD rule (a right-click on your building garrisons), so they still play back exactly as they did. Recordings made from this release onward carry the intent explicitly. Saves are unaffected.

## 0.2.12 - 2026-07-15

### Fixed

- **Boars no longer swivel back and forth while fighting.** A boar now keeps facing whatever it last struck instead of rotating back to its default orientation between bites. Introduced in 0.2.8: the facing was tied to the strike animation's fade-out, so the animal turned home as each gore finished and snapped around again on the next hit.

## 0.2.11 - 2026-07-15

### Changed

- **Buildings read as built material, not painted slabs.** Mills, lumber and mining camps, barracks and other military halls, markets, and castles now carry masonry or timber relief courses banded up their walls, with door trim, plank seams, and stall posts where they fit the role — military halls read as coursed plaster, drop-sites as stacked timber, and a castle keep as heavy laid ashlar. Sites still under construction keep their existing scaffold look so build progress stays legible. Footprints, click targeting, health bars, and selection are unchanged.

## 0.2.10 - 2026-07-15

### Changed

- **Forests and mineral deposits stop looking stamped.** Every tree now has its own canopy — block placement, size, lean, and rotation all vary per tree instead of only the trunk height — and every gold and stone mine gets its own rock layout, sizes, and vein placement rather than one arrangement repeated with a slight turn. Variation is a pure function of each resource's map position, so it is identical every frame, across save/load, and in replays; nothing about amounts, gathering, click targeting, or fog memory changes. On the default map this redraws 4.9% of the screen.

## 0.2.9 - 2026-07-15

### Added

- **Builders swing a hammer while they work.** A villager standing at a construction site now raises its hammer overhead and smashes it down on a repeating loop, so building reads as work rather than standing still. Builders on the same site swing out of sync with each other, the swing stops the moment the villager walks or attacks, and it freezes with pause. Build progress, repair rates, saves, and replays are unchanged.

## 0.2.8 - 2026-07-15

### Added

- **Boars fight back visibly, and killed animals stay down as carcasses.** A boar whose retaliation lands now rears and gores toward whoever it hit, driven by the same successful-hit channel as unit attacks — so it obeys the identical fog rules (you only see strikes you could witness), freezes with pause, and replays exactly. A killed huntable now presents as a fallen carcass tipped onto its side for as long as its corpse is gatherable, instead of standing upright as if alive. Gather targeting, amounts, hit detection, saves, and replays are unchanged.

## 0.2.7 - 2026-07-15

### Changed

- **Attacks land like they mean it.** Successful hits now read as forceful strikes rather than gentle taps: the weapon starts the visible window fully coiled, whip-cracks into the target in about 50 ms, and recovers through one bounded follow-through. Every attacking role got a proportional amplitude raise (villagers, infantry, archers, cavalry, cavalry archers, siege). This also fixes a long-standing direction bug the retune exposed — melee weapons and siege arms were swinging *away* from their target, ending behind the attacker; they now drive through the captured target point. Roots still never lunge, and pause/replay/fog behavior is unchanged.

## 0.2.6 - 2026-07-15

### Added

- **Villagers start mining automatically after building a Mining Camp.** Every villager that built the camp now walks to the nearest harvestable gold or stone mine within 7 cells and starts gathering, instead of standing idle. Ties between equidistant mines resolve deterministically, depleted mines are skipped, and no mine in range leaves the builders idle exactly as before. The auto-order is an ordinary recorded gather order, so it saves, loads, and replays like any command you issue — and it never overrides an explicit order, including a chain-build placement clicked in the same moment the camp completes. Applies to AI villagers identically.

## 0.2.5 - 2026-07-15

### Added

- **Units behind buildings show a white silhouette again.** A unit that walks behind a building now renders a solid white mirror of its full posed body — gait and attack pose included — through the building, restoring AoE2-style behind-building readability. The cue tracks exactly what the renderer paints (occluder regions project from the same recipe geometry picking uses), never reveals fog-hidden units, ignores fog-memory ghosts in both directions, freezes under pause, replays identically, and adds no render batches. This returns the v0.1.133 cue that the v0.2.0 voxel-only migration removed, and covers building flanks the old origin-depth predicate missed.

## 0.2.4 - 2026-07-14

### Villagers visibly emerge when ungarrisoned

Ungarrisoned units now prefer each building's authored south/east exit, placing them in front of the voxel building instead of restoring them on its fully occluded back edge. This changes only the first safe perimeter choice for ungarrison; trained-unit spawn ordering and blocked-exit egress search remain unchanged.

A full 20-villager Castle release now uses the fresh-placement occupancy path. When the first cell's 16 distinct sub-tile slots are occupied, later villagers use a deterministic bounded spiral to reach free neighboring slots and write those actual cells and slot assignments into authoritative state instead of permanently sharing roots under other villagers. If no legal slot exists within that search, the unit stays safely garrisoned. Save/load reproduces the same release positions and transforms. No x-ray overlay, fog rule, entity identity, garrison capacity, or save schema changed.

Validation passed 2,022 Vitest tests with two skips across 266 files, 106 serial headless Chromium tests with two skips, typecheck, lint, content validation, and a 529-module production build. Production-only and complete dependency audits both reported zero vulnerabilities.

## 0.2.3 - 2026-07-14

### Units visibly strike when their attacks land

Perspective-eligible successful unit attacks now drive target-facing rigid-part attack motion instead of leaving the attacker in its idle pose. Villagers swing their tools, infantry use swords and shields, archers and mounted archers work their bows, cavalry thrust their weapons, rams drive their beams, and throwing siege articulates its arm. Connected weapon pieces stay joined around shared pivots, feet and wheels remain planted, and the authoritative unit root does not lunge or teleport.

The impact pose appears when damage lands and recovers smoothly into movement without moving the authoritative root. Pausing now freezes the complete voxel actor, including gait, ambient breathing, secondary motion, and attack geometry. Replay rewinds rebase without sending Voxel a backward timestamp, and playback displays the selected checkpoint before consuming elapsed time. Approaching units keep their speed-matched locomotion, and several villagers hitting one boar on the same tick animate independently. Presented roots and the strike fade remain continuous across movement cancellation; a freshly created renderer restores the same attack phase, weight, and ambient suppression while non-authoritative gait smoothing may restart. If packed occupancy and conversion leave opponents on the same presented root, the valid hit still animates using the actor's prior facing, or its authored forward for a fresh renderer, instead of disappearing. Damage, reload timing, pathing, selection, and ordinary saves are unchanged. Authoritative fog state is unchanged; cue eligibility uses visibility proven current for each impact, including after an intervening same-tick LOS mutation, and at least one cell of both the attacker and target footprints must be visible to a perspective before that perspective receives the cue or its coordinates. New recorder checkpoints also preserve per-perspective suppression after a witnessed attacker later leaves view. Tower targeting keeps one pass-start visibility snapshot for every building, then refreshes final visibility once after any kills and before suppression/checkpoint publication, preventing a fresh replay bridge from resurrecting a cue without making later tower fire depend on building order. Presented silhouette-proxy picking remains authoritative and follows the posed geometry. Monks do not gain an attack, and wildlife retaliation, gathering clips, projectiles, and skeletal animation remain future work.

Validation passed 2,018 Vitest tests with two skips across 265 files, 106 serial headless Chromium tests with two skips, typecheck, lint, content validation, and a 528-module production build. Production-only and complete dependency audits both reported zero vulnerabilities.

## 0.2.2 - 2026-07-14

### Villager groups can surround and hunt one boar together

One group selection and one right-click now keeps every selected villager attacking the same living boar with independent approach, attack, and reload state. The boar may retaliate against one hunter at a time, but that retaliation target does not lock out the others.

When hunters crowd around the boar, a friendly villager's presented silhouette no longer steals the right-click from the boar underneath and turn the group attack into a move order. This arbitration is limited to villager context commands: raw voxel silhouette ordering still drives selection, and Monk healing targets retain their existing priority.

## 0.2.1 - 2026-07-13

### Units move and turn continuously at a measured 60 Hz

Units no longer jump from the position captured by an arbitrary prior browser frame. The renderer keeps the exact immediately preceding simulation-tick projection and interpolates from it, so a slow browser frame that advances more than one simulation tick still presents the correct current segment. Sheep and other moving fine-grid resources use the same root interpolation rather than hopping between projected samples.

The whole voxel actor now turns through the shortest arc toward its smoothed travel heading. Feet and other articulated parts retain the existing speed-matched gait, so starts, stops, corners, and reversals blend continuously while the body actually faces its movement direction. Every fine-grid move is published to rendering, and a unit begins at, approaches, and retains the same allocated sub-cell slot, eliminating first-step recentering, hidden half-cell holds, and last-step slot snaps that could make an otherwise interpolated unit jitter or teleport. Save/load and replay preserve that assigned destination even while the visible root is still moving toward it, and preserve an explicitly full-cell overflow instead of reallocating units in entity-id order. If a same-cell slot later opens, the overflowed unit claims it and walks to it at the normal bounded rate instead of staying stacked or snapping on arrival. Blocked autonomous scouts recenter toward their slot by no more than one normal movement step while retaining deterministic obstacle escape, rather than snapping or settling into a two-cell patrol loop. Representative infantry, archer, cavalry, cavalry-archer, monk, villager, ram, and mangonel silhouettes all verify that their authored semantic front follows travel.

Replay playback also bounds a long browser-frame gap to the same 250 ms visible-simulation interval used by live play instead of advancing the entire hidden interval in one callback. Explicit replay scrubs, authoritative teleports, generation changes, and non-adjacent frames still snap deliberately rather than inventing motion across unrelated state.

The always-on HUD metrics path no longer serializes and structured-clones the complete ECS world every simulation tick. AoE's explicit game-specific debug snapshot remains available on demand, while full `WorldDebugger` serialization is removed from the bridge/render path and normal rendering reads only alive-entity count plus existing world metrics. On the named Windows/Chrome 150/RTX 4090 reference at 1280x720 and DPR 1, the live voxel battlefield measured 59.82 FPS over 658 post-warmup frames; browser-frame intervals were p50 16.7 ms, p95 16.8 ms, and p99 16.8 ms, while full main-thread callback work was p50 3.9 ms, p95 8.2 ms, and p99 11.9 ms. This is a reference-scene result, not a guarantee for arbitrary hardware or browser scheduling.

## 0.2.0 - 2026-07-13

### Voxel graphics are now the whole game world

AoE2 now launches directly into its isometric 3-D voxel battlefield. There is no renderer mode, legacy 2-D fallback, or second input/overlay canvas: terrain, fog shading, buildings, resources, animated units, selection rings, placement previews, health cues, hit sparks, and death debris all come from one interactive Three.js voxel canvas. The HUD, minimap, dialogs, and replay timeline remain normal UI.

Camera pan/zoom, middle-drag, edge pan, selection, box selection, context orders, construction placement, save/load, replay, annotation capture, and browser automation were moved onto a standalone AoE view host without changing simulation authority. The drag rectangle itself is now four bright voxel segments, including when no units are inside it. Clicks and context orders resolve against the currently presented rigid-part silhouettes, so moving units, raised roofs, and walls stay interactive; repeated clicks cycle only the distinct visible groups still under that exact point. Interaction pauses during context loss or a pending presentation revision instead of targeting stale pixels. Health bars and hit sparks clear the authored top of voxel parts instead of relying on footprint guesses.

Legacy `?renderer=phaser`, `?renderer=voxel`, and invalid renderer query values cannot change the graphics path. Failure to initialize the voxel renderer is visible and terminal instead of silently switching art and input behavior, and partial startup failures release the canvas, GPU runtime, listeners, controls, HUD, and recording resources they already created.

The obsolete Phaser source tree, painter tests, runtime dependency, and separate 1.48 MB production chunk are removed. The remaining application bundle retains the reusable sibling `voxel` boundary so City and Townscaper can adopt the same game-neutral chunk, geometry, instance, capture, metrics, and lifecycle contracts without inheriting AoE rules or art.

Terrain remains on an elevation-zero isometric plane for now. The current recipe-derived entity hit proxy is AoE-specific; raised terrain/cliffs and a reusable presented-state engine ray query remain future voxel work. Selection outlines and death debris are currently static voxel cues, and the old white unit-through-building x-ray cue is not present; depth-aware x-ray, gameplay-event attack/gather animation, and richer death motion are explicit follow-ups rather than hidden legacy drawing.

## 0.1.150 - 2026-07-12

### Voxel units plant their feet and match their movement speed

Units in the experimental `?renderer=voxel` view no longer use one fixed walk cycle whenever their position changes. Their gait now follows the smoothly interpolated position on screen: more distance in the same time advances more of the step cycle, while slowing or stopping slows or settles the pose. Humanoid boots visibly travel and lift without dipping through the ground, opposing legs and arms stay coordinated, cavalry use longer paired strides, and siege wheels rotate from distance traveled.

Starts, stops, and path corners use short visual blends so limbs do not pop between rest and motion or snap sideways on an axis-aligned turn. Feet flex in the current travel plane. Pausing the simulation or holding position cannot leave feet walking in place, and selection redraws cannot change how a unit resumes; identity, bridge, fog-memory, disappearance, and replay resets cannot inherit stale gait history. Root position, pathfinding, collision, commands, saves, replays, selection, and hit geometry are unchanged.

This refinement remains AoE-owned. The shared voxel package keeps its existing game-neutral rigid-instance and ambient harmonic contracts; no new gait, unit-role, or movement-state schema was added for City or Townscaper to inherit.

## 0.1.149 - 2026-07-12

### Voxel units are alive

Live units in the experimental `?renderer=voxel` view now animate their existing procedural parts. Villagers, infantry, and archers breathe and bob at rest, then swing opposing arms and legs while moving. Cavalry animate horse legs, tails, and riders; monks move sleeves and staffs; siege units turn wheels or work their mechanisms. Stable identity phases keep a crowd from moving in lockstep.

This is renderer-only motion. Buildings, terrain, resources, contact shadows, and fog-memory ghosts remain static, while gameplay state, commands, selection, hit geometry, saves, and replays are unchanged. The first slice does not claim event-synchronized attacks, gathering, projectiles, skeletal clips, or root motion.

The reusable sibling engine owns only the bounded injected-time harmonic transform lane, conservative motion bounds, partial-upload policy, and metrics. AoE2 owns every unit role, part name, idle/movement profile, amplitude, period, and phase relationship.

## 0.1.148 - 2026-07-12

### The voxel battlefield now looks like an actual RTS settlement

The experimental `?renderer=voxel` view no longer represents every unit, building, and resource with one or two generic blocks. The Town Center now has a stone plinth, plaster hall, timber framing, doors, windows, wings, stepped roofs, a tower, and a faction banner. Houses, farms, mills, production halls, markets, monasteries, fortifications, walls, and construction sites have distinct procedural voxel silhouettes. Villagers carry tools; infantry have helmets, shields, and swords; archers have bows and quivers; cavalry have mounts and saddle cloth; siege units have chassis, wheels, and arms; monks have robes and staffs. Trees use clustered crowns, mines use irregular facets and glints, berries and animals are recognisable, and the ground gains restrained grass, rock, log, and water-glint detail.

Natural plaster, stone, timber, thatch, foliage, skin, cloth, leather, and metal now provide the base palette, while player color is reserved for tunics, shields, eaves, banners, awnings, and other readable accents. A reusable warm daylight rig, small procedural contact shadows, antialiasing, and smooth canvas sampling give the rigid voxel shapes depth without changing the simulation, fog, selection, commands, saves, or replays. Phaser remains the default renderer and still owns the aligned overlay/input plane in voxel mode.

The reviewed pair uses the same `aoe2-prototype` seed, tick 0, camera scroll `(-400, 80)`, zoom `1.4`, 800x600 viewport, 800x480 game canvas, and DPR 1. It changes 71,616 of 480,000 perceptually compared pixels (14.92%), concentrated on terrain texture and the new entity silhouettes. The controlled after frame stays bounded at 1,000 rigid instances, four instance batches, eight draw calls, 16,632 triangles, five materials, and one reusable geometry resource.

## 0.1.147 - 2026-07-12

### Try the battlefield as real 3-D voxel graphics

Add `?renderer=voxel` to the game URL to enable an experimental isometric 3-D view. Terrain, units, buildings, and resources are rendered as lit voxel/block geometry by the new shared Three.js renderer, while the existing fog, selection, health, minimap, controls, HUD, saves, and replays continue to work through the AoE2-owned overlay. The simulation is unchanged, and replayed worlds rebuild the voxel scene instead of retaining stale geometry.

The regular Phaser renderer remains the default while the voxel path is completed. This first reversible slice deliberately flattens terrain elevation to keep its world and hit targets aligned with the existing overlay; raised-geometry picking, final art, animation, and performance promotion remain later work. Omit `renderer=voxel` (or use `?renderer=phaser`) for the established view.

## 0.1.146 - 2026-07-11

### The game runs dramatically faster

The map terrain was being fully re-drawn to the GPU every single frame — roughly 24,000 individual tile fills per frame — which dominated render time and made the whole game feel sluggish regardless of how much was happening. The terrain is fixed for a match, so it is now drawn once and reused as a single image. In a headless measurement the per-frame render work dropped from ~199 ms to ~5 ms (about 37× faster); on real hardware this is the difference between a choppy and a smooth frame rate. One minor visual trade-off: because the terrain is now a baked image, it looks slightly softer when you zoom all the way in (units, buildings, and everything else stay crisp; the default view is unchanged).

## 0.1.145 - 2026-07-11

### Clicking a building selects it, even on its roof

Buildings are drawn as raised 3-D volumes, but clicks were tested only against the flat ground tile the building sits on — so clicking the upper walls or roof missed the building and selected the empty ground drawn behind it (often clearing your selection). A click anywhere on a building's drawn shape now selects that building, and when buildings overlap the front-most one (the one drawn on top) is chosen — matching what you see. Clicking a unit still selects the unit. Found by the full-codebase review.

## 0.1.144 - 2026-07-11

### Your units obey a move order near enemies instead of charging in

When you ordered a unit to move while an enemy was within its vision, the unit could ignore your order for a moment and auto-attack the enemy instead — the classic "my unit won't retreat" frustration. An explicit order you give (move, attack, gather, or a right-click command) now always takes precedence over the unit's automatic aggression for that same moment, so a unit you tell to retreat actually retreats. Found by the full-codebase review.

## 0.1.143 - 2026-07-11

### Destroyed buildings no longer haunt your map forever

A building you had scouted and then lost sight of is remembered under the fog of war as a "last seen" ghost. If that building was later destroyed while you couldn't see it, and the game happened to reuse its internal id for a new unit or building, the ghost could stay on your map permanently — it never cleared even when you re-explored the now-empty ground, and it persisted through save/load. Fog memories are now matched to the exact entity that was seen, so a destroyed building's ghost clears correctly once you look again. Found by the full-codebase review.

## 0.1.142 - 2026-07-11

### Replay minimap updates when you switch whose fog you're viewing

While watching a replay, switching the fog-of-war perspective to a different player did not refresh the minimap if the replay was paused — the minimap kept showing the previous player's explored/visible area until you moved the camera or stepped the tick. The minimap now repaints as soon as you change perspective, so it always reflects whose vision you're currently viewing. Found by the full-codebase review.

## 0.1.141 - 2026-07-11

### Building health bars no longer cut through pitched roofs

A completed building with a pitched roof draws a peak ornament on its ridge — a Barracks banner, a Monastery cross, a Town Center turret, a Mill's blades. The floating health bar was placed just above the flat roof line, so on these buildings it sliced straight through the ornament. Health bars now clear the full painted height (ridge peak plus ornament) on pitched-roof buildings, while flat-roof buildings (Castle, Tower, Wall, Wonder, Farm) and buildings still under construction keep the same close margin as before. Found by the full-codebase review.

## 0.1.140 - 2026-07-11

### A simultaneous Wonder victory now goes to you, not the enemy

If your Wonder and an enemy's Wonder both completed their victory countdown on the exact same tick, the game could hand you a defeat purely because the enemy's Wonder was built first. A tie now resolves in your favour, so a Wonder you kept standing for the full countdown is never turned into a loss by the enemy's coincidental timing. (Found by the full-codebase review.)

## 0.1.139 - 2026-07-10

### The minimap's view rectangle now matches what's on screen

The white outline on the minimap that shows your current view was drawn about twice too large and as the wrong shape — it traced a bounding box around the visible area rather than the visible area itself. It now projects the four real corners of your on-screen view, so the outline is the correct size and shape and accurately shows how much of the map you're looking at. Found by the full-codebase review.

## 0.1.138 - 2026-07-10

### Clicking a marker in the list always jumps to the right one

In the annotation marker list, clicking a row jumped the camera to and selected a marker by its position in the list. If a new marker had just been added (markers sort newest-first, so it jumps to the top and pushes the others down), clicking an existing row could briefly select the wrong marker until the list refreshed. Rows are now matched to their own marker by identity, so a click always targets the marker you clicked. Found by the full-codebase review.

## 0.1.137 - 2026-07-10

### Replays from an interrupted session can be watched again

If the game was closed or refreshed mid-match (without quitting cleanly), the recording of that session was marked as zero-length, and the replay browser refused to open it — even though the whole session was safely recorded. Such sessions now report their true length when loaded, so you can watch the replay of a game that ended in a crash or a page refresh, right up to the last recorded moment. Found by the full-codebase review.

## 0.1.136 - 2026-07-10

### Recordings survive a transient storage hiccup

The background recorder writes gameplay to browser storage in batches. If one of those writes failed — a storage-quota error or a transient transaction abort — the whole batch used to be thrown away, silently truncating the recording or leaving a gap that could break replay. Failed batches are now put back in the queue and retried on the next write, so a momentary storage error no longer costs you recorded data. Found by the full-codebase review.

## 0.1.135 - 2026-07-10

### Saving is disabled while you watch a replay

While a replay was playing, the Save button still worked — but it saved the *replay's* historical game state on top of your live save, silently overwriting it. Saving is now blocked during replay: the Save button is greyed out, and if it is triggered anyway you get a "Can't save while watching a replay" message instead of losing your save. Exit the replay to save your live game again. Found by the full-codebase review.

## 0.1.134 - 2026-07-10

### Hunted and killed wildlife no longer reset when you load a save

Wildlife hit points and death were not being written into the save file. If you saved after wounding or killing a boar and then loaded that save, the boar came back at full health — a killed boar could even resurrect as a live, huntable animal. Saving now preserves each animal's current health and its alive/dead state, so a hunt you were partway through (or had finished) survives a save and load. Found by the full-codebase review.

## 0.1.133 - 2026-07-10

### Units behind buildings show a white outline

A unit standing behind a building used to be completely hidden by it. Now a white silhouette of the unit — in its real role shape, edged in its owner colour — is drawn on top of the building so you can see where it is and whose it is, matching the classic Age of Empires behaviour. The cue appears only for units you can already see (in vision) that a building happens to paint over; it tracks them as they move. Purely visual: the simulation, hit-testing, selection, fog of war, saves, and replays are unchanged.

## 0.1.132 - 2026-07-10

### Buildings have pitched roofs — less of a flat box, more of a building

House-like buildings (Town Center, houses, barracks, mill, market, blacksmith, monastery, drop-off buildings) now wear a pitched ridged-hip roof — two sloped planes meeting at a ridge, lit on the left and shadowed on the right — instead of a flat diamond top. This is the main thing that made structures read as abstract boxes. Roof accents (the Town Center cupola, the Monastery cross, a barracks banner, the mill's blades) now sit up on the ridge. Buildings that should read as flat-topped keep their flat roofs: fortress/tower/wall wear their crenellated battlement, the Wonder its dome, and the farm its plot. Purely visual — footprints, hit-testing, health bars, selection, construction states, fog memory, and the simulation are unchanged.

## 0.1.131 - 2026-07-10

### Faster rendering — the terrain no longer redraws every frame

The map terrain (~2160 isometric tiles) was being cleared and redrawn on every single frame even though it never changes, which dominated the per-frame render cost. Terrain is now drawn once and only repainted when it actually changes (game load), while the camera still pans and zooms it smoothly. Measured on the default map, this cut the per-frame render cost about 6× (a forced full re-render dropped from ~3.6ms to ~0.6ms), leaving far more frame budget for smooth play — especially on lower-end machines. Purely a performance change: the map looks identical, and fog-of-war, unit movement, selection, and hit-testing are unaffected.

## 0.1.130 - 2026-07-10

### The minimap is now an isometric diamond

The minimap matches the game's camera angle: the map projects as a rotated 2:1 diamond (the same isometric transform the world view uses) instead of a top-down rectangle. Terrain and fog tile the diamond, entity markers sit at their projected positions, and the camera viewport draws as a diamond-aligned quad. Click- and drag-to-pan still work — a click is projected back to the map cell under it, and clicks that land on the off-map corners of the minimap panel are ignored.

## 0.1.129 - 2026-07-10

### Dying units collapse instead of blinking out

When a unit dies you now see it: a short (~0.7s) tell plays where it stood — the body tips over and wilts to the ground while fading, under a pair of expanding dust rings. Combat no longer reads as silhouettes vanishing between frames. The effect is purely visual and fog-respecting: you see a death only if you WITNESSED it — had vision of the cell at the moment it happened. A kill that occurred in your fog never surfaces, even if you later scout the cell (no off-screen-combat leak), while your own lone unit's death still shows even though losing it re-fogs its cell. A garrisoned unit dying inside a building shows nothing (the building's own destruction is the visible event). It touches no gameplay — saves, replays, hit-testing, and simulation determinism are unchanged (a load drops any in-flight death animations; replays re-play deaths naturally). Under the hood this adds a transient, never-persisted death feed to the render frame (`ProjectedFrameView.recentUnitDeaths`).

## 0.1.128 - 2026-07-10

### AI scouts patrol reliably; pinned-unit detection stops crying wolf

Both AI scouts now actually patrol for the whole match. Previously the base scout wedged against its own Town Center footprint within a few ticks (the wander step reset its sub-cell transform on an impassable next cell but never changed heading), and the forward enemy scout never moved at all (spawned without wander state). Scouts also no longer freeze at wander-box edges: when the next cell is blocked, the scout re-picks its heading by emulating each candidate's stepped path — box reflection included — instead of blindly rotating 90°, which the edge reflection could cancel into a permanent two-state freeze (observed live: a scout frozen 2502 ticks beside its own forward house). A deterministic patrol kick (heading rotation every 400 ticks, staggered per unit, angle cycling) keeps the otherwise-deterministic bounce dynamics from settling into a closed orbit inside a pocket of water/forest/resources — the prove rerun caught the forward scout circling a 5-cell pocket for 2963 ticks with an open exit to the south — and a scout stranded outside its box by a chase now walks home stepwise instead of teleporting to the box edge. Replays and saves stay deterministic.

The `no-pinned-or-oscillating-units` playtest oracle was rebuilt to evaluate per unit-lifetime interval (entity-id reuse no longer conflates a berry bush with the villager that inherited its id — including same-tick kill-and-reuse, which the engine nets into a single component set), skip owners nothing drives (an inert human's idle units are correct, not pinned; drivenness resolves through an explicit per-command actor whitelist), exclude garrison stays from confinement (a garrison round-trip is not a pin), and detect two confinement shapes: PINNED (inside a 3-cell box ≥ 1200 ticks) and OSCILLATING (still moving, but trapped inside a 6-cell box ≥ 1200 ticks — the shuttle livelock the tight box alone cannot see). Confined spans are exempt only while the latest snapshot 'gathering' sample is fresh (a zero-walk gold miner adjacent to both mine and Town Center is optimal, not stuck; a stale sample no longer excuses a later freeze). A frozen `to-resource` villager still fires. Validation: the 16 baseline violations at the canary seed went to 0 on rerun with a strong replay self-check; unit tests pin the exact recorded trap geometry, id reuse (both shapes), the undriven-owner gate, the gathering-suffix exemption, garrison round-trips, wide-box oscillation, and a per-600-tick-block distinct-cell bound over 2000 live ticks.

## 0.1.127 - 2026-07-09

### Oracle canary drill

New `npm run playtest:canary` proves the oracles still see: for each seeded-bug patch in `canaries/` (one-line bugs with a declared expected oracle), it runs an unpatched LLM-free baseline (the oracle must stay quiet - an always-red oracle cannot measure sensitivity), applies the patch on a throwaway branch, reruns, and asserts the oracle fires. Outcomes `canary-ok | canary-blind | canary-stale | canary-invalid | run-failed` append to `output/self-improvement/recursive/passes.jsonl`; any non-ok exits 1 because a blind or stale canary means the loop's senses degraded and fixing that is the candidate. Ships two canaries: `pinned-units` (movement grant zeroed -> `no-pinned-or-oscillating-units`) and `match-never-completes` (score timer never fires -> `match-completes`). The recursive pass also now appends its manifest to `passes.jsonl` (fleet convention), so cross-repo tooling reads aoe2 like every other repo.

## 0.1.126 - 2026-07-08

### The recursive pass runs the full loop by default

`npm run playtest:recursive` with no flags now proposes a fix, applies and gates it on a branch, reruns the playtest, and proves the fix (never auto-merging) — previously this required `--apply`. Pass `--propose-only` to stop after the proposal. On a dirty or off-main worktree the default degrades to proposal-only with a warning; explicit `--apply` hard-fails there instead. Episodic memory is on by default: the pass feeds the newest prior `ledger.json` under `--out-root` to the run (`--known-findings` overrides). The prove rerun spends only the unspent remainder of `--cost-budget` and is refused below a $0.50 viability floor, because an underfunded rerun produces a near-empty bundle that would false-prove any candidate.

## 0.1.125 - 2026-07-07

### Town Center roofs gain flanking post detail

Town Center roof accents now add four short flanking post strokes around the central roof block. The starting Town Center reads less like a flat cap and more like a supported 3/4-view hall at default zoom. This is visual only: footprints, hit testing, health bars, selection, construction state, fog memory, simulation, saves, and replays are unchanged.

## 0.1.124 - 2026-07-07

### Water edges read more like shorelines

Water tiles that border land now draw short, low-alpha inset shoreline strokes over the existing water ripples and terrain feathering. Land/water boundaries read less like hard blue diamond cutouts while staying subtle under fog. This is visual only: terrain kind data, pathing, fog, camera math, saves, and replays are unchanged.

## 0.1.123 - 2026-07-07

### Building roofs have more depth

Tall isometric buildings now draw subtle inset roof highlights plus darker lower eave shadows over the existing roof tile seams. Large structures like the Town Center read less like flat slabs and more like lit 3/4-view buildings. This is visual only: footprints, hit testing, health bars, selection, construction state, fog memory, saves, and replays are unchanged.

## 0.1.122 - 2026-07-07

### Fog edge is softer

Visible cells that border fog now receive a low-alpha isometric shroud pass, softening the hard sawtooth frontier around explored terrain while keeping the map readable. This is visual only: visibility, exploration, fog memory, pathing, selection, saves, and replays are unchanged.

## 0.1.121 - 2026-07-07

### Gold and stone mines look faceted

Gold and stone deposits now keep their existing ground shadow and mound silhouette but add small light/dark facet planes plus edge strokes. Mineral piles read more like structured rock/gold deposits at default zoom, closer to Age of Empires II's resource readability. This is visual only: resource amounts, gathering, hit testing, selection, fog memory, saves, and replays are unchanged.

## 0.1.120 - 2026-07-07

### Minimap markers are easier to read

The minimap now draws terrain first, then dark-backed unit/building/resource markers, then fog and the camera viewport. Player and enemy markers stand out more clearly on the top-down tactical map, closer to Age of Empires II's readable minimap language. The change is visual only: camera click/drag math, world simulation, fog state, saves, and replays are unchanged.

## 0.1.119 - 2026-07-07

### Terrain gets subtle surface detail

Terrain diamonds now draw kind-specific procedural surface marks: grass/forest/hill tiles get faint speckles and water gets short wave strokes. This gives the default map more Age of Empires II-style texture while staying purely visual and deterministic; simulation, pathing, fog, selection, saves, and replays are unchanged.

## 0.1.118 - 2026-07-07

### Foot units get planted limb detail

Villagers, infantry, and archers now draw small planted legs plus visible foot marks below the torso, helping default-zoom foot units read as upright people instead of head-and-body tokens. This is purely visual: movement, hit testing, selection, health bars, simulation state, saves, and replays are unchanged.

## 0.1.117 - 2026-07-07

### Sheep, boar, and wolves get distinct silhouettes

Wildlife no longer shares one generic animal blob. Sheep now have wool clumps and small legs, boar get tusks, and wolves get pointed ears plus a tail, improving default-zoom readability while keeping the change purely visual.

## 0.1.116 - 2026-07-07

### Buildings get masonry bands and roof tile seams

Isometric buildings now get subtle wall-course lines and sparse roof tile seams on tall structures, breaking up the large flat wall and roof planes that dominated the default Town Center view. This is purely visual: footprints, hit testing, health bars, selection, construction, fog memory, and gameplay are unchanged.

## 0.1.115 - 2026-07-05

### Berry bushes look like bushes

Forage berry bushes now render as a small green foliage mound studded with berry dots (over a ground shadow), instead of a flat coloured circle. Purely visual; no gameplay effect.

## 0.1.114 - 2026-07-05

### Lusher trees

Trees now render with a layered, rounded canopy — a shaded base, the main crown, and a sun-lit highlight — plus a subtle per-tree size variation, so forests read as lush woodland instead of a single flat circle repeated. Purely visual; no gameplay effect.

## 0.1.113 - 2026-07-05

### Fix broken isometric rendering in a real match (fog + health bars + giant roof accents)

Three isometric-rendering defects that were only visible in an actual match (the showcase fixtures hid them behind full vision and isolated buildings) are fixed:

- **Fog of war** was still drawn as axis-aligned squares over the diamond terrain, producing a large misaligned black blob across the map. It now masks each cell as an iso diamond, so the shroud lines up with the terrain.
- **Unit health bars** were positioned at the old top-down cell location instead of over the unit; they now sit on the unit.
- **Roof accents ballooned on large buildings** — a Town Center's central tower rose as a ~100px flat column and a Barracks banner as a giant flagpole, because accents scaled with the full roof width. Accent size is now capped, and the Town Center tower is a small 3-D block instead of a flat billboard.

Purely visual; no gameplay effect.

## 0.1.112 - 2026-07-05

### Buildings get windows

Isometric buildings now show a row of dark windows across both visible wall faces (in addition to the doorway added in 0.1.111's predecessor), so a Castle or Town Center reads as an inhabited structure instead of a blank slab. The number of windows scales with the building's size — a wide Castle wall gets more than a narrow House. Flat/low structures (farms, walls) stay plain. Purely visual; no gameplay effect.

## 0.1.111 - 2026-07-05

### Terrain kind boundaries are softened again

Where two different terrain kinds meet (grass↔water, grass↔forest, hill↔water, …) the hard diamond-tile seam is now feathered with a subtle dithered band of blend-coloured specks — the same softening the top-down map had before the isometric switch, rebuilt for the diamond tiles. Purely visual; no gameplay effect.

## 0.1.110 - 2026-07-05

### Building health bars sit above the 3D volume

Health bars over buildings now float just above the top of the isometric building volume, centred on it, instead of appearing buried partway down the taller 3D structure (a leftover from the flat top-down layout). Unit health bars are unchanged. Purely visual.

## 0.1.109 - 2026-07-05

### Buildings get a doorway

Buildings tall enough to have a wall (everything but flat plots like farms and low walls) now show a dark doorway on their front-lit wall face, so they read as real structures with an entrance rather than plain coloured boxes. Purely visual.

## 0.1.108 - 2026-07-05

### Units bob to life (idle sway + walk bounce)

Units now gently sway in place when idle and bounce with a walking gait when moving, instead of standing perfectly still — a small vertical bob of the figure above its ground shadow, offset per unit so a crowd doesn't move in lockstep. Purely visual and deterministic (no effect on simulation, timing, or replays).

## 0.1.107 - 2026-07-05

### Wildlife reads as animals

Sheep, boar, and wolves now draw as a small standing animal — an oval body with a head, over a ground shadow — instead of a flat coloured dot, so they read as creatures on the isometric ground. Fish, berry bushes, relics, and farms are unchanged. Purely visual.

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
