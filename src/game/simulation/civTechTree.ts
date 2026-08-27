// Per-civilization TECH-TREE DENIAL (spec §11.1, v0.3.138): AoE2's
// civilizations are defined as much by their HOLES as by their bonuses — the
// Franks have no Bracer, the Spanish no Crossbowman line, the Turks no Elite
// Skirmisher or Pikeman, the mesoamerican three no stables at all, and the
// Eagle line belongs to them alone. Until this module, every civilization
// here could research and train everything.
//
// design/stats/tech-tree.csv is the spec of record (correctable data, one
// line per civ); its embedded copy below is parsed once at module load, and
// `tests/content/techTreeDenials.test.ts` guards that every id it names is a
// real technology or unit. One namespace: tech and unit ids never collide.
// Every seeded player HAS a civilization (scenarioSeedOps backfills the
// Britons/Franks defaults — a civ-less player does not exist, as in DE), so
// real holes always apply. The undefined/unknown-name path returns the full
// tree only for unseeded owners in pure-unit tests and pseudo-civ seats
// ('Player 3'+), which carry no bonuses either — consistent fail-open for
// non-civilizations, never a safety valve for real ones.

const DENIALS_BY_CIVILIZATION = new Map<string, ReadonlySet<string>>();

function loadTable(): void {
  // The embedded copy IS the runtime source — browser bundles cannot read
  // files, and the content gate asserts it and the CSV are identical.
  for (const line of EMBEDDED_TABLE.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('civilization')) continue;
    const comma = trimmed.indexOf(',');
    if (comma < 0) continue;
    const civilization = trimmed.slice(0, comma).trim();
    const denied = new Set(
      trimmed.slice(comma + 1).split(';').map((id) => id.trim()).filter(Boolean),
    );
    DENIALS_BY_CIVILIZATION.set(civilization, denied);
  }
}

/** Whether this civilization's tree DENIES the given technology or unit id. */
export function civDenies(civilization: string | undefined, id: string): boolean {
  if (!civilization) return false;
  return DENIALS_BY_CIVILIZATION.get(civilization)?.has(id) ?? false;
}

export function deniedIdsFor(civilization: string | undefined): ReadonlySet<string> {
  return (civilization && DENIALS_BY_CIVILIZATION.get(civilization)) || EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();

// The browser build cannot read design/stats at runtime, so the table is
// embedded verbatim; tests/content/techTreeDenials.test.ts asserts this copy
// and the CSV are IDENTICAL, so the two can never drift.
export const EMBEDDED_TABLE = `civilization, denied
Aztecs, scout;light-cavalry;hussar;knight;cavalier;paladin;camel;heavy-camel;cavalry-archer;heavy-cavalry-archer;hand-cannoneer;bombard-cannon;cannon-galleon;elite-cannon-galleon;light-cavalry-upgrade;hussar-upgrade;cavalier-upgrade;paladin-upgrade;heavy-camel-upgrade;heavy-cavalry-archer-upgrade;cannon-galleon-unlock;elite-cannon-galleon-upgrade;bombard-tower-unlock;bloodlines;husbandry;parthian-tactics;scale-barding-armor;chain-barding-armor;plate-barding;halberdier;halberdier-upgrade;stable
Mayans, scout;light-cavalry;hussar;knight;cavalier;paladin;camel;heavy-camel;cavalry-archer;heavy-cavalry-archer;hand-cannoneer;bombard-cannon;cannon-galleon;elite-cannon-galleon;light-cavalry-upgrade;hussar-upgrade;cavalier-upgrade;paladin-upgrade;heavy-camel-upgrade;heavy-cavalry-archer-upgrade;cannon-galleon-unlock;elite-cannon-galleon-upgrade;bombard-tower-unlock;bloodlines;husbandry;parthian-tactics;scale-barding-armor;chain-barding-armor;plate-barding;blast-furnace;stable;champion;champion-upgrade
Incas, scout;light-cavalry;hussar;knight;cavalier;paladin;camel;heavy-camel;cavalry-archer;heavy-cavalry-archer;hand-cannoneer;bombard-cannon;cannon-galleon;elite-cannon-galleon;light-cavalry-upgrade;hussar-upgrade;cavalier-upgrade;paladin-upgrade;heavy-camel-upgrade;heavy-cavalry-archer-upgrade;cannon-galleon-unlock;elite-cannon-galleon-upgrade;bombard-tower-unlock;bloodlines;husbandry;parthian-tactics;scale-barding-armor;chain-barding-armor;plate-barding;stable
Britons, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;cavalry-archer;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;parthian-tactics;bloodlines;thumb-ring;hand-cannoneer;paladin;paladin-upgrade;bombard-cannon
Franks, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;bracer;bloodlines;arbalest;arbalest-upgrade;halberdier;halberdier-upgrade;bombard-cannon
Celts, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;bracer;thumb-ring;bloodlines;arbalest;arbalest-upgrade;hand-cannoneer;paladin;paladin-upgrade;redemption;atonement;bombard-cannon
Teutons, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;bracer;husbandry;light-cavalry;hussar;light-cavalry-upgrade;hussar-upgrade;thumb-ring
Goths, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;stone-wall;stone-gate;fortified-wall;keep;architecture;hoardings;bombard-tower-unlock
Vikings, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;bloodlines;cavalry-archer;heavy-cavalry-archer;heavy-cavalry-archer-upgrade;parthian-tactics;fire-ship;fast-fire-ship;fast-fire-ship-upgrade;hand-cannoneer;bombard-cannon;paladin;paladin-upgrade;cannon-galleon;elite-cannon-galleon;cannon-galleon-unlock;elite-cannon-galleon-upgrade
Huns, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;fortified-wall;keep;bombard-tower-unlock;two-man-saw
Magyars, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;redemption;block-printing
Slavs, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;thumb-ring;bracer
Saracens, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;halberdier;halberdier-upgrade;paladin;paladin-upgrade
Persians, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;arbalest;arbalest-upgrade;two-man-saw
Turks, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;elite-skirmisher;elite-skirmisher-upgrade;pikeman;halberdier;pikeman-upgrade;halberdier-upgrade;onager;siege-onager;onager-upgrade;siege-onager-upgrade;paladin;paladin-upgrade
Berbers, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;paladin;paladin-upgrade;bracer
Malians, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;blast-furnace;paladin;paladin-upgrade
Ethiopians, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;bloodlines;paladin;paladin-upgrade
Indians, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;knight;cavalier;paladin;cavalier-upgrade;paladin-upgrade
Chinese, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;paladin;paladin-upgrade;hand-cannoneer;bombard-cannon
Japanese, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;bloodlines;hussar;hussar-upgrade;paladin;paladin-upgrade
Koreans, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;paladin;paladin-upgrade;bloodlines
Mongols, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;paladin;paladin-upgrade;halberdier;halberdier-upgrade
Vietnamese, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;blast-furnace
Khmer, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;pikeman;halberdier;pikeman-upgrade;halberdier-upgrade
Burmese, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;padded-archer-armor;leather-archer-armor;ring-archer-armor
Byzantines, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;bloodlines;blast-furnace;siege-engineers
Italians, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;paladin;paladin-upgrade;bloodlines
Portuguese, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;paladin;paladin-upgrade
Spanish, eagle-warrior;elite-eagle-warrior;elite-eagle-warrior-upgrade;camel;heavy-camel;heavy-camel-upgrade;crossbowman;arbalest;crossbowman-upgrade;arbalest-upgrade
`;

loadTable();
