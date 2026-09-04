// Per-civilization PROFILES (spec §11.4, §11.14): `design/stats/civilizations.csv`
// owns every civilization's expansion label, army archetype, unique unit and
// technology names, team bonus, and civilization-bonus lines — and §11.4 says
// the prose spec must never restate them, because two copies drift. The
// in-game Civilizations compendium needs that text at RUNTIME, and the browser
// build cannot read design/stats, so the CSV is embedded verbatim below and
// parsed once at module load — the same shape `civTechTree.ts` uses for the
// denial table.
//
// `tests/content/civProfiles.test.ts` is the gate on both halves: the embedded
// copy must be byte-identical to the CSV (so the two can never drift), and the
// profiles this module parses must deep-equal what the content pipeline's own
// independent parser (`scripts/content-lib.mjs`) reads out of the same file —
// so a divergence between the two readings fails by name rather than showing a
// player one thing while the build believes another.
//
// The parser mirrors content-lib's `parseCsv`/`splitList` exactly, quirks
// included: a quoted segment may sit INSIDE an otherwise unquoted cell (the
// Indians' villager-cost line does), cells are trimmed, and multi-value cells
// are semicolon-separated.

/** The CSV, verbatim. Generated from design/stats/civilizations.csv — the test
 *  asserts this copy and the file are identical, so edit the CSV, not this. */
