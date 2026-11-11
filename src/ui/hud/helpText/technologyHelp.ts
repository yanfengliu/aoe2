// What each technology does, as its tooltip says it (work 148 M2): DE's help text
// (the install's string table, 28xxx) as the source of what to say, in this game's
// own words, every claim checked against this game's rules. One line each.
import type { ResearchableTechnologyType } from '../../../game/simulation/types';

// Where a line names fewer units than DE's text, that is this game's scope
// (bridge/combatStateFactory.ts, prototypeUnitRules.ts): the Blacksmith archer
// techs and Chemistry reach ARCHER_LINE_UNITS (the Archer, Cavalry Archer and
// Longbowman lines; Chemistry the Bombard Cannon too), Thumb Ring the same
// units (projectileTechEffects.ts), and none a Skirmisher, unique archer or
// ship; the Blacksmith cavalry techs reach isCavalryUnit, which leaves out the
// Mameluke; Bloodlines and Husbandry reach MOUNTED_UNITS.
export const GENERAL_TECHNOLOGY_HELP = {
  'feudal-age': 'Your civilization gains new buildings, stronger military units and more technologies.',
  'castle-age': 'Your civilization gains new buildings such as the Castle, stronger units and more technologies.',
  'imperial-age': 'Your civilization gains the Wonder, its strongest units and the final tier of technologies.',
  fletching: 'Archer and Cavalry Archer lines, Longbowmen, Town Centers, Towers and Castles +1 attack and +1 range.',
  // The +1 range reaches the whole siege class, rams and the Petard included,
  // and not the Cannon Galleons (spec §10.7.1).
  'siege-engineers': 'Siege Weapons +1 range. Siege Weapons and Cannon Galleons +20% bonus attack vs. buildings; Petards and Demolition Ships +40%.',
  bloodlines: 'Scout Cavalry, Knight, Camel and Cavalry Archer lines, Missionaries and Conquistadors +20 hit points.',
  // DE effect 321 adds to two building classes, Building and Stone Defense,
  // and only the two towers, Stone Walls and the stone Gate carry the second,
  // no Palisade Gate (buildingAttack.ts, buildingArmor.ts).
  sappers: 'Villagers +15 attack vs. buildings, and another +15 vs. Watch Towers, Bombard Towers, Stone Walls and their Gates.',
  husbandry: 'Scout Cavalry, Knight, Camel and Cavalry Archer lines, Missionaries and Conquistadors move 10% faster.',
  squires: 'Infantry move 10% faster.',
  bracer: 'Archer and Cavalry Archer lines, Longbowmen, Town Centers, Towers and Castles +1 attack and +1 range.',
  // The Forging line reaches villagers too (takesMeleeAttackTechs).
  'blast-furnace': 'Infantry, Villagers and Cavalry except Mamelukes +2 attack.',
  'plate-mail-armor': 'Infantry +1 melee armor and +2 pierce armor.',
  'plate-barding': 'Cavalry except Mamelukes +1 melee armor and +2 pierce armor.',
  forging: 'Infantry, Villagers and Cavalry except Mamelukes +1 attack.',
  'scale-mail-armor': 'Infantry +1 melee armor and +1 pierce armor.',
  'scale-barding-armor': 'Cavalry except Mamelukes +1 melee armor and +1 pierce armor.',
  'padded-archer-armor': 'Archer and Cavalry Archer lines and Longbowmen +1 melee armor and +1 pierce armor.',
  'iron-casting': 'Infantry, Villagers and Cavalry except Mamelukes +1 attack.',
  'chain-mail-armor': 'Infantry +1 melee armor and +1 pierce armor.',
  'chain-barding-armor': 'Cavalry except Mamelukes +1 melee armor and +1 pierce armor.',
  'leather-archer-armor': 'Archer and Cavalry Archer lines and Longbowmen +1 melee armor and +1 pierce armor.',
  'bodkin-arrow': 'Archer and Cavalry Archer lines, Longbowmen, Town Centers, Towers and Castles +1 attack and +1 range.',
  'ring-archer-armor': 'Archer and Cavalry Archer lines and Longbowmen +1 melee armor and +2 pierce armor.',
  // DE's 28047 names its gunpowder units as Required for; here the Hand Cannoneer and
  // the Bombard Cannon wait on it (bridge/trainOptions.ts), and
  // tests/ui/helpTextRequirements.test.ts holds this to it.
  chemistry: 'Archer and Cavalry Archer lines, Longbowmen and Bombard Cannons +1 attack. Required for Hand Cannoneers and Bombard Cannons.',
  'double-bit-axe': 'Villagers chop wood 20% faster.',
  'bow-saw': 'Villagers chop wood 20% faster.',
  'two-man-saw': 'Villagers chop wood 10% faster.',
  'gold-mining': 'Villagers mine gold 15% faster.',
  'gold-shaft-mining': 'Villagers mine gold 15% faster.',
  'stone-mining': 'Villagers mine stone 15% faster.',
  'stone-shaft-mining': 'Villagers mine stone 15% faster.',
  // A Fishing Ship's load runs the same carry calculation (bridge/systems/
  // gatheringStep.ts); the speed is the Villagers' alone (review round 4).
  wheelbarrow: 'Villagers carry 25% more and move 10% faster; Fishing Ships carry 25% more.',
  'hand-cart': 'Villagers carry 50% more and move 10% faster; Fishing Ships carry 50% more.',
  // A Farm standing before the research holds its old food until it reseeds
  // (spec §6.5), so the bonus is stated for new and reseeded Farms.
  'horse-collar': 'New and reseeded Farms hold 75 more food.',
  'heavy-plow': 'New and reseeded Farms hold 125 more food. Farmers +1 carry capacity.',
  'crop-rotation': 'New and reseeded Farms hold 175 more food.',
  loom: 'Villagers +15 hit points, +1 melee armor and +2 pierce armor.',
  'block-printing': 'Monks and Missionaries +3 conversion range.',
  sanctity: 'Monks and Missionaries +15 hit points.',
  faith: 'Your units and buildings take twice as long for enemy Monks to convert.',
  illumination: 'Monks and Missionaries recover their faith 50% faster after converting.',
  theocracy: 'When several Monks convert one target together, only the one that completes it must rest.',
  redemption: 'Monks may convert enemy Siege Weapons and any building except Town Centers, Castles, Wonders, Farms, walls and gates.',
  atonement: 'Monks may convert enemy Monks and Missionaries.',
  fervor: 'Monks and Missionaries move 15% faster.',
  'murder-holes': 'Towers and Castles can shoot enemies standing right next to them.',
  'herbal-medicine': 'Garrisoned units heal four times as fast.',
  heresy: 'Your units die instead of changing sides when enemy Monks convert them.',
  'town-watch': 'Buildings +4 line of sight.',
  'town-patrol': 'Buildings +4 line of sight.',
  conscription: 'Barracks, Archery Ranges, Stables and Castles train units in 25% less time.',
  hoardings: 'Castles +21% hit points.',
  guilds: 'Market trading fee falls from 30% to 15%.',
  coinage: 'Tribute fee falls from 30% to 20%.',
  caravan: 'Trade Carts and Trade Cogs move 50% faster.',
  // Its price, 200 gold per enemy villager, is quoted by the code beside it.
  spies: 'You see the line of sight of every other player for the rest of the game.',
  banking: 'Tribute is sent with no fee.',
  ballistics: 'Your units and buildings aim each shot where a moving target is heading, not where it stands.',
  'thumb-ring': 'Archer and Cavalry Archer lines and Longbowmen fire with 100% accuracy.',
  'parthian-tactics': 'Mounted Archers +1 melee armor and +2 pierce armor; the Cavalry Archer line +4 and Mangudai +2 attack vs. the Spearman line.',
  careening: 'Ships +1 pierce armor. Transport Ships carry 5 more units.',
  'dry-dock': 'Ships move 15% faster. Transport Ships carry 10 more units.',
  shipwright: 'Ships cost 20% less wood and take 35% less time to build.',
  masonry: 'Buildings other than walls, gates, Farms and Fish Traps +10% hit points, +1 melee armor, +1 pierce armor and +3 building armor.',
  architecture: 'Buildings other than walls, gates, Farms and Fish Traps +10% hit points, +1 melee armor, +1 pierce armor and +3 building armor.',
  // Any builder: a Fishing Ship building a Fish Trap too (builderWorkStep.ts).
  'treadmill-crane': 'Villagers and Fishing Ships build 20% faster.',
  'heated-shot': 'Town Centers, Towers and Castles +125% attack vs. ships, the Camel line and Mamelukes.',
} as const satisfies Partial<Record<ResearchableTechnologyType, string>>;

/** The technologies of this file whose DE tooltip says "Upgrade to" rather than "Research". */
export const GENERAL_UPGRADE_VERB: readonly ResearchableTechnologyType[] = [];