export const EMBEDDED_CIVILIZATIONS_CSV = `name, expansion, army_type, unique_unit, unique_tech, team_bonus, civilization_bonus
Aztecs, The Conquerors, Infantry and Monk, Jaguar Warrior, Garland Wars, Relics generate +33% gold, Start with +50 gold;Villagers carry +3;Military units created 15% faster;+5 Monk hit points for each Monastery technology
Britons, Age of Kings, Foot Archer, Longbowman, Yeomen, Archery Ranges work 20% faster, Town Centers cost -50% wood upon reaching the Castle Age;Foot archers (excluding Skirmishers) have +1 range in Castle Age and +1 in Imperial Age (for +2 total);Shepherds work 25% faster
Byzantines, Age of Kings, Defensive, Cataphract, Logistica, Monks heal +100% faster, Buildings (except gates) have +10% HP in Dark Age / +20% HP in Feudal Age  / +30% in Castle Age / +40% in Imperial Age;Spearman skirmisher and camel lines cost 25% less;Fire Ships attack 25% faster;Imperial Age costs -33%;Town Watch and Town Patrol free
Celts, Age of Kings, Infantry, Woad Raider, Furor Celtica, Siege Workshops work 20% faster, Infantry moves 15% faster;Lumberjacks work 15% faster;Siege weapons reload 20% faster;Sheep cannot be stolen if within one Celt unit's line of sight
Chinese, Age of Kings, Archer, Chu Ko Nu, Rocketry, Farms provide +10% food, Start game with 3 extra villagers but -50 wood and -200 food;Technologies cost -5% in Feudal Age/ -10% in Castle Age/-15% in Imperial Age;Town Centers +7 line of sight and provide +15 population space
Franks, Age of Kings, Cavalry, Throwing Axeman, Bearded Axe, Knights have +2 line of sight,Castles are 25% cheaper;Mounted units +20% HP starting in Feudal Age;Farm upgrades are free (Mill is required to receive bonus);Foragers work 15% faster
Goths, Age of Kings, Infantry, Huskarl, Anarchy;Perfusion,Barracks operate 20% faster,Infantry cost 35% less (starting in Feudal Age);Infantry have +1 attack against buildings;Villagers have +5 attack versus wild boar;Hunters carry +15 meat;+10 to population limit in Imperial Age;Loom is researched instantly;Infantry +1/+2/+3 attack vs buildings by age
Huns, The Conquerors, Cavalry, Tarkan, Atheism, Stables are 20% faster,Houses are not required to support population;Start game with -100 Wood;Cavalry Archers cost -10% in Castle Age/ -20% in Imperial Age;Trebuchets are 35% more accurate.
Japanese, Age of Kings, Infantry, Samurai, Kataparuto, Galley line +4 line of sight,Fishing Ships have 2x HP and +2 pierce armor;Fishing Ships work +5% faster in Dark Age/ +10% in Feudal Age/ +15% in Castle Age/ +20% in Imperial Age;Lumber Camps / Mining Camps / Mills are 50% cheaper;Infantry attack 33% faster (starting in Feudal Age);Cavalry Archers +2 attack vs ranged soldiers (except skirmishers)
Koreans, The Conquerors, Tower and naval, War Wagon;Turtle Ship, Shinkichon, Villagers +3 line of sight, Stone miners work 20% faster;Ranged soldiers and infantry cost -50% wood;Warships cost -20% wood;Archer armor and tower upgrades free;Towers (except bombard towers) have +1 range in Castle Age/ +2 in Imperial Age (Eupseong stand-in)
Mayans, The Conquerors, Archer, Plumed Archer, El Dorado, Walls are 50% cheaper,Start game with 1 extra villager but -50 food;Natural resources last 20% longer;Archers cost -10% in Feudal Age/ -20% in Castle Age/ -30% in Imperial Age
Mongols, Age of Kings, Cavalry Archer, Mangudai, Drill, Scout line has +2 Line of sight,Cavalry Archers attack 25% faster;Scout line +20/30% HP in Castle/Imperial Age;Hunters work 40% faster
Persians, Age of Kings, Cavalry, War Elephant, Mahouts, Knights have +2 attack versus Archers,Start game with +50 wood and food;Town Center and Docks have 2x HP;Town Centers and Docks operate +10% faster in Feudal Age/ +15% in Castle Age/ +20% in Imperial Age;Town Centers and Docks work +5/10/15/20% faster by age
Saracens, Age of Kings, Camel and naval, Mameluke, Zealotry, Foot archers have +2 attack bonus against buildings,Market trade cost is only 5% and Markets cost -100 wood;Camel units +25% HP;Transport Ships have 2x HP and carry capacity;Galleys attack 25% faster
Spanish, The Conquerors, Gunpowder and Monk, Conquistador;Missionary, Supremacy, Trade units generate +25% Gold,Villagers construct buildings 30% faster;Blacksmith upgrades do not cost any gold;Cannon Galleons benefit from Ballistics (less reload time and more accuracy);Hand Cannoneers and Bombard Cannons reload 15% faster;Receive +20 gold for each technology researched
Teutons, Age of Kings, Infantry, Teutonic Knight, Crenellations, Units are more resistant to conversion, Monks have 2x healing range;Town Centers +10 and Towers +5 garrison capacity;Murder Holes and Herbal Medicine free;Farms cost 40% less;Barracks and Stable units +1/+2 melee armor in Castle/Imperial Age
Turks, Age of Kings, Gunpowder, Janissary, Artillery, Gunpowder units are created 25% faster,Gunpowder Units have +25% HP;Gunpowder technologies cost 50% less;Chemistry is free;Gold miners work 25% faster;Light Cavalry and Hussar upgrades are free
Vikings, Age of Kings, Infantry and naval, Berserk;Longboat, Berserkergang, Docks are 15% cheaper,Warships cost -10% in Feudal Age/ -15% in Castle Age/ -20% in Imperial Age;Infantry +20% HP starting in Feudal Age;Wheelbarrow and Hand Cart are free
Berbers, African Kingdoms, Cavalry and Naval, Camel Archer;Genitour, Kasbah;Maghrabi Camels, Genitour available at Archery Range, Villagers move +5% faster in Dark Age and +10% from Feudal Age; Stable units cost -15% in Castle Age and -20% in Imperial Age; Ships move +10% faster
Burmese, Rise of Rajas, Monk and Elephant, Arambai, Howdah;Manipur Cavalry, Relics are visible on the min map, Free lumber camp upgrades;Infantry +1 Attacks per Age (starting in Feudal Age); Monastery techs 50% cheaper
Ethiopians, African Kingdoms, Archer, Shotel Warrior, Royal Heirs;Torsion Engines, Towers and Outposts +3 LOS, Foot archers attack 18% faster;Receive +100 gold and +100 food when advancing to the next age; Pikeman upgrade free
Incas, Forgotten Empires, Infantry, Kamayuk;Slinger, Couriers;Andean Sling, Farms built 50% faster,Start with a free llama;Villagers affected by Blacksmith upgrades;Houses support 10 population;Buildings cost -15% stone;Scout Cavalry is replaced by Eagle Warrior;Military units cost -15/20/25/30% food by age
Indians, Forgotten Empires, Gunpowder and Cavalry,Elephant Archer;Imperial Camel,Sultans;Shatagni,Scout line and Camels have +2 attack vs. buildings,"Villagers cost -8% Dark, -13% Feudal, -18% Castle, -23% Imperial";Camel riders attack 20% faster;Gunpowder units +1/+1 armor
Italians, Forgotten Empires, Archer and naval, Genoese Crossbowman;Condottiero, Pavise;Silk Road, Condottiero also available in allies' barracks in Imperial Age (once you have built a castle),Advance to next age costs -15%;Dock and University technologies cost -25%;Fishing ship cost -15 wood;Gunpowder unit costs -20%;Advancing to the next age costs -15%
Khmer, Rise of Rajas, Siege and Elephant Civilization, Ballista Elephant, Tusk Swords;Double Crossbow, Scorpions have +1 range,Prereq buildings aren't required to advance to further ages or unlock other buildings;Battle Elephants are +15% faster;Villagers can garrison in Houses
Magyars, Forgotten Empires, Cavalry Infantry, Magyar Huszar, Mercenaries;Recurve Bow,Mounted archers train 25% faster,"Villagers can kill wolves with 1 strike;Forging, Iron Casting, Blast Furnace are free;Scout Cavalry, Light Cavalry, Hussar cost -15%"
Malians, African Kingdoms, Infantry, Gbeto, Tigui;Farimba, University researches +80% faster, Buildings cost -15% wood;Barracks unit +1 pierce armor per age;Villagers drop off +10% more gold
Portuguese, African Kingdoms, Naval and Gunpowder, Caravel;Organ Gun, Carrack;Arquebus, Technologies research 25% faster, All units costs -20% gold;Ships +10/15/20% HP by age;Can build Feitoria in Imperial Age
Slavs, Forgotten Empires, Cavalry, Boyars, Orthodoxy;Druzhina, Military buildings provide +5% population, Farmers works 15% faster;Siege weapons 15% cheaper;Monks move 20% faster
Vietnamese, Rise of Rajas, Archer, Rattan Archer, Chatras;Paper Money, Have access to Imperial Skirmisher Upgrade,"Reveals enemy positions at game start;Archery Range units +20% HP";Conscription free;Economic upgrades cost no wood and research 100% faster
`;

/** One civilization's design definition, as `civilizations.csv` states it. */
export interface CivProfile {
  readonly name: string;
  /** "Age of Kings", "The Conquerors", "Forgotten Empires", … */
  readonly expansion: string;
  /** The archetype line: "Infantry", "Cavalry Archer", "Tower and naval", … */
  readonly armyType: string;
  /** Unique unit names as the CSV spells them ("Chu Ko Nu"), not unit ids. */
  readonly uniqueUnits: readonly string[];
  /** Unique technology names as the CSV spells them ("Garland Wars"). */
  readonly uniqueTechnologies: readonly string[];
  /** The team bonus (the CSV occasionally lists more than one). */
  readonly teamBonuses: readonly string[];
  /** The passive civilization bonuses, one entry per semicolon-separated line. */
  readonly civilizationBonuses: readonly string[];
}

/** Semicolon-separated multi-value cell -> trimmed, non-empty entries. */
function splitList(value: string): string[] {
  return value.split(';').map((entry) => entry.trim()).filter(Boolean);
}

/** Quote-aware CSV -> header-keyed rows. Mirrors content-lib.mjs's parseCsv:
 *  a bare `"` toggles quoting anywhere in a cell (it does NOT have to wrap the
 *  whole cell), `""` is a literal quote, and every cell is trimmed. */
function parseCsvRows(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = (): void => {
    row.push(current);
    current = '';
  };
  const pushRow = (): void => {
    if (row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      pushCell();
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      pushCell();
      pushRow();
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }
  if (inQuotes) {
    throw new Error(
      'civilizations.csv ended inside a quoted cell - an unclosed double quote would '
      + 'swallow every following comma and newline into one row.',
    );
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((entry) => entry.trim());
  return dataRows.map((dataRow) => {
    const record: Record<string, string> = {};
    headers.forEach((name, column) => {
      record[name] = (dataRow[column] ?? '').trim();
    });
    return record;
  });
}

function parseProfiles(csv: string): CivProfile[] {
  return parseCsvRows(csv).map((row) => ({
    name: row.name ?? '',
    expansion: row.expansion ?? '',
    armyType: row.army_type ?? '',
    uniqueUnits: splitList(row.unique_unit ?? ''),
    uniqueTechnologies: splitList(row.unique_tech ?? ''),
    teamBonuses: splitList(row.team_bonus ?? ''),
    civilizationBonuses: splitList(row.civilization_bonus ?? ''),
  }));
}

/** Every civilization's profile, in CSV order. */
export const CIV_PROFILES: readonly CivProfile[] = parseProfiles(EMBEDDED_CIVILIZATIONS_CSV);

const PROFILES_BY_NAME = new Map<string, CivProfile>(
  CIV_PROFILES.map((profile) => [profile.name, profile]),
);

/** The named civilization's profile, or undefined for an unknown name. */
export function civProfileFor(civilization: string): CivProfile | undefined {
  return PROFILES_BY_NAME.get(civilization);
}
